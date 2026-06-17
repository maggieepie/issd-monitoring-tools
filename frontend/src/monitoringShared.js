export const PAGE = 5;
export const REQUIRED_FIELDS_ALERT_MESSAGE = "Please fill in all required fields.";
export const REQUIRED_FIELDS_ALERT_MESSAGE_POLICY =
  "Please fill in all required fields. Remarks are optional.";
export const number = new Intl.NumberFormat("en-PH");

export const fmtDate = (v) =>
  v
    ? new Date(`${v}T00:00:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "No date";

export const pageSlice = (items, p) => items.slice((p - 1) * PAGE, p * PAGE);

export function blockDateFieldDirectEntry(e) {
  if (e.key === "Tab" || e.key === "Escape" || e.key === "Enter") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.nativeEvent?.isComposing) return;
  if (e.key.length === 1) e.preventDefault();
  if (e.key === "Backspace" || e.key === "Delete") e.preventDefault();
  if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
}

export function exportCsv(name, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Inclusive calendar days between two YYYY-MM-DD values. */
export function policyDaysBetween(startYmd, endYmd) {
  if (!startYmd || !endYmd) return null;
  const s = new Date(`${startYmd}T12:00:00`);
  const e = new Date(`${endYmd}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  if (diff < 0) return null;
  return diff + 1;
}

/** Human-readable span: years, months, weeks, and days (from inclusive day count). */
export function formatPolicyDuration(totalDays) {
  if (totalDays == null || !Number.isFinite(totalDays)) return "";
  const n = Math.max(0, Math.floor(totalDays));
  if (n === 0) return "0 days";

  let remaining = n;
  const years = Math.floor(remaining / 365);
  remaining %= 365;
  const months = Math.floor(remaining / 30);
  remaining %= 30;
  const weeks = Math.floor(remaining / 7);
  const days = remaining % 7;

  const parts = [];
  const push = (value, unit) => {
    if (value > 0) parts.push(`${value} ${unit}${value === 1 ? "" : "s"}`);
  };
  push(years, "year");
  push(months, "month");
  push(weeks, "week");
  push(days, "day");

  return parts.join(", ");
}

/** Elapsed time since a pending timestamp (minutes → hours → days → weeks → months/years). */
export function formatPendingElapsed(isoTimestamp, nowMs = Date.now()) {
  if (!isoTimestamp) return "";
  const start = new Date(isoTimestamp).getTime();
  if (Number.isNaN(start)) return "";

  const totalMinutes = Math.max(0, Math.floor((nowMs - start) / 60000));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalWeeks = Math.floor(totalDays / 7);

  const label = (value, unit) => `${value} ${unit}${value === 1 ? "" : "s"}`;

  if (totalMinutes < 60) {
    return label(totalMinutes, "min");
  }
  if (totalHours < 24) {
    const mins = totalMinutes % 60;
    const parts = [label(totalHours, "hr")];
    if (mins > 0) parts.push(label(mins, "min"));
    return parts.join(", ");
  }
  if (totalDays < 7) {
    const hrs = totalHours % 24;
    const parts = [label(totalDays, "day")];
    if (hrs > 0) parts.push(label(hrs, "hr"));
    return parts.join(", ");
  }
  if (totalWeeks < 52) {
    const days = totalDays % 7;
    const parts = [label(totalWeeks, "week")];
    if (days > 0) parts.push(label(days, "day"));
    return parts.join(", ");
  }

  let remainingDays = totalDays;
  const years = Math.floor(remainingDays / 365);
  remainingDays %= 365;
  const months = Math.floor(remainingDays / 30);
  remainingDays %= 30;
  const weeks = Math.floor(remainingDays / 7);
  const days = remainingDays % 7;

  const parts = [];
  const push = (value, unit) => {
    if (value > 0) parts.push(label(value, unit));
  };
  push(years, "year");
  push(months, "month");
  push(weeks, "week");
  push(days, "day");
  return parts.join(", ");
}
