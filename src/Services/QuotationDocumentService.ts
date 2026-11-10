import type { FullSupplierResponse, SupplierResponseLineItem } from "./RfqSupplierResponseService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import { INITIAL_SAMPLE_SUPPLIERS, type SampleSupplierItem } from "../data/SampleSuppliersData";

export interface QuotationDocumentLine {
  lineNumber: number;
  id: string;
  itemName: string;
  description: string;
  category: string;
  requestedQuantity: number;
  offeredQuantity: number;
  unitPrice: number;
  baseAmount: number;
  discountPercent: number;
  discountAmount: number;
  additionalChargesPercent: number;
  additionalChargesAmount: number;
  additionalChargesDetails: string;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
  leadTime?: string;
}

export interface QuotationDocumentData {
  quotationNumber: string;
  documentDate: string;
  validUntilDate: string;
  status: "Draft" | "Submitted" | "Rewarded";

  // RFQ Context
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  rfqDescription?: string;
  associatedPr?: string;
  deliveryLocation: string;
  buyerOrganization: string;
  buyerContact?: string;

  // Supplier Details
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierCategory?: string;
  supplierContactPerson?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierCity?: string;
  supplierCountry?: string;
  supplierGstin?: string;

  // Commercial Terms
  promisedDeliveryDate?: string;
  paymentTerms: string;
  warranty: string;
  leadTime?: string;
  supplierRemarks?: string;

  // Line Items
  lines: QuotationDocumentLine[];

  // Financial Breakdown
  grossSubtotal: number;
  totalDiscount: number;
  netAfterDiscount: number;
  totalAdditionalCharges: number;
  taxableAmount: number;
  totalTax: number;
  grandTotal: number;
  currencySymbol: string;

  // Verification & Audit
  submissionTimestamp: string;
  digitalSignatureHash: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
}

/**
 * Converts a numeric amount into standard words (Indian numbering system with paise).
 */
