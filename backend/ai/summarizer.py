"""
ai/summarizer.py - Paper & abstract summarization using Claude.

Provides:
  - summarize_abstract()   → concise summary + key points
  - summarize_paper()      → full structured summary from title/abstract/keywords
  - extract_key_concepts() → keyword/topic extraction
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

        result = self._call_claude_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)
        if "error" not in result:
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

        result = self._call_claude_json(SYSTEM_PROMPT, user_prompt, max_tokens=768)
        if "error" not in result:
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
  "keywords": ["keyword1", "keyword2", ...],
  "research_areas": ["area1", "area2"],
  "methods": ["method1", "method2"],
  "datasets": ["dataset1"],
  "models_used": ["model1"],
  "topics": ["topic1", "topic2", "topic3"],
  "problem_domain": "the specific problem domain"
}}"""

        result = self._call_claude_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)
        if "error" not in result:
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
        return self._call_claude_json(SYSTEM_PROMPT, user_prompt, max_tokens=512)
