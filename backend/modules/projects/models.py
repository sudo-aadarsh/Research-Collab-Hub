"""
modules/projects/models.py
"""
from sqlalchemy import Column, String, Date, Boolean, ForeignKey, Enum as PgEnum, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.utils.db import Base


class Project(Base):
    __tablename__ = "projects"

    title        = Column(String(500), nullable=False)
    description  = Column(Text)
    status       = Column(PgEnum('planning','active','on_hold','completed','cancelled',
                                  name='project_status'), default='planning')
    owner_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    start_date   = Column(Date)
    end_date     = Column(Date)
    funding_info = Column(Text)
    file_url     = Column(String(1000))   # uploaded file URL
    tags         = Column(ARRAY(String))
    is_public    = Column(Boolean, default=False)

    owner      = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    members    = relationship("ProjectMember",    back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    papers     = relationship("Paper", back_populates="project")


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    role       = Column(PgEnum('lead','co_author','contributor','reviewer', name='collaboration_role'),
                        default='contributor')

    project    = relationship("Project", back_populates="members")
    user       = relationship("User")


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title        = Column(String(255), nullable=False)
    description  = Column(Text)
    due_date     = Column(Date)
    completed_at = Column(String)    # ISO timestamp or None

    project      = relationship("Project", back_populates="milestones")
