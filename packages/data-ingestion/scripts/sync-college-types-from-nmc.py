#!/usr/bin/env python3
"""
Authoritative collegeType sync from NMC 2026-27 seat matrix.
Priority: 1) nmcId/collegeCode match  2) exact full name match  3) GOVT-only name rules
"""
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JSON_PATH = ROOT / "data/processed/nmc/2026-27-seat-matrix.json"
DB_PATH = ROOT / "packages/database/prisma/prod.db"

DEEMED_PAT = re.compile(
    r"d\.?\s*y\.?\s*patil|dy\s*patil|padmashree|bharati\s+vidyapeeth|symbiosis|amrita|"
    r"aarupadai\s+veedu|kasturba\s+medical|manipal\s+(medical|academy|college)|sikkim[- ]manipal|"
    r"sri\s+siddhartha|sathya\s+sai|gitam|acs\s+medical|krishna\s+institute|chettinad|"
    r"saveetha|srm\s+medical|sri\s+ramachandra|mahatma\s+gandhi\s+medical\s+college|"
    r"shri\s+sathya|deemed\s+university",
    re.I,
)

PRIVATE_PAT = re.compile(
    r"\bprivate\b|\bpvt\.?\b|\bltd\.?\b|multispeciality|multispecialty|"
    r"fortis|apollo|medanta|narayana|unit of|charitable trust|\bdnb\b|"
    r"netralaya|eye care|medicity|manipal\s+hospital",
    re.I,
)

GOVT_PAT = re.compile(
    r"government|govt\.?|\bgmc\b|municipal|gmers|esic medical|district hospital|"
    r"railway hospital|college of medicine",
    re.I,
)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().upper())


def main():
    payload = json.loads(JSON_PATH.read_text())
    by_code: dict[str, str] = {}
    by_exact_name: dict[str, str] = {}
    for row in payload["rows"]:
        cat = row["category"]
        by_code[row["collegeCode"]] = cat
        by_exact_name[norm(row["collegeName"])] = cat

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, slug, name, collegeType, nmcId FROM College "
        "WHERE dataStatus='OFFICIAL' AND slug NOT LIKE 'demo-%'"
    ).fetchall()

    changes = []

    # Pass 1: authoritative NMC college code on nmcId
    for c in rows:
        nmc_id = c["nmcId"]
        if not nmc_id or nmc_id not in by_code:
            continue
        target = by_code[nmc_id]
        if target != c["collegeType"]:
            conn.execute("UPDATE College SET collegeType = ? WHERE id = ?", (target, c["id"]))
            changes.append((c["collegeType"], target, "nmc_code", c["name"][:70]))

    # Pass 2: exact full name match (no partial/generic matching)
    for c in rows:
        key = norm(c["name"])
        if key not in by_exact_name:
            continue
        target = by_exact_name[key]
        cur = conn.execute("SELECT collegeType FROM College WHERE id = ?", (c["id"],)).fetchone()
        if cur and cur["collegeType"] != target:
            conn.execute("UPDATE College SET collegeType = ? WHERE id = ?", (target, c["id"]))
            changes.append((cur["collegeType"], target, "nmc_exact_name", c["name"][:70]))

    # Pass 3: GOVT/CENTRAL mis-tags by name rules (no NMC code on record)
    for c in rows:
        cur = conn.execute(
            "SELECT collegeType, nmcId, name FROM College WHERE id = ?", (c["id"],)
        ).fetchone()
        if not cur or cur["collegeType"] not in ("GOVT", "CENTRAL"):
            continue
        if cur["nmcId"] and cur["nmcId"] in by_code:
            continue
        name = cur["name"]
        target = None
        if DEEMED_PAT.search(name):
            target = "DEEMED"
        elif PRIVATE_PAT.search(name) and not GOVT_PAT.search(name):
            target = "PRIVATE"
        if target and target != cur["collegeType"]:
            conn.execute("UPDATE College SET collegeType = ? WHERE id = ?", (target, c["id"]))
            changes.append((cur["collegeType"], target, "name_rules", name[:70]))

    # Pass 4: Manipal Hospital DNB sites must stay PRIVATE
    conn.execute(
        "UPDATE College SET collegeType = 'PRIVATE' WHERE LOWER(name) LIKE '%manipal hospital%'"
    )

    conn.commit()

    suspicious = conn.execute(
        "SELECT name, collegeType FROM College WHERE collegeType IN ('GOVT','CENTRAL') AND ("
        "LOWER(name) LIKE '%private%' OR LOWER(name) LIKE '%pvt%' OR "
        "LOWER(name) LIKE '%deemed%' OR LOWER(name) LIKE '%bharati vidyapeeth%' OR "
        "LOWER(name) LIKE '%symbiosis%' OR LOWER(name) LIKE '%d y patil%' OR "
        "LOWER(name) LIKE '%manipal hospital%'"
        ")"
    ).fetchall()

    print(f"Applied {len(changes)} classification updates")
    for ch in changes[:30]:
        print(f"  {ch[0]} -> {ch[1]} [{ch[2]}]: {ch[3]}")
    if len(changes) > 30:
        print(f"  ... and {len(changes) - 30} more")

    print(f"\nSuspicious GOVT/CENTRAL remaining: {len(suspicious)}")
    for r in suspicious[:10]:
        print(f"  · {r['name'][:75]}")

    print("\nCounts:")
    for r in conn.execute(
        "SELECT collegeType, COUNT(*) n FROM College WHERE dataStatus='OFFICIAL' "
        "AND slug NOT LIKE 'demo-%' GROUP BY collegeType ORDER BY n DESC"
    ):
        print(f"  {r['collegeType']}: {r['n']}")

    conn.close()


if __name__ == "__main__":
    main()
