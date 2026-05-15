import { env } from "../config/env.js";
import * as outgoingRepo from "../repositories/outgoingRepository.js";

function oracleHelpMessage(message) {
  if (String(message).includes("ORA-00942")) {
    return "Table MONITORING_OUTGOING was not found. Run backend/sql/monitoring-outgoing.sql in your Oracle schema, or enable MONITORING_AUTO_DDL=1.";
  }
  return message;
}

const NOT_CONFIGURED = {
  message:
    "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
};

function parseOutgoingBody(body) {
  const subject = String(body?.subject ?? "").trim().slice(0, 500);
  const memoNo = String(body?.memoNo ?? "").trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const date = String(body?.date ?? "").trim();
  const thru = String(body?.thru ?? "").trim().slice(0, 100);
  const forDept = String(body?.forDept ?? "").trim().slice(0, 100);

  if (!subject || !memoNo || !date) {
    const err = new Error("subject, memoNo, and date are required.");
    err.status = 400;
    throw err;
  }
  if (!thru || !forDept) {
    const err = new Error("thru and forDept are required.");
    err.status = 400;
    throw err;
  }

  return { subject, memoNo, date, thru, forDept };
}

async function list(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const rows = await outgoingRepo.listOutgoing();
    res.json(rows);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const payload = parseOutgoingBody(req.body);
    const row = await outgoingRepo.createOutgoing(payload);
    res.status(201).json(row);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid outgoing record id." });
    const payload = parseOutgoingBody(req.body);
    const row = await outgoingRepo.updateOutgoing(id, payload);
    res.json(row);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid outgoing record id." });
    await outgoingRepo.deleteOutgoing(id);
    res.status(204).send();
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

export { create, list, remove, update };
