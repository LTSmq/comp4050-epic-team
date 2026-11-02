import type { VisualiserCarton, SolverPackingResponse } from "./types";
import type { SolverSolution } from "@/lib/solver/solution";

/**
 * The solver reply exactly as received. New solutions use the solver's
 * current shape (SolverSolution); ones saved before solver #26 still hold the
 * old PascalCase PackingResponse. Nothing reads raw for display: the
 * visualiser only uses `cartons`, which is the same shape for both.
 */
export type StoredRawSolution = SolverSolution | SolverPackingResponse;

export interface StoredSolution {
  orderId: string;
  cartons: VisualiserCarton[];
  raw: StoredRawSolution;
  receivedAt: string;
}

declare global {
  var __solutionStore: Map<string, StoredSolution> | undefined;
}


const store = (globalThis.__solutionStore ??= new Map<string, StoredSolution>());

async function persistToMongo(orderId: string, doc: StoredSolution) {
  if (!process.env.MONGODB_URI) return;
  try {
    const client = (await import("@/lib/mongodb")).default;
    const db = client.db(process.env.MONGODB_DB || "fitvisualizer");
    await db.collection("solutions").updateOne(
      { orderId },
      { $set: { ...doc, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.warn("MongoDB persist failed:", err);
  }
}

export async function saveSolution(
  orderId: string,
  cartons: VisualiserCarton[],
  raw: StoredRawSolution
) {
  const doc: StoredSolution = { orderId, cartons, raw, receivedAt: new Date().toISOString() };
  store.delete(orderId);
  store.set(orderId, doc);
  // Persist before the order is marked ready, so a restart (or another
  // server instance) never sees a "ready" order without its solution.
  await persistToMongo(orderId, doc);
  return doc;
}

export async function getSolution(id: string): Promise<StoredSolution | undefined> {
  const cached = store.get(id);
  if (cached) {
    return cached;
  }

  if (!process.env.MONGODB_URI) {
    return undefined;
  }

  try {
    const client = (await import("@/lib/mongodb")).default;
    const db = client.db(process.env.MONGODB_DB || "fitvisualizer");

    const doc = await db
      .collection<StoredSolution>("solutions")
      .findOne({ orderId: id });

    if (!doc) {
      return undefined;
    }

    const solution: StoredSolution = {
      orderId: doc.orderId,
      cartons: doc.cartons,
      raw: doc.raw,
      receivedAt: doc.receivedAt,
    };

    store.set(id, solution);
    return solution;
  } catch (err) {
    console.warn("MongoDB solution lookup failed:", err);
    return undefined;
  }
}

export async function deleteSolution(orderId: string): Promise<void> {
  store.delete(orderId);

  if (!process.env.MONGODB_URI) {
    return;
  }

  try {
    const client = (await import("@/lib/mongodb")).default;
    const db = client.db(process.env.MONGODB_DB || "fitvisualizer");

    await db.collection("solutions").deleteOne({ orderId });
  } catch (err) {
    console.warn("MongoDB solution delete failed:", err);
  }
}

export const listSolutions = () =>
  Array.from(store.values())
    .reverse()
    .map((s) => ({
      orderId: s.orderId,
      receivedAt: s.receivedAt,
      cartonCount: s.cartons.length,
      itemCount: s.cartons.reduce((sum, c) => sum + (c.items?.length || 0), 0),
    }));
