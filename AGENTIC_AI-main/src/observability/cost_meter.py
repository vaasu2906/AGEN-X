"""
STUB — Objective 7. Will wrap LLMClient.complete() to record token usage
and estimated cost per call, aggregated per run_id.
"""


class CostMeter:
    def record(self, run_id: str, model: str, input_tokens: int, output_tokens: int) -> None:
        raise NotImplementedError("CostMeter is a stub — not yet implemented.")
