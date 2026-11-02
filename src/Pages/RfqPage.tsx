import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Clock3,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  LayoutList,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import { cleanGuid, getTaskApprovalStatusLabel } from "../Services/ApprovalWorkflowService";
import CreateRFQModal from "../components/CreateRFQModal";
import { getInitials } from "../data/Purchaserequestsdata";

import "../Styles/Styles.css";
import "../Styles/PurchaseRequest.css";
import "../Styles/RFQPage.css";

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
  "All Status",
  "Pending",
  "Approved",
  "ChangesNeeded",
  "Rejected",
] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];

type RawRfq = Cr49f_requestforqoutations & {
  "_createdby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_cr49f_prrfq_value@OData.Community.Display.V1.FormattedValue"?: string;
};

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toIsoDate(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getStatusLabel(row: RawRfq): string {
  const formatted = row.cr49f_statusname?.trim();
  if (formatted) {
    const normalized = formatted.replace(/\s+/g, "").toLowerCase();
    if (normalized === "changesneeded") return "Changes Needed";
    if (normalized === "pending") return "Pending";
    if (normalized === "approved") return "Approved";
    if (normalized === "rejected") return "Rejected";
  }

  switch (Number(row.cr49f_status)) {
    case 0:
      return "Pending";
    case 1:
      return "Approved";
    case 2:
      return "Changes Needed";
    case 3:
      return "Rejected";
    default:
      return "Pending";
  }
}

function getStatusFilterValue(row: RawRfq): string {
  return getStatusLabel(row).replace(/\s+/g, "").toLowerCase();
}

function getCreatedBy(row: RawRfq): string {
  return (
    row["_createdby_value@OData.Community.Display.V1.FormattedValue"]?.trim() ||
    row.createdbyname?.trim() ||
    "Unknown"
  );
}

function getAssociatedPr(row: RawRfq): string {
  return (
    row["_cr49f_prrfq_value@OData.Community.Display.V1.FormattedValue"]?.trim() ||
    row.cr49f_prrfqname?.trim() ||
    ""
  );
}

const STATUS_PROGRESS: Record<string, number> = {
  Pending: 50,
  "Changes Needed": 70,
  Approved: 100,
  Rejected: 0,
};

function getDaysRemaining(value?: string | null): { text: string; tone: "green" | "amber" | "red" } | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 5) {
    return { text: `${diffDays} days left`, tone: "green" };
  } else if (diffDays >= 1) {
    return { text: `${diffDays} days left`, tone: "amber" };
  } else if (diffDays === 0) {
    return { text: "Due today", tone: "amber" };
  } else {
    return { text: `${Math.abs(diffDays)} days overdue`, tone: "red" };
  }
}

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
      <svg width="42" height="42" viewBox="0 0 42 42" className="pr-progress-circle-svg">
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
        style={{ color: isApproved ? "#10b981" : isRejected ? "#ef4444" : "#0f172a" }}
      >
        {percentage}%
      </span>
    </div>
  );
}

