"""
Demo: run the full agent stack (PlannerAgent -> ExecutorAgent -> CriticAgent,
wired together by WorkflowEngine) on a real business goal.

Usage:
    python -m examples.demo_run
    python -m examples.demo_run "Onboard a new enterprise client"

Works with or without ANTHROPIC_API_KEY (see README.md).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import settings  # noqa: F401 - triggers load_dotenv()
from src.orchestrator.engine import WorkflowEngine  # noqa: E402

DEFAULT_GOAL = (
    "Every Monday, review last week's overdue invoices, email a friendly "
    "reminder to each customer, and post a summary of who was contacted "
    "to the #finance Slack channel."
)


def main() -> None:
    goal = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GOAL

    engine = WorkflowEngine()
    state = engine.run(goal)

    print("=" * 70)
    print("GOAL:", state.goal)
    print("RUN ID:", state.run_id)
    print("=" * 70)
    for line in state.log:
        print("•", line)

    print("\n--- TASK GRAPH (execution order) ---")
    for task in state.graph.topological_order():
        deps = ", ".join(task.depends_on) or "none"
        print(f"[{task.status.value.upper():9}] {task.name}  (depends_on: {deps})")
        print(f"            tool: {task.tool_name}")
        print(f"            {task.description}")

    print("\n--- CRITIC VERIFICATION ---")
    print("PASSED" if state.verification.passed else "FAILED")
    for issue in state.verification.issues:
        print(" -", issue)

    print("\n--- MERMAID DIAGRAM (paste into https://mermaid.live) ---")
    print(state.graph.render_mermaid())

    print("\n--- CHECKPOINTED RUN STATE (retrievable via engine.resume) ---")
    resumed = engine.resume(state.run_id)
    print(f"resume('{state.run_id}') -> same run, {len(resumed.graph.tasks)} tasks")

    print("\n--- RAW GRAPH (JSON) ---")
    print(json.dumps(state.graph.to_dict(), indent=2))


if __name__ == "__main__":
    main()
