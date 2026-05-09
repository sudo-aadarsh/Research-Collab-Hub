"""
ai/base.py - Abstract base class for all AI service modules.

Supports multiple AI providers:
  1. Google Gemini (FREE tier - gemini-2.0-flash / gemini-1.5-flash)
  2. Ollama (LOCAL - completely free, requires local install)
  3. Anthropic Claude (PAID - kept for compatibility)
  4. Smart fallback (no API key needed - template-based intelligent responses)

Set AI_PROVIDER in .env to choose: "gemini" | "ollama" | "anthropic"
Set GEMINI_API_KEY in .env with your key from https://aistudio.google.com/apikey
"""
from abc import ABC, abstractmethod
from typing import Any, Optional
import json
import hashlib
import logging
import re
import time
import urllib.request
import urllib.error

from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _call_gemini(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """
    Call Google Gemini API.
    Model: gemini-2.5-flash or gemini-1.5-flash
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com/apikey")


    model = settings.GEMINI_MODEL or "gemini-2.0-flash"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    combined_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": combined_prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
            "topP": 0.9,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))

                # Check for prompt feedback / blocking
                if data.get("promptFeedback", {}).get("blockReason"):
                    logger.warning("Gemini blocked prompt: %s", data["promptFeedback"])
                    return ""

                candidates = data.get("candidates", [])
                if not candidates:
                    logger.warning("Gemini returned no candidates: %s", data)
                    return ""

                candidate = candidates[0]
                # Check finish reason
                finish_reason = candidate.get("finishReason", "")
                if finish_reason in ("SAFETY", "RECITATION"):
                    logger.warning("Gemini finish reason: %s", finish_reason)
                    return ""

                parts = candidate.get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
                return ""

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            logger.error("Gemini HTTP error %s: %s", e.code, body)

            if e.code == 429:
                # Rate limited — wait and retry
                wait = (attempt + 1) * 5
                logger.warning("Gemini rate limited, waiting %ss (attempt %d/%d)...", wait, attempt + 1, max_retries)
                time.sleep(wait)
                if attempt < max_retries - 1:
                    continue
                raise RuntimeError(f"Gemini rate limited after {max_retries} attempts. Try again later.")

            if e.code == 400:
                raise RuntimeError(f"Gemini bad request (check model name or API key): {body[:300]}")
            if e.code == 403:
                raise RuntimeError("Gemini API key invalid or quota exceeded. Check https://aistudio.google.com/")

            raise RuntimeError(f"Gemini API error {e.code}: {body[:300]}")

        except urllib.error.URLError as e:
            logger.error("Gemini URL error: %s", e.reason)
            raise RuntimeError(f"Gemini connection error: {e.reason}")

    return ""


def _call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """
    Call Groq API (High limits, extremely fast, free tier).
    Get a free key at: https://console.groq.com/keys
    """
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set. Get a free key at https://console.groq.com/keys")

    model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
    url = "https://api.groq.com/openai/v1/chat/completions"

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_completion_tokens": max_tokens,
        "temperature": 0.7,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ResearchCollabHub/1.0",
        },
        method="POST",
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            logger.error("Groq HTTP error %s: %s", e.code, body)
            
            if e.code == 429:
                wait = (attempt + 1) * 3
                time.sleep(wait)
                if attempt < max_retries - 1:
                    continue
                raise RuntimeError("Groq rate limited. Try again in a few seconds.")
            
            raise RuntimeError(f"Groq API error {e.code}: {body[:300]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Groq connection error: {e.reason}")
    return ""


def _call_ollama(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """
    Call local Ollama API (completely free, requires Ollama installed).
    Install: https://ollama.ai  then: ollama pull llama3.2
    """
    base_url = settings.OLLAMA_BASE_URL.rstrip("/")
    model = settings.OLLAMA_MODEL or "llama3.2"
    url = f"{base_url}/api/generate"

    payload = json.dumps({
        "model": model,
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.7},
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "")
    except urllib.error.URLError as e:
        logger.error("Ollama connection error: %s", e.reason)
        raise RuntimeError(f"Ollama not available: {e.reason}. Is Ollama running?")


def _call_anthropic(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """Call Anthropic Claude API (paid)."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text if message.content else ""
    except Exception as e:
        logger.error("Anthropic error: %s", e)
        raise RuntimeError(f"Anthropic error: {e}")


class AIServiceBase(ABC):
    """
    Abstract base for all AI services. Subclasses implement `run()`.

    Provider priority:
      1. AI_PROVIDER setting ("gemini" | "ollama" | "anthropic")
      2. Falls back to smart template responses if no provider is configured
    """

    _cache: dict = {}   # simple in-process cache; replace with Redis for production

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
            keys = list(self._cache.keys())
            for k in keys[:500]:
                del self._cache[k]
        self._cache[key] = value

    def _is_provider_configured(self) -> bool:
        """Check if any AI provider is properly configured."""
        provider = (settings.AI_PROVIDER or "").lower()
        if provider == "gemini" and settings.GEMINI_API_KEY:
            return True
        if provider == "groq" and settings.GROQ_API_KEY:
            return True
        if provider == "ollama":
            return True  # Ollama doesn't need an API key
        if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            return True
        return False

    def _call_ai(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
        """
        Route to the configured AI provider.
        Returns empty string if no provider is configured.
        """
        provider = (settings.AI_PROVIDER or "").lower()

        try:
            if provider == "gemini" and settings.GEMINI_API_KEY:
                logger.debug("Calling Gemini (model=%s)", settings.GEMINI_MODEL)
                return _call_gemini(system_prompt, user_prompt, max_tokens)
            elif provider == "groq" and settings.GROQ_API_KEY:
                logger.debug("Calling Groq (model=%s)", settings.GROQ_MODEL)
                return _call_groq(system_prompt, user_prompt, max_tokens)
            elif provider == "ollama":
                logger.debug("Calling Ollama (model=%s)", settings.OLLAMA_MODEL)
                return _call_ollama(system_prompt, user_prompt, max_tokens)
            elif provider == "anthropic" and settings.ANTHROPIC_API_KEY:
                logger.debug("Calling Anthropic (model=%s)", settings.AI_MODEL)
                return _call_anthropic(system_prompt, user_prompt, max_tokens)
            else:
                if provider == "gemini" and not settings.GEMINI_API_KEY:
                    logger.warning("AI_PROVIDER=gemini but GEMINI_API_KEY is empty. Using fallback.")
                elif provider == "groq" and not settings.GROQ_API_KEY:
                    logger.warning("AI_PROVIDER=groq but GROQ_API_KEY is empty. Using fallback.")
                else:
                    logger.warning("No AI provider configured. Using fallback responses.")
                return ""
        except RuntimeError as e:
            logger.error("AI provider error: %s", e)
            return ""
        except Exception as e:
            logger.error("Unexpected AI error: %s", e)
            return ""

    def _extract_json_from_text(self, raw: str) -> str:
        """
        Robustly extract JSON from raw text that may contain:
        - Markdown code fences (```json ... ```)
        - Extra explanation text before/after the JSON
        - Partially formatted JSON
        """
        if not raw:
            return ""

        cleaned = raw.strip()

        # Remove ```json ... ``` or ``` ... ``` wrappers (multiline)
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()

        # If still has fences, strip more aggressively
        if cleaned.startswith('```'):
            cleaned = re.sub(r'^```[^\n]*\n', '', cleaned)
            cleaned = re.sub(r'```$', '', cleaned)
            cleaned = cleaned.strip()

        return cleaned

    def _call_ai_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1024,
    ) -> dict:
        """
        Call AI and parse the JSON response.
        Returns dict with 'error' key on parse failure, empty dict if no provider.
        """
        system = (
            system_prompt
            + "\n\nIMPORTANT: Respond ONLY with valid JSON. "
            "Do NOT include markdown code fences, backticks, or any text outside the JSON. "
            "Start your response directly with { or [ and end with } or ]."
        )
        raw = self._call_ai(system, user_prompt, max_tokens)

        if not raw:
            return {}  # Empty = no provider configured, caller should use fallback

        cleaned = self._extract_json_from_text(raw)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Try to extract first JSON object or array from the text
        for pattern in [r'(\{[\s\S]*\})', r'(\[[\s\S]*\])']:
            match = re.search(pattern, cleaned)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass

        # Last resort: try the original raw string
        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError:
            pass

        logger.warning("Failed to parse AI JSON response: %s", raw[:300])
        return {"error": "Failed to parse AI response", "raw": raw[:500]}

    # ── Legacy compatibility aliases (for code that calls _call_claude/_call_claude_json) ──

    def _call_claude(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
        """Legacy alias for _call_ai."""
        return self._call_ai(system_prompt, user_prompt, max_tokens)

    def _call_claude_json(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> dict:
        """Legacy alias for _call_ai_json."""
        return self._call_ai_json(system_prompt, user_prompt, max_tokens)
