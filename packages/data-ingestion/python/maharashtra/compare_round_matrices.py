"""Summarize seat totals by college+branch across R1/R2/R3 matrices."""
from __future__ import annotations

from collections import defaultdict
from typing import Any


def _totals(rows: list[dict[str, Any]]) -> dict[tuple, int]:
    agg: dict[tuple, int] = defaultdict(int)
    for r in rows:
        key = (
            r.get("college_code") or r.get("college_name_norm") or r.get("college_name_raw"),
            r.get("branch_code") or r.get("branch_name_norm") or r.get("branch_name_raw"),
        )
        agg[key] += int(r.get("seat_count") or 0)
    return dict(agg)


def build_round_comparison(matrix_by_label: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    labels = list(matrix_by_label.keys())
    maps = {lb: _totals(matrix_by_label[lb]) for lb in labels}
    keys = set().union(*maps.values()) if maps else set()
    out: list[dict[str, Any]] = []
    for key in sorted(keys):
        row: dict[str, Any] = {"college": key[0], "branch": key[1]}
        prev = None
        for lb in labels:
            val = maps[lb].get(key, 0)
            row[lb] = val
            if prev is not None and val != prev:
                row[f"{lb}_delta"] = val - prev
            prev = val
        out.append(row)
    return out
