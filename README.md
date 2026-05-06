# 🔬 Research Collab Hub

A **modular, production-ready** Collaborative Research Paper & Resource Management System with integrated AI features powered by Claude (Anthropic).

---

## 🏗️ Architecture Overview

```
research_collab/
├── database/
│   ├── schema.sql              # All CREATE TABLE statements + indexes
│   ├── triggers.sql            # Auto-notification, versioning, activity log triggers
│   ├── views_procedures.sql    # Views (v_papers_full, v_coauthor_network) + stored procedures
│   └── seed_data.sql           # Example data (users, papers, conferences)
│
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # App factory, router registration, lifespan
│   ├── config.py               # Pydantic-settings configuration
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── auth/
│   │   └── middleware.py       # JWT tokens, password hashing, get_current_user
│   │
│   ├── utils/
│   │   └── db.py               # SQLAlchemy engine, Base model, get_db dependency
│   │
│   ├── modules/                # ← Each module = independent CRUD domain
│   │   ├── users/
│   │   │   ├── models.py       # User, ResearchInterest, UserSkill ORM
│   │   │   └── routes.py       # Register, Login, Profile CRUD, Interests/Skills
│   │   ├── projects/
│   │   │   ├── models.py       # Project, ProjectMember, ProjectMilestone ORM
│   │   │   └── routes.py       # Projects CRUD, Members, Milestones
│   │   ├── papers/
│   │   │   ├── models.py       # Paper, PaperAuthor, PaperVersion ORM
│   │   │   └── routes.py       # Papers CRUD, Status transitions, Authors, Versions
│   │   ├── references/
│   │   │   ├── models.py       # Reference, PaperReference ORM
│   │   │   └── routes.py       # References CRUD, Paper linking, BibTeX export
│   │   ├── collaborations/
│   │   │   ├── models.py       # CollaborationRequest, AICollabRec ORM
│   │   │   └── routes.py       # Send/respond to requests, AI recommendations
│   │   └── conferences/
│   │       ├── models.py       # Conference, Journal, PaperSubmission ORM
│   │       └── routes.py       # Venue listing, submission tracking
│   │
│   └── ai/                     # ← Modular AI services
│       ├── base.py             # AIServiceBase (Claude client, caching, error handling)
│       ├── summarizer.py       # PaperSummarizer (abstract, full, concepts)
│       ├── collaborator_recommender.py  # Topic overlap + Claude reasoning
│       ├── conference_recommender.py   # ConferenceRecommender + TrendAnalyzer
│       ├── trend_analyzer.py   # TrendAnalyzer (hot topics, gaps, directions)
│       └── routes.py           # /ai/* REST endpoints
│
└── frontend/                   # React 18 + Vite + TailwindCSS
    └── src/
        ├── api/client.js       # Axios client + typed API methods for all modules
        ├── store/index.js      # Zustand: auth store + UI store
        ├── App.jsx             # Router + QueryClient + protected routes
        ├── components/Shared/
        │   ├── AppLayout.jsx   # Sidebar + topbar shell
        │   └── UI.jsx          # Design system (Card, Button, Badge, Modal, etc.)
        └── pages/
            ├── DashboardPage.jsx     # Stats, recent papers, deadlines, AI directions
            ├── PapersPage.jsx        # Paper list + create + AI summarize
            ├── PaperDetailPage.jsx   # Full paper + AI summary + venue recs
            ├── ProjectsPage.jsx      # Projects list + create
            ├── ProjectDetailPage.jsx # Project detail + milestones + members
            ├── CollabPage.jsx        # Requests + AI collaborator recommendations
            ├── ConferencesPage.jsx   # Venue browser with deadline tracking
            ├── TrendsPage.jsx        # AI trend analysis + charts
            ├── ProfilePage.jsx       # User profile + interests + skills
            ├── LoginPage.jsx         # JWT login form
            └── RegisterPage.jsx      # Registration form
```

---

## 🗄️ Database Design

