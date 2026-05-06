"""
utils/db.py - Database engine, session factory, and base model.
All modules import `get_db` for dependency injection in FastAPI routes.
"""
import uuid
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

from backend.config import get_settings

settings = get_settings()

# ── Engine ─────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,            # reconnect on stale connections
    echo=settings.DEBUG,
)

# ── Session factory ────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Declarative base with common columns ──────────────────────────────────
class Base(DeclarativeBase):
    """Base class for all ORM models with UUID PK and timestamps."""

    __allow_unmapped__ = True

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ── FastAPI dependency ─────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a database session.
    Usage:
        @router.get("/")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """
    Create all tables. In production, use Alembic migrations instead.
    """
    # Import all models so SQLAlchemy registers them with Base.metadata
    from backend.modules.users.models import User, ResearchInterest, UserSkill           # noqa
    from backend.modules.projects.models import Project, ProjectMember, ProjectMilestone  # noqa
    from backend.modules.papers.models import Paper, PaperAuthor, PaperVersion            # noqa
    from backend.modules.references.models import Reference, PaperReference               # noqa
    from backend.modules.collaborations.models import CollaborationRequest, AICollabRec   # noqa
    from backend.modules.conferences.models import Conference, Journal, PaperSubmission   # noqa

    Base.metadata.create_all(bind=engine)
