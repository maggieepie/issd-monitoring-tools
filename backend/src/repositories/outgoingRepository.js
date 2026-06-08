import oracledb from "oracledb";

import { getPool } from "../db/oraclePool.js";

const TABLE = "MONITORING_OUTGOING";

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
  return {
    id: Number(row.ID ?? row.id),
    subject: String(row.SUBJECT ?? row.subject ?? ""),
    memoNo: String(row.MEMO_NO ?? row.memo_no ?? ""),
    date: formatDateCell(row.MEMO_DATE ?? row.memo_date),
    thru: String(row.THRU ?? row.thru ?? ""),
    forDept: String(row.FOR_DEPT ?? row.for_dept ?? ""),
    createdAt: formatTimestampCell(row.CREATED_AT ?? row.created_at),
    updatedAt: formatTimestampCell(row.UPDATED_AT ?? row.updated_at),
  };
}

const SELECT_COLS = `ID, SUBJECT, MEMO_NO, MEMO_DATE, THRU, FOR_DEPT, CREATED_AT, UPDATED_AT`;

async function selectOutgoingRow(connection, id) {
  const result = await connection.execute(
    `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function listOutgoing() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE IS_DELETED = 0 OR IS_DELETED IS NULL ORDER BY MEMO_DATE DESC, ID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows || []).map(mapRow).filter(Boolean);
  } finally {
    await connection.close();
  }
}

async function createOutgoing(payload) {
  const id = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO ${TABLE}
         (ID, SUBJECT, MEMO_NO, MEMO_DATE, THRU, FOR_DEPT)
       VALUES
         (:id, :subject, :memoNo, TO_DATE(:memoDate, 'YYYY-MM-DD'), :thru, :forDept)`,
      {
        id,
        subject: payload.subject,
        memoNo: payload.memoNo,
        memoDate: payload.date,
        thru: payload.thru,
        forDept: payload.forDept,
      },
      { autoCommit: true },
    );
    return await selectOutgoingRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function updateOutgoing(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE}
          SET SUBJECT    = :subject,
              MEMO_NO    = :memoNo,
              MEMO_DATE  = TO_DATE(:memoDate, 'YYYY-MM-DD'),
              THRU       = :thru,
              FOR_DEPT   = :forDept,
              UPDATED_AT = SYSTIMESTAMP
        WHERE ID = :id`,
      {
        id,
        subject: payload.subject,
        memoNo: payload.memoNo,
        memoDate: payload.date,
        thru: payload.thru,
        forDept: payload.forDept,
      },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Outgoing record not found");
      err.status = 404;
      throw err;
    }
    return await selectOutgoingRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function deleteOutgoing(id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE} SET IS_DELETED = 1, UPDATED_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Outgoing record not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

export { createOutgoing, deleteOutgoing, listOutgoing, updateOutgoing };
