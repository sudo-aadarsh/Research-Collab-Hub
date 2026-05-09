"""
modules/collaborations/routes.py - Collaboration requests + AI recommendations.
"""
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from .models import CollaborationRequest, AICollabRec
from backend.modules.users.models import User

router = APIRouter(prefix="/collaborations", tags=["Collaborations"])


class RequestCreate(BaseModel):
    target_id:  Optional[str] = None
    target_email: Optional[str] = None
    message:    Optional[str] = None
    project_id: Optional[str] = None
    paper_id:   Optional[str] = None

class RequestRespond(BaseModel):
    status: str   # 'accepted' | 'declined'


@router.post("/requests", status_code=201)
def send_request(
    payload:      RequestCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Send a collaboration request to another researcher."""
    if not payload.target_id and not payload.target_email:
        raise HTTPException(400, "Must provide target_id or target_email")

    target = None
    if payload.target_id:
        target = db.query(User).filter(User.id == UUID(payload.target_id)).first()
    elif payload.target_email:
        target = db.query(User).filter(User.email == payload.target_email).first()
        if not target:
            # Create a shadow user placeholder for the invited email
            import uuid
            shadow_user = User(
                email=payload.target_email,
                username=payload.target_email.split('@')[0] + "_invite_" + str(uuid.uuid4())[:6],
                password_hash="shadow",
                full_name=payload.target_email.split('@')[0],
                is_active=False
            )
            db.add(shadow_user)
            db.commit()
            db.refresh(shadow_user)
            target = shadow_user

    if not target:
        raise HTTPException(404, "Target user not found")

    if str(current_user.id) == str(target.id):
        raise HTTPException(400, "Cannot send request to yourself")

    # Check no pending request already exists
    existing = db.query(CollaborationRequest).filter_by(
        requester_id=current_user.id,
        target_id=target.id,
        status='pending'
    ).first()
    if existing:
        raise HTTPException(409, "A pending request already exists")

    req = CollaborationRequest(
        requester_id=current_user.id,
        target_id=target.id,
        message=payload.message,
        project_id=UUID(payload.project_id) if payload.project_id else None,
        paper_id=UUID(payload.paper_id)     if payload.paper_id   else None,
    )
    db.add(req)
    db.commit()
    return {"message": "Request sent", "id": str(req.id)}


@router.get("/requests/incoming")
def incoming_requests(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Get all incoming collaboration requests for the current user."""
    reqs = db.query(CollaborationRequest).filter_by(
        target_id=current_user.id
    ).order_by(CollaborationRequest.created_at.desc()).all()
    return [
        {
            "id":           str(r.id),
            "requester":    {"id": str(r.requester.id), "name": r.requester.full_name,
                             "institution": r.requester.institution},
            "message":      r.message,
            "status":       r.status,
            "project_id":   str(r.project_id) if r.project_id else None,
            "paper_id":     str(r.paper_id)   if r.paper_id   else None,
            "created_at":   r.created_at.isoformat(),
        }
        for r in reqs
    ]


@router.get("/requests/outgoing")
def outgoing_requests(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    reqs = db.query(CollaborationRequest).filter_by(
        requester_id=current_user.id
    ).order_by(CollaborationRequest.created_at.desc()).all()
    return [
        {
            "id":       str(r.id),
            "target":   {"id": str(r.target.id), "name": r.target.full_name},
            "message":  r.message,
            "status":   r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in reqs
    ]


@router.patch("/requests/{request_id}/respond")
def respond_to_request(
    request_id:   UUID,
    payload:      RequestRespond,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Accept or decline an incoming collaboration request."""
    if payload.status not in ('accepted', 'declined'):
        raise HTTPException(400, "Status must be 'accepted' or 'declined'")

    req = db.query(CollaborationRequest).filter(
        CollaborationRequest.id == request_id,
        CollaborationRequest.target_id == current_user.id,
    ).first()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != 'pending':
        raise HTTPException(409, "Request already responded to")

    req.status = payload.status
    req.responded_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"message": f"Request {payload.status}"}


@router.get("/recommendations")
def get_collab_recommendations(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Get AI-generated collaborator recommendations for the current user."""
    recs = db.query(AICollabRec).filter(
        AICollabRec.for_user_id == current_user.id,
        AICollabRec.is_dismissed == False
    ).order_by(AICollabRec.score.desc()).limit(10).all()
    return [
        {
            "recommended_user": {
                "id":          str(r.recommended.id),
                "name":        r.recommended.full_name,
                "institution": r.recommended.institution,
            },
            "score":         r.score,
            "reasons":       r.reasons or [],
            "common_topics": r.common_topics or [],
            "generated_at":  r.created_at.isoformat(),
        }
        for r in recs
    ]


@router.post("/recommendations/{rec_id}/dismiss")
def dismiss_recommendation(
    rec_id:       UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    rec = db.query(AICollabRec).filter(
        AICollabRec.id == rec_id,
        AICollabRec.for_user_id == current_user.id
    ).first()
    if not rec:
        raise HTTPException(404)
    rec.is_dismissed = True
    db.commit()
    return {"message": "Recommendation dismissed"}
