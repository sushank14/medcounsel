import { describe, expect, it } from "vitest";
import {
  inferCollegeTypeFromName,
  qualifiesAsGovernmentCollege,
} from "@medcounsel/types";

describe("college-type (Maharashtra private vs govt)", () => {
  it("Vedanta Palghar is private", () => {
    expect(inferCollegeTypeFromName("Vedanta Medical College, Palghar")).toBe("PRIVATE");
    expect(
      qualifiesAsGovernmentCollege("Vedanta Medical College, Palghar", "GOVT")
    ).toBe(false);
  });

  it("Grant Medical College Mumbai is government", () => {
    expect(inferCollegeTypeFromName("Grant Medical College, Mumbai")).toBe("GOVT");
  });

  it("KJ Somaiya is private", () => {
    expect(inferCollegeTypeFromName("KJ Somaiya Medical College, Mumbai")).toBe("PRIVATE");
  });
});
