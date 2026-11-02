import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Please define MONGODB_URI in .env.local");
}
const dbName = process.env.MONGODB_DB || "fitvisualizer";

declare global {
  var __mongoClient: MongoClient | undefined;
  var __mongoReady: Promise<MongoClient> | undefined;
}

const client = global.__mongoClient ?? new MongoClient(uri, { maxPoolSize: 10 });
if (!global.__mongoClient) global.__mongoClient = client;

// Connect once and build indexes once. Idempotent, safe under hot reload.
global.__mongoReady ??= client.connect().then(async (c) => {
  await ensureIndexes(c.db(dbName));
  return c;
});
// Never serve identity/order APIs before the uniqueness constraints exist.
// In particular, main-era owner-scoped order IDs may collide globally.
export const mongoReady = global.__mongoReady;
void mongoReady.catch((err) => console.error("MongoDB index setup failed:", err));

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    // Case-insensitive unique usernames (login matches usernames case-insensitively).
    db.collection("users").createIndex(
      { username: 1 },
      { unique: true, collation: { locale: "en", strength: 2 }, name: "username_unique_ci" }
    ),
    db.collection("users").createIndex({ role: 1 }),
    db.collection("orders").createIndex({ orderId: 1 }, { unique: true }),
    db.collection("orders").createIndex({ customerId: 1, updatedAt: -1 }),
    db.collection("orders").createIndex({ progress: 1, solvedAt: 1 }), // packing list
    db.collection("orders").createIndex({ updatedAt: 1 }), // packing list live updates
    // Auto-assignment workload count and each packer's own list both filter on these.
    db.collection("orders").createIndex({ assignedUserId: 1, progress: 1 }),
    db.collection("solutions").createIndex({ orderId: 1 }, { unique: true }),
  ]);
}

export default client;
