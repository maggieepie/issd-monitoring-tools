import fs from "node:fs";
import path from "node:path";

import oracledb from "oracledb";

import { env } from "../config/env.js";

/** @type {import("oracledb").Pool | undefined} */
let pool;

function assertInstantClientOciPresent() {
  if (!env.oracle.clientLibDir) return;
  const ociDll = path.join(env.oracle.clientLibDir, "oci.dll");
  if (!fs.existsSync(ociDll)) {
    throw new Error(
      `Oracle Instant Client: oci.dll not found at ${ociDll}. Unzip the "Basic" or "Basic Light" Instant Client so oci.dll is in that folder. In .env use forward slashes for paths (C:/oracle/instantclient_23_0) to avoid parsing issues.`,
    );
  }
}

function initThickModeIfNeeded() {
  if (!env.oracle.enabled || !env.oracle.thickMode) {
    return;
  }

  assertInstantClientOciPresent();

  const options = env.oracle.clientLibDir
    ? { libDir: env.oracle.clientLibDir }
    : {};

  try {
    oracledb.initOracleClient(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/DPI-1047|NJS-045|NJS-046/i.test(message)) {
      const hint =
        env.oracle.clientLibDir &&
        fs.existsSync(path.join(env.oracle.clientLibDir, "oci.dll"))
          ? " If oci.dll is present, install Microsoft Visual C++ 2015–2022 Redistributable (x64) from Microsoft, then restart."
          : " Confirm ORACLE_CLIENT_LIB_DIR points at the folder that contains oci.dll (use forward slashes in .env).";
      throw new Error(`${message}${hint}`);
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

  if (env.oracle.enabled && !env.oracle.thickMode) {
    console.log(
      "Oracle: Thin mode (ORACLE_THIN=1). Only use for DB versions supported by node-oracledb Thin.",
    );
  }

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

async function getDbHealth() {
  if (!env.oracle.enabled) {
    return { status: "not_configured" };
  }
  if (!pool) {
    return { status: "unavailable", message: "Pool not initialized" };
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT USER AS db_user,
              SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name,
              SYSTIMESTAMP AS db_time
         FROM dual`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const row = result.rows?.[0];
    if (!row) {
      return {
        status: "unavailable",
        message: "Oracle returned no row from DUAL",
      };
    }

    const dbTimeRaw = row.DB_TIME ?? row.db_time;
    const dbTime =
      dbTimeRaw instanceof Date
        ? dbTimeRaw.toISOString()
        : dbTimeRaw != null
          ? String(dbTimeRaw)
          : null;

    return {
      status: "ok",
      proof: {
        note: "Values returned by the database (not the app clock).",
        dbUser: row.DB_USER ?? row.db_user,
        dbName: row.DB_NAME ?? row.db_name ?? null,
        dbTime,
      },
    };
  } catch (err) {
    return {
      status: "unavailable",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function getPool() {
  if (!pool) {
    const err = new Error("Oracle pool is not available.");
    err.status = 503;
    throw err;
  }
  return pool;
}

export { closeOraclePool, getDbHealth, getPool, initOraclePool };
