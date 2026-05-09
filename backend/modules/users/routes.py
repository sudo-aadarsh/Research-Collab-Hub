"""
modules/users/routes.py - REST API for the Users module.

Endpoints:
  POST   /auth/register      - Register new user
  POST   /auth/login         - Login, get JWT
  GET    /users/me           - Get own profile
  PATCH  /users/me           - Update own profile
  GET    /users/{user_id}    - Get public profile
  GET    /users/             - List/search users
  POST   /users/me/interests - Add/update research interest
  DELETE /users/me/interests/{topic} - Remove interest
  POST   /users/me/skills    - Add skill
"""
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.utils.db import get_db
from backend.auth.middleware import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user
)
from .models import User, ResearchInterest, UserSkill

router = APIRouter()

# ── Pydantic Schemas ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:       EmailStr
    username:    str = Field(..., min_length=3, max_length=100)
    password:    str = Field(..., min_length=8)
    full_name:   str
    institution: Optional[str] = None
    department:  Optional[str] = None

class LoginResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_id:       str
    role:          str

class UpdateProfileRequest(BaseModel):
    full_name:   Optional[str] = None
    institution: Optional[str] = None
    department:  Optional[str] = None
    bio:         Optional[str] = None
    orcid_id:    Optional[str] = None
    avatar_url:  Optional[str] = None

class InterestRequest(BaseModel):
    topic:  str
    weight: float = Field(default=1.0, ge=0.0, le=1.0)

class SkillRequest(BaseModel):
    skill: str
    level: str = Field(..., pattern="^(beginner|intermediate|expert)$")

class UserPublicResponse(BaseModel):
    id:          str
    username:    str
    full_name:   str
    institution: Optional[str]
    department:  Optional[str]
    bio:         Optional[str]
    h_index:     int
    orcid_id:    Optional[str]
    interests:   List[str] = []
    skills:      List[dict] = []

    class Config:
        from_attributes = True


# ── Auth Endpoints ────────────────────────────────────────────────────────

@router.post("/auth/register", status_code=201, tags=["Auth"])
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new researcher account."""
    existing_user = db.query(User).filter(User.email == payload.email).first()
    
    if existing_user:
        # Check if it's a shadow user (invited but not registered)
        if existing_user.is_active == False and existing_user.password_hash == "shadow":
            existing_user.username = payload.username
            existing_user.password_hash = hash_password(payload.password)
            existing_user.full_name = payload.full_name
            existing_user.institution = payload.institution
            existing_user.department = payload.department
            existing_user.is_active = True
            db.commit()
            db.refresh(existing_user)
            return {"message": "Registration successful", "user_id": str(existing_user.id)}
        else:
            raise HTTPException(400, "Email already registered")

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(400, "Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        institution=payload.institution,
        department=payload.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Registration successful", "user_id": str(user.id)}


@router.post("/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    user = db.query(User).filter(
        (User.email == form.username) | (User.username == form.username)
    ).first()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token_data = {"sub": str(user.id), "role": user.role}
    return LoginResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user_id=str(user.id),
        role=user.role,
    )


# ── Profile Endpoints ─────────────────────────────────────────────────────

@router.get("/users/me", tags=["Users"])
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get the authenticated user's full profile."""
    return {
        "id":          str(current_user.id),
        "email":       current_user.email,
        "username":    current_user.username,
        "full_name":   current_user.full_name,
        "role":        current_user.role,
        "institution": current_user.institution,
        "department":  current_user.department,
        "bio":         current_user.bio,
        "h_index":     current_user.h_index,
        "orcid_id":    current_user.orcid_id,
        "interests":   [{"topic": i.topic, "weight": i.weight} for i in current_user.interests],
        "skills":      [{"skill": s.skill, "level": s.level} for s in current_user.skills],
    }


@router.patch("/users/me", tags=["Users"])
def update_my_profile(
    payload: UpdateProfileRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Update the authenticated user's profile fields."""
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated"}


@router.get("/users/{user_id}", tags=["Users"])
def get_user_profile(user_id: UUID, db: Session = Depends(get_db)):
    """Get public profile of any user."""
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(404, "User not found")
    return UserPublicResponse(
        id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        institution=user.institution,
        department=user.department,
        bio=user.bio,
        h_index=user.h_index,
        orcid_id=user.orcid_id,
        interests=[i.topic for i in user.interests],
        skills=[{"skill": s.skill, "level": s.level} for s in user.skills],
    )


@router.get("/users/", tags=["Users"])
def list_users(
    search:      Optional[str] = Query(None, description="Search by name or institution"),
    interest:    Optional[str] = Query(None, description="Filter by research interest"),
    institution: Optional[str] = None,
    skip:        int = 0,
    limit:       int = 20,
    db:          Session = Depends(get_db),
):
    """Search and list researchers with optional filters."""
    q = db.query(User).filter(User.is_active == True, User.role != 'admin')

    if search:
        q = q.filter(
            (User.full_name.ilike(f"%{search}%")) |
            (User.institution.ilike(f"%{search}%")) |
            (User.username.ilike(f"%{search}%"))
        )
    if institution:
        q = q.filter(User.institution.ilike(f"%{institution}%"))
    if interest:
        q = q.join(ResearchInterest).filter(
            ResearchInterest.topic.ilike(f"%{interest}%")
        )

    users = q.offset(skip).limit(limit).all()
    return [
        {
            "id": str(u.id), "username": u.username, "full_name": u.full_name,
            "institution": u.institution, "h_index": u.h_index,
            "interests": [i.topic for i in u.interests[:5]],
        }
        for u in users
    ]


# ── Interest & Skill Endpoints ────────────────────────────────────────────

@router.post("/users/me/interests", status_code=201, tags=["Users"])
def add_interest(
    payload:      InterestRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Add or update a research interest (upsert by topic)."""
    existing = db.query(ResearchInterest).filter_by(
        user_id=current_user.id, topic=payload.topic.lower().strip()
    ).first()
    if existing:
        existing.weight = payload.weight
    else:
        db.add(ResearchInterest(user_id=current_user.id,
                                topic=payload.topic.lower().strip(),
                                weight=payload.weight))
    db.commit()
    return {"message": "Interest saved"}


@router.delete("/users/me/interests/{topic}", tags=["Users"])
def remove_interest(
    topic:        str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    db.query(ResearchInterest).filter_by(
        user_id=current_user.id, topic=topic.lower()
    ).delete()
    db.commit()
    return {"message": "Interest removed"}


@router.post("/users/me/skills", status_code=201, tags=["Users"])
def add_skill(
    payload:      SkillRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    existing = db.query(UserSkill).filter_by(
        user_id=current_user.id, skill=payload.skill
    ).first()
    if existing:
        existing.level = payload.level
    else:
        db.add(UserSkill(user_id=current_user.id, skill=payload.skill, level=payload.level))
    db.commit()
    return {"message": "Skill saved"}
