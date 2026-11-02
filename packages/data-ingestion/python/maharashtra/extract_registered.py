"""Extract AIR + SML from CET registered-candidate PDFs."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

import pymupdf

APP_RE = re.compile(r"^258\d{6}$")
ROLL_RE = re.compile(r"^256\d{8}$")
MERGED_APP_ROLL = re.compile(r"^258(\d{6})(256\d{8})$")
AIR_SCORE = re.compile(r"^(\d{1,6})\s+(\d{2,3})$")
NOISE = re.compile(
    r"^(Page \d|Sr\.?\s*No|Rank|Score|Provisional|Government|STATE COMMON|Roll|NEET PG|Category|PWD|Name of|Dated|Cet Cell|In-|service|Minority|NRI)",
    re.I,
)


@dataclass
class RegisteredRow:
    sml_rank: int
    neet_roll: str
    air: int
    neet_score: int
    application_no: str
    category_raw: str
    category: str
    pwd: bool
    in_service: bool
    nri: bool
    minority: bool
    source_page: int


def _map_category(raw: str) -> str:
    s = raw.upper()
    if "OBC" in s or "SEBC" in s or "SBC" in s or "NT(" in s or "DT-" in s:
        return "OBC"
    if "EWS" in s:
        return "EWS"
    if re.search(r"\bSC\b", s):
        return "SC"
    if re.search(r"\bST\b", s):
        return "ST"
    return "GENERAL"


def _parse_category_line(line: str) -> tuple[str, dict[str, bool]] | None:
    s = line.strip()
    if not s or s.isdigit():
        return None
    flags = {"pwd": False, "in_service": False, "nri": False, "minority": False}
    compact = s.upper().replace(" ", "")
    if compact.endswith("YES"):
        if "OBC" in compact:
            flags["in_service"] = True
            return "OBC", flags
        if "ST" in compact:
            flags["in_service"] = True
            return "ST", flags
    if s.upper() in ("MUSLIM", "JAIN"):
        flags["minority"] = True
        return "OPEN", flags
    if s.upper() == "NRI":
        flags["nri"] = True
        return "NRI", flags
    if re.match(r"^[A-Z()\-./\s]{2,40}$", s, re.I):
        return s, flags
    return None


def parse_registered_text(text: str, page_no: int = 1) -> list[RegisteredRow]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip() and not NOISE.match(ln.strip())]
    rows: list[RegisteredRow] = []
    i = 0
    while i < len(lines):
        merged = re.sub(r"\s+", "", lines[i])
        m = MERGED_APP_ROLL.match(merged)
        if m:
            app_no = f"258{m.group(1)}"
            roll = m.group(2)
            i += 1
        elif APP_RE.match(lines[i]) and i + 1 < len(lines) and ROLL_RE.match(lines[i + 1]):
            app_no = lines[i]
            roll = lines[i + 1]
            i += 2
        else:
            i += 1
            continue

        if i >= len(lines):
            break
        air_m = AIR_SCORE.match(lines[i].strip())
        if air_m:
            air = int(air_m.group(1))
            score = int(air_m.group(2))
            i += 1
        elif lines[i].strip().isdigit() and i + 1 < len(lines) and re.match(r"^\d{2,3}$", lines[i + 1].strip()):
            air = int(lines[i].strip())
            score = int(lines[i + 1].strip())
            i += 2
        else:
            i += 1
            continue
        if i >= len(lines):
            break
        cat_parsed = _parse_category_line(lines[i])
        if cat_parsed:
            cat_raw, flags = cat_parsed
            i += 1
        elif lines[i].strip() == "" or lines[i].strip().isdigit():
            cat_raw, flags = "OPEN", {"pwd": False, "in_service": False, "nri": False, "minority": False}
        else:
            i += 1
            continue
        if i < len(lines) and lines[i].upper() in ("MUSLIM", "JAIN"):
            flags["minority"] = True
            i += 1
        if i >= len(lines) or not lines[i].strip().isdigit():
            continue
        sml = int(lines[i])
        i += 1
        rows.append(
            RegisteredRow(
                sml_rank=sml,
                neet_roll=roll,
                air=air,
                neet_score=score,
                application_no=app_no,
                category_raw=cat_raw,
                category=_map_category(cat_raw),
                source_page=page_no,
                **flags,
            )
        )
    return rows


def extract_registered_pdf(path: str) -> list[dict[str, Any]]:
    doc = pymupdf.open(path)
    out: list[RegisteredRow] = []
    for pno in range(doc.page_count):
        out.extend(parse_registered_text(doc[pno].get_text("text"), pno + 1))
    return [asdict(r) for r in out]
