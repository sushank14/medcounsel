"""Extract Maharashtra CAP seat matrix rows (line-based; preserves page numbers)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

import pymupdf

from normalize import normalize_branch, normalize_college

COLLEGE_HDR = re.compile(r"^College:\s*(\d{5})\s+(.+)$", re.I)
SUBJECT_START = re.compile(
    r"^\s*\d+\s+(\d{4}S)\s+(.+?)\s+(G|P)\s+\|(.+)$",
    re.I,
)
PWD_LINE = re.compile(r"^\s*P\s+\|(.+)$", re.I)

GEN_LABELS = ["SC", "ST", "VJ", "NT1", "NT2", "NT3", "OBC", "RES", "SEBC", "EWS", "OPEN", "ORP", "ORC"]
INS_LABELS = ["INS_SC", "INS_ST", "INS_VJ", "INS_NT1", "INS_NT2", "INS_NT3", "INS_OBC", "INS_SEBC", "INS_EWS", "INS_OPEN"]
TAIL_LABELS = ["MINORITY", "IQ", "NRI", "TOTAL"]


@dataclass
class SeatMatrixRow:
    college_code: str
    college_name_raw: str
    college_name_norm: str
    branch_code: str
    branch_name_raw: str
    branch_name_norm: str
    degree: str
    seat_type: str
    category: str
    seat_count: int
    quota: str
    source_page: int


def _parse_pipe_segment(segment: str, labels: list[str]) -> dict[str, int]:
    parts = [p.strip() for p in segment.split("|")]
    counts: dict[str, int] = {}
    for idx, val in enumerate(parts):
        if not val:
            continue
        cleaned = re.sub(r"[^0-9]", "", val)
        if not cleaned:
            continue
        n = int(cleaned)
        if n <= 0:
            continue
        label = labels[idx] if idx < len(labels) else f"COL{idx}"
        counts[label] = counts.get(label, 0) + n
    return counts


def _expand_row(
    college_code: str,
    college_name: str,
    branch_code: str,
    branch_raw: str,
    seat_type: str,
    counts: dict[str, int],
    page_no: int,
) -> list[SeatMatrixRow]:
    branch_norm, degree = normalize_branch(branch_raw)
    rows: list[SeatMatrixRow] = []
    for cat, seats in counts.items():
        quota = "IN_SERVICE" if cat.startswith("INS_") else "STATE"
        if cat in ("MINORITY", "IQ", "NRI"):
            quota = cat
        rows.append(
            SeatMatrixRow(
                college_code=college_code,
                college_name_raw=college_name,
                college_name_norm=college_name,
                branch_code=branch_code,
                branch_name_raw=branch_raw,
                branch_name_norm=branch_norm,
                degree=degree,
                seat_type=seat_type,
                category=cat.replace("INS_", ""),
                seat_count=seats,
                quota=quota,
                source_page=page_no,
            )
        )
    return rows


def parse_seat_matrix_text(text: str, page_no: int) -> list[SeatMatrixRow]:
    rows: list[SeatMatrixRow] = []
    college_code = ""
    college_name = ""
    pending_pwd: tuple[str, str, str] | None = None

    for line in text.split("\n"):
        stripped = line.strip()
        ch = COLLEGE_HDR.match(stripped)
        if ch:
            college_code = ch.group(1)
            college_name = normalize_college(ch.group(2), college_code)
            continue

        sm = SUBJECT_START.match(line)
        if sm and college_code:
            branch_code = sm.group(1).upper()
            branch_raw = sm.group(2).strip()
            seat_type = sm.group(3).upper()
            pipe_rest = sm.group(4)
            parts = pipe_rest.split("|")
            gen_part = "|".join(parts[: len(GEN_LABELS)]) if len(parts) >= len(GEN_LABELS) else pipe_rest
            ins_part = ""
            tail_part = ""
            if len(parts) > len(GEN_LABELS):
                ins_part = "|".join(parts[len(GEN_LABELS) : len(GEN_LABELS) + len(INS_LABELS)])
            if len(parts) > len(GEN_LABELS) + len(INS_LABELS):
                tail_part = "|".join(parts[len(GEN_LABELS) + len(INS_LABELS) :])
            counts = _parse_pipe_segment(gen_part, GEN_LABELS)
            counts.update(_parse_pipe_segment(ins_part, INS_LABELS))
            counts.update(_parse_pipe_segment(tail_part, TAIL_LABELS))
            rows.extend(
                _expand_row(college_code, college_name, branch_code, branch_raw, seat_type, counts, page_no)
            )
            pending_pwd = (branch_code, branch_raw, pipe_rest)
            continue

        pm = PWD_LINE.match(line)
        if pm and college_code and pending_pwd:
            branch_code, branch_raw, _ = pending_pwd
            counts = _parse_pipe_segment(pm.group(1), GEN_LABELS + INS_LABELS + TAIL_LABELS)
            rows.extend(_expand_row(college_code, college_name, branch_code, branch_raw, "P", counts, page_no))
            pending_pwd = None

    return rows


def extract_seat_matrix_pdf(path: str) -> list[dict[str, Any]]:
    doc = pymupdf.open(path)
    out: list[SeatMatrixRow] = []
    for pno in range(doc.page_count):
        out.extend(parse_seat_matrix_text(doc[pno].get_text("text"), pno + 1))
    return [asdict(r) for r in out]
