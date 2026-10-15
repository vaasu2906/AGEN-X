"""
STUB — ReporterAgent. Will specialize in turning a completed TaskGraph's
results into a human-readable summary/report (e.g. for Slack, email digest,
or a dashboard).
"""
from src.agents.base import BaseAgent


class ReporterAgent(BaseAgent):
    name = "reporter"

    def run(self, *args, **kwargs):
        raise NotImplementedError("ReporterAgent is a stub — not yet implemented.")
