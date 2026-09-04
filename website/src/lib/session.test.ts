import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { createHash } from "crypto";

const { sessInsertOne, sessFindOne, sessDeleteOne, usersFindOne } = vi.hoisted(() => ({
  sessInsertOne: vi.fn(),
  sessFindOne: vi.fn(),
  sessDeleteOne: vi.fn(),
  usersFindOne: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  default: {
    db: () => ({
      collection: (name: string) =>
        name === "sessions"
          ? { insertOne: sessInsertOne, findOne: sessFindOne, deleteOne: sessDeleteOne }
          : { findOne: usersFindOne },
    }),
  },
}));

import { createSession, getUserFromSessionToken, deleteSession, SESSION_COOKIE_NAME } from "./session";

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  sessInsertOne.mockResolvedValue({ insertedId: new ObjectId() });
});

describe("createSession", () => {
  it("stores a hashed token (never the raw token) with a 7-day expiry", async () => {
    const userId = new ObjectId();
    const { token, expiresAt } = await createSession(userId);

    expect(sessInsertOne).toHaveBeenCalledTimes(1);
    const doc = sessInsertOne.mock.calls[0][0];
    expect(doc.userId).toBe(userId);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.tokenHash).toBe(sha256(token));
    expect(doc.tokenHash).not.toBe(token);
    expect(doc.expiresAt.getTime() - doc.createdAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(expiresAt).toBeInstanceOf(Date);
  });
});

describe("getUserFromSessionToken", () => {
  it("returns null and never looks up a user when no live session matches", async () => {
    sessFindOne.mockResolvedValue(null);
    expect(await getUserFromSessionToken("plain")).toBeNull();
    expect(usersFindOne).not.toHaveBeenCalled();
  });

  it("looks up the session by hashed token and unexpired, then returns the user without passwordHash", async () => {
    const userId = new ObjectId();
    sessFindOne.mockResolvedValue({ userId, tokenHash: sha256("plain"), expiresAt: new Date(Date.now() + 1000) });
    const user = { _id: userId, username: "alice", email: "a@b.com" };
    usersFindOne.mockResolvedValue(user);

    const result = await getUserFromSessionToken("plain");

    expect(result).toBe(user);
    const query = sessFindOne.mock.calls[0][0];
    expect(query.tokenHash).toBe(sha256("plain"));
    expect(query.expiresAt.$gt).toBeInstanceOf(Date);
    expect(usersFindOne).toHaveBeenCalledWith({ _id: userId }, { projection: { passwordHash: 0 } });
  });
});

describe("deleteSession", () => {
  it("deletes the session by hashed token", async () => {
    sessDeleteOne.mockResolvedValue({ deletedCount: 1 });
    await deleteSession("plain");
    expect(sessDeleteOne).toHaveBeenCalledWith({ tokenHash: sha256("plain") });
  });
});

describe("module constants", () => {
  it("exposes the session cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("epic_session");
  });
});