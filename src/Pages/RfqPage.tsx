import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  Plus,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";

import "../Styles/Styles.css";
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
});

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormatter.format(parsed);
}

function toIsoDate(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  // Use local calendar date rather than shifting a date-only value through UTC.
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
    case 0: return "Pending";
    case 1: return "Approved";
    case 2: return "Changes Needed";
    case 3: return "Rejected";
    default: return "Pending";
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

// ---------------------------------------------------------------------
// Status ring — replaces the plain dot + separate "Status" text column.
// Per your reference screenshot: one ring, colored by status, with the
// progress percentage inside it (same visual language the old mock
// RfqStatusRing/PR StatusIndicator used), and no separate status word
// anywhere else in the row.
//
// Percentages below are a judgment call, not something Dataverse
// stores — cr49f_status only gives the 4 discrete states, not a
// progress number. Pending=50 matches your screenshot; Changes
// Needed=70 (further along than Pending, still open); Approved and
// Rejected both ring fully closed (100) since the RFQ's workflow has
// ended either way, just colored green vs. red. Tell me if you want
// different numbers.
// ---------------------------------------------------------------------
const STATUS_RING_PROGRESS: Record<string, number> = {
  Pending: 50,
  "Changes Needed": 70,
  Approved: 100,
  Rejected: 100,
};

function statusRingTone(label: string): string {
  const normalized = label.replace(/\s+/g, "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "changesneeded") return "changes-needed";
  return "pending";
}

function RfqStatusRing({ label }: { label: string }) {
  const progress = STATUS_RING_PROGRESS[label] ?? 25;
  const tone = statusRingTone(label);
  return (
    <span
      className={`rfq-status-ring ${tone}`}
      role="img"
      aria-label={`${label}, ${progress}% complete`}
      title={`${label} · ${progress}% complete`}
      style={{ "--ring-progress": progress } as React.CSSProperties}
    >
      <span aria-hidden="true">{progress}<small>%</small></span>
    </span>
  );
}

const RfqPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<RawRfq[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState<StatusFilter>("All Status");
  const [currentPage, setCurrentPage] = useState(1);

  const loadRfqs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await Cr49f_requestforqoutationsService.getAll();
      if (!result.success) {
        throw new Error("Dataverse did not return the RFQ records successfully.");
      }
      setRecords((result.data ?? []) as RawRfq[]);
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

  const counts = useMemo(() => ({
    total: records.length,
    approved: records.filter((row) => getStatusLabel(row) === "Approved").length,
    pending: records.filter((row) => {
      const label = getStatusLabel(row);
      return label === "Pending" || label === "Changes Needed";
    }).length,
    rejected: records.filter((row) => getStatusLabel(row) === "Rejected").length,
  }), [records]);

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

      <section id="rfq-records-card" className="purchase-card rfq-records-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <span className="rfq-title-icon" aria-hidden="true">
              <ClipboardList size={14} />
            </span>
            <div className="purchase-title-copy">
              <strong>Request For Quotations</strong>
              <span>{visibleRows.length} of {records.length} RFQs</span>
            </div>
          </div>
          <div className="purchase-actions">
            <button
              type="button"
              className="dashboard-create-button"
              onClick={() => navigate("/rfqs/new")}
            >
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
                placeholder="Search RFQ ID, title, PR, Created By..."
              />
            </div>
          </div>
          <div className="rfq-filter-field">
            <label>Created On</label>
            <div className="rfq-filter-input rfq-date-input">
              <input
                type="date"
                aria-label="Filter by created date"
                value={createdOnQuery}
                onChange={(event) => setCreatedOnQuery(event.target.value)}
              />
              {createdOnQuery && (
                <button
                  type="button"
                  className="rfq-filter-clear-btn"
                  aria-label="Clear date filter"
                  onClick={() => setCreatedOnQuery("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="rfq-filter-field">
            <label>Status</label>
            <div className="rfq-filter-input">
              <select
                value={statusQuery}
                onChange={(event) => setStatusQuery(event.target.value as StatusFilter)}
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option === "ChangesNeeded" ? "Changes Needed" : option}</option>
                ))}
              </select>
              <ChevronDown size={11} />
            </div>
          </div>
        </div>

        {loadError && !isLoading && (
          <div className="purchase-empty-state" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadRfqs()}>Retry loading</button>
          </div>
        )}

        <div className="purchase-table-wrap">
          <table className="purchase-table rfq-table">
            <thead>
              <tr>
                <th aria-label="Status"></th>
                <th>RFQ ID &amp; Title</th>
                <th>Associated PR</th>
                <th>Associated PO</th>
                <th>Request Date</th>
                <th>Submission Deadline</th>
                <th>Award Date</th>
                <th>Closed Date</th>
                <th>Delivery Location</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="purchase-empty-state" colSpan={10}>
                    Loading RFQs from Dataverse...
                  </td>
                </tr>
              ) : loadError ? null : paginatedRows.length ? (
                paginatedRows.map((row) => {
                  const statusLabel = getStatusLabel(row);
                  const createdBy = getCreatedBy(row);
                  const associatedPr = getAssociatedPr(row);

                  return (
                    <tr key={row.cr49f_requestforqoutationid}>
                      <td className="purchase-status-cell">
                        <RfqStatusRing label={statusLabel} />
                      </td>
                      <td className="purchase-subject-cell">
                        <strong className="purchase-request-title">
                          {row.cr49f_rfqtitle?.trim() || "Untitled RFQ"}
                        </strong>
                        <div className="purchase-subject-meta">
                          <button
                            type="button"
                            className="purchase-ref-link"
                            onClick={() => navigate(`/rfqs/${row.cr49f_rfqnumber || row.cr49f_requestforqoutationid}`)}
                          >
                            {row.cr49f_rfqnumber?.trim() || row.cr49f_requestforqoutationid}
                          </button>
                          <span>Created {formatDate(row.createdon)}</span>
                        </div>
                      </td>
                      <td className={associatedPr ? "purchase-link" : "purchase-muted"}>
                        {associatedPr || "Not linked"}
                      </td>
                      {/*
                        Associated PO: there is no PO lookup field on
                        cr49f_requestforqoutations (only cr49f_PRRFQ,
                        the PR lookup, exists) — this will read "Not
                        linked" for every row until that relationship
                        is added in Dataverse. Not faked as a real link.
                      */}
                      <td className="purchase-muted">Not linked</td>
                      <td>{formatDate(row.cr49f_requestdate)}</td>
                      <td>{formatDate(row.cr49f_submissiondeadline)}</td>
                      <td>{formatDate(row.cr49f_awarddate)}</td>
                      <td>{formatDate(row.cr49f_closeddate)}</td>
                      <td>{row.cr49f_deliverylocation?.trim() || "—"}</td>
                      <td>
                        <span className="creator-pill">
                          <span>{getInitials(createdBy === "Unknown" ? "U" : createdBy)}</span>
                          {createdBy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="purchase-empty-state" colSpan={10}>
                    No RFQs match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
            <button type="button" className="selected" aria-current="page">
              {safeCurrentPage}
            </button>
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
    </main>
  );
};

export default RfqPage;