import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type UserRole = "user" | "supervisor";

export type AuthUser = {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as Partial<AuthUser>;

    if (!decoded.userId || !decoded.email || !decoded.username) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role === "supervisor" ? "supervisor" : "user",
    };
  } catch {
    return null;
  }
}

// Alias so existing imports (e.g. the order route) keep working.
export const getCurrentUser = getAuthUser;

// Use in API routes to gate supervisor-only work.
export async function requireRole(role: UserRole): Promise<AuthUser | null> {
  const user = await getAuthUser();
  if (!user || user.role !== role) return null;
  return user;
}