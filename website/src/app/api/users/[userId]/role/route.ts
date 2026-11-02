import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import client from "@/lib/mongodb";
import { requireUser, requirePermission, type Role } from "@/lib/rbac";

const ASSIGNABLE_ROLES: Role[] = ["customer", "team", "supervisor"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const denied = requirePermission(user, "role:assign"); // supervisors only
    if (denied) return denied;

    const { userId } = await context.params;
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const role = String(body.role ?? "").trim() as Role;
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // Don't let a supervisor demote themselves and risk locking everyone out.
    if (userId === user.userId && role !== "supervisor") {
      return NextResponse.json(
        { error: "You cannot remove your own supervisor role." },
        { status: 400 }
      );
    }

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    const users = db.collection("users");

        // Never let the system lose its last supervisor.
    if (role !== "supervisor") {
      const target = await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: { role: 1 } }
      );
      if (target?.role === "supervisor") {
        const supervisors = await users.countDocuments({ role: "supervisor" });
        if (supervisors <= 1) {
          return NextResponse.json(
            { error: "Cannot remove the last supervisor." },
            { status: 400 }
          );
        }
      }
    }

    const result = await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role, roleUpdatedAt: new Date(), roleUpdatedBy: user.userId } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, userId, role });
  } catch (error) {
    console.error("Failed to assign role:", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}