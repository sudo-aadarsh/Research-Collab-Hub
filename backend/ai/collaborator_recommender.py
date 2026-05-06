"""
ai/collaborator_recommender.py - AI-powered collaborator suggestions.

Combines:
1. Topic overlap scoring (fast, deterministic)
2. Claude-based reasoning (rich contextual explanation)
3. Co-author network awareness

Workflow:
  recommend(user_profile, candidates) → ranked list with explanations
"""
from typing import List, Optional
from .base import AIServiceBase


SYSTEM_PROMPT = """You are an expert research collaboration advisor who helps
researchers find the best collaborators. You consider:
- Research interest alignment and complementarity
- Skill gaps that a collaborator could fill
- Institutional diversity
- Publication history and expertise depth

Provide thoughtful, specific recommendations — not generic advice."""


class CollaboratorRecommender(AIServiceBase):
    """AI service for recommending research collaborators."""

    def run(self, user_profile: dict, candidates: List[dict]) -> List[dict]:
        """
        Generate ranked collaborator recommendations.

        Args:
            user_profile:  Dict with user's interests, skills, institution, bio
            candidates:    List of candidate user profiles from DB

        Returns:
            List of recommendations sorted by score, each with reasons
        """
        if not candidates:
            return []

        # Step 1: Fast pre-filtering using topic overlap
        scored = self._score_by_topic_overlap(user_profile, candidates)
        # Keep top 15 for AI deep analysis
        top_candidates = sorted(scored, key=lambda x: x["overlap_score"], reverse=True)[:15]

        if not top_candidates:
            return []

        # Step 2: AI-powered analysis for rich recommendations
        return self._ai_rank_candidates(user_profile, top_candidates)

    def _score_by_topic_overlap(self, user: dict, candidates: List[dict]) -> List[dict]:
        """
        Compute Jaccard similarity of research interest sets.
        Fast, no API call needed.
        """
        user_interests = set(i.lower() for i in user.get("interests", []))
        results = []
        for c in candidates:
            cand_interests = set(i.lower() for i in c.get("interests", []))
            if not user_interests or not cand_interests:
                overlap = 0.0
            else:
                intersection = user_interests & cand_interests
                union = user_interests | cand_interests
                overlap = len(intersection) / len(union) if union else 0.0

            results.append({
                **c,
                "overlap_score":  overlap,
                "common_topics":  list(user_interests & cand_interests),
            })
        return results

    def _ai_rank_candidates(self, user: dict, candidates: List[dict]) -> List[dict]:
        """Use Claude to produce explanatory rankings for top candidates."""
        cache_key = self._cache_key(
            "collab_recommend",
            str(sorted(user.get("interests", []))),
            str([c.get("id") for c in candidates]),
        )
        if cached := self._cached(cache_key):
            return cached

        # Format candidates for the prompt
        cand_text = "\n".join([
            f"- ID: {c['id']}, Name: {c.get('name','Unknown')}, "
            f"Institution: {c.get('institution','')}, "
            f"Interests: {', '.join(c.get('interests', [])[:6])}, "
            f"Skills: {', '.join(c.get('skills', [])[:4])}, "
            f"H-index: {c.get('h_index', 0)}, "
            f"Common topics: {', '.join(c.get('common_topics', []))}"
            for c in candidates
        ])

        user_text = (
            f"Name: {user.get('name')}, "
            f"Institution: {user.get('institution')}, "
            f"Interests: {', '.join(user.get('interests', []))}, "
            f"Skills: {', '.join(user.get('skills', []))}, "
            f"Bio: {user.get('bio', '')[:200]}"
        )

        user_prompt = f"""Recommend collaborators for this researcher:

<researcher>
{user_text}
</researcher>

<candidates>
{cand_text}
</candidates>

For each candidate, assess collaboration potential. Return JSON array:
[
  {{
    "candidate_id": "...",
    "score": 0.0-1.0,
    "reasons": ["specific reason 1", "specific reason 2", "specific reason 3"],
    "collaboration_type": "complementary|overlapping|mentorship",
    "potential_projects": ["project idea 1", "project idea 2"],
    "caution": "any concern or potential conflict (empty string if none)"
  }},
  ...
]

Include ALL candidates. Sort by score descending."""

        result = self._call_claude_json(SYSTEM_PROMPT, user_prompt, max_tokens=1500)

        if isinstance(result, list):
            # Merge AI scores with DB candidate info
            ai_by_id = {r["candidate_id"]: r for r in result}
            enriched = []
            for c in candidates:
                ai = ai_by_id.get(str(c.get("id")), {})
                enriched.append({
                    "candidate":          c,
                    "score":              ai.get("score", c.get("overlap_score", 0)),
                    "reasons":            ai.get("reasons", [f"Shared interests: {', '.join(c.get('common_topics', [])[:3])}"]),
                    "common_topics":      c.get("common_topics", []),
                    "collaboration_type": ai.get("collaboration_type", "overlapping"),
                    "potential_projects": ai.get("potential_projects", []),
                    "caution":            ai.get("caution", ""),
                })
            enriched.sort(key=lambda x: x["score"], reverse=True)
            self._store(cache_key, enriched)
            return enriched

        # Fallback: return overlap-scored candidates without AI reasoning
        return [
            {
                "candidate":     c,
                "score":         c.get("overlap_score", 0),
                "reasons":       [f"Shared interests in: {', '.join(c.get('common_topics', []))}"],
                "common_topics": c.get("common_topics", []),
            }
            for c in candidates
        ]

    def explain_match(self, user_profile: dict, candidate_profile: dict) -> str:
        """
        Generate a detailed explanation for a specific user-candidate pair.
        Used for the detailed recommendation view.
        """
        user_prompt = f"""Explain in detail why these two researchers would make
excellent collaborators:

Researcher A: {user_profile.get('name')}, {user_profile.get('institution')}
Interests: {', '.join(user_profile.get('interests', []))}

Researcher B: {candidate_profile.get('name')}, {candidate_profile.get('institution')}
Interests: {', '.join(candidate_profile.get('interests', []))}

Provide a 2-3 paragraph narrative explanation focusing on complementary strengths,
shared interests, and potential research directions they could pursue together."""
        return self._call_claude(SYSTEM_PROMPT, user_prompt, max_tokens=400)
