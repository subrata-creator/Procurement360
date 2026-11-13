import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Flag,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
  buildDefaultSubTasks,
  getInitials,
  getPurchaseRequestByRef,
  purchaseRequests,
  type ApprovalStep,
  type LineItem,
  type PurchaseRequestRecord,
} from "../data/Purchaserequestsdata";
import { rfqs } from "../data/rfqs";
import { SAMPLE_APPROVAL_CYCLES } from "../data/SampleApprovalCycleData";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { getDynamicPurchaseOrders } from "../Services/PurchaseOrderService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { OrderRow } from "../data/OrdersData";
import CreateRFQModal from "../components/CreateRFQModal";
import {
  createApprovalTasksForObject,
  getApprovalTasksForRecord,
  getTaskApprovalStatusLabel,
  approveTask,
  rejectTask,
  cleanGuid,
  parseTaskComments,
  resolveRecordCreatedBy,
} from "../Services/ApprovalWorkflowService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_role,
  Cr49f_approvaltasksescr49f_slaunit,
} from "../generated/models/Cr49f_approvaltasksesModel";

import "../Styles/PRSummary.css";

const TABS = ["Summary", "RFQs", "Associated Tasks", "Notes", "Attachments"];

type LivePurchaseRequest = {
  cr49f_purchaserequestid: string;
  cr49f_prnumber?: string;
  cr49f_prtitle?: string;
  cr49f_status?: number;
  cr49f_statusname?: string;
  cr49f_priority?: number;
  cr49f_priorityname?: string;
  cr49f_totalamount?: number;
  cr49f_businessjustification?: string;
  cr49f_deliverylocation?: string;
  cr49f_requireddeliverydate?: string;
  createdon?: string;
  createdbyname?: string;
  modifiedon?: string;
};

type LivePurchaseRequestLine = {
  cr49f_purchaserequestlineid: string;
  cr49f_prlinenumber?: string;
  cr49f_itemname?: string;
  cr49f_itemdescription?: string;
  cr49f_quantity?: number;
  cr49f_unitprice?: number;
  _cr49f_purchaserequest_value?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function normalizeId(value?: string): string {
  return (value ?? "").replace(/[{}]/g, "").trim().toLowerCase();
}

// Kept in the original "M/D/YYYY" short form the rest of this page's
// mock dates used (buildApprovalSteps/buildMilestoneSubTasks print
// record.date verbatim), rather than switching to a spelled-out format.
function toUsDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// cr49f_status: 0 Pending, 1 Approved, 2 ChangesNeeded, 3 Rejected.
// The journey/milestone generators only understand the original
// 3-value PRStatus, so Pending and ChangesNeeded both fold into
// "In Review" for that logic. The real 4-value label (cr49f_statusname)
// is still shown as-is in the status pill/KPI — only the journey
// bucket is collapsed.
function mapToPRStatus(status?: number, prId?: string): PurchaseRequestRecord["status"] {
  if (prId && typeof window !== "undefined") {
    const cached = localStorage.getItem(`pr_status_${cleanGuid(prId)}`);
    if (cached === "Approved") return "Approved";
    if (cached === "Rejected") return "Rejected";
  }
  if (status === 1) return "Approved";
  if (status === 3) return "Rejected";
  return "In Review";
}

function getStatusLabel(request: LivePurchaseRequest): string {
  const prId = cleanGuid(request.cr49f_purchaserequestid);
  if (prId && typeof window !== "undefined") {
    const cached = localStorage.getItem(`pr_status_${prId}`);
    if (cached) return cached;
  }
  if (request.cr49f_statusname) return request.cr49f_statusname;
  switch (request.cr49f_status) {
    case 0: return "Pending";
    case 1: return "Approved";
    case 2: return "Changes Needed";
    case 3: return "Rejected";
    default: return "Unknown";
  }
}

function getPriorityLabel(request: LivePurchaseRequest): string {
  if (request.cr49f_priorityname) return request.cr49f_priorityname;
  switch (request.cr49f_priority) {
    case 0: return "Low";
    case 1: return "Medium";
    case 2: return "High";
    default: return "Not set";
  }
}

type RequestNote = {
  id: string;
  title: string;
  type: "Public" | "Private";
  description: string;
  attachmentName: string;
  taggedUsers: string[];
  author: string;
  createdAt: string;
};

function notesStorageKey(ref?: string): string {
  return `procurement360.notes.${ref ?? "unknown"}`;
}

function readRequestNotes(ref?: string): RequestNote[] {
  if (typeof window === "undefined" || !ref) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(notesStorageKey(ref)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((note): note is RequestNote =>
      typeof note?.id === "string" &&
      typeof note?.title === "string" &&
      (note?.type === "Public" || note?.type === "Private") &&
      typeof note?.description === "string" &&
      Array.isArray(note?.taggedUsers) &&
      typeof note?.author === "string" &&
      typeof note?.createdAt === "string"
    ) : [];
  } catch {
    return [];
  }
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function createNoteId(): string {
  return `${Date.now()}`;
}

function statusPillClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "review";
}

function subtaskStatusClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "In Progress") return "in-progress";
  return "pending";
}

function stepCircleClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "";
}

function milestoneIconClass(status: string) {
  if (status === "Completed") return "green";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "pending";
}