### Key Tables
| Table | Purpose |
|-------|---------|
| `users` | Researcher accounts with ORCID, h-index, institution |
| `research_interests` | Weighted topic interests (used for AI matching) |
| `projects` | Research projects with status, tags, timeline |
| `project_members` | Many-to-many: users ↔ projects with roles |
| `project_milestones` | Deadline tracking with completion status |
| `papers` | Papers with versioning, status workflow, keywords |
| `paper_authors` | Ordered author list with corresponding author flag |
| `paper_versions` | Auto-archived previous versions (via trigger) |
| `references` | Citation library with BibTeX support |
| `paper_references` | Many-to-many: papers ↔ references |
| `conferences` / `journals` | Venue database with deadlines, rankings, impact factors |
| `paper_submissions` | Track submission history per paper |
| `collaboration_requests` | Peer-to-peer collaboration invitations |
| `ai_collaboration_recommendations` | Cached AI collaborator suggestions |
| `notifications` | In-app notifications (deadline reminders, collab requests) |
| `activity_log` | Audit trail for all user actions |
| `research_trends` | Cached trend analysis results |

### Triggers (auto-executed)
- **`trg_collab_request_notify`** – Creates notification when collaboration request sent
- **`trg_collab_response_notify`** – Notifies requester of accept/decline
- **`trg_paper_auto_version`** – Archives previous version before paper update
- **`trg_paper_status_log`** – Logs paper status changes to activity_log
- **`trg_project_completion_check`** – Auto-marks project complete when all milestones done

### Views
- **`v_papers_full`** – Papers with JSON-aggregated author list and reference count
- **`v_user_research_profile`** – User profile with interests, skills, paper counts
- **`v_project_dashboard`** – Project with progress %, member count, next deadline
- **`v_coauthor_network`** – Edge list of co-author relationships (for graph analysis)
- **`v_upcoming_deadlines`** – All conference deadlines with days_remaining

---

## 🤖 AI Features

All AI services extend `AIServiceBase` and use Claude via the Anthropic API.

### 1. Paper Summarization (`/ai/summarize`)
- **Abstract mode**: 2-3 sentence summary + key points + methodology
- **Full mode**: TL;DR + contributions + significance + difficulty level
- **Concepts mode**: Extract keywords, research areas, methods, datasets

### 2. Collaborator Recommendation (`/ai/recommend/collaborators`)
Two-stage pipeline:
1. **Fast pre-filter**: Jaccard similarity on research interest sets
2. **AI deep-rank**: Claude analyzes top candidates and explains fit, collaboration type, and potential projects

### 3. Venue Recommendation (`/ai/recommend/venues/{paper_id}`)
Matches paper abstract + keywords against all conferences/journals in DB.
Returns ranked list with:
- Fit score, acceptance probability, submission tips
- Overall submission strategy
- Paper strengths and improvement suggestions

### 4. Trend Analysis (`/ai/trends`)
- Analyzes corpus of papers from DB **or** uses domain knowledge
- Returns: hot topics with trend scores, emerging areas, research gaps, interdisciplinary opportunities, predicted breakthroughs

### 5. Research Directions (`/ai/directions`)
Personalized suggestions based on user's research interests:
- Direction title, description, novelty, feasibility, timeline, impact
- Cross-field intersection opportunities

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

Use Docker Compose if you want to run the whole app with one command. This starts:
- PostgreSQL database
- Redis
- FastAPI backend
- React/Vite frontend

```bash
# 1. Clone the project
git clone <repo-url>
cd ResourceMgmtSys

# 2. Optional: set your Anthropic API key for AI features
# The app can run without this, but /ai endpoints may fail until it is set.
export ANTHROPIC_API_KEY="your_api_key_here"

# 3. Build and start all services in the background
docker compose up --build -d

# 4. Check that containers are running
docker ps

# 5. Check the backend health endpoint
curl http://localhost:8000/health
```

After startup, open:

```text
Frontend: http://localhost:3001
API docs:  http://localhost:8000/docs
API root health check: http://localhost:8000/health
```

To stop the app:

```bash
docker compose down
```

