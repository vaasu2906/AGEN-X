"""
STUB — Human-in-the-loop approval gate. Will let specific tasks (e.g.
anything that sends money, deletes data, or emails a customer) pause
execution and require explicit human sign-off before ExecutorAgent runs
them. Planned integration: a `requires_approval: bool` field on Task
(orchestrator/graph.py), checked by orchestrator/engine.py before dispatch.
"""


class ApprovalGate:
    def request_approval(self, task, reason: str) -> bool:
        raise NotImplementedError("ApprovalGate is a stub — not yet implemented.")
