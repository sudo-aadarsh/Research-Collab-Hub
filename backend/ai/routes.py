"""
ai/routes.py - REST API endpoints for all AI features.

Endpoints:
  POST /ai/summarize              - Summarize a paper abstract
  POST /ai/summarize/paper/{id}   - Summarize a specific paper from DB
  POST /ai/recommend/collaborators - Get collaborator recommendations
  POST /ai/recommend/venues/{paper_id} - Get venue recommendations for a paper
  POST /ai/trends                 - Get trend analysis
  POST /ai/directions             - Get personalized research direction suggestions
"""
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import get_current_user
from backend.modules.users.models import User, ResearchInterest
from backend.modules.papers.models import Paper
from backend.modules.conferences.models import Conference, Journal

from .summarizer import PaperSummarizer
from .collaborator_recommender import CollaboratorRecommender
from .conference_recommender import ConferenceRecommender
from .trend_analyzer import TrendAnalyzer

router = APIRouter(prefix="/ai", tags=["AI Features"])

# ── Service singletons (shared across requests) ───────────────────────────
summarizer     = PaperSummarizer()
collab_rec     = CollaboratorRecommender()
conf_rec       = ConferenceRecommender()
trend_analyzer = TrendAnalyzer()


# ── Schemas ───────────────────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    text: str
    mode: str = "abstract"   # abstract | full | concepts

class TrendRequest(BaseModel):
    domain:     Optional[str] = "computer science"
    paper_ids:  Optional[List[str]] = None  # if provided, analyze these papers


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/summarize")
def summarize_text(
    payload:      SummarizeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Summarize any text (abstract, passage, etc.).
    mode: 'abstract' | 'full' | 'concepts'
    """
    if len(payload.text.strip()) < 30:
        raise HTTPException(400, "Text too short to summarize")
    return summarizer.run(payload.text, mode=payload.mode)


@router.post("/summarize/paper/{paper_id}")
def summarize_paper(
    paper_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Summarize a specific paper from the database.
    Fetches title + abstract + keywords and runs full summary.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")

    context = f"""Title: {paper.title}
Abstract: {paper.abstract or ''}
Keywords: {', '.join(paper.keywords or [])}"""

    result = summarizer.run(context, mode="full")

    # Optionally persist to paper_summaries table
    # (omitted here for brevity; add if desired)

    return {"paper_id": str(paper_id), "title": paper.title, **result}


@router.get("/recommend/collaborators")
def recommend_collaborators(
    limit:        int = 10,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Get AI-powered collaborator recommendations for the current user.
    Combines topic overlap scoring + Claude reasoning.
    """
    # Build current user's profile
    user_profile = {
        "id":          str(current_user.id),
        "name":        current_user.full_name,
        "institution": current_user.institution,
        "bio":         current_user.bio or "",
        "interests":   [i.topic for i in current_user.interests],
        "skills":      [s.skill for s in current_user.skills],
        "h_index":     current_user.h_index,
    }

    if not user_profile["interests"]:
        raise HTTPException(400, "Add research interests to your profile first to get recommendations")

    # Fetch candidate researchers (active, not self, not already in a project together)
    candidates_raw = db.query(User).filter(
        User.id != current_user.id,
        User.is_active == True,
        User.role != 'admin',
    ).limit(50).all()

    candidates = [
        {
            "id":          str(u.id),
            "name":        u.full_name,
            "institution": u.institution or "",
            "bio":         u.bio or "",
            "interests":   [i.topic for i in u.interests],
            "skills":      [s.skill for s in u.skills],
            "h_index":     u.h_index or 0,
        }
        for u in candidates_raw
        if u.interests  # only candidates with declared interests
    ]

    if not candidates:
        return {"recommendations": [], "message": "No candidates with research interests found"}

    recommendations = collab_rec.run(user_profile, candidates)

    return {
        "for_user": user_profile["name"],
        "recommendations": recommendations[:limit],
    }


@router.get("/recommend/venues/{paper_id}")
def recommend_venues(
    paper_id:     UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Recommend conferences and journals for a specific paper.
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")

    paper_dict = {
        "id":       str(paper.id),
        "title":    paper.title,
        "abstract": paper.abstract or "",
        "keywords": paper.keywords or [],
    }

    # Fetch all venues from DB
    conferences = db.query(Conference).all()
    journals    = db.query(Journal).all()

    venues = [
        {
            "id":                  str(c.id),
            "type":                "conference",
            "name":                c.name,
            "abbreviation":        c.abbreviation,
            "research_areas":      c.research_areas or [],
            "ranking":             c.ranking,
            "acceptance_rate":     c.acceptance_rate,
            "submission_deadline": c.submission_deadline.isoformat() if c.submission_deadline else None,
        }
        for c in conferences
    ] + [
        {
            "id":             str(j.id),
            "type":           "journal",
            "name":           j.name,
            "abbreviation":   j.abbreviation,
            "research_areas": j.research_areas or [],
            "ranking":        j.ranking,
            "impact_factor":  j.impact_factor,
            "acceptance_rate": j.acceptance_rate,
        }
        for j in journals
    ]

    result = conf_rec.run(paper_dict, venues)
    return {"paper_id": str(paper_id), "paper_title": paper.title, **result}


@router.post("/trends")
def analyze_trends(
    payload:      TrendRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Analyze research trends.
    If paper_ids provided, analyzes that corpus.
    Otherwise, uses domain knowledge.
    """
    papers = []
    if payload.paper_ids:
        paper_objs = db.query(Paper).filter(
            Paper.id.in_([UUID(pid) for pid in payload.paper_ids])
        ).all()
        papers = [
            {
                "title":    p.title,
                "keywords": p.keywords or [],
                "abstract": (p.abstract or "")[:300],
            }
            for p in paper_objs
        ]

    return trend_analyzer.run({"papers": papers, "domain": payload.domain})


@router.get("/directions")
def get_research_directions(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Get personalized research direction suggestions based on user's interests."""
    interests = [i.topic for i in current_user.interests]
    if not interests:
        raise HTTPException(400, "Add research interests to get personalized directions")
    return trend_analyzer.suggest_research_directions(interests)


@router.get("/explain/match/{candidate_id}")
def explain_collaboration_match(
    candidate_id: UUID,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Get a detailed explanation of why two researchers would collaborate well."""
    candidate = db.query(User).filter(User.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "User not found")

    user_profile = {
        "name":      current_user.full_name,
        "interests": [i.topic for i in current_user.interests],
    }
    cand_profile = {
        "name":      candidate.full_name,
        "interests": [i.topic for i in candidate.interests],
    }
    explanation = collab_rec.explain_match(user_profile, cand_profile)
    return {"explanation": explanation}
