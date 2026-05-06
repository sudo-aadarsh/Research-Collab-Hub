-- ============================================================
-- Seed Data - Example data for development/testing
-- ============================================================

-- -------------------------------------------------------
-- Users (passwords are bcrypt of "Password123!")
-- -------------------------------------------------------
INSERT INTO users (id, email, username, password_hash, full_name, role, institution, department, bio, h_index) VALUES
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    'alice.chen@mit.edu', 'alice_chen',
    '$2b$12$dxQ8aDKJWlz1D3Ffxix8PuTlas.kH3zwl592sLNKkkOTj/NMfD6wO',
    'Dr. Alice Chen', 'researcher', 'MIT', 'Computer Science',
    'AI researcher focused on NLP and knowledge graphs.', 18
),
(
    'a1b2c3d4-0002-0002-0002-000000000002',
    'bob.patel@stanford.edu', 'bob_patel',
    '$2b$12$dxQ8aDKJWlz1D3Ffxix8PuTlas.kH3zwl592sLNKkkOTj/NMfD6wO',
    'Dr. Bob Patel', 'researcher', 'Stanford University', 'Electrical Engineering',
    'Expert in machine learning systems and distributed computing.', 24
),
(
    'a1b2c3d4-0003-0003-0003-000000000003',
    'carol.jones@oxford.edu', 'carol_jones',
    '$2b$12$dxQ8aDKJWlz1D3Ffxix8PuTlas.kH3zwl592sLNKkkOTj/NMfD6wO',
    'Prof. Carol Jones', 'researcher', 'University of Oxford', 'Physics',
    'Quantum computing and quantum information theory researcher.', 31
),
(
    'a1b2c3d4-0004-0004-0004-000000000004',
    'admin@researchhub.io', 'admin',
    '$2b$12$dxQ8aDKJWlz1D3Ffxix8PuTlas.kH3zwl592sLNKkkOTj/NMfD6wO',
    'System Administrator', 'admin', 'ResearchHub', 'Platform',
    'Platform administrator.', 0
);

-- -------------------------------------------------------
-- Research Interests
-- -------------------------------------------------------
INSERT INTO research_interests (user_id, topic, weight) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', 'natural language processing', 0.95),
('a1b2c3d4-0001-0001-0001-000000000001', 'knowledge graphs', 0.85),
('a1b2c3d4-0001-0001-0001-000000000001', 'large language models', 0.90),
('a1b2c3d4-0001-0001-0001-000000000001', 'information retrieval', 0.75),

('a1b2c3d4-0002-0002-0002-000000000002', 'machine learning', 0.95),
('a1b2c3d4-0002-0002-0002-000000000002', 'large language models', 0.80),
('a1b2c3d4-0002-0002-0002-000000000002', 'distributed systems', 0.85),
('a1b2c3d4-0002-0002-0002-000000000002', 'neural networks', 0.88),

('a1b2c3d4-0003-0003-0003-000000000003', 'quantum computing', 0.95),
('a1b2c3d4-0003-0003-0003-000000000003', 'quantum information', 0.90),
('a1b2c3d4-0003-0003-0003-000000000003', 'machine learning', 0.60),
('a1b2c3d4-0003-0003-0003-000000000003', 'cryptography', 0.70);

-- -------------------------------------------------------
-- User Skills
-- -------------------------------------------------------
INSERT INTO user_skills (user_id, skill, level) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', 'Python', 'expert'),
('a1b2c3d4-0001-0001-0001-000000000001', 'PyTorch', 'expert'),
('a1b2c3d4-0001-0001-0001-000000000001', 'BERT/Transformers', 'expert'),
('a1b2c3d4-0002-0002-0002-000000000002', 'Python', 'expert'),
('a1b2c3d4-0002-0002-0002-000000000002', 'TensorFlow', 'expert'),
('a1b2c3d4-0002-0002-0002-000000000002', 'Kubernetes', 'intermediate'),
('a1b2c3d4-0003-0003-0003-000000000003', 'Qiskit', 'expert'),
('a1b2c3d4-0003-0003-0003-000000000003', 'MATLAB', 'expert');

