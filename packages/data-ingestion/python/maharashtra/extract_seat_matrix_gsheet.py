"""Extract MAHACET NEET-PG govt R1 seat matrix from official Google Sheet export."""
from __future__ import annotations

import re
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any
from urllib.request import urlretrieve

import openpyxl

from extract_seat_matrix_r1 import CAT_BLOCKS, R1SeatRow, SUBCOLS, _int_cell
from mah_college_canonical import canonical_mah_college
from normalize import normalize_branch

DEFAULT_SHEET_ID = "1Jl2v_UhUQxJNT2WuHQqs20cLDr8pMV1Ihe8IqDZaTJo"
DEFAULT_XLSX_URL = (
    f"https://docs.google.com/spreadsheets/d/{DEFAULT_SHEET_ID}/export?format=xlsx"
)

SKIP_SHEET_MARKERS = ("NEET PG", "NOTE:", "GEN: GENERAL")


def _college_from_sheet(ws) -> str | None:
    val = ws.cell(1, 1).value
    if val is None:
        return None
    text = str(val).strip()
    if not text or any(text.upper().startswith(m.upper()) for m in SKIP_SHEET_MARKERS):
        return None
    if len(text) < 8:
        return None
    return canonical_mah_college(text)


def extract_from_workbook(path: str) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows: list[R1SeatRow] = []
    sheet_idx = 0
    try:
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            college = _college_from_sheet(ws)
            if not college:
                continue
            sheet_idx += 1
            table_rows = list(ws.iter_rows(values_only=True))
            # Data starts after header rows (No., Name of Subject…)
            data_start = 3
            for raw in table_rows[data_start:]:
                if not raw or len(raw) < 4:
                    continue
                subject = (raw[1] or "")
                subject = str(subject).strip()
                if not subject or subject.lower().startswith("name of"):
                    continue
                if re.match(r"^\d+\.?\s*$", subject):
                    continue
                branch_norm, degree = normalize_branch(subject.replace(".", ""))
                for cat_label, start_col in CAT_BLOCKS:
                    for offset, seat_type in enumerate(SUBCOLS):
                        col = start_col + offset
                        if col >= len(raw):
                            continue
                        n = _int_cell(raw[col])
                        if n <= 0:
                            continue
                        quota = "IN_SERVICE" if "INS" in seat_type else "STATE"
                        rows.append(
                            R1SeatRow(
                                college_name_raw=str(ws.cell(1, 1).value or college),
                                college_name_norm=college,
                                branch_name_raw=subject,
                                branch_name_norm=branch_norm,
                                degree=degree,
                                category=cat_label,
                                seat_type=seat_type.replace("_PWD", ""),
                                seat_count=n,
                                quota=quota,
                                source_page=sheet_idx,
                            )
                        )
    finally:
        wb.close()
    return [asdict(r) for r in rows]


def download_xlsx(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(DEFAULT_XLSX_URL, dest)
    return dest


def main() -> None:
    out_json = Path(__file__).resolve().parents[4] / "data/maharashtra/2026/processed/seat_matrix_r1_govt.json"
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if xlsx_path is None:
        cache = out_json.parent.parent / "seat_matrices/round_1/MAHACET-2026-govt-matrix.xlsx"
        xlsx_path = download_xlsx(cache)
    rows = extract_from_workbook(str(xlsx_path))
    meta = {
        "year": 2026,
        "url": DEFAULT_XLSX_URL,
        "title": "MAHACET NEET-PG 2026 govt matrix (Google Sheet)",
        "source": "google_sheet",
        "sheet_id": DEFAULT_SHEET_ID,
        "rows": len(rows),
        "total_seats": sum(r["seat_count"] for r in rows),
        "colleges": len({r["college_name_norm"] for r in rows}),
    }
    import json

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps({"meta": meta, "rows": rows}, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} rows, {meta['total_seats']} seats, {meta['colleges']} colleges → {out_json}")


if __name__ == "__main__":
    main()
