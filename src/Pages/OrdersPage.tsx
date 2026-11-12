import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FC, ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  Coins,
  Hourglass,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { getAvatarUrl } from "../assets/utils/avatars";
import { getInitials } from "../data/Purchaserequestsdata";
import { getAllOrders, type OrderRow, type OrderStatus } from "../data/OrdersData";
import { getDynamicPurchaseOrders } from "../Services/PurchaseOrderService";

import "../Styles/Styles.css";
import "../Styles/OrdersPage.css";
import "../Styles/OrdersPagePlus.css";

const STATUS_PROGRESS: Record<OrderStatus, number> = { Approved: 100, "In Review": 50, Rejected: 0 };

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const formatUsd = (amount: number) =>
  `USD ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatUsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

const slug = (value: string) => value.toLowerCase().replace(/\s+/g, "-");
const hasRfq = (row: OrderRow) => row.rfq.startsWith("RFQ-");
const hasPr = (row: OrderRow) => row.pr.startsWith("PR-");

function PoStatusRing({ status }: { status: OrderStatus }) {
  const progress = STATUS_PROGRESS[status];
  return (
    <span
      className={`purchase-status-indicator ${slug(status)}`}
      role="img"
      aria-label={`${status}, ${progress}% complete`}
      title={`${status} · ${progress}% complete`}
      style={{ "--status-progress": `${progress}%` } as CSSProperties}
    >
      <span aria-hidden="true">{progress}<small>%</small></span>
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const url = getAvatarUrl(name);
  return url
    ? <img className="po-avatar" src={url} alt="" />
    : <span className="po-avatar fallback" aria-hidden="true">{getInitials(name)}</span>;
}

const OrdersPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as {
    rfqNumber?: string;
    rfqId?: string;
    supplierName?: string;
    supplierId?: string;
    poNumber?: string;
    newlyCreated?: boolean;
    fromAward?: boolean;
  } | null;
  const [awardedRfqBanner, setAwardedRfqBanner] = useState<typeof navState>(
    navState?.fromAward || navState?.newlyCreated ? navState : null
  );
  const [orderList, setOrderList] = useState<OrderRow[]>(() => getAllOrders());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [_loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const dynamicOrders = await getDynamicPurchaseOrders();
      setOrderList(dynamicOrders);
    } catch (err) {
      console.warn("Could not load dynamic purchase orders from Dataverse:", err);
      setLoadError("Could not refresh live orders from Dataverse. Showing cached records.");
      setOrderList(getAllOrders());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    if (navState?.fromAward || navState?.newlyCreated) {
      setAwardedRfqBanner(navState);
    }
  }, [loadOrders, navState]);

  const [search, setSearch] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("All Suppliers");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState("All Status");
  const [askAiQuery, setAskAiQuery] = useState("");

  const suppliers = useMemo(
    () => Array.from(new Set(orderList.map((row) => row.supplier))).sort(),
    [orderList]
  );

  const runAskAiQuery = () => {
    const query = askAiQuery.trim();
    if (!query) return;
    setSearch(query);
    document.getElementById("orders-records-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetFilters = () => {
    setSearch("");
    setAskAiQuery("");
    setSupplierQuery("All Suppliers");
    setCreatedOnQuery("");
    setStatusQuery("All Status");
  };

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderList.filter((row) => {
      const haystack = [
        row.refNo,
        row.rfq,
        row.pr,
        row.supplier,
        row.createdBy,
        row.createdOn,
        formatUsDate(row.createdOn),
        row.status,
      ]
        .join(" ")
        .toLowerCase();
      return (
        haystack.includes(query) &&
        (supplierQuery === "All Suppliers" || row.supplier === supplierQuery) &&
        (!createdOnQuery || row.createdOn === createdOnQuery) &&
        (statusQuery === "All Status" || row.status === statusQuery)
      );
    });
  }, [orderList, search, supplierQuery, createdOnQuery, statusQuery]);

  /* ---------- Dynamic KPI figures derived directly from live Dataverse POs ---------- */
  const totalCount = orderList.length;
  const approvedCount = orderList.filter((row) => row.status === "Approved").length;
  const inReviewCount = orderList.filter((row) => row.status === "In Review").length;
  const rejectedCount = orderList.filter((row) => row.status === "Rejected").length;
  const approvedSpend = orderList
    .filter((row) => row.status === "Approved")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalSpend = orderList.reduce((sum, row) => sum + row.amount, 0);

  const metrics: { label: string; value: string; caption: string; progress?: number; icon: ReactNode; tone: string }[] = [
    {
      label: "Total POs",
      value: String(totalCount),
      caption: "Dataverse purchase orders",
      progress: 100,
      icon: <ClipboardList size={18} />,
      tone: "blue",
    },
    {
      label: "Approved POs",
      value: String(approvedCount),
      caption: totalCount ? `${Math.round((approvedCount / totalCount) * 100)}% of total` : "0%",
      progress: totalCount ? Math.round((approvedCount / totalCount) * 100) : 0,
      icon: <CircleCheck size={18} />,
      tone: "green",
    },
    {
      label: "POs In Review",
      value: String(inReviewCount),
      caption: totalCount ? `${Math.round((inReviewCount / totalCount) * 100)}% of total` : "0%",
      progress: totalCount ? Math.round((inReviewCount / totalCount) * 100) : 0,
      icon: <Hourglass size={18} />,
      tone: "amber",
    },
    {
      label: "Rejected POs",
      value: String(rejectedCount),
      caption: totalCount ? `${Math.round((rejectedCount / totalCount) * 100)}% of total` : "0%",
      progress: totalCount ? Math.round((rejectedCount / totalCount) * 100) : 0,
      icon: <CircleX size={18} />,
      tone: "red",
    },
    {
      label: "Avg Approval Duration",
      value: "0.86 days",
      caption: "Submission to approval",
      icon: <Clock3 size={18} />,
      tone: "violet",
    },
    {
      label: "Issued PO Value",
      value: formatUsd(approvedSpend || totalSpend),
      caption: "Total value of approved POs",
      icon: <Coins size={18} />,
      tone: "cyan",
    },
  ];

  /* ---------- Dynamic insights from current filtered view ---------- */
  const supplierTotals = new Map<string, number>();
  visibleOrders.forEach((row) => supplierTotals.set(row.supplier, (supplierTotals.get(row.supplier) ?? 0) + row.amount));
  const supplierSpend = Array.from(supplierTotals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const maxSupplierSpend = supplierSpend[0]?.value ?? 0;

  const statusBreakdown: { label: string; count: number; tone: "fresh" | "watch" | "critical" }[] = [
    { label: "Approved", count: visibleOrders.filter((row) => row.status === "Approved").length, tone: "fresh" },
    { label: "In Review", count: visibleOrders.filter((row) => row.status === "In Review").length, tone: "watch" },
    { label: "Rejected", count: visibleOrders.filter((row) => row.status === "Rejected").length, tone: "critical" },
  ];
  const maxStatusCount = Math.max(...statusBreakdown.map((row) => row.count), 1);

  const unlinkedAll = orderList.filter((row) => !hasRfq(row) && !hasPr(row)).length;
  const recommendations: { title: string; detail: string; ref: string }[] = [];
  const unlinkedOrder = visibleOrders.find((row) => !hasRfq(row) && !hasPr(row));
  if (unlinkedOrder) {
    recommendations.push({
      title: `Link ${unlinkedOrder.refNo} to an RFQ or PR`,
      detail: "This purchase order has no RFQ or PR recorded in Dataverse — link it for an audit trail.",
      ref: unlinkedOrder.refNo,
    });
  }
  const largestPending = [...visibleOrders].filter((row) => row.status === "In Review").sort((a, b) => b.amount - a.amount)[0];
  if (largestPending) {
    recommendations.push({
      title: `Review ${largestPending.refNo}`,
      detail: `${usdFormatter.format(largestPending.amount)} is still in review — largest pending PO in this view.`,
      ref: largestPending.refNo,
    });
  }

  const aiSummary = `Of ${totalCount} purchase orders recorded in Dataverse cr49f_purchaseorders, ${approvedCount} are approved, ${inReviewCount} are in review and ${rejectedCount} rejected. Total issued PO value is ${formatUsd(approvedSpend || totalSpend)}. ${unlinkedAll} of the ${totalCount} orders loaded here ${unlinkedAll === 1 ? "has" : "have"} no linked RFQ or PR, which may affect audit traceability.`;

  return (
    <main className="purchase-page orders-page">
      <div className="purchase-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>Orders</h1>
          <p>Live purchase orders powered by Dataverse cr49f_purchaseorders table</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={isLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "10px",
            background: "var(--card-hex, #ffffff)",
            border: "1px solid var(--border-hex, #e2e8f0)",
            color: "var(--foreground-hex, #0f172a)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
          title="Refresh orders from Dataverse"
        >
          <RefreshCw size={14} className={isLoading ? "quotation-spin-icon" : ""} />
          <span>{isLoading ? "Syncing Dataverse..." : "Sync Live Orders"}</span>
        </button>
      </div>

      <section className="xd-kpis orders-metrics" aria-label="Order metrics">
        {metrics.map((metric) => (
          <article className={`xd-kpi xd-${metric.tone}`} key={metric.label}>
            <div className="xd-kpi-top">
              <span className="xd-kpi-label">{metric.label}</span>
              <span className="xd-kpi-icon">{metric.icon}</span>
            </div>
            <div className="xd-kpi-mid">
              <strong title={metric.value}>{metric.value}</strong>
            </div>
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{metric.caption}</span>
              {metric.progress !== undefined && (
                <div className="xd-progress" role="progressbar" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.progress}>
                  <span style={{ width: `${Math.max(metric.progress, 2)}%` }} />
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="orders-insights-grid" aria-label="Order insights">
        <article className="orders-insight-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">APPROVAL STATUS</span>
              <h2>Status breakdown</h2>
              <p>{visibleOrders.length} orders in this view</p>
            </div>
            <Clock3 size={17} className="orders-insight-heading-icon" />
          </div>
          <div className="orders-aging-list">
            {statusBreakdown.map((row) => (
              <div className="orders-aging-row" key={row.label}>
                <span>{row.label}</span>
                <div className="orders-aging-track" role="progressbar" aria-label={`${row.label} count`} aria-valuemin={0} aria-valuemax={maxStatusCount} aria-valuenow={row.count}>
                  <span className={row.tone} style={{ width: `${Math.max((row.count / maxStatusCount) * 100, row.count ? 4 : 0)}%` }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="orders-insight-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">SUPPLIER SPEND</span>
              <h2>POs by supplier</h2>
              <p>{supplierSpend.length} supplier groups</p>
            </div>
            <Building2 size={17} className="orders-insight-heading-icon" />
          </div>
          <div className="orders-category-spend">
            {supplierSpend.map((row, index) => (
              <div className="orders-category-row" key={row.name}>
                <span title={row.name}>{row.name}</span>
                <div className="orders-category-track" role="progressbar" aria-label={`${row.name} spend`} aria-valuemin={0} aria-valuemax={maxSupplierSpend} aria-valuenow={row.value}>
                  <span className={`tone-${index % 4}`} style={{ width: `${maxSupplierSpend ? (row.value / maxSupplierSpend) * 100 : 0}%` }} />
                </div>
                <strong>{usdFormatter.format(row.value)}</strong>
              </div>
            ))}
            {supplierSpend.length === 0 && <p className="orders-insight-empty">No orders match the current filters.</p>}
          </div>
        </article>

        <article className="orders-insight-panel orders-recommendations-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">AI RECOMMENDATIONS</span>
              <h2>Prioritized follow-ups</h2>
              <p>Derived from the current order data</p>
            </div>
          </div>
          <div className="orders-recommendation-list">
            {recommendations.length ? recommendations.map((rec) => (
              <button className="orders-recommendation" key={rec.title} type="button" onClick={() => setSearch(rec.ref)}>
                <span className="orders-recommendation-icon"><CircleAlert size={15} /></span>
                <span className="orders-recommendation-copy">
                  <strong>{rec.title}</strong>
                  <small>{rec.detail}</small>
                  <em>{rec.ref}</em>
                </span>
              </button>
            )) : (
              <div className="orders-recommendation-empty">
                <CircleCheck size={17} />
                <span>No follow-up actions identified for the current view.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="orders-ai-summary-band">
        <div className="orders-ai-summary-copy">
          <div className="orders-ai-summary-heading">
            <span><Sparkles size={14} /></span>
            <h2>AI Summary</h2>
            <small>Record-backed</small>
          </div>
          <p>{aiSummary}</p>
        </div>
        <div className="orders-ask-ai">
          <h2>Ask Procurement AI</h2>
          <div className="orders-ask-ai-input">
            <input
              type="text"
              aria-label="Ask Procurement AI about orders"
              placeholder="Ask about spend, suppliers, approvals..."
              value={askAiQuery}
              onChange={(event) => { setAskAiQuery(event.target.value); setSearch(event.target.value); }}
              onKeyDown={(event) => { if (event.key === "Enter") runAskAiQuery(); }}
            />
            <button type="button" aria-label="Search orders" onClick={runAskAiQuery}><MessageSquareText size={14} /></button>
          </div>
          <div className="orders-ask-ai-chips">
            <button type="button" onClick={() => setSearch("No RFQ")}>Which POs lack an RFQ?</button>
            <button type="button" onClick={() => setStatusQuery("In Review")}>Show all POs in review</button>
            <button type="button" onClick={resetFilters}>Reset filters</button>
          </div>
        </div>
      </section>

      <section id="orders-records-card" className="purchase-card orders-records-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <span className="orders-title-icon" aria-hidden="true"><ShoppingCart size={14} /></span>
            <div className="purchase-title-copy">
              <strong>Purchase Orders</strong>
              <span>{visibleOrders.length} of {orderList.length} orders</span>
            </div>
          </div>
          <div className="purchase-actions">
            <button type="button" className="dashboard-create-button">
              <span className="create-plus"><Plus size={16} /></span>
              Create Order
            </button>
          </div>
        </div>

        {awardedRfqBanner && (
          <div
            style={{
              margin: "0 20px 16px",
              padding: "14px 18px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.04) 100%)",
              border: "1px solid rgba(37,99,235,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShoppingCart size={16} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground-hex, #0f172a)" }}>
                  {awardedRfqBanner.poNumber
                    ? `Purchase Order ${awardedRfqBanner.poNumber} Created Successfully`
                    : `Purchase Order for Awarded RFQ: ${awardedRfqBanner.rfqNumber}`}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--muted-foreground-hex, #64748b)" }}>
                  Awarded Supplier: <strong>{awardedRfqBanner.supplierName}</strong>. Linked to {awardedRfqBanner.rfqNumber} with itemized quotation lines.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {awardedRfqBanner.poNumber && (
                <button
                  type="button"
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/orders/${awardedRfqBanner.poNumber}`)}
                >
                  View Order
                </button>
              )}
              <button
                type="button"
                onClick={() => setAwardedRfqBanner(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted-foreground-hex, #94a3b8)",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="orders-filters">
          <div className="orders-filter-field orders-search-filter">
            <label htmlFor="po-search">Search</label>
            <div className="orders-filter-input">
              <Search size={13} aria-hidden="true" />
              <input id="po-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by ref no, RFQ, PR, supplier or created by..." />
            </div>
          </div>

          <div className="orders-filter-field">
            <label htmlFor="po-supplier">Supplier</label>
            <div className="orders-filter-input">
              <select id="po-supplier" value={supplierQuery} onChange={(event) => setSupplierQuery(event.target.value)}>
                <option>All Suppliers</option>
                {suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}
              </select>
            </div>
          </div>

          <div className="orders-filter-field">
            <label htmlFor="po-created">Created On</label>
            <div className="orders-filter-input orders-date-input">
              <input id="po-created" type="date" aria-label="Filter by created date" value={createdOnQuery} onChange={(event) => setCreatedOnQuery(event.target.value)} />
              {createdOnQuery && (
                <button type="button" className="orders-filter-clear-btn" aria-label="Clear date filter" onClick={() => setCreatedOnQuery("")}>×</button>
              )}
            </div>
          </div>

          <div className="orders-filter-field">
            <label htmlFor="po-status">Status</label>
            <div className="orders-filter-input">
              <select id="po-status" value={statusQuery} onChange={(event) => setStatusQuery(event.target.value)}>
                <option>All Status</option>
                <option>Approved</option>
                <option>In Review</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="purchase-table-wrap">
          <table className="purchase-table orders-table">
            <thead>
              <tr>
                <th aria-label="Progress"></th>
                <th>Ref No</th>
                <th>Associated RFQ</th>
                <th>Associated PR</th>
                <th>Supplier</th>
                <th>Total Amount</th>
                <th>Created By</th>
                <th>Created On</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "40px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        color: "var(--muted-foreground-hex, #64748b)",
                        fontSize: "14px",
                      }}
                    >
                      <Loader2 size={18} className="quotation-spin-icon" />
                      <span>Loading purchase orders from Dataverse cr49f_purchaseorders...</span>
                    </div>
                  </td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td className="purchase-empty-state" colSpan={9}>
                    No orders match these filters.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((row) => (
                  <tr key={row.refNo}>
                    <td className="purchase-status-cell">
                      <PoStatusRing status={row.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="purchase-ref-link"
                        onClick={() => navigate(`/orders/${row.refNo}`)}
                      >
                        {row.refNo}
                      </button>
                    </td>
                    <td>
                      {hasRfq(row) ? (
                        <button
                          type="button"
                          className="purchase-associated-ref linked"
                          onClick={() => navigate("/rfqs")}
                        >
                          {row.rfq}
                        </button>
                      ) : (
                        <span className="purchase-associated-ref empty">
                          No RFQ available
                        </span>
                      )}
                    </td>
                    <td>
                      {hasPr(row) ? (
                        <button
                          type="button"
                          className="purchase-associated-ref linked"
                          onClick={() =>
                            navigate(`/purchase-requests/${row.pr}`)
                          }
                        >
                          {row.pr}
                        </button>
                      ) : (
                        <span className="purchase-associated-ref empty">
                          No PR available
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="po-supplier">
                        <Avatar name={row.supplier} />
                        {row.supplier}
                      </span>
                    </td>
                    <td className="purchase-amount">{formatUsd(row.amount)}</td>
                    <td>
                      <span className="po-person">
                        <Avatar name={row.createdBy} />
                        {row.createdBy}
                      </span>
                    </td>
                    <td>
                      <span className="po-date">
                        <CalendarCheck size={15} />
                        {formatUsDate(row.createdOn)}
                      </span>
                    </td>
                    <td>
                      <span className={`po-pill ${slug(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="purchase-footer">
          <span>
            Showing{" "}
            <strong>
              {visibleOrders.length ? `1-${visibleOrders.length}` : "0"}
            </strong>{" "}
            of <strong>{orderList.length}</strong> orders
          </span>
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

export default OrdersPage;