-- -------------------------------------------------------
-- Projects
-- -------------------------------------------------------
INSERT INTO projects (id, title, description, status, owner_id, start_date, end_date, tags, is_public) VALUES
(
    'b1b2c3d4-0001-0001-0001-000000000001',
    'LLM-Powered Knowledge Graph Construction',
    'Automatically constructing knowledge graphs from scientific literature using large language models.',
    'active',
    'a1b2c3d4-0001-0001-0001-000000000001',
    '2024-01-15', '2024-12-31',
    ARRAY['nlp', 'knowledge-graphs', 'llm', 'information-extraction'],
    TRUE
),
(
    'b1b2c3d4-0002-0002-0002-000000000002',
    'Scalable Federated Learning Framework',
    'A privacy-preserving distributed ML framework for heterogeneous edge devices.',
    'active',
    'a1b2c3d4-0002-0002-0002-000000000002',
    '2024-03-01', '2025-03-01',
    ARRAY['federated-learning', 'distributed-systems', 'privacy', 'ml'],
    TRUE
);

-- Project Members
INSERT INTO project_members (project_id, user_id, role) VALUES
('b1b2c3d4-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'lead'),
('b1b2c3d4-0001-0001-0001-000000000001', 'a1b2c3d4-0002-0002-0002-000000000002', 'co_author'),
('b1b2c3d4-0002-0002-0002-000000000002', 'a1b2c3d4-0002-0002-0002-000000000002', 'lead'),
('b1b2c3d4-0002-0002-0002-000000000002', 'a1b2c3d4-0003-0003-0003-000000000003', 'contributor');

-- Project Milestones
INSERT INTO project_milestones (project_id, title, description, due_date, completed_at) VALUES
('b1b2c3d4-0001-0001-0001-000000000001', 'Literature Review', 'Complete survey of related work', '2024-02-28', '2024-02-25'),
('b1b2c3d4-0001-0001-0001-000000000001', 'Dataset Collection', 'Collect and preprocess training data', '2024-04-30', '2024-04-28'),
('b1b2c3d4-0001-0001-0001-000000000001', 'Model Development', 'Build and train the core model', '2024-07-31', NULL),
('b1b2c3d4-0001-0001-0001-000000000001', 'Paper Writing', 'Write and revise the paper', '2024-10-15', NULL),
('b1b2c3d4-0002-0002-0002-000000000002', 'System Design', 'Define architecture and protocols', '2024-04-30', '2024-04-20'),
('b1b2c3d4-0002-0002-0002-000000000002', 'Prototype Implementation', 'Build working prototype', '2024-08-31', NULL);

-- -------------------------------------------------------
-- Papers
-- -------------------------------------------------------
INSERT INTO papers (id, project_id, title, abstract, keywords, status, doi) VALUES
(
    'c1b2c3d4-0001-0001-0001-000000000001',
    'b1b2c3d4-0001-0001-0001-000000000001',
    'AutoKG: Automated Knowledge Graph Construction from Scientific Literature Using Large Language Models',
    'We present AutoKG, a novel framework that leverages large language models (LLMs) for the automated extraction and construction of knowledge graphs from scientific literature. Our approach combines named entity recognition, relation extraction, and ontology alignment to produce high-quality knowledge graphs with minimal human supervision. Experiments on benchmark datasets demonstrate a 23% improvement over existing state-of-the-art methods. AutoKG enables researchers to quickly navigate and discover connections in large corpora of scientific papers.',
    ARRAY['knowledge graphs', 'large language models', 'information extraction', 'NLP', 'scientific literature'],
    'in_review',
    NULL
),
(
    'c1b2c3d4-0002-0002-0002-000000000002',
    'b1b2c3d4-0002-0002-0002-000000000002',
    'FedScale: Communication-Efficient Federated Learning for Heterogeneous Edge Networks',
    'Federated learning holds great promise for privacy-preserving model training, but faces challenges in heterogeneous network environments with non-IID data distributions. We introduce FedScale, a communication-efficient federated learning framework that adapts to device heterogeneity through adaptive compression and asynchronous aggregation. Our system reduces communication overhead by 67% while maintaining model accuracy within 1.2% of centralized training benchmarks.',
    ARRAY['federated learning', 'distributed systems', 'privacy', 'edge computing', 'communication efficiency'],
    'draft',
    NULL
);

-- Paper Authors
INSERT INTO paper_authors (paper_id, user_id, author_name, author_email, order_index, is_corresponding) VALUES
('c1b2c3d4-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'Dr. Alice Chen', 'alice.chen@mit.edu', 0, TRUE),
('c1b2c3d4-0001-0001-0001-000000000001', 'a1b2c3d4-0002-0002-0002-000000000002', 'Dr. Bob Patel', 'bob.patel@stanford.edu', 1, FALSE),
('c1b2c3d4-0002-0002-0002-000000000002', 'a1b2c3d4-0002-0002-0002-000000000002', 'Dr. Bob Patel', 'bob.patel@stanford.edu', 0, TRUE),
('c1b2c3d4-0002-0002-0002-000000000002', 'a1b2c3d4-0003-0003-0003-000000000003', 'Prof. Carol Jones', 'carol.jones@oxford.edu', 1, FALSE);

-- -------------------------------------------------------
-- Conferences
-- -------------------------------------------------------
INSERT INTO conferences (id, name, abbreviation, research_areas, ranking, acceptance_rate, submission_deadline, conference_date, location) VALUES
('d1b2c3d4-0001-0001-0001-000000000001', 'Neural Information Processing Systems', 'NeurIPS', ARRAY['machine learning', 'neural networks', 'AI'], 'A*', 0.26, '2024-05-22 23:59:00+00', '2024-12-10 09:00:00+00', 'Vancouver, Canada'),
('d1b2c3d4-0002-0002-0002-000000000002', 'International Conference on Learning Representations', 'ICLR', ARRAY['deep learning', 'representation learning', 'machine learning'], 'A*', 0.32, '2024-10-01 23:59:00+00', '2025-05-07 09:00:00+00', 'Vienna, Austria'),
('d1b2c3d4-0003-0003-0003-000000000003', 'ACL Anthology - Association for Computational Linguistics', 'ACL', ARRAY['natural language processing', 'computational linguistics', 'NLP'], 'A*', 0.23, '2025-02-15 23:59:00+00', '2025-07-27 09:00:00+00', 'Vienna, Austria'),
('d1b2c3d4-0004-0004-0004-000000000004', 'IEEE International Conference on Computer Communications', 'INFOCOM', ARRAY['networking', 'distributed systems', 'communication'], 'A', 0.19, '2024-07-31 23:59:00+00', '2025-05-19 09:00:00+00', 'London, UK'),
('d1b2c3d4-0005-0005-0005-000000000005', 'International Conference on Quantum Computing', 'QIP', ARRAY['quantum computing', 'quantum information', 'cryptography'], 'A', 0.35, '2024-11-01 23:59:00+00', '2025-01-27 09:00:00+00', 'Taipei, Taiwan');

-- -------------------------------------------------------
-- Journals
-- -------------------------------------------------------
INSERT INTO journals (id, name, abbreviation, impact_factor, research_areas, open_access, acceptance_rate, ranking) VALUES
('e1b2c3d4-0001-0001-0001-000000000001', 'Nature Machine Intelligence', 'Nat. Mach. Intell.', 25.9, ARRAY['machine learning', 'AI', 'robotics'], FALSE, 0.08, 'Q1'),
('e1b2c3d4-0002-0002-0002-000000000002', 'Journal of Machine Learning Research', 'JMLR', 6.1, ARRAY['machine learning', 'statistics', 'neural networks'], TRUE, 0.18, 'Q1'),
('e1b2c3d4-0003-0003-0003-000000000003', 'Artificial Intelligence', 'AIJ', 14.4, ARRAY['artificial intelligence', 'knowledge representation', 'NLP'], FALSE, 0.12, 'Q1'),
('e1b2c3d4-0004-0004-0004-000000000004', 'ACM Transactions on Knowledge Discovery from Data', 'TKDD', 4.0, ARRAY['data mining', 'knowledge graphs', 'information retrieval'], FALSE, 0.20, 'Q2');
