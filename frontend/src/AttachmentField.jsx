import { useMemo } from "react";

import {
  attachmentUrl,
  isAllowedAttachmentFile,
  MAX_ATTACHMENTS_PER_RECORD,
} from "./attachmentApi.js";

function countDraftAttachments(existingAttachments, draft) {
  const keptExisting = (existingAttachments || []).filter(
    (item) => !draft.removedAttachmentIds.includes(item.id),
  ).length;
  return keptExisting + (draft.newFiles?.length || 0);
}

export default function AttachmentField({
  module,
  recordId,
  existingAttachments = [],
  draft,
  onDraftChange,
  disabled = false,
  error = "",
}) {
  const visibleExisting = useMemo(
    () =>
      (existingAttachments || []).filter((item) => !draft.removedAttachmentIds.includes(item.id)),
    [existingAttachments, draft.removedAttachmentIds],
  );

  const totalCount = countDraftAttachments(existingAttachments, draft);
  const atLimit = totalCount >= MAX_ATTACHMENTS_PER_RECORD;
  const localError = draft.localError || error;

  const onFilesSelected = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const nextFiles = [...(draft.newFiles || [])];
    let nextError = "";

    for (const file of files) {
      if (!isAllowedAttachmentFile(file)) {
        nextError = "Only JPEG and PNG images are allowed.";
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        nextError = "Each attachment must be 5 MB or smaller.";
        continue;
      }
      if (countDraftAttachments(existingAttachments, { ...draft, newFiles: nextFiles }) >= MAX_ATTACHMENTS_PER_RECORD) {
        nextError = `At most ${MAX_ATTACHMENTS_PER_RECORD} attachments are allowed per record.`;
        break;
      }
      nextFiles.push(file);
    }

    onDraftChange({ ...draft, newFiles: nextFiles, localError: nextError });
  };

  const removeNewFile = (index) => {
    onDraftChange({
      ...draft,
      newFiles: draft.newFiles.filter((_, i) => i !== index),
      localError: "",
    });
  };

  const removeExisting = (attachmentId) => {
    onDraftChange({
      ...draft,
      removedAttachmentIds: [...draft.removedAttachmentIds, attachmentId],
      localError: "",
    });
  };

  const clearDraft = () => {
    onDraftChange({ newFiles: [], removedAttachmentIds: [], localError: "" });
  };

  const showClear = totalCount > 0 || draft.removedAttachmentIds.length > 0;

  return (
    <label className="attachment-field">
      <span>Attachments (optional)</span>
      <div className="attachment-field__controls">
        <input
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          multiple
          onChange={onFilesSelected}
          disabled={disabled || atLimit}
        />
        {showClear ? (
          <button
            type="button"
            className="ghost-button attachment-field__clear"
            onClick={clearDraft}
            disabled={disabled}
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="attachment-field__hint">
        Up to {MAX_ATTACHMENTS_PER_RECORD} JPEG or PNG files, 5 MB each. {totalCount}/{MAX_ATTACHMENTS_PER_RECORD} selected.
      </p>
      {localError ? (
        <p className="form-field-warning" role="alert">{localError}</p>
      ) : null}
      {draft.newFiles?.length ? (
        <ul className="attachment-field__file-list">
          {draft.newFiles.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <span>{file.name}</span>
              <button
                type="button"
                className="ghost-button ghost-button--compact"
                onClick={() => removeNewFile(index)}
                disabled={disabled}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {visibleExisting.length ? (
        <div className="attachment-field__preview-grid">
          {visibleExisting.map((attachment) => (
            <div key={attachment.id} className="attachment-field__preview-item">
              <img
                src={attachmentUrl(module, recordId, attachment.id)}
                alt={attachment.originalFilename || "Attachment preview"}
              />
              <button
                type="button"
                className="ghost-button ghost-button--compact"
                onClick={() => removeExisting(attachment.id)}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </label>
  );
}

export function AttachmentDetailPreview({ module, recordId, attachments = [] }) {
  const visible = (attachments || []).filter((item) => item?.id);
  if (!visible.length || !recordId) return null;
  return (
    <div className="attachment-detail-preview">
      <span className="attachment-detail-preview__label">
        Attachments ({visible.length})
      </span>
      <div className="attachment-detail-preview__grid">
        {visible.map((attachment) => (
          <img
            key={attachment.id}
            src={attachmentUrl(module, recordId, attachment.id)}
            alt={attachment.originalFilename || "Record attachment"}
          />
        ))}
      </div>
    </div>
  );
}
