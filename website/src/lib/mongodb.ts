import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Please define MONGODB_URI in .env.local");
}
const dbName = process.env.MONGODB_DB || "fitvisualizer";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __mongoReady: Promise<MongoClient> | undefined;
}

const client = global.__mongoClient ?? new MongoClient(uri, { maxPoolSize: 10 });
if (!global.__mongoClient) global.__mongoClient = client;

// Connect once and build indexes once. Idempotent, safe under hot reload.
global.__mongoReady ??= client.connect().then(async (c) => {
  await ensureIndexes(c.db(dbName));
  return c;
});

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ username: 1 }),
    db.collection("users").createIndex({ role: 1 }),
    db.collection("orders").createIndex({ orderId: 1 }, { unique: true }),
    db.collection("orders").createIndex({ customerId: 1, updatedAt: -1 }),
    db.collection("orders").createIndex({ progress: 1, solvedAt: 1 }), // packing list
    db.collection("orders").createIndex({ updatedAt: 1 }), // packing list live updates
    db.collection("solutions").createIndex({ orderId: 1 }, { unique: true }),
  ]).catch((err) => console.warn("ensureIndexes:", err));
}

export default client;
