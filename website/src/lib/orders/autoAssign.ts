
import client from "@/lib/mongodb";
import type { ClientSession } from "mongodb";

const db = () =>
  client.db(process.env.MONGODB_DB || "fitvisualizer");

type PackingLock = {
  _id: string;
  version: number;
};

type Workload = {
  userId: string;
  username: string;
  count: number;
};

/**
 * Serialise automatic assignment transactions.
 *
 * Concurrent transactions updating this lock will
 * conflict, allowing MongoDB to retry the allocation.
 */
async function lockAllocation(
  session: ClientSession
): Promise<void> {
  const locks = db().collection<PackingLock>(
    "packingLocks"
  );

  const result = await locks.updateOne(
    { _id: "allocation" },
    { $inc: { version: 1 } },
    { session }
  );

  if (result.matchedCount !== 1) {
    throw new Error(
      "Packing allocation lock not found."
    );
  }
}

/**
 * Automatically assign an order to the team member
 * with the lowest pending workload.
 *
 * Pending workload includes:
 * - solving
 * - ready
 * - packing
 * - on_hold
 *
 * Packed orders do not count.
 *
 * Returns the assigned packer's user ID.
 */
export async function autoAssignOrder(
  orderId: string
): Promise<string> {
  const database = db();

  const orders = database.collection("orders");
  const users = database.collection("users");

  const locks =
    database.collection<PackingLock>("packingLocks");

  // Initialise the shared allocation lock.
  await locks.updateOne(
    { _id: "allocation" },
    { $setOnInsert: { version: 0 } },
    { upsert: true }
  );

  const session = client.startSession();

  try {
    const assignedUserId =
      await session.withTransaction(async () => {
        // Prevent overlapping allocations from
        // using the same workload snapshot.
        await lockAllocation(session);

        const order = await orders.findOne(
          { orderId },
          { session }
        );

        if (!order) {
          throw new Error(
            `Order ${orderId} not found.`
          );
        }

        // Keep an existing assignment.
        if (
          typeof order.assignedUserId === "string" &&
          order.assignedUserId.length > 0
        ) {
          return order.assignedUserId;
        }

        // Find team members eligible for packing.
        const packers = await users
          .find(
            { role: "team" },
            {
              session,
              projection: {
                username: 1,
              },
            }
          )
          .toArray();

        if (packers.length === 0) {
          throw new Error(
            "No team members available for packing."
          );
        }

        // Count each packer's unfinished assignments in ONE query.
        // (Parallel operations inside a transaction are not supported.)
        const packerIds = packers.map((packer) =>
          packer._id.toString()
        );

        const counts = await orders
          .aggregate<{ _id: string; count: number }>(
            [
              {
                $match: {
                  assignedUserId: { $in: packerIds },
                  progress: {
                    $in: [
                      "solving",
                      "ready",
                      "packing",
                      "on_hold",
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$assignedUserId",
                  count: { $sum: 1 },
                },
              },
            ],
            { session }
          )
          .toArray();

        const countById = new Map(
          counts.map((c) => [c._id, c.count])
        );

        const workloads: Workload[] = packers.map(
          (packer) => {
            const userId = packer._id.toString();

            return {
              userId,
              username: String(
                packer.username ?? userId
              ),
              count: countById.get(userId) ?? 0,
            };
          }
        );

        // Least workload first.
        // User ID provides a stable tie-breaker.
        workloads.sort(
          (a, b) =>
            a.count - b.count ||
            a.userId.localeCompare(b.userId)
        );

        const selected = workloads[0];

        if (!selected) {
          throw new Error(
            "No eligible packer found."
          );
        }

        const now = new Date();

        // Assign only if the order is still unassigned.
        const result = await orders.updateOne(
          {
            orderId,
            assignedUserId: {
              $in: [null, ""],
            },
          },
          {
            $set: {
              assignedUserId: selected.userId,
              assignedUserName: selected.username,
              assignedAt: now,
              updatedAt: now,
            },
          },
          { session }
        );

        if (result.modifiedCount !== 1) {
          throw new Error(
            "Order assignment conflict. Please retry."
          );
        }

        return selected.userId;
      });

    if (!assignedUserId) {
      throw new Error(
        "Automatic assignment did not return a packer."
      );
    }

    return assignedUserId;
  } finally {
    await session.endSession();
  }
}
