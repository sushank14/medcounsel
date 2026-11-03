"""Map MAHACET seat-matrix institute headers to MedCounsel college names."""
from __future__ import annotations

import re

# Longer / more specific patterns first
_COLLEGE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"GRANT\s+GOVERNMENT", re.I), "Grant Medical College, Mumbai"),
    (re.compile(r"SETH\s+G\.?\s*S\.?", re.I), "Seth GS Medical College (KEM), Mumbai"),
    (re.compile(r"LOKMANYA\s+TILAK", re.I), "Lokmanya Tilak Municipal Medical College, Mumbai"),
    (re.compile(r"T\.?\s*N\.?\s*MUNICIPAL", re.I), "Topiwala National Medical College, Mumbai"),
    (re.compile(r"B\.?\s*J\.?\s*MEDICAL", re.I), "BJ Medical College, Pune"),
    (re.compile(r"V\.?\s*M\.?\s*GOVERNMENT", re.I), "Government Medical College, Solapur"),
    (re.compile(r"MIRAJ", re.I), "Government Medical College, Miraj"),
    (re.compile(r"GOVT\.?\s*MEDICAL\s+COLLEGE,\s*NAGPUR", re.I), "Government Medical College, Nagpur"),
    (re.compile(r"INDIRA\s+GANDHI", re.I), "Indira Gandhi Government Medical College, Nagpur"),
    (re.compile(r"V\.?\s*N\.?\s*GOVERNMENT", re.I), "Government Medical College, Yavatmal"),
    (re.compile(r"GOVERNMENT\s+MEDICAL\s+COLLEGE,\s*AKOLA", re.I), "Government Medical College, Akola"),
    (re.compile(r"AURANGABAD|SAMBHAJI", re.I), "Government Medical College, Sambhajinagar"),
    (re.compile(r"GOVERNMENT\s+MEDICAL\s+COLLEGE,\s*NANDED", re.I), "Government Medical College, Nanded"),
    (re.compile(r"SRTR", re.I), "SRTR Medical College, Ambajogai"),
    (re.compile(r"VILASRAO|LATUR", re.I), "Government Medical College, Latur"),
    (re.compile(r"HBT|COOPER", re.I), "HBT Medical College & Cooper Hospital, Mumbai"),
    (re.compile(r"BHAUSAHEB\s+HIRE|HIRE\s+GOVERNMENT", re.I), "Bhausaheb Hire Government Medical College, Dhule"),
    (re.compile(r"MAHATMA\s+GANDHI\s+INSTITUTE", re.I), "Mahatma Gandhi Institute of Medical Sciences, Wardha"),
    (re.compile(r"TATA\s+MEMORIAL", re.I), "Tata Memorial Hospital, Mumbai"),
    (re.compile(r"PHYSICAL\s+MEDICINE", re.I), "All India Institute of Physical Medicine & Rehabilitation, Mumbai"),
    (re.compile(r"BHABHA|BARC", re.I), "BARC Hospital, Mumbai"),
    (re.compile(r"PIMPRI|CHINCHWAD|PCMC", re.I), "PCMC Post Graduate Institute, Pimpri"),
    (re.compile(r"RAJIV\s+GANDHI", re.I), "Rajiv Gandhi Medical College, Thane"),
    (re.compile(r"RCSM", re.I), "RCSM Government Medical College, Kolhapur"),
    (re.compile(r"GONDIA", re.I), "Government Medical College, Gondia"),
    (re.compile(r"CHANDRAPUR", re.I), "Chandrapur Government Medical College, Chandrapur"),
    (re.compile(r"JALGAON", re.I), "Government Medical College, Jalgaon"),
    (re.compile(r"BARAMATI", re.I), "Government Medical College, Baramati"),
    (re.compile(r"NANDURBAR", re.I), "Government Medical College, Nandurbar"),
    (re.compile(r"MPGIMER|POST\s+GRADUATE\s+INSTITUTE.*NASHIK|MAHARASHTRA\s+POST\s+GRADUATE", re.I),
     "Mahatma Gandhi Post Graduate Institute, Nashik"),
    (re.compile(r"P\.?\s*G\.?\s*I\.?\s*M\.?\s*S|NERUL|NAVI\s+MUMBAI", re.I),
     "Post Graduate Institute of Medical Sciences, Navi Mumbai"),
]


def canonical_mah_college(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    if not s:
        return s
    for pat, name in _COLLEGE_PATTERNS:
        if pat.search(s):
            return name
    if s == s.upper() and len(s) > 10:
        return s.title()
    return s
