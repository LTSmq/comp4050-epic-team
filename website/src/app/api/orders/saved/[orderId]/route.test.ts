import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  runOrderSolve: vi.fn(),
  deleteSolution: vi.fn(),
  orders: { findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/mongodb", () => ({ default: { db: () => ({ collection: () => mocks.orders }) } }));
vi.mock("@/lib/solver/server/runOrderSolve", () => ({ runOrderSolve: mocks.runOrderSolve }));
vi.mock("@/app/lib/solutionStore", () => ({ deleteSolution: mocks.deleteSolution }));

import { DELETE, GET, PUT } from "./route";

const as = (role: string, userId = "me") => mocks.getAuthUser.mockResolvedValue({ userId, username: "u", email: "x@x.com", role });
const ctx = (orderId = "PF-000001") => ({ params: Promise.resolve({ orderId }) });
const item = { ItemCode: "A", ItemReference: "Mug", Width: 120, Length: 95, Depth: 100, Weight: 350 };
const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/orders/saved/PF-000001", { method: "PUT", body: JSON.stringify(body) }), ctx());
const setCalls = () => mocks.orders.updateOne.mock.calls.map((c) => (c[1] as { $set: Record<string, unknown> }).$set);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.orders.updateOne.mockResolvedValue({});
  mocks.runOrderSolve.mockResolvedValue({ ok: true });
});

describe("GET /api/orders/saved/[orderId]", () => {
  it("only finds a customer's own order", async () => {
    as("customer", "c1");
    mocks.orders.findOne.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx());
    expect(mocks.orders.findOne.mock.calls[0][0]).toEqual({ customerId: "c1", orderId: "PF-000001" });
    expect(response.status).toBe(404);
  });

  it("returns the order to staff", async () => {
    as("team");
    mocks.orders.findOne.mockResolvedValue({ orderId: "PF-000001" });
    expect(await (await GET(new Request("http://localhost/x"), ctx())).json()).toEqual({ order: { orderId: "PF-000001" } });
  });
});

describe("PUT /api/orders/saved/[orderId]", () => {
  it("is supervisor only", async () => {
    as("team");
    expect((await put({ source: "Manual", status: "Draft", items: [item] })).status).toBe(403);
  });

  it("validates source, status and items", async () => {
    as("supervisor");
    expect((await put({ source: "Fax", status: "Draft", items: [item] })).status).toBe(400);
    expect((await put({ source: "Manual", status: "Lost", items: [item] })).status).toBe(400);
    expect((await put({ source: "Manual", status: "Draft", items: [{ ...item, Width: 0 }] })).status).toBe(400);
  });

  it("returns 404 for a missing order", async () => {
    as("supervisor");
    mocks.orders.findOne.mockResolvedValue(null);
    expect((await put({ source: "Manual", status: "Draft", items: [item] })).status).toBe(404);
  });

  it("refuses to edit an order being packed or packed", async () => {
    as("supervisor");
    for (const progress of ["packing", "packed"]) {
      mocks.orders.findOne.mockResolvedValueOnce({ progress, items: [item] });
      expect((await put({ source: "Manual", status: "Draft", items: [item] })).status).toBe(409);
    }
    expect(mocks.orders.updateOne).not.toHaveBeenCalled();
  });

  it("updates details without re-solving when items are unchanged", async () => {
    as("supervisor");
    mocks.orders.findOne.mockResolvedValueOnce({ progress: "ready", items: [item] }).mockResolvedValue({ orderId: "PF-000001" });
    await put({ source: "Imported", status: "Available", items: [item] });
    expect(setCalls()).toEqual([{ source: "Imported", status: "Available", updatedAt: expect.any(Date) }]);
    expect(mocks.runOrderSolve).not.toHaveBeenCalled();
  });

  it("resets and re-solves when items change", async () => {
    as("supervisor");
    mocks.orders.findOne.mockResolvedValueOnce({ progress: "ready", items: [item] }).mockResolvedValue({ orderId: "PF-000001" });
    await put({ source: "Manual", status: "Draft", items: [{ ...item, Width: 200 }] });
    expect(setCalls()[0]).toMatchObject({ items: [{ ...item, Width: 200 }] });
    expect(setCalls()[1]).toMatchObject({ progress: "submitted", assignedUserId: null, solvedAt: null });
    expect(mocks.runOrderSolve).toHaveBeenCalledWith("PF-000001");
  });
});

describe("DELETE /api/orders/saved/[orderId]", () => {
  it("is supervisor only", async () => {
    as("team");
    expect((await DELETE(new Request("http://localhost/x"), ctx())).status).toBe(403);
  });

  it("deletes the order and its solution", async () => {
    as("supervisor");
    mocks.orders.deleteOne.mockResolvedValue({ deletedCount: 1 });
    expect(await (await DELETE(new Request("http://localhost/x"), ctx())).json()).toEqual({ success: true });
    expect(mocks.orders.deleteOne).toHaveBeenCalledWith({ orderId: "PF-000001" });
    expect(mocks.deleteSolution).toHaveBeenCalledWith("PF-000001");
  });

  it("returns 404 when nothing was deleted", async () => {
    as("supervisor");
    mocks.orders.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect((await DELETE(new Request("http://localhost/x"), ctx())).status).toBe(404);
    expect(mocks.deleteSolution).not.toHaveBeenCalled();
  });
});
