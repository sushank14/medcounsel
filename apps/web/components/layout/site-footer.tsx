import Link from "next/link";
import { CREATOR } from "@/lib/creator";

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-xs leading-relaxed text-slate-500 sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <p>
          © {new Date().getFullYear()} MedCounsel ·{" "}
          <a
            href={CREATOR.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 hover:text-brand-600 hover:underline"
          >
            Built by {CREATOR.name}
          </a>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/profile/about" className="hover:text-brand-600 hover:underline">
            About MedCounsel
          </Link>
          <Link href="/profile/creator" className="hover:text-brand-600 hover:underline">
            About the Creator
          </Link>
          <Link href="/disclaimer" className="hover:text-brand-600 hover:underline">
            Disclaimer
          </Link>
        </div>
      </div>
    </footer>
  );
}
