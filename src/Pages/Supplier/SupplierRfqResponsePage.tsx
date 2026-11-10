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
import { QuotationDocumentModal } from "../../components/QuotationDocumentModal";
import {
  buildQuotationDocument,
  saveQuotationDocumentToStorage,
} from "../../Services/QuotationDocumentService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../../generated/services/Cr49f_supplierproductsService";
import type { Cr49f_requestforqoutations } from "../../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";
import type { Cr49f_supplierproducts } from "../../generated/models/Cr49f_supplierproductsModel";
import { INITIAL_SAMPLE_SUPPLIERS, type SampleSupplierItem, type SampleSupplierProduct } from "../../data/SampleSuppliersData";

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
  const [isQuotationDocOpen, setIsQuotationDocOpen] = useState<boolean>(false);

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
      const [res, prodRes] = await Promise.all([
        getSupplierRfqDetails(rfqId, supId, activeSupplier.cr49f_email),
        Cr49f_supplierproductsService.getAll().catch(() => ({ success: false, data: [] as Cr49f_supplierproducts[] })),
      ]);

      setRfq(res.rfq);
      setResponse(res.response);

      // Resolve supplier products catalog
      const allDataverseProducts: Cr49f_supplierproducts[] =
        prodRes.success && prodRes.data ? prodRes.data : [];

      const activeSupGuid = (activeSupplier.cr49f_supplierid || "").toLowerCase().replace(/[{}]/g, "").trim();
      const activeSupCode = (activeSupplier.cr49f_supplierid1 || "").toLowerCase().trim();
      const activeSupName = (activeSupplier.cr49f_name || "").toLowerCase().trim();

      let supplierCatalog = allDataverseProducts.filter((p) => {
        const raw = p as unknown as Record<string, unknown>;
        const pSupGuid = (
          p._cr49f_supplier_value ||
          (raw._cr49f_Supplier_value as string) ||
          (raw.cr49f_Supplier as string) ||
          (raw.cr49f_supplier as string) ||
          ""
        ).toLowerCase().replace(/[{}]/g, "").trim();
        return pSupGuid && pSupGuid === activeSupGuid;
      });

      // Fallback to sample data catalog if Dataverse has no products for this supplier
      if (supplierCatalog.length === 0) {
        const sampleMatch = INITIAL_SAMPLE_SUPPLIERS.find(
          (s: SampleSupplierItem) =>
            (s.supplier.cr49f_supplierid1 && s.supplier.cr49f_supplierid1.toLowerCase().trim() === activeSupCode) ||
            (s.supplier.cr49f_name && s.supplier.cr49f_name.toLowerCase().trim() === activeSupName)
        );
        if (sampleMatch && sampleMatch.products) {
          supplierCatalog = sampleMatch.products.map((sp: SampleSupplierProduct, pIdx: number) => ({
            cr49f_supplierproductid: sp.cr49f_supplierproductnumber || `sample_prod_${pIdx}`,
            cr49f_productname: sp.cr49f_productname,
            cr49f_unitprice: String(sp.cr49f_unitprice),
            cr49f_category: sp.cr49f_category,
            statecode: 0 as const,
          })) as unknown as Cr49f_supplierproducts[];
        }
      }

      // Helper to match catalog product price
      const getCatalogPriceForLine = (itemName: string, category?: string) => {
        if (!supplierCatalog.length) return null;
        const cleanName = (itemName || "").toLowerCase().trim();
        const cleanCat = (category || "").toLowerCase().trim();

        // 1. Exact name match
        let match = supplierCatalog.find(
          (p) => (p.cr49f_productname || "").toLowerCase().trim() === cleanName
        );

        // 2. Contains match
        if (!match) {
          match = supplierCatalog.find((p) => {
            const pName = (p.cr49f_productname || "").toLowerCase().trim();
            return pName && (cleanName.includes(pName) || pName.includes(cleanName));
          });
        }

        // 3. Keyword / word intersection match
        if (!match) {
          const words = cleanName.split(/\s+/).filter((w) => w.length > 2);
          match = supplierCatalog.find((p) => {
            const pName = (p.cr49f_productname || "").toLowerCase().trim();
            return words.some((w) => pName.includes(w));
          });
        }

        // 4. Category match
        if (!match && cleanCat) {
          match = supplierCatalog.find(
            (p) => (p.cr49f_category || "").toLowerCase().trim() === cleanCat
          );
        }

        // 5. Default to first catalog item if available
        if (!match && supplierCatalog.length > 0) {
          match = supplierCatalog[0];
        }

        if (match && match.cr49f_unitprice) {
          const parsed = parseFloat(String(match.cr49f_unitprice).replace(/[^0-9.]/g, ""));
          if (!isNaN(parsed) && parsed > 0) {
            return { price: parsed, productName: match.cr49f_productname || itemName };
          }
        }
        return null;
      };

      // Process lines:
      // 1. Quantity is READ-ONLY matching the requested quantity
      // 2. Unit price is fetched from supplier's product price (if unitPrice is 0 or unquoted), but editable!
      const processedLines = res.response.lines.map((line) => {
        const reqQty = Number(line.requestedQuantity) || 1;
        let unitPrice = Number(line.unitPrice) || 0;
        let catalogPrice: number | undefined;
        let matchedCatalogName: string | undefined;

        const catMatch = getCatalogPriceForLine(line.itemName, line.category);
        if (catMatch) {
          catalogPrice = catMatch.price;
          matchedCatalogName = catMatch.productName;
          // Auto-fetch if unitPrice hasn't been set yet
          if (unitPrice === 0) {
            unitPrice = catMatch.price;
          }
        }

        const calc = calculateLineTotal(
          unitPrice,
          reqQty, // quantity is read-only = reqQty
          line.discount,
          line.tax,
          line.anyAdditionalCharges,
          line.additionalChargePercentage
        );

        return {
          ...line,
          offeredQuantity: reqQty, // quantity will be read-only matching requested quantity
          unitPrice, // fetched from supplier's product price, but editable!
          totalPrice: calc.totalPrice,
          catalogPrice,
          matchedCatalogName,
        };
      });

      setLines(processedLines);

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

    // Quantity is read-only as per RFQ specifications
    if (field === "offeredQuantity") return;

    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };

      if (
        field === "unitPrice" ||
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

      // Quantity remains strictly locked to requestedQuantity
      const fixedQty = target.requestedQuantity || target.offeredQuantity || 1;
      target.offeredQuantity = fixedQty;

      // Re-calculate financial components using central calculateLineTotal helper
      const calc = calculateLineTotal(
        target.unitPrice,
        fixedQty,
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

      const submitResult = await submitSupplierResponse(response.responseId, formattedLines, {
        deliveryDate,
        paymentTerms,
        warranty,
        rfqId: response.rfqId,
        supplierId: response.supplierId,
        supplierCode: response.supplierCode,
      });

      // Construct and persist full quotation document
      const submittedResponse: FullSupplierResponse = {
        ...response,
        status: "Submitted",
        statuscode: 2,
        statecode: 1,
        totalAmount: submitResult.totalAmount,
        responseDate: submitResult.submittedDate,
        deliveryDate,
        paymentTerms,
        warranty,
        lines,
      };

      const quotationDoc = buildQuotationDocument({
        rfq,
        rfqNumber: rfq?.cr49f_rfqnumber,
        rfqTitle: rfq?.cr49f_rfqtitle,
        deliveryLocation: rfq?.cr49f_deliverylocation,
        response: submittedResponse,
        supplierProfile: activeSupplier,
      });
      saveQuotationDocumentToStorage(quotationDoc);

      setSuccessMsg("Quotation submitted successfully and official Quotation Document generated!");
      setIsQuotationDocOpen(true);
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
          <p style={{ fontSize: 13, margin: "0 0 20px" }}>
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
          {isSubmitted && (
            <button
              type="button"
              className="supplier-btn-action primary"
              onClick={() => setIsQuotationDocOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            >
              <FileText size={13} />
              View Quotation Document
            </button>
          )}
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
        <div className="supplier-loading-state" style={{ padding: 60, textAlign: "center" }}>
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
                    Quotation Successfully Submitted &amp; Generated
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.9 }}>
                    Submitted on {response.responseDate ? new Date(response.responseDate).toLocaleString() : "Recently"}. Official quotation document is recorded and locked for review by Procurement.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  className="supplier-btn-banner-action"
                  onClick={() => setIsQuotationDocOpen(true)}
                >
                  <FileText size={13} />
                  View Quotation Document
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <Lock size={13} />
                  Read-Only
                </div>
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
                  <p style={{ margin: "4px 0 0" }}>
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
                            {/* Quoted Unit Price (Fetched from catalog, editable) */}
                            <div className="supplier-input-block">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <label className="supplier-input-label" style={{ margin: 0 }}>
                                  <span>
                                    QUOTED UNIT PRICE <span className="supplier-req-star">*</span>
                                  </span>
                                </label>
                                {line.catalogPrice ? (
                                  <span
                                    className="supplier-catalog-price-badge"
                                    title={`Standard catalog rate for ${line.matchedCatalogName || line.itemName}: ₹${line.catalogPrice.toLocaleString("en-IN")}`}
                                  >
                                    <Sparkles size={11} />
                                    Catalog: ₹{line.catalogPrice.toLocaleString("en-IN")}
                                  </span>
                                ) : null}
                              </div>
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
                                  title="Quoted unit price (pre-filled from supplier product catalog, editable)"
                                />
                              </div>
                              {line.catalogPrice && line.unitPrice !== line.catalogPrice && !isSubmitted && (
                                <button
                                  type="button"
                                  className="supplier-btn-revert-catalog"
                                  onClick={() => handleLineChange(idx, "unitPrice", line.catalogPrice!)}
                                  title="Reset price back to product catalog rate"
                                >
                                  <RefreshCw size={10} /> Reset to Catalog (₹{line.catalogPrice.toLocaleString("en-IN")})
                                </button>
                              )}
                            </div>

                            {/* Offered Quantity (Read-only as per RFQ) */}
                            <div className="supplier-input-block">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <label className="supplier-input-label" style={{ margin: 0 }}>
                                  <span>OFFERED QUANTITY</span>
                                </label>
                                <span className="supplier-readonly-pill" title="Requested quantity is fixed by the RFQ and cannot be modified">
                                  <Lock size={10} /> Read-only
                                </span>
                              </div>
                              <div className="supplier-input-affix-wrap">
                                <input
                                  type="number"
                                  className="supplier-form-control is-readonly"
                                  value={line.requestedQuantity || line.offeredQuantity || 1}
                                  readOnly
                                  tabIndex={-1}
                                  title="Quantity is set by the Request for Quotation and is read-only"
                                />
                                <span className="supplier-input-suffix">
                                  {(line.requestedQuantity || line.offeredQuantity || 1) === 1 ? "Unit" : "Units"}
                                </span>
                              </div>
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
                                <Truck size={15} className="supplier-charge-truck-icon" />
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                      <div className="supplier-submitted-status-box">
                        <CheckCircle2 size={18} color="#059669" />
                        <div>
                          <strong>Quotation Submitted</strong>
                          <p style={{ margin: "2px 0 0", fontSize: 11.5 }}>
                            Locked in Dataverse for evaluation
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="supplier-btn-action primary"
                        onClick={() => setIsQuotationDocOpen(true)}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "9px 14px",
                          fontWeight: 700,
                        }}
                      >
                        <FileText size={14} />
                        View Quotation Document
                      </button>
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

      {/* Official Quotation Document Modal */}
      {isQuotationDocOpen && (
        <QuotationDocumentModal
          isOpen={isQuotationDocOpen}
          onClose={() => setIsQuotationDocOpen(false)}
          rfq={rfq}
          rfqNumber={rfq?.cr49f_rfqnumber}
          rfqTitle={rfq?.cr49f_rfqtitle}
          deliveryLocation={rfq?.cr49f_deliverylocation}
          response={
            response
              ? {
                  ...response,
                  lines,
                  deliveryDate,
                  paymentTerms,
                  warranty,
                }
              : null
          }
          supplierProfile={activeSupplier}
        />
      )}
    </div>
  );
};

export default SupplierRfqResponsePage;
