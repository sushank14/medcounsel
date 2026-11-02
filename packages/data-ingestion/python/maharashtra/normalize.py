"""College and branch normalization for Maharashtra CET documents."""
from __future__ import annotations

import re

BRANCH_ALIASES: dict[str, str] = {
    "OBGY": "Obstetrics & Gynecology",
    "OBG": "Obstetrics & Gynecology",
    "OBSTET": "Obstetrics & Gynecology",
    "MEDICINE": "General Medicine",
    "GENERAL MEDICINE": "General Medicine",
    "SURGERY": "General Surgery",
    "GENERAL SURGERY": "General Surgery",
    "ORTHO": "Orthopedics",
    "ORTHOPAEDICS": "Orthopedics",
    "ANAESTH": "Anaesthesiology",
    "ANESTH": "Anaesthesiology",
    "RADIOLOGY": "Radiodiagnosis",
    "RADIO DIAG": "Radiodiagnosis",
    "SKIN & VD": "Dermatology",
    "DERM": "Dermatology",
    "ENT": "ENT",
    "E.N.T.": "ENT",
    "PAED": "Pediatrics",
    "PEDIAT": "Pediatrics",
}


def normalize_branch(raw: str) -> tuple[str, str]:
    s = re.sub(r"\s+", " ", raw.strip().upper())
    s = re.sub(r"^\d{4}S\s*:\s*", "", s)
    for key, name in BRANCH_ALIASES.items():
        if key in s or s.startswith(key):
            degree = "MS" if any(x in s for x in ("SURGERY", "ORTHO", "OBG", "ENT")) else "MD"
            if "SURGERY" in s and "GENERAL" not in s and "OBG" not in s:
                degree = "MS"
            return name, degree
    title = raw.strip().title()
    degree = "MS" if re.search(r"surgery|ortho|obg|ent", raw, re.I) else "MD"
    return title, degree


def normalize_college(raw: str, code: str | None = None) -> str:
    s = re.sub(r"\s+", " ", raw.strip())
    s = re.sub(r"^COLLEGE:\s*", "", s, flags=re.I)
    if code:
        s = re.sub(rf"^{re.escape(code)}\s+", "", s, flags=re.I)
    return s.strip()
