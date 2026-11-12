import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Clock3,
  Coins,
  Download,
  FileText,
  Hourglass,
  LayoutGrid,
  LayoutList,
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

import { getInitials } from "../data/Purchaserequestsdata";
import {
  getAllOrders,
  generateNextPoNumber,
  saveCreatedOrder,
  type OrderRow,
  type OrderStatus,
} from "../data/OrdersData";
import { getDynamicPurchaseOrders } from "../Services/PurchaseOrderService";

import "../Styles/Styles.css";
import "../Styles/PurchaseRequest.css";
import "../Styles/RFQPage.css";
import "../Styles/OrdersPage.css";
import "../Styles/OrdersPagePlus.css";

const PAGE_SIZE = 10;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatUsd = (amount: number) =>
  `USD ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function formatUsDate(iso: string): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month}/${day}/${year}`;
  }
  return iso;
}

function formatFilterDate(iso: string): string {
  if (!iso) return "dd-mm-yyyy";
  const parts = iso.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return iso;
}

const hasRfq = (row: OrderRow) => row.rfq && row.rfq.startsWith("RFQ-");
const hasPr = (row: OrderRow) => row.pr && row.pr.startsWith("PR-");

function ProgressCircle({
  percentage,
  isApproved,
  isRejected,
}: {
  percentage: number;
  isApproved: boolean;
  isRejected?: boolean;
}) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color =
    isApproved || percentage === 100
      ? "#10b981"
      : isRejected
      ? "#ef4444"
      : percentage > 0
      ? "#f59e0b"
      : "#cbd5e1";

  return (
    <div className="pr-progress-circle-wrap">
      <svg
        width="42"
        height="42"
        viewBox="0 0 42 42"
        className="pr-progress-circle-svg"
      >
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth="3.5"
        />
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 21 21)"
        />
      </svg>
      <span
        className="pr-progress-circle-text"
        style={{
          color: isApproved ? "#10b981" : isRejected ? "#ef4444" : "#0f172a",
        }}
      >
        {percentage}%
      </span>
    </div>
  );
}

