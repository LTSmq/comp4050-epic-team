import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";

export const SESSION_COOKIE_NAME = "epic_session";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionDocument {
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

interface UserDocument {
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

function getDatabase() {
  const dbName = process.env.MONGODB_DB || "fitvisualizer";
  return client.db(dbName);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: ObjectId) {
  const db = getDatabase();
  const sessions = db.collection<SessionDocument>("sessions");

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);

  await sessions.insertOne({
    userId,
    tokenHash,
    createdAt,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

export async function getUserFromSessionToken(token: string) {
  const db = getDatabase();

  const sessions = db.collection<SessionDocument>("sessions");
  const users = db.collection<UserDocument>("users");

  const tokenHash = hashSessionToken(token);

  const session = await sessions.findOne({
    tokenHash,
    expiresAt: {
      $gt: new Date(),
    },
  });

  if (!session) {
    return null;
  }

  const user = await users.findOne(
    {
      _id: session.userId,
    },
    {
      projection: {
        passwordHash: 0,
      },
    }
  );

  return user;
}

export async function deleteSession(token: string) {
  const db = getDatabase();
  const sessions = db.collection<SessionDocument>("sessions");

  const tokenHash = hashSessionToken(token);

  await sessions.deleteOne({
    tokenHash,
  });
}