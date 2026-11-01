import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  getPackingOrder: vi.fn(),
  runPackAction: vi.fn(),
  runOrderSolve: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/orders/packing", () => {
  class PackingError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  }
  return {
    PACK_ACTIONS: ["claim", "release", "packed", "unavailable", "restore", "resolve", "reopen"],
    PackingError,
    getPackingOrder: mocks.getPackingOrder,
    runPackAction: mocks.runPackAction,
  };
});
vi.mock("@/lib/solver/server/runOrderSolve", () => ({ runOrderSolve: mocks.runOrderSolve }));

import { PackingError } from "@/lib/orders/packing";
import { GET, POST } from "./route";

const as = (role: string, userId = "pack1") => mocks.getAuthUser.mockResolvedValue({ userId, username: "u", email: "x@x.com", role });
const ctx = { params: Promise.resolve({ orderId: "PF-000001" }) };
const order = { orderId: "PF-000001", progress: "ready", updatedAt: "2026-11-01T10:00:00.000Z", items: [] };
const act = (body: unknown) =>
  POST(new Request("http://localhost/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getPackingOrder.mockResolvedValue(order);
  mocks.runPackAction.mockResolvedValue({ ...order, progress: "packing" });
  mocks.runOrderSolve.mockResolvedValue({ ok: true });
});

describe("GET /api/packing/[orderId]", () => {
  it("is for warehouse staff only", async () => {
    as("customer");
    expect((await GET(new Request("http://localhost/x"), ctx)).status).toBe(403);
  });

  it("only shows a packer their own assigned order", async () => {
    as("team", "pack1");
    await GET(new Request("http://localhost/x"), ctx);
    expect(mocks.getPackingOrder).toHaveBeenCalledWith("PF-000001", "pack1");
    as("supervisor");
    await GET(new Request("http://localhost/x"), ctx);
    expect(mocks.getPackingOrder).toHaveBeenLastCalledWith("PF-000001", undefined);
  });

  it("returns 404 when not found or not assigned", async () => {
    as("team");
    mocks.getPackingOrder.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/x"), ctx)).status).toBe(404);
  });

  it("returns 204 when nothing changed since the client's copy", async () => {
    as("team");
    const response = await GET(new Request(`http://localhost/x?since=${encodeURIComponent(order.updatedAt)}`), ctx);
    expect(response.status).toBe(204);
  });

  it("returns the order otherwise", async () => {
    as("team");
    const body = await (await GET(new Request("http://localhost/x?since=old"), ctx)).json();
    expect(body).toMatchObject({ order, now: expect.any(String) });
  });
});

describe("POST /api/packing/[orderId]", () => {
  it("is for warehouse staff only", async () => {
    as("customer");
    expect((await act({ action: "claim" })).status).toBe(403);
  });

  it("validates the request", async () => {
    as("team");
    expect((await act("{bad json")).status).toBe(400);
    expect((await act({ action: "teleport" })).status).toBe(400);
    expect((await act({ action: "unavailable" })).status).toBe(400);
    expect((await act({ action: "unavailable", itemIndex: -1 })).status).toBe(400);
    expect(mocks.runPackAction).not.toHaveBeenCalled();
  });

  it("returns 404 for an order the packer cannot access", async () => {
    as("team");
    mocks.getPackingOrder.mockResolvedValue(null);
    expect((await act({ action: "claim" })).status).toBe(404);
    expect(mocks.runPackAction).not.toHaveBeenCalled();
  });

  it("runs the action and returns the updated order", async () => {
    as("team");
    const body = await (await act({ action: "unavailable", itemIndex: "2" })).json();
    expect(mocks.runPackAction).toHaveBeenCalledWith(expect.objectContaining({ userId: "pack1" }), "PF-000001", "unavailable", 2);
    expect(body.order.progress).toBe("packing");
  });

  it("re-solves after a supervisor resolves a hold", async () => {
    as("supervisor");
    mocks.getPackingOrder.mockResolvedValueOnce(order).mockResolvedValueOnce({ ...order, progress: "ready" });
    const body = await (await act({ action: "resolve" })).json();
    expect(mocks.runOrderSolve).toHaveBeenCalledWith("PF-000001");
    expect(body.order.progress).toBe("ready");
  });

  it("reports a failed re-solve", async () => {
    as("supervisor");
    mocks.runOrderSolve.mockResolvedValue({ ok: false, status: 422, error: "Solver could not fit: X (TooLarge)" });
    const response = await act({ action: "resolve" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Solver could not fit: X (TooLarge)" });
  });

  it("maps packing errors to their status, and anything else to 500", async () => {
    as("team");
    mocks.runPackAction.mockRejectedValueOnce(new PackingError("Pack order PF-000000 first.", 409));
    const conflict = await act({ action: "claim" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "Pack order PF-000000 first." });

    mocks.runPackAction.mockRejectedValueOnce(new Error("boom"));
    expect((await act({ action: "claim" })).status).toBe(500);
  });
});
