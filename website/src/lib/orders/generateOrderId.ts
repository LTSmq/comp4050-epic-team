import client from "@/lib/mongodb";

type Counter = { _id: string; seq: number };

const PREFIX = "PF-";
const DIGITS = 6;
const COUNTER_ID = "orderId";

/**
 * Short, sequential, human-friendly order ID: PF-000123.
 *
 * - Atomic: $inc on a single counter document, safe under concurrent requests.
 * - Self-seeding: the first call starts after the highest existing PF-###### order,
 *   so no manual database step is needed.
 * - The unique index on orders.orderId remains the final safety net.
 */
export async function generateOrderId(): Promise<string> {
  const db = client.db(process.env.MONGODB_DB || "fitvisualizer");
  const counters = db.collection<Counter>("counters");

  if (!(await counters.findOne({ _id: COUNTER_ID }))) {
    const last = await db
      .collection("orders")
      .find(
        { orderId: { $regex: `^${PREFIX}\\d{${DIGITS}}$` } },
        { projection: { orderId: 1 } }
      )
      .sort({ orderId: -1 })
      .limit(1)
      .next();

    const highest = last ? Number(String(last.orderId).slice(PREFIX.length)) : 0;

    // $max makes concurrent first calls harmless: the counter never moves backwards.
    await counters.updateOne(
      { _id: COUNTER_ID },
      { $max: { seq: highest } },
      { upsert: true }
    );
  }

  const counter = await counters.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  if (!counter) {
    throw new Error("Could not allocate an order ID.");
  }

  return `${PREFIX}${String(counter.seq).padStart(DIGITS, "0")}`;
}
