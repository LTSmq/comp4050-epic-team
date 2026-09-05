import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

type AuthToken = {
  userId: string;
  email: string;
  username: string;
  role?: "user" | "supervisor";
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
          message: "Not logged in",
        },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(token, jwtSecret) as AuthToken;

        return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role === "supervisor" ? "supervisor" : "user",   // ← add
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Authentication check failed:", error);

    return NextResponse.json(
      {
        authenticated: false,
        message: "Invalid or expired session",
      },
      { status: 401 }
    );
  }
}