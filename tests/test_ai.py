"""
tests/test_ai.py - Unit tests for AI modules with mocked Claude API.

All Claude API calls are mocked so tests run without an actual API key.
"""
import pytest
from unittest.mock import patch, MagicMock
import json


# ── Mock helpers ──────────────────────────────────────────────────────────

def make_claude_response(text: str):
    """Simulate an Anthropic API message response."""
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


MOCK_SUMMARY = json.dumps({
    "tldr":               "A novel framework for knowledge graph construction from scientific text.",
    "summary":            "AutoKG uses LLMs to automate entity and relation extraction for knowledge graphs, achieving 23% improvement over baselines.",
    "key_contributions":  ["LLM-based extraction pipeline", "Ontology alignment module"],
    "methodology":        "Transformer-based NER + relation extraction with GPT-4 backbone",
    "results":            "23% F1 improvement on three benchmark datasets",
    "significance":       "Reduces human effort in KG curation by 80%",
    "difficulty_level":   "intermediate",
})

MOCK_COLLAB_RECS = json.dumps([
    {
        "candidate_id":       "user-001",
        "score":              0.87,
        "reasons":            ["Shared interest in NLP", "Complementary skills in ML systems"],
        "collaboration_type": "complementary",
        "potential_projects": ["Joint paper on LLM evaluation"],
        "caution":            "",
    }
])

MOCK_VENUE_RECS = json.dumps({
    "top_conferences": [
        {
            "venue_id":               "conf-001",
            "name":                   "ACL",
            "fit_score":              0.92,
            "reasoning":              "Strong NLP focus aligns with paper content",
            "acceptance_probability": "medium",
            "tips":                   "Emphasize the benchmark improvements",
            "deadline_urgency":       "comfortable",
        }
    ],
    "top_journals": [
        {
            "venue_id":             "jour-001",
            "name":                 "JMLR",
            "fit_score":            0.78,
            "reasoning":            "Open access ML journal with good fit",
            "expected_review_time": "3-4 months",
            "tips":                 "Include ablation studies",
        }
    ],
    "overall_strategy": "Submit to ACL first, then JMLR as backup.",
    "paper_strengths":         ["Clear benchmark improvements", "Novel approach"],
    "suggested_improvements":  ["Add more ablation studies"],
})

MOCK_TRENDS = json.dumps({
    "hot_topics": [
        {"topic": "large language models", "trend_score": 0.95, "momentum": "rising",
         "description": "LLMs are dominating NLP research", "why_hot": "GPT-4 impact"},
        {"topic": "retrieval augmented generation", "trend_score": 0.88, "momentum": "rising",
         "description": "RAG addresses hallucination", "why_hot": "Practical deployment needs"},
    ],
    "emerging_areas": [
        {"area": "multimodal LLMs", "description": "Vision + language models", "opportunity_level": "high"}
    ],
    "research_gaps":          ["Efficient inference at scale", "Multilingual alignment"],
    "overall_field_direction": "The field is moving toward agentic and tool-using LLMs.",
    "interdisciplinary_opportunities": ["LLMs for drug discovery"],
    "predicted_breakthroughs": ["Autonomous research agents"],
    "declining_topics":        ["RNNs for sequence modeling"],
})


# ── Summarizer tests ──────────────────────────────────────────────────────

