"""
Declarative tool registry.

Tools register under a name (e.g. "email", "crm"). ExecutorAgent never
imports a connector directly — it looks tools up by name through
`as_tool_map()`, so adding, removing, or swapping a connector never
requires touching agents/executor.py. See bootstrap.py for how the
default registry is assembled from config/tools_config.json.
"""
from __future__ import annotations

from typing import Callable, Dict, List

from src.tools.base_tool import BaseTool


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered.")
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool:
        if name not in self._tools:
            raise KeyError(f"No tool registered under '{name}'.")
        return self._tools[name]

    def list_available(self) -> List[str]:
        return list(self._tools.keys())

    def as_tool_map(self) -> Dict[str, Callable[[dict], dict]]:
        """Adapts registered BaseTool objects to the plain
        `dict -> dict` callables ExecutorAgent expects."""
        return {name: tool.run for name, tool in self._tools.items()}
