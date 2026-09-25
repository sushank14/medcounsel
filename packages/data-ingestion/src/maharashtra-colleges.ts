/** Maharashtra college abbreviations used in MAHACET selection lists */
export const MAH_COLLEGE_MAP: Record<string, { name: string; city: string }> = {
  GSMC: { name: "Grant Medical College", city: "Mumbai" },
  LTMC: { name: "Lokmanya Tilak Municipal Medical College", city: "Mumbai" },
  TNMC: { name: "Topiwala National Medical College", city: "Mumbai" },
  BJMC: { name: "BJ Medical College", city: "Pune" },
  GMC: { name: "Government Medical College", city: "Maharashtra" },
  CGMC: { name: "Chandrapur Government Medical College", city: "Chandrapur" },
  IGMC: { name: "Indira Gandhi Government Medical College", city: "Nagpur" },
  MGIMS: { name: "Mahatma Gandhi Institute of Medical Sciences", city: "Wardha" },
  BHMS: { name: "Bharati Vidyapeeth Medical College", city: "Pune" },
  TATA: { name: "Tata Memorial Hospital", city: "Mumbai" },
  "HBT & COOP": { name: "HBT Medical College & Cooper Hospital", city: "Mumbai" },
  PCMC: { name: "PCMC Post Graduate Institute", city: "Pimpri" },
  "PCMC PGM I": { name: "PCMC Post Graduate Institute", city: "Pimpri" },
  PGIMS: { name: "Post Graduate Institute of Medical Sciences", city: "Navi Mumbai" },
  MPGIMER: { name: "Mahatma Gandhi Post Graduate Institute", city: "Nashik" },
  RMC: { name: "Rural Medical College", city: "Loni" },
  DYPMC: { name: "Dr D Y Patil Medical College", city: "Pune" },
  KIMS: { name: "Krishna Institute of Medical Sciences", city: "Karad" },
  SRTR: { name: "SRTR Medical College", city: "Ambajogai" },
  SKNMC: { name: "SKN Medical College", city: "Pune" },
  SKN: { name: "SKN Medical College", city: "Pune" },
  AFMC: { name: "Armed Forces Medical College", city: "Pune" },
  VMMC: { name: "Seth GS Medical College (KEM)", city: "Mumbai" },
  VNMC: { name: "Government Medical College", city: "Yavatmal" },
  VPS: { name: "VPS Medical College", city: "Nashik" },
  PDMC: { name: "Pandit Deendayal Medical College", city: "Amravati" },
  UPMC: { name: "University PG Medical College", city: "Jalgaon" },
  "VEDANTA MC": { name: "Vedanta Medical College", city: "Palghar" },
  "NKP SALVE": { name: "NKP Salve Institute of Medical Sciences", city: "Nagpur" },
  TERNA: { name: "Terna Medical College", city: "Navi Mumbai" },
  MIMER: { name: "MIMER Medical College", city: "Pune" },
  MIMSR: { name: "MIMSR Medical College", city: "Latur" },
  SMBT: { name: "SMBT Medical College", city: "Nashik" },
  PIMS: { name: "Pravara Institute of Medical Sciences", city: "Loni" },
  ACPM: { name: "ACPM Medical College", city: "Dhule" },
  KJMC: { name: "KJ Somaiya Medical College", city: "Mumbai" },
  BARC: { name: "BARC Hospital", city: "Mumbai" },
  "B HIRE": { name: "Bhausaheb Hire Government Medical College", city: "Dhule" },
  "RAJEEV GAN": { name: "Rajiv Gandhi Medical College", city: "Thane" },
  IIMSR: { name: "Indian Institute of Medical Science & Research", city: "Jalna" },
  AIIPMR: { name: "All India Institute of Physical Medicine & Rehabilitation", city: "Mumbai" },
  SANCHETI: { name: "Sancheti Institute for Orthopedics", city: "Pune" },
  SANJEEVAN: { name: "Sanjeevan Hospital", city: "Pune" },
  SWASTHIYOG: { name: "Swasthiyog Hospital", city: "Miraj" },
  "BK WALAWAL": { name: "BK Walawalkar Rural Medical College", city: "Ratnagiri" },
  VVPF: { name: "VVPF Medical College", city: "Solapur" },
  GGMC: { name: "Government Medical College", city: "Gondia" },
  "ASHWINI ME": { name: "Ashwini Rural Medical College", city: "Solapur" },
};

