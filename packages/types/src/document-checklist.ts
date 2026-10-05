/** Registration document checklist — configurable per counselling track. */

export type DocumentItem = {
  id: string;
  label: string;
  requiredFor: ("AIQ" | "STATE" | "ALL")[];
  stateSpecific?: string;
  note?: string;
};

export const COMMON_NEET_PG_DOCUMENTS: DocumentItem[] = [
  { id: "neet-scorecard", label: "NEET-PG 2026 scorecard / admit card", requiredFor: ["ALL"] },
  { id: "photo-id", label: "Passport-size photographs (as per portal spec)", requiredFor: ["ALL"] },
  { id: "id-proof", label: "Photo ID (Aadhaar / Passport / Driving licence)", requiredFor: ["ALL"] },
  { id: "internship", label: "Internship completion certificate / proof", requiredFor: ["ALL"] },
  { id: "mbbs-degree", label: "MBBS degree / provisional certificate", requiredFor: ["ALL"] },
  { id: "registration", label: "Medical Council registration (provisional/permanent)", requiredFor: ["ALL"] },
  { id: "category-cert", label: "Category certificate (OBC/SC/ST/EWS/PwD) if applicable", requiredFor: ["ALL"], note: "Must match NEET-PG category claimed" },
  { id: "pwd-cert", label: "PwD certificate (if applicable)", requiredFor: ["ALL"] },
];

export const AIQ_SPECIFIC_DOCUMENTS: DocumentItem[] = [
  { id: "mcc-registration", label: "MCC registration printout & fee receipt", requiredFor: ["AIQ"] },
  { id: "nri-docs", label: "NRI / OCI documents (if applying under NRI quota)", requiredFor: ["AIQ"], note: "Only if applicable" },
];

export const STATE_SPECIFIC_DOCUMENTS: DocumentItem[] = [
  {
    id: "domicile-mh",
    label: "Maharashtra domicile / bonafide certificate",
    requiredFor: ["STATE"],
    stateSpecific: "Maharashtra",
  },
  {
    id: "mah-registration",
    label: "MAHACET / state portal registration receipt",
    requiredFor: ["STATE"],
    stateSpecific: "Maharashtra",
  },
];
