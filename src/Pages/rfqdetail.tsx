import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Percent,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
  getInitials,
  getRfqByRef,
  type RfqApprovalStep,
  type RfqRecord,
  type RfqLineItem,
  type RfqSupplier,
} from "../data/RFQdata";

import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import { Cr49f_rfqresponselinesService } from "../generated/services/Cr49f_rfqresponselinesService";
import { SearchSupplierService } from "../generated/services/SearchSupplierService";
import {
  parseSupplierRecommendationsFromFlow,
  resolveSuppliersFromRecommendations,
  type FlowSupplierRecommendation,
} from "../components/CreateRFQModal";

import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_selectedsupplierses } from "../generated/models/Cr49f_selectedsuppliersesModel";
import type { Cr49f_rfqresponselines } from "../generated/models/Cr49f_rfqresponselinesModel";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";

import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_role,
  Cr49f_approvaltasksescr49f_slaunit,
} from "../generated/models/Cr49f_approvaltasksesModel";

import {
  cleanGuid,
  createApprovalTasksForObject,
  getApprovalTasksForRecord,
  getTaskApprovalStatusLabel,
  approveTask,
  rejectTask,
} from "../Services/ApprovalWorkflowService";

import { INITIAL_SAMPLE_SUPPLIERS } from "../data/SampleSuppliersData";
import {
  getSupplierResponsesForRfq,
  type FullSupplierResponse,
} from "../Services/RfqSupplierResponseService";
import { QuotationDocumentModal } from "../components/QuotationDocumentModal";

import "../Styles/RFQSummary.css";
import "../Styles/SupplierPortal.css";

const TABS = [
  "Summary",
  "Purchase Request",
  "Associated Tasks",
  "Supplier Responses",
  "Notes",
  "Attachments",
  "Orders",
];

interface RfqNote {
  id: string;
  title: string;
  body: string;
  type: "Internal" | "Clarification";
  author: string;
  createdAt: string;
}

function toUsDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) return value;
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function getDaysRemaining(value?: string | null): { text: string; tone: "green" | "amber" | "red" } | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 3) return { text: `${diffDays} days left`, tone: "green" };
  if (diffDays >= 0) return { text: `${diffDays} day${diffDays === 1 ? "" : "s"} left`, tone: "amber" };
  return { text: `${Math.abs(diffDays)} days overdue`, tone: "red" };
}

function getStatusBadge(status?: number | string | null): { label: string; tone: string } {
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s.includes("reward") || s === "rewarded") return { label: "Rewarded", tone: "rewarded" };
    if (s.includes("approv") || s === "approved") return { label: "Approved", tone: "approved" };
    if (s.includes("change")) return { label: "Changes Needed", tone: "changes-needed" };
    if (s.includes("reject")) return { label: "Rejected", tone: "rejected" };
    return { label: "Pending", tone: "pending" };
  }
  switch (Number(status)) {
    case 1:
      return { label: "Approved", tone: "approved" };
    case 2:
      return { label: "Changes Needed", tone: "changes-needed" };
    case 3:
      return { label: "Rejected", tone: "rejected" };
    default:
      return { label: "Pending", tone: "pending" };
  }
}

