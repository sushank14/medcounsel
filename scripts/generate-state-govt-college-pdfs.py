#!/usr/bin/env python3
"""Generate ranked top government medical college PDFs for NEET-PG counselling."""

import json
import os
import sqlite3
import subprocess
from dataclasses import dataclass, replace
from datetime import date
from pathlib import Path

from fpdf import FPDF

REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "packages/database/prisma/prod.db"
EM_FOOTNOTE = (
    "* Best AIQ Rank = lowest MCC All India Quota closing rank (General category) for "
    "MD Emergency Medicine, 2024-25 counselling rounds. Lower rank = more competitive seat."
)
EM_FOOTNOTE_ALL = (
    "* Best AIQ Rank = lowest MCC AIQ closing rank (General) for Emergency Medicine-related "
    "PG courses (MD Emergency Medicine and equivalents), 2024-25. Lower rank = better."
)

OUT_DIR = Path.home() / "Downloads"
USER_STORE = Path.home() / "Library/Application Support/Cursor/AgentStores/cursor_agent_stores/t12363857-u382770997/files"

DISCLAIMER = (
    "Rankings combine MCC AIQ closing ranks (2024-25, General category) with widely shared "
    "PG resident/community reputation. Not an official NMC/NIRF ranking. Verify cutoffs, "
    "stipend, bond, and eligibility before counselling."
)


@dataclass
class CollegeRow:
    rank: int
    name: str
    city: str
    best_aiq_rank: str
    tier: str
    note: str


