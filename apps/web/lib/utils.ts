import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)} lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatRank(rank: number, rankType?: string): string {
  const formatted = rank.toLocaleString("en-IN");
  if (rankType === "SML") return `${formatted} (SML)`;
  return `${formatted} (AIR)`;
}
