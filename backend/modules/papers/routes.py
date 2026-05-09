"""
modules/papers/routes.py - REST API for the Papers module.

Endpoints:
  POST   /papers/              - Create paper
  POST   /papers/upload        - Create paper with file upload
  GET    /papers/              - List/search papers
  GET    /papers/{paper_id}    - Get paper detail
  PATCH  /papers/{paper_id}    - Update paper
  DELETE /papers/{paper_id}    - Delete paper
  PATCH  /papers/{id}/status   - Change status
  POST   /papers/{id}/authors  - Add author
  GET    /papers/{id}/versions - List versions
"""
from uuid import UUID
from typing import List, Optional
from datetime import date
import json
import os
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
import mimetypes
from pydantic import BaseModel, Field
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from .models import Paper, PaperAuthor, PaperVersion
from backend.modules.users.models import User

router = APIRouter(prefix="/papers", tags=["Papers"])


# ── Schemas ───────────────────────────────────────────────────────────────

class PaperCreate(BaseModel):
    title:      str
    abstract:   Optional[str] = None
    keywords:   List[str] = []
    project_id: Optional[str] = None
    doi:        Optional[str] = None

class PaperUpdate(BaseModel):
    title:       Optional[str] = None
    abstract:    Optional[str] = None
    keywords:    Optional[List[str]] = None
    doi:         Optional[str] = None
    arxiv_id:    Optional[str] = None
    pdf_url:     Optional[str] = None
    word_count:  Optional[int] = None
    page_count:  Optional[int] = None

class StatusUpdate(BaseModel):
    status:          str = Field(..., pattern="^(draft|in_review|submitted|accepted|rejected|published)$")
    submission_date: Optional[date] = None
    published_date:  Optional[date] = None

class AuthorAdd(BaseModel):
    user_id:          Optional[str] = None   # registered user
    author_name:      str
    author_email:     Optional[str] = None
    order_index:      int = 0
    is_corresponding: bool = False


def _paper_to_dict(p: Paper, include_authors: bool = True) -> dict:
    result = {
        "id":             str(p.id),
        "title":          p.title,
        "abstract":       p.abstract,
        "keywords":       p.keywords or [],
        "status":         p.status,
        "doi":            p.doi,
        "arxiv_id":       p.arxiv_id,
        "pdf_url":        p.pdf_url,
        "word_count":     p.word_count,
        "page_count":     p.page_count,
        "submission_date": str(p.submission_date) if p.submission_date else None,
        "published_date":  str(p.published_date)  if p.published_date  else None,
        "version":        p.version,
        "project_id":     str(p.project_id) if p.project_id else None,
        "created_at":     p.created_at.isoformat(),
        "updated_at":     p.updated_at.isoformat(),
    }
    if include_authors:
        result["authors"] = [
            {
                "id":               str(a.id),
                "user_id":          str(a.user_id) if a.user_id else None,
                "author_name":      a.author_name,
                "author_email":     a.author_email,
                "order_index":      a.order_index,
                "is_corresponding": a.is_corresponding,
            }
            for a in sorted(p.authors, key=lambda x: x.order_index)
        ]
    return result


# ── PDF / DOCX text extraction helpers ──────────────────────────────────────

def _extract_pdf_text(contents: bytes, max_chars: int = 3000) -> str:
    """
    Extract text from PDF bytes using the best available library.
    Tries pypdf (modern) first, falls back to PyPDF2 (legacy).
    """
    import logging
    log = logging.getLogger(__name__)

    # --- attempt 1: pypdf (modern, actively maintained) ---
    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(contents))
        pages_text = []
        for page in reader.pages:
            try:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            except Exception:
                continue
        if pages_text:
            result = " ".join(pages_text)
            result = " ".join(result.split())  # collapse whitespace
            return result[:max_chars]
    except ImportError:
        pass
    except Exception as e:
        log.warning("pypdf extraction failed: %s", e)

    # --- attempt 2: PyPDF2 (legacy) ---
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(BytesIO(contents))
        pages_text = []
        for page in reader.pages:
            try:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            except Exception:
                continue
        if pages_text:
            result = " ".join(pages_text)
            result = " ".join(result.split())
            return result[:max_chars]
    except ImportError:
        pass
    except Exception as e:
        log.warning("PyPDF2 extraction failed: %s", e)

    return "[PDF content could not be extracted from this file]"


