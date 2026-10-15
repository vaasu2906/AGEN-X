"""
Demo: the same Planner -> Executor -> Critic pipeline as demo_run.py, but
orchestrated as a compiled LangGraph state graph with LangGraph's
MemorySaver checkpointer, so resume() reads a real per-node checkpoint
instead of a single end-of-run snapshot.

Usage:
    python -m examples.demo_langgraph_run
    python -m examples.demo_langgraph_run "Onboard a new enterprise client"

Works with or without ANTHROPIC_API_KEY (see README.md).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.orchestrator.graph import TaskGraph  # noqa: E402
from src.orchestrator.langgraph_engine import LangGraphWorkflowEngine  # noqa: E402

DEFAULT_GOAL = (
    "Every Monday, review last week's overdue invoices, email a friendly "
    "reminder to each customer, and log a summary of who was contacted."
)


def main() -> None:
    goal = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GOAL

    engine = LangGraphWorkflowEngine()
    state = engine.run(goal)
    graph = TaskGraph.from_full_dict(state["graph"])

    print("=" * 70)
    print("GOAL:", goal)
    print("RUN ID (LangGraph thread_id):", state["run_id"])
    print("=" * 70)
    for line in state["log"]:
        print("•", line)

    print("\n--- TASK GRAPH (execution order) ---")
    for task in graph.topological_order():
        deps = ", ".join(task.depends_on) or "none"
        print(f"[{task.status.value.upper():9}] {task.name}  (depends_on: {deps})")
        print(f"            tool: {task.tool_name}")
        print(f"            result: {task.result}")

    print("\n--- CRITIC VERIFICATION ---")
    print("PASSED" if state["passed"] else "FAILED")
    for issue in state.get("issues", []):
        print(" -", issue)

    print("\n--- RESUME FROM LANGGRAPH CHECKPOINT ---")
    resumed = engine.resume(state["run_id"])
    resumed_graph = TaskGraph.from_full_dict(resumed["graph"])
    print(f"resume('{state['run_id']}') -> {len(resumed_graph.tasks)} task(s), "
          f"passed={resumed['passed']}")


if __name__ == "__main__":
    main()
