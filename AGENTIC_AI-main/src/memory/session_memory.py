"""
STUB — Objective 3 (short-term half). Will hold per-run context (prior task
results, conversation state) in Redis so multiple workers can share a run's
in-flight state. Currently no in-memory fallback exists yet — this needs to
be built before PlannerAgent/ExecutorAgent can use it.
"""


class SessionMemory:
    def __init__(self, redis_url: str | None = None):
        raise NotImplementedError("SessionMemory is a stub — not yet implemented.")