STATES = {
    "Maharashtra": {
        "filename": "Maharashtra-Top-Government-Medical-Colleges.pdf",
        "subtitle": "Maharashtra State & AIQ  |  NEET-PG Government Institutes",
        "rows": [
            CollegeRow(1, "Seth G.S. Medical College (KEM)", "Mumbai", "~24-130", "Tier 1", "Flagship Mumbai govt college; highest clinical load"),
            CollegeRow(2, "Grant Medical College (JJ Hospital)", "Mumbai", "~5-130", "Tier 1", "Central Mumbai; excellent surgery & medicine exposure"),
            CollegeRow(3, "Lokmanya Tilak Municipal Medical College (Sion)", "Mumbai", "~24", "Tier 1", "Legendary trauma & emergency volume"),
            CollegeRow(4, "Topiwala National Medical College (Nair)", "Mumbai", "~27-259", "Tier 1", "Strong broad-specialty training at Nair Hospital"),
            CollegeRow(5, "BJ Medical College (Sassoon)", "Pune", "~28", "Tier 1", "Top Pune govt pick; balanced academics & clinical work"),
            CollegeRow(6, "HBT Medical College & Dr R.N. Cooper Hospital", "Mumbai", "~42", "Tier 2", "Municipal govt hospital; good Mumbai option"),
            CollegeRow(7, "Government Medical College", "Jalgaon", "~22-1161", "Tier 2", "North Maharashtra; competitive for several branches"),
            CollegeRow(8, "Indira Gandhi Government Medical College", "Nagpur", "~61-525", "Tier 2", "Leading Vidarbha govt institute"),
            CollegeRow(9, "Government Medical College", "Nagpur", "~69-242", "Tier 2", "Second Nagpur govt college; solid state-quota choice"),
            CollegeRow(10, "Government Medical College (Chhatrapati Sambhajinagar)", "Aurangabad", "~471", "Tier 2", "Marathwada regional hub"),
            CollegeRow(11, "Government Medical College", "Nanded", "~127", "Tier 2", "Important Marathwada govt seat"),
            CollegeRow(12, "Pandit Deendayal Medical College", "Amravati", "~358", "Tier 3", "Vidarbha; good for state quota"),
            CollegeRow(13, "Bhausaheb Hire Government Medical College", "Dhule", "~274", "Tier 3", "North Maharashtra govt college"),
            CollegeRow(14, "Government Medical College", "Chandrapur", "~189-421", "Tier 3", "Vidarbha district govt college"),
            CollegeRow(15, "Rajiv Gandhi Medical College", "Thane", "~485", "Tier 3", "Mumbai Metropolitan Region"),
            CollegeRow(16, "Government Medical College", "Yavatmal", "~435", "Tier 3", "Vidarbha rural referral centre"),
            CollegeRow(17, "Government Medical College", "Gondia", "~550", "Tier 3", "East Vidarbha govt option"),
            CollegeRow(18, "Government Medical College", "Miraj", "~592", "Tier 3", "Western Maharashtra; surgery exposure"),
            CollegeRow(19, "Seth G.S. Medical College", "Solapur", "~102", "Tier 3", "South Maharashtra govt college"),
            CollegeRow(20, "Government Medical College", "Latur", "~906", "Tier 4", "Marathwada; moderate cutoffs"),
            CollegeRow(21, "Government Medical College", "Akola", "~585-1866", "Tier 4", "Vidarbha district college"),
            CollegeRow(22, "Dr V.M. Government Medical College", "Solapur", "~1012-1630", "Tier 4", "Solapur district govt institute"),
            CollegeRow(23, "Swami Ramanand Teerth Rural GMC", "Ambajogai", "~1393", "Tier 4", "Rural Marathwada govt college"),
            CollegeRow(24, "Shri Vasantrao Naik Government Medical College", "Yavatmal", "~3177-3410", "Tier 4", "Newer Vidarbha govt seat"),
        ],
    },
    "Madhya Pradesh": {
        "filename": "Madhya-Pradesh-Top-Government-Medical-Colleges.pdf",
        "subtitle": "Madhya Pradesh State & AIQ  |  NEET-PG Government Institutes",
        "rows": [
            CollegeRow(1, "Gandhi Medical College", "Bhopal", "~394-1153", "Tier 1", "State capital; top clinical exposure in MP"),
            CollegeRow(2, "MGM Medical College (Mahatma Gandhi Memorial)", "Indore", "~508", "Tier 1", "Largest MP govt PG seat pool; metro city"),
            CollegeRow(3, "Gajra Raja Medical College", "Gwalior", "~570", "Tier 1", "Historic college; strong radiology & surgery"),
            CollegeRow(4, "Netaji Subhash Chandra Bose Medical College", "Jabalpur", "~754-1926", "Tier 1", "Oldest established govt college in MP"),
            CollegeRow(5, "Shyam Shah Medical College", "Rewa", "~943", "Tier 2", "Vindhya region flagship govt institute"),
            CollegeRow(6, "Bundelkhand Medical College", "Sagar", "~2269", "Tier 2", "Bundelkhand region govt college"),
            CollegeRow(7, "Shrimant Rajmata Vijayaraje Scindia GMC", "Gwalior", "N/A", "Tier 2", "ABV/Vidisha region govt medical college"),
            CollegeRow(8, "Government Medical College", "Ratlam", "~2908", "Tier 3", "Malwa region; growing PG intake"),
            CollegeRow(9, "Government Medical College", "Datia", "~3235", "Tier 3", "Bundelkhand border district college"),
            CollegeRow(10, "NSC Government Medical College", "Khandwa", "~5885", "Tier 3", "Nimar region govt institute"),
            CollegeRow(11, "Government Medical College", "Shivpuri", "~10698", "Tier 4", "Northern MP district college"),
            CollegeRow(12, "Government Medical College", "Shahdol", "~62128", "Tier 4", "Eastern MP; lower cutoff branches"),
            CollegeRow(13, "Government Medical College", "Chhindwara", "N/A", "Tier 4", "Mahakoshal region newer govt college"),
            CollegeRow(14, "Government Medical College", "Satna", "N/A", "Tier 4", "Vindhya district govt option"),
        ],
    },
    "Telangana": {
        "filename": "Telangana-Top-Government-Medical-Colleges.pdf",
        "subtitle": "Telangana (KNRUHS) State & AIQ  |  NEET-PG Government Institutes",
        "rows": [
            CollegeRow(1, "Nizam's Institute of Medical Sciences (NIMS)", "Hyderabad", "~76-268", "Tier 1", "Most competitive; best radiodiagnosis & medicine ranks"),
            CollegeRow(2, "Osmania Medical College", "Hyderabad", "~381-395", "Tier 1", "Largest govt PG seat pool in Telangana"),
            CollegeRow(3, "Gandhi Medical College", "Secunderabad", "~394-742", "Tier 1", "Twin-city flagship; strong clinical departments"),
            CollegeRow(4, "Kakatiya Medical College", "Warangal", "~548-1187", "Tier 2", "Top Telangana choice outside Hyderabad"),
            CollegeRow(5, "Rajiv Gandhi Institute of Medical Sciences", "Adilabad", "~2415", "Tier 2", "North Telangana regional govt institute"),
            CollegeRow(6, "Government Medical College", "Nizamabad", "~1471", "Tier 3", "North Telangana district college"),
            CollegeRow(7, "Government Medical College", "Siddipet", "~1508", "Tier 3", "Central Telangana newer govt seat"),
            CollegeRow(8, "Government Medical College", "Suryapet", "N/A", "Tier 3", "Nalgona/Suryapet region govt college"),
            CollegeRow(9, "Government Medical College", "Mahabubnagar", "~4263", "Tier 4", "South Telangana district college"),
            CollegeRow(10, "Government Medical College", "Nalgonda", "~8114", "Tier 4", "District govt medical college"),
            CollegeRow(11, "Government Medical College", "Ramagundam", "N/A", "Tier 4", "Peddapalli/Karimnagar region"),
        ],
    },
}


