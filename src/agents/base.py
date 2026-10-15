"""
BaseAgent — the common interface every agent in the Planner-Executor-Critic
triad implements.

The orchestrator only ever calls `agent.run(...)`; it never reaches into a
specific agent's internals, so any agent here can be swapped for a
different implementation without touching orchestrator/engine.py.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    """Minimal contract for any agent in the system."""

    name: str = "base_agent"

    @abstractmethod
    def run(self, *args: Any, **kwargs: Any) -> Any:
        """Perform this agent's job. Signature intentionally loose —
        PlannerAgent.run(goal), ExecutorAgent.run(graph), and
        CriticAgent.run(graph) all have different shapes, but all agents
        are invoked the same way by the engine: agent.run(...)."""
        raise NotImplementedError
