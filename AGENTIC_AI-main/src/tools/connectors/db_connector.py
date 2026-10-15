"""
Generic database connector, registered under tool name "database".

Backed by a local SQLite file so the whole pipeline runs end-to-end with
zero external services or credentials. Swapping the connection string for
a real Postgres/MySQL DSN is the only change needed to point this at a
production database — the run() interface and args shape stay the same.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Dict, List

from src.tools.base_tool import BaseTool, ToolSchema

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
DEFAULT_DB_PATH = DATA_DIR / "agentic.db"

# Minimal demo schema + seed rows so a fresh checkout has something real to
# query (e.g. "overdue invoices") without any manual setup.
SEED_SQL = """
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    amount_due REAL NOT NULL,
    status TEXT NOT NULL,
    due_date TEXT NOT NULL
);
"""

SEED_ROWS = [
    (1, "Aarav Mehta", "aarav.mehta@example.com", 15400.00, "overdue", "2026-08-20"),
    (2, "Priya Sharma", "priya.sharma@example.com", 8200.50, "overdue", "2026-08-22"),
    (3, "Global Retail Co.", "billing@globalretail.example.com", 42000.00, "overdue", "2026-08-18"),
    (4, "Nisha Verma", "nisha.verma@example.com", 3100.00, "paid", "2026-08-25"),
]


def _ensure_seeded(conn: sqlite3.Connection) -> None:
    conn.executescript(SEED_SQL)
    count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    if count == 0:
        conn.executemany(
            "INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?)", SEED_ROWS
        )
        conn.commit()


class DBConnector(BaseTool):
    name = "database"
    schema = ToolSchema(
        input_fields=["operation", "sql", "params"],
        output_fields=["records", "row_count"],
    )

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            _ensure_seeded(conn)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        operation = (args.get("operation") or "query").lower()
        sql = args.get("sql") or "SELECT * FROM invoices WHERE status = 'overdue'"
        params = args.get("params") or []

        with self._connect() as conn:
            if operation == "query":
                rows: List[sqlite3.Row] = conn.execute(sql, params).fetchall()
                records = [dict(r) for r in rows]
                return {"records": records, "row_count": len(records)}

            if operation == "execute":
                cur = conn.execute(sql, params)
                conn.commit()
                return {"records": [], "row_count": cur.rowcount}

            raise ValueError(f"Unsupported operation '{operation}' for database tool.")
