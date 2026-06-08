import { env } from "../config/env.js";
import * as policiesRepo from "../repositories/policiesRepository.js";

const POLICY_STATUSES = new Set(["Pending", "In Progress", "Completed", "On Hold", "Cancelled"]);
const MAX_TRANSACTION_CODE = 20;
const MAX_POLICY_TITLE = 175;
const MAX_CREATED_BY = 30;
const MAX_ASSIGNED_TO = 20;
const MAX_REMARKS = 500;
const TRANSACTION_CODE_ALLOWED = /[^A-Za-z0-9- ]/g;
const TRANSACTION_CODE_PATTERN = /^[A-Za-z0-9- ]+$/;
const CREATED_BY_ALLOWED = /[^A-Za-z- ]/g;
const CREATED_BY_PATTERN = /^[A-Za-z- ]+$/;
const ASSIGNED_TO_ALLOWED = /[^A-Za-z0-9- ]/g;
const ASSIGNED_TO_PATTERN = /^[A-Za-z0-9- ]+$/;

function oracleHelpMessage(message) {
  if (String(message).includes("ORA-00942")) {
    return "Table MONITORING_POLICIES was not found. Run backend/sql/monitoring-policies.sql in your Oracle schema, or enable MONITORING_AUTO_DDL=1.";
  }
  return message;
}

const NOT_CONFIGURED = {
  message:
    "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
};

function computeDaysInclusive(startYmd, endYmd) {
  const s = new Date(`${startYmd}T12:00:00Z`);
  const e = new Date(`${endYmd}T12:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  if (diff < 0) return null;
  return diff + 1;
}

function parsePolicyBody(body) {
  const transactionCode = String(body?.transactionCode ?? "")
    .trim()
    .replace(TRANSACTION_CODE_ALLOWED, "")
    .slice(0, MAX_TRANSACTION_CODE);
  const policyTitle = String(body?.policyTitle ?? "").trim().slice(0, MAX_POLICY_TITLE);
  const createdBy = String(body?.createdBy ?? "")
    .trim()
    .replace(CREATED_BY_ALLOWED, "")
    .slice(0, MAX_CREATED_BY);
  const assignedTo = String(body?.assignedTo ?? "")
    .trim()
    .replace(ASSIGNED_TO_ALLOWED, "")
    .slice(0, MAX_ASSIGNED_TO);
  const startDate = String(body?.startDate ?? "").trim();
  const endDate = String(body?.endDate ?? "").trim();
  const status = String(body?.status ?? "").trim();
  const remarks = String(body?.remarks ?? "").trim().slice(0, MAX_REMARKS);

  if (!transactionCode || !policyTitle || !createdBy || !assignedTo || !startDate || !endDate) {
    const err = new Error(
      "transactionCode, policyTitle, createdBy, assignedTo, startDate, and endDate are required.",
    );
    err.status = 400;
    throw err;
  }
  if (!TRANSACTION_CODE_PATTERN.test(transactionCode)) {
    const err = new Error(`transactionCode may only contain letters, numbers, dashes, and spaces (max ${MAX_TRANSACTION_CODE} characters).`);
    err.status = 400;
    throw err;
  }
  if (!CREATED_BY_PATTERN.test(createdBy)) {
    const err = new Error(`createdBy may only contain letters, dashes, and spaces (max ${MAX_CREATED_BY} characters).`);
    err.status = 400;
    throw err;
  }
  if (!ASSIGNED_TO_PATTERN.test(assignedTo)) {
    const err = new Error(`assignedTo may only contain letters, numbers, dashes, and spaces (max ${MAX_ASSIGNED_TO} characters).`);
    err.status = 400;
    throw err;
  }
  if (!status || !POLICY_STATUSES.has(status)) {
    const err = new Error("status must be one of: Pending, In Progress, Completed, On Hold, Cancelled.");
    err.status = 400;
    throw err;
  }

  const days = computeDaysInclusive(startDate, endDate);
  if (days == null) {
    const err = new Error("endDate must be on or after startDate.");
    err.status = 400;
    throw err;
  }

  return {
    transactionCode,
    policyTitle,
    createdBy,
    assignedTo,
    startDate,
    endDate,
    days,
    status,
    remarks,
  };
}

async function list(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const rows = await policiesRepo.listPolicies();
    res.json(rows);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const payload = parsePolicyBody(req.body);
    const row = await policiesRepo.createPolicy(payload);
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
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid policy record id." });
    const payload = parsePolicyBody(req.body);
    const row = await policiesRepo.updatePolicy(id, payload);
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
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid policy record id." });
    await policiesRepo.deletePolicy(id);
    res.status(204).send();
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

export { create, list, remove, update };
