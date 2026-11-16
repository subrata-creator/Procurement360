import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Paperclip,
  ExternalLink,
  Calendar,
  Eye,
  X,
  Loader2,
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
import "../Styles/InvoicesOverview.css";

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

export const InvoicesOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<EnrichedInvoice | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

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

      // Look through all localStorage keys for procurement_custom_invoices_*
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
            // Merge local attachment preview or notes if missing in server record
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
        const invoiceNumber = inv.cr49f_invoicenumber || "INV-UNNAMED";
        const poValue = cleanGuid(inv._cr49f_associatedpo_value) || "";

        // Resolve PO reference
        const matchedPo = pos.find((p) => {
          const pId = cleanGuid(p.cr49f_purchaseorderid);
          const pNum = (p.cr49f_ponumber || "").toLowerCase().trim();
          return (
            (poValue && pId === poValue) ||
            (inv.poRef && pNum === inv.poRef.toLowerCase().trim()) ||
            (inv.cr49f_invoicenumber && inv.cr49f_invoicenumber.includes(p.cr49f_ponumber || ""))
          );
        });

        const poRef = matchedPo?.cr49f_ponumber || inv.poRef || (poValue ? `PO-${poValue.slice(0, 8).toUpperCase()}` : "PO-GENERAL");

        // Resolve Supplier
        const supplierLookup = cleanGuid((matchedPo as any)?._cr49f_supplier_value || (matchedPo as any)?.cr49f_supplier);
        const matchedSupplier = suppliers.find((s) => {
          const sId = cleanGuid(s.cr49f_supplierid);
          const sName = (s.cr49f_name || "").toLowerCase().trim();
          return (
            (supplierLookup && sId === supplierLookup) ||
            ((matchedPo as any)?.cr49f_suppliername && sName === ((matchedPo as any).cr49f_suppliername || "").toLowerCase().trim()) ||
            (inv.supplierName && sName === inv.supplierName.toLowerCase().trim())
          );
        });

        const supplierName =
          inv.supplierName ||
          matchedSupplier?.cr49f_name ||
          (matchedPo as any)?.cr49f_suppliername ||
          (matchedPo as any)?.supplier ||
          "Authorized Supplier";

        const poAmount = Number(inv.cr49f_poamount) || Number(matchedPo?.cr49f_totalamount) || 0;
        const totalAmount = Number(inv.cr49f_totalamount) || Number(matchedPo?.cr49f_totalamount) || 0;
        const amountPaid = Number(inv.cr49f_amountpaid) || 0;
        const remainingBalance = Math.max(0, totalAmount - amountPaid);
        const discount = Number(inv.cr49f_discount) || 0;
        const additionalCharges = Number(inv.cr49f_additionalcharges) || 0;

        let paymentStatus: 1 | 2 | 3 | 4 = (inv.cr49f_paymentstatus as 1 | 2 | 3 | 4) || 2;
        if (amountPaid >= totalAmount && totalAmount > 0) {
          paymentStatus = 1; // Paid
        } else if (amountPaid > 0 && amountPaid < totalAmount) {
          paymentStatus = 3; // Partially Paid
        }

        const paymentStatusName =
          paymentStatus === 1
            ? "Paid"
            : paymentStatus === 3
            ? "Partially Paid"
            : paymentStatus === 4
            ? "On Hold"
            : "Not Paid";

        // Calculate due date status
        let isOverdue = false;
        let dueDaysRemaining: number | undefined = undefined;

        if (inv.cr49f_duedate) {
          const due = new Date(inv.cr49f_duedate);
          due.setHours(0, 0, 0, 0);
          const diffTime = due.getTime() - today.getTime();
          dueDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (dueDaysRemaining < 0 && paymentStatus !== 1) {
            isOverdue = true;
          }
        }

        return {
          id,
          invoiceNumber,
          invoiceDate: inv.cr49f_invoicedate || inv.createdon || new Date().toISOString().split("T")[0],
          dueDate: inv.cr49f_duedate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          poAmount,
          totalAmount,
          amountPaid,
          remainingBalance,
          discount,
          additionalCharges,
          paymentStatus,
          paymentStatusName,
          attachment: inv.cr49f_invoiceattachment,
          poRef,
          poId: matchedPo?.cr49f_purchaseorderid || poValue,
          supplierName,
          notes: inv.notes,
          isOverdue,
          dueDaysRemaining,
          rawRecord: inv,
        };
      });

      setInvoices(enrichedList);
    } catch (err) {
      console.warn("Could not load invoices:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  // Handle invoice created from modal
  const handleInvoiceCreated = (_newInv: Cr49f_invoice1s) => {
    void loadInvoices(true);
  };

  // Quick action: Update status in Dataverse
  const handleUpdatePaymentStatus = async (
    invoice: EnrichedInvoice,
    newStatus: 1 | 2 | 3 | 4
  ) => {
    setIsUpdatingStatus(true);
    try {
      const isRealGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice.id);
      const newPaidAmount = newStatus === 1 ? invoice.totalAmount : newStatus === 2 ? 0 : invoice.amountPaid;

      if (isRealGuid) {
        await Cr49f_invoice1sService.update(invoice.id, {
          cr49f_paymentstatus: newStatus,
          cr49f_amountpaid: newPaidAmount,
        });
      }

      // Update in local master storage as well
      try {
        const masterRaw = localStorage.getItem("procurement_all_invoices");
        if (masterRaw) {
          const list = JSON.parse(masterRaw);
          const updated = list.map((m: any) =>
            m.cr49f_invoicenumber === invoice.invoiceNumber
              ? { ...m, cr49f_paymentstatus: newStatus, cr49f_amountpaid: newPaidAmount }
              : m
          );
          localStorage.setItem("procurement_all_invoices", JSON.stringify(updated));
        }

        const poKey = `procurement_custom_invoices_${invoice.poRef}`;
        const poRaw = localStorage.getItem(poKey);
        if (poRaw) {
          const list = JSON.parse(poRaw);
          const updated = list.map((m: any) =>
            m.cr49f_invoicenumber === invoice.invoiceNumber
              ? { ...m, cr49f_paymentstatus: newStatus, cr49f_amountpaid: newPaidAmount }
              : m
          );
          localStorage.setItem(poKey, JSON.stringify(updated));
        }
      } catch {}

      // Update local state directly
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id || inv.invoiceNumber === invoice.invoiceNumber
            ? {
                ...inv,
                paymentStatus: newStatus,
                amountPaid: newPaidAmount,
                remainingBalance: Math.max(0, inv.totalAmount - newPaidAmount),
                paymentStatusName:
                  newStatus === 1 ? "Paid" : newStatus === 3 ? "Partially Paid" : newStatus === 4 ? "On Hold" : "Not Paid",
              }
            : inv
        )
      );

      if (selectedInvoiceForView) {
        setSelectedInvoiceForView((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: newStatus,
                amountPaid: newPaidAmount,
                remainingBalance: Math.max(0, prev.totalAmount - newPaidAmount),
                paymentStatusName:
                  newStatus === 1 ? "Paid" : newStatus === 3 ? "Partially Paid" : newStatus === 4 ? "On Hold" : "Not Paid",
              }
            : null
        );
      }
    } catch (e) {
      console.error("Could not update invoice payment status:", e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidInvoiced = invoices
      .filter((inv) => inv.paymentStatus === 1)
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const pendingBalance = invoices
      .filter((inv) => inv.paymentStatus === 2 || inv.paymentStatus === 3)
      .reduce((sum, inv) => sum + inv.remainingBalance, 0);
    const onHoldAmount = invoices
      .filter((inv) => inv.paymentStatus === 4)
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    return {
      totalAmount: totalInvoiced,
      totalCount: invoices.length,
      paidAmount: paidInvoiced,
      paidCount: invoices.filter((i) => i.paymentStatus === 1).length,
      pendingAmount: pendingBalance,
      pendingCount: invoices.filter((i) => i.paymentStatus === 2 || i.paymentStatus === 3).length,
      onHoldAmount: onHoldAmount,
      onHoldCount: invoices.filter((i) => i.paymentStatus === 4).length,
    };
  }, [invoices]);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return invoices
      .filter((inv) => {
        // Search query
        if (query) {
          const matchNum = inv.invoiceNumber.toLowerCase().includes(query);
          const matchPo = inv.poRef.toLowerCase().includes(query);
          const matchSup = inv.supplierName.toLowerCase().includes(query);
          if (!matchNum && !matchPo && !matchSup) return false;
        }

        // Status tab filter
        if (statusFilter === "PAID" && inv.paymentStatus !== 1) return false;
        if (statusFilter === "NOT_PAID" && inv.paymentStatus !== 2) return false;
        if (statusFilter === "PARTIAL" && inv.paymentStatus !== 3) return false;
        if (statusFilter === "ON_HOLD" && inv.paymentStatus !== 4) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
        }
        if (sortBy === "due-soon") {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === "amount-high") {
          return b.totalAmount - a.totalAmount;
        }
        if (sortBy === "amount-low") {
          return a.totalAmount - b.totalAmount;
        }
        return 0;
      });
  }, [invoices, searchQuery, statusFilter, sortBy]);

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatCurrency = (val: number) => {
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <main className="purchase-page invoices-overview-page">
      {/* PAGE HEADER */}
      <div className="invoices-heading">
        <div className="invoices-heading-left">
          <h1>Invoices &amp; Billing Overview</h1>
          <p>Comprehensive overview of supplier invoices, settlement statuses, and payment milestones</p>
        </div>
        <div className="invoices-heading-actions">
          <button
            type="button"
            className="invoices-sync-btn"
            onClick={() => void loadInvoices(true)}
            disabled={isRefreshing || isLoading}
            title="Refresh invoices"
          >
            <RefreshCw size={14} className={isRefreshing ? "quotation-spin-icon" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync Invoices"}</span>
          </button>
          <button
            type="button"
            className="invoices-create-btn"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus size={15} />
            <span>Upload Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS BAND */}
      <section className="invoices-kpis-grid" aria-label="Invoice summary metrics">
        {/* KPI 1: TOTAL */}
        <div
          className={`invoice-kpi-card kpi-total ${statusFilter === "ALL" ? "active" : ""}`}
          onClick={() => setStatusFilter("ALL")}
          role="button"
          tabIndex={0}
        >
          <div className="invoice-kpi-top">
            <span className="invoice-kpi-label">Total Invoiced</span>
            <div className="invoice-kpi-icon-wrap">
              <Receipt size={17} />
            </div>
          </div>
          <div className="invoice-kpi-amount">{formatCurrency(metrics.totalAmount)}</div>
          <div className="invoice-kpi-sub">
            <span>All recorded invoices</span>
            <span className="invoice-kpi-count-badge">{metrics.totalCount} Invoices</span>
          </div>
        </div>

        {/* KPI 2: PAID */}
        <div
          className={`invoice-kpi-card kpi-paid ${statusFilter === "PAID" ? "active" : ""}`}
          onClick={() => setStatusFilter("PAID")}
          role="button"
          tabIndex={0}
        >
          <div className="invoice-kpi-top">
            <span className="invoice-kpi-label">Paid &amp; Settled</span>
            <div className="invoice-kpi-icon-wrap">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="invoice-kpi-amount" style={{ color: "#16a34a" }}>
            {formatCurrency(metrics.paidAmount)}
          </div>
          <div className="invoice-kpi-sub">
            <span>Settled in full</span>
            <span className="invoice-kpi-count-badge" style={{ color: "#16a34a" }}>
              {metrics.paidCount} Paid
            </span>
          </div>
        </div>

        {/* KPI 3: PENDING */}
        <div
          className={`invoice-kpi-card kpi-pending ${statusFilter === "NOT_PAID" || statusFilter === "PARTIAL" ? "active" : ""}`}
          onClick={() => setStatusFilter("NOT_PAID")}
          role="button"
          tabIndex={0}
        >
          <div className="invoice-kpi-top">
            <span className="invoice-kpi-label">Pending Balance</span>
            <div className="invoice-kpi-icon-wrap">
              <Clock size={17} />
            </div>
          </div>
          <div className="invoice-kpi-amount" style={{ color: "#d97706" }}>
            {formatCurrency(metrics.pendingAmount)}
          </div>
          <div className="invoice-kpi-sub">
            <span>Awaiting payment</span>
            <span className="invoice-kpi-count-badge" style={{ color: "#d97706" }}>
              {metrics.pendingCount} Pending
            </span>
          </div>
        </div>

        {/* KPI 4: ON HOLD */}
        <div
          className={`invoice-kpi-card kpi-hold ${statusFilter === "ON_HOLD" ? "active" : ""}`}
          onClick={() => setStatusFilter("ON_HOLD")}
          role="button"
          tabIndex={0}
        >
          <div className="invoice-kpi-top">
            <span className="invoice-kpi-label">Under Review / On Hold</span>
            <div className="invoice-kpi-icon-wrap">
              <AlertCircle size={17} />
            </div>
          </div>
          <div className="invoice-kpi-amount" style={{ color: "#64748b" }}>
            {formatCurrency(metrics.onHoldAmount)}
          </div>
          <div className="invoice-kpi-sub">
            <span>Verification pending</span>
            <span className="invoice-kpi-count-badge">{metrics.onHoldCount} On Hold</span>
          </div>
        </div>
      </section>

      {/* FILTER & TOOLBAR */}
      <section className="invoices-toolbar">
        <div className="invoices-search-box">
          <Search size={15} className="invoices-search-icon" />
          <input
            type="text"
            className="invoices-search-input"
            placeholder="Search by invoice #, PO reference, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 10, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="invoices-filter-group">
          {/* Status Tabs */}
          <div className="invoices-status-tabs">
            <button
              type="button"
              className={`invoices-status-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              All ({invoices.length})
            </button>
            <button
              type="button"
              className={`invoices-status-tab-btn ${statusFilter === "PAID" ? "active" : ""}`}
              onClick={() => setStatusFilter("PAID")}
            >
              Paid ({metrics.paidCount})
            </button>
            <button
              type="button"
              className={`invoices-status-tab-btn ${statusFilter === "NOT_PAID" ? "active" : ""}`}
              onClick={() => setStatusFilter("NOT_PAID")}
            >
              Not Paid ({invoices.filter((i) => i.paymentStatus === 2).length})
            </button>
            <button
              type="button"
              className={`invoices-status-tab-btn ${statusFilter === "PARTIAL" ? "active" : ""}`}
              onClick={() => setStatusFilter("PARTIAL")}
            >
              Partially Paid ({invoices.filter((i) => i.paymentStatus === 3).length})
            </button>
            <button
              type="button"
              className={`invoices-status-tab-btn ${statusFilter === "ON_HOLD" ? "active" : ""}`}
              onClick={() => setStatusFilter("ON_HOLD")}
            >
              On Hold ({metrics.onHoldCount})
            </button>
          </div>

          {/* Sort Selector */}
          <select
            className="invoices-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest First</option>
            <option value="due-soon">Sort: Due Date (Earliest)</option>
            <option value="amount-high">Sort: Amount (High to Low)</option>
            <option value="amount-low">Sort: Amount (Low to High)</option>
          </select>
        </div>
      </section>

      {/* INVOICES DATA TABLE */}
      <section className="invoices-table-card">
        {isLoading ? (
          <div className="invoices-loading-container">
            <Loader2 size={30} className="quotation-spin-icon" style={{ color: "var(--primary-hex)" }} />
            <p>Loading invoice records and financial details...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="invoices-empty-state">
            <div className="invoices-empty-icon">
              <Receipt size={28} />
            </div>
            <h3>No Invoices Found</h3>
            <p>
              {searchQuery || statusFilter !== "ALL"
                ? "No invoices match your current search and filter criteria. Try adjusting your filters."
                : "No supplier invoices have been uploaded yet. Upload an invoice to track billing and payment milestones."}
            </p>
            {searchQuery || statusFilter !== "ALL" ? (
              <button
                type="button"
                className="invoices-sync-btn"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                className="invoices-create-btn"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <Plus size={15} />
                Upload First Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="invoices-table-scroll">
            <table className="invoices-table">
              <thead>
                <tr>
                  <th>Invoice Reference</th>
                  <th>Purchase Order</th>
                  <th>Supplier / Vendor</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Amount Paid</th>
                  <th>Remaining Balance</th>
                  <th>Status</th>
                  <th>Attachment</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id || inv.invoiceNumber}>
                    {/* Invoice Reference */}
                    <td>
                      <div className="invoice-num-cell">
                        <FileText size={15} className="invoice-num-icon" />
                        <span>{inv.invoiceNumber}</span>
                      </div>
                    </td>

                    {/* Purchase Order */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          type="button"
                          className="invoice-po-link-pill"
                          onClick={() => navigate(`/orders/${inv.poRef}`)}
                          title={`View Purchase Order ${inv.poRef}`}
                        >
                          {inv.poRef}
                          <ExternalLink size={10} />
                        </button>
                        {inv.poAmount > 0 && (
                          <span style={{ fontSize: 11, color: "var(--muted-foreground-hex)" }}>
                            PO: {formatCurrency(inv.poAmount)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td>
                      <div className="invoice-supplier-cell">
                        <span className="invoice-supplier-avatar">{getInitials(inv.supplierName)}</span>
                        <span className="invoice-supplier-name">{inv.supplierName}</span>
                      </div>
                    </td>

                    {/* Invoice Date */}
                    <td>{new Date(inv.invoiceDate).toLocaleDateString()}</td>

                    {/* Due Date & Urgency Indicator */}
                    <td>
                      <div
                        className={`invoice-due-pill ${
                          inv.isOverdue
                            ? "overdue"
                            : inv.dueDaysRemaining !== undefined && inv.dueDaysRemaining <= 7 && inv.paymentStatus !== 1
                            ? "due-soon"
                            : "normal"
                        }`}
                      >
                        <Calendar size={12} />
                        <span>{new Date(inv.dueDate).toLocaleDateString()}</span>
                        {inv.isOverdue && <span style={{ fontSize: 10, fontWeight: 700 }}> (Overdue)</span>}
                        {inv.dueDaysRemaining !== undefined &&
                          inv.dueDaysRemaining >= 0 &&
                          inv.dueDaysRemaining <= 7 &&
                          inv.paymentStatus !== 1 && (
                            <span style={{ fontSize: 10, fontWeight: 700 }}>
                              {" "}
                              ({inv.dueDaysRemaining}d left)
                            </span>
                          )}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td>
                      <strong style={{ color: "var(--foreground-hex)" }}>{formatCurrency(inv.totalAmount)}</strong>
                    </td>

                    {/* Amount Paid */}
                    <td>{formatCurrency(inv.amountPaid)}</td>

                    {/* Remaining Balance */}
                    <td>
                      <span
                        className={`invoice-balance-cell ${
                          inv.remainingBalance === 0 ? "settled" : inv.amountPaid > 0 ? "partial" : "unpaid"
                        }`}
                      >
                        {formatCurrency(inv.remainingBalance)}
                      </span>
                    </td>

                    {/* Payment Status Pill */}
                    <td>
                      <span
                        className={`order-invoice-status-badge ${
                          inv.paymentStatus === 1
                            ? "paid"
                            : inv.paymentStatus === 3
                            ? "partially-paid"
                            : inv.paymentStatus === 4
                            ? "on-hold"
                            : "not-paid"
                        }`}
                      >
                        {inv.paymentStatus === 1 ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        {inv.paymentStatusName}
                      </span>
                    </td>

                    {/* Attachment */}
                    <td>
                      {inv.attachment ? (
                        <span className="invoice-attachment-pill" title={inv.attachment}>
                          <Paperclip size={12} />
                          {inv.attachment}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted-foreground-hex)", fontSize: 11.5 }}>None</span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="invoice-row-action-btn"
                        onClick={() => setSelectedInvoiceForView(inv)}
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DETAIL PREVIEW MODAL */}
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
              {/* Row 1: PO & Supplier */}
              <div className="invoice-detail-grid-2">
                <div className="invoice-detail-item">
                  <label>Purchase Order</label>
                  <button
                    type="button"
                    className="invoice-po-link-pill"
                    style={{ width: "fit-content", marginTop: 2 }}
                    onClick={() => {
                      setSelectedInvoiceForView(null);
                      navigate(`/orders/${selectedInvoiceForView.poRef}`);
                    }}
                  >
                    {selectedInvoiceForView.poRef} <ExternalLink size={11} />
                  </button>
                </div>
                <div className="invoice-detail-item">
                  <label>Supplier / Vendor</label>
                  <strong>{selectedInvoiceForView.supplierName}</strong>
                </div>
              </div>

              {/* Row 2: Dates & Status */}
              <div className="invoice-detail-grid-2">
                <div className="invoice-detail-item">
                  <label>Invoice Date</label>
                  <strong>{new Date(selectedInvoiceForView.invoiceDate).toLocaleDateString()}</strong>
                </div>
                <div className="invoice-detail-item">
                  <label>Payment Due Date</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <strong>{new Date(selectedInvoiceForView.dueDate).toLocaleDateString()}</strong>
                    {selectedInvoiceForView.isOverdue && (
                      <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>(Overdue)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="invoice-detail-breakdown">
                {selectedInvoiceForView.poAmount > 0 && (
                  <div className="invoice-breakdown-row" style={{ background: "rgba(37, 99, 235, 0.05)", padding: "5px 8px", borderRadius: "6px", marginBottom: "4px" }}>
                    <span>Purchase Order Value (Baseline)</span>
                    <strong style={{ color: "#2563eb" }}>{formatCurrency(selectedInvoiceForView.poAmount)}</strong>
                  </div>
                )}
                <div className="invoice-breakdown-row">
                  <span>Base / Subtotal Amount</span>
                  <strong>{formatCurrency(selectedInvoiceForView.totalAmount + selectedInvoiceForView.discount - selectedInvoiceForView.additionalCharges)}</strong>
                </div>
                {selectedInvoiceForView.discount > 0 && (
                  <div className="invoice-breakdown-row" style={{ color: "#16a34a" }}>
                    <span>Early Payment / Contract Discount (-)</span>
                    <span>-{formatCurrency(selectedInvoiceForView.discount)}</span>
                  </div>
                )}
                {selectedInvoiceForView.additionalCharges > 0 && (
                  <div className="invoice-breakdown-row">
                    <span>Freight &amp; Additional Charges (+)</span>
                    <span>+{formatCurrency(selectedInvoiceForView.additionalCharges)}</span>
                  </div>
                )}
                <div className="invoice-breakdown-row total-row">
                  <span>Net Invoice Amount</span>
                  <span style={{ color: "var(--primary-hex)" }}>{formatCurrency(selectedInvoiceForView.totalAmount)}</span>
                </div>
                <div className="invoice-breakdown-row">
                  <span>Amount Settled / Paid to Date</span>
                  <span style={{ color: "#16a34a", fontWeight: 650 }}>{formatCurrency(selectedInvoiceForView.amountPaid)}</span>
                </div>
                <div className="invoice-breakdown-row" style={{ fontWeight: 700 }}>
                  <span>Remaining Outstanding Balance</span>
                  <span style={{ color: selectedInvoiceForView.remainingBalance === 0 ? "#16a34a" : "#ef4444" }}>
                    {formatCurrency(selectedInvoiceForView.remainingBalance)}
                  </span>
                </div>
              </div>

              {/* Attachment */}
              <div className="invoice-detail-item">
                <label>Attached Document</label>
                {selectedInvoiceForView.attachment ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--primary-hex)", marginTop: 3 }}>
                    <Paperclip size={14} />
                    <strong>{selectedInvoiceForView.attachment}</strong>
                  </div>
                ) : (
                  <span style={{ fontSize: 12.5, color: "var(--muted-foreground-hex)" }}>No file attached</span>
                )}
              </div>
            </div>

            <footer className="invoice-detail-modal-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground-hex)" }}>Status:</span>
                <span
                  className={`order-invoice-status-badge ${
                    selectedInvoiceForView.paymentStatus === 1
                      ? "paid"
                      : selectedInvoiceForView.paymentStatus === 3
                      ? "partially-paid"
                      : selectedInvoiceForView.paymentStatus === 4
                      ? "on-hold"
                      : "not-paid"
                  }`}
                >
                  {selectedInvoiceForView.paymentStatusName}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {selectedInvoiceForView.paymentStatus !== 1 && (
                  <button
                    type="button"
                    className="invoices-sync-btn"
                    style={{ background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", borderColor: "rgba(34, 197, 94, 0.3)" }}
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdatePaymentStatus(selectedInvoiceForView, 1)}
                  >
                    <CheckCircle2 size={13} />
                    Mark as Paid
                  </button>
                )}
                {selectedInvoiceForView.paymentStatus === 1 && (
                  <button
                    type="button"
                    className="invoices-sync-btn"
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdatePaymentStatus(selectedInvoiceForView, 2)}
                  >
                    Revert to Not Paid
                  </button>
                )}
                <button
                  type="button"
                  className="invoices-sync-btn"
                  onClick={() => setSelectedInvoiceForView(null)}
                >
                  Close
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* UPLOAD INVOICE MODAL */}
      <UploadInvoiceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />
    </main>
  );
};

export default InvoicesOverviewPage;
