import oracledb from "oracledb";

import { getPool } from "../db/oraclePool.js";

const TABLE = "MONITORING_POLICIES";

function formatDateCell(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value == null) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatTimestampCell(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return null;
  return String(value);
}

function mapRow(row) {
  if (!row) return null;
  const daysRaw = row.DAYS_COUNT ?? row.days_count;
  return {
    id: Number(row.ID ?? row.id),
    transactionCode: String(row.TRANSACTION_CODE ?? row.transaction_code ?? ""),
    policyTitle: String(row.POLICY_TITLE ?? row.policy_title ?? ""),
    createdBy: String(row.CREATED_BY ?? row.created_by ?? ""),
    assignedTo: String(row.ASSIGNED_TO ?? row.assigned_to ?? ""),
    startDate: formatDateCell(row.START_DATE ?? row.start_date),
    endDate: formatDateCell(row.END_DATE ?? row.end_date),
    days: daysRaw == null || daysRaw === "" ? null : Number(daysRaw),
    status: String(row.STATUS_LABEL ?? row.status_label ?? ""),
    remarks: String(row.REMARKS ?? row.remarks ?? ""),
    createdAt: formatTimestampCell(row.CREATED_AT ?? row.created_at),
    updatedAt: formatTimestampCell(row.UPDATED_AT ?? row.updated_at),
  };
}

const SELECT_COLS = `ID, TRANSACTION_CODE, POLICY_TITLE, CREATED_BY, ASSIGNED_TO,
  START_DATE, END_DATE, DAYS_COUNT, STATUS_LABEL, REMARKS, CREATED_AT, UPDATED_AT`;

async function selectPolicyRow(connection, id) {
  const result = await connection.execute(
    `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function listPolicies() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE IS_DELETED = 0 OR IS_DELETED IS NULL ORDER BY START_DATE DESC, ID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows || []).map(mapRow).filter(Boolean);
  } finally {
    await connection.close();
  }
}

async function createPolicy(payload) {
  const id = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO ${TABLE}
         (ID, TRANSACTION_CODE, POLICY_TITLE, CREATED_BY, ASSIGNED_TO,
          START_DATE, END_DATE, DAYS_COUNT, STATUS_LABEL, REMARKS)
       VALUES
         (:id, :transactionCode, :policyTitle, :createdBy, :assignedTo,
          TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'),
          :days, :status, :remarks)`,
      {
        id,
        transactionCode: payload.transactionCode,
        policyTitle: payload.policyTitle,
        createdBy: payload.createdBy,
        assignedTo: payload.assignedTo,
        startDate: payload.startDate,
        endDate: payload.endDate,
        days: payload.days ?? null,
        status: payload.status,
        remarks: payload.remarks ?? "",
      },
      { autoCommit: true },
    );
    return await selectPolicyRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function updatePolicy(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE}
          SET TRANSACTION_CODE = :transactionCode,
              POLICY_TITLE     = :policyTitle,
              CREATED_BY       = :createdBy,
              ASSIGNED_TO      = :assignedTo,
              START_DATE       = TO_DATE(:startDate, 'YYYY-MM-DD'),
              END_DATE         = TO_DATE(:endDate, 'YYYY-MM-DD'),
              DAYS_COUNT       = :days,
              STATUS_LABEL     = :status,
              REMARKS          = :remarks,
              UPDATED_AT       = SYSTIMESTAMP
        WHERE ID = :id`,
      {
        id,
        transactionCode: payload.transactionCode,
        policyTitle: payload.policyTitle,
        createdBy: payload.createdBy,
        assignedTo: payload.assignedTo,
        startDate: payload.startDate,
        endDate: payload.endDate,
        days: payload.days ?? null,
        status: payload.status,
        remarks: payload.remarks ?? "",
      },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Policy record not found");
      err.status = 404;
      throw err;
    }
    return await selectPolicyRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function deletePolicy(id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE} SET IS_DELETED = 1, UPDATED_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Policy record not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

export { createPolicy, deletePolicy, listPolicies, updatePolicy };
