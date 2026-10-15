"""
STUB — Objective 3 (long-term half). Will wrap Qdrant or FAISS for
semantic recall of organizational knowledge, historical run outcomes, and
user preferences. Planned integration point: PlannerAgent.decompose() would
accept an optional `memory: VectorStore` and prepend recalled context to
the system prompt.
"""


class VectorStore:
    def __init__(self, backend: str = "qdrant"):
        raise NotImplementedError("VectorStore is a stub — not yet implemented.")