export default function RfqDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Summary");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live Dataverse records
  const [liveRfq, setLiveRfq] = useState<Cr49f_requestforqoutations | null>(null);
  const [mockRfq, setMockRfq] = useState<RfqRecord | null>(null);
  const [linkedPR, setLinkedPR] = useState<Cr49f_purchaserequests | null>(null);
  const [prLines, setPrLines] = useState<Cr49f_purchaserequestlines[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Cr49f_suppliers[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Cr49f_selectedsupplierses[]>([]);
  const [_responseLines, setResponseLines] = useState<Cr49f_rfqresponselines[]>([]);
  const [fullSupplierResponses, setFullSupplierResponses] = useState<FullSupplierResponse[]>([]);
  const [selectedQuotationForView, setSelectedQuotationForView] = useState<FullSupplierResponse | null>(null);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<RfqSupplier | null>(null);
  const [isRewardingSupplier, setIsRewardingSupplier] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  // Dynamic SearchSupplier flow invited suppliers
  const [flowInvitedSuppliers, setFlowInvitedSuppliers] = useState<RfqSupplier[]>([]);
  const [isLoadingFlowSuppliers, setIsLoadingFlowSuppliers] = useState<boolean>(false);

  // Approval workflow tasks
  const [approvalTasks, setApprovalTasks] = useState<Cr49f_approvaltaskses[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [actioningTaskId, setActioningTaskId] = useState<string | null>(null);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  // Notes state
  const notesKey = `procurement360.notes.rfq.${cleanGuid(ref) || ref || "unknown"}`;
  const [notes, setNotes] = useState<RfqNote[]>(() => {
    try {
      const saved = localStorage.getItem(notesKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [newNoteType, setNewNoteType] = useState<"Internal" | "Clarification">("Internal");

  // Load RFQ Data & Related Records from Dataverse
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!ref) return;
      setLoading(true);
      setLoadError(null);

      try {
        // 1. Fetch live RFQ from Dataverse
        const rfqRes = await Cr49f_requestforqoutationsService.getAll();
        const cleanRef = cleanGuid(ref);
        const searchRefLower = ref.toLowerCase().trim();

        const foundLive = rfqRes.success && rfqRes.data
          ? rfqRes.data.find((r) => {
              const id = cleanGuid(r.cr49f_requestforqoutationid);
              const num = (r.cr49f_rfqnumber || "").toLowerCase().trim();
              return id === cleanRef || num === searchRefLower;
            })
          : null;

        if (foundLive) {
          if (!isMounted) return;
          setLiveRfq(foundLive);
          setMockRfq(null);

          const rfqId = cleanGuid(foundLive.cr49f_requestforqoutationid);

          // 2. Fetch linked PR and lines if available
          const raw = foundLive as unknown as Record<string, unknown>;
          const prId =
            cleanGuid(foundLive._cr49f_prrfq_value) ||
            cleanGuid(raw._cr49f_PRRFQ_value as string) ||
            cleanGuid(raw.cr49f_prrfq as string);

          if (prId) {
            try {
              const prRes = await Cr49f_purchaserequestsService.getAll();
              if (prRes.success && prRes.data) {
                const foundPr = prRes.data.find(
                  (p) => cleanGuid(p.cr49f_purchaserequestid) === prId
                );
                if (foundPr && isMounted) {
                  setLinkedPR(foundPr);
                }
              }

              const linesRes = await Cr49f_purchaserequestlinesService.getAll();
              if (linesRes.success && linesRes.data && isMounted) {
                const matching = linesRes.data.filter(
                  (l) => cleanGuid(l._cr49f_purchaserequest_value) === prId
                );
                setPrLines(matching);
              }
            } catch (prErr) {
              console.warn("Could not load linked PR records:", prErr);
            }
          }

          // 3. Fetch Selected Suppliers and Response Lines
          try {
            const [selSuppRes, respLinesRes, suppRes] = await Promise.allSettled([
              Cr49f_selectedsuppliersesService.getAll(),
              Cr49f_rfqresponselinesService.getAll(),
              Cr49f_suppliersService.getAll(),
            ]);

            if (selSuppRes.status === "fulfilled" && selSuppRes.value.success && selSuppRes.value.data) {
              const matchedSel = selSuppRes.value.data.filter(
                (s) => cleanGuid(s._cr49f_rfq_value) === rfqId
              );
              if (isMounted) setSelectedSuppliers(matchedSel);
            }

            if (respLinesRes.status === "fulfilled" && respLinesRes.value.success && respLinesRes.value.data) {
              const matchedResp = respLinesRes.value.data.filter(
                (r) => cleanGuid(r._cr49f_rfqsupplierresponse_value) === rfqId
              );
              if (isMounted) setResponseLines(matchedResp);
            }

            if (suppRes.status === "fulfilled" && suppRes.value.success && suppRes.value.data) {
              if (isMounted) setAllSuppliers(suppRes.value.data);
            }

            // Load full structured supplier responses with quotation lines and statuses
            try {
              const fullResponses = await getSupplierResponsesForRfq(rfqId);
              if (isMounted) {
                setFullSupplierResponses(fullResponses);
              }
            } catch (fullRespErr) {
              console.warn("Could not load full supplier responses:", fullRespErr);
            }
          } catch (supErr) {
            console.warn("Could not load suppliers data:", supErr);
          }

          // 4. Fetch Approval Workflow Tasks
          if (rfqId) {
            setLoadingTasks(true);
            try {
              let tasks = await getApprovalTasksForRecord(2, rfqId);
              if (tasks.length === 0) {
                // Auto create approval cycle tasks if not present yet
                await createApprovalTasksForObject({
                  objectType: 2,
                  recordId: rfqId,
                  recordName: foundLive.cr49f_rfqtitle || "RFQ Sign-Off",
                });
                tasks = await getApprovalTasksForRecord(2, rfqId);
              }
              if (isMounted) {
                const filtered = tasks.filter(
                  (t) =>
                    (t.cr49f_sequence ?? 0) >= 1 &&
                    getTaskApprovalStatusLabel(t) !== "Changes Needed" &&
                    !t.cr49f_task?.toLowerCase().includes("changes needed")
                );
                // Deduplicate by sequence
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
              }
            } catch (taskErr) {
              console.warn("Could not load RFQ approval tasks:", taskErr);
            } finally {
              if (isMounted) setLoadingTasks(false);
            }
          }
        } else {
          // Fallback to static mock RFQ
          const fallback = getRfqByRef(ref);
          if (fallback && isMounted) {
            setMockRfq(fallback);
            setLiveRfq(null);
          } else if (isMounted) {
            setLoadError("RFQ not found in Dataverse or catalog.");
          }

          try {
            const suppRes = await Cr49f_suppliersService.getAll();
            if (suppRes.success && suppRes.data && isMounted) {
              setAllSuppliers(suppRes.data);
            }
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        console.error("Failed to load RFQ:", err);
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : "Error loading RFQ details.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [ref]);

  const associatedPrNumber = useMemo(() => {
    if (liveRfq) {
      const raw = liveRfq as unknown as Record<string, unknown>;
      return (
        (raw["_cr49f_prrfq_value@OData.Community.Display.V1.FormattedValue"] as string) ||
        liveRfq.cr49f_prrfqname ||
        linkedPR?.cr49f_prnumber ||
        null
      );
    }
    if (mockRfq) {
      return mockRfq.pr && mockRfq.pr.startsWith("PR-") ? mockRfq.pr : "PR-1009";
    }
    return null;
  }, [liveRfq, mockRfq, linkedPR]);

  // Dynamically trigger SearchSupplier flow for the RFQ's associated PR
  useEffect(() => {
    let isMounted = true;
    const prNum = associatedPrNumber || (mockRfq?.pr && mockRfq.pr !== "No PR available" ? mockRfq.pr : "PR-1009");
    const rfqId = cleanGuid(liveRfq?.cr49f_requestforqoutationid) || cleanGuid(ref) || ref || "";

    // 1. Check if cached from creation or previous flow run
    try {
      const stored =
        localStorage.getItem(`rfq_invited_suppliers_${rfqId}`) ||
        (liveRfq?.cr49f_rfqnumber ? localStorage.getItem(`rfq_invited_suppliers_${liveRfq.cr49f_rfqnumber}`) : null) ||
        localStorage.getItem(`rfq_flow_suppliers_${prNum}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFlowInvitedSuppliers(
            parsed.map((s: any, idx: number) => ({
              id: s.id || s.cr49f_supplierid || `flow-sup-${idx + 1}`,
              name: s.name || s.cr49f_name || `Supplier ${s.cr49f_supplierid1 || idx + 1}`,
              code: s.code || s.cr49f_supplierid1,
              category: s.category || s.cr49f_suppliercategory || "Hardware",
              email: s.email || s.cr49f_email || "vendor@partner.com",
              phone: s.phone || s.cr49f_phonenumber || "+91 80 4426 0000",
              address:
                s.address ||
                [s.cr49f_city, s.cr49f_country].filter(Boolean).join(", ") ||
                "Bengaluru, India",
              ranking: s.ranking ?? s.flowRank ?? (idx + 1),
              reason: s.reason || s.flowReason,
              verified: true,
              rewarded: false,
              hasResponse: false,
            }))
          );
        }
      }
    } catch {
      // Ignore
    }

    // 2. Query SearchSupplier flow
    async function fetchDynamicFlowSuppliers() {
      setIsLoadingFlowSuppliers(true);
      try {
        const flowPayload = {
          text: prNum,
          PR: prNum,
          pr: prNum,
        };

        const flowRes = await SearchSupplierService.Run(flowPayload);
        let recs: FlowSupplierRecommendation[] = [];
        if (flowRes?.data) {
          recs = parseSupplierRecommendationsFromFlow(flowRes.data);
        }
        if (recs.length === 0 && flowRes) {
          recs = parseSupplierRecommendationsFromFlow(flowRes);
        }

        if (recs.length === 0) {
          recs = [
            {
              rank: 1,
              supplierId: "SUP-1008",
              reason:
                "Offers Cisco Catalyst 9300 network switch matching the requested 48-port Gigabit PoE+ managed switch with Layer 3 routing capabilities.",
            },
            {
              rank: 2,
              supplierId: "SUP-1009",
              reason:
                "Provides comprehensive managed services including 24/7 proactive monitoring and level 2/3 incident resolution aligned with the requested emergency SLA.",
            },
          ];
        }

        const resolved = resolveSuppliersFromRecommendations(recs, allSuppliers);
        const mappedSuppliers: RfqSupplier[] = resolved.map((s, idx) => ({
          id: s.cr49f_supplierid || `flow-sup-${idx + 1}`,
          name: s.cr49f_name || `Supplier ${s.cr49f_supplierid1 || idx + 1}`,
          code: s.cr49f_supplierid1,
          category: s.cr49f_suppliercategory || "Hardware",
          email: s.cr49f_email || "vendor@partner.com",
          phone: s.cr49f_phonenumber || "+91 80 4426 0000",
          address:
            [s.cr49f_city, s.cr49f_country].filter(Boolean).join(", ") ||
            "Bengaluru, India",
          ranking: s.flowRank ?? (idx + 1),
          reason: s.flowReason,
          verified: true,
          rewarded: false,
          hasResponse: false,
        }));

        if (isMounted) {
          setFlowInvitedSuppliers(mappedSuppliers);
          try {
            localStorage.setItem(`rfq_flow_suppliers_${prNum}`, JSON.stringify(mappedSuppliers));
          } catch {
            // Ignore
          }
        }
      } catch (err) {
        console.warn("[rfqdetail] SearchSupplier flow error:", err);
      } finally {
        if (isMounted) {
          setIsLoadingFlowSuppliers(false);
        }
      }
    }

    void fetchDynamicFlowSuppliers();

    return () => {
      isMounted = false;
    };
  }, [associatedPrNumber, liveRfq, mockRfq, ref, allSuppliers]);

  // Refresh approval tasks
  const refreshTasks = async (rfqId: string) => {
    try {
      const tasks = await getApprovalTasksForRecord(2, rfqId);
      const filtered = tasks.filter(
        (t) =>
          (t.cr49f_sequence ?? 0) >= 1 &&
          getTaskApprovalStatusLabel(t) !== "Changes Needed" &&
          !t.cr49f_task?.toLowerCase().includes("changes needed")
      );
      setApprovalTasks(filtered);
    } catch (err) {
      console.warn("Could not refresh tasks:", err);
    }
  };

  // Handle task approval
  const handleApprove = async (task: Cr49f_approvaltaskses) => {
    const raw = task as unknown as Record<string, unknown>;
    const taskId = cleanGuid(
      task.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    if (!taskId) return;
    setActioningTaskId(taskId);
    setTaskNotice(null);
    try {
      const approverName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      const result = await approveTask(taskId, approverName);
      if (liveRfq) {
        await refreshTasks(liveRfq.cr49f_requestforqoutationid);
        const refreshed = await Cr49f_requestforqoutationsService.get(liveRfq.cr49f_requestforqoutationid);
        if (refreshed.success && refreshed.data) {
          setLiveRfq(refreshed.data);
        } else if (result.parentCompleted) {
          setLiveRfq((prev) => (prev ? { ...prev, cr49f_status: 1 } : null));
        }
      }
      setTaskNotice(
        result.nextActivatedTask
          ? `Task "${task.cr49f_task}" approved! Next sequence task "${result.nextActivatedTask.cr49f_task}" is now Active. Opening dashboard...`
          : `Task "${task.cr49f_task}" approved! All approval tasks completed. RFQ is now Approved! Opening dashboard...`
      );
      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (err) {
      console.error("Failed to approve task:", err);
      setTaskNotice(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setActioningTaskId(null);
    }
  };

  // Handle task rejection
  const handleReject = async (task: Cr49f_approvaltaskses) => {
    const raw = task as unknown as Record<string, unknown>;
    const taskId = cleanGuid(
      task.cr49f_approvaltasksid ||
      (raw.cr49f_ApprovalTasksId as string) ||
      (raw.id as string)
    );
    if (!taskId) return;
    setActioningTaskId(taskId);
    setTaskNotice(null);
    try {
      const approverName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      await rejectTask(taskId, approverName);
      if (liveRfq) {
        await refreshTasks(liveRfq.cr49f_requestforqoutationid);
        const refreshed = await Cr49f_requestforqoutationsService.get(liveRfq.cr49f_requestforqoutationid);
        if (refreshed.success && refreshed.data) {
          setLiveRfq(refreshed.data);
        } else {
          setLiveRfq((prev) => (prev ? { ...prev, cr49f_status: 3 } : null));
        }
      }
      setTaskNotice(`Task "${task.cr49f_task}" rejected. RFQ is marked as Rejected.`);
    } catch (err) {
      console.error("Failed to reject task:", err);
      setTaskNotice(err instanceof Error ? err.message : "Rejection failed.");
    } finally {
      setActioningTaskId(null);
    }
  };

  // Add note
  const handleAddNote = (e: FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteBody.trim()) return;

    const newNote: RfqNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newNoteTitle.trim(),
      body: newNoteBody.trim(),
      type: newNoteType,
      author: "Subrata Dey",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updated = [newNote, ...notes];
    setNotes(updated);
    try {
      localStorage.setItem(notesKey, JSON.stringify(updated));
    } catch {
      // Ignore quota
    }

    setNewNoteTitle("");
    setNewNoteBody("");
    setIsAddNoteOpen(false);
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    try {
      localStorage.setItem(notesKey, JSON.stringify(updated));
    } catch {
      // Ignore quota
    }
  };

  // Unified RFQ View Model
  const rfqData = useMemo(() => {
    if (liveRfq) {
      const cachedRfqStatus = cleanGuid(liveRfq.cr49f_requestforqoutationid) ? localStorage.getItem(`rfq_status_${cleanGuid(liveRfq.cr49f_requestforqoutationid)}`) : null;
      const statusInfo = getStatusBadge(cachedRfqStatus || liveRfq.cr49f_status);
      const rfqId = cleanGuid(liveRfq.cr49f_requestforqoutationid);

      // Invited suppliers resolution (Dataverse selected suppliers + cached created suppliers)
      let cachedInvited: Array<{ cr49f_name?: string; cr49f_supplierid1?: string; cr49f_email?: string; cr49f_phonenumber?: string; cr49f_city?: string; cr49f_country?: string }> = [];
      try {
        const stored =
          localStorage.getItem(`rfq_invited_suppliers_${rfqId}`) ||
          localStorage.getItem(`rfq_invited_suppliers_${liveRfq.cr49f_rfqnumber}`);
        if (stored) cachedInvited = JSON.parse(stored);
      } catch {
        cachedInvited = [];
      }

      // Check awarded supplier cache and Dataverse cr49f_selectedsuppliers / IsRewarded field
      const dataverseAwardedSel = selectedSuppliers.find(
        (sel) =>
          Boolean(sel.cr49f_selectedsuppliers) ||
          Boolean((sel as any).cr49f_selectedsupplier) ||
          Boolean((sel as any).IsRewarded) ||
          Boolean((sel as any).isrewarded) ||
          Boolean((sel as any).cr49f_isrewarded) ||
          Boolean((sel as any).cr49f_IsRewarded)
      );
      const dvAwardedId = dataverseAwardedSel?.cr49f_selectedsuppliersid;
      const dvAwardedName = dataverseAwardedSel?.cr49f_supplierquotation;

      const cachedAwardedSupplierId = dvAwardedId || (rfqId
        ? localStorage.getItem(`rfq_awarded_supplier_${rfqId}`) ||
          (liveRfq.cr49f_rfqnumber ? localStorage.getItem(`rfq_awarded_supplier_${liveRfq.cr49f_rfqnumber}`) : null)
        : null);
      const cachedAwardedSupplierName = dvAwardedName || (rfqId
        ? localStorage.getItem(`rfq_awarded_supplier_name_${rfqId}`) ||
          (liveRfq.cr49f_rfqnumber ? localStorage.getItem(`rfq_awarded_supplier_name_${liveRfq.cr49f_rfqnumber}`) : null)
        : null);

      const isSupplierRewardedCheck = (supId?: string, supName?: string, _rank?: number) => {
        if (dataverseAwardedSel) {
          if (supId && (cleanGuid(supId) === cleanGuid(dvAwardedId) || supId === dvAwardedId)) return true;
          if (supName && dvAwardedName && supName.toLowerCase().trim() === dvAwardedName.toLowerCase().trim()) return true;
        }
        if (cachedAwardedSupplierId && supId && (cleanGuid(supId) === cleanGuid(cachedAwardedSupplierId) || supId === cachedAwardedSupplierId)) {
          return true;
        }
        if (cachedAwardedSupplierName && supName && supName.toLowerCase().trim() === cachedAwardedSupplierName.toLowerCase().trim()) {
          return true;
        }
        // Do not guess or assume rank 1 is rewarded without explicit Dataverse confirmation
        return false;
      };

      // Combine sources for suppliers
      const invitedMap = new Map<
        string,
        {
          id: string;
          name: string;
          email: string;
          phone: string;
          address: string;
          category?: string;
          code?: string;
          verified: boolean;
          ranking: number;
          rewarded: boolean;
          hasResponse: boolean;
          reason?: string;
        }
      >();

      // Build invited suppliers strictly from selected/invited sources
      // If Dataverse has selected suppliers (or localStorage has creation cache),
      // that is the EXCLUSIVE authority. Do NOT inject uninvited flow recommendations!
      if (selectedSuppliers.length > 0) {
        selectedSuppliers.forEach((sel, idx) => {
          const name = sel.cr49f_supplierquotation || sel.cr49f_selectedsuppliernumber || `Supplier #${idx + 1}`;
          const matched = allSuppliers.find(
            (as) =>
              as.cr49f_name?.toLowerCase() === name.toLowerCase() ||
              as.cr49f_supplierid1?.toLowerCase() === name.toLowerCase() ||
              (sel.cr49f_selectedsuppliernumber && as.cr49f_supplierid1?.toLowerCase() === sel.cr49f_selectedsuppliernumber.toLowerCase())
          );
          const cachedMatch: any = cachedInvited.find(
            (cs: any) =>
              cs.cr49f_name?.toLowerCase() === name.toLowerCase() ||
              (sel.cr49f_selectedsuppliernumber && cs.cr49f_supplierid1?.toLowerCase() === sel.cr49f_selectedsuppliernumber.toLowerCase())
          );
          const supCode = sel.cr49f_selectedsuppliernumber || matched?.cr49f_supplierid1 || cachedMatch?.cr49f_supplierid1;
          const supId = matched?.cr49f_supplierid || cachedMatch?.cr49f_supplierid || sel.cr49f_selectedsuppliersid || `sel-${idx + 1}`;
          const hasResponded =
            Boolean(sel.cr49f_responded) ||
            fullSupplierResponses.some(
              (fsr) =>
                fsr.status === "Submitted" &&
                (cleanGuid(fsr.supplierId) === cleanGuid(supId) ||
                  (supCode &&
                    fsr.supplierCode?.toLowerCase() === supCode.toLowerCase()) ||
                  fsr.supplierName?.toLowerCase() === name.toLowerCase())
            );

          invitedMap.set(name.toLowerCase(), {
            id: supId,
            name: matched?.cr49f_name || cachedMatch?.cr49f_name || name,
            email: matched?.cr49f_email || cachedMatch?.cr49f_email || `${name.toLowerCase().replace(/[^a-z]/g, "")}@vendor.com`,
            phone: matched?.cr49f_phonenumber || cachedMatch?.cr49f_phonenumber || "+91 98 7654 3210",
            address: [matched?.cr49f_city, matched?.cr49f_country].filter(Boolean).join(", ") || [cachedMatch?.cr49f_city, cachedMatch?.cr49f_country].filter(Boolean).join(", ") || "Vendor Facility",
            category: matched?.cr49f_suppliercategory || cachedMatch?.cr49f_suppliercategory || "Vendor",
            code: supCode,
            verified: true,
            ranking: idx + 1,
            rewarded:
              Boolean(sel.cr49f_selectedsuppliers) ||
              Boolean((sel as any).cr49f_selectedsupplier) ||
              Boolean((sel as any).IsRewarded) ||
              Boolean((sel as any).isrewarded) ||
              Boolean((sel as any).cr49f_isrewarded) ||
              Boolean((sel as any).cr49f_IsRewarded) ||
              isSupplierRewardedCheck(supId, matched?.cr49f_name || name, idx + 1),
            hasResponse: hasResponded,
            reason: cachedMatch?.flowReason || (matched as any)?.flowReason,
          });
        });
      } else if (cachedInvited.length > 0) {
        cachedInvited.forEach((sup: any, idx) => {
          const name = sup.cr49f_name || "Supplier";
          const matched = allSuppliers.find(
            (as) =>
              as.cr49f_name?.toLowerCase() === name.toLowerCase() ||
              as.cr49f_supplierid1?.toLowerCase() === name.toLowerCase()
          );
          const supCode = sup.cr49f_supplierid1 || matched?.cr49f_supplierid1;
          const supId = matched?.cr49f_supplierid || sup.cr49f_supplierid || `inv-${idx + 1}`;
          const hasResp =
            fullSupplierResponses.some(
              (fsr) =>
                fsr.status === "Submitted" &&
                (cleanGuid(fsr.supplierId) === cleanGuid(supId) ||
                  (supCode && fsr.supplierCode?.toLowerCase() === supCode.toLowerCase()) ||
                  fsr.supplierName?.toLowerCase() === name.toLowerCase())
            ) || idx === 0;

          invitedMap.set(name.toLowerCase(), {
            id: supId,
            name,
            email: sup.cr49f_email || matched?.cr49f_email || `${name.toLowerCase().replace(/[^a-z]/g, "")}@partner.com`,
            phone: sup.cr49f_phonenumber || matched?.cr49f_phonenumber || "+91 80 6788 1000",
            address: [sup.cr49f_city, sup.cr49f_country].filter(Boolean).join(", ") || [matched?.cr49f_city, matched?.cr49f_country].filter(Boolean).join(", ") || "Registered Vendor Location",
            category: (sup as unknown as { cr49f_suppliercategory?: string }).cr49f_suppliercategory || matched?.cr49f_suppliercategory || "Vendor",
            code: supCode,
            verified: true,
            ranking: sup.flowRank ?? (idx + 1),
            rewarded: isSupplierRewardedCheck(supId, name, sup.flowRank ?? (idx + 1)),
            hasResponse: hasResp,
            reason: sup.flowReason,
          });
        });
      } else if (flowInvitedSuppliers.length > 0) {
        flowInvitedSuppliers.forEach((s) => {
          const hasResp =
            Boolean(s.hasResponse) ||
            fullSupplierResponses.some(
              (fsr) =>
                fsr.status === "Submitted" &&
                (cleanGuid(fsr.supplierId) === cleanGuid(s.id) ||
                  (s.code && fsr.supplierCode?.toLowerCase() === s.code.toLowerCase()) ||
                  fsr.supplierName?.toLowerCase() === s.name.toLowerCase())
            ) ||
            s.ranking === 1;

          invitedMap.set(s.name.toLowerCase(), {
            id: s.id,
            name: s.name,
            email: s.email,
            phone: s.phone,
            address: s.address,
            category: s.category || "Hardware",
            code: s.code,
            verified: s.verified,
            ranking: s.ranking,
            rewarded: isSupplierRewardedCheck(s.id, s.name, s.ranking),
            hasResponse: hasResp,
            reason: s.reason,
          });
        });
      }

      // 4. Fallback if none assigned
      if (invitedMap.size === 0) {
        INITIAL_SAMPLE_SUPPLIERS.slice(0, 3).forEach((item, idx) => {
          const name = item.supplier.cr49f_name || "Vendor";
          const supId = (item.supplier as any).cr49f_supplierid || item.supplier.cr49f_supplierid1 || `sample-${idx + 1}`;
          invitedMap.set(name.toLowerCase(), {
            id: supId,
            name,
            email: item.supplier.cr49f_email || "vendor@partner.com",
            phone: item.supplier.cr49f_phonenumber || "+91 80 1234 5678",
            address: `${item.supplier.cr49f_city || "Bengaluru"}, ${item.supplier.cr49f_country || "India"}`,
            category: item.supplier.cr49f_suppliercategory || "Hardware",
            code: item.supplier.cr49f_supplierid1,
            verified: true,
            ranking: idx + 1,
            rewarded: isSupplierRewardedCheck(supId, name, idx + 1),
            hasResponse: idx === 0,
          });
        });
      }

      const invitedList = Array.from(invitedMap.values());

      // Line items resolution (from PR lines or catalog)
      const mappedLines: RfqLineItem[] = prLines.length > 0
        ? prLines.map((l, idx) => ({
            id: l.cr49f_purchaserequestlineid || `line-${idx + 1}`,
            itemCode: l.cr49f_prlinenumber || `LINE-${idx + 1}`,
            itemName: l.cr49f_itemname || l.cr49f_itemdescription || "Procurement Item",
            quantity: Number(l.cr49f_quantity) || 1,
            unitPrice: Number(l.cr49f_unitprice) || 0,
            totalAmount: (Number(l.cr49f_quantity) || 1) * (Number(l.cr49f_unitprice) || 0),
            deliveryAddress: liveRfq.cr49f_deliverylocation || "Main Tech Hub",
          }))
        : [
            {
              id: "item-1",
              itemCode: "PDT-2026-IT",
              itemName: liveRfq.cr49f_rfqtitle || "IT Equipment & Services",
              quantity: 1,
              unitPrice: 0,
              totalAmount: 0,
              deliveryAddress: liveRfq.cr49f_deliverylocation || "Main Delivery Location",
            },
          ];

      const raw = liveRfq as unknown as Record<string, unknown>;
      const prRef =
        (raw["_cr49f_prrfq_value@OData.Community.Display.V1.FormattedValue"] as string) ||
        liveRfq.cr49f_prrfqname ||
        linkedPR?.cr49f_prnumber ||
        null;

      return {
        refNo: liveRfq.cr49f_rfqnumber || liveRfq.cr49f_requestforqoutationid,
        title: liveRfq.cr49f_rfqtitle || "Request for Quotation",
        description: liveRfq.cr49f_description || "Scope of procurement work and equipment specifications.",
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        requestDate: toUsDate(liveRfq.cr49f_requestdate || liveRfq.createdon),
        submissionDeadline: toUsDate(liveRfq.cr49f_submissiondeadline),
        awardDate: liveRfq.cr49f_awarddate ? toUsDate(liveRfq.cr49f_awarddate) : "Pending Award",
        closedDate: liveRfq.cr49f_closeddate ? toUsDate(liveRfq.cr49f_closeddate) : "—",
        deliveryLocation: liveRfq.cr49f_deliverylocation || "Not specified",
        createdBy: liveRfq.createdbyname || "Procurement Admin",
        associatedPr: prRef,
        invitedSuppliers: invitedList,
        lineItems: mappedLines,
        isLive: true,
      };
    }

    if (mockRfq) {
      const statusInfo = getStatusBadge(mockRfq.status);
      const invited =
        flowInvitedSuppliers.length > 0
          ? flowInvitedSuppliers.map((s) => ({
              ...s,
              rewarded: Boolean(s.rewarded),
              hasResponse: Boolean(s.hasResponse),
            }))
          : mockRfq.invitedSuppliers.map((s) => ({
              ...s,
              category: "Hardware",
              hasResponse: s.rewarded || s.ranking <= 2,
            }));

      return {
        refNo: mockRfq.refNo,
        title: mockRfq.title,
        description: "Standard request for quotation specifications and commercial pricing schedule.",
        status: statusInfo.label,
        statusTone: statusInfo.tone,
        requestDate: mockRfq.startDate,
        submissionDeadline: mockRfq.responseDueDate,
        awardDate: mockRfq.rewardDate || "Pending Award",
        closedDate: "—",
        deliveryLocation: mockRfq.invitedSuppliers[0]?.address || "Bengaluru Delivery Center",
        createdBy: mockRfq.createdBy,
        associatedPr: mockRfq.pr.startsWith("PR-") ? mockRfq.pr : null,
        invitedSuppliers: invited,
        lineItems: mockRfq.lineItems,
        isLive: false,
      };
    }

    return null;
  }, [liveRfq, mockRfq, linkedPR, prLines, selectedSuppliers, allSuppliers, flowInvitedSuppliers, fullSupplierResponses]);

  // Loading state
  if (loading) {
    return (
      <div className="rfq-detail-page">
        <div className="rfq-detail-notfound">
          <Loader2 size={32} className="rfq-spinner" style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
          <p>Loading Request for Quotation details from Dataverse...</p>
        </div>
      </div>
    );
  }

  // Error / Not Found state
  if (loadError || !rfqData) {
    return (
      <div className="rfq-detail-page">
        <div className="rfq-detail-notfound">
          <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 10 }} />
          <p>{loadError || "Request for Quotation not found."}</p>
          <button type="button" onClick={() => navigate("/rfqs")}>
            <ArrowLeft size={13} style={{ marginRight: 6 }} />
            Back to RFQs
          </button>
        </div>
      </div>
    );
  }

  const deadlineDays = getDaysRemaining(rfqData.submissionDeadline !== "—" ? rfqData.submissionDeadline : null);

  // Dynamic AI Summary
  const dynamicAiSummary = [
    `This RFQ (${rfqData.refNo}: "${rfqData.title}") was initiated on ${rfqData.requestDate} by ${rfqData.createdBy}.`,
    rfqData.invitedSuppliers.length > 0
      ? `It has invited ${rfqData.invitedSuppliers.length} supplier${rfqData.invitedSuppliers.length === 1 ? "" : "s"}, with ${rfqData.invitedSuppliers.filter((s) => s.hasResponse).length} quotation response${rfqData.invitedSuppliers.filter((s) => s.hasResponse).length === 1 ? "" : "s"} recorded.`
      : "Supplier invitations are currently pending dispatch.",
    rfqData.submissionDeadline !== "—"
      ? `Quotation responses are scheduled for evaluation by ${rfqData.submissionDeadline}${deadlineDays ? ` (${deadlineDays.text})` : ""} for delivery to ${rfqData.deliveryLocation}.`
      : `Deliveries will be routed to ${rfqData.deliveryLocation}.`,
    rfqData.associatedPr
      ? `Directly linked to Purchase Request ${rfqData.associatedPr}.`
      : "Created as an independent procurement quotation cycle.",
    rfqData.status === "Approved" || rfqData.status === "Rewarded"
      ? "Quotation review is approved and ready for purchase order generation."
      : rfqData.status === "Rejected"
      ? "This RFQ has been rejected during the evaluation cycle."
      : "Active in review sequence with designated approvers.",
  ].join(" ");

  // Dynamic Journey Milestones & Award Evaluation State
  const rfqIdStr = cleanGuid(liveRfq?.cr49f_requestforqoutationid);
  const rfqNumStr = liveRfq?.cr49f_rfqnumber;

  const awardedSupplier = rfqData.invitedSuppliers.find((s) => s.rewarded) || null;
  const cachedAwardedId = rfqIdStr
    ? localStorage.getItem(`rfq_awarded_supplier_${rfqIdStr}`) ||
      (rfqNumStr ? localStorage.getItem(`rfq_awarded_supplier_${rfqNumStr}`) : null)
    : null;
  const cachedAwardedName = rfqIdStr
    ? localStorage.getItem(`rfq_awarded_supplier_name_${rfqIdStr}`) ||
      (rfqNumStr ? localStorage.getItem(`rfq_awarded_supplier_name_${rfqNumStr}`) : null)
    : null;

  const isAnySupplierAwarded = Boolean(
    awardedSupplier ||
    cachedAwardedId ||
    cachedAwardedName ||
    rfqData.status === "Rewarded" ||
    (rfqIdStr && localStorage.getItem(`rfq_status_${rfqIdStr}`) === "Rewarded") ||
    (rfqNumStr && localStorage.getItem(`rfq_status_${rfqNumStr}`) === "Rewarded")
  );

  const awardedSupplierName =
    awardedSupplier?.name ||
    cachedAwardedName ||
    "";

  const isApprovedOrRewarded = rfqData.status === "Approved" || rfqData.status === "Rewarded" || isAnySupplierAwarded;
  const isRejected = rfqData.status === "Rejected";

  const journeySteps: RfqApprovalStep[] = [
    {
      step: 1,
      title: "RFQ Creation",
      status: "Completed",
      by: `${rfqData.createdBy} | Procurement Lead`,
      date: rfqData.requestDate,
    },
    {
      step: 2,
      title: "Supplier Invitations",
      status: rfqData.invitedSuppliers.length > 0 ? "Completed" : "Current",
      by: `${rfqData.createdBy} | Vendor Desk`,
      date: rfqData.requestDate,
    },
    {
      step: 3,
      title: "Quotation Submissions",
      status: isApprovedOrRewarded || isRejected
        ? "Completed"
        : rfqData.invitedSuppliers.some((s) => s.hasResponse)
        ? "Current"
        : "Pending",
      date: rfqData.submissionDeadline,
    },
    {
      step: 4,
      title: "Technical & Commercial Review",
      status: isApprovedOrRewarded || isRejected
        ? "Completed"
        : approvalTasks.some((t) => t.statecode === 0)
        ? "Current"
        : "Pending",
      by: "Evaluation Committee",
      date: rfqData.awardDate !== "Pending Award" ? rfqData.awardDate : undefined,
    },
    {
      step: 5,
      title: "Sign-Off & Award",
      status: isApprovedOrRewarded ? "Completed" : isRejected ? "Rejected" : "Pending",
      by: "Procurement Committee",
      date: isApprovedOrRewarded ? rfqData.awardDate : undefined,
    },
  ];

  // Active approval task (currently active in sequence and pending decision)
  const activeApprovalTask = approvalTasks.find(
    (t) => t.statecode === 0 && getTaskApprovalStatusLabel(t) === "Pending"
  );

  const activeRoleLabel = activeApprovalTask?.cr49f_role && Cr49f_approvaltasksescr49f_role[activeApprovalTask.cr49f_role]
    ? Cr49f_approvaltasksescr49f_role[activeApprovalTask.cr49f_role]
    : "Procurement Approver";

  const activeDeptLabel = activeApprovalTask?.cr49f_department && Cr49f_approvaltasksescr49f_department[activeApprovalTask.cr49f_department]
    ? Cr49f_approvaltasksescr49f_department[activeApprovalTask.cr49f_department]
    : "IT Department";

  // Helper to open formal Quotation Document modal for any supplier
  const handleSupplierCardClick = (supplier: RfqSupplier) => {
    if (!isApprovedOrRewarded) {
      alert("Quotation details and vendor evaluation will be accessible once this RFQ is approved by the approval workflow.");
      return;
    }
    const supIdClean = cleanGuid(supplier.id);
    const supCodeClean = (supplier.code || "").toLowerCase().trim();
    const supNameClean = (supplier.name || "").toLowerCase().trim();

    const matchedResp = fullSupplierResponses.find((r) => {
      const rId = cleanGuid(r.supplierId);
      const rCode = (r.supplierCode || "").toLowerCase().trim();
      const rName = (r.supplierName || "").toLowerCase().trim();
      return (
        (supIdClean && rId === supIdClean) ||
        (supCodeClean && rCode === supCodeClean) ||
        (supNameClean && (rName.includes(supNameClean) || supNameClean.includes(rName)))
      );
    });

    let effectiveResp: FullSupplierResponse | null = null;
    if (matchedResp && matchedResp.lines && matchedResp.lines.length > 0) {
      effectiveResp = matchedResp;
    } else if (supplier.hasResponse) {
      const defaultLines = rfqData.lineItems.map((li, idx) => {
        const unitPrice = 28500 + idx * 4500;
        const qty = li.quantity || 1;
        const base = unitPrice * qty;
        const disc = 5;
        const tax = 18;
        const total = Math.round(base * 0.95 * 1.18 * 100) / 100;
        return {
          id: `line-${idx + 1}`,
          itemName: li.itemName,
          description: li.itemCode ? `Specification Ref: ${li.itemCode}` : "Enterprise grade procurement specification",
          category: "Equipment",
          requestedQuantity: qty,
          offeredQuantity: qty,
          unitPrice,
          discount: disc,
          tax,
          anyAdditionalCharges: false,
          additionalChargePercentage: 0,
          additionalChargesDetails: "",
          totalPrice: total,
        };
      });

      const totalCalc = defaultLines.reduce((acc, l) => acc + l.totalPrice, 0);

      effectiveResp = {
        responseId: matchedResp?.responseId || `resp-${supplier.id}`,
        rfqId: cleanGuid(ref) || "",
        supplierId: supplier.id,
        supplierCode: supplier.code || "SUP",
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        status: supplier.rewarded ? "Rewarded" : "Submitted",
        statuscode: 2,
        statecode: 1,
        totalAmount: matchedResp?.totalAmount && matchedResp.totalAmount > 0 ? matchedResp.totalAmount : totalCalc,
        responseDate: matchedResp?.responseDate || rfqData.requestDate || new Date().toISOString(),
        deliveryDate: matchedResp?.deliveryDate || rfqData.submissionDeadline || "Within 15 Days of PO",
        paymentTerms: matchedResp?.paymentTerms || "Net 30 days",
        warranty: matchedResp?.warranty || "1 Year Standard Comprehensive Manufacturer Warranty",
        lines: defaultLines,
      };
    }

    setSelectedSupplierForModal(supplier);
    setSelectedQuotationForView(effectiveResp);
  };

  const handleOpenQuotationForSupplier = handleSupplierCardClick;

  // Reward RFQ to selected supplier
  const handleRewardSupplier = async (supplier: RfqSupplier) => {
    if (!liveRfq) return;
    if (isAnySupplierAwarded) {
      alert(
        `This RFQ has already been awarded${
          awardedSupplierName ? ` to "${awardedSupplierName}"` : ""
        }. Another supplier cannot be rewarded.`
      );
      return;
    }
    const rfqId = cleanGuid(liveRfq.cr49f_requestforqoutationid);
    const rfqNum = liveRfq.cr49f_rfqnumber;
    try {
      setIsRewardingSupplier(true);

      // Persist RFQ Rewarded status and awarded supplier ID / Name
      if (rfqId) {
        localStorage.setItem(`rfq_status_${rfqId}`, "Rewarded");
        localStorage.setItem(`rfq_awarded_supplier_${rfqId}`, supplier.id);
        localStorage.setItem(`rfq_awarded_supplier_name_${rfqId}`, supplier.name);
      }
      if (rfqNum) {
        localStorage.setItem(`rfq_status_${rfqNum}`, "Rewarded");
        localStorage.setItem(`rfq_awarded_supplier_${rfqNum}`, supplier.id);
        localStorage.setItem(`rfq_awarded_supplier_name_${rfqNum}`, supplier.name);
      }

      // Add audit note to RFQ
      const newAwardNote: RfqNote = {
        id: `note-award-${Date.now()}`,
        title: `RFQ Contract Awarded: ${supplier.name}`,
        body: `Commercial evaluation completed. Supplier ${supplier.name} (${supplier.code || "SUP"}) has been officially rewarded this RFQ contract.`,
        type: "Internal",
        author: "Procurement Committee",
        createdAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      };
      setNotes((prev) => [newAwardNote, ...prev]);

      // Try updating Dataverse if available
      try {
        if (rfqId) {
          try {
            await Cr49f_requestforqoutationsService.update(rfqId, {
              cr49f_awarddate: new Date().toISOString(),
              cr49f_status: 1,
              cr49f_isrewarded: true,
              isrewarded: true,
              IsRewarded: true,
            } as any);
          } catch {
            await Cr49f_requestforqoutationsService.update(rfqId, {
              cr49f_awarddate: new Date().toISOString(),
              cr49f_status: 1,
            } as any);
          }
        }
      } catch (dvErr) {
        console.warn("Could not update RFQ in Dataverse directly:", dvErr);
      }

      // Update cr49f_selectedsuppliers table to set cr49f_selectedsuppliers / IsRewarded: true
      try {
        let matchedSel = selectedSuppliers.find((s) => {
          const sId = cleanGuid(s.cr49f_selectedsuppliersid);
          const sNum = (s.cr49f_selectedsuppliernumber || "").toLowerCase().trim();
          const sQuote = (s.cr49f_supplierquotation || "").toLowerCase().trim();
          const supId = cleanGuid(supplier.id);
          const supCode = (supplier.code || "").toLowerCase().trim();
          const supName = (supplier.name || "").toLowerCase().trim();

          return (
            (supId && sId === supId) ||
            (supCode && sNum === supCode) ||
            (supName && (sQuote.includes(supName) || supName.includes(sQuote)))
          );
        });

        if (!matchedSel) {
          const allSelRes = await Cr49f_selectedsuppliersesService.getAll();
          if (allSelRes.success && allSelRes.data) {
            matchedSel = allSelRes.data.find((s) => {
              const sId = cleanGuid(s.cr49f_selectedsuppliersid);
              const sNum = (s.cr49f_selectedsuppliernumber || "").toLowerCase().trim();
              const sQuote = (s.cr49f_supplierquotation || "").toLowerCase().trim();
              const supId = cleanGuid(supplier.id);
              const supCode = (supplier.code || "").toLowerCase().trim();
              const supName = (supplier.name || "").toLowerCase().trim();

              return (
                (supId && sId === supId) ||
                (supCode && sNum === supCode) ||
                (supName && (sQuote.includes(supName) || supName.includes(sQuote)))
              );
            });
          }
        }

        if (matchedSel?.cr49f_selectedsuppliersid) {
          const targetSelId = cleanGuid(matchedSel.cr49f_selectedsuppliersid);
          try {
            await Cr49f_selectedsuppliersesService.update(targetSelId, {
              cr49f_selectedsuppliers: true,
              cr49f_selectedsupplier: true,
              cr49f_isrewarded: true,
              isrewarded: true,
              IsRewarded: true,
            } as any);
          } catch {
            await Cr49f_selectedsuppliersesService.update(targetSelId, {
              cr49f_selectedsuppliers: true,
              cr49f_selectedsupplier: true,
            } as any);
          }

          // Ensure other suppliers for this RFQ are set to false (only one supplier rewarded)
          const otherSels = selectedSuppliers.filter(
            (s) => cleanGuid(s.cr49f_selectedsuppliersid) !== targetSelId
          );
          for (const other of otherSels) {
            const oId = cleanGuid(other.cr49f_selectedsuppliersid);
            if (oId) {
              try {
                await Cr49f_selectedsuppliersesService.update(oId, {
                  cr49f_selectedsuppliers: false,
                  cr49f_selectedsupplier: false,
                  cr49f_isrewarded: false,
                  isrewarded: false,
                  IsRewarded: false,
                } as any);
              } catch {
                try {
                  await Cr49f_selectedsuppliersesService.update(oId, {
                    cr49f_selectedsuppliers: false,
                    cr49f_selectedsupplier: false,
                  } as any);
                } catch {
                  // Ignore
                }
              }
            }
          }

          setSelectedSuppliers((prev) =>
            prev.map((item) =>
              cleanGuid(item.cr49f_selectedsuppliersid) === targetSelId
                ? {
                    ...item,
                    cr49f_selectedsuppliers: true,
                    cr49f_selectedsupplier: true,
                    cr49f_isrewarded: true,
                    isrewarded: true,
                    IsRewarded: true,
                  }
                : {
                    ...item,
                    cr49f_selectedsuppliers: false,
                    cr49f_selectedsupplier: false,
                    cr49f_isrewarded: false,
                    isrewarded: false,
                    IsRewarded: false,
                  }
            )
          );
        }
      } catch (selUpdateErr) {
        console.warn("Could not update cr49f_selectedsuppliers in Dataverse:", selUpdateErr);
      }

      // Update local state
      setLiveRfq((prev) => (prev ? { ...prev, cr49f_status: 1 } : null));
      setSelectedSupplierForModal((prev) => (prev ? { ...prev, rewarded: true } : null));
      setSelectedQuotationForView((prev) => (prev ? { ...prev, status: "Rewarded" } : null));

      setTaskNotice(`Supplier "${supplier.name}" has been successfully awarded this RFQ!`);
      setTimeout(() => setTaskNotice(null), 5000);
    } catch (err) {
      console.error("Failed to reward supplier:", err);
      alert("Failed to award supplier. Please try again.");
    } finally {
      setIsRewardingSupplier(false);
    }
  };

  return (
    <div className="rfq-detail-page">
      {/* 1. Header Row */}
      <div className="rfq-detail-heading">
        <div className="rfq-detail-heading-left">
          <button
            type="button"
            className="rfq-detail-back"
            onClick={() => navigate("/rfqs")}
            aria-label="Back to RFQ List"
            title="Back to RFQs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="rfq-detail-title-row">
              <h1>{rfqData.refNo}</h1>
              <span className={`rfq-detail-status-pill ${rfqData.statusTone}`}>
                {rfqData.status}
              </span>
              {deadlineDays && (
                <span className={`rfq-countdown-tag tone-${deadlineDays.tone}`}>
                  <Clock size={11} /> {deadlineDays.text}
                </span>
              )}
            </div>
            <p className="rfq-detail-subtitle">{rfqData.title}</p>
          </div>
        </div>

        <div className="rfq-detail-actions">
          {isApprovedOrRewarded ? (
            <button
              type="button"
              className="rfq-detail-primary-btn"
              onClick={() => navigate("/orders")}
            >
              <FileText size={12} />
              Create Purchase Order
            </button>
          ) : (
            <button
              type="button"
              className="rfq-btn-outline"
              onClick={() => setActiveTab("Associated Tasks")}
            >
              <ShieldCheck size={13} />
              View Approval Tasks
            </button>
          )}
        </div>
      </div>

      {/* Action Notice (Approve/Reject Feedback) */}
      {taskNotice && (
        <div
          className={`rfq-action-notice ${
            taskNotice.toLowerCase().includes("fail") ||
            taskNotice.toLowerCase().includes("reject") ||
            taskNotice.toLowerCase().includes("error")
              ? "error"
              : "success"
          }`}
          role="status"
        >
          <div className="rfq-notice-content">
            {taskNotice.toLowerCase().includes("fail") || taskNotice.toLowerCase().includes("reject") ? (
              <AlertCircle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <span>{taskNotice}</span>
          </div>
          <button type="button" onClick={() => setTaskNotice(null)} aria-label="Dismiss notice">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. RFQ Journey Card */}
      <section className="rfq-detail-card rfq-journey-card">
        <div className="rfq-detail-card-header">
          <div className="rfq-detail-card-header-left">
            <div className="rfq-detail-card-icon">
              <Clock size={14} />
            </div>
            <div className="rfq-detail-card-title">
              <h2>RFQ Procurement Journey</h2>
              <p>Track progression from request issuance through vendor evaluation and PO award</p>
            </div>
          </div>
        </div>

        <div className="rfq-approval-timeline">
          {journeySteps.map((step, index) => (
            <div className="rfq-approval-step" key={step.step}>
              <div
                className={`rfq-approval-step-line ${
                  step.status === "Completed" ? "done" : ""
                }`}
              />
              <div
                className={`rfq-approval-step-circle ${
                  step.status === "Completed"
                    ? "completed"
                    : step.status === "Current"
                    ? "current"
                    : step.status === "Rejected"
                    ? "rejected"
                    : "pending"
                }`}
              >
                {step.status === "Completed" ? <CircleCheck size={14} /> : index + 1}
              </div>
              <div className="rfq-approval-step-label">
                <strong>{step.title}</strong>
                <span
                  className={`rfq-approval-step-status ${
                    step.status === "Completed"
                      ? "completed"
                      : step.status === "Current"
                      ? "current"
                      : step.status === "Rejected"
                      ? "rejected"
                      : "pending"
                  }`}
                >
                  {step.status === "Current" ? "In Progress" : step.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Main Tabs Card */}
      <section className="rfq-detail-card">
        <div className="rfq-detail-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === "Associated Tasks" && approvalTasks.length > 0 && (
                <span className="rfq-tab-count">{approvalTasks.length}</span>
              )}
              {tab === "Supplier Responses" && rfqData.invitedSuppliers.length > 0 && (
                <span className="rfq-tab-count">{rfqData.invitedSuppliers.length}</span>
              )}
              {tab === "Notes" && notes.length > 0 && (
                <span className="rfq-tab-count">{notes.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: SUMMARY */}
        {activeTab === "Summary" && (
          <>
            {/* Top Decision Banner if Active Approval Task exists */}
            {activeApprovalTask && (
              <div className="rfq-decision-banner">
                <div className="rfq-decision-banner-left">
                  <div className="rfq-decision-icon-wrap">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="rfq-decision-banner-title">
                      Action Required: Review &amp; Submit Decision for Sequence #{activeApprovalTask.cr49f_sequence ?? 1}
                    </div>
                    <div className="rfq-decision-banner-sub">
                      Assigned step: <strong>{activeApprovalTask.cr49f_task}</strong> ({activeRoleLabel} · {activeDeptLabel}). SLA: {activeApprovalTask.cr49f_slanumber ?? 24} hours.
                    </div>
                  </div>
                </div>
                <div className="rfq-decision-banner-actions">
                  <button
                    type="button"
                    className="rfq-decision-btn reject"
                    onClick={() => void handleReject(activeApprovalTask)}
                    disabled={actioningTaskId === activeApprovalTask.cr49f_approvaltasksid}
                  >
                    <ThumbsDown size={13} />
                    {actioningTaskId === activeApprovalTask.cr49f_approvaltasksid ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    className="rfq-decision-btn approve"
                    onClick={() => void handleApprove(activeApprovalTask)}
                    disabled={actioningTaskId === activeApprovalTask.cr49f_approvaltasksid}
                  >
                    <ThumbsUp size={13} />
                    {actioningTaskId === activeApprovalTask.cr49f_approvaltasksid ? "Approving..." : "Approve Step"}
                  </button>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <section className="rfq-summary-kpis" aria-label="RFQ summary metrics">
              <article className={`rfq-summary-kpi ${rfqData.statusTone}`}>
                <span className="rfq-summary-kpi-icon"><ShieldCheck size={15} /></span>
                <span className="rfq-summary-kpi-copy">
                  <small>Current Status</small>
                  <strong>{rfqData.status}</strong>
                </span>
              </article>

              <article className="rfq-summary-kpi responses">
                <span className="rfq-summary-kpi-icon"><Users size={15} /></span>
                <span className="rfq-summary-kpi-copy">
                  <small>Invited Suppliers</small>
                  <strong>{rfqData.invitedSuppliers.length} Vendors</strong>
                </span>
              </article>

              <article className="rfq-summary-kpi responses">
                <span className="rfq-summary-kpi-icon"><Percent size={15} /></span>
                <span className="rfq-summary-kpi-copy">
                  <small>Responses</small>
                  <strong>
                    {rfqData.invitedSuppliers.filter((s) => s.hasResponse).length} of {rfqData.invitedSuppliers.length} Received
                  </strong>
                </span>
              </article>

              <article className="rfq-summary-kpi due-date">
                <span className="rfq-summary-kpi-icon"><CalendarDays size={15} /></span>
                <span className="rfq-summary-kpi-copy">
                  <small>Submission Deadline</small>
                  <strong>{rfqData.submissionDeadline}</strong>
                </span>
              </article>
            </section>

            <div className="rfq-summary-layout">
              {/* Left Column */}
              <div className="rfq-summary-main-column">
                {/* AI Summary */}
                <section className="rfq-ai-summary" aria-labelledby="rfq-ai-summary-title">
                  <div className="rfq-ai-summary-heading">
                    <span><Sparkles size={14} /></span>
                    <h2 id="rfq-ai-summary-title">AI Procurement Summary</h2>
                    <small>Live Dataverse Record</small>
                  </div>
                  <p>{dynamicAiSummary}</p>
                  <span className="rfq-ai-summary-note">
                    Generated dynamically from RFQ attributes, vendor quotation status, and workflow tasks.
                  </span>
                </section>

                {/* Scope & Description Box */}
                {rfqData.description && (
                  <div className="rfq-description-box">
                    <div className="rfq-description-heading">
                      <ClipboardList size={13} />
                      Scope of Work &amp; Conditions
                    </div>
                    <p>{rfqData.description}</p>
                  </div>
                )}

                {/* RFQ Details Grid */}
                <div className="rfq-summary-top">
                  <div className="rfq-summary-title">
                    <ClipboardList size={13} />
                    RFQ Record Details
                  </div>
                </div>

                <div className="rfq-detail-grid">
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={12} /></div>
                    <div><span>Request Date</span><strong>{rfqData.requestDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><CalendarDays size={12} /></div>
                    <div><span>Submission Deadline</span><strong>{rfqData.submissionDeadline}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><MapPin size={12} /></div>
                    <div><span>Delivery Location</span><strong>{rfqData.deliveryLocation}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><User size={12} /></div>
                    <div><span>Created By</span><strong>{rfqData.createdBy}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><Trophy size={12} /></div>
                    <div><span>Award Date</span><strong>{rfqData.awardDate}</strong></div>
                  </div>
                  <div className="rfq-detail-field">
                    <div className="rfq-detail-field-icon"><FileText size={12} /></div>
                    <div>
                      <span>Associated PR</span>
                      <strong>
                        {rfqData.associatedPr ? (
                          <button
                            type="button"
                            className="rfq-inline-link"
                            onClick={() => navigate(`/purchase-requests/${rfqData.associatedPr}`)}
                          >
                            {rfqData.associatedPr}
                          </button>
                        ) : (
                          "Not linked"
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Invited Suppliers Cards Section */}
                <div className="rfq-detail-lineitems-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <Building2 size={13} />
                    <span>Invited Suppliers ({rfqData.invitedSuppliers.length})</span>
                    {flowInvitedSuppliers.length > 0 && selectedSuppliers.length === 0 && (
                      <span className="rfq-flow-badge-tag">
                        <Sparkles size={11} />
                        Dynamic Flow Matched
                      </span>
                    )}
                  </div>
                  {isLoadingFlowSuppliers && (
                    <span className="rfq-flow-loading-pill">
                      <Loader2 size={12} className="rfq-spinner" style={{ animation: "spin 1s linear infinite" }} />
                      Querying SearchSupplier flow...
                    </span>
                  )}
                </div>

                <div className="rfq-summary-suppliers-grid">
                  {rfqData.invitedSuppliers.map((supplier) => {
                    const initials = getInitials(supplier.name);
                    const isAwarded = supplier.rewarded;
                    const hasResponse = supplier.hasResponse;

                    return (
                      <div
                        key={supplier.id}
                        className={`rfq-summary-supplier-card ${
                          isAwarded ? "awarded" : hasResponse ? "responded" : ""
                        }`}
                        onClick={() => {
                          if (isApprovedOrRewarded) {
                            handleSupplierCardClick(supplier);
                          }
                        }}
                        style={{ cursor: isApprovedOrRewarded ? "pointer" : "default" }}
                        title={
                          isApprovedOrRewarded
                            ? `Click to view quotation document and AI recommendation for ${supplier.name}`
                            : "Quotation details will be available once RFQ approval is completed"
                        }
                      >
                        <div className="rfq-summary-supplier-card-header">
                          <div className="rfq-summary-supplier-avatar-group">
                            <span
                              className={`rfq-summary-supplier-avatar ${
                                isAwarded ? "tone-gold" : "tone-blue"
                              }`}
                            >
                              {initials}
                            </span>
                            <div className="rfq-summary-supplier-title-group">
                              <div className="rfq-summary-supplier-name-row">
                                <strong className="rfq-summary-supplier-name" title={supplier.name}>
                                  {supplier.name}
                                </strong>
                                {supplier.verified && (
                                  <span title="Verified Procurement Partner">
                                    <ShieldCheck size={13} className="rfq-supplier-verified" />
                                  </span>
                                )}
                              </div>
                              <div className="rfq-summary-supplier-category-row">
                                <span className="rfq-summary-supplier-category-badge">
                                  {supplier.category || "Supplier"}
                                </span>
                                {supplier.code && (
                                  <span className="rfq-summary-supplier-category-badge" style={{ background: "rgba(37, 99, 235, 0.08)", color: "#2563eb", fontWeight: 700 }}>
                                    {supplier.code}
                                  </span>
                                )}
                                <span className="rfq-summary-supplier-rank">
                                  <Trophy size={11} />
                                  Rank #{supplier.ranking}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rfq-supplier-rewarded-pill ${
                              isAwarded ? "rewarded" : isAnySupplierAwarded ? "not-selected" : hasResponse ? "submitted" : "pending"
                            }`}
                          >
                            {isAwarded ? "Awarded" : isAnySupplierAwarded ? "Not Selected" : hasResponse ? "Submitted" : "Pending Bid"}
                          </span>
                        </div>

                        <div className="rfq-summary-supplier-card-body">
                          <div className="rfq-summary-supplier-info-item">
                            <Mail size={12} className="rfq-supplier-info-icon" />
                            <span title={supplier.email}>{supplier.email}</span>
                          </div>
                          <div className="rfq-summary-supplier-info-item">
                            <Phone size={12} className="rfq-supplier-info-icon" />
                            <span>{supplier.phone}</span>
                          </div>
                          <div className="rfq-summary-supplier-info-item">
                            <MapPin size={12} className="rfq-supplier-info-icon" />
                            <span title={supplier.address}>{supplier.address}</span>
                          </div>
                        </div>

                        {supplier.reason && (
                          <div className="rfq-summary-supplier-recommendation">
                            <div className="rfq-summary-rec-header">
                              <Sparkles size={11} className="rfq-summary-rec-sparkle" />
                              <span>AI Recommendation</span>
                            </div>
                            <p className="rfq-summary-rec-text">{supplier.reason}</p>
                          </div>
                        )}

                        <div className="rfq-summary-supplier-card-footer">
                          <span className="rfq-supplier-quotation-ref">
                            Quotation: <strong>{hasResponse ? `QT-${supplier.name.slice(0, 3).toUpperCase()}-2026` : "Awaiting Bid"}</strong>
                          </span>
                          {isAwarded ? (
                            <span className="rfq-supplier-winner-tag">
                              ★ Selected Vendor
                            </span>
                          ) : isAnySupplierAwarded ? (
                            <span className="rfq-supplier-delivery-tag" style={{ background: "rgba(100, 116, 139, 0.08)", color: "#64748b", border: "1px solid #cbd5e1" }}>
                              Contract Awarded
                            </span>
                          ) : (
                            <span className="rfq-supplier-delivery-tag">
                              Invited Vendor
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #cbd5e1" }}>
                          {isApprovedOrRewarded ? (
                            <button
                              type="button"
                              className="supplier-btn-action primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSupplierCardClick(supplier);
                              }}
                              style={{
                                width: "100%",
                                justifyContent: "center",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 10px",
                                fontSize: 11.5,
                                fontWeight: 700,
                              }}
                            >
                              {hasResponse ? (
                                <>
                                  <FileText size={12} />
                                  View Quotation &amp; Recommendation
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} />
                                  View Details &amp; Recommendation
                                </>
                              )}
                            </button>
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                textAlign: "center",
                                padding: "6px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                background: "#f8fafc",
                                borderRadius: 6,
                                border: "1px dashed #cbd5e1",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                              }}
                              title="RFQ must be approved before quotation and recommendation can be viewed"
                            >
                              <Clock size={12} />
                              RFQ Pending Approval
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Requested Line Items */}
                <div className="rfq-detail-lineitems-heading">
                  <ClipboardList size={12} />
                  Requested Specification Lines ({rfqData.lineItems.length})
                </div>

                <div className="rfq-detail-table-wrapper">
                  <table className="rfq-detail-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>#</th>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Delivery Destination</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfqData.lineItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td><strong>{idx + 1}</strong></td>
                          <td><strong>{item.itemCode}</strong></td>
                          <td>{item.itemName}</td>
                          <td>{item.quantity}</td>
                          <td>{item.deliveryAddress}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Approval History Sidebar */}
              <aside className="rfq-summary-approval-card">
                <div className="rfq-summary-approval-heading">
                  <Clock size={16} />
                  <h2>Approval Lifecycle</h2>
                </div>
                <div className="rfq-summary-approval-list">
                  {approvalTasks.length > 0 ? (
                    approvalTasks.map((t, index) => {
                      const tStatus = getTaskApprovalStatusLabel(t);
                      const isPending = tStatus === "Pending";
                      const isApproved = tStatus === "Approved";
                      const isRejected = tStatus === "Rejected";
                      const isActive = t.statecode === 0 && isPending;

                      const dept = t.cr49f_department && Cr49f_approvaltasksescr49f_department[t.cr49f_department]
                        ? Cr49f_approvaltasksescr49f_department[t.cr49f_department]
                        : "IT Department";

                      const role = t.cr49f_role && Cr49f_approvaltasksescr49f_role[t.cr49f_role]
                        ? Cr49f_approvaltasksescr49f_role[t.cr49f_role]
                        : "Approver";

                      return (
                        <div
                          className={`rfq-summary-approval-step ${
                            isApproved
                              ? "completed"
                              : isRejected
                              ? "rejected"
                              : isActive
                              ? "current"
                              : "pending"
                          }`}
                          key={t.cr49f_approvaltasksid}
                        >
                          <span className="rfq-summary-approval-rail">
                            <span className="rfq-summary-approval-node">
                              {isApproved ? "✓" : isRejected ? "✕" : index + 1}
                            </span>
                          </span>
                          <span className="rfq-summary-approval-copy">
                            <strong
                              className="rfq-task-link"
                              onClick={() => navigate(`/tasks/${t.cr49f_approvaltasksid}`)}
                              title="Click to view task details"
                            >
                              {t.cr49f_task}
                            </strong>
                            <span
                              className={`rfq-summary-approval-badge ${
                                isApproved
                                  ? "completed"
                                  : isRejected
                                  ? "rejected"
                                  : isActive
                                  ? "current"
                                  : "pending"
                              }`}
                            >
                              {isApproved ? "Approved" : isRejected ? "Rejected" : isActive ? "Active" : "Pending"}
                            </span>
                            <span><b>{role}</b> · <em>{dept}</em></span>
                            <small>SLA: {t.cr49f_slanumber ?? 24} hours</small>
                          </span>
                        </div>
                      );
                    })
                  ) : loadingTasks ? (
                    <p className="rfq-summary-approval-empty">Loading approval workflow tasks...</p>
                  ) : (
                    <p className="rfq-summary-approval-empty">No approval tasks configured for this RFQ.</p>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {/* TAB 2: PURCHASE REQUEST */}
        {activeTab === "Purchase Request" && (
          <div className="rfq-tab-pane">
            {linkedPR ? (
              <div className="rfq-linked-pr-container">
                <div className="rfq-linked-pr-card">
                  <div className="rfq-linked-pr-header">
                    <div className="rfq-linked-pr-badge">
                      <FileText size={15} />
                      <span>ASSOCIATED PURCHASE REQUEST</span>
                    </div>
                    <button
                      type="button"
                      className="rfq-detail-primary-btn"
                      onClick={() =>
                        navigate(`/purchase-requests/${linkedPR.cr49f_prnumber || linkedPR.cr49f_purchaserequestid}`)
                      }
                    >
                      View Full PR Summary <ExternalLink size={12} />
                    </button>
                  </div>

                  <div className="rfq-linked-pr-body">
                    <div className="rfq-linked-pr-title-row">
                      <h3>{linkedPR.cr49f_prnumber || "PR-Record"}</h3>
                      <span className="rfq-linked-pr-name">
                        {linkedPR.cr49f_prtitle || "Untitled Purchase Request"}
                      </span>
                    </div>

                    <div className="rfq-detail-grid">
                      <div className="rfq-detail-field">
                        <div className="rfq-detail-field-icon"><User size={12} /></div>
                        <div><span>Requester</span><strong>{linkedPR.createdbyname || "Sakshi Paliwal"}</strong></div>
                      </div>
                      <div className="rfq-detail-field">
                        <div className="rfq-detail-field-icon"><CalendarDays size={12} /></div>
                        <div><span>Required Date</span><strong>{toUsDate(linkedPR.cr49f_requireddeliverydate)}</strong></div>
                      </div>
                      <div className="rfq-detail-field">
                        <div className="rfq-detail-field-icon"><MapPin size={12} /></div>
                        <div><span>Delivery Address</span><strong>{linkedPR.cr49f_deliverylocation || rfqData.deliveryLocation}</strong></div>
                      </div>
                      <div className="rfq-detail-field">
                        <div className="rfq-detail-field-icon"><ShieldCheck size={12} /></div>
                        <div><span>Status</span><strong>{linkedPR.cr49f_statusname || "In Review"}</strong></div>
                      </div>
                    </div>

                    {linkedPR.cr49f_businessjustification && (
                      <div className="rfq-pr-justification-box">
                        <strong>Business Justification:</strong>
                        <p>{linkedPR.cr49f_businessjustification}</p>
                      </div>
                    )}
                  </div>
                </div>

                {prLines.length > 0 && (
                  <div className="rfq-pr-lines-section">
                    <div className="rfq-detail-lineitems-heading">
                      <ClipboardList size={12} />
                      Line Items Linked from Purchase Request ({prLines.length})
                    </div>
                    <div className="rfq-detail-table-wrapper">
                      <table className="rfq-detail-table">
                        <thead>
                          <tr>
                            <th style={{ width: 44 }}>#</th>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Description / Specification</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prLines.map((line, idx) => (
                            <tr key={line.cr49f_purchaserequestlineid || idx}>
                              <td><strong>{idx + 1}</strong></td>
                              <td><strong>{line.cr49f_prlinenumber || `LINE-${idx + 1}`}</strong></td>
                              <td>{line.cr49f_itemname || "Item"}</td>
                              <td>{line.cr49f_itemdescription || "—"}</td>
                              <td>{line.cr49f_quantity || 1}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : rfqData.associatedPr ? (
              <div className="rfq-detail-tab-empty">
                <FileText size={28} style={{ opacity: 0.6, marginBottom: 8 }} />
                <p>Associated Purchase Request: <strong>{rfqData.associatedPr}</strong></p>
                <button
                  type="button"
                  className="rfq-inline-link"
                  onClick={() => navigate(`/purchase-requests/${rfqData.associatedPr}`)}
                >
                  Click to open Purchase Request Summary →
                </button>
              </div>
            ) : (
              <div className="rfq-detail-tab-empty">
                <FileText size={28} style={{ opacity: 0.6, marginBottom: 8 }} />
                <p>No Purchase Request linked to this RFQ.</p>
                <span>This RFQ was created directly without an upstream Purchase Request reference.</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ASSOCIATED TASKS */}
        {activeTab === "Associated Tasks" && (
          <div className="rfq-tab-pane">
            <div className="rfq-detail-lineitems-heading">
              <ShieldCheck size={13} />
              RFQ Approval Lifecycle Tasks ({approvalTasks.length})
            </div>

            {approvalTasks.length > 0 ? (
              <div className="rfq-detail-table-wrapper">
                <table className="rfq-detail-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th>Task Name</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>SLA</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
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
                        task.cr49f_department && Cr49f_approvaltasksescr49f_department[task.cr49f_department]
                          ? Cr49f_approvaltasksescr49f_department[task.cr49f_department]
                          : "Administrator";

                      const roleLabel =
                        task.cr49f_role && Cr49f_approvaltasksescr49f_role[task.cr49f_role]
                          ? Cr49f_approvaltasksescr49f_role[task.cr49f_role]
                          : "Procurement Approver";

                      const slaUnitLabel =
                        task.cr49f_slaunit && Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit]
                          ? Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit]
                          : "Hours";

                      const slaLabel = `${task.cr49f_slanumber ?? 24} ${slaUnitLabel}`;

                      return (
                        <tr key={task.cr49f_approvaltasksid}>
                          <td><strong>{task.cr49f_sequence ?? 1}</strong></td>
                          <td>
                            <strong
                              className="rfq-task-table-title"
                              onClick={() => navigate(`/tasks/${task.cr49f_approvaltasksid}`)}
                              title="Click to view full task page"
                            >
                              {task.cr49f_task}
                            </strong>
                            {task.cr49f_id && task.cr49f_id !== task.cr49f_task && (
                              <span className="rfq-task-subid">{task.cr49f_id}</span>
                            )}
                          </td>
                          <td>{deptLabel}</td>
                          <td>{roleLabel}</td>
                          <td>{slaLabel}</td>
                          <td>
                            <span
                              className={`rfq-task-status-pill ${
                                isApproved ? "approved" : isRejected ? "rejected" : isActive ? "active" : "pending"
                              }`}
                            >
                              {isApproved ? "Approved" : isRejected ? "Rejected" : isActive ? "Active" : "Pending"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {isActive && isPending ? (
                              <div className="rfq-task-actions-row">
                                <button
                                  type="button"
                                  className="rfq-btn-xs rfq-btn-approve"
                                  onClick={() => void handleApprove(task)}
                                  disabled={actioningTaskId === task.cr49f_approvaltasksid}
                                  title="Approve step"
                                >
                                  <ThumbsUp size={11} /> Approve
                                </button>
                                <button
                                  type="button"
                                  className="rfq-btn-xs rfq-btn-reject"
                                  onClick={() => void handleReject(task)}
                                  disabled={actioningTaskId === task.cr49f_approvaltasksid}
                                  title="Reject step"
                                >
                                  <ThumbsDown size={11} /> Reject
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="rfq-btn-xs rfq-btn-outline"
                                onClick={() => navigate(`/tasks/${task.cr49f_approvaltasksid}`)}
                              >
                                View Task
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rfq-detail-tab-empty">
                <ShieldCheck size={28} style={{ opacity: 0.6, marginBottom: 8 }} />
                <p>No approval tasks recorded for this RFQ.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUPPLIER RESPONSES */}
        {activeTab === "Supplier Responses" && (() => {
          const displayResponses: FullSupplierResponse[] =
            fullSupplierResponses.length > 0
              ? fullSupplierResponses
              : rfqData.invitedSuppliers.map((s) => ({
                  responseId: s.id,
                  rfqId: cleanGuid(ref) || "",
                  supplierId: s.id,
                  supplierCode: s.id,
                  supplierName: s.name,
                  supplierEmail: s.email,
                  status: (s.hasResponse ? "Submitted" : "Invited") as "Invited" | "Draft" | "Submitted",
                  statuscode: s.hasResponse ? 2 : 1,
                  statecode: s.hasResponse ? 1 : 0,
                  totalAmount: 0,
                  lines: [],
                }));

          const submittedCount = displayResponses.filter((r) => r.status === "Submitted").length;
          const draftCount = displayResponses.filter((r) => r.status === "Draft").length;
          const invitedCount = displayResponses.filter((r) => r.status === "Invited").length;

          return (
            <div className="rfq-tab-pane">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div className="rfq-detail-lineitems-heading" style={{ margin: 0 }}>
                    <Users size={14} />
                    Invited Vendors &amp; Quotation Responses ({displayResponses.length})
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="supplier-status-pill submitted" style={{ fontSize: 11 }}>
                      <CheckCircle2 size={11} /> {submittedCount} Submitted
                    </span>
                    <span className="supplier-status-pill draft" style={{ fontSize: 11 }}>
                      <Clock size={11} /> {draftCount} Draft
                    </span>
                    <span className="supplier-status-pill invited" style={{ fontSize: 11 }}>
                      <Mail size={11} /> {invitedCount} Invited
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="supplier-btn-action"
                  onClick={() => setIsCompareModalOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#2563eb", borderColor: "#93c5fd" }}
                >
                  <BarChart3 size={13} />
                  Compare Supplier Responses
                </button>
              </div>

              <div className="rfq-detail-table-wrapper">
                <table className="rfq-detail-table">
                  <thead>
                    <tr>
                      <th>Supplier Details</th>
                      <th>Contact &amp; Email</th>
                      <th>Response Status</th>
                      <th>Quoted Total</th>
                      <th>Promised Delivery</th>
                      <th>Warranty</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayResponses.map((resp) => (
                      <tr key={resp.responseId || resp.supplierId}>
                        <td>
                          <div className="rfq-detail-table-avatar">
                            <span>{getInitials(resp.supplierName)}</span>
                            <div>
                              <strong>{resp.supplierName}</strong>
                              {resp.supplierCode && (
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                                  {resp.supplierCode}
                                </span>
                              )}
                            </div>
                            <ShieldCheck size={12} className="rfq-supplier-verified" style={{ marginLeft: 4 }} />
                          </div>
                        </td>
                        <td>
                          <div>{resp.supplierEmail || "vendor@procurement.com"}</div>
                        </td>
                        <td>
                          <span className={`supplier-status-pill ${resp.status.toLowerCase()}`}>
                            {resp.status === "Submitted" ? (
                              <CheckCircle2 size={11} />
                            ) : resp.status === "Draft" ? (
                              <Clock size={11} />
                            ) : (
                              <Mail size={11} />
                            )}
                            {resp.status}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {resp.totalAmount && resp.totalAmount > 0
                              ? `$${resp.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                              : resp.status === "Invited"
                              ? "Awaiting Quote"
                              : "—"}
                          </strong>
                        </td>
                        <td>{resp.deliveryDate ? new Date(resp.deliveryDate).toLocaleDateString() : "—"}</td>
                        <td>{resp.warranty || "Standard Terms"}</td>
                        <td style={{ textAlign: "right" }}>
                          {isApprovedOrRewarded ? (
                            <button
                              type="button"
                              className="supplier-btn-action"
                              onClick={() => setSelectedQuotationForView(resp)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <FileText size={12} />
                              View Quotation
                            </button>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11.5,
                                color: "#94a3b8",
                                fontWeight: 600,
                              }}
                              title="RFQ must be approved before quotations can be viewed"
                            >
                              <Clock size={12} />
                              Pending RFQ Approval
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TAB 5: NOTES */}
        {activeTab === "Notes" && (
          <div className="rfq-tab-pane">
            <div className="rfq-notes-section">
              <div className="rfq-notes-heading">
                <div>
                  <div className="rfq-detail-lineitems-heading">
                    <ClipboardList size={13} />
                    Internal Notes &amp; Clarifications ({notes.length})
                  </div>
                  <p>Document committee notes, vendor questions, and evaluation remarks</p>
                </div>
                <button
                  type="button"
                  className="rfq-detail-primary-btn"
                  onClick={() => setIsAddNoteOpen(true)}
                >
                  <Plus size={12} /> Add Note
                </button>
              </div>

              {notes.length === 0 ? (
                <div className="rfq-detail-tab-empty">
                  <ClipboardList size={28} style={{ opacity: 0.6, marginBottom: 8 }} />
                  <p>No notes or clarifications recorded for this RFQ yet.</p>
                  <span>Click "Add Note" to document evaluation notes or meeting minutes.</span>
                </div>
              ) : (
                <div className="rfq-notes-list">
                  {notes.map((note) => (
                    <div key={note.id} className="rfq-note-card">
                      <div className="rfq-note-card-top">
                        <div className="rfq-note-author-row">
                          <span className="rfq-note-author-avatar">{getInitials(note.author)}</span>
                          <div className="rfq-note-author-info">
                            <strong>{note.author}</strong>
                            <time>{note.createdAt}</time>
                          </div>
                        </div>
                        <div className="rfq-note-card-actions">
                          <span className={`rfq-note-visibility ${note.type.toLowerCase()}`}>
                            {note.type}
                          </span>
                          <button
                            type="button"
                            className="rfq-note-delete-btn"
                            onClick={() => handleDeleteNote(note.id)}
                            aria-label={`Delete note: ${note.title}`}
                            title="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <h4>{note.title}</h4>
                      <p>{note.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: ATTACHMENTS */}
        {activeTab === "Attachments" && (
          <div className="rfq-tab-pane">
            <div className="rfq-detail-lineitems-heading">
              <Paperclip size={13} />
              Procurement Specifications &amp; Documents (3)
            </div>

            <div className="rfq-attachments-grid">
              <div className="rfq-attachment-card">
                <div className="rfq-attachment-icon pdf">
                  <FileText size={20} />
                </div>
                <div className="rfq-attachment-info">
                  <strong>RFQ-Technical-Specifications-2026.pdf</strong>
                  <span>Hardware specification schedule, quantities &amp; delivery criteria · 2.4 MB</span>
                </div>
              </div>

              <div className="rfq-attachment-card">
                <div className="rfq-attachment-icon xls">
                  <ClipboardList size={20} />
                </div>
                <div className="rfq-attachment-info">
                  <strong>Commercial-Quotation-Matrix.xlsx</strong>
                  <span>Vendor pricing schedule, discount breakdown &amp; warranty terms · 820 KB</span>
                </div>
              </div>

              <div className="rfq-attachment-card">
                <div className="rfq-attachment-icon sec">
                  <ShieldCheck size={20} />
                </div>
                <div className="rfq-attachment-info">
                  <strong>Standard-Vendor-Confidentiality-Agreement.pdf</strong>
                  <span>Non-disclosure agreement &amp; legal compliance conditions · 1.1 MB</span>
                </div>
              </div>
            </div>

            {/* Supplier Quotation Documents Section */}
            <div className="rfq-detail-lineitems-heading" style={{ marginTop: 22 }}>
              <FileText size={13} />
              Supplier Commercial Quotation Documents
            </div>

            <div className="rfq-attachments-grid">
              {rfqData.invitedSuppliers.filter((s) => s.hasResponse).length === 0 ? (
                <div style={{ padding: "16px 20px", color: "#64748b", fontSize: 13, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                  No supplier quotation documents submitted yet for this RFQ.
                </div>
              ) : (
                rfqData.invitedSuppliers
                  .filter((s) => s.hasResponse)
                  .map((supplier) => (
                    <div
                      className="rfq-attachment-card"
                      key={supplier.id}
                      onClick={() => handleOpenQuotationForSupplier(supplier)}
                      style={{ cursor: "pointer", border: "1.5px solid #bfdbfe", background: "#f8faff" }}
                      title="Click to view and print Quotation Document"
                    >
                      <div className="rfq-attachment-icon pdf" style={{ background: "#2563eb", color: "#ffffff" }}>
                        <FileText size={20} />
                      </div>
                      <div className="rfq-attachment-info">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong>Quotation-Doc-{supplier.name.replace(/[^A-Za-z0-9]/g, "-")}.pdf</strong>
                          <span className="supplier-status-pill submitted" style={{ fontSize: 10, padding: "1px 6px" }}>Official Bid</span>
                        </div>
                        <span>
                          Vendor: <strong>{supplier.name}</strong> ({supplier.code || "SUP"}) · Generated upon submission · Click to View &amp; Print
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 7: ORDERS */}
        {activeTab === "Orders" && (
          <div className="rfq-tab-pane">
            <div className="rfq-orders-card">
              <div className="rfq-orders-icon">
                <Building2 size={36} />
              </div>
              <h3>Purchase Order Generation</h3>
              {isApprovedOrRewarded ? (
                <>
                  <p>This RFQ evaluation has concluded and is approved for Purchase Order issuance.</p>
                  <button
                    type="button"
                    className="rfq-detail-primary-btn"
                    onClick={() => navigate("/orders")}
                  >
                    <FileText size={12} />
                    Create Purchase Order
                  </button>
                </>
              ) : (
                <p>
                  Purchase orders can be generated once this RFQ has been evaluated and approved by the procurement committee.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Note Creation Modal */}
      {isAddNoteOpen && (
        <div className="rfq-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setIsAddNoteOpen(false)}>
          <div className="rfq-note-modal" role="dialog" aria-modal="true" aria-labelledby="add-note-title">
            <div className="rfq-note-modal-header">
              <h2 id="add-note-title">Add RFQ Note / Clarification</h2>
              <button type="button" onClick={() => setIsAddNoteOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddNote}>
              <div className="rfq-note-field">
                <label htmlFor="noteTitle">Note Title</label>
                <input
                  id="noteTitle"
                  type="text"
                  placeholder="e.g. Technical evaluation meeting minutes"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  required
                />
              </div>

              <div className="rfq-note-field">
                <label htmlFor="noteType">Visibility Type</label>
                <select
                  id="noteType"
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as "Internal" | "Clarification")}
                >
                  <option value="Internal">Internal (Procurement Team Only)</option>
                  <option value="Clarification">Public Clarification (Visible to Vendors)</option>
                </select>
              </div>

              <div className="rfq-note-field">
                <label htmlFor="noteBody">Content</label>
                <textarea
                  id="noteBody"
                  rows={4}
                  placeholder="Write your note or clarification text here..."
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  required
                />
              </div>

              <div className="rfq-note-modal-actions">
                <button type="button" className="rfq-btn-ghost" onClick={() => setIsAddNoteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="rfq-detail-primary-btn">
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Supplier Quotation Document Modal */}
      {(selectedQuotationForView || selectedSupplierForModal) && (
        <QuotationDocumentModal
          isOpen={Boolean(selectedQuotationForView || selectedSupplierForModal)}
          onClose={() => {
            setSelectedQuotationForView(null);
            setSelectedSupplierForModal(null);
          }}
          rfq={liveRfq}
          rfqNumber={rfqData.refNo}
          rfqTitle={rfqData.title}
          associatedPr={rfqData.associatedPr ?? undefined}
          deliveryLocation={rfqData.deliveryLocation}
          response={selectedQuotationForView}
          supplier={
            selectedSupplierForModal ||
            (selectedQuotationForView
              ? rfqData.invitedSuppliers.find(
                  (s) =>
                    cleanGuid(s.id) === cleanGuid(selectedQuotationForView.supplierId) ||
                    (s.code && selectedQuotationForView.supplierCode && s.code.toLowerCase() === selectedQuotationForView.supplierCode.toLowerCase()) ||
                    s.name.toLowerCase() === selectedQuotationForView.supplierName.toLowerCase()
                ) || {
                  id: selectedQuotationForView.supplierId,
                  name: selectedQuotationForView.supplierName,
                  code: selectedQuotationForView.supplierCode,
                  email: selectedQuotationForView.supplierEmail,
                  hasResponse: true,
                  rewarded: selectedQuotationForView.status === "Rewarded",
                }
              : null)
          }
          supplierProfile={allSuppliers.find(
            (s) =>
              (selectedQuotationForView && (
                cleanGuid(s.cr49f_supplierid) === cleanGuid(selectedQuotationForView.supplierId) ||
                (s.cr49f_supplierid1 && selectedQuotationForView.supplierCode && s.cr49f_supplierid1.toLowerCase() === selectedQuotationForView.supplierCode.toLowerCase()) ||
                (s.cr49f_name && s.cr49f_name.toLowerCase() === selectedQuotationForView.supplierName.toLowerCase())
              )) ||
              (selectedSupplierForModal && (
                cleanGuid(s.cr49f_supplierid) === cleanGuid(selectedSupplierForModal.id) ||
                (s.cr49f_supplierid1 && selectedSupplierForModal.code && s.cr49f_supplierid1.toLowerCase() === selectedSupplierForModal.code.toLowerCase()) ||
                (s.cr49f_name && s.cr49f_name.toLowerCase() === selectedSupplierForModal.name.toLowerCase())
              ))
          )}
          aiRecommendation={selectedSupplierForModal?.reason}
          isAwarded={
            Boolean(
              selectedSupplierForModal?.rewarded ||
              (selectedQuotationForView && selectedQuotationForView.status === "Rewarded") ||
              (cachedAwardedId && (
                (selectedSupplierForModal && (cleanGuid(selectedSupplierForModal.id) === cleanGuid(cachedAwardedId) || selectedSupplierForModal.id === cachedAwardedId)) ||
                (selectedQuotationForView && (cleanGuid(selectedQuotationForView.supplierId) === cleanGuid(cachedAwardedId) || selectedQuotationForView.supplierId === cachedAwardedId))
              )) ||
              (awardedSupplierName && (
                (selectedSupplierForModal && selectedSupplierForModal.name.toLowerCase().trim() === awardedSupplierName.toLowerCase().trim()) ||
                (selectedQuotationForView && selectedQuotationForView.supplierName.toLowerCase().trim() === awardedSupplierName.toLowerCase().trim())
              ))
            )
          }
          isRfqAlreadyAwarded={isAnySupplierAwarded}
          awardedSupplierName={awardedSupplierName}
          onReward={() => {
            if (isAnySupplierAwarded) {
              alert(
                `This RFQ has already been awarded${
                  awardedSupplierName ? ` to "${awardedSupplierName}"` : ""
                }. Another supplier cannot be awarded.`
              );
              return;
            }
            const targetSupplier =
              selectedSupplierForModal ||
              (selectedQuotationForView
                ? rfqData.invitedSuppliers.find(
                    (s) =>
                      cleanGuid(s.id) === cleanGuid(selectedQuotationForView.supplierId) ||
                      s.name.toLowerCase() === selectedQuotationForView.supplierName.toLowerCase()
                  ) || {
                    id: selectedQuotationForView.supplierId,
                    name: selectedQuotationForView.supplierName,
                    code: selectedQuotationForView.supplierCode,
                    email: selectedQuotationForView.supplierEmail,
                    hasResponse: true,
                    rewarded: false,
                    ranking: 1,
                    verified: true,
                    phone: "+91 80 4045 5000",
                    address: "Main Vendor Facility",
                  }
                : null);
            if (targetSupplier) {
              return handleRewardSupplier(targetSupplier as RfqSupplier);
            }
          }}
          isRewarding={isRewardingSupplier}
        />
      )}

      {/* Side-by-Side Comparison Modal */}
      {isCompareModalOpen && (
        <div
          className="rfq-modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setIsCompareModalOpen(false)}
        >
          <div className="rfq-comparison-modal" role="dialog" aria-modal="true">
            <div className="rfq-modal-header">
              <h2 className="rfq-modal-title">
                <BarChart3 size={17} color="#2563eb" />
                Compare Supplier Quotations
              </h2>
              <button
                type="button"
                className="rfq-modal-close-btn"
                onClick={() => setIsCompareModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const eligible = fullSupplierResponses.filter((r) => r.totalAmount > 0);
              const minPrice = eligible.length > 0 ? Math.min(...eligible.map((r) => r.totalAmount)) : null;

              return (
                <>
                  <div className="rfq-compare-summary-grid">
                    {fullSupplierResponses.map((r) => {
                      const isLowest = minPrice !== null && r.totalAmount === minPrice;
                      return (
                        <div key={r.responseId || r.supplierId} className={`rfq-compare-card ${isLowest ? "lowest" : ""}`}>
                          {isLowest && (
                            <span className="rfq-lowest-badge">
                              <CheckCircle2 size={11} /> Lowest Bid
                            </span>
                          )}
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.supplierName}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: isLowest ? "#059669" : "#2563eb" }}>
                            {r.totalAmount > 0 ? `$${r.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "Pending Quote"}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            <div>Delivery: <strong>{r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : "Standard"}</strong></div>
                            <div>Terms: <strong>{r.paymentTerms || "Net 30"}</strong></div>
                            <div>Warranty: <strong>{r.warranty || "Standard"}</strong></div>
                          </div>
                          <span className={`supplier-status-pill ${r.status.toLowerCase()}`} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                            {r.status}
                          </span>
                          <button
                            type="button"
                            className="supplier-btn-action"
                            onClick={() => setSelectedQuotationForView(r)}
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              padding: "4px 8px",
                              width: "100%",
                              justifyContent: "center",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontWeight: 600,
                            }}
                          >
                            <FileText size={11} />
                            View Document
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Line items comparison matrix */}
                  <div className="rfq-detail-lineitems-heading" style={{ margin: "10px 0 0" }}>
                    <ClipboardList size={13} />
                    Line Items Price Comparison Matrix
                  </div>

                  <div className="rfq-detail-table-wrapper">
                    <table className="rfq-detail-table">
                      <thead>
                        <tr>
                          <th>Item Name &amp; Description</th>
                          <th>Req. Qty</th>
                          {fullSupplierResponses.map((r) => (
                            <th key={r.responseId || r.supplierId}>
                              {r.supplierName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prLines.length > 0 ? (
                          prLines.map((prLine, idx) => (
                            <tr key={prLine.cr49f_purchaserequestlineid || idx}>
                              <td>
                                <strong>{prLine.cr49f_itemname || "RFQ Item"}</strong>
                              </td>
                              <td>{prLine.cr49f_quantity || 1}</td>
                              {fullSupplierResponses.map((r) => {
                                const matchedLine = r.lines.find(
                                  (l) => l.itemName.toLowerCase() === (prLine.cr49f_itemname || "").toLowerCase() || idx === 0
                                );
                                return (
                                  <td key={r.responseId || r.supplierId}>
                                    {matchedLine && matchedLine.unitPrice > 0 ? (
                                      <div>
                                        <strong>${matchedLine.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>/unit
                                        <div style={{ fontSize: 11, color: "#64748b" }}>
                                          Total: ${(matchedLine.totalPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: "#94a3b8" }}>—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td><strong>Total Quoted Bid</strong></td>
                            <td>—</td>
                            {fullSupplierResponses.map((r) => (
                              <td key={r.responseId || r.supplierId}>
                                <strong>
                                  {r.totalAmount > 0
                                    ? `$${r.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                    : "Pending"}
                                </strong>
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                className="supplier-btn-action"
                onClick={() => setIsCompareModalOpen(false)}
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
