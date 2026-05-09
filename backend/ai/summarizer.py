"""
ai/summarizer.py - Paper & abstract summarization.

Supports Google Gemini (free), Ollama (local), Anthropic (paid).
Falls back to intelligent template-based responses when no AI is configured.
"""
from typing import Optional
from .base import AIServiceBase


SYSTEM_PROMPT = """You are an expert research assistant specializing in summarizing
academic papers across all scientific domains. Your summaries are:
- Concise yet comprehensive
- Written for a researcher audience
- Free of jargon inflation — you clarify complex ideas clearly
- Structured and actionable"""


class PaperSummarizer(AIServiceBase):
    """AI service for summarizing research papers and abstracts."""

    def run(self, text: str, mode: str = "abstract") -> dict:
        """
        Dispatcher: routes to the right summarization method.

        Args:
            text:  The text to summarize (abstract or full context)
            mode:  'abstract' | 'full' | 'concepts'
        """
        if mode == "concepts":
            return self.extract_key_concepts(text)
        elif mode == "full":
            return self.summarize_paper(text)
        return self.summarize_abstract(text)

    def summarize_abstract(self, abstract: str) -> dict:
        """
        Summarize a paper abstract into 2-3 sentences + key points.
        Results are cached by abstract hash.
        """
        if not abstract or len(abstract.strip()) < 50:
            return {"summary": "Abstract too short to summarize.", "key_points": []}

        cache_key = self._cache_key("abstract_summary", abstract[:500])
        if cached := self._cached(cache_key):
            return cached

        user_prompt = f"""Summarize this research paper abstract:

<abstract>
{abstract}
</abstract>

Return JSON with:
{{
  "summary": "2-3 sentence plain-language summary",
  "key_points": ["point 1", "point 2", "point 3"],
  "methodology": "brief method description",
  "main_contribution": "core novel contribution in 1 sentence",
  "limitations": "noted limitations if any"
}}"""

        result = self._call_ai_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)

        if not result or "error" in result:
            result = self._fallback_abstract_summary(abstract)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def summarize_paper(self, context: str) -> dict:
        """
        Generate a structured summary from title + abstract + keywords.

        Args:
            context: Combined text with title, abstract, keywords
        """
        cache_key = self._cache_key("paper_summary", context[:800])
        if cached := self._cached(cache_key):
            return cached

        user_prompt = f"""Analyze this research paper and produce a structured summary:

<paper>
{context}
</paper>

Return JSON with:
{{
  "tldr": "one-sentence TL;DR",
  "summary": "comprehensive 3-4 sentence summary",
  "key_contributions": ["contribution 1", "contribution 2"],
  "methodology": "research approach and methods used",
  "results": "key findings and metrics",
  "significance": "why this matters to the field",
  "suggested_citations_fields": ["field 1", "field 2"],
  "difficulty_level": "introductory|intermediate|advanced"
}}"""

        result = self._call_ai_json(SYSTEM_PROMPT, user_prompt, max_tokens=768)

        if not result or "error" in result:
            result = self._fallback_paper_summary(context)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def extract_key_concepts(self, text: str) -> dict:
        """
        Extract keywords, research topics, and named entities from text.
        Used for auto-tagging and recommendation matching.
        """
        cache_key = self._cache_key("concepts", text[:600])
        if cached := self._cached(cache_key):
            return cached

        user_prompt = f"""Extract structured information from this academic text:

<text>
{text}
</text>

Return JSON with:
{{
  "keywords": ["keyword1", "keyword2"],
  "research_areas": ["area1", "area2"],
  "methods": ["method1", "method2"],
  "datasets": ["dataset1"],
  "models_used": ["model1"],
  "topics": ["topic1", "topic2", "topic3"],
  "problem_domain": "the specific problem domain"
}}"""

        result = self._call_ai_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)

        if not result or "error" in result:
            result = self._fallback_concepts(text)

        if result and "error" not in result:
            self._store(cache_key, result)
        return result

    def compare_papers(self, paper_a: str, paper_b: str) -> dict:
        """Compare two paper abstracts: similarities, differences, complementarity."""
        user_prompt = f"""Compare these two research papers:

<paper_a>
{paper_a}
</paper_a>

<paper_b>
{paper_b}
</paper_b>

Return JSON with:
{{
  "similarity_score": 0.0-1.0,
  "common_themes": ["theme1", "theme2"],
  "key_differences": ["diff1", "diff2"],
  "complementary_aspects": "how the two papers complement each other",
  "recommended_together": true/false,
  "reason": "brief explanation"
}}"""
        result = self._call_ai_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)
        if not result or "error" in result:
            return {
                "similarity_score": 0.5,
                "common_themes": ["research methodology", "academic contribution"],
                "key_differences": ["Different focus areas", "Different methodological approaches"],
                "complementary_aspects": "Both papers contribute to their respective fields and may share methodological insights.",
                "recommended_together": True,
                "reason": "Papers in related areas often benefit from cross-referencing.",
            }
        return result

    # ── Fallback methods (used when no AI provider is configured) ─────────

    def _fallback_abstract_summary(self, abstract: str) -> dict:
        """Generate a basic summary from the abstract text without AI."""
        sentences = [s.strip() for s in abstract.replace('\n', ' ').split('.') if len(s.strip()) > 20]
        summary = '. '.join(sentences[:2]) + '.' if sentences else abstract[:200]

        # Extract potential key points from sentences
        key_points = []
        for s in sentences[1:4]:
            if len(s) > 30:
                key_points.append(s.strip() + '.')

        # Try to detect methodology keywords
        method_keywords = ['using', 'propose', 'present', 'introduce', 'develop', 'implement', 'apply', 'evaluate']
        methodology = "Not specified"
        for s in sentences:
            if any(kw in s.lower() for kw in method_keywords):
                methodology = s.strip() + '.'
                break

        return {
            "summary": summary,
            "key_points": key_points if key_points else [
                "This paper presents novel research contributions.",
                "The methodology is described in the abstract.",
                "Results and implications are discussed.",
            ],
            "methodology": methodology,
            "main_contribution": sentences[0] + '.' if sentences else "See abstract for details.",
            "limitations": "Please read the full paper for limitations.",
            "source": "text_analysis_fallback",
        }

    def _fallback_paper_summary(self, context: str) -> dict:
        """Generate a basic paper summary without AI."""
        lines = context.strip().split('\n')
        title = ""
        abstract = ""
        keywords = []

        for line in lines:
            if line.startswith("Title:"):
                title = line.replace("Title:", "").strip()
            elif line.startswith("Abstract:"):
                abstract = line.replace("Abstract:", "").strip()
            elif line.startswith("Keywords:"):
                kw_str = line.replace("Keywords:", "").strip()
                keywords = [k.strip() for k in kw_str.split(',') if k.strip()]

        if not abstract:
            abstract = context[:400]

        sentences = [s.strip() for s in abstract.replace('\n', ' ').split('.') if len(s.strip()) > 20]

        return {
            "tldr": f"This paper titled '{title}' presents research on {', '.join(keywords[:3]) if keywords else 'the described topic'}." if title else sentences[0] + '.' if sentences else "Research paper summary.",
            "summary": '. '.join(sentences[:3]) + '.' if sentences else abstract[:300],
            "key_contributions": [
                f"Novel approach to {keywords[0] if keywords else 'the research problem'}",
                "Empirical evaluation and analysis",
                "Contribution to the state of the art",
            ],
            "methodology": "Described in the paper abstract and body.",
            "results": "See the full paper for detailed results and metrics.",
            "significance": f"This work advances research in {', '.join(keywords[:2]) if keywords else 'the field'}.",
            "suggested_citations_fields": keywords[:3] if keywords else ["computer science", "research"],
            "difficulty_level": "intermediate",
            "source": "text_analysis_fallback",
        }

    def _fallback_concepts(self, text: str) -> dict:
        """Extract basic concepts from text without AI."""
        import re
        # Simple keyword extraction: find capitalized multi-word phrases and common terms
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        # Also find common technical terms
        tech_terms = re.findall(r'\b(?:neural network|machine learning|deep learning|NLP|AI|ML|'
                                r'algorithm|model|dataset|training|evaluation|accuracy|'
                                r'transformer|attention|embedding|classification|regression|'
                                r'clustering|optimization|gradient|loss function)\b', text, re.IGNORECASE)

        keywords = list(dict.fromkeys(words[:8] + tech_terms[:5]))  # deduplicate

        return {
            "keywords": keywords[:10] if keywords else ["research", "methodology", "analysis"],
            "research_areas": ["Computer Science", "Research Methodology"],
            "methods": ["Empirical Analysis", "Experimental Evaluation"],
            "datasets": [],
            "models_used": [],
            "topics": keywords[:5] if keywords else ["Academic Research"],
            "problem_domain": "Research and Development",
            "source": "text_analysis_fallback",
        }
