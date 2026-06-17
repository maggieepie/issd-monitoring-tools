import oracledb from "oracledb";

import { env } from "../config/env.js";
import { getPool } from "./oraclePool.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the set of existing column names (upper-cased) for a given table. */
async function listColumns(connection, tableName) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = :t`,
    { t: tableName },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return new Set(
    (result.rows || []).map((row) =>
      String(row.COLUMN_NAME ?? row.column_name ?? "").toUpperCase(),
    ),
  );
}

/** Creates a table if it does not already exist (ignores ORA-00955). */
async function createTableIfAbsent(connection, tableName, createSql) {
  const check = await connection.execute(
    `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name = :tname`,
    { tname: tableName },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = check.rows?.[0];
  const cnt = Number(row?.CNT ?? row?.cnt ?? 0);
  if (cnt === 0) {
    try {
      await connection.execute(createSql, [], { autoCommit: true });
      console.log(`Oracle: created table ${tableName}`);
    } catch (createErr) {
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      if (!msg.includes("ORA-00955")) throw createErr;
    }
  }
}

/** Adds ATTACHMENT_FILENAME to a table if it is missing. */
async function ensureAttachmentColumn(connection, tableName) {
  const cols = await listColumns(connection, tableName);
  if (!cols.has("ATTACHMENT_FILENAME")) {
    await connection.execute(
      `ALTER TABLE ${tableName} ADD (ATTACHMENT_FILENAME VARCHAR2(255))`,
      [],
      { autoCommit: true },
    );
    console.log(`Oracle: added ATTACHMENT_FILENAME to ${tableName}`);
  }
}

/** Adds CREATED_AT, UPDATED_AT, and IS_DELETED to a table if they are missing. */
async function ensureAuditColumns(connection, tableName) {
  let cols = await listColumns(connection, tableName);
  if (!cols.has("CREATED_AT")) {
    await connection.execute(
      `ALTER TABLE ${tableName} ADD (CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
      [],
      { autoCommit: true },
    );
    cols = await listColumns(connection, tableName);
    console.log(`Oracle: added CREATED_AT to ${tableName}`);
  }
  if (!cols.has("UPDATED_AT")) {
    await connection.execute(
      `ALTER TABLE ${tableName} ADD (UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
      [],
      { autoCommit: true },
    );
    cols = await listColumns(connection, tableName);
    console.log(`Oracle: added UPDATED_AT to ${tableName}`);
  }
  if (!cols.has("IS_DELETED")) {
    await connection.execute(
      `ALTER TABLE ${tableName} ADD (IS_DELETED NUMBER(1) DEFAULT 0 NOT NULL)`,
      [],
      { autoCommit: true },
    );
    console.log(`Oracle: added IS_DELETED to ${tableName}`);
  }
}

// ---------------------------------------------------------------------------
// MONITORING_PROJECTS
// ---------------------------------------------------------------------------

const PROJECTS_TABLE = "MONITORING_PROJECTS";
const PROJECTS_CREATE_SQL = `CREATE TABLE ${PROJECTS_TABLE} (
        ID            NUMBER(18)    PRIMARY KEY,
        CONTRACT_NAME VARCHAR2(500) NOT NULL,
        CONTRACT_DATE DATE          NOT NULL,
        DURATION      VARCHAR2(200) NOT NULL,
        GOODS         VARCHAR2(200) NOT NULL,
        AMOUNT        NUMBER(18, 2) NOT NULL,
        OUTSTANDING   NUMBER(18, 2) NOT NULL,
        IS_DELETED    NUMBER(1)     DEFAULT 0 NOT NULL,
        CREATED_AT    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
      )`;

// ---------------------------------------------------------------------------
// MONITORING_DV_PAYMENTS
// ---------------------------------------------------------------------------

const DV_TABLE = "MONITORING_DV_PAYMENTS";
const DV_CREATE_SQL = `CREATE TABLE ${DV_TABLE} (
        ID               NUMBER(18)    PRIMARY KEY,
        TITLE            VARCHAR2(500) NOT NULL,
        CLAIMANT_ADDRESS VARCHAR2(500) NOT NULL,
        VOUCHER_NO       VARCHAR2(200) NOT NULL,
        VOUCHER_DATE     DATE          NOT NULL,
        AMOUNT           NUMBER(18, 2) DEFAULT 0 NOT NULL,
        ICTSSD               VARCHAR2(100) DEFAULT 'Pending'  NOT NULL,
        GAD                  VARCHAR2(100) DEFAULT 'Pending'  NOT NULL,
        CASH                 VARCHAR2(100) DEFAULT 'Pending'  NOT NULL,
        ICTSSD_PENDING_SINCE TIMESTAMP,
        GAD_PENDING_SINCE    TIMESTAMP,
        CASH_PENDING_SINCE   TIMESTAMP,
        IS_DELETED           NUMBER(1)     DEFAULT 0 NOT NULL,
        CREATED_AT       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT       TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
      )`;

/** Adds per-department pending-since timestamps to DV payments when missing. */
async function ensureDvPendingSinceColumns(connection) {
  const pendingCols = [
    "ICTSSD_PENDING_SINCE",
    "GAD_PENDING_SINCE",
    "CASH_PENDING_SINCE",
  ];
  let cols = await listColumns(connection, DV_TABLE);
  for (const name of pendingCols) {
    if (!cols.has(name)) {
      await connection.execute(
        `ALTER TABLE ${DV_TABLE} ADD (${name} TIMESTAMP)`,
        [],
        { autoCommit: true },
      );
      cols = await listColumns(connection, DV_TABLE);
      console.log(`Oracle: added ${name} to ${DV_TABLE}`);
    }
  }
  await connection.execute(
    `UPDATE ${DV_TABLE}
        SET ICTSSD_PENDING_SINCE = CREATED_AT
      WHERE ICTSSD = 'Pending'
        AND ICTSSD_PENDING_SINCE IS NULL
        AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    [],
    { autoCommit: true },
  );
  await connection.execute(
    `UPDATE ${DV_TABLE}
        SET GAD_PENDING_SINCE = CREATED_AT
      WHERE GAD = 'Pending'
        AND GAD_PENDING_SINCE IS NULL
        AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    [],
    { autoCommit: true },
  );
  await connection.execute(
    `UPDATE ${DV_TABLE}
        SET CASH_PENDING_SINCE = CREATED_AT
      WHERE CASH = 'Pending'
        AND CASH_PENDING_SINCE IS NULL
        AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    [],
    { autoCommit: true },
  );
}

