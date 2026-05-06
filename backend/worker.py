"""
backend/worker.py - Celery background task worker.

Tasks:
  - send_deadline_reminders   : Runs daily, notifies users of upcoming deadlines
  - precompute_collab_recs    : Pre-generates AI collaborator recs for all users
  - precompute_trends         : Pre-generates trend analysis for common domains
  - cleanup_old_notifications : Prunes notifications older than 90 days

Run with:
  celery -A backend.worker worker --beat --loglevel=info
"""
from celery import Celery
from celery.schedules import crontab
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from backend.config import get_settings
from backend.utils.db import SessionLocal

settings = get_settings()

# ── Celery app ────────────────────────────────────────────────────────────
celery_app = Celery(
    "research_collab",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # ── Beat schedule (periodic tasks) ────────────────────────────────────
    beat_schedule={
        "deadline-reminders-daily": {
            "task":     "backend.worker.send_deadline_reminders",
            "schedule": crontab(hour=8, minute=0),   # every day at 08:00 UTC
        },
        "precompute-trends-weekly": {
            "task":     "backend.worker.precompute_trends",
            "schedule": crontab(day_of_week=0, hour=2, minute=0),  # Sunday 02:00
        },
        "cleanup-notifications-weekly": {
            "task":     "backend.worker.cleanup_old_notifications",
            "schedule": crontab(day_of_week=1, hour=3, minute=0),  # Monday 03:00
        },
    },
)


# ── Helper ────────────────────────────────────────────────────────────────
def get_session() -> Session:
    return SessionLocal()


# ── Tasks ─────────────────────────────────────────────────────────────────

@celery_app.task(name="backend.worker.send_deadline_reminders", bind=True, max_retries=3)
def send_deadline_reminders(self):
    """
    Notify all active researchers of conferences with deadlines
    in the next 7 days.
    Calls the stored procedure sp / trigger logic directly.
    """
    db = get_session()
    try:
        from backend.modules.conferences.models import Conference
        from backend.modules.users.models import User
        from sqlalchemy import text

        # Call DB stored function
        db.execute(text("SELECT check_upcoming_deadlines()"))
        db.commit()
        return {"status": "ok", "message": "Deadline reminders dispatched"}
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=60 * 5)
    finally:
        db.close()


@celery_app.task(name="backend.worker.precompute_collab_recs", bind=True)
def precompute_collab_recs(self, user_id: str):
    """
    Pre-generate and cache AI collaborator recommendations for a specific user.
    Called after a user updates their research interests.
    """
    from backend.modules.users.models import User, ResearchInterest
    from backend.modules.collaborations.models import AICollabRec
    from backend.ai.collaborator_recommender import CollaboratorRecommender
    import uuid

    db = get_session()
    try:
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if not user or not user.interests:
            return {"status": "skipped", "reason": "no interests"}

        user_profile = {
            "id":          str(user.id),
            "name":        user.full_name,
            "institution": user.institution or "",
            "bio":         user.bio or "",
            "interests":   [i.topic for i in user.interests],
            "skills":      [s.skill for s in user.skills],
            "h_index":     user.h_index or 0,
        }

        candidates_raw = db.query(User).filter(
            User.id != user.id,
            User.is_active == True,
        ).limit(100).all()

        candidates = [
            {
                "id":          str(u.id),
                "name":        u.full_name,
                "institution": u.institution or "",
                "interests":   [i.topic for i in u.interests],
                "skills":      [s.skill for s in u.skills],
                "h_index":     u.h_index or 0,
            }
            for u in candidates_raw if u.interests
        ]

        recommender = CollaboratorRecommender()
        recs = recommender.run(user_profile, candidates)

        # Persist top 10 to DB
        # Clear old recs first
        db.query(AICollabRec).filter(
            AICollabRec.for_user_id == user.id
        ).delete()

        for rec in recs[:10]:
            cand = rec.get("candidate", {})
            if not cand.get("id"):
                continue
            db.add(AICollabRec(
                for_user_id=user.id,
                recommended_id=uuid.UUID(cand["id"]),
                score=rec.get("score", 0.0),
                reasons=rec.get("reasons", []),
                common_topics=rec.get("common_topics", []),
            ))
        db.commit()
        return {"status": "ok", "recs_generated": len(recs[:10])}
    except Exception as exc:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="backend.worker.precompute_trends")
def precompute_trends():
    """
    Pre-generate trend analysis for common research domains and cache in DB.
    """
    from backend.modules.conferences.models import Conference
    from backend.ai.trend_analyzer import TrendAnalyzer
    from sqlalchemy import text

    DOMAINS = [
        "artificial intelligence", "machine learning",
        "natural language processing", "computer vision",
        "quantum computing", "distributed systems",
        "bioinformatics", "cybersecurity",
    ]

    db = get_session()
    analyzer = TrendAnalyzer()
    results = []

    try:
        for domain in DOMAINS:
            try:
                result = analyzer.run({"domain": domain, "papers": []})
                # Store in research_trends table
                year = datetime.now(timezone.utc).year
                for topic_data in result.get("hot_topics", [])[:5]:
                    db.execute(text("""
                        INSERT INTO research_trends (topic, trend_score, year, insights)
                        VALUES (:topic, :score, :year, :insights)
                        ON CONFLICT (topic, year) DO UPDATE
                        SET trend_score = EXCLUDED.trend_score,
                            insights    = EXCLUDED.insights,
                            generated_at = NOW()
                    """), {
                        "topic":    topic_data.get("topic", ""),
                        "score":    topic_data.get("trend_score", 0.0),
                        "year":     year,
                        "insights": topic_data.get("description", ""),
                    })
                results.append(domain)
            except Exception as e:
                print(f"Trend precompute failed for {domain}: {e}")

        db.commit()
        return {"status": "ok", "domains_processed": results}
    except Exception as exc:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="backend.worker.cleanup_old_notifications")
def cleanup_old_notifications():
    """Remove read notifications older than 90 days."""
    from sqlalchemy import text

    db = get_session()
    try:
        result = db.execute(text("""
            DELETE FROM notifications
            WHERE is_read = TRUE
              AND created_at < NOW() - INTERVAL '90 days'
        """))
        db.commit()
        return {"status": "ok", "deleted": result.rowcount}
    finally:
        db.close()
