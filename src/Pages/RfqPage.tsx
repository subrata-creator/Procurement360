import React, { useMemo, useState } from "react";
import { CircleCheck, ClipboardList, Download, MessageSquareText, Plus, Search } from "lucide-react";
import { rfqs } from "../data/rfqs";

const responseTotals = rfqs.reduce((totals, row) => {
  const [received, invited] = row.responses.split("/").map(Number);
  return { received: totals.received + received, invited: totals.invited + invited };
}, { received: 0, invited: 0 });
const rewardedCount = rfqs.filter((row) => row.status === "Rewarded").length;
const approvedCount = rfqs.filter((row) => row.status === "Approved").length;

const metrics = [
  { label: "Total RFQs", value: rfqs.length, caption: "RFQ records", progress: 100, icon: <ClipboardList size={18} />, tone: "blue" },
  { label: "Rewarded RFQs", value: rewardedCount, caption: `${Math.round((rewardedCount / (rfqs.length || 1)) * 100)}% of RFQs`, progress: Math.round((rewardedCount / (rfqs.length || 1)) * 100), icon: <CircleCheck size={18} />, tone: "green" },
  { label: "Approved RFQs", value: approvedCount, caption: `${Math.round((approvedCount / (rfqs.length || 1)) * 100)}% of RFQs`, progress: Math.round((approvedCount / (rfqs.length || 1)) * 100), icon: <CircleCheck size={18} />, tone: "amber" },
  { label: "Supplier Responses", value: `${responseTotals.received}/${responseTotals.invited}`, caption: "Received / invited", progress: Math.round((responseTotals.received / (responseTotals.invited || 1)) * 100), icon: <MessageSquareText size={18} />, tone: "violet" },
];

const RfqPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rfqs.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(query)));
  }, [search]);

  return (
    <main className="purchase-page rfq-page">
      <div className="purchase-heading rfq-heading">
        <div>
          <h1>Request For Quotations</h1>
          <p>Manage and track all RFQs</p>
        </div>
        <label className="purchase-search rfq-search">
          <Search size={15} aria-hidden="true" />
          <input aria-label="Search" placeholder="Search RFQs, PRs, POs, titles, suppliers..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      <section className="xd-kpis rfq-metrics" aria-label="RFQ metrics">
        {metrics.map((metric) => (
          <article className={`xd-kpi xd-${metric.tone}`} key={metric.label}>
            <div className="xd-kpi-top">
              <span className="xd-kpi-label">{metric.label}</span>
              <span className="xd-kpi-icon">{metric.icon}</span>
            </div>
            <div className="xd-kpi-mid"><strong>{metric.value}</strong></div>
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{metric.caption}</span>
              <div className="xd-progress" role="progressbar" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.progress}>
                <span style={{ width: `${Math.max(metric.progress, 2)}%` }} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="purchase-card rfq-records-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <ClipboardList size={16} />
            <div className="purchase-title-copy">
              <strong>Request For Quotations</strong>
              <span>{visibleRows.length} of {rfqs.length} RFQs</span>
            </div>
          </div>
          <div className="purchase-actions">
            <button type="button" className="export-button" aria-label="Export RFQs"><Download size={14} /></button>
            <button type="button" className="dashboard-create-button"><span className="create-plus"><Plus size={16} /></span>Create RFQ</button>
          </div>
        </div>
        <div className="purchase-table-wrap">
          <table className="purchase-table rfq-table">
            <thead>
              <tr><th>#</th><th>RFQ Ref</th><th>Title</th><th>Associated PR</th><th>Associated PO</th><th>Responses</th><th>Supplier</th><th>Created By</th><th>Created Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={row.refNo}>
                  <td className="purchase-row-number">{String(index + 1).padStart(2, "0")}</td>
                  <td className="purchase-link">{row.refNo}</td>
                  <td className="rfq-title-cell">{row.title}</td>
                  <td className={row.pr.startsWith("PR-") ? "purchase-link" : "purchase-muted"}>{row.pr.startsWith("PR-") ? row.pr : "Not linked"}</td>
                  <td className={row.po.startsWith("PO-") ? "purchase-link" : "purchase-muted"}>{row.po.startsWith("PO-") ? row.po : "Not linked"}</td>
                  <td className="rfq-response-count">{row.responses}</td>
                  <td>{row.supplier === "N/A" ? <span className="purchase-muted">Not assigned</span> : row.supplier}</td>
                  <td>{row.createdBy}</td>
                  <td>{row.createdDate}</td>
                  <td><span className={`rfq-status-pill ${row.status.toLowerCase()}`}>{row.status}</span></td>
                </tr>
              ))}
              {visibleRows.length === 0 && <tr><td className="purchase-empty-state" colSpan={10}>No RFQs match this search.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="purchase-footer">
          <span>Showing <strong>{visibleRows.length ? `1-${visibleRows.length}` : "0"}</strong> of <strong>{rfqs.length}</strong> RFQs</span>
          <div className="purchase-pagination"><button type="button" aria-label="Previous page" disabled><span aria-hidden="true">‹</span></button><button type="button" className="selected" aria-label="Page 1">1</button><button type="button" aria-label="Next page" disabled><span aria-hidden="true">›</span></button></div>
        </div>
      </section>
    </main>
  );
};

export default RfqPage;
