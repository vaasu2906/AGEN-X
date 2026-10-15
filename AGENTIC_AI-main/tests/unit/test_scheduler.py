import sys
import time
from datetime import timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.orchestrator.scheduler import Automation, AutomationScheduler, _now


def fake_run_ok(goal: str):
    class FakeVerification:
        passed = True

    class FakeState:
        run_id = "fake-run-id"
        verification = FakeVerification()

    return FakeState()


def fake_run_error(goal: str):
    raise RuntimeError("boom")


class TestAutomationCRUD:
    def test_create_list_delete(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_ok, store_path=tmp_path / "automations.json")
        a = scheduler.create("chase overdue invoices", interval_seconds=60)
        assert a.enabled is True
        assert [x.id for x in scheduler.list()] == [a.id]

        scheduler.delete(a.id)
        assert scheduler.list() == []

    def test_rejects_empty_goal(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_ok, store_path=tmp_path / "a.json")
        with pytest.raises(ValueError):
            scheduler.create("   ", interval_seconds=60)

    def test_rejects_too_short_interval(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_ok, store_path=tmp_path / "a.json")
        with pytest.raises(ValueError):
            scheduler.create("goal", interval_seconds=1)

    def test_set_enabled_toggles_and_rearms(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_ok, store_path=tmp_path / "a.json")
        a = scheduler.create("goal", interval_seconds=60)
        scheduler.set_enabled(a.id, False)
        assert scheduler.get(a.id).enabled is False
        scheduler.set_enabled(a.id, True)
        assert scheduler.get(a.id).enabled is True

    def test_persists_across_instances(self, tmp_path):
        path = tmp_path / "automations.json"
        s1 = AutomationScheduler(run_fn=fake_run_ok, store_path=path)
        a = s1.create("goal", interval_seconds=60)

        s2 = AutomationScheduler(run_fn=fake_run_ok, store_path=path)
        assert [x.id for x in s2.list()] == [a.id]
        assert s2.get(a.id).goal == "goal"


class TestAutomationFiring:
    def test_run_now_records_success(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_ok, store_path=tmp_path / "a.json")
        a = scheduler.create("goal", interval_seconds=60)
        updated = scheduler.run_now(a.id)
        assert updated.last_status == "passed"
        assert updated.last_run_id == "fake-run-id"
        assert updated.last_run_at is not None

    def test_run_now_records_error_without_raising(self, tmp_path):
        scheduler = AutomationScheduler(run_fn=fake_run_error, store_path=tmp_path / "a.json")
        a = scheduler.create("goal", interval_seconds=60)
        updated = scheduler.run_now(a.id)  # must not raise
        assert updated.last_status == "error"
        assert updated.last_run_id is None

    def test_background_loop_fires_due_automation(self, tmp_path):
        calls = []

        def counting_run(goal):
            calls.append(goal)
            return fake_run_ok(goal)

        scheduler = AutomationScheduler(run_fn=counting_run, store_path=tmp_path / "a.json")
        scheduler.create("ping", interval_seconds=60)  # next_run_at defaults to now -> due immediately
        scheduler.start()
        try:
            deadline = time.time() + 3
            while time.time() < deadline and not calls:
                time.sleep(0.1)
        finally:
            scheduler.stop()
        assert calls == ["ping"]

    def test_disabled_automation_is_not_fired(self, tmp_path):
        calls = []

        def counting_run(goal):
            calls.append(goal)
            return fake_run_ok(goal)

        scheduler = AutomationScheduler(run_fn=counting_run, store_path=tmp_path / "a.json")
        a = scheduler.create("ping", interval_seconds=60)
        scheduler.set_enabled(a.id, False)
        scheduler.start()
        try:
            time.sleep(1.5)
        finally:
            scheduler.stop()
        assert calls == []
