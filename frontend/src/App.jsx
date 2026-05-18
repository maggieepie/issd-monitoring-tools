import { useEffect, useMemo, useState } from "react";

import PolicyMonitoringView from "./PolicyMonitoringView.jsx";
import RequiredFieldsAlertModal from "./RequiredFieldsAlertModal.jsx";
import { REQUIRED_FIELDS_ALERT_MESSAGE } from "./monitoringShared.js";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-PH");
const PAGE = 5;
const NAV = [
  { id: "projects", label: "Project Monitoring", icon: "projects" },
  { id: "payments", label: "Disbursement Voucher Monitoring", icon: "dv" },
  { id: "outgoing", label: "Outgoing Document Monitoring", icon: "outgoing" },
  { id: "policies", label: "Policy Monitoring", icon: "policy" },
  { id: "reports", label: "Reports and Analytics", icon: "reports" },
];
const WORKSPACE_SESSION_KEY = "monitoring-workspace-session";

function readWorkspaceSession() {
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSION_KEY);
    if (!raw) return { entered: false, view: "projects" };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { entered: false, view: "projects" };
    const entered = Boolean(parsed.entered);
    const v = typeof parsed.view === "string" && NAV.some((n) => n.id === parsed.view) ? parsed.view : "projects";
    return { entered, view: v };
  } catch {
    return { entered: false, view: "projects" };
  }
}

const VIEW_META = {
  projects: {
    title: "Project Monitoring",
    subtext: "Track contracts, goods, amounts, and outstanding balances in one place.",
  },
  payments: {
    title: "Disbursement Voucher Monitoring",
    subtext: "Monitor voucher records, claimant details, and department-level DV status updates.",
  },
  outgoing: {
    title: "Outgoing Document Monitoring",
    subtext: "Follow outgoing memo routing, endorsements, and receiving departments clearly.",
  },
  policies: {
    title: "Policy Monitoring",
    subtext: "Track policy records, assignments, timelines, and status from one workspace.",
  },
  reports: {
    title: "Reports and Analytics",
    subtext: "Review operational summaries and export monitoring data for each workspace tool.",
  },
};
const GOODS_STORAGE_KEY = "monitoring-extra-goods";
const GOODS_PICKER_HIDDEN_KEY = "monitoring-goods-picker-hidden";
const BASE_GOODS = ["ICT Equipment", "Software", "Office Equipment", "Services"];

function readExtraGoods() {
  try {
    const raw = localStorage.getItem(GOODS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && String(x).trim()).map((x) => String(x).trim());
  } catch {
    return [];
  }
}

function readHiddenPickerGoods() {
  try {
    const raw = localStorage.getItem(GOODS_PICKER_HIDDEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && String(x).trim()).map((x) => String(x).trim());
  } catch {
    return [];
  }
}

/** Keeps the native date picker chrome; `readOnly` on type="date" hides the calendar control in Chromium. */
function blockDateFieldDirectEntry(e) {
  if (e.key === "Tab" || e.key === "Escape" || e.key === "Enter") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.nativeEvent?.isComposing) return;
  if (e.key.length === 1) e.preventDefault();
  if (e.key === "Backspace" || e.key === "Delete") e.preventDefault();
  if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
}

