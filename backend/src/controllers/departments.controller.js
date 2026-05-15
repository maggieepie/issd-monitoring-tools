import { env } from "../config/env.js";
import * as departmentsRepo from "../repositories/departmentsRepository.js";

function oracleHelpMessage(message) {
  if (String(message).includes("ORA-00942")) {
    return "Table MONITORING_DEPARTMENTS was not found. Run backend/sql/monitoring-departments.sql in your Oracle schema, or enable MONITORING_AUTO_DDL=1.";
  }
  return message;
}

const NOT_CONFIGURED = {
  message:
    "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
};

function parseDepartmentBody(body) {
  const name = String(body?.name ?? "").trim().slice(0, 100);
  const kind = String(body?.kind ?? "").trim().toLowerCase();
  if (!name) {
    const err = new Error("name is required.");
    err.status = 400;
    throw err;
  }
  if (kind !== "thru" && kind !== "for") {
    const err = new Error("kind must be 'thru' or 'for'.");
    err.status = 400;
    throw err;
  }
  return { name, kind };
}

async function list(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const kind = req.query.kind;
    const rows = await departmentsRepo.listDepartments(kind);
    res.json(rows);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const payload = parseDepartmentBody(req.body);
    const row = await departmentsRepo.createDepartment(payload);
    res.status(201).json(row);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

export { create, list };
