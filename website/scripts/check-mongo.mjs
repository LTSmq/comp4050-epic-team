// Checks that the portal can reach the MongoDB cluster set in .env.local and
// that transactions work (autoAssign.ts and claimAssigned.ts need them).
//
//   cd website
//   node --env-file=.env.local scripts/check-mongo.mjs

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "fitvisualizer";
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const admin = client.db("admin");

  const hello = await admin.command({ hello: 1 });
  if (!hello.setName) {
    console.error("Connected, but this is a standalone server, not a replica set.");
    console.error("Transactions (packing assignment / claiming) will fail here.");
    process.exitCode = 1;
  } else {
    console.log(`Replica set : ${hello.setName}`);
    console.log(`Primary     : ${hello.primary}`);
    console.log(`Members     : ${hello.hosts.join(", ")}`);
  }

  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  console.log(`\nDatabase "${dbName}":`);
  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${name.padEnd(14)} ${await db.collection(name).countDocuments()} docs`);
  }
  if (collections.length === 0) console.log("  (empty - copy your data across or let the app create it)");

  if (hello.setName) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("packingLocks").updateOne(
          { _id: "allocation" },
          { $setOnInsert: { version: 0 } },
          { upsert: true, session }
        );
      });
      console.log("\nTransaction test: OK");
    } finally {
      await session.endSession();
    }
  }
} catch (err) {
  console.error("\nCould not use the cluster:", err.message);
  if (/ENOTFOUND|getaddrinfo/.test(err.message)) {
    console.error("Hint: add '127.0.0.1 mongo1 mongo2 mongo3' to your hosts file.");
  }
  process.exitCode = 1;
} finally {
  await client.close();
}