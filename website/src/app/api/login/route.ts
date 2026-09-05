import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import client from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        {
          message: "Username/email and password are required",
        },
        { status: 400 }
      );
    }

    const loginValue = email.trim();
    const normalizedEmail = loginValue.toLowerCase();

    const dbName =
      process.env.MONGODB_DB || "fitvisualizer";

    const db = client.db(dbName);
    const users = db.collection("users");

    /*
     * Allow login using either:
     * - email address
     * - username
     *
     * Collation makes the username comparison
     * case-insensitive as well.
     */
    const user = await users.findOne(
      {
        $or: [
          {
            email: normalizedEmail,
          },
          {
            username: loginValue,
          },
        ],
      },
      {
        collation: {
          locale: "en",
          strength: 2,
        },
      }
    );

    if (!user) {
      return NextResponse.json(
        {
          message:
            "Invalid username/email or password",
        },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      console.error(
        "User record does not contain passwordHash"
      );

      return NextResponse.json(
        {
          message: "Unable to authenticate user",
        },
        { status: 500 }
      );
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          message:
            "Invalid username/email or password",
        },
        { status: 401 }
      );
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "JWT_SECRET is not defined"
      );
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role ?? "user",
      },
      jwtSecret,
      {
        expiresIn: "1d",
      }
    );

    const response =
      NextResponse.json(
        {
          message: "Login successful",

          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
          },
        },
        {
          status: 200,
        }
      );

    response.cookies.set(
      "auth_token",
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        message: "Login failed",
      },
      {
        status: 500,
      }
    );
  }
}