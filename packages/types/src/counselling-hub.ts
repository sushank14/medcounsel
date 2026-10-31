/** Configurable counselling authority metadata — extend for new states/years without UI rewrites. */

export type CounsellingTrackCode = "AIQ" | "MAHARASHTRA";

export type CounsellingTrackConfig = {
  code: CounsellingTrackCode;
  label: string;
  authority: string;
  portalUrl: string;
  scheduleUrl?: string;
  rankType: "AIR" | "SML";
  eligibility: string;
  quotaSummary: string;
  categories: string;
  upgradeNote: string;
  exitNote: string;
  supported: boolean;
  dataCoverage: string;
};

export type StateCounsellingConfig = {
  stateCode: string;
  stateName: string;
  authority: string;
  portalUrl?: string;
  supported: boolean;
  rankType: "AIR" | "SML" | "STATE_MERIT";
  domicileRequired: boolean;
  dataCoverage: string;
  notes?: string;
};

export const AIQ_COUNSELLING: CounsellingTrackConfig = {
  code: "AIQ",
  label: "All India Quota (MCC)",
  authority: "Medical Counselling Committee (MCC), DGHS",
  portalUrl: "https://mcc.nic.in/pg-medical-counselling/",
  scheduleUrl:
    "https://cdnbbsr.s3waas.gov.in/s3e0f7a4d0ef9b84b83b693bbf3feb8e6e/uploads/2026/10/202610071411981089.pdf",
  rankType: "AIR",
  eligibility:
    "All NEET-PG qualified candidates. Uses All India Rank (AIR). Includes AIQ seats in government colleges, central institutes, deemed universities, and ESIC (as per MCC notice).",
  quotaSummary: "50% AIQ in govt colleges · Deemed · Central · DNB (as per MCC matrix)",
  categories: "General · EWS · OBC · SC · ST · PwD (per MCC rules)",
  upgradeNote:
    "Upgradation allowed in subsequent MCC rounds if you participate and do not report (verify current MCC notice).",
  exitNote:
    "Resignation / non-reporting rules vary by round — always confirm on mcc.nic.in before the deadline.",
  supported: true,
  dataCoverage:
    "MCC AIQ cutoffs 2020–2025 (final) · 2026 Round 1 provisional · NMC seat matrix 2026–27",
};

export const STATE_COUNSELLING_REGISTRY: StateCounsellingConfig[] = [
  {
    stateCode: "MAHARASHTRA",
    stateName: "Maharashtra",
    authority: "State CET Cell (MAHACET)",
    portalUrl: "https://medicalpg2026.mahacet.org/",
    supported: true,
    rankType: "SML",
    domicileRequired: true,
    dataCoverage:
      "Maharashtra CAP cutoffs 2025 (SML) · 2026 provisional merit list (SML lookup) · Selection list pending",
    notes: "Uses State Merit List (SML), not AIR. Domicile certificate typically required.",
  },
  {
    stateCode: "KARNATAKA",
    stateName: "Karnataka",
    authority: "Karnataka Examination Authority (KEA)",
    supported: false,
    rankType: "STATE_MERIT",
    domicileRequired: true,
    dataCoverage: "Not yet integrated — calendar placeholder only",
    notes: "Coming soon — verify on kea.kar.nic.in for official dates.",
  },
  {
    stateCode: "TELANGANA",
    stateName: "Telangana",
    authority: "Kaloji Narayana Rao University of Health Sciences (KNRUHS)",
    supported: false,
    rankType: "STATE_MERIT",
    domicileRequired: true,
    dataCoverage: "Not yet integrated",
  },
  {
    stateCode: "TAMIL_NADU",
    stateName: "Tamil Nadu",
    authority: "Directorate of Medical Education, TN",
    supported: false,
    rankType: "STATE_MERIT",
    domicileRequired: true,
    dataCoverage: "Not yet integrated",
  },
  {
    stateCode: "GUJARAT",
    stateName: "Gujarat",
    authority: "Admission Committee for Professional Medical Courses (ACPMEC)",
    supported: false,
    rankType: "STATE_MERIT",
    domicileRequired: true,
    dataCoverage: "Not yet integrated",
  },
];

export type ChoiceTier = "DREAM" | "TARGET" | "REALISTIC" | "BACKUP";

export const CHOICE_TIER_LABELS: Record<ChoiceTier, { label: string; description: string }> = {
  DREAM: { label: "Dream", description: "Stretch options — historically very competitive for your rank" },
  TARGET: { label: "Target", description: "Strong matches — good chance based on cutoffs" },
  REALISTIC: { label: "Realistic", description: "Competitive but achievable with favourable trends" },
  BACKUP: { label: "Safe / Backup", description: "Conservative options if higher choices don't work out" },
};

export function fitLevelToTier(fitLevel: string): ChoiceTier {
  switch (fitLevel) {
    case "STRONG":
      return "TARGET";
    case "POSSIBLE":
      return "REALISTIC";
    case "BORDERLINE":
      return "BACKUP";
    case "DIFFICULT":
      return "DREAM";
    default:
      return "REALISTIC";
  }
}