def em_tier(rank: int) -> str:
    if rank <= 4000:
        return "Tier 1"
    if rank <= 7000:
        return "Tier 2"
    if rank <= 10000:
        return "Tier 3"
    return "Tier 4"


def display_city(city: str, state: str) -> str:
    city = (city or "").strip()
    if not city or len(city) > 45 or city.lower() == state.lower():
        return state
    if "medical college" in city.lower() and len(city) > 25:
        return state
    return city[:45]


def pdf_safe(text: str) -> str:
    """fpdf2 Helvetica is Latin-1 only."""
    return (
        text.replace("\u2026", "...")
        .replace("`", "'")
        .replace("\u2019", "'")
        .encode("latin-1", "replace")
        .decode("latin-1")
    )


def shorten_name(name: str, limit: int = 72) -> str:
    name = " ".join(name.split())
    if len(name) <= limit:
        return name
    return name[: limit - 3] + "..."


GENERIC_GMC_NAMES = frozenset(
    {
        "government medical college",
        "govt medical college",
        "govt. medical college",
    }
)


def with_city_in_name(row: CollegeRow) -> CollegeRow:
    """Disambiguate generic institute names (e.g. Government Medical College, Jalgaon)."""
    name = " ".join(row.name.split())
    city = (row.city or "").strip()
    if not city:
        return row
    root = name.split(",")[0].split("(")[0].strip().lower()
    if root not in GENERIC_GMC_NAMES and "government medical college" not in root:
        return row
    if city.lower() in name.lower():
        return row
    if root in GENERIC_GMC_NAMES:
        labeled = f"Government Medical College, {city}"
    else:
        labeled = f"{name.split(',')[0].strip()}, {city}"
    return replace(row, name=shorten_name(labeled))


