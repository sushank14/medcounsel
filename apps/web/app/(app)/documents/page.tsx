"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  COMMON_NEET_PG_DOCUMENTS,
  AIQ_SPECIFIC_DOCUMENTS,
  STATE_SPECIFIC_DOCUMENTS,
  type DocumentItem,
} from "@medcounsel/types";
import { DisclaimerBanner } from "@/components/layout/disclaimer-banner";

const STORAGE_KEY = "medcounsel-doc-checklist-v1";

function DocSection({
  title,
  items,
  checked,
  onToggle,
}: {
  title: string;
  items: DocumentItem[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="card card-body section-block">
      <h2 className="section-title">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((doc) => (
          <li key={doc.id} className="flex items-start gap-3 rounded-lg border px-3 py-2">
            <input
              type="checkbox"
              id={doc.id}
              checked={!!checked[doc.id]}
              onChange={() => onToggle(doc.id)}
              className="mt-1"
            />
            <label htmlFor={doc.id} className="flex-1 cursor-pointer text-sm">
              <span className={checked[doc.id] ? "text-slate-500 line-through" : ""}>{doc.label}</span>
              {doc.note && <span className="mt-0.5 block text-xs text-slate-500">{doc.note}</span>}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DocumentsPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const allDocs = [...COMMON_NEET_PG_DOCUMENTS, ...AIQ_SPECIFIC_DOCUMENTS, ...STATE_SPECIFIC_DOCUMENTS];
  const done = allDocs.filter((d) => checked[d.id]).length;

  return (
    <div className="page">
      <header className="page-header">
        <div className="space-y-2">
          <h1 className="page-title">My documents</h1>
          <p className="page-lead">
            Track registration documents for AIQ and state counselling. Requirements vary — verify on official portals.
          </p>
          <p className="text-sm text-slate-500">
            {done} of {allDocs.length} marked ready (saved on this device)
          </p>
        </div>
      </header>

      <DisclaimerBanner compact />

      <DocSection title="Common (all candidates)" items={COMMON_NEET_PG_DOCUMENTS} checked={checked} onToggle={toggle} />
      <DocSection title="MCC AIQ" items={AIQ_SPECIFIC_DOCUMENTS} checked={checked} onToggle={toggle} />
      <DocSection
        title="State counselling (Maharashtra)"
        items={STATE_SPECIFIC_DOCUMENTS.filter((d) => d.stateSpecific === "Maharashtra")}
        checked={checked}
        onToggle={toggle}
      />

      <p className="text-xs text-slate-500">
        This checklist is a planning aid only. Final document requirements are on{" "}
        <a href="https://mcc.nic.in/pg-medical-counselling/" className="text-brand-600 underline" target="_blank" rel="noreferrer">
          mcc.nic.in
        </a>{" "}
        and your state CET portal.{" "}
        <Link href="/counselling" className="text-brand-600 underline">
          Counselling hub →
        </Link>
      </p>
    </div>
  );
}
