"""
modules/conferences/routes.py
"""
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from .models import Conference, Journal, PaperSubmission

router = APIRouter(tags=["Conferences & Journals"])


@router.get("/conferences")
def list_conferences(
    search:     Optional[str] = None,
    area:       Optional[str] = None,
    ranking:    Optional[str] = None,
    upcoming:   bool = False,
    skip: int = 0, limit: int = 20,
    db: Session = Depends(get_db),
):
    q = db.query(Conference)
    if search:
        q = q.filter(
            Conference.name.ilike(f"%{search}%") |
            Conference.abbreviation.ilike(f"%{search}%")
        )
    if area:
        q = q.filter(Conference.research_areas.contains([area]))
    if ranking:
        q = q.filter(Conference.ranking == ranking)
    if upcoming:
        q = q.filter(Conference.submission_deadline >= datetime.now(timezone.utc))
        q = q.order_by(Conference.submission_deadline.asc())
    else:
        q = q.order_by(Conference.name.asc())

    total = q.count()
    confs = q.offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id":                   str(c.id),
                "name":                 c.name,
                "abbreviation":         c.abbreviation,
                "research_areas":       c.research_areas or [],
                "ranking":              c.ranking,
                "acceptance_rate":      c.acceptance_rate,
                "submission_deadline":  c.submission_deadline.isoformat() if c.submission_deadline else None,
                "conference_date":      c.conference_date.isoformat() if c.conference_date else None,
                "location":             c.location,
                "days_remaining": (
                    (c.submission_deadline.date() - datetime.now(timezone.utc).date()).days
                    if c.submission_deadline else None
                ),
            }
            for c in confs
        ]
    }


@router.get("/journals")
def list_journals(
    search:   Optional[str] = None,
    area:     Optional[str] = None,
    ranking:  Optional[str] = None,
    open_access: Optional[bool] = None,
    skip: int = 0, limit: int = 20,
    db: Session = Depends(get_db),
):
    q = db.query(Journal)
    if search:
        q = q.filter(Journal.name.ilike(f"%{search}%"))
    if area:
        q = q.filter(Journal.research_areas.contains([area]))
    if ranking:
        q = q.filter(Journal.ranking == ranking)
    if open_access is not None:
        q = q.filter(Journal.open_access == open_access)

    total = q.count()
    journals = q.order_by(Journal.impact_factor.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": str(j.id), "name": j.name, "abbreviation": j.abbreviation,
                "impact_factor": j.impact_factor, "h_index": j.h_index,
                "research_areas": j.research_areas or [], "open_access": j.open_access,
                "acceptance_rate": j.acceptance_rate, "review_speed": j.review_speed,
                "ranking": j.ranking,
            }
            for j in journals
        ]
    }


class SubmissionCreate(BaseModel):
    paper_id:      str
    conference_id: Optional[str] = None
    journal_id:    Optional[str] = None

@router.post("/submissions", status_code=201, tags=["Submissions"])
def create_submission(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not payload.conference_id and not payload.journal_id:
        raise HTTPException(400, "Provide either conference_id or journal_id")
    if payload.conference_id and payload.journal_id:
        raise HTTPException(400, "Provide only one venue")

    sub = PaperSubmission(
        paper_id=UUID(payload.paper_id),
        conference_id=UUID(payload.conference_id) if payload.conference_id else None,
        journal_id=UUID(payload.journal_id) if payload.journal_id else None,
    )
    db.add(sub)
    db.commit()
    return {"message": "Submission recorded", "id": str(sub.id)}


class ConferenceCreate(BaseModel):
    name: str
    abbreviation: Optional[str] = None
    submission_deadline: Optional[datetime] = None
    conference_date: Optional[datetime] = None
    location: Optional[str] = None
    research_areas: Optional[list[str]] = None


@router.post("/conferences", status_code=201)
def create_conference(
    payload: ConferenceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Basic create endpoint for adding conferences manually from the UI
    c = Conference(
        name=payload.name,
        abbreviation=payload.abbreviation,
        submission_deadline=payload.submission_deadline,
        conference_date=payload.conference_date,
        location=payload.location,
        research_areas=payload.research_areas,
    )
    db.add(c)
    db.commit()
    return {"message": "Conference created", "id": str(c.id)}