def fetch_emergency_pdf_rows(mode: str) -> list[CollegeRow]:
    """Resolved college + city labels via @medcounsel/types (same as the web app)."""
    env = os.environ.copy()
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = f"file:{DB_PATH.resolve()}"

    proc = subprocess.run(
        ["npx", "tsx", "src/export-emergency-pdf-rows.ts", mode],
        cwd=str(REPO_ROOT / "packages/data-ingestion"),
        capture_output=True,
        text=True,
        env=env,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"export-emergency-pdf-rows.ts failed:\n{proc.stderr or proc.stdout}"
        )

    rows: list[CollegeRow] = []
    for i, item in enumerate(json.loads(proc.stdout), start=1):
        city = str(item.get("city") or item.get("state") or "")[:45]
        rows.append(
            CollegeRow(
                i,
                pdf_safe(shorten_name(str(item["name"]))),
                pdf_safe(city),
                str(item["bestAiqRank"]),
                str(item["tier"]),
                pdf_safe(str(item.get("note") or "")),
            )
        )
    return rows


def fetch_emergency_ranked(
    *,
    state_filter: str | None = None,
    limit: int | None = None,
    md_only: bool = True,
) -> list[tuple[str, str, str, str, int]]:
    if not DB_PATH.exists():
        return []

    specialty_sql = (
        "s.slug = 'md-emergency-medicine'"
        if md_only
        else "(s.slug LIKE '%emergency%' OR s.name LIKE '%Emergency%')"
    )
    state_sql = ""
    params: list = []
    if state_filter:
        state_sql = "AND c.state = ?"
        params.append(state_filter)

    limit_sql = f"LIMIT {int(limit)}" if limit else ""

    sql = f"""
        SELECT c.name, c.state, c.city, c.collegeType,
               MIN(co.closingRank) AS best_aiq
        FROM College c
        JOIN Cutoff co ON co.collegeId = c.id
          AND co.year >= 2024 AND co.category = 'GENERAL'
        JOIN Specialty s ON s.id = co.specialtyId AND {specialty_sql}
        JOIN Counselling cou ON cou.id = co.counsellingId AND cou.code = 'AIQ'
        WHERE 1=1 {state_sql}
        GROUP BY c.id
        ORDER BY best_aiq ASC
        {limit_sql}
    """
    conn = sqlite3.connect(str(DB_PATH))
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def rows_from_db_records(records: list[tuple], *, mh_notes: bool = False) -> list[CollegeRow]:
    rows: list[CollegeRow] = []
    for i, (name, state, city, ctype, rank) in enumerate(records, start=1):
        loc = display_city(city, state)
        if mh_notes:
            note = f"{ctype}; Maharashtra AIQ EM seat"
        else:
            note = f"{state}; {ctype} institute"
        rows.append(
            CollegeRow(
                i,
                shorten_name(name),
                loc,
                str(rank),
                em_tier(rank),
                note,
            )
        )
    return rows


def emergency_medicine_guides() -> dict:
    return {
        "India Top 30 EM": {
            "filename": "India-Top-30-Emergency-Medicine-Colleges.pdf",
            "title_line1": "Top 30 MD Emergency Medicine Colleges",
            "title_line2": "India (National)",
            "header_title": "India Top 30 - MD Emergency Medicine",
            "subtitle": "Full top-30 by MCC AIQ rank  |  MD Emergency Medicine",
            "footnote": EM_FOOTNOTE,
            "rows": fetch_emergency_pdf_rows("india30"),
        },
        "Maharashtra EM All": {
            "filename": "Maharashtra-Emergency-Medicine-Colleges.pdf",
            "title_line1": "Maharashtra Emergency Medicine Colleges",
            "title_line2": "All institutes with MCC AIQ EM data",
            "header_title": "Maharashtra - Emergency Medicine Colleges",
            "subtitle": "Ranked by MCC AIQ closing rank  |  MD Emergency Medicine & related",
            "footnote": EM_FOOTNOTE_ALL,
            "rows": fetch_emergency_pdf_rows("maharashtra"),
        },
    }


class CollegePDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 64, 120)
        self.cell(0, 8, self.title_text, ln=True, align="C")
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"MedCounsel  |  Page {self.page_no()}", align="C")


