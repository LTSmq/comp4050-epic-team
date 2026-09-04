import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const { usersFindOne, bcryptCompare, jwtSign } = vi.hoisted(() => ({
  usersFindOne: vi.fn(),
  bcryptCompare: vi.fn(),
  jwtSign: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ default: { db: () => ({ collection: () => ({ findOne: usersFindOne }) }) } }));
vi.mock("bcrypt", () => ({ default: { compare: bcryptCompare } }));
vi.mock("jsonwebtoken", () => ({ default: { sign: jwtSign } }));

import { POST } from "./route";

const USER = { _id: new ObjectId("507f1f77bcf86cd799439011"), email: "a@b.com", username: "alice", passwordHash: "hashed" };

function loginReq(body: unknown) {
  return new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  usersFindOne.mockResolvedValue(USER);
  bcryptCompare.mockResolvedValue(true);
  jwtSign.mockReturnValue("signed.jwt.token");
});

describe("POST /api/login", () => {
  it("returns 400 when email or password is missing", async () => {
    const res = await POST(loginReq({ email: "", password: "" }));
    expect(res.status).toBe(400);
    expect(usersFindOne).not.toHaveBeenCalled();
  });

  it("looks the user up by email OR username with case-insensitive collation", async () => {
    await POST(loginReq({ email: "Alice", password: "pw" }));
    const [query, opts] = usersFindOne.mock.calls[0];
    expect(query.$or).toEqual([{ email: "alice" }, { username: "Alice" }]);
    expect(opts.collation).toEqual({ locale: "en", strength: 2 });
  });

  it("returns 401 when no matching user exists", async () => {
    usersFindOne.mockResolvedValue(null);
    const res = await POST(loginReq({ email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(401);
    expect((await res.json()).message).toMatch(/invalid/i);
  });

  it("returns 500 when the user record has no password hash", async () => {
    usersFindOne.mockResolvedValue({ ...USER, passwordHash: undefined });
    const res = await POST(loginReq({ email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(500);
  });

  it("returns 401 when the password does not match", async () => {
    bcryptCompare.mockResolvedValue(false);
    const res = await POST(loginReq({ email: "a@b.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 200, signs a JWT, sets the auth cookie, and never leaks the password hash", async () => {
    const res = await POST(loginReq({ email: "a@b.com", password: "pw" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user).toEqual({ id: "507f1f77bcf86cd799439011", username: "alice", email: "a@b.com" });
    expect(JSON.stringify(body)).not.toContain("hashed");
    expect(jwtSign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "507f1f77bcf86cd799439011", email: "a@b.com", username: "alice" }),
      "test-secret",
      expect.objectContaining({ expiresIn: "1d" })
    );
    expect(res.cookies.get("auth_token")?.value).toBe("signed.jwt.token");
  });

  it("returns 500 when the lookup throws", async () => {
    usersFindOne.mockRejectedValue(new Error("db down"));
    const res = await POST(loginReq({ email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe("Login failed");
  });
});