// ---------------------------------------------------------------------------
// MONITORING_OUTGOING
// ---------------------------------------------------------------------------

const OUTGOING_TABLE = "MONITORING_OUTGOING";
const OUTGOING_CREATE_SQL = `CREATE TABLE ${OUTGOING_TABLE} (
        ID          NUMBER(18)     PRIMARY KEY,
        SUBJECT     VARCHAR2(2000) NOT NULL,
        MEMO_NO     VARCHAR2(200)  NOT NULL,
        MEMO_DATE   DATE           NOT NULL,
        THRU        VARCHAR2(100)  NOT NULL,
        FOR_DEPT    VARCHAR2(100)  NOT NULL,
        IS_DELETED  NUMBER(1)      DEFAULT 0 NOT NULL,
        CREATED_AT  TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT  TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
      )`;

// ---------------------------------------------------------------------------
// MONITORING_DEPARTMENTS
// ---------------------------------------------------------------------------

const POLICIES_TABLE = "MONITORING_POLICIES";
const POLICIES_CREATE_SQL = `CREATE TABLE ${POLICIES_TABLE} (
        ID                NUMBER(18)    PRIMARY KEY,
        TRANSACTION_CODE  VARCHAR2(50)  NOT NULL,
        POLICY_TITLE      VARCHAR2(500) NOT NULL,
        CREATED_BY        VARCHAR2(200) NOT NULL,
        ASSIGNED_TO       VARCHAR2(200) NOT NULL,
        START_DATE        DATE          NOT NULL,
        END_DATE          DATE          NOT NULL,
        DAYS_COUNT        NUMBER(10),
        STATUS_LABEL      VARCHAR2(50)  NOT NULL,
        REMARKS           VARCHAR2(2000),
        IS_DELETED        NUMBER(1)     DEFAULT 0 NOT NULL,
        CREATED_AT        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT        TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
      )`;

