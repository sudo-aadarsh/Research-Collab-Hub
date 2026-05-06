"""
modules/references/routes.py - References / Citations REST API.

Endpoints:
  POST   /references/              - Add a reference
  GET    /references/              - Search references
  GET    /references/{ref_id}      - Get reference detail
  PATCH  /references/{ref_id}      - Update reference
  DELETE /references/{ref_id}      - Delete reference
  POST   /papers/{paper_id}/references/{ref_id} - Link reference to paper
  DELETE /papers/{paper_id}/references/{ref_id} - Unlink reference
  GET    /papers/{paper_id}/references          - List references for a paper
  GET    /references/{ref_id}/bibtex            - Export as BibTeX
"""
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from .models import Reference, PaperReference
from backend.modules.users.models import User

router = APIRouter(tags=["References"])


# ── Schemas ───────────────────────────────────────────────────────────────

class ReferenceCreate(BaseModel):
    title:        str
    authors:      List[str] = []
    year:         Optional[int] = None
    doi:          Optional[str] = None
    arxiv_id:     Optional[str] = None
    journal:      Optional[str] = None
    conference:   Optional[str] = None
    url:          Optional[str] = None
    citation_key: Optional[str] = None
    abstract:     Optional[str] = None
    tags:         List[str] = []

class ReferenceUpdate(BaseModel):
    title:        Optional[str] = None
    authors:      Optional[List[str]] = None
    year:         Optional[int] = None
    doi:          Optional[str] = None
    journal:      Optional[str] = None
    conference:   Optional[str] = None
    url:          Optional[str] = None
    abstract:     Optional[str] = None
    tags:         Optional[List[str]] = None

class LinkReference(BaseModel):
    context: Optional[str] = None  # how the reference is used in the paper


