"""
modules/projects/routes.py - REST API for the Projects module.
"""
import json
import uuid as uuid_module
from uuid import UUID
from typing import List, Optional
from datetime import date, datetime, timezone
from pathlib import Path
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
import mimetypes

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from .models import Project, ProjectMember, ProjectMilestone
from backend.modules.users.models import User

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ───────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title:        str
    description:  Optional[str] = None
    start_date:   Optional[date] = None
    end_date:     Optional[date] = None
    tags:         List[str] = []
    is_public:    bool = False
    funding_info: Optional[str] = None

class ProjectUpdate(BaseModel):
    title:        Optional[str] = None
    description:  Optional[str] = None
    status:       Optional[str] = None
    start_date:   Optional[date] = None
    end_date:     Optional[date] = None
    tags:         Optional[List[str]] = None
    is_public:    Optional[bool] = None
    funding_info: Optional[str] = None

class MemberAdd(BaseModel):
    user_id: str
    role:    str = "contributor"

class MilestoneCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    due_date:    Optional[date] = None


def _project_dict(p: Project, include_members: bool = False) -> dict:
    d = {
        "id":          str(p.id),
        "title":       p.title,
        "description": p.description,
        "status":      p.status,
        "owner_id":    str(p.owner_id),
        "start_date":  str(p.start_date) if p.start_date else None,
        "end_date":    str(p.end_date)   if p.end_date   else None,
        "tags":        p.tags or [],
        "is_public":   p.is_public,
        "funding_info": p.funding_info,
        "file_url":    p.file_url,
        "created_at":  p.created_at.isoformat(),
        # Progress metrics
        "milestone_total":     len(p.milestones),
        "milestone_completed": sum(1 for m in p.milestones if m.completed_at),
        "paper_count":         len(p.papers),
    }
    if include_members:
        d["members"] = [
            {"user_id": str(m.user_id), "role": m.role,
             "name": m.user.full_name if m.user else None}
            for m in p.members
        ]
        d["milestones"] = [
            {
                "id":           str(ms.id),
                "title":        ms.title,
                "description":  ms.description,
                "due_date":     str(ms.due_date) if ms.due_date else None,
                "completed_at": ms.completed_at,
            }
            for ms in p.milestones
        ]
    return d


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def create_project(
    payload:      ProjectCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    project = Project(
        title=payload.title,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
        tags=payload.tags,
        is_public=payload.is_public,
        funding_info=payload.funding_info,
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()
    # Add owner as lead member
    db.add(ProjectMember(project_id=project.id, user_id=current_user.id, role='lead'))
    db.commit()
    db.refresh(project)
    return _project_dict(project, include_members=True)


@router.get("/")
def list_projects(
    search:    Optional[str] = None,
    status:    Optional[str] = None,
    tag:       Optional[str] = None,
    my_only:   bool = False,
    skip:      int = 0,
    limit:     int = 20,
    db:        Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    q = db.query(Project)

    if not (current_user and current_user.role == 'admin'):
        # Non-admins only see public projects or their own
        if my_only and current_user:
            q = q.filter(Project.owner_id == current_user.id)
        elif current_user:
            q = q.filter(
                (Project.is_public == True) | (Project.owner_id == current_user.id)
            )
        else:
            q = q.filter(Project.is_public == True)

    if search:
        q = q.filter(
            Project.title.ilike(f"%{search}%") |
            Project.description.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(Project.status == status)
    if tag:
        q = q.filter(Project.tags.contains([tag]))

    total = q.count()
    projects = q.order_by(Project.updated_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_project_dict(p) for p in projects]}


@router.get("/{project_id}")
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return _project_dict(p, include_members=True)


@router.patch("/{project_id}")
def update_project(
    project_id:   UUID,
    payload:      ProjectUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    is_member = db.query(ProjectMember).filter_by(
        project_id=project_id, user_id=current_user.id
    ).first()
    if str(p.owner_id) != str(current_user.id) and not is_member and current_user.role != 'admin':
        raise HTTPException(403, "Only project members can update it")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    return _project_dict(p, include_members=True)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id:   UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if str(p.owner_id) != str(current_user.id) and current_user.role != 'admin':
        raise HTTPException(403, "Not authorized")
    db.delete(p)
    db.commit()


# ── File Upload / Download ────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def create_project_with_upload(
    title:        str = Form(...),
    description:  Optional[str] = Form(None),
    tags:         str = Form("[]"),
    is_public:    str = Form("false"),
    file:         Optional[UploadFile] = File(None),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Create a new project with optional file upload (any type)."""
    tags_list = json.loads(tags) if isinstance(tags, str) else tags
    # FastAPI treats bool Form fields incorrectly ("false" -> True).
    # Parse manually instead.
    is_public_bool = is_public.lower() == 'true' if is_public else False

    storage_dir = Path("/tmp/projects_storage")
    storage_dir.mkdir(parents=True, exist_ok=True)

    file_url = None
    if file:
        contents = await file.read()
        import urllib.parse
        safe_title = "".join(c for c in title if c.isalnum() or c in ('-', '_')).strip()[:50]
        safe_title = safe_title.replace(' ', '_')
        unique_id = str(uuid_module.uuid4())[:8]
        ext = Path(file.filename).suffix.lower() if file.filename else ''
        filename = f"{safe_title}_{unique_id}{ext}"
        filepath = storage_dir / filename
        with open(filepath, 'wb') as f:
            f.write(contents)
        file_url = f"/api/v1/projects/download/{urllib.parse.quote(filename)}"

    project = Project(
        title=title,
        description=description,
        tags=tags_list,
        is_public=is_public_bool,
        file_url=file_url,
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=current_user.id, role='lead'))
    db.commit()
    db.refresh(project)
    return _project_dict(project, include_members=True)


@router.get("/download/{filename}")
def download_project_file(filename: str):
    """Download a project file."""
    import urllib.parse
    filename = urllib.parse.unquote(filename)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename")
    storage_dir = Path("/tmp/projects_storage")
    filepath = storage_dir / filename
    if not filepath.exists():
        raise HTTPException(404, "File not found")
    try:
        filepath.resolve().relative_to(storage_dir.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = 'application/octet-stream'
    return Response(
        content=filepath.read_bytes(),
        media_type=content_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\""
        }
    )


# ── Members ───────────────────────────────────────────────────────────────

@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id:   UUID,
    payload:      MemberAdd,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if str(p.owner_id) != str(current_user.id) and current_user.role != 'admin':
        raise HTTPException(403, "Not authorized")

    existing = db.query(ProjectMember).filter_by(
        project_id=project_id, user_id=UUID(payload.user_id)
    ).first()
    if existing:
        raise HTTPException(409, "User already a member")

    db.add(ProjectMember(project_id=project_id, user_id=UUID(payload.user_id), role=payload.role))
    db.commit()
    return {"message": "Member added"}


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id:   UUID,
    user_id:      UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404)
    if str(p.owner_id) != str(current_user.id) and current_user.role != 'admin':
        raise HTTPException(403, "Not authorized")

    db.query(ProjectMember).filter_by(project_id=project_id, user_id=user_id).delete()
    db.commit()


# ── Milestones ────────────────────────────────────────────────────────────

@router.post("/{project_id}/milestones", status_code=201)
def add_milestone(
    project_id:   UUID,
    payload:      MilestoneCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    milestone = ProjectMilestone(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
    )
    db.add(milestone)
    db.commit()
    return {"message": "Milestone created", "id": str(milestone.id)}


@router.patch("/{project_id}/milestones/{milestone_id}/complete")
def complete_milestone(
    project_id:   UUID,
    milestone_id: UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    m = db.query(ProjectMilestone).filter_by(
        id=milestone_id, project_id=project_id
    ).first()
    if not m:
        raise HTTPException(404, "Milestone not found")
    m.completed_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"message": "Milestone completed"}


# ── Join Project ──────────────────────────────────────────────────────────

@router.post("/{project_id}/join")
def join_project(
    project_id:   UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
        
    existing = db.query(ProjectMember).filter_by(
        project_id=project_id, user_id=current_user.id
    ).first()
    
    if existing:
        return {"message": "Already a member"}
        
    db.add(ProjectMember(project_id=project_id, user_id=current_user.id, role='contributor'))
    db.commit()
    return {"message": "Successfully joined project"}


# ── Chat Messages ─────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    message: str

@router.get("/{project_id}/messages")
def get_messages(
    project_id:   UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from .models import ProjectMessage
    msgs = db.query(ProjectMessage).filter_by(project_id=project_id).order_by(ProjectMessage.created_at.asc()).all()
    return [
        {
            "id": str(m.id),
            "project_id": str(m.project_id),
            "user_id": str(m.user_id) if m.user_id else None,
            "user_name": m.user.full_name if m.user else "Unknown",
            "message": m.message,
            "created_at": m.created_at
        }
        for m in msgs
    ]

@router.post("/{project_id}/messages", status_code=201)
def post_message(
    project_id:   UUID,
    payload:      MessageCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from .models import ProjectMessage
    msg = ProjectMessage(
        project_id=project_id,
        user_id=current_user.id,
        message=payload.message
    )
    db.add(msg)
    db.commit()
    return {"message": "Message sent"}

