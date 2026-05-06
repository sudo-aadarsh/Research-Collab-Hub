"""
ai/conference_recommender.py - Recommends best conferences and journals for a paper.
ai/trend_analyzer.py         - Identifies hot topics and research trends.
"""
from typing import List, Optional
from .base import AIServiceBase, settings


# ══════════════════════════════════════════════════════════════════════════
# Conference / Journal Recommender
# ══════════════════════════════════════════════════════════════════════════

VENUE_SYSTEM = """You are an expert academic publishing advisor with deep knowledge
of research venues across all computer science, AI, physics, and engineering domains.
You give specific, actionable venue recommendations with honest assessments of fit,
competitiveness, and likelihood of acceptance."""


class ConferenceRecommender(AIServiceBase):
    """
    Recommends best submission venues (conferences + journals) for a paper.
    """

    def run(self, paper: dict, venues: List[dict]) -> dict:
        """
        Recommend venues for a paper.

        Args:
            paper:  Dict with title, abstract, keywords, status
            venues: List of venue dicts from DB (conferences + journals)

        Returns:
            Dict with ranked conference and journal recommendations
        """
        if not venues:
            return {"conferences": [], "journals": [], "advice": "No venues found in database."}

        cache_key = self._cache_key(
            "venue_recommend",
            paper.get("title", "")[:200],
            str([v.get("id") for v in venues[:20]]),
        )
        if cached := self._cached(cache_key):
            return cached

        # Build venue summary for prompt
        conf_list = [v for v in venues if v.get("type") == "conference"][:12]
        jour_list = [v for v in venues if v.get("type") == "journal"][:8]

        conf_text = "\n".join([
            f"- ID:{v['id']} | {v['name']} ({v.get('abbreviation','')}) | "
            f"Ranking:{v.get('ranking','?')} | Accept:{v.get('acceptance_rate','?')} | "
            f"Areas:{','.join(v.get('research_areas',[])[:4])} | "
            f"Deadline:{v.get('submission_deadline','?')}"
            for v in conf_list
        ])
        jour_text = "\n".join([
            f"- ID:{v['id']} | {v['name']} ({v.get('abbreviation','')}) | "
            f"IF:{v.get('impact_factor','?')} | Ranking:{v.get('ranking','?')} | "
            f"Accept:{v.get('acceptance_rate','?')} | "
            f"Areas:{','.join(v.get('research_areas',[])[:4])}"
            for v in jour_list
        ])

        user_prompt = f"""Recommend the best submission venues for this paper:

<paper>
Title: {paper.get('title')}
Abstract: {paper.get('abstract', '')[:600]}
Keywords: {', '.join(paper.get('keywords', []))}
</paper>

<available_conferences>
{conf_text}
</available_conferences>

<available_journals>
{jour_text}
</available_journals>

Return JSON:
{{
  "top_conferences": [
    {{
      "venue_id": "...",
      "name": "...",
      "fit_score": 0.0-1.0,
      "reasoning": "why this is a good fit",
      "acceptance_probability": "high|medium|low",
      "tips": "specific advice to improve chances",
      "deadline_urgency": "urgent|comfortable|plenty_of_time"
    }}
  ],
  "top_journals": [
    {{
      "venue_id": "...",
      "name": "...",
      "fit_score": 0.0-1.0,
      "reasoning": "why this is a good fit",
      "expected_review_time": "X months",
      "tips": "specific advice for this journal"
    }}
  ],
  "overall_strategy": "strategic advice for submission and positioning",
  "paper_strengths": ["strength 1", "strength 2"],
  "suggested_improvements": ["improvement 1", "improvement 2"]
}}

Return top 3-5 conferences and 2-3 journals. Sort by fit_score descending."""

        result = self._call_claude_json(VENUE_SYSTEM, user_prompt, max_tokens=1500)
        if "error" not in result:
            self._store(cache_key, result)
        return result

    def get_submission_checklist(self, paper: dict, venue: dict) -> dict:
        """Generate a submission-ready checklist for a specific paper+venue pair."""
        user_prompt = f"""Create a detailed submission checklist for:

Paper: {paper.get('title')}
Venue: {venue.get('name')} ({venue.get('abbreviation', '')})
Deadline: {venue.get('submission_deadline', 'unknown')}

Return JSON:
{{
  "checklist": [
    {{"item": "...", "priority": "critical|high|medium", "done": false}}
  ],
  "formatting_requirements": "...",
  "common_rejection_reasons": ["reason1", "reason2"],
  "days_needed_estimate": 14
}}"""
        return self._call_claude_json(VENUE_SYSTEM, user_prompt, max_tokens=600)


# ══════════════════════════════════════════════════════════════════════════
# Research Trend Analyzer
# ══════════════════════════════════════════════════════════════════════════

