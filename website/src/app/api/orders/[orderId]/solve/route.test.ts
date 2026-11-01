import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn(), runOrderSolve: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/solver/server/runOrderSolve", () => ({ runOrderSolve: mocks.runOrderSolve }));

import { POST } from "./route";

const as = (role: string) => mocks.getAuthUser.mockResolvedValue({ userId: "me", username: "u", email: "x@x.com", role });
const solve = () => POST(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ orderId: "PF-000001" }) });

describe("POST /api/orders/[orderId]/solve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is supervisor only", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await solve()).status).toBe(401);
    as("team");
    expect((await solve()).status).toBe(403);
    expect(mocks.runOrderSolve).not.toHaveBeenCalled();
  });

  it("re-solves and returns the solution", async () => {
    as("supervisor");
    mocks.runOrderSolve.mockResolvedValue({ ok: true, result: { id: "PF-000001", packages: [], unpacked: [] } });
    expect(await (await solve()).json()).toEqual({ success: true, orderId: "PF-000001", result: { id: "PF-000001", packages: [], unpacked: [] } });
    expect(mocks.runOrderSolve).toHaveBeenCalledWith("PF-000001", {});
  });

  it("passes the failure status and reason through", async () => {
    as("supervisor");
    mocks.runOrderSolve.mockResolvedValue({ ok: false, status: 422, error: "Solver could not fit: BIG (TooLarge)", solverResult: { x: 1 } });
    const response = await solve();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ success: false, error: "Solver could not fit: BIG (TooLarge)", solverResult: { x: 1 } });
  });
});
