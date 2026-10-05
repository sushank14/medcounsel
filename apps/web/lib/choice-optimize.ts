import type { FitLevel, PredictionInput, PredictionResult } from "@medcounsel/types";
import { normalizePriorities } from "@medcounsel/types";

const FIT_ORDER: Record<FitLevel, number> = {
  STRONG: 0,
  POSSIBLE: 1,
  BORDERLINE: 2,
  DIFFICULT: 3,
};

export type ChoiceListItem = {
  id: string;
  collegeId: string;
  specialtyId: string;
  collegeName: string;
  specialtyName: string;
  degree: string;
  state: string;
  city: string;
  fitLevel?: FitLevel;
};

export type OptimizedChoice = ChoiceListItem & {
  explanation: string;
  sortScore: number;
};

function matchesPreferredBranch(
  specialtyName: string,
  degree: string,
  preferred: string[]
): boolean {
  if (!preferred.length) return true;
  const label = `${degree} ${specialtyName}`.toLowerCase();
  return preferred.some(
    (p) =>
      label.includes(p.toLowerCase()) ||
      p.toLowerCase().includes(specialtyName.toLowerCase())
  );
}

function priorityScoreFromResult(
  result: PredictionResult,
  priorities: string[],
  input: PredictionInput
): number {
  let score = 0;
  priorities.forEach((priority, index) => {
    const weight = priorities.length - index;
    switch (priority) {
      case "Branch":
        if (
          input.preferredSpecialties?.some(
            (p) =>
              result.specialtyName.toLowerCase().includes(p.toLowerCase()) ||
              p.toLowerCase().includes(result.specialtyName.toLowerCase())
          )
        ) {
          score += weight * 20;
        }
        break;
      case "Location":
        if (result.state === input.domicileState) score += weight * 15;
        if (result.city && input.preferredCities?.includes(result.city)) score += weight * 20;
        break;
      case "Government college":
        if (result.collegeType === "GOVT" || result.collegeType === "CENTRAL") score += weight * 15;
        break;
      case "Fees":
        if (result.fees) score += weight * Math.max(0, 2_000_000 - result.fees.totalAnnual) / 100_000;
        else score += weight * 2;
        break;
      case "Stipend":
        if (result.stipend) score += weight * (result.stipend.totalMonthly / 5000);
        break;
      case "Bond":
        if (!result.bond?.bondAmount) score += weight * 10;
        break;
      default:
        break;
    }
  });
  return score;
}

function explainPlacement(
  item: ChoiceListItem,
  result: PredictionResult | undefined,
  input: PredictionInput,
  rank: number,
  prev?: OptimizedChoice
): string {
  if (rank === 1) {
    return "Top of suggested order — best balance of your priorities and fit level.";
  }

  const priorities = normalizePriorities(input.priorityRanking);
  const branchFirst = priorities[0] === "Branch";
  const branchMatch = matchesPreferredBranch(
    item.specialtyName,
    item.degree,
    input.preferredSpecialties ?? []
  );

  if (branchFirst && !branchMatch && prev && matchesPreferredBranch(prev.specialtyName, prev.degree, input.preferredSpecialties ?? [])) {
    return "Placed lower because it does not match your preferred branch (Branch is your #1 priority).";
  }

  if (result && prev?.fitLevel && result.fitLevel && FIT_ORDER[result.fitLevel] > FIT_ORDER[prev.fitLevel as FitLevel]) {
    return `Placed lower because fit is ${result.fitLevel.toLowerCase()} vs ${prev.fitLevel.toLowerCase()} for the option above.`;
  }

  if (priorities.includes("Fees") && result?.fees && input.budgetRange && input.budgetRange !== "NO_RESTRICTION") {
    return "Order considers your fee/budget priority alongside branch preference.";
  }

  if (priorities.includes("Government college") && result?.collegeType === "PRIVATE") {
    return "Placed lower — private college while Government college is in your priorities.";
  }

  if (priorities.includes("Location") && result && result.state !== input.domicileState) {
    return "Placed lower — outside your domicile state while Location is a priority.";
  }

  return "Ordered by your saved priority ranking and historical fit.";
}

/**
 * Suggest choice order respecting branch preference over raw fit alone.
 */
export function optimizeChoiceOrder(
  items: ChoiceListItem[],
  predictions: PredictionResult[],
  input: PredictionInput
): OptimizedChoice[] {
  const priorities = normalizePriorities(input.priorityRanking);
  const branchPriorityHigh = priorities.indexOf("Branch") <= 1;

  const enriched = items.map((item) => {
    const pred =
      predictions.find(
        (p) => p.collegeId === item.collegeId && p.specialtyId === item.specialtyId
      ) ?? null;
    const fitLevel = (pred?.fitLevel ?? item.fitLevel ?? "DIFFICULT") as FitLevel;
    const branchMatch = matchesPreferredBranch(
      item.specialtyName,
      item.degree,
      input.preferredSpecialties ?? []
    );
    const branchRank = branchMatch ? 0 : 1;
    const priScore = pred ? priorityScoreFromResult(pred, priorities, input) : 0;
    const fitRank = FIT_ORDER[fitLevel];
    const diff = pred ? Math.abs(pred.candidateDiff) : 99999;

    const sortScore =
      (branchPriorityHigh ? branchRank * 1000 : branchRank * 100) +
      fitRank * 10 -
      priScore * 0.1 +
      diff * 0.0001;

    return {
      ...item,
      fitLevel,
      sortScore,
      _pred: pred,
    };
  });

  enriched.sort((a, b) => a.sortScore - b.sortScore);

  const out: OptimizedChoice[] = [];
  enriched.forEach((row, i) => {
    const { _pred, sortScore, ...item } = row;
    out.push({
      ...item,
      sortScore,
      explanation: explainPlacement(item, _pred ?? undefined, input, i + 1, out[i - 1]),
    });
  });

  return out;
}
