-- ============================================================
-- Database Triggers
-- ============================================================

-- -------------------------------------------------------
-- Generic updated_at trigger function
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to all relevant tables
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_papers_updated_at
    BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -------------------------------------------------------
-- Trigger: Auto-create notification on collaboration request
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_collaboration_request()
RETURNS TRIGGER AS $$
DECLARE
    requester_name VARCHAR;
BEGIN
    SELECT full_name INTO requester_name FROM users WHERE id = NEW.requester_id;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
        NEW.target_id,
        'collab_request',
        'New Collaboration Request',
        requester_name || ' wants to collaborate with you.',
        '/collaborations/requests/' || NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collab_request_notify
    AFTER INSERT ON collaboration_requests
    FOR EACH ROW EXECUTE FUNCTION notify_collaboration_request();

-- -------------------------------------------------------
-- Trigger: Notify on collaboration response
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_collaboration_response()
RETURNS TRIGGER AS $$
DECLARE
    target_name VARCHAR;
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('accepted', 'declined') THEN
        SELECT full_name INTO target_name FROM users WHERE id = NEW.target_id;

        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
            NEW.requester_id,
            'collab_response',
            'Collaboration Request ' || initcap(NEW.status),
            target_name || ' has ' || NEW.status || ' your collaboration request.',
            '/collaborations/requests/' || NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_collab_response_notify
    AFTER UPDATE ON collaboration_requests
    FOR EACH ROW EXECUTE FUNCTION notify_collaboration_response();

-- -------------------------------------------------------
-- Trigger: Notify 7 days before conference deadline
-- (Run via scheduled job that calls check_upcoming_deadlines)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION check_upcoming_deadlines()
RETURNS void AS $$
DECLARE
    conf RECORD;
    member RECORD;
BEGIN
    -- Find conferences with deadlines in next 7 days
    FOR conf IN
        SELECT id, name, submission_deadline
        FROM conferences
        WHERE submission_deadline BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    LOOP
        -- Notify all active researchers
        FOR member IN SELECT id FROM users WHERE is_active = TRUE AND role != 'guest'
        LOOP
            INSERT INTO notifications (user_id, type, title, body, link)
            VALUES (
                member.id,
                'deadline_reminder',
                'Deadline Approaching: ' || conf.name,
                'Submission deadline is ' || conf.submission_deadline::DATE || '. Don''t miss it!',
                '/conferences/' || conf.id
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- Trigger: Auto-log activity on paper status changes
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION log_paper_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        INSERT INTO activity_log (action, entity_type, entity_id, metadata)
        VALUES (
            'paper_status_changed',
            'paper',
            NEW.id,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'paper_title', NEW.title
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paper_status_log
    AFTER UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION log_paper_status_change();

-- -------------------------------------------------------
-- Trigger: Increment paper version on update
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_version_paper()
RETURNS TRIGGER AS $$
BEGIN
    -- Only bump version if content fields changed
    IF NEW.title != OLD.title OR NEW.abstract IS DISTINCT FROM OLD.abstract THEN
        NEW.version = OLD.version + 1;

        -- Archive old version
        INSERT INTO paper_versions (paper_id, version, pdf_url, change_log)
        VALUES (OLD.id, OLD.version, OLD.pdf_url, 'Auto-archived before update');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paper_auto_version
    BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION auto_version_paper();

-- -------------------------------------------------------
-- Trigger: Update project status when all milestones done
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION check_project_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_milestones INT;
    completed_milestones INT;
BEGIN
    SELECT COUNT(*) INTO total_milestones
    FROM project_milestones WHERE project_id = NEW.project_id;

    SELECT COUNT(*) INTO completed_milestones
    FROM project_milestones
    WHERE project_id = NEW.project_id AND completed_at IS NOT NULL;

    IF total_milestones > 0 AND total_milestones = completed_milestones THEN
        UPDATE projects SET status = 'completed' WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_completion_check
    AFTER UPDATE ON project_milestones
    FOR EACH ROW EXECUTE FUNCTION check_project_completion();
