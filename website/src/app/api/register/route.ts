import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import client from "@/lib/mongodb";

// No "@" allowed, so a username can never look like (or shadow) an email at login.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { message: "Username, email and password are required" },
        { status: 400 }
      );
    }

    if (!USERNAME_PATTERN.test(username.trim())) {
      return NextResponse.json(
        { message: "Username must be 3-32 characters: letters, numbers, . _ -" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return NextResponse.json(
        { message: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // bcrypt only uses the first 72 bytes, so reject longer instead of silently truncating.
    if (password.length < 8 || Buffer.byteLength(password) > 72) {
      return NextResponse.json(
        { message: "Password must be 8-72 characters" },
        { status: 400 }
      );
    }

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const users = db.collection("users");

    const existingUser = await users.findOne(
      { $or: [{ email: normalizedEmail }, { username: username.trim() }] },
      { collation: { locale: "en", strength: 2 } }
    );

    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email or username already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "customer", // staff roles are never self-assigned
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: {
          id: result.insertedId.toString(),
          username: username.trim(),
          email: normalizedEmail,
          role: "customer",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Unique index hit: two registrations raced for the same email/username.
    if ((error as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { message: "An account with this email or username already exists" },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json({ message: "Registration failed" }, { status: 500 });
  }
}