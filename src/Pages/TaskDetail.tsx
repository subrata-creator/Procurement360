import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Flag,
  List,
  Loader2,
  Send,
  ShieldCheck,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  XCircle,
  AlertCircle,
  CheckCircle2,
  FileEdit,
  RotateCcw,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  X,
  Package,
  Building2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getTaskById } from "../data/tasks";
import type { Task } from "../types/dashboard";
import { Cr49f_approvaltasksesService } from "../generated/services/Cr49f_approvaltasksesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_productsesService } from "../generated/services/Cr49f_productsesService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import type { Cr49f_approvaltaskses } from "../generated/models/Cr49f_approvaltasksesModel";
import {
  Cr49f_approvaltasksescr49f_department,
  Cr49f_approvaltasksescr49f_role,
  Cr49f_approvaltasksescr49f_slaunit,
} from "../generated/models/Cr49f_approvaltasksesModel";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_productses } from "../generated/models/Cr49f_productsesModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import { INITIAL_SAMPLE_SUPPLIERS } from "../data/SampleSuppliersData";
import {
  cleanGuid,
  getTaskApprovalStatusLabel,
  approveTask,
  rejectTask,
  requestChangesOnTask,
  submitChangesNeededUpdate,
  getApprovalTasksForRecord,
} from "../Services/ApprovalWorkflowService";
import "../Styles/TaskDetail.css";

function toUsDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

interface TaskComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dataverseTask, setDataverseTask] = useState<Cr49f_approvaltaskses | null>(null);
  const [parentPR, setParentPR] = useState<Cr49f_purchaserequests | null>(null);
  const [parentRFQ, setParentRFQ] = useState<Cr49f_requestforqoutations | null>(null);
  const [lineItems, setLineItems] = useState<Cr49f_purchaserequestlines[]>([]);
  const [siblingTasks, setSiblingTasks] = useState<Cr49f_approvaltaskses[]>([]);

  const loadDataverseTaskData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const cleanTargetId = cleanGuid(id);
      const res = await Cr49f_approvaltasksesService.getAll();
      const allTasks = res.data ?? [];

      const matched = allTasks.find((t) => {
        const raw = t as unknown as Record<string, unknown>;
        return (
          cleanGuid(t.cr49f_approvaltasksid) === cleanTargetId ||
          t.cr49f_id === id ||
          cleanGuid(raw.cr49f_approvaltasksid as string) === cleanTargetId
        );
      });

      if (matched) {
        setDataverseTask(matched);

        const rawMatched = matched as unknown as Record<string, unknown>;
        const prId =
          cleanGuid(matched._cr49f_pr_value) ||
          cleanGuid(rawMatched._cr49f_PR_value as string) ||
          cleanGuid(rawMatched.cr49f_pr as string);

        const rfqId =
          cleanGuid(matched._cr49f_rfq_value) ||
          cleanGuid(rawMatched._cr49f_RFQ_value as string) ||
          cleanGuid(rawMatched.cr49f_rfq as string);

        const taskTitleLower = String(matched.cr49f_task || "").toLowerCase();
        const isObjectRfq =
          matched.cr49f_object === 2 ||
          Boolean(rfqId) ||
          taskTitleLower.includes("rfq") ||
          taskTitleLower.includes("quotation");

        const isObjectPr = !isObjectRfq && (matched.cr49f_object === 1 || Boolean(prId));

        if (isObjectRfq) {
          const [rfqsRes, prsRes] = await Promise.all([
            Cr49f_requestforqoutationsService.getAll(),
            prId ? Cr49f_purchaserequestsService.getAll() : Promise.resolve({ data: [] }),
          ]);

          const allRfqs = rfqsRes.data ?? [];
          let foundRFQ = allRfqs.find(
            (r) => cleanGuid(r.cr49f_requestforqoutationid) === rfqId
          );

          if (!foundRFQ) {
            foundRFQ = allRfqs.find((r) => {
              const rNum = r.cr49f_rfqnumber?.toLowerCase();
              if (rNum && taskTitleLower.includes(rNum)) return true;
              if (prId && cleanGuid(r._cr49f_prrfq_value) === prId) return true;
              return false;
            });
          }

          const effectiveRfqId = cleanGuid(foundRFQ?.cr49f_requestforqoutationid) || rfqId;
          const siblings = await getApprovalTasksForRecord(2, effectiveRfqId || "");

          setParentRFQ(foundRFQ || null);
          setSiblingTasks(siblings);

          // If linked to an originating PR, load PR lines for item context
          if (prId) {
            const foundPR = (prsRes.data ?? []).find(
              (p) => cleanGuid(p.cr49f_purchaserequestid) === prId
            );
            setParentPR(foundPR || null);
            try {
              const linesRes = await Cr49f_purchaserequestlinesService.getAll();
              const matchedLines = (linesRes.data ?? []).filter((l) => {
                const rawL = l as unknown as Record<string, unknown>;
                const lPR =
                  cleanGuid(l._cr49f_purchaserequest_value) ||
                  cleanGuid(rawL._cr49f_PurchaseRequest_value as string);
                return lPR === prId;
              });
              setLineItems(matchedLines);
            } catch {}
          } else {
            setParentPR(null);
            setLineItems([]);
          }
        } else if (isObjectPr) {
          const [prsRes, linesRes, siblings] = await Promise.all([
            Cr49f_purchaserequestsService.getAll(),
            Cr49f_purchaserequestlinesService.getAll(),
            getApprovalTasksForRecord(1, prId || ""),
          ]);

          const foundPR = (prsRes.data ?? []).find(
            (p) => cleanGuid(p.cr49f_purchaserequestid) === prId
          );
          setParentPR(foundPR || null);
          setParentRFQ(null);

          const matchedLines = (linesRes.data ?? []).filter((l) => {
            const rawL = l as unknown as Record<string, unknown>;
            const lPR =
              cleanGuid(l._cr49f_purchaserequest_value) ||
              cleanGuid(rawL._cr49f_PurchaseRequest_value as string);
            return lPR === prId;
          });
          setLineItems(matchedLines);
          setSiblingTasks(siblings);
        }
      }
    } catch (err) {
      console.warn("Failed to load Dataverse approval task:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDataverseTaskData();

    const handleUpdate = () => void loadDataverseTaskData();
    window.addEventListener("approvalTasksUpdated", handleUpdate);
    return () => {
      window.removeEventListener("approvalTasksUpdated", handleUpdate);
    };
  }, [loadDataverseTaskData]);

  if (loading) {
    return (
      <section className="task-page-container" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "var(--muted-foreground-hex, #64748b)" }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: "0 auto 12px", display: "block", color: "var(--primary-hex, #2563eb)" }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Loading approval task details...</p>
        </div>
      </section>
    );
  }

  // 1. Dataverse Task Found
  if (dataverseTask) {
    return (
      <ModernDataverseTaskDetail
        task={dataverseTask}
        parentPR={parentPR}
        parentRFQ={parentRFQ}
        lineItems={lineItems}
        siblingTasks={siblingTasks}
        onRefresh={loadDataverseTaskData}
        onBack={() => navigate(-1)}
      />
    );
  }

  // 2. Legacy / Sample Task Fallback
  const numericId = Number(id?.replace("sample-", ""));
  const sampleTask = !Number.isNaN(numericId) ? getTaskById(numericId) : undefined;

  if (sampleTask) {
    if (sampleTask.taskType === "Request for Quotation") {
      return <RfqApprovalTask task={sampleTask} onBack={() => navigate(-1)} />;
    }
    return <OtherApprovalTask task={sampleTask} onBack={() => navigate(-1)} />;
  }

  // 3. Not Found
  return (
    <section className="task-page-container">
      <button type="button" className="task-back-btn" onClick={() => navigate("/")}>
        <ArrowLeft size={16} /> Dashboard
      </button>
      <div style={{ margin: "60px auto", textAlign: "center", maxWidth: 440 }}>
        <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 14px", display: "block" }} />
        <h2 style={{ fontSize: 18, color: "var(--foreground-hex, #0f172a)", marginBottom: 8, fontWeight: 700 }}>Task Not Found</h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground-hex, #64748b)", marginBottom: 20, lineHeight: 1.5 }}>
          Could not find an approval task matching &quot;{id}&quot; in the approval tasks table.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            padding: "9px 20px",
            background: "var(--primary-hex, #2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Return to Dashboard
        </button>
      </div>
    </section>
  );
}

/**
 * Modern, High-End Enterprise Task Review View
 * Pure task focus without PR Journey card.
 */
