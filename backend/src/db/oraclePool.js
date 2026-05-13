import oracledb from "oracledb";

import { env } from "../config/env.js";

/** @type {import("oracledb").Pool | undefined} */
let pool;

function initThickModeIfNeeded() {
  if (!env.oracle.enabled || !env.oracle.thickMode) {
    return;
  }

  const options = env.oracle.clientLibDir
    ? { libDir: env.oracle.clientLibDir }
    : {};

  try {
    oracledb.initOracleClient(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/DPI-1047|NJS-045|NJS-046/i.test(message)) {
      throw err;
    }
    if (/DPI-1072/i.test(message)) {
      throw err;
    }
    console.warn("Oracle: initOracleClient:", message);
    throw err;
  }

  console.log(
    env.oracle.clientLibDir
      ? `Oracle: Thick mode (Instant Client from ${env.oracle.clientLibDir})`
      : "Oracle: Thick mode (Instant Client from PATH)",
  );
}

async function initOraclePool() {
  if (!env.oracle.enabled) {
    console.log(
      "Oracle: skipped (set ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING to enable)",
    );
    return;
  }

  initThickModeIfNeeded();

  pool = await oracledb.createPool({
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.connectString,
    poolMin: env.oracle.poolMin,
    poolMax: env.oracle.poolMax,
    poolIncrement: 1,
  });

  console.log("Oracle: connection pool ready");
}

async function closeOraclePool() {
  if (!pool) return;
  await pool.close(10);
  pool = undefined;
  console.log("Oracle: connection pool closed");
}

async function pingOracle() {
  if (!pool) {
    throw new Error("Oracle pool is not initialized");
  }
  const connection = await pool.getConnection();
  try {
    await connection.execute("SELECT 1 AS ok FROM DUAL");
  } finally {
    await connection.close();
  }
}

async function getDbHealth() {
  if (!env.oracle.enabled) {
    return { status: "not_configured" };
  }
  if (!pool) {
    return { status: "unavailable", message: "Pool not initialized" };
  }
  try {
    await pingOracle();
    return { status: "ok" };
  } catch (err) {
    return {
      status: "unavailable",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export { closeOraclePool, getDbHealth, initOraclePool, pingOracle };
