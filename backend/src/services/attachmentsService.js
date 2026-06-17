import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import oracledb from "oracledb";

import { getPool } from "../db/oraclePool.js";
import { getAttachmentModule } from "./attachmentModules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");
const ATTACHMENTS_TABLE = "MONITORING_ATTACHMENTS";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RECORD = 5;

function moduleUploadDir(moduleKey) {
  return path.join(UPLOAD_ROOT, moduleKey);
}

function storedFilePath(moduleKey, filename) {
  return path.join(moduleUploadDir(moduleKey), filename);
}

function mapAttachmentRow(row) {
  if (!row) return null;
  return {
    id: Number(row.ID ?? row.id),
    storedFilename: String(row.STORED_FILENAME ?? row.stored_filename ?? ""),
    originalFilename: String(row.ORIGINAL_FILENAME ?? row.original_filename ?? ""),
    mimeType: String(row.MIME_TYPE ?? row.mime_type ?? "image/jpeg"),
    createdAt: row.CREATED_AT ?? row.created_at ?? null,
  };
}

async function ensureUploadDirs() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const { ATTACHMENT_MODULES } = await import("./attachmentModules.js");
  for (const moduleKey of Object.keys(ATTACHMENT_MODULES)) {
    await fs.mkdir(moduleUploadDir(moduleKey), { recursive: true });
  }
}

async function assertRecordExists(moduleKey, recordId) {
  const { table } = getAttachmentModule(moduleKey);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ID FROM ${table} WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
      { id: recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (!result.rows?.[0]) {
      const err = new Error("Record not found");
      err.status = 404;
      throw err;
    }
  } finally {
    await connection.close();
  }
}

