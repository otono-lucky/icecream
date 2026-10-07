import { describe, expect, it } from "vitest";

import { ageOn, isValidDateOfBirth, normalizeEmail } from "../../contracts";

describe("ageOn", () => {
  it("counts the birthday itself", () => {
    expect(ageOn("1991-09-25", "2026-09-25")).toBe(35);
    expect(ageOn("1991-09-26", "2026-09-25")).toBe(34);
  });

  it("handles 29 February", () => {
    expect(ageOn("1988-02-29", "2023-02-28")).toBe(34);
    expect(ageOn("1988-02-29", "2023-03-01")).toBe(35);
  });
});

describe("isValidDateOfBirth", () => {
  it("rejects impossible, badly formatted and future dates", () => {
    expect(isValidDateOfBirth("1980-02-30", "2026-09-25")).toBe(false);
    expect(isValidDateOfBirth("20-05-1980", "2026-09-25")).toBe(false);
    expect(isValidDateOfBirth("2027-01-01", "2026-09-25")).toBe(false);
    expect(isValidDateOfBirth("1980-05-20", "2026-09-25")).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada.Obi@Example.COM ")).toBe("ada.obi@example.com");
  });

  it.each(["", "ada", "ada@", "ada@example", "ada @example.com", "ada@example.c"])("rejects %j", (input) => {
    expect(normalizeEmail(input)).toBeUndefined();
  });
});
