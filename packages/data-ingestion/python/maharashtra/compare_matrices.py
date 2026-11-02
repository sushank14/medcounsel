"""Compare Maharashtra seat matrix versions (R2 original vs updated, etc.)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any


def _key(row: dict[str, Any]) -> tuple:
    return (
        row.get("college_code"),
        row.get("branch_code"),
        row.get("category"),
        row.get("seat_type"),
        row.get("quota", "STATE"),
    )


def compare_matrix_versions(
    left: list[dict[str, Any]],
    right: list[dict[str, Any]],
    left_label: str,
    right_label: str,
) -> dict[str, Any]:
    lmap = {_key(r): r for r in left}
    rmap = {_key(r): r for r in right}
    keys = set(lmap) | set(rmap)
    changes: list[dict[str, Any]] = []

    for k in sorted(keys):
        l = lmap.get(k)
        r = rmap.get(k)
        lseats = l.get("seat_count", 0) if l else 0
        rseats = r.get("seat_count", 0) if r else 0
        if lseats == rseats and l and r:
            change_type = "unchanged"
        elif l and not r:
            change_type = "removed"
        elif r and not l:
            change_type = "newly_added"
        elif rseats > lseats:
            change_type = "seat_added"
        elif rseats < lseats:
            change_type = "seat_removed"
        else:
            change_type = "unknown_change"

        if change_type != "unchanged":
            sample = r or l
            changes.append(
                {
                    "college_code": k[0],
                    "branch_code": k[1],
                    "category": k[2],
                    "seat_type": k[3],
                    "quota": k[4],
                    "college_name": sample.get("college_name_norm"),
                    "branch_name": sample.get("branch_name_norm"),
                    left_label: lseats,
                    right_label: rseats,
                    "net_change": rseats - lseats,
                    "change_type": change_type,
                }
            )

    by_college: dict[str, int] = defaultdict(int)
    for c in changes:
        by_college[c["college_code"] or "unknown"] += abs(c["net_change"])

    return {
        "left_label": left_label,
        "right_label": right_label,
        "left_rows": len(left),
        "right_rows": len(right),
        "changes_count": len(changes),
        "changes": changes,
        "college_net_seat_delta": dict(by_college),
    }
