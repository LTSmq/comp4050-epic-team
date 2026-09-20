import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { Role } from "./rbac";

export type AuthUser = {
  userId: string;
  email: string;
  username: string;
  role: Role;
};

const VALID_ROLES: Role[] = ["customer", "team", "supervisor"];

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as Partial<AuthUser>;

    if (!decoded.userId || !decoded.email || !decoded.username) {
      return null;
    }

    // Tokens issued before roles existed default to the least-privileged role.
    const role =
      decoded.role && VALID_ROLES.includes(decoded.role)
        ? decoded.role
        : "customer";

    return {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role,
    };
  } catch {
    return null;
  }
}