"""
Thin, model-agnostic LLM client. Every agent call goes through
`complete()`, so provider routing (Objective 6: cost/latency-aware model
selection) can be added here later without touching agents/*.py.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class LLMResponse:
    text: str
    raw: Any = None


class LLMUnavailableError(Exception):
    """Raised when the LLM backend cannot be reached (missing key/package)."""


class LLMClient:
    """Wraps a single provider call behind a stable interface. If no
    ANTHROPIC_API_KEY is available, complete() raises LLMUnavailableError so
    callers (e.g. PlannerAgent) can fall back to a deterministic path —
    keeps the demo runnable with zero setup."""

    def __init__(self, model: str = "claude-sonnet-4-6", api_key: Optional[str] = None):
        self.model = model
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 2000,
        temperature: float = 0.0,
    ) -> LLMResponse:
        if not self.is_available():
            raise LLMUnavailableError("No ANTHROPIC_API_KEY set; cannot call the LLM.")

        try:
            import anthropic
        except ImportError as e:
            raise LLMUnavailableError(
                "The 'anthropic' package is not installed. Run: pip install anthropic"
            ) from e

        client = anthropic.Anthropic(api_key=self.api_key)
        response = client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        return LLMResponse(text=text, raw=response)

    @staticmethod
    def extract_json(text: str) -> Dict[str, Any]:
        """Best-effort extraction of a JSON object from model output, in
        case it's wrapped in prose or markdown code fences."""
        text = text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError(f"No JSON object found in model output: {text[:200]}")
        return json.loads(text[start : end + 1])
