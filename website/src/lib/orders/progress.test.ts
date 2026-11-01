import { describe, expect, it } from "vitest";
import {
  CLAIM_TTL_MS,
  ORDER_PROGRESS,
  PACKED_WINDOW_MS,
  formatAge,
  isClaimStale,
  progressLabel,
  type OrderProgress,
} from "./progress";

describe("progressLabel", () => {
  it("shows customers only Submitted or Packed", () => {
    for (const p of ORDER_PROGRESS) {
      expect(progressLabel(p, "customer")).toBe(p === "packed" ? "Packed" : "Submitted");
    }
  });

  it("shows staff the exact state", () => {
    const expected: Record<OrderProgress, string> = {
      submitted: "Submitted",
      solving: "Solving",
      ready: "3D Ready",
      packing: "Packing",
      packed: "Packed",
      on_hold: "On hold",
      failed: "Failed",
    };
    for (const p of ORDER_PROGRESS) {
      expect(progressLabel(p, "team")).toBe(expected[p]);
      expect(progressLabel(p, "supervisor")).toBe(expected[p]);
    }
  });

  it("treats a missing progress as Submitted", () => {
    expect(progressLabel(undefined, "supervisor")).toBe("Submitted");
    expect(progressLabel(undefined, "customer")).toBe("Submitted");
  });
});

describe("isClaimStale", () => {
  const claimedAt = "2026-11-01T10:00:00.000Z";
  const at = (msAfter: number) => Date.parse(claimedAt) + msAfter;

  it("is false within 30 minutes of the claim", () => {
    expect(isClaimStale({ progress: "packing", claimedAt }, at(CLAIM_TTL_MS))).toBe(false);
  });

  it("is true once 30 minutes have passed", () => {
    expect(isClaimStale({ progress: "packing", claimedAt }, at(CLAIM_TTL_MS + 1))).toBe(true);
  });

  it("only applies to orders being packed", () => {
    expect(isClaimStale({ progress: "ready", claimedAt }, at(CLAIM_TTL_MS * 10))).toBe(false);
    expect(isClaimStale({ progress: "packing", claimedAt: null }, at(CLAIM_TTL_MS * 10))).toBe(false);
  });
});

describe("formatAge", () => {
  const start = "2026-11-01T10:00:00.000Z";
  const after = (minutes: number) => Date.parse(start) + minutes * 60_000;

  it("formats minutes, hours and days", () => {
    expect(formatAge(start, after(0.5))).toBe("just now");
    expect(formatAge(start, after(4))).toBe("4m");
    expect(formatAge(start, after(59))).toBe("59m");
    expect(formatAge(start, after(60))).toBe("1h");
    expect(formatAge(start, after(23 * 60 + 59))).toBe("23h");
    expect(formatAge(start, after(3 * 24 * 60))).toBe("3d");
  });

  it("returns an empty string without a time", () => {
    expect(formatAge(null, after(5))).toBe("");
  });

  it("never shows a negative age for clock skew", () => {
    expect(formatAge(start, after(-10))).toBe("just now");
  });
});

describe("constants", () => {
  it("lists every progress state once", () => {
    expect(new Set(ORDER_PROGRESS).size).toBe(7);
  });

  it("uses a 30 minute claim expiry and a 12 hour packed window", () => {
    expect(CLAIM_TTL_MS).toBe(30 * 60 * 1000);
    expect(PACKED_WINDOW_MS).toBe(12 * 60 * 60 * 1000);
  });
});
