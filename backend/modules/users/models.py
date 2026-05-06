"""
modules/users/models.py - SQLAlchemy ORM models for the Users module.
"""
import uuid
from sqlalchemy import Column, String, Boolean, Float, Integer, Enum as PgEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.utils.db import Base


class User(Base):
    __tablename__ = "users"

    email         = Column(String(255), unique=True, nullable=False, index=True)
    username      = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(255), nullable=False)
    role          = Column(PgEnum('researcher','admin','reviewer','guest', name='user_role'),
                           nullable=False, default='researcher')
    institution   = Column(String(255))
    department    = Column(String(255))
    bio           = Column(String)
    orcid_id      = Column(String(50))
    h_index       = Column(Integer, default=0)
    avatar_url    = Column(String(500))
    is_active     = Column(Boolean, default=True)
    is_verified   = Column(Boolean, default=False)

    # Relationships
    interests     = relationship("ResearchInterest", back_populates="user", cascade="all, delete-orphan")
    skills        = relationship("UserSkill",        back_populates="user", cascade="all, delete-orphan")
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")


class ResearchInterest(Base):
    __tablename__ = "research_interests"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic   = Column(String(255), nullable=False)
    weight  = Column(Float, default=1.0)

    user    = relationship("User", back_populates="interests")


class UserSkill(Base):
    __tablename__ = "user_skills"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill   = Column(String(255), nullable=False)
    level   = Column(String(50))

    user    = relationship("User", back_populates="skills")
