/**
 * Seat matrix comparison fixtures (not production data).
 * Run: tsx src/maharashtra-seat-matrix-compare.test.ts
 */

type Row = {
  college_name_norm: string;
  branch_name_norm: string;
  degree: string;
  category: string;
  quota: string;
  seat_count: number;
};

function key(r: Row) {
  return `${r.college_name_norm}|${r.degree}-${r.branch_name_norm}|${r.category}|${r.quota}`;
}

function compareMaps(a: Row[], b: Row[]) {
  const ma = new Map<string, number>();
  const mb = new Map<string, number>();
  for (const r of a) ma.set(key(r), (ma.get(key(r)) ?? 0) + r.seat_count);
  for (const r of b) mb.set(key(r), (mb.get(key(r)) ?? 0) + r.seat_count);
  const out: Array<{ change: number; status: string }> = [];
  for (const k of new Set([...ma.keys(), ...mb.keys()])) {
    const sa = ma.get(k);
    const sb = mb.get(k);
    if (sa == null && sb != null) out.push({ change: sb, status: "new" });
    else if (sa != null && sb == null) out.push({ change: -sa, status: "removed" });
    else if (sa != null && sb != null) {
      const d = sb - sa;
      out.push({
        change: d,
        status: d > 0 ? "increased" : d < 0 ? "decreased" : "unchanged",
      });
    }
  }
  return out;
}

const base: Row = {
  college_name_norm: "Test Medical College",
  branch_name_norm: "General Medicine",
  degree: "MD",
  category: "OBC",
  quota: "STATE",
  seat_count: 5,
};

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

const c1 = compareMaps([{ ...base, seat_count: 5 }], [{ ...base, seat_count: 8 }]);
assert(c1[0]?.change === 3 && c1[0]?.status === "increased", "case1 +3");

const c2 = compareMaps([{ ...base, seat_count: 10 }], [{ ...base, seat_count: 6 }]);
assert(c2[0]?.change === -4 && c2[0]?.status === "decreased", "case2 -4");

const c3 = compareMaps([{ ...base, seat_count: 4 }], [{ ...base, seat_count: 4 }]);
assert(c3[0]?.change === 0 && c3[0]?.status === "unchanged", "case3 0");

const c4 = compareMaps([], [{ ...base, seat_count: 2 }]);
assert(c4[0]?.status === "new", "case4 new");

const c5 = compareMaps([{ ...base, seat_count: 3 }], []);
assert(c5[0]?.status === "removed", "case5 removed");

if (failed) process.exit(1);
console.log("✅ maharashtra-seat-matrix-compare fixture tests passed");
