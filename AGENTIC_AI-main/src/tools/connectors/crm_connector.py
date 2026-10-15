"""
CRM connector, registered under tool name "crm".

Backed by a local JSON store standing in for a real CRM (Salesforce,
HubSpot, Zoho, ...). Supports the CRUD shape any of those APIs exposes
(list / get / create / update against an object type), so pointing this
at a real CRM later means implementing the same run() contract against
that API's SDK, not redesigning the tool interface.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List

from src.tools.base_tool import BaseTool, ToolSchema

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
DEFAULT_STORE_PATH = DATA_DIR / "crm.json"

SEED_STORE: Dict[str, List[Dict[str, Any]]] = {
    "contact": [
        {"id": "c-001", "name": "Aarav Mehta", "email": "aarav.mehta@example.com", "company": "Mehta Textiles"},
        {"id": "c-002", "name": "Priya Sharma", "email": "priya.sharma@example.com", "company": "Sharma Logistics"},
    ],
    "deal": [
        {"id": "d-001", "contact_id": "c-001", "stage": "negotiation", "value": 15400.00},
        {"id": "d-002", "contact_id": "c-002", "stage": "prospecting", "value": 8200.50},
    ],
}


class CRMConnector(BaseTool):
    name = "crm"
    schema = ToolSchema(
        input_fields=["object_type", "action", "payload", "record_id"],
        output_fields=["records"],
    )

    def __init__(self, store_path: Path | str = DEFAULT_STORE_PATH):
        self.store_path = Path(store_path)
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.store_path.exists():
            self._write_store(SEED_STORE)

    def _read_store(self) -> Dict[str, List[Dict[str, Any]]]:
        with open(self.store_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_store(self, store: Dict[str, List[Dict[str, Any]]]) -> None:
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(store, f, indent=2)

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        object_type = args.get("object_type", "contact")
        action = args.get("action", "list")
        store = self._read_store()
        table = store.setdefault(object_type, [])

        if action == "list":
            return {"records": table}

        if action == "get":
            record_id = args.get("record_id")
            match = [r for r in table if r.get("id") == record_id]
            return {"records": match}

        if action == "create":
            payload = dict(args.get("payload") or {})
            payload.setdefault("id", f"{object_type[0]}-{uuid.uuid4().hex[:8]}")
            table.append(payload)
            self._write_store(store)
            return {"records": [payload]}

        if action == "update":
            record_id = args.get("record_id")
            payload = args.get("payload") or {}
            updated = None
            for record in table:
                if record.get("id") == record_id:
                    record.update(payload)
                    updated = record
                    break
            if updated is None:
                raise KeyError(f"No {object_type} record with id '{record_id}'.")
            self._write_store(store)
            return {"records": [updated]}

        raise ValueError(f"Unsupported CRM action '{action}'.")
