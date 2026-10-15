import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.llm.gateway import ModelGateway
from src.tools.bootstrap import build_default_registry
from src.tools.connectors.crm_connector import CRMConnector
from src.tools.connectors.db_connector import DBConnector
from src.tools.connectors.extractor_connector import ExtractorConnector
from src.tools.connectors.mail_connector import MailConnector
from src.tools.connectors.sheets_connector import SheetsConnector


class TestDBConnector:
    def test_seeded_query_returns_overdue_invoices(self, tmp_path):
        db = DBConnector(db_path=tmp_path / "test.db")
        result = db.run({"operation": "query", "sql": "SELECT * FROM invoices WHERE status = 'overdue'"})
        assert result["row_count"] == 3
        assert all(r["status"] == "overdue" for r in result["records"])

    def test_execute_insert_then_query(self, tmp_path):
        db = DBConnector(db_path=tmp_path / "test.db")
        db.run({
            "operation": "execute",
            "sql": "INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?)",
            "params": [99, "Test Co", "test@example.com", 100.0, "overdue", "2026-09-01"],
        })
        result = db.run({"operation": "query", "sql": "SELECT * FROM invoices WHERE id = 99"})
        assert result["records"][0]["customer_name"] == "Test Co"

    def test_unsupported_operation_raises(self, tmp_path):
        db = DBConnector(db_path=tmp_path / "test.db")
        with pytest.raises(ValueError):
            db.run({"operation": "delete_everything"})


class TestMailConnector:
    def test_local_outbox_send(self, tmp_path):
        mailer = MailConnector(outbox_path=tmp_path / "outbox.jsonl")
        result = mailer.run({"to": "a@b.com", "subject": "hi", "body": "hello"})
        assert "message_id" in result
        assert (tmp_path / "outbox.jsonl").exists()

    def test_missing_recipient_raises(self, tmp_path):
        mailer = MailConnector(outbox_path=tmp_path / "outbox.jsonl")
        with pytest.raises(ValueError):
            mailer.run({"subject": "hi", "body": "hello"})


class TestCRMConnector:
    def test_list_seeded_contacts(self, tmp_path):
        crm = CRMConnector(store_path=tmp_path / "crm.json")
        result = crm.run({"object_type": "contact", "action": "list"})
        assert len(result["records"]) == 2

    def test_create_and_update_contact(self, tmp_path):
        crm = CRMConnector(store_path=tmp_path / "crm.json")
        created = crm.run({
            "object_type": "contact",
            "action": "create",
            "payload": {"name": "New Person", "email": "new@example.com"},
        })
        record_id = created["records"][0]["id"]

        updated = crm.run({
            "object_type": "contact",
            "action": "update",
            "record_id": record_id,
            "payload": {"company": "New Co"},
        })
        assert updated["records"][0]["company"] == "New Co"


class TestSheetsConnector:
    def test_append_then_read(self, tmp_path):
        sheets = SheetsConnector(workbook_path=tmp_path / "wb.xlsx")
        write_result = sheets.run({
            "operation": "append",
            "sheet_name": "Log",
            "rows": [["goal", "status"], ["do the thing", "done"]],
        })
        assert "Log" in write_result["updated_range"]

        read_result = sheets.run({"operation": "read", "sheet_name": "Log"})
        assert read_result["rows"][0] == ["goal", "status"]


class TestExtractorConnector:
    def test_no_local_model_returns_null_valued_fallback(self):
        gw = ModelGateway(role="extractor", backend_priority=["ollama"])
        extractor = ExtractorConnector(gateway=gw)
        with patch("requests.post", side_effect=ConnectionError("refused")):
            result = extractor.run(
                {"text": "Invoice #123 for $500 due Jan 1", "fields": ["amount", "due_date"]}
            )
        assert result["fields"] == {"amount": None, "due_date": None}
        assert result["generated_by"] == "fallback"

    def test_local_model_extracts_requested_fields(self):
        gw = ModelGateway(role="extractor", backend_priority=["ollama"])
        extractor = ExtractorConnector(gateway=gw)

        mock_response = Mock()
        mock_response.raise_for_status = Mock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": '{"amount": "$500", "due_date": "Jan 1"}'}}]
        }
        with patch("requests.post", return_value=mock_response):
            result = extractor.run(
                {"text": "Invoice #123 for $500 due Jan 1", "fields": ["amount", "due_date"]}
            )
        assert result["fields"] == {"amount": "$500", "due_date": "Jan 1"}
        assert result["generated_by"] == "hermes3-8b"

    def test_missing_text_raises(self):
        extractor = ExtractorConnector(gateway=ModelGateway(role="extractor"))
        with pytest.raises(ValueError):
            extractor.run({"fields": ["amount"]})

    def test_missing_fields_raises(self):
        extractor = ExtractorConnector(gateway=ModelGateway(role="extractor"))
        with pytest.raises(ValueError):
            extractor.run({"text": "some text"})


class TestBootstrap:
    def test_default_registry_has_all_four_tools(self):
        registry = build_default_registry()
        assert set(registry.list_available()) == {
            "database", "email", "crm", "spreadsheet", "coder", "extractor"
        }
