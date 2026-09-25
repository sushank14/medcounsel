/** Community-informed college guides — not official NIRF/MCI rankings */

export type GuideCategory = "overall" | "region" | "branch";

export interface CuratedCollegeEntry {
  rank: number;
  /** Preferred slug when present in DB */
  collegeSlug?: string;
  /** Fallback: all keywords must appear in college name (case-insensitive) */
  nameKeywords: string[];
  /** Branch this note applies to (optional) */
  specialtySlug?: string;
  highlights: string[];
  /** Reddit / senior-resident style tip */
  communityTip?: string;
}

export interface CuratedGuide {
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
  region?: string;
  specialtySlug?: string;
  specialtyLabel?: string;
  entries: CuratedCollegeEntry[];
}

export const TOP_COLLEGES_DISCLAIMER =
  "These lists combine historical cutoff competitiveness with widely shared PG resident/community opinions (Reddit, seniors, coaching circles). They are not official NIRF or government rankings. Always cross-check cutoffs, stipend, bond, and your rank before choosing.";

const mhGovt: CuratedCollegeEntry[] = [
  {
    rank: 1,
    collegeSlug: "seth-gordhandas-sunderdas-medical-college",
    nameKeywords: ["Seth", "Sunderdas"],
    highlights: ["KEM Mumbai", "Huge patient load", "Strong clinical exposure"],
    communityTip: "Often called the 'AIIMS of Maharashtra' in Reddit threads — extremely busy, excellent teachers, tough life but great training.",
  },
  {
    rank: 2,
    collegeSlug: "grant-medical-college",
    nameKeywords: ["Grant Medical"],
    highlights: ["JJ Hospital campus", "Central Mumbai", "High OPD load"],
    communityTip: "Classic choice for clinical-heavy training; stipend and hostel vary — check latest state rules.",
  },
  {
    rank: 3,
    collegeSlug: "topiwala-national-medical-college",
    nameKeywords: ["Topiwala"],
    highlights: ["Nair Hospital", "Mumbai", "Good broad exposure"],
    communityTip: "Popular for branches where you want busy hospital work without leaving Mumbai.",
  },
  {
    rank: 4,
    collegeSlug: "lokmanya-tilak-municipal-medical-college",
    nameKeywords: ["Lokmanya Tilak"],
    highlights: ["Sion Hospital", "Trauma & medicine volume"],
    communityTip: "Sion = legendary casualty load; residents often mention strong emergency & medicine exposure.",
  },
  {
    rank: 5,
    collegeSlug: "bj-medical-college",
    nameKeywords: ["BJ Medical", "Pune"],
    highlights: ["Sassoon Hospital", "Top Pune govt pick"],
    communityTip: "Default 'best in Pune' on most PG forums; good balance of academics + clinical work.",
  },
  {
    rank: 6,
    collegeSlug: "indira-gandhi-government-medical-college",
    nameKeywords: ["Indira Gandhi", "Nagpur"],
    highlights: ["Vidarbha hub", "Strong govt setup"],
    communityTip: "Usually the first choice for candidates targeting Nagpur / Vidarbha with state quota.",
  },
];

const branchEntries = (
  slug: string,
  picks: Omit<CuratedCollegeEntry, "specialtySlug">[]
): CuratedCollegeEntry[] => picks.map((p) => ({ ...p, specialtySlug: slug }));