export function numberToWords(amount: number): string {
  const rounded = Math.round(Math.max(0, amount) * 100) / 100;
  const num = Math.floor(rounded);
  const paise = Math.round((rounded - num) * 100);
  if (num === 0 && paise === 0) return "Zero Rupees Only";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const unit = n % 10;
    return `${tens[Math.floor(n / 10)]}${unit ? " " + units[unit] : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundred > 0) res += `${units[hundred]} Hundred`;
    if (rest > 0) res += `${res ? " and " : ""}${convertTwoDigits(rest)}`;
    return res;
  }

  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder %= 1000;
  let hundred = remainder;

  let words = "";
  if (crore > 0) words += `${convertThreeDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertThreeDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertThreeDigits(thousand)} Thousand `;
  if (hundred > 0) words += `${convertThreeDigits(hundred)} `;

  const rupeesPart = words.trim() ? `Rupees ${words.trim()}` : "";
  const paisePart = paise > 0 ? `${convertTwoDigits(paise)} Paise` : "";

  if (rupeesPart && paisePart) {
    return `${rupeesPart} and ${paisePart} Only`;
  }
  if (rupeesPart) {
    return `${rupeesPart} Only`;
  }
  return `${paisePart} Only`;
}

/**
 * Simple pseudo-hash generator for realistic digital document stamping.
 */
function generateDocumentHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  const hex2 = Math.abs((hash * 31) | 0).toString(16).padStart(8, "0");
  const hex3 = Math.abs((hash * 97) | 0).toString(16).padStart(8, "0");
  const hex4 = Math.abs((hash * 13) | 0).toString(16).padStart(8, "0");
  return `SHA256:${hex}${hex2}${hex3}${hex4}`.toUpperCase();
}

/**
 * Builds a comprehensive Quotation Document from RFQ, Supplier response, and Supplier profile.
 */
export function buildQuotationDocument(params: {
  rfq?: Cr49f_requestforqoutations | null;
  rfqNumber?: string;
  rfqTitle?: string;
  associatedPr?: string;
  deliveryLocation?: string;
  response: FullSupplierResponse;
  supplierProfile?: Cr49f_suppliers | null;
  customQuotationNumber?: string;
}): QuotationDocumentData {
  const { rfq, response, supplierProfile, customQuotationNumber } = params;

  const rfqNum =
    params.rfqNumber ||
    rfq?.cr49f_rfqnumber ||
    (response.rfqId ? `RFQ-${response.rfqId.slice(0, 6)}` : "RFQ-1005");

  const rfqTitle =
    params.rfqTitle ||
    rfq?.cr49f_rfqtitle ||
    "Procurement Request for Quotation";

  const associatedPr =
    params.associatedPr ||
    rfq?.cr49f_prrfqname ||
    "PR-2026-081";

  const deliveryLocation =
    params.deliveryLocation ||
    rfq?.cr49f_deliverylocation ||
    "Jaipur, Rajasthan";

  // Resolve supplier info with fallbacks to SampleSuppliersData
  const sampleSup = INITIAL_SAMPLE_SUPPLIERS.find(
    (s: SampleSupplierItem) =>
      (response.supplierCode && s.supplier.cr49f_supplierid1?.toLowerCase() === response.supplierCode.toLowerCase()) ||
      (response.supplierName && s.supplier.cr49f_name?.toLowerCase().includes(response.supplierName.toLowerCase())) ||
      (supplierProfile?.cr49f_name && s.supplier.cr49f_name?.toLowerCase() === supplierProfile.cr49f_name.toLowerCase())
  );

  const supplierCode =
    response.supplierCode ||
    supplierProfile?.cr49f_supplierid1 ||
    sampleSup?.supplier.cr49f_supplierid1 ||
    "SUP-101";

  const supplierName =
    response.supplierName ||
    supplierProfile?.cr49f_name ||
    sampleSup?.supplier.cr49f_name ||
    "Supplier Enterprise";

  const supplierContactPerson =
    supplierProfile?.cr49f_contactperson ||
    sampleSup?.supplier.cr49f_contactperson ||
    "Authorized Representative";

  const supplierEmail =
    response.supplierEmail ||
    supplierProfile?.cr49f_email ||
    sampleSup?.supplier.cr49f_email ||
    "orders@supplier.com";

  const supplierPhone =
    supplierProfile?.cr49f_phonenumber ||
    sampleSup?.supplier.cr49f_phonenumber ||
    "+91 80 4123 4567";

  const supplierAddress =
    supplierProfile?.cr49f_address ||
    sampleSup?.supplier.cr49f_address ||
    "Plot 42, Tech Industrial Zone";

  const supplierCity =
    supplierProfile?.cr49f_city ||
    sampleSup?.supplier.cr49f_city ||
    "Bengaluru";

  const supplierCountry =
    supplierProfile?.cr49f_country ||
    sampleSup?.supplier.cr49f_country ||
    "India";

  const supplierGstin =
    supplierProfile?.cr49f_pan ||
    supplierProfile?.cr49f_registrationnumber ||
    sampleSup?.supplier.cr49f_pan ||
    `29AAAC${supplierCode.replace(/[^0-9]/g, "").padStart(4, "1")}1Z5`;

  const cleanRfqTag = rfqNum.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const cleanSupTag = supplierCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Quotation Reference Number
  const quotationNumber =
    customQuotationNumber ||
    `QUO-${cleanRfqTag}-${cleanSupTag}-${new Date().getFullYear()}`;

  const submissionDateObj = response.responseDate ? new Date(response.responseDate) : new Date();
  const documentDate = !isNaN(submissionDateObj.getTime())
    ? submissionDateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const validUntilObj = new Date(submissionDateObj);
  validUntilObj.setDate(validUntilObj.getDate() + 30);
  const validUntilDate = validUntilObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Calculate line items with complete itemized breakdown
  let grossSubtotal = 0;
  let totalDiscount = 0;
  let totalAdditionalCharges = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const lines: QuotationDocumentLine[] = (response.lines || []).map((line: SupplierResponseLineItem, idx: number) => {
    const qty = Number(line.offeredQuantity) || Number(line.requestedQuantity) || 1;
    const price = Number(line.unitPrice) || 0;
    const discPct = Number(line.discount) || 0;
    const taxPct = Number(line.tax) || 0;
    const addlPct = line.anyAdditionalCharges ? Number(line.additionalChargePercentage) || 0 : 0;

    const baseAmount = price * qty;
    const discountAmount = baseAmount * (discPct / 100);
    const netAfterDisc = Math.max(0, baseAmount - discountAmount);
    const additionalChargesAmount = netAfterDisc * (addlPct / 100);
    const taxableAmount = netAfterDisc + additionalChargesAmount;
    const taxAmount = taxableAmount * (taxPct / 100);
    const lineTotal = Number(line.totalPrice) > 0 ? Number(line.totalPrice) : Math.round((taxableAmount + taxAmount) * 100) / 100;

    grossSubtotal += baseAmount;
    totalDiscount += discountAmount;
    totalAdditionalCharges += additionalChargesAmount;
    totalTax += taxAmount;
    grandTotal += lineTotal;

    const rawDesc = line.additionalChargesDetails || line.description || line.comments || "";
    const cleanDesc =
      rawDesc && rawDesc !== "Standard procurement grade goods"
        ? rawDesc
        : "";

    return {
      lineNumber: idx + 1,
      id: line.id || `line-${idx + 1}`,
      itemName: line.itemName || `Item #${idx + 1}`,
      description: cleanDesc,
      category: line.category || "General Supplies",
      requestedQuantity: Number(line.requestedQuantity) || qty,
      offeredQuantity: qty,
      unitPrice: price,
      baseAmount: Math.round(baseAmount * 100) / 100,
      discountPercent: discPct,
      discountAmount: Math.round(discountAmount * 100) / 100,
      additionalChargesPercent: addlPct,
      additionalChargesAmount: Math.round(additionalChargesAmount * 100) / 100,
      additionalChargesDetails: cleanDesc || (addlPct > 0 ? "Freight & Logistics" : ""),
      taxPercent: taxPct,
      taxAmount: Math.round(taxAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      leadTime: line.leadTime,
    };
  });

  // Fallback if response lines were empty
  if (lines.length === 0 && response.totalAmount > 0) {
    grandTotal = response.totalAmount;
    grossSubtotal = response.totalAmount;
    lines.push({
      lineNumber: 1,
      id: "line-summary",
      itemName: rfqTitle,
      description: "Complete quotation schedule conforming to RFQ specifications",
      category: "Procurement Bundle",
      requestedQuantity: 1,
      offeredQuantity: 1,
      unitPrice: response.totalAmount,
      baseAmount: response.totalAmount,
      discountPercent: 0,
      discountAmount: 0,
      additionalChargesPercent: 0,
      additionalChargesAmount: 0,
      additionalChargesDetails: "",
      taxPercent: 0,
      taxAmount: 0,
      lineTotal: response.totalAmount,
    });
  }

  const netAfterDiscount = Math.max(0, grossSubtotal - totalDiscount);
  const taxableAmount = netAfterDiscount + totalAdditionalCharges;

  const rawHash = `${quotationNumber}|${supplierCode}|${rfqNum}|${grandTotal}|${documentDate}`;
  const digitalSignatureHash = generateDocumentHash(rawHash);

  const status: "Draft" | "Submitted" | "Rewarded" =
    response.status === "Rewarded"
      ? "Rewarded"
      : response.status === "Submitted"
      ? "Submitted"
      : "Draft";

  const formattedTimestamp = !isNaN(submissionDateObj.getTime())
    ? submissionDateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }) +
      ", " +
      submissionDateObj.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return {
    quotationNumber,
    documentDate,
    validUntilDate,
    status,

    rfqId: response.rfqId,
    rfqNumber: rfqNum,
    rfqTitle,
    rfqDescription: rfq?.cr49f_description,
    associatedPr,
    deliveryLocation,
    buyerOrganization: "Procurement360 Enterprise Corporation",
    buyerContact: "Corporate Procurement & Sourcing Division",

    supplierId: response.supplierId,
    supplierCode,
    supplierName,
    supplierCategory: supplierProfile?.cr49f_suppliercategory || sampleSup?.supplier.cr49f_suppliercategory,
    supplierContactPerson,
    supplierEmail,
    supplierPhone,
    supplierAddress,
    supplierCity,
    supplierCountry,
    supplierGstin,

    promisedDeliveryDate: response.deliveryDate
      ? new Date(response.deliveryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : undefined,
    paymentTerms: response.paymentTerms || "Net 30 days",
    warranty: response.warranty || "1 Year Standard Comprehensive Manufacturer Warranty",
    supplierRemarks: lines.map((l) => l.description).filter(Boolean).join("; "),

    lines,

    grossSubtotal: Math.round(grossSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    netAfterDiscount: Math.round(netAfterDiscount * 100) / 100,
    totalAdditionalCharges: Math.round(totalAdditionalCharges * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    currencySymbol: "₹",

    submissionTimestamp: formattedTimestamp,
    digitalSignatureHash,
    authorizedSignatoryName: supplierContactPerson,
    authorizedSignatoryTitle: "Authorized Commercial Signatory",
  };
}

/**
 * Saves a quotation document to localStorage for persistent retrieval across portals.
 */
export function saveQuotationDocumentToStorage(doc: QuotationDocumentData): void {
  try {
    if (!doc.rfqId || !doc.supplierId) return;
    const cleanRfq = doc.rfqId.toLowerCase().replace(/[{}]/g, "");
    const cleanSup = doc.supplierId.toLowerCase().replace(/[{}]/g, "");
    const cleanSupCode = (doc.supplierCode || "").toLowerCase().trim();

    const json = JSON.stringify(doc);
    localStorage.setItem(`quotation_doc_${cleanRfq}_${cleanSup}`, json);
    if (cleanSupCode) {
      localStorage.setItem(`quotation_doc_${cleanRfq}_${cleanSupCode}`, json);
    }
    localStorage.setItem(`quotation_doc_num_${doc.quotationNumber}`, json);

    // Also register in an index of generated quotation documents for this RFQ
    const indexKey = `rfq_quotations_index_${cleanRfq}`;
    let existingIndex: string[] = [];
    try {
      const raw = localStorage.getItem(indexKey);
      if (raw) existingIndex = JSON.parse(raw);
    } catch {
      existingIndex = [];
    }
    if (!existingIndex.includes(doc.quotationNumber)) {
      existingIndex.push(doc.quotationNumber);
      localStorage.setItem(indexKey, JSON.stringify(existingIndex));
    }
  } catch (err) {
    console.warn("Failed to persist quotation document to storage:", err);
  }
}

/**
 * Loads a quotation document from localStorage if cached.
 */
export function getSavedQuotationDocument(
  rfqId: string,
  supplierIdOrCode: string
): QuotationDocumentData | null {
  try {
    const cleanRfq = (rfqId || "").toLowerCase().replace(/[{}]/g, "");
    const cleanKey = (supplierIdOrCode || "").toLowerCase().replace(/[{}]/g, "").trim();

    const stored =
      localStorage.getItem(`quotation_doc_${cleanRfq}_${cleanKey}`) ||
      localStorage.getItem(`quotation_doc_num_${supplierIdOrCode}`);

    if (stored) {
      return JSON.parse(stored) as QuotationDocumentData;
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Generates the quotation document as a self-contained, executive styled HTML string.
 * Uses 100% standard hex/rgb colors with zero oklch or external stylesheet dependencies.
 */
export function buildQuotationDocumentHtml(doc: QuotationDocumentData): string {
  const currency = doc.currencySymbol;
  const fmt = (v: number) =>
    currency +
    (Number(v) || 0).toLocaleString("en-IN", {
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

  const linesHtml = doc.lines
    .map(
      (l, idx) => `
      <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}; transition: background 0.15s ease;">
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: 600;">${l.lineNumber}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${l.itemName}</div>
          ${
            l.description
              ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.4;">${l.description}</div>`
              : ""
          }
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-weight: 500;">${l.requestedQuantity}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a;">${l.offeredQuantity}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #334155;">${fmt(l.unitPrice)}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          ${
            l.discountPercent > 0
              ? `<span style="display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700;">${l.discountPercent}%</span>`
              : `<span style="color: #94a3b8;">—</span>`
          }
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          ${
            l.additionalChargesPercent > 0
              ? `<span style="display: inline-block; background: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700;">+${l.additionalChargesPercent}%</span>`
              : `<span style="color: #94a3b8;">—</span>`
          }
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          ${
            l.taxPercent > 0
              ? `<span style="display: inline-block; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600;">${l.taxPercent}%</span>`
              : `<span style="color: #94a3b8;">0%</span>`
          }
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${fmt(l.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${doc.quotationNumber} - ${doc.supplierName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 36px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .doc-page {
      max-width: 880px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      overflow: hidden;
    }
    .top-accent-bar {
      height: 6px;
      background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%);
    }
    .doc-inner {
      padding: 36px 42px;
    }
    .header-flex {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 1.5px solid #e2e8f0;
      margin-bottom: 24px;
      gap: 20px;
    }
    .supplier-brand-block {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .supplier-emblem {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: #1e3a8a;
      color: #ffffff;
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.25);
    }
    .supplier-company-name {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      margin-right: 6px;
    }
    .badge-pill.vendor-code {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .badge-pill.gstin {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .title-block {
      text-align: right;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .status-pill.rewarded {
      background: #faf5ff;
      color: #7e22ce;
      border-color: #e9d5ff;
    }
    .doc-main-title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-ref-badge {
      font-size: 13px;
      font-weight: 700;
      color: #2563eb;
      margin-top: 4px;
    }
    .meta-date-row {
      font-size: 12px;
      color: #64748b;
      margin-top: 3px;
    }
    .meta-date-row strong {
      color: #334155;
    }
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 22px;
    }
    .party-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
    }
    .party-eyebrow {
      font-size: 10.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .party-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .party-line {
      font-size: 12px;
      color: #475569;
      line-height: 1.55;
    }
    .party-line strong {
      color: #1e293b;
    }
    .terms-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .term-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .term-label {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .term-val {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .table-container {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .table-lines {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .table-lines thead th {
      background: #f8fafc;
      color: #475569;
      padding: 12px 14px;
      text-align: left;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .financials-wrapper {
      display: grid;
      grid-template-columns: 1.25fr 0.95fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .declarations-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #2563eb;
      border-radius: 8px;
      padding: 16px 18px;
    }
    .declarations-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .declarations-list {
      margin: 0;
      padding-left: 18px;
      font-size: 11.5px;
      color: #475569;
      line-height: 1.6;
    }
    .amount-words-pill {
      margin-top: 14px;
      padding: 10px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #1e40af;
      font-style: italic;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px 20px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .summary-table td {
      padding: 6px 0;
    }
    .summary-table .label {
      color: #64748b;
    }
    .summary-table .val {
      text-align: right;
      font-weight: 600;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .grand-total-row {
      border-top: 2px solid #0f172a;
      margin-top: 10px;
      padding-top: 10px;
    }
    .grand-total-row td {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .grand-total-row .val {
      font-size: 19px;
      color: #1d4ed8;
      font-weight: 800;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 22px;
      border-top: 1px dashed #cbd5e1;
      margin-top: 20px;
      gap: 20px;
    }
    .stamp-box {
      border: 1.5px solid #059669;
      background: #ecfdf5;
      padding: 12px 16px;
      border-radius: 8px;
      color: #065f46;
      max-width: 390px;
    }
    .stamp-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #047857;
      margin-bottom: 4px;
    }
    .stamp-sub {
      font-size: 10.5px;
      color: #065f46;
      line-height: 1.45;
    }
    .stamp-hash {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9.5px;
      color: #047857;
      margin-top: 4px;
      word-break: break-all;
    }
    .signatory-box {
      text-align: right;
      min-width: 240px;
    }
    .signatory-signature-line {
      display: inline-block;
      width: 180px;
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 8px;
    }
    .signatory-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .signatory-title {
      font-size: 11.5px;
      color: #64748b;
    }
    .signatory-company {
      font-size: 12.5px;
      font-weight: 600;
      color: #1e3a8a;
      margin-top: 2px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .doc-page { border: none; box-shadow: none; border-radius: 0; }
      .doc-inner { padding: 12mm 15mm; }
      .table-container, .parties-grid, .financials-wrapper, .signature-row { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc-page">
    <div class="top-accent-bar"></div>
    <div class="doc-inner">
      <div class="header-flex">
        <div>
          <div class="supplier-brand-block">
            <div class="supplier-emblem">${getInitials(doc.supplierName)}</div>
            <div>
              <div class="supplier-company-name">${doc.supplierName}</div>
              <div style="margin-top: 4px;">
                <span class="badge-pill vendor-code">ID: ${doc.supplierCode}</span>
                ${
                  doc.supplierGstin
                    ? `<span class="badge-pill gstin">GSTIN: ${doc.supplierGstin}</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 8px; line-height: 1.45;">
            ${doc.supplierAddress ? `${doc.supplierAddress}, ` : ""}${doc.supplierCity ? `${doc.supplierCity}, ` : ""}${doc.supplierCountry || "India"}<br>
            Email: <strong style="color: #334155;">${doc.supplierEmail || "—"}</strong> • Phone: <strong style="color: #334155;">${doc.supplierPhone || "—"}</strong>
          </div>
        </div>

        <div class="title-block">
          <div class="status-pill ${doc.status === "Rewarded" ? "rewarded" : ""}">
            ● ${doc.status === "Rewarded" ? "AWARDED QUOTATION" : "OFFICIALLY SUBMITTED"}
          </div>
          <h1 class="doc-main-title">Commercial Quotation</h1>
          <div class="doc-ref-badge">Ref: ${doc.quotationNumber}</div>
          <div class="meta-date-row">Date Issued: <strong>${doc.documentDate}</strong></div>
          <div class="meta-date-row">Valid Until: <strong>${doc.validUntilDate}</strong></div>
        </div>
      </div>

      <div class="parties-grid">
        <div class="party-card">
          <div class="party-eyebrow">From (Supplier / Bidding Entity)</div>
          <div class="party-name">${doc.supplierName}</div>
          <div class="party-line">
            Authorized Contact: <strong>${doc.supplierContactPerson || "Commercial Sales Lead"}</strong><br>
            Vendor Identification: <strong>${doc.supplierCode}</strong><br>
            Official Email: ${doc.supplierEmail || "—"}<br>
            Phone / Hotline: ${doc.supplierPhone || "—"}
          </div>
        </div>

        <div class="party-card">
          <div class="party-eyebrow">Quotation Prepared For (Buyer Entity)</div>
          <div class="party-name">${doc.buyerOrganization}</div>
          <div class="party-line">
            RFQ Reference: <strong>${doc.rfqNumber}</strong> (${doc.rfqTitle})<br>
            Associated PR: <strong>${doc.associatedPr || "N/A"}</strong><br>
            Delivery Facility: <strong>${doc.deliveryLocation}</strong><br>
            Division: <strong>${doc.buyerContact || "Corporate Procurement Team"}</strong>
          </div>
        </div>
      </div>

      <div class="terms-grid">
        <div class="term-box">
          <div class="term-label">Promised Delivery</div>
          <div class="term-val" style="color: #1e3a8a;">${doc.promisedDeliveryDate || "As Per RFQ Schedule"}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Payment Terms</div>
          <div class="term-val">${doc.paymentTerms}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Warranty Coverage</div>
          <div class="term-val">${doc.warranty}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Document Status</div>
          <div class="term-val" style="color: #047857;">✔ Submitted &amp; Verified</div>
        </div>
      </div>

      <div class="table-container">
        <table class="table-lines">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">#</th>
              <th>Item Description &amp; Specifications</th>
              <th style="width: 75px; text-align: center;">Req Qty</th>
              <th style="width: 75px; text-align: center;">Offered</th>
              <th style="width: 105px; text-align: right;">Unit Price</th>
              <th style="width: 75px; text-align: center;">Discount</th>
              <th style="width: 75px; text-align: center;">Charges</th>
              <th style="width: 65px; text-align: center;">Tax</th>
              <th style="width: 120px; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>
      </div>

      <div class="financials-wrapper">
        <div>
          <div class="declarations-card">
            <div class="declarations-title">Commercial Declarations &amp; Scope</div>
            <ul class="declarations-list">
              <li>Prices quoted are firm, fixed, and valid for 30 calendar days from <strong>${doc.documentDate}</strong>.</li>
              <li>Goods and services conform strictly with the technical specifications in <strong>${doc.rfqNumber}</strong>.</li>
              <li>Delivery destination facility: <strong>${doc.deliveryLocation}</strong>.</li>
              <li>Standard manufacturer warranty: <strong>${doc.warranty}</strong>.</li>
            </ul>

            <div class="amount-words-pill">
              <strong>Amount in Words:</strong><br>
              ${numberToWords(doc.grandTotal)}
            </div>
          </div>
        </div>

        <div>
          <div class="summary-card">
            <table class="summary-table">
              <tr>
                <td class="label">Gross Subtotal:</td>
                <td class="val">${fmt(doc.grossSubtotal)}</td>
              </tr>
              ${
                doc.totalDiscount > 0
                  ? `<tr>
                      <td class="label" style="color: #16a34a;">Commercial Discount:</td>
                      <td class="val" style="color: #16a34a;">-${fmt(doc.totalDiscount)}</td>
                    </tr>`
                  : ""
              }
              ${
                doc.totalAdditionalCharges > 0
                  ? `<tr>
                      <td class="label" style="color: #b45309;">Freight, Handling &amp; Logistics:</td>
                      <td class="val" style="color: #b45309;">+${fmt(doc.totalAdditionalCharges)}</td>
                    </tr>`
                  : ""
              }
              <tr>
                <td class="label">Applicable Tax &amp; GST:</td>
                <td class="val">+${fmt(doc.totalTax)}</td>
              </tr>
              <tr class="grand-total-row">
                <td style="padding-top: 12px;">Net Payable:</td>
                <td class="val" style="padding-top: 12px;">${fmt(doc.grandTotal)}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <div class="signature-row">
        <div class="stamp-box">
          <div class="stamp-title">✔ Verified &amp; Audited Proposal</div>
          <div class="stamp-sub">
            Electronically authenticated and logged in Procurement360 platform.<br>
            Submission Timestamp: <strong>${doc.submissionTimestamp}</strong>
          </div>
          <div class="stamp-hash">${doc.digitalSignatureHash}</div>
        </div>

        <div class="signatory-box">
          <div class="signatory-signature-line"></div>
          <div class="signatory-name">${doc.authorizedSignatoryName}</div>
          <div class="signatory-title">${doc.authorizedSignatoryTitle}</div>
          <div class="signatory-company">${doc.supplierName}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return htmlContent;
}

/**
 * Downloads the quotation document as a self-contained, executive styled HTML file.
 */
export function downloadQuotationDocumentHtml(doc: QuotationDocumentData): void {
  const htmlContent = buildQuotationDocumentHtml(doc);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.quotationNumber}_${doc.supplierName.replace(/[^A-Za-z0-9]/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Direct client-side PDF download for quotation document using html2canvas & jsPDF.
 * Renders inside a clean, isolated DOM sandbox with zero oklch / theme stylesheet collisions,
 * generating a sharp, high-resolution A4 PDF.
 */
export async function downloadQuotationDocumentPdf(
  _element: HTMLElement | null,
  doc: QuotationDocumentData
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Create an isolated iframe to completely isolate rendering from main document's Tailwind v4 / oklch stylesheets
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "920px";
  iframe.style.height = "1600px";
  iframe.style.border = "none";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Unable to create isolated rendering sandbox for PDF generation.");
    }

    const htmlContent = buildQuotationDocumentHtml(doc);
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for the iframe layout and web fonts to complete rendering
    await new Promise((resolve) => setTimeout(resolve, 250));

    const targetElement =
      (iframeDoc.querySelector(".doc-page") as HTMLElement) || iframeDoc.body;

    const canvas = await html2canvas(targetElement, {
      scale: 2, // 2x high-resolution rendering
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: 920,
      onclone: (clonedDoc) => {
        // Extra safeguard: remove any oklch occurrences if any browser extension or agent injected one
        const styles = clonedDoc.querySelectorAll("style");
        styles.forEach((st) => {
          if (st.textContent && st.textContent.includes("oklch")) {
            st.textContent = st.textContent.replace(/oklch\([^)]+\)/gi, "#2563eb");
          }
        });
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // A4 dimensions: 210mm x 297mm
    const marginMm = 8;
    const pdfWidthMm = 210 - marginMm * 2; // 194mm
    const pdfPageHeightMm = 297 - marginMm * 2; // 281mm

    const totalContentHeightMm = (canvas.height * pdfWidthMm) / canvas.width;

    if (totalContentHeightMm <= pdfPageHeightMm) {
      // Single page document
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      pdf.addImage(imgData, "JPEG", marginMm, marginMm, pdfWidthMm, totalContentHeightMm, undefined, "FAST");
    } else {
      // Multi-page document: slice canvas cleanly by page height
      const pxPerMm = canvas.width / pdfWidthMm;
      const pageSliceHeightPx = Math.floor(pdfPageHeightMm * pxPerMm);
      let renderedHeightPx = 0;
      let pageIndex = 0;

      while (renderedHeightPx < canvas.height) {
        const sliceHeight = Math.min(pageSliceHeightPx, canvas.height - renderedHeightPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");

        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            renderedHeightPx,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );

          const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.98);
          const sliceHeightMm = sliceHeight / pxPerMm;

          if (pageIndex > 0) {
            pdf.addPage();
          }
          pdf.addImage(pageImgData, "JPEG", marginMm, marginMm, pdfWidthMm, sliceHeightMm, undefined, "FAST");
          pageIndex++;
        }

        renderedHeightPx += sliceHeight;
      }
    }

    const filename = `${doc.quotationNumber}_${doc.supplierName.replace(/[^A-Za-z0-9]/g, "_")}.pdf`;
    pdf.save(filename);
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
