"""Extract Maharashtra provisional merit lists (2025 block layout)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

import pymupdf

ROLL_RE = re.compile(r"^256\d{8}$")
APP_RE = re.compile(r"^258\d{6}$")
SCORE_RE = re.compile(r"^\d{3}$")

HEADER = re.compile(
    r"^(Page \d|Merit No|SML|Common Provisional|Government|STATE COMMON|Roll|NEET PG|Score|Name of|Remark|Type|Cet Cell|Category|Dated|For\s+Maharashtra|NRI)$",
    re.I,
)


@dataclass
class MeritRow:
    sml_rank: int
    neet_roll: str
    candidate_name: str
    application_no: str
    category_merit_no: int | None
    neet_score: int | None
    category_raw: str
    category: str
    candidature_type: str | None
    source_page: int


def _map_category(raw: str) -> str:
    s = raw.upper()
    if not s:
        return "GENERAL"
    if "OBC" in s or "SEBC" in s or "NT(" in s or "NT-" in s:
        return "OBC"
    if "EWS" in s:
        return "EWS"
    if re.search(r"\bSC\b", s):
        return "SC"
    if re.search(r"\bST\b", s):
        return "ST"
    if "PWD" in s or "PH" in s:
        return "PWD"
    return "GENERAL"


def parse_merit_page_text(text: str, page_no: int) -> list[MeritRow]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip() and not HEADER.match(ln.strip())]
    rows: list[MeritRow] = []
    i = 0
    while i < len(lines) - 4:
        if not lines[i].isdigit():
            i += 1
            continue
        sml = int(lines[i])
        if sml < 1 or sml > 100_000:
            i += 1
            continue
        if i + 1 >= len(lines) or not ROLL_RE.match(lines[i + 1]):
            i += 1
            continue
        roll = lines[i + 1]
        i += 2
        name_parts: list[str] = []
        while i < len(lines) and not APP_RE.match(lines[i]):
            if ROLL_RE.match(lines[i]) or lines[i].isdigit() and int(lines[i]) == sml + 1:
                break
            if re.match(r"^(State|NRI)$", lines[i], re.I):
                break
            name_parts.append(lines[i])
            i += 1
        if i >= len(lines) or not APP_RE.match(lines[i]):
            continue
        app = lines[i]
        i += 1
        cat_raw = ""
        if i < len(lines) and not SCORE_RE.match(lines[i]) and not lines[i].isdigit():
            if not re.match(r"^(State|NRI)$", lines[i], re.I):
                cat_raw = lines[i]
                i += 1
        cat_merit: int | None = None
        score: int | None = None
        if i < len(lines) and lines[i].isdigit():
            cat_merit = int(lines[i])
            i += 1
        if i < len(lines) and SCORE_RE.match(lines[i]):
            score = int(lines[i])
            i += 1
        cand_type: str | None = None
        if i < len(lines) and re.match(r"^(State|NRI)$", lines[i], re.I):
            cand_type = lines[i]
            i += 1
        rows.append(
            MeritRow(
                sml_rank=sml,
                neet_roll=roll,
                candidate_name=" ".join(name_parts).strip(),
                application_no=app,
                category_merit_no=cat_merit,
                neet_score=score,
                category_raw=cat_raw or "OPEN",
                category=_map_category(cat_raw),
                candidature_type=cand_type,
                source_page=page_no,
            )
        )
    return rows


def extract_merit_pdf(path: str) -> list[dict[str, Any]]:
    doc = pymupdf.open(path)
    out: list[MeritRow] = []
    for pno in range(doc.page_count):
        out.extend(parse_merit_page_text(doc[pno].get_text("text"), pno + 1))
    return [asdict(r) for r in out]
