import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Info,
  Lock,
  Mail,
  MapPin,
  Package,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Truck,
} from "lucide-react";

import {
  getSupplierRfqDetails,
  saveSupplierResponseDraft,
  submitSupplierResponse,
  calculateLineTotal,
  type FullSupplierResponse,
  type SupplierResponseLineItem,
} from "../../Services/RfqSupplierResponseService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import type { Cr49f_requestforqoutations } from "../../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";

import "../../Styles/SupplierPortal.css";

interface SupplierRfqResponsePageProps {
  userEmail?: string;
  userName?: string;
}

export const SupplierRfqResponsePage: React.FC<SupplierRfqResponsePageProps> = ({
  userEmail,
  userName,
}) => {
  const { id: rfqId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rfq, setRfq] = useState<Cr49f_requestforqoutations | null>(null);
  const [response, setResponse] = useState<FullSupplierResponse | null>(null);
  const [lines, setLines] = useState<SupplierResponseLineItem[]>([]);

  // Commercial terms (Parent response level)
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>("Net 30 days");
  const [warranty, setWarranty] = useState<string>("1 year standard warranty");

  const [activeSupplier, setActiveSupplier] = useState<Cr49f_suppliers | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // Accordion & Interactive states
  const [expandedLineIndices, setExpandedLineIndices] = useState<Set<number>>(new Set([0]));
  const [isScopeExpanded, setIsScopeExpanded] = useState<boolean>(false);

  // 1. Resolve Supplier Identity
  useEffect(() => {
    let isMounted = true;
    const resolveSup = async () => {
      try {
        const suppRes = await Cr49f_suppliersService.getAll();
        const allSupp = suppRes.success && suppRes.data ? suppRes.data : [];

        if (isMounted) {
          const matched = allSupp.find(
            (s) =>
              (userEmail && s.cr49f_email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && s.cr49f_contactperson?.toLowerCase() === userName.toLowerCase()) ||
              (userName && s.cr49f_name?.toLowerCase() === userName.toLowerCase())
          );

          const savedSupId = localStorage.getItem("procurement360_active_supplier_id");
          const preferred =
            (savedSupId && allSupp.find((s) => s.cr49f_supplierid === savedSupId || s.cr49f_supplierid1 === savedSupId)) ||
            matched ||
            allSupp[0] ||
            null;

          setActiveSupplier(preferred);
        }
      } catch (err) {
        console.warn("Failed to load suppliers:", err);
      }
    };

    void resolveSup();
    return () => {
      isMounted = false;
    };
  }, [userEmail, userName]);

  // 2. Load RFQ & response details
  const loadData = async () => {
    if (!rfqId || !activeSupplier) return;
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      const supId = activeSupplier.cr49f_supplierid1 || activeSupplier.cr49f_supplierid;
      const res = await getSupplierRfqDetails(rfqId, supId, activeSupplier.cr49f_email);

      setRfq(res.rfq);
      setResponse(res.response);
      setLines(res.response.lines);

      if (res.response.deliveryDate) {
        const d = new Date(res.response.deliveryDate);
        if (!isNaN(d.getTime())) {
          setDeliveryDate(d.toISOString().slice(0, 10));
        } else {
          setDeliveryDate(res.response.deliveryDate);
        }
      }
      if (res.response.paymentTerms) setPaymentTerms(res.response.paymentTerms);
      if (res.response.warranty) setWarranty(res.response.warranty);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load RFQ.";
      if (msg.includes("Access Denied") || msg.includes("not authorized")) {
        setAccessDenied(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [rfqId, activeSupplier]);

  const isSubmitted = response?.status === "Submitted";

  // Handle line item field edits with immediate recalculation
  const handleLineChange = (
    index: number,
    field: keyof SupplierResponseLineItem,
    value: string | number | boolean
  ) => {
    if (isSubmitted) return;

    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };

      if (
        field === "unitPrice" ||
        field === "offeredQuantity" ||
        field === "discount" ||
        field === "tax" ||
        field === "additionalChargePercentage"
      ) {
        const numVal = Math.max(0, Number(value) || 0);
        (target as Record<string, unknown>)[field] = numVal;
      } else if (field === "anyAdditionalCharges") {
        target.anyAdditionalCharges = Boolean(value);
        if (!target.anyAdditionalCharges) {
          target.additionalChargePercentage = 0;
        }
      } else {
        (target as Record<string, unknown>)[field] = value;
      }

      // Re-calculate financial components using central calculateLineTotal helper
      const calc = calculateLineTotal(
        target.unitPrice,
        target.offeredQuantity,
        target.discount,
        target.tax,
        target.anyAdditionalCharges,
        target.additionalChargePercentage
      );
      target.totalPrice = calc.totalPrice;

      updated[index] = target;
      return updated;
    });
  };

  // Comprehensive Financial Summary
  const quotationFinancials = useMemo(() => {
    let grossTotal = 0;
    let discountTotal = 0;
    let addlChargesTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const line of lines) {
      const calc = calculateLineTotal(
        line.unitPrice,
        line.offeredQuantity,
        line.discount,
        line.tax,
        line.anyAdditionalCharges,
        line.additionalChargePercentage
      );
      grossTotal += calc.baseAmount;
      discountTotal += calc.discountAmount;
      addlChargesTotal += calc.additionalChargesAmount;
      taxTotal += calc.taxAmount;
      grandTotal += calc.totalPrice;
    }

    return {
      grossTotal: Math.round(grossTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      addlChargesTotal: Math.round(addlChargesTotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [lines]);

  // Completed items count & progress
  const completedLinesCount = useMemo(() => {
    return lines.filter((l) => l.unitPrice > 0 && l.offeredQuantity > 0).length;
  }, [lines]);

  const progressPercent = useMemo(() => {
    if (lines.length === 0) return 0;
    const lineWeight = (completedLinesCount / lines.length) * 80;
    const termsWeight = deliveryDate ? 20 : 0;
    return Math.min(100, Math.round(lineWeight + termsWeight));
  }, [completedLinesCount, lines.length, deliveryDate]);

  // Submission Deadline & Days Remaining calculation
  const deadlineInfo = useMemo(() => {
    if (!rfq?.cr49f_submissiondeadline) {
      return {
        daysText: "Open",
        dueSubtext: "No fixed deadline",
        formattedDeadline: "Open / Ongoing",
      };
    }
    const deadline = new Date(rfq.cr49f_submissiondeadline);
    if (isNaN(deadline.getTime())) {
      return {
        daysText: "Open",
        dueSubtext: "No fixed deadline",
        formattedDeadline: String(rfq.cr49f_submissiondeadline),
      };
    }
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const formattedDeadline = deadline.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    if (diffDays < 0) {
      return {
        daysText: "Expired",
        dueSubtext: "Deadline passed",
        formattedDeadline,
      };
    }
    if (diffDays === 0) {
      return {
        daysText: "Due today",
        dueSubtext: "Due by 6:00 PM IST",
        formattedDeadline,
      };
    }
    return {
      daysText: `${diffDays} days`,
      dueSubtext: "Due by 6:00 PM IST",
      formattedDeadline,
    };
  }, [rfq?.cr49f_submissiondeadline]);

  // Helper currency formatter (INR symbol ₹ matching reference design)
  const formatCurrency = (val: number) => {
    return (
      "₹" +
      (Number(val) || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Toggle single line accordion
  const toggleLineExpanded = (idx: number) => {
    setExpandedLineIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Toggle all lines expanded / collapsed
  const toggleAllLines = () => {
    if (expandedLineIndices.size === lines.length) {
      setExpandedLineIndices(new Set());
    } else {
      setExpandedLineIndices(new Set(lines.map((_, i) => i)));
    }
  };

  // Save as Draft action
  const handleSaveDraft = async () => {
    if (!response || isSubmitted) return;
    try {
      setSavingDraft(true);
      setError(null);
      setSuccessMsg(null);

      const formattedLines = lines.map((l) => ({
        id: l.id,
        unitPrice: l.unitPrice,
        offeredQuantity: l.offeredQuantity,
        discount: l.discount,
        tax: l.tax,
        anyAdditionalCharges: l.anyAdditionalCharges,
        additionalChargePercentage: l.additionalChargePercentage,
        additionalChargesDetails: l.additionalChargesDetails || l.comments || "",
        leadTime: l.leadTime,
        comments: l.additionalChargesDetails || l.comments,
      }));

      await saveSupplierResponseDraft(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation draft saved successfully in Dataverse! You can continue updating anytime.");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Response action
  const handleSubmitResponse = async () => {
    if (!response || isSubmitted) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      // Validation check: Unit Price & Offered Quantity for all lines
      for (const [idx, l] of lines.entries()) {
        if (!l.unitPrice || l.unitPrice <= 0) {
          throw new Error(`Line #${idx + 1} (${l.itemName}) requires a valid quoted unit price greater than ₹0.`);
        }
        if (!l.offeredQuantity || l.offeredQuantity <= 0) {
          throw new Error(`Line #${idx + 1} (${l.itemName}) requires an offered quantity greater than 0.`);
        }
        if (l.anyAdditionalCharges && l.additionalChargePercentage > 0 && !l.additionalChargesDetails?.trim()) {
          throw new Error(
            `Line #${idx + 1} has an additional charge of ${l.additionalChargePercentage}%. Please provide description/breakdown in Additional Charges Details.`
          );
        }
      }

      if (!deliveryDate) {
        throw new Error("Please select a Promised Delivery Date before submitting your quotation.");
      }

      const formattedLines = lines.map((l) => ({
        id: l.id,
        unitPrice: l.unitPrice,
        offeredQuantity: l.offeredQuantity,
        discount: l.discount,
        tax: l.tax,
        anyAdditionalCharges: l.anyAdditionalCharges,
        additionalChargePercentage: l.additionalChargePercentage,
        additionalChargesDetails: l.additionalChargesDetails || l.comments || "",
        leadTime: l.leadTime,
        comments: l.additionalChargesDetails || l.comments,
      }));

      await submitSupplierResponse(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
      });

      setSuccessMsg("Quotation submitted successfully! The response is now locked and submitted to Procurement.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  // Access Denied Screen (Strict Dataverse Authorization)
  if (accessDenied) {
    return (
      <div className="supplier-portal-container supplier-rfq-response-page">
        <div className="supplier-denied-box">
          <div className="supplier-denied-icon">
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: 13, color: "#475569", margin: "0 0 20px" }}>
            You do not have authorization to view or respond to this RFQ. Only invited suppliers with verified credentials can submit quotations.
          </p>
          <button
            type="button"
            className="supplier-btn-action primary"
            onClick={() => navigate("/supplier-rfqs")}
          >
            <ArrowLeft size={13} />
            Back to My RFQs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="supplier-portal-container supplier-rfq-response-page">
      {/* Top Bar Navigation */}
      <div className="supplier-response-top-bar">
        <button
          type="button"
          className="supplier-btn-back-link"
          onClick={() => navigate("/supplier-rfqs")}
        >
          <ArrowLeft size={15} />
          <span>Back to all RFQs</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="supplier-badge-active">
            <Building2 size={13} />
            {activeSupplier?.cr49f_name || "Supplier"}
            {activeSupplier?.cr49f_supplierid1 ? ` (${activeSupplier.cr49f_supplierid1})` : ""}
          </span>
          {response && (
            <span className={`supplier-status-pill ${response.status.toLowerCase()}`}>
              {response.status === "Submitted" ? (
                <CheckCircle2 size={12} />
              ) : response.status === "Draft" ? (
                <Clock size={12} />
              ) : (
                <Mail size={12} />
              )}
              {response.status}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>
          <RefreshCw size={24} className="rfq-spinner" style={{ margin: "0 auto 12px" }} />
          Loading RFQ details and quotation lines from Dataverse...
        </div>
      ) : error && !rfq ? (
        <div style={{ padding: 32, textAlign: "center", color: "#dc2626" }}>
          <AlertCircle size={24} style={{ margin: "0 auto 10px" }} />
          {error}
        </div>
      ) : (
        <div className="supplier-response-view">
          {/* Notifications */}
          {error && (
            <div className="supplier-feedback-banner error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="supplier-feedback-banner success">
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submitted Banner */}
          {isSubmitted && (
            <div className="supplier-submitted-banner">
              <div className="supplier-submitted-banner-left">
                <div className="supplier-submitted-icon">
                  <Check size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Quotation Successfully Submitted
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.9 }}>
                    Submitted on {response.responseDate ? new Date(response.responseDate).toLocaleString() : "Recently"}. This response is locked for review by the Procurement team.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                <Lock size={13} />
                Read-Only
              </div>
            </div>
          )}

          {/* Hero Banner Card */}
          <div className="supplier-hero-card">
            <div className="supplier-hero-left">
              {/* Top Tags */}
              <div className="supplier-hero-tag-row">
                <span className="supplier-hero-id-pill">
                  {rfq?.cr49f_rfqnumber || "RFQ-1005"}
                </span>
                <span className="supplier-hero-status-pill">
                  <span className="supplier-hero-dot" />
                  {isSubmitted ? "RESPONSE SUBMITTED" : "RESPONSE REQUESTED"}
                </span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="supplier-hero-title">
                {rfq?.cr49f_rfqtitle || "Office Equipments"}
              </h1>
              <p className="supplier-hero-subtitle">
                Review the request details and submit your most competitive quotation.
              </p>

              {/* Meta specifications footer */}
              <div className="supplier-hero-meta-row">
                <div className="supplier-hero-meta-item">
                  <div className="supplier-hero-meta-icon">
                    <MapPin size={16} />
                  </div>
                  <div className="supplier-hero-meta-text">
                    <span className="supplier-hero-meta-label">DELIVERY LOCATION</span>
                    <span className="supplier-hero-meta-val">
                      {rfq?.cr49f_deliverylocation || "Jaipur, Rajasthan"}
                    </span>
                  </div>
                </div>

                <div className="supplier-hero-meta-item">
                  <div className="supplier-hero-meta-icon">
                    <Calendar size={16} />
                  </div>
                  <div className="supplier-hero-meta-text">
                    <span className="supplier-hero-meta-label">SUBMISSION DEADLINE</span>
                    <span className="supplier-hero-meta-val">
                      {deadlineInfo.formattedDeadline}
                    </span>
                  </div>
                </div>

                <div className="supplier-hero-meta-item">
                  <div className="supplier-hero-meta-icon">
                    <Package size={16} />
                  </div>
                  <div className="supplier-hero-meta-text">
                    <span className="supplier-hero-meta-label">REQUESTED ITEMS</span>
                    <span className="supplier-hero-meta-val">
                      {lines.length} line items
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Remaining Translucent Card */}
            <div className="supplier-hero-time-card">
              <div className="supplier-hero-time-icon">
                <Clock size={18} />
              </div>
              <div className="supplier-hero-time-info">
                <span className="supplier-hero-time-label">TIME REMAINING</span>
                <span className="supplier-hero-time-val">{deadlineInfo.daysText}</span>
                <span className="supplier-hero-time-sub">{deadlineInfo.dueSubtext}</span>
              </div>
            </div>
          </div>

          {/* Scope & Specifications Banner Card */}
          <div className="supplier-scope-card">
            <div className="supplier-scope-card-header">
              <div className="supplier-scope-left">
                <div className="supplier-scope-icon-wrap">
                  <Info size={15} />
                </div>
                <span className="supplier-scope-title">Scope &amp; specifications</span>
                <span className="supplier-scope-rfq-name">
                  {rfq?.cr49f_rfqtitle || "Procurement Scope"}
                </span>
              </div>

              <button
                type="button"
                className="supplier-scope-toggle-btn"
                onClick={() => setIsScopeExpanded((prev) => !prev)}
              >
                <span>{isScopeExpanded ? "Hide details" : "View details"}</span>
                {isScopeExpanded ? <ChevronUp size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {isScopeExpanded && (
              <div className="supplier-scope-card-body">
                <div style={{ marginBottom: 10 }}>
                  <strong>Description &amp; Instructions:</strong>
                  <p style={{ margin: "4px 0 0", color: "#475569" }}>
                    {rfq?.cr49f_description || "Standard procurement scope for requested items. Review line items and specifications below to quote your best competitive rates and timelines."}
                  </p>
                </div>
                <div className="supplier-scope-meta-grid">
                  <div>
                    <span className="supplier-scope-label">RFQ Reference:</span> {rfq?.cr49f_rfqnumber || "—"}
                  </div>
                  <div>
                    <span className="supplier-scope-label">Delivery Destination:</span> {rfq?.cr49f_deliverylocation || "Main Hub"}
                  </div>
                  <div>
                    <span className="supplier-scope-label">Quotation Validity:</span> 30 Days from Submission
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Two-Column Quotation Layout */}
          <div className="supplier-quote-layout">
            {/* Left Column: Build Your Quotation & Lines */}
            <div className="supplier-quote-main">
              {/* Section Header */}
              <div className="supplier-quotation-header">
                <div className="supplier-quotation-header-left">
                  <div className="supplier-quotation-icon">
                    <Package size={17} />
                  </div>
                  <div>
                    <h2 className="supplier-quotation-title">Build your quotation</h2>
                    <p className="supplier-quotation-subtitle">
                      Enter commercial details for each requested item. Click any item card to expand and edit pricing.
                    </p>
                  </div>
                </div>

                <div className="supplier-quotation-header-right">
                  <span className="supplier-completed-pill">
                    {completedLinesCount} of {lines.length} completed
                  </span>
                  <button
                    type="button"
                    className="supplier-btn-toggle-all"
                    onClick={toggleAllLines}
                  >
                    {expandedLineIndices.size === lines.length ? "Collapse all" : "Expand all"}
                  </button>
                </div>
              </div>

              {/* Line Item Accordion Cards */}
              <div className="supplier-line-accordions-list">
                {lines.map((line, idx) => {
                  const isExpanded = expandedLineIndices.has(idx);
                  const calc = calculateLineTotal(
                    line.unitPrice,
                    line.offeredQuantity,
                    line.discount,
                    line.tax,
                    line.anyAdditionalCharges,
                    line.additionalChargePercentage
                  );
                  const seqNum = String(idx + 1).padStart(2, "0");

                  return (
                    <div
                      key={line.id || idx}
                      className={`supplier-line-accordion ${isExpanded ? "expanded" : ""}`}
                    >
                      {/* Clickable Card Header */}
                      <div
                        className="supplier-line-accordion-header"
                        onClick={() => toggleLineExpanded(idx)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                      >
                        <div className="supplier-line-accordion-header-left">
                          <span className="supplier-line-seq">{seqNum}</span>
                          <div className="supplier-line-icon-box">
                            <Package size={16} />
                          </div>
                          <div className="supplier-line-info">
                            <h4 className="supplier-line-name">{line.itemName}</h4>
                            <span className="supplier-line-category-code">
                              {(line.category || "GENERAL ACCESSORIES").toUpperCase()} • LOG-{seqNum}00
                            </span>
                          </div>
                        </div>

                        <div className="supplier-line-accordion-header-right">
                          <div className="supplier-line-metric">
                            <span className="supplier-line-metric-label">REQUESTED</span>
                            <span className="supplier-line-metric-val">
                              {line.requestedQuantity} unit
                            </span>
                          </div>

                          <div className="supplier-line-metric total">
                            <span className="supplier-line-metric-label">LINE TOTAL</span>
                            <span className="supplier-line-metric-val price">
                              {formatCurrency(calc.totalPrice)}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="supplier-line-chevron-btn"
                            aria-label={isExpanded ? "Collapse item" : "Expand item"}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Form Body */}
                      {isExpanded && (
                        <div className="supplier-line-accordion-body">
                          {/* 4-Column Pricing & Quantities */}
                          <div className="supplier-pricing-grid-4">
                            {/* Quoted Unit Price */}
                            <div className="supplier-input-block">
                              <label className="supplier-input-label">
                                <span>
                                  QUOTED UNIT PRICE <span className="supplier-req-star">*</span>
                                </span>
                              </label>
                              <div className="supplier-input-affix-wrap">
                                <span className="supplier-input-prefix">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="supplier-form-control has-prefix"
                                  placeholder="0.00"
                                  value={line.unitPrice === 0 ? "" : line.unitPrice}
                                  onChange={(e) => handleLineChange(idx, "unitPrice", e.target.value)}
                                  disabled={isSubmitted}
                                />
                              </div>
                            </div>

                            {/* Offered Quantity */}
                            <div className="supplier-input-block">
                              <label className="supplier-input-label">
                                <span>
                                  OFFERED QUANTITY <span className="supplier-req-star">*</span>
                                </span>
                                <span className="supplier-req-helper">
                                  Requested: {line.requestedQuantity}
                                </span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                className="supplier-form-control"
                                value={line.offeredQuantity}
                                onChange={(e) => handleLineChange(idx, "offeredQuantity", e.target.value)}
                                disabled={isSubmitted}
                              />
                            </div>

                            {/* Discount */}
                            <div className="supplier-input-block">
                              <label className="supplier-input-label">
                                <span>DISCOUNT</span>
                              </label>
                              <div className="supplier-input-affix-wrap">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="supplier-form-control has-suffix"
                                  placeholder="0"
                                  value={line.discount === 0 ? "" : line.discount}
                                  onChange={(e) => handleLineChange(idx, "discount", e.target.value)}
                                  disabled={isSubmitted}
                                />
                                <span className="supplier-input-suffix">%</span>
                              </div>
                            </div>

                            {/* Tax / GST / VAT */}
                            <div className="supplier-input-block">
                              <label className="supplier-input-label">
                                <span>TAX / GST / VAT</span>
                              </label>
                              <div className="supplier-input-affix-wrap">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="supplier-form-control has-suffix"
                                  placeholder="0"
                                  value={line.tax === 0 ? "" : line.tax}
                                  onChange={(e) => handleLineChange(idx, "tax", e.target.value)}
                                  disabled={isSubmitted}
                                />
                                <span className="supplier-input-suffix">%</span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Charges Section */}
                          <div className="supplier-charge-row-card">
                            <div className="supplier-charge-header">
                              <div className="supplier-charge-left">
                                <Truck size={15} color="#64748b" />
                                <div>
                                  <span className="supplier-charge-title">Additional charges</span>
                                  <span className="supplier-charge-desc">
                                    Freight, packaging, customs or tooling
                                  </span>
                                </div>
                              </div>

                              <div className="supplier-pill-toggle">
                                <button
                                  type="button"
                                  className={`supplier-pill-toggle-btn ${!line.anyAdditionalCharges ? "active" : ""}`}
                                  onClick={() => handleLineChange(idx, "anyAdditionalCharges", false)}
                                  disabled={isSubmitted}
                                >
                                  Included
                                </button>
                                <button
                                  type="button"
                                  className={`supplier-pill-toggle-btn ${line.anyAdditionalCharges ? "active" : ""}`}
                                  onClick={() => handleLineChange(idx, "anyAdditionalCharges", true)}
                                  disabled={isSubmitted}
                                >
                                  Add charges
                                </button>
                              </div>
                            </div>

                            {line.anyAdditionalCharges && (
                              <div className="supplier-charge-fields-grid">
                                <div className="supplier-input-block">
                                  <label className="supplier-input-label">
                                    <span>ADDITIONAL CHARGE (%) *</span>
                                  </label>
                                  <div className="supplier-input-affix-wrap">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      className="supplier-form-control has-suffix"
                                      placeholder="e.g. 5"
                                      value={line.additionalChargePercentage === 0 ? "" : line.additionalChargePercentage}
                                      onChange={(e) =>
                                        handleLineChange(idx, "additionalChargePercentage", e.target.value)
                                      }
                                      disabled={isSubmitted}
                                    />
                                    <span className="supplier-input-suffix">%</span>
                                  </div>
                                </div>

                                <div className="supplier-input-block">
                                  <label className="supplier-input-label">
                                    <span>CHARGES DETAILS &amp; DESCRIPTION *</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="supplier-form-control"
                                    placeholder="e.g. Express shipping &amp; wooden crating"
                                    value={line.additionalChargesDetails || ""}
                                    onChange={(e) =>
                                      handleLineChange(idx, "additionalChargesDetails", e.target.value)
                                    }
                                    disabled={isSubmitted}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Line Calculation Math Footer Strip */}
                          <div className="supplier-line-summary-strip">
                            <div className="supplier-line-summary-breakdown">
                              <span>Gross {formatCurrency(calc.baseAmount)}</span>
                              <span className="bullet">•</span>
                              <span>Discount - {formatCurrency(calc.discountAmount)}</span>
                              <span className="bullet">•</span>
                              {line.anyAdditionalCharges && (
                                <>
                                  <span>Addl Chg + {formatCurrency(calc.additionalChargesAmount)}</span>
                                  <span className="bullet">•</span>
                                </>
                              )}
                              <span>Tax {formatCurrency(calc.taxAmount)}</span>
                            </div>

                            <div className="supplier-line-summary-total">
                              <span>Total {formatCurrency(calc.totalPrice)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Commercial Terms Card */}
              <div className="supplier-terms-card">
                <div className="supplier-terms-header">
                  <div className="supplier-terms-icon-wrap">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="supplier-terms-title">Commercial terms</h3>
                    <p className="supplier-terms-subtitle">
                      Confirm delivery, payment and warranty conditions.
                    </p>
                  </div>
                </div>

                <div className="supplier-terms-grid-3">
                  <div className="supplier-input-block">
                    <label className="supplier-input-label">
                      <span>
                        PROMISED DELIVERY DATE <span className="supplier-req-star">*</span>
                      </span>
                    </label>
                    <input
                      type="date"
                      className="supplier-form-control"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      disabled={isSubmitted}
                    />
                  </div>

                  <div className="supplier-input-block">
                    <label className="supplier-input-label">
                      <span>PAYMENT TERMS</span>
                    </label>
                    <select
                      className="supplier-form-control select"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      disabled={isSubmitted}
                    >
                      <option value="Net 30 days">Net 30 days</option>
                      <option value="Net 15 days">Net 15 days</option>
                      <option value="Net 45 days">Net 45 days</option>
                      <option value="Net 60 days">Net 60 days</option>
                      <option value="Immediate upon delivery">Immediate upon delivery</option>
                      <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                    </select>
                  </div>

                  <div className="supplier-input-block">
                    <label className="supplier-input-label">
                      <span>WARRANTY &amp; SUPPORT TERMS</span>
                    </label>
                    <input
                      type="text"
                      className="supplier-form-control"
                      placeholder="1 year standard warranty"
                      value={warranty}
                      onChange={(e) => setWarranty(e.target.value)}
                      disabled={isSubmitted}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Quote Summary Card */}
            <div className="supplier-quote-sidebar">
              <div className="supplier-quote-summary-card">
                {/* Header */}
                <div className="supplier-summary-card-header">
                  <div className="supplier-summary-icon-box">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="supplier-summary-title">Quote summary</h3>
                    <span className="supplier-summary-rfq-num">
                      {rfq?.cr49f_rfqnumber || "RFQ-1005"}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="supplier-summary-progress-box">
                  <div className="supplier-summary-progress-label-row">
                    <span className="supplier-progress-label">Response progress</span>
                    <span className="supplier-progress-val">{progressPercent}%</span>
                  </div>
                  <div className="supplier-progress-track">
                    <div
                      className="supplier-progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="supplier-progress-hint">
                    {progressPercent === 100
                      ? "All details completed — ready to submit quotation!"
                      : !deliveryDate
                      ? "Almost there — add your delivery date."
                      : `${completedLinesCount} of ${lines.length} items priced.`}
                  </div>
                </div>

                {/* Itemized Line Items List */}
                <div className="supplier-summary-items-list">
                  {lines.map((line, idx) => {
                    const calc = calculateLineTotal(
                      line.unitPrice,
                      line.offeredQuantity,
                      line.discount,
                      line.tax,
                      line.anyAdditionalCharges,
                      line.additionalChargePercentage
                    );
                    const seqNum = String(idx + 1).padStart(2, "0");

                    return (
                      <div
                        key={line.id || idx}
                        className="supplier-summary-item-row"
                        onClick={() => {
                          setExpandedLineIndices((prev) => new Set(prev).add(idx));
                        }}
                        title="Click to view/edit this line item"
                      >
                        <div className="supplier-summary-item-left">
                          <span className="supplier-summary-item-seq">{seqNum}</span>
                          <span className="supplier-summary-item-name" title={line.itemName}>
                            {line.itemName}
                          </span>
                        </div>
                        <span className="supplier-summary-item-price">
                          {formatCurrency(calc.totalPrice)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="supplier-summary-divider" />

                {/* Grand Total */}
                <div className="supplier-summary-total-box">
                  <span className="supplier-summary-total-label">GRAND TOTAL QUOTATION</span>
                  <div className="supplier-summary-total-val">
                    {formatCurrency(quotationFinancials.grandTotal)}
                  </div>
                  <span className="supplier-summary-total-caption">
                    Taxes and charges included
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="supplier-summary-actions">
                  {!isSubmitted ? (
                    <>
                      <button
                        type="button"
                        className="supplier-btn-submit-action"
                        onClick={handleSubmitResponse}
                        disabled={savingDraft || submitting || quotationFinancials.grandTotal <= 0}
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={15} className="rfq-spinner" />
                            <span>Submitting Response...</span>
                          </>
                        ) : (
                          <>
                            <span>Submit response</span>
                            <Send size={14} />
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="supplier-btn-draft-action"
                        onClick={handleSaveDraft}
                        disabled={savingDraft || submitting}
                      >
                        {savingDraft ? (
                          <>
                            <RefreshCw size={14} className="rfq-spinner" />
                            <span>Saving Draft...</span>
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            <span>Save as draft</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="supplier-submitted-status-box">
                      <CheckCircle2 size={18} color="#059669" />
                      <div>
                        <strong>Quotation Submitted</strong>
                        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
                          Locked in Dataverse for evaluation
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Privacy note */}
                <div className="supplier-summary-privacy-note">
                  <Check size={12} color="#10b981" />
                  <span>Your quote remains private until submission</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierRfqResponsePage;
