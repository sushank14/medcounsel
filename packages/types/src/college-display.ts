const KNOWN_CITIES = [
  "Navi Mumbai",
  "New Delhi",
  "Mumbai",
  "Pune",
  "Nagpur",
  "Thane",
  "Nashik",
  "Delhi",
  "Bangalore",
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Kolhapur",
  "Solapur",
  "Amravati",
  "Aurangabad",
  "Sambhajinagar",
  "Latur",
  "Akola",
  "Jalgaon",
  "Dhule",
  "Sangli",
  "Ahmednagar",
  "Chandrapur",
  "Nanded",
  "Gondia",
  "Yavatmal",
  "Wardha",
  "Loni",
  "Karad",
  "Ambajogai",
  "Ratnagiri",
  "Miraj",
  "Palghar",
  "Pimpri",
  "Beed",
  "Buldhana",
  "Hingoli",
  "Parbhani",
  "Jalna",
  "Washim",
  "Osmanabad",
  "Satara",
  "Tiruchirappalli",
  "Srinagar",
  "Kozhikode",
  "Kota",
  "Patiala",
  "Kadapa",
  "Surat",
  "Theni",
  "Nizamabad",
  "Jammu",
  "Alibag",
  "Raigad",
  "Dhule",
  "Kannur",
  "Kannauj",
  "Coimbatore",
  "Shahdol",
  "Kollam",
  "Cuddalore",
  "Mahabubnagar",
  "Mullur",
  "Bharatpur",
  "Suryapet",
  "Miraj",
];

const CITY_ALIASES: Record<string, string> = {
  tiruchirappalli: "Tiruchirappalli",
  tiruchirappallli: "Tiruchirappalli",
  tiruchirapalli: "Tiruchirappalli",
  trichy: "Tiruchirappalli",
  bengaluru: "Bangalore",
  bangalore: "Bangalore",
  newdelhi: "New Delhi",
  sambhajinagar: "Sambhajinagar",
  aurangabad: "Sambhajinagar",
  yeotmal: "Yavatmal",
  yavatmal: "Yavatmal",
  alibaug: "Alibag",
  raigad: "Raigad",
  sakriroad: "Dhule",
  dhule: "Dhule",
  kolhapur: "Kolhapur",
};

const SLUG_STOP_WORDS = new Set([
  "a", "an", "and", "associated", "attached", "base", "central", "college",
  "deemed", "district", "dr", "for", "foundation", "general", "govt", "government",
  "group", "hospital", "institute", "medical", "of", "pg", "post", "pvt", "quota",
  "regional", "research", "rural", "sciences", "the", "to", "university", "be",
]);

/** Well-known colleges whose name does not contain the city */
const COLLEGE_CITY_HINTS: [RegExp, string][] = [
  [/viswanatham|tiruchirappalli/i, "Tiruchirappalli"],
  [/shahu maharaj|rajarshee chhatrapati/i, "Kolhapur"],
  [/hbt medical|cooper.*hospital|rn cooper/i, "Mumbai"],
  [/alibag.*raigad|raigad district/i, "Alibag"],
  [/bhausaheb hire|b hire/i, "Dhule"],
  [/rajiv gandhi medical college(?!.*thane)/i, "Thane"],
];

const ACRONYMS = new Set([
  "AIIMS",
  "KEM",
  "BJ",
  "BJMC",
  "LTMC",
  "TNMC",
  "IGMC",
  "GSMC",
  "VMMC",
  "AFMC",
  "ESIC",
  "DNB",
  "NBEMS",
  "MD",
  "MS",
  "OBG",
  "ENT",
  "PGI",
  "JIPMER",
  "MAMC",
  "UCMS",
  "LHMC",
]);

