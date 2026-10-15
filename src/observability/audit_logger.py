"""
STUB — Objective 7. Will write an append-only, ideally hash-chained, audit
log entry for every agent decision (Planner's chosen decomposition,
Executor's tool calls, Critic's verdicts) so a run is fully explainable
after the fact.
"""


class AuditLogger:
    def log(self, run_id: str, event: dict) -> None:
        raise NotImplementedError("AuditLogger is a stub — not yet implemented.")
