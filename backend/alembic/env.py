"""
alembic/env.py - Alembic migration environment.
Auto-detects all SQLAlchemy models by importing them here.
"""
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os, sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.utils.db import Base
from backend.config import get_settings

# Import all models so Alembic can detect changes
from backend.modules.users.models         import User, ResearchInterest, UserSkill         # noqa
from backend.modules.projects.models      import Project, ProjectMember, ProjectMilestone  # noqa
from backend.modules.papers.models        import Paper, PaperAuthor, PaperVersion          # noqa
from backend.modules.references.models    import Reference, PaperReference                 # noqa
from backend.modules.collaborations.models import CollaborationRequest, AICollabRec        # noqa
from backend.modules.conferences.models   import Conference, Journal, PaperSubmission      # noqa

config  = context.config
settings = get_settings()

if config.config_file_name:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata,
                      literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
