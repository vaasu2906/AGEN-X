"""Application settings, environment variables, LLM configurations."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Load variables from a .env file in the project root (if present) into
# the process environment before anything below reads os.environ. Every
# entry point (uvicorn, demo scripts, tests) imports this module directly
# or indirectly, so this is the single place .env gets picked up from.
load_dotenv()


@dataclass
class Settings:
    # Sovereign Model Layer (paper Section 4) - role-routed local models,
    # see src/llm/gateway.py and config/llm_routing.yaml.
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    vllm_base_url: str = os.environ.get("VLLM_BASE_URL", "http://localhost:8000/v1")
    llm_backend_priority: str = os.environ.get("LLM_BACKEND_PRIORITY", "ollama,vllm,anthropic")

    # Optional, opt-in only (AGENTIC_ALLOW_CLOUD_FALLBACK=1): a hosted
    # cloud model used solely as a development fallback when no local
    # Ollama/vLLM server is reachable. Never used silently.
    allow_cloud_fallback: bool = os.environ.get("AGENTIC_ALLOW_CLOUD_FALLBACK", "0") == "1"
    anthropic_api_key: str | None = os.environ.get("ANTHROPIC_API_KEY")
    default_model: str = os.environ.get("AGENTIC_DEFAULT_MODEL", "claude-sonnet-4-6")
    max_replans: int = int(os.environ.get("AGENTIC_MAX_REPLANS", "2"))

    # Not yet used — placeholders for when memory/api layers are implemented.
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    postgres_url: str = os.environ.get("POSTGRES_URL", "postgresql://localhost:5432/agentic")
    qdrant_url: str = os.environ.get("QDRANT_URL", "http://localhost:6333")


settings = Settings()