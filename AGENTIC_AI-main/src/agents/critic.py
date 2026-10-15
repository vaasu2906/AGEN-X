"""
CriticAgent — checks each succeeded task's result against its
OutputContract and reports pass/fail with specific issues.

Deterministic checks (structural: are the required fields present) are
authoritative, exactly as the paper specifies: "Only if these pass does
an optional LLM judgement run for qualities that cannot be coded... its
verdict can only add concerns, never override a failed deterministic
check" (Section 3.9). That optional judge is wired in here as `concerns`
- informational only, routed through the gateway's "critic" role (Hermes
3) - and only runs when a gateway is explicitly supplied and reachable,
so CriticAgent() with no arguments behaves exactly as before.

`suggest_replan()` is the hook orchestrator/engine.py calls when
verification fails; it currently returns None (no automatic re-plan),
leaving that as future work.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional

from src.agents.base import BaseAgent
from src.llm.client import LLMUnavailableError
from src.orchestrator.graph import Task, TaskGraph, TaskStatus

CRITIC_JUDGE_SYSTEM_PROMPT = """You are the Critic-judge role of an \
agentic workflow automation system. Deterministic checks on this task's \
output have already passed. Look only for residual quality concerns that \
cannot be checked by code (e.g. a summary that drifts from its source, \
an odd tone, an ambiguous instruction). If you see a genuine concern, \
state it in one short sentence. If there is nothing worth flagging, \
respond with exactly: none"""


@dataclass
class VerificationResult:
    passed: bool
    issues: List[str] = field(default_factory=list)
    # LLM-judge output only (Section 3.9) - never affects `passed`.
    concerns: List[str] = field(default_factory=list)


class CriticAgent(BaseAgent):
    """Contract-checking critic. Mock-executed tasks (reasoning-only steps
    with no registered tool, e.g. tool_name="llm") are treated as passing
    since there's no output contract a mock result could satisfy."""

    name = "critic"

    def __init__(self, llm_gateway: Optional[Any] = None):
        # Optional and off by default: deterministic checks alone are
        # enough to pass/fail a task. Pass ModelGateway(role="critic") to
        # additionally get non-binding LLM-judge concerns.
        self.llm_gateway = llm_gateway

    def run(self, graph: TaskGraph) -> VerificationResult:
        return self.verify_graph(graph)

    def verify_task(self, task: Task) -> VerificationResult:
        if task.status != TaskStatus.SUCCEEDED:
            return VerificationResult(
                passed=False, issues=[f"Task '{task.name}' did not succeed."]
            )

        required = task.output_contract.required_fields
        result = task.result or {}
        missing = [f for f in required if f not in result]
        if result.get("mock"):
            return VerificationResult(passed=True, issues=[])
        if missing:
            return VerificationResult(
                passed=False,
                issues=[
                    f"Task '{task.name}' result missing required field(s): {missing}"
                ],
            )
        return VerificationResult(passed=True, issues=[], concerns=self._judge(task))

    def _judge(self, task: Task) -> List[str]:
        """Optional LLM-judge (Section 3.9): only runs if a gateway was
        supplied and is reachable; never raises, never affects `passed`."""
        if self.llm_gateway is None:
            return []
        try:
            response = self.llm_gateway.generate(
                role="critic",
                system=CRITIC_JUDGE_SYSTEM_PROMPT,
                user=(
                    f"Task: {task.name}\nContract: {task.output_contract.description}\n"
                    f"Output: {task.result}"
                ),
            )
        except LLMUnavailableError:
            return []
        verdict = response.text.strip()
        if not verdict or verdict.lower() == "none":
            return []
        return [verdict]

    def verify_graph(self, graph: TaskGraph) -> VerificationResult:
        all_issues: List[str] = []
        all_concerns: List[str] = []
        for task in graph.tasks.values():
            result = self.verify_task(task)
            all_issues.extend(result.issues)
            all_concerns.extend(f"{task.name}: {c}" for c in result.concerns)
        return VerificationResult(
            passed=len(all_issues) == 0, issues=all_issues, concerns=all_concerns
        )

    def suggest_replan(self, graph: TaskGraph, verification: VerificationResult) -> Optional[str]:
        """Would turn `verification.issues` into a targeted instruction
        fed back into PlannerAgent.decompose() for a bounded number of
        attempts. Not implemented yet — returns None (no re-plan)."""
        return None
