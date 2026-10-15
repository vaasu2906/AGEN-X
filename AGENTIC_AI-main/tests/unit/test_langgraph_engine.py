import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.orchestrator.graph import TaskGraph
from src.orchestrator.langgraph_engine import LangGraphWorkflowEngine
from src.tools.bootstrap import build_default_registry
from src.tools.langchain_adapter import registry_to_langchain_tools


class TestLangGraphWorkflowEngine:
    def test_run_produces_passing_graph(self):
        engine = LangGraphWorkflowEngine()
        state = engine.run("Automate customer invoice reminders")
        assert state["passed"] is True
        graph = TaskGraph.from_full_dict(state["graph"])
        assert all(t.status.value == "succeeded" for t in graph.tasks.values())

    def test_critic_llm_judge_is_on_by_default(self):
        from src.llm.gateway import ModelGateway

        engine = LangGraphWorkflowEngine()
        assert isinstance(engine.critic.llm_gateway, ModelGateway)
        assert engine.critic.llm_gateway.role == "critic"

    def test_resume_reads_langgraph_checkpoint(self):
        engine = LangGraphWorkflowEngine()
        state = engine.run("Automate customer invoice reminders")
        resumed = engine.resume(state["run_id"])
        assert resumed["passed"] == state["passed"]
        graph = TaskGraph.from_full_dict(resumed["graph"])
        assert len(graph.tasks) == len(TaskGraph.from_full_dict(state["graph"]).tasks)

    def test_resume_unknown_run_id_raises(self):
        engine = LangGraphWorkflowEngine()
        with pytest.raises(KeyError):
            engine.resume("not-a-real-run-id")


class TestLangChainAdapter:
    def test_registry_tools_are_callable(self):
        registry = build_default_registry()
        tools = registry_to_langchain_tools(registry)
        names = {t.name for t in tools}
        assert names == {"database", "email", "crm", "spreadsheet", "coder", "extractor"}

        db_tool = next(t for t in tools if t.name == "database")
        result = db_tool.invoke({"operation": "query", "sql": "SELECT * FROM invoices"})
        assert "records" in result
