"""
tests/conftest.py - Pytest fixtures: in-memory SQLite DB, test client, auth helpers.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.utils.db import Base, get_db
from backend.main import app
from backend.auth.middleware import hash_password

# ── In-memory SQLite for tests (no Postgres needed) ──────────────────────
TEST_DB_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create all tables at session start, drop at end."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestSession()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def test_user(db):
    """Create a test researcher user."""
    from backend.modules.users.models import User
    user = User(
        email="test@university.edu",
        username="testuser",
        password_hash=hash_password("TestPass123!"),
        full_name="Dr. Test User",
        institution="Test University",
        role="researcher",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user):
    """Log in and return Authorization headers."""
    res = client.post("/api/v1/auth/login",
        data={"username": "test@university.edu", "password": "TestPass123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