/** College codes that may appear appended to subject when PDF spacing collapses */
export const MAH_COLLEGE_SUFFIXES = Object.keys(MAH_COLLEGE_MAP).sort((a, b) => b.length - a.length);

const QUOTA_SUFFIXES = ["EMSEBC", "EMNTB", "EMNTD", "EMOBC", "EMVJA", "SEBC", "OPEN", "OBC", "EWS", "SC", "ST", "NTB", "NTC", "NTD", "VJA", "PH"];

export function sanitizeCollegeRaw(raw: string): string {
  let s = raw
    .replace(/^&\s*(TB|VD|CRITICAL|EMERGENCY)\s+/gi, "")
    .replace(/^&\s+/g, "")
    .replace(/\s*&\s*VD\s*$/gi, "")
    .trim();

  for (const token of QUOTA_SUFFIXES) {
    const re = new RegExp(`\\s+${token}\\s*$`, "i");
    if (re.test(s)) s = s.replace(re, "").trim();
  }
  return s;
}

export function resolveMahCollege(raw: string, cityHint?: string): { name: string; city: string; norm: string } {
  const cleaned = sanitizeCollegeRaw(raw.replace(/,\s*$/, "").trim());
  const upper = cleaned.toUpperCase();

  const sorted = Object.entries(MAH_COLLEGE_MAP).sort(([a], [b]) => b.length - a.length);
  for (const [abbrev, info] of sorted) {
    const ab = abbrev.toUpperCase();
    if (upper === ab || upper.startsWith(`${ab} `) || upper.startsWith(ab)) {
      const city = resolveCity(cityHint, info.city);
      const name =
        info.city === "Maharashtra" && city !== info.city
          ? `${info.name}, ${city}`
          : info.name;
      return { name, city, norm: slugNorm(name, city) };
    }
  }

  const city = resolveCity(cityHint, "Maharashtra");
  const name = cleaned.includes(",") ? cleaned : `${cleaned}, ${city}`;
  return { name, city, norm: slugNorm(name, city) };
}

function resolveCity(cityHint: string | undefined, fallback: string): string {
  if (!cityHint || cityHint === "Maharashtra") return fallback;
  return normalizeCity(cityHint);
}

function slugNorm(name: string, city: string): string {
  return `${name.split(",")[0]}-${city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Expand seat-matrix abbreviations (GGMC, BJMC…) to readable names */
export function expandInstituteAbbrev(raw: string, state?: string): string {
  const cleaned = raw.replace(/\(\d{5,7}\)\s*$/, "").replace(/\s+/g, " ").trim();
  const upper = cleaned.toUpperCase();

  for (const [abbrev, info] of Object.entries(MAH_COLLEGE_MAP).sort(
    ([a], [b]) => b.length - a.length
  )) {
    if (upper === abbrev || upper.startsWith(`${abbrev} `)) {
      return info.city !== "Maharashtra" ? `${info.name}, ${info.city}` : info.name;
    }
  }

  if (state === "Maharashtra" && cleaned.length <= 12 && /^[A-Z.&\s]+$/.test(cleaned)) {
    return cleaned;
  }

  return cleaned;
}

export function normalizeCity(raw: string): string {
  const map: Record<string, string> = {
    MUMBAI: "Mumbai",
    MUMB: "Mumbai",
    SAMBHAJINA: "Sambhajinagar",
    SAMBHAJINAGAR: "Sambhajinagar",
    PUNE: "Pune",
    NAGPUR: "Nagpur",
    AURANGABAD: "Sambhajinagar",
    NASHIK: "Nashik",
    KOLHAPUR: "Kolhapur",
    SOLAPUR: "Solapur",
    AMRAVATI: "Amravati",
    JUHU: "Mumbai",
    PIMPARI: "Pimpri",
    LATUR: "Latur",
    NANDED: "Nanded",
    JALGAON: "Jalgaon",
    CHANDRAPUR: "Chandrapur",
    DHULE: "Dhule",
    THANE: "Thane",
    PALGHAR: "Palghar",
    YEOTMAL: "Yavatmal",
    YAVATMAL: "Yavatmal",
    WARDHA: "Wardha",
    SEVAGRAM: "Wardha",
    MIRAJ: "Miraj",
    RATNAGIRI: "Ratnagiri",
  };
  const key = raw.replace(/[,.\s]+/g, "").toUpperCase();
  for (const [k, v] of Object.entries(map)) {
    if (key === k || key.startsWith(k)) return v;
  }
  const cleaned = raw.replace(/[,.\s]+$/g, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}