/** Remove duplicated half-phrases from PDF-imported institute names */
export function dedupeRepeatedPhrase(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;

  const words = t.split(" ");
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (first.toLowerCase() === second.toLowerCase()) return first;
  }

  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ").toLowerCase();
    const right = words.slice(i).join(" ").toLowerCase();
    if (left === right) return words.slice(0, i).join(" ");
    if (right.startsWith(left) && left.length >= 12) return words.slice(0, i).join(" ");
  }

  const mid = Math.floor(t.length / 2);
  for (let offset = -25; offset <= 25; offset++) {
    const split = mid + offset;
    if (split < 8 || split > t.length - 8) continue;
    const a = t.slice(0, split).trim().toLowerCase();
    const b = t.slice(split).trim().toLowerCase();
    if (a === b) return t.slice(0, split).trim();
    if (b.startsWith(a) && a.length >= 15) return t.slice(0, split).trim();
  }

  return t;
}

function titleCaseWords(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (/^[a-z]\.?$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Names shared by many institutes — city must disambiguate */
const GENERIC_COLLEGE_ROOTS = [
  "government medical college",
  "govt medical college",
  "government medical college and hospital",
  "medical college",
];

export function isGenericCollegeName(name: string): boolean {
  const root = name.split(",")[0].trim().toLowerCase();
  return GENERIC_COLLEGE_ROOTS.some((g) => root === g || root.startsWith(`${g} `));
}

function normalizeCityAlias(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (key.startsWith(alias) || alias.startsWith(key)) return city;
  }
  return null;
}

function matchKnownCity(fragment: string): string | null {
  const tail = fragment.trim().toLowerCase();
  if (!tail) return null;
  const alias = normalizeCityAlias(tail);
  if (alias) return alias;
  for (const known of KNOWN_CITIES) {
    const k = known.toLowerCase();
    if (tail === k || tail.startsWith(`${k} `) || tail.startsWith(`${k}.`)) return known;
  }
  return null;
}

/** Clean college name for display (fixes double-double PDF import artifacts) */
export function displayCollegeName(raw: string): string {
  if (!raw) return "";

  let name = raw.replace(/\s+/g, " ").trim();

  name = name.replace(/^[\d\s]+(?:Management\/Paid Seats Quota|Seats Quota)\s*/i, "");
  name = name.replace(/^Quota\s+/i, "");
  name = name.replace(/\(\d{5,7}\)\s*$/, "");

  const commaIdx = name.indexOf(",");
  if (commaIdx > 0) {
    const head = dedupeRepeatedPhrase(name.slice(0, commaIdx).trim());
    const tailRaw = name.slice(commaIdx + 1).trim().split(",")[0].trim();
    const tail = tailRaw.toLowerCase();
    const knownCity = matchKnownCity(tailRaw);
    if (knownCity) {
      name = `${head}, ${knownCity}`;
    } else if (
      tail.includes("maharashtra") ||
      tail.includes("india") ||
      /\b\d{5,6}\b/.test(tail) ||
      tail.includes(head.toLowerCase().slice(0, 20))
    ) {
      name = head;
    } else {
      name = head;
    }
  } else {
    name = dedupeRepeatedPhrase(name);
  }

  if (name === name.toUpperCase() && name.length > 12) {
    name = titleCaseWords(name);
  }

  return name.slice(0, 160);
}

function matchKnownCityInText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const known of KNOWN_CITIES) {
    if (lower.includes(known.toLowerCase())) return known;
  }
  return null;
}

/** Extract city token from slug e.g. government-medical-college-kota → Kota */
export function cityFromSlug(slug: string): string | null {
  const tokens = slug
    .split("-")
    .filter((t) => t.length > 2 && !SLUG_STOP_WORDS.has(t) && !/^\d+$/.test(t));

  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    for (let i = tokens.length - len; i >= 0; i--) {
      const phrase = tokens.slice(i, i + len).join(" ");
      const matched = matchKnownCityInText(phrase);
      if (matched) return matched;
      const title = phrase.charAt(0).toUpperCase() + phrase.slice(1);
      if (KNOWN_CITIES.some((c) => c.toLowerCase() === phrase.toLowerCase())) return title;
    }
  }
  return null;
}

