import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), insertOne: vi.fn(), hash: vi.fn() }));

vi.mock("@/lib/mongodb", () => ({
  default: { db: () => ({ collection: () => ({ findOne: mocks.findOne, insertOne: mocks.insertOne }) }) },
}));
vi.mock("bcrypt", () => ({ default: { hash: mocks.hash } }));

import { POST } from "./route";

const register = (body: unknown) =>
  POST(new Request("http://localhost/api/register", { method: "POST", body: JSON.stringify(body) }));
const valid = { username: "cust1", email: "Cust1@Example.com", password: "password123" };

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findOne.mockResolvedValue(null);
    mocks.insertOne.mockResolvedValue({ insertedId: { toString: () => "new-id" } });
    mocks.hash.mockResolvedValue("hashed");
  });

  it("creates a customer account with a hashed password", async () => {
    const response = await register(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ user: { id: "new-id", username: "cust1", email: "cust1@example.com", role: "customer" } });
    expect(mocks.hash).toHaveBeenCalledWith("password123", 12);
    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ username: "cust1", email: "cust1@example.com", passwordHash: "hashed", role: "customer" })
    );
  });

  it("never lets someone register themselves as staff", async () => {
    await register({ ...valid, role: "supervisor" });
    expect(mocks.insertOne.mock.calls[0][0]).toMatchObject({ role: "customer" });
  });

  const invalid: Array<[string, Record<string, unknown>, string]> = [
    ["missing fields", { username: "cust1" }, "required"],
    ["a short username", { ...valid, username: "ab" }, "Username must be"],
    ["an @ in the username", { ...valid, username: "a@b" }, "Username must be"],
    ["a bad email", { ...valid, email: "not-an-email" }, "valid email"],
    ["a short password", { ...valid, password: "short" }, "8-72"],
    ["a password over 72 bytes", { ...valid, password: "x".repeat(73) }, "8-72"],
  ];
  for (const [label, body, message] of invalid) {
    it(`rejects ${label}`, async () => {
      const response = await register(body);
      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain(message);
      expect(mocks.insertOne).not.toHaveBeenCalled();
    });
  }

  it("returns 409 when the email or username is taken", async () => {
    mocks.findOne.mockResolvedValue({ _id: "x" });
    expect((await register(valid)).status).toBe(409);
  });

  it("returns 409 when two sign-ups race (duplicate key)", async () => {
    mocks.insertOne.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    expect((await register(valid)).status).toBe(409);
  });
});