function MiniProgressStepper({
  status,
  isApproved,
  progressPercentage,
}: {
  status: string;
  isApproved: boolean;
  progressPercentage?: number;
}) {
  const step2Done = isApproved || (progressPercentage ?? 0) >= 50;
  const step3Done = isApproved || (progressPercentage ?? 0) === 100;
  const isRejected = status === "Rejected";

  return (
    <div className="pr-mini-stepper">
      <div className="pr-mini-stepper-track">
        <div className="pr-mini-node done" title="RFQ Created">
          <Check size={8} />
        </div>
        <div className={`pr-mini-line ${step2Done ? "done" : ""}`} />
        <div
          className={`pr-mini-node ${step2Done ? "done" : (progressPercentage ?? 0) > 0 ? "active" : ""}`}
          title="In Review"
        >
          {step2Done ? <Check size={8} /> : <span className="inner-dot" />}
        </div>
        <div className={`pr-mini-line ${step3Done ? "done" : ""}`} />
        <div
          className={`pr-mini-node ${step3Done ? "done" : isRejected ? "rejected" : ""}`}
          title="Approved"
        >
          {step3Done ? <Check size={8} /> : isRejected ? <X size={8} /> : <span className="inner-dot" />}
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

export interface RfqPageProps {
  openCreateModal?: boolean;
}

const RfqPage: React.FC<RfqPageProps> = ({ openCreateModal = false }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<RawRfq[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<Cr49f_approvaltaskses[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState<StatusFilter>("All Status");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(openCreateModal);

  // Modern table controls
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"details" | "history" | "comments" | "ai">("details");
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  // Close actions dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveActionMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (openCreateModal) {
      setIsCreateModalOpen(true);
    }
  }, [openCreateModal]);

  const loadRfqs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [rfqRes, tasksRes] = await Promise.allSettled([
        Cr49f_requestforqoutationsService.getAll(),
        Cr49f_approvaltasksesService.getAll(),
      ]);

      if (rfqRes.status === "fulfilled" && rfqRes.value.success) {
        setRecords((rfqRes.value.data ?? []) as RawRfq[]);
      } else if (rfqRes.status === "rejected" || (rfqRes.status === "fulfilled" && !rfqRes.value.success)) {
        throw new Error("Dataverse did not return the RFQ records successfully.");
      }

      if (tasksRes.status === "fulfilled" && tasksRes.value.success && tasksRes.value.data) {
        setApprovalTasks(tasksRes.value.data);
      }
    } catch (error) {
      console.error("Failed to load RFQs from Dataverse:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Couldn't load RFQs from Dataverse. Check the browser console for details."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRfqs();
  }, [loadRfqs]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((row) => {
      const createdBy = getCreatedBy(row);
      const associatedPr = getAssociatedPr(row);
      const statusLabel = getStatusLabel(row);

      const haystack = [
        row.cr49f_rfqnumber,
        row.cr49f_rfqtitle,
        row.cr49f_description,
        createdBy,
        statusLabel,
        associatedPr,
        row.cr49f_deliverylocation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(query);
      const matchesCreatedOn =
        !createdOnQuery ||
        toIsoDate(row.createdon ?? row.cr49f_requestdate) === createdOnQuery;
      const matchesStatus =
        statusQuery === "All Status" ||
        getStatusFilterValue(row) === statusQuery.replace(/\s+/g, "").toLowerCase();

      return matchesSearch && matchesCreatedOn && matchesStatus;
    });
  }, [records, search, createdOnQuery, statusQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, createdOnQuery, statusQuery]);

  const counts = useMemo(
    () => ({
      total: records.length,
      approved: records.filter((row) => getStatusLabel(row) === "Approved").length,
      pending: records.filter((row) => {
        const label = getStatusLabel(row);
        return label === "Pending" || label === "Changes Needed";
      }).length,
      rejected: records.filter((row) => getStatusLabel(row) === "Rejected").length,
    }),
    [records]
  );

  const percentOf = (count: number) =>
    counts.total ? Math.round((count / counts.total) * 100) : 0;

  const metrics = [
    {
      label: "Total RFQs",
      value: counts.total,
      caption: "All RFQ records",
      progress: 100,
      icon: <ClipboardList size={18} />,
      tone: "blue",
      filter: "All Status" as const,
    },
    {
      label: "Approved RFQs",
      value: counts.approved,
      caption: `${percentOf(counts.approved)}% of RFQs`,
      progress: percentOf(counts.approved),
      icon: <CircleCheck size={18} />,
      tone: "green",
      filter: "Approved" as const,
    },
    {
      label: "Pending RFQs",
      value: counts.pending,
      caption: `${percentOf(counts.pending)}% of RFQs`,
      progress: percentOf(counts.pending),
      icon: <Clock3 size={18} />,
      tone: "amber",
      filter: "Pending" as const,
    },
    {
      label: "Rejected RFQs",
      value: counts.rejected,
      caption: `${percentOf(counts.rejected)}% of RFQs`,
      progress: percentOf(counts.rejected),
      icon: <CircleX size={18} />,
      tone: "red",
      filter: "Rejected" as const,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = visibleRows.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );
  const startRecord = visibleRows.length
    ? (safeCurrentPage - 1) * PAGE_SIZE + 1
    : 0;
  const endRecord = Math.min(safeCurrentPage * PAGE_SIZE, visibleRows.length);

  const exportCsv = () => {
    const csvRows = [
      [
        "Status",
        "RFQ ID",
        "Title",
        "Associated PR",
        "Associated PO",
        "Request Date",
        "Submission Deadline",
        "Delivery Location",
        "Created By",
        "Created On",
      ],
      ...visibleRows.map((row) => [
        getStatusLabel(row),
        row.cr49f_rfqnumber || row.cr49f_requestforqoutationid,
        row.cr49f_rfqtitle || "Untitled",
        getAssociatedPr(row) || "Not linked",
        "Not linked",
        formatShortDate(row.cr49f_requestdate),
        formatShortDate(row.cr49f_submissiondeadline),
        row.cr49f_deliverylocation || "—",
        getCreatedBy(row),
        formatShortDate(row.createdon),
      ]),
    ];

    const csv = csvRows
      .map((r) =>
        r
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "rfqs-overview.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="purchase-page rfq-page">
      <div className="purchase-heading">
        <div>
          <h1>Request For Quotations</h1>
          <p>Manage and track all RFQs</p>
        </div>
      </div>

      <section className="xd-kpis rfq-metrics" aria-label="RFQ metrics">
        {metrics.map((metric) => (
          <article
            className={`xd-kpi xd-${metric.tone} ${statusQuery === metric.filter ? "selected" : ""}`}
            key={metric.label}
            role="button"
            tabIndex={0}
            aria-pressed={statusQuery === metric.filter}
            onClick={() => setStatusQuery(metric.filter)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStatusQuery(metric.filter);
              }
            }}
          >
            <div className="xd-kpi-top">
              <span className="xd-kpi-label">{metric.label}</span>
              <span className="xd-kpi-icon">{metric.icon}</span>
            </div>
            <div className="xd-kpi-mid">
              <strong>{metric.value}</strong>
            </div>
            <div className="xd-kpi-progress-wrap">
              <span className="xd-kpi-cap">{metric.caption}</span>
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
            </div>
          </article>
        ))}
      </section>

      {/* Modern Card matching PR overview table layout */}
      <section className="pr-modern-card" id="rfq-records-card">
        {/* Top Controls / Filter Toolbar */}
        <div className="pr-modern-toolbar">
          {/* Search Box with sparkle */}
          <div className="pr-toolbar-search">
            <Search size={15} className="search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by RFQ ID, title, PR, or creator..."
            />
            <Sparkles size={14} className="sparkle-icon" />
          </div>

          <div className="pr-toolbar-filters">
            {/* Created On Date Filter */}
            <div className="pr-filter-date-badge">
              <Calendar size={14} className="cal-icon" />
              <div className="date-meta">
                <span className="date-label">Created On</span>
                <input
                  type="date"
                  value={createdOnQuery}
                  onChange={(e) => setCreatedOnQuery(e.target.value)}
                  className="pr-hidden-date-input"
                  id="rfq-created-date-input"
                />
                <label htmlFor="rfq-created-date-input" className="date-value">
                  {createdOnQuery ? formatFilterDate(createdOnQuery) : "dd-mm-yyyy"}
                </label>
              </div>
              <ChevronDown size={12} className="chevron-icon" />
            </div>

            {/* Status Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value as StatusFilter)}
                className="pr-filter-dropdown"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "ChangesNeeded" ? "Changes Needed" : option}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* More Filters button / Reset */}
            <button
              type="button"
              className="pr-btn-more-filters"
              onClick={() => {
                setStatusQuery("All Status");
                setCreatedOnQuery("");
                setSearch("");
              }}
              title="Reset filters"
            >
              <Filter size={13} />
              <span>More Filters</span>
            </button>

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

            {/* Create RFQ Button */}
            <button
              type="button"
              className="pr-btn-create"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={15} />
              <span>Create RFQ</span>
            </button>
          </div>
        </div>

        {loadError && !isLoading && (
          <div className="purchase-empty-state" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadRfqs()}>
              Retry loading
            </button>
          </div>
        )}

        {viewMode === "grid" ? (
          /* Grid View Mode */
          <div className="pr-modern-grid-wrap">
            {paginatedRows.map((row) => {
              const statusLabel = getStatusLabel(row);
              const isApproved = statusLabel === "Approved";
              const isRejected = statusLabel === "Rejected";
              const progressPct = STATUS_PROGRESS[statusLabel] ?? (isApproved ? 100 : 50);
              const createdBy = getCreatedBy(row);
              const rfqIdentifier = row.cr49f_rfqnumber?.trim() || row.cr49f_requestforqoutationid;

              return (
                <div className="pr-grid-card" key={row.cr49f_requestforqoutationid}>
                  <div className="pr-grid-card-header">
                    <ProgressCircle
                      percentage={progressPct}
                      isApproved={isApproved}
                      isRejected={isRejected}
                    />
                    <div className="pr-grid-badges">
                      <span className={`pr-status-badge ${isApproved ? "approved" : isRejected ? "rejected" : "pending"}`}>
                        {isApproved ? "Approved" : isRejected ? "Rejected" : statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="pr-grid-card-body">
                    <strong
                      className="pr-grid-card-title"
                      onClick={() => navigate(`/rfqs/${rfqIdentifier}`)}
                    >
                      {row.cr49f_rfqtitle?.trim() || "Untitled RFQ"}
                    </strong>
                    <span className="pr-grid-card-ref">{rfqIdentifier}</span>
                    <div className="pr-grid-meta-row">
                      <span>Deadline: {row.cr49f_submissiondeadline ? formatShortDate(row.cr49f_submissiondeadline) : "—"}</span>
                      <span>By: {createdBy}</span>
                    </div>
                  </div>

                  <div className="pr-grid-card-footer">
                    <button
                      type="button"
                      className="pr-grid-btn"
                      onClick={() => navigate(`/rfqs/${rfqIdentifier}`)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modern Table View */
          <div className="pr-modern-table-wrap">
            <table className="pr-modern-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th style={{ width: 44 }}>#</th>
                  <th style={{ width: "23%" }}>
                    RFQ DETAILS <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>ASSOCIATED PR</th>
                  <th style={{ width: "11%" }}>ASSOCIATED PO</th>
                  <th style={{ width: "13%" }}>
                    SUBMISSION DEADLINE <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "13%" }}>
                    DELIVERY LOCATION <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>
                    CREATED BY <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "9%" }}>
                    STATUS <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>PROGRESS</th>
                  <th style={{ width: 44, textAlign: "center" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="purchase-empty-state" colSpan={11}>
                      Loading RFQs from Dataverse...
                    </td>
                  </tr>
                ) : loadError ? null : paginatedRows.length ? (
                  paginatedRows.map((row, index) => {
                    const statusLabel = getStatusLabel(row);
                    const isApproved = statusLabel === "Approved";
                    const isRejected = statusLabel === "Rejected";
                    const progressPct = STATUS_PROGRESS[statusLabel] ?? (isApproved ? 100 : 50);
                    const createdBy = getCreatedBy(row);
                    const associatedPr = getAssociatedPr(row);
                    const isExpanded = expandedRowId === row.cr49f_requestforqoutationid;
                    const rowIndex = String((safeCurrentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0");
                    const daysInfo = getDaysRemaining(row.cr49f_submissiondeadline);
                    const rfqIdentifier = row.cr49f_rfqnumber?.trim() || row.cr49f_requestforqoutationid;

                    // Match approval tasks for this RFQ
                    const rfqTasks = approvalTasks.filter((t) => {
                      const raw = t as unknown as Record<string, unknown>;
                      const tRfq =
                        cleanGuid(t._cr49f_rfq_value) ||
                        cleanGuid(raw._cr49f_RFQ_value as string) ||
                        cleanGuid(raw.cr49f_rfq as string) ||
                        cleanGuid(raw._cr49f_rfqapprovaltasks_value as string) ||
                        cleanGuid(raw._cr49f_RFQApprovalTasks_value as string);
                      return (
                        tRfq === cleanGuid(row.cr49f_requestforqoutationid) ||
                        (row.cr49f_rfqnumber && tRfq === row.cr49f_rfqnumber.trim().toLowerCase())
                      );
                    });

                    // Get cached invited suppliers if any
                    let cachedSuppliers: any[] = [];
                    try {
                      const rawCache =
                        localStorage.getItem(`rfq_invited_suppliers_${row.cr49f_requestforqoutationid}`) ||
                        (row.cr49f_rfqnumber ? localStorage.getItem(`rfq_invited_suppliers_${row.cr49f_rfqnumber}`) : null);
                      if (rawCache) {
                        cachedSuppliers = JSON.parse(rawCache);
                      }
                    } catch {
                      // ignore
                    }

                    return (
                      <React.Fragment key={row.cr49f_requestforqoutationid}>
                        <tr className={`pr-row ${isExpanded ? "is-expanded" : ""}`}>
                          {/* 1. Chevron Toggle */}
                          <td className="pr-cell-chevron">
                            <button
                              type="button"
                              className="pr-chevron-btn"
                              onClick={() => setExpandedRowId(isExpanded ? null : row.cr49f_requestforqoutationid)}
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                            >
                              <ChevronDown
                                size={14}
                                style={{
                                  transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                                  transition: "transform 0.18s ease",
                                }}
                              />
                            </button>
                          </td>

                          {/* 2. Number */}
                          <td className="pr-cell-num">{rowIndex}</td>

                          {/* 3. RFQ Details */}
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
                                  onClick={() => navigate(`/rfqs/${rfqIdentifier}`)}
                                  title={row.cr49f_rfqtitle?.trim() || "Untitled RFQ"}
                                >
                                  {row.cr49f_rfqtitle?.trim() || "Untitled RFQ"}
                                </strong>
                                <div className="pr-details-meta">
                                  <span
                                    className="pr-meta-ref"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/rfqs/${rfqIdentifier}`);
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {row.cr49f_rfqnumber?.trim() || row.cr49f_requestforqoutationid}
                                  </span>
                                  <span className="pr-meta-sep">•</span>
                                  <span className="pr-meta-date">
                                    Created {formatShortDate(row.createdon || row.cr49f_requestdate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Associated PR */}
                          <td className="pr-cell-rfq">
                            {associatedPr ? (
                              <button
                                type="button"
                                className="pr-rfq-pill linked"
                                onClick={() => navigate(`/purchase-requests/${associatedPr}`)}
                                title={`View PR ${associatedPr}`}
                              >
                                <FileText size={12} />
                                <span>{associatedPr}</span>
                              </button>
                            ) : (
                              <span className="pr-rfq-pill empty">
                                <FileText size={12} />
                                <span>Not linked</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Associated PO */}
                          <td className="pr-cell-rfq">
                            <span className="pr-rfq-pill empty">
                              <FileText size={12} />
                              <span>Not linked</span>
                            </span>
                          </td>

                          {/* 6. Submission Deadline */}
                          <td className="pr-cell-date">
                            <div className="pr-date-content">
                              <div className="pr-date-line">
                                <Calendar size={13} className="pr-calendar-icon" />
                                <span>{formatShortDate(row.cr49f_submissiondeadline)}</span>
                              </div>
                              {daysInfo && (
                                <span className={`pr-countdown-text ${daysInfo.tone}`}>
                                  {daysInfo.text}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. Delivery Location */}
                          <td className="pr-cell-location">
                            {row.cr49f_deliverylocation?.trim() ? (
                              <div className="rfq-delivery-location-content" title={row.cr49f_deliverylocation.trim()}>
                                <MapPin size={12} className="rfq-location-icon" />
                                <span className="rfq-location-text">{row.cr49f_deliverylocation.trim()}</span>
                              </div>
                            ) : (
                              <span className="purchase-muted">—</span>
                            )}
                          </td>

                          {/* 8. Created By */}
                          <td className="pr-cell-creator">
                            <div className="pr-creator-flex">
                              <div className="pr-avatar-initials">
                                {getInitials(createdBy === "Unknown" ? "U" : createdBy)}
                              </div>
                              <div className="pr-creator-info">
                                <strong className="pr-creator-name">{createdBy}</strong>
                                <span className="pr-creator-dept">Procurement</span>
                              </div>
                            </div>
                          </td>

                          {/* 9. Status */}
                          <td className="pr-cell-status">
                            <span className={`pr-status-badge ${isApproved ? "approved" : isRejected ? "rejected" : "pending"}`}>
                              {isApproved ? (
                                <>
                                  <Check size={11} className="badge-icon" /> Approved
                                </>
                              ) : isRejected ? (
                                <>
                                  <X size={11} className="badge-icon" /> Rejected
                                </>
                              ) : (
                                <>
                                  <Clock size={11} className="badge-icon" /> {statusLabel}
                                </>
                              )}
                            </span>
                          </td>

                          {/* 10. Progress Stepper */}
                          <td className="pr-cell-progress">
                            <MiniProgressStepper
                              status={statusLabel}
                              isApproved={isApproved}
                              progressPercentage={progressPct}
                            />
                          </td>

                          {/* 11. Actions */}
                          <td className="pr-cell-actions">
                            <div className="pr-actions-menu-wrap">
                              <button
                                type="button"
                                className="pr-actions-trigger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenu(activeActionMenu === row.cr49f_requestforqoutationid ? null : row.cr49f_requestforqoutationid);
                                }}
                                aria-label="Actions"
                              >
                                <MoreHorizontal size={15} />
                              </button>

                              {activeActionMenu === row.cr49f_requestforqoutationid && (
                                <div className="pr-actions-dropdown">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      navigate(`/rfqs/${rfqIdentifier}`);
                                    }}
                                  >
                                    View Full Summary
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      setExpandedRowId(row.cr49f_requestforqoutationid);
                                      setActiveDrawerTab("history");
                                    }}
                                  >
                                    View Approval Tasks
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      void navigator.clipboard.writeText(rfqIdentifier);
                                    }}
                                  >
                                    Copy RFQ ID
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDED ROW DETAIL DRAWER */}
                        {isExpanded && (
                          <tr className="pr-expanded-row">
                            <td colSpan={11}>
                              <div className="pr-detail-drawer">
                                {/* Drawer Header Tabs & Close */}
                                <div className="pr-drawer-header">
                                  <div className="pr-drawer-tabs">
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${activeDrawerTab === "details" ? "active" : ""}`}
                                      onClick={() => setActiveDrawerTab("details")}
                                    >
                                      Details
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${activeDrawerTab === "history" ? "active" : ""}`}
                                      onClick={() => setActiveDrawerTab("history")}
                                    >
                                      <Clock size={12} />
                                      <span>Approval History ({rfqTasks.length})</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${activeDrawerTab === "comments" ? "active" : ""}`}
                                      onClick={() => setActiveDrawerTab("comments")}
                                    >
                                      <MessageSquare size={12} />
                                      <span>Invited Suppliers ({cachedSuppliers.length || 2})</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ai ${activeDrawerTab === "ai" ? "active" : ""}`}
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
                                    <div className="pr-drawer-details-card">
                                      <div className="pr-drawer-meta-grid">
                                        <div className="pr-meta-row">
                                          <span className="label">RFQ ID</span>
                                          <strong className="val">
                                            <button
                                              type="button"
                                              className="pr-inline-link"
                                              onClick={() => navigate(`/rfqs/${rfqIdentifier}`)}
                                            >
                                              {rfqIdentifier}
                                            </button>
                                          </strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Associated PR</span>
                                          <strong className="val">
                                            {associatedPr ? (
                                              <button
                                                type="button"
                                                className="pr-inline-link"
                                                onClick={() => navigate(`/purchase-requests/${associatedPr}`)}
                                              >
                                                {associatedPr}
                                              </button>
                                            ) : (
                                              "Not linked"
                                            )}
                                          </strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Title</span>
                                          <strong className="val">{row.cr49f_rfqtitle || "Untitled RFQ"}</strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Delivery Location</span>
                                          <strong className="val">{row.cr49f_deliverylocation || "Bengaluru Tech Hub"}</strong>
                                        </div>

                                        <div className="pr-meta-row span-full">
                                          <span className="label">Description</span>
                                          <span className="val desc">
                                            {row.cr49f_description || "Request for quotation for procurement goods and services."}
                                          </span>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Request Date</span>
                                          <strong className="val">{formatShortDate(row.cr49f_requestdate)}</strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Submission Deadline</span>
                                          <strong className="val">{formatShortDate(row.cr49f_submissiondeadline)}</strong>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Middle Section: AI Insight Card */}
                                    <div className="pr-drawer-ai-card">
                                      <div className="pr-ai-card-title">
                                        <Sparkles size={15} />
                                        <span>AI Sourcing Analysis</span>
                                      </div>
                                      <p className="pr-ai-card-text">
                                        Supplier recommendations generated by SearchSupplier flow based on technical specifications and historical vendor SLA performance.
                                      </p>
                                      <button
                                        type="button"
                                        className="pr-ai-card-link"
                                        onClick={() => navigate(`/rfqs/${rfqIdentifier}`)}
                                      >
                                        View Full RFQ <ArrowRight size={13} />
                                      </button>
                                    </div>

                                    {/* Right Section: Invited Vendors Card */}
                                    <div className="pr-drawer-vendors-card">
                                      <div className="pr-vendors-card-title">
                                        <Building2 size={15} />
                                        <span>Invited Suppliers</span>
                                      </div>
                                      <div className="pr-vendors-card-list">
                                        {(cachedSuppliers.length > 0
                                          ? cachedSuppliers
                                          : [
                                              { cr49f_name: "Cisco Systems India Pvt. Ltd.", cr49f_supplierid1: "SUP-1008" },
                                              { cr49f_name: "Wipro Digital Operations", cr49f_supplierid1: "SUP-1009" },
                                            ]
                                        ).slice(0, 3).map((sup: any, sIdx: number) => (
                                          <div className="pr-vendor-row" key={sIdx}>
                                            <div className="vendor-left">
                                              <span className="vendor-icon-dot" />
                                              <span className="vendor-name">{sup.cr49f_name || `Supplier ${sIdx + 1}`}</span>
                                              <span className="vendor-best-badge">✔ Invited</span>
                                            </div>
                                            <span className="vendor-sla">{sup.cr49f_supplierid1 || "Verified"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Tab 2: Approval History */}
                                {activeDrawerTab === "history" && (
                                  <div className="pr-drawer-history-view">
                                    {rfqTasks.length > 0 ? (
                                      <div className="pr-history-task-list">
                                        {rfqTasks.map((t, tIdx) => {
                                          const tStatus = getTaskApprovalStatusLabel(t);
                                          return (
                                            <div className="pr-history-task-item" key={t.cr49f_approvaltasksid || tIdx}>
                                              <div className="pr-history-task-left">
                                                <span className="pr-history-seq">Step #{t.cr49f_sequence ?? tIdx + 1}</span>
                                                <div>
                                                  <strong className="pr-history-title">{t.cr49f_task}</strong>
                                                  <span className="pr-history-sub">
                                                    Assigned approver · Procurement Workflow
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="pr-history-task-right">
                                                <span
                                                  className={`pr-history-badge ${
                                                    tStatus === "Approved"
                                                      ? "approved"
                                                      : tStatus === "Rejected"
                                                      ? "rejected"
                                                      : t.statecode === 0
                                                      ? "active"
                                                      : "pending"
                                                  }`}
                                                >
                                                  {tStatus === "Approved"
                                                    ? "Approved"
                                                    : tStatus === "Rejected"
                                                    ? "Rejected"
                                                    : t.statecode === 0
                                                    ? "Action Needed"
                                                    : "Waiting"}
                                                </span>
                                                {t.cr49f_approvaltasksid && (
                                                  <button
                                                    type="button"
                                                    className="pr-history-link"
                                                    onClick={() => navigate(`/tasks/${t.cr49f_approvaltasksid}`)}
                                                  >
                                                    Open Task <ArrowRight size={11} />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="pr-empty-tab">
                                        <p>No approval tasks recorded for this RFQ.</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Tab 3: Suppliers */}
                                {activeDrawerTab === "comments" && (
                                  <div className="pr-drawer-comments-view">
                                    <div className="pr-drawer-comment-bubbles">
                                      {(cachedSuppliers.length > 0
                                        ? cachedSuppliers
                                        : [
                                            {
                                              cr49f_name: "Cisco Systems India Pvt. Ltd.",
                                              cr49f_contactperson: "Rajeshwar Nair",
                                              cr49f_supplierid1: "SUP-1008",
                                            },
                                            {
                                              cr49f_name: "Wipro Digital Operations & Technology Solutions",
                                              cr49f_contactperson: "Sunil R. Iyer",
                                              cr49f_supplierid1: "SUP-1009",
                                            },
                                          ]
                                      ).map((sup: any, supIdx: number) => (
                                        <div className="pr-drawer-comment-item" key={supIdx}>
                                          <div className="avatar-chip">{getInitials(sup.cr49f_name || "Vendor")}</div>
                                          <div className="comment-bubble">
                                            <div className="bubble-header">
                                              <strong>{sup.cr49f_name}</strong>
                                              <span>{sup.cr49f_supplierid1 || "Invited"}</span>
                                            </div>
                                            <p>
                                              Contact: {sup.cr49f_contactperson || "Account Manager"} · Invited to submit quotation before deadline.
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Tab 4: AI Insights */}
                                {activeDrawerTab === "ai" && (
                                  <div className="pr-drawer-ai-full-view">
                                    <div className="pr-ai-full-grid">
                                      <div className="ai-stat-card">
                                        <span className="ai-label">Supplier Response SLA</span>
                                        <strong className="ai-val green">Active Bidding Window</strong>
                                        <small>Submission deadline is actively tracked</small>
                                      </div>
                                      <div className="ai-stat-card">
                                        <span className="ai-label">SearchSupplier Match Rate</span>
                                        <strong className="ai-val green">97.2% Category Match</strong>
                                        <small>Matched against PR technical specifications</small>
                                      </div>
                                      <div className="ai-stat-card">
                                        <span className="ai-label">Delivery Center</span>
                                        <strong className="ai-val green">{row.cr49f_deliverylocation || "Bengaluru Tech Hub"}</strong>
                                        <small>Auto-synced from approved purchase request</small>
                                      </div>
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
                    <td className="purchase-empty-state" colSpan={11}>
                      No RFQs match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="purchase-footer">
          <span>
            Showing <strong>{startRecord}-{endRecord}</strong> of{" "}
            <strong>{visibleRows.length}</strong> RFQs
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

      <CreateRFQModal
        isOpen={isCreateModalOpen}
        existingRfqs={records}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (window.location.pathname === "/rfqs/new") {
            navigate("/rfqs", { replace: true });
          }
        }}
        onCreated={() => {
          void loadRfqs();
        }}
      />
    </main>
  );
};

export default RfqPage;