#### Docker Compose Notes
- The frontend is exposed on `localhost:3001` because `3000` is commonly used by other local dev servers.
- Redis is available inside Docker Compose as `redis:6379`; it is not published to the host, so it will not conflict with another Redis already using `localhost:6379`.
- If you see `ANTHROPIC_API_KEY is not set`, the core app still starts. Add the key only if you want AI endpoints to work.
- If port `8000` or `5432` is already in use, stop the conflicting local service or change the matching `ports` entry in `docker-compose.yml`.

Useful commands:

```bash
# View logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# Rebuild after dependency or Dockerfile changes
docker compose up --build -d
```

### Option B: Local Development

#### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL 14+
- Redis 7+

#### Backend setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp ../.env.example ../.env
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# Initialize database (creates tables + loads seed data)
psql -U postgres -c "CREATE DATABASE research_collab;"
psql -U postgres -d research_collab -f ../database/schema.sql
psql -U postgres -d research_collab -f ../database/triggers.sql
psql -U postgres -d research_collab -f ../database/views_procedures.sql
psql -U postgres -d research_collab -f ../database/seed_data.sql

# Start the API server
cd ..
uvicorn backend.main:app --reload --port 8000
```

#### Frontend setup
```bash
cd frontend

# Install dependencies
npm install

# Set API URL
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env

# Start dev server
npm run dev
```

The local frontend defaults to Vite's dev port, usually `http://localhost:5173`, unless that port is already busy.

---

## 📡 API Reference

Interactive docs available at `http://localhost:8000/docs` (Swagger UI).

### Authentication
```bash
# Register
POST /api/v1/auth/register
{"email":"you@uni.edu","username":"yourname","password":"Password123!","full_name":"Dr. You"}

# Login
POST /api/v1/auth/login
form-data: username=you@uni.edu, password=Password123!
# → Returns: access_token, refresh_token
```

### Core Endpoints
```
# Users
GET    /api/v1/users/me
PATCH  /api/v1/users/me
POST   /api/v1/users/me/interests   {"topic": "machine learning", "weight": 0.9}
POST   /api/v1/users/me/skills      {"skill": "Python", "level": "expert"}

# Papers
POST   /api/v1/papers/              {"title": "...", "abstract": "...", "keywords": [...]}
GET    /api/v1/papers/?search=llm&status=published
PATCH  /api/v1/papers/{id}/status   {"status": "submitted"}
GET    /api/v1/papers/{id}/versions

# Projects
POST   /api/v1/projects/
POST   /api/v1/projects/{id}/members   {"user_id": "...", "role": "co_author"}
POST   /api/v1/projects/{id}/milestones
PATCH  /api/v1/projects/{id}/milestones/{ms_id}/complete

# References
POST   /api/v1/references              {"title":"...", "authors":[...], "year":2024}
POST   /api/v1/papers/{id}/references/{ref_id}
GET    /api/v1/papers/{id}/references/export/bibtex

# Collaborations
POST   /api/v1/collaborations/requests    {"target_id": "...", "message": "..."}
PATCH  /api/v1/collaborations/requests/{id}/respond   {"status": "accepted"}

# AI Features
POST   /api/v1/ai/summarize             {"text": "abstract...", "mode": "abstract"}
POST   /api/v1/ai/summarize/paper/{id}
GET    /api/v1/ai/recommend/collaborators
GET    /api/v1/ai/recommend/venues/{paper_id}
POST   /api/v1/ai/trends               {"domain": "NLP"}
GET    /api/v1/ai/directions
```

---

## 🔄 Complete Workflow Example

Here's a full end-to-end scenario using the API:

