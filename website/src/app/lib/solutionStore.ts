import type { VisualiserCarton, SolverPackingResponse } from "./types";

export interface StoredSolution {
  orderId: string;
  cartons: VisualiserCarton[];
  raw: SolverPackingResponse;
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
    const db = client.db(process.env.MONGODB_DB || "comp4050");
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
  raw: SolverPackingResponse
) {
  const doc: StoredSolution = { orderId, cartons, raw, receivedAt: new Date().toISOString() };
  store.delete(orderId);
  store.set(orderId, doc);
  persistToMongo(orderId, doc);
  return doc;
}

export const getSolution = (id: string) => store.get(id);

export const getLatestSolution = () => Array.from(store.values()).pop();

export const listSolutions = () =>
  Array.from(store.values())
    .reverse()
    .map((s) => ({
      orderId: s.orderId,
      receivedAt: s.receivedAt,
      cartonCount: s.cartons.length,
      itemCount: s.cartons.reduce((sum, c) => sum + (c.items?.length || 0), 0),
    }));

export const clearSolutions = () => store.clear();
