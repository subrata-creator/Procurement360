import React, { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { rfqs } from "../data/rfqs";
import "../Styles/Styles.css";
import "../Styles/RFQPage.css";
const RFQ_STATUS_PROGRESS: Record<string, number> = {
  Rewarded: 100,
  Approved: 50,
};

function parseResponses(responses: string): { received: number; invited: number } {
  const [received, invited] = responses.split("/").map(Number);
  return {
    received: Number.isFinite(received) ? received : 0,
    invited: Number.isFinite(invited) ? invited : 0,
  };
}

function isoToDmyDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${year}`;
}

function RfqStatusRing({ status }: { status: string }) {
  const progress = RFQ_STATUS_PROGRESS[status] ?? 25;
  const tone = status.toLowerCase();
  return (
    <span
      className={`rfq-status-ring ${tone}`}
      role="img"
      aria-label={`${status}, ${progress}% complete`}
      title={`${status} · ${progress}% complete`}
      style={{ "--ring-progress": progress } as React.CSSProperties}
    >
      <span aria-hidden="true">
        {progress}
        <small>%</small>
      </span>
    </span>
  );
}

const RfqPage: React.FC = () => {
  const createdOnDateRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState("All Status");

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rfqs.filter((row) => {
      const haystack = [row.refNo, row.title, row.pr, row.po, row.supplier, row.createdBy, row.status, row.createdDate]
        .join(" ")
        .toLowerCase();
      const matchesSearch = haystack.includes(query);
      const matchesCreatedOn = !createdOnQuery || row.createdDate === isoToDmyDate(createdOnQuery);
      const matchesStatus = statusQuery === "All Status" || row.status === statusQuery;
      return matchesSearch && matchesCreatedOn && matchesStatus;
    });
  }, [search, createdOnQuery, statusQuery]);

  // KPIs: computed from the full data set (not the current filter), same as
  // the Purchase Requests page's stat tiles.
  const responseTotals = rfqs.reduce(
    (totals, row) => {
      const { received, invited } = parseResponses(row.responses);
      return { received: totals.received + received, invited: totals.invited + invited };
    },
    { received: 0, invited: 0 }
  );
  const rewardedCount = rfqs.filter((row) => row.status === "Rewarded").length;
  const unlinkedCount = rfqs.filter((row) => !row.pr.startsWith("PR-")).length;
  const avgResponseRate = Math.round((responseTotals.received / (responseTotals.invited || 1)) * 100);
  const awardRate = Math.round((rewardedCount / (rfqs.length || 1)) * 100);

  const metrics = [
    { label: "Total RFQs", value: rfqs.length, caption: "RFQ records", progress: 100, icon: <ChevronRight size={0} style={{ display: "none" }} />, tone: "blue" },
    { label: "Avg Response Rate", value: `${avgResponseRate}%`, caption: `${responseTotals.received} of ${responseTotals.invited} invited suppliers responded`, progress: avgResponseRate, icon: <MessageSquareText size={18} />, tone: "violet" },
    { label: "Award Rate", value: `${awardRate}%`, caption: `${rewardedCount} of ${rfqs.length} RFQs rewarded`, progress: awardRate, icon: <CircleCheck size={18} />, tone: "green" },
    { label: "Needs Attention", value: unlinkedCount, caption: "RFQs with no linked PR", progress: Math.round((unlinkedCount / (rfqs.length || 1)) * 100), icon: <CircleAlert size={18} />, tone: "amber" },
  ];

  // Insights below derive from the current filtered view, same pattern as
  // the Purchase Requests page's aging/spend/recommendations panels.
  const responseTracking = [...visibleRows]
    .map((row) => {
      const { received, invited } = parseResponses(row.responses);
      const pct = invited ? Math.round((received / invited) * 100) : 0;
      return { ref: row.refNo, responses: row.responses, pct };
    })
    .sort((a, b) => a.pct - b.pct);

  const supplierCounts = new Map<string, number>();
  visibleRows.forEach((row) => {
    const name = row.supplier === "N/A" ? "No supplier assigned" : row.supplier;
    supplierCounts.set(name, (supplierCounts.get(name) ?? 0) + 1);
  });
  const supplierMix = Array.from(supplierCounts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const maxSupplierCount = supplierMix[0]?.count ?? 0;

  const recommendations: Array<{ title: string; detail: string; ref: string }> = [];
  const unlinkedRow = visibleRows.find((row) => !row.pr.startsWith("PR-"));
  if (unlinkedRow) {
    recommendations.push({
      title: `Link ${unlinkedRow.refNo} to a purchase request`,
      detail: `${unlinkedRow.title} has no associated PR recorded — link it for a complete audit trail.`,
      ref: unlinkedRow.refNo,
    });
  }
  const zeroResponseRow = visibleRows.find((row) => parseResponses(row.responses).received === 0);
  if (zeroResponseRow) {
    const { invited } = parseResponses(zeroResponseRow.responses);
    recommendations.push({
      title: `Follow up on ${zeroResponseRow.refNo}`,
      detail: `0 of ${invited} invited suppliers have responded yet.`,
      ref: zeroResponseRow.refNo,
    });
  }
  const noSupplierRow = visibleRows.find((row) => {
    const { received } = parseResponses(row.responses);
    return row.supplier === "N/A" && received > 0;
  });
  if (noSupplierRow) {
    recommendations.push({
      title: `Assign a supplier to ${noSupplierRow.refNo}`,
      detail: `This RFQ has an active response but no supplier recorded.`,
      ref: noSupplierRow.refNo,
    });
  }

  const fullyResponsiveSuppliers = supplierMix
    .filter((s) => s.name !== "No supplier assigned")
    .filter((s) => visibleRows.some((row) => row.supplier === s.name && parseResponses(row.responses).received === parseResponses(row.responses).invited))
    .map((s) => s.name);

  const aiSummary = `Of ${rfqs.length} tracked RFQs, ${rewardedCount} have been rewarded and ${rfqs.length - rewardedCount} are approved and awaiting award. Supplier response rate stands at ${avgResponseRate}% (${responseTotals.received} of ${responseTotals.invited} invited)${fullyResponsiveSuppliers.length ? `, with ${fullyResponsiveSuppliers.join(" and ")} fully responsive on their quotes` : ""}. ${unlinkedCount} RFQ${unlinkedCount === 1 ? "" : "s"} ${unlinkedCount === 1 ? "has" : "have"} no linked purchase request, which may affect audit traceability.`;

  return (
    <main className="purchase-page rfq-page">
      <div className="purchase-heading">
        <div>
          <h1>Request For Quotations</h1>
          <p>Manage and track all RFQs — with response and supplier intelligence</p>
        </div>
      </div>

      <section className="xd-kpis rfq-metrics" aria-label="RFQ metrics">
        {metrics.map((metric) => (
          <article className={`xd-kpi xd-${metric.tone}`} key={metric.label}>
            <div className="xd-kpi-top">
              <span className="xd-kpi-label">{metric.label}</span>
              <span className="xd-kpi-icon">{metric.icon}</span>
            </div>
            <div className="xd-kpi-mid">
              <strong>{metric.value}</strong>
            </div>
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{metric.caption}</span>
              <div className="xd-progress" role="progressbar" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.progress}>
                <span style={{ width: `${Math.max(metric.progress, 2)}%` }} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rfq-insights-grid" aria-label="RFQ insights">
        <article className="rfq-insight-panel rfq-aging-panel">
          <div className="rfq-insight-heading">
            <div>
              <span className="rfq-insight-kicker">RESPONSE TRACKING</span>
              <h2>Supplier response status</h2>
              <p>{visibleRows.length} RFQs in this view</p>
            </div>
            <Clock3 size={17} className="rfq-insight-heading-icon" />
          </div>
          <div className="rfq-aging-list">
            {responseTracking.map((row) => (
              <div className="rfq-aging-row" key={row.ref}>
                <span>{row.ref}</span>
                <div className="rfq-aging-track" role="progressbar" aria-label={`${row.ref} response rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.pct}>
                  <span className={row.pct === 0 ? "critical" : row.pct < 100 ? "watch" : "fresh"} style={{ width: `${Math.max(row.pct, 4)}%` }} />
                </div>
                <strong>{row.responses}</strong>
              </div>
            ))}
            {responseTracking.length === 0 && <p className="rfq-insight-empty">No RFQs match the current filters.</p>}
          </div>
        </article>

        <article className="rfq-insight-panel rfq-spend-panel">
          <div className="rfq-insight-heading">
            <div>
              <span className="rfq-insight-kicker">SUPPLIER MIX</span>
              <h2>RFQs by supplier</h2>
              <p>{supplierMix.length} supplier groups</p>
            </div>
            <Building2 size={17} className="rfq-insight-heading-icon" />
          </div>
          <div className="rfq-category-spend">
            {supplierMix.map((row, index) => (
              <div className="rfq-category-row" key={row.name}>
                <span title={row.name}>{row.name}</span>
                <div className="rfq-category-track" role="progressbar" aria-label={`${row.name} RFQ count`} aria-valuemin={0} aria-valuemax={maxSupplierCount} aria-valuenow={row.count}>
                  <span className={`tone-${index % 4}`} style={{ width: `${maxSupplierCount ? (row.count / maxSupplierCount) * 100 : 0}%` }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
            {supplierMix.length === 0 && <p className="rfq-insight-empty">No RFQs match the current filters.</p>}
          </div>
        </article>

        <article className="rfq-insight-panel rfq-recommendations-panel">
          <div className="rfq-insight-heading">
            <div>
              <span className="rfq-insight-kicker">AI RECOMMENDATIONS</span>
              <h2>Prioritized follow-ups</h2>
              <p>Derived from the current RFQ data</p>
            </div>
          </div>
          <div className="rfq-recommendation-list">
            {recommendations.length ? recommendations.map((rec) => (
              <button
                className="rfq-recommendation"
                key={rec.title}
                type="button"
                onClick={() => setSearch(rec.ref)}
              >
                <span className="rfq-recommendation-icon"><CircleAlert size={15} /></span>
                <span className="rfq-recommendation-copy">
                  <strong>{rec.title}</strong>
                  <small>{rec.detail}</small>
                  <em>{rec.ref}</em>
                </span>
                <ArrowRight size={15} />
              </button>
            )) : (
              <div className="rfq-recommendation-empty">
                <CircleCheck size={17} />
                <span>No follow-up actions identified for the current view.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rfq-ai-summary-band">
        <div className="rfq-ai-summary-copy">
          <div className="rfq-ai-summary-heading">
            <span><Sparkles size={14} /></span>
            <h2>AI Summary</h2>
            <small>Record-backed</small>
          </div>
          <p>{aiSummary}</p>
        </div>
        <div className="rfq-ask-ai">
          <h2>Ask Procurement AI</h2>
          <div className="rfq-ask-ai-input">
            <label htmlFor="rfq-ask-ai" className="sr-only">Ask Procurement AI about RFQs</label>
            <input id="rfq-ask-ai" type="text" placeholder="Ask about response rates, suppliers, awards..." />
            <button type="button" aria-label="Ask Procurement AI">
              <MessageSquareText size={14} />
            </button>
          </div>
          <div className="rfq-ask-ai-chips">
            <button type="button" onClick={() => setSearch("Not linked")}>Which RFQs lack a PR?</button>
            <button type="button" onClick={() => setStatusQuery("Approved")}>Show all approved RFQs</button>
            <button type="button" onClick={() => setSearch("")}>Reset filters</button>
          </div>
        </div>
      </section>

      <section className="purchase-card rfq-records-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <span className="rfq-title-icon" aria-hidden="true">
              <Sparkles size={14} />
            </span>
            <div className="purchase-title-copy">
              <strong>Request For Quotations</strong>
              <span>{visibleRows.length} of {rfqs.length} RFQs</span>
            </div>
          </div>
          <div className="purchase-actions">
            <button type="button" className="dashboard-create-button">
              <span className="create-plus"><Plus size={16} /></span>
              Create RFQ
            </button>
          </div>
        </div>

        <div className="rfq-filters">
          <div className="rfq-filter-field rfq-search-filter">
            <label>Search</label>
            <div className="rfq-filter-input">
              <Search size={13} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by ref no, title, PR, PO, supplier or created by..."
              />
            </div>
          </div>
          <div className="rfq-filter-field">
            <label>Created On</label>
            <div className="rfq-filter-input">
              <input
                ref={createdOnDateRef}
                type="date"
                className="rfq-hidden-date-input"
                value={createdOnQuery}
                onChange={(event) => setCreatedOnQuery(event.target.value)}
              />
              <input
                readOnly
                placeholder="Select date"
                value={createdOnQuery ? isoToDmyDate(createdOnQuery) : ""}
                onClick={() => createdOnDateRef.current?.showPicker?.()}
              />
              <button type="button" className="rfq-filter-calendar-btn" onClick={() => createdOnDateRef.current?.showPicker?.()}>
                <CalendarDays size={11} />
              </button>
            </div>
          </div>
          <div className="rfq-filter-field">
            <label>Status</label>
            <div className="rfq-filter-input">
              <select value={statusQuery} onChange={(event) => setStatusQuery(event.target.value)}>
                <option>All Status</option>
                <option>Rewarded</option>
                <option>Approved</option>
              </select>
              <ChevronDown size={11} />
            </div>
          </div>
        </div>

        <div className="purchase-table-wrap">
          <table className="purchase-table rfq-table">
            <thead>
              <tr>
                <th aria-label="Status"></th>
                <th>RFQ ID</th><th>Title</th><th>Associated PR</th><th>Associated PO</th><th>Responses</th><th>Supplier</th><th>Created By</th><th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.refNo}>
                  <td className="purchase-status-cell"><RfqStatusRing status={row.status} /></td>
                  <td className="purchase-link">{row.refNo}</td>
                  <td className="rfq-title-cell">{row.title}</td>
                  <td className={row.pr.startsWith("PR-") ? "purchase-link" : "purchase-muted"}>{row.pr.startsWith("PR-") ? row.pr : "Not linked"}</td>
                  <td className={row.po.startsWith("PO-") ? "purchase-link" : "purchase-muted"}>{row.po.startsWith("PO-") ? row.po : "Not linked"}</td>
                  <td className="rfq-response-count">{row.responses}</td>
                  <td>{row.supplier === "N/A" ? <span className="purchase-muted">Not assigned</span> : row.supplier}</td>
                  <td>{row.createdBy}</td>
                  <td>{row.createdDate}</td>
                </tr>
              ))}
              {visibleRows.length === 0 && <tr><td className="purchase-empty-state" colSpan={9}>No RFQs match these filters.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="purchase-footer">
          <span>Showing <strong>{visibleRows.length ? `1-${visibleRows.length}` : "0"}</strong> of <strong>{rfqs.length}</strong> RFQs</span>
          <div className="purchase-pagination">
            <button type="button" aria-label="Previous page" disabled><ChevronLeft size={11} /></button>
            <button type="button" className="selected" aria-label="Page 1">1</button>
            <button type="button" aria-label="Next page" disabled><ChevronRight size={11} /></button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default RfqPage;