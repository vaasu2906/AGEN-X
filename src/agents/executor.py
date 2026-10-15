"""
ExecutorAgent — runs a validated TaskGraph by dispatching each task to a
registered tool (see tools/registry.py) by `task.tool_name`.

Parallel/retry-aware execution belongs in orchestrator/engine.py, which
calls into this agent per task rather than replacing it.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from src.agents.base import BaseAgent
from src.orchestrator.graph import Task, TaskGraph, TaskStatus

# A tool function takes the task's tool_args and returns a result dict.
ToolFn = Callable[[Dict[str, Any]], Dict[str, Any]]


class ExecutorAgent(BaseAgent):
    """Synchronous, single-process executor. Unknown tool names (e.g. the
    pure-reasoning "llm" steps a plan produces) fall back to a mock
    completion rather than failing the task."""

    name = "executor"

    def __init__(self, tools: Optional[Dict[str, ToolFn]] = None):
        self.tools: Dict[str, ToolFn] = tools or {}

    def register_tool(self, name: str, fn: ToolFn) -> None:
        self.tools[name] = fn

    def run(self, graph: TaskGraph) -> TaskGraph:
        return self.run_graph(graph)

    def run_task(self, task: Task) -> Dict[str, Any]:
        task.attempts += 1
        tool = self.tools.get(task.tool_name or "")
        if tool is None:
            return {
                "mock": True,
                "note": f"No tool registered for '{task.tool_name}'; "
                f"simulated completion of '{task.name}'.",
            }
        return tool(task.tool_args)

    def run_graph(self, graph: TaskGraph) -> TaskGraph:
        graph.validate()
        for task in graph.topological_order():
            deps = [graph.get(d) for d in task.depends_on]
            if any(d.status == TaskStatus.FAILED for d in deps):
                task.status = TaskStatus.SKIPPED
                continue
            task.status = TaskStatus.RUNNING
            try:
                task.result = self.run_task(task)
                task.status = TaskStatus.SUCCEEDED
            except Exception as e:  # noqa: BLE001
                task.error = str(e)
                task.status = TaskStatus.FAILED
        return graph