function MiniProgressStepper({
  status,
  isApproved,
}: {
  status: OrderStatus;
  isApproved: boolean;
}) {
  const step2Done = isApproved || status === "In Review";
  const step3Done = isApproved;
  const isRejected = status === "Rejected";

  return (
    <div className="pr-mini-stepper">
      <div className="pr-mini-stepper-track">
        <div className="pr-mini-node done" title="PO Created">
          <Check size={8} />
        </div>
        <div className={`pr-mini-line ${step2Done ? "done" : ""}`} />
        <div
          className={`pr-mini-node ${step2Done ? "done" : ""}`}
          title="In Review"
        >
          {step2Done ? <Check size={8} /> : <span className="inner-dot" />}
        </div>
        <div className={`pr-mini-line ${step3Done ? "done" : ""}`} />
        <div
          className={`pr-mini-node ${
            step3Done ? "done" : isRejected ? "rejected" : ""
          }`}
          title="Approved"
        >
          {step3Done ? (
            <Check size={8} />
          ) : isRejected ? (
            <X size={8} />
          ) : (
            <span className="inner-dot" />
          )}
        </div>
      </div>
      <div className="pr-mini-stepper-labels">
        <span>Created</span>
        <span>Review</span>
        <span>Approved</span>
      </div>
    </div>
  );
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

  const [search, setSearch] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("All Suppliers");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState("All Status");
  const [dateSortOrder, setDateSortOrder] = useState<"desc" | "asc">("desc");
  const [askAiQuery, setAskAiQuery] = useState("");

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"details" | "history" | "ai">("details");

  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState<boolean>(false);
  const [newPoSupplier, setNewPoSupplier] = useState<string>("");
  const [newPoAmount, setNewPoAmount] = useState<string>("");
  const [newPoRfq, setNewPoRfq] = useState<string>("");
  const [newPoPr, setNewPoPr] = useState<string>("");
  const [newPoStatus, setNewPoStatus] = useState<OrderStatus>("In Review");

  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDatePicker = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch {
        dateInputRef.current.focus();
      }
    }
  };

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

  const suppliers = useMemo(
    () => Array.from(new Set(orderList.map((row) => row.supplier))).filter(Boolean).sort(),
    [orderList]
  );

  const runAskAiQuery = () => {
    const query = askAiQuery.trim();
    if (!query) return;
    setSearch(query);
    setCurrentPage(1);
    document.getElementById("orders-records-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const resetFilters = () => {
    setSearch("");
    setAskAiQuery("");
    setSupplierQuery("All Suppliers");
    setCreatedOnQuery("");
    setStatusQuery("All Status");
    setCurrentPage(1);
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

      const matchesSearch = !query || haystack.includes(query);
      const matchesSupplier =
        supplierQuery === "All Suppliers" || row.supplier === supplierQuery;
      const matchesDate =
        !createdOnQuery || (row.createdOn && row.createdOn.startsWith(createdOnQuery));
      const matchesStatus =
        statusQuery === "All Status" || row.status === statusQuery;

      return matchesSearch && matchesSupplier && matchesDate && matchesStatus;
    });
  }, [orderList, search, supplierQuery, createdOnQuery, statusQuery]);

  const sortedOrders = useMemo(() => {
    return [...visibleOrders].sort((a, b) => {
      const dateA = new Date(a.createdOn).getTime() || 0;
      const dateB = new Date(b.createdOn).getTime() || 0;
      return dateSortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [visibleOrders, dateSortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = sortedOrders.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );
  const startRecord = sortedOrders.length ? (safeCurrentPage - 1) * PAGE_SIZE + 1 : 0;
  const endRecord = Math.min(safeCurrentPage * PAGE_SIZE, sortedOrders.length);

  /* ---------- Dynamic KPI figures derived directly from live Dataverse POs ---------- */
  const totalCount = orderList.length;
  const approvedCount = orderList.filter((row) => row.status === "Approved").length;
  const inReviewCount = orderList.filter((row) => row.status === "In Review").length;
  const rejectedCount = orderList.filter((row) => row.status === "Rejected").length;
  const approvedSpend = orderList
    .filter((row) => row.status === "Approved")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalSpend = orderList.reduce((sum, row) => sum + row.amount, 0);

  const metrics: {
    label: string;
    value: string;
    caption: string;
    progress?: number;
    icon: ReactNode;
    tone: string;
    filter: string;
  }[] = [
    {
      label: "Total POs",
      value: String(totalCount),
      caption: "Dataverse purchase orders",
      progress: 100,
      icon: <ClipboardList size={18} />,
      tone: "blue",
      filter: "All Status",
    },
    {
      label: "Approved POs",
      value: String(approvedCount),
      caption: totalCount
        ? `${Math.round((approvedCount / totalCount) * 100)}% of total`
        : "0%",
      progress: totalCount ? Math.round((approvedCount / totalCount) * 100) : 0,
      icon: <CircleCheck size={18} />,
      tone: "green",
      filter: "Approved",
    },
    {
      label: "POs In Review",
      value: String(inReviewCount),
      caption: totalCount
        ? `${Math.round((inReviewCount / totalCount) * 100)}% of total`
        : "0%",
      progress: totalCount ? Math.round((inReviewCount / totalCount) * 100) : 0,
      icon: <Hourglass size={18} />,
      tone: "amber",
      filter: "In Review",
    },
    {
      label: "Rejected POs",
      value: String(rejectedCount),
      caption: totalCount
        ? `${Math.round((rejectedCount / totalCount) * 100)}% of total`
        : "0%",
      progress: totalCount ? Math.round((rejectedCount / totalCount) * 100) : 0,
      icon: <CircleX size={18} />,
      tone: "red",
      filter: "Rejected",
    },
    {
      label: "Avg Approval Duration",
      value: "0.86 days",
      caption: "Submission to approval",
      icon: <Clock3 size={18} />,
      tone: "violet",
      filter: "All Status",
    },
    {
      label: "Issued PO Value",
      value: formatUsd(approvedSpend || totalSpend),
      caption: "Total value of approved POs",
      icon: <Coins size={18} />,
      tone: "cyan",
      filter: "Approved",
    },
  ];

  /* ---------- Dynamic insights from current view ---------- */
  const supplierTotals = new Map<string, number>();
  visibleOrders.forEach((row) =>
    supplierTotals.set(row.supplier, (supplierTotals.get(row.supplier) ?? 0) + row.amount)
  );
  const supplierSpend = Array.from(supplierTotals, ([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value);
  const maxSupplierSpend = supplierSpend[0]?.value ?? 0;

  const statusBreakdown: { label: string; count: number; tone: "fresh" | "watch" | "critical" }[] = [
    {
      label: "Approved",
      count: visibleOrders.filter((row) => row.status === "Approved").length,
      tone: "fresh",
    },
    {
      label: "In Review",
      count: visibleOrders.filter((row) => row.status === "In Review").length,
      tone: "watch",
    },
    {
      label: "Rejected",
      count: visibleOrders.filter((row) => row.status === "Rejected").length,
      tone: "critical",
    },
  ];
  const maxStatusCount = Math.max(...statusBreakdown.map((row) => row.count), 1);

  const unlinkedAll = orderList.filter((row) => !hasRfq(row) && !hasPr(row)).length;
  const recommendations: { title: string; detail: string; ref: string }[] = [];
  const unlinkedOrder = visibleOrders.find((row) => !hasRfq(row) && !hasPr(row));
  if (unlinkedOrder) {
    recommendations.push({
      title: `Link ${unlinkedOrder.refNo} to an RFQ or PR`,
      detail:
        "This purchase order has no RFQ or PR recorded in Dataverse — link it for an audit trail.",
      ref: unlinkedOrder.refNo,
    });
  }
  const largestPending = [...visibleOrders]
    .filter((row) => row.status === "In Review")
    .sort((a, b) => b.amount - a.amount)[0];
  if (largestPending) {
    recommendations.push({
      title: `Review ${largestPending.refNo}`,
      detail: `${usdFormatter.format(
        largestPending.amount
      )} is still in review — largest pending PO in this view.`,
      ref: largestPending.refNo,
    });
  }

  const aiSummary = `Of ${totalCount} purchase orders recorded in Dataverse cr49f_purchaseorders, ${approvedCount} are approved, ${inReviewCount} are in review and ${rejectedCount} rejected. Total issued PO value is ${formatUsd(
    approvedSpend || totalSpend
  )}. ${unlinkedAll} of the ${totalCount} orders loaded here ${
    unlinkedAll === 1 ? "has" : "have"
  } no linked RFQ or PR, which may affect audit traceability.`;

  const exportCsv = () => {
    const csvRows = [
      [
        "PO Number",
        "Status",
        "Associated RFQ",
        "Associated PR",
        "Supplier",
        "Total Amount",
        "Created By",
        "Created On",
      ],
      ...sortedOrders.map((row) => [
        row.refNo,
        row.status,
        row.rfq,
        row.pr,
        row.supplier,
        row.amount,
        row.createdBy,
        row.createdOn,
      ]),
    ];
    const csv = csvRows
      .map((r) =>
        r.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "purchase-orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoSupplier.trim()) return;

    const newPoNumber = generateNextPoNumber();
    const parsedAmount = parseFloat(newPoAmount) || 0;
    const nowIso = new Date().toISOString().split("T")[0];

    const newOrderRecord: OrderRow = {
      refNo: newPoNumber,
      rfq: newPoRfq.trim() || "No RFQ available",
      pr: newPoPr.trim() || "No PR available",
      supplier: newPoSupplier.trim(),
      amount: parsedAmount,
      createdBy: "Administrator",
      createdOn: nowIso,
      status: newPoStatus,
    };

    saveCreatedOrder(newOrderRecord);
    setIsCreateOrderOpen(false);
    setNewPoSupplier("");
    setNewPoAmount("");
    setNewPoRfq("");
    setNewPoPr("");
    void loadOrders();
    navigate(`/orders/${newPoNumber}`);
  };

  return (
    <main className="purchase-page orders-page">
      {/* Top Heading */}
      <div className="purchase-heading">
        <div>
          <h1>Purchase Orders</h1>
          <p>Manage and track all purchase orders across Dataverse cr49f_purchaseorders</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={isLoading}
            className="pr-btn-more-filters"
            title="Refresh orders from Dataverse"
          >
            <RefreshCw
              size={14}
              className={isLoading ? "quotation-spin-icon" : ""}
            />
            <span>{isLoading ? "Syncing Dataverse..." : "Sync Live Orders"}</span>
          </button>
        </div>
      </div>

      {/* KPI Band matching PR & RFQ */}
      <section className="xd-kpis orders-metrics" aria-label="Purchase order metrics">
        {metrics.map((metric) => (
          <article
            className={`xd-kpi xd-${metric.tone} purchase-stat ${
              statusQuery === metric.filter ? "selected" : ""
            }`}
            key={metric.label}
            role="button"
            tabIndex={0}
            aria-pressed={statusQuery === metric.filter}
            onClick={() => {
              setStatusQuery(metric.filter);
              setCurrentPage(1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStatusQuery(metric.filter);
                setCurrentPage(1);
              }
            }}
          >
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
                <div
                  className="xd-progress"
                  role="progressbar"
                  aria-label={metric.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={metric.progress}
                >
                  <span style={{ width: `${Math.max(metric.progress, 2)}%` }} />
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Insights Grid */}
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
                <div
                  className="orders-aging-track"
                  role="progressbar"
                  aria-label={`${row.label} count`}
                  aria-valuemin={0}
                  aria-valuemax={maxStatusCount}
                  aria-valuenow={row.count}
                >
                  <span
                    className={row.tone}
                    style={{
                      width: `${Math.max(
                        (row.count / maxStatusCount) * 100,
                        row.count ? 4 : 0
                      )}%`,
                    }}
                  />
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
            {supplierSpend.slice(0, 5).map((row, index) => (
              <div className="orders-category-row" key={row.name}>
                <span title={row.name}>{row.name}</span>
                <div
                  className="orders-category-track"
                  role="progressbar"
                  aria-label={`${row.name} spend`}
                  aria-valuemin={0}
                  aria-valuemax={maxSupplierSpend}
                  aria-valuenow={row.value}
                >
                  <span
                    className={`tone-${index % 4}`}
                    style={{
                      width: `${
                        maxSupplierSpend ? (row.value / maxSupplierSpend) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
                <strong>{usdFormatter.format(row.value)}</strong>
              </div>
            ))}
            {supplierSpend.length === 0 && (
              <p className="orders-insight-empty">
                No orders match the current filters.
              </p>
            )}
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
            {recommendations.length ? (
              recommendations.map((rec) => (
                <button
                  className="orders-recommendation"
                  key={rec.title}
                  type="button"
                  onClick={() => setSearch(rec.ref)}
                >
                  <span className="orders-recommendation-icon">
                    <CircleAlert size={15} />
                  </span>
                  <span className="orders-recommendation-copy">
                    <strong>{rec.title}</strong>
                    <small>{rec.detail}</small>
                    <em>{rec.ref}</em>
                  </span>
                </button>
              ))
            ) : (
              <div className="orders-recommendation-empty">
                <CircleCheck size={17} />
                <span>No follow-up actions identified for the current view.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* AI Summary Band */}
      <section className="orders-ai-summary-band">
        <div className="orders-ai-summary-copy">
          <div className="orders-ai-summary-heading">
            <span>
              <Sparkles size={14} />
            </span>
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
              onChange={(event) => {
                setAskAiQuery(event.target.value);
                setSearch(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") runAskAiQuery();
              }}
            />
            <button
              type="button"
              aria-label="Search orders"
              onClick={runAskAiQuery}
            >
              <MessageSquareText size={14} />
            </button>
          </div>
          <div className="orders-ask-ai-chips">
            <button type="button" onClick={() => setSearch("No RFQ")}>
              Which POs lack an RFQ?
            </button>
            <button type="button" onClick={() => setStatusQuery("In Review")}>
              Show all POs in review
            </button>
            <button type="button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </div>
      </section>

      {/* Modern Card Matching PR and RFQ Dashboard */}
      <section id="orders-records-card" className="pr-modern-card">
        {/* RFQ Award Notification Banner if navigated from RFQ Award */}
        {awardedRfqBanner && (
          <div
            style={{
              margin: "16px 18px 0",
              padding: "14px 18px",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.04) 100%)",
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
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--foreground-hex, #0f172a)",
                  }}
                >
                  {awardedRfqBanner.poNumber
                    ? `Purchase Order ${awardedRfqBanner.poNumber} Created Successfully`
                    : `Purchase Order for Awarded RFQ: ${awardedRfqBanner.rfqNumber}`}
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--muted-foreground-hex, #64748b)",
                  }}
                >
                  Awarded Supplier: <strong>{awardedRfqBanner.supplierName}</strong>. Linked to{" "}
                  {awardedRfqBanner.rfqNumber} with itemized quotation lines.
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
                    padding: "6px 14px",
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

        {/* Modern Filter Toolbar */}
        <div className="pr-modern-toolbar">
          {/* Search Box with sparkle */}
          <div className="pr-toolbar-search">
            <Search size={15} className="search-icon" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by PO ID, supplier, PR, RFQ, or creator..."
            />
            <Sparkles size={14} className="sparkle-icon" />
          </div>

          <div className="pr-toolbar-filters">
            {/* Created On Date Filter */}
            <div
              className={`pr-filter-date-badge ${createdOnQuery ? "has-filter" : ""}`}
              onClick={handleOpenDatePicker}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenDatePicker();
                }
              }}
              title={
                createdOnQuery
                  ? `Filtered by ${formatFilterDate(createdOnQuery)}. Click to change.`
                  : "Filter by Created Date"
              }
            >
              <Calendar size={14} className="cal-icon" />
              <div className="date-meta">
                <span className="date-label">Created On</span>
                <span className="date-value">
                  {createdOnQuery ? formatFilterDate(createdOnQuery) : "dd-mm-yyyy"}
                </span>
              </div>
              <input
                ref={dateInputRef}
                type="date"
                value={createdOnQuery}
                onChange={(e) => {
                  setCreatedOnQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    (e.target as HTMLInputElement).showPicker();
                  } catch {}
                }}
                className="pr-hidden-date-input"
                id="po-created-date-input"
                aria-label="Filter by Created Date"
                tabIndex={-1}
              />
              {createdOnQuery ? (
                <button
                  type="button"
                  className="pr-date-clear-btn"
                  title="Clear date filter"
                  aria-label="Clear date filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatedOnQuery("");
                    setCurrentPage(1);
                  }}
                >
                  <X size={12} />
                </button>
              ) : (
                <ChevronDown size={12} className="chevron-icon" />
              )}
            </div>

            {/* Supplier Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-filter-dropdown"
              >
                <option value="All Suppliers">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* Status Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={statusQuery}
                onChange={(e) => {
                  setStatusQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-filter-dropdown"
              >
                <option value="All Status">All Status</option>
                <option value="Approved">Approved</option>
                <option value="In Review">In Review</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* Date Sort Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={dateSortOrder}
                onChange={(e) => {
                  setDateSortOrder(e.target.value as "desc" | "asc");
                  setCurrentPage(1);
                }}
                className="pr-filter-dropdown"
                title="Sort by Created Date"
                aria-label="Sort by Created Date"
              >
                <option value="desc">Date: Newest First</option>
                <option value="asc">Date: Oldest First</option>
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* List / Grid View Toggle */}
            <div className="pr-view-toggle">
              <button
                type="button"
                className={`pr-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <LayoutList size={15} />
              </button>
              <button
                type="button"
                className={`pr-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              className="pr-btn-export"
              onClick={exportCsv}
              title="Export CSV"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {/* Create Order Button */}
            <button
              type="button"
              className="pr-btn-create"
              onClick={() => setIsCreateOrderOpen(true)}
            >
              <Plus size={15} />
              <span>Create Order</span>
            </button>
          </div>
        </div>

        {/* Content: Grid View or Modern Table View */}
        {viewMode === "grid" ? (
          <div className="pr-modern-grid-wrap">
            {paginatedOrders.map((row) => {
              const isApproved = row.status === "Approved";
              const isRejected = row.status === "Rejected";
              const progressPct = isApproved ? 100 : row.status === "In Review" ? 50 : 0;

              return (
                <div className="pr-grid-card" key={row.refNo}>
                  <div className="pr-grid-card-header">
                    <ProgressCircle
                      percentage={progressPct}
                      isApproved={isApproved}
                      isRejected={isRejected}
                    />
                    <div className="pr-grid-badges">
                      <span
                        className={`pr-status-badge ${
                          isApproved ? "approved" : isRejected ? "rejected" : "pending"
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>

                  <div className="pr-grid-card-body">
                    <strong
                      className="pr-grid-card-title"
                      onClick={() => navigate(`/orders/${row.refNo}`)}
                      title={row.refNo}
                    >
                      {row.refNo}
                    </strong>
                    <span className="pr-grid-card-ref">{row.supplier}</span>
                    <div className="pr-grid-amount">{formatUsd(row.amount)}</div>
                    <div className="pr-grid-meta-row">
                      <span>Created: {formatUsDate(row.createdOn)}</span>
                      <span>By: {row.createdBy}</span>
                    </div>
                  </div>

                  <div className="pr-grid-card-footer">
                    <button
                      type="button"
                      className="pr-grid-btn"
                      onClick={() => navigate(`/orders/${row.refNo}`)}
                    >
                      View Order Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pr-modern-table-wrap">
            <table className="pr-modern-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th style={{ width: 32 }}>#</th>
                  <th
                    style={{ width: "22%", cursor: "pointer", userSelect: "none" }}
                    onClick={() =>
                      setDateSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                    }
                    title={`Sorted by Created Date (${
                      dateSortOrder === "desc" ? "Newest First" : "Oldest First"
                    }). Click to toggle.`}
                  >
                    PO DETAILS{" "}
                    <span
                      className="sort-diamond"
                      style={{ color: "var(--primary-hex, #2563eb)", fontWeight: 700 }}
                    >
                      {dateSortOrder === "desc" ? "▼" : "▲"}
                    </span>
                  </th>
                  <th style={{ width: "11%" }}>
                    ASSOCIATED RFQ <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "11%" }}>
                    ASSOCIATED PR <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "14%" }}>
                    SUPPLIER <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>
                    TOTAL AMOUNT <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>
                    CREATED BY <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "9%" }}>
                    STATUS <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "9%" }}>PROGRESS</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="purchase-empty-state" colSpan={10}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "10px",
                          padding: "24px 0",
                        }}
                      >
                        <Loader2 size={18} className="quotation-spin-icon" />
                        <span>Loading purchase orders from Dataverse cr49f_purchaseorders...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedOrders.length ? (
                  paginatedOrders.map((row, index) => {
                    const isApproved = row.status === "Approved";
                    const isRejected = row.status === "Rejected";
                    const progressPct = isApproved ? 100 : row.status === "In Review" ? 50 : 0;
                    const isExpanded = expandedRowId === row.refNo;
                    const rowIndex = String(
                      (safeCurrentPage - 1) * PAGE_SIZE + index + 1
                    ).padStart(2, "0");

                    return (
                      <React.Fragment key={row.refNo}>
                        <tr className={`pr-row ${isExpanded ? "is-expanded" : ""}`}>
                          {/* 1. Chevron Toggle */}
                          <td className="pr-cell-chevron">
                            <button
                              type="button"
                              className="pr-chevron-btn"
                              onClick={() =>
                                setExpandedRowId(isExpanded ? null : row.refNo)
                              }
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                            >
                              <ChevronDown
                                size={14}
                                style={{
                                  transform: isExpanded
                                    ? "rotate(0deg)"
                                    : "rotate(-90deg)",
                                  transition: "transform 0.18s ease",
                                }}
                              />
                            </button>
                          </td>

                          {/* 2. Number */}
                          <td className="pr-cell-num">{rowIndex}</td>

                          {/* 3. PO Details */}
                          <td className="pr-cell-details">
                            <div className="pr-details-flex">
                              <ProgressCircle
                                percentage={progressPct}
                                isApproved={isApproved}
                                isRejected={isRejected}
                              />
                              <div className="pr-details-text">
                                <strong
                                  className="pr-details-title"
                                  onClick={() => navigate(`/orders/${row.refNo}`)}
                                  title={row.refNo}
                                >
                                  {row.refNo}
                                </strong>
                                <div className="pr-details-meta">
                                  <span
                                    className="pr-meta-ref"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/orders/${row.refNo}`);
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {row.supplier}
                                  </span>
                                  <span className="pr-meta-sep">•</span>
                                  <span className="pr-meta-date">
                                    Created {formatUsDate(row.createdOn)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Associated RFQ */}
                          <td className="pr-cell-rfq">
                            {hasRfq(row) ? (
                              <button
                                type="button"
                                className="pr-rfq-pill linked"
                                onClick={() => navigate(`/rfqs`)}
                                title={`View RFQ ${row.rfq}`}
                              >
                                <FileText size={12} />
                                <span>{row.rfq}</span>
                              </button>
                            ) : (
                              <span className="pr-rfq-pill empty">
                                <FileText size={12} />
                                <span>Not linked</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Associated PR */}
                          <td className="pr-cell-rfq">
                            {hasPr(row) ? (
                              <button
                                type="button"
                                className="pr-rfq-pill linked"
                                onClick={() =>
                                  navigate(`/purchase-requests/${row.pr}`)
                                }
                                title={`View PR ${row.pr}`}
                              >
                                <FileText size={12} />
                                <span>{row.pr}</span>
                              </button>
                            ) : (
                              <span className="pr-rfq-pill empty">
                                <FileText size={12} />
                                <span>Not linked</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Supplier */}
                          <td className="pr-cell-creator">
                            <div className="pr-creator-flex">
                              <span
                                className="pr-avatar-initials"
                                style={{ background: "#eff6ff", color: "#2563eb" }}
                              >
                                {getInitials(row.supplier)}
                              </span>
                              <div className="pr-creator-info">
                                <span className="pr-creator-name" title={row.supplier}>
                                  {row.supplier}
                                </span>
                                <span className="pr-creator-dept">Vendor</span>
                              </div>
                            </div>
                          </td>

                          {/* 7. Total Amount */}
                          <td className="pr-cell-amount">
                            <strong>{formatUsd(row.amount)}</strong>
                          </td>

                          {/* 8. Created By */}
                          <td className="pr-cell-creator">
                            <div className="pr-creator-flex">
                              <span className="pr-avatar-initials">
                                {getInitials(row.createdBy)}
                              </span>
                              <div className="pr-creator-info">
                                <span className="pr-creator-name">{row.createdBy}</span>
                                <span className="pr-creator-dept">Procurement</span>
                              </div>
                            </div>
                          </td>

                          {/* 9. Status */}
                          <td className="pr-cell-status">
                            <span
                              className={`pr-status-badge ${
                                isApproved
                                  ? "approved"
                                  : isRejected
                                  ? "rejected"
                                  : "pending"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>

                          {/* 10. Progress Stepper */}
                          <td className="pr-cell-stepper">
                            <MiniProgressStepper
                              status={row.status}
                              isApproved={isApproved}
                            />
                          </td>
                        </tr>

                        {/* EXPANDED ROW DETAIL DRAWER */}
                        {isExpanded && (
                          <tr className="pr-expanded-row">
                            <td colSpan={10}>
                              <div className="pr-detail-drawer">
                                {/* Drawer Header Tabs & Close */}
                                <div className="pr-drawer-header">
                                  <div className="pr-drawer-tabs">
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${
                                        activeDrawerTab === "details" ? "active" : ""
                                      }`}
                                      onClick={() => setActiveDrawerTab("details")}
                                    >
                                      Details
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${
                                        activeDrawerTab === "history" ? "active" : ""
                                      }`}
                                      onClick={() => setActiveDrawerTab("history")}
                                    >
                                      <Clock size={12} />
                                      <span>Order Summary</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ai ${
                                        activeDrawerTab === "ai" ? "active" : ""
                                      }`}
                                      onClick={() => setActiveDrawerTab("ai")}
                                    >
                                      <Sparkles size={12} />
                                      <span>✦ AI Insights</span>
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    className="pr-drawer-close-btn"
                                    onClick={() => setExpandedRowId(null)}
                                    aria-label="Close"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>

                                {/* Tab 1: Details */}
                                {activeDrawerTab === "details" && (
                                  <div className="pr-drawer-grid">
                                    {/* Left: Key Details */}
                                    <div className="pr-drawer-details-card">
                                      <div className="pr-drawer-meta-grid">
                                        <div className="pr-meta-row">
                                          <span className="label">PO Number</span>
                                          <strong className="val">
                                            <button
                                              type="button"
                                              className="pr-inline-link"
                                              onClick={() =>
                                                navigate(`/orders/${row.refNo}`)
                                              }
                                            >
                                              {row.refNo}
                                            </button>
                                          </strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Status</span>
                                          <strong className="val">{row.status}</strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Supplier</span>
                                          <strong className="val">{row.supplier}</strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Total Amount</span>
                                          <strong
                                            className="val"
                                            style={{ color: "#2563eb" }}
                                          >
                                            {formatUsd(row.amount)}
                                          </strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Associated RFQ</span>
                                          <span className="val">
                                            {row.rfq || "None"}
                                          </span>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Associated PR</span>
                                          <span className="val">
                                            {row.pr || "None"}
                                          </span>
                                        </div>

                                        <div className="pr-meta-row span-full">
                                          <span className="label">Created Date</span>
                                          <span className="val desc">
                                            {formatUsDate(row.createdOn)} by{" "}
                                            {row.createdBy}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Middle: AI Integrity Card */}
                                    <div className="pr-drawer-ai-card">
                                      <div className="pr-ai-card-title">
                                        <Sparkles size={15} />
                                        <span>AI Integrity Check</span>
                                      </div>
                                      <p className="pr-ai-card-text">
                                        {hasRfq(row) && hasPr(row)
                                          ? `Full audit trail verified across ${row.pr} → ${row.rfq} → ${row.refNo}. Pricing matches quotation records.`
                                          : hasRfq(row)
                                          ? `Linked to ${row.rfq}. Competitive quotations recorded in Dataverse.`
                                          : "Direct order without linked RFQ. Traceability status: standard standalone order."}
                                      </p>
                                      <button
                                        type="button"
                                        className="pr-ai-card-link"
                                        onClick={() =>
                                          navigate(`/orders/${row.refNo}`)
                                        }
                                      >
                                        View Full Order <ArrowRight size={13} />
                                      </button>
                                    </div>

                                    {/* Right: Supplier Card */}
                                    <div className="pr-drawer-vendors-card">
                                      <div className="pr-vendors-card-title">
                                        <Building2 size={15} />
                                        <span>Supplier Profile</span>
                                      </div>
                                      <div className="pr-vendors-card-list">
                                        <div className="pr-vendor-row">
                                          <div className="vendor-left">
                                            <span className="vendor-avatar">
                                              {getInitials(row.supplier)}
                                            </span>
                                            <div className="vendor-info">
                                              <strong className="vendor-name">
                                                {row.supplier}
                                              </strong>
                                              <span className="vendor-status">
                                                Active Supplier
                                              </span>
                                            </div>
                                          </div>
                                          <span
                                            className="vendor-score"
                                            style={{
                                              color: "#10b981",
                                              fontWeight: 700,
                                            }}
                                          >
                                            Verified
                                          </span>
                                        </div>
                                        <div
                                          style={{
                                            marginTop: "12px",
                                            paddingTop: "10px",
                                            borderTop: "1px solid #f1f5f9",
                                            fontSize: "11.5px",
                                            color: "#64748b",
                                          }}
                                        >
                                          Delivery Location:{" "}
                                          <strong>Main Office / Warehouse</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Tab 2: Order Summary */}
                                {activeDrawerTab === "history" && (
                                  <div
                                    className="pr-drawer-details-card"
                                    style={{ padding: "16px 20px" }}
                                  >
                                    <h3
                                      style={{
                                        margin: "0 0 10px",
                                        fontSize: "13.5px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      Order Lifecycle Summary
                                    </h3>
                                    <p
                                      style={{
                                        margin: "0 0 14px",
                                        fontSize: "12px",
                                        color: "#64748b",
                                      }}
                                    >
                                      Purchase Order {row.refNo} was created on{" "}
                                      {formatUsDate(row.createdOn)} by {row.createdBy}{" "}
                                      with an issued value of {formatUsd(row.amount)}.
                                      Current lifecycle status is {row.status}.
                                    </p>
                                    <button
                                      type="button"
                                      className="pr-btn-create"
                                      style={{
                                        fontSize: "12px",
                                        height: "34px",
                                        padding: "0 14px",
                                      }}
                                      onClick={() =>
                                        navigate(`/orders/${row.refNo}`)
                                      }
                                    >
                                      Open Full Order Details{" "}
                                      <ArrowRight size={13} />
                                    </button>
                                  </div>
                                )}

                                {/* Tab 3: AI Full Insights */}
                                {activeDrawerTab === "ai" && (
                                  <div className="pr-ai-full-grid">
                                    <div className="ai-stat-card">
                                      <span className="ai-label">Spend Compliance</span>
                                      <span className="ai-val green">
                                        100% Compliant
                                      </span>
                                      <small>Matched approved budget threshold</small>
                                    </div>
                                    <div className="ai-stat-card">
                                      <span className="ai-label">Payment Terms</span>
                                      <span className="ai-val highlight">Net 30</span>
                                      <small>Standard vendor agreement</small>
                                    </div>
                                    <div className="ai-stat-card">
                                      <span className="ai-label">
                                        Fulfillment Status
                                      </span>
                                      <span className="ai-val">Pending Delivery</span>
                                      <small>
                                        Tracked via Dataverse cr49f_purchaseorders
                                      </small>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td className="purchase-empty-state" colSpan={10}>
                      No purchase orders match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modern Pagination Footer */}
        <div className="purchase-footer">
          <span>
            Showing <strong>{startRecord}-{endRecord}</strong> of{" "}
            <strong>{sortedOrders.length}</strong> orders
          </span>
          <div className="purchase-pagination">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from(
              { length: Math.min(2, totalPages - safeCurrentPage + 1) },
              (_, i) => safeCurrentPage + i
            ).map((page) => (
              <button
                type="button"
                key={page}
                className={safeCurrentPage === page ? "selected" : ""}
                aria-current={safeCurrentPage === page ? "page" : undefined}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Create Order Modal */}
      {isCreateOrderOpen && (
        <div className="po-modal-overlay" onClick={() => setIsCreateOrderOpen(false)}>
          <div
            className="po-modal-container"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="po-modal-header">
              <h2>
                <ShoppingCart size={18} style={{ color: "#2563eb" }} />
                <span>Create Purchase Order</span>
              </h2>
              <button
                type="button"
                className="po-modal-close-btn"
                onClick={() => setIsCreateOrderOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit}>
              <div className="po-modal-body">
                <div className="po-form-group">
                  <label htmlFor="po-supplier-input">Supplier Name *</label>
                  <input
                    id="po-supplier-input"
                    type="text"
                    required
                    placeholder="e.g. Dell Inc., Logitech, ITC..."
                    value={newPoSupplier}
                    onChange={(e) => setNewPoSupplier(e.target.value)}
                  />
                </div>

                <div className="po-form-group">
                  <label htmlFor="po-amount-input">Total Order Value (USD) *</label>
                  <input
                    id="po-amount-input"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 15000.00"
                    value={newPoAmount}
                    onChange={(e) => setNewPoAmount(e.target.value)}
                  />
                </div>

                <div className="po-form-group">
                  <label htmlFor="po-rfq-input">Associated RFQ (Optional)</label>
                  <input
                    id="po-rfq-input"
                    type="text"
                    placeholder="e.g. RFQ-1006"
                    value={newPoRfq}
                    onChange={(e) => setNewPoRfq(e.target.value)}
                  />
                </div>

                <div className="po-form-group">
                  <label htmlFor="po-pr-input">Associated PR (Optional)</label>
                  <input
                    id="po-pr-input"
                    type="text"
                    placeholder="e.g. PR-1009"
                    value={newPoPr}
                    onChange={(e) => setNewPoPr(e.target.value)}
                  />
                </div>

                <div className="po-form-group">
                  <label htmlFor="po-status-select">Initial Status</label>
                  <select
                    id="po-status-select"
                    value={newPoStatus}
                    onChange={(e) => setNewPoStatus(e.target.value as OrderStatus)}
                  >
                    <option value="In Review">In Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="po-modal-footer">
                <button
                  type="button"
                  className="po-btn-secondary"
                  onClick={() => setIsCreateOrderOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="po-btn-primary">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default OrdersPage;
