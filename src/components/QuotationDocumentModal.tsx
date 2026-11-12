import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileDown,
  Loader2,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import {
  type QuotationDocumentData,
  buildQuotationDocument,
  downloadQuotationDocumentPdf,
  numberToWords,
} from "../Services/QuotationDocumentService";
import type { FullSupplierResponse } from "../Services/RfqSupplierResponseService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";

import "../Styles/QuotationDocument.css";

export interface QuotationDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData?: QuotationDocumentData | null;
  rfq?: Cr49f_requestforqoutations | null;
  rfqNumber?: string;
  rfqTitle?: string;
  associatedPr?: string;
  deliveryLocation?: string;
  response?: FullSupplierResponse | null;
  supplierProfile?: Cr49f_suppliers | null;
  // Extended Supplier Evaluation & Award props
  supplier?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    category?: string;
    verified?: boolean;
    ranking?: number;
    rewarded?: boolean;
    hasResponse?: boolean;
    reason?: string;
    code?: string;
  } | null;
  aiRecommendation?: string;
  isAwarded?: boolean;
  isRfqAlreadyAwarded?: boolean;
  awardedSupplierName?: string;
  onReward?: () => Promise<void> | void;
  isRewarding?: boolean;
}

export const QuotationDocumentModal: React.FC<QuotationDocumentModalProps> = ({
  isOpen,
  onClose,
  documentData: initialDoc,
  rfq,
  rfqNumber,
  rfqTitle,
  associatedPr,
  deliveryLocation,
  response,
  supplierProfile,
  supplier,
  aiRecommendation,
  isAwarded: isAwardedProp,
  isRfqAlreadyAwarded = false,
  awardedSupplierName,
  onReward,
  isRewarding = false,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isAwarded = Boolean(isAwardedProp || supplier?.rewarded || response?.status === "Rewarded");
  const isLockedAnotherAwarded = Boolean(isRfqAlreadyAwarded && !isAwarded);

  // Construct or resolve document data
  const doc: QuotationDocumentData | null = useMemo(() => {
    if (initialDoc) return initialDoc;
    if (response && (response.lines?.length || supplier?.hasResponse)) {
      return buildQuotationDocument({
        rfq,
        rfqNumber,
        rfqTitle,
        associatedPr,
        deliveryLocation,
        response,
        supplierProfile,
      });
    }
    if (supplier) {
      return {
        quotationNumber: `QT-${(supplier.code || supplier.name.slice(0, 3)).toUpperCase()}-2026`,
        documentDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        validUntilDate: "As per RFQ Schedule",
        status: (isAwarded ? "Rewarded" : supplier.hasResponse ? "Submitted" : "Draft") as "Draft" | "Submitted" | "Rewarded",
        rfqId: rfq?.cr49f_requestforqoutationid || "",
        rfqNumber: rfqNumber || rfq?.cr49f_rfqnumber || "RFQ",
        rfqTitle: rfqTitle || rfq?.cr49f_rfqtitle || "Commercial Procurement Request",
        associatedPr,
        deliveryLocation: deliveryLocation || rfq?.cr49f_deliverylocation || "Main Delivery Facility",
        buyerOrganization: "Procurement360 Enterprise Corporation",
        supplierId: supplier.id,
        supplierCode: supplier.code || "SUP",
        supplierName: supplier.name,
        supplierCategory: supplier.category,
        supplierEmail: supplier.email,
        supplierPhone: supplier.phone,
        supplierAddress: supplier.address,
        paymentTerms: "Net 30 days",
        warranty: "1 Year Standard Comprehensive Manufacturer Warranty",
        lines: [],
        grossSubtotal: 0,
        totalDiscount: 0,
        netAfterDiscount: 0,
        totalAdditionalCharges: 0,
        taxableAmount: 0,
        totalTax: 0,
        grandTotal: 0,
        currencySymbol: "₹",
        submissionTimestamp: "Awaiting Submission",
        digitalSignatureHash: "Pending Digital Submission",
        authorizedSignatoryName: supplier.name,
        authorizedSignatoryTitle: "Authorized Commercial Signatory",
      };
    }
    return null;
  }, [initialDoc, response, rfq, rfqNumber, rfqTitle, associatedPr, deliveryLocation, supplierProfile, supplier, isAwarded]);

  const paperRef = useRef<HTMLDivElement>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!isOpen || !doc) return null;

  const hasResponded = Boolean(
    supplier ? supplier.hasResponse : (response && response.status === "Submitted") || (doc && doc.lines && doc.lines.length > 0)
  );

  const currency = doc.currencySymbol || "₹";
  const formatMoney = (val: number) =>
    currency +
    (Number(val) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getInitials = (name?: string) => {
    if (!name) return "SP";
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current || isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);
      await downloadQuotationDocumentPdf(paperRef.current, doc);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to generate and download PDF:", err);
      alert(`An error occurred while generating the PDF (${errorMessage}). You can also use the 'Print' button to save as PDF.`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      className="quotation-doc-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="quotation-doc-modal-container">
        {/* Top Header Controls */}
        <div className="quotation-doc-topbar">
          <div className="quotation-doc-topbar-left">
            <div className="quotation-doc-topbar-icon">
              <FileCheck2 size={18} />
            </div>
            <div>
              <div className="quotation-doc-topbar-title">
                <span>Supplier Quotation &amp; Recommendation</span>
                <span className="quotation-topbar-quotation-num">
                  ({hasResponded ? doc.quotationNumber : "Awaiting Bid Submission"})
                </span>
              </div>
              <div className="quotation-doc-topbar-sub">
                {doc.supplierName} ({doc.supplierCode}) • {doc.rfqNumber}
              </div>
            </div>
          </div>

          <div className="quotation-doc-topbar-actions">
            {hasResponded && (
              <>
                <button
                  type="button"
                  className="quotation-btn-control primary"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  title="Download official quotation as PDF file"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 size={14} className="quotation-spin-icon" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={14} />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="quotation-btn-control"
                  onClick={handlePrint}
                  title="Print document or use browser print dialog"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="quotation-btn-close"
              onClick={onClose}
              aria-label="Close Quotation"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="quotation-doc-scroll-viewport">
          {/* AI Recommendation Banner */}
          {(aiRecommendation || supplier?.reason) && (
            <div className="quotation-ai-recommendation-card">
              <div className="quotation-ai-rec-top">
                <div className="quotation-ai-rec-badge">
                  <Sparkles size={13} className="quotation-ai-sparkle-icon" />
                  <span>AI Sourcing Analysis &amp; Recommendation</span>
                </div>
                {typeof supplier?.ranking === "number" && (
                  <span className="quotation-ai-rank-badge">
                    <Trophy size={12} />
                    Rank #{supplier.ranking} Preferred Match
                  </span>
                )}
              </div>
              <p className="quotation-ai-rec-text">
                {aiRecommendation || supplier?.reason}
              </p>
              <div className="quotation-ai-chips-row">
                <div className="quotation-ai-chip">
                  <span className="quotation-ai-chip-label">Category:</span>
                  <span className="quotation-ai-chip-val">{supplier?.category || doc.supplierCategory || "Supplier"}</span>
                </div>
                {supplier?.verified && (
                  <div className="quotation-ai-chip">
                    <ShieldCheck size={12} style={{ color: "#10b981" }} />
                    <span className="quotation-ai-chip-val">Verified Procurement Partner</span>
                  </div>
                )}
                <div className="quotation-ai-chip">
                  <span className="quotation-ai-chip-label">Bid Status:</span>
                  <span className={`quotation-ai-chip-val status-${hasResponded ? "submitted" : "pending"}`}>
                    {hasResponded ? "Quotation Submitted" : "Awaiting Bid Submission"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasResponded ? (
            /* Printable White Paper Sheet */
            <div className="quotation-paper-sheet" ref={paperRef}>
              <div className="quotation-top-accent-bar" />

              {/* Header: Supplier Branding & Official Document Metadata */}
              <div className="quotation-sheet-header">
                <div className="quotation-supplier-branding">
                  <div className="quotation-supplier-logo-row">
                    <div className="quotation-supplier-avatar">
                      {getInitials(doc.supplierName)}
                    </div>
                    <div>
                      <div className="quotation-supplier-name">{doc.supplierName}</div>
                      <div className="quotation-supplier-meta-tags">
                        <span className="quotation-code-tag">ID: {doc.supplierCode}</span>
                        {doc.supplierGstin && (
                          <span className="quotation-gstin-tag">
                            GSTIN: {doc.supplierGstin}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="quotation-supplier-contact-line">
                    {doc.supplierAddress ? `${doc.supplierAddress}, ` : ""}
                    {doc.supplierCity ? `${doc.supplierCity}, ` : ""}
                    {doc.supplierCountry || "India"}
                  </div>
                  <div className="quotation-supplier-contact-line">
                    Email: <strong>{doc.supplierEmail || "—"}</strong> • Phone:{" "}
                    <strong>{doc.supplierPhone || "—"}</strong>
                  </div>
                </div>

                <div className="quotation-document-title-block">
                  <div
                    className={`quotation-status-badge ${
                      doc.status === "Rewarded" ? "rewarded" : ""
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    <span>
                      {doc.status === "Rewarded"
                        ? "AWARDED QUOTATION"
                        : "OFFICIALLY SUBMITTED"}
                    </span>
                  </div>
                  <h1 className="quotation-doc-heading">Commercial Quotation</h1>
                  <div className="quotation-number-badge">Ref: {doc.quotationNumber}</div>
                  <div className="quotation-date-row">
                    Date Issued: <strong>{doc.documentDate}</strong>
                  </div>
                  <div className="quotation-date-row">
                    Valid Until: <strong>{doc.validUntilDate}</strong>
                  </div>
                </div>
              </div>

              {/* Address Blocks: From (Supplier) and Prepared For (Buyer) */}
              <div className="quotation-parties-grid">
                <div className="quotation-party-card">
                  <div className="quotation-party-heading">
                    <Building2 size={12} />
                    <span>From (Supplier / Bidding Entity)</span>
                  </div>
                  <div className="quotation-party-name">{doc.supplierName}</div>
                  <div className="quotation-party-field">
                    <span>Authorized Contact:</span>
                    <strong>{doc.supplierContactPerson || "Commercial Sales Lead"}</strong>
                  </div>
                  <div className="quotation-party-field">
                    <span>Vendor ID:</span>
                    <strong>{doc.supplierCode}</strong>
                  </div>
                  <div className="quotation-party-field">
                    <span>Official Email:</span>
                    <span>{doc.supplierEmail || "—"}</span>
                  </div>
                  <div className="quotation-party-field">
                    <span>Phone / Contact:</span>
                    <span>{doc.supplierPhone || "—"}</span>
                  </div>
                </div>

                <div className="quotation-party-card">
                  <div className="quotation-party-heading">
                    <User size={12} />
                    <span>Quotation Prepared For (Buyer Entity)</span>
                  </div>
                  <div className="quotation-party-name">{doc.buyerOrganization}</div>
                  <div className="quotation-party-field">
                    <span>RFQ Reference:</span>
                    <strong>
                      {doc.rfqNumber} ({doc.rfqTitle})
                    </strong>
                  </div>
                  <div className="quotation-party-field">
                    <span>Associated PR:</span>
                    <strong>{doc.associatedPr || "N/A"}</strong>
                  </div>
                  <div className="quotation-party-field">
                    <span>Delivery Facility:</span>
                    <strong>{doc.deliveryLocation}</strong>
                  </div>
                  <div className="quotation-party-field">
                    <span>Division:</span>
                    <span>{doc.buyerContact || "Corporate Procurement Division"}</span>
                  </div>
                </div>
              </div>

              {/* Commercial Terms Summary Grid */}
              <div className="quotation-terms-grid">
                <div className="quotation-term-card">
                  <div className="quotation-term-label">Promised Delivery</div>
                  <div className="quotation-term-val" style={{ color: "#1e3a8a" }}>
                    <Calendar size={13} color="#2563eb" />
                    <span>{doc.promisedDeliveryDate || "As Per RFQ Schedule"}</span>
                  </div>
                </div>

                <div className="quotation-term-card">
                  <div className="quotation-term-label">Payment Terms</div>
                  <div className="quotation-term-val">
                    <Clock size={13} color="#059669" />
                    <span>{doc.paymentTerms}</span>
                  </div>
                </div>

                <div className="quotation-term-card">
                  <div className="quotation-term-label">Warranty Coverage</div>
                  <div className="quotation-term-val">
                    <ShieldCheck size={13} color="#7c3aed" />
                    <span>{doc.warranty}</span>
                  </div>
                </div>

                <div className="quotation-term-card">
                  <div className="quotation-term-label">Document Status</div>
                  <div className="quotation-term-val" style={{ color: "#047857" }}>
                    <CheckCircle2 size={13} />
                    <span>Submitted &amp; Verified</span>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="quotation-table-wrapper">
                <table className="quotation-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, textAlign: "center" }}>#</th>
                      <th>Item Description &amp; Specifications</th>
                      <th style={{ width: 75, textAlign: "center" }}>Req Qty</th>
                      <th style={{ width: 75, textAlign: "center" }}>Offered</th>
                      <th style={{ width: 105, textAlign: "right" }}>Unit Price</th>
                      <th style={{ width: 75, textAlign: "center" }}>Discount</th>
                      <th style={{ width: 75, textAlign: "center" }}>Charges</th>
                      <th style={{ width: 65, textAlign: "center" }}>Tax</th>
                      <th style={{ width: 120, textAlign: "right" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                          No line items found in this quotation schedule.
                        </td>
                      </tr>
                    ) : (
                      doc.lines.map((l) => (
                        <tr key={l.id || l.lineNumber}>
                          <td style={{ textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                            {l.lineNumber}
                          </td>
                          <td>
                            <div className="quotation-item-name">{l.itemName}</div>
                            {l.description && (
                              <div className="quotation-item-desc">{l.description}</div>
                            )}
                          </td>
                          <td style={{ textAlign: "center", color: "#475569" }}>
                            {l.requestedQuantity}
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                            {l.offeredQuantity}
                          </td>
                          <td className="quotation-money-col">{formatMoney(l.unitPrice)}</td>
                          <td style={{ textAlign: "center" }}>
                            {l.discountPercent > 0 ? (
                              <span className="quotation-badge-discount">
                                {l.discountPercent}%
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {l.additionalChargesPercent > 0 ? (
                              <span className="quotation-badge-charge">
                                +{l.additionalChargesPercent}%
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {l.taxPercent > 0 ? (
                              <span className="quotation-badge-tax">{l.taxPercent}%</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>0%</span>
                            )}
                          </td>
                          <td className="quotation-money-col quotation-line-total">
                            <strong>{formatMoney(l.lineTotal)}</strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Declarations */}
              <div className="quotation-financials-layout">
                <div className="quotation-declarations-box">
                  <div className="quotation-declarations-title">
                    Commercial Declarations &amp; Scope
                  </div>
                  <ul className="quotation-declarations-list">
                    <li>
                      Prices quoted are firm, fixed, and valid for 30 calendar days from{" "}
                      <strong>{doc.documentDate}</strong>.
                    </li>
                    <li>
                      All products are brand new, original, and compliant with technical guidelines
                      specified in <strong>{doc.rfqNumber}</strong>.
                    </li>
                    <li>
                      Delivery destination facility: <strong>{doc.deliveryLocation}</strong>.
                    </li>
                    <li>Standard manufacturer warranty: <strong>{doc.warranty}</strong>.</li>
                  </ul>

                  <div className="quotation-amount-words">
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: "#1e40af", marginBottom: 3 }}>
                      Amount in Words:
                    </div>
                    {numberToWords(doc.grandTotal)}
                  </div>
                </div>

                <div className="quotation-summary-card">
                  <div className="quotation-summary-row">
                    <span>Gross Subtotal:</span>
                    <span className="quotation-summary-num">{formatMoney(doc.grossSubtotal)}</span>
                  </div>

                  {doc.totalDiscount > 0 && (
                    <div className="quotation-summary-row discount">
                      <span>Commercial Discount:</span>
                      <span className="quotation-summary-num">-{formatMoney(doc.totalDiscount)}</span>
                    </div>
                  )}

                  {doc.totalAdditionalCharges > 0 && (
                    <div className="quotation-summary-row charges">
                      <span>Freight, Handling &amp; Logistics:</span>
                      <span className="quotation-summary-num">+{formatMoney(doc.totalAdditionalCharges)}</span>
                    </div>
                  )}

                  <div className="quotation-summary-row">
                    <span>Applicable Tax &amp; GST:</span>
                    <span className="quotation-summary-num">+{formatMoney(doc.totalTax)}</span>
                  </div>

                  <div className="quotation-summary-grand-total">
                    <span>Net Payable:</span>
                    <span className="quotation-grand-total-amount">
                      {formatMoney(doc.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature & Electronic Stamp Block */}
              <div className="quotation-signature-footer">
                <div className="quotation-digital-stamp">
                  <div className="quotation-stamp-title">
                    <ShieldCheck size={14} />
                    <span>Verified &amp; Audited Proposal</span>
                  </div>
                  <div className="quotation-stamp-meta">
                    Electronically authenticated and logged in Procurement360 platform.
                  </div>
                  <div className="quotation-stamp-meta" style={{ marginTop: 2 }}>
                    Submission Timestamp: <strong>{doc.submissionTimestamp}</strong>
                  </div>
                  <div className="quotation-stamp-hash">{doc.digitalSignatureHash}</div>
                </div>

                <div className="quotation-signatory-block">
                  <div className="quotation-signatory-line" />
                  <div className="quotation-signatory-name">{doc.authorizedSignatoryName}</div>
                  <div className="quotation-signatory-title">{doc.authorizedSignatoryTitle}</div>
                  <div className="quotation-signatory-company">{doc.supplierName}</div>
                </div>
              </div>
            </div>
          ) : (
            /* Awaiting Supplier Quotation View */
            <div className="quotation-pending-view">
              <div className="quotation-pending-icon-circle">
                <Clock size={32} style={{ color: "#d97706" }} />
              </div>
              <h3 className="quotation-pending-title">Awaiting Supplier Quotation</h3>
              <p className="quotation-pending-sub">
                <strong>{doc.supplierName}</strong> has been invited to submit commercial quotation for{" "}
                <strong>{doc.rfqNumber}</strong>. Their formal proposal has not yet been submitted.
              </p>
              <div className="quotation-pending-contact-grid">
                <div className="quotation-pending-contact-item">
                  <span>Vendor Identifier</span>
                  <strong>{doc.supplierCode}</strong>
                </div>
                <div className="quotation-pending-contact-item">
                  <span>Category</span>
                  <strong>{doc.supplierCategory || "General Procurement"}</strong>
                </div>
                <div className="quotation-pending-contact-item">
                  <span>Contact Email</span>
                  <strong>{doc.supplierEmail || "—"}</strong>
                </div>
                <div className="quotation-pending-contact-item">
                  <span>Contact Phone</span>
                  <strong>{doc.supplierPhone || "—"}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar: Close & Reward Buttons */}
        <div className="quotation-doc-bottombar">
          <div className="quotation-doc-bottombar-left">
            <span className="quotation-bottombar-label">Supplier:</span>
            <strong className="quotation-bottombar-name">{doc.supplierName}</strong>
            {isAwarded ? (
              <span className="quotation-awarded-status-pill">
                <Trophy size={13} />
                Awarded Vendor
              </span>
            ) : isLockedAnotherAwarded ? (
              <span className="quotation-locked-status-pill">
                <Lock size={12} />
                RFQ Awarded to {awardedSupplierName || "Another Vendor"}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onReward && (
              <button
                type="button"
                className={`quotation-btn-footer-reward ${
                  isAwarded
                    ? "awarded"
                    : isLockedAnotherAwarded
                    ? "locked"
                    : ""
                }`}
                onClick={() => {
                  if (!isAwarded && !isLockedAnotherAwarded && !isRewarding) {
                    onReward();
                  }
                }}
                disabled={isAwarded || isLockedAnotherAwarded || isRewarding}
                title={
                  isAwarded
                    ? "This supplier is already the awarded vendor for this RFQ"
                    : isLockedAnotherAwarded
                    ? `This RFQ has already been awarded to ${awardedSupplierName || "another supplier"}. Cannot award another supplier.`
                    : "Award RFQ contract to this supplier"
                }
              >
                {isRewarding ? (
                  <>
                    <Loader2 size={15} className="quotation-spin-icon" />
                    <span>Awarding RFQ...</span>
                  </>
                ) : isAwarded ? (
                  <>
                    <Trophy size={15} />
                    <span>★ Currently Awarded</span>
                  </>
                ) : isLockedAnotherAwarded ? (
                  <>
                    <Lock size={15} />
                    <span>RFQ Already Awarded</span>
                  </>
                ) : (
                  <>
                    <Trophy size={15} />
                    <span>Reward / Award Supplier</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationDocumentModal;