/** Base order (minus hidden/deleted labels), then user-added kinds, then any kinds from loaded projects (deduped case-insensitively). Hidden items are never surfaced regardless of project usage. */
function mergeGoodsOptions(extraGoods, projects, hiddenPickerGoods) {
  const hidden = new Set((hiddenPickerGoods ?? []).map((x) => String(x).toLowerCase()));
  const seen = new Set();
  const out = [];
  const push = (g) => {
    const t = String(g ?? "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (hidden.has(k)) return;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  BASE_GOODS.forEach(push);
  extraGoods.forEach(push);
  for (const p of projects) push(p.goods);
  return out;
}
const ICTSSD = ["Signed", "Receive", "Pending"];
const GAD = ["Pending", "Signed", "Unsigned", "Return"];
const CASH = ["Received", "Return"];
const PAYMENT_FILTERS = ["All", "Signed", "Receive", "Received", "Pending", "Unsigned", "Return"];
const BASE_THRU = ["NCD", "ITMG", "BAC", "PMO", "PSD", "PCEO"];
const BASE_FOR = ["SSC", "PCEO", "NCD", "ITMG", "BAC", "PMO", "PSD", "PPMD", "BUDGET", "LEGAL", "ESD", "OPSD", "PMERD", "LDD"];
/** Hard cap for department name (Thru / For lists; Oracle NAME is VARCHAR2(100)). */
const MAX_DEPARTMENT_NAME_LENGTH = 100;

function mergeDepartmentOptions(baseList, dbDepartments, kind, records, recordKey) {
  const seen = new Set();
  const out = [];
  const push = (name) => {
    const t = String(name ?? "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  baseList.forEach(push);
  for (const d of dbDepartments) {
    if (d.kind === kind) push(d.name);
  }
  for (const r of records) push(r[recordKey]);
  return out;
}

function DeptSelectWithAdd({
  label,
  id,
  value,
  onChange,
  options,
  addVisible,
  onAddOpen,
  onAddCancel,
  addDraft,
  onAddDraftChange,
  addError,
  onAddCommit,
  addAriaLabel,
  requiredMark = false,
  requiredWarning = false,
  showPlaceholderOption = false,
}) {
  return (
    <div className="form-label-with-action">
      <div className="form-label-with-action__row">
        <label className="form-label-with-action__text" htmlFor={id}>
          <span>{label}{requiredMark ? " *" : ""}</span>
        </label>
        {addVisible ? (
          <button type="button" className="goods-cancel-btn" aria-label="Cancel" onClick={onAddCancel}>
            <span className="goods-btn__icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </span>
            <span className="goods-btn__label">Cancel</span>
          </button>
        ) : (
          <button type="button" className="goods-add-btn goods-add-btn--dept" aria-label={addAriaLabel} onClick={onAddOpen}>
            <span className="goods-btn__icon">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="2" x2="8" y2="14" />
                <line x1="2" y1="8" x2="14" y2="8" />
              </svg>
            </span>
            <span className="goods-btn__label">Add Department</span>
          </button>
        )}
      </div>
      {!addVisible ? (
        <select id={id} value={value} onChange={onChange} aria-invalid={requiredWarning}>
          {showPlaceholderOption ? <option value="">Select department</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className="form-inline-add-goods">
          <input
            type="text"
            autoComplete="off"
            value={addDraft}
            onChange={(e) => onAddDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onAddCommit();
              }
            }}
            placeholder="Add New Department"
            aria-label="Add New Department"
          />
          <button type="button" className="ghost-button ghost-button--compact" onClick={() => void onAddCommit()}>Save</button>
          <button type="button" className="ghost-button ghost-button--compact" onClick={onAddCancel}>Cancel</button>
        </div>
      )}
      <div className="form-field-warning-slot">
        {requiredWarning ? (
          <p className="form-field-warning" role="alert">
            {OUTGOING_REQUIRED_MSG}
          </p>
        ) : null}
        {addError ? <p className="form-field-warning form-field-warning--tight" role="alert">{addError}</p> : null}
      </div>
    </div>
  );
}

/** Hard cap for contract title (UI + API; Oracle CONTRACT_NAME remains VARCHAR2(500)). */
const MAX_PROJECT_CONTRACT_NAME_LENGTH = 175;
/** Hard cap for DV payment title (UI + API; Oracle TITLE remains VARCHAR2(500)). */
const MAX_DV_TITLE_LENGTH = 150;
/** Hard cap for DV claimant address (Oracle CLAIMANT_ADDRESS is VARCHAR2(500)). */
const MAX_DV_CLAIMANT_LENGTH = 500;
/** Hard cap for DV voucher number — numbers only, max 20 digits. */
const MAX_DV_VOUCHER_LENGTH = 20;
/** Hard cap for outgoing memo subject (UI + API). */
const MAX_OUTGOING_SUBJECT_LENGTH = 500;
/** Hard cap for outgoing memo number — letters, digits, and hyphens only. */
const MAX_OUTGOING_MEMO_NO_LENGTH = 20;
const OUTGOING_MEMO_NO_ALLOWED = /[^A-Za-z0-9-]/g;
const OUTGOING_MEMO_NO_DISALLOWED = /[^A-Za-z0-9-]/;
const OUTGOING_REQUIRED_MSG = "This field is required.";
const blankOutgoingRequiredWarnings = {
  subject: false,
  memoNo: false,
  date: false,
  thru: false,
  forDept: false,
};
const blankPaymentRequiredWarnings = {
  title: false,
  claimantAddress: false,
  voucherNo: false,
  amount: false,
  date: false,
};
const blankProjectRequiredWarnings = {
  contractName: false,
  date: false,
  duration: false,
  amount: false,
  outstanding: false,
};
/** Hard cap for duration text (UI + API; Oracle DURATION remains VARCHAR2(200)). */
const MAX_PROJECT_DURATION_LENGTH = 30;

const blankProject = { contractName: "", date: "", duration: "", goods: "ICT Equipment", amount: "", outstanding: "" };
const blankProjectMoneyWarnings = {
  amount: { invalidChars: false, maxDigits: false },
  outstanding: { invalidChars: false, maxDigits: false },
  contractName: { maxLength: false },
  duration: { maxLength: false },
};
const blankPayment = { title: "", claimantAddress: "", voucherNo: "", amount: "", date: "", ictssd: "Pending", gad: "Pending", cash: "Received" };
const blankOutgoing = { subject: "", memoNo: "", date: "", thru: "", forDept: "" };
const LANDING_BUILDING_IMAGE = "/sss-building.jpg";
const LANDING_LOGO_IMAGE = "https://www.sss.gov.ph/wp-content/uploads/2024/09/SSS-favicon.png";
const SIDEBAR_LOGO_IMAGE = "/sss-logo.png";
const FAQ_ITEMS = [
  {
    id: "project-monitoring",
    title: "Project Monitoring",
    description: "Track contracts, types of goods, contract amounts, and outstanding balances in a structured and centralized view. This helps ensure accurate monitoring of project progress and financial status.",
  },
  {
    id: "dv-monitoring",
    title: "Disbursement Voucher Monitoring",
    description: "Monitor voucher records, claimant information, and department-level status updates across ICTSSD, GAD, and CASH. This improves visibility and tracking of DV processing stages.",
  },
  {
    id: "outgoing-monitoring",
    title: "Outgoing Document Monitoring",
    description: "Track outgoing memos, routing paths, and receiving departments with clear documentation flow. This ensures proper handling and monitoring of document movement across units.",
  },
  {
    id: "reports-analytics",
    title: "Reports and Analytics",
    description: "View summarized operational data across all monitoring tools. Generate insights and export reports to support decision-making and documentation.",
  },
];
const LANDING_PANELS = {
  home: {
    label: "Home",
    eyebrow: "ISSD Monitoring",
    title: "Centralized monitoring for daily ISSD operations",
    copy: [
      "The landing page introduces the workspace for project monitoring, DV payment monitoring, and outgoing document tracking.",
      "Use Get Started to enter the full dashboard and manage live monitoring records in one place.",
    ],
  },
  about: {
    label: "About",
    eyebrow: "About The System",
    title: "Built to keep ISSD records organized and visible",
    copy: [
      "This system supports the Internal Service Support Division by keeping operational records accurate, structured, and easy to retrieve.",
      "It combines monitoring for contracts, disbursement vouchers, and routed outgoing documents inside a single interface.",
    ],
  },
  services: {
    label: "Services",
    eyebrow: "Core Services",
    title: "Key monitoring tools available in the workspace",
    list: [
      "Project contract monitoring",
      "DV payment tracking",
      "Outgoing document routing",
      "Record search, review, and CSV export",
    ],
  },
  faqs: {
    label: "FAQs",
    eyebrow: "Frequently Asked Questions",
    title: "Frequently asked questions",
    description: "Select a monitoring category below to view a quick explanation of what each tool does.",
    items: FAQ_ITEMS,
  },
};

const fmtDate = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "No date");
const statusTone = (v) => ({ Signed: "positive", Receive: "positive", Received: "positive", Pending: "warning", Unsigned: "critical", Return: "critical", Returned: "critical" }[v] || "neutral");
const pageSlice = (items, p) => items.slice((p - 1) * PAGE, p * PAGE);
const tally = (items, key) => Object.entries(items.reduce((a, item) => ({ ...a, [item[key]]: (a[item[key]] || 0) + 1 }), {})).map(([label, value]) => ({ label, value }));
const normalizePaymentStatus = (status) => ({ Receive: "Received", Received: "Received", Return: "Returned", Returned: "Returned" }[status] || status);
const compactLabel = (value, limit = 22) => (value.length > limit ? `${value.slice(0, limit - 3)}...` : value);

/** Log-scale ratio so small and large amounts both read well in charts (0–1). */
function analyticsLogRatio(value, max) {
  if (value <= 0 || max <= 0) return 0;
  const log10 = (n) => Math.log10(Math.max(n, 1));
  return log10(value) / log10(max);
}

function analyticsBarWidthPercent(value, max) {
  if (value <= 0) return 0;
  const pct = analyticsLogRatio(value, max) * 100;
  return Math.min(100, Math.max(6, pct));
}

function formatAnalyticsMoney(value) {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `₱${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `₱${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `₱${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `₱${(value / 1e3).toFixed(1)}K`;
  return peso.format(value);
}
const sortDateDesc = (items, key = "date") => [...items].sort((a, b) => b[key].localeCompare(a[key]));
function exportCsv(name, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

/** Oracle column is NUMBER(18,2): max 16 integer digits + 2 decimal places. */
const MAX_PROJECT_MONEY_INT_DIGITS = 16;
const MAX_PROJECT_MONEY_FRAC_DIGITS = 2;

/** Allowed in the field: digits, thousands commas, and a single decimal period (others stripped). */
const PROJECT_MONEY_ALLOWED = /[^\d.,]/g;
/** Same character class without `g` — safe for `.test()` */
const PROJECT_MONEY_DISALLOWED = /[^\d.,]/;

function stripMoneyGrouping(value) {
  return String(value ?? "").replace(/,/g, "");
}

function projectMoneyDisplayToNumber(display) {
  const s = stripMoneyGrouping(String(display ?? "").replace(PROJECT_MONEY_ALLOWED, "")).trim();
  if (!s || s === ".") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function projectMoneyExceedsOracleMax(display) {
  return projectMoneyParseState(display).digitLimitExceeded;
}

/** @returns {{ display: string, hadInvalidChars: boolean, digitLimitExceeded: boolean }} */
function projectMoneyParseState(rawInput) {
  const raw = String(rawInput ?? "");
  const hadInvalidChars = PROJECT_MONEY_DISALLOWED.test(raw);
  const allowedOnly = raw.replace(PROJECT_MONEY_ALLOWED, "");
  let s = stripMoneyGrouping(allowedOnly).replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  let intD = dot === -1 ? s.replace(/\./g, "") : s.slice(0, dot).replace(/\D/g, "");
  let fracD = dot === -1 ? "" : s.slice(dot + 1).replace(/\D/g, "");
  const digitLimitExceeded = intD.length > MAX_PROJECT_MONEY_INT_DIGITS || fracD.length > MAX_PROJECT_MONEY_FRAC_DIGITS;
  intD = intD.slice(0, MAX_PROJECT_MONEY_INT_DIGITS);
  fracD = fracD.slice(0, MAX_PROJECT_MONEY_FRAC_DIGITS);
  const trailingDot = dot !== -1 && fracD.length === 0 && s.endsWith(".");
  if (intD.length > 1) intD = intD.replace(/^0+/, "") || "0";
  const intNum = intD;
  const withCommas = intNum === "" ? "" : intNum.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let display;
  if (trailingDot) {
    display = withCommas === "" ? "0." : `${withCommas}.`;
  } else if (fracD) {
    const left = withCommas === "" ? "0" : withCommas;
    display = `${left}.${fracD}`;
  } else {
    display = withCommas;
  }
  return { display, hadInvalidChars, digitLimitExceeded };
}

function formatProjectMoneyInput(rawInput) {
  return projectMoneyParseState(rawInput).display;
}

function projectMoneyFromNumber(n) {
  if (!Number.isFinite(n) || n === 0) return "";
  return formatProjectMoneyInput(String(n));
}

/**
 * Parses duration text into an amount and unit: day, week, month, or year.
 * Examples: "120 days", "12 wks", "6 months", "1 year", "3 mo", "90-day", bare "90" → days.
 */
function parseProjectDuration(durationStr) {
  const raw = String(durationStr ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return null;
  const n = Number(numMatch[1]);
  if (!Number.isFinite(n) || n < 0) return null;

  const afterNum = lower.slice(lower.indexOf(numMatch[1]) + numMatch[1].length).trim();
  const tail = afterNum.replace(/^[\s\-–—]+/, "");

  /** Prefer explicit text after the number; else scan the whole string for keywords. */
  let unit = "day";
  const pickFromTail = () => {
    if (/^(year|years|yrs)\b/.test(tail) || /^yr\b/.test(tail) || /^y\b/.test(tail)) return "year";
    if (/^(month|months)\b/.test(tail) || /^mos\b/.test(tail) || /^mo\b/.test(tail) || /^m\b/.test(tail)) return "month";
    if (/^(week|weeks)\b/.test(tail) || /^wks\b/.test(tail) || /^wk\b/.test(tail) || /^w\b/.test(tail)) return "week";
    if (/^(day|days)\b/.test(tail) || /^d\b/.test(tail)) return "day";
    return null;
  };

  const fromTail = pickFromTail();
  if (fromTail) unit = fromTail;
  else if (/^\d+(?:\.\d+)?\s*$/.test(lower)) unit = "day";
  else if (/\b(year|years|yrs)\b/.test(lower) || /\byr\b/.test(lower)) unit = "year";
  else if (/\b(month|months|mos)\b/.test(lower) || /\bmo\b/.test(lower)) unit = "month";
  else if (/\b(week|weeks)\b/.test(lower) || /\bwks\b/.test(lower) || /\bwk\b/.test(lower)) unit = "week";
  else if (/\b(day|days)\b/.test(lower)) unit = "day";

  const amount =
    unit === "day" || unit === "week"
      ? Math.round(n * 100) / 100
      : Math.round(n);

  return { amount, unit };
}

function ymdFromLocalDate(dt) {
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Apply parsed duration to a local-calendar start date (YYYY-MM-DD). */
function addDurationToYmd(startYmd, parsed) {
  if (!startYmd || !parsed || !Number.isFinite(parsed.amount)) return "";
  const parts = startYmd.split("-");
  if (parts.length !== 3) return "";
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (![y, mo, d].every((x) => Number.isFinite(x))) return "";
  const dt = new Date(y, mo - 1, d);
  switch (parsed.unit) {
    case "day":
      dt.setDate(dt.getDate() + Math.round(parsed.amount));
      break;
    case "week":
      dt.setDate(dt.getDate() + Math.round(parsed.amount * 7));
      break;
    case "month":
      dt.setMonth(dt.getMonth() + parsed.amount);
      break;
    case "year":
      dt.setFullYear(dt.getFullYear() + parsed.amount);
      break;
    default:
      return "";
  }
  return ymdFromLocalDate(dt);
}

/** End date (YYYY-MM-DD) = start date + duration (days, weeks, months, or years). */
function projectComputedEndDateYmd(startYmd, durationStr) {
  const parsed = parseProjectDuration(durationStr);
  if (!parsed || !startYmd) return "";
  return addDurationToYmd(startYmd, parsed);
}

function formatProjectEndDateLabel(dateStr, durationStr) {
  const ymd = projectComputedEndDateYmd(dateStr, durationStr);
  return ymd ? fmtDate(ymd) : "—";
}

function App() {
  const [started, setStarted] = useState(() => readWorkspaceSession().entered);
  const [view, setView] = useState(() => readWorkspaceSession().view);
  const [landingModal, setLandingModal] = useState(null);
  const [activeFaq, setActiveFaq] = useState(FAQ_ITEMS[0].id);
  const [theme, setTheme] = useState(() => localStorage.getItem("monitoring-theme") || "light");
  const [dense] = useState(() => localStorage.getItem("monitoring-density") === "dense");
  const [sidebarNavOpen, setSidebarNavOpen] = useState(true);
  const [projects, setProjects] = useState([]);
  const [payments, setPayments] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [projectForm, setProjectForm] = useState(blankProject);
  const [projectMoneyWarnings, setProjectMoneyWarnings] = useState(blankProjectMoneyWarnings);
  const [extraGoods, setExtraGoods] = useState(readExtraGoods);
  const [hiddenPickerGoods, setHiddenPickerGoods] = useState(readHiddenPickerGoods);
  const [goodsAddVisible, setGoodsAddVisible] = useState(false);
  const [goodsAddDraft, setGoodsAddDraft] = useState("");
  const [goodsAddError, setGoodsAddError] = useState("");
  const [goodsRenameVisible, setGoodsRenameVisible] = useState(false);
  const [goodsRenameDraft, setGoodsRenameDraft] = useState("");
  const [goodsRenameError, setGoodsRenameError] = useState("");
  const [goodsSelectError, setGoodsSelectError] = useState("");
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [outgoingForm, setOutgoingForm] = useState(blankOutgoing);
  const [projectEdit, setProjectEdit] = useState(null);
  const [paymentEdit, setPaymentEdit] = useState(null);
  const [paymentEditModal, setPaymentEditModal] = useState(false);
  const [paymentEditForm, setPaymentEditForm] = useState(blankPayment);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [outgoingEdit, setOutgoingEdit] = useState(null);
  const [outgoingEditModal, setOutgoingEditModal] = useState(false);
  const [outgoingEditForm, setOutgoingEditForm] = useState(blankOutgoing);
  const [projectSearch, setProjectSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [outgoingSearch, setOutgoingSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Goods");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [outgoingFilter, setOutgoingFilter] = useState("All");
  const [projectPage, setProjectPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState("");
  const [projectSaveError, setProjectSaveError] = useState("");
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState("");
  const [paymentSaveError, setPaymentSaveError] = useState("");
  const [outgoingLoading, setOutgoingLoading] = useState(false);
  const [outgoingLoadError, setOutgoingLoadError] = useState("");
  const [outgoingSaveError, setOutgoingSaveError] = useState("");
  const [outgoingSaving, setOutgoingSaving] = useState(false);
  const [outgoingSubjectWarning, setOutgoingSubjectWarning] = useState(false);
  const [outgoingMemoNoWarning, setOutgoingMemoNoWarning] = useState({ invalidChars: false, maxLength: false });
  const [outgoingRequiredWarnings, setOutgoingRequiredWarnings] = useState(blankOutgoingRequiredWarnings);
  const [departments, setDepartments] = useState([]);
  const [thruAddVisible, setThruAddVisible] = useState(false);
  const [thruAddDraft, setThruAddDraft] = useState("");
  const [thruAddError, setThruAddError] = useState("");
  const [forAddVisible, setForAddVisible] = useState(false);
  const [forAddDraft, setForAddDraft] = useState("");
  const [forAddError, setForAddError] = useState("");
  const [dvTitleWarning, setDvTitleWarning] = useState(false);
  const [dvClaimantWarning, setDvClaimantWarning] = useState(false);
  const [dvVoucherWarning, setDvVoucherWarning] = useState({ nonNumeric: false, maxLength: false });
  const [dvAmountWarning, setDvAmountWarning] = useState({ invalidChars: false, maxDigits: false });
  const [paymentRequiredWarnings, setPaymentRequiredWarnings] = useState(blankPaymentRequiredWarnings);
  const [projectRequiredWarnings, setProjectRequiredWarnings] = useState(blankProjectRequiredWarnings);
  const [projectSaving, setProjectSaving] = useState(false);
  const [reportExport, setReportExport] = useState("summary");
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [requiredFieldsAlert, setRequiredFieldsAlert] = useState(null);
  const showRequiredFieldsAlert = (message = REQUIRED_FIELDS_ALERT_MESSAGE) => {
    setRequiredFieldsAlert(message);
  };
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(blankProject);
  const [editMoneyWarnings, setEditMoneyWarnings] = useState(blankProjectMoneyWarnings);
  const closeEditModal = () => {
    setEditModal(false);
    setProjectEdit(null);
    setEditForm(blankProject);
    setEditMoneyWarnings(blankProjectMoneyWarnings);
    setGoodsAddVisible(false);
    setGoodsAddDraft("");
    setGoodsAddError("");
    setGoodsRenameVisible(false);
    setGoodsRenameDraft("");
    setGoodsRenameError("");
    setGoodsSelectError("");
    setProjectSaveError("");
  };
  const closePaymentEditModal = () => {
    setPaymentEditModal(false);
    setPaymentEdit(null);
    setPaymentEditForm(blankPayment);
    setDvTitleWarning(false);
    setDvClaimantWarning(false);
    setDvVoucherWarning({ nonNumeric: false, maxLength: false });
    setDvAmountWarning({ invalidChars: false, maxDigits: false });
    setPaymentSaveError("");
  };
  const closeOutgoingEditModal = () => {
    setOutgoingEditModal(false);
    setOutgoingEdit(null);
    setOutgoingEditForm(blankOutgoing);
    setOutgoingSubjectWarning(false);
    setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false });
    setThruAddVisible(false);
    setThruAddDraft("");
    setThruAddError("");
    setForAddVisible(false);
    setForAddDraft("");
    setForAddError("");
    setOutgoingSaveError("");
  };
  const currentViewMeta = VIEW_META[view];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = dense ? "dense" : "comfortable";
    localStorage.setItem("monitoring-theme", theme);
    localStorage.setItem("monitoring-density", dense ? "dense" : "comfortable");
  }, [theme, dense]);

  useEffect(() => {
    if (!started) {
      try {
        localStorage.removeItem(WORKSPACE_SESSION_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify({ entered: true, view }));
    } catch {
      /* ignore */
    }
  }, [started, view]);

  useEffect(() => {
    try {
      localStorage.setItem(GOODS_STORAGE_KEY, JSON.stringify(extraGoods));
    } catch {
      /* ignore quota / private mode */
    }
  }, [extraGoods]);

  useEffect(() => {
    try {
      localStorage.setItem(GOODS_PICKER_HIDDEN_KEY, JSON.stringify(hiddenPickerGoods));
    } catch {
      /* ignore */
    }
  }, [hiddenPickerGoods]);

  const goodsOptions = useMemo(() => mergeGoodsOptions(extraGoods, projects, hiddenPickerGoods), [extraGoods, projects, hiddenPickerGoods]);
  const goodsFilterOptions = useMemo(() => ["All Goods", ...goodsOptions], [goodsOptions]);

  const addGoodsCommit = () => {
    const t = goodsAddDraft.trim();
    if (!t) {
      setGoodsAddError("Enter a name.");
      return;
    }
    const lower = t.toLowerCase();
    if (goodsOptions.some((g) => g.toLowerCase() === lower)) {
      setGoodsAddError("That kind is already listed.");
      return;
    }
    setExtraGoods((prev) => [...prev, t]);
    setProjectForm((f) => ({ ...f, goods: t }));
    setGoodsAddDraft("");
    setGoodsAddVisible(false);
    setGoodsAddError("");
  };

  const renameGoodsCommit = async () => {
    const oldName = projectForm.goods;
    const newName = goodsRenameDraft.trim();
    if (!newName) {
      setGoodsRenameError("Enter a name.");
      return;
    }
    if (oldName === newName) {
      setGoodsRenameVisible(false);
      setGoodsRenameError("");
      return;
    }
    const lower = newName.toLowerCase();
    if (goodsOptions.some((g) => g !== oldName && g.toLowerCase() === lower)) {
      setGoodsRenameError("That kind is already listed.");
      return;
    }
    const affected = projects.filter((p) => p.goods === oldName);
    setGoodsRenameError("");
    setGoodsSelectError("");
    try {
      const replacements = new Map();
      for (const p of affected) {
        const body = {
          contractName: String(p.contractName ?? "").trim().slice(0, MAX_PROJECT_CONTRACT_NAME_LENGTH),
          date: String(p.date ?? "").trim(),
          duration: String(p.duration ?? "").trim().slice(0, MAX_PROJECT_DURATION_LENGTH),
          goods: newName,
          amount: Number(p.amount ?? 0),
          outstanding: Number(p.outstanding ?? 0),
        };
        const res = await fetch(`/api/projects/${p.id}`, {
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
        if (!res.ok) {
          throw new Error((data && data.message) || raw || "Save failed");
        }
        replacements.set(p.id, data);
      }
      setProjects((cur) => cur.map((x) => replacements.get(x.id) ?? x));
      setExtraGoods((prev) => {
        if (!prev.some((x) => x === oldName)) return prev;
        const next = prev.map((x) => (x === oldName ? newName : x));
        const seen = new Set();
        return next.filter((x) => {
          const k = x.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      });
      setProjectForm((f) => ({ ...f, goods: newName }));
      if (projectFilter === oldName) setProjectFilter(newName);
      if (BASE_GOODS.includes(oldName)) {
        setHiddenPickerGoods((prev) => Array.from(new Set([...prev, oldName])));
        if (affected.length === 0) {
          setExtraGoods((prev) => (prev.some((x) => x.toLowerCase() === newName.toLowerCase()) ? prev : [...prev, newName]));
        }
      }
      setGoodsRenameVisible(false);
      setGoodsRenameDraft("");
      setGoodsRenameError("");
    } catch (e) {
      setGoodsRenameError(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteGoodsKind = () => {
    const name = projectForm.goods;
    setGoodsSelectError("");
    const inExtra = extraGoods.some((x) => x === name);
    const isBase = BASE_GOODS.includes(name);

    if (isBase) {
      if (!window.confirm(`Delete "${name}" from the kinds list? Existing project records will not be changed.`)) return;
      const nextHidden = Array.from(new Set([...hiddenPickerGoods, name]));
      setHiddenPickerGoods(nextHidden);
      const nextOpts = mergeGoodsOptions(extraGoods, projects, nextHidden);
      const fallback = nextOpts[0] || BASE_GOODS[0];
      setProjectForm((f) => ({ ...f, goods: f.goods === name ? fallback : f.goods }));
      if (projectFilter === name) setProjectFilter("All Goods");
      return;
    }

    if (!inExtra) {
      setGoodsSelectError("Remove kinds you added with Add Goods, or delete a built-in with the trash icon.");
      return;
    }

    if (!window.confirm(`Delete "${name}" from your added kinds? Existing project records will not be changed.`)) return;
    const nextExtra = extraGoods.filter((x) => x !== name);
    const nextHidden = Array.from(new Set([...hiddenPickerGoods, name]));
    const nextOpts = mergeGoodsOptions(nextExtra, projects, nextHidden);
    const fallback = nextOpts[0] || BASE_GOODS[0];
    setExtraGoods(nextExtra);
    setHiddenPickerGoods(nextHidden);
    setProjectForm((f) => ({ ...f, goods: f.goods === name ? fallback : f.goods }));
    if (projectFilter === name) setProjectFilter("All Goods");
  };

  const stats = useMemo(() => {
    const totalContractValue = projects.reduce((s, x) => s + x.amount, 0);
    const totalOutstandingValue = projects.reduce((s, x) => s + x.outstanding, 0);
    const totalVoucherValue = payments.reduce((s, x) => s + x.amount, 0);
    const pendingPayments = payments.filter((x) => x.ictssd === "Pending" || x.gad === "Pending" || x.gad === "Unsigned" || x.gad === "Return" || x.cash === "Return").length;
    return {
      totalProjects: projects.length,
      totalContractValue,
      totalOutstandingValue,
      totalVouchers: payments.length,
      totalVoucherValue,
      pendingPayments,
      totalOutgoing: outgoing.length,
      pendingProjects: projects.filter((x) => x.outstanding > 0).length,
    };
  }, [projects, payments, outgoing]);

  const outgoingBars = useMemo(() => tally(outgoing, "forDept").sort((a, b) => b.value - a.value).slice(0, 6), [outgoing]);
  const projectRows = useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    return projects.filter((x) => (!q || `${x.contractName} ${x.goods} ${x.duration}`.toLowerCase().includes(q)) && (projectFilter === "All Goods" || x.goods === projectFilter));
  }, [projects, projectSearch, projectFilter]);
  const paymentRows = useMemo(() => {
    const q = paymentSearch.toLowerCase().trim();
    return payments.filter((x) => (!q || `${x.title} ${x.claimantAddress} ${x.voucherNo}`.toLowerCase().includes(q)) && (paymentFilter === "All" || [x.ictssd, x.gad, x.cash].includes(paymentFilter)));
  }, [payments, paymentSearch, paymentFilter]);
  const outgoingRows = useMemo(() => {
    const q = outgoingSearch.toLowerCase().trim();
    return outgoing.filter((x) => (!q || `${x.subject} ${x.memoNo} ${x.forDept}`.toLowerCase().includes(q)) && (outgoingFilter === "All" || x.forDept === outgoingFilter));
  }, [outgoing, outgoingSearch, outgoingFilter]);

  const thruDeptOptions = useMemo(
    () => mergeDepartmentOptions(BASE_THRU, departments, "thru", outgoing, "thru"),
    [departments, outgoing],
  );
  const forDeptOptions = useMemo(
    () => mergeDepartmentOptions(BASE_FOR, departments, "for", outgoing, "forDept"),
    [departments, outgoing],
  );
  const forDeptFilterOptions = useMemo(() => ["All", ...forDeptOptions], [forDeptOptions]);

  const projectPages = Math.ceil(projectRows.length / PAGE) || 1;
  const paymentPages = Math.ceil(paymentRows.length / PAGE) || 1;
  const outgoingPages = Math.ceil(outgoingRows.length / PAGE) || 1;
  const safeProjectPage = Math.min(projectPage, projectPages);
  const safePaymentPage = Math.min(paymentPage, paymentPages);
  const safeOutgoingPage = Math.min(outgoingPage, outgoingPages);

  const projectEndDateYmd = useMemo(
    () => projectComputedEndDateYmd(projectForm.date, projectForm.duration),
    [projectForm.date, projectForm.duration],
  );
  const editEndDateYmd = useMemo(
    () => projectComputedEndDateYmd(editForm.date, editForm.duration),
    [editForm.date, editForm.duration],
  );

  const projectValueSeries = useMemo(
    () => projects.map((item) => ({ label: compactLabel(item.contractName), fullLabel: item.contractName, value: item.amount })),
    [projects],
  );
  const projectOutstandingSeries = useMemo(
    () => projects.map((item) => ({ label: compactLabel(item.contractName), fullLabel: item.contractName, value: item.outstanding })),
    [projects],
  );
  const outstandingPercent = stats.totalContractValue ? Math.round((stats.totalOutstandingValue / stats.totalContractValue) * 100) : 0;

  const dvStatusCharts = useMemo(() => {
    const collect = (key) => Object.entries(
      payments.reduce((acc, item) => {
        const label = normalizePaymentStatus(item[key]);
        return { ...acc, [label]: (acc[label] || 0) + 1 };
      }, {}),
    ).map(([label, value]) => ({ label, value }));

    return {
      ictssd: collect("ictssd"),
      gad: collect("gad"),
      cash: collect("cash"),
    };
  }, [payments]);

  const dvStatusSummary = useMemo(() => {
    const labels = ["Signed", "Pending", "Received", "Returned", "Unsigned"];
    const counts = labels.reduce((acc, label) => ({ ...acc, [label]: 0 }), {});

    payments.forEach((item) => {
      [item.ictssd, item.gad, item.cash].forEach((status) => {
        const normalized = normalizePaymentStatus(status);
        if (counts[normalized] !== undefined) counts[normalized] += 1;
      });
    });

    return labels.map((label) => ({ label, value: counts[label] }));
  }, [payments]);

  const outgoingByThru = useMemo(() => tally(outgoing, "thru").sort((a, b) => b.value - a.value), [outgoing]);
  const outgoingByFor = useMemo(() => tally(outgoing, "forDept").sort((a, b) => b.value - a.value), [outgoing]);
  const recentOutgoingPreview = useMemo(() => sortDateDesc(outgoing).slice(0, 5), [outgoing]);

  const recentActivityRows = useMemo(() => {
    const projectItems = projects.map((item) => ({
      id: `project-${item.id}`,
      recordType: "Project",
      title: item.contractName,
      date: item.date,
      status: item.outstanding > 0 ? "Outstanding" : "Cleared",
      amount: item.amount,
    }));
    const paymentItems = payments.map((item) => ({
      id: `payment-${item.id}`,
      recordType: "DV Payment",
      title: item.voucherNo,
      date: item.date || "",
      status: `${item.ictssd} / ${item.gad} / ${item.cash}`,
      amount: item.amount,
    }));
    const outgoingItems = outgoing.map((item) => ({
      id: `outgoing-${item.id}`,
      recordType: "Outgoing",
      title: item.subject,
      date: item.date,
      status: `${item.thru} -> ${item.forDept}`,
      amount: null,
    }));

    return [...projectItems, ...paymentItems, ...outgoingItems].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [projects, payments, outgoing]);

  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      setProjectLoadError("");
      try {
        const res = await fetch("/api/projects");
        const raw = await res.text();
        let data;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        if (!res.ok) {
          throw new Error((data && data.message) || raw || "Failed to load projects");
        }
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setProjectLoadError(e instanceof Error ? e.message : String(e));
          setProjects([]);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [started]);

  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    (async () => {
      setPaymentsLoading(true);
      setPaymentLoadError("");
      try {
        const res = await fetch("/api/dv-payments");
        const raw = await res.text();
        let data;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!res.ok) throw new Error((data && data.message) || raw || "Failed to load DV payments");
        if (!cancelled) setPayments(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) { setPaymentLoadError(e instanceof Error ? e.message : String(e)); setPayments([]); }
      } finally {
        if (!cancelled) setPaymentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [started]);

  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    (async () => {
      setOutgoingLoading(true);
      setOutgoingLoadError("");
      try {
        const res = await fetch("/api/outgoing");
        const raw = await res.text();
        let data;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!res.ok) throw new Error((data && data.message) || raw || "Failed to load outgoing records");
        if (!cancelled) setOutgoing(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setOutgoingLoadError(e instanceof Error ? e.message : String(e));
          setOutgoing([]);
        }
      } finally {
        if (!cancelled) setOutgoingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [started]);

  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/departments");
        const raw = await res.text();
        let data;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!res.ok) throw new Error((data && data.message) || raw || "Failed to load departments");
        if (!cancelled) setDepartments(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [started]);

  const deleteProjectRow = async (id, title) => {
    await new Promise((resolve) => setConfirmModal({ title, onConfirm: resolve }));
    setConfirmModal(null);
    setProjectSaveError("");
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
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
      setProjects((cur) => cur.filter((item) => item.id !== id));
    } catch (e) {
      setProjectSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteOutgoingRow = async (id, title) => {
    await new Promise((resolve) => setConfirmModal({ title, onConfirm: resolve }));
    setConfirmModal(null);
    setOutgoingSaveError("");
    try {
      const res = await fetch(`/api/outgoing/${id}`, { method: "DELETE" });
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
      setOutgoing((cur) => cur.filter((item) => item.id !== id));
      if (outgoingEdit === id) {
        closeOutgoingEditModal();
      }
    } catch (e) {
      setOutgoingSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveProject = async (e) => {
    e.preventDefault();
    const isEdit = projectEdit != null;
    const src = isEdit ? editForm : projectForm;
    setProjectSaveError("");

    if (!isEdit) {
      if (goodsAddVisible || goodsRenameVisible) {
        setProjectSaveError("Save or cancel goods changes before adding the project.");
        return;
      }
      const required = {
        contractName: !src.contractName.trim(),
        date: !src.date?.trim(),
        duration: !src.duration.trim(),
        amount: !src.amount.trim(),
        outstanding: !src.outstanding.trim(),
      };
      if (Object.values(required).some(Boolean)) {
        setProjectRequiredWarnings(required);
        showRequiredFieldsAlert();
        return;
      }
      if (
        projectMoneyWarnings.contractName.maxLength ||
        projectMoneyWarnings.duration.maxLength ||
        projectMoneyWarnings.amount.invalidChars ||
        projectMoneyWarnings.amount.maxDigits ||
        projectMoneyWarnings.outstanding.invalidChars ||
        projectMoneyWarnings.outstanding.maxDigits
      ) {
        setProjectSaveError("Fix field errors before saving.");
        return;
      }
      setProjectRequiredWarnings(blankProjectRequiredWarnings);
    } else if (!src.contractName || !src.date || !src.duration) {
      return;
    }

    if (projectMoneyExceedsOracleMax(src.amount) || projectMoneyExceedsOracleMax(src.outstanding)) {
      setProjectSaveError("Amount values exceed the maximum allowed (16 digits before decimal).");
      return;
    }
    const amount = projectMoneyDisplayToNumber(src.amount);
    const outstanding = projectMoneyDisplayToNumber(src.outstanding);
    setProjectSaving(true);
    const body = {
      contractName: src.contractName.trim().slice(0, MAX_PROJECT_CONTRACT_NAME_LENGTH),
      date: src.date,
      duration: src.duration.trim().slice(0, MAX_PROJECT_DURATION_LENGTH),
      goods: src.goods,
      amount,
      outstanding,
    };
    try {
      const url = projectEdit != null ? `/api/projects/${projectEdit}` : "/api/projects";
      const method = projectEdit != null ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
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
      if (!res.ok) {
        throw new Error((data && data.message) || raw || "Save failed");
      }
      const saved = data;
      setProjects((cur) => (projectEdit != null ? cur.map((x) => (x.id === projectEdit ? saved : x)) : [saved, ...cur]));
      setProjectForm(blankProject);
      setProjectMoneyWarnings(blankProjectMoneyWarnings);
      setProjectRequiredWarnings(blankProjectRequiredWarnings);
      setGoodsAddVisible(false);
      setGoodsAddDraft("");
      setGoodsAddError("");
      setGoodsRenameVisible(false);
      setGoodsRenameDraft("");
      setGoodsRenameError("");
      setGoodsSelectError("");
      setProjectEdit(null);
      setEditModal(false);
    } catch (err) {
      setProjectSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setProjectSaving(false);
    }
  };
  const savePayment = async (e) => {
    e.preventDefault();
    setPaymentSaveError("");
    const required = {
      title: !paymentForm.title.trim(),
      claimantAddress: !paymentForm.claimantAddress.trim(),
      voucherNo: !paymentForm.voucherNo.trim(),
      amount: !paymentForm.amount.trim(),
      date: !paymentForm.date?.trim(),
    };
    if (Object.values(required).some(Boolean)) {
      setPaymentRequiredWarnings(required);
      showRequiredFieldsAlert();
      return;
    }
    if (dvVoucherWarning.nonNumeric || dvVoucherWarning.maxLength) {
      setPaymentSaveError("Fix voucher number errors before saving.");
      return;
    }
    if (dvAmountWarning.invalidChars || dvAmountWarning.maxDigits) {
      setPaymentSaveError("Fix amount errors before saving.");
      return;
    }
    setPaymentRequiredWarnings(blankPaymentRequiredWarnings);
    const body = {
      title: paymentForm.title.trim().slice(0, MAX_DV_TITLE_LENGTH),
      claimantAddress: paymentForm.claimantAddress.trim().slice(0, MAX_DV_CLAIMANT_LENGTH),
      voucherNo: paymentForm.voucherNo.trim().slice(0, MAX_DV_VOUCHER_LENGTH),
      amount: projectMoneyDisplayToNumber(paymentForm.amount),
      date: paymentForm.date.trim(),
      ictssd: paymentForm.ictssd,
      gad: paymentForm.gad,
      cash: paymentForm.cash,
    };
    try {
      const res = await fetch("/api/dv-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      const saved = data;
      setPayments((cur) => [saved, ...cur]);
      setPaymentForm(blankPayment);
      setDvTitleWarning(false);
      setDvClaimantWarning(false);
      setDvVoucherWarning({ nonNumeric: false, maxLength: false });
      setDvAmountWarning({ invalidChars: false, maxDigits: false });
      setPaymentRequiredWarnings(blankPaymentRequiredWarnings);
    } catch (err) {
      setPaymentSaveError(err instanceof Error ? err.message : String(err));
    }
  };
  const savePaymentEdit = async (e) => {
    e.preventDefault();
    if (paymentEdit == null) return;
    if (!paymentEditForm.title || !paymentEditForm.claimantAddress || !paymentEditForm.voucherNo) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const body = {
      title: paymentEditForm.title.trim(),
      claimantAddress: paymentEditForm.claimantAddress.trim(),
      voucherNo: paymentEditForm.voucherNo.trim(),
      amount: projectMoneyDisplayToNumber(paymentEditForm.amount),
      date: paymentEditForm.date?.trim() || payments.find((x) => x.id === paymentEdit)?.date || todayStr,
      ictssd: paymentEditForm.ictssd,
      gad: paymentEditForm.gad,
      cash: paymentEditForm.cash,
    };
    setPaymentSaving(true);
    setPaymentSaveError("");
    try {
      const res = await fetch(`/api/dv-payments/${paymentEdit}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      const saved = data;
      setPayments((cur) => cur.map((x) => (x.id === paymentEdit ? saved : x)));
      closePaymentEditModal();
    } catch (err) {
      setPaymentSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaymentSaving(false);
    }
  };
  const saveOutgoing = async (e) => {
    e.preventDefault();
    setOutgoingSaveError("");

    if (thruAddVisible || forAddVisible) {
      setOutgoingSaveError("Save or cancel the new department before adding the outgoing record.");
      return;
    }

    const required = {
      subject: !outgoingForm.subject.trim(),
      memoNo: !outgoingForm.memoNo.trim(),
      date: !outgoingForm.date?.trim(),
      thru: !outgoingForm.thru?.trim(),
      forDept: !outgoingForm.forDept?.trim(),
    };
    if (Object.values(required).some(Boolean)) {
      setOutgoingRequiredWarnings(required);
      showRequiredFieldsAlert();
      return;
    }
    setOutgoingRequiredWarnings(blankOutgoingRequiredWarnings);

    const subject = outgoingForm.subject.trim().slice(0, MAX_OUTGOING_SUBJECT_LENGTH);
    const memoNo = outgoingForm.memoNo.trim().replace(OUTGOING_MEMO_NO_ALLOWED, "").slice(0, MAX_OUTGOING_MEMO_NO_LENGTH);
    const date = outgoingForm.date.trim();
    const thru = outgoingForm.thru.trim();
    const forDept = outgoingForm.forDept.trim();

    if (!memoNo) {
      setOutgoingSaveError("Memo number is required (letters, numbers, and hyphens only).");
      return;
    }

    const body = { subject, memoNo, date, thru, forDept };
    setOutgoingSaving(true);
    try {
      const res = await fetch("/api/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      const saved = data;
      setOutgoing((cur) => [saved, ...cur]);
      setOutgoingForm(blankOutgoing);
      setOutgoingSubjectWarning(false);
      setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false });
      setOutgoingRequiredWarnings(blankOutgoingRequiredWarnings);
      setThruAddVisible(false);
      setThruAddDraft("");
      setThruAddError("");
      setForAddVisible(false);
      setForAddDraft("");
      setForAddError("");
    } catch (err) {
      setOutgoingSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutgoingSaving(false);
    }
  };
  const saveOutgoingEdit = async (e) => {
    e.preventDefault();
    if (outgoingEdit == null) return;
    setOutgoingSaveError("");

    if (thruAddVisible || forAddVisible) {
      setOutgoingSaveError("Save or cancel the new department before saving.");
      return;
    }

    const subject = outgoingEditForm.subject.trim().slice(0, MAX_OUTGOING_SUBJECT_LENGTH);
    const memoNo = outgoingEditForm.memoNo.trim().replace(OUTGOING_MEMO_NO_ALLOWED, "").slice(0, MAX_OUTGOING_MEMO_NO_LENGTH);
    const todayStr = new Date().toISOString().slice(0, 10);
    const date = outgoingEditForm.date?.trim() || outgoing.find((x) => x.id === outgoingEdit)?.date || todayStr;
    const thru = outgoingEditForm.thru?.trim() || thruDeptOptions[0] || BASE_THRU[0] || "";
    const forDept = outgoingEditForm.forDept?.trim() || forDeptOptions[0] || BASE_FOR[0] || "";

    if (!subject) {
      setOutgoingSaveError("Subject is required.");
      return;
    }
    if (!memoNo) {
      setOutgoingSaveError("Memo number is required (letters, numbers, and hyphens only).");
      return;
    }
    if (!thru || !forDept) {
      setOutgoingSaveError("Thru and For departments are required.");
      return;
    }

    const body = { subject, memoNo, date, thru, forDept };
    setOutgoingSaving(true);
    try {
      const res = await fetch(`/api/outgoing/${outgoingEdit}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      const saved = data;
      setOutgoing((cur) => cur.map((x) => (x.id === outgoingEdit ? saved : x)));
      closeOutgoingEditModal();
    } catch (err) {
      setOutgoingSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setOutgoingSaving(false);
    }
  };

  const toolbar = (title, desc, search, setSearch, filter, setFilter, options, label, onExport) => (
    <>
      <div className="panel__header"><div><p className="panel__kicker">Records</p><h3>{title}</h3><p className="panel__description">{desc}</p></div><button type="button" className="ghost-button" onClick={onExport}>Export CSV</button></div>
      <div className="toolbar">
        <label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records" /></label>
        <label><span>{label}</span><select value={filter} onChange={(e) => setFilter(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
      </div>
    </>
  );
  const pager = (page, pages, total, setPage) => (
    <div className="pagination">
      <span className="pagination__summary">Showing {total ? (page - 1) * PAGE + 1 : 0}-{Math.min(page * PAGE, total)} of {total}</span>
      <strong className="pagination__status">Page {page} of {pages}</strong>
      <div className="pagination__nav">
        <button type="button" className="ghost-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <button type="button" className="ghost-button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
  const open = (type, title, rows) => setModal({ type, title, rows });
  const openLandingPanel = (key) => {
    setLandingModal(LANDING_PANELS[key]);
    setActiveFaq(key === "faqs" ? FAQ_ITEMS[0].id : "");
  };

  const projectExport = () => exportCsv("project-monitoring.csv", [["Name of Contract", "Start Date", "End Date", "Duration", "Kind of Goods", "Amount of Contract", "Outstanding Value"], ...projectRows.map((x) => [x.contractName, x.date, projectComputedEndDateYmd(x.date, x.duration) || "", x.duration, x.goods, x.amount, x.outstanding])]);
  const paymentExport = () => exportCsv("dv-payment-monitoring.csv", [["Title of the Project", "Name and Address of Claimant", "Voucher No.", "Date", "Amount", "ICTSSD", "GAD", "CASH"], ...paymentRows.map((x) => [x.title, x.claimantAddress, x.voucherNo, x.date || "", x.amount, x.ictssd, x.gad, x.cash])]);
  const outgoingExport = () => exportCsv("issd-outgoing-monitoring.csv", [["Subject", "Memo Number", "Date", "Thru", "For"], ...outgoingRows.map((x) => [x.subject, x.memoNo, x.date, x.thru, x.forDept])]);

  const commitDepartmentAdd = async (kind, draft, options, formField, setError, setVisible, setDraft, setForm) => {
    const t = draft.trim().slice(0, MAX_DEPARTMENT_NAME_LENGTH);
    if (!t) {
      setError("Enter a name.");
      return;
    }
    if (options.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setError("That department is already listed.");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t, kind }),
      });
      const raw = await res.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!res.ok) throw new Error((data && data.message) || raw || "Save failed");
      setDepartments((cur) => [...cur, data]);
      setForm((f) => ({ ...f, [formField]: t }));
      setDraft("");
      setVisible(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderOutgoingDeptPickers = (form, setForm, thruId, forId, requiredWarnings, setRequiredWarnings) => (
    <div className="form-row form-row--dept-pickers">
      <DeptSelectWithAdd
        label="Thru"
        id={thruId}
        value={form.thru}
        requiredMark={Boolean(requiredWarnings)}
        requiredWarning={Boolean(requiredWarnings?.thru)}
        showPlaceholderOption={Boolean(requiredWarnings)}
        onChange={(e) => {
          setForm({ ...form, thru: e.target.value });
          setRequiredWarnings?.((w) => ({ ...w, thru: false }));
        }}
        options={thruDeptOptions}
        addVisible={thruAddVisible}
        onAddOpen={() => {
          setThruAddError("");
          setThruAddDraft("");
          setThruAddVisible(true);
          setForAddVisible(false);
          setForAddDraft("");
          setForAddError("");
        }}
        onAddCancel={() => {
          setThruAddVisible(false);
          setThruAddDraft("");
          setThruAddError("");
        }}
        addDraft={thruAddDraft}
        onAddDraftChange={(v) => {
          setThruAddDraft(v.slice(0, MAX_DEPARTMENT_NAME_LENGTH));
          setThruAddError("");
        }}
        addError={thruAddError}
        onAddCommit={() => void commitDepartmentAdd("thru", thruAddDraft, thruDeptOptions, "thru", setThruAddError, setThruAddVisible, setThruAddDraft, setForm)}
        addAriaLabel="Add Department"
      />
      <DeptSelectWithAdd
        label="For"
        id={forId}
        value={form.forDept}
        requiredMark={Boolean(requiredWarnings)}
        requiredWarning={Boolean(requiredWarnings?.forDept)}
        showPlaceholderOption={Boolean(requiredWarnings)}
        onChange={(e) => {
          setForm({ ...form, forDept: e.target.value });
          setRequiredWarnings?.((w) => ({ ...w, forDept: false }));
        }}
        options={forDeptOptions}
        addVisible={forAddVisible}
        onAddOpen={() => {
          setForAddError("");
          setForAddDraft("");
          setForAddVisible(true);
          setThruAddVisible(false);
          setThruAddDraft("");
          setThruAddError("");
        }}
        onAddCancel={() => {
          setForAddVisible(false);
          setForAddDraft("");
          setForAddError("");
        }}
        addDraft={forAddDraft}
        onAddDraftChange={(v) => {
          setForAddDraft(v.slice(0, MAX_DEPARTMENT_NAME_LENGTH));
          setForAddError("");
        }}
        addError={forAddError}
        onAddCommit={() => void commitDepartmentAdd("for", forAddDraft, forDeptOptions, "forDept", setForAddError, setForAddVisible, setForAddDraft, setForm)}
        addAriaLabel="Add Department"
      />
    </div>
  );
  const outgoingDeptPickers = renderOutgoingDeptPickers(
    outgoingForm,
    setOutgoingForm,
    "outgoing-thru-select",
    "outgoing-for-select",
    outgoingRequiredWarnings,
    setOutgoingRequiredWarnings,
  );
  const outgoingEditDeptPickers = renderOutgoingDeptPickers(
    outgoingEditForm,
    setOutgoingEditForm,
    "outgoing-edit-thru-select",
    "outgoing-edit-for-select",
  );

  const projectAddRecordForm = (
    <form className="record-form" onSubmit={saveProject}>
      <label>
        <span>Name of Contract *</span>
        <input
          type="text"
          autoComplete="off"
          value={projectForm.contractName}
          onChange={(e) => {
            const raw = e.target.value;
            const maxLen = MAX_PROJECT_CONTRACT_NAME_LENGTH;
            const capped = raw.slice(0, maxLen);
            setProjectForm({ ...projectForm, contractName: capped });
            setProjectRequiredWarnings((w) => ({ ...w, contractName: false }));
            setProjectMoneyWarnings((w) => ({ ...w, contractName: { maxLength: raw.length > maxLen } }));
          }}
          onBlur={() => {
            setProjectMoneyWarnings((w) => ({ ...w, contractName: { maxLength: false } }));
          }}
          placeholder="Enter contract title"
          aria-invalid={projectRequiredWarnings.contractName || projectMoneyWarnings.contractName.maxLength}
        />
        <div className="form-field-warning-slot">
          {projectRequiredWarnings.contractName ? (
            <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
          ) : null}
          {!projectRequiredWarnings.contractName && projectMoneyWarnings.contractName.maxLength ? (
            <p className="form-field-warning" role="alert">{`At most ${MAX_PROJECT_CONTRACT_NAME_LENGTH} characters are allowed.`}</p>
          ) : null}
        </div>
      </label>
      <div className="form-row form-row--project-start-duration">
        <label>
          <span>Start Date *</span>
          <input
            type="date"
            title="Choose a date using the calendar"
            value={projectForm.date}
            onKeyDown={blockDateFieldDirectEntry}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => {
              setProjectForm({ ...projectForm, date: e.target.value });
              setProjectRequiredWarnings((w) => ({ ...w, date: false }));
            }}
            aria-invalid={projectRequiredWarnings.date}
          />
          <div className="form-field-warning-slot">
            {projectRequiredWarnings.date ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Duration *</span>
          <input
            type="text"
            autoComplete="off"
            value={projectForm.duration}
            onChange={(e) => {
              const raw = e.target.value;
              const maxLen = MAX_PROJECT_DURATION_LENGTH;
              const capped = raw.slice(0, maxLen);
              setProjectForm({ ...projectForm, duration: capped });
              setProjectRequiredWarnings((w) => ({ ...w, duration: false }));
              setProjectMoneyWarnings((w) => ({ ...w, duration: { maxLength: raw.length > maxLen } }));
            }}
            onBlur={() => {
              setProjectMoneyWarnings((w) => ({ ...w, duration: { maxLength: false } }));
            }}
            placeholder="e.g. 120 days, 12 weeks, 6 months, 1 year"
            aria-invalid={projectRequiredWarnings.duration || projectMoneyWarnings.duration.maxLength}
          />
          <div className="form-field-warning-slot">
            {projectRequiredWarnings.duration ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!projectRequiredWarnings.duration && projectMoneyWarnings.duration.maxLength ? (
              <p className="form-field-warning" role="alert">{`At most ${MAX_PROJECT_DURATION_LENGTH} characters are allowed.`}</p>
            ) : null}
          </div>
        </label>
      </div>
      <label>
        <span>End Date</span>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          className="form-field-computed"
          value={projectEndDateYmd ? fmtDate(projectEndDateYmd) : ""}
          placeholder="Set start date and duration"
          title="Computed from start date plus duration. Use days, weeks, months, or years (e.g. 90 days, 8 wks, 3 mo, 2 years). A plain number defaults to days."
        />
        <div className="form-field-warning-slot" />
      </label>
      <div className="form-label-with-action">
        <div className="form-label-with-action__row">
          <label className="form-label-with-action__text" htmlFor="project-goods-select">
            <span>Kind of Goods *</span>
          </label>
          {goodsAddVisible ? (
            <button
              type="button"
              className="goods-cancel-btn"
              aria-label="Cancel"
              onClick={() => {
                setGoodsAddVisible(false);
                setGoodsAddDraft("");
                setGoodsAddError("");
              }}
            >
              <span className="goods-btn__icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </span>
              <span className="goods-btn__label">Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              className="goods-add-btn"
              aria-label="Add goods"
              onClick={() => {
                setGoodsAddError("");
                setGoodsAddDraft("");
                setGoodsAddVisible(true);
              }}
            >
              <span className="goods-btn__icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="2" x2="8" y2="14" />
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
              </span>
              <span className="goods-btn__label">Add Goods</span>
            </button>
          )}
        </div>
        {goodsAddVisible ? (
          <div className="form-inline-add-goods">
            <input
              type="text"
              value={goodsAddDraft}
              onChange={(e) => {
                setGoodsAddDraft(e.target.value);
                setGoodsAddError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGoodsCommit();
                }
              }}
              placeholder="e.g. Vehicles"
              aria-label="New kind of goods"
            />
            <button type="button" className="ghost-button ghost-button--compact" onClick={addGoodsCommit}>
              Add
            </button>
          </div>
        ) : null}
        {goodsAddError ? (
          <p className="form-field-warning form-field-warning--tight" role="alert">
            {goodsAddError}
          </p>
        ) : null}
        {(goodsRenameVisible || goodsAddVisible) ? (
          <select
            id="project-goods-select"
            className="form-goods-select form-goods-select--visual-hide"
            value={projectForm.goods}
            onChange={(e) => {
              setProjectForm({ ...projectForm, goods: e.target.value });
              setGoodsRenameError("");
              setGoodsSelectError("");
            }}
            tabIndex={-1}
            aria-label="Current kind of goods"
          >
            {goodsOptions.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        ) : (
          <div className="form-goods-select-row">
            <select
              id="project-goods-select"
              className="form-goods-select"
              value={projectForm.goods}
              onChange={(e) => {
                setProjectForm({ ...projectForm, goods: e.target.value });
                setGoodsRenameError("");
                setGoodsSelectError("");
              }}
            >
              {goodsOptions.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <button
              type="button"
              className="form-goods-select__icon-btn"
              aria-label="Rename kind of goods"
              title="Renames this kind and updates every project that uses it in the database"
              onClick={() => {
                setGoodsSelectError("");
                setGoodsRenameError("");
                setGoodsRenameDraft(projectForm.goods);
                setGoodsRenameVisible(true);
              }}
            >
              <GoodsEditIcon />
            </button>
            <button
              type="button"
              className="form-goods-select__icon-btn form-goods-select__icon-btn--danger"
              aria-label="Remove or hide kind from list"
              title="Hides a built-in kind from the list, or removes a kind you added with Add Goods."
              disabled={
                !BASE_GOODS.includes(projectForm.goods) && !extraGoods.some((x) => x === projectForm.goods)
              }
              onClick={() => void deleteGoodsKind()}
            >
              <GoodsTrashIcon />
            </button>
          </div>
        )}
        {goodsRenameVisible ? (
          <div className="form-inline-add-goods form-inline-add-goods--rename">
            <input
              type="text"
              value={goodsRenameDraft}
              onChange={(e) => {
                setGoodsRenameDraft(e.target.value);
                setGoodsRenameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void renameGoodsCommit();
                }
              }}
              placeholder="New name"
              aria-label="Rename kind of goods"
            />
            <button type="button" className="ghost-button ghost-button--compact" onClick={() => void renameGoodsCommit()}>
              Save
            </button>
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={() => {
                setGoodsRenameVisible(false);
                setGoodsRenameError("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {(goodsRenameError || goodsSelectError) ? (
          <p className="form-field-warning form-field-warning--tight" role="alert">
            {goodsRenameError || goodsSelectError}
          </p>
        ) : null}
      </div>
      <div className="form-row form-row--money-warnings">
        <label>
          <span>Amount of Contract *</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={projectForm.amount}
            onChange={(e) => {
              const st = projectMoneyParseState(e.target.value);
              setProjectForm({ ...projectForm, amount: st.display });
              setProjectRequiredWarnings((w) => ({ ...w, amount: false }));
              setProjectMoneyWarnings((w) => ({
                ...w,
                amount: { invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded },
              }));
            }}
            placeholder="0.00"
            aria-invalid={
              projectRequiredWarnings.amount ||
              projectMoneyWarnings.amount.invalidChars ||
              projectMoneyWarnings.amount.maxDigits
            }
          />
          <div className="form-field-warning-slot">
            {projectRequiredWarnings.amount ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!projectRequiredWarnings.amount &&
            (projectMoneyWarnings.amount.invalidChars || projectMoneyWarnings.amount.maxDigits) ? (
              <p className="form-field-warning" role="alert">
                {projectMoneyWarnings.amount.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}
                {projectMoneyWarnings.amount.maxDigits
                  ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.`
                  : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Outstanding Value *</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={projectForm.outstanding}
            onChange={(e) => {
              const st = projectMoneyParseState(e.target.value);
              setProjectForm({ ...projectForm, outstanding: st.display });
              setProjectRequiredWarnings((w) => ({ ...w, outstanding: false }));
              setProjectMoneyWarnings((w) => ({
                ...w,
                outstanding: { invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded },
              }));
            }}
            placeholder="0.00"
            aria-invalid={
              projectRequiredWarnings.outstanding ||
              projectMoneyWarnings.outstanding.invalidChars ||
              projectMoneyWarnings.outstanding.maxDigits
            }
          />
          <div className="form-field-warning-slot">
            {projectRequiredWarnings.outstanding ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!projectRequiredWarnings.outstanding &&
            (projectMoneyWarnings.outstanding.invalidChars || projectMoneyWarnings.outstanding.maxDigits) ? (
              <p className="form-field-warning" role="alert">
                {projectMoneyWarnings.outstanding.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}
                {projectMoneyWarnings.outstanding.maxDigits
                  ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.`
                  : null}
              </p>
            ) : null}
          </div>
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={projectSaving}>
          {projectSaving ? "Saving…" : "Add project"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setProjectEdit(null);
            setProjectForm(blankProject);
            setProjectMoneyWarnings(blankProjectMoneyWarnings);
            setProjectRequiredWarnings(blankProjectRequiredWarnings);
            setGoodsAddVisible(false);
            setGoodsAddDraft("");
            setGoodsAddError("");
            setGoodsRenameVisible(false);
            setGoodsRenameDraft("");
            setGoodsRenameError("");
            setGoodsSelectError("");
            setProjectSaveError("");
          }}
        >
          Clear form
        </button>
      </div>
    </form>
  );

  const outgoingAddRecordForm = (
    <form className="record-form" onSubmit={saveOutgoing}>
      <label>
        <span>Subject *</span>
        <textarea
          value={outgoingForm.subject}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = raw.slice(0, MAX_OUTGOING_SUBJECT_LENGTH);
            setOutgoingForm({ ...outgoingForm, subject: capped });
            setOutgoingRequiredWarnings((w) => ({ ...w, subject: false }));
            setOutgoingSubjectWarning(raw.length > MAX_OUTGOING_SUBJECT_LENGTH);
          }}
          onBlur={() => setOutgoingSubjectWarning(false)}
          placeholder="Enter the memo subject"
          aria-invalid={outgoingRequiredWarnings.subject || outgoingSubjectWarning}
        />
        <div className="form-field-warning-slot">
          {outgoingRequiredWarnings.subject ? (
            <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
          ) : null}
          {!outgoingRequiredWarnings.subject && outgoingSubjectWarning ? (
            <p className="form-field-warning" role="alert">{`At most ${MAX_OUTGOING_SUBJECT_LENGTH} characters are allowed.`}</p>
          ) : null}
        </div>
      </label>
      <div className="form-row">
        <label>
          <span>Memo Number *</span>
          <input
            type="text"
            autoComplete="off"
            value={outgoingForm.memoNo}
            onChange={(e) => {
              const raw = e.target.value;
              const allowedOnly = raw.replace(OUTGOING_MEMO_NO_ALLOWED, "");
              const capped = allowedOnly.slice(0, MAX_OUTGOING_MEMO_NO_LENGTH);
              setOutgoingForm({ ...outgoingForm, memoNo: capped });
              setOutgoingRequiredWarnings((w) => ({ ...w, memoNo: false }));
              setOutgoingMemoNoWarning({
                invalidChars: OUTGOING_MEMO_NO_DISALLOWED.test(raw),
                maxLength: allowedOnly.length > MAX_OUTGOING_MEMO_NO_LENGTH,
              });
            }}
            onBlur={() => setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false })}
            placeholder="ISSD-YYYY-000"
            aria-invalid={
              outgoingRequiredWarnings.memoNo || outgoingMemoNoWarning.invalidChars || outgoingMemoNoWarning.maxLength
            }
          />
          <div className="form-field-warning-slot">
            {outgoingRequiredWarnings.memoNo ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!outgoingRequiredWarnings.memoNo && (outgoingMemoNoWarning.invalidChars || outgoingMemoNoWarning.maxLength) ? (
              <p className="form-field-warning" role="alert">
                {outgoingMemoNoWarning.invalidChars ? "Only letters, numbers, and hyphens are allowed. " : null}
                {outgoingMemoNoWarning.maxLength ? `At most ${MAX_OUTGOING_MEMO_NO_LENGTH} characters are allowed.` : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Date *</span>
          <input
            type="date"
            title="Choose a date using the calendar"
            value={outgoingForm.date}
            onKeyDown={blockDateFieldDirectEntry}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => {
              setOutgoingForm({ ...outgoingForm, date: e.target.value });
              setOutgoingRequiredWarnings((w) => ({ ...w, date: false }));
            }}
            aria-invalid={outgoingRequiredWarnings.date}
          />
          <div className="form-field-warning-slot">
            {outgoingRequiredWarnings.date ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
          </div>
        </label>
      </div>
      {outgoingDeptPickers}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={outgoingSaving}>
          {outgoingSaving ? "Adding…" : "Add outgoing"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setOutgoingForm(blankOutgoing);
            setOutgoingSaveError("");
            setOutgoingSubjectWarning(false);
            setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false });
            setOutgoingRequiredWarnings(blankOutgoingRequiredWarnings);
            setThruAddVisible(false);
            setThruAddDraft("");
            setThruAddError("");
            setForAddVisible(false);
            setForAddDraft("");
            setForAddError("");
          }}
        >
          Clear form
        </button>
      </div>
      {outgoingSaveError && !outgoingEditModal ? (
        <p className="form-save-error" role="alert">
          {outgoingSaveError}
        </p>
      ) : null}
    </form>
  );

  const paymentAddRecordForm = (
    <form className="record-form" onSubmit={savePayment}>
      <label>
        <span>Title of the Project *</span>
        <input
          type="text"
          autoComplete="off"
          value={paymentForm.title}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = raw.slice(0, MAX_DV_TITLE_LENGTH);
            setPaymentForm({ ...paymentForm, title: capped });
            setPaymentRequiredWarnings((w) => ({ ...w, title: false }));
            setDvTitleWarning(raw.length > MAX_DV_TITLE_LENGTH);
          }}
          onBlur={() => setDvTitleWarning(false)}
          placeholder="Enter project title"
          aria-invalid={paymentRequiredWarnings.title || dvTitleWarning}
        />
        <div className="form-field-warning-slot">
          {paymentRequiredWarnings.title ? (
            <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
          ) : null}
          {!paymentRequiredWarnings.title && dvTitleWarning ? (
            <p className="form-field-warning" role="alert">{`At most ${MAX_DV_TITLE_LENGTH} characters are allowed.`}</p>
          ) : null}
        </div>
      </label>
      <label>
        <span>Name and Address of Claimant *</span>
        <textarea
          value={paymentForm.claimantAddress}
          onChange={(e) => {
            const raw = e.target.value;
            const capped = raw.slice(0, MAX_DV_CLAIMANT_LENGTH);
            setPaymentForm({ ...paymentForm, claimantAddress: capped });
            setPaymentRequiredWarnings((w) => ({ ...w, claimantAddress: false }));
            setDvClaimantWarning(raw.length > MAX_DV_CLAIMANT_LENGTH);
          }}
          onBlur={() => setDvClaimantWarning(false)}
          placeholder="Enter claimant name and address"
          aria-invalid={paymentRequiredWarnings.claimantAddress || dvClaimantWarning}
        />
        <div className="form-field-warning-slot">
          {paymentRequiredWarnings.claimantAddress ? (
            <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
          ) : null}
          {!paymentRequiredWarnings.claimantAddress && dvClaimantWarning ? (
            <p className="form-field-warning" role="alert">{`At most ${MAX_DV_CLAIMANT_LENGTH} characters are allowed.`}</p>
          ) : null}
        </div>
      </label>
      <div className="form-row form-row--money-warnings">
        <label>
          <span>Voucher No. *</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={paymentForm.voucherNo}
            onChange={(e) => {
              const raw = e.target.value;
              const digitsOnly = raw.replace(/\D/g, "");
              const capped = digitsOnly.slice(0, MAX_DV_VOUCHER_LENGTH);
              setPaymentForm({ ...paymentForm, voucherNo: capped });
              setPaymentRequiredWarnings((w) => ({ ...w, voucherNo: false }));
              setDvVoucherWarning({
                nonNumeric: /\D/.test(raw),
                maxLength: digitsOnly.length > MAX_DV_VOUCHER_LENGTH,
              });
            }}
            onBlur={() => setDvVoucherWarning({ nonNumeric: false, maxLength: false })}
            placeholder="Enter voucher number"
            aria-invalid={
              paymentRequiredWarnings.voucherNo || dvVoucherWarning.nonNumeric || dvVoucherWarning.maxLength
            }
          />
          <div className="form-field-warning-slot">
            {paymentRequiredWarnings.voucherNo ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!paymentRequiredWarnings.voucherNo && (dvVoucherWarning.nonNumeric || dvVoucherWarning.maxLength) ? (
              <p className="form-field-warning" role="alert">
                {dvVoucherWarning.nonNumeric ? "Numbers only. " : null}
                {dvVoucherWarning.maxLength ? `At most ${MAX_DV_VOUCHER_LENGTH} digits are allowed.` : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Amount *</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={paymentForm.amount}
            onChange={(e) => {
              const st = projectMoneyParseState(e.target.value);
              setPaymentForm({ ...paymentForm, amount: st.display });
              setPaymentRequiredWarnings((w) => ({ ...w, amount: false }));
              setDvAmountWarning({ invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded });
            }}
            onBlur={() => setDvAmountWarning({ invalidChars: false, maxDigits: false })}
            placeholder="0.00"
            aria-invalid={paymentRequiredWarnings.amount || dvAmountWarning.invalidChars || dvAmountWarning.maxDigits}
          />
          <div className="form-field-warning-slot">
            {paymentRequiredWarnings.amount ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
            {!paymentRequiredWarnings.amount && (dvAmountWarning.invalidChars || dvAmountWarning.maxDigits) ? (
              <p className="form-field-warning" role="alert">
                {dvAmountWarning.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}
                {dvAmountWarning.maxDigits
                  ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.`
                  : null}
              </p>
            ) : null}
          </div>
        </label>
        <label>
          <span>Record date *</span>
          <input
            type="date"
            title="Choose a date using the calendar"
            value={paymentForm.date}
            onKeyDown={blockDateFieldDirectEntry}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onChange={(e) => {
              setPaymentForm({ ...paymentForm, date: e.target.value });
              setPaymentRequiredWarnings((w) => ({ ...w, date: false }));
            }}
            aria-invalid={paymentRequiredWarnings.date}
          />
          <div className="form-field-warning-slot">
            {paymentRequiredWarnings.date ? (
              <p className="form-field-warning" role="alert">{OUTGOING_REQUIRED_MSG}</p>
            ) : null}
          </div>
        </label>
      </div>
      <div className="form-row form-row--triple">
        <label>
          <span>ICTSSD (Department) *</span>
          <select value={paymentForm.ictssd} onChange={(e) => setPaymentForm({ ...paymentForm, ictssd: e.target.value })}>
            {ICTSSD.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <div className="form-field-warning-slot" />
        </label>
        <label>
          <span>GAD (Department) *</span>
          <select value={paymentForm.gad} onChange={(e) => setPaymentForm({ ...paymentForm, gad: e.target.value })}>
            {GAD.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <div className="form-field-warning-slot" />
        </label>
        <label>
          <span>CASH (Department) *</span>
          <select value={paymentForm.cash} onChange={(e) => setPaymentForm({ ...paymentForm, cash: e.target.value })}>
            {CASH.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <div className="form-field-warning-slot" />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button">
          Add DV record
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setPaymentForm(blankPayment);
            setPaymentSaveError("");
            setDvTitleWarning(false);
            setDvClaimantWarning(false);
            setDvVoucherWarning({ nonNumeric: false, maxLength: false });
            setDvAmountWarning({ invalidChars: false, maxDigits: false });
            setPaymentRequiredWarnings(blankPaymentRequiredWarnings);
          }}
        >
          Clear form
        </button>
      </div>
      {paymentSaveError && !paymentEditModal ? (
        <p className="form-save-error" role="alert">
          {paymentSaveError}
        </p>
      ) : null}
    </form>
  );

  const summaryExport = () => exportCsv("monitoring-summary.csv", [
    ["Metric", "Value", "Supporting Text"],
    ["Total Projects", stats.totalProjects, `${stats.pendingProjects} with outstanding balances`],
    ["Total Contract Value", stats.totalContractValue, "Calculated from project monitoring records"],
    ["Total DV Amount", stats.totalVoucherValue, `${stats.totalVouchers} DV records tracked`],
    ["Total Outgoing Documents", stats.totalOutgoing, `${outgoingByThru.length} active Thru departments`],
  ]);
  const runSelectedReportExport = () => ({
    summary: summaryExport,
    project: projectExport,
    dv: paymentExport,
    outgoing: outgoingExport,
  }[reportExport]?.());

  if (!started) {
    return (
      <main className="landing-page">
        <div className="landing-orb landing-orb--left" />
        <div className="landing-orb landing-orb--right" />
        <div className="landing-grid" />

        <section className="landing-card landing-card--expanded">
          <header className="landing-topbar">
            <div className="landing-topbar__brand">
              <img src={LANDING_LOGO_IMAGE} alt="SSS logo" className="landing-topbar__logo" />
              <div>
                <span className="landing-topbar__eyebrow">Social Security System</span>
                <strong>ISSD Monitoring</strong>
              </div>
            </div>

            <nav className="landing-topnav" aria-label="Startup navigation">
              {Object.entries(LANDING_PANELS).map(([key, panel]) => (
                <button key={key} type="button" onClick={() => openLandingPanel(key)}>
                  {panel.label}
                </button>
              ))}
            </nav>

            <div className="landing-profile">
              <span className="landing-profile__icon">◉</span>
              <strong>ISSD</strong>
            </div>
          </header>

          <section className="landing-hero">
            <div className="landing-media">
              <div className="landing-media__stage">
                <div className="landing-media__building-shell">
                  <img
                    src={LANDING_BUILDING_IMAGE}
                    alt="Social Security System building"
                    className="landing-media__photo"
                  />
                </div>
              </div>
            </div>

            <div className="landing-copy landing-copy--hero">
              <h1>Centralized Monitoring for ISSD Operations</h1>

              <button type="button" className="landing-button landing-button--inline" onClick={() => setStarted(true)}>
                Get Started
              </button>
            </div>
          </section>
        </section>

        {landingModal && (
          <div className="modal-backdrop" onClick={() => setLandingModal(null)}>
            <div className="modal-card landing-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-card__header">
                <div>
                  <p className="landing-modal__eyebrow">{landingModal.eyebrow}</p>
                  <h3>{landingModal.title}</h3>
                  {landingModal.description && <p className="landing-modal__description">{landingModal.description}</p>}
                </div>
                <button
                  type="button"
                  className="landing-modal__close"
                  aria-label="Close panel"
                  onClick={() => setLandingModal(null)}
                >
                  X
                </button>
              </div>

              <div className="landing-modal__body">
                {landingModal.copy?.map((item) => <p key={item}>{item}</p>)}
                {landingModal.list && (
                  <ul className="landing-modal__list">
                    {landingModal.list.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {landingModal.items && (
                  <div className="faq-accordion" role="list">
                    {landingModal.items.map((item) => {
                      const expanded = activeFaq === item.id;
                      return (
                        <article key={item.id} className={`faq-item ${expanded ? "is-open" : ""}`} role="listitem">
                          <button
                            type="button"
                            className="faq-item__trigger"
                            aria-expanded={expanded}
                            onClick={() => setActiveFaq(item.id)}
                          >
                            <span>{item.title}</span>
                            <span className="faq-item__icon" aria-hidden="true">
                              <svg viewBox="0 0 20 20">
                                <path d="M5 7.5 10 12.5 15 7.5" />
                              </svg>
                            </span>
                          </button>
                          <div className="faq-item__content">
                            <div className="faq-item__content-inner">
                              <p>{item.description}</p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <div className={`workspace-shell${sidebarNavOpen ? "" : " workspace-shell--sidebar-collapsed"}`}>
      <aside id="workspace-sidebar" className="sidebar">
        <div className="sidebar-header-row">
          <button
            type="button"
            className="icon-button sidebar-menu-toggle"
            aria-label={sidebarNavOpen ? "Collapse Operations Hub navigation" : "Expand Operations Hub navigation"}
            aria-expanded={sidebarNavOpen}
            aria-controls="workspace-sidebar-nav"
            title="Open or close navigation"
            onClick={() => setSidebarNavOpen((v) => !v)}
          >
            <SidebarHamburgerIcon />
          </button>
          <button
            type="button"
            className="icon-button sidebar-theme-toggle"
            tabIndex={sidebarNavOpen ? undefined : -1}
            aria-label={theme === "light" ? "Enable dark mode" : "Enable light mode"}
            title={theme === "light" ? "Enable dark mode" : "Enable light mode"}
            onClick={() => {
              document.documentElement.classList.add("no-transitions");
              setTheme((x) => (x === "light" ? "dark" : "light"));
              requestAnimationFrame(() => requestAnimationFrame(() => {
                document.documentElement.classList.remove("no-transitions");
              }));
            }}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
        <div className="sidebar-body" inert={!sidebarNavOpen ? true : undefined}>
          <div className="brand-block">
            <button type="button" className="brand-mark-button" aria-label="Return to landing page" onClick={() => setStarted(false)}><img src={SIDEBAR_LOGO_IMAGE} alt="SSS logo" className="brand-mark" /></button>
            <div>
              <p className="brand-eyebrow">ISSD Monitoring</p>
              <h1>Operations Hub</h1>
            </div>
          </div>
          <nav id="workspace-sidebar-nav" className="sidebar-nav" aria-label="Operations Hub views">
            {NAV.map((item) => (
              <button key={item.id} type="button" className={`nav-button ${view === item.id ? "is-active" : ""}`} onClick={() => setView(item.id)}>
                <span className="nav-button__icon" aria-hidden="true"><SidebarNavIcon name={item.icon} /></span>
                <span className="nav-button__label">{item.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="sidebar-return" onClick={() => setStarted(false)}>Return to landing page</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__titles">
            <p className="topbar__eyebrow">Monitoring System</p>
            <h2>{currentViewMeta.title}</h2>
          </div>
        </header>

        {view === "projects" && (
        <section className="page tool-page">
          <div className="tool-layout">
            {(projectLoadError || projectSaveError) && (
              <div
                role="alert"
                style={{
                  marginBottom: "1rem",
                  padding: "0.65rem 0.9rem",
                  borderRadius: 8,
                  background: "rgba(180, 40, 40, 0.12)",
                  fontSize: "0.9rem",
                }}
              >
                {projectLoadError ? <div>{projectLoadError}</div> : null}
                {projectSaveError ? <div>{projectSaveError}</div> : null}
              </div>
            )}
            <section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total of contracts" value={number.format(projects.length)} /><MetricChip label="Total of contract value" value={peso.format(stats.totalContractValue)} /><MetricChip label="Total of outstanding" value={peso.format(stats.totalOutstandingValue)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">Project Monitoring Tool</p><h3>Add new project</h3></div></div>{projectAddRecordForm}</section><section className="panel table-panel">{toolbar("Project records", "Search, filter, and export contract monitoring data.", projectSearch, setProjectSearch, projectFilter, setProjectFilter, goodsFilterOptions, "Goods", projectExport)}<div className="table-wrap table-wrap--projects"><table><thead><tr><th>Name of Contract</th><th>Start Date</th><th>End Date</th><th>Duration</th><th>Kind of Goods</th><th>Amount of Contract</th><th>Outstanding Value</th><th>Actions</th></tr></thead><tbody>{projectsLoading ? <tr><td colSpan={8}>Loading projects…</td></tr> : pageSlice(projectRows, safeProjectPage).map((x) => <tr key={x.id}><td>{x.contractName}</td><td>{fmtDate(x.date)}</td><td>{formatProjectEndDateLabel(x.date, x.duration)}</td><td>{x.duration}</td><td>{x.goods}</td><td>{peso.format(x.amount)}</td><td>{peso.format(x.outstanding)}</td><td><ActionSet onView={() => open("Project", x.contractName, [["Start Date", fmtDate(x.date)], ["End Date", formatProjectEndDateLabel(x.date, x.duration)], ["Duration", x.duration], ["Kind of Goods", x.goods], ["Amount of Contract", peso.format(x.amount)], ["Outstanding Value", peso.format(x.outstanding)]])} onEdit={() => { setProjectEdit(x.id); const cn = String(x.contractName ?? ""); setEditMoneyWarnings({ ...blankProjectMoneyWarnings, contractName: { maxLength: false } }); setGoodsAddVisible(false); setGoodsAddDraft(""); setGoodsAddError(""); setGoodsRenameVisible(false); setGoodsRenameDraft(""); setGoodsRenameError(""); setGoodsSelectError(""); setEditForm({ contractName: cn.slice(0, MAX_PROJECT_CONTRACT_NAME_LENGTH), date: x.date, duration: String(x.duration ?? "").slice(0, MAX_PROJECT_DURATION_LENGTH), goods: x.goods, amount: projectMoneyFromNumber(x.amount), outstanding: projectMoneyFromNumber(x.outstanding) }); setEditModal(true); }} onDelete={() => void deleteProjectRow(x.id, x.contractName)} /></td></tr>)}</tbody></table></div>{pager(safeProjectPage, projectPages, projectRows.length, setProjectPage)}</section></div></section>)}
        {view === "payments" && <section className="page tool-page"><div className="tool-layout">{(paymentLoadError || (paymentSaveError && !paymentEditModal)) && <div role="alert" style={{background:"#fee2e2",color:"#991b1b",padding:"14px 18px",borderRadius:"14px",fontSize:".93rem"}}>{paymentLoadError || paymentSaveError}</div>}<section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total DV" value={number.format(payments.length)} /><MetricChip label="Total amount" value={peso.format(stats.totalVoucherValue)} /><MetricChip label="Status alerts" value={number.format(stats.pendingPayments)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">DV Payment Monitoring Tool</p><h3>Add new DV record</h3></div></div>{paymentAddRecordForm}</section><section className="panel table-panel">{toolbar("DV payment records", "Track voucher workflow progress with clear department status indicators.", paymentSearch, setPaymentSearch, paymentFilter, setPaymentFilter, PAYMENT_FILTERS, "Status", paymentExport)}<div className="table-wrap table-wrap--payments"><table><thead><tr><th>Title of the Project</th><th>Name and Address of Claimant</th><th>Voucher No.</th><th>Date</th><th>Amount</th><th>ICTSSD</th><th>GAD</th><th>CASH</th><th>Actions</th></tr></thead><tbody>{paymentsLoading ? <tr><td colSpan={9}>Loading DV payments…</td></tr> : pageSlice(paymentRows, safePaymentPage).map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.claimantAddress}</td><td>{x.voucherNo}</td><td>{fmtDate(x.date)}</td><td>{peso.format(x.amount)}</td><td><StatusBadge label={x.ictssd} /></td><td><StatusBadge label={x.gad} /></td><td><StatusBadge label={x.cash} /></td><td><ActionSet onView={() => open("DV Payment", x.voucherNo, [["Title of the Project", x.title], ["Name and Address of Claimant", x.claimantAddress], ["Voucher No.", x.voucherNo], ["Date", fmtDate(x.date)], ["Amount", peso.format(x.amount)], ["ICTSSD", x.ictssd], ["GAD", x.gad], ["CASH", x.cash]])} onEdit={() => { setPaymentEdit(x.id); setPaymentEditForm({ title: x.title, claimantAddress: x.claimantAddress, voucherNo: x.voucherNo, amount: projectMoneyFromNumber(x.amount), date: x.date || "", ictssd: x.ictssd, gad: x.gad, cash: x.cash }); setPaymentSaveError(""); setDvTitleWarning(false); setDvClaimantWarning(false); setDvVoucherWarning({ nonNumeric: false, maxLength: false }); setDvAmountWarning({ invalidChars: false, maxDigits: false }); setPaymentEditModal(true); }} onDelete={async () => { await new Promise((resolve) => setConfirmModal({ title: x.voucherNo, onConfirm: resolve })); setConfirmModal(null); try { const res = await fetch(`/api/dv-payments/${x.id}`, { method: "DELETE" }); if (!res.ok && res.status !== 204) { const t = await res.text(); setPaymentSaveError(t || "Delete failed"); return; } setPayments((cur) => cur.filter((item) => item.id !== x.id)); } catch (err) { setPaymentSaveError(err instanceof Error ? err.message : String(err)); } }} /></td></tr>)}</tbody></table></div>{pager(safePaymentPage, paymentPages, paymentRows.length, setPaymentPage)}</section></div></section>}

        {view === "policies" && (
          <PolicyMonitoringView
            setModal={setModal}
            setConfirmModal={setConfirmModal}
            showRequiredFieldsAlert={showRequiredFieldsAlert}
          />
        )}

        {view === "outgoing" && <section className="page tool-page"><div className="tool-layout">{outgoingLoadError && <div role="alert" style={{background:"#fee2e2",color:"#991b1b",padding:"14px 18px",borderRadius:"14px",fontSize:".93rem"}}>{outgoingLoadError}</div>}<section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total outgoing" value={number.format(outgoing.length)} /><MetricChip label="Top route" value={outgoingBars[0]?.label || "None"} /><MetricChip label="Departments hit" value={number.format(outgoingBars.length)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">ISSD Outgoing Monitoring Tool</p><h3>Add outgoing record</h3></div></div>{outgoingAddRecordForm}</section><section className="panel table-panel">{toolbar("Outgoing records", "Monitor subject routing and department distribution.", outgoingSearch, setOutgoingSearch, outgoingFilter, setOutgoingFilter, forDeptFilterOptions, "For", outgoingExport)}<div className="table-wrap table-wrap--outgoing"><table><thead><tr><th>Subject</th><th>Memo Number</th><th>Date</th><th>Thru</th><th>For</th><th>Actions</th></tr></thead><tbody>{outgoingLoading ? <tr><td colSpan={6}>Loading outgoing records…</td></tr> : pageSlice(outgoingRows, safeOutgoingPage).map((x) => <tr key={x.id}><td title={x.subject}>{x.subject}</td><td>{x.memoNo}</td><td>{fmtDate(x.date)}</td><td>{x.thru}</td><td>{x.forDept}</td><td><ActionSet onView={() => open("Outgoing", x.memoNo, [["Subject", x.subject], ["Date", fmtDate(x.date)], ["Thru", x.thru], ["For", x.forDept]])} onEdit={() => { setOutgoingEdit(x.id); setOutgoingEditForm({ subject: x.subject, memoNo: x.memoNo, date: x.date || "", thru: x.thru, forDept: x.forDept }); setOutgoingSaveError(""); setOutgoingSubjectWarning(false); setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false }); setThruAddVisible(false); setThruAddDraft(""); setThruAddError(""); setForAddVisible(false); setForAddDraft(""); setForAddError(""); setOutgoingEditModal(true); }} onDelete={() => void deleteOutgoingRow(x.id, x.memoNo)} /></td></tr>)}</tbody></table></div>{pager(safeOutgoingPage, outgoingPages, outgoingRows.length, setOutgoingPage)}</section></div></section>}

        {view === "reports" && (
          <section className="page reports-page">
            <div className="reports-toolbar">
              <div>
                <p className="panel__kicker">Executive Dashboard</p>
                <h3>Whole-system monitoring analytics</h3>
                <p className="panel__description">Dynamic insights from Project Monitoring, DV Payment Monitoring, and ISSD Outgoing Monitoring records.</p>
              </div>
              <div className="reports-toolbar__actions reports-export-picker">
                <label>
                  <span>Export report</span>
                  <select value={reportExport} onChange={(e) => setReportExport(e.target.value)}>
                    <option value="summary">Summary Report</option>
                    <option value="project">Project Report</option>
                    <option value="dv">DV Report</option>
                    <option value="outgoing">Outgoing Report</option>
                  </select>
                </label>
                <button type="button" className="primary-button" onClick={runSelectedReportExport}>Export</button>
              </div>
            </div>

            <div className="analytics-summary-grid">
              <AnalyticsSummaryCard label="Total Projects" value={number.format(stats.totalProjects)} detail={`${stats.pendingProjects} projects still have outstanding balances`} icon="projects" delay={0} />
              <AnalyticsSummaryCard label="Total Contract Value" value={peso.format(stats.totalContractValue)} detail="Calculated from all monitored project contract amounts" icon="value" delay={1} />
              <AnalyticsSummaryCard label="Total DV Amount" value={peso.format(stats.totalVoucherValue)} detail={`${number.format(stats.totalVouchers)} DV records are currently tracked`} icon="dv" delay={2} />
              <AnalyticsSummaryCard label="Total Outgoing Documents" value={number.format(stats.totalOutgoing)} detail={`${number.format(outgoingByThru.length)} departments appear in Thru routing`} icon="outgoing" delay={3} />
            </div>

            <div className="reports-layout">
              <section className="panel analytics-panel">
                <div className="panel__header">
                  <div>
                    <p className="panel__kicker">Project Monitoring Analytics</p>
                    <h3>Project value and outstanding balance view</h3>
                  </div>
                </div>
                <div className="analytics-two-column">
                  <BarAnalyticsCard title="Contract Value per Project" subtitle="Compares total contract amount across monitored projects">
                    <HorizontalBarChart data={projectValueSeries} formatter={(value) => peso.format(value)} tone="brand" />
                  </BarAnalyticsCard>
                  <LineAnalyticsCard title="Outstanding Value per Project" subtitle="Highlights remaining balances still open per project">
                    <LineTrendChart data={projectOutstandingSeries} formatter={(value) => peso.format(value)} />
                  </LineAnalyticsCard>
                </div>
                <div className="analytics-foot-grid">
                  <ProgressAnalyticsCard label="Outstanding Balance Ratio" value={`${number.format(outstandingPercent)}%`} detail={`${peso.format(stats.totalOutstandingValue)} outstanding out of ${peso.format(stats.totalContractValue)}`} progress={outstandingPercent} />
                  <InsightListCard title="Project Highlights" items={[
                    `${number.format(stats.totalProjects)} total projects are currently monitored.`,
                    `${number.format(stats.pendingProjects)} projects still carry outstanding balances.`,
                    `Highest contract value is ${projects[0] ? peso.format(Math.max(...projects.map((item) => item.amount))) : peso.format(0)}.`,
                  ]} />
                </div>
              </section>

              <section className="panel analytics-panel">
                <div className="panel__header">
                  <div>
                    <p className="panel__kicker">DV Payment Monitoring Analytics</p>
                    <h3>Department status distribution</h3>
                  </div>
                </div>
                <div className="analytics-three-column">
                  <DonutAnalyticsCard title="ICTSSD Statuses" data={dvStatusCharts.ictssd} />
                  <DonutAnalyticsCard title="GAD Statuses" data={dvStatusCharts.gad} />
                  <DonutAnalyticsCard title="CASH Statuses" data={dvStatusCharts.cash} />
                </div>
                <div className="status-summary-grid">
                  {dvStatusSummary.map((item, index) => <AnalyticsCountPill key={item.label} label={item.label} value={number.format(item.value)} delay={index} />)}
                </div>
              </section>

              <div className="reports-split">
                <section className="panel analytics-panel">
                  <div className="panel__header">
                    <div>
                      <p className="panel__kicker">Outgoing Document Analytics</p>
                      <h3>Routing volume by department</h3>
                    </div>
                  </div>
                  <div className="analytics-two-column">
                    <BarAnalyticsCard title="Outgoing by Thru Department" subtitle="Number of records routed through each department">
                      <HorizontalBarChart data={outgoingByThru} formatter={(value) => number.format(value)} tone="accent" />
                    </BarAnalyticsCard>
                    <BarAnalyticsCard title="Outgoing by For Department" subtitle="Receiving department volume across monitored outgoing records">
                      <HorizontalBarChart data={outgoingByFor} formatter={(value) => number.format(value)} tone="brand-soft" />
                    </BarAnalyticsCard>
                  </div>
                </section>

                <section className="panel analytics-panel">
                  <div className="panel__header">
                    <div>
                      <p className="panel__kicker">Recent Outgoing Records</p>
                      <h3>Latest routing preview</h3>
                    </div>
                  </div>
                  <AnalyticsTable
                    columns={["Subject", "Memo No.", "Date", "Thru", "For"]}
                    rows={recentOutgoingPreview.map((item) => [item.subject, item.memoNo, fmtDate(item.date), item.thru, item.forDept])}
                  />
                </section>
              </div>

              <section className="panel analytics-panel">
                <div className="panel__header">
                  <div>
                    <p className="panel__kicker">Recent Activity</p>
                    <h3>Latest records across all monitoring tools</h3>
                  </div>
                </div>
                <AnalyticsTable
                  columns={["Record Type", "Title / Subject", "Date", "Status / Department", "Amount"]}
                  rows={recentActivityRows.map((item) => [
                    item.recordType,
                    item.title,
                    fmtDate(item.date),
                    item.status,
                    item.amount == null ? "-" : peso.format(item.amount),
                  ])}
                />
              </section>
            </div>
          </section>
        )}

      </main>

      {editModal && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-card workspace-modal workspace-modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal__header">
              <div>
                <p className="workspace-modal__eyebrow">Project Monitoring Tool</p>
                <h3>Edit project record</h3>
              </div>
              <button type="button" className="workspace-modal__close" aria-label="Cancel edit" onClick={closeEditModal}><CloseIcon /></button>
            </div>
            <form className="record-form" onSubmit={saveProject}>
              <label><span>Name of Contract</span><input type="text" autoComplete="off" value={editForm.contractName} onChange={(e) => { const raw = e.target.value; const maxLen = MAX_PROJECT_CONTRACT_NAME_LENGTH; const capped = raw.slice(0, maxLen); setEditForm({ ...editForm, contractName: capped }); setEditMoneyWarnings((w) => ({ ...w, contractName: { maxLength: raw.length > maxLen } })); }} onBlur={() => { setEditMoneyWarnings((w) => ({ ...w, contractName: { maxLength: false } })); }} placeholder="Enter contract title" aria-invalid={editMoneyWarnings.contractName.maxLength} /><div className="form-field-warning-slot">{editMoneyWarnings.contractName.maxLength ? (<p className="form-field-warning" role="alert">{`At most ${MAX_PROJECT_CONTRACT_NAME_LENGTH} characters are allowed.`}</p>) : null}</div></label>
              <div className="form-row form-row--project-start-duration"><label><span>Start Date</span><input type="date" title="Choose a date using the calendar" value={editForm.date} onKeyDown={blockDateFieldDirectEntry} onPaste={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /><div className="form-field-warning-slot" /></label><label><span>Duration</span><input type="text" autoComplete="off" value={editForm.duration} onChange={(e) => { const raw = e.target.value; const maxLen = MAX_PROJECT_DURATION_LENGTH; const capped = raw.slice(0, maxLen); setEditForm({ ...editForm, duration: capped }); setEditMoneyWarnings((w) => ({ ...w, duration: { maxLength: raw.length > maxLen } })); }} onBlur={() => { setEditMoneyWarnings((w) => ({ ...w, duration: { maxLength: false } })); }} placeholder="e.g. 120 days, 12 weeks, 6 months, 1 year" aria-invalid={editMoneyWarnings.duration.maxLength} /><div className="form-field-warning-slot">{editMoneyWarnings.duration.maxLength ? (<p className="form-field-warning" role="alert">{`At most ${MAX_PROJECT_DURATION_LENGTH} characters are allowed.`}</p>) : null}</div></label></div>
              <label><span>End Date</span><input type="text" readOnly tabIndex={-1} className="form-field-computed" value={editEndDateYmd ? fmtDate(editEndDateYmd) : ""} placeholder="Set start date and duration" title="Computed from start date plus duration. Use days, weeks, months, or years (e.g. 90 days, 8 wks, 3 mo, 2 years). A plain number defaults to days." /><div className="form-field-warning-slot" /></label>
              <div className="form-label-with-action"><div className="form-label-with-action__row"><label className="form-label-with-action__text" htmlFor="edit-goods-select"><span>Kind of Goods</span></label>{goodsAddVisible ? (<button type="button" className="goods-cancel-btn" aria-label="Cancel" onClick={() => { setGoodsAddVisible(false); setGoodsAddDraft(""); setGoodsAddError(""); }}><span className="goods-btn__icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></span><span className="goods-btn__label">Cancel</span></button>) : (<button type="button" className="goods-add-btn" aria-label="Add goods" onClick={() => { setGoodsAddError(""); setGoodsAddDraft(""); setGoodsAddVisible(true); }}><span className="goods-btn__icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg></span><span className="goods-btn__label">Add Goods</span></button>)}</div>{goodsAddVisible ? (<div className="form-inline-add-goods"><input type="text" value={goodsAddDraft} onChange={(e) => { setGoodsAddDraft(e.target.value); setGoodsAddError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGoodsCommit(); } }} placeholder="e.g. Vehicles" aria-label="New kind of goods" /><button type="button" className="ghost-button ghost-button--compact" onClick={addGoodsCommit}>Add</button></div>) : null}{goodsAddError ? (<p className="form-field-warning form-field-warning--tight" role="alert">{goodsAddError}</p>) : null}{(goodsRenameVisible || goodsAddVisible) ? (<select id="edit-goods-select" className="form-goods-select form-goods-select--visual-hide" value={editForm.goods} onChange={(e) => { setEditForm({ ...editForm, goods: e.target.value }); setGoodsRenameError(""); setGoodsSelectError(""); }} tabIndex={-1} aria-label="Current kind of goods">{goodsOptions.map((g) => <option key={g}>{g}</option>)}</select>) : (<div className="form-goods-select-row"><select id="edit-goods-select" className="form-goods-select" value={editForm.goods} onChange={(e) => { setEditForm({ ...editForm, goods: e.target.value }); setGoodsRenameError(""); setGoodsSelectError(""); }}>{goodsOptions.map((g) => <option key={g}>{g}</option>)}</select><button type="button" className="form-goods-select__icon-btn" aria-label="Rename kind of goods" title="Renames this kind and updates every project that uses it in the database" onClick={() => { setGoodsSelectError(""); setGoodsRenameError(""); setGoodsRenameDraft(editForm.goods); setGoodsRenameVisible(true); }}><GoodsEditIcon /></button><button type="button" className="form-goods-select__icon-btn form-goods-select__icon-btn--danger" aria-label="Remove or hide kind from list" title="Hides a built-in kind from the list, or removes a kind you added with Add Goods." disabled={!BASE_GOODS.includes(editForm.goods) && !extraGoods.some((x) => x === editForm.goods)} onClick={() => void deleteGoodsKind()}><GoodsTrashIcon /></button></div>)}{goodsRenameVisible ? (<div className="form-inline-add-goods form-inline-add-goods--rename"><input type="text" value={goodsRenameDraft} onChange={(e) => { setGoodsRenameDraft(e.target.value); setGoodsRenameError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void renameGoodsCommit(); } }} placeholder="New name" aria-label="Rename kind of goods" /><button type="button" className="ghost-button ghost-button--compact" onClick={() => void renameGoodsCommit()}>Save</button><button type="button" className="ghost-button ghost-button--compact" onClick={() => { setGoodsRenameVisible(false); setGoodsRenameError(""); }}>Cancel</button></div>) : null}{(goodsRenameError || goodsSelectError) ? (<p className="form-field-warning form-field-warning--tight" role="alert">{goodsRenameError || goodsSelectError}</p>) : null}</div>
              <div className="form-row form-row--money-warnings"><label><span>Amount of Contract</span><input type="text" inputMode="decimal" autoComplete="off" value={editForm.amount} onChange={(e) => { const st = projectMoneyParseState(e.target.value); setEditForm({ ...editForm, amount: st.display }); setEditMoneyWarnings((w) => ({ ...w, amount: { invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded } })); }} placeholder="0.00" aria-invalid={editMoneyWarnings.amount.invalidChars || editMoneyWarnings.amount.maxDigits} /><div className="form-field-warning-slot">{(editMoneyWarnings.amount.invalidChars || editMoneyWarnings.amount.maxDigits) ? (<p className="form-field-warning" role="alert">{editMoneyWarnings.amount.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}{editMoneyWarnings.amount.maxDigits ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.` : null}</p>) : null}</div></label><label><span>Outstanding Value</span><input type="text" inputMode="decimal" autoComplete="off" value={editForm.outstanding} onChange={(e) => { const st = projectMoneyParseState(e.target.value); setEditForm({ ...editForm, outstanding: st.display }); setEditMoneyWarnings((w) => ({ ...w, outstanding: { invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded } })); }} placeholder="0.00" aria-invalid={editMoneyWarnings.outstanding.invalidChars || editMoneyWarnings.outstanding.maxDigits} /><div className="form-field-warning-slot">{(editMoneyWarnings.outstanding.invalidChars || editMoneyWarnings.outstanding.maxDigits) ? (<p className="form-field-warning" role="alert">{editMoneyWarnings.outstanding.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}{editMoneyWarnings.outstanding.maxDigits ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.` : null}</p>) : null}</div></label></div>
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={projectSaving}>{projectSaving ? "Saving…" : "Save changes"}</button>
                <button type="button" className="ghost-button" onClick={closeEditModal}>Cancel</button>
              </div>
              {projectSaveError ? <p className="form-save-error" role="alert">{projectSaveError}</p> : null}
            </form>
          </div>
        </div>
      )}
      {paymentEditModal && (
        <div className="modal-backdrop" onClick={closePaymentEditModal}>
          <div className="modal-card workspace-modal workspace-modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal__header">
              <div>
                <p className="workspace-modal__eyebrow">DV Payment Monitoring Tool</p>
                <h3>Edit DV record</h3>
              </div>
              <button type="button" className="workspace-modal__close" aria-label="Cancel edit" onClick={closePaymentEditModal}><CloseIcon /></button>
            </div>
            <form className="record-form" onSubmit={savePaymentEdit}>
              <label>
                <span>Title of the Project *</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={paymentEditForm.title}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const capped = raw.slice(0, MAX_DV_TITLE_LENGTH);
                    setPaymentEditForm({ ...paymentEditForm, title: capped });
                    setDvTitleWarning(raw.length > MAX_DV_TITLE_LENGTH);
                  }}
                  onBlur={() => setDvTitleWarning(false)}
                  placeholder="Enter project title"
                  aria-invalid={dvTitleWarning}
                />
                <div className="form-field-warning-slot">{dvTitleWarning ? <p className="form-field-warning" role="alert">{`At most ${MAX_DV_TITLE_LENGTH} characters are allowed.`}</p> : null}</div>
              </label>
              <label>
                <span>Name and Address of Claimant</span>
                <textarea
                  value={paymentEditForm.claimantAddress}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const capped = raw.slice(0, MAX_DV_CLAIMANT_LENGTH);
                    setPaymentEditForm({ ...paymentEditForm, claimantAddress: capped });
                    setDvClaimantWarning(raw.length > MAX_DV_CLAIMANT_LENGTH);
                  }}
                  onBlur={() => setDvClaimantWarning(false)}
                  placeholder="Enter claimant name and address"
                  aria-invalid={dvClaimantWarning}
                />
                <div className="form-field-warning-slot">{dvClaimantWarning ? <p className="form-field-warning" role="alert">{`At most ${MAX_DV_CLAIMANT_LENGTH} characters are allowed.`}</p> : null}</div>
              </label>
              <div className="form-row">
                <label>
                  <span>Voucher No.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={paymentEditForm.voucherNo}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const digitsOnly = raw.replace(/\D/g, "");
                      const capped = digitsOnly.slice(0, MAX_DV_VOUCHER_LENGTH);
                      setPaymentEditForm({ ...paymentEditForm, voucherNo: capped });
                      setDvVoucherWarning({ nonNumeric: /\D/.test(raw), maxLength: digitsOnly.length > MAX_DV_VOUCHER_LENGTH });
                    }}
                    onBlur={() => setDvVoucherWarning({ nonNumeric: false, maxLength: false })}
                    placeholder="Enter voucher number"
                    aria-invalid={dvVoucherWarning.nonNumeric || dvVoucherWarning.maxLength}
                  />
                  <div className="form-field-warning-slot">{(dvVoucherWarning.nonNumeric || dvVoucherWarning.maxLength) ? <p className="form-field-warning" role="alert">{dvVoucherWarning.nonNumeric ? "Numbers only. " : null}{dvVoucherWarning.maxLength ? `At most ${MAX_DV_VOUCHER_LENGTH} digits are allowed.` : null}</p> : null}</div>
                </label>
                <label>
                  <span>Amount</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={paymentEditForm.amount}
                    onChange={(e) => {
                      const st = projectMoneyParseState(e.target.value);
                      setPaymentEditForm({ ...paymentEditForm, amount: st.display });
                      setDvAmountWarning({ invalidChars: st.hadInvalidChars, maxDigits: st.digitLimitExceeded });
                    }}
                    onBlur={() => setDvAmountWarning({ invalidChars: false, maxDigits: false })}
                    placeholder="0.00"
                    aria-invalid={dvAmountWarning.invalidChars || dvAmountWarning.maxDigits}
                  />
                  <div className="form-field-warning-slot">{(dvAmountWarning.invalidChars || dvAmountWarning.maxDigits) ? <p className="form-field-warning" role="alert">{dvAmountWarning.invalidChars ? "Only numbers, commas, and periods are allowed. " : null}{dvAmountWarning.maxDigits ? `At most ${MAX_PROJECT_MONEY_INT_DIGITS} integer digits and ${MAX_PROJECT_MONEY_FRAC_DIGITS} decimal places are allowed.` : null}</p> : null}</div>
                </label>
                <label>
                  <span>Record date</span>
                  <input
                    type="date"
                    title="Choose a date using the calendar"
                    value={paymentEditForm.date}
                    onKeyDown={blockDateFieldDirectEntry}
                    onPaste={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onChange={(e) => setPaymentEditForm({ ...paymentEditForm, date: e.target.value })}
                  />
                  <div className="form-field-warning-slot" />
                </label>
              </div>
              <div className="form-row form-row--triple">
                <label>
                  <span>ICTSSD (Department)</span>
                  <select value={paymentEditForm.ictssd} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, ictssd: e.target.value })}>{ICTSSD.map((o) => <option key={o}>{o}</option>)}</select>
                  <div className="form-field-warning-slot" />
                </label>
                <label>
                  <span>GAD (Department)</span>
                  <select value={paymentEditForm.gad} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, gad: e.target.value })}>{GAD.map((o) => <option key={o}>{o}</option>)}</select>
                  <div className="form-field-warning-slot" />
                </label>
                <label>
                  <span>CASH (Department)</span>
                  <select value={paymentEditForm.cash} onChange={(e) => setPaymentEditForm({ ...paymentEditForm, cash: e.target.value })}>{CASH.map((o) => <option key={o}>{o}</option>)}</select>
                  <div className="form-field-warning-slot" />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={paymentSaving}>{paymentSaving ? "Saving…" : "Save changes"}</button>
                <button type="button" className="ghost-button" onClick={closePaymentEditModal}>Cancel</button>
              </div>
              {paymentSaveError ? <p className="form-save-error" role="alert">{paymentSaveError}</p> : null}
            </form>
          </div>
        </div>
      )}

      {outgoingEditModal && (
        <div className="modal-backdrop" onClick={closeOutgoingEditModal}>
          <div className="modal-card workspace-modal workspace-modal--edit" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal__header">
              <div>
                <p className="workspace-modal__eyebrow">ISSD Outgoing Monitoring Tool</p>
                <h3>Edit outgoing record</h3>
              </div>
              <button type="button" className="workspace-modal__close" aria-label="Cancel edit" onClick={closeOutgoingEditModal}><CloseIcon /></button>
            </div>
            <form className="record-form" onSubmit={saveOutgoingEdit}>
              <label><span>Subject</span><textarea value={outgoingEditForm.subject} onChange={(e) => { const raw = e.target.value; const capped = raw.slice(0, MAX_OUTGOING_SUBJECT_LENGTH); setOutgoingEditForm({ ...outgoingEditForm, subject: capped }); setOutgoingSubjectWarning(raw.length > MAX_OUTGOING_SUBJECT_LENGTH); }} onBlur={() => setOutgoingSubjectWarning(false)} placeholder="Enter the memo subject" aria-invalid={outgoingSubjectWarning} /><div className="form-field-warning-slot">{outgoingSubjectWarning ? <p className="form-field-warning" role="alert">{`At most ${MAX_OUTGOING_SUBJECT_LENGTH} characters are allowed.`}</p> : null}</div></label>
              <div className="form-row">
                <label><span>Memo Number</span><input type="text" autoComplete="off" value={outgoingEditForm.memoNo} onChange={(e) => { const raw = e.target.value; const allowedOnly = raw.replace(OUTGOING_MEMO_NO_ALLOWED, ""); const capped = allowedOnly.slice(0, MAX_OUTGOING_MEMO_NO_LENGTH); setOutgoingEditForm({ ...outgoingEditForm, memoNo: capped }); setOutgoingMemoNoWarning({ invalidChars: OUTGOING_MEMO_NO_DISALLOWED.test(raw), maxLength: allowedOnly.length > MAX_OUTGOING_MEMO_NO_LENGTH }); }} onBlur={() => setOutgoingMemoNoWarning({ invalidChars: false, maxLength: false })} placeholder="ISSD-YYYY-000" aria-invalid={outgoingMemoNoWarning.invalidChars || outgoingMemoNoWarning.maxLength} /><div className="form-field-warning-slot">{(outgoingMemoNoWarning.invalidChars || outgoingMemoNoWarning.maxLength) ? <p className="form-field-warning" role="alert">{outgoingMemoNoWarning.invalidChars ? "Only letters, numbers, and hyphens are allowed. " : null}{outgoingMemoNoWarning.maxLength ? `At most ${MAX_OUTGOING_MEMO_NO_LENGTH} characters are allowed.` : null}</p> : null}</div></label>
                <label><span>Date</span><input type="date" title="Choose a date using the calendar" value={outgoingEditForm.date} onKeyDown={blockDateFieldDirectEntry} onPaste={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onChange={(e) => setOutgoingEditForm({ ...outgoingEditForm, date: e.target.value })} /></label>
              </div>
              {outgoingEditDeptPickers}
              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={outgoingSaving}>{outgoingSaving ? "Saving…" : "Save changes"}</button>
                <button type="button" className="ghost-button" onClick={closeOutgoingEditModal}>Cancel</button>
              </div>
              {outgoingSaveError ? <p className="form-save-error" role="alert">{outgoingSaveError}</p> : null}
            </form>
          </div>
        </div>
      )}
      {requiredFieldsAlert ? (
        <RequiredFieldsAlertModal message={requiredFieldsAlert} onClose={() => setRequiredFieldsAlert(null)} />
      ) : null}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal-card workspace-modal workspace-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal__header">
              <div>
                <p className="workspace-modal__eyebrow">Confirm Delete</p>
                <h3>{confirmModal.title}</h3>
              </div>
              <button type="button" className="workspace-modal__close" aria-label="Cancel" onClick={() => setConfirmModal(null)}><CloseIcon /></button>
            </div>
            <div className="workspace-modal--confirm__body">
              <p>Are you sure you want to delete this record? This action cannot be undone.</p>
              <div className="workspace-modal--confirm__actions">
                <button type="button" className="ghost-button" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button type="button" className="table-button table-button--danger" onClick={() => confirmModal.onConfirm()}>Delete record</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className={`modal-card workspace-modal ${modal.type === "Project" ? "workspace-modal--project" : ""}${modal.type === "Outgoing" ? " workspace-modal--outgoing" : ""}${modal.type === "DV Payment" ? " workspace-modal--dv-payment" : ""}${modal.type === "Policy" ? " workspace-modal--policy" : ""}`} onClick={(e) => e.stopPropagation()}><div className="workspace-modal__header"><div><p className="workspace-modal__eyebrow">{modal.type.toUpperCase()} DETAILS</p><h3>{modal.title}</h3></div><button type="button" className="workspace-modal__close" aria-label="Close details" onClick={() => setModal(null)}><CloseIcon /></button></div><div className="workspace-modal__body">{modal.type === "Project" ? <div className="project-detail-grid">{buildProjectDetailFields(modal).map((field) => <article key={field.label} className="project-detail-field"><span className="project-detail-label">{field.label}</span><strong className={`project-detail-value ${field.tone === "amount" ? "project-detail-value--amount" : ""} ${field.tone === "danger" ? "project-detail-value--danger" : ""}`}>{field.value}</strong></article>)}</div> : buildDetailSections(modal).map((section) => <section key={section.key || section.title || section.fields[0]?.label} className={`detail-section${section.compact ? " detail-section--compact" : ""}`}>{section.title && !section.hideTitle ? <div className="detail-section__header"><p className="detail-section__title">{section.title}</p></div> : null}<div className={`detail-grid detail-grid--${section.columns}${section.columns === 1 ? " detail-grid--field-wide" : ""}`}>{section.fields.map((field) => <article key={field.label} className={`detail-item detail-item--${field.tone}`}><div className="detail-item__header"><span className="detail-item__icon"><DetailFieldIcon name={field.icon} /></span><span className="detail-item__label">{field.label}</span></div><strong className="detail-item__value">{field.value}</strong></article>)}</div></section>)}</div></div></div>}
    </div>
  );
}

function MetricChip({ label, value }) {
  const valueText = value == null ? "" : String(value);
  return (
    <article className="metric-chip">
      <span>{label}</span>
      <strong title={valueText}>{value}</strong>
    </article>
  );
}
function StatusBadge({ label }) { return <span className={`status-badge ${statusTone(label)}`}>{label}</span>; }
function ActionSet({ onView, onEdit, onDelete }) {
  return (
    <div className="action-set">
      <button type="button" className="table-button table-button--view" onClick={onView} aria-label="View">
        <span className="table-button__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
        <span className="table-button__label">View</span>
      </button>
      <button type="button" className="table-button table-button--edit" onClick={onEdit} aria-label="Edit">
        <span className="table-button__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
        <span className="table-button__label">Edit</span>
      </button>
      <button type="button" className="table-button table-button--danger" onClick={onDelete} aria-label="Delete">
        <span className="table-button__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span>
        <span className="table-button__label">Delete</span>
      </button>
    </div>
  );
}
function AnalyticsSummaryCard({ label, value, detail, icon, delay }) {
  return (
    <article className="analytics-summary-card" style={{ animationDelay: `${delay * 90}ms` }}>
      <div className="analytics-summary-card__icon"><AnalyticsIcon name={icon} /></div>
      <div>
        <span className="analytics-summary-card__label">{label}</span>
        <strong className="analytics-summary-card__value">{value}</strong>
        <p className="analytics-summary-card__detail">{detail}</p>
      </div>
    </article>
  );
}

function AnalyticsBlock({ title, subtitle, children }) {
  return (
    <section className="analytics-block">
      <div className="analytics-block__header">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function BarAnalyticsCard({ title, subtitle, children }) { return <AnalyticsBlock title={title} subtitle={subtitle}>{children}</AnalyticsBlock>; }
function LineAnalyticsCard({ title, subtitle, children }) { return <AnalyticsBlock title={title} subtitle={subtitle}>{children}</AnalyticsBlock>; }

function HorizontalBarChart({ data, formatter, tone = "brand" }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={`analytics-bar-chart analytics-bar-chart--${tone}`}>
      {data.map((item, index) => (
        <article key={`${item.label}-${index}`} className="analytics-bar-row">
          <div className="analytics-bar-row__meta">
            <span title={item.fullLabel || item.label}>{item.label}</span>
            <strong>{formatter(item.value)}</strong>
          </div>
          <div className="analytics-bar-row__track">
            <div
              className="analytics-bar-row__fill"
              style={{ width: `${analyticsBarWidthPercent(item.value, max)}%`, animationDelay: `${index * 80}ms` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function LineTrendChart({ data, formatter }) {
  if (!data.length) return <div className="analytics-empty">No project data available.</div>;

  const width = 520;
  const height = 210;
  const paddingX = 26;
  const paddingY = 24;
  const max = Math.max(...data.map((item) => item.value), 1);
  const stepX = data.length === 1 ? 0 : (width - paddingX * 2) / (data.length - 1);

  const points = data.map((item, index) => {
    const x = paddingX + stepX * index;
    const y = height - paddingY - analyticsLogRatio(item.value, max) * (height - paddingY * 2);
    return { ...item, x, y };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="analytics-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-line-chart__svg" role="img" aria-label="Outstanding value line chart">
        <defs>
          <linearGradient id="lineFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(31, 106, 165, 0.34)" />
            <stop offset="100%" stopColor="rgba(31, 106, 165, 0.04)" />
          </linearGradient>
        </defs>
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="analytics-line-chart__axis" />
        <polyline points={polylinePoints} className="analytics-line-chart__path" />
        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="5" className="analytics-line-chart__dot" />
        ))}
      </svg>
      <div className="analytics-line-chart__labels">
        {data.map((item) => (
          <article key={item.label} className="analytics-line-chart__label">
            <span title={item.fullLabel || item.label}>{item.label}</span>
            <strong title={formatter(item.value)}>{formatAnalyticsMoney(item.value)}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function DonutAnalyticsCard({ title, data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="analytics-block analytics-block--donut">
      <div className="analytics-block__header">
        <h4>{title}</h4>
        <p>{number.format(total)} tracked status updates</p>
      </div>
      <div className="donut-card">
        <DonutChart data={data} />
        <div className="donut-card__legend">
          {data.map((item, index) => <DonutLegendItem key={`${item.label}-${index}`} item={item} index={index} total={total} />)}
        </div>
      </div>
    </section>
  );
}

function DonutChart({ data }) {
  const palette = ["#0f4c81", "#2f77b4", "#64b0e2", "#f4b860", "#d38d27", "#c95252", "#7a8ca8"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let current = 0;
  const background = data.length
    ? `conic-gradient(${data.map((item, index) => {
        const start = current;
        current += (item.value / total) * 100;
        return `${palette[index % palette.length]} ${start}% ${current}%`;
      }).join(", ")})`
    : "conic-gradient(#d6e2f0 0% 100%)";

  return (
    <div className="donut-chart" style={{ background }}>
      <div className="donut-chart__center">
        <strong>{number.format(total)}</strong>
        <span>Total</span>
      </div>
    </div>
  );
}

function DonutLegendItem({ item, index, total }) {
  const palette = ["#0f4c81", "#2f77b4", "#64b0e2", "#f4b860", "#d38d27", "#c95252", "#7a8ca8"];
  const percent = total ? Math.round((item.value / total) * 100) : 0;

  return (
    <article className="donut-legend-item">
      <span className="donut-legend-item__swatch" style={{ background: palette[index % palette.length] }} />
      <div>
        <strong>{item.label}</strong>
        <span>{number.format(item.value)} entries • {percent}%</span>
      </div>
    </article>
  );
}

function AnalyticsCountPill({ label, value, delay }) {
  return (
    <article className="analytics-count-pill" style={{ animationDelay: `${delay * 60}ms` }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ProgressAnalyticsCard({ label, value, detail, progress }) {
  return (
    <section className="analytics-block analytics-block--compact">
      <div className="analytics-block__header">
        <h4>{label}</h4>
        <p>{detail}</p>
      </div>
      <div className="progress-card">
        <div className="progress-card__ring" style={{ background: `conic-gradient(#1f6aa5 0% ${progress}%, rgba(15, 76, 129, 0.12) ${progress}% 100%)` }}>
          <div className="progress-card__ring-inner">
            <strong>{value}</strong>
            <span>Outstanding</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function InsightListCard({ title, items }) {
  return (
    <section className="analytics-block analytics-block--compact">
      <div className="analytics-block__header">
        <h4>{title}</h4>
        <p>Quick executive takeaways from the current monitoring data</p>
      </div>
      <ul className="analytics-insight-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function AnalyticsTable({ columns, rows }) {
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsIcon({ name }) {
  if (name === "projects") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 6.75h14.5v10.5H4.75z" /><path d="M8 9.75h8M8 13h5" /></svg>;
  if (name === "value") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75h5.25a3.75 3.75 0 1 1 0 7.5H8m0-7.5v12.5m-2-9.25h8m-8 3.5h8" /></svg>;
  if (name === "dv") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 4.75h6l3.5 3.5v11a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" /><path d="M13.75 4.75v3.5h3.5M9 12h6M9 15h4" /></svg>;
  if (name === "outgoing") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6.5h5v5h-5zM13.5 12.5h5v5h-5z" /><path d="M10.5 9h2a3 3 0 0 1 3 3v.5" /></svg>;
  if (name === "policy") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4.75h7l3.25 3.25v11.5a1 1 0 0 1-1 1H7.75a1 1 0 0 1-1-1V5.75a1 1 0 0 1 1-1Z" /><path d="M13.75 4.75v3.25h3.25M9.25 12h5.5M9.25 15h4" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>;
}

function SidebarNavIcon({ name }) {
  if (name === "projects") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 6.75h14.5v10.5H4.75z" /><path d="M8 9.75h8M8 13h5" /></svg>;
  if (name === "dv") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 4.75h6l3.5 3.5v11a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" /><path d="M13.75 4.75v3.5h3.5M9 12h6M9 15h4" /></svg>;
  if (name === "outgoing") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 6.5h5v5h-5zM13.5 12.5h5v5h-5z" /><path d="M10.5 9h2a3 3 0 0 1 3 3v.5" /></svg>;
  if (name === "policy") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4.75h7l3.25 3.25v11.5a1 1 0 0 1-1 1H7.75a1 1 0 0 1-1-1V5.75a1 1 0 0 1 1-1Z" /><path d="M13.75 4.75v3.25h3.25M9.25 12h5.5M9.25 15h4" /></svg>;
  if (name === "reports") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.75 18.25V10.5M11.75 18.25V5.75M17.75 18.25v-4.5M4 18.25h16" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>;
}
function buildDetailSections(modal) {
  const byLabel = Object.fromEntries(modal.rows);

  if (modal.type === "Project") {
    return [
      {
        title: "Basic Information",
        columns: 2,
        fields: [
          detailField("Start Date", byLabel["Start Date"]),
          detailField("End Date", byLabel["End Date"]),
          detailField("Duration", byLabel["Duration"]),
          detailField("Kind of Goods", byLabel["Kind of Goods"]),
        ],
      },
      {
        title: "Financial Summary",
        columns: 2,
        fields: [
          detailField("Amount of Contract", byLabel["Amount of Contract"]),
          detailField("Outstanding Value", byLabel["Outstanding Value"]),
        ],
      },
    ];
  }

  if (modal.type === "DV Payment") {
    return [
      {
        key: "dv-voucher-title",
        title: "Voucher Information",
        columns: 1,
        fields: [detailField("Title of the Project", byLabel["Title of the Project"])],
      },
      {
        key: "dv-voucher-claimant",
        hideTitle: true,
        compact: true,
        columns: 1,
        fields: [detailField("Name and Address of Claimant", byLabel["Name and Address of Claimant"])],
      },
      {
        key: "dv-voucher-meta",
        hideTitle: true,
        compact: true,
        columns: 2,
        fields: [
          detailField("Voucher No.", byLabel["Voucher No."] ?? modal.title),
          detailField("Date", byLabel["Date"]),
        ],
      },
      {
        key: "dv-processing-amount",
        title: "Processing Status",
        columns: 1,
        fields: [detailField("Amount", byLabel["Amount"])],
      },
      {
        key: "dv-processing-status",
        hideTitle: true,
        compact: true,
        columns: 3,
        fields: [
          detailField("ICTSSD", byLabel["ICTSSD"]),
          detailField("GAD", byLabel["GAD"]),
          detailField("CASH", byLabel["CASH"]),
        ],
      },
    ];
  }

  if (modal.type === "Policy") {
    return [
      {
        key: "policy-header",
        title: "Policy Information",
        columns: 1,
        fields: [detailField("Policy Title", byLabel["Policy Title"])],
      },
      {
        key: "policy-people",
        hideTitle: true,
        compact: true,
        columns: 2,
        fields: [
          detailField("Created By", byLabel["Created By"]),
          detailField("Assigned To", byLabel["Assigned To"]),
        ],
      },
      {
        key: "policy-dates",
        hideTitle: true,
        compact: true,
        columns: 3,
        fields: [
          detailField("Start Date", byLabel["Start Date"]),
          detailField("End Date", byLabel["End Date"]),
          detailField("Duration", byLabel["Duration"] || byLabel["Days"]),
        ],
      },
      {
        key: "policy-status",
        hideTitle: true,
        compact: true,
        columns: 2,
        fields: [
          detailField("Status", byLabel["Status"]),
          detailField("Remarks", byLabel["Remarks"] || "—"),
        ],
      },
    ];
  }

  if (modal.type === "Outgoing") {
    return [
      {
        key: "outgoing-document",
        title: "Document Information",
        columns: 1,
        fields: [detailField("Subject", byLabel["Subject"])],
      },
      {
        key: "outgoing-document-meta",
        hideTitle: true,
        compact: true,
        columns: 2,
        fields: [
          detailField("Date", byLabel["Date"]),
          detailField("Memo Number", byLabel["Memo Number"] ?? modal.title),
        ],
      },
      {
        key: "outgoing-routing",
        title: "Routing Summary",
        columns: 2,
        fields: [
          detailField("Thru", byLabel["Thru"]),
          detailField("For", byLabel["For"]),
        ],
      },
    ];
  }

  return [{ title: "Record Information", columns: 3, fields: modal.rows.map(([label, value]) => detailField(label, value)) }];
}

function buildProjectDetailFields(modal) {
  const byLabel = Object.fromEntries(modal.rows);
  return [
    detailField("Start Date", byLabel["Start Date"]),
    detailField("End Date", byLabel["End Date"]),
    detailField("Duration", byLabel["Duration"]),
    detailField("Kind of Goods", byLabel["Kind of Goods"]),
    detailField("Amount of Contract", byLabel["Amount of Contract"]),
    detailField("Outstanding Value", byLabel["Outstanding Value"]),
  ];
}

function detailField(label, value) {
  return {
    label,
    value,
    icon: iconForField(label),
    tone: toneForField(label, value),
  };
}

function iconForField(label) {
  const map = {
    Date: "calendar",
    "Start Date": "calendar",
    "End Date": "calendar",
    Duration: "clock",
    "Kind of Goods": "box",
    "Amount of Contract": "peso",
    "Outstanding Value": "warning",
    Amount: "peso",
    "Title of the Project": "file",
    "Name and Address of Claimant": "user",
    "Voucher No.": "hash",
    ICTSSD: "building",
    GAD: "building",
    CASH: "building",
    Subject: "file",
    "Memo Number": "hash",
    Thru: "route",
    For: "route",
  };
  return map[label] || "file";
}

function toneForField(label, value) {
  if (label === "Amount of Contract" || label === "Amount") return "amount";
  if (label === "Outstanding Value") {
    const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
    return numeric > 0 ? "danger" : "neutral";
  }
  return "neutral";
}

function DetailFieldIcon({ name }) {
  if (name === "calendar") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2.75v3.5M17 2.75v3.5M3.75 9.25h16.5M5.75 5.75h12.5A2 2 0 0 1 20.25 7.75v10.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2V7.75a2 2 0 0 1 2-2Z" /></svg>;
  if (name === "clock") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" /><path d="M12 7.75v4.75l3 1.75" /></svg>;
  if (name === "box") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.75 7 3.5-7 3.5-7-3.5 7-3.5ZM5 7.25v9.5l7 3.5 7-3.5v-9.5M12 10.75v9.5" /></svg>;
  if (name === "peso") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.75h5.25a3.75 3.75 0 1 1 0 7.5H8m0-7.5v12.5m-2-9.25h8m-8 3.5h8" /></svg>;
  if (name === "warning") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.25 20 18.5H4L12 4.25Z" /><path d="M12 9v4.5M12 16.75h.01" /></svg>;
  if (name === "user") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.25a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 19.25a7 7 0 0 1 14 0" /></svg>;
  if (name === "hash") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.75 7 19.25M17 4.75l-2 14.5M4.75 9.25h14.5M3.75 14.75h14.5" /></svg>;
  if (name === "building") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.75 20.25V5.75h8.5v14.5M3.75 20.25h16.5M8.5 8.75h1.5M8.5 11.75h1.5M8.5 14.75h1.5M15.5 10.75h2.75v9.5H15.5Z" /></svg>;
  if (name === "route") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.25 6.25h4.5v4.5h-4.5ZM13.25 13.25h4.5v4.5h-4.5Z" /><path d="M10.75 8.5h2.5a3 3 0 0 1 3 3v1.75" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 4.75h6l3.5 3.5v11a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" /><path d="M13.75 4.75v3.5h3.5" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>;
}

function GoodsEditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20.25h3.5L18 9.75l-3.5-3.5L4 16.75v3.5Z" />
      <path d="m14.5 5.75 3.5 3.5" />
    </svg>
  );
}

function GoodsTrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.25 10v8.5M14.75 10v8.5M5.75 10h12.5l-.75 9h-11l-.75-9ZM9.25 10V7a1 1 0 011-1h3.5a1 1 0 011 1v3M4 10h16" />
    </svg>
  );
}
function SidebarHamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ThemeIcon({ theme }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon">
      {theme === "light" ? (
        <path d="M14.5 3.5a1 1 0 0 0-1.3 1.2 7 7 0 0 1-8.5 8.5 1 1 0 0 0-1.2 1.3A9 9 0 1 0 14.5 3.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 1.75v2.5M12 19.75v2.5M4.75 4.75l1.77 1.77M17.48 17.48l1.77 1.77M1.75 12h2.5M19.75 12h2.5M4.75 19.25l1.77-1.77M17.48 6.52l1.77-1.77" />
        </>
      )}
    </svg>
  );
}

export default App;
