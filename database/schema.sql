-- ============================================================
-- Collaborative Research Paper & Resource Management System
-- Database Schema - PostgreSQL
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('researcher', 'admin', 'reviewer', 'guest');
CREATE TYPE paper_status AS ENUM ('draft', 'in_review', 'submitted', 'accepted', 'rejected', 'published');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE collaboration_role AS ENUM ('lead', 'co_author', 'contributor', 'reviewer');
CREATE TYPE recommendation_type AS ENUM ('collaborator', 'conference', 'journal', 'reference');

-- ============================================================
-- MODULE: USERS
-- ============================================================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          user_role NOT NULL DEFAULT 'researcher',
    institution   VARCHAR(255),
    department    VARCHAR(255),
    bio           TEXT,
    orcid_id      VARCHAR(50),                      -- ORCID researcher ID
    h_index       INTEGER DEFAULT 0,
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN DEFAULT TRUE,
    is_verified   BOOLEAN DEFAULT FALSE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE research_interests (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic      VARCHAR(255) NOT NULL,
    weight     FLOAT DEFAULT 1.0,                   -- interest strength 0-1
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, topic)
);

CREATE TABLE user_skills (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill      VARCHAR(255) NOT NULL,
    level      VARCHAR(50) CHECK (level IN ('beginner','intermediate','expert')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, skill)
);

-- ============================================================
-- MODULE: PROJECTS
-- ============================================================

CREATE TABLE projects (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    status        project_status DEFAULT 'planning',
    owner_id      UUID NOT NULL REFERENCES users(id),
    start_date    DATE,
    end_date      DATE,
    funding_info  TEXT,
    file_url      VARCHAR(1000),                      -- uploaded file URL
    tags          TEXT[],                            -- array of topic tags
    is_public     BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE project_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       collaboration_role DEFAULT 'contributor',
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE TABLE project_milestones (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MODULE: PAPERS
-- ============================================================

CREATE TABLE papers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id     UUID REFERENCES projects(id) ON DELETE SET NULL,
    title          VARCHAR(1000) NOT NULL,
    abstract       TEXT,
    keywords       TEXT[],
    status         paper_status DEFAULT 'draft',
    doi            VARCHAR(255) UNIQUE,
    arxiv_id       VARCHAR(100),
    pdf_url        VARCHAR(1000),
    word_count     INTEGER,
    page_count     INTEGER,
    submission_date DATE,
    published_date  DATE,
    version        INTEGER DEFAULT 1,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_authors (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name  VARCHAR(255) NOT NULL,             -- for external authors
    author_email VARCHAR(255),
    order_index  INTEGER NOT NULL DEFAULT 0,         -- author ordering
    is_corresponding BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_id, order_index)
);

CREATE TABLE paper_versions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id    UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL,
    pdf_url     VARCHAR(1000),
    change_log  TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_id, version)
);

CREATE TABLE paper_summaries (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE UNIQUE,
    summary      TEXT,
    key_points   TEXT[],
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    model_used   VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MODULE: REFERENCES
-- ============================================================

CREATE TABLE references (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id      UUID REFERENCES papers(id) ON DELETE SET NULL,  -- which paper cites this
    title         VARCHAR(1000) NOT NULL,
    authors       TEXT[],
    year          INTEGER CHECK (year > 1800 AND year <= EXTRACT(YEAR FROM NOW()) + 1),
    doi           VARCHAR(255),
    arxiv_id      VARCHAR(100),
    journal       VARCHAR(500),
    conference    VARCHAR(500),
    url           VARCHAR(1000),
    citation_key  VARCHAR(100),                     -- BibTeX key
    abstract      TEXT,
    tags          TEXT[],
    added_by      UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_references (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id     UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL REFERENCES references(id) ON DELETE CASCADE,
    context      TEXT,                              -- how reference is used
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_id, reference_id)
);

-- ============================================================
-- MODULE: COLLABORATIONS
-- ============================================================

CREATE TABLE collaboration_requests (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id),
    target_id    UUID NOT NULL REFERENCES users(id),
    project_id   UUID REFERENCES projects(id),
    paper_id     UUID REFERENCES papers(id),
    message      TEXT,
    status       VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
    responded_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_request CHECK (requester_id != target_id)
);

CREATE TABLE ai_collaboration_recommendations (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    for_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score            FLOAT NOT NULL CHECK (score BETWEEN 0 AND 1),
    reasons          TEXT[],
    common_topics    TEXT[],
    generated_at     TIMESTAMPTZ DEFAULT NOW(),
    is_dismissed     BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(for_user_id, recommended_id)
);

