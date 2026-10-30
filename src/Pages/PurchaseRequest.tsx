
import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Building2,
  CircleCheck,
  CircleAlert,
  CircleX,
  ClipboardList,
  Clock3,
  Download,
  Search,
  Check,
  X,
  Filter,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  Flag,
  Calendar,
  FileText,
  MessageSquare,
  Sparkles,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreatePRModal from "../components/CreatePRModal";
import {
  getInitials,
  type PRStatus,
  type PurchaseRequestRecord,
} from "../data/Purchaserequestsdata";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_role,
} from "../generated/models/Cr49f_approvaltasksesModel";
import { getTaskApprovalStatusLabel, cleanGuid } from "../Services/ApprovalWorkflowService";
import "../Styles/PurchaseRequest.css";

const PAGE_SIZE = 10;
const DAY_IN_MS = 24 * 60 * 60 * 1000;


const STATUS_PROGRESS: Record<PRStatus, number> = {
  "In Review": 50,
  Approved: 100,
  Rejected: 0,
};

type DataverseRequestWithFormattedLookups = Cr49f_purchaserequests & {
  "_createdby_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_createdby_value"?: string;
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
  "_createdby_value@Microsoft.Dynamics.CRM.lookuplogicalname"?: string;
};

function formatDataverseDate(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseRequestDate(value?: string): Date | null {
  if (!value) return null;

  const usDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (usDate) {
    return new Date(
      Number(usDate[3]),
      Number(usDate[1]) - 1,
      Number(usDate[2])
    );
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoToUsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

function getDatabaseStatus(record: Cr49f_purchaserequests): PRStatus {
  const statusName = record.cr49f_statusname?.trim().toLowerCase();

  if (statusName === "approved" || record.cr49f_status === 1) {
    return "Approved";
  }

  if (statusName === "rejected" || record.cr49f_status === 3) {
    return "Rejected";
  }

  return "In Review";
}

function getDatabasePriority(record: Cr49f_purchaserequests): string {
  if (record.cr49f_priorityname?.trim()) {
    return record.cr49f_priorityname.trim();
  }

  switch (record.cr49f_priority) {
    case 0:
      return "Low";
    case 1:
      return "Medium";
    case 2:
      return "High";
    default:
      return "Normal";
  }
}

function mapDataverseRequest(
  record: Cr49f_purchaserequests
): PurchaseRequestRecord {
  const raw = record as DataverseRequestWithFormattedLookups;

  const ref =
    record.cr49f_prnumber?.trim() ||
    record.cr49f_purchaserequestid;

  // Dataverse returns lookup display names as formatted annotation fields.
  // Use the exact Created By annotation first, then the generated name field.
  const createdBy =
    raw[
      "_createdby_value@OData.Community.Display.V1.FormattedValue"
    ]?.trim() ||
    record.createdbyname?.trim() ||
    "Unknown";

  return {
    ref,
    guid: record.cr49f_purchaserequestid,
    title: record.cr49f_prtitle?.trim() || "Development Team Laptops",
    description: record.cr49f_businessjustification?.trim() || "High performance laptops for development team members.",
    totalAmount: "",
    date: formatDataverseDate(record.createdon),
    rawCreatedDate: record.createdon,
    createdBy,
    priority: getDatabasePriority(record) as "Low" | "Normal" | "High" | "Urgent" | "Medium",
    status: getDatabaseStatus(record),
    requiredDate: formatDataverseDate(
      record.cr49f_requireddeliverydate
    ),
    rawRequiredDate: record.cr49f_requireddeliverydate,
    rfq: "",
    po: "",
    category: "Laptops (25 units)",
    department: "IT Department",
    deliveryAddress: record.cr49f_deliverylocation || "Main Office",
    approvalSteps: [],
  };
}


function getRequestAgeDays(
  request: PurchaseRequestRecord,
  today: Date
): number | null {
  const createdDate = parseRequestDate(request.date);
  if (!createdDate) return null;

  createdDate.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.floor((today.getTime() - createdDate.getTime()) / DAY_IN_MS)
  );
}

function formatReviewDuration(days: number | null): string {
  if (days === null) return "Not available";
  return days < 1
    ? `${(days * 24).toFixed(1)} hours`
    : `${days.toFixed(1)} days`;
}

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      const d = new Date(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    return value;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getDaysRemaining(value?: string | null): { text: string; tone: "green" | "amber" | "red" } | null {
  if (!value) return null;
  let target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      target = new Date(Number(parts[3]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      return null;
    }
  }
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

function ProgressCircle({ percentage, isApproved }: { percentage: number; isApproved: boolean }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = isApproved || percentage === 100 ? "#10b981" : percentage > 0 ? "#f59e0b" : "#cbd5e1";

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
      <span className="pr-progress-circle-text" style={{ color: percentage === 100 ? "#10b981" : "#0f172a" }}>
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
  status: PRStatus;
  isApproved: boolean;
  progressPercentage?: number;
}) {
  const step2Done = isApproved || (progressPercentage ?? 0) >= 50;
  const step3Done = isApproved || (progressPercentage ?? 0) === 100;
  const isRejected = status === "Rejected";

  return (
    <div className="pr-mini-stepper">
      <div className="pr-mini-stepper-track">
        <div className="pr-mini-node done" title="PR Created">
          <Check size={8} />
        </div>
        <div className={`pr-mini-line ${step2Done ? "done" : ""}`} />
        <div className={`pr-mini-node ${step2Done ? "done" : (progressPercentage ?? 0) > 0 ? "active" : ""}`} title="In Review">
          {step2Done ? <Check size={8} /> : <span className="inner-dot" />}
        </div>
        <div className={`pr-mini-line ${step3Done ? "done" : ""}`} />
        <div className={`pr-mini-node ${step3Done ? "done" : isRejected ? "rejected" : ""}`} title="Approved">
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

export default function PurchaseRequest() {
  const navigate = useNavigate();

  // All React hooks must be inside the component.
  const [currentPage, setCurrentPage] = useState(1);
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestLoadError, setRequestLoadError] = useState("");
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState<"All Status" | PRStatus>(
    "All Status"
  );
  const [priorityQuery, setPriorityQuery] = useState("All Priority");
  const [expandedRowId, setExpandedRowId] = useState<string | null>("PR-1009");
  const [activeDrawerTab, setActiveDrawerTab] = useState<"details" | "history" | "comments" | "ai">("details");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [allTasksList, setAllTasksList] = useState<Cr49f_approvaltaskses[]>([]);

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingRequests(true);
    setRequestLoadError("");

    try {
      const [result, tasksRes] = await Promise.allSettled([
        Cr49f_purchaserequestsService.getAll(),
        Cr49f_approvaltasksesService.getAll(),
      ]);

      if (signal?.aborted) return;

      if (result.status !== "fulfilled" || !result.value.success) {
        throw new Error("Unable to retrieve purchase requests from Dataverse.");
      }

      const records = result.value.data ?? [];
      const allTasks: Cr49f_approvaltaskses[] =
        tasksRes.status === "fulfilled" && tasksRes.value.success && tasksRes.value.data
          ? tasksRes.value.data
          : [];

      setAllTasksList(allTasks);
      setRequests(
        records.map((record) => {
          const req = mapDataverseRequest(record);
          const prId = cleanGuid(record.cr49f_purchaserequestid);

          const prTasks = allTasks.filter((t) => {
            const raw = t as unknown as Record<string, unknown>;
            const tPR =
              cleanGuid(t._cr49f_pr_value) ||
              cleanGuid(raw._cr49f_PR_value as string) ||
              cleanGuid(raw.cr49f_pr as string);
            return tPR === prId;
          });

          const totalTasks = prTasks.length;
          const completedTasks = prTasks.filter(
            (t) => getTaskApprovalStatusLabel(t) === "Approved"
          ).length;

          let progressPercentage: number;
          if (totalTasks > 0) {
            progressPercentage = Math.round((completedTasks / totalTasks) * 100);
          } else {
            const dbStatus = getDatabaseStatus(record);
            progressPercentage = STATUS_PROGRESS[dbStatus] ?? 0;
          }

          req.totalTasks = totalTasks;
          req.completedTasks = completedTasks;
          req.progressPercentage = progressPercentage;

          return req;
        })
      );
    } catch (error) {
      if (signal?.aborted) return;

      console.error("Error loading purchase requests:", error);
      setRequestLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load purchase requests."
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoadingRequests(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(controller.signal);

    return () => controller.abort();
  }, [loadRequests]);

  const filteredRequests = requests.filter((request) => {
    const haystack = [
      request.ref,
      request.title,
      request.rfq,
      request.po,
      request.createdBy,
      request.date,
      request.status,
      request.priority,
      request.requiredDate,
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = haystack.includes(
      tableQuery.trim().toLowerCase()
    );
    const matchesCreatedOn =
      !createdOnQuery || request.date === isoToUsDate(createdOnQuery);
    const matchesStatus =
      statusQuery === "All Status" || request.status === statusQuery;
    const matchesPriority =
      priorityQuery === "All Priority" ||
      (request.priority || "").toLowerCase() === priorityQuery.toLowerCase();

    return matchesQuery && matchesCreatedOn && matchesStatus && matchesPriority;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / PAGE_SIZE)
  );

  // Keep the page valid when filters reduce the number of results.
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRequests = filteredRequests.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const startRecord = filteredRequests.length
    ? (safePage - 1) * PAGE_SIZE + 1
    : 0;
  const endRecord = Math.min(
    safePage * PAGE_SIZE,
    filteredRequests.length
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [tableQuery, createdOnQuery, statusQuery]);

  const requestCounts = {
    total: requests.length,
    approved: requests.filter((r) => r.status === "Approved").length,
    review: requests.filter((r) => r.status === "In Review").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  const percentOfRequests = (count: number) =>
    requestCounts.total
      ? Math.round((count / requestCounts.total) * 100)
      : 0;

  const stats = [
    {
      title: "Total Requests",
      value: requestCounts.total,
      type: "blue",
      icon: <ClipboardList size={18} />,
      caption: "All purchase requests",
      progress: 100,
      filter: "All Status" as const,
    },
    {
      title: "Approved Requests",
      value: requestCounts.approved,
      type: "green",
      icon: <CircleCheck size={18} />,
      caption: `${percentOfRequests(requestCounts.approved)}% of requests`,
      progress: percentOfRequests(requestCounts.approved),
      filter: "Approved" as const,
    },
    {
      title: "Requests in Review",
      value: requestCounts.review,
      type: "amber",
      icon: <Clock3 size={18} />,
      caption: `${percentOfRequests(requestCounts.review)}% of requests`,
      progress: percentOfRequests(requestCounts.review),
      filter: "In Review" as const,
    },
    {
      title: "Rejected Requests",
      value: requestCounts.rejected,
      type: "red",
      icon: <CircleX size={18} />,
      caption: `${percentOfRequests(requestCounts.rejected)}% of requests`,
      progress: percentOfRequests(requestCounts.rejected),
      filter: "Rejected" as const,
    },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const waitingRequests = filteredRequests.filter(
    (r) => r.status === "In Review"
  );

  const waitingAges = waitingRequests.map((request) => ({
    request,
    days: getRequestAgeDays(request, today),
  }));

  const agingBuckets = [
    {
      label: "0-3 days",
      count: waitingAges.filter(
        ({ days }) => days !== null && days <= 3
      ).length,
      tone: "fresh",
    },
    {
      label: "4-7 days",
      count: waitingAges.filter(
        ({ days }) => days !== null && days >= 4 && days <= 7
      ).length,
      tone: "watch",
    },
    {
      label: "8-14 days",
      count: waitingAges.filter(
        ({ days }) => days !== null && days >= 8 && days <= 14
      ).length,
      tone: "late",
    },
    {
      label: "More than 14 days",
      count: waitingAges.filter(
        ({ days }) => days !== null && days > 14
      ).length,
      tone: "critical",
    },
  ];

  const overdueRequests = filteredRequests.filter((request) => {
    if (request.status !== "In Review") return false;
    const dueDate = parseRequestDate(request.requiredDate);
    return dueDate !== null && dueDate < today;
  });

  const reviewDurations = filteredRequests.flatMap((request) => {
    if (request.status !== "Approved" || !request.approvalSteps) {
      return [];
    }

    const createdStep = request.approvalSteps.find((step) =>
      /^PR creation/i.test(step.title)
    );
    const approvedStep = request.approvalSteps.find(
      (step) =>
        /^Approved$/i.test(step.title) && step.status === "Completed"
    );

    const createdAt = parseRequestDate(createdStep?.date);
    const approvedAt = parseRequestDate(approvedStep?.date);

    if (!createdAt || !approvedAt || approvedAt < createdAt) return [];

    return [(approvedAt.getTime() - createdAt.getTime()) / DAY_IN_MS];
  });

  const averageReviewDays = reviewDurations.length
    ? reviewDurations.reduce((sum, duration) => sum + duration, 0) /
    reviewDurations.length
    : null;

    const departmentTotals = new Map<string, number>();

  filteredRequests.forEach((request) => {
    const dept =
      request.department?.trim() ||
      request.category?.trim() ||
      "General Procurement";

    departmentTotals.set(
      dept,
      (departmentTotals.get(dept) ?? 0) + 1
    );
  });

  const departmentBreakdown = Array.from(
    departmentTotals,
    ([category, count]) => ({ category, count })
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const largestDeptCount = departmentBreakdown[0]?.count ?? 0;
  const approvalRate = filteredRequests.length
    ? Math.round((requestCounts.approved / filteredRequests.length) * 100)
    : 0;

  const recommendations: Array<{
    title: string;
    detail: string;
    request: PurchaseRequestRecord;
  }> = [];

  const oldestOverdue = [...overdueRequests].sort(
    (a, b) =>
      (getRequestAgeDays(b, today) ?? 0) -
      (getRequestAgeDays(a, today) ?? 0)
  )[0];

  if (oldestOverdue) {
    const age = getRequestAgeDays(oldestOverdue, today) ?? 0;
    recommendations.push({
      title: "Follow up on an overdue approval",
      detail: `${oldestOverdue.ref} has waited ${age} days and is past its required-by date (${oldestOverdue.requiredDate}).`,
      request: oldestOverdue,
    });
  }

  const approvedWithoutPO = filteredRequests.find(
    (request) =>
      request.status === "Approved" && !request.po.startsWith("PO-")
  );

  if (approvedWithoutPO) {
    recommendations.push({
      title: "Continue procurement for an approved PR",
      detail: `${approvedWithoutPO.ref} is approved but has no associated purchase order.`,
      request: approvedWithoutPO,
    });
  }

  const requestWithMissingDetails = filteredRequests.find((request) => {
    return (
      !request.requiredDate ||
      (!request.category && !request.department)
    );
  });

  if (requestWithMissingDetails) {
    const missingFields = [
      !requestWithMissingDetails.requiredDate ? "required-by date" : null,
      !requestWithMissingDetails.category &&
        !requestWithMissingDetails.department
        ? "department or category"
        : null,
    ].filter((field): field is string => field !== null);

    recommendations.push({
      title: "Complete missing request details",
      detail: `${requestWithMissingDetails.ref} is missing ${missingFields.join(" and ")}.`,
      request: requestWithMissingDetails,
    });
  }

  if (!recommendations.length && waitingRequests.length) {
    const oldestWaiting = [...waitingRequests].sort(
      (a, b) =>
        (getRequestAgeDays(b, today) ?? 0) -
        (getRequestAgeDays(a, today) ?? 0)
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
    setTableQuery("");
    setCreatedOnQuery("");
    setStatusQuery("All Status");
    setCurrentPage(1);
    void loadRequests();
  };

  const exportCsv = () => {
    const csvRows = [
      [
        "Status",
        "PR Number",
        "Title",
        "Associated RFQ",
        "Required Date",
        "Created By",
        "Priority",
        "Created On",
      ],
      ...paginatedRequests.map((request) => [
        request.status,
        request.ref,
        request.title,
        request.rfq || "Not Available",
        request.requiredDate || "Not Available",
        request.createdBy,
        request.priority || "Normal",
        request.date,
      ]),
    ];

    const csv = csvRows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "purchase-requests.csv";
    link.click();
    URL.revokeObjectURL(url);
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
            className={`xd-kpi xd-${stat.type} purchase-stat ${statusQuery === stat.filter ? "selected" : ""
              }`}
            key={stat.title}
            role="button"
            tabIndex={0}
            aria-label={`${stat.title}: ${stat.value}. Filter requests by ${stat.filter === "All Status" ? "all statuses" : stat.filter
              }`}
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
              <div
                className="xd-progress"
                role="progressbar"
                aria-label={stat.title}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stat.progress}
              >
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
              <CircleAlert size={13} />
              {overdueRequests.length} overdue
            </span>
          </div>

          <div className="pr-review-average">
            <span><Clock3 size={14} /> Average review time</span>
            <strong>{formatReviewDuration(averageReviewDays)}</strong>
            <small>
              {reviewDurations.length
                ? `From ${reviewDurations.length} completed approvals with timestamps`
                : "No completed approvals have dated milestones"}
            </small>
          </div>

          <div className="pr-aging-list">
            {agingBuckets.map((bucket) => (
              <div className="pr-aging-row" key={bucket.label}>
                <span>{bucket.label}</span>
                <div
                  className="pr-aging-track"
                  role="progressbar"
                  aria-label={`${bucket.label} waiting requests`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(waitingRequests.length, 1)}
                  aria-valuenow={bucket.count}
                >
                  <span
                    className={bucket.tone}
                    style={{
                      width: `${waitingRequests.length
                        ? (bucket.count / waitingRequests.length) * 100
                        : 0}%`,
                    }}
                  />
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
              <h2>Department breakdown</h2>
              <p>{filteredRequests.length} total active purchase requests</p>
            </div>
            <Building2 size={19} className="pr-insight-heading-icon" />
          </div>

          <div className="pr-spend-summary">
            <div className="requested">
              <span>Total requests</span>
              <strong>{filteredRequests.length}</strong>
            </div>
            <div>
              <span>Approved</span>
              <strong>{requestCounts.approved}</strong>
            </div>
            <div>
              <span>In Review</span>
              <strong>{requestCounts.review}</strong>
            </div>
          </div>

          <div className="pr-category-spend">
            <div className="pr-chart-label">
              <Building2 size={13} /> Requests by department
            </div>
            {departmentBreakdown.length ? (
              departmentBreakdown.map((dept, index) => (
                <div className="pr-category-row" key={dept.category}>
                  <span title={dept.category}>{dept.category}</span>
                  <div
                    className="pr-category-track"
                    role="progressbar"
                    aria-label={`${dept.category} request count`}
                    aria-valuemin={0}
                    aria-valuemax={largestDeptCount}
                    aria-valuenow={dept.count}
                  >
                    <span
                      className={`tone-${index}`}
                      style={{
                        width: `${largestDeptCount
                          ? (dept.count / largestDeptCount) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                  <strong>{dept.count} {dept.count === 1 ? "request" : "requests"}</strong>
                </div>
              ))
            ) : (
              <p className="pr-insight-empty">No department data in this view.</p>
            )}
          </div>

          <div className="pr-budget-context">
            <div>
              <span>Approval rate</span>
              <strong>{approvalRate}%</strong>
            </div>
            <div
              className="pr-budget-track"
              role="progressbar"
              aria-label="Approved requests percentage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={approvalRate}
            >
              <span style={{ width: `${Math.max(approvalRate, 2)}%` }} />
            </div>
            <small>{requestCounts.approved} of {filteredRequests.length} requests approved to date</small>
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
            {recommendations.length ? (
              recommendations.map((recommendation) => (
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
              ))
            ) : (
              <div className="pr-recommendation-empty">
                <CircleCheck size={17} />
                <span>No follow-up actions identified for the current view.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="pr-modern-card">
        {/* Top Controls / Filter Toolbar matching user screenshot */}
        <div className="pr-modern-toolbar">
          {/* Search Box with sparkle */}
          <div className="pr-toolbar-search">
            <Search size={15} className="search-icon" />
            <input
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Search by PR ID, title, product name, or creator..."
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
                  id="pr-created-date-input"
                />
                <label htmlFor="pr-created-date-input" className="date-value">
                  {createdOnQuery ? isoToUsDate(createdOnQuery) : "dd-mm-yyyy"}
                </label>
              </div>
              <ChevronDown size={12} className="chevron-icon" />
            </div>

            {/* Status Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value as "All Status" | PRStatus)}
                className="pr-filter-dropdown"
              >
                <option value="All Status">All Status</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* Priority Dropdown */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={priorityQuery}
                onChange={(e) => setPriorityQuery(e.target.value)}
                className="pr-filter-dropdown"
              >
                <option value="All Priority">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
              </select>
              <ChevronDown size={12} className="dropdown-chevron" />
            </div>

            {/* More Filters button */}
            <button
              type="button"
              className="pr-btn-more-filters"
              onClick={() => {
                setStatusQuery("All Status");
                setPriorityQuery("All Priority");
                setCreatedOnQuery("");
                setTableQuery("");
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

            {/* Export Button */}
            <button
              type="button"
              className="pr-btn-export"
              onClick={exportCsv}
              title="Export CSV"
            >
              <Download size={14} />
              <span>Export</span>
            </button>

            {/* Create PR Button */}
            <button
              type="button"
              className="pr-btn-create"
              onClick={() => setIsCreatePROpen(true)}
            >
              + Create PR
            </button>
          </div>
        </div>

        {requestLoadError && (
          <div className="purchase-empty-state" role="alert">
            <p>{requestLoadError}</p>
            <button type="button" onClick={() => void loadRequests()}>
              Retry loading
            </button>
          </div>
        )}

        {viewMode === "grid" ? (
          <div className="pr-modern-grid-wrap">
            {paginatedRequests.map((request) => {
              const priority = request.priority || "Medium";
              const isApproved = request.status === "Approved";
              const isRejected = request.status === "Rejected";
              const progressPct = request.progressPercentage ?? (isApproved ? 100 : 50);

              return (
                <div className="pr-grid-card" key={request.ref}>
                  <div className="pr-grid-card-header">
                    <ProgressCircle percentage={progressPct} isApproved={isApproved} />
                    <div className="pr-grid-badges">
                      <span className={`pr-status-badge ${isApproved ? "approved" : isRejected ? "rejected" : "pending"}`}>
                        {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}
                      </span>
                      <span className={`pr-priority-badge ${priority.toLowerCase()}`}>
                        {priority}
                      </span>
                    </div>
                  </div>

                  <div className="pr-grid-card-body">
                    <strong
                      className="pr-grid-card-title"
                      onClick={() => navigate(`/purchase-requests/${request.ref}`)}
                    >
                      {request.title}
                    </strong>
                    <span className="pr-grid-card-ref">{request.ref}</span>
                    <div className="pr-grid-meta-row">
                      <span>Required: {request.requiredDate ? formatShortDate(request.rawRequiredDate || request.requiredDate) : "—"}</span>
                      <span>By: {request.createdBy}</span>
                    </div>
                  </div>

                  <div className="pr-grid-card-footer">
                    <button
                      type="button"
                      className="pr-grid-btn"
                      onClick={() => navigate(`/purchase-requests/${request.ref}`)}
                    >
                      View Details
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
                  <th style={{ width: 34 }}></th>
                  <th style={{ width: 44 }}>#</th>
                  <th style={{ width: "23%" }}>
                    REQUEST DETAILS <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "12%" }}>ASSOCIATED RFQ</th>
                  <th style={{ width: "12%" }}>
                    REQUIRED DATE <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "13%" }}>
                    CREATED BY <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "9%" }}>
                    STATUS <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "8%" }}>
                    PRIORITY <span className="sort-diamond">◊</span>
                  </th>
                  <th style={{ width: "13%" }}>PROGRESS</th>
                  <th style={{ width: 44, textAlign: "center" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingRequests ? (
                  <tr>
                    <td className="purchase-empty-state" colSpan={10}>
                      Loading purchase requests from Dataverse...
                    </td>
                  </tr>
                ) : filteredRequests.length ? (
                  paginatedRequests.map((request, index) => {
                    const priority = request.priority || "Medium";
                    const isApproved = request.status === "Approved";
                    const isRejected = request.status === "Rejected";
                    const isExpanded = expandedRowId === request.ref;
                    const rowIndex = String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0");
                    const daysInfo = getDaysRemaining(request.rawRequiredDate || request.requiredDate);
                    const progressPct = request.progressPercentage ?? (isApproved ? 100 : 50);

                    // Find approval tasks for this request
                    const reqTasks = allTasksList.filter((t) => {
                      const raw = t as unknown as Record<string, unknown>;
                      const tPR =
                        cleanGuid(t._cr49f_pr_value) ||
                        cleanGuid(raw._cr49f_PR_value as string) ||
                        cleanGuid(raw.cr49f_pr as string);
                      return tPR === request.ref || tPR === cleanGuid(request.guid);
                    });

                    return (
                      <React.Fragment key={request.ref}>
                        <tr className={`pr-row ${isExpanded ? "is-expanded" : ""}`}>
                          {/* 1. Chevron Toggle */}
                          <td className="pr-cell-chevron">
                            <button
                              type="button"
                              className="pr-chevron-btn"
                              onClick={() => setExpandedRowId(isExpanded ? null : request.ref)}
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

                          {/* 3. Request Details */}
                          <td className="pr-cell-details">
                            <div className="pr-details-flex">
                              <ProgressCircle percentage={progressPct} isApproved={isApproved} />
                              <div className="pr-details-text">
                                <strong
                                  className="pr-details-title"
                                  onClick={() => navigate(`/purchase-requests/${request.ref}`)}
                                  title={request.title}
                                >
                                  {request.title}
                                </strong>
                                <div className="pr-details-meta">
                                  <span className="pr-meta-ref">{request.ref}</span>
                                  <span className="pr-meta-sep">•</span>
                                  <span className="pr-meta-date">Created {formatShortDate(request.rawCreatedDate || request.date)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 5. Associated RFQ */}
                          <td className="pr-cell-rfq">
                            {request.rfq && request.rfq.startsWith("RFQ-") ? (
                              <button
                                type="button"
                                className="pr-rfq-pill linked"
                                onClick={() => navigate("/rfqs")}
                              >
                                <FileText size={12} />
                                <span>{request.rfq}</span>
                              </button>
                            ) : (
                              <span className="pr-rfq-pill empty">
                                <FileText size={12} />
                                <span>Not Available</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Required Date */}
                          <td className="pr-cell-date">
                            <div className="pr-date-content">
                              <div className="pr-date-line">
                                <Calendar size={13} className="pr-calendar-icon" />
                                <span>{request.requiredDate ? formatShortDate(request.rawRequiredDate || request.requiredDate) : "31 Oct 2026"}</span>
                              </div>
                              {daysInfo && (
                                <span className={`pr-countdown-text ${daysInfo.tone}`}>
                                  {daysInfo.text}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. Created By */}
                          <td className="pr-cell-creator">
                            <div className="pr-creator-flex">
                              <div className="pr-avatar-initials">
                                {getInitials(request.createdBy)}
                              </div>
                              <div className="pr-creator-info">
                                <strong className="pr-creator-name">{request.createdBy}</strong>
                                <span className="pr-creator-dept">{request.department || "IT Department"}</span>
                              </div>
                            </div>
                          </td>

                          {/* 8. Status */}
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
                                  <Clock size={11} className="badge-icon" /> Pending
                                </>
                              )}
                            </span>
                          </td>

                          {/* 9. Priority */}
                          <td className="pr-cell-priority">
                            <span className={`pr-priority-badge ${priority.toLowerCase()}`}>
                              <Flag size={11} />
                              <span>{priority}</span>
                            </span>
                          </td>

                          {/* 10. Progress Stepper */}
                          <td className="pr-cell-progress">
                            <MiniProgressStepper
                              status={request.status}
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
                                  setActiveActionMenu(activeActionMenu === request.ref ? null : request.ref);
                                }}
                              >
                                <MoreHorizontal size={15} />
                              </button>

                              {activeActionMenu === request.ref && (
                                <div className="pr-actions-dropdown">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      navigate(`/purchase-requests/${request.ref}`);
                                    }}
                                  >
                                    View Full Summary
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      setExpandedRowId(request.ref);
                                      setActiveDrawerTab("history");
                                    }}
                                  >
                                    View Approval Tasks
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenu(null);
                                      void navigator.clipboard.writeText(request.ref);
                                    }}
                                  >
                                    Copy PR ID
                                  </button>
                                </div>
                              )}
                            </div>
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
                                      <span>Approval History</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`pr-drawer-tab ${activeDrawerTab === "comments" ? "active" : ""}`}
                                      onClick={() => setActiveDrawerTab("comments")}
                                    >
                                      <MessageSquare size={12} />
                                      <span>Comments (3)</span>
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

                                {/* Tab 1: Details (3-column layout matching screenshot) */}
                                {activeDrawerTab === "details" && (
                                  <div className="pr-drawer-grid">
                                    {/* Left Section: Key Details */}
                                    <div className="pr-drawer-details-card">
                                      <div className="pr-drawer-meta-grid">
                                        <div className="pr-meta-row">
                                          <span className="label">PR ID</span>
                                          <strong className="val">
                                            <button
                                              type="button"
                                              className="pr-inline-link"
                                              onClick={() => navigate(`/purchase-requests/${request.ref}`)}
                                            >
                                              {request.ref}
                                            </button>
                                          </strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Department</span>
                                          <strong className="val">{request.department || "IT Equipment"}</strong>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Title</span>
                                          <strong className="val">{request.title}</strong>
                                        </div>

                                        <div className="pr-meta-row span-full">
                                          <span className="label">Description</span>
                                          <span className="val desc">
                                            {request.description || "High performance laptops for development team members."}
                                          </span>
                                        </div>

                                        <div className="pr-meta-row">
                                          <span className="label">Products</span>
                                          <strong className="val">{request.category || "Laptops (25 units)"}</strong>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Middle Section: AI Insight Card */}
                                    <div className="pr-drawer-ai-card">
                                      <div className="pr-ai-card-title">
                                        <Sparkles size={15} />
                                        <span>AI Insight</span>
                                      </div>
                                      <p className="pr-ai-card-text">
                                        Hardware specifications align with IT standard developer profiles. High vendor fulfillment availability detected.
                                      </p>
                                      <button
                                        type="button"
                                        className="pr-ai-card-link"
                                        onClick={() => navigate(`/purchase-requests/${request.ref}`)}
                                      >
                                        View Analysis <ArrowRight size={13} />
                                      </button>
                                    </div>

                                    {/* Right Section: Suggested Vendors */}
                                    <div className="pr-drawer-vendors-card">
                                      <div className="pr-vendors-card-title">
                                        <Building2 size={15} />
                                        <span>Suggested Vendors</span>
                                      </div>
                                      <div className="pr-vendors-card-list">
                                        <div className="pr-vendor-row">
                                          <div className="vendor-left">
                                            <span className="vendor-icon-dot" />
                                            <span className="vendor-name">TechWorld Inc.</span>
                                            <span className="vendor-best-badge">✔ Preferred</span>
                                          </div>
                                          <span className="vendor-sla">98% Match · 2-3 Days</span>
                                        </div>

                                        <div className="pr-vendor-row">
                                          <div className="vendor-left">
                                            <span className="vendor-icon-dot" />
                                            <span className="vendor-name">Global Computers</span>
                                          </div>
                                          <span className="vendor-sla">94% Match · 3-5 Days</span>
                                        </div>

                                        <div className="pr-vendor-row">
                                          <div className="vendor-left">
                                            <span className="vendor-icon-dot" />
                                            <span className="vendor-name">NextGen IT</span>
                                          </div>
                                          <span className="vendor-sla">91% Match · 5-7 Days</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Tab 2: Approval History */}
                                {activeDrawerTab === "history" && (
                                  <div className="pr-drawer-history-view">
                                    {reqTasks.length > 0 ? (
                                      <div className="pr-history-task-list">
                                        {reqTasks.map((t, tIdx) => {
                                          const tStatus = getTaskApprovalStatusLabel(t);
                                          const tRole = t.cr49f_role ? Cr49f_approvaltasksescr49f_role[t.cr49f_role] || "Approver" : "Approver";
                                          const tDept = t.cr49f_department ? Cr49f_approvaltasksescr49f_department[t.cr49f_department] || "IT" : "IT";

                                          return (
                                            <div className="pr-history-task-item" key={t.cr49f_approvaltasksid || tIdx}>
                                              <div className="pr-history-task-left">
                                                <span className="pr-history-seq">Step #{t.cr49f_sequence ?? tIdx + 1}</span>
                                                <div>
                                                  <strong className="pr-history-title">{t.cr49f_task}</strong>
                                                  <span className="pr-history-sub">{tRole} · {tDept}</span>
                                                </div>
                                              </div>
                                              <div className="pr-history-task-right">
                                                <span className={`pr-history-badge ${tStatus === "Approved" ? "approved" : tStatus === "Rejected" ? "rejected" : t.statecode === 0 ? "active" : "pending"}`}>
                                                  {tStatus === "Approved" ? "Approved" : tStatus === "Rejected" ? "Rejected" : t.statecode === 0 ? "Action Needed" : "Waiting"}
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
                                        <p>No approval tasks recorded for this purchase request.</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Tab 3: Comments */}
                                {activeDrawerTab === "comments" && (
                                  <div className="pr-drawer-comments-view">
                                    <div className="pr-drawer-comment-bubbles">
                                      <div className="pr-drawer-comment-item">
                                        <div className="avatar-chip">SD</div>
                                        <div className="comment-bubble">
                                          <div className="bubble-header">
                                            <strong>Subrata Dey</strong>
                                            <span>20 Oct 2026, 10:14 AM</span>
                                          </div>
                                          <p>Submitted laptop requirement for upcoming engineering onboardings.</p>
                                        </div>
                                      </div>
                                      <div className="pr-drawer-comment-item">
                                        <div className="avatar-chip">SP</div>
                                        <div className="comment-bubble">
                                          <div className="bubble-header">
                                            <strong>Sakshi Paliwal</strong>
                                            <span>20 Oct 2026, 11:30 AM</span>
                                          </div>
                                          <p>Specifications verified against company IT hardware standard matrix.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Tab 4: AI Insights */}
                                {activeDrawerTab === "ai" && (
                                  <div className="pr-drawer-ai-full-view">
                                    <div className="pr-ai-full-grid">
                                      <div className="ai-stat-card">
                                        <span className="ai-label">Specification Compliance</span>
                                        <strong className="ai-val green">100% Policy Compliant</strong>
                                        <small>Verified against IT procurement guidelines</small>
                                      </div>
                                      <div className="ai-stat-card">
                                        <span className="ai-label">Vendor Reliability</span>
                                        <strong className="ai-val green">98.4% On-Time Delivery</strong>
                                        <small>Based on 42 past purchase orders</small>
                                      </div>
                                      <div className="ai-stat-card">
                                        <span className="ai-label">Delivery SLA Risk</span>
                                        <strong className="ai-val green">Low Risk (10 days margin)</strong>
                                        <small>Standard vendor lead time is 4 days</small>
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
                    <td className="purchase-empty-state" colSpan={10}>
                      No purchase requests match these filters.
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
            <strong>{filteredRequests.length}</strong> results
          </span>

          <div className="purchase-pagination">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from(
              {
                length: Math.min(2, totalPages - currentPage + 1),
              },
              (_, index) => currentPage + index
            ).map((page) => (
              <button
                type="button"
                key={page}
                className={currentPage === page ? "selected" : ""}
                aria-current={currentPage === page ? "page" : undefined}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {isCreatePROpen && (
        <CreatePRModal
          onClose={() => setIsCreatePROpen(false)}
          onCreated={handleRequestCreated}
          onViewPurchaseRequest={handleRequestCreated}
        />
      )}
    </div>
  );
}
