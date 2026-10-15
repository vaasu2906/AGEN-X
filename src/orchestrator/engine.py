"""
WorkflowEngine — runs the Planner -> Executor -> Critic loop and
checkpoints the resulting RunState after each run.

Conditional branching, true parallel task execution, and retry-with-
backoff are not implemented yet. graph.ready_tasks() already exposes the
set of tasks safe to run concurrently, which is the hook a thread/async
pool would consume; that's future work, not part of this pass.
"""
from __future__ import annotations

import uuid
from typing import Optional

from src.agents.critic import CriticAgent
from src.agents.executor import ExecutorAgent
from src.agents.planner import PlannerAgent
from src.llm.gateway import ModelGateway
from src.orchestrator.state import RunState, RunStateStore, VerificationResult
from src.tools.bootstrap import build_default_registry


class WorkflowEngine:
    def __init__(
        self,
        planner: Optional[PlannerAgent] = None,
        executor: Optional[ExecutorAgent] = None,
        critic: Optional[CriticAgent] = None,
        state_store: Optional[RunStateStore] = None,
        max_replans: int = 2,
    ):
        self.planner = planner or PlannerAgent()
        self.executor = executor or ExecutorAgent(tools=build_default_registry().as_tool_map())
        # LLM-judge on by default (role="critic" -> Hermes 3, see
        # llm/gateway.py): still non-binding - CriticAgent.verify_task()
        # only ever appends to `concerns`, never to `issues`/`passed`, and
        # ModelGateway construction here is free (no network call; the
        # judge is only invoked, and only degrades gracefully via
        # LLMUnavailableError, once a task has already passed its
        # deterministic contract check).
        self.critic = critic or CriticAgent(llm_gateway=ModelGateway(role="critic"))
        self.state_store = state_store or RunStateStore()
        self.max_replans = max_replans

    def run(self, goal: str, run_id: Optional[str] = None) -> RunState:
        run_id = run_id or uuid.uuid4().hex[:12]
        log = [f"Decomposing goal: {goal!r}"]

        graph = self.planner.run(goal)
        log.append(f"Planner produced {len(graph.tasks)} task(s).")

        attempts = 0
        verification: VerificationResult
        while True:
            self.executor.run(graph)
            verification = self.critic.run(graph)
            outcome = "passed" if verification.passed else "found issues"
            log.append(f"Critic {outcome} on attempt {attempts + 1}.")
            for concern in getattr(verification, "concerns", []):
                log.append(f"Critic-judge concern (non-binding): {concern}")

            if verification.passed or attempts >= self.max_replans:
                break

            replan_hint = self.critic.suggest_replan(graph, verification)
            if replan_hint is None:
                log.append("Critic found issues but no re-plan hint was available; stopping.")
                break
            attempts += 1
            log.append(f"Re-planning (attempt {attempts}): {replan_hint}")
            graph = self.planner.run(replan_hint)

        state = RunState(
            run_id=run_id,
            goal=goal,
            graph=graph,
            replan_attempts=attempts,
            log=log,
            verification=verification,
        )
        self.state_store.save(state)  # checkpoint after run completes
        return state

    def resume(self, run_id: str) -> RunState:
        """Returns the last checkpointed state for a run. State is only
        saved once per run() call right now, so this returns that
        snapshot rather than continuing mid-run; the LangGraph-based
        engine (orchestrator/langgraph_engine.py) checkpoints per node
        and can resume a genuinely interrupted run."""
        state = self.state_store.load(run_id)
        if state is None:
            raise KeyError(f"No saved run with id '{run_id}'")
        return state
