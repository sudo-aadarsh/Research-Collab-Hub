"""
modules/conferences/models.py
"""
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.utils.db import Base
from sqlalchemy import DateTime


class Conference(Base):
    __tablename__ = "conferences"

    name                = Column(String(500), nullable=False)
    abbreviation        = Column(String(50))
    description         = Column(String)
    website             = Column(String(500))
    location            = Column(String(255))
    country             = Column(String(100))
    is_virtual          = Column(Boolean, default=False)
    research_areas      = Column(ARRAY(String))
    acceptance_rate     = Column(Float)
    impact_factor       = Column(Float)
    ranking             = Column(String(50))
    submission_deadline = Column(DateTime(timezone=True))
    notification_date   = Column(DateTime(timezone=True))
    conference_date     = Column(DateTime(timezone=True))


class Journal(Base):
    __tablename__ = "journals"

    name            = Column(String(500), nullable=False)
    abbreviation    = Column(String(100))
    issn            = Column(String(20))
    publisher       = Column(String(255))
    website         = Column(String(500))
    impact_factor   = Column(Float)
    h_index         = Column(Integer)
    research_areas  = Column(ARRAY(String))
    open_access     = Column(Boolean, default=False)
    acceptance_rate = Column(Float)
    review_speed    = Column(Integer)
    ranking         = Column(String(50))


class PaperSubmission(Base):
    __tablename__ = "paper_submissions"

    paper_id       = Column(UUID(as_uuid=True), ForeignKey("papers.id",       ondelete="CASCADE"), nullable=False)
    conference_id  = Column(UUID(as_uuid=True), ForeignKey("conferences.id"))
    journal_id     = Column(UUID(as_uuid=True), ForeignKey("journals.id"))
    submitted_at   = Column(DateTime(timezone=True))
    status         = Column(String(50), default='planned')
    decision_date  = Column(DateTime(timezone=True))
    reviewer_notes = Column(String)

    conference = relationship("Conference")
    journal    = relationship("Journal")
