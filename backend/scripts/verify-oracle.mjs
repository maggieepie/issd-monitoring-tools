/**
 * One-shot check: loads .env, starts the pool, runs the same proof query as /api/health.
 * Usage (from repo root): npm run verify:db --prefix backend
 */
import { closeOraclePool, getDbHealth, initOraclePool } from "../src/db/oraclePool.js";

await initOraclePool();
const database = await getDbHealth();
console.log(JSON.stringify({ database }, null, 2));
if (database.status !== "ok") {
  process.exitCode = 1;
}
await closeOraclePool();
