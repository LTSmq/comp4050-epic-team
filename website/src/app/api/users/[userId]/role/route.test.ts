import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn(), findOne: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({ collection: () => ({ findOne: mocks.findOne, countDocuments: mocks.countDocuments, updateOne: mocks.updateOne }) }),
  },
}));

import { PATCH } from "./route";

const ME = "65f0a1b2c3d4e5f6a7b8c9d0";
const TARGET = "65f0a1b2c3d4e5f6a7b8c9d1";
const as = (role: string) => mocks.getAuthUser.mockResolvedValue({ userId: ME, username: "boss", email: "b@x.com", role });
const setRole = (userId: string, role: unknown) =>
  PATCH(new Request(`http://localhost/api/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }), {
    params: Promise.resolve({ userId }),
  });

describe("PATCH /api/users/[userId]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    as("supervisor");
    mocks.findOne.mockResolvedValue({ role: "customer" });
    mocks.countDocuments.mockResolvedValue(2);
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("only lets supervisors change roles", async () => {
    as("team");
    expect((await setRole(TARGET, "team")).status).toBe(403);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("changes a role and records who did it", async () => {
    const response = await setRole(TARGET, "team");
    expect(await response.json()).toEqual({ success: true, userId: TARGET, role: "team" });
    const [filter, update] = mocks.updateOne.mock.calls[0] as [{ _id: unknown }, { $set: Record<string, unknown> }];
    expect(String(filter._id)).toBe(TARGET);
    expect(update.$set).toMatchObject({ role: "team", roleUpdatedBy: ME, roleUpdatedAt: expect.any(Date) });
  });

  it("rejects an invalid user id or role", async () => {
    expect((await setRole("not-an-id", "team")).status).toBe(400);
    expect((await setRole(TARGET, "admin")).status).toBe(400);
  });

  it("stops supervisors demoting themselves", async () => {
    const response = await setRole(ME, "team");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("You cannot remove your own supervisor role.");
  });

  it("never removes the last supervisor", async () => {
    mocks.findOne.mockResolvedValue({ role: "supervisor" });
    mocks.countDocuments.mockResolvedValue(1);
    const response = await setRole(TARGET, "customer");
    expect((await response.json()).error).toBe("Cannot remove the last supervisor.");
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("allows demoting a supervisor when another remains", async () => {
    mocks.findOne.mockResolvedValue({ role: "supervisor" });
    expect((await setRole(TARGET, "team")).status).toBe(200);
  });

  it("returns 404 for an unknown user", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect((await setRole(TARGET, "team")).status).toBe(404);
  });
});
