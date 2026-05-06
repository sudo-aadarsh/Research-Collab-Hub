-- ============================================================
-- Database Views
-- ============================================================

-- -------------------------------------------------------
-- View: Full paper details with authors and project
-- -------------------------------------------------------
CREATE OR REPLACE VIEW v_papers_full AS
SELECT
    p.id,
    p.title,
    p.abstract,
    p.keywords,
    p.status,
    p.doi,
    p.arxiv_id,
    p.submission_date,
    p.published_date,
    p.version,
    p.created_at,
    p.updated_at,
    pr.id       AS project_id,
    pr.title    AS project_title,
    -- Aggregate authors as JSON array
    COALESCE(
        json_agg(
            json_build_object(
                'user_id',   pa.user_id,
                'name',      pa.author_name,
                'email',     pa.author_email,
                'order',     pa.order_index,
                'is_corresponding', pa.is_corresponding
            ) ORDER BY pa.order_index
        ) FILTER (WHERE pa.id IS NOT NULL),
        '[]'
    ) AS authors,
    COUNT(DISTINCT pr2.id) AS reference_count
FROM papers p
LEFT JOIN projects      pr  ON pr.id  = p.project_id
LEFT JOIN paper_authors pa  ON pa.paper_id = p.id
LEFT JOIN paper_references pr2 ON pr2.paper_id = p.id
GROUP BY p.id, pr.id, pr.title;

-- -------------------------------------------------------
-- View: User research profile (for collaborator matching)
-- -------------------------------------------------------
CREATE OR REPLACE VIEW v_user_research_profile AS
SELECT
    u.id,
    u.username,
    u.full_name,
    u.institution,
    u.department,
    u.h_index,
    u.orcid_id,
    u.bio,
    -- Research interests as array
    COALESCE(array_agg(DISTINCT ri.topic) FILTER (WHERE ri.topic IS NOT NULL), '{}') AS interests,
    -- Skills as array
    COALESCE(array_agg(DISTINCT us.skill)  FILTER (WHERE us.skill IS NOT NULL), '{}')  AS skills,
    -- Count of published papers
    COUNT(DISTINCT pa.paper_id) FILTER (
        WHERE p.status = 'published'
    ) AS published_paper_count,
    -- Co-authors
    COUNT(DISTINCT pa2.user_id) FILTER (
        WHERE pa2.user_id != u.id
    ) AS co_author_count
FROM users u
LEFT JOIN research_interests ri  ON ri.user_id = u.id
LEFT JOIN user_skills        us  ON us.user_id = u.id
LEFT JOIN paper_authors      pa  ON pa.user_id = u.id
LEFT JOIN papers             p   ON p.id = pa.paper_id
LEFT JOIN paper_authors      pa2 ON pa2.paper_id = pa.paper_id
WHERE u.is_active = TRUE
GROUP BY u.id;

-- -------------------------------------------------------
-- View: Project dashboard summary
-- -------------------------------------------------------
CREATE OR REPLACE VIEW v_project_dashboard AS
SELECT
    pr.id,
    pr.title,
    pr.description,
    pr.status,
    pr.start_date,
    pr.end_date,
    pr.tags,
    u.full_name   AS owner_name,
    u.id          AS owner_id,
    COUNT(DISTINCT pm.user_id)                   AS member_count,
    COUNT(DISTINCT p.id)                         AS paper_count,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'published') AS published_count,
    COUNT(DISTINCT pm2.id)                       AS total_milestones,
    COUNT(DISTINCT pm2.id) FILTER (WHERE pm2.completed_at IS NOT NULL) AS completed_milestones,
    -- Compute progress percentage
    CASE
        WHEN COUNT(DISTINCT pm2.id) = 0 THEN 0
        ELSE ROUND(
            COUNT(DISTINCT pm2.id) FILTER (WHERE pm2.completed_at IS NOT NULL)::NUMERIC
            / COUNT(DISTINCT pm2.id) * 100
        )
    END AS progress_pct,
    -- Next upcoming deadline
    MIN(pm2.due_date) FILTER (WHERE pm2.completed_at IS NULL AND pm2.due_date >= CURRENT_DATE)
        AS next_deadline
FROM projects pr
JOIN    users             u   ON u.id  = pr.owner_id
LEFT JOIN project_members pm  ON pm.project_id = pr.id
LEFT JOIN papers          p   ON p.project_id  = pr.id
LEFT JOIN project_milestones pm2 ON pm2.project_id = pr.id
GROUP BY pr.id, u.full_name, u.id;

-- -------------------------------------------------------
-- View: Co-author network (for graph analysis)
-- -------------------------------------------------------
CREATE OR REPLACE VIEW v_coauthor_network AS
SELECT DISTINCT
    a1.user_id AS author_a,
    a2.user_id AS author_b,
    COUNT(DISTINCT a1.paper_id) AS shared_papers
