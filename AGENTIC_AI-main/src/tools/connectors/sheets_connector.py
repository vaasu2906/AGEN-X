"""
Spreadsheet connector, registered under tool name "spreadsheet".

Reads and writes a local .xlsx workbook via openpyxl, standing in for
Google Sheets / Excel Online. The args shape (sheet_name + rows, or a
range read) mirrors what those APIs expect, so this can be swapped for a
real Google Sheets API client later without changing the run() contract.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from openpyxl import Workbook, load_workbook

from src.tools.base_tool import BaseTool, ToolSchema

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
DEFAULT_WORKBOOK_PATH = DATA_DIR / "workbook.xlsx"


class SheetsConnector(BaseTool):
    name = "spreadsheet"
    schema = ToolSchema(
        input_fields=["operation", "sheet_name", "rows"],
        output_fields=["updated_range", "confirmation", "rows"],
    )

    def __init__(self, workbook_path: Path | str = DEFAULT_WORKBOOK_PATH):
        self.workbook_path = Path(workbook_path)
        self.workbook_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.workbook_path.exists():
            wb = Workbook()
            wb.save(self.workbook_path)

    def _load(self) -> Workbook:
        return load_workbook(self.workbook_path)

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        operation = (args.get("operation") or "append").lower()
        sheet_name = args.get("sheet_name", "Sheet1")

        wb = self._load()
        if sheet_name not in wb.sheetnames:
            # A brand-new workbook has a single default "Sheet" — rename
            # that instead of leaving an unused empty sheet behind.
            ws = wb.active if wb.sheetnames == ["Sheet"] else wb.create_sheet(sheet_name)
            ws.title = sheet_name
        else:
            ws = wb[sheet_name]

        if operation == "read":
            rows: List[List[Any]] = [[cell.value for cell in row] for row in ws.iter_rows()]
            return {"rows": rows, "confirmation": f"Read {len(rows)} row(s) from '{sheet_name}'."}

        if operation in ("write", "append"):
            new_rows = args.get("rows") or []
            if operation == "write":
                ws.delete_rows(1, ws.max_row)
            for row in new_rows:
                ws.append(row)
            wb.save(self.workbook_path)
            end_row = ws.max_row
            return {
                "updated_range": f"{sheet_name}!A1:Z{end_row}",
                "confirmation": f"Wrote {len(new_rows)} row(s) to '{sheet_name}'.",
            }

        raise ValueError(f"Unsupported operation '{operation}' for spreadsheet tool.")
