import oracledb from "oracledb";

import { env } from "../config/env.js";
import { getPool } from "./oraclePool.js";

const TABLE = "MONITORING_PROJECTS";

const CREATE_SQL = `CREATE TABLE ${TABLE} (
        ID NUMBER(18) PRIMARY KEY,
        CONTRACT_NAME VARCHAR2(500) NOT NULL,
        CONTRACT_DATE DATE NOT NULL,
        DURATION VARCHAR2(200) NOT NULL,
        GOODS VARCHAR2(200) NOT NULL,
        AMOUNT NUMBER(18, 2) NOT NULL,
        OUTSTANDING NUMBER(18, 2) NOT NULL,
        CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
      )`;

/** @param {import("oracledb").Connection} connection */
async function listUserColumns(connection) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = :t`,
    { t: TABLE },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return new Set(
    (result.rows || []).map((row) =>
      String(row.COLUMN_NAME ?? row.column_name ?? "").toUpperCase(),
    ),
  );
}

/** @param {import("oracledb").Connection} connection */
async function ensureAuditColumns(connection) {
  let cols = await listUserColumns(connection);
  if (!cols.has("CREATED_AT")) {
    await connection.execute(
      `ALTER TABLE ${TABLE} ADD (CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
      [],
      { autoCommit: true },
    );
    cols = await listUserColumns(connection);
    console.log(`Oracle: added CREATED_AT to ${TABLE}`);
  }
  if (!cols.has("UPDATED_AT")) {
    await connection.execute(
      `ALTER TABLE ${TABLE} ADD (UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
      [],
      { autoCommit: true },
    );
    console.log(`Oracle: added UPDATED_AT to ${TABLE}`);
  }
}

/**
 * Creates MONITORING_PROJECTS in the connected user's schema if it does not exist, and adds
 * CREATED_AT / UPDATED_AT when missing (matches backend/sql/monitoring-projects.sql).
 * Disable with MONITORING_AUTO_DDL=0 when a DBA manages DDL separately.
 */
async function ensureMonitoringProjectsTable() {
  if (!env.oracle.enabled || !env.oracle.monitoringAutoDdl) {
    return;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const check = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = :tname`,
      { tname: TABLE },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = check.rows?.[0];
    const cnt = Number(row?.CNT ?? row?.cnt ?? 0);
    if (cnt === 0) {
      try {
        await connection.execute(CREATE_SQL, [], { autoCommit: true });
        console.log(`Oracle: created table ${TABLE}`);
      } catch (createErr) {
        const createMsg =
          createErr instanceof Error ? createErr.message : String(createErr);
        if (!createMsg.includes("ORA-00955")) {
          throw createErr;
        }
      }
    }

    await ensureAuditColumns(connection);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint =
      "If this user cannot CREATE TABLE, run backend/sql/monitoring-projects.sql as a DBA, or set MONITORING_AUTO_DDL=0 and create the table manually.";
    console.error(`Oracle: failed to auto-create ${TABLE}`, err);
    throw new Error(`${msg} ${hint}`);
  } finally {
    await connection.close();
  }
}

export { ensureMonitoringProjectsTable };