async function getLegacyAttachmentFilename(moduleKey, recordId) {
  const { table } = getAttachmentModule(moduleKey);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const cols = await connection.execute(
      `SELECT column_name FROM user_tab_columns
        WHERE table_name = :t AND column_name = 'ATTACHMENT_FILENAME'`,
      { t: table },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (!cols.rows?.length) return null;

    const result = await connection.execute(
      `SELECT ATTACHMENT_FILENAME FROM ${table}
        WHERE ID = :id AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
      { id: recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const raw = result.rows?.[0]?.ATTACHMENT_FILENAME ?? result.rows?.[0]?.attachment_filename;
    return raw == null || raw === "" ? null : String(raw);
  } catch {
    return null;
  } finally {
    await connection.close();
  }
}

async function countAttachments(moduleKey, recordId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT COUNT(*) AS CNT
         FROM ${ATTACHMENTS_TABLE}
        WHERE MODULE_KEY = :moduleKey
          AND RECORD_ID = :recordId
          AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
      { moduleKey, recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return Number(result.rows?.[0]?.CNT ?? result.rows?.[0]?.cnt ?? 0);
  } finally {
    await connection.close();
  }
}

async function migrateLegacyAttachment(moduleKey, recordId, storedFilename) {
  const filePath = storedFilePath(moduleKey, storedFilename);
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const ext = path.extname(storedFilename).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const id = Date.now();
    await connection.execute(
      `INSERT INTO ${ATTACHMENTS_TABLE}
         (ID, MODULE_KEY, RECORD_ID, STORED_FILENAME, ORIGINAL_FILENAME, MIME_TYPE)
       VALUES
         (:id, :moduleKey, :recordId, :storedFilename, :originalFilename, :mimeType)`,
      {
        id,
        moduleKey,
        recordId,
        storedFilename,
        originalFilename: storedFilename,
        mimeType,
      },
      { autoCommit: true },
    );
    return mapAttachmentRow({
      ID: id,
      STORED_FILENAME: storedFilename,
      ORIGINAL_FILENAME: storedFilename,
      MIME_TYPE: mimeType,
    });
  } finally {
    await connection.close();
  }
}

async function listAttachments(moduleKey, recordId) {
  await assertRecordExists(moduleKey, recordId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ID, STORED_FILENAME, ORIGINAL_FILENAME, MIME_TYPE, CREATED_AT
         FROM ${ATTACHMENTS_TABLE}
        WHERE MODULE_KEY = :moduleKey
          AND RECORD_ID = :recordId
          AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        ORDER BY CREATED_AT ASC, ID ASC`,
      { moduleKey, recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    let rows = (result.rows || []).map(mapAttachmentRow).filter(Boolean);
    if (rows.length === 0) {
      const legacy = await getLegacyAttachmentFilename(moduleKey, recordId);
      if (legacy) {
        const migrated = await migrateLegacyAttachment(moduleKey, recordId, legacy);
        if (migrated) rows = [migrated];
      }
    }
    return rows;
  } finally {
    await connection.close();
  }
}

async function listAttachmentsByRecordIds(moduleKey, recordIds) {
  const ids = [...new Set(recordIds.filter((id) => Number.isFinite(id)))];
  const map = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return map;

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const binds = { moduleKey };
    const placeholders = ids.map((id, index) => {
      const key = `id${index}`;
      binds[key] = id;
      return `:${key}`;
    });
    const result = await connection.execute(
      `SELECT ID, RECORD_ID, STORED_FILENAME, ORIGINAL_FILENAME, MIME_TYPE, CREATED_AT
         FROM ${ATTACHMENTS_TABLE}
        WHERE MODULE_KEY = :moduleKey
          AND RECORD_ID IN (${placeholders.join(", ")})
          AND (IS_DELETED = 0 OR IS_DELETED IS NULL)
        ORDER BY RECORD_ID, CREATED_AT ASC, ID ASC`,
      binds,
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    for (const row of result.rows || []) {
      const recordId = Number(row.RECORD_ID ?? row.record_id);
      const mapped = mapAttachmentRow(row);
      if (!mapped || !map.has(recordId)) continue;
      map.get(recordId).push(mapped);
    }
  } finally {
    await connection.close();
  }

  for (const recordId of ids) {
    if (map.get(recordId).length === 0) {
      const legacy = await getLegacyAttachmentFilename(moduleKey, recordId);
      if (legacy) {
        const migrated = await migrateLegacyAttachment(moduleKey, recordId, legacy);
        if (migrated) map.set(recordId, [migrated]);
      }
    }
  }

  return map;
}

async function enrichRecordsWithAttachments(moduleKey, records) {
  if (!Array.isArray(records) || records.length === 0) return records;
  const byRecord = await listAttachmentsByRecordIds(
    moduleKey,
    records.map((record) => Number(record.id)),
  );
  return records.map((record) => {
    const attachments = byRecord.get(Number(record.id)) || [];
    return {
      ...record,
      attachments,
      hasAttachment: attachments.length > 0,
      attachmentCount: attachments.length,
    };
  });
}

async function enrichRecordWithAttachments(moduleKey, record) {
  if (!record) return record;
  const [enriched] = await enrichRecordsWithAttachments(moduleKey, [record]);
  return enriched;
}

function validateImageFile(file) {
  if (!file) {
    const err = new Error("No attachment file was uploaded.");
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    const err = new Error("Only JPEG and PNG images are allowed.");
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const err = new Error("Each attachment must be 5 MB or smaller.");
    err.status = 400;
    throw err;
  }
}

async function deleteStoredFile(moduleKey, filename) {
  if (!filename) return;
  try {
    await fs.unlink(storedFilePath(moduleKey, filename));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function saveAttachment(moduleKey, recordId, file) {
  validateImageFile(file);
  await ensureUploadDirs();
  await assertRecordExists(moduleKey, recordId);

  const currentCount = await countAttachments(moduleKey, recordId);
  if (currentCount >= MAX_ATTACHMENTS_PER_RECORD) {
    const err = new Error(`At most ${MAX_ATTACHMENTS_PER_RECORD} attachments are allowed per record.`);
    err.status = 400;
    throw err;
  }

  const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname || "").toLowerCase() || ".jpg";
  const storedName = `${recordId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const dest = storedFilePath(moduleKey, storedName);
  await fs.writeFile(dest, file.buffer);

  const id = Date.now() + Math.floor(Math.random() * 1000);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.execute(
      `INSERT INTO ${ATTACHMENTS_TABLE}
         (ID, MODULE_KEY, RECORD_ID, STORED_FILENAME, ORIGINAL_FILENAME, MIME_TYPE)
       VALUES
         (:id, :moduleKey, :recordId, :storedFilename, :originalFilename, :mimeType)`,
      {
        id,
        moduleKey,
        recordId,
        storedFilename: storedName,
        originalFilename: String(file.originalname || storedName).slice(0, 500),
        mimeType: file.mimetype,
      },
      { autoCommit: true },
    );
  } finally {
    await connection.close();
  }

  const attachments = await listAttachments(moduleKey, recordId);
  return {
    attachment: mapAttachmentRow({
      ID: id,
      STORED_FILENAME: storedName,
      ORIGINAL_FILENAME: file.originalname || storedName,
      MIME_TYPE: file.mimetype,
    }),
    attachments,
    hasAttachment: attachments.length > 0,
    attachmentCount: attachments.length,
  };
}

async function removeAttachmentById(moduleKey, recordId, attachmentId) {
  await assertRecordExists(moduleKey, recordId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT ID, STORED_FILENAME
         FROM ${ATTACHMENTS_TABLE}
        WHERE ID = :attachmentId
          AND MODULE_KEY = :moduleKey
          AND RECORD_ID = :recordId
          AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
      { attachmentId, moduleKey, recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) {
      const err = new Error("Attachment not found");
      err.status = 404;
      throw err;
    }
    await connection.execute(
      `UPDATE ${ATTACHMENTS_TABLE}
          SET IS_DELETED = 1
        WHERE ID = :attachmentId`,
      { attachmentId },
      { autoCommit: true },
    );
    await deleteStoredFile(moduleKey, String(row.STORED_FILENAME ?? row.stored_filename ?? ""));
  } finally {
    await connection.close();
  }

  const attachments = await listAttachments(moduleKey, recordId);
  return {
    attachments,
    hasAttachment: attachments.length > 0,
    attachmentCount: attachments.length,
  };
}

async function removeAllAttachments(moduleKey, recordId) {
  const attachments = await listAttachments(moduleKey, recordId).catch(() => []);
  for (const attachment of attachments) {
    await removeAttachmentById(moduleKey, recordId, attachment.id).catch(() => undefined);
  }
  return { attachments: [], hasAttachment: false, attachmentCount: 0 };
}

async function openAttachment(moduleKey, recordId, attachmentId) {
  await assertRecordExists(moduleKey, recordId);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      `SELECT STORED_FILENAME, ORIGINAL_FILENAME, MIME_TYPE
         FROM ${ATTACHMENTS_TABLE}
        WHERE ID = :attachmentId
          AND MODULE_KEY = :moduleKey
          AND RECORD_ID = :recordId
          AND (IS_DELETED = 0 OR IS_DELETED IS NULL)`,
      { attachmentId, moduleKey, recordId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = result.rows?.[0];
    if (!row) {
      const legacy = await getLegacyAttachmentFilename(moduleKey, recordId);
      if (legacy) {
        const filePath = storedFilePath(moduleKey, legacy);
        try {
          await fs.access(filePath);
          const ext = path.extname(legacy).toLowerCase();
          return {
            filePath,
            contentType: ext === ".png" ? "image/png" : "image/jpeg",
            filename: legacy,
          };
        } catch {
          /* fall through */
        }
      }
      const err = new Error("Attachment not found");
      err.status = 404;
      throw err;
    }

    const filename = String(row.STORED_FILENAME ?? row.stored_filename ?? "");
    const filePath = storedFilePath(moduleKey, filename);
    try {
      await fs.access(filePath);
    } catch {
      const err = new Error("Attachment file is missing on disk");
      err.status = 404;
      throw err;
    }
    const mimeType = String(row.MIME_TYPE ?? row.mime_type ?? "image/jpeg");
    return {
      filePath,
      contentType: mimeType,
      filename: String(row.ORIGINAL_FILENAME ?? row.original_filename ?? filename),
    };
  } finally {
    await connection.close();
  }
}

export {
  ATTACHMENTS_TABLE,
  enrichRecordWithAttachments,
  enrichRecordsWithAttachments,
  ensureUploadDirs,
  listAttachments,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_RECORD,
  openAttachment,
  removeAllAttachments,
  removeAttachmentById,
  saveAttachment,
  UPLOAD_ROOT,
};
