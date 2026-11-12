"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddPreferenceButton } from "@/components/mcc-finder/add-preference-button";
import { usePreferenceIds } from "@/components/mcc-finder/preference-store";
import { groupLabel, sourceLabel, type FinderRecord } from "@/lib/mcc-college-finder";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadExcel(rows: FinderRecord[]) {
  const headers = ["Order", "College", "Code", "State", "Institute type", "Seat type", "Speciality", "Degree", "Quota", "Seat category", "PwD", "Seats", "Availability", "PDF page"];
  const headerXml = headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join("");
  const body = rows
    .map((row, index) => {
      const cells = [
        index + 1,
        row.institute,
        row.code,
        row.state,
        row.officialType,
        groupLabel(row.group),
        row.branch,
        row.degree,
        row.quota,
        row.seatCategory,
        row.pwd ? "YES" : "NO",
        row.seats ?? "",
        sourceLabel(row.source),
        row.page,
      ];
      return `<Row>${cells
        .map((cell) =>
          typeof cell === "number"
            ? `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
            : `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`
        )
        .join("")}</Row>`;
    })
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Preferences"><Table><Row>${headerXml}</Row>${body}</Table></Worksheet>
</Workbook>`;
  const url = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "MCC_College_Finder_Preferences_2026.xls";
  link.click();
  URL.revokeObjectURL(url);
}

export function PreferenceListEditor() {
  const [ids, setIds] = usePreferenceIds();
  const [rows, setRows] = useState<FinderRecord[]>([]);
  const [focus, setFocus] = useState<"all" | "preferred">("all");
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    fetch("/api/mcc-college-finder/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((response) => response.json())
      .then((payload: { rows: FinderRecord[] }) => {
        if (!cancelled) setRows(payload.rows);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const visible = rows.filter((row) => {
    if (focus === "all") return true;
    return row.group === "government_mdms" || row.group === "government_other" || row.group === "dnb";
  });

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setIds(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`rounded-lg px-3 py-1.5 text-sm ${focus === "all" ? "bg-brand-600 text-white" : "border border-slate-200"}`} onClick={() => setFocus("all")}>
          All saved
        </button>
        <button type="button" className={`rounded-lg px-3 py-1.5 text-sm ${focus === "preferred" ? "bg-brand-600 text-white" : "border border-slate-200"}`} onClick={() => setFocus("preferred")}>
          Government and DNB
        </button>
        <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={() => downloadExcel(visible)} disabled={visible.length === 0}>
          Export Excel
        </button>
        <Link href="/mcc-college-finder" className="text-sm text-brand-700 hover:underline">
          Back to finder
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        Drag a row to set your own order. Vacancy counts are not used to rank this list. {ids.length.toLocaleString("en-IN")} saved.
      </p>
      {visible.length === 0 ? <p className="text-sm text-slate-500">No preferences in this view.</p> : null}
      <ol className="space-y-2">
        {visible.map((row) => {
          const index = ids.indexOf(row.id);
          return (
            <li
              key={row.id}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) move(dragFrom, index);
                setDragFrom(null);
              }}
              className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm active:cursor-grabbing"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {index + 1}. {row.institute}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.state} · {row.code} · {groupLabel(row.group)}
                    {row.dnbKind ? ` (${row.dnbKind} DNB)` : ""} · {row.officialType}
                  </p>
                  <p className="mt-1">{row.branch}</p>
                  <p className="text-xs text-slate-600">
                    {row.quota} · {row.seatCategory}
                    {row.pwd ? " · PwD" : ""} · {row.seats ?? "—"} seats · {sourceLabel(row.source)} p.{row.page}
                  </p>
                </div>
                <AddPreferenceButton id={row.id} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