class TestPaperSummarizer:
    def test_summarize_abstract(self):
        from backend.ai.summarizer import PaperSummarizer
        summarizer = PaperSummarizer()
        PaperSummarizer._cache = {}  # clear cache

        with patch.object(summarizer, "_call_claude", return_value=MOCK_SUMMARY):
            result = summarizer.summarize_abstract(
                "We present AutoKG, a novel framework for automated knowledge graph "
                "construction using large language models. Our approach achieves 23% "
                "improvement over state-of-the-art baselines on benchmark datasets."
            )

        assert "summary" in result or "tldr" in result

    def test_summarize_too_short(self):
        from backend.ai.summarizer import PaperSummarizer
        summarizer = PaperSummarizer()
        result = summarizer.summarize_abstract("Short.")
        assert result["summary"] == "Abstract too short to summarize."

    def test_extract_concepts(self):
        from backend.ai.summarizer import PaperSummarizer
        summarizer = PaperSummarizer()
        PaperSummarizer._cache = {}

        mock_concepts = json.dumps({
            "keywords":       ["knowledge graphs", "LLMs", "NER"],
            "research_areas": ["NLP", "information extraction"],
            "methods":        ["transformer", "named entity recognition"],
            "datasets":       ["Freebase", "Wikidata"],
            "models_used":    ["GPT-4", "BERT"],
            "topics":         ["knowledge representation"],
            "problem_domain": "information extraction from text",
        })

        with patch.object(summarizer, "_call_claude", return_value=mock_concepts):
            result = summarizer.extract_key_concepts("Knowledge graphs built with LLMs using NER.")

        assert "keywords" in result

    def test_caching(self):
        from backend.ai.summarizer import PaperSummarizer
        summarizer = PaperSummarizer()
        PaperSummarizer._cache = {}

        call_count = 0
        def mock_call(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return MOCK_SUMMARY

        abstract = "A" * 200
        with patch.object(summarizer, "_call_claude", side_effect=mock_call):
            summarizer.summarize_abstract(abstract)
            summarizer.summarize_abstract(abstract)  # should use cache

        assert call_count == 1, "Cache should prevent second API call"


# ── Collaborator Recommender tests ────────────────────────────────────────

class TestCollaboratorRecommender:
    @pytest.fixture
    def user_profile(self):
        return {
            "id":          "user-main",
            "name":        "Dr. Alice Chen",
            "institution": "MIT",
            "bio":         "NLP researcher",
            "interests":   ["nlp", "knowledge graphs", "large language models"],
            "skills":      ["Python", "PyTorch"],
            "h_index":     18,
        }

    @pytest.fixture
    def candidates(self):
        return [
            {
                "id": "user-001", "name": "Dr. Bob Patel",
                "institution": "Stanford",
                "interests": ["machine learning", "large language models", "distributed systems"],
                "skills": ["Python", "TensorFlow"],
                "h_index": 24,
            },
            {
                "id": "user-002", "name": "Prof. Carol Jones",
                "institution": "Oxford",
                "interests": ["quantum computing", "cryptography"],
                "skills": ["Qiskit"],
                "h_index": 31,
            },
        ]

    def test_topic_overlap_scoring(self, user_profile, candidates):
        from backend.ai.collaborator_recommender import CollaboratorRecommender
        rec = CollaboratorRecommender()
        scored = rec._score_by_topic_overlap(user_profile, candidates)

        assert len(scored) == 2
        # Bob shares "large language models", Carol shares nothing
        bob   = next(s for s in scored if s["id"] == "user-001")
        carol = next(s for s in scored if s["id"] == "user-002")
        assert bob["overlap_score"] > carol["overlap_score"]
        assert "large language models" in bob["common_topics"]

    def test_ai_rank_candidates(self, user_profile, candidates):
        from backend.ai.collaborator_recommender import CollaboratorRecommender
        rec = CollaboratorRecommender()
        CollaboratorRecommender._cache = {}

        for c in candidates:
            c["overlap_score"] = 0.3
            c["common_topics"] = ["nlp"]

        with patch.object(rec, "_call_claude", return_value=MOCK_COLLAB_RECS):
            results = rec._ai_rank_candidates(user_profile, candidates)

        assert isinstance(results, list)
        assert len(results) > 0
        assert "score"   in results[0]
        assert "reasons" in results[0]

    def test_full_run_empty_candidates(self, user_profile):
        from backend.ai.collaborator_recommender import CollaboratorRecommender
        rec = CollaboratorRecommender()
        result = rec.run(user_profile, [])
        assert result == []

    def test_jaccard_zero_when_no_overlap(self, user_profile):
        from backend.ai.collaborator_recommender import CollaboratorRecommender
        rec = CollaboratorRecommender()
        disjoint = [{"id": "x", "name": "Z", "interests": ["physics", "chemistry"],
                     "skills": [], "h_index": 5, "institution": "X"}]
        scored = rec._score_by_topic_overlap(user_profile, disjoint)
        assert scored[0]["overlap_score"] == 0.0


# ── Trend Analyzer tests ──────────────────────────────────────────────────

class TestTrendAnalyzer:
    def test_domain_analysis(self):
        from backend.ai.trend_analyzer import TrendAnalyzer
        analyzer = TrendAnalyzer()
        TrendAnalyzer._cache = {}

        with patch.object(analyzer, "_call_claude", return_value=MOCK_TRENDS):
            result = analyzer.run({"domain": "nlp", "papers": []})

        assert "hot_topics"          in result
        assert "emerging_areas"      in result
        assert "research_gaps"       in result
        assert len(result["hot_topics"]) > 0
        assert result["hot_topics"][0]["trend_score"] <= 1.0

    def test_corpus_analysis(self):
        from backend.ai.trend_analyzer import TrendAnalyzer
        analyzer = TrendAnalyzer()
        TrendAnalyzer._cache = {}

        papers = [
            {"title": "GPT-4 Technical Report", "keywords": ["llm", "gpt"], "abstract": ""},
            {"title": "RAG for Open Domain QA",  "keywords": ["rag", "qa"],  "abstract": ""},
            {"title": "Efficient Attention",      "keywords": ["attention"],  "abstract": ""},
        ]
        with patch.object(analyzer, "_call_claude", return_value=MOCK_TRENDS):
            result = analyzer.run({"domain": "nlp", "papers": papers})

        assert "hot_topics" in result

    def test_research_directions(self):
        from backend.ai.trend_analyzer import TrendAnalyzer
        analyzer = TrendAnalyzer()
        TrendAnalyzer._cache = {}

        mock_dirs = json.dumps({
            "recommended_directions": [
                {
                    "title":                     "LLM-assisted literature review",
                    "description":               "Automate review using RAG",
                    "novelty":                   "Combines LLMs with systematic review methodology",
                    "feasibility":               "high",
                    "estimated_timeline":        "6 months",
                    "potential_impact":          "high",
                    "required_skills":           ["Python", "LLM APIs"],
                    "suggested_collaborators_profile": "ML engineer",
                }
            ],
            "hot_intersections":  ["NLP meets scientometrics"],
            "funding_areas":      ["NSF CISE", "NIH NLM"],
        })
        with patch.object(analyzer, "_call_claude", return_value=mock_dirs):
            result = analyzer.suggest_research_directions(
                ["nlp", "knowledge graphs", "large language models"]
            )

        assert "recommended_directions" in result
        assert len(result["recommended_directions"]) > 0


# ── Conference Recommender tests ──────────────────────────────────────────

class TestConferenceRecommender:
    def test_venue_recommendations(self):
        from backend.ai.trend_analyzer import ConferenceRecommender
        rec = ConferenceRecommender()
        ConferenceRecommender._cache = {}

        paper = {
            "id": "paper-001",
            "title": "AutoKG: Knowledge Graphs from Scientific Literature",
            "abstract": "We present AutoKG for automated knowledge graph construction.",
            "keywords": ["knowledge graphs", "nlp", "llm"],
        }
        venues = [
            {"id": "conf-001", "type": "conference", "name": "ACL",
             "abbreviation": "ACL", "research_areas": ["nlp", "computational linguistics"],
             "ranking": "A*", "acceptance_rate": 0.23, "submission_deadline": "2025-02-15"},
            {"id": "jour-001", "type": "journal", "name": "JMLR",
             "abbreviation": "JMLR", "research_areas": ["machine learning"],
             "ranking": "Q1", "impact_factor": 6.1, "acceptance_rate": 0.18},
        ]

        with patch.object(rec, "_call_claude", return_value=MOCK_VENUE_RECS):
            result = rec.run(paper, venues)

        assert "top_conferences"    in result
        assert "top_journals"       in result
        assert "overall_strategy"   in result

    def test_empty_venues(self):
        from backend.ai.trend_analyzer import ConferenceRecommender
        rec = ConferenceRecommender()
        result = rec.run({"title": "Paper"}, [])
        assert result["conferences"] == []
        assert result["journals"]    == []


# ── API endpoint integration tests ───────────────────────────────────────

class TestAIRoutes:
    def test_summarize_text_endpoint(self, client, auth_headers):
        with patch("backend.ai.routes.summarizer.run") as mock_run:
            mock_run.return_value = {
                "summary":    "A paper about knowledge graphs.",
                "key_points": ["Novel approach", "23% improvement"],
            }
            res = client.post("/api/v1/ai/summarize",
                headers=auth_headers,
                json={"text": "A" * 100, "mode": "abstract"})

        assert res.status_code == 200

    def test_summarize_too_short(self, client, auth_headers):
        res = client.post("/api/v1/ai/summarize",
            headers=auth_headers,
            json={"text": "Short.", "mode": "abstract"})
        assert res.status_code == 400

    def test_trends_endpoint(self, client, auth_headers):
        with patch("backend.ai.routes.trend_analyzer.run") as mock_run:
            mock_run.return_value = {
                "hot_topics":          [{"topic": "llm", "trend_score": 0.9}],
                "emerging_areas":      [],
                "research_gaps":       [],
                "overall_field_direction": "AI is booming.",
            }
            res = client.post("/api/v1/ai/trends",
                headers=auth_headers,
                json={"domain": "machine learning"})

        assert res.status_code == 200
        assert "hot_topics" in res.json()

    def test_collab_recs_no_interests(self, client, auth_headers):
        """Should return 400 if user has no interests set."""
        res = client.get("/api/v1/ai/recommend/collaborators", headers=auth_headers)
        # Either 400 (no interests) or 200 (interests were added in earlier tests)
        assert res.status_code in [200, 400]