def build_pdf(state: str, meta: dict, out_path: Path) -> None:
    pdf = CollegePDF(orientation="L", unit="mm", format="A4")
    title_line1 = meta.get("title_line1", "Top Government Medical Colleges")
    title_line2 = meta.get("title_line2", state)
    pdf.title_text = meta.get("header_title", f"Top Government Medical Colleges - {state}")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, title_line1, ln=True, align="C")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(30, 64, 120)
    pdf.cell(0, 10, title_line2, ln=True, align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, meta["subtitle"], ln=True, align="C")
    pdf.cell(0, 7, f"Ranked list for NEET-PG  |  Generated {date.today():%d %b %Y}", ln=True, align="C")
    pdf.ln(4)

    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(0, 5, DISCLAIMER)
    pdf.ln(3)

    col_w = [12, 78, 38, 32, 18, 96]
    headers = ["Rank", "College Name", "City", "Best AIQ Rank*", "Tier", "Highlights"]

    def table_header():
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(30, 64, 120)
        pdf.set_text_color(255, 255, 255)
        for w, h in zip(col_w, headers):
            pdf.cell(w, 8, h, border=1, fill=True)
        pdf.ln()
        pdf.set_text_color(0, 0, 0)

    table_header()
    pdf.set_font("Helvetica", "", 8.5)

    fill = False
    for row in meta["rows"]:
        if pdf.get_y() > 185:
            pdf.add_page()
            table_header()
            pdf.set_font("Helvetica", "", 8.5)

        if fill:
            pdf.set_fill_color(245, 247, 250)
        else:
            pdf.set_fill_color(255, 255, 255)

        h = 7
        x0, y0 = pdf.get_x(), pdf.get_y()
        pdf.cell(col_w[0], h, str(row.rank), border=1, fill=True, align="C")

        x = pdf.get_x()
        pdf.multi_cell(col_w[1], h, pdf_safe(row.name), border="LR")
        y1 = pdf.get_y()
        pdf.set_xy(x + col_w[1], y0)
        pdf.cell(col_w[2], h, pdf_safe(row.city), border="LR", fill=True)
        pdf.cell(col_w[3], h, row.best_aiq_rank, border="LR", fill=True, align="C")
        pdf.cell(col_w[4], h, row.tier, border="LR", fill=True, align="C")

        x_note = pdf.get_x()
        pdf.multi_cell(col_w[5], h, pdf_safe(row.note), border="LR")
        y2 = pdf.get_y()
        row_h = max(y1, y2) - y0
        pdf.line(x0, y0, x0 + sum(col_w), y0)
        pdf.line(x0, y0 + row_h, x0 + sum(col_w), y0 + row_h)
        pdf.set_xy(x0, y0 + row_h)
        fill = not fill

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    footnote = meta.get(
        "footnote",
        "* Best AIQ Rank = lowest (best) MCC All India Quota closing rank in General category "
        "across MD/MS branches, 2024-25 counselling rounds. Lower rank = more competitive college.",
    )
    pdf.multi_cell(0, 4, footnote)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out_path))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    USER_STORE.mkdir(parents=True, exist_ok=True)

    generated = []
    all_guides = {**STATES, **emergency_medicine_guides()}

    for state, meta in all_guides.items():
        if not meta.get("rows"):
            print(f"⚠ Skipped {state} (no rows)")
            continue
        meta = {
            **meta,
            "rows": [with_city_in_name(r) for r in meta["rows"]],
        }
        out = OUT_DIR / meta["filename"]
        build_pdf(state, meta, out)
        store_copy = USER_STORE / meta["filename"]
        build_pdf(state, meta, store_copy)
        generated.append(out)
        print(f"✓ {out} ({len(meta['rows'])} colleges)")

    bundle_folder = OUT_DIR / "Top-Govt-Medical-Colleges"
    bundle_folder.mkdir(parents=True, exist_ok=True)
    for meta in all_guides.values():
        src = OUT_DIR / meta["filename"]
        if src.exists():
            (bundle_folder / meta["filename"]).write_bytes(src.read_bytes())

    print(f"\nGenerated {len(generated)} PDFs in {OUT_DIR}")


if __name__ == "__main__":
    main()
