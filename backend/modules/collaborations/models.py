"""
modules/collaborations/models.py
"""
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.utils.db import Base


class CollaborationRequest(Base):
    __tablename__ = "collaboration_requests"

    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    target_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    paper_id     = Column(UUID(as_uuid=True), ForeignKey("papers.id"))
    message      = Column(Text)
    status       = Column(String(50), default='pending')
    responded_at = Column(String)

    requester    = relationship("User", foreign_keys=[requester_id])
    target       = relationship("User", foreign_keys=[target_id])


class AICollabRec(Base):
    __tablename__ = "ai_collaboration_recommendations"

    for_user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recommended_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score          = Column(Float, nullable=False)
    reasons        = Column(ARRAY(String))
    common_topics  = Column(ARRAY(String))
    is_dismissed   = Column(Boolean, default=False)

    for_user       = relationship("User", foreign_keys=[for_user_id])
    recommended    = relationship("User", foreign_keys=[recommended_id])
