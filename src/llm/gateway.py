"""
Sovereign Model Layer (paper Section 4): "A model gateway inside the llm
package exposes one internal interface - generate(role, messages, schema)
- and forwards to a vLLM or Ollama server through an OpenAI-compatible
local endpoint, so callers depend on a role, not on a model."

This module is that gateway. It replaces the single hard-coded Anthropic
call in llm/client.py with role-based routing across the models the
paper actually names:

    planner   -> Hermes 3 70B        (fallback: Hermes 3 8B)
    critic    -> Hermes 3 70B        (LLM-judge only; never overrides a
                                       failed deterministic check)
    extractor -> Hermes 3 8B
    coder     -> Qwen2.5-Coder-32B   (fallback: DeepSeek-Coder-V2-Lite)

served locally through Ollama and/or vLLM's OpenAI-compatible
`/v1/chat/completions` endpoint - see config/llm_routing.yaml for the
routing table and .env.example for the endpoint/backend-priority knobs.

Sovereignty by default (paper Section 3.5, "no component may call an
external model endpoint"): if no local backend answers, generate() raises
LLMUnavailableError exactly like the old single-model LLMClient did, so
every existing caller's "fall back to a deterministic path" behaviour
keeps working with zero setup. Anthropic is accepted only as an
explicitly opted-into *development* fallback (AGENTIC_ALLOW_CLOUD_FALLBACK=1)
for people iterating on this project without a local GPU; it is never
used silently, and every substitution the gateway makes - fallback model,
fallback backend, or the cloud dev path - is recorded on
`self.last_substitution` the way the paper's trace does.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from src.llm.client import LLMClient, LLMResponse, LLMUnavailableError

logger = logging.getLogger("agentic.llm.gateway")

ROUTING_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "llm_routing.yaml"

Role = str  # "planner" | "critic" | "extractor" | "coder"

# Used only if config/llm_routing.yaml is missing.
DEFAULT_ROUTES: Dict[str, Dict[str, Any]] = {
    "planner": {"model": "hermes3-70b", "fallback": "hermes3-8b", "max_tokens": 3000, "temperature": 0.2},
    "critic": {"model": "hermes3-70b", "fallback": "hermes3-8b", "max_tokens": 800, "temperature": 0.0},
    "extractor": {"model": "hermes3-8b", "fallback": None, "max_tokens": 1200, "temperature": 0.0},
    "coder": {"model": "qwen2.5-coder-32b", "fallback": "deepseek-coder-v2-lite", "max_tokens": 4000, "temperature": 0.1},
}

# Logical model id -> Ollama `ollama pull` tag. vLLM instead takes the
# logical id as-is (set it to whatever --served-model-name your vLLM
# deployment exposes).
OLLAMA_TAGS: Dict[str, str] = {
    "hermes3-70b": "hermes3:70b",
    "hermes3-8b": "hermes3:8b",
    "llama3.2-1b": "llama3.2:1b",
    "qwen2.5-coder-32b": "qwen2.5-coder:32b",
    "deepseek-coder-v2-lite": "deepseek-coder-v2:lite",
}


def load_routing_config(path: Path | str = ROUTING_CONFIG_PATH) -> Dict[str, Dict[str, Any]]:
    """Reads config/llm_routing.yaml, filling any gap with DEFAULT_ROUTES
    so a partially-edited file (or a missing one) never breaks startup."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {role: dict(cfg) for role, cfg in DEFAULT_ROUTES.items()}

    routes: Dict[str, Dict[str, Any]] = {role: dict(cfg) for role, cfg in DEFAULT_ROUTES.items()}
    for role, cfg in data.items():
        routes[role] = {**routes.get(role, {}), **(cfg or {})}
    return routes


@dataclass
class Substitution:
    """Recorded whenever the gateway can't use a role's primary model on
    its first-choice backend - mirrors the paper's "the gateway falls
    back... and records the substitution in the trace" (Section 4.4)."""

    role: str
    requested_model: str
    used_model: str
    backend: str
    reason: str

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return (
            f"[{self.role}] wanted {self.requested_model!r}, used "
            f"{self.used_model!r} on {self.backend} ({self.reason})"
        )


