import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.llm.client import LLMUnavailableError
from src.llm.gateway import DEFAULT_ROUTES, ModelGateway, load_routing_config


class TestRoutingConfig:
    def test_default_routes_cover_all_paper_roles(self):
        for role in ("planner", "critic", "extractor", "coder"):
            assert role in DEFAULT_ROUTES
            assert "model" in DEFAULT_ROUTES[role]

    def test_paper_model_names_are_wired_to_the_right_roles(self):
        # Hermes 3 plans/critiques/extracts; Qwen2.5-Coder/DeepSeek-Coder-V2
        # handle code-centric work - Section 4.2/4.4 of the paper.
        assert DEFAULT_ROUTES["planner"]["model"] == "hermes3-70b"
        assert DEFAULT_ROUTES["critic"]["model"] == "hermes3-70b"
        assert DEFAULT_ROUTES["extractor"]["model"] == "hermes3-8b"
        assert DEFAULT_ROUTES["coder"]["model"] == "qwen2.5-coder-32b"
        assert DEFAULT_ROUTES["coder"]["fallback"] == "deepseek-coder-v2-lite"

    def test_loads_repo_routing_yaml(self):
        routes = load_routing_config()
        assert routes["planner"]["model"] == "hermes3-70b"
        assert routes["coder"]["fallback"] == "deepseek-coder-v2-lite"

    def test_missing_file_falls_back_to_defaults(self):
        routes = load_routing_config("/nonexistent/path/routing.yaml")
        assert routes == DEFAULT_ROUTES


class TestModelGatewayUnavailable:
    def test_raises_llm_unavailable_when_nothing_reachable(self):
        gw = ModelGateway(role="planner", backend_priority=["ollama", "vllm"])
        with patch("requests.post", side_effect=ConnectionError("refused")):
            assert gw.is_available() is False
            with pytest.raises(LLMUnavailableError):
                gw.complete(system="sys", user="hi")

    def test_no_cloud_fallback_without_explicit_opt_in(self):
        gw = ModelGateway(
            role="planner",
            backend_priority=["ollama", "anthropic"],
            allow_cloud_fallback=False,
        )
        candidates = gw._candidate_calls("planner")
        assert all(backend != "anthropic" for backend, _, _ in candidates)

    def test_cloud_fallback_available_when_opted_in(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-key")
        gw = ModelGateway(
            role="planner",
            backend_priority=["ollama", "anthropic"],
            allow_cloud_fallback=True,
        )
        candidates = gw._candidate_calls("planner")
        assert any(backend == "anthropic" for backend, _, _ in candidates)


class TestModelGatewaySuccess:
    def test_calls_ollama_openai_compatible_endpoint(self):
        gw = ModelGateway(role="planner", backend_priority=["ollama"])

        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '{"tasks": []}'}}]
        }
        with patch("requests.post", return_value=mock_response) as mock_post:
            result = gw.complete(system="sys", user="hi")

        assert result.text == '{"tasks": []}'
        called_url = mock_post.call_args.args[0]
        assert called_url.endswith("/chat/completions")
        payload = mock_post.call_args.kwargs["json"]
        assert payload["model"] == "hermes3:70b"  # OLLAMA_TAGS mapping

    def test_falls_back_to_secondary_model_and_records_substitution(self):
        gw = ModelGateway(role="planner", backend_priority=["ollama"])

        mock_ok = Mock()
        mock_ok.raise_for_status = Mock()
        mock_ok.json.return_value = {"choices": [{"message": {"content": "ok"}}]}

        def side_effect(url, json, timeout):  # noqa: A002
            if json["model"] == "hermes3:70b":
                raise ConnectionError("primary model not pulled")
            return mock_ok

        with patch("requests.post", side_effect=side_effect):
            result = gw.complete(system="sys", user="hi")

        assert result.text == "ok"
        assert gw.last_substitution is not None
        assert gw.last_substitution.used_model == "hermes3-8b"

    def test_coder_role_routes_to_code_model(self):
        gw = ModelGateway(role="coder", backend_priority=["ollama"])

        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "SELECT 1;"}}]
        }
        with patch("requests.post", return_value=mock_response) as mock_post:
            result = gw.complete(system="sys", user="write a query")

        assert result.text == "SELECT 1;"
        payload = mock_post.call_args.kwargs["json"]
        assert payload["model"] == "qwen2.5-coder:32b"

    def test_extractor_role_routes_to_hermes3_8b(self):
        gw = ModelGateway(role="extractor", backend_priority=["ollama"])

        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '{"amount": "$100"}'}}]
        }
        with patch("requests.post", return_value=mock_response) as mock_post:
            result = gw.complete(system="sys", user="extract amount")

        assert result.text == '{"amount": "$100"}'
        payload = mock_post.call_args.kwargs["json"]
        assert payload["model"] == "hermes3:8b"


class TestPlannerUsesGatewayByDefault:
    def test_planner_default_llm_client_is_a_gateway(self):
        from src.agents.planner import PlannerAgent

        planner = PlannerAgent()
        assert isinstance(planner.llm_client, ModelGateway)
        assert planner.llm_client.role == "planner"

    def test_planner_still_falls_back_deterministically_with_no_backend(self):
        from src.agents.planner import PlannerAgent

        gw = ModelGateway(role="planner", backend_priority=["ollama"])
        planner = PlannerAgent(llm_client=gw)
        with patch("requests.post", side_effect=ConnectionError("refused")):
            graph = planner.run("Automate customer invoice reminders")
        assert len(graph.tasks) > 0
