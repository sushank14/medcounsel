/** Infer ownership / institute type from display name (MCC + state counselling lists). */

export type CollegeTypeCode = "GOVT" | "PRIVATE" | "DEEMED" | "CENTRAL" | "STATE_UNIV";

export const COLLEGE_TYPE_LABELS: Record<string, string> = {
  GOVT: "Government",
  CENTRAL: "Central (AIIMS etc.)",
  PRIVATE: "Private / DNB hospital",
  DEEMED: "Deemed university",
  STATE_UNIV: "State university",
};

const CENTRAL_PATTERNS = [
  /\baiims\b/i,
  /\bjipmer\b/i,
  /\bpgimer\b/i,
  /\bnimhans\b/i,
  /\bsipmer\b/i,
  /\bsgpgi\b/i,
  /\ball india institute\b/i,
  /\bafmc\b/i,
  /armed forces medical/i,
  /sanjay gandhi postgraduat/i,
  /sanjay gandhi postgarduate/i,
];

const GOVT_KNOWN_PATTERNS = [
  /sher-i-kashmir institute of medical sciences/i,
  /indira gandhi institute of medical sciences/i,
  /post graduate institute of medical education/i,
  /postgraduate institute of medical sciences/i,
  /\bmpgimer\b/i,
  /institute of post graduate medical/i,
  /\bipgm/i,
  /\bsskm\b/i,
  /dr\.?\s*ram manohar lohia institute of medical sciences/i,
  /rajendra institute of medical sciences/i,
  /regional institute of medical sciences/i,
  /north eastern indira gandhi regional institute/i,
  /pandit bhagwat dayal sharma post graduate institute/i,
  /esi-post graduate institute/i,
  /\besic\b.*institute/i,
  /seth gs medical college/i,
  /seth gordhandas/i,
  /seth v\.? c\.? gandhi.*municipal/i,
  /municipal general hospital/i,
  /government multi specialty hospital/i,
  /gmers medical college/i,
  /lady hardinge medical college/i,
  /mandya institute of medical sciences/i,
  /shimoga institute of medical sciences/i,
  /gadag institute of medical sciences/i,
  /gulbarga institute of medical sciences/i,
  /raichur institute of medical sciences/i,
  /vijanagara institute of medical sciences/i,
  /koppal institute of medical sciences/i,
  /rajiv gandhi institute of medical sciences srikakulam/i,
  /vss institute of medical sciences/i,
  /sri venkateswara institute of medical sciences/i,
  /college of medicine.*sagore dutta/i,
  /college of medicine and jnm hospital/i,
  /\besic medical college/i,
  /post graduate institute of medical education.*research/i,
  /capital hospital.*pgimer/i,
];

const GOVT_PATTERNS = [
  /government medical college/i,
  /govt\.?\s*medical college/i,
  /\bgmc\b/i,
  /municipal (corporation )?.*medical/i,
  /municipal.*postgraduate institute/i,
  /college of medicine\b/i,
  /medical college and hospital/i,
  /medical college,/i,
  /medical college\s/i,
  /district hospital/i,
  /central railway hospital/i,
  /railway hospital/i,
  ...GOVT_KNOWN_PATTERNS,
];

const PRIVATE_NAME_PATTERNS = [
  /\bprivate\b/i,
  /\bpvt\.?\b/i,
  /\bltd\.?\b/i,
  /\blimited\b/i,
  /\bunit of\b/i,
  /\bcharitable trust\b/i,
  /super specialty hospital/i,
  /superspeciality hospital/i,
  /superspecialty hospital/i,
  /multispeciality hospital/i,
  /multispecialty hospital/i,
  /healthcare (services|private)/i,
  /health care services/i,
  /medical services pvt/i,
  /research centre pvt/i,
  /research center pvt/i,
  /\bdnb\b/i,
  /\bnbems\b/i,
];

const PRIVATE_CHAIN_PATTERNS = [
  /fortis/i,
  /apollo/i,
  /\bmax\b/i,
  /medanta/i,
  /narayana/i,
  /manipal/i,
  /\baster\b/i,
  /hiranandani/i,
  /batra hospital/i,
  /hinduja/i,
  /livasa/i,
  /aakash healthcare/i,
  /raheja/i,
  /naruvi/i,
  /ambani hospital/i,
  /dharamshila/i,
  /kokilaben/i,
  /kuppuswamy naidu memorial/i,
  /st\.?\s*stephen/i,
  /mission hospital/i,
  /iqraa international/i,
  /bhaktivedanta hospital/i,
  /sunshine hospital/i,
  /kailash hospital/i,
  /medicover/i,
  /kerala institute of medical sciences/i,
  /kovai medical centre/i,
  /artemis health institute/i,
  /ruby hall clinic/i,
  /malabar institute of medical sciences/i,
  /asian institute of medical sciences/i,
  /sum ultimate medicare/i,
  /sankara nethralaya/i,
  /metro heart institute/i,
  /lisie medical institution/i,
  /rajiv gandhi cancer institute/i,
  /chittaranjan national cancer institute dnb/i,
];

