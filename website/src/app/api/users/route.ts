import { NextResponse } from "next/server";

import client from "@/lib/mongodb";
import { requireUser, requirePermission } from "@/lib/rbac";

const dbName = process.env.MONGODB_DB || "fitvisualizer";

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    // Only roles that can assign roles may list users.
    const denied = requirePermission(user, "order:create");
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role");
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

    const filter: Record<string, unknown> = {};
    if (roleFilter && ["customer", "team", "supervisor"].includes(roleFilter)) {
      filter.role = roleFilter;
    }
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const coll = client.db(dbName).collection("users");
    const [rows, total] = await Promise.all([
      coll
        .find(filter, { projection: { username: 1, email: 1, role: 1 } })
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      coll.countDocuments(filter),
    ]);

    return NextResponse.json({
      total,
      users: rows.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        role: u.role ?? "customer",
      })),
    });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}