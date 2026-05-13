import { env } from "../config/env.js";
import * as projectsRepo from "../repositories/projectsRepository.js";

function oracleHelpMessage(message) {
  if (String(message).includes("ORA-00942")) {
    return "Table MONITORING_PROJECTS was not found. Run backend/sql/monitoring-projects.sql in your Oracle schema.";
  }
  return message;
}

const MAX_CONTRACT_NAME_LENGTH = 50;

function parseProjectBody(body) {
  const contractName = String(body?.contractName ?? "").trim().slice(0, MAX_CONTRACT_NAME_LENGTH);
  const date = String(body?.date ?? "").trim();
  const duration = String(body?.duration ?? "").trim();
  const goods = String(body?.goods ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const outstanding = Number(body?.outstanding ?? 0);

  if (!contractName || !date || !duration || !goods) {
    const err = new Error("contractName, date, duration, and goods are required.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(amount) || !Number.isFinite(outstanding) || amount < 0 || outstanding < 0) {
    const err = new Error("amount and outstanding must be non-negative numbers.");
    err.status = 400;
    throw err;
  }

  return { contractName, date, duration, goods, amount, outstanding };
}

async function list(req, res, next) {
  try {
    if (!env.oracle.enabled) {
      return res.status(503).json({
        message:
          "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
      });
    }
    const rows = await projectsRepo.listProjects();
    res.json(rows);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!env.oracle.enabled) {
      return res.status(503).json({
        message:
          "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
      });
    }
    const payload = parseProjectBody(req.body);
    const row = await projectsRepo.createProject(payload);
    res.status(201).json(row);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    if (!env.oracle.enabled) {
      return res.status(503).json({
        message:
          "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
      });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid project id." });
    }
    const payload = parseProjectBody(req.body);
    const row = await projectsRepo.updateProject(id, payload);
    res.json(row);
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (!env.oracle.enabled) {
      return res.status(503).json({
        message:
          "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
      });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid project id." });
    }
    await projectsRepo.deleteProject(id);
    res.status(204).send();
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

export { create, list, remove, update };
