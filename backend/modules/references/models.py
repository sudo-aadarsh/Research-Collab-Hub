"""
modules/references/models.py + routes.py - Citations & References management.
"""
# ── models ────────────────────────────────────────────────────────────────
from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.utils.db import Base


class Reference(Base):
    __tablename__ = "references"

    paper_id     = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="SET NULL"))
    title        = Column(String(1000), nullable=False)
    authors      = Column(ARRAY(String))
    year         = Column(Integer)
    doi          = Column(String(255))
    arxiv_id     = Column(String(100))
    journal      = Column(String(500))
    conference   = Column(String(500))
    url          = Column(String(1000))
    citation_key = Column(String(100))
    abstract     = Column(Text)
    tags         = Column(ARRAY(String))
    added_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"))


class PaperReference(Base):
    __tablename__ = "paper_references"

    paper_id     = Column(UUID(as_uuid=True), ForeignKey("papers.id",      ondelete="CASCADE"), nullable=False)
    reference_id = Column(UUID(as_uuid=True), ForeignKey("references.id",  ondelete="CASCADE"), nullable=False)
    context      = Column(Text)

    reference    = relationship("Reference")