class ModelGateway:
    """generate(role, system, user) -> LLMResponse

    Also exposes complete()/is_available()/extract_json() so it is a
    drop-in replacement for the plain LLMClient anywhere one is expected
    (PlannerAgent(llm_client=ModelGateway(role="planner")), etc.) -
    `complete()` just calls `generate()` with the gateway's own `role`.
    """

    def __init__(
        self,
        role: Role = "planner",
        routing_path: Path | str = ROUTING_CONFIG_PATH,
        ollama_base_url: Optional[str] = None,
        vllm_base_url: Optional[str] = None,
        backend_priority: Optional[List[str]] = None,
        request_timeout: float = 1200.0,
        allow_cloud_fallback: Optional[bool] = None,
    ):
        self.role = role
        self.routes = load_routing_config(routing_path)
        self.ollama_base_url = ollama_base_url or os.environ.get(
            "OLLAMA_BASE_URL", "http://localhost:11434/v1"
        )
        self.vllm_base_url = vllm_base_url or os.environ.get(
            "VLLM_BASE_URL", "http://localhost:8000/v1"
        )
        self.backend_priority = [
            b.strip()
            for b in (
                backend_priority
                or os.environ.get("LLM_BACKEND_PRIORITY", "ollama,vllm,anthropic").split(",")
            )
            if b.strip()
        ]
        self.request_timeout = request_timeout
        if allow_cloud_fallback is None:
            allow_cloud_fallback = os.environ.get("AGENTIC_ALLOW_CLOUD_FALLBACK", "0") == "1"
        self.allow_cloud_fallback = allow_cloud_fallback

        self.last_substitution: Optional[Substitution] = None
        self._anthropic_clients: Dict[str, LLMClient] = {}

    # -- interface expected by PlannerAgent / callers of the old LLMClient --

    def is_available(self) -> bool:
        """Unlike the old key-presence check, this actually probes a
        backend (a cheap 1-token completion), since "available" for a
        local model gateway means "something answers", not "something is
        configured"."""
        try:
            self.generate(self.role, system="ping", user="ping", max_tokens=1)
            return True
        except LLMUnavailableError:
            return False

    def complete(
        self,
        system: str,
        user: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> LLMResponse:
        return self.generate(self.role, system, user, max_tokens=max_tokens, temperature=temperature)

    @staticmethod
    def extract_json(text: str) -> Dict[str, Any]:
        return LLMClient.extract_json(text)

    # -- role-routed interface ------------------------------------------

    def generate(
        self,
        role: Role,
        system: str,
        user: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        schema: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        route = self.routes.get(role) or DEFAULT_ROUTES.get(role)
        if route is None:
            raise LLMUnavailableError(f"No routing entry for role '{role}'.")

        resolved_max_tokens = max_tokens if max_tokens is not None else route.get("max_tokens", 2000)
        resolved_temperature = temperature if temperature is not None else route.get("temperature", 0.0)

        candidates = self._candidate_calls(role)
        errors: List[str] = []
        for backend, model, is_fallback in candidates:
            try:
                text = self._dispatch(
                    backend, model, system, user, resolved_max_tokens, resolved_temperature, schema
                )
            except Exception as e:  # noqa: BLE001 - any backend failure just tries the next candidate
                errors.append(f"{backend}:{model} -> {e}")
                continue

            if is_fallback:
                self.last_substitution = Substitution(
                    role=role,
                    requested_model=route.get("model", "?"),
                    used_model=model,
                    backend=backend,
                    reason="primary model/backend unavailable",
                )
                logger.warning("LLM gateway substitution: %s", self.last_substitution)
            return LLMResponse(text=text, raw={"backend": backend, "model": model, "role": role})

        raise LLMUnavailableError(
            f"No reachable local model for role '{role}'. Tried: {'; '.join(errors) or 'nothing configured'}. "
            "Start Ollama/vLLM and pull the model(s) in config/llm_routing.yaml, or set "
            "AGENTIC_ALLOW_CLOUD_FALLBACK=1 with ANTHROPIC_API_KEY for a dev-only cloud fallback."
        )

    # -- internals --------------------------------------------------------

    def _candidate_calls(self, role: Role) -> List[Tuple[str, str, bool]]:
        """(backend, model, is_fallback) tuples in the order they'll be
        tried: the role's primary model on every configured local
        backend first, then its fallback model on every local backend,
        then - only if explicitly opted in - Anthropic as a last resort."""
        route = self.routes.get(role) or DEFAULT_ROUTES.get(role)
        if route is None:
            raise LLMUnavailableError(f"No routing entry for role '{role}'.")

        primary = route.get("model")
        fallback = route.get("fallback")
        calls: List[Tuple[str, str, bool]] = []

        for backend in self.backend_priority:
            if backend in ("ollama", "vllm") and primary:
                calls.append((backend, primary, False))
        for backend in self.backend_priority:
            if backend in ("ollama", "vllm") and fallback:
                calls.append((backend, fallback, True))
        if "anthropic" in self.backend_priority and self.allow_cloud_fallback:
            calls.append(("anthropic", os.environ.get("AGENTIC_DEFAULT_MODEL", "claude-sonnet-4-6"), True))

        return calls

    def _dispatch(
        self,
        backend: str,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        temperature: float,
        schema: Optional[Dict[str, Any]],
    ) -> str:
        if backend == "ollama":
            return self._call_openai_compatible(
                self.ollama_base_url, OLLAMA_TAGS.get(model, model), system, user, max_tokens, temperature
            )
        if backend == "vllm":
            return self._call_openai_compatible(
                self.vllm_base_url, model, system, user, max_tokens, temperature
            )
        if backend == "anthropic":
            return self._call_anthropic(model, system, user, max_tokens, temperature)
        raise LLMUnavailableError(f"Unknown backend '{backend}'.")

    def _call_openai_compatible(
        self, base_url: str, model: str, system: str, user: str, max_tokens: int, temperature: float
    ) -> str:
        """Ollama (>=0.1.30) and vLLM both serve an OpenAI-compatible
        `/v1/chat/completions` route, so one code path covers both -
        this is exactly what lets the gateway "issue the same internal
        request to Hermes 3 or to a code model" per Section 4.10."""
        import requests

        url = base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        response = requests.post(url, json=payload, timeout=self.request_timeout)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    def _call_anthropic(self, model: str, system: str, user: str, max_tokens: int, temperature: float) -> str:
        client = self._anthropic_clients.get(model)
        if client is None:
            client = LLMClient(model=model)
            self._anthropic_clients[model] = client
        if not client.is_available():
            raise LLMUnavailableError("ANTHROPIC_API_KEY not set; cloud dev fallback unavailable.")
        response = client.complete(system=system, user=user, max_tokens=max_tokens, temperature=temperature)
        return response.text