```bash
BASE=http://localhost:8000/api/v1
TOKEN="Bearer your_jwt_token"

# 1. Register and login
curl -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"alice.chen@mit.edu","username":"alice_chen","password":"Password123!","full_name":"Dr. Alice Chen","institution":"MIT"}'

# 2. Add research interests
curl -X POST $BASE/users/me/interests -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" -d '{"topic":"large language models","weight":0.95}'

# 3. Create a project
curl -X POST $BASE/projects/ -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"LLM Knowledge Extraction","tags":["nlp","llm"],"is_public":true}'

# 4. Create a paper under that project
curl -X POST $BASE/papers/ -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"AutoKG: Automated Knowledge Graph Construction","abstract":"We present...","keywords":["knowledge graphs","LLM"],"project_id":"<project_id>"}'

# 5. Get AI summary of the paper
curl -X POST $BASE/ai/summarize/paper/<paper_id> -H "Authorization: $TOKEN"

# 6. Get venue recommendations
curl $BASE/ai/recommend/venues/<paper_id> -H "Authorization: $TOKEN"

# 7. Add a reference and link it
curl -X POST $BASE/references -H "Authorization: $TOKEN" \
  -d '{"title":"Attention Is All You Need","authors":["Vaswani et al."],"year":2017,"doi":"10.48550/arXiv.1706.03762"}'
curl -X POST $BASE/papers/<paper_id>/references/<ref_id> -H "Authorization: $TOKEN"

# 8. Get AI collaborator recommendations
curl $BASE/ai/recommend/collaborators -H "Authorization: $TOKEN"

# 9. Send a collaboration request
curl -X POST $BASE/collaborations/requests -H "Authorization: $TOKEN" \
  -d '{"target_id":"<user_id>","message":"Hi, I think our research interests align well..."}'

# 10. Submit paper and update status
curl -X PATCH $BASE/papers/<paper_id>/status -H "Authorization: $TOKEN" \
  -d '{"status":"submitted","submission_date":"2024-10-15"}'

# 11. Analyze trends in your field
curl -X POST $BASE/ai/trends -H "Authorization: $TOKEN" \
  -d '{"domain":"natural language processing","paper_ids":["<id1>","<id2>"]}'
```

---

## 🔧 Extending the System

### Adding a New AI Feature
```python
# 1. Create backend/ai/my_feature.py
from .base import AIServiceBase

class MyFeature(AIServiceBase):
    def run(self, data: dict) -> dict:
        return self._call_claude_json(SYSTEM, user_prompt)

# 2. Register in backend/ai/routes.py
from .my_feature import MyFeature
my_feature = MyFeature()

@router.post("/ai/my-feature")
def my_feature_endpoint(...):
    return my_feature.run(data)
```

### Adding a New Module
```
1. Create backend/modules/mymodule/models.py   (SQLAlchemy ORM)
2. Create backend/modules/mymodule/routes.py   (FastAPI router)
3. Add import in backend/main.py               (register router)
4. Add CREATE TABLE in database/schema.sql
5. Add API calls in frontend/src/api/client.js
6. Create frontend/src/pages/MyPage.jsx
7. Add route in frontend/src/App.jsx
```

### Swapping the AI Model
Update `AI_MODEL` in `.env`:
```
AI_MODEL=claude-opus-4-6   # for more powerful analysis
AI_MODEL=claude-haiku-4-5-20251001  # for faster, cheaper responses
```

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v --asyncio-mode=auto
```

---

## 📦 Production Deployment

1. Set `ENVIRONMENT=production` and `DEBUG=false` in `.env`
2. Replace `SECRET_KEY` with a cryptographically random 64-char string
3. Run database migrations with **Alembic** instead of `init_db()`
4. Use **Nginx** as a reverse proxy in front of uvicorn
5. Set `ALLOWED_ORIGINS` to your actual frontend domain
6. Enable **Redis** for AI response caching (already wired in `AIServiceBase`)
7. Use **Celery** workers for background tasks (deadline reminders, AI pre-computation)

---

## 📄 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Database** | PostgreSQL 16 with triggers, views, stored procedures |
| **Backend** | Python 3.12 + FastAPI + SQLAlchemy 2.0 |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **AI** | Anthropic Claude (claude-sonnet-4-20250514) |
| **Caching** | Redis (AI responses + sessions) |
| **Frontend** | React 18 + Vite + TailwindCSS |
| **State** | Zustand + TanStack Query |
| **Charts** | Recharts |
| **Container** | Docker + Docker Compose |

---

## 🐛 Demo Credentials

After running seed data:
- `alice.chen@mit.edu` / `Password123!`   — NLP researcher
- `bob.patel@stanford.edu` / `Password123!`  — ML researcher
- `carol.jones@oxford.edu` / `Password123!`  — Quantum computing researcher
- `admin@researchhub.io` / `Password123!`    — Admin
# Research-Collab-Hub
