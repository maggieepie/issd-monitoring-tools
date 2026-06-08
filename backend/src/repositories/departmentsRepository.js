import oracledb from "oracledb";

import { BUILTIN_FOR, BUILTIN_THRU } from "../constants/departmentBuiltin.js";
import { getPool } from "../db/oraclePool.js";

const TABLE = "MONITORING_DEPARTMENTS";

function formatTimestampCell(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return null;
  return String(value);
}

function mapRow(row) {
  if (!row) return null;
  const isBuiltinRaw = row.IS_BUILTIN ?? row.is_builtin ?? 0;
  return {
    id: Number(row.ID ?? row.id),
    name: String(row.NAME ?? row.name ?? ""),
    kind: String(row.KIND ?? row.kind ?? "").toLowerCase(),
    isBuiltin: Number(isBuiltinRaw) === 1,
    createdAt: formatTimestampCell(row.CREATED_AT ?? row.created_at),
    updatedAt: formatTimestampCell(row.UPDATED_AT ?? row.updated_at),
  };
}

const SELECT_COLS = `ID, NAME, KIND, IS_BUILTIN, CREATED_AT, UPDATED_AT`;

async function seedBuiltinDepartments(connection) {
  const countResult = await connection.execute(
    `SELECT COUNT(*) AS CNT FROM ${TABLE} WHERE IS_DELETED = 0 OR IS_DELETED IS NULL`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const cnt = Number(countResult.rows?.[0]?.CNT ?? countResult.rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  let nextId = Date.now();
  const rows = [
    ...BUILTIN_THRU.map((name) => ({ name, kind: "thru" })),
    ...BUILTIN_FOR.map((name) => ({ name, kind: "for" })),
  ];
  for (const row of rows) {
    await connection.execute(
      `INSERT INTO ${TABLE} (ID, NAME, KIND, IS_BUILTIN)
       VALUES (:id, :name, :kind, 1)`,
      { id: nextId++, name: row.name, kind: row.kind },
      { autoCommit: false },
    );
  }
  await connection.commit();
  console.log(`Oracle: seeded ${rows.length} built-in departments`);
}

async function listDepartments(kind) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await seedBuiltinDepartments(connection);
    const normalizedKind = kind ? String(kind).trim().toLowerCase() : "";
    const sql =
      normalizedKind === "thru" || normalizedKind === "for"
        ? `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE KIND = :kind AND (IS_DELETED = 0 OR IS_DELETED IS NULL) ORDER BY NAME ASC`
        : `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE IS_DELETED = 0 OR IS_DELETED IS NULL ORDER BY KIND ASC, NAME ASC`;
    const binds = normalizedKind === "thru" || normalizedKind === "for" ? { kind: normalizedKind } : {};
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return (result.rows || []).map(mapRow).filter(Boolean);
  } finally {
    await connection.close();
  }
}

async function findDepartmentByNameKind(connection, name, kind) {
  const result = await connection.execute(
    `SELECT ${SELECT_COLS} FROM ${TABLE}
      WHERE UPPER(NAME) = UPPER(:name) AND KIND = :kind AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    { name, kind },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function createDepartment(payload) {
  const id = Date.now();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await seedBuiltinDepartments(connection);
    const existing = await findDepartmentByNameKind(connection, payload.name, payload.kind);
    if (existing) {
      const err = new Error("That department is already listed for this field.");
      err.status = 409;
      throw err;
    }
    await connection.execute(
      `INSERT INTO ${TABLE} (ID, NAME, KIND, IS_BUILTIN)
       VALUES (:id, :name, :kind, 0)`,
      { id, name: payload.name, kind: payload.kind },
      { autoCommit: true },
    );
    return await findDepartmentByNameKind(connection, payload.name, payload.kind);
  } finally {
    await connection.close();
  }
}

async function findDepartmentById(connection, id) {
  const result = await connection.execute(
    `SELECT ${SELECT_COLS} FROM ${TABLE} WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
    { id },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return mapRow(result.rows?.[0]);
}

async function updateDepartment(id, payload) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const current = await findDepartmentById(connection, id);
    if (!current) {
      const err = new Error("Department not found");
      err.status = 404;
      throw err;
    }
    const name = String(payload.name ?? "").trim().slice(0, 100);
    if (!name) {
      const err = new Error("name is required.");
      err.status = 400;
      throw err;
    }
    const duplicate = await findDepartmentByNameKind(connection, name, current.kind);
    if (duplicate && duplicate.id !== id) {
      const err = new Error("That department is already listed for this field.");
      err.status = 409;
      throw err;
    }
    const oldName = current.name;
    await connection.execute(
      `UPDATE ${TABLE} SET NAME = :name, UPDATED_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id, name },
      { autoCommit: false },
    );
    const outgoingColumn = current.kind === "thru" ? "THRU" : "FOR_DEPT";
    await connection.execute(
      `UPDATE MONITORING_OUTGOING
          SET ${outgoingColumn} = :newName, UPDATED_AT = SYSTIMESTAMP
        WHERE UPPER(${outgoingColumn}) = UPPER(:oldName)`,
      { oldName, newName: name },
      { autoCommit: false },
    );
    await connection.commit();
    return await findDepartmentById(connection, id);
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await connection.close();
  }
}

async function deleteDepartment(id) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const current = await findDepartmentById(connection, id);
    if (!current) {
      const err = new Error("Department not found");
      err.status = 404;
      throw err;
    }
    const result = await connection.execute(
      `UPDATE ${TABLE} SET IS_DELETED = 1, UPDATED_AT = SYSTIMESTAMP WHERE ID = :id`,
      { id },
      { autoCommit: true },
    );
    if (result.rowsAffected === 0) {
      const err = new Error("Department not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

export { createDepartment, deleteDepartment, listDepartments, seedBuiltinDepartments, updateDepartment };
