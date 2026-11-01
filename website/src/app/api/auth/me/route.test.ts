import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));

import { GET } from "./route";

describe("GET /api/auth/me", () => {
  it("returns 401 without a valid session", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ authenticated: false });
  });

  it("returns the current user", async () => {
    mocks.getAuthUser.mockResolvedValue({ userId: "u1", username: "pack1", email: "p@x.com", role: "team" });
    const response = await GET();
    expect(await response.json()).toEqual({
      authenticated: true,
      user: { id: "u1", username: "pack1", email: "p@x.com", role: "team" },
    });
  });
});
