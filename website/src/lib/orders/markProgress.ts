import client from "@/lib/mongodb";
import type { OrderProgress } from "./progress";

export async function markOrderProgress(
  orderId: string,
  progress: OrderProgress
): Promise<void> {
  try {
    const dbName = process.env.MONGODB_DB || "fitvisualizer";
    const db = client.db(dbName);
    await db.collection("orders").updateOne(
      { orderId },
      {
        $set: {
          progress,
          updatedAt: new Date(),
          ...(progress === "ready" ? { solvedAt: new Date() } : {}),
        },
      }
    );
  } catch (err) {
    console.warn("Failed to mark order progress:", err);
  }
}