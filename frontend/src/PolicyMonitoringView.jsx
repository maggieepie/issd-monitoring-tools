import { useEffect, useMemo, useState } from "react";

import {
  PAGE,
  blockDateFieldDirectEntry,
  exportCsv,
  fmtDate,
  number,
  pageSlice,
  formatPolicyDuration,
  policyDaysBetween,
  REQUIRED_FIELDS_ALERT_MESSAGE_POLICY,
} from "./monitoringShared.js";

const POLICY_STATUSES = ["Pending", "In Progress", "Completed", "On Hold", "Cancelled"];
const POLICY_FILTERS = ["All", ...POLICY_STATUSES];
const MAX_POLICY_TRANSACTION_CODE = 20;
const POLICY_TRANSACTION_CODE_ALLOWED = /[^A-Za-z0-9-]/g;
const POLICY_TRANSACTION_CODE_DISALLOWED = /[^A-Za-z0-9-]/;
const blankTransactionCodeWarning = { invalidChars: false, maxLength: false };
const MAX_POLICY_TITLE = 175;
const MAX_POLICY_CREATED_BY = 30;
const POLICY_CREATED_BY_ALLOWED = /[^A-Za-z-]/g;
const POLICY_CREATED_BY_DISALLOWED = /[^A-Za-z-]/;
const blankCreatedByWarning = { invalidChars: false, maxLength: false };
const MAX_POLICY_ASSIGNED_TO = 20;
const POLICY_ASSIGNED_TO_ALLOWED = /[^A-Za-z0-9-]/g;
const POLICY_ASSIGNED_TO_DISALLOWED = /[^A-Za-z0-9-]/;
const blankAssignedToWarning = { invalidChars: false, maxLength: false };
const MAX_POLICY_REMARKS = 500;

const blankPolicy = {
  transactionCode: "",
  policyTitle: "",
  createdBy: "",
  assignedTo: "",
  startDate: "",
  endDate: "",
  status: "Pending",
  remarks: "",
};

const POLICY_REQUIRED_MSG = "This field is required.";
const blankPolicyRequiredWarnings = {
  transactionCode: false,
  policyTitle: false,
  createdBy: false,
  assignedTo: false,
  startDate: false,
  endDate: false,
  duration: false,
};

function getPolicyRequiredWarnings(form, computedDays) {
  const hasStart = Boolean(form.startDate?.trim());
  const hasEnd = Boolean(form.endDate?.trim());
  const missingDates = !hasStart || !hasEnd;
  const invalidRange = hasStart && hasEnd && computedDays == null;
  return {
    transactionCode: !form.transactionCode.trim(),
    policyTitle: !form.policyTitle.trim(),
    createdBy: !form.createdBy.trim(),
    assignedTo: !form.assignedTo.trim(),
    startDate: !hasStart,
    endDate: !hasEnd,
    duration: missingDates || invalidRange,
  };
}

function hasPolicyRequiredWarnings(warnings) {
  return Object.values(warnings).some(Boolean);
}

function PolicyRequiredWarning({ show, message = POLICY_REQUIRED_MSG }) {
  if (!show) return null;
  return (
    <p className="form-field-warning" role="alert">
      {message}
    </p>
  );
}