FROM paper_authors a1
JOIN paper_authors a2
    ON a1.paper_id = a2.paper_id
    AND a1.user_id < a2.user_id     -- avoid duplicates
WHERE a1.user_id IS NOT NULL
  AND a2.user_id IS NOT NULL
GROUP BY a1.user_id, a2.user_id;

-- -------------------------------------------------------
-- View: Upcoming conference deadlines
-- -------------------------------------------------------
CREATE OR REPLACE VIEW v_upcoming_deadlines AS
SELECT
    'conference' AS venue_type,
    id           AS venue_id,
    name,
    abbreviation,
    submission_deadline AS deadline,
    research_areas,
    ranking,
    acceptance_rate,
    (submission_deadline::DATE - CURRENT_DATE) AS days_remaining
FROM conferences
WHERE submission_deadline >= NOW()
ORDER BY submission_deadline ASC;

-- ============================================================
-- Stored Procedures
-- ============================================================

-- -------------------------------------------------------
-- Procedure: Find potential collaborators for a user
-- Returns users with overlapping research interests
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_find_collaborators(
    p_user_id UUID,
    p_limit   INTEGER DEFAULT 10
)
RETURNS TABLE (
    candidate_id   UUID,
    full_name      VARCHAR,
    institution    VARCHAR,
    interests      TEXT[],
    common_topics  TEXT[],
    similarity     FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_interests AS (
        SELECT topic FROM research_interests WHERE user_id = p_user_id
    ),
    candidate_scores AS (
        SELECT
            u.id,
            u.full_name,
            u.institution,
            array_agg(DISTINCT ri.topic) AS all_interests,
            array_agg(DISTINCT ri.topic) FILTER (
                WHERE ri.topic IN (SELECT topic FROM user_interests)
            ) AS common,
            COUNT(DISTINCT ri.topic) FILTER (
                WHERE ri.topic IN (SELECT topic FROM user_interests)
            )::FLOAT AS overlap_count
        FROM users u
        JOIN research_interests ri ON ri.user_id = u.id
        WHERE u.id != p_user_id
          AND u.is_active = TRUE
          -- Exclude existing collaborators
          AND u.id NOT IN (
              SELECT pm.user_id FROM project_members pm
              JOIN project_members pm2 ON pm2.project_id = pm.project_id
              WHERE pm2.user_id = p_user_id
          )
        GROUP BY u.id, u.full_name, u.institution
        HAVING COUNT(DISTINCT ri.topic) FILTER (
            WHERE ri.topic IN (SELECT topic FROM user_interests)
        ) > 0
    )
    SELECT
        cs.id,
        cs.full_name,
        cs.institution,
        cs.all_interests,
        cs.common,
        cs.overlap_count / GREATEST(
            (SELECT COUNT(*) FROM user_interests), 1
        ) AS similarity
    FROM candidate_scores cs
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- Procedure: Get paper statistics for dashboard
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_paper_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total',       COUNT(*),
        'draft',       COUNT(*) FILTER (WHERE p.status = 'draft'),
        'in_review',   COUNT(*) FILTER (WHERE p.status = 'in_review'),
        'submitted',   COUNT(*) FILTER (WHERE p.status = 'submitted'),
        'accepted',    COUNT(*) FILTER (WHERE p.status = 'accepted'),
        'published',   COUNT(*) FILTER (WHERE p.status = 'published'),
        'rejected',    COUNT(*) FILTER (WHERE p.status = 'rejected')
    ) INTO result
    FROM papers p
    JOIN paper_authors pa ON pa.paper_id = p.id
    WHERE pa.user_id = p_user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- Procedure: Upsert research interest with weight
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_upsert_interest(
    p_user_id UUID,
    p_topic   VARCHAR,
    p_weight  FLOAT DEFAULT 1.0
) RETURNS VOID AS $$
BEGIN
    INSERT INTO research_interests (user_id, topic, weight)
    VALUES (p_user_id, lower(trim(p_topic)), p_weight)
    ON CONFLICT (user_id, topic)
    DO UPDATE SET weight = EXCLUDED.weight;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- Procedure: Full-text search across papers + references
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_search_papers(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE(
    id         UUID,
    title      VARCHAR,
    abstract   TEXT,
    status     paper_status,
    rank       FLOAT4
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.title,
        p.abstract,
        p.status,
        ts_rank(
            to_tsvector('english', p.title || ' ' || coalesce(p.abstract, '')),
            plainto_tsquery('english', p_query)
        ) AS rank
    FROM papers p
    WHERE to_tsvector('english', p.title || ' ' || coalesce(p.abstract, ''))
          @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
