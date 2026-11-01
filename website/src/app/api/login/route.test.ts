import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), compare: vi.fn(), sign: vi.fn() }));

vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ findOne: mocks.findOne }) }) },
}));
vi.mock("bcrypt", () => ({ default: { compare: mocks.compare } }));
vi.mock("jsonwebtoken", () => ({ default: { sign: mocks.sign } }));

import { POST } from "./route";

const login = (body: unknown) =>
  POST(new Request("http://localhost/api/login", { method: "POST", body: JSON.stringify(body) }));

const storedUser = {
  _id: { toString: () => "65f0a1b2c3d4e5f6a7b8c9d0" },
  username: "pack1",
  email: "pack1@example.com",
  passwordHash: "$2b$12$hash",
  role: "team",
};

describe("POST /api/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findOne.mockResolvedValue(storedUser);
    mocks.compare.mockResolvedValue(true);
    mocks.sign.mockReturnValue("signed-token");
  });

  it("requires a login and password", async () => {
    expect((await login({ email: "pack1" })).status).toBe(400);
    expect((await login({ password: "x" })).status).toBe(400);
  });

  it("looks up by email when the login contains @, case-insensitively", async () => {
    await login({ email: "  Pack1@Example.com ", password: "secret123" });
    expect(mocks.findOne).toHaveBeenCalledWith({ email: "pack1@example.com" }, { collation: { locale: "en", strength: 2 } });
  });

  it("looks up by username otherwise", async () => {
    await login({ email: "pack1", password: "secret123" });
    expect(mocks.findOne.mock.calls[0][0]).toEqual({ username: "pack1" });
  });

  it("gives the same 401 for an unknown user and a wrong password", async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    const unknown = await login({ email: "ghost", password: "secret123" });
    mocks.compare.mockResolvedValueOnce(false);
    const wrong = await login({ email: "pack1", password: "nope" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("sets an httpOnly session cookie and returns the user", async () => {
    const response = await login({ email: "pack1", password: "secret123" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Login successful",
      user: { id: "65f0a1b2c3d4e5f6a7b8c9d0", username: "pack1", email: "pack1@example.com", role: "team" },
    });
    expect(response.cookies.get("auth_token")).toMatchObject({ value: "signed-token", httpOnly: true, sameSite: "lax", path: "/" });
    expect(mocks.sign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "65f0a1b2c3d4e5f6a7b8c9d0", role: "team" }),
      "test-secret",
      { expiresIn: "1d", algorithm: "HS256" }
    );
  });

  it("defaults a user without a role to customer", async () => {
    mocks.findOne.mockResolvedValue({ ...storedUser, role: undefined });
    const body = await (await login({ email: "pack1", password: "secret123" })).json();
    expect(body.user.role).toBe("customer");
  });

  it("returns 500 for a broken user record or missing JWT secret", async () => {
    mocks.findOne.mockResolvedValueOnce({ ...storedUser, passwordHash: undefined });
    expect((await login({ email: "pack1", password: "secret123" })).status).toBe(500);
    vi.stubEnv("JWT_SECRET", "");
    expect((await login({ email: "pack1", password: "secret123" })).status).toBe(500);
  });
});
