import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeOraclePool, initOraclePool } from "./db/oraclePool.js";

async function start() {
  try {
    await initOraclePool();
  } catch (err) {
    console.error("Oracle: failed to start connection pool", err);
    if (env.oracle.enabled) {
      process.exit(1);
    }
  }

  const server = app.listen(env.port, () => {
    console.log(`Backend server running on http://localhost:${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal}: shutting down…`);
    await new Promise((resolve) => {
      server.close(() => resolve(undefined));
    });
    await closeOraclePool();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void start();
