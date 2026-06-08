import oracledb from "oracledb";

import { getPool } from "../db/oraclePool.js";

const TABLE = "MONITORING_PROJECTS";

function formatDateCell(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value == null) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatTimestampCell(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value == null) return null;
  return String(value);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: Number(row.ID ?? row.id),
    contractName: String(row.CONTRACT_NAME ?? row.contract_name ?? ""),
    date: formatDateCell(row.CONTRACT_DATE ?? row.contract_date),
    duration: String(row.DURATION ?? row.duration ?? ""),
    goods: String(row.GOODS ?? row.goods ?? ""),
    amount: Number(row.AMOUNT ?? row.amount ?? 0),
    outstanding: Number(row.OUTSTANDING ?? row.outstanding ?? 0),
    createdAt: formatTimestampCell(row.CREATED_AT ?? row.created_at),
    updatedAt: formatTimestampCell(row.UPDATED_AT ?? row.updated_at),
  };
}

/** @param {import("oracledb").Connection} connection */
async function selectProjectRow(connection, id) {
  const result = await connection.execute(
    `SELECT ID, CONTRACT_NAME, CONTRACT_DATE, DURATION, GOODS, AMOUNT, OUTSTANDING,
            CREATED_AT, UPDATED_AT
       FROM ${TABLE}
      WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function listProjects() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ID, CONTRACT_NAME, CONTRACT_DATE, DURATION, GOODS, AMOUNT, OUTSTANDING,
              CREATED_AT, UPDATED_AT
         FROM ${TABLE}
        WHERE IS_DELETED = 0 OR IS_DELETED IS NULL
        ORDER BY CONTRACT_DATE DESC, ID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows || []).map(mapRow).filter(Boolean);
  } finally {
    await connection.close();
  }
}

async function createProject(payload) {
  const id = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO ${TABLE} (ID, CONTRACT_NAME, CONTRACT_DATE, DURATION, GOODS, AMOUNT, OUTSTANDING)
       VALUES (:id, :cn, TO_DATE(:cd, 'YYYY-MM-DD'), :dur, :goods, :amt, :outst)`,
      {
        id,
        cn: payload.contractName,
        cd: payload.date,
        dur: payload.duration,
        goods: payload.goods,
        amt: payload.amount,
        outst: payload.outstanding,
      },
      { autoCommit: true },
    );
    return await selectProjectRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function updateProject(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE}
          SET CONTRACT_NAME = :cn,
              CONTRACT_DATE = TO_DATE(:cd, 'YYYY-MM-DD'),
              DURATION = :dur,
              GOODS = :goods,
              AMOUNT = :amt,
              OUTSTANDING = :outst,
              UPDATED_AT = SYSTIMESTAMP
        WHERE ID = :id`,
      {
        id,
        cn: payload.contractName,
        cd: payload.date,
        dur: payload.duration,
        goods: payload.goods,
        amt: payload.amount,
        outst: payload.outstanding,
      },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }
    return await selectProjectRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function deleteProject(id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE} SET IS_DELETED = 1, UPDATED_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Project not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

export { createProject, deleteProject, listProjects, updateProject };
