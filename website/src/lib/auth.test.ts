import { describe, it, expect, vi, beforeEach } from "vitest";

const { cookiesGet, jwtVerify } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookiesGet })),
}));
vi.mock("jsonwebtoken", () => ({ default: { verify: jwtVerify } }));

import { getAuthUser, getCurrentUser, requireRole } from "./auth";

const DECODED = { userId: "u1", email: "a@b.com", username: "alice", role: "user" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  cookiesGet.mockReturnValue({ value: "tok" });
  jwtVerify.mockReturnValue(DECODED);
});

describe("getAuthUser", () => {
  it("returns null when there is no auth cookie", async () => {
    cookiesGet.mockReturnValue(undefined);
    expect(await getAuthUser()).toBeNull();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("returns null when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    expect(await getAuthUser()).toBeNull();
  });

  it("returns null when the token fails verification", async () => {
    jwtVerify.mockImplementation(() => { throw new Error("bad token"); });
    expect(await getAuthUser()).toBeNull();
  });

  it("returns null when the decoded token is missing required fields", async () => {
    jwtVerify.mockReturnValue({ userId: "u1" }); // no email/username
    expect(await getAuthUser()).toBeNull();
  });

  it("returns the user and defaults an unknown role to 'user'", async () => {
    jwtVerify.mockReturnValue({ userId: "u1", email: "a@b.com", username: "alice", role: "admin" });
    expect(await getAuthUser()).toEqual({ userId: "u1", email: "a@b.com", username: "alice", role: "user" });
  });

  it("preserves the supervisor role", async () => {
    jwtVerify.mockReturnValue({ ...DECODED, role: "supervisor" });
    expect((await getAuthUser())?.role).toBe("supervisor");
  });

  it("exposes getCurrentUser as an alias of getAuthUser", () => {
    expect(getCurrentUser).toBe(getAuthUser);
  });
});

describe("requireRole", () => {
  it("returns null when there is no authenticated user", async () => {
    cookiesGet.mockReturnValue(undefined);
    expect(await requireRole("supervisor")).toBeNull();
  });

  it("returns null when the user's role does not match", async () => {
    jwtVerify.mockReturnValue({ ...DECODED, role: "user" });
    expect(await requireRole("supervisor")).toBeNull();
  });

  it("returns the user when the role matches", async () => {
    jwtVerify.mockReturnValue({ ...DECODED, role: "supervisor" });
    expect(await requireRole("supervisor")).toEqual({ ...DECODED, role: "supervisor" });
  });
});