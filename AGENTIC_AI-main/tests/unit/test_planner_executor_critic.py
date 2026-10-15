import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.agents.critic import CriticAgent
from src.agents.executor import ExecutorAgent
from src.agents.planner import PlannerAgent, PlannerError
from src.llm.client import LLMClient
from src.orchestrator.graph import (
    GraphValidationError,
    OutputContract,
    Task,
    TaskGraph,
    TaskStatus,
)


def make_llm_client_without_key() -> LLMClient:
    client = LLMClient()
    client.api_key = None
    return client


class TestTaskGraph:
    def test_valid_linear_graph(self):
        a = Task(name="a", description="first")
        b = Task(name="b", description="second", depends_on=[a.id])
        graph = TaskGraph(goal="test", tasks=[a, b])
        graph.validate()
        order = [t.id for t in graph.topological_order()]
        assert order.index(a.id) < order.index(b.id)

    def test_detects_cycle(self):
        a = Task(name="a", description="first")
        b = Task(name="b", description="second", depends_on=[a.id])
        a.depends_on = [b.id]
        graph = TaskGraph(goal="test", tasks=[a, b])
        with pytest.raises(GraphValidationError):
            graph.validate()

    def test_detects_dangling_dependency(self):
        a = Task(name="a", description="first", depends_on=["nonexistent"])
        graph = TaskGraph(goal="test", tasks=[a])
        with pytest.raises(GraphValidationError):
            graph.validate()

    def test_ready_tasks_respects_dependencies(self):
        a = Task(name="a", description="first")
        b = Task(name="b", description="second", depends_on=[a.id])
        graph = TaskGraph(goal="test", tasks=[a, b])
        assert [t.id for t in graph.ready_tasks()] == [a.id]
        a.status = TaskStatus.SUCCEEDED
        assert [t.id for t in graph.ready_tasks()] == [b.id]


class TestPlannerAgent:
    def test_fallback_decomposition_produces_valid_graph(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Automate customer invoice reminders")
        assert len(graph.tasks) > 0
        graph.validate()
        assert len(graph.topological_order()) == len(graph.tasks)

    def test_empty_goal_raises(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        with pytest.raises(PlannerError):
            planner.run("   ")

    def test_dependencies_resolve_to_correct_ids(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Automate customer invoice reminders")
        by_name = {t.name: t for t in graph.tasks.values()}
        gather = by_name["gather_records"]
        clarify = by_name["clarify_goal"]
        assert clarify.id in gather.depends_on

    def test_fallback_emits_coder_task_for_query_goals(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Generate a SQL report of overdue invoices by region")
        by_name = {t.name: t for t in graph.tasks.values()}
        assert "generate_query_or_formula" in by_name
        coder_task = by_name["generate_query_or_formula"]
        assert coder_task.tool_name == "coder"
        process = by_name["process_and_decide"]
        assert coder_task.id in process.depends_on

    def test_fallback_emits_extractor_task_for_extraction_goals(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Extract the customer name and amount from incoming emails")
        by_name = {t.name: t for t in graph.tasks.values()}
        assert "extract_fields" in by_name
        extract_task = by_name["extract_fields"]
        assert extract_task.tool_name == "extractor"
        process = by_name["process_and_decide"]
        assert extract_task.id in process.depends_on

    def test_fallback_skips_coder_and_extractor_when_not_needed(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Automate customer invoice reminders")
        by_name = {t.name: t for t in graph.tasks.values()}
        assert "generate_query_or_formula" not in by_name
        assert "extract_fields" not in by_name


class TestExecutorAndCritic:
    def test_end_to_end_mock_run(self):
        planner = PlannerAgent(llm_client=make_llm_client_without_key())
        graph = planner.run("Automate customer invoice reminders")

        executor = ExecutorAgent()
        executor.run(graph)
        assert all(t.status == TaskStatus.SUCCEEDED for t in graph.tasks.values())

        critic = CriticAgent()
        verification = critic.run(graph)
        assert verification.passed, verification.issues

    def test_critic_flags_missing_required_field(self):
        task = Task(
            name="send_email",
            description="send a reminder email",
            tool_name="email",
            output_contract=OutputContract(required_fields=["confirmation"]),
        )
        task.status = TaskStatus.SUCCEEDED
        task.result = {}
        critic = CriticAgent()
        result = critic.verify_task(task)
        assert not result.passed
        assert "confirmation" in result.issues[0]

    def test_downstream_task_skipped_on_failure(self):
        a = Task(name="a", description="fails on purpose", tool_name="boom")
        b = Task(name="b", description="depends on a", depends_on=[a.id])
        graph = TaskGraph(goal="test", tasks=[a, b])

        def boom(_args):
            raise RuntimeError("simulated failure")

        executor = ExecutorAgent(tools={"boom": boom})
        executor.run(graph)
        assert a.status == TaskStatus.FAILED
        assert b.status == TaskStatus.SKIPPED


class TestToolRegistry:
    def test_registry_feeds_executor(self):
        from src.tools.base_tool import BaseTool, ToolSchema
        from src.tools.registry import ToolRegistry

        class EchoTool(BaseTool):
            name = "echo"
            schema = ToolSchema(input_fields=["msg"], output_fields=["confirmation"])

            def run(self, args):
                return {"confirmation": f"echoed: {args.get('msg')}"}

        registry = ToolRegistry()
        registry.register(EchoTool())

        task = Task(name="say_hi", description="test", tool_name="echo", tool_args={"msg": "hi"})
        graph = TaskGraph(goal="test", tasks=[task])

        executor = ExecutorAgent(tools=registry.as_tool_map())
        executor.run(graph)
        assert task.status == TaskStatus.SUCCEEDED
        assert task.result["confirmation"] == "echoed: hi"


class TestWorkflowEngine:
    def test_engine_runs_and_checkpoints(self):
        from src.orchestrator.engine import WorkflowEngine

        engine = WorkflowEngine(planner=PlannerAgent(llm_client=make_llm_client_without_key()))
        state = engine.run("Automate customer invoice reminders")
        assert state.verification.passed
        assert engine.state_store.load(state.run_id) is state

    def test_critic_llm_judge_is_on_by_default(self):
        from src.llm.gateway import ModelGateway
        from src.orchestrator.engine import WorkflowEngine

        engine = WorkflowEngine(planner=PlannerAgent(llm_client=make_llm_client_without_key()))
        assert engine.critic.llm_gateway is not None
        assert isinstance(engine.critic.llm_gateway, ModelGateway)
        assert engine.critic.llm_gateway.role == "critic"
        # A run still passes with no local backend reachable - the judge
        # degrades to no concerns rather than failing the task.
        state = engine.run("Automate customer invoice reminders")
        assert state.verification.passed
