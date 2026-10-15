"""
STUB — Objective 7. Will wrap PlannerAgent/ExecutorAgent/CriticAgent.run()
and LLMClient.complete() with OpenTelemetry spans so a full run is
reproducible as a trace tree, linked via run_id from orchestrator/state.py.
"""


def start_span(name: str):
    raise NotImplementedError("tracer.start_span is a stub — not yet implemented.")
