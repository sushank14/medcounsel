#!/usr/bin/env python3
"""Parse NMC/MARB PG Seat Matrix PDF (AY 2026–27) into structured JSON.

Requires: pip install pymupdf
Usage:
  python3 parse-nmc-seat-matrix.py /path/to/1871.pdf
  python3 parse-nmc-seat-matrix.py /path/to/1871.pdf --out data/processed/nmc/2026-27-seat-matrix.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import pymupdf
except ImportError:
    sys.stderr.write("Install pymupdf: pip install pymupdf\n")
    sys.exit(1)

COLLEGE_CODE = re.compile(r"^[A-Z]{2}/\d+/(G|P|D)/\d+$")
COURSE_START = re.compile(r"^(M\.|MS\.|M\.S\.|DNB|Diploma|DIPLOMA)", re.I)
ACADEMIC_YEAR = "2026-27"
MATRIX_YEAR = 2026

CAT_MAP = {
    "Govt": "GOVT",
    "Pvt": "PRIVATE",
    "Deemed": "DEEMED",
}


def norm_category(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().rstrip(".")
    return CAT_MAP.get(key, key.upper())


def parse_pdf(pdf_path: Path) -> list[dict]:
    doc = pymupdf.open(str(pdf_path))
    raw_rows: list[dict] = []

    for pno in range(doc.page_count):
        page = doc[pno]
        text = page.get_text("text")
        if "College Code" not in text and "Seat Matrix for Postgraduate" not in text:
            continue

        tables = page.find_tables()
        if not tables or not tables.tables:
            continue

        for tbl in tables.tables:
            for row in tbl.extract():
                if not row or len(row) < 7:
                    continue
                sr, code, state, college, cat, course, seats = row[:7]
                code_s = str(code or "").strip()
                course_s = str(course or "").strip()
                if not COLLEGE_CODE.match(code_s):
                    continue
                if not course_s or not COURSE_START.match(course_s):
                    continue

                seat_val: int | None
                try:
                    seat_val = int(str(seats).strip())
                except (TypeError, ValueError):
                    seat_val = None

                raw_rows.append(
                    {
                        "srNo": str(sr or "").strip(),
                        "collegeCode": code_s,
                        "state": str(state or "").strip(),
                        "collegeName": str(college or "").strip(),
                        "category": norm_category(str(cat or "")),
                        "courseName": course_s,
                        "seats": seat_val,
                        "academicYear": ACADEMIC_YEAR,
                        "matrixYear": MATRIX_YEAR,
                        "page": pno + 1,
                    }
                )

    return dedupe_rows(raw_rows)


def dedupe_rows(rows: list[dict]) -> list[dict]:
    """Keep latest page for duplicate college+course; prefer higher seat count on same page."""
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        grouped[(r["collegeCode"], r["courseName"])].append(r)

    out: list[dict] = []
    for key, items in grouped.items():
        items.sort(key=lambda x: (x["page"], x["seats"] if x["seats"] is not None else -1))
        chosen = items[-1]
        if len(items) > 1:
            chosen = dict(chosen)
            chosen["_dedupedFrom"] = len(items)
            pages = sorted({i["page"] for i in items})
            seats = [i["seats"] for i in items]
            if len(set(seats)) > 1:
                chosen["_seatConflict"] = {"pages": pages, "values": seats}
        out.append(chosen)

    out.sort(key=lambda r: (r["collegeCode"], r["courseName"]))
    return out


def validate(rows: list[dict]) -> dict:
    dup_keys = Counter((r["collegeCode"], r["courseName"]) for r in rows)
    duplicates = {k: v for k, v in dup_keys.items() if v > 1}

    missing = {
        "collegeCode": sum(1 for r in rows if not r["collegeCode"]),
        "state": sum(1 for r in rows if not r["state"]),
        "collegeName": sum(1 for r in rows if not r["collegeName"]),
        "category": sum(1 for r in rows if not r["category"]),
        "courseName": sum(1 for r in rows if not r["courseName"]),
        "seats": sum(1 for r in rows if r["seats"] is None),
    }
    invalid_seats = [r for r in rows if r["seats"] is not None and r["seats"] < 0]
    large_seats = [r for r in rows if r["seats"] is not None and r["seats"] > 100]

    by_state = Counter(r["state"] for r in rows)
    by_category = Counter(r["category"] for r in rows)
    by_course = Counter(r["courseName"] for r in rows)

    seat_conflicts = [r for r in rows if r.get("_seatConflict")]

    return {
        "recordCount": len(rows),
        "uniqueCollegeCodes": len(set(r["collegeCode"] for r in rows)),
        "uniqueColleges": len(set((r["collegeCode"], r["collegeName"]) for r in rows)),
        "uniqueCourses": len(set(r["courseName"] for r in rows)),
        "totalSeats": sum(r["seats"] or 0 for r in rows),
        "zeroSeatRecords": sum(1 for r in rows if r["seats"] == 0),
        "missingFields": missing,
        "duplicateCollegeCourseAfterDedup": len(duplicates),
        "negativeSeatRecords": len(invalid_seats),
        "suspiciousLargeSeatRecords": len(large_seats),
        "seatConflictRecords": len(seat_conflicts),
        "seatsByState": dict(by_state.most_common()),
        "seatsByCategory": {
            cat: sum(r["seats"] or 0 for r in rows if r["category"] == cat)
            for cat in sorted(set(r["category"] for r in rows))
        },
        "topCoursesBySeats": dict(by_course.most_common(15)),
        "recordsWithMissingSeats": [
            {k: r[k] for k in ("collegeCode", "collegeName", "courseName", "page")}
            for r in rows
            if r["seats"] is None
        ],
        "seatConflictSamples": seat_conflicts[:10],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path, help="Path to NMC seat matrix PDF")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/processed/nmc/2026-27-seat-matrix.json"),
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("data/processed/nmc/2026-27-seat-matrix.validation.json"),
    )
    args = parser.parse_args()

    if not args.pdf.exists():
        sys.stderr.write(f"PDF not found: {args.pdf}\n")
        sys.exit(1)

    rows = parse_pdf(args.pdf)
    report = validate(rows)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": {
            "authority": "NMC/MARB",
            "title": "Seat Matrix for Postgraduate (PG) Seats for Academic Year 2026–27",
            "publishedDate": "2026-09-29",
            "academicYear": ACADEMIC_YEAR,
            "matrixYear": MATRIX_YEAR,
            "pdfFile": args.pdf.name,
        },
        "extractedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "rows": [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows],
        "validation": report,
    }

    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✅ Wrote {len(rows)} records → {args.out}")
    print(f"   Validation report → {args.report}")
    print(f"   Colleges: {report['uniqueCollegeCodes']} | Seats: {report['totalSeats']:,}")
    if report["missingFields"]["seats"]:
        print(f"   ⚠ Missing seat values: {report['missingFields']['seats']}")


if __name__ == "__main__":
    main()
