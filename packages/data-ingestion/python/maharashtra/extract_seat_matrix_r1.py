"""Extract Round 1 category-wise seat matrix (govt/pvt tabular PDFs via pdfplumber)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

import pdfplumber

from normalize import normalize_branch

CAT_BLOCKS = [
    ("SC", 3),
    ("ST", 7),
    ("VJ", 11),
    ("NT1", 15),
    ("NT2", 19),
    ("NT3", 23),
    ("OBC", 27),
    ("SEBC", 31),
    ("EWS", 35),
    ("OPEN", 39),
]
SUBCOLS = ("GEN", "INS", "GEN_PWD", "INS_PWD")


@dataclass
class R1SeatRow:
    college_name_raw: str
    college_name_norm: str
    branch_name_raw: str
    branch_name_norm: str
    degree: str
    category: str
    seat_type: str
    seat_count: int
    quota: str
    source_page: int


def _int_cell(val: str | None) -> int:
    if not val:
        return 0
    m = re.search(r"\d+", str(val).replace("\n", " "))
    return int(m.group(0)) if m else 0


def _college_from_page(text: str) -> str:
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.startswith("SC ST"):
            continue
        if re.match(r"^(No\.|State|Seats|GEN|NEET|PROVISIONAL|CATEGORY)", line, re.I):
            continue
        if len(line) > 8:
            return line
    return "UNKNOWN"


def extract_r1_seat_matrix_pdf(path: str) -> list[dict[str, Any]]:
    rows: list[R1SeatRow] = []
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            college = _college_from_page(text)
            if college == "UNKNOWN" and pno == 0:
                college = "STATE_SUMMARY"
            tables = page.extract_tables() or []
            if not tables:
                continue
            table = tables[0]
            for raw in table[2:]:
                if not raw or len(raw) < 4:
                    continue
                subject = (raw[1] or "").strip()
                if not subject or subject.lower().startswith("name of"):
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
                                college_name_raw=college,
                                college_name_norm=college,
                                branch_name_raw=subject,
                                branch_name_norm=branch_norm,
                                degree=degree,
                                category=cat_label,
                                seat_type=seat_type.replace("_PWD", ""),
                                seat_count=n,
                                quota=quota,
                                source_page=pno + 1,
                            )
                        )
    return [asdict(r) for r in rows]