def _ref_dict(r: Reference) -> dict:
    return {
        "id":           str(r.id),
        "title":        r.title,
        "authors":      r.authors or [],
        "year":         r.year,
        "doi":          r.doi,
        "arxiv_id":     r.arxiv_id,
        "journal":      r.journal,
        "conference":   r.conference,
        "url":          r.url,
        "citation_key": r.citation_key,
        "abstract":     r.abstract,
        "tags":         r.tags or [],
        "created_at":   r.created_at.isoformat(),
    }


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/references", status_code=201)
def create_reference(
    payload:      ReferenceCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Add a new reference to the library."""
    # Auto-generate BibTeX key if not provided
    citation_key = payload.citation_key
    if not citation_key and payload.authors:
        first_author = payload.authors[0].split()[-1].lower()  # last name
        year = payload.year or "xxxx"
        # First word of title
        first_word = payload.title.split()[0].lower().strip(".,:")
        citation_key = f"{first_author}{year}{first_word}"

    ref = Reference(
        title=payload.title,
        authors=payload.authors,
        year=payload.year,
        doi=payload.doi,
        arxiv_id=payload.arxiv_id,
        journal=payload.journal,
        conference=payload.conference,
        url=payload.url,
        citation_key=citation_key,
        abstract=payload.abstract,
        tags=payload.tags,
        added_by=current_user.id,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return _ref_dict(ref)


@router.get("/references")
def list_references(
    search:  Optional[str] = Query(None, description="Search title, authors, abstract"),
    tag:     Optional[str] = None,
    year:    Optional[int] = None,
    journal: Optional[str] = None,
    skip:    int = 0,
    limit:   int = 20,
    db:      Session = Depends(get_db),
):
    """Search the global reference library."""
    q = db.query(Reference)

    if search:
        q = q.filter(
            Reference.title.ilike(f"%{search}%") |
            Reference.abstract.ilike(f"%{search}%")
        )
    if tag:
        q = q.filter(Reference.tags.contains([tag]))
    if year:
        q = q.filter(Reference.year == year)
    if journal:
        q = q.filter(Reference.journal.ilike(f"%{journal}%"))

    total = q.count()
    refs = q.order_by(Reference.year.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_ref_dict(r) for r in refs]}


@router.get("/references/{ref_id}")
def get_reference(ref_id: UUID, db: Session = Depends(get_db)):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(404, "Reference not found")
    return _ref_dict(ref)


@router.patch("/references/{ref_id}")
def update_reference(
    ref_id:       UUID,
    payload:      ReferenceUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(404, "Reference not found")
    if str(ref.added_by) != str(current_user.id) and current_user.role != 'admin':
        raise HTTPException(403, "Not authorized to edit this reference")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ref, field, value)
    db.commit()
    db.refresh(ref)
    return _ref_dict(ref)


@router.delete("/references/{ref_id}", status_code=204)
def delete_reference(
    ref_id:       UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(404)
    if str(ref.added_by) != str(current_user.id) and current_user.role != 'admin':
        raise HTTPException(403, "Not authorized")
    db.delete(ref)
    db.commit()


# ── Paper ↔ Reference linking ─────────────────────────────────────────────

@router.post("/papers/{paper_id}/references/{ref_id}", status_code=201)
def link_reference_to_paper(
    paper_id:     UUID,
    ref_id:       UUID,
    payload:      LinkReference = LinkReference(),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Attach a reference to a paper (cite it)."""
    existing = db.query(PaperReference).filter_by(
        paper_id=paper_id, reference_id=ref_id
    ).first()
    if existing:
        raise HTTPException(409, "Reference already linked to this paper")

    link = PaperReference(
        paper_id=paper_id,
        reference_id=ref_id,
        context=payload.context,
    )
    db.add(link)
    db.commit()
    return {"message": "Reference linked to paper"}


@router.delete("/papers/{paper_id}/references/{ref_id}", status_code=204)
def unlink_reference(
    paper_id: UUID,
    ref_id:   UUID,
    db:       Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(PaperReference).filter_by(
        paper_id=paper_id, reference_id=ref_id
    ).delete()
    db.commit()


@router.get("/papers/{paper_id}/references")
def get_paper_references(paper_id: UUID, db: Session = Depends(get_db)):
    """Get all references cited in a specific paper."""
    links = db.query(PaperReference).filter_by(paper_id=paper_id).all()
    return [
        {
            **_ref_dict(link.reference),
            "context": link.context,
        }
        for link in links
    ]


# ── BibTeX Export ─────────────────────────────────────────────────────────

@router.get("/references/{ref_id}/bibtex")
def export_bibtex(ref_id: UUID, db: Session = Depends(get_db)):
    """Export a reference as a BibTeX entry."""
    ref = db.query(Reference).filter(Reference.id == ref_id).first()
    if not ref:
        raise HTTPException(404, "Reference not found")

    entry_type = "inproceedings" if ref.conference else "article"
    key = ref.citation_key or f"ref_{str(ref.id)[:8]}"
    authors_str = " and ".join(ref.authors or ["Unknown Author"])

    lines = [f"@{entry_type}{{{key},"]
    lines.append(f'  title     = {{{ref.title}}},')
    lines.append(f'  author    = {{{authors_str}}},')
    if ref.year:
        lines.append(f'  year      = {{{ref.year}}},')
    if ref.journal:
        lines.append(f'  journal   = {{{ref.journal}}},')
    if ref.conference:
        lines.append(f'  booktitle = {{{ref.conference}}},')
    if ref.doi:
        lines.append(f'  doi       = {{{ref.doi}}},')
    if ref.url:
        lines.append(f'  url       = {{{ref.url}}},')
    lines.append("}")

    bibtex = "\n".join(lines)
    return {"bibtex": bibtex, "key": key}


@router.get("/papers/{paper_id}/references/export/bibtex")
def export_paper_references_bibtex(paper_id: UUID, db: Session = Depends(get_db)):
    """Export ALL references of a paper as a BibTeX file content."""
    links = db.query(PaperReference).filter_by(paper_id=paper_id).all()
    if not links:
        return {"bibtex": "", "count": 0}

    entries = []
    for link in links:
        r = link.reference
        entry_type = "inproceedings" if r.conference else "article"
        key = r.citation_key or f"ref_{str(r.id)[:8]}"
        authors_str = " and ".join(r.authors or ["Unknown"])
        entry = f"@{entry_type}{{{key},\n  title  = {{{r.title}}},\n  author = {{{authors_str}}},"
        if r.year:       entry += f"\n  year   = {{{r.year}}},"
        if r.journal:    entry += f"\n  journal= {{{r.journal}}},"
        if r.conference: entry += f"\n  booktitle = {{{r.conference}}},"
        if r.doi:        entry += f"\n  doi    = {{{r.doi}}},"
        entry += "\n}"
        entries.append(entry)

    return {"bibtex": "\n\n".join(entries), "count": len(entries)}
