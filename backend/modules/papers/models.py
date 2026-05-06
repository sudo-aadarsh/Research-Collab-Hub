"""
modules/papers/models.py - ORM models for the Papers module.
"""
from sqlalchemy import Column, String, Integer, Boolean, Date, ForeignKey, Enum as PgEnum, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.utils.db import Base


class Paper(Base):
    __tablename__ = "papers"

    project_id      = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"))
    title           = Column(String(1000), nullable=False)
    abstract        = Column(Text)
    keywords        = Column(ARRAY(String))
    status          = Column(PgEnum('draft','in_review','submitted','accepted','rejected','published',
                                    name='paper_status'), default='draft')
    doi             = Column(String(255), unique=True)
    arxiv_id        = Column(String(100))
    pdf_url         = Column(String(1000))
    word_count      = Column(Integer)
    page_count      = Column(Integer)
    submission_date = Column(Date)
    published_date  = Column(Date)
    version         = Column(Integer, default=1)

    authors         = relationship("PaperAuthor",  back_populates="paper", cascade="all, delete-orphan")
    versions        = relationship("PaperVersion", back_populates="paper", cascade="all, delete-orphan")
    project         = relationship("Project", back_populates="papers")


class PaperAuthor(Base):
    __tablename__ = "paper_authors"

    paper_id           = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    user_id            = Column(UUID(as_uuid=True), ForeignKey("users.id",  ondelete="SET NULL"))
    author_name        = Column(String(255), nullable=False)
    author_email       = Column(String(255))
    order_index        = Column(Integer, default=0)
    is_corresponding   = Column(Boolean, default=False)

    paper              = relationship("Paper", back_populates="authors")


class PaperVersion(Base):
    __tablename__ = "paper_versions"

    paper_id   = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    version    = Column(Integer, nullable=False)
    pdf_url    = Column(String(1000))
    change_log = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    paper      = relationship("Paper", back_populates="versions")
