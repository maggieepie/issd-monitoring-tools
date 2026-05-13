import oracledb from "oracledb";

import { env } from "../config/env.js";
import { getPool } from "./oraclePool.js";

const TABLE = "MONITORING_PROJECTS";

/**
 * Creates MONITORING_PROJECTS in the connected user's schema if it does not exist.
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
    if (cnt > 0) {
      return;
    }

    await connection.execute(
      `CREATE TABLE ${TABLE} (
        ID NUMBER(18) PRIMARY KEY,
        CONTRACT_NAME VARCHAR2(500) NOT NULL,
        CONTRACT_DATE DATE NOT NULL,
        DURATION VARCHAR2(200) NOT NULL,
        GOODS VARCHAR2(200) NOT NULL,
        AMOUNT NUMBER(18, 2) NOT NULL,
        OUTSTANDING NUMBER(18, 2) NOT NULL
      )`,
      [],
      { autoCommit: true },
    );
    console.log(`Oracle: created table ${TABLE}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ORA-00955")) {
      return;
    }
    const hint =
      "If this user cannot CREATE TABLE, run backend/sql/monitoring-projects.sql as a DBA, or set MONITORING_AUTO_DDL=0 and create the table manually.";
    console.error(`Oracle: failed to auto-create ${TABLE}`, err);
    throw new Error(`${msg} ${hint}`);
  } finally {
    await connection.close();
  }
}

export { ensureMonitoringProjectsTable };
