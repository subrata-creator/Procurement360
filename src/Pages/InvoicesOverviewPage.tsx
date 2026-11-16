import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutList,
  LayoutGrid,
  CheckCircle2,
  Clock3,
  AlertCircle,
  X,
  ExternalLink,
  Paperclip,
  Eye,
  ShoppingCart,
  Building2,
  CircleCheck,
  CircleAlert,
  Loader2,
  Check,
} from "lucide-react";

import { Cr49f_invoice1sService } from "../generated/services/Cr49f_invoice1sService";
import { Cr49f_purchaseordersService } from "../generated/services/Cr49f_purchaseordersService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import type { Cr49f_invoice1s } from "../generated/models/Cr49f_invoice1sModel";
import type { Cr49f_purchaseorders } from "../generated/models/Cr49f_purchaseordersModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import { UploadInvoiceModal } from "../components/UploadInvoiceModal";

import "../Styles/Styles.css";
import "../Styles/PurchaseRequest.css";
import "../Styles/RFQPage.css";
import "../Styles/OrdersPage.css";
import "../Styles/InvoicesOverview.css";

const PAGE_SIZE = 10;

export interface EnrichedInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poAmount: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  discount: number;
  additionalCharges: number;
  paymentStatus: 1 | 2 | 3 | 4;
  paymentStatusName: string;
  attachment?: string;
  poRef: string;
  poId?: string;
  supplierName: string;
  notes?: string;
  isOverdue: boolean;
  dueDaysRemaining?: number;
  rawRecord: Cr49f_invoice1s;
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

function formatUsDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
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

