"""Merge round-wise allotment JSON into candidate history keyed by NEET roll / SML."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _load_selections(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("rows") or data.get("selections") or []


def build_history(processed_dir: Path) -> dict[str, Any]:
    rounds = {
        "R1": processed_dir / "allotment_r1.json",
        "R2": processed_dir / "allotment_r2.json",
        "R3": processed_dir / "allotment_r3.json",
    }
    by_roll: dict[str, dict[str, Any]] = {}

    for rnd, path in rounds.items():
        for sel in _load_selections(path):
            sml = sel.get("smlRank") or sel.get("sml_rank")
            roll = sel.get("neetRoll") or sel.get("neet_roll")
            key = str(roll or sml or "")
            if not key:
                continue
            rec = by_roll.setdefault(
                key,
                {
                    "neet_roll": roll,
                    "sml_rank": sml,
                    "category": sel.get("candidateCategory") or sel.get("category"),
                    "rounds": {},
                },
            )
            rec["rounds"][rnd] = {
                "college": sel.get("collegeRaw") or sel.get("college"),
                "branch": sel.get("subject") or sel.get("branch_name"),
                "seat_category": sel.get("seatCategory") or sel.get("seat_category"),
                "quota": sel.get("quota"),
            }

    for rec in by_roll.values():
        r = rec["rounds"]
        status = "unknown"
        if "R1" in r and "R2" not in r and "R3" not in r:
            status = "r1_only"
        elif "R3" in r:
            status = "allotted_r3"
        elif "R2" in r:
            status = "allotted_r2"
        if "R1" in r and "R2" in r:
            if r["R1"].get("college") == r["R2"].get("college") and r["R1"].get("branch") == r["R2"].get("branch"):
                status = "retained_r2"
            else:
                status = "changed_r2"
        rec["movement_status"] = status

    from datetime import datetime, timezone

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "candidate_count": len(by_roll),
        "candidates": by_roll,
    }


if __name__ == "__main__":
    from manifest import data_root

    out_dir = Path(data_root(2025)) / "processed"
    payload = build_history(out_dir)
    out_path = out_dir / "candidate_allotment_history.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {payload['candidate_count']} candidates to {out_path}")
