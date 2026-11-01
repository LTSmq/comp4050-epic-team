import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateOrderId: vi.fn(),
  runOrderSolve: vi.fn(),
  orders: { insertOne: vi.fn(), findOne: vi.fn() },
  users: { findOne: vi.fn() },
}));

vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: (name: string) => (name === "users" ? mocks.users : mocks.orders) }) },
}));
vi.mock("@/lib/orders/generateOrderId", () => ({ generateOrderId: mocks.generateOrderId }));
vi.mock("@/lib/solver/server/runOrderSolve", () => ({ runOrderSolve: mocks.runOrderSolve }));

import { POST } from "./route";

const KEY = "test-intake-key";
const CUSTOMER_ID = "65f0a1b2c3d4e5f6a7b8c9d0";
const item = { ItemCode: "EXT-1", ItemReference: "Box", Width: 100, Length: 100, Depth: 100, Weight: 500 };
const send = (body: unknown, key: string | null = KEY) =>
  POST(
    new Request("http://localhost/api/orders/intake", {
      method: "POST",
      headers: key === null ? {} : { "x-api-key": key },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/orders/intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ORDER_INTAKE_API_KEY", KEY);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateOrderId.mockResolvedValue("PF-000100");
    mocks.orders.insertOne.mockResolvedValue({});
    mocks.orders.findOne.mockResolvedValue({ orderId: "PF-000100", progress: "ready", assignedUserName: "pack1" });
    mocks.runOrderSolve.mockResolvedValue({ ok: true });
    mocks.users.findOne.mockResolvedValue({ username: "cust1" });
  });

  it("rejects a missing or wrong API key", async () => {
    expect((await send({ items: [item] }, null)).status).toBe(401);
    expect((await send({ items: [item] }, "wrong")).status).toBe(401);
    expect(mocks.orders.insertOne).not.toHaveBeenCalled();
  });

  it("creates an External order with a system ID, solves it and returns the result", async () => {
    const response = await send({ items: [item] });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ orderId: "PF-000100", assignedUserName: "pack1" });
    expect(mocks.orders.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "PF-000100",
        source: "External",
        status: "Available",
        items: [item],
        customerId: null,
        customerName: "Unassigned",
        progress: "submitted",
      })
    );
    expect(mocks.runOrderSolve).toHaveBeenCalledWith("PF-000100");
  });

  it("ignores any system fields the sender tries to set", async () => {
    await send({ items: [item], orderId: "MINE", progress: "packed", assignedUserId: "x", source: "Manual" });
    expect(mocks.orders.insertOne.mock.calls[0][0]).toMatchObject({ orderId: "PF-000100", progress: "submitted", source: "External" });
    expect(mocks.orders.insertOne.mock.calls[0][0]).not.toHaveProperty("assignedUserId");
  });

  it("links the order to a real customer when given", async () => {
    await send({ items: [item], customerId: CUSTOMER_ID });
    expect(mocks.orders.insertOne.mock.calls[0][0]).toMatchObject({ customerId: CUSTOMER_ID, customerName: "cust1" });
  });

  it("rejects an invalid or unknown customer", async () => {
    expect((await send({ items: [item], customerId: "nope" })).status).toBe(400);
    mocks.users.findOne.mockResolvedValue(null);
    expect((await send({ items: [item], customerId: CUSTOMER_ID })).status).toBe(404);
  });

  it("rejects invalid items without creating an order", async () => {
    const response = await send({ items: [{ ...item, Weight: 0 }] });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.orders.insertOne).not.toHaveBeenCalled();
  });
});
