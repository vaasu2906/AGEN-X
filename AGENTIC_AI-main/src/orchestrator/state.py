"""
RunState and checkpoint persistence models.

RunStateStore below is in-memory only; swapping it for a Postgres/Redis-
backed store is the only change needed for durable checkpointing, since
engine.py already codes against save()/load() rather than a specific
backend.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from src.orchestrator.graph import TaskGraph


@dataclass
class VerificationResult:
    passed: bool
    issues: List[str] = field(default_factory=list)


@dataclass
class RunState:
    """Everything needed to resume a workflow run from where it left off."""
    run_id: str
    goal: str
    graph: TaskGraph
    replan_attempts: int = 0
    log: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    verification: Optional[VerificationResult] = None


class RunStateStore:
    """In-memory RunState store."""

    def __init__(self):
        self._runs: dict[str, RunState] = {}

    def save(self, state: RunState) -> None:
        self._runs[state.run_id] = state

    def load(self, run_id: str) -> Optional[RunState]:
        return self._runs.get(run_id)

    def list_run_ids(self) -> List[str]:
        return list(self._runs.keys())
