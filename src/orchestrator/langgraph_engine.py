"""
LangGraph-based version of the Planner -> Executor -> Critic loop.

orchestrator/engine.py implements this loop by hand with an in-memory
RunStateStore. This module wires the same three agents into a LangGraph
StateGraph instead, which gets us real, per-node checkpointing and resume
"for free" from LangGraph's MemorySaver rather than re-implementing it -
directly useful for the stateful orchestration and recovery objectives.

Both engines share the same PlannerAgent / ExecutorAgent / CriticAgent and
the same tool registry, so a graph produced here is identical in shape to
one from the hand-rolled engine.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from src.agents.critic import CriticAgent
from src.agents.executor import ExecutorAgent
from src.agents.planner import PlannerAgent
from src.llm.gateway import ModelGateway
from src.orchestrator.graph import TaskGraph
from src.tools.bootstrap import build_default_registry


class WorkflowState(TypedDict, total=False):
    goal: str
    graph: Dict[str, Any]  # TaskGraph.to_full_dict() - kept JSON-plain so
    # LangGraph's checkpointer (msgpack-based) can serialize it directly.
    passed: bool
    issues: List[str]
    replan_attempts: int
    max_replans: int
    log: List[str]


class LangGraphWorkflowEngine:
    """Same Planner-Executor-Critic loop as WorkflowEngine, run as a
    compiled LangGraph graph so runs can be checkpointed and resumed by
    thread_id via LangGraph's checkpointer."""

    def __init__(
        self,
        planner: Optional[PlannerAgent] = None,
        executor: Optional[ExecutorAgent] = None,
        critic: Optional[CriticAgent] = None,
        max_replans: int = 2,
    ):
        self.planner = planner or PlannerAgent()
        self.executor = executor or ExecutorAgent(tools=build_default_registry().as_tool_map())
        # LLM-judge on by default here too, so both engines exercise the
        # same "critic" role - see the matching comment in
        # orchestrator/engine.py for why this is safe with no local
        # backend running.
        self.critic = critic or CriticAgent(llm_gateway=ModelGateway(role="critic"))
        self.max_replans = max_replans
        self.checkpointer = MemorySaver()
        self.graph_app = self._build_graph()

    def _plan_node(self, state: WorkflowState) -> Dict[str, Any]:
        goal = state["goal"]
        task_graph = self.planner.run(goal)
        log = list(state.get("log", []))
        log.append(f"Planner produced {len(task_graph.tasks)} task(s) for: {goal!r}")
        return {"graph": task_graph.to_full_dict(), "log": log}

    def _execute_node(self, state: WorkflowState) -> Dict[str, Any]:
        task_graph = TaskGraph.from_full_dict(state["graph"])
        task_graph = self.executor.run(task_graph)
        log = list(state.get("log", []))
        log.append("Executor ran the task graph.")
        return {"graph": task_graph.to_full_dict(), "log": log}

    def _critic_node(self, state: WorkflowState) -> Dict[str, Any]:
        task_graph = TaskGraph.from_full_dict(state["graph"])
        verification = self.critic.run(task_graph)
        log = list(state.get("log", []))
        outcome = "passed" if verification.passed else "found issues"
        log.append(f"Critic {outcome}: {verification.issues or 'no issues'}")
        return {"passed": verification.passed, "issues": verification.issues, "log": log}

    def _route_after_critic(self, state: WorkflowState) -> str:
        if state.get("passed"):
            return "end"
        if state.get("replan_attempts", 0) >= state.get("max_replans", self.max_replans):
            return "end"
        return "replan"

    def _prepare_replan_node(self, state: WorkflowState) -> Dict[str, Any]:
        attempts = state.get("replan_attempts", 0) + 1
        log = list(state.get("log", []))
        log.append(f"Re-planning (attempt {attempts}) after Critic found issues.")
        return {"replan_attempts": attempts, "log": log}

    def _build_graph(self):
        builder: StateGraph = StateGraph(WorkflowState)
        builder.add_node("plan", self._plan_node)
        builder.add_node("execute", self._execute_node)
        builder.add_node("critic", self._critic_node)
        builder.add_node("prepare_replan", self._prepare_replan_node)

        builder.set_entry_point("plan")
        builder.add_edge("plan", "execute")
        builder.add_edge("execute", "critic")
        builder.add_conditional_edges(
            "critic",
            self._route_after_critic,
            {"end": END, "replan": "prepare_replan"},
        )
        builder.add_edge("prepare_replan", "plan")

        return builder.compile(checkpointer=self.checkpointer)

    def run(self, goal: str, run_id: Optional[str] = None) -> WorkflowState:
        run_id = run_id or uuid.uuid4().hex[:12]
        config = {"configurable": {"thread_id": run_id}}
        initial_state: WorkflowState = {
            "goal": goal,
            "replan_attempts": 0,
            "max_replans": self.max_replans,
            "log": [],
        }
        final_state = self.graph_app.invoke(initial_state, config=config)
        final_state["run_id"] = run_id  # type: ignore[typeddict-item]
        return final_state

    def resume(self, run_id: str) -> WorkflowState:
        """Returns the checkpointed state for a given thread_id/run_id
        via LangGraph's checkpointer - genuine resumability, since
        LangGraph persists state after every node, not just at the end
        of a run."""
        config = {"configurable": {"thread_id": run_id}}
        snapshot = self.graph_app.get_state(config)
        if snapshot is None or not snapshot.values:
            raise KeyError(f"No checkpointed run with id '{run_id}'")
        state = dict(snapshot.values)
        state["run_id"] = run_id
        return state  # type: ignore[return-value]
