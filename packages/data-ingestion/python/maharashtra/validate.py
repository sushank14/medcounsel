"""Validation helpers for extracted Maharashtra datasets."""
from __future__ import annotations

from typing import Any


def _get(r: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in r and r[k] is not None:
            return r[k]
    return None


def validate_registered_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    errors: list[str] = []
    seen_roll: set[str] = set()
    dup = 0
    for i, r in enumerate(rows):
        air = _get(r, "air")
        sml = _get(r, "sml_rank", "smlRank")
        if not isinstance(air, int) or air < 1:
            errors.append(f"row {i}: invalid AIR")
        if not isinstance(sml, int) or sml < 1:
            errors.append(f"row {i}: invalid SML")
        roll = _get(r, "neet_roll", "neetRoll")
        if roll in seen_roll:
            dup += 1
        if roll:
            seen_roll.add(str(roll))
    return {
        "rows": len(rows),
        "duplicate_rolls": dup,
        "errors": errors[:50],
        "error_count": len(errors),
        "verified_rows": len(rows) - len(errors),
        "needs_review": len(errors) + dup,
    }


def validate_seat_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    errors: list[str] = []
    for i, r in enumerate(rows):
        if r.get("seat_count", 0) < 0:
            errors.append(f"row {i}: negative seats")
        if not r.get("college_code") and not r.get("college_name_norm") and not r.get("college_name_raw"):
            errors.append(f"row {i}: missing college identifier")
    return {
        "rows": len(rows),
        "errors": errors[:50],
        "error_count": len(errors),
        "verified_rows": len(rows) - len(errors),
        "needs_review": len(errors),
    }
