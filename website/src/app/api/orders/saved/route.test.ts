import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  generateOrderId: vi.fn(),
  runOrderSolve: vi.fn(),
  orders: { find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() },
  users: { findOne: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: (name: string) => (name === "users" ? mocks.users : mocks.orders) }) },
}));
vi.mock("@/lib/orders/generateOrderId", () => ({ generateOrderId: mocks.generateOrderId }));
vi.mock("@/lib/solver/server/runOrderSolve", () => ({ runOrderSolve: mocks.runOrderSolve }));

import { GET, POST } from "./route";

const CUSTOMER_ID = "65f0a1b2c3d4e5f6a7b8c9d0";
const as = (role: string, userId = "me") => mocks.getAuthUser.mockResolvedValue({ userId, username: `${role}-user`, email: "x@x.com", role });
const item = { ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 };
const newOrder = { source: "Manual", status: "Available", items: [item] };
const post = (body: unknown) => POST(new Request("http://localhost/api/orders/saved", { method: "POST", body: JSON.stringify(body) }));

describe("GET /api/orders/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orders.find.mockReturnValue({ sort: () => ({ toArray: async () => [{ orderId: "PF-000001" }] }) });
  });

  it("requires a login", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/orders/saved"))).status).toBe(401);
  });

  it("shows customers only their own orders", async () => {
    as("customer", "c1");
    await GET(new Request("http://localhost/api/orders/saved?customerId=someone-else"));
    expect(mocks.orders.find.mock.calls[0][0]).toEqual({ customerId: "c1" });
  });

  it("lets staff see all orders, or one customer's", async () => {
    as("team");
    await GET(new Request("http://localhost/api/orders/saved"));
    await GET(new Request("http://localhost/api/orders/saved?customerId=c9"));
    expect(mocks.orders.find.mock.calls.map((c) => c[0])).toEqual([{}, { customerId: "c9" }]);
  });

  it("never returns the internal owner id", async () => {
    as("supervisor");
    const response = await GET(new Request("http://localhost/api/orders/saved"));
    expect(mocks.orders.find.mock.calls[0][1]).toEqual({ projection: { _id: 0, ownerUserId: 0 } });
    expect(await response.json()).toEqual({ orders: [{ orderId: "PF-000001" }] });
  });
});

describe("POST /api/orders/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateOrderId.mockResolvedValue("PF-000042");
    mocks.orders.findOne.mockResolvedValueOnce(null).mockResolvedValue({ orderId: "PF-000042", progress: "ready" });
    mocks.orders.updateOne.mockResolvedValue({});
    mocks.runOrderSolve.mockResolvedValue({ ok: true });
    mocks.users.findOne.mockResolvedValue({ username: "cust1" });
  });

  it("creates a customer's order under their own account and solves it", async () => {
    as("customer", "c1");
    const response = await post(newOrder);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ orderId: "PF-000042", progress: "ready" });

    const [filter, update] = mocks.orders.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> }];
    expect(filter).toEqual({ orderId: "PF-000042" });
    expect(update.$set).toMatchObject({ orderId: "PF-000042", customerId: "c1", customerName: "customer-user", ownerUserId: "c1", items: [item] });
    expect(update.$setOnInsert).toMatchObject({ progress: "submitted" });
    expect(mocks.runOrderSolve).toHaveBeenCalledWith("PF-000042");
  });

  it("ignores any orderId sent by the client", async () => {
    as("customer", "c1");
    await post({ ...newOrder, orderId: "HACKED-1" });
    expect((mocks.orders.updateOne.mock.calls[0][1] as { $set: { orderId: string } }).$set.orderId).toBe("PF-000042");
  });

  it("requires staff to say which customer the order is for", async () => {
    as("supervisor");
    expect((await post(newOrder)).status).toBe(400);
    expect((await post({ ...newOrder, customerId: "bad" })).status).toBe(400);
    mocks.users.findOne.mockResolvedValueOnce(null);
    expect((await post({ ...newOrder, customerId: CUSTOMER_ID })).status).toBe(404);
  });

  it("lets staff create an order for a real customer", async () => {
    as("supervisor");
    await post({ ...newOrder, customerId: CUSTOMER_ID });
    expect((mocks.orders.updateOne.mock.calls[0][1] as { $set: Record<string, unknown> }).$set).toMatchObject({
      customerId: CUSTOMER_ID,
      customerName: "cust1",
    });
  });

  it("rejects invalid orders with the validation message", async () => {
    as("customer");
    const response = await post({ ...newOrder, items: [{ ...item, Weight: 0 }] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Item 1 has invalid dimensions." });
    expect(mocks.orders.updateOne).not.toHaveBeenCalled();
  });

  it("never overwrites an existing order", async () => {
    as("customer");
    mocks.orders.findOne.mockReset().mockResolvedValue({ orderId: "PF-000042" });
    expect((await post(newOrder)).status).toBe(409);
    expect(mocks.orders.updateOne).not.toHaveBeenCalled();
  });
});
