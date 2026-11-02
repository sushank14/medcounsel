"""Check manifest URLs for new/changed PDFs (checksum compare). Run via cron."""
from __future__ import annotations

import json
from pathlib import Path

from downloader import download_all


def main() -> None:
    report = download_all(2025)
    root = Path(__file__).resolve().parents[4] / "data" / "maharashtra" / "2025" / "processed"
    notify_path = root / "portal_check_latest.json"
    notify_path.parent.mkdir(parents=True, exist_ok=True)
    changed = [d for d in report["documents"] if d.get("ok") and not d.get("skipped_duplicate")]
    payload = {
        "summary": report["summary"],
        "new_or_updated_downloads": [c["key"] for c in changed],
        "failed": [d["key"] for d in report["documents"] if not d.get("ok")],
    }
    notify_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
