import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    if (!can(user, "user:manage"))
      return NextResponse.json({ message: "Supervisor access required." }, { status: 403 });

    const { id } = await context.params;
    if (!ObjectId.isValid(id))
      return NextResponse.json({ message: "Invalid user id." }, { status: 400 });

    const { role } = await request.json();
    if (role !== "user" && role !== "supervisor")
      return NextResponse.json({ message: 'Role must be "user" or "supervisor".' }, { status: 400 });

    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const users = client.db(dbName).collection("users");
    const targetId = new ObjectId(id);

    // Never remove the last supervisor — it would lock everyone out of user management.
    if (role === "user") {
      const target = await users.findOne({ _id: targetId });
      if (!target) return NextResponse.json({ message: "User not found." }, { status: 404 });
      if (target.role === "supervisor") {
        const supervisors = await users.countDocuments({ role: "supervisor" });
        if (supervisors <= 1)
          return NextResponse.json({ message: "Cannot remove the last supervisor." }, { status: 409 });
      }
    }

    const result = await users.updateOne({ _id: targetId }, { $set: { role } });
    if (result.matchedCount === 0)
      return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json({ message: `Role updated to ${role}.`, id, role });
  } catch (error) {
    console.error("Failed to update role:", error);
    return NextResponse.json({ message: "Unable to update role." }, { status: 500 });
  }
}