import { NextResponse } from "next/server";

import client from "@/lib/mongodb";
import { requireUser, requirePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    // Only roles that can assign roles may list users.
    const denied = requirePermission(user, "role:assign");
    if (denied) return denied;

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);

    const users = await db
      .collection("users")
      .find({}, { projection: { username: 1, email: 1, role: 1 } })
      .sort({ username: 1 })
      .toArray();

    return NextResponse.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        role: u.role ?? "customer",
      })),
    });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}