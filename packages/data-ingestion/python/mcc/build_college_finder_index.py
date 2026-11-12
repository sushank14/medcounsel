#!/usr/bin/env python3
"""Build the College Finder index from the verified 11 November 2026 Excel files.

The Excel workbooks remain the source of truth. This script does not read the PDFs.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_round2_vacancies import parse_branch  # noqa: E402

REPO = Path(__file__).resolve().parents[4]
ROUND2 = REPO / "data" / "mcc" / "round2"
FILES = {
    "new": "MCC_R2_Newly_Added_Seats_2026.xlsx",
    "clear": "MCC_R2_Clear_Vacancy_2026.xlsx",
    "virtual": "MCC_R2_Virtual_Vacancy_2026.xlsx",
}

GOVERNMENT_TYPES = {
    "All India except Central University",
    "Central University",
}
DNB_TYPES = {
    "Diplomate of National Board (DNB) (Govt.) PG": "government",
    "Diplomate of National Board (DNB) (Pvt.) PG": "private",
}

# Array positions written into college_finder_index.json
FIELDS = [
    "id",
    "source",
    "state",
    "officialType",
    "group",
    "dnbKind",
    "degree",
    "institute",
    "code",
    "quota",
    "branch",
    "branchCode",
    "category",
    "seatCategory",
    "pwd",
    "seats",
    "page",
    "flag",
]


def seat_category(category: str) -> tuple[str, str]:
    text = (category or "").strip().upper()
    parts = text.split()
    if len(parts) != 2:
        return "Unparsed", "unparsed_category"
    code, flag = parts
    if flag not in {"NO", "PH"}:
        return "Unparsed", "unparsed_category"
    mapped = {
        "BC": "OBC",
        "OP": "Open",
        "EW": "EWS",
        "SC": "SC",
        "ST": "ST",
    }.get(code)
    if not mapped:
        return "Unparsed", "unparsed_category"
    return mapped, ""


def classify(official_type: str, degree: str) -> tuple[str, str, str]:
    if official_type in DNB_TYPES:
        return "dnb", DNB_TYPES[official_type], ""
    if official_type == "Deemed University":
        return "deemed", "", ""
    if official_type in GOVERNMENT_TYPES:
        if degree in {"MD", "MS"}:
            return "government_mdms", "", ""
        return "government_other", "", "degree_not_md_ms" if degree else "degree_not_printed"
    return "other", "", "institute_type_not_classified"


def load_excel(source: str, filename: str) -> list[list]:
    wb = load_workbook(ROUND2 / filename, read_only=True, data_only=True)
    ws = wb["Records"]
    rows = []
    header = None
    for index, raw in enumerate(ws.iter_rows(values_only=True), start=1):
        if header is None:
            header = raw
            expected = (
                "StateName",
                "InstituteType",
                "Institute",
                "InstituteCode",
                "Quota",
                "Branch",
                "BranchCode",
                "Category",
                "PwD",
                "TotalSeats",
                "SourceType",
                "Round",
                "AcademicYear",
                "PDFPage",
            )
            if raw != expected:
                raise SystemExit(f"{filename} header changed: {raw}")
            continue
        state, official_type, institute, code, quota, branch, branch_code, category, pwd, seats, source_type, round_name, year, page = raw
        parsed = parse_branch(branch or "")
        degree = parsed["degree"]
        group, dnb_kind, flag = classify(official_type or "", degree)
        seat_cat, seat_flag = seat_category(category or "")
        flags = [item for item in (flag, seat_flag) if item and item != "degree_not_md_ms"]
        if branch_code and parsed["specialty_code"] and str(branch_code) != parsed["specialty_code"]:
            flags.append("branch_code_mismatch")
        if seats is None or not isinstance(seats, int):
            flags.append("seat_not_integer")
        if not code:
            flags.append("missing_institute_code")
        rows.append(
            [
                f"{source}:{index}",
                source,
                state or "",
                official_type or "",
                group,
                dnb_kind,
                degree,
                institute or "",
                str(code or ""),
                quota or "",
                branch or "",
                str(branch_code or parsed["specialty_code"] or ""),
                category or "",
                seat_cat,
                pwd == "YES",
                seats if isinstance(seats, int) else None,
                page,
                ",".join(flags),
            ]
        )
    wb.close()
    return rows


def main() -> int:
    records = []
    for source, filename in FILES.items():
        loaded = load_excel(source, filename)
        print(f"{source}: {len(loaded)}", flush=True)
        records.extend(loaded)
    payload = {
        "source": "Verified MCC Round 2 Excel workbooks dated 11 November 2026",
        "fields": FIELDS,
        "records": records,
        "classification": {
            "government_mdms": "Official type is All India except Central University or Central University, and the printed degree is MD or MS.",
            "government_other": "Same official government types, with a printed degree other than MD or MS.",
            "dnb": "Official type starts with Diplomate of National Board. Govt. and Pvt. DNB stay distinguishable via dnbKind.",
            "deemed": "Official type is Deemed University.",
            "private": "No official Private Medical College type is present in these three workbooks. Private DNB institutes stay in the DNB section.",
            "other": "Official type did not match a known MCC value.",
            "seatCategory": "BC is OBC. OP is Open. EWS, SC, and ST stay separate. PwD is a flag, not a category.",
            "city": "These workbooks have no city column. City is not inferred.",
        },
    }
    out = ROUND2 / "college_finder_index.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    report = validate(records)
    (ROUND2 / "college_finder_validation.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("status", "records", "seat_sums", "groups", "seat_categories", "flags")}, indent=2))
    return 0 if report["status"] == "pass" else 2


def validate(records: list[list]) -> dict:
    excel_counts = {}
    excel_seats = {}
    for source, filename in FILES.items():
        wb = load_workbook(ROUND2 / filename, read_only=True, data_only=True)
        count = 0
        seats = 0
        for index, raw in enumerate(wb["Records"].iter_rows(values_only=True)):
            if index == 0:
                continue
            count += 1
            if isinstance(raw[9], int):
                seats += raw[9]
        wb.close()
        excel_counts[source] = count
        excel_seats[source] = seats
    by_source = Counter(row[1] for row in records)
    seat_sums = Counter()
    groups = Counter()
    cats = Counter()
    flags = Counter()
    for row in records:
        if isinstance(row[15], int):
            seat_sums[row[1]] += row[15]
        groups[row[4]] += 1
        cats[row[13]] += 1
        if row[17]:
            for flag in row[17].split(","):
                flags[flag] += 1
    mismatches = {
        source: {
            "excel_rows": excel_counts[source],
            "index_rows": by_source[source],
            "excel_seats": excel_seats[source],
            "index_seats": seat_sums[source],
        }
        for source in FILES
    }
    ok = all(
        item["excel_rows"] == item["index_rows"] and item["excel_seats"] == item["index_seats"]
        for item in mismatches.values()
    ) and flags.get("branch_code_mismatch", 0) == 0 and flags.get("unparsed_category", 0) == 0 and flags.get("institute_type_not_classified", 0) == 0
    return {
        "status": "pass" if ok else "fail",
        "records": dict(by_source),
        "seat_sums": dict(seat_sums),
        "excel_check": mismatches,
        "groups": dict(groups),
        "seat_categories": dict(cats),
        "flags": dict(flags),
        "private_medical_college_rows": 0,
        "private_note": "The verified workbooks contain no institute type named Private Medical College. DNB (Pvt.) rows remain DNB.",
    }


if __name__ == "__main__":
    raise SystemExit(main())
