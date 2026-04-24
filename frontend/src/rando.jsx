import { useEffect, useMemo, useState } from "react";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-PH");
const PAGE = 5;
const NAV = [
  ["projects", "Project Monitoring"],
  ["payments", "Disbursement Voucher Monitoring"],
  ["outgoing", "Outgoing Document Monitoring"],
  ["reports", "Reports and Analytics"],
];
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
  reports: {
    title: "Reports and Analytics",
    subtext: "Review operational summaries and export monitoring data for each workspace tool.",
  },
};
const GOODS = ["All Goods", "ICT Equipment", "Software", "Office Equipment", "Services"];
const ICTSSD = ["Signed", "Receive", "Pending"];
const GAD = ["Pending", "Signed", "Unsigned", "Return"];
const CASH = ["Received", "Return"];
const PAYMENT_FILTERS = ["All", "Signed", "Receive", "Received", "Pending", "Unsigned", "Return"];
const THRU = ["NCD", "ITMG", "BAC", "PMO", "PSD", "PCEO"];
const FOR = ["SSC", "PCEO", "NCD", "ITMG", "BAC", "PMO", "PSD", "PPMD", "BUDGET", "LEGAL", "ESD", "OPSD", "PMERD", "LDD"];

const seedProjects = [
  { id: 1, contractName: "Supply and Delivery of ICT Equipment", date: "2026-03-15", duration: "120 days", goods: "ICT Equipment", amount: 131123123, outstanding: 22000000 },
  { id: 2, contractName: "Document Management Platform Upgrade", date: "2026-02-10", duration: "180 days", goods: "Software", amount: 18500000, outstanding: 6150000 },
  { id: 3, contractName: "Regional Office Network Enhancement", date: "2026-01-24", duration: "90 days", goods: "Services", amount: 9800000, outstanding: 2500000 },
];
const seedPayments = [
  { id: 11, title: "Network Upgrade Project", claimantAddress: "Juan Dela Cruz, Quezon City", voucherNo: "KM-3313", amount: 245000, ictssd: "Signed", gad: "Pending", cash: "Received" },
  { id: 12, title: "Server Room Improvement", claimantAddress: "Maria Santos, Pasig City", voucherNo: "KM-3314", amount: 825000, ictssd: "Receive", gad: "Signed", cash: "Return" },
  { id: 13, title: "Cybersecurity Hardening", claimantAddress: "Carlos Reyes, Manila City", voucherNo: "KM-3315", amount: 450000, ictssd: "Pending", gad: "Unsigned", cash: "Received" },
];
const seedOutgoing = [
  { id: 21, subject: "Submission of Procurement Plan", memoNo: "ISSD-2026-014", date: "2026-03-18", thru: "BAC", forDept: "BUDGET" },
  { id: 22, subject: "Request for Technical Evaluation", memoNo: "ISSD-2026-019", date: "2026-03-21", thru: "ITMG", forDept: "LEGAL" },
  { id: 23, subject: "Endorsement of Project Timeline", memoNo: "ISSD-2026-024", date: "2026-03-27", thru: "PMO", forDept: "PCEO" },
];
const blankProject = { contractName: "", date: "", duration: "", goods: "ICT Equipment", amount: "", outstanding: "" };
const blankPayment = { title: "", claimantAddress: "", voucherNo: "", amount: "", ictssd: "Pending", gad: "Pending", cash: "Received" };
const blankOutgoing = { subject: "", memoNo: "", date: "", thru: "BAC", forDept: "SSC" };
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
function exportCsv(name, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function App() {
  const [started, setStarted] = useState(false);
  const [view, setView] = useState("projects");
  const [landingModal, setLandingModal] = useState(null);
  const [activeFaq, setActiveFaq] = useState(FAQ_ITEMS[0].id);
  const [theme, setTheme] = useState(() => localStorage.getItem("monitoring-theme") || "light");
  const [dense, setDense] = useState(() => localStorage.getItem("monitoring-density") === "dense");
  const [projects, setProjects] = useState(seedProjects);
  const [payments, setPayments] = useState(seedPayments);
  const [outgoing, setOutgoing] = useState(seedOutgoing);
  const [projectForm, setProjectForm] = useState(blankProject);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [outgoingForm, setOutgoingForm] = useState(blankOutgoing);
  const [projectEdit, setProjectEdit] = useState(null);
  const [paymentEdit, setPaymentEdit] = useState(null);
  const [outgoingEdit, setOutgoingEdit] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [outgoingSearch, setOutgoingSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Goods");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [outgoingFilter, setOutgoingFilter] = useState("All");
  const [projectPage, setProjectPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [modal, setModal] = useState(null);
  const currentViewMeta = VIEW_META[view];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = dense ? "dense" : "comfortable";
    localStorage.setItem("monitoring-theme", theme);
    localStorage.setItem("monitoring-density", dense ? "dense" : "comfortable");
  }, [theme, dense]);

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

  const projectBars = useMemo(() => tally(projects, "goods"), [projects]);
  const paymentBars = useMemo(() => {
    const counts = { Signed: 0, Receive: 0, Received: 0, Pending: 0, Unsigned: 0, Return: 0 };
    payments.forEach((x) => [x.ictssd, x.gad, x.cash].forEach((s) => { counts[s] += 1; }));
    return Object.entries(counts).filter(([, v]) => v).map(([label, value]) => ({ label, value }));
  }, [payments]);
  const outgoingBars = useMemo(() => tally(outgoing, "forDept").sort((a, b) => b.value - a.value).slice(0, 6), [outgoing]);
  const maxBar = Math.max(1, ...projectBars.map((x) => x.value), ...paymentBars.map((x) => x.value), ...outgoingBars.map((x) => x.value));

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

  const projectPages = Math.ceil(projectRows.length / PAGE) || 1;
  const paymentPages = Math.ceil(paymentRows.length / PAGE) || 1;
  const outgoingPages = Math.ceil(outgoingRows.length / PAGE) || 1;
  const safeProjectPage = Math.min(projectPage, projectPages);
  const safePaymentPage = Math.min(paymentPage, paymentPages);
  const safeOutgoingPage = Math.min(outgoingPage, outgoingPages);

  const activity = [...projects.map((x) => ({ id: `p-${x.id}`, type: "Project", title: x.contractName, date: x.date, detail: `Outstanding ${peso.format(x.outstanding)}` })), ...payments.map((x) => ({ id: `d-${x.id}`, type: "DV Payment", title: x.voucherNo, date: `2026-04-${String((x.id % 8) + 1).padStart(2, "0")}`, detail: `${x.claimantAddress} - ${peso.format(x.amount)}` })), ...outgoing.map((x) => ({ id: `o-${x.id}`, type: "Outgoing", title: x.memoNo, date: x.date, detail: `${x.thru} to ${x.forDept}` }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const saveProject = (e) => {
    e.preventDefault();
    if (!projectForm.contractName || !projectForm.date || !projectForm.duration) return;
    const rec = { id: projectEdit ?? Date.now(), contractName: projectForm.contractName.trim(), date: projectForm.date, duration: projectForm.duration.trim(), goods: projectForm.goods, amount: Number(projectForm.amount || 0), outstanding: Number(projectForm.outstanding || 0) };
    setProjects((cur) => projectEdit ? cur.map((x) => (x.id === projectEdit ? rec : x)) : [rec, ...cur]);
    setProjectForm(blankProject); setProjectEdit(null);
  };
  const savePayment = (e) => {
    e.preventDefault();
    if (!paymentForm.title || !paymentForm.claimantAddress || !paymentForm.voucherNo) return;
    const rec = { id: paymentEdit ?? Date.now(), title: paymentForm.title.trim(), claimantAddress: paymentForm.claimantAddress.trim(), voucherNo: paymentForm.voucherNo.trim(), amount: Number(paymentForm.amount || 0), ictssd: paymentForm.ictssd, gad: paymentForm.gad, cash: paymentForm.cash };
    setPayments((cur) => paymentEdit ? cur.map((x) => (x.id === paymentEdit ? rec : x)) : [rec, ...cur]);
    setPaymentForm(blankPayment); setPaymentEdit(null);
  };
  const saveOutgoing = (e) => {
    e.preventDefault();
    if (!outgoingForm.subject || !outgoingForm.memoNo || !outgoingForm.date) return;
    const rec = { id: outgoingEdit ?? Date.now(), subject: outgoingForm.subject.trim(), memoNo: outgoingForm.memoNo.trim(), date: outgoingForm.date, thru: outgoingForm.thru, forDept: outgoingForm.forDept };
    setOutgoing((cur) => outgoingEdit ? cur.map((x) => (x.id === outgoingEdit ? rec : x)) : [rec, ...cur]);
    setOutgoingForm(blankOutgoing); setOutgoingEdit(null);
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
  const pager = (page, pages, total, setPage) => <div className="pagination"><span>Showing {total ? (page - 1) * PAGE + 1 : 0}-{Math.min(page * PAGE, total)} of {total}</span><div className="pagination__actions"><button type="button" className="ghost-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><strong>Page {page} of {pages}</strong><button type="button" className="ghost-button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></div>;
  const open = (type, title, rows) => setModal({ type, title, rows });
  const openLandingPanel = (key) => {
    setLandingModal(LANDING_PANELS[key]);
    setActiveFaq(key === "faqs" ? FAQ_ITEMS[0].id : "");
  };

  const projectExport = () => exportCsv("project-monitoring.csv", [["Name of Contract", "Date", "Duration", "Kind of Goods", "Amount of Contract", "Outstanding Value"], ...projectRows.map((x) => [x.contractName, x.date, x.duration, x.goods, x.amount, x.outstanding])]);
  const paymentExport = () => exportCsv("dv-payment-monitoring.csv", [["Title of the Project", "Name and Address of Claimant", "Voucher No.", "Amount", "ICTSSD", "GAD", "CASH"], ...paymentRows.map((x) => [x.title, x.claimantAddress, x.voucherNo, x.amount, x.ictssd, x.gad, x.cash])]);
  const outgoingExport = () => exportCsv("issd-outgoing-monitoring.csv", [["Subject", "Memo Number", "Date", "Thru", "For"], ...outgoingRows.map((x) => [x.subject, x.memoNo, x.date, x.thru, x.forDept])]);

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

          <section className="landing-sections">
            <article className="landing-section-card">
              <div className="landing-section-card__title">
                <span>About</span>
                <h2>About the System</h2>
              </div>
              <p>
                This system supports the Internal Service Support Division in monitoring
                key operational records. It focuses on project tracking, DV payment
                processing, and outgoing document routing. The goal is to keep records
                accurate, organized, and easy to access.
              </p>
            </article>

            <article className="landing-section-card">
              <div className="landing-section-card__title">
                <span>Services</span>
                <h2>Core Monitoring Services</h2>
              </div>
              <ul className="landing-list">
                <li>Project contract monitoring</li>
                <li>DV payment tracking</li>
                <li>Outgoing document routing</li>
                <li>Record management and reporting</li>
              </ul>
            </article>

            <article className="landing-section-card">
              <div className="landing-section-card__title">
                <span>FAQs</span>
                <h2>Frequently Asked Questions</h2>
              </div>
              <p>
                Find answers about how to track records, update entries, and manage
                document workflows within the system.
              </p>
            </article>
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
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="brand-block"><button type="button" className="brand-mark-button" aria-label="Return to landing page" onClick={() => setStarted(false)}><img src={SIDEBAR_LOGO_IMAGE} alt="SSS logo" className="brand-mark" /></button><div><p className="brand-eyebrow">ISSD Monitoring</p><h1>Operations Hub</h1></div></div>
        <nav className="sidebar-nav">{NAV.map(([id, label]) => <button key={id} type="button" className={`nav-button ${view === id ? "is-active" : ""}`} onClick={() => setView(id)}>{label}</button>)}</nav>
        <button type="button" className="sidebar-return" onClick={() => setStarted(false)}>Return to landing page</button>
      </aside>

      <main className="workspace">
        <header className="topbar"><div><p className="topbar__eyebrow">Monitoring System</p><h2>{currentViewMeta.title}</h2><span className="topbar__subtext">{currentViewMeta.subtext}</span></div><div className="topbar-actions"><button type="button" className="icon-button" aria-label={theme === "light" ? "Enable dark mode" : "Enable light mode"} title={theme === "light" ? "Enable dark mode" : "Enable light mode"} onClick={() => setTheme((x) => x === "light" ? "dark" : "light")}><ThemeIcon theme={theme} /></button></div></header>

        {view === "projects" && <section className="page tool-page"><div className="tool-layout"><section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total contracts" value={number.format(projects.length)} /><MetricChip label="Contract value" value={peso.format(stats.totalContractValue)} /><MetricChip label="Outstanding" value={peso.format(stats.totalOutstandingValue)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">Project Monitoring Tool</p><h3>{projectEdit ? "Edit project record" : "Add new project"}</h3></div></div><form className="record-form" onSubmit={saveProject}><label><span>Name of Contract</span><input value={projectForm.contractName} onChange={(e) => setProjectForm({ ...projectForm, contractName: e.target.value })} placeholder="Enter contract title" /></label><div className="form-row"><label><span>Date</span><input type="date" value={projectForm.date} onChange={(e) => setProjectForm({ ...projectForm, date: e.target.value })} /></label><label><span>Duration</span><input value={projectForm.duration} onChange={(e) => setProjectForm({ ...projectForm, duration: e.target.value })} placeholder="e.g. 120 days" /></label></div><label><span>Kind of Goods</span><select value={projectForm.goods} onChange={(e) => setProjectForm({ ...projectForm, goods: e.target.value })}>{GOODS.filter((g) => g !== "All Goods").map((g) => <option key={g}>{g}</option>)}</select></label><div className="form-row"><label><span>Amount of Contract</span><input type="number" min="0" step="0.01" value={projectForm.amount} onChange={(e) => setProjectForm({ ...projectForm, amount: e.target.value })} placeholder="0.00" /></label><label><span>Outstanding Value</span><input type="number" min="0" step="0.01" value={projectForm.outstanding} onChange={(e) => setProjectForm({ ...projectForm, outstanding: e.target.value })} placeholder="0.00" /></label></div><div className="form-actions"><button type="submit" className="primary-button">{projectEdit ? "Save project" : "Add project"}</button><button type="button" className="ghost-button" onClick={() => { setProjectEdit(null); setProjectForm(blankProject); }}>Clear form</button></div></form></section><section className="panel table-panel">{toolbar("Project records", "Search, filter, and export contract monitoring data.", projectSearch, setProjectSearch, projectFilter, setProjectFilter, GOODS, "Goods", projectExport)}<div className="table-wrap"><table><thead><tr><th>Name of Contract</th><th>Date</th><th>Duration</th><th>Kind of Goods</th><th>Amount of Contract</th><th>Outstanding Value</th><th>Actions</th></tr></thead><tbody>{pageSlice(projectRows, safeProjectPage).map((x) => <tr key={x.id}><td>{x.contractName}</td><td>{fmtDate(x.date)}</td><td>{x.duration}</td><td>{x.goods}</td><td>{peso.format(x.amount)}</td><td>{peso.format(x.outstanding)}</td><td><ActionSet onView={() => open("Project", x.contractName, [["Date", fmtDate(x.date)], ["Duration", x.duration], ["Kind of Goods", x.goods], ["Amount of Contract", peso.format(x.amount)], ["Outstanding Value", peso.format(x.outstanding)]])} onEdit={() => { setProjectEdit(x.id); setProjectForm({ contractName: x.contractName, date: x.date, duration: x.duration, goods: x.goods, amount: String(x.amount), outstanding: String(x.outstanding) }); }} onDelete={() => setProjects((cur) => cur.filter((item) => item.id !== x.id))} /></td></tr>)}</tbody></table></div>{pager(safeProjectPage, projectPages, projectRows.length, setProjectPage)}</section></div></section>}
        {view === "payments" && <section className="page tool-page"><div className="tool-layout"><section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total vouchers" value={number.format(payments.length)} /><MetricChip label="Total amount" value={peso.format(stats.totalVoucherValue)} /><MetricChip label="Status alerts" value={number.format(stats.pendingPayments)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">DV Payment Monitoring Tool</p><h3>{paymentEdit ? "Edit voucher record" : "Add new DV record"}</h3></div></div><form className="record-form" onSubmit={savePayment}><div className="form-section"><p className="form-section__title">Input Fields</p><p className="form-section__note">Complete the project, claimant, voucher, and amount details for the disbursement voucher record.</p></div><label><span>Title of the Project *</span><input value={paymentForm.title} onChange={(e) => setPaymentForm({ ...paymentForm, title: e.target.value })} placeholder="Enter project title" /></label><label><span>Name and Address of Claimant</span><textarea value={paymentForm.claimantAddress} onChange={(e) => setPaymentForm({ ...paymentForm, claimantAddress: e.target.value })} placeholder="Enter claimant name and address" /></label><div className="form-row"><label><span>Voucher No.</span><input value={paymentForm.voucherNo} onChange={(e) => setPaymentForm({ ...paymentForm, voucherNo: e.target.value })} placeholder="KM-3313" /></label><label><span>Amount: Php.</span><input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="0.00" /></label></div><div className="form-section"><p className="form-section__title">Monitoring Fields</p><p className="form-section__note">Set the current status per department using the dropdown lists below.</p></div><div className="form-row form-row--triple"><label><span>ICTSSD (Department)</span><select value={paymentForm.ictssd} onChange={(e) => setPaymentForm({ ...paymentForm, ictssd: e.target.value })}>{ICTSSD.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>GAD (Department)</span><select value={paymentForm.gad} onChange={(e) => setPaymentForm({ ...paymentForm, gad: e.target.value })}>{GAD.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>CASH (Department)</span><select value={paymentForm.cash} onChange={(e) => setPaymentForm({ ...paymentForm, cash: e.target.value })}>{CASH.map((o) => <option key={o}>{o}</option>)}</select></label></div><div className="form-actions"><button type="submit" className="primary-button">{paymentEdit ? "Save voucher" : "Add DV record"}</button><button type="button" className="ghost-button" onClick={() => { setPaymentEdit(null); setPaymentForm(blankPayment); }}>Clear form</button></div></form></section><section className="panel table-panel">{toolbar("DV payment records", "Track voucher workflow progress with clear department status indicators.", paymentSearch, setPaymentSearch, paymentFilter, setPaymentFilter, PAYMENT_FILTERS, "Status", paymentExport)}<div className="table-wrap"><table><thead><tr><th>Title of the Project</th><th>Name and Address of Claimant</th><th>Voucher No.</th><th>Amount</th><th>ICTSSD</th><th>GAD</th><th>CASH</th><th>Actions</th></tr></thead><tbody>{pageSlice(paymentRows, safePaymentPage).map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.claimantAddress}</td><td>{x.voucherNo}</td><td>{peso.format(x.amount)}</td><td><StatusBadge label={x.ictssd} /></td><td><StatusBadge label={x.gad} /></td><td><StatusBadge label={x.cash} /></td><td><ActionSet onView={() => open("DV Payment", x.voucherNo, [["Title of the Project", x.title], ["Name and Address of Claimant", x.claimantAddress], ["Voucher No.", x.voucherNo], ["Amount", peso.format(x.amount)], ["ICTSSD", x.ictssd], ["GAD", x.gad], ["CASH", x.cash]])} onEdit={() => { setPaymentEdit(x.id); setPaymentForm({ title: x.title, claimantAddress: x.claimantAddress, voucherNo: x.voucherNo, amount: String(x.amount), ictssd: x.ictssd, gad: x.gad, cash: x.cash }); }} onDelete={() => setPayments((cur) => cur.filter((item) => item.id !== x.id))} /></td></tr>)}</tbody></table></div>{pager(safePaymentPage, paymentPages, paymentRows.length, setPaymentPage)}</section></div></section>}

        {view === "outgoing" && <section className="page tool-page"><div className="tool-layout"><section className="panel metric-panel"><div className="metric-section"><div className="inline-stat-grid"><MetricChip label="Total outgoing" value={number.format(outgoing.length)} /><MetricChip label="Top route" value={outgoingBars[0]?.label || "None"} /><MetricChip label="Departments hit" value={number.format(outgoingBars.length)} /></div></div></section><section className="panel form-panel"><div className="panel__header"><div><p className="panel__kicker">ISSD Outgoing Monitoring Tool</p><h3>{outgoingEdit ? "Edit outgoing route" : "Add outgoing record"}</h3></div></div><form className="record-form" onSubmit={saveOutgoing}><label><span>Subject</span><textarea value={outgoingForm.subject} onChange={(e) => setOutgoingForm({ ...outgoingForm, subject: e.target.value })} placeholder="Enter the memo subject" /></label><div className="form-row"><label><span>Memo Number</span><input value={outgoingForm.memoNo} onChange={(e) => setOutgoingForm({ ...outgoingForm, memoNo: e.target.value })} placeholder="ISSD-YYYY-000" /></label><label><span>Date</span><input type="date" value={outgoingForm.date} onChange={(e) => setOutgoingForm({ ...outgoingForm, date: e.target.value })} /></label></div><div className="form-row"><label><span>Thru</span><select value={outgoingForm.thru} onChange={(e) => setOutgoingForm({ ...outgoingForm, thru: e.target.value })}>{THRU.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>For</span><select value={outgoingForm.forDept} onChange={(e) => setOutgoingForm({ ...outgoingForm, forDept: e.target.value })}>{FOR.map((o) => <option key={o}>{o}</option>)}</select></label></div><div className="form-actions"><button type="submit" className="primary-button">{outgoingEdit ? "Save outgoing record" : "Add outgoing"}</button><button type="button" className="ghost-button" onClick={() => { setOutgoingEdit(null); setOutgoingForm(blankOutgoing); }}>Clear form</button></div></form></section><section className="panel table-panel">{toolbar("Outgoing records", "Monitor subject routing and department distribution.", outgoingSearch, setOutgoingSearch, outgoingFilter, setOutgoingFilter, ["All", ...FOR], "For", outgoingExport)}<div className="table-wrap"><table><thead><tr><th>Subject</th><th>Memo Number</th><th>Date</th><th>Thru</th><th>For</th><th>Actions</th></tr></thead><tbody>{pageSlice(outgoingRows, safeOutgoingPage).map((x) => <tr key={x.id}><td>{x.subject}</td><td>{x.memoNo}</td><td>{fmtDate(x.date)}</td><td>{x.thru}</td><td>{x.forDept}</td><td><ActionSet onView={() => open("Outgoing", x.memoNo, [["Subject", x.subject], ["Date", fmtDate(x.date)], ["Thru", x.thru], ["For", x.forDept]])} onEdit={() => { setOutgoingEdit(x.id); setOutgoingForm({ subject: x.subject, memoNo: x.memoNo, date: x.date, thru: x.thru, forDept: x.forDept }); }} onDelete={() => setOutgoing((cur) => cur.filter((item) => item.id !== x.id))} /></td></tr>)}</tbody></table></div>{pager(safeOutgoingPage, outgoingPages, outgoingRows.length, setOutgoingPage)}</section></div></section>}

        {view === "reports" && <section className="page"><div className="reports-grid"><section className="panel"><div className="panel__header"><div><p className="panel__kicker">Reports / Analytics</p><h3>Operational analytics snapshot</h3></div></div><div className="report-stat-grid"><StatCard label="Project completion signal" value={stats.totalContractValue === 0 ? "0%" : `${Math.round(((stats.totalContractValue - stats.totalOutstandingValue) / stats.totalContractValue) * 100)}%`} caption="Based on total contract value vs. outstanding value" /><StatCard label="Voucher completion signal" value={number.format(payments.filter((x) => x.ictssd !== "Pending" && x.gad !== "Pending" && x.gad !== "Unsigned" && x.gad !== "Return" && x.cash !== "Return").length)} caption="Records with no pending or returned stage" /><StatCard label="Outgoing route coverage" value={number.format(outgoingBars.length)} caption="Top receiving departments shown in analytics" /></div><ChartCard title="Cross-tool distribution" data={[{ label: "Projects", value: projects.length }, { label: "DV", value: payments.length }, { label: "Outgoing", value: outgoing.length }]} max={Math.max(projects.length, payments.length, outgoing.length, 1)} /></section><section className="panel"><div className="panel__header"><div><p className="panel__kicker">Export Center</p><h3>Quick reporting actions</h3></div></div><div className="export-stack"><button type="button" className="primary-button" onClick={projectExport}>Export project CSV</button><button type="button" className="primary-button" onClick={paymentExport}>Export DV payment CSV</button><button type="button" className="primary-button" onClick={outgoingExport}>Export outgoing CSV</button><p className="export-note">PDF export is represented here with report-ready sections and CSV outputs without additional libraries.</p></div></section></div></section>}

      </main>

      {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className={`modal-card workspace-modal ${modal.type === "Project" ? "workspace-modal--project" : ""}`} onClick={(e) => e.stopPropagation()}><div className="workspace-modal__header"><div><p className="workspace-modal__eyebrow">{modal.type.toUpperCase()} DETAILS</p><h3>{modal.title}</h3></div><button type="button" className="workspace-modal__close" aria-label="Close details" onClick={() => setModal(null)}><CloseIcon /></button></div><div className="workspace-modal__body">{modal.type === "Project" ? <div className="project-detail-grid">{buildProjectDetailFields(modal).map((field) => <article key={field.label} className="project-detail-field"><span className="project-detail-label">{field.label}</span><strong className={`project-detail-value ${field.tone === "amount" ? "project-detail-value--amount" : ""} ${field.tone === "danger" ? "project-detail-value--danger" : ""}`}>{field.value}</strong></article>)}</div> : buildDetailSections(modal).map((section) => <section key={section.title} className="detail-section"><div className="detail-section__header"><p className="detail-section__title">{section.title}</p></div><div className={`detail-grid detail-grid--${section.columns}`}>{section.fields.map((field) => <article key={field.label} className={`detail-item detail-item--${field.tone}`}><div className="detail-item__header"><span className="detail-item__icon"><DetailFieldIcon name={field.icon} /></span><span className="detail-item__label">{field.label}</span></div><strong className="detail-item__value">{field.value}</strong></article>)}</div></section>)}</div></div></div>}
    </div>
  );
}

function StatCard({ label, value, caption }) { return <article className="stat-card"><span>{label}</span><strong>{value}</strong><p>{caption}</p></article>; }
function MetricChip({ label, value }) { return <article className="metric-chip"><span>{label}</span><strong>{value}</strong></article>; }
function StatusBadge({ label }) { return <span className={`status-badge ${statusTone(label)}`}>{label}</span>; }
function ActionSet({ onView, onEdit, onDelete }) { return <div className="action-set"><button type="button" className="table-button" onClick={onView}>View</button><button type="button" className="table-button" onClick={onEdit}>Edit</button><button type="button" className="table-button table-button--danger" onClick={onDelete}>Delete</button></div>; }
function ChartCard({ title, data, max }) { return <section className="chart-card"><div className="chart-card__header"><h4>{title}</h4></div><div className="chart-bars">{data.map((item) => <article key={item.label} className="chart-row"><div className="chart-row__meta"><span>{item.label}</span><strong>{number.format(item.value)}</strong></div><div className="chart-row__track"><div className="chart-row__fill" style={{ width: `${(item.value / max) * 100}%` }} /></div></article>)}</div></section>; }
function buildDetailSections(modal) {
  const byLabel = Object.fromEntries(modal.rows);

  if (modal.type === "Project") {
    return [
      {
        title: "Basic Information",
        columns: 3,
        fields: [
          detailField("Date", byLabel["Date"]),
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
        title: "Voucher Information",
        columns: 3,
        fields: [
          detailField("Title of the Project", byLabel["Title of the Project"]),
          detailField("Name and Address of Claimant", byLabel["Name and Address of Claimant"]),
          detailField("Voucher No.", byLabel["Voucher No."]),
        ],
      },
      {
        title: "Processing Status",
        columns: 2,
        fields: [
          detailField("Amount", byLabel["Amount"]),
          detailField("ICTSSD", byLabel["ICTSSD"]),
          detailField("GAD", byLabel["GAD"]),
          detailField("CASH", byLabel["CASH"]),
        ],
      },
    ];
  }

  if (modal.type === "Outgoing") {
    return [
      {
        title: "Document Information",
        columns: 3,
        fields: [
          detailField("Subject", byLabel["Subject"]),
          detailField("Date", byLabel["Date"]),
          detailField("Memo Number", byLabel["Memo Number"] ?? modal.title),
        ],
      },
      {
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
    detailField("Date", byLabel["Date"]),
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


