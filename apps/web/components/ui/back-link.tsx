"use client";

import { useRouter } from "next/navigation";

type BackLinkProps = {
  /** Used when there is no prior in-app history (direct link / new tab) */
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackLink({
  fallbackHref = "/",
  label = "← Back",
  className = "text-sm text-brand-600 hover:underline",
}: BackLinkProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <a href={fallbackHref} onClick={handleClick} className={className}>
      {label}
    </a>
  );
}
