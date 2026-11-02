#!/usr/bin/env python3
"""Download, extract, validate, and compare Maharashtra NEET-PG 2025 documents."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from compare_matrices import compare_matrix_versions
from downloader import download_all
from extract_merit import extract_merit_pdf
from extract_registered import extract_registered_pdf
from build_candidate_history import build_history
from compare_round_matrices import build_round_comparison
from extract_seat_matrix import extract_seat_matrix_pdf
from extract_seat_matrix_r1 import extract_r1_seat_matrix_pdf
from manifest import MAHarashtra_2025_DOCUMENTS, MahDocumentSpec, data_root, repo_root
from validate import validate_registered_rows, validate_seat_rows

LEGACY_IMPORT = Path(repo_root()) / "data" / "imports" / "maharashtra"
LEGACY_MAP: dict[str, str] = {
    "merit_r1": "2025-r1-merit-list.pdf",
    "merit_cap3": "2025-r3-merit-list.pdf",
    "registered_cap3": "2025-reg-cap3.pdf",
    "seat_matrix_r3": "2025-r3-seat-matrix.pdf",
    "allotment_r1": "2025-r1-sellist.pdf",
    "allotment_r2": "2025-r2-sellist.pdf",
    "allotment_r3": "2025-r3-sellist.pdf",
}


def resolve_pdf(spec: MahDocumentSpec, year: int) -> Path | None:
    dest = Path(data_root(year)) / spec.subdir / spec.filename
    if dest.exists() and dest.stat().st_size > 5000:
        return dest
    legacy_name = LEGACY_MAP.get(spec.key)
    if legacy_name:
        legacy = LEGACY_IMPORT / legacy_name
        if legacy.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(legacy, dest)
            return dest
    return None


def run_node_export(script_name: str, args: list[str]) -> subprocess.CompletedProcess[str]:
    script = Path(repo_root()) / "packages" / "data-ingestion" / "src" / script_name
    cmd = ["npx", "tsx", str(script), *args]
    env = {**dict(__import__("os").environ), "TSX_DISABLE_IPC": "1"}
    return subprocess.run(
        cmd,
        cwd=Path(repo_root()) / "packages" / "data-ingestion",
        capture_output=True,
        text=True,
        env=env,
    )


def extract_document(spec: MahDocumentSpec, pdf_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if spec.kind == "registered_list":
        out_file = pdf_path.with_suffix(".registered.json")
        proc = run_node_export("export-mah-registered-json.ts", [str(pdf_path), str(out_file)])
        if proc.returncode == 0 and out_file.exists():
            payload = json.loads(out_file.read_text(encoding="utf-8"))
            rows = payload.get("rows", [])
            index = payload.get("index")
            if index:
                write_json(Path(data_root(2025)) / "processed" / "2025-reg-cap3-air-sml-index.json", index)
        else:
            rows = extract_registered_pdf(str(pdf_path))
        audit = validate_registered_rows(rows)
    elif spec.kind == "merit_list":
        rows = extract_merit_pdf(str(pdf_path))
        audit = {
            "rows": len(rows),
            "verified_rows": len(rows),
            "needs_review": 0,
            "error_count": 0,
            "errors": [],
        }
    elif spec.kind == "seat_matrix":
        if spec.key.startswith("seat_matrix_r1"):
            rows = extract_r1_seat_matrix_pdf(str(pdf_path))
        else:
            rows = extract_seat_matrix_pdf(str(pdf_path))
        audit = validate_seat_rows(rows)
        if not rows:
            import pymupdf

            pages = pymupdf.open(str(pdf_path)).page_count
            audit["needs_review"] = pages
            audit["errors"] = ["Seat matrix parser returned 0 rows."]
            audit["error_count"] = 1 if pages > 0 else 0
    elif spec.kind == "allotment":
        rows, audit = extract_allotment_via_node(pdf_path, spec)
    else:
        rows, audit = [], {"rows": 0, "verified_rows": 0, "needs_review": 0, "error_count": 0, "errors": []}
    audit["document_key"] = spec.key
    audit["processed_at"] = datetime.now(timezone.utc).isoformat()
    return rows, audit


def extract_allotment_via_node(pdf_path: Path, spec: MahDocumentSpec) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    script = Path(repo_root()) / "packages" / "data-ingestion" / "src" / "export-mah-allotment-json.ts"
    if not script.exists():
        return [], {
            "rows": 0,
            "verified_rows": 0,
            "needs_review": 1,
            "error_count": 1,
            "errors": ["export-mah-allotment-json.ts missing"],
        }
    out_file = pdf_path.with_suffix(".allotment.json")
    proc = run_node_export("export-mah-allotment-json.ts", [str(pdf_path), str(out_file), spec.round])
    if proc.returncode != 0 or not out_file.exists():
        return [], {
            "rows": 0,
            "verified_rows": 0,
            "needs_review": 1,
            "error_count": 1,
            "errors": [proc.stderr[-500:] if proc.stderr else "allotment export failed"],
        }
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    rows = payload.get("selections", [])
    return rows, {
        "rows": len(rows),
        "verified_rows": len(rows),
        "needs_review": 0,
        "error_count": 0,
        "errors": payload.get("warnings", [])[:20],
    }


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def run(year: int = 2025, skip_download: bool = False) -> dict[str, Any]:
    if not skip_download:
        download_all(year)

    processed = Path(data_root(year)) / "processed"
    audits: list[dict[str, Any]] = []
    matrix_by_key: dict[str, list[dict[str, Any]]] = {}

    for spec in MAHarashtra_2025_DOCUMENTS:
        pdf = resolve_pdf(spec, year)
        if not pdf:
            audits.append(
                {
                    "document_key": spec.key,
                    "extraction_status": "missing_pdf",
                    "rows_extracted": 0,
                    "rows_verified": 0,
                    "rows_rejected": 0,
                    "error_details": f"PDF not available for {spec.key}",
                }
            )
            continue

        rows, audit = extract_document(spec, pdf)
        audits.append(
            {
                "document_key": spec.key,
                "extraction_status": "ok" if audit.get("error_count", 0) == 0 else "needs_review",
                "rows_extracted": len(rows),
                "rows_verified": audit.get("verified_rows", 0),
                "rows_rejected": audit.get("error_count", 0),
                "error_details": audit.get("errors"),
                **audit,
            }
        )
        out_name = f"{spec.key}.json"
        write_json(processed / out_name, {"meta": {"key": spec.key, "url": spec.url, "path": str(pdf)}, "rows": rows})
        if spec.kind == "seat_matrix":
            matrix_by_key[spec.key] = rows

    comparisons: dict[str, Any] = {}
    if "seat_matrix_r2_original" in matrix_by_key and "seat_matrix_r2_updated" in matrix_by_key:
        comparisons["r2_original_vs_updated"] = compare_matrix_versions(
            matrix_by_key["seat_matrix_r2_original"],
            matrix_by_key["seat_matrix_r2_updated"],
            "R2_original",
            "R2_updated",
        )
        write_json(processed / "matrix_compare_r2_original_vs_updated.json", comparisons["r2_original_vs_updated"])

    matrix_compare_rounds: dict[str, list[dict[str, Any]]] = {}
    label_map = {
        "seat_matrix_r1_govt": "R1_govt",
        "seat_matrix_r2_updated": "R2_updated",
        "seat_matrix_r3": "R3",
    }
    round_mats = {label_map[k]: matrix_by_key[k] for k in label_map if k in matrix_by_key and matrix_by_key[k]}
    if len(round_mats) >= 2:
        matrix_compare_rounds = build_round_comparison(round_mats)
        write_json(processed / "matrix_compare_rounds.json", matrix_compare_rounds)

    history = build_history(processed)
    write_json(processed / "candidate_allotment_history.json", history)

    closing: list[dict[str, Any]] = []
    for spec in MAHarashtra_2025_DOCUMENTS:
        if spec.kind != "allotment":
            continue
        pdf = resolve_pdf(spec, year)
        if not pdf:
            continue
        sidecar = pdf.with_suffix(".allotment.json")
        if not sidecar.exists():
            continue
        data = json.loads(sidecar.read_text(encoding="utf-8"))
        for c in data.get("cutoffs", []):
            closing.append({**c, "round": spec.round})
    if closing:
        write_json(processed / "closing_ranks_sml_2025.json", closing)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "year": year,
        "audits": audits,
        "comparisons": {k: {kk: vv for kk, vv in v.items() if kk != "changes"} | {"changes_count": v.get("changes_count")} for k, v in comparisons.items()},
        "candidate_history_count": history.get("candidate_count"),
        "matrix_round_rows_compared": len(matrix_compare_rounds),
    }
    write_json(processed / "validation_report.json", report)
    write_json(processed / "source_urls.json", [{"key": s.key, "url": s.url, "kind": s.kind, "round": s.round, "version": s.version} for s in MAHarashtra_2025_DOCUMENTS])
    return report


if __name__ == "__main__":
    skip = "--skip-download" in sys.argv
    summary = run(skip_download=skip)
    print(json.dumps(summary, indent=2))
