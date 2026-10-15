import { useState } from "react";
import type { CSSProperties } from "react";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Building2,
  CircleCheck,
  CircleAlert,
  CircleDollarSign,
  CircleX,
  ClipboardList,
  Clock3,
  Download,
  Search,
  ShoppingCart,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import CreatePRModal from "../components/CreatePRModal";
import { PROCUREMENT_BUDGET_USD } from "../data/procurementBudget";

import {
  getInitials,
  purchaseRequests,
  type PRStatus,
  type PurchaseRequestRecord,
} from "./Purchaserequestsdata";

import "../Styles/PurchaseRequest.css";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const STATUS_PROGRESS: Record<PRStatus, number> = {
  "In Review": 50,
  Approved: 100,
  Rejected: 0,
};

function parseRequestDate(value?: string): Date | null {
  if (!value) return null;

  if (value.includes(",")) {
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }

  const usDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDate) {
    return new Date(Number(usDate[3]), Number(usDate[1]) - 1, Number(usDate[2]));
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function getRequestAmount(request: PurchaseRequestRecord): number | null {
  if (!request.totalAmount) return null;
  const amount = Number(request.totalAmount.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function getRequestAgeDays(request: PurchaseRequestRecord, today: Date): number | null {
  const createdDate = parseRequestDate(request.date);
  if (!createdDate) return null;
  createdDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / DAY_IN_MS));
}

function formatReviewDuration(days: number | null): string {
  if (days === null) return "Not available";
  const hours = days * 24;
  return hours < 24 ? `${hours.toFixed(1)} hours` : `${days.toFixed(1)} days`;
}

function isoToUsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

function StatusIndicator({ status }: { status: PRStatus }) {
  const progress = STATUS_PROGRESS[status];
  const statusClass = status.toLowerCase().replace(" ", "-");

  return (
    <span
      className={`purchase-status-indicator ${statusClass}`}
      role="img"
      aria-label={`${status}, ${progress}% complete`}
      title={`${status} · ${progress}% complete`}
      style={{ "--status-progress": `${progress}%` } as CSSProperties}
    >
      <span aria-hidden="true">{progress}<small>%</small></span>
    </span>
  );
}

export default function PurchaseRequest() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>(() => [...purchaseRequests]);
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState<"All Status" | PRStatus>("All Status");

  const filteredRequests = requests.filter((request) => {
    const haystack = [request.ref, request.title, request.rfq, request.po, request.createdBy, request.date, request.status].join(" ").toLowerCase();

    const matchesQuery = haystack.includes(tableQuery.trim().toLowerCase());
    const matchesCreatedOn = !createdOnQuery || request.date === isoToUsDate(createdOnQuery);
    const matchesStatus = statusQuery === "All Status" || request.status === statusQuery;

    return matchesQuery && matchesCreatedOn && matchesStatus;
  });

  const requestCounts = {
    total: requests.length,
    approved: requests.filter((request) => request.status === "Approved").length,
    review: requests.filter((request) => request.status === "In Review").length,
    rejected: requests.filter((request) => request.status === "Rejected").length,
  };
  const percentOfRequests = (count: number) => requestCounts.total ? Math.round((count / requestCounts.total) * 100) : 0;
  const stats = [
    { title: "Total Requests", value: requestCounts.total, type: "blue", icon: <ClipboardList size={18} />, caption: "All purchase requests", progress: 100, filter: "All Status" as const },
    { title: "Approved Requests", value: requestCounts.approved, type: "green", icon: <CircleCheck size={18} />, caption: `${percentOfRequests(requestCounts.approved)}% of requests`, progress: percentOfRequests(requestCounts.approved), filter: "Approved" as const },
    { title: "Requests in Review", value: requestCounts.review, type: "amber", icon: <Clock3 size={18} />, caption: `${percentOfRequests(requestCounts.review)}% of requests`, progress: percentOfRequests(requestCounts.review), filter: "In Review" as const },
    { title: "Rejected Requests", value: requestCounts.rejected, type: "red", icon: <CircleX size={18} />, caption: `${percentOfRequests(requestCounts.rejected)}% of requests`, progress: percentOfRequests(requestCounts.rejected), filter: "Rejected" as const },
  ];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const waitingRequests = filteredRequests.filter((request) => request.status === "In Review");
  const waitingAges = waitingRequests.map((request) => ({ request, days: getRequestAgeDays(request, today) }));
  const agingBuckets = [
    { label: "0-3 days", count: waitingAges.filter(({ days }) => days !== null && days <= 3).length, tone: "fresh" },
    { label: "4-7 days", count: waitingAges.filter(({ days }) => days !== null && days >= 4 && days <= 7).length, tone: "watch" },
    { label: "8-14 days", count: waitingAges.filter(({ days }) => days !== null && days >= 8 && days <= 14).length, tone: "late" },
    { label: "More than 14 days", count: waitingAges.filter(({ days }) => days !== null && days > 14).length, tone: "critical" },
  ];
  const overdueRequests = filteredRequests.filter((request) => {
    if (request.status !== "In Review") return false;
    const dueDate = parseRequestDate(request.requiredDate);
    return dueDate !== null && dueDate < today;
  });
  const reviewDurations = filteredRequests.flatMap((request) => {
    if (request.status !== "Approved" || !request.approvalSteps) return [];
    const createdStep = request.approvalSteps.find((step) => /^PR creation/i.test(step.title));
    const approvedStep = request.approvalSteps.find((step) => /^Approved$/i.test(step.title) && step.status === "Completed");
    const createdAt = parseRequestDate(createdStep?.date);
    const approvedAt = parseRequestDate(approvedStep?.date);
    if (!createdAt || !approvedAt || approvedAt < createdAt) return [];
    return [(approvedAt.getTime() - createdAt.getTime()) / DAY_IN_MS];
  });
  const averageReviewDays = reviewDurations.length
    ? reviewDurations.reduce((sum, duration) => sum + duration, 0) / reviewDurations.length
    : null;

  const spendRecords = filteredRequests.flatMap((request) => {
    const amount = getRequestAmount(request);
    return amount === null ? [] : [{ request, amount }];
  });
  const requestedSpend = spendRecords.reduce((sum, record) => sum + record.amount, 0);
  const approvedSpend = spendRecords.filter(({ request }) => request.status === "Approved").reduce((sum, record) => sum + record.amount, 0);
  const pendingSpend = spendRecords.filter(({ request }) => request.status === "In Review").reduce((sum, record) => sum + record.amount, 0);
  const spendByCategoryTotals = new Map<string, number>();
  spendRecords.forEach(({ request, amount }) => {
    const category = request.category?.trim() || request.department?.trim() || "Uncategorized";
    spendByCategoryTotals.set(category, (spendByCategoryTotals.get(category) ?? 0) + amount);
  });
  const spendByCategory = Array.from(spendByCategoryTotals, ([category, amount]) => ({ category, amount }))
    .sort((first, second) => second.amount - first.amount)
    .slice(0, 4);
  const largestCategorySpend = spendByCategory[0]?.amount ?? 0;
  const budgetShare = Math.min((requestedSpend / PROCUREMENT_BUDGET_USD) * 100, 100);

  const recommendations: Array<{ title: string; detail: string; request: PurchaseRequestRecord }> = [];
  const oldestOverdue = [...overdueRequests].sort((first, second) =>
    (getRequestAgeDays(second, today) ?? 0) - (getRequestAgeDays(first, today) ?? 0)
  )[0];
  if (oldestOverdue) {
    const age = getRequestAgeDays(oldestOverdue, today) ?? 0;
    recommendations.push({
      title: "Follow up on an overdue approval",
      detail: `${oldestOverdue.ref} has waited ${age} days and is past its required-by date (${oldestOverdue.requiredDate}).`,
      request: oldestOverdue,
    });
  }

  const approvedWithoutPO = filteredRequests.find((request) => request.status === "Approved" && !request.po.startsWith("PO-"));
  if (approvedWithoutPO) {
    recommendations.push({
      title: "Continue procurement for an approved PR",
      detail: `${approvedWithoutPO.ref} is approved but has no associated purchase order.`,
      request: approvedWithoutPO,
    });
  }

  const requestWithMissingDetails = filteredRequests.find((request) => {
    const missingAmount = getRequestAmount(request) === null;
    const missingDueDate = !request.requiredDate;
    const missingClassification = !request.category && !request.department;
    return missingAmount || missingDueDate || missingClassification;
  });
  if (requestWithMissingDetails) {
    const missingFields = [
      getRequestAmount(requestWithMissingDetails) === null ? "amount" : null,
      !requestWithMissingDetails.requiredDate ? "required-by date" : null,
      !requestWithMissingDetails.category && !requestWithMissingDetails.department ? "department or category" : null,
    ].filter((field): field is string => field !== null);
    recommendations.push({
      title: "Complete missing request details",
      detail: `${requestWithMissingDetails.ref} is missing ${missingFields.join(" and ")}.`,
      request: requestWithMissingDetails,
    });
  }

  if (recommendations.length === 0 && waitingRequests.length > 0) {
    const oldestWaiting = [...waitingRequests].sort((first, second) =>
      (getRequestAgeDays(second, today) ?? 0) - (getRequestAgeDays(first, today) ?? 0)
    )[0];
    if (oldestWaiting) {
      recommendations.push({
        title: "Review the oldest pending request",
        detail: `${oldestWaiting.ref} has been waiting ${getRequestAgeDays(oldestWaiting, today) ?? 0} days for review.`,
        request: oldestWaiting,
      });
    }
  }

  const handleRequestCreated = () => {
    setRequests([...purchaseRequests]);
    setTableQuery("");
    setCreatedOnQuery("");
    setStatusQuery("All Status");
  };

  return (
    <div className="purchase-page">
      <div className="purchase-heading">
        <div>
          <h1>Purchase Requests</h1>
          <p>Manage and track all purchase requests</p>
        </div>
      </div>

      <section className="xd-kpis purchase-stats" aria-label="Purchase request metrics">
        {stats.map((stat) => (
          <article
            className={`xd-kpi xd-${stat.type} purchase-stat ${statusQuery === stat.filter ? "selected" : ""}`}
            key={stat.title}
            role="button"
            tabIndex={0}
            aria-label={`${stat.title}: ${stat.value}. Filter requests by ${stat.filter === "All Status" ? "all statuses" : stat.filter}`}
            aria-pressed={statusQuery === stat.filter}
            onClick={() => setStatusQuery(stat.filter)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStatusQuery(stat.filter);
              }
            }}
          >
            <div className="xd-kpi-top">
              <span className="xd-kpi-label">{stat.title}</span>
              <span className="xd-kpi-icon">{stat.icon}</span>
            </div>
            <div className="xd-kpi-mid">
              <strong>{stat.value}</strong>
            </div>
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{stat.caption}</span>
              <div className="xd-progress" role="progressbar" aria-label={stat.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stat.progress}>
                <span style={{ width: `${Math.max(stat.progress, 2)}%` }} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="pr-insights-grid" aria-label="Request insights">
        <article className="pr-insight-panel pr-aging-panel">
          <div className="pr-insight-heading">
            <div>
              <span className="pr-insight-kicker">WAITING TIME</span>
              <h2>Request aging</h2>
              <p>{waitingRequests.length} requests in review</p>
            </div>
            <span className={`pr-overdue-count ${overdueRequests.length ? "active" : ""}`}>
              <CircleAlert size={13} />{overdueRequests.length} overdue
            </span>
          </div>

          <div className="pr-review-average">
            <span><Clock3 size={14} />Average review time</span>
            <strong>{formatReviewDuration(averageReviewDays)}</strong>
            <small>{reviewDurations.length ? `From ${reviewDurations.length} completed approval${reviewDurations.length === 1 ? "" : "s"} with timestamps` : "No completed approvals have dated milestones"}</small>
          </div>

          <div className="pr-aging-list">
            {agingBuckets.map((bucket) => (
              <div className="pr-aging-row" key={bucket.label}>
                <span>{bucket.label}</span>
                <div className="pr-aging-track" role="progressbar" aria-label={`${bucket.label} waiting requests`} aria-valuemin={0} aria-valuemax={Math.max(waitingRequests.length, 1)} aria-valuenow={bucket.count}>
                  <span className={bucket.tone} style={{ width: `${waitingRequests.length ? (bucket.count / waitingRequests.length) * 100 : 0}%` }} />
                </div>
                <strong>{bucket.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="pr-insight-panel pr-spend-panel">
          <div className="pr-insight-heading">
            <div>
              <span className="pr-insight-kicker">CURRENT SCOPE</span>
              <h2>Spend intelligence</h2>
              <p>{spendRecords.length} requests with recorded amounts</p>
            </div>
            <CircleDollarSign size={19} className="pr-insight-heading-icon" />
          </div>

          <div className="pr-spend-summary">
            <div className="requested">
              <span>Total requested</span>
              <strong>{usdFormatter.format(requestedSpend)}</strong>
            </div>
            <div>
              <span>Approved value</span>
              <strong>{usdFormatter.format(approvedSpend)}</strong>
            </div>
            <div>
              <span>Pending approval</span>
              <strong>{usdFormatter.format(pendingSpend)}</strong>
            </div>
          </div>

          <div className="pr-category-spend">
            <div className="pr-chart-label"><Building2 size={13} />Spend by category</div>
            {spendByCategory.length ? spendByCategory.map((category, index) => (
              <div className="pr-category-row" key={category.category}>
                <span title={category.category}>{category.category}</span>
                <div className="pr-category-track" role="progressbar" aria-label={`${category.category} spend`} aria-valuemin={0} aria-valuemax={largestCategorySpend} aria-valuenow={category.amount}>
                  <span className={`tone-${index}`} style={{ width: `${largestCategorySpend ? (category.amount / largestCategorySpend) * 100 : 0}%` }} />
                </div>
                <strong>{usdFormatter.format(category.amount)}</strong>
              </div>
            )) : <p className="pr-insight-empty">No request amounts in this view.</p>}
          </div>

          <div className="pr-budget-context">
            <div><span>Dashboard allocation</span><strong>{usdFormatter.format(PROCUREMENT_BUDGET_USD)}</strong></div>
            <div className="pr-budget-track" role="progressbar" aria-label="Requested value as a share of dashboard allocation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budgetShare}>
              <span style={{ width: `${Math.max(budgetShare, requestedSpend ? 0.5 : 0)}%` }} />
            </div>
            <small>{budgetShare.toFixed(2)}% represented by requests in this view</small>
          </div>
        </article>

        <article className="pr-insight-panel pr-recommendations-panel">
          <div className="pr-insight-heading">
            <div>
              <span className="pr-insight-kicker">RECORD-BASED FOLLOW-UP</span>
              <h2>Action recommendations</h2>
              <p>Prioritized from the current request data</p>
            </div>
          </div>

          <div className="pr-recommendation-list">
            {recommendations.length ? recommendations.map((recommendation) => (
              <button
                className="pr-recommendation"
                key={`${recommendation.request.ref}-${recommendation.title}`}
                type="button"
                onClick={() => navigate(`/purchase-requests/${recommendation.request.ref}`)}
              >
                <span className="pr-recommendation-icon"><CircleAlert size={15} /></span>
                <span className="pr-recommendation-copy">
                  <strong>{recommendation.title}</strong>
                  <small>{recommendation.detail}</small>
                  <em>{recommendation.request.ref}</em>
                </span>
                <ArrowRight size={15} />
              </button>
            )) : (
              <div className="pr-recommendation-empty">
                <CircleCheck size={17} />
                <span>No follow-up actions identified for the current view.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="purchase-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <ShoppingCart size={12} />
            <div className="purchase-title-copy">
              <strong>Purchase Requests</strong>
              <span>{filteredRequests.length} of {requests.length} rows</span>
            </div>
          </div>

          <div className="purchase-actions">
            <button type="button" className="export-button" aria-label="Export">
              <Download size={12} />
            </button>
            <button type="button" className="dashboard-create-button" onClick={() => setIsCreatePROpen(true)}>
              <span className="create-plus">+</span>
              Create Purchase Request
            </button>
          </div>
        </div>

        <div className="pr-filters">
          <div className="filter-field search-filter-field">
            <label>Search</label>
            <div className="filter-input">
              <Search size={13} />
              <input
                value={tableQuery}
                onChange={(event) => setTableQuery(event.target.value)}
                placeholder="Search by ref no, title, RFQ, PO or created by..."
              />
            </div>
          </div>
          <div className="filter-field">
            <label>Created On</label>
            <div className="filter-input filter-date-control">
              <input
                type="date"
                value={createdOnQuery}
                onChange={(event) => setCreatedOnQuery(event.target.value)}
                aria-label="Created On"
              />
            </div>
          </div>
          <div className="filter-field">
            <label>Status</label>
            <div className="filter-input">
              <select value={statusQuery} onChange={(event) => setStatusQuery(event.target.value as "All Status" | PRStatus)}>
                <option>All Status</option>
                <option>In Review</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
              <ChevronDown size={11} />
            </div>
          </div>
        </div>

        <div className="purchase-table-wrap">
          <table className="purchase-table">
            <thead>
              <tr>
                <th aria-label="Status"></th>
                <th>ID & Title</th>
                <th>PR Amount</th>
                <th>Associated RFQ</th>
                <th>Associated PO</th>
                <th>Created By</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => {
                const priority = request.priority ?? "Normal";
                return (
                <tr key={request.ref}>
                  <td className="purchase-status-cell"><StatusIndicator status={request.status} /></td>
                  <td className="purchase-subject-cell">
                    <strong className="purchase-request-title">{request.title}</strong>
                    <div className="purchase-subject-meta">
                      <button type="button" className="purchase-ref-link" onClick={() => navigate(`/purchase-requests/${request.ref}`)}>{request.ref}</button>
                      <span>Created {request.date}</span>
                    </div>
                  </td>
                  <td className="purchase-amount">{request.totalAmount || "—"}</td>
                  <td>
                    {request.rfq.startsWith("RFQ-") ? (
                      <button type="button" className="purchase-associated-ref linked" onClick={() => navigate("/rfqs")}>
                        {request.rfq}
                      </button>
                    ) : <span className="purchase-associated-ref empty">Not Available</span>}
                  </td>
                  <td>
                    {request.po.startsWith("PO-") ? (
                      <button type="button" className="purchase-associated-ref linked" onClick={() => navigate("/orders")}>
                        {request.po}
                      </button>
                    ) : <span className="purchase-associated-ref empty">Not Available</span>}
                  </td>
                  <td>
                    <span className="creator-pill">
                      <span>{getInitials(request.createdBy)}</span>
                      {request.createdBy}
                    </span>
                  </td>
                  <td><span className={`purchase-priority ${priority.toLowerCase()}`}>{priority}</span></td>
                </tr>
                );
              })}
              {filteredRequests.length === 0 && (
                <tr>
                  <td className="purchase-empty-state" colSpan={7}>No purchase requests match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="purchase-footer">
          <span>Showing <strong>{filteredRequests.length ? `1-${filteredRequests.length}` : "0"}</strong> of <strong>{requests.length}</strong> results</span>
          <div className="purchase-pagination">
            <button type="button"><ChevronLeft size={11} /></button>
            <button type="button" className="selected">1</button>
            <button type="button"><ChevronRight size={11} /></button>
          </div>
        </div>
      </section>


      {isCreatePROpen && <CreatePRModal onCreate={handleRequestCreated} onClose={() => setIsCreatePROpen(false)} />}
    </div>
  );
}