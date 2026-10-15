"""
STUB — ExtractorAgent. Will specialize in pulling structured data out of
unstructured sources (documents, emails, web pages) for use by downstream
tasks. Would inherit BaseAgent, same as PlannerAgent/ExecutorAgent/CriticAgent.
"""
from src.agents.base import BaseAgent


class ExtractorAgent(BaseAgent):
    name = "extractor"

    def run(self, *args, **kwargs):
        raise NotImplementedError("ExtractorAgent is a stub — not yet implemented.")
