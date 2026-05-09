"""
ai/trend_analyzer.py  - Research trend analysis and research direction suggestions.
ai/conference_recommender.py - Venue recommendations for papers.

Supports Google Gemini (free), Ollama (local), Anthropic (paid).
Falls back to intelligent template-based responses when no AI is configured.
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
            return {"top_conferences": [], "top_journals": [], "overall_strategy": "No venues found in database. Please add conferences and journals first."}

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

        result = self._call_ai_json(VENUE_SYSTEM, user_prompt, max_tokens=1500)

        if not result or "error" in result:
            result = self._fallback_venue_recommendations(paper, conf_list, jour_list)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def _fallback_venue_recommendations(self, paper: dict, conferences: List[dict], journals: List[dict]) -> dict:
        """Generate venue recommendations without AI using keyword matching."""
        paper_keywords = set(k.lower() for k in paper.get("keywords", []))
        paper_title = paper.get("title", "").lower()
        paper_abstract = paper.get("abstract", "").lower()
        paper_text = f"{paper_title} {paper_abstract} {' '.join(paper_keywords)}"

        def score_venue(venue: dict) -> float:
            areas = set(a.lower() for a in venue.get("research_areas", []))
            name = venue.get("name", "").lower()
            # Keyword overlap score
            overlap = len(paper_keywords & areas)
            # Name relevance
            name_score = sum(1 for kw in paper_keywords if kw in name) * 0.3
            # Area text match
            area_text_score = sum(1 for area in areas if area in paper_text) * 0.2
            total = min(1.0, (overlap * 0.4 + name_score + area_text_score) / max(1, len(paper_keywords)))
            return round(max(0.3, total), 2)  # minimum 0.3 for any venue

        scored_confs = sorted(
            [{"venue": c, "score": score_venue(c)} for c in conferences],
            key=lambda x: x["score"], reverse=True
        )[:5]

        scored_jours = sorted(
            [{"venue": j, "score": score_venue(j)} for j in journals],
            key=lambda x: x["score"], reverse=True
        )[:3]

        top_conferences = [
            {
                "venue_id": str(item["venue"].get("id", "")),
                "name": item["venue"].get("name", ""),
                "fit_score": item["score"],
                "reasoning": f"This venue covers {', '.join(item['venue'].get('research_areas', [])[:3])} which aligns with your paper's topics.",
                "acceptance_probability": "medium" if item["score"] > 0.5 else "low",
                "tips": f"Ensure your paper clearly addresses {', '.join(item['venue'].get('research_areas', [])[:2])} in the introduction.",
                "deadline_urgency": "comfortable",
            }
            for item in scored_confs
        ]

        top_journals = [
            {
                "venue_id": str(item["venue"].get("id", "")),
                "name": item["venue"].get("name", ""),
                "fit_score": item["score"],
                "reasoning": f"This journal publishes work in {', '.join(item['venue'].get('research_areas', [])[:3])}.",
                "expected_review_time": "3-6 months",
                "tips": "Expand the related work section and ensure rigorous experimental evaluation.",
            }
            for item in scored_jours
        ]

        return {
            "top_conferences": top_conferences,
            "top_journals": top_journals,
            "overall_strategy": (
                f"Based on your paper's keywords ({', '.join(list(paper_keywords)[:4])}), "
                "target venues that specialize in these areas. Consider submitting to a top conference "
                "first for visibility, then extend to a journal for a more comprehensive version."
            ),
            "paper_strengths": [
                "Clear research contribution",
                f"Relevant to {', '.join(list(paper_keywords)[:2]) if paper_keywords else 'the field'}",
            ],
            "suggested_improvements": [
                "Strengthen the experimental evaluation with more baselines",
                "Add a limitations section",
                "Improve the related work coverage",
            ],
            "source": "keyword_matching_fallback",
        }

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
        result = self._call_ai_json(VENUE_SYSTEM, user_prompt, max_tokens=600)
        if not result or "error" in result:
            return {
                "checklist": [
                    {"item": "Verify paper length meets venue requirements", "priority": "critical", "done": False},
                    {"item": "Check formatting guidelines (font, margins, columns)", "priority": "critical", "done": False},
                    {"item": "Ensure all figures are high resolution", "priority": "high", "done": False},
                    {"item": "Proofread for grammar and spelling", "priority": "high", "done": False},
                    {"item": "Verify all references are complete and correctly formatted", "priority": "high", "done": False},
                    {"item": "Check that abstract meets word limit", "priority": "medium", "done": False},
                    {"item": "Ensure author information is anonymized (if double-blind)", "priority": "critical", "done": False},
                    {"item": "Submit supplementary materials if needed", "priority": "medium", "done": False},
                ],
                "formatting_requirements": f"Check the official {venue.get('name', 'venue')} website for current formatting requirements.",
                "common_rejection_reasons": [
                    "Insufficient experimental evaluation",
                    "Weak related work section",
                    "Unclear problem statement",
                    "Missing ablation studies",
                ],
                "days_needed_estimate": 14,
            }
        return result


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

        result = self._call_ai_json(TREND_SYSTEM, user_prompt, max_tokens=1500)

        if not result or "error" in result:
            result = self._fallback_trend_analysis(domain, papers)

        if result and "error" not in result:
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

        result = self._call_ai_json(TREND_SYSTEM, user_prompt, max_tokens=1000)

        if not result or "error" in result:
            result = self._fallback_trend_analysis(domain)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def _fallback_trend_analysis(self, domain: str, papers: Optional[List[dict]] = None) -> dict:
        """Return deterministic development data when the AI provider is not configured."""
        normalized = (domain or "computer science").lower()
        domain_topics = {
            "artificial intelligence": [
                ("Agentic AI Systems", 0.94, "rising", "Tool-using AI systems that can plan, call APIs, and complete multi-step workflows."),
                ("Retrieval Augmented Generation", 0.89, "rising", "Grounding generated answers in private and domain-specific knowledge bases."),
                ("AI Safety & Alignment", 0.86, "rising", "Benchmarking reliability, robustness, and alignment risks before deployment."),
                ("Multimodal Foundation Models", 0.84, "rising", "Models that combine text, image, audio, video, and structured data."),
                ("Efficient Fine-tuning (LoRA/QLoRA)", 0.78, "stable", "Parameter-efficient adaptation methods for specialized tasks."),
            ],
            "natural language processing": [
                ("Long-Context Reasoning", 0.91, "rising", "Methods for using long documents without losing factual consistency."),
                ("Scientific Information Extraction", 0.87, "rising", "Extracting claims, entities, datasets, and citations from papers."),
                ("Low-Resource Language Modeling", 0.81, "rising", "Improving model quality for languages with limited data."),
                ("Evaluation of Generated Text", 0.79, "stable", "Measuring faithfulness, factuality, and task usefulness."),
                ("Instruction Tuning", 0.76, "stable", "Fine-tuning LLMs to follow natural language instructions."),
            ],
            "machine learning": [
                ("Federated Learning", 0.84, "rising", "Training models across distributed devices while preserving privacy."),
                ("Causal Representation Learning", 0.82, "rising", "Learning features that capture stable cause-effect structure."),
                ("Model Compression & Quantization", 0.78, "stable", "Reducing latency and memory while preserving accuracy."),
                ("Uncertainty Quantification", 0.76, "stable", "Estimating model confidence for high-stakes decisions."),
                ("Graph Neural Networks", 0.74, "stable", "Learning on graph-structured data for molecular and social networks."),
            ],
            "computer vision": [
                ("Vision-Language Models", 0.92, "rising", "Models that understand both images and text for multimodal tasks."),
                ("3D Scene Understanding", 0.85, "rising", "Reconstructing and reasoning about 3D environments from 2D images."),
                ("Video Understanding", 0.82, "rising", "Temporal reasoning and action recognition in video streams."),
                ("Diffusion Models", 0.88, "rising", "Generative models for high-quality image and video synthesis."),
                ("Object Detection & Segmentation", 0.75, "stable", "Identifying and localizing objects in images."),
            ],
            "quantum computing": [
                ("Quantum Error Correction", 0.90, "rising", "Improving fault tolerance for scalable quantum computers."),
                ("Hybrid Quantum-Classical Algorithms", 0.82, "stable", "Combining quantum circuits with classical optimization loops."),
                ("Quantum Machine Learning", 0.76, "rising", "Exploring quantum advantages in learning and optimization."),
                ("Quantum Cryptography", 0.80, "stable", "Secure communication protocols based on quantum mechanics."),
            ],
            "bioinformatics": [
                ("Protein Structure Prediction", 0.93, "rising", "AI-driven prediction of 3D protein structures from sequences."),
                ("Single-Cell Genomics", 0.88, "rising", "Analyzing gene expression at the individual cell level."),
                ("Drug Discovery with AI", 0.85, "rising", "Using ML to identify and optimize drug candidates."),
                ("Genomic Variant Analysis", 0.78, "stable", "Identifying disease-causing genetic variants."),
            ],
        }

        # Find best matching domain
        selected = None
        for key in domain_topics:
            if key in normalized or normalized in key:
                selected = domain_topics[key]
                break
        if not selected:
            selected = domain_topics.get("artificial intelligence")

        if papers:
            paper_keywords = []
            for paper in papers:
                paper_keywords.extend(paper.get("keywords") or [])
            for keyword in paper_keywords[:3]:
                if keyword and len(keyword) > 3:
                    selected = [(keyword, 0.83, "rising", f"Appears frequently in the selected {domain} paper corpus.")] + list(selected)

        hot_topics = [
            {
                "topic": topic,
                "trend_score": score,
                "momentum": momentum,
                "description": description,
                "key_papers_themes": [topic.split()[0], domain],
                "why_hot": "Active publication growth and strong practical demand make this area attractive for new work.",
            }
            for topic, score, momentum, description in selected[:8]
        ]

        return {
            "hot_topics": hot_topics,
            "emerging_areas": [
                {
                    "area": f"Trustworthy {domain.title()}",
                    "description": "Combines performance with reliability, transparency, and human oversight.",
                    "opportunity_level": "high",
                    "entry_barrier": "medium",
                },
                {
                    "area": f"Domain-Specific {domain.title()}",
                    "description": "Adapts general methods to scientific, medical, legal, and engineering workflows.",
                    "opportunity_level": "medium",
                    "entry_barrier": "low",
                },
                {
                    "area": "Efficient & Sustainable AI",
                    "description": "Reducing computational cost and environmental impact of AI systems.",
                    "opportunity_level": "high",
                    "entry_barrier": "medium",
                },
            ],
            "research_gaps": [
                "Better benchmarks that reflect real-world use rather than isolated leaderboard tasks.",
                "More reproducible studies with open datasets, ablations, and deployment constraints.",
                "Clearer measurement of cost, latency, reliability, and downstream impact.",
                "Underrepresented languages and domains in current datasets.",
            ],
            "interdisciplinary_opportunities": [
                f"Apply {domain} methods to scientific literature mining and research workflow automation.",
                "Combine human-computer interaction with model evaluation for safer expert-facing tools.",
                f"Bridge {domain} with cognitive science for more human-aligned AI systems.",
            ],
            "predicted_breakthroughs": [
                "Smaller specialized models matching larger general models on narrow research workflows.",
                "More reliable systems that cite evidence and expose uncertainty during decision support.",
                "Real-time adaptive systems that learn from user feedback without full retraining.",
            ],
            "declining_topics": [
                "Single-metric leaderboard optimization without deployment analysis",
                "Purely supervised learning without consideration of data efficiency",
            ],
            "overall_field_direction": (
                f"{domain.title()} is moving toward reliable, domain-aware systems that can be evaluated in real workflows. "
                "The strongest opportunities are at the intersection of practical deployment, trustworthy evaluation, and specialized data. "
                "Efficiency and sustainability are becoming first-class research concerns."
            ),
            "top_publication_venues": ["NeurIPS", "ICLR", "ICML", "ACL", "EMNLP", "CVPR", "JMLR"],
            "source": "curated_knowledge_fallback",
        }

    def suggest_research_directions(self, user_interests: List[str]) -> dict:
        """
        Suggest specific research directions for a researcher based on their interests.
        """
        cache_key = self._cache_key("directions", str(sorted(user_interests)))
        if cached := self._cached(cache_key):
            return cached

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

        result = self._call_ai_json(TREND_SYSTEM, user_prompt, max_tokens=1200)

        if not result or "error" in result:
            result = self._fallback_research_directions(user_interests)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def _fallback_research_directions(self, interests: List[str]) -> dict:
        """Generate research directions without AI based on user interests."""
        if not interests:
            interests = ["computer science"]

        primary = interests[0]
        secondary = interests[1] if len(interests) > 1 else "machine learning"
        tertiary = interests[2] if len(interests) > 2 else "data analysis"

        directions = [
            {
                "title": f"Efficient {primary.title()} for Resource-Constrained Environments",
                "description": f"Develop lightweight {primary} methods that work effectively on edge devices and low-resource settings, making the technology accessible to a broader range of applications.",
                "novelty": f"Combines {primary} with hardware-aware optimization techniques not yet fully explored.",
                "feasibility": "high",
                "estimated_timeline": "1 year",
                "potential_impact": "high",
                "required_skills": ["Python", "Model Optimization", primary.title()],
                "suggested_collaborators_profile": "Systems researcher with hardware optimization experience",
            },
            {
                "title": f"Interpretable {primary.title()} with {secondary.title()} Integration",
                "description": f"Create explainable {primary} models that leverage {secondary} techniques to provide transparent decision-making, crucial for high-stakes applications in healthcare and finance.",
                "novelty": f"Novel integration of {primary} and {secondary} for interpretability.",
                "feasibility": "medium",
                "estimated_timeline": "1-2 years",
                "potential_impact": "high",
                "required_skills": [primary.title(), secondary.title(), "Explainable AI"],
                "suggested_collaborators_profile": f"Domain expert in {secondary} applications",
            },
            {
                "title": f"Cross-Domain Transfer Learning in {primary.title()}",
                "description": f"Investigate how knowledge from {primary} can be transferred to {tertiary} domains with minimal labeled data, reducing the annotation burden for new applications.",
                "novelty": "Systematic study of cross-domain transfer in underexplored domain pairs.",
                "feasibility": "medium",
                "estimated_timeline": "1 year",
                "potential_impact": "medium",
                "required_skills": ["Transfer Learning", primary.title(), tertiary.title()],
                "suggested_collaborators_profile": f"Researcher with expertise in {tertiary}",
            },
            {
                "title": f"Evaluation Benchmarks for Real-World {primary.title()} Applications",
                "description": f"Design comprehensive evaluation frameworks that measure {primary} system performance in realistic deployment scenarios, going beyond standard academic benchmarks.",
                "novelty": "Addresses the gap between academic benchmarks and real-world performance.",
                "feasibility": "high",
                "estimated_timeline": "6 months",
                "potential_impact": "medium",
                "required_skills": ["Experimental Design", "Statistical Analysis", primary.title()],
                "suggested_collaborators_profile": "Industry practitioner with deployment experience",
            },
            {
                "title": f"Federated and Privacy-Preserving {primary.title()}",
                "description": f"Develop {primary} methods that can learn from distributed, private data sources without centralizing sensitive information, enabling collaboration across institutions.",
                "novelty": f"Applies federated learning principles specifically to {primary} challenges.",
                "feasibility": "medium",
                "estimated_timeline": "2+ years",
                "potential_impact": "high",
                "required_skills": ["Federated Learning", "Privacy", primary.title()],
                "suggested_collaborators_profile": "Privacy and security researcher",
            },
        ]

        intersections = []
        for i in range(len(interests)):
            for j in range(i + 1, len(interests)):
                intersections.append(f"{interests[i].title()} × {interests[j].title()}: Combining these fields could yield novel approaches to shared challenges.")

        return {
            "recommended_directions": directions[:5],
            "hot_intersections": intersections[:3] if intersections else [
                f"{primary.title()} applied to real-world deployment challenges",
                f"Bridging {primary.title()} with human-centered design",
            ],
            "funding_areas": [
                "NSF (National Science Foundation) - CISE Division",
                "NIH (for biomedical applications)",
                "DARPA (for defense-relevant AI research)",
                "European Research Council (ERC)",
                "Google Research Awards",
                "Microsoft Research Grants",
                "Industry partnerships and sponsored research",
            ],
            "source": "template_fallback",
        }