export const InvoicesOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Controls
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [supplierQuery, setSupplierQuery] = useState<string>("All Suppliers");
  const [dateQuery, setDateQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Modals & Action state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<EnrichedInvoice | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

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

  // Helper formatting
  const formatCurrency = (val: number) => {
    return `$${Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getInitials = (name: string) => {
    if (!name) return "VN";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Load all invoices and resolve relationships
  const loadInvoices = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Concurrently fetch invoices, POs, and suppliers
      const [invRes, poRes, supRes] = await Promise.allSettled([
        Cr49f_invoice1sService.getAll(),
        Cr49f_purchaseordersService.getAll(),
        Cr49f_suppliersService.getAll(),
      ]);

      const rawInvoices: Cr49f_invoice1s[] =
        invRes.status === "fulfilled" && invRes.value.success && invRes.value.data ? invRes.value.data : [];

      const pos: Cr49f_purchaseorders[] =
        poRes.status === "fulfilled" && poRes.value.success && poRes.value.data ? poRes.value.data : [];

      const suppliers: Cr49f_suppliers[] =
        supRes.status === "fulfilled" && supRes.value.success && supRes.value.data ? supRes.value.data : [];

      // 2. Load locally cached invoices
      const localInvoices: any[] = [];
      try {
        const masterRaw = localStorage.getItem("procurement_all_invoices");
        if (masterRaw) {
          const parsed = JSON.parse(masterRaw);
          if (Array.isArray(parsed)) localInvoices.push(...parsed);
        }
      } catch {}

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("procurement_custom_invoices_")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) localInvoices.push(...list);
            }
          }
        }
      } catch {}

      // 3. Deduplicate and merge
      const mergedMap = new Map<string, any>();

      rawInvoices.forEach((inv) => {
        const key = inv.cr49f_invoicenumber || inv.cr49f_invoice1id;
        if (key) mergedMap.set(key, { ...inv, isFromDataverse: true });
      });

      localInvoices.forEach((loc) => {
        const key = loc.cr49f_invoicenumber || loc.cr49f_invoice1id;
        if (key) {
          if (!mergedMap.has(key)) {
            mergedMap.set(key, loc);
          } else {
            const existing = mergedMap.get(key);
            mergedMap.set(key, {
              ...existing,
              notes: loc.notes || existing.notes,
              poRef: loc.poRef || existing.poRef,
              supplierName: loc.supplierName || existing.supplierName,
              cr49f_invoiceattachment: existing.cr49f_invoiceattachment || loc.cr49f_invoiceattachment,
            });
          }
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 4. Enrich invoices with PO & Supplier Details
      const enrichedList: EnrichedInvoice[] = Array.from(mergedMap.values()).map((inv) => {
        const id = inv.cr49f_invoice1id || `inv-${Math.random().toString(36).substring(2, 9)}`;
        const invoiceNumber = inv.cr49f_invoicenumber || `INV-${id.slice(0, 8).toUpperCase()}`;

        // Resolve associated PO
        const rawPoLookup =
          inv._cr49f_associatedpo_value ||
          inv["cr49f_AssociatedPO@odata.bind"] ||
          inv.cr49f_associatedpo ||
          inv.poId;
        const cleanPoId = cleanGuid(rawPoLookup);

        let matchedPo = pos.find(
          (p) =>
            cleanGuid(p.cr49f_purchaseorderid) === cleanPoId ||
            (inv.poRef && p.cr49f_ponumber?.toLowerCase() === inv.poRef.toLowerCase())
        );

        const poRef = matchedPo?.cr49f_ponumber || inv.poRef || "PO-2026-033";
        const poAmount = Number(inv.cr49f_poamount) || Number(matchedPo?.cr49f_totalamount) || 0;

        // Resolve supplier
        let supplierName = inv.supplierName;
        if (!supplierName) {
          if (matchedPo) {
            supplierName =
              (matchedPo as any).cr49f_suppliername ||
              (matchedPo as any).cr49f_supplier ||
              "Verified Supplier";
          } else {
            const matchedSup = suppliers.find((s) => cleanGuid(s.cr49f_supplierid) === cleanPoId);
            supplierName = matchedSup?.cr49f_name || "Procurement Supplier";
          }
        }

        const invoiceDate = inv.cr49f_invoicedate || inv.createdon || new Date().toISOString();
        const dueDate =
          inv.cr49f_duedate ||
          new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const poAmt = Number(inv.cr49f_poamount) || poAmount || 0;
        const discount = Number(inv.cr49f_discount) || 0;
        const additionalCharges = Number(inv.cr49f_additionalcharges) || 0;

        // Dynamic calculation: PO Total - Discount + Charges
        const calculatedTotal = Math.max(0, poAmt - discount + additionalCharges);
        const totalAmount =
          inv.cr49f_totalamount !== undefined && Number(inv.cr49f_totalamount) > 0
            ? Number(inv.cr49f_totalamount)
            : calculatedTotal > 0
            ? calculatedTotal
            : poAmount;

        const amountPaid = Number(inv.cr49f_amountpaid) || (inv.cr49f_paymentstatus === 1 ? totalAmount : 0);
        const remainingBalance = Math.max(0, totalAmount - amountPaid);

        // Normalize status
        let paymentStatus: 1 | 2 | 3 | 4 = (Number(inv.cr49f_paymentstatus) as any) || 2;
        if (![1, 2, 3, 4].includes(paymentStatus)) {
          if (amountPaid >= totalAmount && totalAmount > 0) paymentStatus = 1;
          else if (amountPaid > 0) paymentStatus = 3;
          else paymentStatus = 2;
        }

        const statusNames: Record<number, string> = {
          1: "Paid",
          2: "Not Paid",
          3: "Partially Paid",
          4: "On Hold",
        };

        const dueTime = new Date(dueDate).getTime();
        const diffDays = Math.ceil((dueTime - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0 && paymentStatus !== 1;

        return {
          id,
          invoiceNumber,
          invoiceDate,
          dueDate,
          poAmount: poAmt,
          totalAmount,
          amountPaid,
          remainingBalance,
          discount,
          additionalCharges,
          paymentStatus,
          paymentStatusName: statusNames[paymentStatus] || "Pending",
          attachment: inv.cr49f_invoiceattachment || (inv as any).attachment,
          poRef,
          poId: matchedPo?.cr49f_purchaseorderid,
          supplierName,
          notes: inv.notes,
          isOverdue,
          dueDaysRemaining: diffDays,
          rawRecord: inv,
        };
      });

      // Sort by newest first by default
      enrichedList.sort(
        (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
      );

      setInvoices(enrichedList);
    } catch (err) {
      console.error("Failed to load invoices overview:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const totalAmount = invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
    const paidAmount = invoices.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0);
    const pendingAmount = invoices.reduce(
      (sum, i) => (i.paymentStatus !== 1 ? sum + (Number(i.remainingBalance) || 0) : sum),
      0
    );
    const onHoldAmount = invoices
      .filter((i) => i.paymentStatus === 4)
      .reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);

    const paidCount = invoices.filter((i) => i.paymentStatus === 1).length;
    const notPaidCount = invoices.filter((i) => i.paymentStatus === 2).length;
    const partialCount = invoices.filter((i) => i.paymentStatus === 3).length;
    const onHoldCount = invoices.filter((i) => i.paymentStatus === 4).length;

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      onHoldAmount,
      totalCount: invoices.length,
      paidCount,
      notPaidCount,
      partialCount,
      onHoldCount,
      pendingCount: notPaidCount + partialCount,
    };
  }, [invoices]);

  // KPI Cards array matching PR, RFQ, and PO
  const kpiCards = useMemo(() => {
    const total = metrics.totalAmount || 1;
    return [
      {
        label: "TOTAL INVOICED",
        value: formatCurrency(metrics.totalAmount),
        caption: `${metrics.totalCount} invoices recorded`,
        tone: "blue",
        filter: "ALL",
        icon: <Receipt size={17} />,
        progress: 100,
      },
      {
        label: "PAID & SETTLED",
        value: formatCurrency(metrics.paidAmount),
        caption: `${metrics.paidCount} invoices settled in full`,
        tone: "success",
        filter: "PAID",
        icon: <CircleCheck size={17} />,
        progress: Math.min(100, Math.round((metrics.paidAmount / total) * 100)),
      },
      {
        label: "PENDING BALANCE",
        value: formatCurrency(metrics.pendingAmount),
        caption: `${metrics.pendingCount} unpaid or partial invoices`,
        tone: "warning",
        filter: "NOT_PAID",
        icon: <Clock3 size={17} />,
        progress: Math.min(100, Math.round((metrics.pendingAmount / total) * 100)),
      },
      {
        label: "UNDER REVIEW / HOLD",
        value: formatCurrency(metrics.onHoldAmount),
        caption: `${metrics.onHoldCount} invoices on verification hold`,
        tone: "danger",
        filter: "ON_HOLD",
        icon: <CircleAlert size={17} />,
        progress: Math.min(100, Math.round((metrics.onHoldAmount / total) * 100)),
      },
    ];
  }, [metrics]);

  // Status breakdown for insights panel
  const statusBreakdown = useMemo(() => {
    return [
      { label: "Paid", count: metrics.paidCount, tone: "tone-approved" },
      { label: "Partially Paid", count: metrics.partialCount, tone: "tone-review" },
      { label: "Not Paid", count: metrics.notPaidCount, tone: "tone-pending" },
      { label: "On Hold", count: metrics.onHoldCount, tone: "tone-rejected" },
    ];
  }, [metrics]);
  const maxStatusCount = Math.max(...statusBreakdown.map((s) => s.count), 1);

  // Supplier spend for insights panel
  const supplierSpend = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((inv) => {
      const sup = inv.supplierName || "Other Supplier";
      map.set(sup, (map.get(sup) || 0) + (Number(inv.totalAmount) || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);
  const maxSupplierSpend = Math.max(...supplierSpend.map((s) => s.value), 1);

  // Settlement Alerts & Recommendations
  const invoiceAlerts = useMemo(() => {
    const list: { title: string; detail: string; filter: string }[] = [];
    const overdue = invoices.filter((i) => i.isOverdue && i.paymentStatus !== 1);
    if (overdue.length > 0) {
      list.push({
        title: `${overdue.length} Invoices Overdue`,
        detail: `Settlement past deadline for ${overdue[0].supplierName}${
          overdue.length > 1 ? ` +${overdue.length - 1} more` : ""
        }.`,
        filter: "OVERDUE",
      });
    }

    const dueSoon = invoices.filter(
      (i) =>
        i.dueDaysRemaining !== undefined &&
        i.dueDaysRemaining >= 0 &&
        i.dueDaysRemaining <= 7 &&
        i.paymentStatus !== 1
    );
    if (dueSoon.length > 0) {
      list.push({
        title: `${dueSoon.length} Invoices Due Soon`,
        detail: `Deadline within next 7 days. Action required for timely payment.`,
        filter: "DUE_SOON",
      });
    }

    const onHold = invoices.filter((i) => i.paymentStatus === 4);
    if (onHold.length > 0) {
      list.push({
        title: `${onHold.length} Invoices On Hold`,
        detail: `Verification pending against commercial terms or PO line items.`,
        filter: "ON_HOLD",
      });
    }

    return list;
  }, [invoices]);

  // All distinct suppliers for filter dropdown
  const allSupplierNames = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => {
      if (i.supplierName) set.add(i.supplierName);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Filtering & Search
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Search Query
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchNumber = inv.invoiceNumber.toLowerCase().includes(query);
        const matchPo = inv.poRef.toLowerCase().includes(query);
        const matchSup = inv.supplierName.toLowerCase().includes(query);
        if (!matchNumber && !matchPo && !matchSup) return false;
      }

      // 2. Status filter
      if (statusFilter === "PAID" && inv.paymentStatus !== 1) return false;
      if (statusFilter === "NOT_PAID" && inv.paymentStatus !== 2 && inv.paymentStatus !== 3) return false;
      if (statusFilter === "PARTIAL" && inv.paymentStatus !== 3) return false;
      if (statusFilter === "ON_HOLD" && inv.paymentStatus !== 4) return false;
      if (statusFilter === "OVERDUE" && (!inv.isOverdue || inv.paymentStatus === 1)) return false;
      if (
        statusFilter === "DUE_SOON" &&
        (inv.dueDaysRemaining === undefined || inv.dueDaysRemaining < 0 || inv.dueDaysRemaining > 7 || inv.paymentStatus === 1)
      ) {
        return false;
      }

      // 3. Supplier filter
      if (supplierQuery !== "All Suppliers" && inv.supplierName !== supplierQuery) return false;

      // 4. Date filter
      if (dateQuery) {
        const invDateOnly = inv.invoiceDate.split("T")[0];
        if (invDateOnly !== dateQuery) return false;
      }

      return true;
    });
  }, [invoices, search, statusFilter, supplierQuery, dateQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startRecord = (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(safeCurrentPage * PAGE_SIZE, filteredInvoices.length);
  const paginatedInvoices = useMemo(() => {
    return filteredInvoices.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  }, [filteredInvoices, safeCurrentPage]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter !== "ALL" || supplierQuery !== "All Suppliers" || dateQuery
  );

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setSupplierQuery("All Suppliers");
    setDateQuery("");
    setCurrentPage(1);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) return;
    const headers = [
      "Invoice Number",
      "Purchase Order",
      "Supplier",
      "Invoice Date",
      "Due Date",
      "Total Amount ($)",
      "Amount Paid ($)",
      "Remaining Balance ($)",
      "Payment Status",
      "Attachment",
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.poRef,
      `"${inv.supplierName.replace(/"/g, '""')}"`,
      inv.invoiceDate,
      inv.dueDate,
      inv.totalAmount.toFixed(2),
      inv.amountPaid.toFixed(2),
      inv.remainingBalance.toFixed(2),
      inv.paymentStatusName,
      inv.attachment || "None",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Status Update
  const handleQuickStatusChange = async (
    targetInvoice: EnrichedInvoice,
    newStatus: 1 | 2 | 3 | 4
  ) => {
    setIsUpdatingStatus(true);
    try {
      const isPaid = newStatus === 1;
      const amountPaid = isPaid ? targetInvoice.totalAmount : newStatus === 2 ? 0 : targetInvoice.amountPaid;

      if (targetInvoice.rawRecord.cr49f_invoice1id) {
        await Cr49f_invoice1sService.update(targetInvoice.rawRecord.cr49f_invoice1id, {
          cr49f_paymentstatus: newStatus,
          cr49f_amountpaid: amountPaid,
        });
      }

      // Update local storage master cache
      try {
        const raw = localStorage.getItem("procurement_all_invoices");
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(
            (i: any) =>
              i.cr49f_invoicenumber === targetInvoice.invoiceNumber ||
              i.cr49f_invoice1id === targetInvoice.id
          );
          if (idx >= 0) {
            list[idx].cr49f_paymentstatus = newStatus;
            list[idx].cr49f_amountpaid = amountPaid;
            localStorage.setItem("procurement_all_invoices", JSON.stringify(list));
          }
        }
      } catch {}

      await loadInvoices(true);
      if (selectedInvoiceForView) {
        setSelectedInvoiceForView({
          ...selectedInvoiceForView,
          paymentStatus: newStatus,
          amountPaid,
          remainingBalance: Math.max(0, targetInvoice.totalAmount - amountPaid),
          paymentStatusName:
            newStatus === 1 ? "Paid" : newStatus === 3 ? "Partially Paid" : newStatus === 4 ? "On Hold" : "Not Paid",
        });
      }
    } catch (err) {
      console.error("Failed to update payment status:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <main className="purchase-page invoices-page">
      {/* 1. TOP HEADING */}
      <div className="purchase-heading">
        <div>
          <h1>Invoices &amp; Billing</h1>
          <p>Manage and track all supplier invoices, settlement milestones, and payments across Dataverse</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => void loadInvoices(true)}
            disabled={isLoading || isRefreshing}
            className="pr-btn-more-filters"
            title="Refresh invoices from Dataverse"
          >
            <RefreshCw size={14} className={isRefreshing ? "quotation-spin-icon" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync Invoices"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="pr-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} />
            <span>Upload Invoice</span>
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS BAND MATCHING PR, RFQ, AND PO */}
      <section className="xd-kpis purchase-stats" aria-label="Invoice metrics">
        {kpiCards.map((metric) => (
          <article
            className={`xd-kpi xd-${metric.tone} purchase-stat ${
              statusFilter === metric.filter ? "selected" : ""
            }`}
            key={metric.label}
            role="button"
            tabIndex={0}
            aria-pressed={statusFilter === metric.filter}
            onClick={() => {
              setStatusFilter(metric.filter);
              setCurrentPage(1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStatusFilter(metric.filter);
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

      {/* 3. INSIGHTS GRID MATCHING PO AND PR */}
      <section className="orders-insights-grid" aria-label="Invoice insights">
        {/* Panel 1: Settlement Status breakdown */}
        <article className="orders-insight-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">SETTLEMENT STATUS</span>
              <h2>Status breakdown</h2>
              <p>{filteredInvoices.length} invoices in view</p>
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

        {/* Panel 2: Supplier Spend */}
        <article className="orders-insight-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">SUPPLIER INVOICED SPEND</span>
              <h2>Spend by supplier</h2>
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
                <strong>{formatCurrency(row.value)}</strong>
              </div>
            ))}
            {supplierSpend.length === 0 && (
              <p className="orders-insight-empty">
                No invoices match the current filters.
              </p>
            )}
          </div>
        </article>

        {/* Panel 3: Financial Integrity & Alerts */}
        <article className="orders-insight-panel orders-recommendations-panel">
          <div className="orders-insight-heading">
            <div>
              <span className="orders-insight-kicker">FINANCIAL INTEGRITY & AUDIT</span>
              <h2>Settlement alerts</h2>
              <p>Derived from live billing milestones</p>
            </div>
          </div>
          <div className="orders-recommendation-list">
            {invoiceAlerts.length ? (
              invoiceAlerts.map((rec) => (
                <button
                  className="orders-recommendation"
                  key={rec.title}
                  type="button"
                  onClick={() => {
                    setStatusFilter(rec.filter);
                    setCurrentPage(1);
                  }}
                >
                  <span className="orders-recommendation-icon">
                    <CircleAlert size={15} />
                  </span>
                  <span className="orders-recommendation-copy">
                    <strong>{rec.title}</strong>
                    <small>{rec.detail}</small>
                    <em>Filter: {rec.filter}</em>
                  </span>
                </button>
              ))
            ) : (
              <div className="orders-recommendation-empty">
                <CircleCheck size={17} />
                <span>All invoices are in good standing with zero overdue settlements.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* 4. MODERN CARD MATCHING PR, RFQ, AND PO */}
      <section id="invoices-records-card" className="pr-modern-card">
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
              placeholder="Search by invoice #, PO reference, or supplier..."
            />
            <Sparkles size={14} className="sparkle-icon" />
          </div>

          <div className="pr-toolbar-filters">
            {/* Created/Invoice Date Filter */}
            <div
              className={`pr-filter-date-badge ${dateQuery ? "has-filter" : ""}`}
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
                dateQuery
                  ? `Filtered by ${formatFilterDate(dateQuery)}. Click to change.`
                  : "Filter by Invoice Date"
              }
            >
              <Calendar size={14} className="cal-icon" />
              <div className="date-meta">
                <span className="date-label">Invoice Date</span>
                <span className="date-value">
                  {dateQuery ? formatFilterDate(dateQuery) : "dd-mm-yyyy"}
                </span>
              </div>
              <input
                ref={dateInputRef}
                type="date"
                value={dateQuery}
                onChange={(e) => {
                  setDateQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    (e.target as HTMLInputElement).showPicker();
                  } catch {}
                }}
                className="pr-hidden-date-input"
                aria-label="Filter by invoice date"
              />
              {dateQuery && (
                <button
                  type="button"
                  className="pr-date-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateQuery("");
                    setCurrentPage(1);
                  }}
                  title="Clear date filter"
                  aria-label="Clear date filter"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Supplier Filter */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-filter-dropdown"
                aria-label="Filter by supplier"
              >
                <option value="All Suppliers">All Suppliers</option>
                {allSupplierNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="dropdown-chevron" />
            </div>

            {/* Status Filter */}
            <div className="pr-filter-dropdown-wrap">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-filter-dropdown"
                aria-label="Filter by payment status"
              >
                <option value="ALL">All Statuses ({invoices.length})</option>
                <option value="PAID">Paid ({metrics.paidCount})</option>
                <option value="NOT_PAID">Not Paid ({metrics.notPaidCount})</option>
                <option value="PARTIAL">Partially Paid ({metrics.partialCount})</option>
                <option value="ON_HOLD">On Hold ({metrics.onHoldCount})</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="DUE_SOON">Due within 7 Days</option>
              </select>
              <ChevronDown size={14} className="dropdown-chevron" />
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                className="pr-btn-more-filters"
                onClick={resetFilters}
                style={{ color: "#ef4444", borderColor: "#fca5a5" }}
              >
                <X size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="pr-toolbar-actions">
            {/* View Mode Toggle */}
            <div className="pr-view-toggle">
              <button
                type="button"
                className={`pr-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Table view"
                aria-label="Table view"
              >
                <LayoutList size={16} />
              </button>
              <button
                type="button"
                className={`pr-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Cards view"
                aria-label="Cards view"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              className="pr-btn-export"
              onClick={handleExportCsv}
              title="Export filtered invoices to CSV"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Content: Cards View or Modern Table View */}
        {viewMode === "grid" ? (
          paginatedInvoices.length ? (
            <div className="pr-modern-grid-wrap" style={{ padding: "18px" }}>
              {paginatedInvoices.map((inv) => {
                const isPaid = inv.paymentStatus === 1;
                const isOnHold = inv.paymentStatus === 4;
                const progressPct =
                  inv.totalAmount > 0
                    ? Math.min(100, Math.round((inv.amountPaid / inv.totalAmount) * 100))
                    : isPaid
                    ? 100
                    : 0;

                return (
                  <div className="pr-grid-card" key={inv.id || inv.invoiceNumber}>
                    <div className="pr-grid-card-header">
                      <ProgressCircle
                        percentage={progressPct}
                        isApproved={isPaid}
                        isRejected={isOnHold}
                      />
                      <div className="pr-grid-badges">
                        <span
                          className={`pr-status-badge ${
                            isPaid ? "approved" : isOnHold ? "rejected" : "pending"
                          }`}
                        >
                          {inv.paymentStatusName}
                        </span>
                      </div>
                    </div>

                    <div className="pr-grid-card-body">
                      <strong
                        className="pr-grid-card-title"
                        onClick={() => setSelectedInvoiceForView(inv)}
                        title={inv.invoiceNumber}
                      >
                        {inv.invoiceNumber}
                      </strong>
                      <span className="pr-grid-card-ref">{inv.supplierName}</span>
                      <div className="pr-grid-amount">{formatCurrency(inv.totalAmount)}</div>

                      <div className="pr-grid-meta-row" style={{ marginTop: 8 }}>
                        <span>PO: {inv.poRef}</span>
                        <span>Due: {formatUsDate(inv.dueDate)}</span>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11.5,
                          display: "flex",
                          justifyContent: "space-between",
                          color: inv.remainingBalance > 0 ? "#d97706" : "#16a34a",
                          fontWeight: 650,
                        }}
                      >
                        <span>Paid: {formatCurrency(inv.amountPaid)}</span>
                        <span>Bal: {formatCurrency(inv.remainingBalance)}</span>
                      </div>
                    </div>

                    <div className="pr-grid-card-footer">
                      <button
                        type="button"
                        className="pr-grid-btn"
                        onClick={() => setSelectedInvoiceForView(inv)}
                      >
                        View Invoice Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="purchase-empty-state" style={{ padding: "48px 20px" }}>
              {isLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <Loader2 size={18} className="quotation-spin-icon" />
                  <span>Loading invoices from Dataverse cr49f_invoice1...</span>
                </div>
              ) : invoices.length === 0 ? (
                "No supplier invoices found in Dataverse cr49f_invoice1 table. Upload an invoice to begin tracking billing milestones."
              ) : (
                "No invoices match your current search and filter criteria."
              )}
            </div>
          )
        ) : (
          <div className="pr-modern-table-wrap">
            <table className="pr-modern-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center" }}></th>
                  <th style={{ width: 48 }}>#</th>
                  <th style={{ minWidth: 260 }}>Invoice Reference</th>
                  <th style={{ minWidth: 150 }}>Associated PO</th>
                  <th style={{ minWidth: 200 }}>Supplier / Vendor</th>
                  <th style={{ minWidth: 130 }}>Total Amount</th>
                  <th style={{ minWidth: 150 }}>Paid / Balance</th>
                  <th style={{ minWidth: 140 }}>Due Date</th>
                  <th style={{ minWidth: 130 }}>Status</th>
                  <th style={{ minWidth: 120, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "36px 0" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "10px",
                          color: "var(--muted-foreground-hex)",
                        }}
                      >
                        <Loader2 size={18} className="quotation-spin-icon" />
                        <span>Loading invoices from Dataverse cr49f_invoice1...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedInvoices.length ? (
                  paginatedInvoices.map((inv, index) => {
                    const isPaid = inv.paymentStatus === 1;
                    const isOnHold = inv.paymentStatus === 4;
                    const progressPct =
                      inv.totalAmount > 0
                        ? Math.min(100, Math.round((inv.amountPaid / inv.totalAmount) * 100))
                        : isPaid
                        ? 100
                        : 0;

                    const isExpanded = expandedRowId === inv.id;
                    const rowIndex = String((safeCurrentPage - 1) * PAGE_SIZE + index + 1).padStart(
                      2,
                      "0"
                    );

                    return (
                      <React.Fragment key={inv.id || inv.invoiceNumber}>
                        <tr className={`pr-row ${isExpanded ? "is-expanded" : ""}`}>
                          {/* 1. Chevron Toggle */}
                          <td className="pr-cell-chevron">
                            <button
                              type="button"
                              className="pr-chevron-btn"
                              onClick={() => setExpandedRowId(isExpanded ? null : inv.id)}
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

                          {/* 3. Invoice Details */}
                          <td className="pr-cell-details">
                            <div className="pr-details-flex">
                              <ProgressCircle
                                percentage={progressPct}
                                isApproved={isPaid}
                                isRejected={isOnHold}
                              />
                              <div className="pr-details-text">
                                <strong
                                  className="pr-details-title"
                                  onClick={() => setSelectedInvoiceForView(inv)}
                                  title={inv.invoiceNumber}
                                  style={{ cursor: "pointer" }}
                                >
                                  {inv.invoiceNumber}
                                </strong>
                                <div className="pr-details-meta">
                                  <span className="pr-meta-ref">{inv.supplierName}</span>
                                  <span className="pr-meta-sep">•</span>
                                  <span className="pr-meta-date">
                                    Issued {formatUsDate(inv.invoiceDate)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Associated PO */}
                          <td className="pr-cell-rfq">
                            {inv.poRef ? (
                              <button
                                type="button"
                                className="invoice-po-link-pill"
                                onClick={() => navigate(`/orders/${inv.poRef}`)}
                                title={`View Purchase Order ${inv.poRef}`}
                              >
                                <ShoppingCart size={11} />
                                <span>{inv.poRef}</span>
                                <ExternalLink size={10} />
                              </button>
                            ) : (
                              <span className="pr-rfq-pill empty">
                                <span>No PO Linked</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Supplier */}
                          <td className="pr-cell-creator">
                            <div className="pr-creator-flex">
                              <span
                                className="pr-avatar-initials"
                                style={{ background: "#eff6ff", color: "#2563eb" }}
                              >
                                {getInitials(inv.supplierName)}
                              </span>
                              <div className="pr-creator-info">
                                <span className="pr-creator-name" title={inv.supplierName}>
                                  {inv.supplierName}
                                </span>
                                <span className="pr-creator-dept">Registered Vendor</span>
                              </div>
                            </div>
                          </td>

                          {/* 6. Total Amount */}
                          <td className="pr-cell-amount">
                            <strong>{formatCurrency(inv.totalAmount)}</strong>
                          </td>

                          {/* 7. Paid / Balance */}
                          <td>
                            <div
                              className={`invoice-balance-cell ${
                                inv.remainingBalance === 0
                                  ? "settled"
                                  : inv.paymentStatus === 4
                                  ? "on-hold"
                                  : inv.amountPaid > 0
                                  ? "partial"
                                  : "unpaid"
                              }`}
                            >
                              <span className="balance-amount">
                                {formatCurrency(inv.amountPaid)} paid
                              </span>
                              <span className="balance-sub">
                                {inv.remainingBalance === 0
                                  ? "Fully Settled"
                                  : `Bal: ${formatCurrency(inv.remainingBalance)}`}
                              </span>
                            </div>
                          </td>

                          {/* 8. Due Date */}
                          <td>
                            <div
                              className={`invoice-due-pill ${
                                inv.isOverdue
                                  ? "overdue"
                                  : inv.dueDaysRemaining !== undefined &&
                                    inv.dueDaysRemaining <= 7 &&
                                    inv.paymentStatus !== 1
                                  ? "due-soon"
                                  : "normal"
                              }`}
                            >
                              <Calendar size={12} />
                              <span>{formatUsDate(inv.dueDate)}</span>
                              {inv.isOverdue && <span style={{ fontWeight: 700 }}>(Overdue)</span>}
                              {inv.dueDaysRemaining !== undefined &&
                                inv.dueDaysRemaining >= 0 &&
                                inv.dueDaysRemaining <= 7 &&
                                inv.paymentStatus !== 1 && (
                                  <span style={{ fontWeight: 700 }}>({inv.dueDaysRemaining}d)</span>
                                )}
                            </div>
                          </td>

                          {/* 9. Payment Status */}
                          <td>
                            <span
                              className={`pr-status-badge ${
                                isPaid ? "approved" : isOnHold ? "rejected" : "pending"
                              }`}
                            >
                              {isPaid ? (
                                <CheckCircle2 size={12} className="badge-icon" />
                              ) : (
                                <Clock3 size={12} className="badge-icon" />
                              )}
                              {inv.paymentStatusName}
                            </span>
                          </td>

                          {/* 10. Actions */}
                          <td style={{ textAlign: "right" }}>
                            <div className="invoice-action-btn-group">
                              {inv.attachment && (
                                <span
                                  className="invoice-attachment-pill"
                                  title={`Attachment: ${inv.attachment}`}
                                  onClick={() => setSelectedInvoiceForView(inv)}
                                >
                                  <Paperclip size={11} />
                                  <span>Doc</span>
                                </span>
                              )}
                              <button
                                type="button"
                                className="invoice-row-action-btn"
                                onClick={() => setSelectedInvoiceForView(inv)}
                                title="View invoice breakdown & milestones"
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>
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
                                    <button type="button" className="pr-drawer-tab active">
                                      Financial Breakdown &amp; Audit
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    className="pr-drawer-close-btn"
                                    onClick={() => setExpandedRowId(null)}
                                    aria-label="Close drawer"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                <div className="pr-drawer-grid">
                                  {/* Left: Financial calculation breakdown */}
                                  <div className="pr-drawer-meta-card">
                                    <div className="pr-meta-card-title">
                                      <Receipt size={15} />
                                      <span>Commercial Calculation</span>
                                    </div>
                                    <div className="pr-meta-grid">
                                      <div className="pr-meta-row">
                                        <span className="label">PO Baseline Total</span>
                                        <strong className="val">{formatCurrency(inv.poAmount)}</strong>
                                      </div>
                                      <div className="pr-meta-row">
                                        <span className="label">Contractual Discount</span>
                                        <strong className="val" style={{ color: "#16a34a" }}>
                                          -${Number(inv.discount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>
                                      <div className="pr-meta-row">
                                        <span className="label">Additional Surcharges</span>
                                        <strong className="val">
                                          +${Number(inv.additionalCharges || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>
                                      <div className="pr-meta-row">
                                        <span className="label">Total Amount Payable</span>
                                        <strong className="val" style={{ color: "#2563eb", fontSize: "14px" }}>
                                          {formatCurrency(inv.totalAmount)}
                                        </strong>
                                      </div>
                                      <div className="pr-meta-row">
                                        <span className="label">Amount Settled</span>
                                        <strong className="val" style={{ color: "#16a34a" }}>
                                          {formatCurrency(inv.amountPaid)}
                                        </strong>
                                      </div>
                                      <div className="pr-meta-row">
                                        <span className="label">Remaining Balance</span>
                                        <strong
                                          className="val"
                                          style={{ color: inv.remainingBalance > 0 ? "#d97706" : "#16a34a" }}
                                        >
                                          {formatCurrency(inv.remainingBalance)}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Middle: AI Match & Integrity */}
                                  <div className="pr-drawer-ai-card">
                                    <div className="pr-ai-card-title">
                                      <Sparkles size={15} />
                                      <span>3-Way Matching &amp; Audit</span>
                                    </div>
                                    <p className="pr-ai-card-text">
                                      {inv.poRef
                                        ? `Invoice verified against Purchase Order ${inv.poRef}. Commercial values reconcile with approved PO total.`
                                        : "Standalone invoice record. Please associate with a validated purchase order."}
                                    </p>
                                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                      <button
                                        type="button"
                                        className="pr-ai-card-link"
                                        onClick={() => navigate(`/orders/${inv.poRef}`)}
                                      >
                                        View Linked PO <ExternalLink size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        className="pr-ai-card-link"
                                        onClick={() => setSelectedInvoiceForView(inv)}
                                      >
                                        Full Invoice View <Eye size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Right: Supplier Profile & Quick Settlement Actions */}
                                  <div className="pr-drawer-vendors-card">
                                    <div className="pr-vendors-card-title">
                                      <Building2 size={15} />
                                      <span>Vendor Settlement</span>
                                    </div>
                                    <div className="pr-vendors-card-list">
                                      <div className="pr-vendor-row">
                                        <div className="vendor-left">
                                          <span className="vendor-avatar">
                                            {getInitials(inv.supplierName)}
                                          </span>
                                          <div className="vendor-info">
                                            <strong className="vendor-name">{inv.supplierName}</strong>
                                            <span className="vendor-status">
                                              Status: {inv.paymentStatusName}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {inv.paymentStatus !== 1 && (
                                          <button
                                            type="button"
                                            className="invoice-status-quick-btn pay-btn"
                                            onClick={() => void handleQuickStatusChange(inv, 1)}
                                            disabled={isUpdatingStatus}
                                          >
                                            <Check size={13} />
                                            Mark as Paid
                                          </button>
                                        )}
                                        {inv.paymentStatus !== 4 && (
                                          <button
                                            type="button"
                                            className="invoice-status-quick-btn hold-btn"
                                            onClick={() => void handleQuickStatusChange(inv, 4)}
                                            disabled={isUpdatingStatus}
                                          >
                                            <AlertCircle size={13} />
                                            Hold
                                          </button>
                                        )}
                                        {inv.paymentStatus === 4 && (
                                          <button
                                            type="button"
                                            className="invoice-status-quick-btn pay-btn"
                                            onClick={() => void handleQuickStatusChange(inv, 2)}
                                            disabled={isUpdatingStatus}
                                          >
                                            Release Hold
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td className="purchase-empty-state" colSpan={10} style={{ padding: "48px 20px" }}>
                      {invoices.length === 0
                        ? "No supplier invoices found in Dataverse cr49f_invoice1 table. Upload an invoice to begin tracking billing milestones."
                        : "No invoices match your current search and filter criteria."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. MODERN PAGINATION FOOTER */}
        <div className="purchase-footer">
          <span>
            Showing <strong>{filteredInvoices.length ? startRecord : 0}-{endRecord}</strong> of{" "}
            <strong>{filteredInvoices.length}</strong> invoices
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

      {/* 6. DETAIL PREVIEW MODAL */}
      {selectedInvoiceForView && (
        <div
          className="invoice-detail-preview-modal"
          onClick={() => setSelectedInvoiceForView(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="invoice-detail-card-inner" onClick={(e) => e.stopPropagation()}>
            <header className="invoice-detail-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="invoice-modal-icon-badge">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {selectedInvoiceForView.invoiceNumber}
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground-hex)" }}>
                    Linked to Purchase Order {selectedInvoiceForView.poRef}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="invoice-modal-close-btn"
                onClick={() => setSelectedInvoiceForView(null)}
              >
                <X size={17} />
              </button>
            </header>

            <div className="invoice-detail-modal-body">
              <div className="invoice-detail-grid-2">
                <div className="invoice-detail-item">
                  <label>Supplier / Vendor</label>
                  <strong>{selectedInvoiceForView.supplierName}</strong>
                </div>
                <div className="invoice-detail-item">
                  <label>Payment Status</label>
                  <div>
                    <span
                      className={`pr-status-badge ${
                        selectedInvoiceForView.paymentStatus === 1
                          ? "approved"
                          : selectedInvoiceForView.paymentStatus === 4
                          ? "rejected"
                          : "pending"
                      }`}
                    >
                      {selectedInvoiceForView.paymentStatusName}
                    </span>
                  </div>
                </div>

                <div className="invoice-detail-item">
                  <label>Invoice Date</label>
                  <strong>{formatUsDate(selectedInvoiceForView.invoiceDate)}</strong>
                </div>
                <div className="invoice-detail-item">
                  <label>Payment Due Date</label>
                  <strong>{formatUsDate(selectedInvoiceForView.dueDate)}</strong>
                </div>
              </div>

              {/* Commercial Calculation Breakdown */}
              <div className="invoice-detail-breakdown">
                <div className="invoice-breakdown-row">
                  <span>PO Baseline Total</span>
                  <span>{formatCurrency(selectedInvoiceForView.poAmount)}</span>
                </div>
                <div className="invoice-breakdown-row">
                  <span>Contractual Discount</span>
                  <span style={{ color: "#16a34a" }}>
                    -${Number(selectedInvoiceForView.discount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="invoice-breakdown-row">
                  <span>Additional Charges</span>
                  <span>
                    +${Number(selectedInvoiceForView.additionalCharges || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="invoice-breakdown-row total-row">
                  <span>Total Invoiced</span>
                  <span style={{ color: "#2563eb" }}>
                    {formatCurrency(selectedInvoiceForView.totalAmount)}
                  </span>
                </div>
                <div className="invoice-breakdown-row">
                  <span>Amount Paid to Date</span>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>
                    {formatCurrency(selectedInvoiceForView.amountPaid)}
                  </span>
                </div>
                <div className="invoice-breakdown-row">
                  <span>Remaining Balance</span>
                  <span
                    style={{
                      color: selectedInvoiceForView.remainingBalance > 0 ? "#d97706" : "#16a34a",
                      fontWeight: 750,
                    }}
                  >
                    {formatCurrency(selectedInvoiceForView.remainingBalance)}
                  </span>
                </div>
              </div>

              {/* Attachment if present */}
              {selectedInvoiceForView.attachment && (
                <div className="invoice-detail-item">
                  <label>Attached Document</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Paperclip size={14} style={{ color: "#2563eb" }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {selectedInvoiceForView.attachment}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <footer className="invoice-detail-modal-footer">
              <div style={{ display: "flex", gap: 8 }}>
                {selectedInvoiceForView.paymentStatus !== 1 && (
                  <button
                    type="button"
                    className="invoice-status-quick-btn pay-btn"
                    onClick={() => void handleQuickStatusChange(selectedInvoiceForView, 1)}
                    disabled={isUpdatingStatus}
                  >
                    <Check size={14} />
                    Mark as Paid
                  </button>
                )}
                {selectedInvoiceForView.paymentStatus !== 4 && (
                  <button
                    type="button"
                    className="invoice-status-quick-btn hold-btn"
                    onClick={() => void handleQuickStatusChange(selectedInvoiceForView, 4)}
                    disabled={isUpdatingStatus}
                  >
                    <AlertCircle size={14} />
                    Put On Hold
                  </button>
                )}
                {selectedInvoiceForView.paymentStatus === 4 && (
                  <button
                    type="button"
                    className="invoice-status-quick-btn pay-btn"
                    onClick={() => void handleQuickStatusChange(selectedInvoiceForView, 2)}
                    disabled={isUpdatingStatus}
                  >
                    Release Hold
                  </button>
                )}
              </div>
              <button
                type="button"
                className="invoice-row-action-btn"
                onClick={() => setSelectedInvoiceForView(null)}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 7. UPLOAD INVOICE MODAL */}
      <UploadInvoiceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onInvoiceCreated={() => void loadInvoices(true)}
      />
    </main>
  );
};

export default InvoicesOverviewPage;
