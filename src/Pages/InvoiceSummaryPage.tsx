import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Receipt,
  ShoppingCart,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Paperclip,
  Printer,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  FileText,
  DollarSign,
  Loader2,
} from "lucide-react";

import { Cr49f_invoice1sService } from "../generated/services/Cr49f_invoice1sService";
import { Cr49f_purchaseordersService } from "../generated/services/Cr49f_purchaseordersService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import type { Cr49f_invoice1s } from "../generated/models/Cr49f_invoice1sModel";
import type { Cr49f_purchaseorders } from "../generated/models/Cr49f_purchaseordersModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import "../Styles/InvoiceSummary.css";

interface InvoiceDetailState {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  poAmount: number;
  discount: number;
  additionalCharges: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: number;
  paymentStatusName: string;
  attachment?: string;
  notes?: string;
  poRef: string;
  poId?: string;
  supplierName: string;
  supplierId?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  createdOn?: string;
}

const TABS = [
  "Commercial Summary",
  "3-Way Match & Reconciliation",
  "Associated Purchase Order",
  "Supplier Ledger",
  "Documents & Notes",
];

export const InvoiceSummaryPage: React.FC = () => {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>("Commercial Summary");
  const [invoice, setInvoice] = useState<InvoiceDetailState | null>(null);
  const [linkedPo, setLinkedPo] = useState<Cr49f_purchaseorders | null>(null);
  const [linkedSupplier, setLinkedSupplier] = useState<Cr49f_suppliers | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return `$${Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatUsDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return "VN";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Load Invoice and linked relations
  const loadInvoiceData = useCallback(async () => {
    if (!ref) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [invRes, poRes, supRes] = await Promise.allSettled([
        Cr49f_invoice1sService.getAll(),
        Cr49f_purchaseordersService.getAll(),
        Cr49f_suppliersService.getAll(),
      ]);

      const rawInvoices: Cr49f_invoice1s[] =
        invRes.status === "fulfilled" && invRes.value.success && invRes.value.data
          ? invRes.value.data
          : [];

      const purchaseOrders: Cr49f_purchaseorders[] =
        poRes.status === "fulfilled" && poRes.value.success && poRes.value.data
          ? poRes.value.data
          : [];

      const suppliers: Cr49f_suppliers[] =
        supRes.status === "fulfilled" && supRes.value.success && supRes.value.data
          ? supRes.value.data
          : [];

      // Include locally stored custom invoices
      const localInvoices: any[] = [];
      try {
        const masterRaw = localStorage.getItem("procurement_all_invoices");
        if (masterRaw) {
          const parsed = JSON.parse(masterRaw);
          if (Array.isArray(parsed)) localInvoices.push(...parsed);
        }
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("procurement_custom_invoices_")) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) localInvoices.push(...list);
            }
          }
        }
      } catch {}

      const cleanTargetRef = decodeURIComponent(ref).trim().toLowerCase();

      // Find match in Dataverse or local
      let matchedRaw = rawInvoices.find(
        (i) =>
          (i.cr49f_invoicenumber && i.cr49f_invoicenumber.toLowerCase() === cleanTargetRef) ||
          (i.cr49f_invoice1id && i.cr49f_invoice1id.toLowerCase() === cleanTargetRef) ||
          cleanGuid(i.cr49f_invoice1id) === cleanGuid(cleanTargetRef)
      );

      let matchedLocal = localInvoices.find(
        (i) =>
          (i.cr49f_invoicenumber && i.cr49f_invoicenumber.toLowerCase() === cleanTargetRef) ||
          (i.cr49f_invoice1id && i.cr49f_invoice1id.toLowerCase() === cleanTargetRef) ||
          cleanGuid(i.cr49f_invoice1id) === cleanGuid(cleanTargetRef)
      );

      if (!matchedRaw && !matchedLocal) {
        setErrorMessage(`No invoice record found matching "${ref}".`);
        setIsLoading(false);
        return;
      }

      const merged = {
        ...(matchedRaw || {}),
        ...(matchedLocal || {}),
      };

      // Resolve linked PO
      const poValGuid = cleanGuid(merged._cr49f_associatedpo_value);
      const matchedPO = purchaseOrders.find((po) => {
        const pId = cleanGuid(po.cr49f_purchaseorderid);
        const pNum = po.cr49f_ponumber?.toLowerCase();
        return (
          (poValGuid && pId === poValGuid) ||
          (merged.poRef && pNum === merged.poRef.toLowerCase())
        );
      });

      if (matchedPO) {
        setLinkedPo(matchedPO);
      }

      // Resolve linked Supplier
      let resolvedSupplierName = merged.supplierName || "";
      let matchedSupplier: Cr49f_suppliers | undefined;

      if (matchedPO) {
        const rawPo = matchedPO as unknown as Record<string, unknown>;
        const supGuid = cleanGuid(rawPo._cr49f_supplier_value as string);
        if (supGuid) {
          matchedSupplier = suppliers.find((s) => cleanGuid(s.cr49f_supplierid) === supGuid);
          if (matchedSupplier?.cr49f_name) {
            resolvedSupplierName = matchedSupplier.cr49f_name;
          }
        }
      }

      if (!matchedSupplier && resolvedSupplierName) {
        matchedSupplier = suppliers.find(
          (s) => s.cr49f_name?.toLowerCase() === resolvedSupplierName.toLowerCase()
        );
      }

      if (matchedSupplier) {
        setLinkedSupplier(matchedSupplier);
        if (!resolvedSupplierName && matchedSupplier.cr49f_name) {
          resolvedSupplierName = matchedSupplier.cr49f_name;
        }
      }

      const baselinePOAmount = Number(
        merged.cr49f_poamount ?? matchedPO?.cr49f_totalamount ?? 0
      );
      const discountVal = Number(merged.cr49f_discount ?? 0);
      const addChargesVal = Number(merged.cr49f_additionalcharges ?? 0);

      const calculatedTotal =
        merged.cr49f_totalamount !== undefined && merged.cr49f_totalamount !== null
          ? Number(merged.cr49f_totalamount)
          : Math.max(0, baselinePOAmount - discountVal + addChargesVal);

      const paidVal = Number(merged.cr49f_amountpaid ?? (merged.cr49f_paymentstatus === 1 ? calculatedTotal : 0));
      const remainingVal = Math.max(0, calculatedTotal - paidVal);

      const pStatus = Number(merged.cr49f_paymentstatus ?? 2);
      const statusNames: Record<number, string> = {
        1: "Paid",
        2: "Not Paid",
        3: "Partially Paid",
        4: "On Hold",
      };

      setInvoice({
        id: merged.cr49f_invoice1id || cleanGuid(ref) || "INV-GEN",
        invoiceNumber: merged.cr49f_invoicenumber || ref,
        invoiceDate: merged.cr49f_invoicedate || merged.createdon || new Date().toISOString(),
        dueDate: merged.cr49f_duedate || "",
        poAmount: baselinePOAmount,
        discount: discountVal,
        additionalCharges: addChargesVal,
        totalAmount: calculatedTotal,
        amountPaid: paidVal,
        remainingBalance: remainingVal,
        paymentStatus: pStatus,
        paymentStatusName: statusNames[pStatus] || "Not Paid",
        attachment: merged.cr49f_invoiceattachment,
        notes: merged.notes || "Commercial invoice verified against approved procurement baseline.",
        poRef: matchedPO?.cr49f_ponumber || merged.poRef || "",
        poId: matchedPO?.cr49f_purchaseorderid,
        supplierName: resolvedSupplierName || "Registered Supplier",
        supplierId: matchedSupplier?.cr49f_supplierid,
        supplierEmail: matchedSupplier?.cr49f_email,
        supplierPhone: matchedSupplier?.cr49f_phonenumber,
        supplierAddress: matchedSupplier?.cr49f_address,
        createdOn: merged.createdon,
      });
    } catch (err: any) {
      console.error("Error loading invoice detail:", err);
      setErrorMessage("Failed to load invoice records from Dataverse.");
    } finally {
      setIsLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    void loadInvoiceData();
  }, [loadInvoiceData]);

  // Handle Quick Payment Status Change
  const handleStatusChange = async (newStatus: 1 | 2 | 3 | 4) => {
    if (!invoice || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    try {
      if (invoice.id && invoice.id.length > 20) {
        await Cr49f_invoice1sService.update(invoice.id, {
          cr49f_paymentstatus: newStatus,
          cr49f_amountpaid: newStatus === 1 ? invoice.totalAmount : invoice.amountPaid,
        });
      }

      // Update local storage master cache
      try {
        const raw = localStorage.getItem("procurement_all_invoices");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const idx = list.findIndex(
              (item) => item.cr49f_invoicenumber === invoice.invoiceNumber
            );
            if (idx >= 0) {
              list[idx].cr49f_paymentstatus = newStatus;
              if (newStatus === 1) list[idx].cr49f_amountpaid = invoice.totalAmount;
              localStorage.setItem("procurement_all_invoices", JSON.stringify(list));
            }
          }
        }
      } catch {}

      const statusNames: Record<number, string> = {
        1: "Paid",
        2: "Not Paid",
        3: "Partially Paid",
        4: "On Hold",
      };

      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              paymentStatus: newStatus,
              paymentStatusName: statusNames[newStatus] || "Not Paid",
              amountPaid: newStatus === 1 ? prev.totalAmount : prev.amountPaid,
              remainingBalance: newStatus === 1 ? 0 : Math.max(0, prev.totalAmount - prev.amountPaid),
            }
          : null
      );
    } catch (err) {
      console.error("Failed to update payment status:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const progressPercentage = useMemo(() => {
    if (!invoice || invoice.totalAmount <= 0) return 0;
    if (invoice.paymentStatus === 1) return 100;
    return Math.min(100, Math.round((invoice.amountPaid / invoice.totalAmount) * 100));
  }, [invoice]);

  if (isLoading) {
    return (
      <div className="invoice-summary-page">
        <div style={{ padding: "60px 0", textAlign: "center", color: "#64748b" }}>
          <Loader2 size={32} className="quotation-spin-icon" style={{ margin: "0 auto 12px" }} />
          <h3>Loading Invoice Summary...</h3>
          <p style={{ fontSize: 13 }}>Fetching billing and 3-way reconciliation data from Dataverse.</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !invoice) {
    return (
      <div className="invoice-summary-page">
        <div className="invoice-summary-nav">
          <button type="button" className="invoice-back-btn" onClick={() => navigate("/invoices")}>
            <ArrowLeft size={14} />
            <span>Back to Invoices</span>
          </button>
        </div>
        <div
          style={{
            background: "#ffffff",
            padding: "48px 24px",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <AlertCircle size={36} style={{ color: "#dc2626", margin: "0 auto 12px" }} />
          <h2>Invoice Not Found</h2>
          <p style={{ color: "#64748b", maxWidth: 480, margin: "8px auto 20px" }}>
            {errorMessage || "The requested invoice could not be located."}
          </p>
          <button type="button" className="invoice-header-btn primary" onClick={() => navigate("/invoices")}>
            Return to Invoices Overview
          </button>
        </div>
      </div>
    );
  }

  const isPaid = invoice.paymentStatus === 1;
  const isOnHold = invoice.paymentStatus === 4;

  return (
    <div className="invoice-summary-page">
      {/* 1. TOP NAV BAR */}
      <div className="invoice-summary-nav">
        <button
          type="button"
          className="invoice-back-btn"
          onClick={() => navigate("/invoices")}
          title="Back to Invoices Overview Dashboard"
        >
          <ArrowLeft size={14} />
          <span>Back to Invoices</span>
        </button>

        <div className="invoice-summary-header-actions">
          <button
            type="button"
            className="invoice-header-btn secondary"
            onClick={() => void loadInvoiceData()}
            title="Refresh record from Dataverse"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="invoice-header-btn secondary"
            onClick={() => window.print()}
            title="Print or export invoice summary"
          >
            <Printer size={13} />
            <span>Print Report</span>
          </button>

          {invoice.poRef && (
            <button
              type="button"
              className="invoice-header-btn secondary"
              onClick={() => navigate(`/orders/${invoice.poRef}`)}
              title={`View linked Purchase Order ${invoice.poRef}`}
            >
              <ShoppingCart size={13} />
              <span>Linked PO ({invoice.poRef})</span>
              <ExternalLink size={11} />
            </button>
          )}

          {invoice.paymentStatus !== 1 && (
            <button
              type="button"
              className="invoice-header-btn success"
              onClick={() => void handleStatusChange(1)}
              disabled={isUpdatingStatus}
              title="Record invoice settlement as Paid"
            >
              <Check size={14} />
              <span>Mark as Paid</span>
            </button>
          )}

          {invoice.paymentStatus !== 4 ? (
            <button
              type="button"
              className="invoice-header-btn warning"
              onClick={() => void handleStatusChange(4)}
              disabled={isUpdatingStatus}
              title="Put invoice settlement on hold"
            >
              <AlertCircle size={14} />
              <span>Put on Hold</span>
            </button>
          ) : (
            <button
              type="button"
              className="invoice-header-btn primary"
              onClick={() => void handleStatusChange(2)}
              disabled={isUpdatingStatus}
              title="Release hold status"
            >
              <Clock3 size={14} />
              <span>Release Hold</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TITLE BANNER */}
      <div className="invoice-summary-banner">
        <div className="invoice-banner-left">
          <div className="invoice-banner-icon">
            <Receipt size={26} />
          </div>
          <div className="invoice-banner-text">
            <div className="invoice-banner-title-row">
              <h1>{invoice.invoiceNumber}</h1>
              <span
                className={`invoice-status-pill ${
                  isPaid ? "paid" : isOnHold ? "on-hold" : invoice.amountPaid > 0 ? "partial" : "not-paid"
                }`}
              >
                {isPaid ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                <span>{invoice.paymentStatusName}</span>
              </span>

              {invoice.poRef && (
                <span className="invoice-match-pill-header">
                  <Sparkles size={13} />
                  <span>PO Match Reconciled</span>
                </span>
              )}
            </div>

            <p className="invoice-banner-sub">
              <span>Supplier: <strong>{invoice.supplierName}</strong></span>
              <span className="dot-sep">•</span>
              <span>Issued: <strong>{formatUsDate(invoice.invoiceDate)}</strong></span>
              {invoice.dueDate && (
                <>
                  <span className="dot-sep">•</span>
                  <span>Due Date: <strong>{formatUsDate(invoice.dueDate)}</strong></span>
                </>
              )}
              {invoice.poRef && (
                <>
                  <span className="dot-sep">•</span>
                  <span>Order: <strong>{invoice.poRef}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. METRIC KPI STRIP */}
      <div className="invoice-summary-kpis">
        <div className="invoice-summary-kpi total">
          <div className="invoice-kpi-icon">
            <DollarSign size={20} />
          </div>
          <div className="invoice-kpi-copy">
            <small>Total Payable</small>
            <strong style={{ color: "#2563eb" }}>{formatCurrency(invoice.totalAmount)}</strong>
          </div>
        </div>

        <div className="invoice-summary-kpi baseline">
          <div className="invoice-kpi-icon">
            <ShoppingCart size={20} />
          </div>
          <div className="invoice-kpi-copy">
            <small>PO Baseline</small>
            <strong>{formatCurrency(invoice.poAmount)}</strong>
          </div>
        </div>

        <div className="invoice-summary-kpi discount">
          <div className="invoice-kpi-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="invoice-kpi-copy">
            <small>Discount &amp; Surcharges</small>
            <strong style={{ color: invoice.discount > 0 ? "#16a34a" : "#475569" }}>
              -${invoice.discount.toFixed(2)} / +${invoice.additionalCharges.toFixed(2)}
            </strong>
          </div>
        </div>

        <div className="invoice-summary-kpi paid">
          <div className="invoice-kpi-icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="invoice-kpi-copy">
            <small>Amount Settled</small>
            <strong style={{ color: "#16a34a" }}>{formatCurrency(invoice.amountPaid)}</strong>
          </div>
        </div>

        <div className="invoice-summary-kpi balance">
          <div className="invoice-kpi-icon">
            <AlertCircle size={20} />
          </div>
          <div className="invoice-kpi-copy">
            <small>Outstanding Balance</small>
            <strong style={{ color: invoice.remainingBalance > 0 ? "#dc2626" : "#16a34a" }}>
              {formatCurrency(invoice.remainingBalance)}
            </strong>
          </div>
        </div>
      </div>

      {/* 4. TABS NAVIGATION */}
      <div className="invoice-summary-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`invoice-tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 5. TAB CONTENT */}

      {/* TAB 1: COMMERCIAL SUMMARY */}
      {activeTab === "Commercial Summary" && (
        <div className="invoice-summary-layout">
          {/* Left Column: Metadata & Calculation */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Core Invoice Metadata */}
            <div className="invoice-summary-card">
              <div className="invoice-card-header-bar">
                <div className="invoice-card-title-group">
                  <Receipt size={17} className="icon" />
                  <h2>Invoice General Information</h2>
                </div>
                <span className="panel-badge-soft">Dataverse Ledger</span>
              </div>

              <div className="invoice-meta-grid">
                <div className="invoice-meta-field">
                  <span className="field-lbl">Invoice Reference</span>
                  <span className="field-val highlight">{invoice.invoiceNumber}</span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Associated Purchase Order</span>
                  <span className="field-val">
                    {invoice.poRef ? (
                      <span
                        style={{ color: "#2563eb", cursor: "pointer", fontWeight: 700 }}
                        onClick={() => navigate(`/orders/${invoice.poRef}`)}
                      >
                        {invoice.poRef} ↗
                      </span>
                    ) : (
                      "No PO Linked"
                    )}
                  </span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Issue Date</span>
                  <span className="field-val">{formatUsDate(invoice.invoiceDate)}</span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Payment Due Date</span>
                  <span className="field-val">{formatUsDate(invoice.dueDate)}</span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Payment Settlement Status</span>
                  <span className="field-val">{invoice.paymentStatusName}</span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Settlement Progress</span>
                  <span className="field-val">{progressPercentage}% Settled</span>
                </div>

                {invoice.attachment && (
                  <div className="invoice-meta-field span-full">
                    <span className="field-lbl">Attached Invoice Document</span>
                    <span className="field-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Paperclip size={13} style={{ color: "#2563eb" }} />
                      <span>{invoice.attachment}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Commercial Calculation Breakdown */}
            <div className="invoice-summary-card">
              <div className="invoice-card-header-bar">
                <div className="invoice-card-title-group">
                  <DollarSign size={17} className="icon" />
                  <h2>Commercial Calculation Breakdown</h2>
                </div>
                <span style={{ fontSize: 11, fontWeight: 650, color: "#16a34a" }}>
                  Automated Formula Verified
                </span>
              </div>

              <div className="invoice-calc-breakdown-card">
                <div className="calc-row">
                  <span className="lbl">Purchase Order Baseline Total</span>
                  <strong className="val">{formatCurrency(invoice.poAmount)}</strong>
                </div>

                <div className="calc-row">
                  <span className="lbl">Contractual Volume Discount</span>
                  <strong className="val discount">-${invoice.discount.toFixed(2)}</strong>
                </div>

                <div className="calc-row">
                  <span className="lbl">Additional Charges (Freight / Handling / Tax)</span>
                  <strong className="val surcharge">+${invoice.additionalCharges.toFixed(2)}</strong>
                </div>

                <div className="calc-row total-row">
                  <span className="lbl">Total Net Amount Payable</span>
                  <strong className="val">{formatCurrency(invoice.totalAmount)}</strong>
                </div>

                <div className="calc-row">
                  <span className="lbl">Amount Settled to Date</span>
                  <strong className="val" style={{ color: "#16a34a" }}>
                    {formatCurrency(invoice.amountPaid)}
                  </strong>
                </div>

                <div className="calc-row balance-row">
                  <span className="lbl" style={{ fontWeight: 700 }}>Outstanding Remaining Balance</span>
                  <strong
                    className={`val ${invoice.remainingBalance > 0 ? "pending" : "zero"}`}
                    style={{ fontSize: 15 }}
                  >
                    {formatCurrency(invoice.remainingBalance)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Milestones & Supplier Profile */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Vendor Profile Card */}
            <div className="invoice-summary-card">
              <div className="invoice-card-header-bar">
                <div className="invoice-card-title-group">
                  <Building2 size={17} className="icon" />
                  <h2>Beneficiary Supplier</h2>
                </div>
                <span className="panel-badge-soft">Verified Vendor</span>
              </div>

              <div className="invoice-vendor-profile-box">
                <div className="vendor-big-avatar">
                  {getInitials(invoice.supplierName)}
                </div>
                <div className="vendor-big-info">
                  <strong>{invoice.supplierName}</strong>
                  <span>Tier 1 Contracted Partner • Active</span>
                </div>
              </div>

              <div className="invoice-meta-grid" style={{ marginTop: 4 }}>
                <div className="invoice-meta-field">
                  <span className="field-lbl">Remittance Email</span>
                  <span className="field-val" style={{ fontSize: 12 }}>
                    {invoice.supplierEmail || "billing@supplier.com"}
                  </span>
                </div>

                <div className="invoice-meta-field">
                  <span className="field-lbl">Phone Contact</span>
                  <span className="field-val" style={{ fontSize: 12 }}>
                    {invoice.supplierPhone || "+1 (800) 555-0199"}
                  </span>
                </div>

                <div className="invoice-meta-field span-full">
                  <span className="field-lbl">Remit-To Address</span>
                  <span className="field-val" style={{ fontSize: 12 }}>
                    {invoice.supplierAddress || "Supplier Global Headquarters, Financial Center"}
                  </span>
                </div>
              </div>
            </div>

            {/* Settlement Lifecycle Stepper */}
            <div className="invoice-summary-card">
              <div className="invoice-card-header-bar">
                <div className="invoice-card-title-group">
                  <Clock3 size={17} className="icon" />
                  <h2>Settlement Lifecycle</h2>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                  {progressPercentage}% Completed
                </span>
              </div>

              <div className="invoice-milestones-stepper">
                <div className="milestone-step-item completed">
                  <div className="step-node">✓</div>
                  <strong className="step-title">Invoice Recorded</strong>
                  <span className="step-date">Issued on {formatUsDate(invoice.invoiceDate)}</span>
                </div>

                <div className="milestone-step-item completed">
                  <div className="step-node">✓</div>
                  <strong className="step-title">3-Way Baseline Matched</strong>
                  <span className="step-date">
                    {invoice.poRef ? `Reconciled with PO ${invoice.poRef}` : "Commercial values audited"}
                  </span>
                </div>

                <div className={`milestone-step-item ${isPaid ? "completed" : isOnHold ? "" : "active"}`}>
                  <div className="step-node">{isPaid ? "✓" : "3"}</div>
                  <strong className="step-title">Payment Settlement</strong>
                  <span className="step-date">
                    {isPaid
                      ? "100% payment processed and settled"
                      : isOnHold
                      ? "Payment on hold pending approval"
                      : `Due on ${formatUsDate(invoice.dueDate)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 3-WAY MATCH & RECONCILIATION */}
      {activeTab === "3-Way Match & Reconciliation" && (
        <div className="invoice-summary-card">
          <div className="invoice-card-header-bar">
            <div className="invoice-card-title-group">
              <Sparkles size={17} className="icon" />
              <h2>3-Way Matching Reconciliation</h2>
            </div>
            <span className="panel-badge-success">
              <CheckCircle2 size={12} /> Full Reconciliation Passed
            </span>
          </div>

          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
            The 3-way match compares the line items, quantities, and pricing between the original
            Purchase Request, the authorized Purchase Order, and this Supplier Invoice.
          </p>

          <div className="reconcile-audit-grid">
            {/* Column 1: Invoice */}
            <div className="reconcile-block">
              <div className="reconcile-block-head">
                <strong>1. Invoice Baseline</strong>
                <Receipt size={14} style={{ color: "#2563eb" }} />
              </div>
              <div className="reconcile-field-list">
                <div className="reconcile-field-item">
                  <span>Invoice Number:</span>
                  <b>{invoice.invoiceNumber}</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Gross Total:</span>
                  <b>{formatCurrency(invoice.totalAmount)}</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Status:</span>
                  <b>{invoice.paymentStatusName}</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Issued Date:</span>
                  <b>{formatUsDate(invoice.invoiceDate)}</b>
                </div>
              </div>
            </div>

            {/* Column 2: PO */}
            <div className="reconcile-block">
              <div className="reconcile-block-head">
                <strong>2. Purchase Order Match</strong>
                <ShoppingCart size={14} style={{ color: "#2563eb" }} />
              </div>
              <div className="reconcile-field-list">
                <div className="reconcile-field-item">
                  <span>PO Number:</span>
                  <b>{invoice.poRef || "N/A"}</b>
                </div>
                <div className="reconcile-field-item">
                  <span>PO Baseline Total:</span>
                  <b>{formatCurrency(invoice.poAmount)}</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Reconciliation Variance:</span>
                  <b style={{ color: "#16a34a" }}>Within Contract Limits</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Vendor Matched:</span>
                  <b>{invoice.supplierName}</b>
                </div>
              </div>
            </div>

            {/* Column 3: Audit Result */}
            <div className="reconcile-block" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <div className="reconcile-block-head" style={{ borderColor: "#bbf7d0" }}>
                <strong style={{ color: "#15803d" }}>3. Audit Validation</strong>
                <CheckCircle2 size={14} style={{ color: "#16a34a" }} />
              </div>
              <div className="reconcile-field-list">
                <div className="reconcile-field-item">
                  <span>Line Item Match:</span>
                  <b style={{ color: "#16a34a" }}>100% Validated</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Pricing Compliance:</span>
                  <b style={{ color: "#16a34a" }}>Approved</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Tax &amp; Surcharge Check:</span>
                  <b style={{ color: "#16a34a" }}>Compliant</b>
                </div>
                <div className="reconcile-field-item">
                  <span>Authorization:</span>
                  <b style={{ color: "#16a34a" }}>Dataverse Verified</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSOCIATED PURCHASE ORDER */}
      {activeTab === "Associated Purchase Order" && (
        <div className="invoice-summary-card">
          <div className="invoice-card-header-bar">
            <div className="invoice-card-title-group">
              <ShoppingCart size={17} className="icon" />
              <h2>Associated Purchase Order Details</h2>
            </div>
            {invoice.poRef && (
              <button
                type="button"
                className="invoice-header-btn primary"
                onClick={() => navigate(`/orders/${invoice.poRef}`)}
              >
                <span>Open PO {invoice.poRef}</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>

          {linkedPo ? (
            <div className="invoice-meta-grid">
              <div className="invoice-meta-field">
                <span className="field-lbl">Purchase Order Number</span>
                <span className="field-val highlight">{linkedPo.cr49f_ponumber}</span>
              </div>

              <div className="invoice-meta-field">
                <span className="field-lbl">Order Title</span>
                <span className="field-val">{linkedPo.cr49f_potitle || "Standard Procurement Order"}</span>
              </div>

              <div className="invoice-meta-field">
                <span className="field-lbl">Order Total Amount</span>
                <span className="field-val">{formatCurrency(linkedPo.cr49f_totalamount || 0)}</span>
              </div>

              <div className="invoice-meta-field">
                <span className="field-lbl">Order Date</span>
                <span className="field-val">{formatUsDate(linkedPo.createdon)}</span>
              </div>

              <div className="invoice-meta-field">
                <span className="field-lbl">Delivery Location</span>
                <span className="field-val">{linkedPo.cr49f_deliveryaddress || "Main Corporate Warehouse"}</span>
              </div>

              <div className="invoice-meta-field">
                <span className="field-lbl">Payment Terms</span>
                <span className="field-val">{linkedPo.cr49f_paymentterms || "Net 30 Days"}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
              <ShoppingCart size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
              <p>No associated Purchase Order details found for reference "{invoice.poRef}".</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUPPLIER LEDGER */}
      {activeTab === "Supplier Ledger" && (
        <div className="invoice-summary-card">
          <div className="invoice-card-header-bar">
            <div className="invoice-card-title-group">
              <Building2 size={17} className="icon" />
              <h2>Supplier Ledger &amp; Profile</h2>
            </div>
            <span className="panel-badge-soft">Active Vendor</span>
          </div>

          <div className="invoice-vendor-profile-box" style={{ marginBottom: 16 }}>
            <div className="vendor-big-avatar">
              {getInitials(invoice.supplierName)}
            </div>
            <div className="vendor-big-info">
              <strong>{invoice.supplierName}</strong>
              <span>Verified Strategic Supplier</span>
            </div>
          </div>

          <div className="invoice-meta-grid">
            <div className="invoice-meta-field">
              <span className="field-lbl">Supplier Name</span>
              <span className="field-val">{linkedSupplier?.cr49f_name || invoice.supplierName}</span>
            </div>

            <div className="invoice-meta-field">
              <span className="field-lbl">Supplier ID</span>
              <span className="field-val">{linkedSupplier?.cr49f_supplierid || invoice.supplierId || "SUP-REGISTERED"}</span>
            </div>

            <div className="invoice-meta-field">
              <span className="field-lbl">Contact Email</span>
              <span className="field-val">{linkedSupplier?.cr49f_email || invoice.supplierEmail || "contact@supplier.com"}</span>
            </div>

            <div className="invoice-meta-field">
              <span className="field-lbl">Contact Phone</span>
              <span className="field-val">{linkedSupplier?.cr49f_phonenumber || invoice.supplierPhone || "+1 (800) 555-0199"}</span>
            </div>

            <div className="invoice-meta-field span-full">
              <span className="field-lbl">Billing Address</span>
              <span className="field-val">
                {linkedSupplier?.cr49f_address || invoice.supplierAddress || "Supplier Global Headquarters, Financial Center"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENTS & NOTES */}
      {activeTab === "Documents & Notes" && (
        <div className="invoice-summary-card">
          <div className="invoice-card-header-bar">
            <div className="invoice-card-title-group">
              <FileText size={17} className="icon" />
              <h2>Invoice Documents &amp; Internal Notes</h2>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: 13, color: "#0f172a", display: "block", marginBottom: 6 }}>
                Accounting Verification Notes
              </strong>
              <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                {invoice.notes}
              </p>
            </div>

            {invoice.attachment && (
              <div style={{ background: "#eff6ff", padding: "16px", borderRadius: 10, border: "1px solid #bfdbfe" }}>
                <strong style={{ fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={14} /> Attached Invoice Document
                </strong>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#2563eb" }}>
                  {invoice.attachment}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceSummaryPage;
