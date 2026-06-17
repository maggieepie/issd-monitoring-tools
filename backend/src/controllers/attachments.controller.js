import fs from "node:fs";

import {
  listAttachments,
  openAttachment,
  removeAllAttachments,
  removeAttachmentById,
  saveAttachment,
} from "../services/attachmentsService.js";

function parseRecordId(req) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    const err = new Error("Invalid record id.");
    err.status = 400;
    throw err;
  }
  return id;
}

function parseAttachmentId(req) {
  const id = Number(req.params.attachmentId);
  if (!Number.isFinite(id)) {
    const err = new Error("Invalid attachment id.");
    err.status = 400;
    throw err;
  }
  return id;
}

function makeAttachmentHandlers(moduleKey) {
  async function list(req, res, next) {
    try {
      const recordId = parseRecordId(req);
      const attachments = await listAttachments(moduleKey, recordId);
      res.json({
        attachments,
        hasAttachment: attachments.length > 0,
        attachmentCount: attachments.length,
      });
    } catch (err) {
      next(err);
    }
  }

  async function upload(req, res, next) {
    try {
      const recordId = parseRecordId(req);
      const result = await saveAttachment(moduleKey, recordId, req.file);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async function getOne(req, res, next) {
    try {
      const recordId = parseRecordId(req);
      const attachmentId = parseAttachmentId(req);
      const { filePath, contentType, filename } = await openAttachment(moduleKey, recordId, attachmentId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async function removeOne(req, res, next) {
    try {
      const recordId = parseRecordId(req);
      const attachmentId = parseAttachmentId(req);
      const result = await removeAttachmentById(moduleKey, recordId, attachmentId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async function removeAll(req, res, next) {
    try {
      const recordId = parseRecordId(req);
      const result = await removeAllAttachments(moduleKey, recordId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  return { list, upload, getOne, removeOne, removeAll };
}

const projectAttachmentHandlers = makeAttachmentHandlers("projects");
const dvPaymentAttachmentHandlers = makeAttachmentHandlers("dv-payments");
const outgoingAttachmentHandlers = makeAttachmentHandlers("outgoing");
const policyAttachmentHandlers = makeAttachmentHandlers("policies");

export {
  dvPaymentAttachmentHandlers,
  outgoingAttachmentHandlers,
  policyAttachmentHandlers,
  projectAttachmentHandlers,
};