def _extract_docx_text(contents: bytes, max_chars: int = 3000) -> str:
    """Extract text from DOCX bytes using python-docx."""
    try:
        from docx import Document
        doc = Document(BytesIO(contents))
        paras = [p.text for p in doc.paragraphs if p.text.strip()]
        result = " ".join(paras)
        result = " ".join(result.split())
        return result[:max_chars] if result else "[Word document has no readable text]"
    except ImportError:
        return "[Word document uploaded - python-docx library not available]"
    except Exception as e:
        return f"[Word document extraction failed: {e}]"


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def create_paper(
    payload:      PaperCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Create a new paper and add the creator as first author."""
    paper = Paper(
        title=payload.title,
        abstract=payload.abstract,
        keywords=payload.keywords,
        project_id=UUID(payload.project_id) if payload.project_id else None,
        doi=payload.doi,
    )
    db.add(paper)
    db.flush()  # get paper.id without committing

    # Auto-add creator as first author
    db.add(PaperAuthor(
        paper_id=paper.id,
        user_id=current_user.id,
        author_name=current_user.full_name,
        author_email=current_user.email,
        order_index=0,
        is_corresponding=True,
    ))
    db.commit()
    db.refresh(paper)
    return _paper_to_dict(paper)


@router.post("/upload", status_code=201)
async def create_paper_with_upload(
    title:        str = Form(...),
    abstract:     Optional[str] = Form(None),
    keywords:     str = Form("[]"),
    file:         Optional[UploadFile] = File(None),
    project_id:   Optional[str] = Form(None),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Create a new paper with optional file upload (PDF, DOCX, or text)."""
    try:
        # Parse keywords JSON
        keywords_list = json.loads(keywords) if isinstance(keywords, str) else keywords
        if isinstance(keywords_list, str):
            keywords_list = [k.strip() for k in keywords_list.split(',') if k.strip()]
    except:
        keywords_list = []

    # Create storage directory if it doesn't exist
    storage_dir = Path("/tmp/papers_storage")
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Extract text from file if provided
    extracted_text = ""
    pdf_url = None
    original_filename = None
    
    if file:
        try:
            contents = await file.read()
            original_filename = file.filename
            file_extension = Path(file.filename).suffix.lower()
            
            # Handle PDF files
            if file.content_type == 'application/pdf' or file_extension == '.pdf':
                extracted_text = _extract_pdf_text(contents)
            
            # Handle Word documents
            elif file.content_type in ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] or file_extension in ['.doc', '.docx']:
                extracted_text = _extract_docx_text(contents)
            
            # Handle plain text files
            elif file.content_type == 'text/plain' or file_extension == '.txt':
                extracted_text = contents.decode('utf-8', errors='ignore')[:2000]
            
            # Save file to storage
            try:
                # Generate unique filename with paper title and random suffix
                import uuid as uuid_module
                import urllib.parse
                safe_title = "".join(c for c in title if c.isalnum() or c in ('-', '_')).strip()[:50]
                safe_title = safe_title.replace(' ', '_')
                unique_id = str(uuid_module.uuid4())[:8]
                filename = f"{safe_title}_{unique_id}{file_extension}"
                filepath = storage_dir / filename
                
                with open(filepath, 'wb') as f:
                    f.write(contents)
                
                # Store relative path for serving (URL-encode to handle any special chars)
                pdf_url = f"/papers/download/{urllib.parse.quote(filename)}"
            except Exception as e:
                pdf_url = None
        
        except Exception as e:
            extracted_text = f"[File upload processed, but content could not be extracted: {str(e)}]"

    # Use extracted text as abstract if not provided
    if not abstract and extracted_text:
        # Skip placeholder text - don't store it as abstract
        PLACEHOLDER_MARKERS = ["[PDF file uploaded", "[PDF content could not", "content extraction requires"]
        if not any(m in extracted_text for m in PLACEHOLDER_MARKERS):
            abstract = extracted_text[:1500]  # more context for better AI summaries

    # Create paper
    paper = Paper(
        title=title,
        abstract=abstract,
        keywords=keywords_list,
        project_id=UUID(project_id) if project_id else None,
        pdf_url=pdf_url,  # Store the file URL
    )
    db.add(paper)
    db.flush()

    # Auto-add creator as first author
    db.add(PaperAuthor(
        paper_id=paper.id,
        user_id=current_user.id,
        author_name=current_user.full_name,
        author_email=current_user.email,
        order_index=0,
        is_corresponding=True,
    ))
    db.commit()
    db.refresh(paper)
    return _paper_to_dict(paper)


