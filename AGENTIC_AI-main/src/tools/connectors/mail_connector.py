"""
Email connector, registered under tool name "email".

Default transport writes to a local JSONL "outbox" file, so sending mail
is fully functional in a demo/offline environment with no mail account
needed. If SMTP_HOST (and related SMTP_* env vars) are set, run() sends a
real message over SMTP instead — same args, same return shape, so nothing
upstream (ExecutorAgent, Planner-produced tasks) has to change.
"""
from __future__ import annotations

import json
import logging
import os
import smtplib
import uuid
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict

from src.tools.base_tool import BaseTool, ToolSchema

logger = logging.getLogger("agentic.tools.email")

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
DEFAULT_OUTBOX_PATH = DATA_DIR / "outbox.jsonl"


class MailConnector(BaseTool):
    name = "email"
    schema = ToolSchema(
        input_fields=["to", "subject", "body"],
        output_fields=["confirmation", "message_id"],
    )

    def __init__(self, outbox_path: Path | str = DEFAULT_OUTBOX_PATH):
        self.outbox_path = Path(outbox_path)
        self.outbox_path.parent.mkdir(parents=True, exist_ok=True)
        self.smtp_host = os.environ.get("SMTP_HOST")

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        to = args.get("to")
        subject = args.get("subject", "(no subject)")
        body = args.get("body", "")
        if not to:
            raise ValueError("email tool requires a 'to' address.")

        message_id = f"<{uuid.uuid4().hex}@agentic-workflow.local>"

        transport = "local_outbox"
        if self.smtp_host:
            try:
                self._send_smtp(to, subject, body, message_id)
                transport = "smtp"
            except Exception as e:
                logger.error("SMTP sending to %s failed (%s). Recording in local outbox.", to, e)
                # Keep local record even if live SMTP encounters network/auth issues
                transport = f"local_outbox (SMTP failed: {e})"

        self._write_local(to, subject, body, message_id)

        return {
            "confirmation": f"Email to {to} recorded via {transport}.",
            "message_id": message_id,
        }

    def _write_local(self, to: str, subject: str, body: str, message_id: str) -> None:
        record = {
            "message_id": message_id,
            "to": to,
            "subject": subject,
            "body": body,
        }
        with open(self.outbox_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def _send_smtp(self, to: str, subject: str, body: str, message_id: str) -> None:
        msg = MIMEText(body)
        msg["Subject"] = subject
        sender = os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER") or "agentic-workflow@example.com"
        msg["From"] = sender
        msg["To"] = to
        msg["Message-ID"] = message_id

        port = int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(self.smtp_host, port, timeout=15) as server:
            if os.environ.get("SMTP_USE_TLS", "true").lower() == "true":
                server.starttls()
            user = os.environ.get("SMTP_USER")
            password = os.environ.get("SMTP_PASSWORD")
            if user and password:
                server.login(user, password)
            server.sendmail(sender, [to], msg.as_string())
        logger.info("Successfully sent SMTP email from %s to %s (Subject: %s)", sender, to, subject)
