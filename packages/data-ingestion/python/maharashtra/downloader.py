"""Download official Maharashtra PDFs with checksums and validation."""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from manifest import MAHarashtra_2025_DOCUMENTS, MahDocumentSpec, data_root


@dataclass
class DownloadResult:
    key: str
    ok: bool
    path: str | None
    status_code: int | None
    checksum_sha256: str | None
    file_size_bytes: int
    error: str | None
    skipped_duplicate: bool


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_pdf(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            return f.read(5) == b"%PDF-"
    except OSError:
        return False


def download_one(spec: MahDocumentSpec, dest: Path, retries: int = 3) -> DownloadResult:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 10_000 and _is_pdf(dest):
        return DownloadResult(
            key=spec.key,
            ok=True,
            path=str(dest),
            status_code=200,
            checksum_sha256=_sha256(dest),
            file_size_bytes=dest.stat().st_size,
            error=None,
            skipped_duplicate=True,
        )

    last_err: str | None = None
    status: int | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                spec.url,
                headers={"User-Agent": "MedCounsel-DataBot/1.0 (+https://medcounsel.onrender.com)"},
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                status = resp.getcode()
                data = resp.read()
            if status != 200:
                last_err = f"HTTP {status}"
                time.sleep(1 + attempt)
                continue
            dest.write_bytes(data)
            if not _is_pdf(dest):
                dest.unlink(missing_ok=True)
                last_err = "Not a PDF (missing %PDF- header)"
                continue
            if dest.stat().st_size < 5000:
                last_err = f"File too small ({dest.stat().st_size} bytes)"
                dest.unlink(missing_ok=True)
                continue
            return DownloadResult(
                key=spec.key,
                ok=True,
                path=str(dest),
                status_code=status,
                checksum_sha256=_sha256(dest),
                file_size_bytes=dest.stat().st_size,
                error=None,
                skipped_duplicate=False,
            )
        except urllib.error.HTTPError as e:
            status = e.code
            last_err = f"HTTP {e.code}: {e.reason}"
            time.sleep(1 + attempt)
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
            time.sleep(1 + attempt)

    return DownloadResult(
        key=spec.key,
        ok=False,
        path=None,
        status_code=status,
        checksum_sha256=None,
        file_size_bytes=0,
        error=last_err,
        skipped_duplicate=False,
    )


def download_all(year: int = 2025) -> dict[str, Any]:
    root = Path(data_root(year))
    results: list[DownloadResult] = []
    checksum_index: dict[str, str] = {}

    for spec in MAHarashtra_2025_DOCUMENTS:
        dest = root / spec.subdir / spec.filename
        res = download_one(spec, dest)
        results.append(res)
        if res.ok and res.checksum_sha256:
            if res.checksum_sha256 in checksum_index.values():
                pass  # same file at different keys is ok
            checksum_index[spec.key] = res.checksum_sha256

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "year": year,
        "documents": [
            {
                **asdict(r),
                "spec": {
                    "url": next(s.url for s in MAHarashtra_2025_DOCUMENTS if s.key == r.key),
                    "kind": next(s.kind for s in MAHarashtra_2025_DOCUMENTS if s.key == r.key),
                    "round": next(s.round for s in MAHarashtra_2025_DOCUMENTS if s.key == r.key),
                    "version": next(s.version for s in MAHarashtra_2025_DOCUMENTS if s.key == r.key),
                },
            }
            for r in results
        ],
        "summary": {
            "total": len(results),
            "ok": sum(1 for r in results if r.ok),
            "failed": sum(1 for r in results if not r.ok),
        },
    }
    report_path = root / "processed" / "download_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
