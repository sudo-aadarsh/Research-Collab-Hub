#!/usr/bin/env bash
# =============================================================================
# setup.sh - One-command local development setup
# Usage:  chmod +x setup.sh && ./setup.sh
# =============================================================================
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
section() { echo -e "\n${BOLD}══════════════════════════════════════${NC}"; echo -e "${BOLD} $*${NC}"; echo -e "${BOLD}══════════════════════════════════════${NC}"; }

section "Research Collab Hub - Local Setup"

# ── 1. Check prerequisites ────────────────────────────────────────────────
section "Checking prerequisites"
command -v python3 >/dev/null 2>&1 || error "Python 3 not found. Install from python.org"
command -v node    >/dev/null 2>&1 || error "Node.js not found. Install from nodejs.org"
command -v psql    >/dev/null 2>&1 || warn  "PostgreSQL CLI not found. Install PostgreSQL."
info "Python: $(python3 --version)"
info "Node:   $(node --version)"

# ── 2. Environment file ───────────────────────────────────────────────────
section "Setting up environment"
if [ ! -f .env ]; then
    cp .env.example .env
    warn "Created .env from .env.example"
    warn ">>> IMPORTANT: Set your ANTHROPIC_API_KEY in .env <<<"
    warn ">>> Edit .env now, then re-run this script        <<<"
else
    info ".env already exists"
fi

# Check for API key
if grep -q "your-key-here" .env; then
    warn "ANTHROPIC_API_KEY not set in .env — AI features will not work"
    warn "Get your key from: https://console.anthropic.com"
fi

# ── 3. Backend setup ──────────────────────────────────────────────────────
section "Setting up Python backend"
cd backend

if [ ! -d "venv" ]; then
    info "Creating virtual environment..."
    python3 -m venv venv
fi

info "Activating venv and installing dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
info "Backend dependencies installed ✓"
cd ..

# ── 4. Database setup ─────────────────────────────────────────────────────
section "Setting up PostgreSQL database"

# Load DB URL from .env
export $(grep -v '^#' .env | grep DATABASE_URL | xargs) 2>/dev/null || true
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/research_collab}"
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///')

if command -v psql >/dev/null 2>&1; then
    info "Creating database '$DB_NAME' (if not exists)..."
    psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || info "Database already exists"

    info "Running schema..."
    psql -U postgres -d "$DB_NAME" -f database/schema.sql -q

    info "Running triggers..."
    psql -U postgres -d "$DB_NAME" -f database/triggers.sql -q

    info "Running views and procedures..."
    psql -U postgres -d "$DB_NAME" -f database/views_procedures.sql -q

    info "Loading seed data..."
    psql -U postgres -d "$DB_NAME" -f database/seed_data.sql -q

    info "Database initialized ✓"
else
    warn "psql not found — skipping DB setup. Run manually:"
    warn "  psql -U postgres -f database/schema.sql"
    warn "  psql -U postgres -f database/triggers.sql"
    warn "  psql -U postgres -f database/views_procedures.sql"
    warn "  psql -U postgres -f database/seed_data.sql"
fi

# ── 5. Frontend setup ─────────────────────────────────────────────────────
section "Setting up React frontend"
cd frontend
if [ ! -d "node_modules" ]; then
    info "Installing npm dependencies..."
    npm install --silent
fi

if [ ! -f ".env" ]; then
    echo "VITE_API_URL=http://localhost:8000/api/v1" > .env
    info "Created frontend .env"
fi
info "Frontend dependencies installed ✓"
cd ..

# ── 6. Start services ─────────────────────────────────────────────────────
section "Starting services"
info "Starting FastAPI backend on http://localhost:8000"
info "API docs at: http://localhost:8000/docs"
info ""
info "Starting React frontend on http://localhost:3000"
info ""
info "Demo login: alice@mit.edu / Password123!"

# Start backend in background
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

# Start frontend in foreground
cd frontend
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null; echo 'Servers stopped'" EXIT