export const CURATED_GUIDES: CuratedGuide[] = [
  {
    slug: "maharashtra-govt-top",
    title: "Top Maharashtra Government Colleges",
    description: "Most sought-after govt institutes for Maharashtra state & AIQ counselling — based on cutoffs + community reputation.",
    category: "overall",
    region: "Maharashtra",
    entries: mhGovt,
  },
  {
    slug: "mumbai-top",
    title: "Best Colleges in Mumbai",
    description: "Mumbai metro — high patient volume, teaching hospitals, competitive cutoffs.",
    category: "region",
    region: "Mumbai",
    entries: mhGovt.filter((e) =>
      ["Grant", "Topiwala", "Lokmanya", "Seth", "Sunderdas"].some((k) =>
        e.nameKeywords.join(" ").includes(k)
      )
    ),
  },
  {
    slug: "pune-top",
    title: "Best Colleges in Pune",
    description: "Pune region govt colleges — popular for quality training with slightly better lifestyle than Mumbai.",
    category: "region",
    region: "Pune",
    entries: [
      {
        rank: 1,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Sassoon Hospital", "Top Pune pick"],
        communityTip: "Almost always #1 for Pune in senior lists and Reddit 'where to take MD' threads.",
      },
    ],
  },
  {
    slug: "nagpur-top",
    title: "Best Colleges in Nagpur",
    description: "Vidarbha region — strong state-quota options.",
    category: "region",
    region: "Nagpur",
    entries: [
      {
        rank: 1,
        collegeSlug: "indira-gandhi-government-medical-college",
        nameKeywords: ["Indira Gandhi", "Nagpur"],
        highlights: ["Regional referral centre"],
        communityTip: "Go-to Nagpur choice; compare SML cutoffs branch-wise before locking.",
      },
    ],
  },
  {
    slug: "md-general-medicine",
    title: "Best for MD General Medicine",
    description: "Branches where medicine residents report strong ward learning & exam prep culture.",
    category: "branch",
    specialtySlug: "md-general-medicine",
    specialtyLabel: "MD General Medicine",
    entries: branchEntries("md-general-medicine", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Massive medicine wards", "Strong academics"],
        communityTip: "Medicine at KEM is a common 'dream pick' if cutoffs allow — expect intense duty.",
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["JJ medicine units", "High case variety"],
      },
      {
        rank: 3,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Sassoon medicine", "Slightly better QoL than Mumbai"],
      },
    ]),
  },
  {
    slug: "md-radiodiagnosis",
    title: "Best for MD Radiodiagnosis",
    description: "High scan volume & learning — historically among the most competitive branches.",
    category: "branch",
    specialtySlug: "md-radiodiagnosis",
    specialtyLabel: "MD Radiodiagnosis",
    entries: branchEntries("md-radiodiagnosis", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Busy radiology dept", "Wide modality exposure"],
        communityTip: "Radiodiagnosis cutoffs are brutal everywhere — KEM/Grant/BJMC lead most tier lists.",
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Strong radiodiagnosis OPD"],
      },
      {
        rank: 3,
        collegeSlug: "topiwala-national-medical-college",
        nameKeywords: ["Topiwala"],
        highlights: ["Nair Hospital radiology"],
      },
    ]),
  },
  {
    slug: "md-dermatology",
    title: "Best for MD Dermatology",
    description: "Derm seats are scarce — these see the fiercest competition in forums.",
    category: "branch",
    specialtySlug: "md-dermatology",
    specialtyLabel: "MD Dermatology",
    entries: branchEntries("md-dermatology", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Premium derm seat", "Very high cutoff"],
        communityTip: "Derm at top Mumbai colleges often needs top-tier AIR — verify latest MCC round data.",
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Established derm dept"],
      },
    ]),
  },
  {
    slug: "md-pediatrics",
    title: "Best for MD Pediatrics",
    description: "Paediatric training with good NICU/PICU exposure.",
    category: "branch",
    specialtySlug: "md-pediatrics",
    specialtyLabel: "MD Pediatrics",
    entries: branchEntries("md-pediatrics", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Large paediatric hospital"],
      },
      {
        rank: 2,
        collegeSlug: "lokmanya-tilak-municipal-medical-college",
        nameKeywords: ["Lokmanya Tilak"],
        highlights: ["Sion paediatrics", "High volume"],
      },
      {
        rank: 3,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Sassoon paediatrics"],
      },
    ]),
  },
  {
    slug: "ms-orthopedics",
    title: "Best for MS Orthopedics",
    description: "Ortho needs OT volume — these colleges are commonly recommended.",
    category: "branch",
    specialtySlug: "ms-orthopedics",
    specialtyLabel: "MS Orthopedics",
    entries: branchEntries("ms-orthopedics", [
      {
        rank: 1,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Trauma & ortho load"],
      },
      {
        rank: 2,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["KEM ortho OTs"],
      },
      {
        rank: 3,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Good ortho training"],
      },
    ]),
  },
  {
    slug: "ms-general-surgery",
    title: "Best for MS General Surgery",
    description: "Surgery residency — case load and assistantship matter most.",
    category: "branch",
    specialtySlug: "ms-general-surgery",
    specialtyLabel: "MS General Surgery",
    entries: branchEntries("ms-general-surgery", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Heavy surgical volume"],
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["JJ surgery units"],
      },
      {
        rank: 3,
        collegeSlug: "lokmanya-tilak-municipal-medical-college",
        nameKeywords: ["Lokmanya Tilak"],
        highlights: ["Trauma surgery exposure"],
      },
    ]),
  },
  {
    slug: "ms-obg",
    title: "Best for MS Obstetrics & Gynecology",
    description: "OBGYN — delivery load and labour room exposure.",
    category: "branch",
    specialtySlug: "ms-obg",
    specialtyLabel: "MS Obstetrics & Gynecology",
    entries: branchEntries("ms-obg", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["High delivery volume"],
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Busy OBG unit"],
      },
      {
        rank: 3,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Strong OBG at Sassoon"],
      },
    ]),
  },
  {
    slug: "md-anaesthesiology",
    title: "Best for MD Anaesthesiology",
    description: "Anaesthesia — OT list size and ICU cover matter.",
    category: "branch",
    specialtySlug: "md-anaesthesiology",
    specialtyLabel: "MD Anaesthesiology",
    entries: branchEntries("md-anaesthesiology", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["Large OT complex"],
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Wide surgical lists"],
      },
    ]),
  },
  {
    slug: "md-psychiatry",
    title: "Best for MD Psychiatry",
    description: "Psychiatry — OPD diversity and institute culture.",
    category: "branch",
    specialtySlug: "md-psychiatry",
    specialtyLabel: "MD Psychiatry",
    entries: branchEntries("md-psychiatry", [
      {
        rank: 1,
        collegeSlug: "topiwala-national-medical-college",
        nameKeywords: ["Topiwala"],
        highlights: ["Known psych dept at Nair"],
      },
      {
        rank: 2,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Urban psych exposure"],
      },
    ]),
  },
  {
    slug: "md-pathology",
    title: "Best for MD Pathology",
    description: "Pathology — slide load and reporting volume.",
    category: "branch",
    specialtySlug: "md-pathology",
    specialtyLabel: "MD Pathology",
    entries: branchEntries("md-pathology", [
      {
        rank: 1,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["High sample turnover"],
      },
      {
        rank: 2,
        collegeSlug: "bj-medical-college",
        nameKeywords: ["BJ Medical", "Pune"],
        highlights: ["Balanced path training"],
      },
    ]),
  },
  {
    slug: "ms-ophthalmology",
    title: "Best for MS Ophthalmology",
    description: "Ophthalmology — surgical eye volume.",
    category: "branch",
    specialtySlug: "ms-ophthalmology",
    specialtyLabel: "MS Ophthalmology",
    entries: branchEntries("ms-ophthalmology", [
      {
        rank: 1,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["JJ eye load"],
      },
      {
        rank: 2,
        collegeSlug: "seth-gordhandas-sunderdas-medical-college",
        nameKeywords: ["Seth", "Sunderdas"],
        highlights: ["KEM ophthalmology"],
      },
    ]),
  },
  {
    slug: "ms-ent",
    title: "Best for MS ENT",
    description: "ENT — OT cases and emergency cover.",
    category: "branch",
    specialtySlug: "ms-ent",
    specialtyLabel: "MS ENT",
    entries: branchEntries("ms-ent", [
      {
        rank: 1,
        collegeSlug: "grant-medical-college",
        nameKeywords: ["Grant Medical"],
        highlights: ["Busy ENT unit"],
      },
      {
        rank: 2,
        collegeSlug: "topiwala-national-medical-college",
        nameKeywords: ["Topiwala"],
        highlights: ["Nair ENT"],
      },
    ]),
  },
];

export function getCuratedGuide(slug: string): CuratedGuide | undefined {
  return CURATED_GUIDES.find((g) => g.slug === slug);
}

export function guidesByCategory(category: GuideCategory): CuratedGuide[] {
  return CURATED_GUIDES.filter((g) => g.category === category);
}