TREND_SYSTEM = """You are an expert research trend analyst with comprehensive knowledge
of academic fields including AI, machine learning, NLP, distributed systems,
quantum computing, bioinformatics, and more.

You identify emerging trends, hot topics, and research opportunities based on
keyword patterns, paper abstracts, and domain knowledge.
Your trend analyses are specific, data-grounded, and actionable."""


class TrendAnalyzer(AIServiceBase):
    """AI service for analyzing research trends from paper data."""

    def run(self, data: dict) -> dict:
        """
        Analyze trends from provided research data.

        Args:
            data: Dict with 'papers' (list of dicts), 'domain' (optional string)

        Returns:
            Trend analysis with hot topics, emerging areas, opportunities
        """
        papers = data.get("papers", [])
        domain = data.get("domain", "general research")

        if not papers:
            return self._domain_trend_analysis(domain)
        return self._corpus_trend_analysis(papers, domain)

    def _corpus_trend_analysis(self, papers: List[dict], domain: str) -> dict:
        """Analyze trends from a collection of papers."""
        cache_key = self._cache_key("trends", domain, len(papers), str([p.get("title", "")[:50] for p in papers[:10]]))
        if cached := self._cached(cache_key):
            return cached

        # Build paper corpus summary
        paper_summaries = "\n".join([
            f"- {p.get('title', 'Untitled')} | Keywords: {', '.join(p.get('keywords', [])[:5])}"
            for p in papers[:30]
        ])

        user_prompt = f"""Analyze research trends from this corpus of papers in {domain}:

<papers>
{paper_summaries}
</papers>

Return comprehensive trend analysis as JSON:
{{
  "hot_topics": [
    {{
      "topic": "topic name",
      "trend_score": 0.0-1.0,
      "momentum": "rising|stable|declining",
      "description": "what's happening in this area",
      "key_papers_themes": ["theme1", "theme2"],
      "why_hot": "reason this is trending"
    }}
  ],
  "emerging_areas": [
    {{
      "area": "area name",
      "description": "brief description",
      "opportunity_level": "high|medium|low",
      "entry_barrier": "low|medium|high"
    }}
  ],
  "research_gaps": ["gap 1", "gap 2", "gap 3"],
  "interdisciplinary_opportunities": [
    "opportunity connecting two fields"
  ],
  "predicted_breakthroughs": ["prediction 1", "prediction 2"],
  "declining_topics": ["topic 1"],
  "overall_field_direction": "2-3 sentence summary of where the field is heading"
}}"""

        if not settings.ANTHROPIC_API_KEY:
            return self._fallback_trend_analysis(domain, papers)

        result = self._call_claude_json(TREND_SYSTEM, user_prompt, max_tokens=1500)
        if "error" in result:
            return self._fallback_trend_analysis(domain, papers)
        if "error" not in result:
            self._store(cache_key, result)
        return result

    def _domain_trend_analysis(self, domain: str) -> dict:
        """Generate trend analysis for a domain using model knowledge."""
        cache_key = self._cache_key("domain_trends", domain)
        if cached := self._cached(cache_key):
            return cached

        user_prompt = f"""What are the current research trends in {domain}?

Return JSON:
{{
  "hot_topics": [
    {{
      "topic": "...",
      "trend_score": 0.0-1.0,
      "momentum": "rising|stable|declining",
      "description": "...",
      "why_hot": "..."
    }}
  ],
  "emerging_areas": [{{"area": "...", "description": "...", "opportunity_level": "high|medium|low"}}],
  "research_gaps": ["gap1", "gap2"],
  "overall_field_direction": "...",
  "top_publication_venues": ["venue1", "venue2"]
}}"""

        if not settings.ANTHROPIC_API_KEY:
            return self._fallback_trend_analysis(domain)

        result = self._call_claude_json(TREND_SYSTEM, user_prompt, max_tokens=1000)
        if "error" in result:
            return self._fallback_trend_analysis(domain)
        if "error" not in result:
            self._store(cache_key, result)
        return result

    def _fallback_trend_analysis(self, domain: str, papers: Optional[List[dict]] = None) -> dict:
        """Return deterministic development data when the AI provider is not configured."""
        normalized = (domain or "computer science").lower()
        domain_topics = {
            "artificial intelligence": [
                ("agentic AI systems", 0.94, "rising", "Tool-using AI systems that can plan, call APIs, and complete multi-step workflows."),
                ("retrieval augmented generation", 0.89, "rising", "Grounding generated answers in private and domain-specific knowledge bases."),
                ("AI safety evaluation", 0.86, "rising", "Benchmarking reliability, robustness, and alignment risks before deployment."),
                ("multimodal foundation models", 0.84, "rising", "Models that combine text, image, audio, video, and structured data."),
                ("efficient fine-tuning", 0.78, "stable", "Parameter-efficient adaptation methods for specialized tasks."),
            ],
            "natural language processing": [
                ("long-context reasoning", 0.91, "rising", "Methods for using long documents without losing factual consistency."),
                ("scientific information extraction", 0.87, "rising", "Extracting claims, entities, datasets, and citations from papers."),
                ("low-resource language modeling", 0.81, "rising", "Improving model quality for languages with limited data."),
                ("evaluation of generated text", 0.79, "stable", "Measuring faithfulness, factuality, and task usefulness."),
            ],
            "machine learning": [
                ("federated learning", 0.84, "rising", "Training models across distributed devices while preserving privacy."),
                ("causal representation learning", 0.82, "rising", "Learning features that capture stable cause-effect structure."),
                ("model compression", 0.78, "stable", "Reducing latency and memory while preserving accuracy."),
                ("uncertainty quantification", 0.76, "stable", "Estimating model confidence for high-stakes decisions."),
            ],
            "quantum computing": [
                ("quantum error correction", 0.9, "rising", "Improving fault tolerance for scalable quantum computers."),
                ("hybrid quantum-classical algorithms", 0.82, "stable", "Combining quantum circuits with classical optimization loops."),
                ("quantum machine learning", 0.76, "rising", "Exploring quantum advantages in learning and optimization."),
            ],
        }
        selected = domain_topics.get(normalized, domain_topics["artificial intelligence"])
        if papers:
            paper_keywords = []
            for paper in papers:
                paper_keywords.extend(paper.get("keywords") or [])
            for keyword in paper_keywords[:3]:
                selected.insert(0, (keyword, 0.83, "rising", f"Appears frequently in the selected {domain} paper corpus."))

        hot_topics = [
            {
                "topic": topic,
                "trend_score": score,
                "momentum": momentum,
                "description": description,
                "why_hot": "Active publication growth and strong practical demand make this area attractive for new work.",
            }
            for topic, score, momentum, description in selected[:8]
        ]
        return {
            "hot_topics": hot_topics,
            "emerging_areas": [
                {
                    "area": f"trustworthy {normalized}",
                    "description": "Combines performance with reliability, transparency, and human oversight.",
                    "opportunity_level": "high",
                },
                {
                    "area": f"domain-specific {normalized}",
                    "description": "Adapts general methods to scientific, medical, legal, and engineering workflows.",
                    "opportunity_level": "medium",
                },
            ],
            "research_gaps": [
                "Better benchmarks that reflect real-world use rather than isolated leaderboard tasks.",
                "More reproducible studies with open datasets, ablations, and deployment constraints.",
                "Clearer measurement of cost, latency, reliability, and downstream impact.",
            ],
            "interdisciplinary_opportunities": [
                f"Apply {normalized} methods to scientific literature mining and research workflow automation.",
                "Combine human-computer interaction with model evaluation for safer expert-facing tools.",
            ],
            "predicted_breakthroughs": [
                "Smaller specialized models matching larger general models on narrow research workflows.",
                "More reliable systems that cite evidence and expose uncertainty during decision support.",
            ],
            "declining_topics": ["single-metric leaderboard optimization without deployment analysis"],
            "overall_field_direction": (
                f"{domain.title()} is moving toward reliable, domain-aware systems that can be evaluated in real workflows. "
                "The strongest opportunities are at the intersection of practical deployment, trustworthy evaluation, and specialized data."
            ),
            "top_publication_venues": ["NeurIPS", "ICLR", "ACL", "JMLR"],
            "source": "local_fallback_no_anthropic_key",
        }

    def suggest_research_directions(self, user_interests: List[str]) -> dict:
        """
        Suggest specific research directions for a researcher based on their interests.
        """
        user_prompt = f"""Suggest concrete research directions for a researcher with these interests:
{', '.join(user_interests)}

Return JSON:
{{
  "recommended_directions": [
    {{
      "title": "Research direction title",
      "description": "What to research and why",
      "novelty": "What makes this novel",
      "feasibility": "high|medium|low",
      "estimated_timeline": "6 months | 1 year | 2+ years",
      "potential_impact": "high|medium|low",
      "required_skills": ["skill1", "skill2"],
      "suggested_collaborators_profile": "type of collaborator needed"
    }}
  ],
  "hot_intersections": ["area where two of your interests intersect in an exciting way"],
  "funding_areas": ["likely funding agencies or programs for these directions"]
}}

Provide 3-5 specific, actionable directions."""

        return self._call_claude_json(TREND_SYSTEM, user_prompt, max_tokens=1200)
