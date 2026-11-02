
import client from "@/lib/mongodb";
import type { OrderProgress } from "./progress";

/**
 * Update an order's progress in MongoDB.
 *
 * Rules:
 * - Ready orders must have an assigned packer.
 * - A saved solution records solvedAt, even while assignment is pending.
 * - Active packing and packed orders cannot be overwritten
 *   by a delayed solver update.
 */
export async function markOrderProgress(
  orderId: string,
  progress: OrderProgress
): Promise<void> {
  const db = client.db(
    process.env.MONGODB_DB || "fitvisualizer"
  );

  const orders = db.collection("orders");
  const now = new Date();

  const filter: Record<string, unknown> = {
    orderId,
  };

  // Solver updates must not overwrite active packing.
  if (
    progress === "solving" ||
    progress === "awaiting_assignment" ||
    progress === "ready" ||
    progress === "failed"
  ) {
    filter.progress = {
      $nin: ["packing", "packed", "on_hold"],
    };
  }

  // An order must have a packer before becoming ready.
  if (progress === "ready") {
    filter.assignedUserId = {
      $exists: true,
      $nin: [null, ""],
    };
  }

  const update =
    progress === "ready" || progress === "awaiting_assignment"
      ? [
          {
            $set: {
              progress,
              updatedAt: now,

              // Keep the original timestamp if present.
              // Otherwise record when the solution became available.
              solvedAt: {
                $ifNull: ["$solvedAt", now],
              },
            },
          },
        ]
      : [
          {
            $set: {
              progress,
              updatedAt: now,
            },
          },
        ];

  const result = await orders.updateOne(
    filter,
    update
  );

  if (result.matchedCount === 0) {
    throw new Error(
      `Cannot update order ${orderId} to ${progress}. ` +
        "The order may be missing, locked, or lack an assigned packer."
    );
  }
}
