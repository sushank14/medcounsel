"use client";

import { MAHARASHTRA_CITIES } from "@medcounsel/types";
import { cn } from "@/lib/utils";

interface CityChipPickerProps {
  selected: string[];
  onChange: (cities: string[]) => void;
  className?: string;
}

export function CityChipPicker({ selected, onChange, className }: CityChipPickerProps) {
  const toggle = (city: string) => {
    onChange(
      selected.includes(city) ? selected.filter((c) => c !== city) : [...selected, city]
    );
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {MAHARASHTRA_CITIES.map((city) => {
        const active = selected.includes(city);
        return (
          <button
            key={city}
            type="button"
            onClick={() => toggle(city)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {city}
          </button>
        );
      })}
    </div>
  );
}
