export const MAX_ATTACHMENTS_PER_RECORD = 5;

export function attachmentUrl(module, recordId, attachmentId) {
  if (attachmentId != null) {
    return `/api/${module}/${recordId}/attachments/${attachmentId}`;
  }
  return `/api/${module}/${recordId}/attachments`;
}

async function parseResponse(res) {
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.message) || raw || "Attachment request failed");
  }
  return data;
}

export async function syncRecordAttachments(
  module,
  recordId,
  { newFiles = [], removedAttachmentIds = [] } = {},
) {
  let latest = null;

  for (const attachmentId of removedAttachmentIds) {
    const res = await fetch(attachmentUrl(module, recordId, attachmentId), { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      await parseResponse(res);
    } else if (res.ok) {
      latest = await parseResponse(res);
    }
  }

  for (const file of newFiles) {
    const formData = new FormData();
    formData.append("attachment", file);
    const res = await fetch(attachmentUrl(module, recordId), { method: "POST", body: formData });
    latest = await parseResponse(res);
  }

  return latest;
}

export function applyAttachmentMeta(record, attachmentResult, draft) {
  if (attachmentResult) {
    return {
      ...record,
      attachments: attachmentResult.attachments ?? record.attachments ?? [],
      hasAttachment: Boolean(attachmentResult.hasAttachment),
      attachmentCount: attachmentResult.attachmentCount ?? (attachmentResult.attachments?.length ?? 0),
    };
  }
  if (draft?.removedAttachmentIds?.length) {
    const removed = new Set(draft.removedAttachmentIds);
    const attachments = (record.attachments || []).filter((item) => !removed.has(item.id));
    return {
      ...record,
      attachments,
      hasAttachment: attachments.length > 0,
      attachmentCount: attachments.length,
    };
  }
  return record;
}

export const blankAttachmentDraft = { newFiles: [], removedAttachmentIds: [], localError: "" };

export function isAllowedAttachmentFile(file) {
  if (!file) return true;
  return file.type === "image/jpeg" || file.type === "image/png";
}

export function normalizeAttachments(row) {
  const attachments = Array.isArray(row?.attachments) ? row.attachments : [];
  return {
    ...row,
    attachments,
    hasAttachment: attachments.length > 0 || Boolean(row?.hasAttachment ?? row?.attachmentFilename),
    attachmentCount: attachments.length || Number(row?.attachmentCount ?? 0),
  };
}
