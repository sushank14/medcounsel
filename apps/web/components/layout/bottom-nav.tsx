"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Search, List, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/my-chances", label: "Chances", icon: Target },
  { href: "/colleges", label: "Search", icon: Search },
  { href: "/preferences", label: "Prefs", icon: List },
  { href: "/simulator", label: "More", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="flex items-center justify-around py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
                active ? "text-brand-600" : "text-slate-500"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
