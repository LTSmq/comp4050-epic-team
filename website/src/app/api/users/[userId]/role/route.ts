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

    // Concurrent role changes write a shared durable document in their
    // transactions, forcing retries against a fresh supervisor count.
    const locks = db.collection<{ _id: string; version: number }>("roleLocks");
    await locks.updateOne({ _id: "supervisors" }, { $setOnInsert: { version: 0 } }, { upsert: true });
    const session = client.startSession();
    let outcome: "ok" | "forbidden" | "missing" | "last" = "missing";
    try {
      outcome = await session.withTransaction(async () => {
        await locks.updateOne({ _id: "supervisors" }, { $inc: { version: 1 } }, { session });
        // The actor may have been demoted after the session was read.
        const actor = await users.findOne({ _id: new ObjectId(user.userId), role: "supervisor" }, { session });
        if (!actor) return "forbidden" as const;
        const target = await users.findOne({ _id: new ObjectId(userId) }, { session });
        if (!target) return "missing" as const;
        if (target.role === "supervisor" && role !== "supervisor" &&
            await users.countDocuments({ role: "supervisor" }, { session }) <= 1) return "last" as const;
        await users.updateOne(
          { _id: target._id },
          { $set: { role, roleUpdatedAt: new Date(), roleUpdatedBy: user.userId } },
          { session }
        );
        return "ok" as const;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally {
      await session.endSession();
    }
    if (outcome === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (outcome === "missing") return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (outcome === "last") return NextResponse.json({ error: "Cannot remove the last supervisor." }, { status: 400 });

    return NextResponse.json({ success: true, userId, role });
  } catch (error) {
    console.error("Failed to assign role:", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}
