import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type AuthUser = {
  userId: string;
  email: string;
  username: string;
};

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

    const decoded = jwt.verify(
      token,
      jwtSecret
    ) as AuthUser;

    if (
      !decoded.userId ||
      !decoded.email ||
      !decoded.username
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}