function policyStatusTone(v) {
  if (v === "Completed") return "positive";
  if (v === "In Progress") return "warning";
  if (v === "Cancelled") return "critical";
  if (v === "On Hold") return "neutral";
  return "warning";
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function PolicyMonitoringView({ setModal, setConfirmModal, showRequiredFieldsAlert }) {
  const [policies, setPolicies] = useState([]);
  const [policyForm, setPolicyForm] = useState(blankPolicy);
  const [policyEdit, setPolicyEdit] = useState(null);
  const [policyEditModal, setPolicyEditModal] = useState(false);
  const [policyEditForm, setPolicyEditForm] = useState(blankPolicy);
  const [policySearch, setPolicySearch] = useState("");
  const [policyFilter, setPolicyFilter] = useState("All");
  const [policyPage, setPolicyPage] = useState(1);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyLoadError, setPolicyLoadError] = useState("");
  const [policySaveError, setPolicySaveError] = useState("");
  const [policySaving, setPolicySaving] = useState(false);
  const [policyTxWarning, setPolicyTxWarning] = useState(blankTransactionCodeWarning);
  const [policyEditTxWarning, setPolicyEditTxWarning] = useState(blankTransactionCodeWarning);
  const [policyTitleWarning, setPolicyTitleWarning] = useState(false);
  const [policyEditTitleWarning, setPolicyEditTitleWarning] = useState(false);
  const [policyCreatedByWarning, setPolicyCreatedByWarning] = useState(blankCreatedByWarning);
  const [policyEditCreatedByWarning, setPolicyEditCreatedByWarning] = useState(blankCreatedByWarning);
  const [policyAssignedToWarning, setPolicyAssignedToWarning] = useState(blankAssignedToWarning);
  const [policyEditAssignedToWarning, setPolicyEditAssignedToWarning] = useState(blankAssignedToWarning);
  const [policyRemarksWarning, setPolicyRemarksWarning] = useState(false);
  const [policyEditRemarksWarning, setPolicyEditRemarksWarning] = useState(false);
  const [policyRequiredWarnings, setPolicyRequiredWarnings] = useState(blankPolicyRequiredWarnings);
  const [policyEditRequiredWarnings, setPolicyEditRequiredWarnings] = useState(blankPolicyRequiredWarnings);

  const formDays = useMemo(
    () => policyDaysBetween(policyForm.startDate, policyForm.endDate),
    [policyForm.startDate, policyForm.endDate],
  );
  const editFormDays = useMemo(
    () => policyDaysBetween(policyEditForm.startDate, policyEditForm.endDate),
    [policyEditForm.startDate, policyEditForm.endDate],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPolicyLoading(true);
      setPolicyLoadError("");
      try {
        const res = await fetch("/api/policies");
        const raw = await res.text();
        let data;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        if (!res.ok) throw new Error((data && data.message) || raw || "Failed to load policy records");
        if (!cancelled) setPolicies(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setPolicyLoadError(e instanceof Error ? e.message : String(e));
          setPolicies([]);
        }
      } finally {
        if (!cancelled) setPolicyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const policyRows = useMemo(() => {
    const q = policySearch.toLowerCase().trim();
    return policies.filter(
      (x) =>
        (!q ||
          `${x.transactionCode} ${x.policyTitle} ${x.createdBy} ${x.assignedTo} ${x.status} ${x.remarks ?? ""}`
            .toLowerCase()
            .includes(q)) &&
        (policyFilter === "All" || x.status === policyFilter),
    );
  }, [policies, policySearch, policyFilter]);

  const policyPages = Math.ceil(policyRows.length / PAGE) || 1;
  const safePolicyPage = Math.min(policyPage, policyPages);

  const closePolicyEditModal = () => {
    setPolicyEditModal(false);
    setPolicyEdit(null);
    setPolicyEditForm(blankPolicy);
    setPolicyEditTxWarning(blankTransactionCodeWarning);
    setPolicyEditTitleWarning(false);
    setPolicyEditCreatedByWarning(blankCreatedByWarning);
    setPolicyEditAssignedToWarning(blankAssignedToWarning);
    setPolicyEditRemarksWarning(false);
    setPolicyEditRequiredWarnings(blankPolicyRequiredWarnings);
    setPolicySaveError("");
  };

  const buildPolicyBody = (form, computedDays) => {
    const transactionCode = form.transactionCode
      .trim()
      .replace(POLICY_TRANSACTION_CODE_ALLOWED, "")
      .slice(0, MAX_POLICY_TRANSACTION_CODE);
    const policyTitle = form.policyTitle.trim().slice(0, MAX_POLICY_TITLE);
    const createdBy = form.createdBy
      .trim()
      .replace(POLICY_CREATED_BY_ALLOWED, "")
      .slice(0, MAX_POLICY_CREATED_BY);
    const assignedTo = form.assignedTo
      .trim()
      .replace(POLICY_ASSIGNED_TO_ALLOWED, "")
      .slice(0, MAX_POLICY_ASSIGNED_TO);
    const startDate = form.startDate?.trim() || "";
    const endDate = form.endDate?.trim() || "";
    const status = form.status;
    const remarks = form.remarks.trim().slice(0, MAX_POLICY_REMARKS);
    return { transactionCode, policyTitle, createdBy, assignedTo, startDate, endDate, days: computedDays, status, remarks };
  };

  const validatePolicy = (body) => {
    if (!body.transactionCode) return "Transaction code is required.";
    if (POLICY_TRANSACTION_CODE_DISALLOWED.test(body.transactionCode)) {
      return "Transaction code may only contain letters, numbers, and dashes.";
    }
    if (body.transactionCode.length > MAX_POLICY_TRANSACTION_CODE) {
      return `Transaction code must be at most ${MAX_POLICY_TRANSACTION_CODE} characters.`;
    }
    if (!body.policyTitle) return "Policy title is required.";
    if (body.policyTitle.length > MAX_POLICY_TITLE) {
      return `Policy title must be at most ${MAX_POLICY_TITLE} characters.`;
    }
    if (!body.createdBy) return "Created by is required.";
    if (POLICY_CREATED_BY_DISALLOWED.test(body.createdBy)) {
      return "Created by may only contain letters and dashes.";
    }
    if (body.createdBy.length > MAX_POLICY_CREATED_BY) {
      return `Created by must be at most ${MAX_POLICY_CREATED_BY} characters.`;
    }
    if (!body.assignedTo) return "Assigned to is required.";
    if (POLICY_ASSIGNED_TO_DISALLOWED.test(body.assignedTo)) {
      return "Assigned to may only contain letters, numbers, and dashes.";
    }
    if (body.assignedTo.length > MAX_POLICY_ASSIGNED_TO) {
      return `Assigned to must be at most ${MAX_POLICY_ASSIGNED_TO} characters.`;
    }
    if (!body.startDate) return "Start date is required.";
    if (!body.endDate) return "End date is required.";
    if (body.days == null) return "End date must be on or after start date.";
    if (!POLICY_STATUSES.includes(body.status)) return "Status is required.";
    if (body.remarks.length > MAX_POLICY_REMARKS) {
      return `Remarks must be at most ${MAX_POLICY_REMARKS} characters.`;
    }
    return "";
  };

  const savePolicy = async (e) => {
    e.preventDefault();
    setPolicySaveError("");
    const required = getPolicyRequiredWarnings(policyForm, formDays);
    if (hasPolicyRequiredWarnings(required)) {
      setPolicyRequiredWarnings(required);
      showRequiredFieldsAlert(REQUIRED_FIELDS_ALERT_MESSAGE_POLICY);
      return;
    }
    setPolicyRequiredWarnings(blankPolicyRequiredWarnings);
    const body = buildPolicyBody(policyForm, formDays);
    const err = validatePolicy(body);
    if (err) {
      setPolicySaveError(err);
      return;
    }
    setPolicySaving(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      setPolicies((cur) => [data, ...cur]);
      setPolicyForm(blankPolicy);
      setPolicyTxWarning(blankTransactionCodeWarning);
      setPolicyTitleWarning(false);
      setPolicyCreatedByWarning(blankCreatedByWarning);
      setPolicyAssignedToWarning(blankAssignedToWarning);
      setPolicyRemarksWarning(false);
      setPolicyRequiredWarnings(blankPolicyRequiredWarnings);
    } catch (err) {
      setPolicySaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicySaving(false);
    }
  };

  const savePolicyEdit = async (e) => {
    e.preventDefault();
    if (policyEdit == null) return;
    setPolicySaveError("");
    const required = getPolicyRequiredWarnings(policyEditForm, editFormDays);
    if (hasPolicyRequiredWarnings(required)) {
      setPolicyEditRequiredWarnings(required);
      showRequiredFieldsAlert(REQUIRED_FIELDS_ALERT_MESSAGE_POLICY);
      return;
    }
    setPolicyEditRequiredWarnings(blankPolicyRequiredWarnings);
    const body = buildPolicyBody(policyEditForm, editFormDays);
    const err = validatePolicy(body);
    if (err) {
      setPolicySaveError(err);
      return;
    }
    setPolicySaving(true);
    try {
      const res = await fetch(`/api/policies/${policyEdit}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      setPolicies((cur) => cur.map((x) => (x.id === policyEdit ? data : x)));
      closePolicyEditModal();
    } catch (err) {
      setPolicySaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setPolicySaving(false);
    }
  };

  const deletePolicyRow = async (id, title) => {
    await new Promise((resolve) => setConfirmModal({ title, onConfirm: resolve }));
    setConfirmModal(null);
    setPolicySaveError("");
    try {
      const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const raw = await res.text();
        let msg;
        try {
          msg = raw ? JSON.parse(raw).message : null;
        } catch {
          msg = raw;
        }
        throw new Error(msg || "Delete failed");
      }
      setPolicies((cur) => cur.filter((item) => item.id !== id));
      if (policyEdit === id) closePolicyEditModal();
    } catch (e) {
      setPolicySaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const policyExport = () =>
    exportCsv("policy-monitoring.csv", [
      [
        "Transaction Code",
        "Policy Title",
        "Created By",
        "Assigned To",
        "Start Date",
        "End Date",
        "Duration",
        "Status",
        "Remarks",
      ],
      ...policyRows.map((x) => [
        x.transactionCode,
        x.policyTitle,
        x.createdBy,
        x.assignedTo,
        x.startDate,
        x.endDate,
        x.days != null ? formatPolicyDuration(x.days) : "",
        x.status,
        x.remarks,
      ]),
    ]);

  const openPolicyView = (x) =>
    setModal({
      type: "Policy",
      title: x.transactionCode,
      rows: [
        ["Policy Title", x.policyTitle],
        ["Created By", x.createdBy],
        ["Assigned To", x.assignedTo],
        ["Start Date", fmtDate(x.startDate)],
        ["End Date", fmtDate(x.endDate)],
        ["Duration", x.days != null ? formatPolicyDuration(x.days) : "—"],
        ["Status", x.status],
        ["Remarks", x.remarks || "—"],
      ],
    });

  const startPolicyEdit = (x) => {
    setPolicyEdit(x.id);
    setPolicyEditForm({
      transactionCode: x.transactionCode,
      policyTitle: x.policyTitle,
      createdBy: x.createdBy,
      assignedTo: x.assignedTo,
      startDate: x.startDate || "",
      endDate: x.endDate || "",
      status: x.status,
      remarks: x.remarks || "",
    });
    setPolicyEditTxWarning(blankTransactionCodeWarning);
    setPolicyEditTitleWarning(false);
    setPolicyEditCreatedByWarning(blankCreatedByWarning);
    setPolicyEditAssignedToWarning(blankAssignedToWarning);
    setPolicyEditRemarksWarning(false);
    setPolicyEditRequiredWarnings(blankPolicyRequiredWarnings);
    setPolicySaveError("");
    setPolicyEditModal(true);
  };

  const renderPolicyFields = (
    form,
    setForm,
    computedDays,
    idPrefix,
    txWarning,
    setTxWarning,
    titleWarning,
    setTitleWarning,
    createdByWarning,
    setCreatedByWarning,
    assignedToWarning,
    setAssignedToWarning,
    remarksWarning,
    setRemarksWarning,
    requiredWarnings,
    setRequiredWarnings,
  ) => {
    const hasStart = Boolean(form.startDate?.trim());
    const hasEnd = Boolean(form.endDate?.trim());
    const durationRequiredMessage =
      !hasStart || !hasEnd
        ? POLICY_REQUIRED_MSG
        : "End date must be on or after start date.";

    return (
    <>
      <div className="form-row">
        <label>
          <span>Transaction Code *</span>
          <input
            type="text"
            autoComplete="off"
            value={form.transactionCode}
            onChange={(e) => {
              const raw = e.target.value;
              const allowedOnly = raw.replace(POLICY_TRANSACTION_CODE_ALLOWED, "");
              const capped = allowedOnly.slice(0, MAX_POLICY_TRANSACTION_CODE);
              setForm({ ...form, transactionCode: capped });
              setRequiredWarnings((w) => ({ ...w, transactionCode: false }));
              setTxWarning({
                invalidChars: POLICY_TRANSACTION_CODE_DISALLOWED.test(raw),
                maxLength:
                  raw.length > MAX_POLICY_TRANSACTION_CODE ||
                  allowedOnly.length > MAX_POLICY_TRANSACTION_CODE,
              });
            }}
            onBlur={() => setTxWarning(blankTransactionCodeWarning)}
            placeholder="e.g. POL-2026-001"
            aria-invalid={requiredWarnings.transactionCode || txWarning.invalidChars || txWarning.maxLength}
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.transactionCode} />
            {!requiredWarnings.transactionCode && (txWarning.invalidChars || txWarning.maxLength) ? (
              <p className="form-field-warning" role="alert">
                {txWarning.invalidChars ? "Only letters, numbers, and dashes are allowed. " : null}
                {txWarning.maxLength ? `At most ${MAX_POLICY_TRANSACTION_CODE} characters are allowed.` : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Status *</span>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {POLICY_STATUSES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span>Policy Title *</span>
        <textarea
          value={form.policyTitle}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = raw.slice(0, MAX_POLICY_TITLE);
            setForm({ ...form, policyTitle: capped });
            setRequiredWarnings((w) => ({ ...w, policyTitle: false }));
            setTitleWarning(raw.length > MAX_POLICY_TITLE);
          }}
          onBlur={() => setTitleWarning(false)}
          placeholder="Enter policy title"
          aria-invalid={requiredWarnings.policyTitle || titleWarning}
        />
        <div className="form-field-warning-slot">
          <PolicyRequiredWarning show={requiredWarnings.policyTitle} />
          {!requiredWarnings.policyTitle && titleWarning ? (
            <p className="form-field-warning" role="alert">
              {`At most ${MAX_POLICY_TITLE} characters are allowed.`}
            </p>
          ) : null}
        </div>
      </label>
      <div className="form-row">
        <label>
          <span>Created By *</span>
          <input
            type="text"
            autoComplete="off"
            value={form.createdBy}
            onChange={(e) => {
              const raw = e.target.value;
              const allowedOnly = raw.replace(POLICY_CREATED_BY_ALLOWED, "");
              const capped = allowedOnly.slice(0, MAX_POLICY_CREATED_BY);
              setForm({ ...form, createdBy: capped });
              setRequiredWarnings((w) => ({ ...w, createdBy: false }));
              setCreatedByWarning({
                invalidChars: POLICY_CREATED_BY_DISALLOWED.test(raw),
                maxLength:
                  raw.length > MAX_POLICY_CREATED_BY || allowedOnly.length > MAX_POLICY_CREATED_BY,
              });
            }}
            onBlur={() => setCreatedByWarning(blankCreatedByWarning)}
            placeholder="Enter creator name"
            aria-invalid={
              requiredWarnings.createdBy || createdByWarning.invalidChars || createdByWarning.maxLength
            }
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.createdBy} />
            {!requiredWarnings.createdBy && (createdByWarning.invalidChars || createdByWarning.maxLength) ? (
              <p className="form-field-warning" role="alert">
                {createdByWarning.invalidChars ? "Only letters and dashes are allowed. " : null}
                {createdByWarning.maxLength ? `At most ${MAX_POLICY_CREATED_BY} characters are allowed.` : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Assigned To *</span>
          <input
            type="text"
            autoComplete="off"
            value={form.assignedTo}
            onChange={(e) => {
              const raw = e.target.value;
              const allowedOnly = raw.replace(POLICY_ASSIGNED_TO_ALLOWED, "");
              const capped = allowedOnly.slice(0, MAX_POLICY_ASSIGNED_TO);
              setForm({ ...form, assignedTo: capped });
              setRequiredWarnings((w) => ({ ...w, assignedTo: false }));
              setAssignedToWarning({
                invalidChars: POLICY_ASSIGNED_TO_DISALLOWED.test(raw),
                maxLength:
                  raw.length > MAX_POLICY_ASSIGNED_TO || allowedOnly.length > MAX_POLICY_ASSIGNED_TO,
              });
            }}
            onBlur={() => setAssignedToWarning(blankAssignedToWarning)}
            placeholder="Enter assignee name"
            aria-invalid={
              requiredWarnings.assignedTo || assignedToWarning.invalidChars || assignedToWarning.maxLength
            }
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.assignedTo} />
            {!requiredWarnings.assignedTo && (assignedToWarning.invalidChars || assignedToWarning.maxLength) ? (
              <p className="form-field-warning" role="alert">
                {assignedToWarning.invalidChars ? "Only letters, numbers, and dashes are allowed. " : null}
                {assignedToWarning.maxLength ? `At most ${MAX_POLICY_ASSIGNED_TO} characters are allowed.` : null}
              </p>
            ) : null}
          </div>
        </label>
      </div>
      <div className="form-row form-row--policy-dates">
        <label>
          <span>Start Date *</span>
          <input
            type="date"
            title="Choose a date using the calendar"
            value={form.startDate}
            onKeyDown={blockDateFieldDirectEntry}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => {
              setForm({ ...form, startDate: e.target.value });
              setRequiredWarnings((w) => ({ ...w, startDate: false, duration: false }));
            }}
            aria-invalid={requiredWarnings.startDate}
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.startDate} />
          </div>
        </label>
        <label>
          <span>End Date *</span>
          <input
            type="date"
            title="Choose a date using the calendar"
            value={form.endDate}
            onKeyDown={blockDateFieldDirectEntry}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => {
              setForm({ ...form, endDate: e.target.value });
              setRequiredWarnings((w) => ({ ...w, endDate: false, duration: false }));
            }}
            aria-invalid={requiredWarnings.endDate}
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.endDate} />
          </div>
        </label>
        <label>
          <span>Duration *</span>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            className="form-field-computed"
            id={`${idPrefix}-duration`}
            value={computedDays != null ? formatPolicyDuration(computedDays) : ""}
            placeholder="Set start and end dates"
            title="Computed from start and end dates (years, months, weeks, and days)"
            aria-invalid={requiredWarnings.duration}
          />
          <div className="form-field-warning-slot">
            <PolicyRequiredWarning show={requiredWarnings.duration} message={durationRequiredMessage} />
          </div>
        </label>
      </div>
      <label>
        <span>Remarks</span>
        <textarea
          value={form.remarks}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = raw.slice(0, MAX_POLICY_REMARKS);
            setForm({ ...form, remarks: capped });
            setRemarksWarning(raw.length > MAX_POLICY_REMARKS);
          }}
          onBlur={() => setRemarksWarning(false)}
          placeholder="Optional remarks"
          aria-invalid={remarksWarning}
        />
        <div className="form-field-warning-slot">
          {remarksWarning ? (
            <p className="form-field-warning" role="alert">
              {`At most ${MAX_POLICY_REMARKS} characters are allowed.`}
            </p>
          ) : null}
        </div>
      </label>
    </>
    );
  };

  const pendingCount = policies.filter((x) => x.status === "Pending" || x.status === "In Progress").length;

  return (
    <section className="page tool-page">
      <div className="tool-layout">
        {policyLoadError && (
          <div role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: "14px 18px", borderRadius: "14px", fontSize: ".93rem" }}>
            {policyLoadError}
          </div>
        )}
        <section className="panel metric-panel">
          <div className="metric-section">
            <div className="inline-stat-grid">
              <MetricChip label="Total policies" value={number.format(policies.length)} />
              <MetricChip label="In progress" value={number.format(pendingCount)} />
              <MetricChip label="Completed" value={number.format(policies.filter((x) => x.status === "Completed").length)} />
            </div>
          </div>
        </section>
        <section className="panel form-panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Policy Monitoring Tool</p>
              <h3>Add policy record</h3>
            </div>
          </div>
          <form className="record-form" onSubmit={savePolicy}>
            {renderPolicyFields(
              policyForm,
              setPolicyForm,
              formDays,
              "policy-add",
              policyTxWarning,
              setPolicyTxWarning,
              policyTitleWarning,
              setPolicyTitleWarning,
              policyCreatedByWarning,
              setPolicyCreatedByWarning,
              policyAssignedToWarning,
              setPolicyAssignedToWarning,
              policyRemarksWarning,
              setPolicyRemarksWarning,
              policyRequiredWarnings,
              setPolicyRequiredWarnings,
            )}
            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={policySaving}>
                {policySaving ? "Adding…" : "Add policy"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setPolicyForm(blankPolicy);
                  setPolicyTxWarning(blankTransactionCodeWarning);
                  setPolicyTitleWarning(false);
                  setPolicyCreatedByWarning(blankCreatedByWarning);
                  setPolicyAssignedToWarning(blankAssignedToWarning);
                  setPolicyRemarksWarning(false);
                  setPolicyRequiredWarnings(blankPolicyRequiredWarnings);
                  setPolicySaveError("");
                }}
              >
                Clear form
              </button>
            </div>
            {policySaveError && !policyEditModal ? (
              <p className="form-save-error" role="alert">
                {policySaveError}
              </p>
            ) : null}
          </form>
        </section>
        <section className="panel table-panel">
          <PolicyToolbar
            search={policySearch}
            setSearch={setPolicySearch}
            filter={policyFilter}
            setFilter={setPolicyFilter}
            onExport={policyExport}
          />
          <div className="table-wrap table-wrap--policies">
            <table>
              <thead>
                <tr>
                  <th>Transaction Code</th>
                  <th>Policy Title</th>
                  <th>Created By</th>
                  <th>Assigned To</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policyLoading ? (
                  <tr>
                    <td colSpan={10}>Loading policy records…</td>
                  </tr>
                ) : (
                  pageSlice(policyRows, safePolicyPage).map((x) => (
                    <tr key={x.id}>
                      <td>{x.transactionCode}</td>
                      <td>{x.policyTitle}</td>
                      <td>{x.createdBy}</td>
                      <td>{x.assignedTo}</td>
                      <td>{fmtDate(x.startDate)}</td>
                      <td>{fmtDate(x.endDate)}</td>
                      <td>{x.days != null ? formatPolicyDuration(x.days) : "—"}</td>
                      <td>
                        <StatusBadge label={x.status} />
                      </td>
                      <td>{x.remarks?.trim() ? x.remarks : "—"}</td>
                      <td>
                        <ActionSet
                          onView={() => openPolicyView(x)}
                          onEdit={() => startPolicyEdit(x)}
                          onDelete={() => void deletePolicyRow(x.id, x.transactionCode)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PolicyPager page={safePolicyPage} pages={policyPages} total={policyRows.length} setPage={setPolicyPage} />
        </section>
      </div>

      {policyEditModal && (
        <div className="modal-backdrop" onClick={closePolicyEditModal}>
          <div className="modal-card workspace-modal workspace-modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal__header">
              <div>
                <p className="workspace-modal__eyebrow">Policy Monitoring Tool</p>
                <h3>Edit policy record</h3>
              </div>
              <button type="button" className="workspace-modal__close" aria-label="Cancel edit" onClick={closePolicyEditModal}>
                <CloseIcon />
              </button>
            </div>
            <form className="record-form" onSubmit={savePolicyEdit}>
              {renderPolicyFields(
                policyEditForm,
                setPolicyEditForm,
                editFormDays,
                "policy-edit",
                policyEditTxWarning,
                setPolicyEditTxWarning,
                policyEditTitleWarning,
                setPolicyEditTitleWarning,
                policyEditCreatedByWarning,
                setPolicyEditCreatedByWarning,
                policyEditAssignedToWarning,
                setPolicyEditAssignedToWarning,
                policyEditRemarksWarning,
                setPolicyEditRemarksWarning,
                policyEditRequiredWarnings,
                setPolicyEditRequiredWarnings,
              )}
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={policySaving}>
                  {policySaving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="ghost-button" onClick={closePolicyEditModal}>
                  Cancel
                </button>
              </div>
              {policySaveError ? (
                <p className="form-save-error" role="alert">
                  {policySaveError}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricChip({ label, value }) {
  return (
    <article className="metric-chip">
      <span>{label}</span>
      <strong title={String(value)}>{value}</strong>
    </article>
  );
}

function StatusBadge({ label }) {
  return <span className={`status-badge ${policyStatusTone(label)}`}>{label}</span>;
}

function ActionSet({ onView, onEdit, onDelete }) {
  return (
    <div className="action-set">
      <button type="button" className="table-button table-button--view" onClick={onView} aria-label="View">
        <span className="table-button__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span className="table-button__label">View</span>
      </button>
      <button type="button" className="table-button table-button--edit" onClick={onEdit} aria-label="Edit">
        <span className="table-button__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </span>
        <span className="table-button__label">Edit</span>
      </button>
      <button type="button" className="table-button table-button--danger" onClick={onDelete} aria-label="Delete">
        <span className="table-button__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </span>
        <span className="table-button__label">Delete</span>
      </button>
    </div>
  );
}

function PolicyToolbar({ search, setSearch, filter, setFilter, onExport }) {
  return (
    <>
      <div className="panel__header">
        <div>
          <p className="panel__kicker">Records</p>
          <h3>Policy records</h3>
          <p className="panel__description">Track policy lifecycle, ownership, and status in one place.</p>
        </div>
        <button type="button" className="ghost-button" onClick={onExport}>
          Export CSV
        </button>
      </div>
      <div className="toolbar">
        <label>
          <span>Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records" />
        </label>
        <label>
          <span>Status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {POLICY_FILTERS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function PolicyPager({ page, pages, total, setPage }) {
  return (
    <div className="pagination">
      <span className="pagination__summary">
        Showing {total ? (page - 1) * PAGE + 1 : 0}-{Math.min(page * PAGE, total)} of {total}
      </span>
      <strong className="pagination__status">
        Page {page} of {pages}
      </strong>
      <div className="pagination__nav">
        <button type="button" className="ghost-button" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="ghost-button" disabled={page === pages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
