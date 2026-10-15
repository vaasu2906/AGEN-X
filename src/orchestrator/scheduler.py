"""
AutomationScheduler — runs a goal through a WorkflowEngine automatically,
on a repeating interval, with no manual trigger per run.

This is what the frontend's "Automations" panel talks to: create an
automation once ("every 30 minutes, chase overdue invoices") and the
engine fires it itself from then on, the same Planner -> Executor ->
Critic loop as a manually-triggered run, just started by a clock instead
of a click. Each firing produces a normal RunState in the engine's own
RunStateStore/history - there is no separate "automation run" data model,
so the existing /runs, task graph, and log UI all work unchanged for
automation-triggered runs.

In-memory + a JSON snapshot file (data/automations.json) so automations
survive a server restart within the same demo, without pulling in a real
job queue (Celery/RQ) or a database - swapping this for one is the only
change needed for a production deployment, mirroring RunStateStore's own
"in-memory now, swap the backend later" note in orchestrator/state.py.
"""
from __future__ import annotations

import json
import logging
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional

logger = logging.getLogger("agentic.orchestrator.scheduler")

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEFAULT_STORE_PATH = DATA_DIR / "automations.json"

# How often the background thread checks for due automations. Real
# schedules (minutes/hours) are unaffected; this only bounds how late a
# firing can be.
TICK_SECONDS = 1.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Automation:
    id: str
    goal: str
    interval_seconds: int
    enabled: bool = True
    created_at: datetime = field(default_factory=_now)
    last_run_at: Optional[datetime] = None
    last_run_id: Optional[str] = None
    last_status: Optional[str] = None  # "passed" | "failed" | "error"
    next_run_at: datetime = field(default_factory=_now)

    def to_dict(self) -> Dict:
        d = asdict(self)
        for key in ("created_at", "last_run_at", "next_run_at"):
            if isinstance(d[key], datetime):
                d[key] = d[key].isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict) -> "Automation":
        d = dict(d)
        for key in ("created_at", "next_run_at", "last_run_at"):
            if isinstance(d.get(key), str):
                d[key] = datetime.fromisoformat(d[key])
        return cls(**d)


class AutomationScheduler:
    """Owns a set of Automations and a single background thread that
    fires due ones through `run_fn` (normally `WorkflowEngine.run`).

    `run_fn` is injected rather than importing WorkflowEngine directly so
    this module has no dependency on which engine (hand-rolled or
    LangGraph) is actually running the goal - routes.py wires whichever
    engine instance it already uses.
    """

    def __init__(
        self,
        run_fn: Callable[[str], object],
        store_path: Path | str = DEFAULT_STORE_PATH,
    ):
        self._run_fn = run_fn
        self._store_path = Path(store_path)
        self._lock = threading.Lock()
        self._automations: Dict[str, Automation] = {}
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._load()

    # -- persistence ---------------------------------------------------

    def _load(self) -> None:
        if not self._store_path.exists():
            return
        try:
            with open(self._store_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for item in raw:
                automation = Automation.from_dict(item)
                self._automations[automation.id] = automation
        except (json.JSONDecodeError, OSError, TypeError, KeyError) as e:
            logger.warning("Could not load %s, starting empty: %s", self._store_path, e)

    def _save(self) -> None:
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._store_path, "w", encoding="utf-8") as f:
            json.dump([a.to_dict() for a in self._automations.values()], f, indent=2)

    # -- CRUD, called from the API layer --------------------------------

    def create(self, goal: str, interval_seconds: int) -> Automation:
        if not goal or not goal.strip():
            raise ValueError("Automation goal must not be empty.")
        if interval_seconds < 5:
            raise ValueError("interval_seconds must be at least 5.")
        automation = Automation(
            id=uuid.uuid4().hex[:10],
            goal=goal.strip(),
            interval_seconds=interval_seconds,
            next_run_at=_now(),  # fires on the first tick, then every interval
        )
        with self._lock:
            self._automations[automation.id] = automation
            self._save()
        return automation

    def list(self) -> List[Automation]:
        with self._lock:
            return sorted(self._automations.values(), key=lambda a: a.created_at, reverse=True)

    def get(self, automation_id: str) -> Automation:
        with self._lock:
            if automation_id not in self._automations:
                raise KeyError(f"No automation with id '{automation_id}'")
            return self._automations[automation_id]

    def set_enabled(self, automation_id: str, enabled: bool) -> Automation:
        with self._lock:
            automation = self._automations[automation_id]
            automation.enabled = enabled
            if enabled:
                automation.next_run_at = _now()  # re-arm immediately when turned back on
            self._save()
            return automation

    def delete(self, automation_id: str) -> None:
        with self._lock:
            self._automations.pop(automation_id, None)
            self._save()

    def run_now(self, automation_id: str) -> Automation:
        """Fires one automation immediately, outside its normal cadence,
        without disturbing its schedule."""
        with self._lock:
            automation = self._automations[automation_id]
        self._fire(automation)
        return automation

    # -- background loop -------------------------------------------------

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=TICK_SECONDS * 2)
            self._thread = None

    def _loop(self) -> None:
        while not self._stop_event.wait(TICK_SECONDS):
            due = []
            with self._lock:
                now = _now()
                for automation in self._automations.values():
                    if automation.enabled and automation.next_run_at <= now:
                        due.append(automation)
            for automation in due:
                self._fire(automation)

    def _fire(self, automation: Automation) -> None:
        """Runs the goal through the injected engine and records the
        outcome. Never raises - a bad goal or an engine exception is
        recorded as `last_status = "error"` so one broken automation
        can't take down the scheduler thread or the others."""
        try:
            state = self._run_fn(automation.goal)
            run_id = getattr(state, "run_id", None)
            if run_id is None and isinstance(state, dict):
                run_id = state.get("run_id")
            verification = getattr(state, "verification", None)
            passed = getattr(verification, "passed", None)
            if passed is None and isinstance(state, dict):
                passed = state.get("passed")
            status = "passed" if passed else "failed"
        except Exception as e:  # noqa: BLE001
            logger.warning("Automation %s failed: %s", automation.id, e)
            run_id, status = None, "error"

        with self._lock:
            automation.last_run_at = _now()
            automation.last_run_id = run_id
            automation.last_status = status
            automation.next_run_at = _now() + timedelta(seconds=automation.interval_seconds)
            self._save()
