#!/usr/bin/env python3
"""Extract official MCC NEET PG 2026 Round 2 vacancy PDFs.

Sources (mandatory):
  Clear vacancy, virtual vacancy, newly added seats.

The virtual vacancy file published by MCC is truncated at 1,048,576 bytes
(no xref, no catalog, no %%EOF). Complete page objects inside that file are
rebuilt into a temporary PDF and extracted. Missing pages stay as errors.
Nothing is invented for pages that are not in the file.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

REPO = Path(__file__).resolve().parents[4]
RAW = REPO / "data" / "mcc" / "2026" / "round_2" / "raw"
OUT = REPO / "data" / "mcc" / "2026" / "round_2"
R1_DIR = REPO / "data" / "imports" / "mcc"

SOURCES = {
    "clear": {
        "label": "Clear Vacancy",
        "file": "clear_vacancy.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/202611101579995383.pdf",
        "vacancy_type": "clear",
    },
    "virtual": {
        "label": "Virtual Vacancy",
        "file": "virtual_vacancy.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/2026111073855246.pdf",
        "vacancy_type": "virtual",
    },
    "new": {
        "label": "New Seats",
        "file": "new_seats.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/202611101718716060.pdf",
        "vacancy_type": "new",
    },
}

AUDIT_NAMES = {
    "clear": "mcc_round2_clear_vacancy_audit.json",
    "virtual": "mcc_round2_virtual_vacancy_audit.json",
    "new": "mcc_round2_new_seats_audit.json",
}

HEADER_TOKENS = ("statename", "institutetype", "institute", "quota", "branch", "category", "totalseats")
CODE_RE = re.compile(r"\((\d{5,7})\)")
PAGE_OF_RE = re.compile(r"Page\s+(\d+)\s+of\s+(\d+)", re.I)
CAT_RE = re.compile(r"^(OP|BC|EW|SC|ST|GN|UR|EWS|OBC)\s+(NO|PH)$", re.I)
SPEC_CODE_RE = re.compile(r"\(([A-Z][A-Z0-9]{0,8}(?:-[A-Z0-9]{1,8})?)\)\s*$")
OBJ_RE = re.compile(rb"(\d+)\s+0\s+obj\b")

CATEGORY_LABEL = {
    "OP": "Open (UR)",
    "GN": "Open (UR)",
    "UR": "Open (UR)",
    "BC": "OBC",
    "OBC": "OBC",
    "EW": "EWS",
    "EWS": "EWS",
    "SC": "SC",
    "ST": "ST",
}
RESERVATION = {
    "OP": "UR",
    "GN": "UR",
    "UR": "UR",
    "BC": "OBC",
    "OBC": "OBC",
    "EW": "EWS",
    "EWS": "EWS",
    "SC": "SC",
    "ST": "ST",
}

# Round 1 DNB wide columns -> the same category token used in Round 2 PDFs.
DNB_CATEGORY_COLUMNS = [
    ("Open", "OP NO"),
    ("Open PwD", "OP PH"),
    ("General-EWS", "EW NO"),
    ("General-EWS PwD", "EW PH"),
    ("OBC", "BC NO"),
    ("OBC PwD", "BC PH"),
    ("SC", "SC NO"),
    ("SC PwD", "SC PH"),
    ("ST", "ST NO"),
    ("ST PwD", "ST PH"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def norm_space(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def is_header_row(cells: list[str]) -> bool:
    joined = "".join(cells).lower().replace(" ", "")
    return all(token in joined for token in ("statename", "institute", "totalseats"))


def is_title_row(cells: list[str]) -> bool:
    text = " ".join(cells).upper()
    if not text:
        return False
    if is_header_row(cells):
        return False
    filled = [c for c in cells if c]
    if len(filled) == 1 and (
        "VACANCY" in text or "NEWLY ADDED" in text or "SEATS MATRIX" in text or "PG COUNSELLING" in text
    ):
        return True
    return False


def parse_institute(raw: str) -> tuple[str, str, list[str]]:
    notes: list[str] = []
    text = norm_space(raw)
    matches = list(CODE_RE.finditer(text))
    if not matches:
        return "", text, ["missing_institute_code"]
    if len(matches) > 1:
        notes.append("multiple_institute_codes")
    match = matches[-1]
    code = match.group(1)
    name = text[: match.start()].strip(" ,")
    if not name:
        notes.append("missing_institute_name")
    return code, name, notes


def parse_branch(raw: str) -> dict:
    branch = norm_space(raw)
    notes: list[str] = []
    degree = ""
    rest = branch
    patterns = [
        (r"^\(NBEMS-DIPLOMA\)\s*", "DNB Diploma"),
        (r"^DIPLOMA\b\s*", "Diploma"),
        (r"^\(NBEMS\)\s*", "DNB"),
        (r"^DNB\b\s*", "DNB"),
        (r"^M\.?\s*Ch\.?\s*", "MCh"),
        (r"^M\.D\.\s*", "MD"),
        (r"^MD\b\s*", "MD"),
        (r"^M\.S\.\s*", "MS"),
        (r"^MS\b\s*", "MS"),
    ]
    for pattern, label in patterns:
        m = re.match(pattern, rest, flags=re.I)
        if m:
            degree = label
            rest = rest[m.end() :].strip()
            break
    if not degree and re.search(r"\(D\.D\.V\.L\.\)", branch, flags=re.I):
        degree = "Diploma"
    if not degree:
        if re.match(r"^(M\.|MS\b|MD\b|DNB|DIP)", branch, flags=re.I):
            notes.append("unrecognized_degree")
        else:
            notes.append("degree_not_printed")
    code = ""
    specialty = rest
    cm = SPEC_CODE_RE.search(rest)
    if cm:
        code = cm.group(1).upper()
        specialty = rest[: cm.start()].strip(" -/")
    else:
        notes.append("missing_specialty_code")
    if not specialty:
        notes.append("missing_specialty")
    return {
        "branch": branch,
        "degree": degree,
        "specialty": specialty,
        "specialty_code": code,
        "notes": notes,
    }


def parse_category(raw: str) -> dict:
    text = norm_space(raw).upper()
    notes: list[str] = []
    m = CAT_RE.fullmatch(text)
    if not m:
        return {
            "category_raw": norm_space(raw),
            "category_code": "",
            "category_label": "",
            "reservation": "",
            "pwd": None,
            "notes": ["unparsed_category"],
        }
    code = m.group(1).upper()
    flag = m.group(2).upper()
    if code not in CATEGORY_LABEL:
        notes.append("unknown_category_code")
    return {
        "category_raw": f"{code} {flag}",
        "category_code": code,
        "category_label": CATEGORY_LABEL.get(code, ""),
        "reservation": RESERVATION.get(code, ""),
        "pwd": flag == "PH",
        "notes": notes,
    }


def parse_seats(raw: str) -> tuple[int | None, list[str]]:
    text = norm_space(raw)
    if not text:
        return None, ["unparsed_seats"]
    if not re.fullmatch(r"\d+", text):
        return None, ["unparsed_seats"]
    value = int(text)
    if value < 1:
        return value, ["zero_or_negative_seats"]
    return value, []


def loose_specialty(branch: str) -> str:
    text = branch.upper()
    text = re.sub(r"\(NBEMS-DIPLOMA\)|\(NBEMS\)", " ", text)
    text = re.sub(r"\bM\.D\.|\bM\.S\.|\bDNB\b|\bDIPLOMA\b|\bMD\b|\bMS\b", " ", text)
    text = re.sub(r"\([A-Z0-9-]{2,12}\)", " ", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def logical_key(code: str, branch: str, quota: str, category_raw: str) -> str:
    return "|".join(
        [
            code,
            re.sub(r"\s+", " ", branch.upper()).strip(),
            re.sub(r"\s+", " ", quota.upper()).strip(),
            category_raw.upper().strip(),
        ]
    )


def row_verified(record: dict) -> bool:
    if record.get("notes"):
        blocking = {
            "missing_institute_code",
            "missing_institute_name",
            "missing_state",
            "missing_institute_type",
            "missing_quota",
            "missing_branch",
            "unrecognized_degree",
            "code_recovered_not_printed",
            "missing_specialty",
            "unparsed_category",
            "unknown_category_code",
            "unparsed_seats",
            "zero_or_negative_seats",
            "column_count",
        }
        if any(note in blocking for note in record["notes"]):
            return False
    required = [
        record.get("state"),
        record.get("institute_type"),
        record.get("institute_name"),
        record.get("institute_code"),
        record.get("quota"),
        record.get("branch"),
        record.get("degree"),
        record.get("specialty"),
        record.get("category_raw"),
        record.get("reservation"),
    ]
    if any(not value for value in required):
        return False
    seats = record.get("seats")
    return isinstance(seats, int) and seats >= 1


def parse_seat_cells(cells: list[str], *, page: int, row_on_page: int, meta: dict) -> dict:
    padded = (cells + [""] * 7)[:7]
    extras = cells[7:]
    notes: list[str] = []
    if len([c for c in cells if c != ""]) and len(cells) != 7:
        # Keep the first 7 as the official columns and retain leftovers as remarks.
        if any(extras):
            notes.append("extra_columns")
    state, institute_type, institute, quota, branch, category, seats_raw = padded
    if not state:
        notes.append("missing_state")
    if not institute_type:
        notes.append("missing_institute_type")
    if not quota:
        notes.append("missing_quota")
    if not branch:
        notes.append("missing_branch")
    code, name, inst_notes = parse_institute(institute)
    notes.extend(inst_notes)
    branch_info = parse_branch(branch)
    notes.extend(branch_info["notes"])
    cat = parse_category(category)
    notes.extend(cat["notes"])
    seats, seat_notes = parse_seats(seats_raw)
    notes.extend(seat_notes)
    remarks = norm_space(" ".join(extras))
    record = {
        "id": f"{meta['vacancy_type']}:{page}:{row_on_page}",
        "vacancy_type": meta["vacancy_type"],
        "state": state,
        "institute_type": institute_type,
        "institute": institute,
        "institute_name": name,
        "institute_code": code,
        "address_text": institute,
        "city": None,
        "city_note": "MCC Round 2 PDFs do not publish a separate city column. The institute cell is preserved in full.",
        "quota": quota,
        "branch": branch_info["branch"],
        "degree": branch_info["degree"],
        "specialty": branch_info["specialty"],
        "specialty_code": branch_info["specialty_code"],
        "category_raw": cat["category_raw"],
        "category_code": cat["category_code"],
        "category_label": cat["category_label"],
        "reservation": cat["reservation"],
        "pwd": cat["pwd"],
        "seats": seats,
        "seats_raw": seats_raw,
        "remarks": remarks,
        "source_pdf": meta["file"],
        "source_url": meta["url"],
        "source_label": meta["label"],
        "page": page,
        "row_on_page": row_on_page,
        "notes": notes,
    }
    record["verified"] = row_verified(record)
    record["logical_key"] = logical_key(code, record["branch"], quota, record["category_raw"] or category)
    record["specialty_loose"] = loose_specialty(record["branch"])
    return record


def classify_table_row(cells: list[str]) -> str:
    if not any(cells):
        return "blank"
    if is_header_row(cells):
        return "header"
    if is_title_row(cells):
        return "title"
    joined = " ".join(cells).upper()
    seats_cell = cells[6] if len(cells) > 6 else ""
    identity = "".join(cells[:6])
    if re.fullmatch(r"\d+", seats_cell) and not identity:
        return "total"
    if "TOTAL" in joined and not CODE_RE.search(joined):
        return "total"
    return "data"


def extract_pdf_tables(path: Path, meta: dict) -> tuple[list[dict], list[dict], dict]:
    import pdfplumber as _pdfplumber

    records: list[dict] = []
    raw_rows: list[dict] = []
    page_audits: list[dict] = []
    issues: list[dict] = []
    declared_pages: Counter[int] = Counter()
    non_data: list[dict] = []

    with _pdfplumber.open(str(path)) as pdf:
        page_count = len(pdf.pages)
        for index, page in enumerate(pdf.pages):
            page_no = index + 1
            text = page.extract_text() or ""
            declared = None
            declared_this = None
            m = PAGE_OF_RE.search(text)
            if m:
                declared_this = int(m.group(1))
                declared = int(m.group(2))
                declared_pages[declared] += 1
            page_issues: list[str] = []
            if not text.strip():
                page_issues.append("no_extractable_text")
            if declared_this is not None and declared_this != page_no:
                page_issues.append(f"printed_page_number_{declared_this}_does_not_match_pdf_index_{page_no}")
            tables = page.extract_tables() or []
            if not tables:
                page_issues.append("no_table")
            data_rows = 0
            parsed_rows = 0
            seat_sum = 0
            for table in tables:
                for raw in table:
                    cells = [norm_space(c) for c in raw]
                    kind = classify_table_row(cells)
                    if kind != "data":
                        if kind not in {"blank", "header"}:
                            non_data.append({"page": page_no, "kind": kind, "cells": cells})
                        continue
                    data_rows += 1
                    record = parse_seat_cells(cells, page=page_no, row_on_page=data_rows, meta=meta)
                    records.append(record)
                    raw_rows.append(
                        {
                            "id": record["id"],
                            "source_pdf": meta["file"],
                            "page": page_no,
                            "row_on_page": data_rows,
                            "cells": cells,
                        }
                    )
                    parsed_rows += 1
                    if isinstance(record["seats"], int):
                        seat_sum += record["seats"]
                    if not record["verified"]:
                        issues.append(
                            {
                                "severity": "error",
                                "source": meta["vacancy_type"],
                                "page": page_no,
                                "row_on_page": data_rows,
                                "id": record["id"],
                                "notes": record["notes"],
                            }
                        )
            if data_rows == 0 and "no_table" not in page_issues:
                page_issues.append("table_without_data_rows")
            status = "ok" if not page_issues else "error"
            if page_issues:
                issues.append(
                    {
                        "severity": "error",
                        "source": meta["vacancy_type"],
                        "page": page_no,
                        "notes": page_issues,
                    }
                )
            page_audits.append(
                {
                    "page": page_no,
                    "printed_page": declared_this,
                    "declared_total_pages": declared,
                    "chars": len(text),
                    "tables": len(tables),
                    "data_rows": data_rows,
                    "parsed_rows": parsed_rows,
                    "seat_sum": seat_sum,
                    "status": status,
                    "issues": page_issues,
                }
            )
            if page_no % 100 == 0:
                print(f"  {meta['label']}: page {page_no}/{page_count}", flush=True)

    declared_total = declared_pages.most_common(1)[0][0] if declared_pages else None
    audit_pages_missing = []
    if declared_total and declared_total != page_count:
        audit_pages_missing.append(
            {
                "severity": "error",
                "source": meta["vacancy_type"],
                "notes": [f"pdf_page_count_{page_count}_does_not_match_declared_{declared_total}"],
            }
        )
    return records, raw_rows, {
        "page_count": page_count,
        "declared_total_pages": declared_total,
        "declared_page_votes": dict(declared_pages),
        "pages": page_audits,
        "issues": issues + audit_pages_missing,
        "non_data_rows": non_data,
    }


def _iter_objects(data: bytes):
    """Yield complete top-level objects. Stream bodies are skipped, not scanned."""
    pos = 0
    while pos < len(data):
        match = OBJ_RE.search(data, pos)
        if not match:
            return
        num = int(match.group(1))
        start = match.start()
        window = data[start : start + 20000]
        stream_at = re.search(rb"stream\r?\n", window)
        dict_end = window.find(b"endobj")
        if stream_at and (dict_end < 0 or stream_at.start() < dict_end):
            length_m = re.search(rb"/Length\s+(\d+)", window[: stream_at.start()])
            if not length_m:
                yield num, start, None, "stream length is not a direct integer"
                return
            length = int(length_m.group(1))
            stream_start = start + stream_at.end()
            stream_end = stream_start + length
            if stream_end > len(data):
                yield num, start, None, f"stream truncated need {length} bytes have {max(0, len(data) - stream_start)}"
                return
            endstream = data.find(b"endstream", stream_end - 2, stream_end + 32)
            if endstream < 0:
                yield num, start, None, "endstream missing after declared stream length"
                return
            endobj = data.find(b"endobj", endstream, endstream + 40)
            if endobj < 0:
                yield num, start, None, "endobj missing after endstream"
                return
            yield num, start, data[start : endobj + 6], None
            pos = endobj + 6
            continue
        if dict_end < 0:
            yield num, start, None, "dictionary object truncated before endobj"
            return
        endobj = start + dict_end
        yield num, start, data[start : endobj + 6], None
        pos = endobj + 6


def _gid_to_unicode(font) -> dict[int, int]:
    order = font.getGlyphOrder()
    name_to_gid = {name: index for index, name in enumerate(order)}
    chosen: dict[int, int] = {}
    for table in font["cmap"].tables:
        for codepoint, name in table.cmap.items():
            gid = name_to_gid.get(name)
            if gid is None:
                continue
            current = chosen.get(gid)
            if current is None or codepoint == 32 or (codepoint < 128 <= (current or 999)):
                chosen[gid] = codepoint
    if "space" in name_to_gid:
        chosen.setdefault(name_to_gid["space"], 32)
    return chosen


def _tounicode_cmap(gid_to_unicode: dict[int, int]) -> bytes:
    pairs = sorted(gid_to_unicode.items())
    chunks: list[str] = []
    for offset in range(0, len(pairs), 100):
        block = pairs[offset : offset + 100]
        lines = [f"{len(block)} beginbfchar"]
        for gid, codepoint in block:
            lines.append(f"<{gid:04X}> <{codepoint:04X}>")
        lines.append("endbfchar")
        chunks.append("\n".join(lines))
    body = "\n".join(
        [
            "/CIDInit /ProcSet findresource begin",
            "12 dict begin",
            "begincmap",
            "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
            "/CMapName /Adobe-Identity-UCS def",
            "/CMapType 2 def",
            "1 begincodespacerange",
            "<0000> <FFFF>",
            "endcodespacerange",
            *chunks,
            "endcmap",
            "CMapName currentdict /CMap defineresource pop",
            "end",
            "end",
        ]
    )
    return body.encode("ascii")


def _pdf_stream(num: int, payload: bytes) -> bytes:
    return (
        f"{num} 0 obj\n<< /Length {len(payload)} >>\nstream\n".encode("ascii")
        + payload
        + b"\nendstream\nendobj\n"
    )


def _fill_missing_font_objects(objects: dict[int, bytes]) -> list[str]:
    """The published virtual PDF stores ToUnicode, widths, and FontBBox as null.

    Character codes in the content streams are Calibri glyph IDs. Without a
    ToUnicode map, extractors emit the glyph id as a Unicode scalar. Widths
    are rebuilt from the embedded font so table columns land in the right place.
    """
    from fontTools.ttLib import TTFont
    import io

    notes: list[str] = []
    font_objs = []
    for num, body in objects.items():
        if b"/Subtype /Type0" in body or b"/Subtype/Type0" in body:
            font_objs.append(num)
    for num in font_objs:
        body = objects[num]
        file_m = re.search(rb"/FontFile2\s+(\d+)\s+0\s+R", body)
        uni_m = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", body)
        width_m = re.search(rb"/W\s+(\d+)\s+0\s+R", body)
        box_m = re.search(rb"/FontBBox\s+(\d+)\s+0\s+R", body)
        stem_m = re.search(rb"/StemV\s+(\d+)\s+0\s+R", body)
        if not file_m:
            notes.append(f"font {num} has no FontFile2")
            continue
        file_num = int(file_m.group(1))
        font_bytes = objects.get(file_num)
        if not font_bytes:
            notes.append(f"font file {file_num} missing")
            continue
        stream_m = re.search(rb"stream\r?\n", font_bytes)
        if not stream_m:
            notes.append(f"font file {file_num} is not a stream")
            continue
        length_m = re.search(rb"/Length\s+(\d+)", font_bytes[: stream_m.start()])
        if not length_m:
            notes.append(f"font file {file_num} has no length")
            continue
        raw = font_bytes[stream_m.end() : stream_m.end() + int(length_m.group(1))]
        if b"/FlateDecode" in font_bytes[: stream_m.start()]:
            import zlib
            ttf = zlib.decompress(raw)
        else:
            ttf = raw
        font = TTFont(io.BytesIO(ttf))
        head = font["head"]
        scale = 1000 / head.unitsPerEm
        gid_map = _gid_to_unicode(font)
        if uni_m:
            uni_num = int(uni_m.group(1))
            if uni_num not in objects:
                objects[uni_num] = _pdf_stream(uni_num, _tounicode_cmap(gid_map))
                notes.append(f"built ToUnicode object {uni_num} with {len(gid_map)} mappings")
        if width_m:
            width_num = int(width_m.group(1))
            if width_num not in objects:
                hmtx = font["hmtx"]
                order = font.getGlyphOrder()
                widths = [str(int(round(hmtx[name][0] * scale))) for name in order]
                payload = f"[ 0 [ {' '.join(widths)} ] ]".encode("ascii")
                objects[width_num] = f"{width_num} 0 obj\n".encode() + payload + b"\nendobj\n"
                notes.append(f"built width array object {width_num} ({len(widths)} glyphs)")
        if box_m:
            box_num = int(box_m.group(1))
            if box_num not in objects:
                box = [int(round(v * scale)) for v in (head.xMin, head.yMin, head.xMax, head.yMax)]
                objects[box_num] = f"{box_num} 0 obj\n[ {' '.join(str(v) for v in box)} ]\nendobj\n".encode()
                notes.append(f"built FontBBox object {box_num}")
        if stem_m:
            stem_num = int(stem_m.group(1))
            if stem_num not in objects:
                objects[stem_num] = f"{stem_num} 0 obj\n80\nendobj\n".encode()
                notes.append(f"built StemV object {stem_num}")
    return notes


def repair_truncated_pdf(src: Path, dest: Path) -> dict:
    """Rebuild a page tree for a PDF whose trailer was cut off mid-stream."""
    data = src.read_bytes()
    objects: dict[int, bytes] = {}
    truncated: list[dict] = []
    order: list[int] = []
    for num, start, body, err in _iter_objects(data):
        if body is None:
            truncated.append({"object": num, "offset": start, "reason": err})
            break
        objects[num] = body
        order.append(num)

    page_nums = []
    for num in order:
        body = objects[num]
        if re.search(rb"/Type\s*/Page\b", body) and not re.search(rb"/Type\s*/Pages\b", body):
            page_nums.append(num)

    usable_pages = []
    dropped_pages = []
    for num in page_nums:
        body = objects[num]
        # /Parent points at the missing page tree. That object is rebuilt below.
        body_wo_parent = re.sub(rb"/Parent\s+\d+\s+0\s+R", b"", body)
        refs = [int(x) for x in re.findall(rb"(\d+)\s+0\s+R", body_wo_parent)]
        missing = [ref for ref in refs if ref not in objects]
        if missing:
            dropped_pages.append({"page_object": num, "missing_objects": missing})
            continue
        usable_pages.append(num)

    if not usable_pages:
        raise RuntimeError(f"No complete pages recovered from {src.name}: {truncated[:5]}")

    font_repairs = _fill_missing_font_objects(objects)
    catalog_num = max(objects) + 1
    kids = " ".join(f"{n} 0 R" for n in usable_pages)
    objects[2] = f"2 0 obj\n<< /Type /Pages /Count {len(usable_pages)} /Kids [ {kids} ] >>\nendobj\n".encode()
    objects[catalog_num] = f"{catalog_num} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n".encode()

    out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = {0: 0}
    max_num = catalog_num
    for num in range(1, max_num + 1):
        body = objects.get(num)
        if body is None:
            continue
        if not body.endswith(b"\n"):
            body += b"\n"
        offsets[num] = len(out)
        out.extend(body)

    xref_at = len(out)
    size = max_num + 1
    xref = ["xref", f"0 {size}", "0000000000 65535 f "]
    for num in range(1, size):
        if num in offsets and num != 0:
            xref.append(f"{offsets[num]:010d} 00000 n ")
        else:
            xref.append("0000000000 00000 f ")
    xref.append("trailer")
    xref.append(f"<< /Size {size} /Root {catalog_num} 0 R >>")
    xref.append("startxref")
    xref.append(str(xref_at))
    xref.append("%%EOF\n")
    out.extend(("\n".join(xref)).encode())
    dest.write_bytes(out)
    return {
        "source_bytes": len(data),
        "source_has_eof": data.rstrip().endswith(b"%%EOF"),
        "objects_recovered": len(objects) - 2,
        "truncated_objects": truncated,
        "page_objects_found": len(page_nums),
        "pages_rebuilt": len(usable_pages),
        "pages_dropped_incomplete": dropped_pages,
        "font_repairs": font_repairs,
        "repaired_path": str(dest.relative_to(REPO)),
    }


def load_column_csv(path: Path, source_name: str) -> tuple[list[dict], list[dict]]:
    issues: list[dict] = []
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        for index, raw in enumerate(reader, start=1):
            cells = [norm_space(c) for c in raw]
            if not any(cells):
                continue
            if index == 1 or (cells and "StateName" in cells[0] and "Institute" in "".join(cells)):
                continue
            if len(cells) < 7:
                issues.append({"source": source_name, "row": index, "notes": ["short_csv_row"], "cells": cells})
                continue
            meta = {
                "vacancy_type": "round1",
                "file": path.name,
                "url": "",
                "label": source_name,
            }
            record = parse_seat_cells(cells[:7], page=0, row_on_page=index, meta=meta)
            record["round1_source"] = source_name
            rows.append(record)
            if not record["verified"]:
                issues.append({"source": source_name, "row": index, "notes": record["notes"], "cells": cells[:7]})
    return rows, issues


def load_dnb_csv(path: Path) -> tuple[list[dict], list[dict]]:
    """Explode the wide DNB matrix into one category row per non-zero seat cell."""
    issues: list[dict] = []
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = None
        for index, raw in enumerate(reader, start=1):
            cells = [norm_space(c) for c in raw]
            if not any(cells):
                continue
            if header is None:
                header = cells
                continue
            if len(cells) < 15:
                issues.append({"source": "round1-dnb-csv", "row": index, "notes": ["short_dnb_row"], "cells": cells})
                continue
            institute_type, institute, program, quota = cells[0], cells[1], cells[2], cells[3]
            code, name, inst_notes = parse_institute(institute)
            seat_cells = cells[4:14]
            total_raw = cells[14] if len(cells) > 14 else ""
            parsed_parts: list[tuple[str, int]] = []
            row_bad = False
            for (label, token), seat_raw in zip(DNB_CATEGORY_COLUMNS, seat_cells):
                if seat_raw == "":
                    issues.append({"source": "round1-dnb-csv", "row": index, "notes": [f"blank_{token}"]})
                    row_bad = True
                    continue
                if not re.fullmatch(r"\d+", seat_raw):
                    issues.append({"source": "round1-dnb-csv", "row": index, "notes": [f"unparsed_{token}"], "value": seat_raw})
                    row_bad = True
                    continue
                seats = int(seat_raw)
                if seats > 0:
                    parsed_parts.append((token, seats))
            if re.fullmatch(r"\d+", total_raw or ""):
                total = int(total_raw)
                part_sum = sum(seats for _, seats in parsed_parts)
                if not row_bad and part_sum != total:
                    issues.append(
                        {
                            "source": "round1-dnb-csv",
                            "row": index,
                            "notes": ["dnb_category_sum_mismatch"],
                            "part_sum": part_sum,
                            "total": total,
                        }
                    )
            else:
                issues.append({"source": "round1-dnb-csv", "row": index, "notes": ["unparsed_dnb_total"], "value": total_raw})
            if inst_notes and "missing_institute_code" in inst_notes:
                issues.append({"source": "round1-dnb-csv", "row": index, "notes": inst_notes, "institute": institute})
            for token, seats in parsed_parts:
                cat = parse_category(token)
                branch_info = parse_branch(program)
                record = {
                    "round1_source": "DNB CSV",
                    "state": "",
                    "institute_type": institute_type,
                    "institute": norm_space(institute),
                    "institute_name": name,
                    "institute_code": code,
                    "quota": quota,
                    "branch": branch_info["branch"],
                    "degree": branch_info["degree"],
                    "specialty": branch_info["specialty"],
                    "specialty_code": branch_info["specialty_code"],
                    "specialty_loose": loose_specialty(branch_info["branch"]),
                    "category_raw": cat["category_raw"],
                    "reservation": cat["reservation"],
                    "pwd": cat["pwd"],
                    "seats": seats,
                    "logical_key": logical_key(code, branch_info["branch"], quota, cat["category_raw"]),
                    "notes": inst_notes + branch_info["notes"] + cat["notes"],
                }
                rows.append(record)
    return rows, issues


def scan_pdf_codes(path: Path) -> set[str]:
    import pymupdf

    codes: set[str] = set()
    doc = pymupdf.open(str(path))
    try:
        for page in doc:
            text = page.get_text("text")
            codes.update(CODE_RE.findall(text))
    finally:
        doc.close()
    return codes


def build_round1() -> dict:
    sources_used = []
    rows: list[dict] = []
    issues: list[dict] = []
    code_scan: dict[str, int] = {}

    aiq_csv = R1_DIR / "2026-aiq-seat-matrix-sheet.csv"
    dnb_csv = R1_DIR / "2026-dnb-seat-matrix-sheet.csv"
    deemed_pdf = R1_DIR / "2026-deemed-seat-matrix.pdf"
    central_pdf = R1_DIR / "2026-central-seat-matrix.pdf"
    aiq_pdf = R1_DIR / "2026-aiq-seat-matrix.pdf"
    dnb_pdf = R1_DIR / "2026-dnb-seat-matrix.pdf"

    if aiq_csv.exists():
        parsed, parsed_issues = load_column_csv(aiq_csv, "AIQ CSV")
        rows.extend(parsed)
        issues.extend(parsed_issues)
        sources_used.append({"name": "AIQ official sheet CSV", "path": str(aiq_csv.relative_to(REPO)), "rows": len(parsed), "issues": len(parsed_issues)})
    if dnb_csv.exists():
        parsed, parsed_issues = load_dnb_csv(dnb_csv)
        rows.extend(parsed)
        issues.extend(parsed_issues)
        sources_used.append({"name": "DNB official sheet CSV", "path": str(dnb_csv.relative_to(REPO)), "rows": len(parsed), "issues": len(parsed_issues)})

    for label, path in (("Deemed PDF", deemed_pdf), ("Central PDF", central_pdf)):
        if not path.exists():
            issues.append({"source": label, "notes": ["round1_file_missing"], "path": str(path)})
            continue
        meta = {"vacancy_type": "round1", "file": path.name, "url": "", "label": label}
        print(f"Round 1 {label}: extracting {path.name}", flush=True)
        parsed, _raw, info = extract_pdf_tables(path, meta)
        for record in parsed:
            record["round1_source"] = label
        rows.extend(parsed)
        unverified = sum(1 for r in parsed if not r["verified"])
        issues.extend(info["issues"])
        sources_used.append(
            {
                "name": label,
                "path": str(path.relative_to(REPO)),
                "pdf_pages": info["page_count"],
                "declared_pages": info["declared_total_pages"],
                "rows": len(parsed),
                "unverified_rows": unverified,
                "page_errors": sum(1 for p in info["pages"] if p["status"] != "ok"),
            }
        )

    for label, path in (
        ("AIQ PDF code scan", aiq_pdf),
        ("DNB PDF code scan", dnb_pdf),
        ("Deemed PDF code scan", deemed_pdf),
        ("Central PDF code scan", central_pdf),
    ):
        if not path.exists():
            continue
        print(f"Round 1 code scan: {path.name}", flush=True)
        found = scan_pdf_codes(path)
        code_scan[label] = len(found)
        for code in found:
            rows.append(
                {
                    "round1_source": label,
                    "institute_code": code,
                    "institute_name": "",
                    "branch": "",
                    "specialty_loose": "",
                    "specialty_code": "",
                    "quota": "",
                    "category_raw": "",
                    "seats": None,
                    "logical_key": "",
                    "code_scan_only": True,
                }
            )

    return {"rows": rows, "issues": issues, "sources": sources_used, "code_scan_counts": code_scan}


def compare_rounds(round2: list[dict], round1: dict) -> dict:
    r1_rows = [r for r in round1["rows"] if not r.get("code_scan_only")]
    r1_codes = {r.get("institute_code") for r in round1["rows"] if r.get("institute_code")}
    by_code_names: dict[str, set[str]] = defaultdict(set)
    by_code_loose: dict[str, set[str]] = defaultdict(set)
    by_code_spec_codes: dict[str, set[str]] = defaultdict(set)
    r1_seat_keys: dict[str, int] = defaultdict(int)
    r1_names: dict[str, str] = {}
    for row in r1_rows:
        code = row.get("institute_code") or ""
        if not code:
            continue
        if row.get("institute_name") and code not in r1_names:
            r1_names[code] = row["institute_name"]
        if row.get("specialty_loose"):
            by_code_loose[code].add(row["specialty_loose"])
        if row.get("specialty_code"):
            by_code_spec_codes[code].add(row["specialty_code"])
        if row.get("logical_key") and isinstance(row.get("seats"), int):
            r1_seat_keys[row["logical_key"]] += row["seats"]

    r2_codes = {r["institute_code"] for r in round2 if r.get("institute_code")}
    new_college_codes = sorted(c for c in r2_codes if c not in r1_codes)
    names_by_code: dict[str, dict] = {}
    for row in round2:
        code = row.get("institute_code")
        if code and code not in names_by_code:
            names_by_code[code] = {
                "institute_code": code,
                "institute_name": row["institute_name"],
                "state": row["state"],
                "institute_type": row["institute_type"],
            }

    new_colleges = []
    for code in new_college_codes:
        info = dict(names_by_code.get(code, {"institute_code": code}))
        subset = [r for r in round2 if r.get("institute_code") == code and isinstance(r.get("seats"), int)]
        info["clear_seats"] = sum(r["seats"] for r in subset if r["vacancy_type"] == "clear")
        info["virtual_seats"] = sum(r["seats"] for r in subset if r["vacancy_type"] == "virtual")
        info["new_seats"] = sum(r["seats"] for r in subset if r["vacancy_type"] == "new")
        info["vacancy_types"] = sorted({r["vacancy_type"] for r in subset})
        new_colleges.append(info)

    new_specialties = []
    specialty_review = []
    seen_new = set()
    seen_review = set()
    for row in round2:
        if row["vacancy_type"] != "new" or not row.get("institute_code"):
            continue
        code = row["institute_code"]
        loose = row.get("specialty_loose") or ""
        spec_code = row.get("specialty_code") or ""
        if code not in r1_codes:
            continue
        code_known = bool(spec_code) and spec_code in by_code_spec_codes.get(code, set())
        name_known = bool(loose) and loose in by_code_loose.get(code, set())
        if code_known or name_known:
            continue
        identity = (code, spec_code or loose, row["branch"])
        # Code is new but the loose name already exists under another code: do not call it new.
        if spec_code and name_known:
            if identity not in seen_review:
                seen_review.add(identity)
                specialty_review.append(
                    {
                        "institute_code": code,
                        "institute_name": row["institute_name"],
                        "branch": row["branch"],
                        "specialty": row["specialty"],
                        "specialty_code": spec_code,
                        "reason": "specialty code was not in Round 1 for this college, but the specialty name matches an existing Round 1 course",
                    }
                )
            continue
        if identity in seen_new:
            continue
        seen_new.add(identity)
        new_specialties.append(
            {
                "institute_code": code,
                "institute_name": row["institute_name"],
                "state": row["state"],
                "branch": row["branch"],
                "degree": row["degree"],
                "specialty": row["specialty"],
                "specialty_code": spec_code,
                "quota": row["quota"],
                "page": row["page"],
                "source_pdf": row["source_pdf"],
            }
        )

    increases = []
    added_on_new_keys = []
    for row in round2:
        if row["vacancy_type"] != "new" or not isinstance(row.get("seats"), int):
            continue
        key = row["logical_key"]
        if key in r1_seat_keys:
            increases.append(
                {
                    "logical_key": key,
                    "institute_code": row["institute_code"],
                    "institute_name": row["institute_name"],
                    "branch": row["branch"],
                    "quota": row["quota"],
                    "category_raw": row["category_raw"],
                    "round1_seats": r1_seat_keys[key],
                    "added_seats": row["seats"],
                    "page": row["page"],
                }
            )
        else:
            added_on_new_keys.append(
                {
                    "logical_key": key,
                    "institute_code": row["institute_code"],
                    "institute_name": row["institute_name"],
                    "branch": row["branch"],
                    "quota": row["quota"],
                    "category_raw": row["category_raw"],
                    "added_seats": row["seats"],
                    "page": row["page"],
                    "college_in_round1": row["institute_code"] in r1_codes,
                }
            )

    unchanged = []
    r2_code_set = r2_codes
    for code in sorted(r1_codes):
        if code in r2_code_set:
            continue
        unchanged.append({"institute_code": code, "institute_name": r1_names.get(code, "")})

    return {
        "round1_available": bool(round1["sources"]),
        "round1_sources": round1["sources"],
        "round1_code_scan_counts": round1["code_scan_counts"],
        "round1_issue_count": len(round1["issues"]),
        "round1_issue_sample": round1["issues"][:40],
        "round1_college_codes": len(r1_codes),
        "round1_seat_rows": len(r1_rows),
        "new_colleges": new_colleges,
        "new_college_count": len(new_colleges),
        "new_specialties": new_specialties,
        "new_specialty_count": len(new_specialties),
        "specialty_needs_review": specialty_review,
        "seat_increases_on_existing_keys": increases,
        "seat_increase_on_existing_keys_seats": sum(item["added_seats"] for item in increases),
        "seat_additions_on_new_keys": added_on_new_keys,
        "seat_addition_on_new_keys_seats": sum(item["added_seats"] for item in added_on_new_keys),
        "seat_decreases": None,
        "seat_decrease_note": (
            "Round 2 clear, virtual, and newly added PDFs do not publish a revised full matrix "
            "or a list of withdrawn seats. No decrease is inferred from vacancies."
        ),
        "colleges_with_no_round2_rows": unchanged,
        "colleges_with_no_round2_rows_count": len(unchanged),
        "comparison_note": (
            "A college is new only when its institute code is absent from the Round 1 AIQ CSV, "
            "DNB CSV, Deemed PDF, Central PDF, and from a code scan of those PDFs. "
            "An existing college with a new course stays in the existing-college set. "
            "Seat keys are institute code + branch + quota + category. Different categories are not merged."
        ),
    }


def overlap_report(records: list[dict]) -> dict:
    by_type: dict[str, dict[str, int]] = {"clear": defaultdict(int), "virtual": defaultdict(int), "new": defaultdict(int)}
    for row in records:
        if not isinstance(row.get("seats"), int):
            continue
        by_type[row["vacancy_type"]][row["logical_key"]] += row["seats"]
    pairs = [("clear", "virtual"), ("clear", "new"), ("virtual", "new")]
    overlaps = {}
    for a, b in pairs:
        keys = sorted(set(by_type[a]) & set(by_type[b]))
        overlaps[f"{a}_and_{b}"] = {
            "keys": len(keys),
            "seats_in_" + a: sum(by_type[a][k] for k in keys),
            "seats_in_" + b: sum(by_type[b][k] for k in keys),
            "sample_keys": keys[:25],
        }
    return overlaps


def college_summaries(records: list[dict], comparison: dict) -> list[dict]:
    new_codes = {c["institute_code"] for c in comparison["new_colleges"]}
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in records:
        if row.get("institute_code"):
            grouped[row["institute_code"]].append(row)
    summaries = []
    for code, rows in grouped.items():
        first = rows[0]
        courses: dict[tuple, dict] = {}
        for row in rows:
            key = (row["branch"], row["quota"])
            bucket = courses.setdefault(
                key,
                {
                    "branch": row["branch"],
                    "degree": row["degree"],
                    "specialty": row["specialty"],
                    "specialty_code": row["specialty_code"],
                    "quota": row["quota"],
                    "clear_seats": 0,
                    "virtual_seats": 0,
                    "new_seats": 0,
                    "by_category": [],
                },
            )
            seats = row["seats"] if isinstance(row["seats"], int) else 0
            if row["vacancy_type"] == "clear":
                bucket["clear_seats"] += seats
            elif row["vacancy_type"] == "virtual":
                bucket["virtual_seats"] += seats
            elif row["vacancy_type"] == "new":
                bucket["new_seats"] += seats
            bucket["by_category"].append(
                {
                    "vacancy_type": row["vacancy_type"],
                    "category_raw": row["category_raw"],
                    "category_label": row["category_label"],
                    "reservation": row["reservation"],
                    "pwd": row["pwd"],
                    "seats": row["seats"],
                    "page": row["page"],
                    "source_pdf": row["source_pdf"],
                    "source_url": row["source_url"],
                    "verified": row["verified"],
                    "id": row["id"],
                }
            )
        summaries.append(
            {
                "institute_code": code,
                "institute_name": first["institute_name"],
                "state": first["state"],
                "institute_type": first["institute_type"],
                "address_text": first["institute"],
                "city": None,
                "is_new_college": code in new_codes,
                "clear_seats": sum(r["seats"] for r in rows if r["vacancy_type"] == "clear" and isinstance(r["seats"], int)),
                "virtual_seats": sum(r["seats"] for r in rows if r["vacancy_type"] == "virtual" and isinstance(r["seats"], int)),
                "new_seats": sum(r["seats"] for r in rows if r["vacancy_type"] == "new" and isinstance(r["seats"], int)),
                "courses": list(courses.values()),
            }
        )
    summaries.sort(key=lambda item: (item["state"], item["institute_name"], item["institute_code"]))
    return summaries


def source_audit(meta: dict, info: dict, records: list[dict], repair: dict | None, file_path: Path) -> dict:
    verified = [r for r in records if r["verified"]]
    seat_sum = sum(r["seats"] for r in records if isinstance(r["seats"], int))
    verified_seats = sum(r["seats"] for r in verified)
    colleges = {r["institute_code"] for r in records if r.get("institute_code")}
    missing_name = sum(1 for r in records if not r.get("institute_name"))
    missing_code = sum(1 for r in records if not r.get("institute_code"))
    unparsed_seats = sum(1 for r in records if "unparsed_seats" in r["notes"])
    unknown_cat = sum(1 for r in records if "unparsed_category" in r["notes"] or "unknown_category_code" in r["notes"])
    pages_processed = len(info["pages"])
    pages_ok = sum(1 for p in info["pages"] if p["status"] == "ok")
    pages_error = pages_processed - pages_ok
    declared = info["declared_total_pages"]
    file_errors = []
    if repair:
        file_errors.append(
            {
                "severity": "error",
                "notes": [
                    "Official virtual vacancy PDF is truncated at the published Content-Length. "
                    "Trailer, catalog, and %%EOF are absent. Only complete page objects were extracted."
                ],
                "repair": repair,
            }
        )
        if declared and repair["pages_rebuilt"] < declared:
            file_errors.append(
                {
                    "severity": "error",
                    "notes": [f"{declared - repair['pages_rebuilt']} declared pages are not present in the downloaded file"],
                }
            )
    if declared and declared != info["page_count"]:
        file_errors.append(
            {
                "severity": "error",
                "notes": [f"Opened page count {info['page_count']} != printed total {declared}"],
            }
        )
    pdf_totals = []
    for row in info["non_data_rows"]:
        if row.get("kind") != "total":
            continue
        nums = [int(cell) for cell in row.get("cells") or [] if re.fullmatch(r"\d+", cell or "")]
        if nums:
            pdf_totals.append({"page": row["page"], "seats": nums[-1], "cells": row["cells"]})
    row_errors = sum(1 for record in records if not record["verified"])
    structural_pages = sum(1 for page in info["pages"] if page["status"] != "ok")
    missing_pages = (declared - info["page_count"]) if declared and declared > info["page_count"] else 0
    error_count = row_errors + structural_pages + missing_pages + (1 if repair else 0)
    seat_matches_pdf = None
    if pdf_totals:
        seat_matches_pdf = seat_sum == pdf_totals[-1]["seats"]
    return {
        "source_label": meta["label"],
        "vacancy_type": meta["vacancy_type"],
        "source_url": meta["url"],
        "source_file": meta["file"],
        "sha256": sha256_file(file_path),
        "file_bytes": file_path.stat().st_size,
        "extracted_at": utc_now(),
        "pdf_page_count": info["page_count"],
        "declared_page_count": declared,
        "pages_processed": pages_processed,
        "pages_ok": pages_ok,
        "pages_with_errors": pages_error,
        "extracted_records": len(records),
        "verified_records": len(verified),
        "error_count": error_count,
        "row_errors": row_errors,
        "structural_page_errors": structural_pages,
        "pages_not_in_file": missing_pages,
        "pdf_reported_seat_totals": pdf_totals,
        "seat_sum_matches_pdf_total": seat_matches_pdf,
        "seat_sum_all_parsed_integers": seat_sum,
        "seat_sum_verified": verified_seats,
        "unique_colleges": len(colleges),
        "rows_missing_college_name": missing_name,
        "rows_missing_college_code": missing_code,
        "rows_unparsed_seats": unparsed_seats,
        "rows_unparsed_category": unknown_cat,
        "ocr_required_pages": [p["page"] for p in info["pages"] if "no_extractable_text" in p["issues"]],
        "non_data_rows": info["non_data_rows"],
        "repair": repair,
        "file_errors": file_errors,
        "issues": info["issues"],
        "pages": info["pages"],
        "complete": (
            not repair
            and missing_pages == 0
            and structural_pages == 0
            and row_errors == 0
            and (seat_matches_pdf is not False)
        ),
    }


def recover_missing_codes(records: list[dict], round1_rows: list[dict]) -> dict:
    """Fill institute codes that the virtual PDF clipped, only when one code matches.

    The official virtual file drops the trailing institute code on some wrapped
    cells. A code is copied only when the printed name uniquely matches one
    coded name in Round 2 or Round 1. Those rows stay unverified.
    """
    catalog: dict[str, set[tuple[str, str]]] = defaultdict(set)

    def add(state: str, name: str, code: str) -> None:
        name = norm_space(name)
        if not code or len(name) < 25:
            return
        catalog[name].add((norm_space(state), code))

    for row in records:
        add(row.get("state") or "", row.get("institute_name") or "", row.get("institute_code") or "")
    for row in round1_rows:
        if row.get("code_scan_only"):
            continue
        add(row.get("state") or "", row.get("institute_name") or "", row.get("institute_code") or "")

    recovered = still_missing = ambiguous = 0
    for row in records:
        if row.get("institute_code"):
            row.setdefault("institute_code_source", "printed")
            continue
        name = norm_space(row.get("institute_name") or "")
        state = norm_space(row.get("state") or "")
        if len(name) < 40:
            row["institute_code_source"] = "missing"
            still_missing += 1
            continue
        found: set[str] = set()
        for known, pairs in catalog.items():
            # The PDF clips the end of the institute cell, so the printed text must
            # be the start of exactly one longer official name, and most of that name.
            if known != name and not (known.startswith(name) and len(name) >= int(0.75 * len(known))):
                continue
            for known_state, code in pairs:
                if known_state and state and known_state != state:
                    continue
                found.add(code)
        if len(found) == 1:
            code = next(iter(found))
            row["institute_code"] = code
            row["institute_code_source"] = "unique_name_match"
            row["notes"] = [note for note in row["notes"] if note != "missing_institute_code"]
            row["notes"].append("code_recovered_not_printed")
            row["verified"] = False
            row["logical_key"] = logical_key(code, row.get("branch") or "", row.get("quota") or "", row.get("category_raw") or "")
            recovered += 1
        elif len(found) > 1:
            row["institute_code_source"] = "ambiguous"
            row["notes"].append("code_match_ambiguous")
            ambiguous += 1
            still_missing += 1
        else:
            row["institute_code_source"] = "missing"
            still_missing += 1
    return {"recovered_unique_name": recovered, "still_missing": still_missing, "ambiguous": ambiguous}


def write_json(path: Path, payload: dict | list) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    extracted_at = utc_now()
    all_records: list[dict] = []
    all_raw: list[dict] = []
    bundles = []

    for key, meta in SOURCES.items():
        src = RAW / meta["file"]
        if not src.exists():
            print(f"MISSING {src}", file=sys.stderr)
            return 1
        repair = None
        open_path = src
        print(f"Extracting {meta['label']} from {src.name}", flush=True)
        if key == "virtual":
            repaired = RAW / "virtual_vacancy.repaired.pdf"
            repair = repair_truncated_pdf(src, repaired)
            open_path = repaired
            print(
                f"  repaired virtual PDF pages={repair['pages_rebuilt']} truncated_objects={len(repair['truncated_objects'])}",
                flush=True,
            )
        records, raw_rows, info = extract_pdf_tables(open_path, meta)
        for record in records:
            record["source_sha256"] = sha256_file(src)
            record["extracted_at"] = extracted_at
            record.setdefault("institute_code_source", "printed" if record.get("institute_code") else "missing")
        bundles.append((key, meta, src, repair, records, raw_rows, info))
        all_records.extend(records)
        all_raw.extend(raw_rows)
        print(f"  parsed records={len(records)} pages={info['page_count']} declared={info['declared_total_pages']}", flush=True)

    print("Loading Round 1 baseline", flush=True)
    round1 = build_round1()
    code_recovery = recover_missing_codes(all_records, round1["rows"])
    print("  code recovery", code_recovery, flush=True)
    audits = {}
    for key, meta, src, repair, records, _raw, info in bundles:
        audit = source_audit(meta, info, records, repair, src)
        audit["code_recovery"] = {
            "note": "Virtual rows whose institute code was clipped are filled only on a unique name match and remain unverified.",
            **code_recovery,
        }
        if repair:
            audit["complete"] = False
        audits[key] = audit
        write_json(OUT / AUDIT_NAMES[key], audit)
        print(
            f"  {meta['label']}: records={audit['extracted_records']} verified={audit['verified_records']} errors={audit['error_count']} pdf_total={audit['pdf_reported_seat_totals']} match={audit['seat_sum_matches_pdf_total']}",
            flush=True,
        )
    comparison = compare_rounds(all_records, round1)
    overlaps = overlap_report(all_records)
    colleges = college_summaries(all_records, comparison)

    def seat_sum(kind: str, verified_only: bool = False) -> int:
        total = 0
        for row in all_records:
            if row["vacancy_type"] != kind or not isinstance(row.get("seats"), int):
                continue
            if verified_only and not row["verified"]:
                continue
            total += row["seats"]
        return total

    reconciliation = []
    for key, meta in SOURCES.items():
        audit = audits[key]
        total_pages = audit["declared_page_count"] or audit["pdf_page_count"]
        reconciliation.append(
            {
                "source_pdf": meta["label"],
                "total_pages": total_pages,
                "pdf_pages_opened": audit["pdf_page_count"],
                "pages_processed": audit["pages_processed"],
                "extracted_records": audit["extracted_records"],
                "verified_records": audit["verified_records"],
                "errors": audit["error_count"],
                "complete": audit["complete"],
            }
        )

    dataset_complete = all(item["complete"] for item in reconciliation) and all(
        audits[k]["pages_processed"] == audits[k]["pdf_page_count"] for k in audits
    )
    # A truncated official file cannot be marked complete even if every recovered page parsed.
    if audits["virtual"].get("repair"):
        dataset_complete = False

    validation = {
        "extracted_at": extracted_at,
        "dataset_complete": dataset_complete,
        "completion_rule": (
            "Complete only when every printed page of every official PDF was opened and every extracted "
            "seat row verified. The virtual vacancy file on cdnbbsr is published at exactly 1048576 bytes "
            "and has no trailer; recovered pages are included and the dataset stays incomplete."
        ),
        "reconciliation": reconciliation,
        "seat_totals": {
            "clear_vacancy_seats": seat_sum("clear"),
            "clear_vacancy_verified_seats": seat_sum("clear", True),
            "virtual_vacancy_seats": seat_sum("virtual"),
            "virtual_vacancy_verified_seats": seat_sum("virtual", True),
            "newly_added_seats": seat_sum("new"),
            "newly_added_verified_seats": seat_sum("new", True),
            "note": "Clear, virtual, and new seats are not added together. Virtual seats are not confirmed vacancies.",
        },
        "unique_colleges_in_round2": len({r["institute_code"] for r in all_records if r.get("institute_code")}),
        "new_college_count": comparison["new_college_count"],
        "new_specialty_count": comparison["new_specialty_count"],
        "cross_document_overlaps": overlaps,
        "duplicate_policy": (
            "Rows are kept once per source page. Identical logical keys inside one PDF are retained because "
            "they are separate printed rows. Keys that appear in more than one PDF are listed under overlaps "
            "and are not summed into a single availability total."
        ),
        "ocr": {
            "pages_without_text": {
                key: audits[key]["ocr_required_pages"] for key in audits
            },
            "note": "All opened pages of these MCC PDFs are text-based. OCR was not applied. Pages with no extractable text would be listed above.",
        },
        "code_recovery": code_recovery,
        "round1_comparison_available": comparison["round1_available"],
        "round1_issue_count": comparison["round1_issue_count"],
        "errors_disclosed": {
            key: {
                "error_count": audits[key]["error_count"],
                "file_errors": audits[key]["file_errors"],
                "unverified_records": audits[key]["extracted_records"] - audits[key]["verified_records"],
            }
            for key in audits
        },
    }

    # Drop bulky page issue duplication from the public validation file; full issues stay in per-PDF audits.
    write_json(OUT / "mcc_round2_validation_report.json", validation)
    write_json(OUT / "mcc_round2_records.json", all_records)
    write_json(OUT / "mcc_round2_raw.json", all_raw)
    write_json(OUT / "mcc_round2_colleges.json", colleges)
    write_json(OUT / "mcc_round2_comparison.json", comparison)
    print(json.dumps({"dataset_complete": dataset_complete, "reconciliation": reconciliation, "seats": validation["seat_totals"], "new_colleges": comparison["new_college_count"], "new_specialties": comparison["new_specialty_count"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