const PRIVATE_DEEMED_MEDICAL_COLLEGES =
  /manipal|sri siddhartha|saveetha|chettinad|datta meghe|sbks medical|krishna institute of medical|sri ramachandra medical|srm medical college/i;

/** Clear private-hospital / corporate signals in the official institute name. */
export function hasPrivateOwnershipSignals(name: string): boolean {
  if (/medical college/i.test(name) && PRIVATE_DEEMED_MEDICAL_COLLEGES.test(name)) {
    return true;
  }

  // Private hospital groups that include "Medical College" in the legal name (e.g. SMS Multispeciality).
  if (
    /multispeciality hospital|multispecialty hospital/i.test(name) &&
    !/municipal|government|govt|gmers|\bgmc\b/i.test(name)
  ) {
    return true;
  }

  const isGovtMedicalCollege =
    (/medical college/i.test(name) && !PRIVATE_DEEMED_MEDICAL_COLLEGES.test(name)) ||
    /college of medicine/i.test(name) ||
    /\besic medical college/i.test(name) ||
    GOVT_KNOWN_PATTERNS.some((p) => p.test(name));

  if (!isGovtMedicalCollege && PRIVATE_NAME_PATTERNS.some((p) => p.test(name))) return true;
  if (!isGovtMedicalCollege && PRIVATE_CHAIN_PATTERNS.some((p) => p.test(name))) return true;

  if (/hospital/i.test(name) && !/medical college/i.test(name) && !/college of medicine/i.test(name)) {
    const publicHospital =
      /municipal|government|govt|esic|railway|district hospital|institute of post graduate|ipgm|sskm/i.test(
        name
      );
    if (!publicHospital) return true;
  }

  return false;
}

/** Clear government-medical-college signals in the official institute name. */
export function hasGovernmentOwnershipSignals(name: string): boolean {
  if (CENTRAL_PATTERNS.some((p) => p.test(name))) return true;
  return GOVT_PATTERNS.some((p) => p.test(name));
}

/** NBEMS / DNB seats at private hospitals — not government medical colleges. */
export function isNbemsOrDnbSeat(specialtyName?: string, degree?: string): boolean {
  if (degree === "DNB") return true;
  if (!specialtyName) return false;
  return /\bnbems\b/i.test(specialtyName) || /^\(nbems/i.test(specialtyName.trim());
}

/** Default type for newly imported institutes (conservative). */
export function inferCollegeTypeFromName(name: string): CollegeTypeCode {
  if (/deemed/i.test(name)) return "DEEMED";
  if (hasPrivateOwnershipSignals(name)) return "PRIVATE";
  if (CENTRAL_PATTERNS.some((p) => p.test(name)) && !/\bdnb\b/i.test(name)) return "CENTRAL";
  if (hasGovernmentOwnershipSignals(name)) {
    if (/university/i.test(name) && /medical/i.test(name) && !/government|govt/i.test(name)) {
      return "STATE_UNIV";
    }
    return "GOVT";
  }
  if (/medical college/i.test(name)) return "GOVT";
  if (/university/i.test(name) && /medical/i.test(name)) return "STATE_UNIV";
  return "GOVT";
}

/**
 * Strict check for "Government only" preference — excludes private DNB hospitals
 * even if they were historically tagged GOVT in the database.
 */
export function qualifiesAsGovernmentCollege(
  name: string,
  collegeType: string,
  specialtyName?: string,
  degree?: string
): boolean {
  if (collegeType !== "GOVT" && collegeType !== "CENTRAL") return false;
  if (isNbemsOrDnbSeat(specialtyName, degree)) return false;
  if (hasPrivateOwnershipSignals(name)) return false;

  if (collegeType === "CENTRAL") {
    return CENTRAL_PATTERNS.some((p) => p.test(name)) && !/\bdnb\b/i.test(name);
  }

  return (
    /medical college/i.test(name) ||
    /government|govt\.|municipal|gmers|\bgmc\b/i.test(name) ||
    GOVT_KNOWN_PATTERNS.some((p) => p.test(name))
  );
}

/** High-confidence retag for data repair scripts only. */
export function confidentCollegeTypeRetag(
  name: string,
  currentType: string
): CollegeTypeCode | null {
  if (hasPrivateOwnershipSignals(name) && currentType !== "PRIVATE" && currentType !== "DEEMED") {
    return "PRIVATE";
  }

  if (
    (currentType === "PRIVATE" || currentType === "GOVT") &&
    hasGovernmentOwnershipSignals(name) &&
    !hasPrivateOwnershipSignals(name)
  ) {
    if (CENTRAL_PATTERNS.some((p) => p.test(name)) && !/\bdnb\b/i.test(name)) return "CENTRAL";
    if (/university/i.test(name) && /medical/i.test(name) && !/government|govt/i.test(name)) {
      return "STATE_UNIV";
    }
    return "GOVT";
  }

  return null;
}
