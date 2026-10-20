
import client from "@/lib/mongodb";
import { CLAIM_TTL_MS } from "./progress";

const db = () =>
  client.db(process.env.MONGODB_DB || "fitvisualizer");

type PackingLock = {
  _id: string;
  version: number;
};

export class ClaimError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

/**
 * Claim an order assigned to the current packer.
 *
 * Rules:
 * 1. Only the assigned packer may claim the order.
 * 2. A packer can have only one active order.
 * 3. Ready orders must be claimed in FIFO order.
 * 4. Different packers can work simultaneously.
 * 5. Expired claims may be reclaimed.
 * 6. A supervisor may pack any ready order (rules 1 and 3 do not apply).
 *
 * Requires MongoDB transaction support.
 */
export async function claimAssignedOrder(
  orderId: string,
  userId: string,
  username: string,
  supervisor = false
): Promise<void> {
  const database = db();

  const orders = database.collection("orders");
  const locks =
    database.collection<PackingLock>("packingLocks");

  const lockId = `claim:${userId}`;

  // Ensure the packer has a lock document.
  await locks.updateOne(
    { _id: lockId },
    { $setOnInsert: { version: 0 } },
    { upsert: true }
  );

  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      // Serialise claims for this packer.
      await locks.updateOne(
        { _id: lockId },
        { $inc: { version: 1 } },
        { session }
      );

      const now = new Date();
      const staleBefore = new Date(
        now.getTime() - CLAIM_TTL_MS
      );

      const order = await orders.findOne(
        { orderId },
        { session }
      );

      if (!order) {
        throw new ClaimError(
          "Order not found.",
          404
        );
      }

      // The logged-in packer must own this assignment.
      if (!supervisor && order.assignedUserId !== userId) {
        throw new ClaimError(
          "This order is assigned to another packer.",
          403
        );
      }

      // Find any active order belonging to this packer.
      const active = await orders.findOne(
        {
          "packer.id": userId,
          progress: "packing",
          $or: [
            { claimedAt: { $gte: staleBefore } },
            { claimedAt: null },
          ],
        },
        { session }
      );

      // Claiming an already active order is idempotent.
      if (active?.orderId === orderId) {
        return;
      }

      if (active) {
        throw new ClaimError(
          `Finish order ${active.orderId} first.`,
          409
        );
      }

      // Someone else (e.g. a supervisor) is actively packing this order.
      if (
        order.progress === "packing" &&
        order.packer?.id !== userId &&
        order.claimedAt instanceof Date &&
        order.claimedAt >= staleBefore
      ) {
        throw new ClaimError(
          `Being packed by ${order.packer?.name ?? "someone else"}.`,
          409
        );
      }

      // FIFO includes ready orders and expired claims.
      const eligible = {
        assignedUserId: userId,
        $or: [
          { progress: "ready" },
          {
            progress: "packing",
            claimedAt: { $lt: staleBefore },
          },
        ],
      };

      // Supervisors are not part of the FIFO queue.
      if (!supervisor) {
        const oldest = await orders
          .find(eligible, { session })
          .sort({
            solvedAt: 1,
            orderId: 1,
          })
          .limit(1)
          .next();

        if (!oldest) {
          throw new ClaimError(
            "No orders are ready for packing.",
            409
          );
        }

        if (oldest.orderId !== orderId) {
          throw new ClaimError(
            `Pack order ${oldest.orderId} first.`,
            409
          );
        }
      }

      // Atomic state transition.
      const result = await orders.updateOne(
        {
          orderId,
          ...(supervisor ? {} : { assignedUserId: userId }),
          $or: [
            { progress: "ready" },
            {
              progress: "packing",
              claimedAt: { $lt: staleBefore },
            },
          ],
        },
        {
          $set: {
            progress: "packing",
            packer: {
              id: userId,
              name: username,
            },
            claimedAt: now,
            updatedAt: now,
          },
        },
        { session }
      );

      if (result.modifiedCount !== 1) {
        throw new ClaimError(
          "Order changed. Please retry.",
          409
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
