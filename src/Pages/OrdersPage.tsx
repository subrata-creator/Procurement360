import React, { useMemo, useState } from "react";

type OrderStatus = "Approved" | "In Review";

interface OrderRow {
  refNo: string;
  rfq: string;
  pr: string;
  supplier: string;
  amount: string;
  createdBy: string;
  createdOn: string;
  status: OrderStatus;
}

const orders: OrderRow[] = [
  { refNo: "PO-2026-032", rfq: "RFQ-2026-052", pr: "PR-2026-088", supplier: "Logitech", amount: "USD 17,171.00", createdBy: "Ashish Bhatia", createdOn: "4/3/2026", status: "Approved" },
  { refNo: "PO-2026-031", rfq: "No RFQ available", pr: "No PR available", supplier: "Logitech", amount: "USD 187.00", createdBy: "Ashish Bhatia", createdOn: "3/22/2026", status: "Approved" },
  { refNo: "PO-2026-030", rfq: "No RFQ available", pr: "No PR available", supplier: "Classmate", amount: "USD 209.00", createdBy: "Ashish Bhatia", createdOn: "3/22/2026", status: "In Review" },
  { refNo: "PO-2026-029", rfq: "No RFQ available", pr: "No PR available", supplier: "ITC", amount: "USD 71,500.00", createdBy: "Ashish Bhatia", createdOn: "3/19/2026", status: "In Review" },
  { refNo: "PO-2026-028", rfq: "RFQ-2026-047", pr: "PR-2026-085", supplier: "ITC", amount: "USD 495.00", createdBy: "Ashish Bhatia", createdOn: "2/3/2026", status: "Approved" },
  { refNo: "PO-2026-027", rfq: "RFQ-2026-042", pr: "PR-2026-083", supplier: "Logitech", amount: "USD 6,600.00", createdBy: "Ashish Bhatia", createdOn: "1/28/2026", status: "Approved" },
  { refNo: "PO-2026-026", rfq: "RFQ-2026-041", pr: "PR-2026-081", supplier: "Dell Inc.", amount: "USD 5,500.00", createdBy: "Ashish Bhatia", createdOn: "1/27/2026", status: "Approved" },
];

const metrics = [
  { label: "Total POs", value: "32", icon: "▣", tone: "blue" },
  { label: "Approved POs", value: "17", icon: "♢", tone: "green" },
  { label: "POs In Review", value: "10", icon: "⌛", tone: "purple" },
  { label: "Rejected POs", value: "2", icon: "♧", tone: "pink" },
  { label: "Average Approval Duration", value: "0.86 days", icon: "◷", tone: "amber" },
  { label: "Issue PO Value", value: "440381.70", icon: "▣", tone: "cyan" },
];

const OrdersPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const visibleOrders = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((order) => Object.values(order).some((value) => value.toLowerCase().includes(query)));
  }, [search]);

  return (
    <main className="orders-page">
      <div className="orders-heading">
        <div><h1>Orders</h1><p>Manage and track all purchase orders</p></div>
        <label className="orders-global-search"><span>⌕</span><input placeholder="Search purchase orders..." /></label>
        <button type="button" className="orders-notification" aria-label="Notifications">♧<i /></button>
      </div>
      <section className="orders-metrics">
        {metrics.map((metric) => <article className={`orders-metric ${metric.tone}`} key={metric.label}><div className="orders-metric-icon">{metric.icon}</div><div><span>{metric.label}</span><strong>{metric.value}</strong></div><div className="orders-spark" aria-hidden="true" /></article>)}
      </section>
      <section className="orders-card">
        <div className="orders-card-heading"><h2><span>🛒</span> Purchase Orders</h2><div className="orders-actions"><button type="button" className="orders-export" aria-label="Export orders">▣</button><button type="button" className="create-order">＋ Create Order</button></div></div>
        <div className="orders-filters">
          {[["Ref No", "Search..."], ["Associated RFQ", "Search..."], ["Associated PR", "Search..."], ["Supplier", "Search..."], ["Total Amount", "Search..."], ["Created By", "Search..."]].map(([label, placeholder], index) => <label key={label}><span>{label}</span><input value={index === 0 ? search : undefined} onChange={index === 0 ? (event) => setSearch(event.target.value) : undefined} placeholder={placeholder} /></label>)}
          <label><span>Created On</span><div className="orders-date-filter"><b>▣</b><input placeholder="Select date" /></div></label>
          <label><span>Status</span><select defaultValue="All"><option>All Status</option><option>Approved</option><option>In Review</option></select></label>
        </div>
        <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>#</th><th>Ref No <b>↕</b></th><th>Associated RFQ <b>↕</b></th><th>Associated PR <b>↕</b></th><th>Supplier <b>↕</b></th><th>Total Amount <b>↕</b></th><th>Created By <b>↕</b></th><th>Created On <b>↕</b></th><th>Status <b>↕</b></th></tr></thead><tbody>{visibleOrders.map((order, index) => <tr key={order.refNo}><td>{index + 1}</td><td className="order-link">{order.refNo}</td><td className={order.rfq.startsWith("RFQ-") ? "order-link" : "order-muted"}>{order.rfq}</td><td className={order.pr.startsWith("PR-") ? "order-link" : "order-muted"}>{order.pr}</td><td><span className={`order-supplier ${order.supplier === "Classmate" ? "classmate" : ""}`}><b>{order.supplier === "Dell Inc." ? "DELL" : order.supplier === "Logitech" ? "G" : order.supplier === "ITC" ? "ITC" : "c"}</b>{order.supplier}</span></td><td>{order.amount}</td><td><span className="order-creator"><b>👤</b>{order.createdBy}</span></td><td><span className="order-date">▣ {order.createdOn}</span></td><td><span className={`order-status ${order.status === "Approved" ? "approved" : "review"}`}>{order.status === "Approved" ? "✓" : "⌛"} {order.status}</span></td></tr>)}</tbody></table></div>
        <div className="orders-footer"><span>Showing <strong>1-{visibleOrders.length}</strong> of <strong>32</strong> results</span><div className="orders-pagination"><button type="button">‹</button><button type="button" className="selected">1</button><button type="button">›</button></div></div>
      </section>
    </main>
  );
};

export default OrdersPage;
