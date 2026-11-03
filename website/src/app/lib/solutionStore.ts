import client from "@/lib/mongodb";
import type { ObjectId } from "mongodb";
import type { VisualiserCarton, SolverPackingResponse } from "./types";
import type { SolverSolution } from "@/lib/solver/solution";

export type StoredRawSolution = SolverSolution | SolverPackingResponse;

export interface StoredSolution {
  orderId: string;
  cartons: VisualiserCarton[];
  raw: StoredRawSolution;
  receivedAt: string;
  generation?: string;
}

const database = () => client.db(process.env.MONGODB_DB || "fitvisualizer");

/** The attempt no longer owns the order; no solution was written. */
export class StaleSolveError extends Error {
  constructor() {
    super("The order or solve changed. Generate a new packing layout.");
    this.name = "StaleSolveError";
  }
}

/**
 * The order transition and solution are one transaction. Updating the order
 * first makes edits, claims, deletion and other attempts conflict with this
 * transaction; a retry rechecks the attempt before any write can commit.
 */
export async function acceptSolution(
  orderId: string,
  orderDocumentId: ObjectId,
  generation: string,
  cartons: VisualiserCarton[],
  raw: StoredRawSolution
): Promise<void> {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const result = await database().collection("orders").updateOne(
        { _id: orderDocumentId, orderId, solveGeneration: generation, progress: "solving" },
        [{ $set: {
          progress: "awaiting_assignment",
          solutionGeneration: generation,
          solvedAt: { $ifNull: ["$solvedAt", now] },
          updatedAt: now,
        } }],
        { session }
      );
      if (result.matchedCount !== 1) throw new StaleSolveError();

      const doc: StoredSolution = {
        orderId, cartons, raw, generation, receivedAt: now.toISOString(),
      };
      await database().collection("solutions").updateOne(
        { orderId },
        { $set: { ...doc, updatedAt: now } },
        { upsert: true, session }
      );
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
}

/** MongoDB is authoritative. A process-local cache cannot be invalidated by
 * edits, deletes or solves performed by another server instance. */
export async function getSolution(orderId: string): Promise<StoredSolution | undefined> {
  const doc = await database().collection<StoredSolution>("solutions").findOne({ orderId });
  return doc ?? undefined;
}

export async function listSolutions() {
  const ids = await database().collection("orders")
    .find({ progress: { $in: ["ready", "packing", "packed", "on_hold", "awaiting_assignment"] }, solvedAt: { $ne: null } },
      { projection: { orderId: 1 } })
    .toArray();
  const solutions = await database().collection<StoredSolution>("solutions")
    .find({ orderId: { $in: ids.map((order) => order.orderId) } })
    .sort({ receivedAt: -1 }).toArray();
  return solutions.map((s) => ({
    orderId: s.orderId,
    receivedAt: s.receivedAt,
    cartonCount: s.cartons.length,
    itemCount: s.cartons.reduce((sum, c) => sum + (c.items?.length || 0), 0),
  }));
}
