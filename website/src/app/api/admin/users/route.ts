import { NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    if (!can(user, "user:manage"))
      return NextResponse.json({ message: "Supervisor access required." }, { status: 403 });

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const users = client.db(dbName).collection("users");

    const docs = await users
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      users: docs.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        role: u.role === "supervisor" ? "supervisor" : "user",
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json({ message: "Unable to load users." }, { status: 500 });
  }
}