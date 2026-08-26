import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import client from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { message: "Username, email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const users = db.collection("users");

    const existingUser = await users.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "user", 
      createdAt: new Date(),
    });

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: {
          id: result.insertedId.toString(),
          username: username.trim(),
          email: normalizedEmail,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { message: "Registration failed" },
      { status: 500 }
    );
  }
}