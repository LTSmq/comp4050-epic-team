import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import client from "./mongodb";
import type { Role } from "./rbac";

export type AuthUser = { userId: string; email: string; username: string; role: Role };

const VALID_ROLES: Role[] = ["customer", "team", "supervisor"];
const dbName = process.env.MONGODB_DB || "fitvisualizer";

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const token = (await cookies()).get("auth_token")?.value;
    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as Partial<AuthUser>;
    if (!decoded.userId || !decoded.email || !decoded.username) return null;

    // Role is authoritative from the DB, not the token, so changes apply immediately.
    let role: Role = "customer";
    try {
      const record = await client
        .db(dbName)
        .collection("users")
        .findOne({ _id: new ObjectId(decoded.userId) }, { projection: { role: 1 } });
      if (record?.role && VALID_ROLES.includes(record.role as Role)) {
        role = record.role as Role;
      }
    } catch {
      // DB unreachable: fall back to the token's role rather than logging everyone out.
      if (decoded.role && VALID_ROLES.includes(decoded.role)) role = decoded.role;
    }

    return { userId: decoded.userId, email: decoded.email, username: decoded.username, role };
  } catch {
    return null;
  }
}