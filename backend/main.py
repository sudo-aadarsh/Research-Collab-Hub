"""
main.py - FastAPI application entry point.

Registers all module routers under /api/v1/.
Configures CORS, middleware, exception handlers, and startup events.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.utils.db import init_db

# ── Module routers ────────────────────────────────────────────────────────
from backend.modules.users.routes          import router as users_router
from backend.modules.projects.routes      import router as projects_router
from backend.modules.papers.routes        import router as papers_router
from backend.modules.references.routes    import router as references_router
from backend.modules.collaborations.routes import router as collab_router
from backend.modules.conferences.routes   import router as conf_router
from backend.ai.routes                    import router as ai_router

settings = get_settings()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before accepting requests."""
    print(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    if settings.ENVIRONMENT == "development":
        init_db()   # auto-create tables in dev; use Alembic in production
    yield
    print("👋 Shutting down")


# ── App factory ───────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Collaborative Research Paper & Resource Management System

A modular platform for researchers to:
- **Manage papers** with version control and author tracking
- **Collaborate** with AI-powered researcher matching
- **Discover venues** with conference & journal recommendations
- **Track trends** with AI-driven research analytics

### Authentication
Use `POST /api/v1/auth/login` with `username` + `password` to get a JWT token.
Include it as: `Authorization: Bearer <token>`
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handlers ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


# ── Health check ──────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {
        "status":      "healthy",
        "app":         settings.APP_NAME,
        "version":     settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# ── Register all module routers ───────────────────────────────────────────
API_PREFIX = "/api/v1"

# Users & Auth (users_router handles both /auth/* and /users/*)
app.include_router(users_router,   prefix=API_PREFIX)

# Core modules
app.include_router(projects_router, prefix=API_PREFIX)
app.include_router(papers_router,   prefix=API_PREFIX)
app.include_router(references_router, prefix=API_PREFIX)
app.include_router(collab_router,   prefix=API_PREFIX)
app.include_router(conf_router,     prefix=API_PREFIX)

# AI features
app.include_router(ai_router, prefix=API_PREFIX)


# ── API route summary ─────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/routes", tags=["System"])
def list_routes():
    """Return all registered API routes (useful for frontend client generation)."""
    routes = []
    for route in app.routes:
        if hasattr(route, "methods"):
            routes.append({
                "path":    route.path,
                "methods": list(route.methods),
                "name":    route.name,
            })
    return {"routes": routes, "total": len(routes)}