@router.get("/download/{filename}")
def download_paper_file(filename: str):
    """Download a paper file. Files are served from storage."""
    import urllib.parse
    # URL-decode the filename (it was URL-encoded when stored)
    filename = urllib.parse.unquote(filename)
    
    # Sanitize filename to prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    
    storage_dir = Path("/tmp/papers_storage")
    filepath = storage_dir / filename
    
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    
    # Verify file is in storage directory (security check)
    try:
        filepath.resolve().relative_to(storage_dir.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")
    
    # Determine content type for inline viewing
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = 'application/octet-stream'
    
    # Check if browser can display inline (PDF, images, text)
    is_inline = content_type in [
        'application/pdf',
        'image/png', 'image/jpeg', 'image/gif', 'image/webp',
        'text/plain', 'text/html',
    ]
    
    return Response(
        content=filepath.read_bytes(),
        media_type=content_type,
        headers={
            "Content-Disposition": f"{'inline' if is_inline else 'attachment'}; filename=\"{filename}\""
        }
    )


@router.get("/")
def list_papers(
    search:     Optional[str] = Query(None, description="Full-text search on title/abstract"),
    status:     Optional[str] = None,
    project_id: Optional[str] = None,
    keyword:    Optional[str] = None,
    author_id:  Optional[str] = None,
    skip:       int = 0,
    limit:      int = 20,
    db:         Session = Depends(get_db),
):
    """List papers with optional filters. Public endpoint."""
    q = db.query(Paper)

    if search:
        q = q.filter(
            or_(
                Paper.title.ilike(f"%{search}%"),
                Paper.abstract.ilike(f"%{search}%"),
            )
        )
    if status:
        q = q.filter(Paper.status == status)
    if project_id:
        q = q.filter(Paper.project_id == UUID(project_id))
    if keyword:
        q = q.filter(Paper.keywords.contains([keyword]))
    if author_id:
        q = q.join(PaperAuthor).filter(PaperAuthor.user_id == UUID(author_id))

    total = q.count()
    papers = q.order_by(Paper.updated_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [_paper_to_dict(p, include_authors=False) for p in papers]
    }


@router.get("/{paper_id}")
def get_paper(paper_id: UUID, db: Session = Depends(get_db)):
    """Get full paper detail with authors."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")
    return _paper_to_dict(paper)


@router.patch("/{paper_id}")
def update_paper(
    paper_id:     UUID,
    payload:      PaperUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Update paper fields. Only authors can edit."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")

    # Check author permission
    is_author = db.query(PaperAuthor).filter_by(
        paper_id=paper_id, user_id=current_user.id
    ).first()
    
    is_project_member = False
    if paper.project_id:
        from backend.modules.projects.models import ProjectMember
        is_project_member = db.query(ProjectMember).filter_by(
            project_id=paper.project_id, user_id=current_user.id
        ).first()

    if not is_author and not is_project_member and current_user.role != 'admin':
        raise HTTPException(403, "Not an author or project member of this paper")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(paper, field, value)
    db.commit()
    db.refresh(paper)
    return _paper_to_dict(paper)


@router.patch("/{paper_id}/status")
def update_status(
    paper_id:     UUID,
    payload:      StatusUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Transition paper status (draft → in_review → submitted → accepted/rejected → published)."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")

    is_author = db.query(PaperAuthor).filter_by(
        paper_id=paper_id, user_id=current_user.id
    ).first()
    
    is_project_member = False
    if paper.project_id:
        from backend.modules.projects.models import ProjectMember
        is_project_member = db.query(ProjectMember).filter_by(
            project_id=paper.project_id, user_id=current_user.id
        ).first()

    if not is_author and not is_project_member and current_user.role != 'admin':
        raise HTTPException(403, "Not an author or project member of this paper")

    paper.status = payload.status
    if payload.submission_date:
        paper.submission_date = payload.submission_date
    if payload.published_date:
        paper.published_date = payload.published_date
    db.commit()
    return {"message": f"Status updated to {payload.status}"}


@router.delete("/{paper_id}", status_code=204)
def delete_paper(
    paper_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")
    # Only first author (index 0) or admin can delete
    lead = db.query(PaperAuthor).filter_by(paper_id=paper_id, order_index=0).first()
    if not lead or (str(lead.user_id) != str(current_user.id) and current_user.role != 'admin'):
        raise HTTPException(403, "Only the lead author can delete this paper")
    db.delete(paper)
    db.commit()


@router.post("/{paper_id}/authors", status_code=201)
def add_author(
    paper_id:     UUID,
    payload:      AuthorAdd,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Add an author to a paper."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")

    is_author = db.query(PaperAuthor).filter_by(
        paper_id=paper_id, user_id=current_user.id
    ).first()
    
    is_project_member = False
    if paper.project_id:
        from backend.modules.projects.models import ProjectMember
        is_project_member = db.query(ProjectMember).filter_by(
            project_id=paper.project_id, user_id=current_user.id
        ).first()

    if not is_author and not is_project_member and current_user.role != 'admin':
        raise HTTPException(403, "Not an author or project member of this paper")

    author = PaperAuthor(
        paper_id=paper_id,
        user_id=UUID(payload.user_id) if payload.user_id else None,
        author_name=payload.author_name,
        author_email=payload.author_email,
        order_index=payload.order_index,
        is_corresponding=payload.is_corresponding,
    )
    db.add(author)
    db.commit()
    return {"message": "Author added"}


@router.get("/{paper_id}/versions")
def get_versions(paper_id: UUID, db: Session = Depends(get_db)):
    """List all archived versions of a paper."""
    versions = db.query(PaperVersion).filter_by(paper_id=paper_id)\
                 .order_by(PaperVersion.version.desc()).all()
    return [
        {
            "version":    v.version,
            "pdf_url":    v.pdf_url,
            "change_log": v.change_log,
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


# ── Join Paper ────────────────────────────────────────────────────────────

@router.post("/{paper_id}/join")
def join_paper(
    paper_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Paper).filter(Paper.id == paper_id).first()
    if not p:
        raise HTTPException(404, "Paper not found")
        
    existing = db.query(PaperAuthor).filter_by(
        paper_id=paper_id, user_id=current_user.id
    ).first()
    
    if existing:
        return {"message": "Already an author"}
        
    # Add as author with current max order index + 1
    max_order = db.query(func.max(PaperAuthor.order_index)).filter_by(paper_id=paper_id).scalar() or 0
    db.add(PaperAuthor(paper_id=paper_id, user_id=current_user.id, author_name=current_user.full_name, author_email=current_user.email, order_index=max_order + 1))
    db.commit()
    return {"message": "Successfully joined paper"}

# ── Chat Messages ─────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    message: str

@router.get("/{paper_id}/messages")
def get_paper_messages(
    paper_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from .models import PaperMessage
    msgs = db.query(PaperMessage).filter_by(paper_id=paper_id).order_by(PaperMessage.created_at.asc()).all()
    return [
        {
            "id": str(m.id),
            "paper_id": str(m.paper_id),
            "user_id": str(m.user_id) if m.user_id else None,
            "user_name": m.user.full_name if m.user else "Unknown",
            "message": m.message,
            "created_at": m.created_at
        }
        for m in msgs
    ]

@router.post("/{paper_id}/messages", status_code=201)
def post_paper_message(
    paper_id:     UUID,
    payload:      MessageCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from .models import PaperMessage
    msg = PaperMessage(
        paper_id=paper_id,
        user_id=current_user.id,
        message=payload.message
    )
    db.add(msg)
    db.commit()
    return {"message": "Message sent"}
