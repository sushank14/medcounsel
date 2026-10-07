#!/usr/bin/env python3
"""Backfill nmcId from NMC 2026 JSON using exact name match."""
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JSON_PATH = ROOT / "data/processed/nmc/2026-27-seat-matrix.json"
DB_PATH = ROOT / "packages/database/prisma/prod.db"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().upper())


def main():
    payload = json.loads(JSON_PATH.read_text())
    by_name: dict[str, str] = {}
    by_cat: dict[str, str] = {}
    for row in payload["rows"]:
        by_name[norm(row["collegeName"])] = row["collegeCode"]
        by_cat[norm(row["collegeName"])] = row["category"]

    conn = sqlite3.connect(str(DB_PATH))
    updated = 0
    typed = 0
    for row in conn.execute(
        "SELECT id, name, nmcId, collegeType FROM College WHERE dataStatus='OFFICIAL'"
    ):
        key = norm(row[1])
        if key not in by_name:
            continue
        code, cat = by_name[key], by_cat[key]
        nmc_id = row[2]
        if not nmc_id or not nmc_id.startswith(tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")) or "/" not in (nmc_id or ""):
            conn.execute("UPDATE College SET nmcId = ? WHERE id = ?", (code, row[0]))
            updated += 1
        if row[3] != cat:
            conn.execute("UPDATE College SET collegeType = ? WHERE id = ?", (cat, row[0]))
            typed += 1
    conn.commit()
    print(f"Backfilled {updated} nmcIds, synced {typed} types from exact NMC names")
    conn.close()


if __name__ == "__main__":
    main()
