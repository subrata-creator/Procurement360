import React, { useMemo, useState } from "react";

type RfqStatus = "Rewarded" | "Approved";

interface RfqRow {
  refNo: string;
  title: string;
  pr: string;
  po: string;
  responses: string;
  supplier: string;
  createdBy: string;
  createdDate: string;
  status: RfqStatus;
}

const rfqs: RfqRow[] = [
  { refNo: "RFQ-2026-052", title: "RFQ - IT Equipments", pr: "PR-2026-088", po: "PO-2026-032", responses: "3/3", supplier: "Logitech", createdBy: "Ashish Bhatia", createdDate: "01/04/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-051", title: "RFQ for Printer", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "18/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-050", title: "RFQ", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "17/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-049", title: "RFQ", pr: "No PR available", po: "No PO available", responses: "0/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "17/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-048", title: "RFQ", pr: "PR-2026-087", po: "No PO available", responses: "1/2", supplier: "Dell Inc.", createdBy: "Ashish Bhatia", createdDate: "03/02/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-047", title: "RFQ Pens", pr: "PR-2026-085", po: "PO-2026-028", responses: "2/2", supplier: "ITC", createdBy: "Ashish Bhatia", createdDate: "03/02/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-046", title: "RFQ ST - IT", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "Dell Inc.", createdBy: "Ashish Bhatia", createdDate: "30/01/2026", status: "Rewarded" },
];

const metrics = [
  { label: "Rewarded Suppliers", value: "24", icon: "♧", tone: "blue" },
  { label: "Published To Suppliers", value: "43", icon: "▣", tone: "purple" },
  { label: "Response Due This Week", value: "0", icon: "⇆", tone: "amber" },
  { label: "Overdue RFQs", value: "39", icon: "▣", tone: "pink" },
];

const RfqPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(() => {
    const query = search.toLowerCase();
    return rfqs.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(query)));
  }, [search]);

  return (
    <main className="rfq-page">
      <div className="rfq-heading">
        <div>
          <h1>Request For Quotations</h1>
          <p>Manage and track all RFQs</p>
        </div>
        <label className="rfq-global-search"><span>⌕</span><input placeholder="Search RFQs..." /></label>
        <button className="rfq-notification" type="button" aria-label="Notifications">♧<i /></button>
      </div>

      <section className="rfq-metrics">
        {metrics.map((metric) => (
          <article className={`rfq-metric ${metric.tone}`} key={metric.label}>
            <div className="rfq-metric-icon">{metric.icon}</div>
            <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
            <div className="metric-spark" aria-hidden="true" />
          </article>
        ))}
      </section>

      <section className="rfq-card">
        <div className="rfq-card-heading">
          <h2><span>➤</span> Request For Quotations</h2>
          <div className="rfq-card-actions"><button type="button" className="export-button" aria-label="Export RFQs">▣</button><button type="button" className="create-rfq">＋ Create RFQ</button></div>
        </div>
        <div className="rfq-filters">
          {[
            ["Ref No", "Search..."], ["Title", "Search..."], ["Associated PR", "Search..."], ["Associated PO", "Search..."], ["Responses", "Search..."], ["Rewarded Supplier", "Search..."], ["Created By", "Search..."],
          ].map(([label, placeholder], index) => (
            <label key={label}><span>{label}</span><input value={index === 0 ? search : undefined} onChange={index === 0 ? (event) => setSearch(event.target.value) : undefined} placeholder={placeholder} /></label>
          ))}
          <label><span>Created Date</span><div className="date-filter"><b>▣</b><input placeholder="Select date" /><i>⚱</i></div></label>
          <label><span>Status</span><select defaultValue="All"><option>All Status</option><option>Rewarded</option><option>Approved</option></select></label>
        </div>
        <div className="rfq-table-wrap">
          <table className="rfq-table">
            <thead><tr><th>#</th><th>Ref No <b>↕</b></th><th>Title</th><th>Associated PR <b>↕</b></th><th>Associated PO <b>↕</b></th><th>Responses <b>↕</b></th><th>Rewarded Supplier <b>↕</b></th><th>Created By <b>↕</b></th><th>Created Date <b>↕</b></th><th>Status <b>↕</b></th></tr></thead>
            <tbody>{visibleRows.map((row, index) => <tr key={row.refNo}>
              <td>{index + 1}</td><td className="link-cell">{row.refNo}</td><td>{row.title}</td><td className={row.pr.startsWith("PR-") ? "link-cell" : "muted-cell"}>{row.pr}</td><td className={row.po.startsWith("PO-") ? "link-cell" : "muted-cell"}>{row.po}</td><td>{row.responses}</td>
              <td><span className={`supplier-cell ${row.supplier === "N/A" ? "supplier-na" : ""}`}>{row.supplier !== "N/A" && <b>{row.supplier === "Logitech" ? "G" : row.supplier === "ITC" ? "△" : "D"}</b>}{row.supplier}</span></td><td><span className="creator-cell"><b>👤</b>{row.createdBy}</span></td><td><span className="date-cell">▣ {row.createdDate}</span></td><td><span className={`status-pill ${row.status.toLowerCase()}`}>{row.status === "Rewarded" ? "▣" : "◉"} {row.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="rfq-footer"><span>Showing <strong>1-{visibleRows.length}</strong> of <strong>39</strong> results</span><div className="rfq-pagination"><button type="button">‹</button><button type="button" className="selected">1</button><button type="button">›</button></div></div>
      </section>
    </main>
  );
};

export default RfqPage;
