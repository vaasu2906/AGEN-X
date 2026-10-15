"""
STUB — Role-based access control. Will restrict which users/services can
trigger which workflows or tools, checked at the api/ layer and/or per-tool
in tools/registry.py.
"""


class RBACPolicy:
    def check(self, user, action: str) -> bool:
        raise NotImplementedError("RBACPolicy is a stub — not yet implemented.")