const DEPARTMENTS_TABLE = "MONITORING_DEPARTMENTS";
const DEPARTMENTS_CREATE_SQL = `CREATE TABLE ${DEPARTMENTS_TABLE} (
        ID          NUMBER(18)    PRIMARY KEY,
        NAME        VARCHAR2(100) NOT NULL,
        KIND        VARCHAR2(10)  NOT NULL,
        IS_BUILTIN  NUMBER(1)     DEFAULT 0 NOT NULL,
        IS_DELETED  NUMBER(1)     DEFAULT 0 NOT NULL,
        CREATED_AT  TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
        UPDATED_AT  TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL
      )`;

const ATTACHMENTS_TABLE = "MONITORING_ATTACHMENTS";
const ATTACHMENTS_CREATE_SQL = `CREATE TABLE ${ATTACHMENTS_TABLE} (
        ID                NUMBER(18)     PRIMARY KEY,
        MODULE_KEY        VARCHAR2(50)   NOT NULL,
        RECORD_ID         NUMBER(18)     NOT NULL,
        STORED_FILENAME   VARCHAR2(255)  NOT NULL,
        ORIGINAL_FILENAME VARCHAR2(500),
        MIME_TYPE         VARCHAR2(100)  NOT NULL,
        IS_DELETED        NUMBER(1)      DEFAULT 0 NOT NULL,
        CREATED_AT        TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL
      )`;

// ---------------------------------------------------------------------------
// Public entry-point
// ---------------------------------------------------------------------------

/**
 * Creates MONITORING_PROJECTS, MONITORING_DV_PAYMENTS, MONITORING_OUTGOING,
 * and MONITORING_DEPARTMENTS
 * in the connected user's schema if they do not exist, and adds audit columns
 * when missing. Matches the DDL in backend/sql/*.sql.
 * Disable with MONITORING_AUTO_DDL=0 when a DBA manages DDL separately.
 */
async function ensureMonitoringProjectsTable() {
  if (!env.oracle.enabled || !env.oracle.monitoringAutoDdl) {
    return;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await createTableIfAbsent(connection, PROJECTS_TABLE, PROJECTS_CREATE_SQL);
    await ensureAuditColumns(connection, PROJECTS_TABLE);
    await ensureAttachmentColumn(connection, PROJECTS_TABLE);

    await createTableIfAbsent(connection, DV_TABLE, DV_CREATE_SQL);
    await ensureAuditColumns(connection, DV_TABLE);
    await ensureDvPendingSinceColumns(connection);
    await ensureAttachmentColumn(connection, DV_TABLE);

    await createTableIfAbsent(connection, OUTGOING_TABLE, OUTGOING_CREATE_SQL);
    await ensureAuditColumns(connection, OUTGOING_TABLE);
    await ensureAttachmentColumn(connection, OUTGOING_TABLE);

    await createTableIfAbsent(connection, POLICIES_TABLE, POLICIES_CREATE_SQL);
    await ensureAuditColumns(connection, POLICIES_TABLE);
    await ensureAttachmentColumn(connection, POLICIES_TABLE);

    await createTableIfAbsent(connection, DEPARTMENTS_TABLE, DEPARTMENTS_CREATE_SQL);
    await ensureAuditColumns(connection, DEPARTMENTS_TABLE);

    await createTableIfAbsent(connection, ATTACHMENTS_TABLE, ATTACHMENTS_CREATE_SQL);
    await ensureAuditColumns(connection, ATTACHMENTS_TABLE);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint =
      "If this user cannot CREATE TABLE, run the scripts in backend/sql/ as a DBA, or set MONITORING_AUTO_DDL=0 and create the tables manually.";
    console.error("Oracle: failed to auto-create monitoring tables", err);
    throw new Error(`${msg} ${hint}`);
  } finally {
    await connection.close();
  }
}

export { ensureMonitoringProjectsTable };
