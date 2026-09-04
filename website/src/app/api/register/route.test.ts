import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const { usersFindOne, usersInsertOne, bcryptHash } = vi.hoisted(() => ({
  usersFindOne: vi.fn(),
  usersInsertOne: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ default: { db: () => ({ collection: () => ({ findOne: usersFindOne, insertOne: usersInsertOne }) }) } }));
vi.mock("bcrypt", () => ({ default: { hash: bcryptHash } }));

import { POST } from "./route";

function regReq(body: unknown) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  usersFindOne.mockResolvedValue(null);
  usersInsertOne.mockResolvedValue({ insertedId: new ObjectId("507f191e810c19729de860ea") });
  bcryptHash.mockResolvedValue("hashed-pw");
});

describe("POST /api/register", () => {
  it("returns 400 when any field is missing", async () => {
    const res = await POST(regReq({ username: "", email: "", password: "" }));
    expect(res.status).toBe(400);
    expect(usersInsertOne).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already registered", async () => {
    usersFindOne.mockResolvedValue({ _id: new ObjectId(), email: "a@b.com" });
    const res = await POST(regReq({ username: "alice", email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(409);
    expect(usersInsertOne).not.toHaveBeenCalled();
  });

  it("hashes the password, normalizes fields, defaults role to 'user', and returns 201", async () => {
    const res = await POST(regReq({ username: "  alice  ", email: "  Alice@B.com  ", password: "pw" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user).toEqual({ id: "507f191e810c19729de860ea", username: "alice", email: "alice@b.com" });
    expect(bcryptHash).toHaveBeenCalledWith("pw", 12);

    const doc = usersInsertOne.mock.calls[0][0];
    expect(doc).toEqual(expect.objectContaining({
      username: "alice",
      email: "alice@b.com",
      passwordHash: "hashed-pw",
      role: "user",
    }));
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it("stores only the hash, never the plaintext password", async () => {
    await POST(regReq({ username: "alice", email: "a@b.com", password: "s3cret" }));
    const doc = usersInsertOne.mock.calls[0][0];
    expect(doc.passwordHash).toBe("hashed-pw");
    expect(JSON.stringify(doc)).not.toContain("s3cret");
  });

  it("returns 500 when the insert throws", async () => {
    usersInsertOne.mockRejectedValue(new Error("db down"));
    const res = await POST(regReq({ username: "alice", email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(500);
  });
});