function ModernDataverseTaskDetail({
  task,
  parentPR,
  parentRFQ,
  lineItems,
  siblingTasks,
  onRefresh,
  onBack,
}: {
  task: Cr49f_approvaltaskses;
  parentPR: Cr49f_purchaserequests | null;
  parentRFQ: Cr49f_requestforqoutations | null;
  lineItems: Cr49f_purchaserequestlines[];
  siblingTasks: Cr49f_approvaltaskses[];
  onRefresh: () => Promise<void>;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const cleanTaskId = cleanGuid(task.cr49f_approvaltasksid);
  const approvalStatus = getTaskApprovalStatusLabel(task);
  const isApproved = approvalStatus === "Approved";
  const isRejected = approvalStatus === "Rejected";
  const isChangesNeeded =
    approvalStatus === "Changes Needed" ||
    task.cr49f_id === "Changes Needed" ||
    (task.cr49f_sequence ?? 0) === 0 ||
    Boolean(task.cr49f_task && task.cr49f_task.toLowerCase().includes("changes needed"));
  const isPending = approvalStatus === "Pending" && !isChangesNeeded;
  const isRecordActive =
    (task.statecode === 0 || task.statecode === undefined || Number(task.statecode) === 0) &&
    Number(task.statuscode ?? 1) !== 2;
  const isActive = isRecordActive && (isPending || isChangesNeeded);

  // Dynamic Object Type Detection (RFQ vs PR vs PO)
  const taskTitleLower = String(task.cr49f_task || "").toLowerCase();
  const isRfq =
    task.cr49f_object === 2 ||
    Boolean(parentRFQ) ||
    Boolean(cleanGuid(task._cr49f_rfq_value)) ||
    taskTitleLower.includes("rfq") ||
    taskTitleLower.includes("quotation");

  const isPr =
    !isRfq &&
    (task.cr49f_object === 1 || Boolean(parentPR) || Boolean(cleanGuid(task._cr49f_pr_value)));
  const isPo = !isRfq && !isPr && task.cr49f_object === 3;

  const objectTypeLabel = isRfq
    ? "Request for Quotation"
    : isPr
    ? "Purchase Request"
    : isPo
    ? "Purchase Order"
    : "Approval Task";

  const shortType = isRfq ? "RFQ" : isPr ? "Purchase Request" : isPo ? "Purchase Order" : "Record";

  const reference = isRfq
    ? parentRFQ?.cr49f_rfqnumber || "RFQ-2026"
    : isPr
    ? parentPR?.cr49f_prnumber || "PR-2026"
    : `TASK-${task.cr49f_sequence || 1}`;

  const prIdClean = cleanGuid(parentPR?.cr49f_purchaserequestid) || cleanGuid(task._cr49f_pr_value);
  const cachedPrStatus = prIdClean && typeof window !== "undefined" ? localStorage.getItem(`pr_status_${prIdClean}`) : null;
  const isPrChangesNeeded =
    parentPR?.cr49f_status === 2 ||
    parentPR?.cr49f_statusname?.toLowerCase().includes("change") ||
    cachedPrStatus === "Changes Needed";

  const rfqIdClean = cleanGuid(parentRFQ?.cr49f_requestforqoutationid) || cleanGuid(task._cr49f_rfq_value);
  const cachedRfqStatus = rfqIdClean && typeof window !== "undefined" ? localStorage.getItem(`rfq_status_${rfqIdClean}`) : null;
  const isRfqChangesNeeded =
    parentRFQ?.cr49f_status === 2 ||
    parentRFQ?.cr49f_statusname?.toLowerCase().includes("change") ||
    cachedRfqStatus === "Changes Needed";

  const isRecordChangesNeeded = isPrChangesNeeded || isRfqChangesNeeded;
  const changesReason =
    (prIdClean && typeof window !== "undefined" && localStorage.getItem(`pr_changes_reason_${prIdClean}`)) ||
    (rfqIdClean && typeof window !== "undefined" && localStorage.getItem(`rfq_changes_reason_${rfqIdClean}`)) ||
    "An approver has requested modifications before approval can proceed.";

  // Modal for approver requesting changes
  const [isChangesNeededModalOpen, setIsChangesNeededModalOpen] = useState(false);
  const [changesFeedbackText, setChangesFeedbackText] = useState("");

  // Revision form states when viewing an active Changes Needed task for PR
  const [editTitle, setEditTitle] = useState(parentPR?.cr49f_prtitle || "");
  const [editPriority, setEditPriority] = useState<number>(parentPR?.cr49f_priority ?? 2);
  const [editLocation, setEditLocation] = useState(parentPR?.cr49f_deliverylocation || "");
  const [editDeliveryDate, setEditDeliveryDate] = useState(
    parentPR?.cr49f_requireddeliverydate ? parentPR.cr49f_requireddeliverydate.slice(0, 10) : ""
  );
  const [editJustification, setEditJustification] = useState(parentPR?.cr49f_businessjustification || "");
  const [editableLines, setEditableLines] = useState<Cr49f_purchaserequestlines[]>(lineItems);

  // Revision form states when viewing an active Changes Needed task for RFQ
  const [editRfqTitle, setEditRfqTitle] = useState(parentRFQ?.cr49f_rfqtitle || "");
  const [editRfqDeadline, setEditRfqDeadline] = useState(
    parentRFQ?.cr49f_submissiondeadline ? parentRFQ.cr49f_submissiondeadline.slice(0, 10) : ""
  );
  const [editRfqLocation, setEditRfqLocation] = useState(parentRFQ?.cr49f_deliverylocation || "");
  const [editRfqDescription, setEditRfqDescription] = useState(parentRFQ?.cr49f_description || "");

  const [requesterRemarks, setRequesterRemarks] = useState("");
  const [submittingChanges, setSubmittingChanges] = useState(false);

  useEffect(() => {
    if (parentPR) {
      setEditTitle(parentPR.cr49f_prtitle || "");
      setEditPriority(parentPR.cr49f_priority ?? 2);
      setEditLocation(parentPR.cr49f_deliverylocation || "");
      setEditDeliveryDate(
        parentPR.cr49f_requireddeliverydate ? parentPR.cr49f_requireddeliverydate.slice(0, 10) : ""
      );
      setEditJustification(parentPR.cr49f_businessjustification || "");
    }
  }, [parentPR]);

  useEffect(() => {
    if (parentRFQ) {
      setEditRfqTitle(parentRFQ.cr49f_rfqtitle || "");
      setEditRfqDeadline(
        parentRFQ.cr49f_submissiondeadline ? parentRFQ.cr49f_submissiondeadline.slice(0, 10) : ""
      );
      setEditRfqLocation(parentRFQ.cr49f_deliverylocation || "");
      setEditRfqDescription(parentRFQ.cr49f_description || "");
    }
  }, [parentRFQ]);

  useEffect(() => {
    if (lineItems && lineItems.length > 0) {
      setEditableLines(lineItems);
    }
  }, [lineItems]);

  // Products from Dataverse for adding products to PR Changes Needed
  const [availableProducts, setAvailableProducts] = useState<Cr49f_productses[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("ALL");
  const [deletedLineIds, setDeletedLineIds] = useState<string[]>([]);

  // Suppliers & PR selection states for RFQ Changes Needed
  const [availableSuppliers, setAvailableSuppliers] = useState<Cr49f_suppliers[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState("ALL");
  const [approvedPrs, setApprovedPrs] = useState<Cr49f_purchaserequests[]>([]);
  const [selectedPrId, setSelectedPrId] = useState<string>(
    cleanGuid(parentPR?.cr49f_purchaserequestid) || cleanGuid(parentRFQ?._cr49f_prrfq_value) || ""
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCatalogAndSuppliers() {
      try {
        const [prodRes, supRes, prsRes, selSupRes] = await Promise.allSettled([
          Cr49f_productsesService.getAll(),
          Cr49f_suppliersService.getAll(),
          Cr49f_purchaserequestsService.getAll(),
          Cr49f_selectedsuppliersesService.getAll(),
        ]);

        if (cancelled) return;

        if (prodRes.status === "fulfilled" && prodRes.value.data) {
          const activeProds = prodRes.value.data.filter(
            (p) => p.statecode === 0 && Boolean(p.cr49f_productname)
          );
          setAvailableProducts(activeProds);
        }

        let sups: Cr49f_suppliers[] = [];
        if (supRes.status === "fulfilled" && supRes.value.data && supRes.value.data.length > 0) {
          sups = supRes.value.data;
        } else {
          sups = INITIAL_SAMPLE_SUPPLIERS.map((item, idx) => ({
            cr49f_supplierid: (item.supplier as any).cr49f_supplierid || `mock-sup-${idx + 1}`,
            cr49f_name: item.supplier.cr49f_name,
            cr49f_supplierid1: item.supplier.cr49f_supplierid1,
            cr49f_suppliertype: item.supplier.cr49f_suppliertype,
            cr49f_suppliercategory: item.supplier.cr49f_suppliercategory,
            cr49f_contactperson: item.supplier.cr49f_contactperson,
            cr49f_email: item.supplier.cr49f_email,
            cr49f_phonenumber: item.supplier.cr49f_phonenumber,
            cr49f_city: item.supplier.cr49f_city,
            statecode: 0,
            ownerid: "system",
          })) as unknown as Cr49f_suppliers[];
        }
        setAvailableSuppliers(sups);

        if (prsRes.status === "fulfilled" && prsRes.value.data) {
          setApprovedPrs(prsRes.value.data);
        }

        // Initialize selected suppliers for this RFQ
        const rfqId = cleanGuid(parentRFQ?.cr49f_requestforqoutationid) || cleanGuid(task._cr49f_rfq_value);
        const initialSelected: string[] = [];

        // From cr49f_selectedsupplierses in Dataverse
        if (selSupRes.status === "fulfilled" && selSupRes.value.data) {
          const matched = selSupRes.value.data.filter(
            (s) => cleanGuid(s._cr49f_rfq_value) === rfqId
          );
          for (const m of matched) {
            const matchedSup = sups.find(
              (s) =>
                (s.cr49f_supplierid1 && s.cr49f_supplierid1 === m.cr49f_selectedsuppliernumber) ||
                (s.cr49f_name && s.cr49f_name === m.cr49f_supplierquotation) ||
                s.cr49f_supplierid === m.cr49f_selectedsuppliernumber
            );
            if (matchedSup && !initialSelected.includes(matchedSup.cr49f_supplierid)) {
              initialSelected.push(matchedSup.cr49f_supplierid);
            }
          }
        }

        // From localStorage cache
        if (rfqId && typeof window !== "undefined") {
          try {
            const cachedStr = localStorage.getItem(`rfq_invited_suppliers_${rfqId}`);
            if (cachedStr) {
              const cachedList = JSON.parse(cachedStr) as Cr49f_suppliers[];
              for (const c of cachedList) {
                const sId = c.cr49f_supplierid;
                if (sId && !initialSelected.includes(sId)) {
                  initialSelected.push(sId);
                }
              }
            }
          } catch {}
        }

        setSelectedSupplierIds(initialSelected);
      } catch (err) {
        console.warn("Could not load products or suppliers:", err);
      }
    }

    void loadCatalogAndSuppliers();
    return () => {
      cancelled = true;
    };
  }, [parentRFQ, task]);

  // Filtered products for catalog modal
  const filteredCatalogProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      const matchesCat =
        catalogCategory === "ALL" ||
        (p.cr49f_category && p.cr49f_category.toLowerCase() === catalogCategory.toLowerCase());
      const query = catalogSearch.trim().toLowerCase();
      const matchesQuery =
        !query ||
        p.cr49f_productname?.toLowerCase().includes(query) ||
        p.cr49f_productdescription?.toLowerCase().includes(query) ||
        p.cr49f_productnumber?.toLowerCase().includes(query) ||
        p.cr49f_category?.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [availableProducts, catalogCategory, catalogSearch]);

  const catalogCategories = useMemo(() => {
    const cats = new Set<string>();
    availableProducts.forEach((p) => {
      if (p.cr49f_category?.trim()) cats.add(p.cr49f_category.trim());
    });
    return ["ALL", ...Array.from(cats)];
  }, [availableProducts]);

  // Filtered suppliers for RFQ revision
  const filteredSuppliers = useMemo(() => {
    return availableSuppliers.filter((s) => {
      const matchesCat =
        supplierCategoryFilter === "ALL" ||
        (s.cr49f_suppliercategory &&
          s.cr49f_suppliercategory.toLowerCase() === supplierCategoryFilter.toLowerCase());
      const query = supplierSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        s.cr49f_name?.toLowerCase().includes(query) ||
        s.cr49f_supplierid1?.toLowerCase().includes(query) ||
        s.cr49f_contactperson?.toLowerCase().includes(query) ||
        s.cr49f_email?.toLowerCase().includes(query) ||
        s.cr49f_city?.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [availableSuppliers, supplierCategoryFilter, supplierSearchQuery]);

  const supplierCategories = useMemo(() => {
    const cats = new Set<string>();
    availableSuppliers.forEach((s) => {
      if (s.cr49f_suppliercategory?.trim()) cats.add(s.cr49f_suppliercategory.trim());
    });
    return ["ALL", ...Array.from(cats)];
  }, [availableSuppliers]);

  const handleAddProductFromCatalog = (product: Cr49f_productses) => {
    const newLine = {
      cr49f_purchaserequestlineid: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cr49f_itemname: product.cr49f_productname || "Product Item",
      cr49f_itemdescription: product.cr49f_productdescription || "",
      cr49f_category: product.cr49f_category || "General",
      cr49f_quantity: 1,
      cr49f_unitprice: 0,
      statecode: 0,
      statuscode: 1,
    } as unknown as Cr49f_purchaserequestlines;
    setEditableLines((prev) => [...prev, newLine]);
    setNotice(`Added "${product.cr49f_productname}" to requested items.`);
  };

  const handleAddCustomLine = () => {
    const newLine = {
      cr49f_purchaserequestlineid: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cr49f_itemname: "",
      cr49f_itemdescription: "",
      cr49f_category: "General",
      cr49f_quantity: 1,
      cr49f_unitprice: 0,
      statecode: 0,
      statuscode: 1,
    } as unknown as Cr49f_purchaserequestlines;
    setEditableLines((prev) => [...prev, newLine]);
  };

  const handleRemoveLine = (idx: number) => {
    const line = editableLines[idx];
    if (line?.cr49f_purchaserequestlineid && !line.cr49f_purchaserequestlineid.startsWith("new_")) {
      setDeletedLineIds((prev) => [...prev, line.cr49f_purchaserequestlineid]);
    }
    setEditableLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleSupplier = (supId: string) => {
    setSelectedSupplierIds((prev) =>
      prev.includes(supId) ? prev.filter((id) => id !== supId) : [...prev, supId]
    );
  };

  const handleSelectAllVisibleSuppliers = () => {
    const visibleIds = filteredSuppliers.map((s) => s.cr49f_supplierid);
    setSelectedSupplierIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleClearSupplierSelection = () => {
    setSelectedSupplierIds([]);
  };

  // Comments state persisted in localStorage
  const commentsKey = `task_comments_${cleanTaskId}`;
  const [comments, setComments] = useState<TaskComment[]>(() => {
    try {
      const stored = window.localStorage.getItem(commentsKey);
      if (stored) return JSON.parse(stored) as TaskComment[];
    } catch {
      // Fallback
    }
    return [];
  });
  const [commentDraft, setCommentDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const addComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;

    const newComment: TaskComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      author: "Procurement Approver",
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    const updated = [...comments, newComment];
    setComments(updated);
    try {
      window.localStorage.setItem(commentsKey, JSON.stringify(updated));
    } catch {
      // Keep in local state
    }
    setCommentDraft("");
    setNotice("Comment added successfully.");
  };

  const handleApprove = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setNotice(null);
    try {
      const currentUserName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      const result = await approveTask(cleanTaskId, currentUserName);
      setNotice(
        result.parentCompleted
          ? "Final approval complete! All sequential cycle tasks are approved and the record is Approved. Opening dashboard..."
          : `Task approved successfully! Sequence #${result.nextActivatedTask?.cr49f_sequence ?? 2} has been activated. Opening dashboard...`
      );
      await onRefresh();
      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (err: unknown) {
      console.error("Failed to approve task:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setNotice(`Failed to approve task: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setNotice(null);
    try {
      const currentUserName = typeof window !== "undefined" ? (localStorage.getItem("procurement_user_name") || "Subrata Dey") : "Subrata Dey";
      await rejectTask(cleanTaskId, currentUserName);
      setNotice("Task has been rejected. Parent procurement request has been marked as Rejected. Opening dashboard...");
      await onRefresh();
      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (err: unknown) {
      console.error("Failed to reject task:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setNotice(`Failed to reject task: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changesFeedbackText.trim()) {
      setNotice("Please provide comments or feedback on what changes are needed.");
      return;
    }
    setActionLoading(true);
    setNotice(null);
    try {
      const currentUserName = typeof window !== "undefined"
        ? (localStorage.getItem("procurement_user_name") || "Subrata Dey")
        : "Subrata Dey";

      const result = await requestChangesOnTask(cleanTaskId, changesFeedbackText.trim(), currentUserName);
      setIsChangesNeededModalOpen(false);
      setNotice(`${shortType} (${reference}) has been marked as Changes Needed. A revision task has been created for the requester.`);
      await onRefresh();
      if (result.newTaskId) {
        setTimeout(() => {
          navigate(`/tasks/${result.newTaskId}`);
        }, 700);
      } else {
        setTimeout(() => {
          navigate("/");
        }, 700);
      }
    } catch (err: unknown) {
      console.error("Failed to request changes:", err);
      const msg = err instanceof Error ? err.message : "Failed to request changes";
      setNotice(`Failed to request changes: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitChangesRevision = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submittingChanges) return;
    setSubmittingChanges(true);
    setNotice(null);
    try {
      const prId = cleanGuid(parentPR?.cr49f_purchaserequestid) || cleanGuid(task._cr49f_pr_value);
      if (!prId) throw new Error("Purchase Request ID not found.");

      const currentUserName = typeof window !== "undefined"
        ? (localStorage.getItem("procurement_user_name") || "Subrata Dey")
        : "Subrata Dey";

      await submitChangesNeededUpdate({
        changesNeededTaskId: cleanTaskId,
        prId,
        requesterRemarks: requesterRemarks.trim(),
        requesterName: currentUserName,
        updatedPR: {
          cr49f_prtitle: editTitle,
          cr49f_priority: editPriority,
          cr49f_deliverylocation: editLocation,
          cr49f_businessjustification: editJustification,
          cr49f_requireddeliverydate: editDeliveryDate ? new Date(editDeliveryDate).toISOString() : undefined,
        },
        updatedLines: editableLines.map((l) => ({
          lineId: l.cr49f_purchaserequestlineid,
          itemName: l.cr49f_itemname || l.cr49f_itemdescription || "Product Item",
          description: l.cr49f_itemdescription || l.cr49f_itemname || "",
          category: l.cr49f_category || "General",
          quantity: Number(l.cr49f_quantity) || 1,
        })),
        deletedLineIds,
      });

      setNotice("Revisions submitted successfully! Purchase Request updated and workflow restarted from Sequence #1. Opening dashboard...");
      await onRefresh();
      setTimeout(() => {
        navigate("/");
      }, 800);
    } catch (err: unknown) {
      console.error("Failed to submit revisions:", err);
      const msg = err instanceof Error ? err.message : "Failed to submit revisions";
      setNotice(`Failed to submit revisions: ${msg}`);
    } finally {
      setSubmittingChanges(false);
    }
  };

  const handleSubmitRfqChangesRevision = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submittingChanges) return;
    setSubmittingChanges(true);
    setNotice(null);
    try {
      const rfqId = cleanGuid(parentRFQ?.cr49f_requestforqoutationid) || cleanGuid(task._cr49f_rfq_value);
      if (!rfqId) throw new Error("Request for Quotation ID not found.");

      const currentUserName = typeof window !== "undefined"
        ? (localStorage.getItem("procurement_user_name") || "Subrata Dey")
        : "Subrata Dey";

      await submitChangesNeededUpdate({
        changesNeededTaskId: cleanTaskId,
        rfqId,
        requesterRemarks: requesterRemarks.trim(),
        requesterName: currentUserName,
        updatedRFQ: {
          cr49f_rfqtitle: editRfqTitle,
          cr49f_submissiondeadline: editRfqDeadline ? new Date(editRfqDeadline).toISOString() : undefined,
          cr49f_deliverylocation: editRfqLocation,
          cr49f_description: editRfqDescription,
          purchaseRequestId: selectedPrId || undefined,
        },
        selectedSupplierIds,
      });

      setNotice("Revisions submitted successfully! RFQ updated and workflow restarted from Sequence #1. Opening dashboard...");
      await onRefresh();
      setTimeout(() => {
        navigate("/");
      }, 800);
    } catch (err: unknown) {
      console.error("Failed to submit RFQ revisions:", err);
      const msg = err instanceof Error ? err.message : "Failed to submit revisions";
      setNotice(`Failed to submit revisions: ${msg}`);
    } finally {
      setSubmittingChanges(false);
    }
  };

  const recordTitle = isRfq
    ? parentRFQ?.cr49f_rfqtitle || "Request for Quotation"
    : isPr
    ? parentPR?.cr49f_prtitle || "Purchase Request"
    : task.cr49f_task || "Approval Task";

  const requesterName = isRfq
    ? parentRFQ?.createdbyname || "Neha Sharma"
    : isPr
    ? parentPR?.createdbyname || "Sakshi Paliwal"
    : "Business User";

  const deptLabel = task.cr49f_department
    ? (Cr49f_approvaltasksescr49f_department[task.cr49f_department] || "IT")
    : "Information Technology";

  const roleLabel = task.cr49f_role
    ? (Cr49f_approvaltasksescr49f_role[task.cr49f_role] || "Procurement Approver")
    : "Procurement Approver";

  const slaUnitLabel = task.cr49f_slaunit
    ? (Cr49f_approvaltasksescr49f_slaunit[task.cr49f_slaunit] || "Hours")
    : "Hours";

  const slaLabel = `${task.cr49f_slanumber ?? 24} ${slaUnitLabel}`;

  const priorityLabel = isPr
    ? parentPR?.cr49f_priority === 2
      ? "High"
      : parentPR?.cr49f_priority === 0
      ? "Low"
      : "Medium"
    : "Medium";

  // Stepper milestones from siblingTasks: sequential approval milestones only (sequence >= 1, excluding changes needed tasks)
  const displaySteps = (siblingTasks.length > 0 ? siblingTasks : [task])
    .filter((s) => {
      const sSeq = s.cr49f_sequence ?? 0;
      const sStatus = getTaskApprovalStatusLabel(s);
      const sTitle = String(s.cr49f_task || "").toLowerCase();
      return (
        sSeq >= 1 &&
        sStatus !== "Changes Needed" &&
        !sTitle.includes("changes needed")
      );
    })
    .sort((a, b) => (a.cr49f_sequence ?? 0) - (b.cr49f_sequence ?? 0));

  return (
    <section className="task-page-container">
      {/* 1. Header Navigation & Title Section */}
      <header className="task-page-header">
        <div className="task-nav-row">
          <button type="button" className="task-back-btn" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Tasks
          </button>
          <div className="task-breadcrumb-nav">
            <span>Work Queue</span>
            <span className="separator">/</span>
            {isRfq ? (
              <Link to="/rfq">{reference}</Link>
            ) : isPr && parentPR ? (
              <Link to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}>
                {reference}
              </Link>
            ) : (
              <span>{reference}</span>
            )}
            <span className="separator">/</span>
            <span>{isChangesNeeded ? "Changes Needed Revision" : `Task #${task.cr49f_sequence ?? 1}`}</span>
          </div>
        </div>

        <div className="task-header-main">
          <div className="task-title-group">
            <div className="task-badge-row">
              <span className="task-eyebrow-pill">
                <ShieldCheck size={11} />
                {isPr ? "Purchase Request Approval" : isRfq ? "RFQ Approval" : "Approval Task"}
              </span>
              {!isChangesNeeded && displaySteps.length > 0 && (
                <span className="task-seq-pill">
                  Step {task.cr49f_sequence ?? 1} of {displaySteps.length}
                </span>
              )}
              <span className={`task-status-pill ${isApproved ? "approved" : isRejected ? "rejected" : isChangesNeeded ? "changes-needed" : isActive ? "active" : "pending"}`}>
                <span className="dot" />
                {isApproved
                  ? "Approved"
                  : isRejected
                  ? "Rejected"
                  : isChangesNeeded
                  ? (isActive ? "Changes Needed (Action Required)" : "Changes Submitted")
                  : isActive
                  ? "Action Required"
                  : "Inactive (Waiting in Sequence)"}
              </span>
            </div>

            <h1>{task.cr49f_task || "Approval Task"}</h1>

            <div className="task-subtitle-row">
              <span>Related to <strong>{reference}</strong>: {recordTitle}</span>
              {isRfq ? (
                <Link to="/rfq">
                  Open Full RFQ Summary <ExternalLink size={12} />
                </Link>
              ) : isPr && parentPR ? (
                <Link to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}>
                  Open Full PR Summary <ExternalLink size={12} />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="task-header-right-actions">
            <div className="task-sla-badge-box">
              <Clock size={16} className="task-sla-icon" />
              <div>
                <span className="task-sla-label">Turnaround SLA</span>
                <strong className="task-sla-value">{slaLabel}</strong>
              </div>
            </div>


          </div>
        </div>
      </header>

      {/* Feedback Notice */}
      {notice && (
        <div
          style={{
            margin: "0 0 20px",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            background: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "#fee2e2"
              : "#f0fdf4",
            color: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "#991b1b"
              : "#166534",
            border: notice.toLowerCase().includes("fail") || notice.toLowerCase().includes("error")
              ? "1px solid #fecaca"
              : "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Changes Needed Alert Banner */}
      {isRecordChangesNeeded && (
        <div className="task-changes-alert-banner">
          <div className="task-changes-alert-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="task-changes-alert-text">
            <h4>{isPr ? "Purchase Request" : isRfq ? "RFQ" : "Record"} Status: Changes Needed</h4>
            <p>{changesReason}</p>
          </div>
        </div>
      )}

      {isChangesNeeded && !isActive && (
        <div className="task-changes-completed-banner">
          <div className="task-changes-completed-icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="task-changes-completed-text">
            <h4>Revisions Completed &amp; Resubmitted</h4>
            <p>
              The requested revisions were submitted. This revision task is completed and the sequential approval workflow has restarted from Sequence #1.
            </p>
          </div>
        </div>
      )}

      {/* 3. Sequential Approval Cycle Stepper Card - Hidden on Changes Needed task */}
      {!isChangesNeeded && displaySteps.length > 0 && (
        <section className="task-workflow-card">
          <div className="task-card-header">
            <div className="task-card-header-left">
              <div className="task-card-header-icon green">
                <ShieldCheck size={16} />
              </div>
              <div className="task-card-header-titles">
                <h2>Approval Workflow Sequence</h2>
                <p>Step {task.cr49f_sequence ?? 1} of {displaySteps.length} configured in approval cycle</p>
              </div>
            </div>
            <span
              className={`task-step-badge ${isApproved ? "approved" : isRejected ? "rejected" : isActive ? "active" : "pending"}`}
              style={{ fontSize: 11, padding: "3px 10px" }}
            >
              {isApproved ? "Approved" : isRejected ? "Rejected" : isActive ? "Current Action Step" : "Waiting in Sequence"}
            </span>
          </div>

          <div className="task-workflow-stepper">
            {displaySteps.map((stepItem, index) => {
              const stepStatus = getTaskApprovalStatusLabel(stepItem);
              const stepApproved = stepStatus === "Approved";
              const stepRejected = stepStatus === "Rejected";
              const stepActive = stepItem.statecode === 0 && stepStatus === "Pending";
              const isCurrentViewed = cleanGuid(stepItem.cr49f_approvaltasksid) === cleanTaskId;

              const stepRole = stepItem.cr49f_role
                ? (Cr49f_approvaltasksescr49f_role[stepItem.cr49f_role] || "Approver")
                : "Approver";
              const stepDept = stepItem.cr49f_department
                ? (Cr49f_approvaltasksescr49f_department[stepItem.cr49f_department] || "IT")
                : "IT";

              return (
                <button
                  type="button"
                  className={`task-step-item ${
                    stepApproved
                      ? "is-approved"
                      : stepRejected
                      ? "is-rejected"
                      : stepActive
                      ? "is-current-active"
                      : ""
                  } ${isCurrentViewed ? "is-current" : ""}`}
                  key={stepItem.cr49f_approvaltasksid || index}
                  onClick={() => {
                    if (stepItem.cr49f_approvaltasksid && !isCurrentViewed) {
                      navigate(`/tasks/${stepItem.cr49f_approvaltasksid}`);
                    }
                  }}
                  title={`Click to view Task #${stepItem.cr49f_sequence || index + 1}`}
                >
                  <div className={`task-step-connector ${stepApproved ? "done" : ""}`} />
                  <div className="task-step-node">
                    {stepApproved ? (
                      <Check size={14} />
                    ) : stepRejected ? (
                      <XCircle size={14} />
                    ) : (
                      stepItem.cr49f_sequence || index + 1
                    )}
                  </div>

                  <div className="task-step-details">
                    <span className="task-step-title">{stepItem.cr49f_task || `Task #${index + 1}`}</span>
                    <span className="task-step-meta">{stepRole} · {stepDept}</span>
                    <span
                      className={`task-step-badge ${
                        stepApproved
                          ? "approved"
                          : stepRejected
                          ? "rejected"
                          : stepActive
                          ? "active"
                          : "pending"
                      }`}
                    >
                      {stepApproved
                        ? "Approved"
                        : stepRejected
                        ? "Rejected"
                        : stepActive
                        ? "Action Needed"
                        : "Pending"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Two-Column Dashboard Layout */}
      <div className="task-grid-layout">
        {/* Left Column (Primary Request Details, Items, and Comments) */}
        <div className="task-main-col">
          {isChangesNeeded && isRecordActive ? (
            isRfq ? (
              /* Interactive RFQ Revision Form */
              <form onSubmit={handleSubmitRfqChangesRevision} className="task-card task-changes-form-card">
                <div className="task-card-header">
                  <div className="task-card-header-left">
                    <div className="task-card-header-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706" }}>
                      <FileEdit size={16} />
                    </div>
                    <div className="task-card-header-titles">
                      <h2>Update Request for Quotation (RFQ) Information</h2>
                      <p>Revise RFQ specifications, submission deadline, and requirements to resolve approver feedback</p>
                    </div>
                  </div>
                </div>

                <div className="task-changes-form-body">
                  <div className="task-changes-form-row">
                    <div className="task-changes-field">
                      <label>RFQ Title</label>
                      <input
                        type="text"
                        value={editRfqTitle}
                        onChange={(e) => setEditRfqTitle(e.target.value)}
                        required
                        className="task-input"
                        placeholder="e.g. IT Equipment and Hardware RFQ"
                      />
                    </div>
                    <div className="task-changes-field">
                      <label>Submission Deadline</label>
                      <input
                        type="date"
                        value={editRfqDeadline}
                        onChange={(e) => setEditRfqDeadline(e.target.value)}
                        required
                        className="task-input"
                      />
                    </div>
                  </div>

                  <div className="task-changes-form-row">
                    <div className="task-changes-field">
                      <label>Delivery / Site Location</label>
                      <input
                        type="text"
                        value={editRfqLocation}
                        onChange={(e) => setEditRfqLocation(e.target.value)}
                        className="task-input"
                        placeholder="e.g. Headquarters - Floor 3"
                      />
                    </div>
                    <div className="task-changes-field">
                      <label>Originating Purchase Request</label>
                      <select
                        value={selectedPrId}
                        onChange={(e) => {
                          const chosenPrId = e.target.value;
                          setSelectedPrId(chosenPrId);
                          const chosenPR = approvedPrs.find(
                            (p) => cleanGuid(p.cr49f_purchaserequestid) === chosenPrId
                          );
                          if (chosenPR?.cr49f_deliverylocation) {
                            setEditRfqLocation(chosenPR.cr49f_deliverylocation);
                          }
                        }}
                        className="task-select"
                      >
                        <option value="">-- Direct RFQ / No Linked PR --</option>
                        {approvedPrs.map((pr) => {
                          const prId = cleanGuid(pr.cr49f_purchaserequestid);
                          const label = `${pr.cr49f_prnumber || "PR"} - ${pr.cr49f_prtitle || "Purchase Request"}`;
                          return (
                            <option key={prId} value={prId}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="task-changes-field">
                    <label>Scope of Work, Requirements &amp; Description</label>
                    <textarea
                      rows={3}
                      value={editRfqDescription}
                      onChange={(e) => setEditRfqDescription(e.target.value)}
                      className="task-textarea"
                      placeholder="Explain the revised scope of work, technical requirements, or bidding rules..."
                    />
                  </div>

                  {/* Supplier Selection Section */}
                  <div className="task-suppliers-section">
                    <div className="task-suppliers-header">
                      <div>
                        <h3><Building2 size={16} /> Invited Suppliers &amp; Quotation Participants</h3>
                        <p>Select suppliers who will be invited to review and submit quotations for this RFQ</p>
                      </div>
                      <span className="task-selected-badge">
                        {selectedSupplierIds.length} {selectedSupplierIds.length === 1 ? "supplier" : "suppliers"} selected
                      </span>
                    </div>

                    {/* Selected Supplier Chips */}
                    {selectedSupplierIds.length > 0 && (
                      <div className="task-supplier-chips-wrap">
                        {selectedSupplierIds.map((supId) => {
                          const sup = availableSuppliers.find((s) => s.cr49f_supplierid === supId);
                          return (
                            <span key={supId} className="task-supplier-chip">
                              <strong>{sup?.cr49f_supplierid1 || "SUP"}</strong>
                              <span>{sup?.cr49f_name || "Supplier"}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleSupplier(supId)}
                                title="Remove supplier"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Supplier Filter Toolbar */}
                    <div className="task-suppliers-toolbar">
                      <div className="task-suppliers-search-wrap">
                        <Search size={14} />
                        <input
                          type="text"
                          value={supplierSearchQuery}
                          onChange={(e) => setSupplierSearchQuery(e.target.value)}
                          placeholder="Search suppliers by name, code, contact..."
                          className="task-suppliers-search-input"
                        />
                      </div>
                      <select
                        value={supplierCategoryFilter}
                        onChange={(e) => setSupplierCategoryFilter(e.target.value)}
                        className="task-select"
                        style={{ width: "auto", minWidth: 140, padding: "7px 10px", fontSize: 12 }}
                      >
                        {supplierCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === "ALL" ? "All Categories" : cat}
                          </option>
                        ))}
                      </select>
                      <div className="task-suppliers-actions">
                        <button
                          type="button"
                          onClick={handleSelectAllVisibleSuppliers}
                          className="task-btn-action-secondary"
                          style={{ padding: "5px 10px", fontSize: 11.5 }}
                        >
                          <CheckSquare size={13} /> Select All
                        </button>
                        {selectedSupplierIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearSupplierSelection}
                            className="task-btn-action-secondary"
                            style={{ padding: "5px 10px", fontSize: 11.5, color: "#ef4444" }}
                          >
                            <X size={13} /> Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Supplier Cards Grid */}
                    <div className="task-suppliers-grid">
                      {filteredSuppliers.length > 0 ? (
                        filteredSuppliers.map((sup) => {
                          const isSelected = selectedSupplierIds.includes(sup.cr49f_supplierid);
                          return (
                            <div
                              key={sup.cr49f_supplierid}
                              className={`task-supplier-card ${isSelected ? "selected" : ""}`}
                              onClick={() => handleToggleSupplier(sup.cr49f_supplierid)}
                            >
                              <div className="task-supplier-card-top">
                                <div className="task-supplier-card-top-left">
                                  {isSelected ? (
                                    <CheckSquare size={16} className="task-supplier-check-icon" />
                                  ) : (
                                    <Square size={16} style={{ color: "#94a3b8" }} />
                                  )}
                                  <span className="task-supplier-card-name" title={sup.cr49f_name || ""}>
                                    {sup.cr49f_name || "Supplier"}
                                  </span>
                                </div>
                                <span className="task-supplier-card-code">
                                  {sup.cr49f_supplierid1 || "SUP"}
                                </span>
                              </div>
                              <div className="task-supplier-card-details">
                                <span>{sup.cr49f_suppliercategory || "Vendor"}</span>
                                <span>{sup.cr49f_city || sup.cr49f_country || "Active"}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px", color: "#64748b", fontSize: 13 }}>
                          No suppliers found matching "{supplierSearchQuery}".
                        </div>
                      )}
                    </div>
                  </div>

                  {lineItems && lineItems.length > 0 && (
                    <div className="task-changes-lines-section">
                      <div className="task-changes-lines-header">
                        <div>
                          <h3>Originating PR Line Items</h3>
                          <p>Scope items referenced in this RFQ</p>
                        </div>
                        <span className="task-lines-total-badge">{lineItems.length} items</span>
                      </div>
                      <div className="task-table-scroll">
                        <table className="task-modern-table">
                          <thead>
                            <tr>
                              <th style={{ width: 44 }}>#</th>
                              <th>Item Name</th>
                              <th>Specification / Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item, idx) => (
                              <tr key={item.cr49f_purchaserequestlineid || idx}>
                                <td><strong>{idx + 1}</strong></td>
                                <td><strong>{item.cr49f_itemname || `Item #${idx + 1}`}</strong></td>
                                <td style={{ color: "var(--muted-foreground-hex, #64748b)" }}>
                                  {item.cr49f_itemdescription || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="task-changes-field" style={{ marginTop: 18 }}>
                    <label>Requester Revision Notes (What changes did you apply?)</label>
                    <textarea
                      rows={2}
                      value={requesterRemarks}
                      onChange={(e) => setRequesterRemarks(e.target.value)}
                      placeholder="e.g. Adjusted submission deadline and updated scope description per approver feedback."
                      className="task-textarea"
                    />
                  </div>

                  <div className="task-changes-form-actions">
                    <button
                      type="submit"
                      className="task-btn-submit-changes"
                      disabled={submittingChanges}
                    >
                      {submittingChanges ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      Submit Updated RFQ &amp; Restart Approval Workflow
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* Interactive PR Revision Form */
              <form onSubmit={handleSubmitChangesRevision} className="task-card task-changes-form-card">
              <div className="task-card-header">
                <div className="task-card-header-left">
                  <div className="task-card-header-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706" }}>
                    <FileEdit size={16} />
                  </div>
                  <div className="task-card-header-titles">
                    <h2>Update Purchase Request Information</h2>
                    <p>Revise PR specifications and line item quantities/pricing to resolve approver feedback</p>
                  </div>
                </div>
              </div>

              <div className="task-changes-form-body">
                <div className="task-changes-form-row">
                  <div className="task-changes-field">
                    <label>Purchase Request Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      className="task-input"
                      placeholder="e.g. IT Equipment and Office Laptops"
                    />
                  </div>
                  <div className="task-changes-field">
                    <label>Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(Number(e.target.value))}
                      className="task-select"
                    >
                      <option value={0}>Low</option>
                      <option value={1}>Medium</option>
                      <option value={2}>Normal</option>
                      <option value={3}>High</option>
                      <option value={4}>Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="task-changes-form-row">
                  <div className="task-changes-field">
                    <label>Delivery Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="task-input"
                      placeholder="e.g. Headquarters - Floor 3"
                    />
                  </div>
                  <div className="task-changes-field">
                    <label>Required Delivery Date</label>
                    <input
                      type="date"
                      value={editDeliveryDate}
                      onChange={(e) => setEditDeliveryDate(e.target.value)}
                      className="task-input"
                    />
                  </div>
                </div>

                <div className="task-changes-field">
                  <label>Business Need &amp; Justification</label>
                  <textarea
                    rows={3}
                    value={editJustification}
                    onChange={(e) => setEditJustification(e.target.value)}
                    className="task-textarea"
                    placeholder="Explain the business need or reason for the requested changes..."
                  />
                </div>

                {/* Editable Line Items Section */}
                <div className="task-changes-lines-section">
                  <div className="task-changes-lines-header">
                    <div>
                      <h3>Requested Products &amp; Line Items</h3>
                      <p>Adjust item specifications, quantities, or add more products</p>
                    </div>
                    <div className="task-lines-actions">
                      <span className="task-lines-total-badge">
                        {editableLines.length} {editableLines.length === 1 ? "Item" : "Items"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCatalogModalOpen(true)}
                        className="task-btn-action-primary"
                      >
                        <Package size={14} /> Add Product from Catalog
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomLine}
                        className="task-btn-action-secondary"
                      >
                        <Plus size={14} /> Custom Item
                      </button>
                    </div>
                  </div>

                  <div className="task-table-scroll">
                    <table className="task-modern-table editable-lines-table">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>#</th>
                          <th style={{ width: 220 }}>Product Name</th>
                          <th>Specification / Description</th>
                          <th style={{ width: 110 }}>Quantity</th>
                          <th style={{ width: 50, textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableLines.length > 0 ? (
                          editableLines.map((line, idx) => (
                            <tr key={line.cr49f_purchaserequestlineid || idx}>
                              <td><strong>{idx + 1}</strong></td>
                              <td>
                                <input
                                  type="text"
                                  value={line.cr49f_itemname || ""}
                                  onChange={(e) => {
                                    const updated = [...editableLines];
                                    updated[idx] = { ...updated[idx], cr49f_itemname: e.target.value };
                                    setEditableLines(updated);
                                  }}
                                  className="task-input-sm"
                                  placeholder="Product name"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={line.cr49f_itemdescription || ""}
                                  onChange={(e) => {
                                    const updated = [...editableLines];
                                    updated[idx] = { ...updated[idx], cr49f_itemdescription: e.target.value };
                                    setEditableLines(updated);
                                  }}
                                  className="task-input-sm"
                                  placeholder="Specification / description"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  value={line.cr49f_quantity ?? 1}
                                  onChange={(e) => {
                                    const updated = [...editableLines];
                                    updated[idx] = { ...updated[idx], cr49f_quantity: Number(e.target.value) };
                                    setEditableLines(updated);
                                  }}
                                  className="task-input-sm"
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="task-line-delete-btn"
                                  title="Remove this item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--muted-foreground-hex, #64748b)" }}>
                              No products recorded on this PR. Click <strong>"Add Product from Catalog"</strong> or <strong>"Custom Item"</strong> above to add items.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="task-changes-field" style={{ marginTop: 18 }}>
                  <label>Requester Revision Notes (What changes did you apply?)</label>
                  <textarea
                    rows={2}
                    value={requesterRemarks}
                    onChange={(e) => setRequesterRemarks(e.target.value)}
                    placeholder="e.g. Adjusted quantities and updated delivery schedule per approver feedback."
                    className="task-textarea"
                  />
                </div>

                <div className="task-changes-form-actions">
                  <button
                    type="submit"
                    className="task-btn-submit-changes"
                    disabled={submittingChanges}
                  >
                    {submittingChanges ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                    Submit Updated PR &amp; Restart Approval Workflow
                  </button>
                </div>
              </div>
            </form>
          )) : (
            <>
              {/* Request Information Metrics Card */}
              <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <FileText size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Request Overview</h2>
                  <p>Procurement request details and specifications</p>
                </div>
              </div>
            </div>

            <div className="task-metrics-grid">
              <div className="task-metric-tile highlight">
                <div className="task-metric-icon violet">
                  <Flag size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">Priority Tier</span>
                  <strong className="task-metric-value large">{priorityLabel}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon blue">
                  <UserRound size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">Requester</span>
                  <strong className="task-metric-value">{requesterName}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon purple">
                  <List size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">{shortType} Reference</span>
                  <strong className="task-metric-value">{reference}</strong>
                </div>
              </div>

              <div className="task-metric-tile">
                <div className="task-metric-icon green">
                  <CalendarDays size={17} />
                </div>
                <div className="task-metric-info">
                  <span className="task-metric-label">
                    {isRfq ? "Submission Deadline" : "Required Delivery"}
                  </span>
                  <strong className="task-metric-value">
                    {isRfq
                      ? toUsDate(parentRFQ?.cr49f_submissiondeadline)
                      : toUsDate(parentPR?.cr49f_requireddeliverydate)}
                  </strong>
                </div>
              </div>
            </div>

            {parentPR?.cr49f_businessjustification && (
              <div className="task-justification-box">
                <div className="task-justification-title">
                  <Tag size={12} />
                  Business Need &amp; Justification
                </div>
                <p>{parentPR.cr49f_businessjustification}</p>
              </div>
            )}
          </section>

          {/* Line Items Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <List size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Requested Line Items</h2>
                  <p>Itemized equipment and service specifications</p>
                </div>
              </div>
              <span className="task-seq-pill">
                {lineItems.length > 0 ? `${lineItems.length} line items` : "1 item recorded"}
              </span>
            </div>

            <div className="task-table-scroll">
              <table className="task-modern-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Item Name</th>
                    <th>Specification / Description</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? (
                    lineItems.map((item, index) => {
                      return (
                        <tr key={item.cr49f_purchaserequestlineid || index}>
                          <td><strong>{index + 1}</strong></td>
                          <td>
                            <strong style={{ color: "var(--foreground-hex, #0f172a)" }}>
                              {item.cr49f_itemname || `Item #${index + 1}`}
                            </strong>
                          </td>
                          <td style={{ color: "var(--muted-foreground-hex, #64748b)" }}>
                            {item.cr49f_itemdescription || "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td>1</td>
                      <td><strong>{recordTitle}</strong></td>
                      <td>Procurement equipment / services</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="task-table-footer">
              <span>Showing all requested items</span>
              <span>
                Total Items: <strong>{lineItems.length > 0 ? lineItems.length : 1}</strong>
              </span>
            </div>
          </section>
        </>
      )}

          {/* Comments & Remarks Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon">
                  <ClipboardList size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Task Comments &amp; Notes</h2>
                  <p>Audit trail of approver remarks and internal communications</p>
                </div>
              </div>
              <span className="task-seq-pill">
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </span>
            </div>

            <div className="task-comments-container">
              {comments.length > 0 ? (
                <div className="task-comments-feed">
                  {comments.map((comment) => (
                    <div className="task-comment-item" key={comment.id}>
                      <div className="task-comment-avatar">
                        {comment.author.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="task-comment-bubble">
                        <div className="task-comment-bubble-header">
                          <span className="task-comment-author">{comment.author}</span>
                          <span className="task-comment-time">{comment.timestamp}</span>
                        </div>
                        <p className="task-comment-text">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="task-empty-comments">
                  No comments yet. Leave an approval remark or note below.
                </div>
              )}

              <form className="task-comment-composer" onSubmit={addComment}>
                <input
                  className="task-comment-input"
                  aria-label="Add remark"
                  placeholder="Type an approver note, comment, or remark..."
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <button type="submit" className="task-comment-submit-btn">
                  <Send size={14} /> Send
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Right Column (Task Assignment & Record Context) */}
        <div className="task-side-col">
          {/* Task Assignment Card */}
          <section className="task-card">
            <div className="task-card-header">
              <div className="task-card-header-left">
                <div className="task-card-header-icon green">
                  <ShieldCheck size={16} />
                </div>
                <div className="task-card-header-titles">
                  <h2>Task Assignment</h2>
                  <p>Workflow routing &amp; SLA</p>
                </div>
              </div>
            </div>

            <div className="task-profile-body">
              <div className="task-profile-hero">
                <div className="task-profile-avatar assignee">
                  {roleLabel.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="task-profile-name">{roleLabel}</h3>
                  <p className="task-profile-role">{deptLabel} Department</p>
                </div>
              </div>

              <div className="task-info-list">
                <div className="task-info-row">
                  <span className="label">Sequence Position</span>
                  <strong className="value">
                    {isChangesNeeded ? "Changes Required Revision" : `Step #${task.cr49f_sequence ?? 1} in Workflow`}
                  </strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Target SLA</span>
                  <strong className="value">{slaLabel}</strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Workflow State</span>
                  <strong className="value">
                    {task.statecode === 0 ? "Active (In Progress)" : "Inactive (Waiting in sequence)"}
                  </strong>
                </div>
                <div className="task-info-row">
                  <span className="label">Decision Status</span>
                  <strong
                    className="value"
                    style={{ color: isApproved ? "#16a34a" : isRejected ? "#dc2626" : "#2563eb" }}
                  >
                    {approvalStatus}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Related RFQ Record Context */}
          {parentRFQ && (
            <section className="task-card">
              <div className="task-card-header">
                <div className="task-card-header-left">
                  <div className="task-card-header-icon blue">
                    <FileText size={16} />
                  </div>
                  <div className="task-card-header-titles">
                    <h2>Record Context</h2>
                    <p>Request for Quotation details</p>
                  </div>
                </div>
              </div>

              <div className="task-profile-body">
                <div className="task-info-list">
                  <div className="task-info-row">
                    <span className="label">RFQ Number</span>
                    <strong className="value">{reference}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Department</span>
                    <strong className="value">{deptLabel}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Submission Deadline</span>
                    <strong className="value">{toUsDate(parentRFQ.cr49f_submissiondeadline)}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Delivery Location</span>
                    <strong className="value">{parentRFQ.cr49f_deliverylocation || "Main Site"}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Link to="/rfq" className="task-link-button">
                    <span>View Full RFQ Summary</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Related PR Record Context */}
          {parentPR && !parentRFQ && (
            <section className="task-card">
              <div className="task-card-header">
                <div className="task-card-header-left">
                  <div className="task-card-header-icon blue">
                    <FileText size={16} />
                  </div>
                  <div className="task-card-header-titles">
                    <h2>Record Context</h2>
                    <p>Purchase request details</p>
                  </div>
                </div>
              </div>

              <div className="task-profile-body">
                <div className="task-info-list">
                  <div className="task-info-row">
                    <span className="label">PR Number</span>
                    <strong className="value">{reference}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Department</span>
                    <strong className="value">{deptLabel}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Delivery Location</span>
                    <strong className="value">{parentPR.cr49f_deliverylocation || "Main Office"}</strong>
                  </div>
                  <div className="task-info-row">
                    <span className="label">Priority</span>
                    <strong className="value">{priorityLabel}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Link
                    to={`/purchase-requests/${parentPR.cr49f_prnumber || parentPR.cr49f_purchaserequestid}`}
                    className="task-link-button"
                  >
                    <span>View Full PR Summary</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 5. Sticky Action Footer Bar */}
      <footer className="task-sticky-bar">
        <div className="task-sticky-left">
          <button type="button" className="task-btn-close" onClick={onBack}>
            ← Back
          </button>
          <span style={{ fontSize: 13, color: "var(--foreground-hex, #0f172a)", fontWeight: 600 }}>
            {task.cr49f_task} ({reference})
          </span>
        </div>

        <div className="task-sticky-actions">
          {isApproved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill approved">
                <CheckCircle2 size={13} /> Task Approved
              </span>
            </div>
          ) : isRejected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill rejected">
                <XCircle size={13} /> Task Rejected
              </span>
            </div>
          ) : isChangesNeeded ? (
            isRecordActive ? (
              <button
                type="button"
                className="task-btn-submit-changes"
                onClick={() =>
                  void (isRfq
                    ? handleSubmitRfqChangesRevision()
                    : handleSubmitChangesRevision())
                }
                disabled={submittingChanges}
              >
                {submittingChanges ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Submit Updated {shortType} &amp; Restart Approval
              </button>
            ) : (
              <span className="task-status-pill approved">
                <CheckCircle2 size={13} /> Revisions Submitted · Sequence #1 Restarted
              </span>
            )
          ) : !isActive ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="task-status-pill pending">
                ⏳ Inactive · Waiting for prior sequential task approval
              </span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="task-btn-reject"
                onClick={() => void handleReject()}
                disabled={actionLoading}
              >
                <ThumbsDown size={14} /> Reject
              </button>

              <button
                type="button"
                className="task-btn-changes-needed"
                onClick={() => setIsChangesNeededModalOpen(true)}
                disabled={actionLoading}
              >
                <FileEdit size={14} /> Changes Needed
              </button>

              <button
                type="button"
                className="task-btn-approve"
                onClick={() => void handleApprove()}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                Approve Task
              </button>
            </>
          )}
        </div>
      </footer>

      {/* Changes Needed Approver Modal */}
      {isChangesNeededModalOpen && (
        <div className="task-modal-backdrop" onClick={() => !actionLoading && setIsChangesNeededModalOpen(false)}>
          <div className="task-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="task-modal-header">
              <div className="task-modal-header-icon">
                <FileEdit size={18} />
              </div>
              <div>
                <h3>Request Changes on {shortType}</h3>
                <p>Specify the modifications required before this {shortType} can be approved.</p>
              </div>
            </div>

            <div className="task-modal-body">
              <div className="task-modal-description">
                <strong>Action Summary:</strong>
                <p style={{ margin: "4px 0 0", color: "#475569" }}>
                  This will update the {objectTypeLabel} ({reference}) status to <strong>Changes Needed</strong> in Dataverse. All existing approval tasks will be marked Inactive with Pending approval status, and a new <strong>Changes Needed</strong> task will be created for the requester to make modifications.
                </p>
              </div>

              <label className="task-modal-label">Approver Feedback / Required Changes:</label>
              <textarea
                className="task-modal-textarea"
                rows={4}
                value={changesFeedbackText}
                onChange={(e) => setChangesFeedbackText(e.target.value)}
                placeholder={`Describe what adjustments, quantity updates, or specification changes are needed on this ${shortType}...`}
                autoFocus
              />
            </div>

            <div className="task-modal-actions">
              <button
                type="button"
                className="task-modal-btn-cancel"
                onClick={() => setIsChangesNeededModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="task-modal-btn-confirm"
                onClick={() => void handleRequestChanges()}
                disabled={actionLoading || !changesFeedbackText.trim()}
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Request Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Catalog Modal for Adding Products to PR */}
      {isCatalogModalOpen && (
        <div className="task-modal-backdrop" onClick={() => setIsCatalogModalOpen(false)}>
          <div className="task-modal-content task-catalog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-modal-header">
              <div className="task-modal-header-icon" style={{ background: "rgba(37, 99, 235, 0.12)", color: "var(--primary-hex, #2563eb)" }}>
                <Package size={18} />
              </div>
              <div>
                <h3>Add Product from Catalog</h3>
                <p>Browse available products in Dataverse and add them directly to this PR</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="task-modal-body" style={{ padding: "16px 20px" }}>
              <div className="task-catalog-search-row">
                <div className="task-catalog-search-wrap">
                  <Search size={15} />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search products by name, code, description..."
                    className="task-catalog-search-input"
                    autoFocus
                  />
                </div>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="task-select"
                  style={{ width: "auto", minWidth: 150 }}
                >
                  {catalogCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "ALL" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-catalog-grid">
                {filteredCatalogProducts.length > 0 ? (
                  filteredCatalogProducts.map((p) => {
                    const alreadyAddedCount = editableLines.filter(
                      (l) => l.cr49f_itemname?.toLowerCase() === p.cr49f_productname?.toLowerCase()
                    ).length;

                    return (
                      <div key={p.cr49f_productsid} className="task-catalog-card">
                        <div>
                          <div className="task-catalog-card-header">
                            <h4>{p.cr49f_productname}</h4>
                            {p.cr49f_category && (
                              <span className="task-catalog-cat-badge">{p.cr49f_category}</span>
                            )}
                          </div>
                          <p>{p.cr49f_productdescription || "No description provided."}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ fontSize: 11.5, color: "#64748b" }}>
                            {alreadyAddedCount > 0 ? `${alreadyAddedCount} added` : p.cr49f_productnumber || ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddProductFromCatalog(p)}
                            className="task-catalog-add-btn"
                          >
                            <Plus size={13} /> Add to PR
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No products found matching "{catalogSearch}".
                  </div>
                )}
              </div>
            </div>

            <div className="task-modal-actions">
              <button
                type="button"
                className="task-modal-btn-confirm"
                onClick={() => setIsCatalogModalOpen(false)}
                style={{ background: "var(--primary-hex, #2563eb)" }}
              >
                Done Adding Products ({editableLines.length} Total Items)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// Legacy Mock Task Components for Fallback
// -------------------------------------------------------------

function RfqApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("In Review");
  const [assignee, setAssignee] = useState(task.id === 5 ? "Rushi Pardeshi" : "Aman Jain");
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/RFQ-\d{4}-\d{3}/)?.[0] ?? "RFQ-2025-019";
  const isTestingRfq = reference.endsWith("019");
  const rfqTitle = isTestingRfq ? "testing" : "Office supplies quotation";

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`RFQ ${reference} marked ${nextStatus.toLowerCase()}.`);
    if (nextStatus === "Approved") {
      setTimeout(() => {
        navigate("/");
      }, 700);
    }
  };

  const reassign = () => {
    setAssignee((current) => current === "Rushi Pardeshi" ? "Aman Jain" : "Rushi Pardeshi");
    setNotice("Task reassigned.");
  };

  return (
    <section className="task-page-container">
      <header className="task-page-header">
        <button type="button" className="task-back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Tasks
        </button>
        <div style={{ marginTop: 12 }}>
          <h1>REQUEST FOR QUOTATION APPROVAL FOR {reference} | {rfqTitle.toUpperCase()}</h1>
          <span className={`task-status-pill ${status === "Approved" ? "approved" : "active"}`}>{status}</span>
        </div>
      </header>

      <div className="task-card" style={{ padding: 20 }}>
        <p style={{ margin: 0, color: "var(--muted-foreground-hex, #64748b)" }}>Sample RFQ Approval for demonstration.</p>
        {notice && <p style={{ color: "var(--primary-hex, #2563eb)", marginTop: 8 }}>{notice}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="task-btn-reject" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="task-btn-approve" onClick={() => updateStatus("Approved")}>Approve</button>
          <button type="button" className="task-btn-close" onClick={reassign}>Reassign ({assignee})</button>
        </div>
      </div>
    </section>
  );
}

function OtherApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("In Review");
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/(?:INV|PR|PO)-\d{4}-\d{3}/)?.[0] ?? "PR-2026";

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`${reference} marked ${nextStatus.toLowerCase()}.`);
    if (nextStatus === "Approved") {
      setTimeout(() => {
        navigate("/");
      }, 700);
    }
  };

  return (
    <section className="task-page-container">
      <header className="task-page-header">
        <button type="button" className="task-back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Tasks
        </button>
        <div style={{ marginTop: 12 }}>
          <h1>{task.taskName}</h1>
          <span className={`task-status-pill ${status === "Approved" ? "approved" : "active"}`}>{status}</span>
        </div>
      </header>

      <div className="task-card" style={{ padding: 20 }}>
        <p style={{ margin: 0, color: "var(--muted-foreground-hex, #64748b)" }}>{task.description || "Sample task review."}</p>
        {notice && <p style={{ color: "var(--primary-hex, #2563eb)", marginTop: 8 }}>{notice}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="task-btn-reject" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="task-btn-approve" onClick={() => updateStatus("Approved")}>Approve</button>
        </div>
      </div>
    </section>
  );
}
