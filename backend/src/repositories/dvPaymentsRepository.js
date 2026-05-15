import oracledb from "oracledb";

import { getPool } from "../db/oraclePool.js";

const TABLE = "MONITORING_DV_PAYMENTS";

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
    title: String(row.TITLE ?? row.title ?? ""),
    claimantAddress: String(row.CLAIMANT_ADDRESS ?? row.claimant_address ?? ""),
    voucherNo: String(row.VOUCHER_NO ?? row.voucher_no ?? ""),
    date: formatDateCell(row.VOUCHER_DATE ?? row.voucher_date),
    amount: Number(row.AMOUNT ?? row.amount ?? 0),
    ictssd: String(row.ICTSSD ?? row.ictssd ?? "Pending"),
    gad: String(row.GAD ?? row.gad ?? "Pending"),
    cash: String(row.CASH ?? row.cash ?? "Received"),
    createdAt: formatTimestampCell(row.CREATED_AT ?? row.created_at),
    updatedAt: formatTimestampCell(row.UPDATED_AT ?? row.updated_at),
  };
}

const SELECT_COLS = `ID, TITLE, CLAIMANT_ADDRESS, VOUCHER_NO, VOUCHER_DATE,
                     AMOUNT, ICTSSD, GAD, CASH, CREATED_AT, UPDATED_AT`;

async function selectDvRow(connection, id) {
  const result = await connection.execute(
    `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE ID = :id`,
    { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function listDvPayments() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ${SELECT_COLS} FROM ${TABLE} ORDER BY VOUCHER_DATE DESC, ID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows || []).map(mapRow).filter(Boolean);
  } finally {
    await connection.close();
  }
}

async function createDvPayment(payload) {
  const id = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO ${TABLE}
         (ID, TITLE, CLAIMANT_ADDRESS, VOUCHER_NO, VOUCHER_DATE, AMOUNT, ICTSSD, GAD, CASH)
       VALUES
         (:id, :title, :addr, :vno, TO_DATE(:vdate, 'YYYY-MM-DD'), :amt, :ictssd, :gad, :cash)`,
      {
        id,
        title: payload.title,
        addr: payload.claimantAddress,
        vno: payload.voucherNo,
        vdate: payload.date,
        amt: payload.amount,
        ictssd: payload.ictssd,
        gad: payload.gad,
        cash: payload.cash,
      },
      { autoCommit: true },
    );
    return await selectDvRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function updateDvPayment(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `UPDATE ${TABLE}
          SET TITLE            = :title,
              CLAIMANT_ADDRESS = :addr,
              VOUCHER_NO       = :vno,
              VOUCHER_DATE     = TO_DATE(:vdate, 'YYYY-MM-DD'),
              AMOUNT           = :amt,
              ICTSSD           = :ictssd,
              GAD              = :gad,
              CASH             = :cash,
              UPDATED_AT       = SYSTIMESTAMP
        WHERE ID = :id`,
      {
        id,
        title: payload.title,
        addr: payload.claimantAddress,
        vno: payload.voucherNo,
        vdate: payload.date,
        amt: payload.amount,
        ictssd: payload.ictssd,
        gad: payload.gad,
        cash: payload.cash,
      },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("DV record not found");
      err.status = 404;
      throw err;
    }
    return await selectDvRow(connection, id);
  } finally {
    await connection.close();
  }
}

async function deleteDvPayment(id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `DELETE FROM ${TABLE} WHERE ID = :id`,
      { id },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("DV record not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

export { createDvPayment, deleteDvPayment, listDvPayments, updateDvPayment };
