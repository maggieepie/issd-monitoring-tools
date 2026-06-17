import { env } from "../config/env.js";
import * as dvRepo from "../repositories/dvPaymentsRepository.js";
import { enrichRecordWithAttachments, enrichRecordsWithAttachments, removeAllAttachments } from "../services/attachmentsService.js";

function oracleHelpMessage(message) {
  if (String(message).includes("ORA-00942")) {
    return "Table MONITORING_DV_PAYMENTS was not found. Run backend/sql/monitoring-dv-payments.sql in your Oracle schema, or enable MONITORING_AUTO_DDL=1.";
  }
  return message;
}

const NOT_CONFIGURED = {
  message:
    "Oracle is not configured. Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in backend/.env.",
};

function parseDvBody(body) {
  const title = String(body?.title ?? "").trim().slice(0, 500);
  const claimantAddress = String(body?.claimantAddress ?? "").trim().slice(0, 500);
  const voucherNo = String(body?.voucherNo ?? "").trim().slice(0, 200);
  const date = String(body?.date ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const ictssd = String(body?.ictssd ?? "Pending").trim().slice(0, 100);
  const gad = String(body?.gad ?? "Pending").trim().slice(0, 100);
  const cash = String(body?.cash ?? "Received").trim().slice(0, 100);

  if (!title || !claimantAddress || !voucherNo || !date) {
    const err = new Error("title, claimantAddress, voucherNo, and date are required.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error("amount must be a non-negative number.");
    err.status = 400;
    throw err;
  }

  return { title, claimantAddress, voucherNo, date, amount, ictssd, gad, cash };
}

async function list(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const rows = await dvRepo.listDvPayments();
    res.json(await enrichRecordsWithAttachments("dv-payments", rows));
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const payload = parseDvBody(req.body);
    const row = await dvRepo.createDvPayment(payload);
    res.status(201).json(await enrichRecordWithAttachments("dv-payments", row));
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid DV record id." });
    const payload = parseDvBody(req.body);
    const row = await dvRepo.updateDvPayment(id, payload);
    res.json(await enrichRecordWithAttachments("dv-payments", row));
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    if (!env.oracle.enabled) return res.status(503).json(NOT_CONFIGURED);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid DV record id." });
    await removeAllAttachments("dv-payments", id).catch(() => undefined);
    await dvRepo.deleteDvPayment(id);
    res.status(204).send();
  } catch (err) {
    err.message = oracleHelpMessage(err.message);
    next(err);
  }
}

export { create, list, remove, update };
