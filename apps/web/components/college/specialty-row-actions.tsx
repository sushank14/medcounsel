"use client";

import { AddToChoiceButton } from "@/components/preference/add-to-choice-button";
import { AddToCompareButton } from "@/components/compare/add-to-compare-button";

export function SpecialtyRowActions({
  collegeId,
  specialtyId,
}: {
  collegeId: string;
  specialtyId: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <AddToChoiceButton collegeId={collegeId} specialtyId={specialtyId} compact />
      <AddToCompareButton collegeId={collegeId} specialtyId={specialtyId} compact />
    </div>
  );
}
