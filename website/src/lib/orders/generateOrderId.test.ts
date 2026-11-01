
import { describe, expect, it } from "vitest";
import { generateOrderId } from "./generateOrderId";

describe("generateOrderId", () => {
  it("generates an ID with the correct format", () => {
    const orderId = generateOrderId();

    expect(orderId).toMatch(
      /^ORD-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("generates a unique ID each time", () => {
    const firstId = generateOrderId();
    const secondId = generateOrderId();

    expect(firstId).not.toBe(secondId);
  });
});
