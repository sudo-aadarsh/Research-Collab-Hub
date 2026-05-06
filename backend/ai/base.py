"""
ai/base.py - Abstract base class for all AI service modules.

Every AI feature (summarizer, recommender, trend analyzer) extends
AIServiceBase, ensuring a consistent interface and making it trivial
to swap out models or providers in the future.
"""
from abc import ABC, abstractmethod
from typing import Any, Optional
import json
import hashlib

import anthropic
from backend.config import get_settings

settings = get_settings()


class AIServiceBase(ABC):
    """
    Abstract base for all AI services. Subclasses implement `run()`.

    Features:
    - Shared Anthropic client
    - Simple in-memory result cache (swap for Redis in production)
    - Consistent error handling wrapper
    """

    _client: Optional[anthropic.Anthropic] = None
    _cache: dict = {}   # simple in-process cache; replace with Redis for production

    @classmethod
    def get_client(cls) -> anthropic.Anthropic:
        if cls._client is None:
            cls._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return cls._client

    @abstractmethod
    def run(self, *args, **kwargs) -> Any:
        """Execute the AI task. Must be implemented by subclasses."""
        ...

    def _cache_key(self, *args) -> str:
        """Generate a deterministic cache key from arguments."""
        raw = json.dumps(args, sort_keys=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()

    def _cached(self, key: str) -> Optional[Any]:
        return self._cache.get(key)

    def _store(self, key: str, value: Any) -> None:
        # In production: use Redis with TTL
        if len(self._cache) > 1000:
            # Simple eviction: clear oldest half
            keys = list(self._cache.keys())
            for k in keys[:500]:
                del self._cache[k]
        self._cache[key] = value

    def _call_claude(
        self,
        system_prompt: str,
        user_prompt:   str,
        max_tokens:    int = 1024,
    ) -> str:
        """
        Single-turn call to Claude. Returns the text response.
        Handles API errors gracefully.
        """
        try:
            client = self.get_client()
            message = client.messages.create(
                model=settings.AI_MODEL,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            return message.content[0].text if message.content else ""
        except anthropic.APIConnectionError:
            return "AI service temporarily unavailable. Please try again later."
        except anthropic.RateLimitError:
            return "AI service rate limit reached. Please wait a moment."
        except anthropic.APIError as e:
            return f"AI service error: {str(e)}"

    def _call_claude_json(
        self,
        system_prompt: str,
        user_prompt:   str,
        max_tokens:    int = 1024,
    ) -> dict:
        """
        Call Claude and parse the JSON response.
        Returns empty dict on parse failure.
        """
        system = system_prompt + "\n\nRespond ONLY with valid JSON. No explanation, no markdown fences."
        raw = self._call_claude(system, user_prompt, max_tokens)
        try:
            # Strip potential markdown code fences
            cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"error": "Failed to parse AI response", "raw": raw}
