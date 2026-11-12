#!/usr/bin/env python3
"""Convert the 11 November 2026 MCC Round 2 PDFs into verified Excel workbooks.

These URLs replace the 10 November files. This script does not update the website.
Institute codes are taken only from the printed institute cell.
"""

from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_round2_vacancies as mcc  # noqa: E402

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "data" / "mcc" / "round2"
RAW = OUT / "raw"

SOURCES = [
    {
        "key": "new",
        "sheet": "Newly Added Seats",
        "source_type": "Newly Added",
        "file": "new_seats_20261111.pdf",
        "official_name": "202611111088701627.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/202611111088701627.pdf",
        "label": "Newly Added Seats",
        "vacancy_type": "new",
        "xlsx": "MCC_R2_Newly_Added_Seats_2026.xlsx",
        "expected_pages": 176,
    },
    {
        "key": "clear",
        "sheet": "Clear Vacancy",
        "source_type": "Clear",
        "file": "clear_vacancy_20261111.pdf",
        "official_name": "20261111393380887.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/20261111393380887.pdf",
        "label": "Clear Vacancy",
        "vacancy_type": "clear",
        "xlsx": "MCC_R2_Clear_Vacancy_2026.xlsx",
        "expected_pages": 781,
    },
    {
        "key": "virtual",
        "sheet": "Virtual Vacancy",
        "source_type": "Virtual",
        "file": "virtual_vacancy_20261111.pdf",
        "official_name": "202611111350590462.pdf",
        "url": "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/11/202611111350590462.pdf",
        "label": "Virtual Vacancy",
        "vacancy_type": "virtual",
        "xlsx": "MCC_R2_Virtual_Vacancy_2026.xlsx",
        "expected_pages": 810,
    },
]

