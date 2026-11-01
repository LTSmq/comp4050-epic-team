import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  verify: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "auth_token" && mocks.cookieValue ? { value: mocks.cookieValue } : undefined),
  }),
}));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.verify } }));
vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ findOne: mocks.findOne }) }) },
}));

import { getAuthUser } from "./auth";

const USER_ID = "65f0a1b2c3d4e5f6a7b8c9d0";
const token = { userId: USER_ID, email: "pack1@example.com", username: "pack1", role: "supervisor" };

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.cookieValue = "signed.jwt.token";
    mocks.verify.mockReturnValue(token);
    mocks.findOne.mockResolvedValue({ role: "team" });
  });

  it("returns null without a session cookie", async () => {
    mocks.cookieValue = undefined;
    await expect(getAuthUser()).resolves.toBeNull();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("returns null when JWT_SECRET is not configured", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("returns null for an invalid or expired token", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });
    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("only accepts HS256 tokens", async () => {
    await getAuthUser();
    expect(mocks.verify).toHaveBeenCalledWith("signed.jwt.token", "test-secret", { algorithms: ["HS256"] });
  });

  it("takes the role from the database, not the token", async () => {
    await expect(getAuthUser()).resolves.toEqual({
      userId: USER_ID,
      email: "pack1@example.com",
      username: "pack1",
      role: "team",
    });
  });

  it("rejects the session if the account was deleted", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("falls back to customer for an unknown stored role", async () => {
    mocks.findOne.mockResolvedValue({ role: "admin" });
    await expect(getAuthUser()).resolves.toMatchObject({ role: "customer" });
  });

  it("fails closed to customer when the database is unreachable", async () => {
    mocks.findOne.mockRejectedValue(new Error("network"));
    await expect(getAuthUser()).resolves.toMatchObject({ role: "customer" });
  });

  it("rejects tokens with missing fields or a malformed user id", async () => {
    mocks.verify.mockReturnValueOnce({ ...token, email: undefined });
    await expect(getAuthUser()).resolves.toBeNull();
    mocks.verify.mockReturnValueOnce({ ...token, userId: "not-an-object-id" });
    await expect(getAuthUser()).resolves.toBeNull();
  });
});
