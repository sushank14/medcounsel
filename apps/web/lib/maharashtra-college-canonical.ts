/** Canonical MAH institute names for seat-matrix compare keys (matches ingestion). */
const COLLEGE_PATTERNS: Array<[RegExp, string]> = [
  [/GRANT\s+GOVERNMENT/i, "Grant Medical College, Mumbai"],
  [/SETH\s+G\.?\s*S\.?/i, "Seth GS Medical College (KEM), Mumbai"],
  [/LOKMANYA\s+TILAK/i, "Lokmanya Tilak Municipal Medical College, Mumbai"],
  [/T\.?\s*N\.?\s*MUNICIPAL/i, "Topiwala National Medical College, Mumbai"],
  [/B\.?\s*J\.?\s*MEDICAL/i, "BJ Medical College, Pune"],
  [/V\.?\s*M\.?\s*GOVERNMENT/i, "Government Medical College, Solapur"],
  [/MIRAJ/i, "Government Medical College, Miraj"],
  [/GOVT\.?\s*MEDICAL\s+COLLEGE,\s*NAGPUR/i, "Government Medical College, Nagpur"],
  [/INDIRA\s+GANDHI/i, "Indira Gandhi Government Medical College, Nagpur"],
  [/V\.?\s*N\.?\s*GOVERNMENT/i, "Government Medical College, Yavatmal"],
  [/GOVERNMENT\s+MEDICAL\s+COLLEGE,\s*AKOLA/i, "Government Medical College, Akola"],
  [/AURANGABAD|SAMBHAJI/i, "Government Medical College, Sambhajinagar"],
  [/GOVERNMENT\s+MEDICAL\s+COLLEGE,\s*NANDED/i, "Government Medical College, Nanded"],
  [/SRTR/i, "SRTR Medical College, Ambajogai"],
  [/VILASRAO|LATUR/i, "Government Medical College, Latur"],
  [/HBT|COOPER/i, "HBT Medical College & Cooper Hospital, Mumbai"],
  [/BHAUSAHEB\s+HIRE|HIRE\s+GOVERNMENT/i, "Bhausaheb Hire Government Medical College, Dhule"],
  [/MAHATMA\s+GANDHI\s+INSTITUTE/i, "Mahatma Gandhi Institute of Medical Sciences, Wardha"],
  [/TATA\s+MEMORIAL/i, "Tata Memorial Hospital, Mumbai"],
  [/PHYSICAL\s+MEDICINE/i, "All India Institute of Physical Medicine & Rehabilitation, Mumbai"],
  [/BHABHA|BARC/i, "BARC Hospital, Mumbai"],
  [/PIMPRI|CHINCHWAD|PCMC/i, "PCMC Post Graduate Institute, Pimpri"],
  [/RAJIV\s+GANDHI/i, "Rajiv Gandhi Medical College, Thane"],
  [/RCSM/i, "RCSM Government Medical College, Kolhapur"],
  [/GONDIA/i, "Government Medical College, Gondia"],
  [/CHANDRAPUR/i, "Chandrapur Government Medical College, Chandrapur"],
  [/JALGAON/i, "Government Medical College, Jalgaon"],
  [/BARAMATI/i, "Government Medical College, Baramati"],
  [/NANDURBAR/i, "Government Medical College, Nandurbar"],
  [
    /MPGIMER|POST\s+GRADUATE\s+INSTITUTE.*NASHIK|MAHARASHTRA\s+POST\s+GRADUATE/i,
    "Mahatma Gandhi Post Graduate Institute, Nashik",
  ],
  [/P\.?\s*G\.?\s*I\.?\s*M\.?\s*S|NERUL|NAVI\s+MUMBAI/i, "Post Graduate Institute of Medical Sciences, Navi Mumbai"],
];

export function canonicalMahCollegeName(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return s;
  for (const [pat, name] of COLLEGE_PATTERNS) {
    if (pat.test(s)) return name;
  }
  if (s === s.toUpperCase() && s.length > 10) {
    return s.replace(/\w\S*/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  }
  return s;
}