export default function PurchaseRequestDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Summary");
  const [noteCollection, setNoteCollection] = useState(() => ({ ref, notes: readRequestNotes(ref) }));
  const notes = noteCollection.ref === ref ? noteCollection.notes : readRequestNotes(ref);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteType, setNoteType] = useState<RequestNote["type"]>("Public");
  const [noteDescription, setNoteDescription] = useState("");
  const [noteTaggedUsers, setNoteTaggedUsers] = useState("");
  const [noteAttachment, setNoteAttachment] = useState<File | null>(null);
  const [subTasksOpen, setSubTasksOpen] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<ApprovalStep | null>(null);

  const [liveRequests, setLiveRequests] = useState<LivePurchaseRequest[]>([]);
  const [liveLines, setLiveLines] = useState<LivePurchaseRequestLine[]>([]);
  const [allRfqs, setAllRfqs] = useState<Cr49f_requestforqoutations[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Approval tasks states
  const [approvalTasks, setApprovalTasks] = useState<Cr49f_approvaltaskses[]>([]);
  const [rfqApprovalTasks, setRfqApprovalTasks] = useState<Cr49f_approvaltaskses[]>([]);
  const [poApprovalTasks, setPoApprovalTasks] = useState<Cr49f_approvaltaskses[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [actioningTaskId, setActioningTaskId] = useState<string | null>(null);
  const [taskActionNotice, setTaskActionNotice] = useState<string | null>(null);
  const [isCreateRfqModalOpen, setIsCreateRfqModalOpen] = useState(false);

  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setLoadError("");
    try {
      const [requestResult, lineResult, rfqResult, ordersResult] = await Promise.allSettled([
        Cr49f_purchaserequestsService.getAll(),
        Cr49f_purchaserequestlinesService.getAll(),
        Cr49f_requestforqoutationsService.getAll(),
        getDynamicPurchaseOrders(),
      ]);

      if (requestResult.status === "fulfilled" && requestResult.value.success) {
        setLiveRequests((requestResult.value.data ?? []) as LivePurchaseRequest[]);
      }
      if (lineResult.status === "fulfilled" && lineResult.value.success) {
        setLiveLines((lineResult.value.data ?? []) as LivePurchaseRequestLine[]);
      }
      if (rfqResult.status === "fulfilled" && rfqResult.value.success) {
        setAllRfqs((rfqResult.value.data ?? []) as Cr49f_requestforqoutations[]);
      }
      if (ordersResult.status === "fulfilled") {
        setAllOrders(ordersResult.value ?? []);
      }
    } catch (err) {
      console.error("Failed to load purchase request summary:", err);
      if (isInitial) {
        setLoadError(err instanceof Error ? err.message : "An unexpected error occurred while loading the purchase request.");
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData(true);
    const handleFocus = () => void loadData(false);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const liveRecord = useMemo(() => {
    if (!ref) return undefined;
    const routeRef = normalizeId(ref);
    const foundLive = liveRequests.find((request) =>
      normalizeId(request.cr49f_prnumber) === routeRef ||
      normalizeId(request.cr49f_purchaserequestid) === routeRef
    );
    if (foundLive) return foundLive;

    // Fallback: seeded / mock PRs
    const mockPr = getPurchaseRequestByRef(ref) || purchaseRequests.find((p) => normalizeId(p.ref) === routeRef);
    if (mockPr) {
      return {
        cr49f_purchaserequestid: mockPr.ref,
        cr49f_prnumber: mockPr.ref,
        cr49f_prtitle: mockPr.title,
        cr49f_status: mockPr.status === "Approved" ? 1 : mockPr.status === "Rejected" ? 3 : 0,
        cr49f_businessjustification: mockPr.justification,
        cr49f_deliverylocation: mockPr.deliveryAddress,
        createdon: mockPr.date,
        createdbyname: mockPr.createdBy,
      } as LivePurchaseRequest;
    }

    return undefined;
  }, [liveRequests, ref]);

  const mappedLineItems: LineItem[] = useMemo(() => {
    if (!liveRecord) return [];
    const requestId = normalizeId(liveRecord.cr49f_purchaserequestid);
    const lines = liveLines
      .filter((line) => normalizeId(line._cr49f_purchaserequest_value) === requestId)
      .map((line, index) => {
        const quantity = Number(line.cr49f_quantity) || 0;
        const unitPrice = Number(line.cr49f_unitprice) || 0;
        return {
          id: index + 1,
          itemCode: line.cr49f_prlinenumber || `LINE-${index + 1}`,
          itemName: line.cr49f_itemname || line.cr49f_itemdescription || "Unnamed item",
          quantity,
          previousContract: "—",
          unitPrice: currencyFormatter.format(unitPrice),
          totalAmount: currencyFormatter.format(quantity * unitPrice),
          deliveryDate: "—",
          deliveryAddress: "—",
        };
      });
    if (lines.length > 0) return lines;

    const mockPr = getPurchaseRequestByRef(ref || "") || purchaseRequests.find((p) => normalizeId(p.ref) === normalizeId(ref || ""));
    return mockPr?.lineItems ?? [];
  }, [liveRecord, liveLines, ref]);

  // Dynamically match any RFQ linked to this PR
  const matchedRfq = useMemo(() => {
    if (!liveRecord) return undefined;
    const prGuid = cleanGuid(liveRecord.cr49f_purchaserequestid);
    const prNum = liveRecord.cr49f_prnumber?.trim();

    // 1. Dataverse allRfqs
    const dvMatch = allRfqs.find((r) => {
      const raw = r as unknown as Record<string, unknown>;
      const linkedPrGuid = cleanGuid(
        r._cr49f_prrfq_value ||
        (raw._cr49f_PRRFQ_value as string) ||
        (raw.cr49f_PRRFQ as string) ||
        (raw.cr49f_prrfq as string)
      );
      if (prGuid && linkedPrGuid && linkedPrGuid === prGuid) return true;

      const rfqPrName =
        (raw["_cr49f_prrfq_value@OData.Community.Display.V1.FormattedValue"] as string) ||
        r.cr49f_prrfqname ||
        (raw.cr49f_PRRFQname as string);
      if (prNum && rfqPrName && rfqPrName.toLowerCase().includes(prNum.toLowerCase())) return true;
      if (prNum && r.cr49f_rfqtitle && r.cr49f_rfqtitle.toLowerCase().includes(prNum.toLowerCase())) return true;

      return false;
    });
    if (dvMatch) return dvMatch;

    // 2. Mock / static rfqs list fallback
    const mockMatch = rfqs.find((r) => {
      if (prNum && r.pr && r.pr.toLowerCase() === prNum.toLowerCase()) return true;
      if (prGuid && r.pr && cleanGuid(r.pr) === prGuid) return true;
      return false;
    });
    if (mockMatch) {
      return {
        cr49f_requestforqoutationid: mockMatch.refNo,
        cr49f_rfqnumber: mockMatch.refNo,
        cr49f_rfqtitle: mockMatch.title,
        cr49f_status: ((mockMatch.status as string) === "Approved" || (mockMatch.status as string) === "Closed" ? 1 : 0) as any,
        createdon: mockMatch.createdDate,
        createdbyname: mockMatch.createdBy,
        statecode: 0,
      } as Cr49f_requestforqoutations;
    }

    return undefined;
  }, [liveRecord, allRfqs]);

  // Dynamically match any PO linked to this PR or matched RFQ
  const matchedPo = useMemo(() => {
    if (!liveRecord) return undefined;
    const prGuid = cleanGuid(liveRecord.cr49f_purchaserequestid);
    const prNum = liveRecord.cr49f_prnumber?.trim();
    const matchedRfqNum = matchedRfq?.cr49f_rfqnumber?.trim();
    const matchedRfqGuid = matchedRfq ? cleanGuid(matchedRfq.cr49f_requestforqoutationid) : "";

    const foundOrder = allOrders.find((o) => {
      if (prNum && o.pr && o.pr.toLowerCase() === prNum.toLowerCase()) return true;
      if (prNum && (o as any).associatedPr && (o as any).associatedPr.toLowerCase() === prNum.toLowerCase()) return true;
      if (prGuid && o.pr && cleanGuid(o.pr) === prGuid) return true;

      if (matchedRfqNum && o.rfq && o.rfq.toLowerCase() === matchedRfqNum.toLowerCase()) return true;
      if (matchedRfqGuid && (o as any).rfqId && cleanGuid((o as any).rfqId) === matchedRfqGuid) return true;

      return false;
    });
    if (foundOrder) return foundOrder;

    return undefined;
  }, [liveRecord, allOrders, matchedRfq]);

  const record: PurchaseRequestRecord | undefined = useMemo(() => {
    if (!liveRecord) return undefined;
    const fallbackMock = getPurchaseRequestByRef(ref || "") || purchaseRequests.find((p) => normalizeId(p.ref) === normalizeId(ref || ""));
    return {
      ref: liveRecord.cr49f_prnumber || liveRecord.cr49f_purchaserequestid,
      title: liveRecord.cr49f_prtitle || fallbackMock?.title || "Untitled Purchase Request",
      rfq: matchedRfq?.cr49f_rfqnumber || fallbackMock?.rfq || "No RFQ available",
      po: matchedPo?.refNo || fallbackMock?.po || "No PO available",
      createdBy: resolveRecordCreatedBy(liveRecord, fallbackMock?.createdBy || "Unknown"),
      date: toUsDate(liveRecord.createdon) || fallbackMock?.date || "—",
      status: mapToPRStatus(liveRecord.cr49f_status, liveRecord.cr49f_purchaserequestid) || fallbackMock?.status || "In Review",
      requester: resolveRecordCreatedBy(liveRecord, "") || fallbackMock?.requester || undefined,
      requiredDate: toUsDate(liveRecord.cr49f_requireddeliverydate) || fallbackMock?.requiredDate,
      totalAmount: liveRecord.cr49f_totalamount != null ? currencyFormatter.format(liveRecord.cr49f_totalamount) : fallbackMock?.totalAmount,
      justification: liveRecord.cr49f_businessjustification || fallbackMock?.justification,
      deliveryAddress: liveRecord.cr49f_deliverylocation || fallbackMock?.deliveryAddress,
      lineItems: mappedLineItems.length > 0 ? mappedLineItems : (fallbackMock?.lineItems ?? []),
    };
  }, [liveRecord, mappedLineItems, matchedRfq, matchedPo, ref]);

  const loadApprovalTasks = async (prId: string) => {
    const validGuid = cleanGuid(prId);
    if (!validGuid) {
      setApprovalTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      let tasks = await getApprovalTasksForRecord(1, validGuid);
      if (tasks.length === 0 && liveRecord) {
        try {
          await createApprovalTasksForObject({
            objectType: 1, // PR
            recordId: validGuid,
            recordName: liveRecord.cr49f_prtitle || "Purchase Request Approval",
          });
          tasks = await getApprovalTasksForRecord(1, validGuid);
        } catch (autoErr) {
          console.warn("[PRSummary] Auto-create tasks for PR failed:", autoErr);
        }
      }
      const filtered = tasks.filter(
        (t) =>
          (t.cr49f_sequence ?? 0) >= 1 &&
          getTaskApprovalStatusLabel(t) !== "Changes Needed" &&
          !t.cr49f_task?.toLowerCase().includes("changes needed")
      );
      const uniqueBySeq = new Map<number, Cr49f_approvaltaskses>();
      for (const t of filtered) {
        const seq = t.cr49f_sequence ?? 1;
        if (!uniqueBySeq.has(seq)) {
          uniqueBySeq.set(seq, t);
        }
      }
      setApprovalTasks(
        Array.from(uniqueBySeq.values()).sort(
          (a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0)
        )
      );
    } catch (err) {
      console.warn("Failed to load approval tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadRfqApprovalTasks = async (rfq: Cr49f_requestforqoutations) => {
    const rfqId = cleanGuid(rfq.cr49f_requestforqoutationid);
    if (!rfqId) {
      setRfqApprovalTasks([]);
      return;
    }
    try {
      let tasks = await getApprovalTasksForRecord(2, rfqId);
      if (tasks.length === 0 && !rfq.cr49f_requestforqoutationid.startsWith("RFQ-")) {
        try {
          await createApprovalTasksForObject({
            objectType: 2,
            recordId: rfqId,
            recordName: rfq.cr49f_rfqtitle || "RFQ Sourcing Approval",
          });
          tasks = await getApprovalTasksForRecord(2, rfqId);
        } catch (autoErr) {
          console.warn("[PRSummary] Auto-create tasks for RFQ failed:", autoErr);
        }
      }
      const filtered = tasks.filter(
        (t) =>
          (t.cr49f_sequence ?? 0) >= 1 &&
          getTaskApprovalStatusLabel(t) !== "Changes Needed" &&
          !t.cr49f_task?.toLowerCase().includes("changes needed")
      );
      const uniqueBySeq = new Map<number, Cr49f_approvaltaskses>();
      for (const t of filtered) {
        const seq = t.cr49f_sequence ?? 1;
        if (!uniqueBySeq.has(seq)) {
          uniqueBySeq.set(seq, t);
        }
      }
      setRfqApprovalTasks(
        Array.from(uniqueBySeq.values()).sort(
          (a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0)
        )
      );
    } catch (err) {
      console.warn("Failed to load RFQ approval tasks:", err);
    }
  };

  const loadPoApprovalTasks = async (po: OrderRow) => {
    const raw = po as unknown as Record<string, unknown>;
    const poId = cleanGuid((raw.dataversePoId as string) || (raw.id as string) || (raw.guid as string));
    if (!poId) {
      setPoApprovalTasks([]);
      return;
    }
    try {
      let tasks = await getApprovalTasksForRecord(3, poId);
      if (tasks.length === 0 && raw.dataversePoId) {
        try {
          await createApprovalTasksForObject({
            objectType: 3,
            recordId: poId,
            recordName: `PO Approval - ${po.refNo}`,
          });
          tasks = await getApprovalTasksForRecord(3, poId);
        } catch (autoErr) {
          console.warn("[PRSummary] Auto-create tasks for PO failed:", autoErr);
        }
      }
      const filtered = tasks.filter(
        (t) =>
          (t.cr49f_sequence ?? 0) >= 1 &&
          getTaskApprovalStatusLabel(t) !== "Changes Needed" &&
          !t.cr49f_task?.toLowerCase().includes("changes needed")
      );
      const uniqueBySeq = new Map<number, Cr49f_approvaltaskses>();
      for (const t of filtered) {
        const seq = t.cr49f_sequence ?? 1;
        if (!uniqueBySeq.has(seq)) {
          uniqueBySeq.set(seq, t);
        }
      }
      setPoApprovalTasks(
        Array.from(uniqueBySeq.values()).sort(
          (a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0)
        )
      );
    } catch (err) {
      console.warn("Failed to load PO approval tasks:", err);
    }
  };

  useEffect(() => {
    if (liveRecord?.cr49f_purchaserequestid) {
      void loadApprovalTasks(liveRecord.cr49f_purchaserequestid);
    }
  }, [liveRecord?.cr49f_purchaserequestid]);

  useEffect(() => {
    if (matchedRfq) {
      void loadRfqApprovalTasks(matchedRfq);
    } else {
      setRfqApprovalTasks([]);
    }
  }, [matchedRfq?.cr49f_requestforqoutationid]);

  useEffect(() => {
    if (matchedPo) {
      void loadPoApprovalTasks(matchedPo);
    } else {
      setPoApprovalTasks([]);
    }
  }, [matchedPo?.refNo]);

  const handleGenerateTasks = async () => {
    if (!liveRecord?.cr49f_purchaserequestid) return;
    setLoadingTasks(true);
    try {
      await createApprovalTasksForObject({
        objectType: 1, // PR
        recordId: liveRecord.cr49f_purchaserequestid,
        recordName: liveRecord.cr49f_prtitle,
      });
      await loadApprovalTasks(liveRecord.cr49f_purchaserequestid);
      setTaskActionNotice("Approval tasks created successfully from template tasks.");
    } catch (err) {
      console.error("Failed to generate approval tasks:", err);
      setTaskActionNotice(err instanceof Error ? err.message : "Failed to create approval tasks.");
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleApprove = async (task: Cr49f_approvaltaskses) => {
    const raw = task as unknown as Record<string, unknown>;
    const taskId = cleanGuid(
      task.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    if (!taskId) return;
    setActioningTaskId(taskId);
    setTaskActionNotice(null);
    try {
      const approverName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      const result = await approveTask(taskId, approverName);
      if (liveRecord?.cr49f_purchaserequestid) {
        await loadApprovalTasks(liveRecord.cr49f_purchaserequestid);
        if (result.parentCompleted) {
          setLiveRequests((prev) => prev.map((req) => cleanGuid(req.cr49f_purchaserequestid) === cleanGuid(liveRecord.cr49f_purchaserequestid) ? { ...req, cr49f_status: 1 } : req));
        }
      }
      setTaskActionNotice(
        result.nextActivatedTask
          ? `Task "${task.cr49f_task}" approved! Next task "${result.nextActivatedTask.cr49f_task}" is now Active.`
          : `Task "${task.cr49f_task}" approved! All approval tasks completed. PR is now Approved!`
      );
    } catch (err) {
      console.error("Approve failed:", err);
      setTaskActionNotice(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setActioningTaskId(null);
    }
  };

  const handleReject = async (task: Cr49f_approvaltaskses) => {
    const raw = task as unknown as Record<string, unknown>;
    const taskId = cleanGuid(
      task.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    if (!taskId) return;
    setActioningTaskId(taskId);
    setTaskActionNotice(null);
    try {
      const approverName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      await rejectTask(taskId, approverName);
      if (liveRecord?.cr49f_purchaserequestid) {
        await loadApprovalTasks(liveRecord.cr49f_purchaserequestid);
        setLiveRequests((prev) => prev.map((req) => cleanGuid(req.cr49f_purchaserequestid) === cleanGuid(liveRecord.cr49f_purchaserequestid) ? { ...req, cr49f_status: 3 } : req));
      }
      setTaskActionNotice(
        `Task "${task.cr49f_task}" rejected. Further tasks remain inactive and PR is marked Rejected.`
      );
    } catch (err) {
      console.error("Reject failed:", err);
      setTaskActionNotice(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setActioningTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Loading purchase request from Dataverse…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>{loadError}</p>
          <button type="button" onClick={() => navigate("/purchase-requests")}>Back to Purchase Requests</button>
        </div>
      </div>
    );
  }

  if (!record || !liveRecord) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Purchase Request not found.</p>
          <button type="button" onClick={() => navigate("/purchase-requests")}>Back to Purchase Requests</button>
        </div>
      </div>
    );
  }

  const statusLabel = getStatusLabel(liveRecord);
  const priorityLabel = getPriorityLabel(liveRecord);

  // Milestone 1: PR Creation status
  const hasPrTasks = approvalTasks.length > 0;
  const allPrTasksApproved = hasPrTasks
    ? approvalTasks.every((t) => getTaskApprovalStatusLabel(t) === "Approved")
    : (liveRecord.cr49f_status === 1 || record.status === "Approved");
  const isPrRejected = approvalTasks.some((t) => getTaskApprovalStatusLabel(t) === "Rejected") ||
                       liveRecord.cr49f_status === 3 || record.status === "Rejected";

  const prCreationStatus: "Completed" | "Current" | "Rejected" = isPrRejected
    ? "Rejected"
    : allPrTasksApproved
    ? "Completed"
    : "Current"; // displayed as "In Progress"

  const isPrApproved =
    !isPrRejected &&
    (statusLabel.toLowerCase() === "approved" ||
      record.status === "Approved" ||
      liveRecord.cr49f_status === 1 ||
      prCreationStatus === "Completed" ||
      allPrTasksApproved);

  // Milestone 2: RFQ Initiated status
  const isRfqCreated = Boolean(matchedRfq);
  let rfqMilestoneStatus: "Completed" | "Current" | "Pending" | "Rejected" = "Pending";
  if (isRfqCreated) {
    const hasRfqTasks = rfqApprovalTasks.length > 0;
    const allRfqTasksApproved = hasRfqTasks
      ? rfqApprovalTasks.every((t) => getTaskApprovalStatusLabel(t) === "Approved")
      : (matchedRfq?.cr49f_status === 1 || (matchedRfq as any)?.cr49f_statusname === "Approved");
    const isRfqRejected = rfqApprovalTasks.some((t) => getTaskApprovalStatusLabel(t) === "Rejected") ||
                          matchedRfq?.cr49f_status === 3;

    rfqMilestoneStatus = isRfqRejected
      ? "Rejected"
      : allRfqTasksApproved
      ? "Completed"
      : "Current"; // displayed as "In Progress"
  }

  // Milestone 3: PO Created status
  const isPoCreated = Boolean(matchedPo);
  let poMilestoneStatus: "Completed" | "Current" | "Pending" | "Rejected" = "Pending";
  if (isPoCreated) {
    const hasPoTasks = poApprovalTasks.length > 0;
    const allPoTasksApproved = hasPoTasks
      ? poApprovalTasks.every((t) => getTaskApprovalStatusLabel(t) === "Approved")
      : (matchedPo?.status === "Approved" || (matchedPo as any)?.cr49f_status === 1);
    const isPoRejected = poApprovalTasks.some((t) => getTaskApprovalStatusLabel(t) === "Rejected") ||
                         matchedPo?.status === "Rejected";

    poMilestoneStatus = isPoRejected
      ? "Rejected"
      : allPoTasksApproved
      ? "Completed"
      : "Current"; // displayed as "In Progress"
  }

  const visibleApprovalSteps: ApprovalStep[] = [
    {
      step: 1,
      title: "PR Creation",
      status: prCreationStatus,
      date: prCreationStatus === "Completed" ? (liveRecord.modifiedon ? toUsDate(liveRecord.modifiedon) : record.date) : record.date,
      by: record.createdBy,
    },
    {
      step: 2,
      title: "RFQ Initiated",
      status: rfqMilestoneStatus,
      date: matchedRfq?.createdon ? toUsDate(matchedRfq.createdon) : undefined,
      by: matchedRfq?.createdbyname || (isRfqCreated ? "Procurement Specialist" : undefined),
    },
    {
      step: 3,
      title: "PO Created",
      status: poMilestoneStatus,
      date: matchedPo?.createdOn ? toUsDate(matchedPo.createdOn) : undefined,
      by: matchedPo?.createdBy || (isPoCreated ? "Purchasing Agent" : undefined),
    },
    {
      step: 4,
      title: "Invoice Created",
      status: "Pending",
    },
    {
      step: 5,
      title: "Closed",
      status: "Pending",
    },
  ];

  const currentInProgressStep =
    visibleApprovalSteps.find((s) => s.status === "Current") || visibleApprovalSteps[0];

  const activeMilestone = (() => {
    if (selectedMilestone) {
      const fresh = visibleApprovalSteps.find((s) => s.step === selectedMilestone.step);
      if (fresh) return fresh;
    }
    return currentInProgressStep || visibleApprovalSteps[0] || null;
  })();

  // Approval History (sidebar) stays in sync with the timeline by sourcing from visibleApprovalSteps
  const historyEvents = visibleApprovalSteps.filter(
    (step) => step.status === "Completed" || step.status === "Current" || step.status === "Rejected"
  );

  const isPrCreationMilestone = activeMilestone?.step === 1;
  const isRfqMilestone = activeMilestone?.step === 2;
  const isPoMilestone = activeMilestone?.step === 3;

  type NormalizedMilestoneTask = {
    id: string | number;
    sequence: number;
    task: string;
    status: "Completed" | "In Progress" | "Pending" | "Rejected";
    statusClass: "completed" | "in-progress" | "pending" | "rejected";
    assignedTo: string;
    initials: string;
    remarks: string;
    completedOn: string;
    approvalTaskId?: string;
  };

  const activeMilestoneTasks: NormalizedMilestoneTask[] = (() => {
    if (!record || !activeMilestone) return [];

    // 1. PR Creation Milestone
    if (isPrCreationMilestone) {
      if (approvalTasks.length > 0) {
        return approvalTasks.map((t, index) => {
          const approvalStatus = getTaskApprovalStatusLabel(t);
          const isApproved = approvalStatus === "Approved";
          const isRejected = approvalStatus === "Rejected";
          const isPending = approvalStatus === "Pending";
          const isActive = t.statecode === 0 && isPending;

          const label = isApproved
            ? "Completed"
            : isRejected
            ? "Rejected"
            : isActive
            ? "In Progress"
            : "Pending";
          const sClass = isApproved
            ? "completed"
            : isRejected
            ? "rejected"
            : isActive
            ? "in-progress"
            : "pending";

          const roleName = t.cr49f_role
            ? (Cr49f_approvaltasksescr49f_role[t.cr49f_role] || "Approver")
            : "Approver";
          const parsedComments = parseTaskComments(t.cr49f_comments ?? (t as unknown as Record<string, unknown>).cr49f_Comments);
          const latestComment = parsedComments.length > 0 ? parsedComments[parsedComments.length - 1].text : null;
          const remarks = latestComment || (isApproved
            ? "Completed for this approval stage"
            : isRejected
            ? "Task rejected"
            : isActive
            ? "Awaiting approval decision"
            : "Pending previous task approval");

          const completedOn = isApproved
            ? (t.modifiedon ? toUsDate(t.modifiedon) : (record.date || "—"))
            : "—";

          return {
            id: t.cr49f_approvaltasksid || index,
            sequence: t.cr49f_sequence || index + 1,
            task: t.cr49f_task || "PR Approval Task",
            status: label,
            statusClass: sClass,
            assignedTo: roleName,
            initials: getInitials(roleName),
            remarks,
            completedOn,
            approvalTaskId: t.cr49f_approvaltasksid,
          };
        });
      }

      const fallbackTasks = buildDefaultSubTasks(record);
      return fallbackTasks.map((ft, index) => {
        const isApproved = prCreationStatus === "Completed";
        const label = isApproved ? "Completed" : index === 0 ? "In Progress" : "Pending";
        const sClass = isApproved ? "completed" : index === 0 ? "in-progress" : "pending";
        return {
          id: ft.id,
          sequence: index + 1,
          task: ft.task,
          status: label,
          statusClass: sClass,
          assignedTo: ft.assignedTo,
          initials: getInitials(ft.assignedTo),
          remarks: isApproved ? "Completed for this approval stage" : index === 0 ? "Awaiting reviewer action" : "Queued for next workflow action",
          completedOn: isApproved ? record.date : "—",
        };
      });
    }

    // 2. RFQ Initiated Milestone
    if (isRfqMilestone) {
      if (isRfqCreated) {
        if (rfqApprovalTasks.length > 0) {
          return rfqApprovalTasks.map((t, index) => {
            const approvalStatus = getTaskApprovalStatusLabel(t);
            const isApproved = approvalStatus === "Approved";
            const isRejected = approvalStatus === "Rejected";
            const isPending = approvalStatus === "Pending";
            const isActive = t.statecode === 0 && isPending;

            const label = isApproved
              ? "Completed"
              : isRejected
              ? "Rejected"
              : isActive
              ? "In Progress"
              : "Pending";
            const sClass = isApproved
              ? "completed"
              : isRejected
              ? "rejected"
              : isActive
              ? "in-progress"
              : "pending";

            const roleName = t.cr49f_role
              ? (Cr49f_approvaltasksescr49f_role[t.cr49f_role] || "Procurement Officer")
              : "Procurement Officer";
            const parsedComments = parseTaskComments(t.cr49f_comments ?? (t as unknown as Record<string, unknown>).cr49f_Comments);
            const latestComment = parsedComments.length > 0 ? parsedComments[parsedComments.length - 1].text : null;
            const remarks = latestComment || (isApproved
              ? "Completed for sourcing stage"
              : isRejected
              ? "RFQ task rejected"
              : isActive
              ? "Awaiting vendor bidding evaluation"
              : "Pending previous RFQ task");

            const completedOn = isApproved
              ? (t.modifiedon ? toUsDate(t.modifiedon) : (matchedRfq?.createdon ? toUsDate(matchedRfq.createdon) : "—"))
              : "—";

            return {
              id: t.cr49f_approvaltasksid || index,
              sequence: t.cr49f_sequence || index + 1,
              task: t.cr49f_task || "RFQ Sourcing Task",
              status: label,
              statusClass: sClass,
              assignedTo: roleName,
              initials: getInitials(roleName),
              remarks,
              completedOn,
              approvalTaskId: t.cr49f_approvaltasksid,
            };
          });
        }

        const rfqCycle = SAMPLE_APPROVAL_CYCLES.find((c) => c.objectType === 2);
        const cycleTasks = rfqCycle?.tasks || [
          { cr49f_task: "Review Sourcing Scope & Vendor Bidding List", cr49f_role: 4, cr49f_sequencenumber: 1 },
          { cr49f_task: "Technical & Compliance Bid Evaluation", cr49f_role: 2, cr49f_sequencenumber: 2 },
          { cr49f_task: "Commercial Comparison & Vendor Selection Approval", cr49f_role: 3, cr49f_sequencenumber: 3 },
        ];
        const isApproved = rfqMilestoneStatus === "Completed";
        return cycleTasks.map((ct, idx) => {
          const roleLabel = Cr49f_approvaltasksescr49f_role[ct.cr49f_role as keyof typeof Cr49f_approvaltasksescr49f_role] || "Procurement Officer";
          const label = isApproved ? "Completed" : idx === 0 ? "In Progress" : "Pending";
          const sClass = isApproved ? "completed" : idx === 0 ? "in-progress" : "pending";
          return {
            id: `rfq-t-${idx + 1}`,
            sequence: ct.cr49f_sequencenumber || idx + 1,
            task: ct.cr49f_task,
            status: label,
            statusClass: sClass,
            assignedTo: roleLabel,
            initials: getInitials(roleLabel),
            remarks: isApproved
              ? "Completed for sourcing stage"
              : idx === 0
              ? "Vendor quotation review in progress"
              : "Queued for the next workflow action",
            completedOn: isApproved && matchedRfq?.createdon ? toUsDate(matchedRfq.createdon) : "—",
          };
        });
      }

      // No RFQ created yet: do not show any tasks until RFQ is initiated
      return [];
    }

    // 3. PO Created Milestone
    if (isPoMilestone) {
      if (isPoCreated) {
        if (poApprovalTasks.length > 0) {
          return poApprovalTasks.map((t, index) => {
            const approvalStatus = getTaskApprovalStatusLabel(t);
            const isApproved = approvalStatus === "Approved";
            const isRejected = approvalStatus === "Rejected";
            const isPending = approvalStatus === "Pending";
            const isActive = t.statecode === 0 && isPending;

            const label = isApproved
              ? "Completed"
              : isRejected
              ? "Rejected"
              : isActive
              ? "In Progress"
              : "Pending";
            const sClass = isApproved
              ? "completed"
              : isRejected
              ? "rejected"
              : isActive
              ? "in-progress"
              : "pending";

            const roleName = t.cr49f_role
              ? (Cr49f_approvaltasksescr49f_role[t.cr49f_role] || "Procurement Admin")
              : "Procurement Admin";
            const parsedComments = parseTaskComments(t.cr49f_comments ?? (t as unknown as Record<string, unknown>).cr49f_Comments);
            const latestComment = parsedComments.length > 0 ? parsedComments[parsedComments.length - 1].text : null;
            const remarks = latestComment || (isApproved
              ? "Completed for purchase order stage"
              : isRejected
              ? "PO task rejected"
              : isActive
              ? "Awaiting order verification & sign-off"
              : "Pending previous PO task");

            const completedOn = isApproved
              ? (t.modifiedon ? toUsDate(t.modifiedon) : (matchedPo?.createdOn ? toUsDate(matchedPo.createdOn) : "—"))
              : "—";

            return {
              id: t.cr49f_approvaltasksid || index,
              sequence: t.cr49f_sequence || index + 1,
              task: t.cr49f_task || "PO Verification Task",
              status: label,
              statusClass: sClass,
              assignedTo: roleName,
              initials: getInitials(roleName),
              remarks,
              completedOn,
              approvalTaskId: t.cr49f_approvaltasksid,
            };
          });
        }

        const poCycle = SAMPLE_APPROVAL_CYCLES.find((c) => c.objectType === 3);
        const cycleTasks = poCycle?.tasks || [
          { cr49f_task: "PO Generation & Contract Line Validation", cr49f_role: 4, cr49f_sequencenumber: 1 },
          { cr49f_task: "Supplier Risk, Compliance & Terms Verification", cr49f_role: 2, cr49f_sequencenumber: 2 },
          { cr49f_task: "Financial Controller Budget Commitment Sign-Off", cr49f_role: 3, cr49f_sequencenumber: 3 },
          { cr49f_task: "Executive Procurement Director Authorization", cr49f_role: 2, cr49f_sequencenumber: 4 },
          { cr49f_task: "PO Dispatch & Vendor Confirmation Acknowledgment", cr49f_role: 4, cr49f_sequencenumber: 5 },
        ];
        const isApproved = poMilestoneStatus === "Completed";
        return cycleTasks.map((ct, idx) => {
          const roleLabel = Cr49f_approvaltasksescr49f_role[ct.cr49f_role as keyof typeof Cr49f_approvaltasksescr49f_role] || "Procurement Admin";
          const label = isApproved ? "Completed" : idx === 0 ? "In Progress" : "Pending";
          const sClass = isApproved ? "completed" : idx === 0 ? "in-progress" : "pending";
          return {
            id: `po-t-${idx + 1}`,
            sequence: ct.cr49f_sequencenumber || idx + 1,
            task: ct.cr49f_task,
            status: label,
            statusClass: sClass,
            assignedTo: roleLabel,
            initials: getInitials(roleLabel),
            remarks: isApproved
              ? "Completed for purchase order stage"
              : idx === 0
              ? "Order compliance & terms validation in progress"
              : "Queued for the next workflow action",
            completedOn: isApproved && matchedPo?.createdOn ? toUsDate(matchedPo.createdOn) : "—",
          };
        });
      }

      // No PO created yet: do not show any tasks until PO is initiated
      return [];
    }

    // 4. Invoices / Closed: not initiated yet, do not show any tasks
    return [];
  })();

  const lineItems = record.lineItems ?? [];

  const associatedRfqs = (() => {
    const list: Array<{
      refNo: string;
      title: string;
      pr: string;
      po: string;
      responses: number | string;
      supplier: string;
      createdBy: string;
      createdDate: string;
      status: string;
    }> = [];

    if (matchedRfq) {
      const raw = matchedRfq as unknown as Record<string, unknown>;
      list.push({
        refNo: matchedRfq.cr49f_rfqnumber || matchedRfq.cr49f_requestforqoutationid,
        title: matchedRfq.cr49f_rfqtitle || "Request for Quotation",
        pr: record.ref,
        po: matchedPo ? (matchedPo.refNo || "—") : "—",
        responses: 0,
        supplier: (matchedRfq as any).supplier || "—",
        createdBy: matchedRfq.createdbyname || (raw.createdbyyominame as string) || "Procurement Admin",
        createdDate: matchedRfq.createdon ? toUsDate(matchedRfq.createdon) : record.date,
        status: matchedRfq.cr49f_status === 1 ? "Approved" : matchedRfq.cr49f_status === 3 ? "Rejected" : "In Review",
      });
    }

    if (record.rfq && record.rfq.startsWith("RFQ-") && !list.some((r) => r.refNo === record.rfq)) {
      const found = rfqs.filter((r) => r.refNo === record.rfq);
      list.push(...found);
    }

    return list;
  })();

  // Associated Tasks: only the PR Creation stage's tasks that are still
  // In Progress or Pending (not the completed ones).
  const prCreationActiveTasks = buildDefaultSubTasks(record).filter(
    (task) => task.status === "In Progress" || task.status === "Pending"
  );
  const summaryItems = lineItems.length
    ? lineItems.map((item) => item.itemName).join(", ")
    : undefined;
  const aiSummary = [
    summaryItems ? `This request covers ${summaryItems}.` : record.title,
    `${record.status === "In Review" ? "It is currently awaiting review." : `Current status is ${statusLabel.toLowerCase()}.`}`,
  ].join(" ");

  const milestoneDisplayStatus = activeMilestone?.status === "Current"
    ? "In Progress"
    : activeMilestone?.status === "Skipped"
    ? "Not Applicable"
    : (activeMilestone?.status || "Pending");

  const milestoneTagClass = activeMilestone?.status === "Completed"
    ? "completed"
    : activeMilestone?.status === "Current"
    ? "in-progress"
    : activeMilestone?.status === "Rejected"
    ? "rejected"
    : "pending";

  const milestoneSubtitle = (() => {
    if (!activeMilestone) return "";
    if (isPrCreationMilestone) {
      return activeMilestone.status === "Completed"
        ? `Milestone status: Completed · ${record.requester || record.createdBy}`
        : `Milestone status: In Progress · ${record.requester || record.createdBy}`;
    }
    if (isRfqMilestone) {
      return isRfqCreated
        ? `Milestone status: ${milestoneDisplayStatus} · ${matchedRfq?.cr49f_rfqnumber || "RFQ"}${matchedRfq?.cr49f_rfqtitle ? ` (${matchedRfq.cr49f_rfqtitle})` : ""}`
        : `Milestone status: Pending - Tannu Jha`;
    }
    if (isPoMilestone) {
      return isPoCreated
        ? `Milestone status: ${milestoneDisplayStatus} · ${matchedPo?.refNo || "PO"}`
        : `Milestone status: Pending · Purchasing Agent`;
    }
    return activeMilestone.date
      ? `Milestone activity on ${activeMilestone.date}`
      : `Milestone status: ${milestoneDisplayStatus}`;
  })();

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note: RequestNote = {
      id: createNoteId(),
      title: noteTitle.trim(),
      type: noteType,
      description: noteDescription.trim(),
      attachmentName: noteAttachment?.name ?? "",
      taggedUsers: [...new Set(noteTaggedUsers.split(",").map((user) => user.trim()).filter(Boolean))],
      author: record.requester || record.createdBy,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [note, ...notes];
    setNoteCollection({ ref: record.ref, notes: updatedNotes });
    try {
      window.localStorage.setItem(notesStorageKey(record.ref), JSON.stringify(updatedNotes));
    } catch {
      // Keep the new note available for this session if browser storage is unavailable.
    }
    setNoteTitle("");
    setNoteType("Public");
    setNoteDescription("");
    setNoteTaggedUsers("");
    setNoteAttachment(null);
    setIsNoteFormOpen(false);
  };

  const removeNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    setNoteCollection({ ref: record.ref, notes: updatedNotes });
    try {
      window.localStorage.setItem(notesStorageKey(record.ref), JSON.stringify(updatedNotes));
    } catch {
      // Note stays removed for this session even if browser storage is unavailable.
    }
  };

  const toggleMilestone = (step: ApprovalStep) => {
    if (subTasksOpen && activeMilestone?.step === step.step) {
      setSubTasksOpen(false);
      return;
    }

    setSelectedMilestone(step);
    setSubTasksOpen(true);
  };

  return (
    <div className="pr-detail-page">
      <div className="pr-detail-heading">
        <div className="pr-detail-heading-left">
          <button type="button" className="pr-detail-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />
          </button>

          <div>
            <div className="pr-detail-title-row">
              <h1>{record.ref}</h1>
              <span className={`pr-detail-status-pill ${statusPillClass(statusLabel)}`}>{statusLabel}</span>
            </div>
            <p className="pr-detail-subtitle">{record.title}</p>
          </div>
        </div>

        <div className="pr-detail-actions">
          {matchedRfq ? (
            <button
              type="button"
              className="pr-detail-primary-btn"
              onClick={() => navigate(`/rfqs/${matchedRfq.cr49f_rfqnumber || matchedRfq.cr49f_requestforqoutationid}`)}
              title="View the RFQ linked to this Purchase Request"
            >
              <FileText size={11} />
              View Linked RFQ ({matchedRfq.cr49f_rfqnumber || "RFQ"})
            </button>
          ) : isPrApproved ? (
            <button
              type="button"
              className="pr-detail-primary-btn"
              onClick={() => setIsCreateRfqModalOpen(true)}
              title="Initiate RFQ for this approved PR"
            >
              <FileText size={11} />
              Initiate RFQ
            </button>
          ) : null}
        </div>
      </div>

      <section className="pr-detail-card pr-journey-card">
        <div className="pr-detail-card-header">
          <div className="pr-detail-card-header-left">
            <div className="pr-detail-card-icon">
              <Clock size={12} />
            </div>
            <div className="pr-detail-card-title">
              <h2>PR Journey</h2>
              <p>Track progress from PR creation through closure</p>
            </div>
          </div>
        </div>

        <div className="approval-timeline">
          {visibleApprovalSteps.map((step, index) => {
            const isPreviousCompleted = index > 0 && visibleApprovalSteps[index - 1].status === "Completed";
            const displayStatus = step.status === "Current" ? "In Progress" : (step.status === "Skipped" ? "Not Applicable" : step.status);
            return (
              <button
                className={`approval-step ${activeMilestone?.step === step.step ? "selected" : ""}`}
                key={step.step}
                type="button"
                aria-label={`${step.title}, ${displayStatus}. View milestone tasks`}
                aria-pressed={activeMilestone?.step === step.step}
                aria-expanded={subTasksOpen && activeMilestone?.step === step.step}
                onClick={() => toggleMilestone(step)}
              >
                <div className={`approval-step-line ${isPreviousCompleted ? "done" : ""}`} />
                <div className={`approval-step-circle ${stepCircleClass(step.status)}`}>{index + 1}</div>

                <div className="approval-step-label">
                  <strong>{step.title}</strong>
                  <span className={`approval-step-status ${displayStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                    {displayStatus}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {activeMilestone && (
        <section className="pr-detail-card">
          <div className="pr-detail-card-header">
            <div className="pr-detail-card-header-left">
              <div className={`pr-detail-card-icon ${milestoneIconClass(activeMilestone.status)}`}>
                <ShieldCheck size={12} />
              </div>
              <div className="pr-detail-card-title">
                <h2>{activeMilestone.title} - Sub Tasks</h2>
                <p>{milestoneSubtitle}</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <span className={`pr-detail-status-tag ${milestoneTagClass}`}>
                <ShieldCheck size={9} />
                {milestoneDisplayStatus}
              </span>

              <button
                type="button"
                className="pr-detail-collapse-btn"
                onClick={() => setSubTasksOpen((open) => !open)}
                style={{ transform: subTasksOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                aria-label="Toggle sub-tasks"
              >
                <ChevronUp size={12} />
              </button>
            </div>
          </div>

          {subTasksOpen && (
            <div className="pr-detail-table-wrapper">
              <table className="pr-detail-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Remarks</th>
                    <th>Completed On</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMilestoneTasks.length > 0 ? (
                    activeMilestoneTasks.map((task) => (
                      <tr
                        key={task.id}
                        style={{ cursor: task.approvalTaskId ? "pointer" : "default" }}
                        onClick={() => {
                          if (task.approvalTaskId) {
                            navigate(`/tasks/${task.approvalTaskId}`);
                          }
                        }}
                        title={task.approvalTaskId ? "Click to view task details, approve/reject, or add comment" : undefined}
                      >
                        <td>{task.sequence}</td>
                        <td>
                          {task.approvalTaskId ? (
                            <span
                              style={{
                                fontWeight: 600,
                                color: "var(--primary-hex, #2563eb)",
                                textDecoration: "underline",
                                textUnderlineOffset: 3,
                                cursor: "pointer",
                              }}
                            >
                              {task.task}
                            </span>
                          ) : (
                            task.task
                          )}
                        </td>
                        <td>
                          <span className={`subtask-status ${task.statusClass}`}>{task.status}</span>
                        </td>
                        <td>
                          <div className="pr-detail-table-avatar">
                            <span>{task.initials}</span>
                            {task.assignedTo}
                          </div>
                        </td>
                        <td>{task.remarks}</td>
                        <td>{task.completedOn}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "20px 16px", color: "var(--muted-foreground-hex)" }}>
                        {isPoMilestone && !isPoCreated
                          ? "Purchase Order has not been initiated yet. Tasks will appear once a PO is created."
                          : isRfqMilestone && !isRfqCreated
                          ? "Request for Quotation has not been initiated yet. Tasks will appear once an RFQ is created."
                          : "No sub-tasks recorded for this milestone."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="pr-detail-card">
        <div className="pr-detail-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "RFQs" && (
          <div className="pr-rfq-section">
            <div className="pr-rfq-card-header">
              <div>
                <div className="pr-rfq-title-row">
                  <span className="pr-rfq-icon">✦</span>
                  <h3>Request For Quotations ({associatedRfqs.length})</h3>
                </div>
                <p>RFQ records linked to this purchase request</p>
              </div>
            </div>

            {associatedRfqs.length ? (
              <div className="pr-rfq-table-wrap">
                <table className="pr-rfq-table">
                  <thead>
                    <tr>
                      <th>Ref No</th>
                      <th>Title</th>
                      <th>Associated PR</th>
                      <th>Associated PO</th>
                      <th>Responses</th>
                      <th>Supplier</th>
                      <th>Created By</th>
                      <th>Created Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associatedRfqs.map((rfq) => (
                      <tr key={rfq.refNo}>
                        <td className="pr-rfq-ref">{rfq.refNo}</td>
                        <td>{rfq.title}</td>
                        <td>{rfq.pr.startsWith("PR-") ? rfq.pr : "—"}</td>
                        <td>{rfq.po.startsWith("PO-") ? rfq.po : "—"}</td>
                        <td>{rfq.responses}</td>
                        <td>{rfq.supplier === "N/A" ? "—" : rfq.supplier}</td>
                        <td>{rfq.createdBy}</td>
                        <td>{rfq.createdDate}</td>
                        <td><span className={`pr-rfq-status ${rfq.status.toLowerCase()}`}>{rfq.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-rfq-empty">
                <FileText size={19} />
                <strong>No RFQ linked</strong>
                <span>This purchase request does not have an associated RFQ.</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "Associated Tasks" && (
          <div className="pr-associated-tasks">
            <div className="pr-associated-tasks-heading">
              <div>
                <h3>Associated Approval Tasks (cr49f_approvaltasks)</h3>
                <p>Configured sequential workflow approval tasks for this Purchase Request</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>{approvalTasks.length} tasks configured</span>
                {approvalTasks.length < 4 && (
                  <button
                    type="button"
                    className="pr-detail-primary-btn"
                    onClick={handleGenerateTasks}
                    disabled={loadingTasks}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                  >
                    {loadingTasks ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span>{approvalTasks.length === 0 ? "Generate Tasks" : "Generate All Tasks"}</span>
                  </button>
                )}
              </div>
            </div>

            {taskActionNotice && (
              <div
                style={{
                  padding: "10px 14px",
                  background: taskActionNotice.toLowerCase().includes("fail") ||
                              taskActionNotice.toLowerCase().includes("could not") ||
                              taskActionNotice.toLowerCase().includes("error")
                    ? "#fef2f2"
                    : "#f0fdf4",
                  border: taskActionNotice.toLowerCase().includes("fail") ||
                          taskActionNotice.toLowerCase().includes("could not") ||
                          taskActionNotice.toLowerCase().includes("error")
                    ? "1px solid #fecaca"
                    : "1px solid #bbf7d0",
                  color: taskActionNotice.toLowerCase().includes("fail") ||
                         taskActionNotice.toLowerCase().includes("could not") ||
                         taskActionNotice.toLowerCase().includes("error")
                    ? "#991b1b"
                    : "#166534",
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{taskActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setTaskActionNotice(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {approvalTasks.length > 0 ? (
              <div className="pr-detail-table-wrapper">
                <table className="pr-detail-table">
                  <thead>
                    <tr>
                      <th style={{ width: 45 }}>#</th>
                      <th>Task Title</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>SLA</th>
                      <th>Task State</th>
                      <th>Approval Status</th>
                      <th style={{ textAlign: "center", width: 190 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalTasks.map((task) => {
                      const isActive = task.statecode === 0;
                      const approvalStatus = getTaskApprovalStatusLabel(task);
                      const isPending = approvalStatus === "Pending";
                      const isApproved = approvalStatus === "Approved";
                      const isRejected = approvalStatus === "Rejected";

                      const deptLabel =
                        task.cr49f_department &&
                        Cr49f_approvaltasksescr49f_department[task.cr49f_department]
                          ? Cr49f_approvaltasksescr49f_department[task.cr49f_department]
                          : "Administrator";

                      const roleLabel =
                        task.cr49f_role &&
                        Cr49f_approvaltasksescr49f_role[task.cr49f_role]
                          ? Cr49f_approvaltasksescr49f_role[task.cr49f_role]
                          : "Procurement Admin";

                      const slaUnitLabel =
                        task.cr49f_slaunit &&
                        Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit]
                          ? Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit]
                          : "Hours";

                      const slaLabel = `${task.cr49f_slanumber ?? 24} ${slaUnitLabel}`;

                      return (
                        <tr key={task.cr49f_approvaltasksid}>
                          <td><strong>{task.cr49f_sequence ?? 1}</strong></td>
                          <td>
                            <strong
                              style={{ color: "var(--primary-hex, #2563eb)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                              onClick={() => navigate(`/tasks/${task.cr49f_approvaltasksid}`)}
                              title="Click to view full task page"
                            >
                              {task.cr49f_task}
                            </strong>
                            {task.cr49f_id && task.cr49f_id !== task.cr49f_task && (
                              <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                {task.cr49f_id}
                              </span>
                            )}
                          </td>
                          <td>{deptLabel}</td>
                          <td>{roleLabel}</td>
                          <td>{slaLabel}</td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isActive ? "#dcfce7" : "#f1f5f9",
                                color: isActive ? "#15803d" : "#64748b",
                              }}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isApproved
                                  ? "#dcfce7"
                                  : isRejected
                                  ? "#fee2e2"
                                  : "#fef3c7",
                                color: isApproved
                                  ? "#15803d"
                                  : isRejected
                                  ? "#b91c1c"
                                  : "#b45309",
                              }}
                            >
                              {approvalStatus}
                            </span>
                            {isApproved && (task.cr49f_approvedby || task.cr49f_approvedon) && (
                              <span style={{ display: "block", fontSize: 10, color: "#64748b", marginTop: 2 }}>
                                {task.cr49f_approvedby ? `by ${task.cr49f_approvedby}` : ""}
                                {task.cr49f_approvedon ? ` (${new Date(task.cr49f_approvedon).toLocaleDateString()})` : ""}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {isActive && isPending ? (
                              <div style={{ display: "inline-flex", gap: 6, justifyContent: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => void handleApprove(task)}
                                  disabled={actioningTaskId === task.cr49f_approvaltasksid}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#ffffff",
                                    backgroundColor: "#16a34a",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                  title="Approve task and activate next task in sequence"
                                >
                                  {actioningTaskId === task.cr49f_approvaltasksid ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <ThumbsUp size={11} />
                                  )}
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReject(task)}
                                  disabled={actioningTaskId === task.cr49f_approvaltasksid}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#ffffff",
                                    backgroundColor: "#dc2626",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                  title="Reject task (further tasks remain inactive)"
                                >
                                  <ThumbsDown size={11} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : isApproved ? (
                              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                                ✓ Approved
                              </span>
                            ) : isRejected ? (
                              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                                ✕ Rejected
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                Waiting for previous task
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : prCreationActiveTasks.length ? (
              <div className="pr-detail-table-wrapper">
                <table className="pr-detail-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Completed On</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prCreationActiveTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.task}</td>
                        <td><span className={`subtask-status ${subtaskStatusClass(task.status)}`}>{task.status}</span></td>
                        <td>
                          <div className="pr-detail-table-avatar">
                            <span>{getInitials(task.assignedTo)}</span>
                            {task.assignedTo}
                          </div>
                        </td>
                        <td>{task.completedOn || "—"}</td>
                        <td>{task.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-associated-tasks-empty">
                No approval tasks found for this request. Click "Generate Tasks" above to create them.
              </div>
            )}
          </div>
        )}

        {activeTab === "Notes" && (
          <div className="pr-notes-section">
            <div className="pr-notes-heading">
              <div>
                <h3>Notes</h3>
                <p>Notes and updates for {record.ref}</p>
              </div>
              <button type="button" className="pr-note-create-btn" onClick={() => setIsNoteFormOpen(true)}>
                <Plus size={14} />New note
              </button>
            </div>

            {notes.length ? (
              <div className="pr-note-list">
                {notes.map((note) => (
                  <article className="pr-note-card" key={note.id}>
                    <div className="pr-note-card-top">
                      <span className="pr-note-author-avatar">{getInitials(note.author)}</span>
                      <div className="pr-note-author">
                        <strong>{note.author}</strong>
                        <time dateTime={note.createdAt}>{formatNoteDate(note.createdAt)}</time>
                      </div>
                      <span className={`pr-note-visibility ${note.type.toLowerCase()}`}>{note.type}</span>
                      <button
                        type="button"
                        className="pr-note-remove-btn"
                        aria-label={`Remove note: ${note.title}`}
                        onClick={() => removeNote(note.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <h4>{note.title}</h4>
                    {note.description && <p>{note.description}</p>}
                    {note.attachmentName && <span className="pr-note-attachment"><Paperclip size={12} />{note.attachmentName}</span>}
                    {note.taggedUsers.length > 0 && (
                      <div className="pr-note-tags">
                        <span>Tagged</span>
                        {note.taggedUsers.map((user) => <span className="pr-note-tag" key={user}>{user}</span>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="pr-notes-empty">
                <ClipboardList size={20} />
                <strong>No notes yet</strong>
                <span>Add a note to keep request context with this PR.</span>
              </div>
            )}

            {isNoteFormOpen && (
              <div className="pr-note-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsNoteFormOpen(false); }}>
                <section className="pr-note-modal" role="dialog" aria-modal="true" aria-labelledby="pr-note-modal-title">
                  <header className="pr-note-modal-header">
                    <h2 id="pr-note-modal-title">New note</h2>
                    <button type="button" onClick={() => setIsNoteFormOpen(false)} aria-label="Close new note form"><X size={16} /></button>
                  </header>
                  <form onSubmit={saveNote}>
                    <label className="pr-note-field">
                      <span>Title <b>*</b></span>
                      <input autoFocus required maxLength={120} value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Type <b>*</b></span>
                      <select value={noteType} onChange={(event) => setNoteType(event.target.value as RequestNote["type"])}>
                        <option value="Public">Public</option>
                        <option value="Private">Private</option>
                      </select>
                    </label>
                    <label className="pr-note-field">
                      <span>Attachment</span>
                      <input type="file" onChange={(event) => setNoteAttachment(event.target.files?.[0] ?? null)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Description <b>*</b></span>
                      <textarea required rows={4} maxLength={2000} value={noteDescription} onChange={(event) => setNoteDescription(event.target.value)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Tag users</span>
                      <input placeholder="Enter names separated by commas" value={noteTaggedUsers} onChange={(event) => setNoteTaggedUsers(event.target.value)} />
                    </label>
                    <footer className="pr-note-modal-actions">
                      <button type="button" className="secondary" onClick={() => setIsNoteFormOpen(false)}>Cancel</button>
                      <button type="submit" className="primary">Save note</button>
                    </footer>
                  </form>
                </section>
              </div>
            )}
          </div>
        )}

        {activeTab === "Attachments" && (
          <div className="pr-detail-tab-empty">No {activeTab.toLowerCase()} linked to this purchase request yet.</div>
        )}

        {activeTab === "Summary" && (
          <>
            <section className="pr-summary-kpis" aria-label="Purchase request summary metrics">
              <article className="pr-summary-kpi department">
                <span className="pr-summary-kpi-icon"><Building2 size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Department</small><strong>{record.department || "IT Department"}</strong></span>
              </article>
              <article className={`pr-summary-kpi ${statusPillClass(statusLabel)}`}>
                <span className="pr-summary-kpi-icon"><ShieldCheck size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Current Status</small><strong>{statusLabel}</strong></span>
              </article>
              <article className="pr-summary-kpi priority">
                <span className="pr-summary-kpi-icon"><Flag size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Priority</small><strong>{priorityLabel}</strong></span>
              </article>
              <article className="pr-summary-kpi due-date">
                <span className="pr-summary-kpi-icon"><CalendarDays size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Required By</small><strong>{record.requiredDate || "Not set"}</strong></span>
              </article>
            </section>

            <div className="pr-summary-layout">
              <div className="pr-summary-main-column">
                <section className="pr-ai-summary" aria-labelledby="pr-ai-summary-title">
                  <div className="pr-ai-summary-heading">
                    <span><Sparkles size={14} /></span>
                    <h2 id="pr-ai-summary-title">AI Summary</h2>
                    <small>Record-backed</small>
                  </div>
                  <p>{aiSummary}</p>
                  <span className="pr-ai-summary-note">Generated from the fields and procurement links recorded on this request.</span>
                </section>

                <div className="pr-summary-top">
                  <div className="pr-summary-title">
                    <ClipboardList size={13} />
                    Purchase Request Details
                  </div>
                </div>

                <div className="pr-detail-grid">
                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><FileText size={11} /></div>
                    <div>
                      <span>PR Number</span>
                      <strong>{record.ref}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><User size={11} /></div>
                    <div>
                      <span>Requester</span>
                      <strong>{record.requester || record.createdBy}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><Tag size={11} /></div>
                    <div>
                      <span>Title</span>
                      <strong>{record.title}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><Building2 size={11} /></div>
                    <div>
                      <span>Department</span>
                      <strong>{record.department || "—"}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                    <div>
                      <span>Request Date</span>
                      <strong>{record.date}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                    <div>
                      <span>Required Date</span>
                      <strong>{record.requiredDate || "—"}</strong>
                    </div>
                  </div>

                  <div className="pr-detail-field">
                    <div className="pr-detail-field-icon"><Flag size={11} /></div>
                    <div>
                      <span>Priority</span>
                      <strong>{priorityLabel}</strong>
                    </div>
                  </div>
                </div>

                <div className="pr-detail-justification">
                  <span>Business Justification</span>
                  <p>{record.justification || "No business justification provided."}</p>
                  <small>Delivery location: {record.deliveryAddress || "—"}</small>
                </div>

                <div className="pr-detail-lineitems-heading">
                  <FileText size={11} />
                  Purchase Request Line Items ({lineItems.length})
                </div>

                <div className="pr-detail-table-wrapper">
                  <table className="pr-detail-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Previous Contract</th>
                        <th>Delivery Date</th>
                        <th>Delivery Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.length ? lineItems.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.itemCode}</td>
                          <td>{item.itemName}</td>
                          <td>{item.previousContract}</td>
                          <td>{item.deliveryDate}</td>
                          <td>{item.deliveryAddress}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6}>No line items are linked to this purchase request.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="pr-summary-approval-card">
                <div className="pr-summary-approval-heading">
                  <Clock size={17} />
                  <h2>Approval History</h2>
                </div>
                <div className="pr-summary-approval-list">
                  {historyEvents.length > 0 ? historyEvents.map((step, index) => {
                    const [actor, role] = (step.by ?? "").split("|").map((part) => part.trim());
                    const stepStatusClass = step.status === "Current" ? "in-progress" : step.status.toLowerCase();
                    return (
                      <button
                        type="button"
                        className={`pr-summary-approval-step ${stepStatusClass} ${activeMilestone?.step === step.step ? "selected" : ""}`}
                        key={step.step}
                        aria-label={`${step.title}, ${step.status}. View milestone tasks`}
                        aria-expanded={subTasksOpen && activeMilestone?.step === step.step}
                        onClick={() => toggleMilestone(step)}
                      >
                        <span className="pr-summary-approval-rail">
                          <span className="pr-summary-approval-node">{step.status === "Completed" ? "✓" : index + 1}</span>
                        </span>
                        <span className="pr-summary-approval-copy">
                          <strong>{step.title}</strong>
                          <span className={`pr-summary-approval-badge ${stepStatusClass}`}>
                            {step.status === "Current" ? "In progress" : step.status}
                          </span>
                          {actor && <span><b>{actor}</b>{role && <>: <em>{role}</em></>}</span>}
                          {step.department && <span>{step.department}</span>}
                          {step.date && <small>{step.date}</small>}
                        </span>
                      </button>
                    );
                  }) : <p className="pr-summary-approval-empty">No approval actions recorded yet.</p>}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>

      {liveRecord && (
        <CreateRFQModal
          isOpen={isCreateRfqModalOpen}
          onClose={() => setIsCreateRfqModalOpen(false)}
          onCreated={async () => {
            setIsCreateRfqModalOpen(false);
            try {
              const [rfqRes, posRes] = await Promise.allSettled([
                Cr49f_requestforqoutationsService.getAll(),
                getDynamicPurchaseOrders(),
              ]);
              if (rfqRes.status === "fulfilled" && rfqRes.value.success) {
                setAllRfqs((rfqRes.value.data ?? []) as Cr49f_requestforqoutations[]);
              }
              if (posRes.status === "fulfilled") {
                setAllOrders(posRes.value ?? []);
              }
              if (liveRecord.cr49f_purchaserequestid) {
                await loadApprovalTasks(liveRecord.cr49f_purchaserequestid);
              }
            } catch (err) {
              console.warn("Refresh after RFQ creation failed:", err);
            }
            setSelectedMilestone({ step: 2, title: "RFQ Initiated", status: "Current" });
          }}
          existingRfqs={allRfqs}
          initialPurchaseRequestId={liveRecord.cr49f_purchaserequestid}
          initialPurchaseRequest={{
            cr49f_purchaserequestid: liveRecord.cr49f_purchaserequestid,
            cr49f_prnumber: liveRecord.cr49f_prnumber || record.ref,
            cr49f_prtitle: liveRecord.cr49f_prtitle || record.title,
            cr49f_deliverylocation: liveRecord.cr49f_deliverylocation || record.deliveryAddress,
          }}
          isPurchaseRequestReadOnly={true}
        />
      )}
    </div>
  );
}