-- ============================================================
-- MODULE: CONFERENCES & JOURNALS
-- ============================================================

CREATE TABLE conferences (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               VARCHAR(500) NOT NULL,
    abbreviation       VARCHAR(50),
    description        TEXT,
    website            VARCHAR(500),
    location           VARCHAR(255),
    country            VARCHAR(100),
    is_virtual         BOOLEAN DEFAULT FALSE,
    research_areas     TEXT[],
    acceptance_rate    FLOAT CHECK (acceptance_rate BETWEEN 0 AND 1),
    impact_factor      FLOAT,
    ranking            VARCHAR(50),                 -- A*, A, B, C, etc.
    submission_deadline TIMESTAMPTZ,
    notification_date  TIMESTAMPTZ,
    conference_date    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(500) NOT NULL,
    abbreviation    VARCHAR(100),
    issn            VARCHAR(20),
    publisher       VARCHAR(255),
    website         VARCHAR(500),
    impact_factor   FLOAT,
    h_index         INTEGER,
    research_areas  TEXT[],
    open_access     BOOLEAN DEFAULT FALSE,
    acceptance_rate FLOAT CHECK (acceptance_rate BETWEEN 0 AND 1),
    review_speed    INTEGER,                         -- avg days to decision
    ranking         VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id        UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    conference_id   UUID REFERENCES conferences(id),
    journal_id      UUID REFERENCES journals(id),
    submitted_at    TIMESTAMPTZ,
    status          VARCHAR(50) DEFAULT 'planned'
                    CHECK (status IN ('planned','submitted','under_review','accepted','rejected','withdrawn')),
    decision_date   TIMESTAMPTZ,
    reviewer_notes  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_venue CHECK (
        (conference_id IS NULL) != (journal_id IS NULL)
    )
);

CREATE TABLE ai_venue_recommendations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id        UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    conference_id   UUID REFERENCES conferences(id),
    journal_id      UUID REFERENCES journals(id),
    score           FLOAT NOT NULL CHECK (score BETWEEN 0 AND 1),
    reasoning       TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_venue CHECK (
        (conference_id IS NULL) != (journal_id IS NULL)
    )
);

-- ============================================================
-- MODULE: NOTIFICATIONS & ACTIVITY
-- ============================================================

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(100) NOT NULL,               -- 'deadline', 'collab_request', etc.
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    link       VARCHAR(500),
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    metadata    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MODULE: TREND ANALYSIS CACHE
-- ============================================================

CREATE TABLE research_trends (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic        VARCHAR(255) NOT NULL,
    trend_score  FLOAT,
    growth_rate  FLOAT,
    paper_count  INTEGER,
    year         INTEGER,
    insights     TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(topic, year)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_institution ON users(institution);
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_research_interests_user ON research_interests(user_id);
CREATE INDEX idx_research_interests_topic ON research_interests USING gin(to_tsvector('english', topic));

-- Projects
CREATE INDEX idx_projects_owner    ON projects(owner_id);
CREATE INDEX idx_projects_status   ON projects(status);
CREATE INDEX idx_projects_tags     ON projects USING gin(tags);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user    ON project_members(user_id);

-- Papers
CREATE INDEX idx_papers_project    ON papers(project_id);
CREATE INDEX idx_papers_status     ON papers(status);
CREATE INDEX idx_papers_keywords   ON papers USING gin(keywords);
CREATE INDEX idx_papers_title_fts  ON papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract_fts ON papers USING gin(to_tsvector('english', coalesce(abstract, '')));
CREATE INDEX idx_paper_authors_paper ON paper_authors(paper_id);
CREATE INDEX idx_paper_authors_user  ON paper_authors(user_id);

-- References
CREATE INDEX idx_references_paper  ON references(paper_id);
CREATE INDEX idx_references_doi    ON references(doi);
CREATE INDEX idx_references_title_fts ON references USING gin(to_tsvector('english', title));

-- Conferences
CREATE INDEX idx_conferences_deadline ON conferences(submission_deadline);
CREATE INDEX idx_conferences_areas    ON conferences USING gin(research_areas);

-- Notifications
CREATE INDEX idx_notifications_user   ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Activity
CREATE INDEX idx_activity_user     ON activity_log(user_id);
CREATE INDEX idx_activity_entity   ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created  ON activity_log(created_at DESC);