COLUMNS = [
    ("StateName", 28),
    ("InstituteType", 42),
    ("Institute", 78),
    ("InstituteCode", 16),
    ("Quota", 28),
    ("Branch", 62),
    ("BranchCode", 14),
    ("Category", 14),
    ("PwD", 10),
    ("TotalSeats", 14),
    ("SourceType", 16),
    ("Round", 12),
    ("AcademicYear", 16),
    ("PDFPage", 12),
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(color="FFFFFF", bold=True)
TITLE_FONT = Font(bold=True, size=14)
NOTE_FILL = PatternFill("solid", fgColor="FFF2CC")


def blank(value: str | None) -> str | None:
    text = mcc.norm_space(value)
    return text or None


def pwd_value(flag: bool | None) -> str | None:
    if flag is True:
        return "YES"
    if flag is False:
        return "NO"
    return None


def excel_row(record: dict, source_type: str) -> list:
    seats = record["seats"] if isinstance(record["seats"], int) else None
    return [
        blank(record.get("state")),
        blank(record.get("institute_type")),
        blank(record.get("institute")),
        blank(record.get("institute_code")),
        blank(record.get("quota")),
        blank(record.get("branch")),
        blank(record.get("specialty_code")),
        blank(record.get("category_raw")),
        pwd_value(record.get("pwd")),
        seats,
        source_type,
        "Round 2",
        2026,
        record["page"],
    ]


def style_header(ws: Worksheet, widths: list[int]) -> None:
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    ws.row_dimensions[1].height = 22
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width
    ws.auto_filter.ref = f"A1:{get_column_letter(len(widths))}{ws.max_row}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.oddHeader.left.text = ws.title
    ws.print_title_rows = "1:1"


def write_table(ws: Worksheet, headers: list[str], rows: list[list], widths: list[int] | None = None) -> None:
    ws.append(headers)
    for row in rows:
        ws.append(row)
    style_header(ws, widths or [22] * len(headers))
    seat_cols = {name for name in headers if name in {"TotalSeats", "Records", "Seats", "Pages", "Count"}}
    for col_index, name in enumerate(headers, start=1):
        if name not in seat_cols and name not in {"TotalSeats", "PDFPage", "AcademicYear"}:
            continue
        for cell in ws.iter_cols(min_col=col_index, max_col=col_index, min_row=2, max_row=ws.max_row):
            for item in cell:
                if isinstance(item.value, int):
                    item.number_format = "#,##0"


def count_sheet(ws: Worksheet, title: str, counter: Counter, key_name: str) -> None:
    rows = [[key, count] for key, count in counter.most_common()]
    write_table(ws, [key_name, "Records"], rows, [48, 14])
    ws.sheet_properties.tabColor = "1F4E79"
    ws.oddHeader.center.text = title


def duplicate_groups(records: list[dict]) -> tuple[list[list], int]:
    """Keep every printed row. Report keys that occur more than once."""
    grouped: dict[tuple, list[dict]] = defaultdict(list)
    for record in records:
        key = (
            record.get("institute_code") or "",
            record.get("branch") or "",
            record.get("quota") or "",
            record.get("category_raw") or "",
        )
        grouped[key].append(record)
    rows = []
    extra = 0
    for key, items in grouped.items():
        if len(items) < 2:
            continue
        extra += len(items) - 1
        seats = sorted({item["seats"] for item in items})
        pages = sorted({item["page"] for item in items})
        rows.append(
            [
                key[0] or None,
                items[0].get("institute") or None,
                key[1],
                key[2],
                key[3],
                len(items),
                ", ".join(str(value) for value in seats),
                ", ".join(str(page) for page in pages),
                "Kept. Same institute code, branch, quota, and category were printed more than once.",
            ]
        )
    rows.sort(key=lambda row: (-row[5], row[0] or "", row[2]))
    return rows, extra


def unverified_rows(records: list[dict]) -> list[list]:
    rows = []
    for record in records:
        if record["verified"]:
            continue
        rows.append(
            [
                record["page"],
                record.get("row_on_page"),
                record.get("state") or None,
                record.get("institute") or None,
                record.get("institute_code") or None,
                record.get("branch") or None,
                record.get("category_raw") or None,
                record["seats"] if isinstance(record["seats"], int) else None,
                ", ".join(record.get("notes") or []),
            ]
        )
    return rows


def build_detail_book(meta: dict, records: list[dict], info: dict, pdf_total: int | None) -> dict:
    seat_sum = sum(record["seats"] for record in records if isinstance(record["seats"], int))
    codes = {record["institute_code"] for record in records if record.get("institute_code")}
    branches = {record["branch"] for record in records if record.get("branch")}
    branch_codes = {record["specialty_code"] for record in records if record.get("specialty_code")}
    missing_code = sum(1 for record in records if not record.get("institute_code"))
    dup_rows, dup_extra = duplicate_groups(records)
    review = unverified_rows(records)
    zero_seat_rows = [
        record for record in records if record.get("notes") == ["zero_or_negative_seats"] and record.get("seats") == 0
    ]
    unverified = [
        row
        for record, row in zip(
            [record for record in records if not record["verified"]],
            review,
        )
        if record.get("notes") != ["zero_or_negative_seats"]
    ]
    failed_pages = [page for page in info["pages"] if page["status"] != "ok"]
    ocr_pages = [page["page"] for page in info["pages"] if "no_extractable_text" in page["issues"]]
    declared = info["declared_total_pages"]
    pages_match = info["page_count"] == meta["expected_pages"] == declared
    seat_match = pdf_total is not None and seat_sum == pdf_total
    status = "Verified"
    reasons = []
    if not pages_match:
        status = "Not complete"
        reasons.append(
            f"Page count opened {info['page_count']}, expected {meta['expected_pages']}, printed total {declared}."
        )
    if failed_pages:
        status = "Not complete"
        reasons.append(f"{len(failed_pages)} pages have extraction issues.")
    if ocr_pages:
        status = "Not complete"
        reasons.append(f"{len(ocr_pages)} pages had no extractable text.")
    if pdf_total is None:
        status = "Not complete"
        reasons.append("No printed grand total was found.")
    elif not seat_match:
        status = "Not complete"
        reasons.append(f"Seat sum {seat_sum} does not equal printed total {pdf_total}.")
    if unverified:
        status = "Not complete"
        reasons.append(f"{len(unverified)} records are unverified.")
    if not reasons:
        reasons.append("Every opened page was processed and the seat sum matches the printed total.")
    if zero_seat_rows:
        reasons.append(
            f"{len(zero_seat_rows)} rows print TotalSeats 0. Those rows are kept. They do not change the seat total."
        )

    wb = Workbook()
    detail = wb.active
    detail.title = "Records"
    detail.append([name for name, _width in COLUMNS])
    for record in records:
        detail.append(excel_row(record, meta["source_type"]))
        row_index = detail.max_row
        detail.cell(row_index, 10).number_format = "0"
        detail.cell(row_index, 13).number_format = "0"
        detail.cell(row_index, 14).number_format = "0"
    style_header(detail, [width for _name, width in COLUMNS])
    detail.auto_filter.ref = f"A1:N{detail.max_row}"
    detail.freeze_panes = "A2"

    summary = wb.create_sheet("Summary")
    summary_rows = [
        ["Item", "Value"],
        ["Source PDF", meta["official_name"]],
        ["Local file", meta["file"]],
        ["Source URL", meta["url"]],
        ["Source type", meta["source_type"]],
        ["Round", "Round 2"],
        ["Academic year", 2026],
        ["PDF page count", info["page_count"]],
        ["Printed page total", declared],
        ["Pages processed", len(info["pages"])],
        ["Failed pages", len(failed_pages)],
        ["OCR-required pages", len(ocr_pages)],
        ["Extracted records", len(records)],
        ["Verified records", sum(1 for record in records if record["verified"])],
        ["Unverified records", len(unverified)],
        ["Printed zero-seat rows", len(zero_seat_rows)],
        ["Rows missing a printed institute code", missing_code],
        ["Unique institutes with a printed code", len(codes)],
        ["Unique branch names", len(branches)],
        ["Unique branch codes", len(branch_codes)],
        ["Repeated logical keys kept", len(dup_rows)],
        ["Extra rows inside those keys", dup_extra],
        ["Total seats", seat_sum],
        ["Printed PDF seat total", pdf_total],
        ["Seat sum matches printed total", "Yes" if seat_match else "No"],
        ["Verification status", status],
        ["Notes", " ".join(reasons)],
        [
            "Mixing rule",
            "Do not add Newly Added, Clear, and Virtual seat totals together.",
        ],
    ]
    for row in summary_rows:
        summary.append(row)
    style_header(summary, [46, 88])
    summary["A1"].value = "Item"
    summary["B1"].value = "Value"
    for cell in summary[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT

    count_sheet(
        wb.create_sheet("By State"),
        "State",
        Counter(record.get("state") or "(blank)" for record in records),
        "StateName",
    )
    count_sheet(
        wb.create_sheet("By Category"),
        "Category",
        Counter(record.get("category_raw") or "(blank)" for record in records),
        "Category",
    )
    count_sheet(
        wb.create_sheet("By Institute Type"),
        "Institute type",
        Counter(record.get("institute_type") or "(blank)" for record in records),
        "InstituteType",
    )

    unverified_sheet = wb.create_sheet("Unverified")
    write_table(
        unverified_sheet,
        ["PDFPage", "RowOnPage", "StateName", "Institute", "InstituteCode", "Branch", "Category", "TotalSeats", "Notes"],
        review,
        [12, 12, 28, 70, 16, 50, 14, 12, 42],
    )
    dup_sheet = wb.create_sheet("Repeated Keys Kept")
    write_table(
        dup_sheet,
        ["InstituteCode", "Institute", "Branch", "Quota", "Category", "RowsKept", "SeatValues", "PDFPages", "Decision"],
        dup_rows,
        [16, 70, 50, 24, 14, 12, 18, 24, 62],
    )
    wb.save(OUT / meta["xlsx"])
    return {
        "meta": meta,
        "records": len(records),
        "verified": sum(1 for record in records if record["verified"]),
        "unverified": len(unverified),
        "unverified_rows": review,
        "institutes": len(codes),
        "branches": len(branches),
        "branch_codes": len(branch_codes),
        "missing_code": missing_code,
        "duplicate_groups": len(dup_rows),
        "duplicate_extra_rows": dup_extra,
        "duplicate_rows": dup_rows,
        "seat_sum": seat_sum,
        "pdf_total": pdf_total,
        "seat_match": seat_match,
        "pages": info["page_count"],
        "declared": declared,
        "processed": len(info["pages"]),
        "failed_pages": failed_pages,
        "ocr_pages": ocr_pages,
        "page_audits": info["pages"],
        "status": status,
        "reasons": reasons,
        "note_counts": Counter(note for record in records for note in record.get("notes") or []),
    }


def pdf_grand_total(info: dict) -> int | None:
    totals = []
    for row in info["non_data_rows"]:
        if row.get("kind") != "total":
            continue
        nums = [int(cell) for cell in row.get("cells") or [] if cell.isdigit()]
        if nums:
            totals.append((row["page"], nums[-1]))
    if not totals:
        return None
    return totals[-1][1]


def write_master(extracted: list[tuple[dict, list[dict]]]) -> None:
    wb = Workbook()
    first = True
    for meta, records in extracted:
        ws = wb.active if first else wb.create_sheet(meta["sheet"])
        first = False
        ws.title = meta["sheet"]
        ws.append([name for name, _width in COLUMNS])
        for record in records:
            ws.append(excel_row(record, meta["source_type"]))
        style_header(ws, [width for _name, width in COLUMNS])
        ws.auto_filter.ref = f"A1:N{ws.max_row}"
        ws.freeze_panes = "A2"
    note = wb.create_sheet("Read Me", 0)
    lines = [
        ["MCC NEET PG 2026 Round 2 — 11 November 2026 PDFs"],
        ["These three sheets are separate official lists. Do not add their seat totals together."],
        ["Clear Vacancy seats are the clear-vacancy document. Virtual Vacancy seats are not guaranteed clear seats."],
        ["Newly Added seats are the newly added document. A seat can appear in more than one PDF."],
        ["InstituteCode and BranchCode are blank when the PDF did not print them on that row."],
        ["Repeated keys were kept. See each source workbook and the audit workbook."],
    ]
    for line in lines:
        note.append(line)
    note.column_dimensions["A"].width = 120
    note["A1"].font = TITLE_FONT
    wb.save(OUT / "MCC_R2_Complete_Master_Data_2026.xlsx")


def write_audit(stats: list[dict]) -> None:
    wb = Workbook()
    status = wb.active
    status.title = "Verification Status"
    headers = [
        "Original PDF",
        "Local file",
        "Source type",
        "PDF page count",
        "Printed page total",
        "Processed page count",
        "Extracted records",
        "Verified records",
        "Unique institutes",
        "Unique specialities",
        "Repeated keys kept",
        "Extra rows in repeated keys",
        "Failed page count",
        "OCR-required page count",
        "Unverified record count",
        "Rows missing printed institute code",
        "Total seats",
        "Printed PDF seat total",
        "Seat total matches",
        "Verification status",
        "Notes",
    ]
    status.append(headers)
    for item in stats:
        status.append(
            [
                item["meta"]["official_name"],
                item["meta"]["file"],
                item["meta"]["source_type"],
                item["pages"],
                item["declared"],
                item["processed"],
                item["records"],
                item["verified"],
                item["institutes"],
                item["branches"],
                item["duplicate_groups"],
                item["duplicate_extra_rows"],
                len(item["failed_pages"]),
                len(item["ocr_pages"]),
                item["unverified"],
                item["missing_code"],
                item["seat_sum"],
                item["pdf_total"],
                "Yes" if item["seat_match"] else "No",
                item["status"],
                " ".join(item["reasons"]),
            ]
        )
    style_header(status, [28, 32, 16, 16, 18, 20, 18, 18, 18, 18, 18, 24, 16, 22, 22, 32, 14, 20, 16, 20, 80])

    pages = wb.create_sheet("Page Audit")
    pages.append(
        ["Source type", "PDF page", "Printed page", "Printed total", "Characters", "Tables", "Data rows", "Seat sum", "Status", "Issues"]
    )
    for item in stats:
        for page in item["page_audits"]:
            pages.append(
                [
                    item["meta"]["source_type"],
                    page["page"],
                    page["printed_page"],
                    page["declared_total_pages"],
                    page["chars"],
                    page["tables"],
                    page["data_rows"],
                    page["seat_sum"],
                    page["status"],
                    "; ".join(page["issues"]),
                ]
            )
    style_header(pages, [16, 12, 14, 14, 14, 12, 12, 12, 12, 70])

    failed = wb.create_sheet("Failed Pages")
    failed.append(["Source type", "PDF page", "Status", "Issues"])
    for item in stats:
        for page in item["failed_pages"]:
            failed.append([item["meta"]["source_type"], page["page"], page["status"], "; ".join(page["issues"])])
    style_header(failed, [16, 12, 12, 80])

    ocr = wb.create_sheet("OCR Pages")
    ocr.append(["Source type", "PDF page"])
    for item in stats:
        for page in item["ocr_pages"]:
            ocr.append([item["meta"]["source_type"], page])
    if ocr.max_row == 1:
        ocr.append(["None", "Every opened page had extractable text. OCR was not required."])
    style_header(ocr, [16, 70])

    unverified = wb.create_sheet("Unverified Records")
    unverified.append(
        ["Source type", "PDFPage", "RowOnPage", "StateName", "Institute", "InstituteCode", "Branch", "Category", "TotalSeats", "Notes"]
    )
    for item in stats:
        for row in item["unverified_rows"]:
            unverified.append([item["meta"]["source_type"], *row])
    style_header(unverified, [16, 12, 12, 28, 70, 16, 50, 14, 12, 42])

    duplicates = wb.create_sheet("Repeated Keys Kept")
    duplicates.append(
        ["Source type", "InstituteCode", "Institute", "Branch", "Quota", "Category", "RowsKept", "SeatValues", "PDFPages", "Decision"]
    )
    for item in stats:
        for row in item["duplicate_rows"]:
            duplicates.append([item["meta"]["source_type"], *row])
    style_header(duplicates, [16, 16, 70, 50, 24, 14, 12, 18, 24, 62])

    notes = wb.create_sheet("Parser Notes")
    notes.append(["Source type", "Note", "Rows"])
    for item in stats:
        for note, count in item["note_counts"].most_common():
            notes.append([item["meta"]["source_type"], note, count])
    style_header(notes, [16, 36, 12])
    wb.save(OUT / "MCC_R2_Extraction_Audit_2026.xlsx")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    extracted: list[tuple[dict, list[dict]]] = []
    stats = []
    for meta in SOURCES:
        path = RAW / meta["file"]
        print(f"Extracting {meta['label']} from {path.name}", flush=True)
        records, _raw, info = mcc.extract_pdf_tables(path, meta)
        total = pdf_grand_total(info)
        print(
            f"  records={len(records)} pages={info['page_count']} declared={info['declared_total_pages']} pdf_total={total}",
            flush=True,
        )
        stats.append(build_detail_book(meta, records, info, total))
        extracted.append((meta, records))
    print("Writing master workbook", flush=True)
    write_master(extracted)
    print("Writing audit workbook", flush=True)
    write_audit(stats)
    for item in stats:
        print(
            f"{item['meta']['source_type']}: status={item['status']} records={item['records']} "
            f"seats={item['seat_sum']} pdf_total={item['pdf_total']} unverified={item['unverified']} "
            f"failed_pages={len(item['failed_pages'])}",
            flush=True,
        )
    return 0 if all(item["status"] == "Verified" for item in stats) else 2


if __name__ == "__main__":
    raise SystemExit(main())
