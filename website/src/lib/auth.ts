import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type AuthUser = {
  userId: string;
  email: string;
  username: string;
};

export function verifyAuthToken(token: string): AuthUser | null {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (
      typeof decoded === "string" ||
      !decoded.userId ||
      !decoded.email ||
      !decoded.username
    ) {
      return null;
    }

    return {
      userId: String(decoded.userId),
      email: String(decoded.email),
      username: String(decoded.username),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}