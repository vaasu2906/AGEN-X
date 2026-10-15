"""
Tool interface and typed input/output schemas.

Every connector in connectors/ implements this interface. ExecutorAgent
(agents/executor.py) only ever calls `tool.run(args)` — it never knows
whether that's an email API, a CRM call, or a mock.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class ToolSchema:
    """Declares what a tool accepts and returns, so the registry can
    validate a Planner-produced task before dispatching it."""
    input_fields: List[str] = field(default_factory=list)
    output_fields: List[str] = field(default_factory=list)


class BaseTool(ABC):
    name: str
    schema: ToolSchema

    @abstractmethod
    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError
