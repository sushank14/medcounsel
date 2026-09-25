/** Extract MCC institute code e.g. (1234567) from institute string */
export function extractInstituteCode(name: string): string | null {
  const m = name.match(/\((\d{5,7})\)/);
  return m?.[1] ?? null;
}

export function normalizeCollegeName(name: string): string {
  const withoutCode = name.replace(/\(\d{5,7}\)\s*$/, "").trim();
  const parts = withoutCode
    .split(",")
    .map((p) => p.trim().replace(/\d{5,}.*$/, "").trim())
    .filter(Boolean);
  const key = parts.slice(0, Math.min(2, parts.length)).join(" ");
  return key
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s&().'-]/g, "")
    .trim()
    .toLowerCase();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function mapMccCategory(allotted: string, candidate: string): string {
  const a = `${allotted} ${candidate}`.toLowerCase();
  if (a.includes("pwd") || a.includes("pwbd")) return "PWD";
  if (a.includes("ew") || a.includes("ews")) return "EWS";
  if (a.includes("bc") || a.includes("obc")) return "OBC";
  if (a.includes("sc") && !a.includes("schedule tribe")) return "SC";
  if (a.includes("st") || a.includes("schedule tribe")) return "ST";
  return "GENERAL";
}

export function mapMccQuota(quota: string): string {
  const q = quota.toLowerCase();
  if (q.includes("all india")) return "AIQ";
  if (q.includes("nri")) return "NRI";
  if (q.includes("management") || q.includes("paid")) return "MANAGEMENT";
  if (q.includes("muslim") || q.includes("minority") || q.includes("jain")) return "IQ";
  if (q.includes("dnb")) return "AIQ";
  if (q.includes("delhi") || q.includes("banaras") || q.includes("aligarh")) return "AIQ";
  return "AIQ";
}

export function parseCourse(courseRaw: string): { degree: string; specialty: string; slug: string } {
  const course = courseRaw.replace(/\s+/g, " ").trim();
  const upper = course.toUpperCase();

  let degree = "MD";
  if (upper.startsWith("M.S") || upper.startsWith("MS")) degree = "MS";
  else if (upper.startsWith("DNB")) degree = "DNB";
  else if (upper.startsWith("DIPLOMA")) degree = "DIPLOMA";

  const specialtyMap: [RegExp, string][] = [
    [/GENERAL\s*MEDICINE/i, "General Medicine"],
    [/RADIO\s*DIAG/i, "Radiodiagnosis"],
    [/DERM/i, "Dermatology"],
    [/PAED/i, "Pediatrics"],
    [/ANAE?STH/i, "Anaesthesiology"],
    [/GENERAL\s*SURGERY/i, "General Surgery"],
    [/ORTHOP/i, "Orthopedics"],
    [/O\.?B\.?G|OBSTET|GYNAEC/i, "Obstetrics & Gynecology"],
    [/OPHTHAL/i, "Ophthalmology"],
    [/ENT|OTO-RHINO/i, "ENT"],
    [/PATHO/i, "Pathology"],
    [/PSYCHI/i, "Psychiatry"],
    [/RADIO\s*THER/i, "Radiotherapy"],
    [/EMERGENCY/i, "Emergency Medicine"],
    [/RESPIR|PULMON/i, "Respiratory Medicine"],
  ];

  let specialty = course.replace(/^(M\.?D\.?|M\.?S\.?|DNB|DIPLOMA)\s*[(\[]?\s*/i, "").replace(/[)\]]/g, "").trim();
  for (const [re, name] of specialtyMap) {
    if (re.test(course)) {
      specialty = name;
      break;
    }
  }

  specialty = specialty
    .replace(/\.$/, "")
    .replace(/RADIO\s*-?\s*DIAGNOSIS/i, "Radiodiagnosis")
    .replace(/\s+/g, " ")
    .trim();
  const slug = slugify(`${degree}-${specialty}`);

  return { degree, specialty, slug };
}

export function extractStateFromInstitute(institute: string): { state: string; city: string } {
  const parts = institute.split(",").map((p) => p.trim());
  const state = parts.length >= 2 ? parts[parts.length - 2] : "Unknown";
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[0];
  return { state: state.replace(/\d+.*/, "").trim() || "Unknown", city: city.slice(0, 60) };
}