/** Best-effort city for a college record */
export function resolveCollegeCity(
  name: string,
  slug: string,
  state?: string,
  processedHint?: { city: string; state?: string } | null
): string | null {
  if (processedHint?.city && !isGarbageCity(processedHint.city)) {
    return displayCity(processedHint.city);
  }

  for (const [re, city] of COLLEGE_CITY_HINTS) {
    if (re.test(name)) return city;
  }

  const fromName = cityFromName(name);
  if (fromName) return fromName;

  const commaPart = name.split(",").map((p) => p.trim())[1];
  if (commaPart) {
    const fromComma = matchKnownCity(commaPart) ?? matchKnownCityInText(commaPart);
    if (fromComma && !isGarbageCity(fromComma)) return fromComma;
  }

  const fromSlug = cityFromSlug(slug);
  if (fromSlug) return fromSlug;

  if (state === "Maharashtra") {
    const mh = matchKnownCityInText(slug.replace(/-/g, " "));
    if (mh) return mh;
  }

  return null;
}

/** Location line for UI — never shows bare "Unknown" */
export function formatCollegeLocation(
  city: string,
  state: string,
  name?: string,
  slug?: string
): string {
  let resolved = displayCity(city);
  if (!resolved || resolved.toLowerCase() === "unknown") {
    resolved =
      resolveCollegeCity(name ?? "", slug ?? "", state) ?? "";
  }
  if (!resolved) return state;
  return `${resolved}, ${state}`;
}

/** Extract a readable city from messy address strings */
export function displayCity(raw: string): string {
  if (!raw) return "";
  if (/^unknown$/i.test(raw.trim())) return "";

  let city = raw.replace(/\s+/g, " ").trim();
  city = dedupeRepeatedPhrase(city.split(",")[0].trim());

  const lower = city.toLowerCase();
  for (const known of KNOWN_CITIES) {
    if (lower.includes(known.toLowerCase())) return known;
  }

  if (city.length > 45) {
    for (const known of KNOWN_CITIES) {
      if (raw.toLowerCase().includes(known.toLowerCase())) return known;
    }
    return city.slice(0, 42) + "…";
  }

  const alias = normalizeCityAlias(city);
  if (alias) return alias;

  if (city === city.toUpperCase() && city.length > 3) {
    const titled = titleCaseWords(city);
    return normalizeCityAlias(titled) ?? titled;
  }

  return city;
}

export function isGarbageCollegeName(raw: string): boolean {
  const name = raw.trim();
  if (name.length < 4) return true;
  if (/^\d{4,}/.test(name)) return true;
  if (/^[\d\s-]+$/.test(name)) return true;
  if (/Not Reported|Not Allotted|Did not fill|fill up fresh choices|Upgradation Reported/i.test(name)) {
    return true;
  }
  if (/^(MEDICINE|PATHOLOGY|SURGERY|RADIO|DERMA)\s/i.test(name)) return true;
  if (/^(Against|Seats Quota|Quota)\b/i.test(name)) return true;
  if (name.startsWith("&")) return true;
  const cleaned = displayCollegeName(name);
  return cleaned.length < 4;
}

export function cityFromName(name: string): string | null {
  for (const [re, city] of COLLEGE_CITY_HINTS) {
    if (re.test(name)) return city;
  }
  return matchKnownCityInText(name);
}

export function needsCityRepair(city: string): boolean {
  return !city || isGarbageCity(city);
}

/** Prisma `where` fragment — hide demo/placeholder colleges everywhere */
export const excludeDemoCollegesWhere = {
  NOT: [{ slug: { startsWith: "demo-" } }, { dataStatus: "DEMO" as const }],
};

export function isDemoCollege(slug: string, dataStatus?: string): boolean {
  return slug.startsWith("demo-") || dataStatus === "DEMO";
}

export function isGarbageCity(raw: string): boolean {
  const city = raw.trim();
  if (!city || city.length < 2) return true;
  if (/^(Against|Unknown|Maharashtra|India)\b/i.test(city)) return true;
  if (/\bis$/i.test(city) && city.length < 20) return true;
  if (/not reported|quota|seats/i.test(city)) return true;
  return false;
}
