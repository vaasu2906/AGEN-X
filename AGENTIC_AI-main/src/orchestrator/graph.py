"""
DAG traversal, topological sort, dependency resolution.

This module owns the Task/TaskGraph data model — the shared contract that
planner.py produces, executor.py consumes, and critic.py verifies against.
Keeping it here rather than duplicated per agent is what makes the
Planner-Executor-Critic triad modular: none of them import from each
other, only from this module.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class GraphValidationError(Exception):
    """Raised when a task graph is structurally invalid (e.g. contains a
    cycle, or references a dependency that does not exist)."""


@dataclass
class OutputContract:
    """Defines what a 'successful' execution of a task must produce.
    The Critic evaluates a task's actual output against this contract."""
    required_fields: List[str] = field(default_factory=list)
    description: str = ""


@dataclass
class Task:
    """A single unit of work in the task graph.

    depends_on holds the IDs of tasks that must reach SUCCEEDED before this
    task becomes READY. tool_name is the pluggable tool this task should be
    routed to via tools/registry.py — the Planner only needs to *name* a
    tool, not know how it works.
    """
    name: str
    description: str
    tool_name: Optional[str] = None
    tool_args: Dict[str, Any] = field(default_factory=dict)
    depends_on: List[str] = field(default_factory=list)
    output_contract: OutputContract = field(default_factory=OutputContract)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    attempts: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "tool_name": self.tool_name,
            "tool_args": self.tool_args,
            "depends_on": self.depends_on,
            "status": self.status.value,
            "output_contract": {
                "required_fields": self.output_contract.required_fields,
                "description": self.output_contract.description,
            },
        }

    def to_full_dict(self) -> Dict[str, Any]:
        """Like to_dict(), but round-trippable: also carries result/error/
        attempts so a graph can be serialized mid-execution (e.g. into a
        LangGraph checkpoint) and rebuilt exactly via from_full_dict()."""
        data = self.to_dict()
        data.update({"result": self.result, "error": self.error, "attempts": self.attempts})
        return data

    @classmethod
    def from_full_dict(cls, data: Dict[str, Any]) -> "Task":
        contract = data.get("output_contract", {}) or {}
        task = cls(
            name=data["name"],
            description=data.get("description", ""),
            tool_name=data.get("tool_name"),
            tool_args=data.get("tool_args", {}) or {},
            depends_on=list(data.get("depends_on", [])),
            output_contract=OutputContract(
                required_fields=contract.get("required_fields", []),
                description=contract.get("description", ""),
            ),
            id=data["id"],
        )
        task.status = TaskStatus(data.get("status", TaskStatus.PENDING.value))
        task.result = data.get("result")
        task.error = data.get("error")
        task.attempts = data.get("attempts", 0)
        return task


class TaskGraph:
    """A directed acyclic graph (DAG) of Tasks. Responsible for structural
    validation (no cycles, no dangling dependencies) and for producing a
    valid execution order."""

    def __init__(self, goal: str, tasks: Optional[List[Task]] = None):
        self.goal = goal
        self.tasks: Dict[str, Task] = {}
        if tasks:
            for t in tasks:
                self.add_task(t)

    def add_task(self, task: Task) -> None:
        if task.id in self.tasks:
            raise GraphValidationError(f"Duplicate task id: {task.id}")
        self.tasks[task.id] = task

    def get(self, task_id: str) -> Task:
        return self.tasks[task_id]

    def validate(self) -> None:
        """Raises GraphValidationError if the graph is not a valid DAG."""
        for task in self.tasks.values():
            for dep in task.depends_on:
                if dep not in self.tasks:
                    raise GraphValidationError(
                        f"Task '{task.name}' ({task.id}) depends on unknown "
                        f"task id '{dep}'"
                    )

        WHITE, GRAY, BLACK = 0, 1, 2
        color = {tid: WHITE for tid in self.tasks}

        def visit(tid: str, stack: List[str]) -> None:
            color[tid] = GRAY
            stack.append(tid)
            for dep in self.tasks[tid].depends_on:
                if color[dep] == GRAY:
                    cycle = " -> ".join(stack + [dep])
                    raise GraphValidationError(f"Cycle detected: {cycle}")
                if color[dep] == WHITE:
                    visit(dep, stack)
            stack.pop()
            color[tid] = BLACK

        for tid in list(self.tasks):
            if color[tid] == WHITE:
                visit(tid, [])

    def topological_order(self) -> List[Task]:
        """Returns tasks in a valid dependency-respecting execution order."""
        self.validate()
        visited: Dict[str, bool] = {tid: False for tid in self.tasks}
        order: List[Task] = []

        def visit(tid: str) -> None:
            if visited[tid]:
                return
            visited[tid] = True
            for dep in self.tasks[tid].depends_on:
                visit(dep)
            order.append(self.tasks[tid])

        for tid in list(self.tasks):
            visit(tid)
        return order

    def ready_tasks(self) -> List[Task]:
        """Tasks whose dependencies have all succeeded and are themselves
        still pending. This is what the orchestration engine (engine.py)
        will use to schedule parallel execution."""
        ready = []
        for task in self.tasks.values():
            if task.status != TaskStatus.PENDING:
                continue
            deps = [self.tasks[d] for d in task.depends_on]
            if all(d.status == TaskStatus.SUCCEEDED for d in deps):
                ready.append(task)
        return ready

    def is_complete(self) -> bool:
        return all(
            t.status in (TaskStatus.SUCCEEDED, TaskStatus.SKIPPED)
            for t in self.tasks.values()
        )

    def has_failed(self) -> bool:
        return any(t.status == TaskStatus.FAILED for t in self.tasks.values())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal": self.goal,
            "tasks": [t.to_dict() for t in self.tasks.values()],
        }

    def to_full_dict(self) -> Dict[str, Any]:
        """Round-trippable form (see Task.to_full_dict) - use this, not
        to_dict(), whenever the graph needs to be rebuilt exactly later
        (e.g. LangGraph checkpoint state)."""
        return {
            "goal": self.goal,
            "tasks": [t.to_full_dict() for t in self.tasks.values()],
        }

    @classmethod
    def from_full_dict(cls, data: Dict[str, Any]) -> "TaskGraph":
        graph = cls(goal=data["goal"])
        for raw_task in data.get("tasks", []):
            graph.add_task(Task.from_full_dict(raw_task))
        return graph

    def render_mermaid(self) -> str:
        """Returns a Mermaid flowchart definition for quick visualization."""
        lines = ["flowchart TD"]
        for t in self.tasks.values():
            label = t.name.replace('"', "'")
            lines.append(f'    {t.id}["{label}"]')
        for t in self.tasks.values():
            for dep in t.depends_on:
                lines.append(f"    {dep} --> {t.id}")
        return "\n".join(lines)
