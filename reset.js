/**
 * reset-database.js
 *
 * Wipes ALL data used by the Freshers' Quiz app.
 * Collections touched: quiz, questions, participants, responses, results, counters
 *
 * Usage:
 *   node reset-database.js                 -> deletes all documents, KEEPS collections + indexes
 *   node reset-database.js --drop          -> drops the collections entirely (indexes gone too;
 *                                             they'll be recreated automatically next time the
 *                                             app boots, since ensureSeed() in route.js re-creates them)
 *
 * Safety: this will NOT run without typing "DELETE" at the confirmation prompt,
 * or passing --yes to skip the prompt (e.g. for CI/automation).
 *
 * Requires: MONGO_URL and (optionally) DB_NAME environment variables,
 * same as the app itself.
 *
 *   MONGO_URL="mongodb+srv://..." node reset-database.js
 */

import { MongoClient } from "mongodb";
import readline from "readline";

const COLLECTIONS = ["participants", "questions", "results"];

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || "freshers_quiz";

const args = process.argv.slice(2);
const shouldDrop = args.includes("--drop");
const skipConfirm = args.includes("--yes");

function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function wipeAll(db, { drop }) {
  const summary = [];
  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    if (drop) {
      const exists = await db.listCollections({ name }).toArray();
      if (exists.length > 0) {
        await collection.drop();
        summary.push(`  - ${name}: dropped (collection + indexes removed)`);
      } else {
        summary.push(`  - ${name}: did not exist, skipped`);
      }
    } else {
      const result = await collection.deleteMany({});
      summary.push(`  - ${name}: ${result.deletedCount} document(s) deleted`);
    }
  }
  return summary;
}

async function main() {
  if (!uri) {
    console.error("ERROR: MONGO_URL environment variable is not set.");
    process.exit(1);
  }

  console.log(`Target database: "${dbName}"`);
  console.log(
    `Mode: ${shouldDrop ? "DROP collections (removes indexes too)" : "Delete all documents (keeps indexes)"}`,
  );
  console.log(`Collections affected: ${COLLECTIONS.join(", ")}`);
  console.log("");
  console.log("THIS CANNOT BE UNDONE.");
  console.log("");

  if (!skipConfirm) {
    const answer = await confirm(
      'Type "DELETE" to proceed, or anything else to cancel: ',
    );
    if (answer !== "DELETE") {
      console.log("Cancelled. No changes made.");
      process.exit(0);
    }
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const summary = await wipeAll(db, { drop: shouldDrop });
    console.log("");
    console.log("Done:");
    summary.forEach((line) => console.log(line));
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
