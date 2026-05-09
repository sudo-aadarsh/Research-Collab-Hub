"""
config.py - Centralized configuration using pydantic-settings.
All settings are loaded from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional, Literal


class Settings(BaseSettings):
    # ── Application ─────────────────────────────────────────────
    APP_NAME: str = "Research Collab Hub"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"   # development | staging | production

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/research_collab"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # ── Authentication ────────────────────────────────────────────
    SECRET_KEY: str = "change-me-to-a-long-random-string-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI Provider Selection ─────────────────────────────────────────
    # Options: "gemini" (Google Gemini free tier - RECOMMENDED)
    #          "ollama" (local LLM - completely free, requires Ollama install)
    #          "anthropic" (paid Claude API)
    # Falls back to intelligent template responses if no key is configured.
    AI_PROVIDER: str = "gemini"

    # ── Google Gemini API (FREE tier - Recommended) ──────────────
    # Get your free key at: https://aistudio.google.com/apikey
    # Free limits: 15 RPM, 1M TPM, 1500 RPD (gemini-2.0-flash)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Universal free tier model

    # ── Groq (High Limit, Extremely Fast, Free Tier) ─────────────
    # Get your free key at: https://console.groq.com/keys
    # Free limits: ~30 RPM, generous TPM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Ollama (Local LLM - completely free) ──────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"  # or "mistral", "phi3", etc.

    # ── Anthropic Claude (Paid) ───────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-20250514"

    # ── AI General Settings ───────────────────────────────────────
    AI_MAX_TOKENS: int = 2048
    AI_CACHE_TTL_SECONDS: int = 3600      # cache AI responses 1 hour

    # ── Redis (for caching & Celery) ──────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── CORS ──────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # ── Email (optional) ──────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance (singleton)."""
    return Settings()