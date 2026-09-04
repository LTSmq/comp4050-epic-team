import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const { jwtVerify } = vi.hoisted(() => ({ jwtVerify: vi.fn() }));
vi.mock("jsonwebtoken", () => ({ default: { verify: jwtVerify } }));

import { GET } from "./route";

function meReq(token?: string) {
  return {
    cookies: { get: (name: string) => (token ? { name, value: token } : undefined) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  jwtVerify.mockReturnValue({ userId: "u1", email: "a@b.com", username: "alice", role: "user" });
});

describe("GET /api/auth/me", () => {
  it("returns 401 and does not verify when there is no cookie", async () => {
    const res = await GET(meReq());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ authenticated: false, message: "Not logged in" });
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("returns 200 with the user when the token is valid", async () => {
    const res = await GET(meReq("tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: { id: "u1", username: "alice", email: "a@b.com" },
    });
  });

  it("returns 401 when the token is invalid or expired", async () => {
    jwtVerify.mockImplementation(() => { throw new Error("expired"); });
    const res = await GET(meReq("tok"));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toMatch(/invalid or expired/i);
  });
});