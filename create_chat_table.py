import asyncio
from sqlalchemy import create_engine, text

# Use the URL from .env
url = "postgresql://postgres:postgres@localhost:5432/research_collab"
engine = create_engine(url)

with engine.connect() as conn:
    conn.execute(text("""
    CREATE TABLE IF NOT EXISTS project_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """))
    conn.commit()
print("Table created")
