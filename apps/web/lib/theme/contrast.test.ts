import { describe, expect, it } from "vitest";
import { contrastRatio, meetsWcagAA } from "./contrast";

describe("contrastRatio", () => {
  it("is 21:1 for black on white (maximum possible contrast)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is 1:1 for identical colors", () => {
    expect(contrastRatio("#3366cc", "#3366cc")).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    expect(contrastRatio("#123456", "#fedcba")).toBeCloseTo(contrastRatio("#fedcba", "#123456"), 10);
  });

  it("supports 3-digit shorthand hex", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 0);
  });
});

describe("meetsWcagAA", () => {
  it("requires 4.5:1 for normal text", () => {
    expect(meetsWcagAA(4.5)).toBe(true);
    expect(meetsWcagAA(4.4)).toBe(false);
  });

  it("only requires 3:1 for large text / UI components", () => {
    expect(meetsWcagAA(3, true)).toBe(true);
    expect(meetsWcagAA(2.9, true)).toBe(false);
  });
});
