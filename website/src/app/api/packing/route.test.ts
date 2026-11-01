import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn(), listPackingOrders: vi.fn(), listPackingChanges: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/orders/packing", () => ({
  listPackingOrders: mocks.listPackingOrders,
  listPackingChanges: mocks.listPackingChanges,
}));

import { GET } from "./route";

const as = (role: string, userId = "pack1") => mocks.getAuthUser.mockResolvedValue({ userId, username: "u", email: "x@x.com", role });
const get = (query = "") => GET(new Request(`http://localhost/api/packing${query}`));

describe("GET /api/packing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPackingOrders.mockResolvedValue([{ orderId: "PF-1" }]);
    mocks.listPackingChanges.mockResolvedValue([{ orderId: "PF-2" }]);
  });

  it("is for warehouse staff only", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    as("customer");
    expect((await get()).status).toBe(403);
  });

  it("returns a packer's full list scoped to their assignments", async () => {
    as("team", "pack1");
    const response = await get();
    const body = await response.json();
    expect(mocks.listPackingOrders).toHaveBeenCalledWith(expect.any(Date), "pack1");
    expect(body).toMatchObject({ reset: true, rows: [{ orderId: "PF-1" }] });
    expect(Date.parse(body.now) - Date.parse(body.cursor)).toBe(2000);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns every order to supervisors", async () => {
    as("supervisor");
    await get();
    expect(mocks.listPackingOrders).toHaveBeenCalledWith(expect.any(Date), undefined);
  });

  it("returns only changes when given a cursor", async () => {
    as("team", "pack1");
    const body = await (await get("?since=2026-11-01T10:00:00.000Z")).json();
    expect(mocks.listPackingChanges).toHaveBeenCalledWith(new Date("2026-11-01T10:00:00.000Z"), "pack1");
    expect(body).toMatchObject({ reset: false, rows: [{ orderId: "PF-2" }] });
    expect(mocks.listPackingOrders).not.toHaveBeenCalled();
  });

  it("falls back to a full list for a bad cursor or too many changes", async () => {
    as("team");
    await get("?since=not-a-date");
    expect(mocks.listPackingChanges).not.toHaveBeenCalled();
    mocks.listPackingChanges.mockResolvedValue(null);
    const body = await (await get("?since=2026-11-01T10:00:00.000Z")).json();
    expect(body.reset).toBe(true);
    expect(mocks.listPackingOrders).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when the database fails", async () => {
    as("team");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listPackingOrders.mockRejectedValue(new Error("down"));
    expect((await get()).status).toBe(500);
  });
});
