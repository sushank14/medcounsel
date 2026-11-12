import assert from "node:assert/strict";
import { loadFinder } from "./mcc-college-finder-data.ts";
import {
  filterRecords,
  matchesSpecialty,
  sortRecords,
  sourceTotals,
  type FinderRecord,
} from "./mcc-college-finder.ts";

function row(partial: Partial<FinderRecord> & Pick<FinderRecord, "id" | "source" | "group" | "seatCategory" | "branchCode">): FinderRecord {
  return {
    state: "Maharashtra",
    officialType: "All India except Central University",
    dnbKind: "",
    degree: "MD",
    institute: "Test College",
    code: "100001",
    quota: "All India",
    branch: "M.D. General Medicine (GMED)",
    category: "BC NO",
    pwd: false,
    seats: 1,
    page: 1,
    flag: "",
    ...partial,
  };
}

const sample: FinderRecord[] = [
  row({ id: "c1", source: "clear", group: "government_mdms", seatCategory: "OBC", branchCode: "GMED", category: "BC NO" }),
  row({ id: "c2", source: "clear", group: "government_mdms", seatCategory: "Open", branchCode: "RADD", category: "OP NO", branch: "M.D. Radio-Diagnosis /Radiology (RADD)" }),
  row({ id: "v1", source: "virtual", group: "dnb", seatCategory: "OBC", branchCode: "DMED", degree: "DNB", dnbKind: "private", officialType: "Diplomate of National Board (DNB) (Pvt.) PG", seats: 2 }),
  row({ id: "n1", source: "new", group: "deemed", seatCategory: "Open", branchCode: "GMED", officialType: "Deemed University" }),
  row({ id: "s1", source: "clear", group: "government_mdms", seatCategory: "SC", branchCode: "GMED", category: "SC NO" }),
];

const base = { q: "", city: "", state: "", group: "", category: "both" as const, source: "", specs: [], sort: "priority", page: 1, code: "", pick: [] };

const both = filterRecords(sample, base);
assert.deepEqual(both.map((item) => item.id).sort(), ["c1", "c2", "n1", "v1"]);
assert.equal(filterRecords(sample, { ...base, category: "obc" }).every((item) => item.seatCategory === "OBC"), true);
assert.equal(filterRecords(sample, { ...base, category: "open" }).every((item) => item.seatCategory === "Open"), true);
assert.equal(filterRecords(sample, { ...base, group: "government" }).every((item) => item.group.startsWith("government")), true);
assert.equal(filterRecords(sample, { ...base, group: "dnb" }).length, 1);
assert.equal(filterRecords(sample, { ...base, group: "private" }).length, 0);
assert.equal(filterRecords(sample, { ...base, state: "Maharashtra" }).length, both.length);
assert.equal(filterRecords(sample, { ...base, specs: ["md-radd"] }).every((item) => item.branchCode === "RADD"), true);
assert.equal(filterRecords(sample, { ...base, source: "clear" }).every((item) => item.source === "clear"), true);
assert.equal(filterRecords(sample, { ...base, source: "virtual" }).every((item) => item.source === "virtual"), true);
assert.equal(filterRecords(sample, { ...base, source: "new" }).every((item) => item.source === "new"), true);

const totals = sourceTotals(both);
assert.equal(totals.clear.seats + totals.virtual.seats + totals.new.seats, 1 + 1 + 2 + 1);
assert.notEqual(totals.clear.seats, totals.clear.seats + totals.virtual.seats);

const ordered = sortRecords(both, "priority");
assert.equal(ordered[0].group, "government_mdms");
assert.equal(ordered.at(-1)?.group, "deemed");
assert.equal(matchesSpecialty(sample[2], ["dnb-med"]), true);
assert.equal(matchesSpecialty(sample[2], ["md-gmed"]), false);

const data = loadFinder();
assert.equal(data.records.length, 2443 + 10424 + 11312);
const allTotals = sourceTotals(data.records);
assert.equal(allTotals.clear.seats, 15408);
assert.equal(allTotals.virtual.seats, 18189);
assert.equal(allTotals.new.seats, 3678);
const eligible = filterRecords(data.records, base);
assert.equal(eligible.length, data.records.filter((item) => item.seatCategory === "OBC" || item.seatCategory === "Open").length);
const mah = filterRecords(data.records, { ...base, state: "Maharashtra" });
assert.equal(mah.every((item) => item.state === "Maharashtra"), true);
assert.ok(mah.length > 0);
const govDnb = filterRecords(data.records, { ...base, group: "government" }).length + filterRecords(data.records, { ...base, group: "dnb" }).length;
assert.equal(filterRecords(data.records, { ...base, group: "government" }).some((item) => item.group === "dnb"), false);
assert.ok(govDnb > 0);

console.log("ok");
