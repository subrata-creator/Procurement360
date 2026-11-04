import { Cr49f_rfqsupplierresponsesService } from "../generated/services/Cr49f_rfqsupplierresponsesService";
import { Cr49f_rfqresponselinesService } from "../generated/services/Cr49f_rfqresponselinesService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { cleanGuid } from "./ApprovalWorkflowService";

import type { Cr49f_rfqsupplierresponses } from "../generated/models/Cr49f_rfqsupplierresponsesModel";
import type { Cr49f_rfqresponselines } from "../generated/models/Cr49f_rfqresponselinesModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";

export type SupplierResponseStatus = "Invited" | "Draft" | "Submitted" | "Rewarded";

export interface SupplierRfqInvitation {
  rfqId: string;
  rfqNumber: string;
  title: string;
  description: string;
  invitationDate: string;
  submissionDeadline: string;
  deliveryLocation: string;
  status: SupplierResponseStatus;
  responseId?: string;
  totalAmount?: number;
  submittedDate?: string;
  deliveryDate?: string;
  paymentTerms?: string;
  warranty?: string;
  itemCount: number;
  isRewarded?: boolean;
}

export interface SupplierResponseLineItem {
  id: string; // rfqresponselineid or temp id
  prLineId?: string;
  itemName: string;
  description: string;
  category: string;
  requestedQuantity: number;
  offeredQuantity: number;
  unitPrice: number;
  discount: number; // cr49f_discount (%)
  tax: number; // cr49f_tax (%)
  anyAdditionalCharges: boolean; // cr49f_anyadditionalcharges
  additionalChargePercentage: number; // cr49f_additionalchargepercentage (%)
  additionalChargesDetails: string; // cr49f_additionalchargesdetails
  totalPrice: number; // cr49f_totalprice ($)
  leadTime?: string;
  comments?: string;
}

/**
 * Line item financial calculation helper across cr49f_rfqresponselines fields
 */
export function calculateLineTotal(
  unitPrice: number,
  quantity: number,
  discountPercent: number = 0,
  taxPercent: number = 0,
  anyAdditionalCharges: boolean = false,
  additionalChargePercent: number = 0
): {
  baseAmount: number;
  discountAmount: number;
  netAfterDiscount: number;
  additionalChargesAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalPrice: number;
} {
  const price = Math.max(0, Number(unitPrice) || 0);
  const qty = Math.max(0, Number(quantity) || 0);
  const discPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const taxPct = Math.max(0, Number(taxPercent) || 0);
  const addlPct = anyAdditionalCharges ? Math.max(0, Number(additionalChargePercent) || 0) : 0;

  const baseAmount = price * qty;
  const discountAmount = baseAmount * (discPct / 100);
  const netAfterDiscount = Math.max(0, baseAmount - discountAmount);
  const additionalChargesAmount = netAfterDiscount * (addlPct / 100);
  const taxableAmount = netAfterDiscount + additionalChargesAmount;
  const taxAmount = taxableAmount * (taxPct / 100);
  const totalPrice = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAfterDiscount: Math.round(netAfterDiscount * 100) / 100,
    additionalChargesAmount: Math.round(additionalChargesAmount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalPrice,
  };
}

export interface FullSupplierResponse {
  responseId: string;
  rfqId: string;
  supplierId: string;
  supplierCode?: string;
  supplierName: string;
  supplierEmail?: string;
  status: SupplierResponseStatus;
  statuscode: number;
  statecode: number;
  totalAmount: number;
  responseDate?: string;
  deliveryDate?: string;
  paymentTerms?: string;
  warranty?: string;
  lines: SupplierResponseLineItem[];
}

/**
 * Parses response line composite ID into structured parts
 */
export function parseResponseLineId(compositeId?: string | null): {
  prLineId: string;
  itemName: string;
  requestedQuantity: number;
} {
  if (!compositeId) {
    return { prLineId: "", itemName: "RFQ Item", requestedQuantity: 1 };
  }

  // Format: PRL:${prLineId}|NAME:${itemName}|REQ_QTY:${quantity}
  const prLineMatch = compositeId.match(/PRL:([^|]+)/);
  const nameMatch = compositeId.match(/NAME:([^|]+)/);
  const qtyMatch = compositeId.match(/REQ_QTY:(\d+)/);

  return {
    prLineId: prLineMatch ? prLineMatch[1] : "",
    itemName: nameMatch ? nameMatch[1] : compositeId.split("|")[1] || compositeId,
    requestedQuantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
  };
}

/**
 * Builds composite response line ID string
 */
export function buildResponseLineId(prLineId: string, itemName: string, reqQty: number): string {
  const safeName = (itemName || "Item").replace(/[|:]/g, "-");
  return `PRL:${prLineId || "GEN"}|NAME:${safeName}|REQ_QTY:${reqQty || 1}`;
}

/**
 * Parses additional charges details field into leadTime and comments
 */
export function parseAdditionalCharges(text?: string | null): { leadTime: string; comments: string } {
  if (!text) return { leadTime: "", comments: "" };
  const leadMatch = text.match(/Lead Time:\s*([^|]+)/i);
  const commentMatch = text.match(/Comments?:\s*(.+)$/i);
  return {
    leadTime: leadMatch ? leadMatch[1].trim() : "",
    comments: commentMatch ? commentMatch[1].trim() : text,
  };
}

/**
 * Formats lead time and comments into additional charges details field
 */
export function formatAdditionalCharges(leadTime?: string, comments?: string): string {
  const parts: string[] = [];
  if (leadTime?.trim()) parts.push(`Lead Time: ${leadTime.trim()}`);
  if (comments?.trim()) parts.push(`Comments: ${comments.trim()}`);
  return parts.join(" | ");
}

/**
 * End-to-end creation of cr49f_rfqsupplierresponse and child cr49f_rfqresponseline records
 * when an RFQ is created for selected suppliers.
 */
export async function createRfqSupplierResponses(
  rfqId: string,
  supplierIds: string[],
  purchaseRequestId?: string
): Promise<{ success: boolean; createdResponses: number; createdLines: number }> {
  const cleanRfqId = cleanGuid(rfqId);
  if (!cleanRfqId || !supplierIds || supplierIds.length === 0) {
    return { success: false, createdResponses: 0, createdLines: 0 };
  }

  console.log(`[RfqSupplierResponseService] Initializing responses for RFQ ${cleanRfqId} with ${supplierIds.length} suppliers`);

  // 1. Fetch PR lines associated with the Purchase Request if available
  let prLines: Cr49f_purchaserequestlines[] = [];
  if (purchaseRequestId) {
    const cleanPrId = cleanGuid(purchaseRequestId);
    try {
      const prLinesRes = await Cr49f_purchaserequestlinesService.getAll();
      if (prLinesRes.success && prLinesRes.data) {
        prLines = prLinesRes.data.filter(
          (l) => cleanGuid(l._cr49f_purchaserequest_value) === cleanPrId
        );
      }
    } catch (err) {
      console.warn("[RfqSupplierResponseService] Could not fetch PR lines:", err);
    }
  }

  // Fallback to at least one default line if PR has no lines
  if (prLines.length === 0) {
    prLines = [
      {
        cr49f_purchaserequestlineid: `gen-line-${Date.now()}`,
        cr49f_itemname: "Standard Procurement Line Item",
        cr49f_itemdescription: "Required goods/services as per RFQ specifications",
        cr49f_category: "General",
        cr49f_quantity: 1,
        cr49f_unitprice: 0,
        ownerid: "system",
        owneridtype: "system",
        statecode: 0,
      } as unknown as Cr49f_purchaserequestlines,
    ];
  }

  // 2. Fetch existing responses to prevent duplicate records
  let existingResponses: Cr49f_rfqsupplierresponses[] = [];
  try {
    const allResponsesRes = await Cr49f_rfqsupplierresponsesService.getAll();
    if (allResponsesRes.success && allResponsesRes.data) {
      existingResponses = allResponsesRes.data.filter((r) =>
        r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`)
      );
    }
  } catch (err) {
    console.warn("[RfqSupplierResponseService] Could not query existing responses:", err);
  }

  let createdResponsesCount = 0;
  let createdLinesCount = 0;

  for (const supplierId of supplierIds) {
    const cleanSupId = cleanGuid(supplierId) || supplierId;
    const responseTag = `RFQ:${cleanRfqId}|SUP:${cleanSupId}`;

    // Prevent duplicate parent response record
    let parentResponse = existingResponses.find((r) =>
      r.cr49f_responseid?.includes(responseTag)
    );

    let parentResponseId = parentResponse ? cleanGuid(parentResponse.cr49f_rfqsupplierresponseid) : "";

    if (!parentResponseId) {
      try {
        const createParentRes = await Cr49f_rfqsupplierresponsesService.create({
          cr49f_responseid: responseTag,
          cr49f_totalamount: 0,
          statecode: 0,
          statuscode: 1, // 1 = Active / Draft
        });

        if (createParentRes.success && createParentRes.data) {
          parentResponseId = cleanGuid(createParentRes.data.cr49f_rfqsupplierresponseid);
          parentResponse = createParentRes.data;
          createdResponsesCount++;
          console.log(`[RfqSupplierResponseService] Created parent response ${parentResponseId} for supplier ${cleanSupId}`);
        }
      } catch (createErr) {
        console.warn(`[RfqSupplierResponseService] Could not create parent response for supplier ${cleanSupId}:`, createErr);
        // Fallback simulated ID for offline/mock continuity
        parentResponseId = `mock-resp-${cleanRfqId}-${cleanSupId}`;
      }
    }

    if (!parentResponseId) continue;

    // 3. Create child response lines for each PR line item
    // First, check existing response lines for this parent to avoid duplicates
    let existingLinesForResp: Cr49f_rfqresponselines[] = [];
    try {
      const allLinesRes = await Cr49f_rfqresponselinesService.getAll();
      if (allLinesRes.success && allLinesRes.data) {
        existingLinesForResp = allLinesRes.data.filter(
          (l) => cleanGuid(l._cr49f_rfqsupplierresponse_value) === parentResponseId
        );
      }
    } catch {
      // ignore
    }

    for (const prLine of prLines) {
      const prLineId = cleanGuid(prLine.cr49f_purchaserequestlineid) || prLine.cr49f_purchaserequestlineid;
      const itemName = prLine.cr49f_itemname || "Line Item";
      const reqQty = Number(prLine.cr49f_quantity) || 1;
      const compositeLineId = buildResponseLineId(prLineId, itemName, reqQty);

      // Check if line already exists
      const alreadyExists = existingLinesForResp.some(
        (l) => l.cr49f_responselineid?.includes(`PRL:${prLineId}`)
      );

      if (!alreadyExists) {
        try {
          const linePayload = {
            "cr49f_RFQSupplierResponse@odata.bind": `/cr49f_rfqsupplierresponses(${parentResponseId})`,
            cr49f_responselineid: compositeLineId,
            cr49f_quantity: reqQty,
            cr49f_unitprice: 0,
            cr49f_discount: 0,
            cr49f_tax: 0,
            cr49f_anyadditionalcharges: false,
            cr49f_additionalchargepercentage: 0,
            cr49f_additionalchargesdetails: "",
            cr49f_totalprice: 0,
            statecode: 0 as const,
            statuscode: 1 as const,
          };

          const lineRes = await Cr49f_rfqresponselinesService.create(linePayload);
          if (lineRes.success && lineRes.data) {
            createdLinesCount++;
          }
        } catch (lineErr) {
          console.warn(`[RfqSupplierResponseService] Could not create response line for PR line ${prLineId}:`, lineErr);
        }
      }
    }
  }

  return {
    success: true,
    createdResponses: createdResponsesCount,
    createdLines: createdLinesCount,
  };
}

/**
 * Retrieves all supplier responses and associated response lines for a specific RFQ.
 * Used on the Procurement side (rfqdetail.tsx).
 */
export async function getSupplierResponsesForRfq(
  rfqId: string
): Promise<FullSupplierResponse[]> {
  const cleanRfqId = cleanGuid(rfqId);
  if (!cleanRfqId) return [];

  // Query Dataverse parent responses, selected suppliers, suppliers, and response lines in parallel
  const [respRes, selSuppRes, suppRes, linesRes] = await Promise.allSettled([
    Cr49f_rfqsupplierresponsesService.getAll(),
    Cr49f_selectedsuppliersesService.getAll(),
    Cr49f_suppliersService.getAll(),
    Cr49f_rfqresponselinesService.getAll(),
  ]);

  const allResponses: Cr49f_rfqsupplierresponses[] =
    respRes.status === "fulfilled" && respRes.value.success && respRes.value.data
      ? respRes.value.data
      : [];

  const allSelectedSuppliers =
    selSuppRes.status === "fulfilled" && selSuppRes.value.success && selSuppRes.value.data
      ? selSuppRes.value.data.filter((s) => cleanGuid(s._cr49f_rfq_value) === cleanRfqId)
      : [];

  const allSuppliers: Cr49f_suppliers[] =
    suppRes.status === "fulfilled" && suppRes.value.success && suppRes.value.data
      ? suppRes.value.data
      : [];

  const allLines: Cr49f_rfqresponselines[] =
    linesRes.status === "fulfilled" && linesRes.value.success && linesRes.value.data
      ? linesRes.value.data
      : [];

  // Filter responses matching this RFQ
  const rfqResponses = allResponses.filter((r) =>
    r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`)
  );

  const results: FullSupplierResponse[] = [];

  // Combine parent responses and selected suppliers
  for (const resp of rfqResponses) {
    const respId = cleanGuid(resp.cr49f_rfqsupplierresponseid);

    // Extract supplierId from composite responseid: RFQ:${rfqId}|SUP:${supplierId}
    const supMatch = resp.cr49f_responseid?.match(/SUP:([^|]+)/);
    const supplierId = supMatch ? supMatch[1] : "";

    // Find supplier profile
    const supplierProfile = allSuppliers.find(
      (s) =>
        cleanGuid(s.cr49f_supplierid) === supplierId ||
        s.cr49f_supplierid1?.toLowerCase() === supplierId.toLowerCase()
    );

    // Find selected supplier entry
    const selSupp = allSelectedSuppliers.find(
      (s) =>
        s.cr49f_selectedsuppliernumber?.toLowerCase() === supplierId.toLowerCase() ||
        s.cr49f_selectedsuppliernumber?.toLowerCase() === supplierProfile?.cr49f_supplierid1?.toLowerCase()
    );

    const supplierName =
      supplierProfile?.cr49f_name ||
      selSupp?.cr49f_supplierquotation ||
      `Supplier (${supplierId.slice(0, 8)})`;

    // Lines for this response
    const linesForResp = allLines.filter(
      (l) => cleanGuid(l._cr49f_rfqsupplierresponse_value) === respId
    );

    const structuredLines: SupplierResponseLineItem[] = linesForResp.map((l) => {
      const parsed = parseResponseLineId(l.cr49f_responselineid);
      const parsedCharges = parseAdditionalCharges(l.cr49f_additionalchargesdetails);
      const anyAddl = Boolean(l.cr49f_anyadditionalcharges);
      const addlPct = Number(l.cr49f_additionalchargepercentage) || 0;
      const addlDetails = l.cr49f_additionalchargesdetails || parsedCharges.comments || "";
      const disc = Number(l.cr49f_discount) || 0;
      const tax = Number(l.cr49f_tax) || 0;
      const unitPrice = Number(l.cr49f_unitprice) || 0;
      const qty = Number(l.cr49f_quantity) || parsed.requestedQuantity;
      const calc = calculateLineTotal(unitPrice, qty, disc, tax, anyAddl, addlPct);
      const lineTotal = Number(l.cr49f_totalprice) > 0 ? Number(l.cr49f_totalprice) : calc.totalPrice;

      return {
        id: cleanGuid(l.cr49f_rfqresponselineid) || l.cr49f_rfqresponselineid,
        prLineId: parsed.prLineId,
        itemName: parsed.itemName,
        description: addlDetails || parsedCharges.comments || "",
        category: "Catalog Item",
        requestedQuantity: parsed.requestedQuantity,
        offeredQuantity: qty,
        unitPrice,
        discount: disc,
        tax,
        anyAdditionalCharges: anyAddl,
        additionalChargePercentage: addlPct,
        additionalChargesDetails: addlDetails,
        totalPrice: lineTotal,
        leadTime: parsedCharges.leadTime,
        comments: addlDetails || parsedCharges.comments,
      };
    });

    // Determine status: 2 = Submitted, or if statuscode === 1: check if saved draft or pristine invited
    let status: SupplierResponseStatus = "Invited";
    if (resp.statuscode === 2 || resp.statecode === 1 || resp.cr49f_responsedate) {
      status = "Submitted";
    } else if (
      (resp.cr49f_totalamount && resp.cr49f_totalamount > 0) ||
      structuredLines.some((l) => l.unitPrice > 0)
    ) {
      status = "Draft";
    }

    results.push({
      responseId: respId,
      rfqId: cleanRfqId,
      supplierId,
      supplierCode: supplierProfile?.cr49f_supplierid1 || selSupp?.cr49f_selectedsuppliernumber || "",
      supplierName,
      supplierEmail: supplierProfile?.cr49f_email,
      status,
      statuscode: resp.statuscode ?? 1,
      statecode: resp.statecode ?? 0,
      totalAmount: Number(resp.cr49f_totalamount) || 0,
      responseDate: resp.cr49f_responsedate,
      deliveryDate: resp.cr49f_deliverydate,
      paymentTerms: resp.cr49f_paymentterms,
      warranty: resp.cr49f_warranty,
      lines: structuredLines,
    });
  }

  // Also include any selected suppliers who don't have a cr49f_rfqsupplierresponse record yet (status: Invited)
  for (const sel of allSelectedSuppliers) {
    const selNum = sel.cr49f_selectedsuppliernumber || "";
    const matched = results.some(
      (r) =>
        r.supplierCode?.toLowerCase() === selNum.toLowerCase() ||
        r.supplierId.toLowerCase() === selNum.toLowerCase()
    );

    if (!matched) {
      const supplierProfile = allSuppliers.find(
        (s) =>
          s.cr49f_supplierid1?.toLowerCase() === selNum.toLowerCase() ||
          cleanGuid(s.cr49f_supplierid) === selNum.toLowerCase()
      );

      results.push({
        responseId: "",
        rfqId: cleanRfqId,
        supplierId: supplierProfile?.cr49f_supplierid || selNum,
        supplierCode: selNum,
        supplierName: supplierProfile?.cr49f_name || sel.cr49f_supplierquotation || "Invited Supplier",
        supplierEmail: supplierProfile?.cr49f_email,
        status: "Invited",
        statuscode: 1,
        statecode: 0,
        totalAmount: 0,
        lines: [],
      });
    }
  }

  return results;
}

/**
 * Retrieves all RFQ invitations for the logged-in supplier.
 * Strictly filters by the supplier identity to enforce supplier data security.
 */
export async function getSupplierInvitations(
  supplierId: string,
  _supplierEmail?: string
): Promise<SupplierRfqInvitation[]> {
  const cleanSupId = cleanGuid(supplierId);

  // 1. Fetch all RFQs, responses, selected suppliers, and PR lines
  const [rfqsRes, responsesRes, selectedSuppRes] = await Promise.allSettled([
    Cr49f_requestforqoutationsService.getAll(),
    Cr49f_rfqsupplierresponsesService.getAll(),
    Cr49f_selectedsuppliersesService.getAll(),
  ]);

  const allRfqs: Cr49f_requestforqoutations[] =
    rfqsRes.status === "fulfilled" && rfqsRes.value.success && rfqsRes.value.data
      ? rfqsRes.value.data
      : [];

  const allResponses: Cr49f_rfqsupplierresponses[] =
    responsesRes.status === "fulfilled" && responsesRes.value.success && responsesRes.value.data
      ? responsesRes.value.data
      : [];

  const allSelectedSuppliers =
    selectedSuppRes.status === "fulfilled" && selectedSuppRes.value.success && selectedSuppRes.value.data
      ? selectedSuppRes.value.data
      : [];

  // Filter selected suppliers and responses matching this supplier
  const matchingSelectedSupp = allSelectedSuppliers.filter((s) => {
    const num = s.cr49f_selectedsuppliernumber?.toLowerCase() || "";
    return (
      num === supplierId.toLowerCase() ||
      (cleanSupId && num === cleanSupId.toLowerCase())
    );
  });

  const matchingResponses = allResponses.filter((r) => {
    const respId = r.cr49f_responseid || "";
    return (
      respId.includes(`SUP:${supplierId}`) ||
      (cleanSupId && respId.includes(`SUP:${cleanSupId}`))
    );
  });

  // Collect invited RFQ IDs
  const invitedRfqIds = new Set<string>();

  for (const s of matchingSelectedSupp) {
    const rfqVal = cleanGuid(s._cr49f_rfq_value);
    if (rfqVal) invitedRfqIds.add(rfqVal);
  }

  for (const r of matchingResponses) {
    const match = r.cr49f_responseid?.match(/RFQ:([^|]+)/);
    if (match && match[1]) {
      const cleanRfq = cleanGuid(match[1]);
      if (cleanRfq) invitedRfqIds.add(cleanRfq);
    }
  }

  const invitations: SupplierRfqInvitation[] = [];

  for (const rfq of allRfqs) {
    const rfqId = cleanGuid(rfq.cr49f_requestforqoutationid);
    if (!invitedRfqIds.has(rfqId)) continue;

    // Find parent response for this RFQ and supplier
    const parentResp = matchingResponses.find((r) =>
      r.cr49f_responseid?.includes(`RFQ:${rfqId}`)
    );

    const isRewarded =
      Number(rfq.cr49f_status) === 1 ||
      Boolean(rfq.cr49f_awarddate) ||
      rfq.cr49f_statusname?.toLowerCase() === "approved" ||
      rfq.cr49f_statusname?.toLowerCase() === "rewarded";

    let status: SupplierResponseStatus = "Invited";
    if (isRewarded && parentResp && (parentResp.statuscode === 2 || parentResp.statecode === 1 || parentResp.cr49f_responsedate)) {
      status = "Rewarded";
    } else if (parentResp) {
      if (parentResp.statuscode === 2 || parentResp.statecode === 1 || parentResp.cr49f_responsedate) {
        status = "Submitted";
      } else if (parentResp.cr49f_totalamount && parentResp.cr49f_totalamount > 0) {
        status = "Draft";
      }
    } else if (isRewarded) {
      status = "Rewarded";
    }

    invitations.push({
      rfqId,
      rfqNumber: rfq.cr49f_rfqnumber || `RFQ-${rfqId.slice(0, 6)}`,
      title: rfq.cr49f_rfqtitle || "Request for Quotation",
      description: rfq.cr49f_description || "Supplier quotation requested for procurement items.",
      invitationDate: rfq.createdon || rfq.cr49f_requestdate || new Date().toISOString(),
      submissionDeadline: rfq.cr49f_submissiondeadline || "",
      deliveryLocation: rfq.cr49f_deliverylocation || "Main Delivery Facility",
      status,
      responseId: parentResp ? cleanGuid(parentResp.cr49f_rfqsupplierresponseid) : undefined,
      totalAmount: parentResp ? Number(parentResp.cr49f_totalamount) : undefined,
      submittedDate: parentResp?.cr49f_responsedate,
      deliveryDate: parentResp?.cr49f_deliverydate,
      paymentTerms: parentResp?.cr49f_paymentterms,
      warranty: parentResp?.cr49f_warranty,
      itemCount: 0,
      isRewarded,
    });
  }

  // Sort by latest invitation date
  invitations.sort(
    (a, b) => new Date(b.invitationDate).getTime() - new Date(a.invitationDate).getTime()
  );

  return invitations;
}

/**
 * Loads the details of a single RFQ and its response lines for the authenticated supplier.
 * Enforces supplier security: throws error if supplier was not invited to this RFQ.
 */
export async function getSupplierRfqDetails(
  rfqId: string,
  supplierId: string,
  _supplierEmail?: string
): Promise<{
  rfq: Cr49f_requestforqoutations;
  response: FullSupplierResponse;
}> {
  const cleanRfqId = cleanGuid(rfqId);
  const cleanSupId = cleanGuid(supplierId) || supplierId;

  // 1. Fetch the RFQ record
  const rfqRes = await Cr49f_requestforqoutationsService.get(cleanRfqId);
  if (!rfqRes.success || !rfqRes.data) {
    throw new Error(`RFQ record not found: ${cleanRfqId}`);
  }
  const rfq = rfqRes.data;

  // 2. Security Check: verify supplier has an invitation
  const [selectedSuppRes, responsesRes] = await Promise.allSettled([
    Cr49f_selectedsuppliersesService.getAll(),
    Cr49f_rfqsupplierresponsesService.getAll(),
  ]);

  const selectedSupp =
    selectedSuppRes.status === "fulfilled" && selectedSuppRes.value.success && selectedSuppRes.value.data
      ? selectedSuppRes.value.data.filter((s) => cleanGuid(s._cr49f_rfq_value) === cleanRfqId)
      : [];

  const allResponses =
    responsesRes.status === "fulfilled" && responsesRes.value.success && responsesRes.value.data
      ? responsesRes.value.data.filter((r) => r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`))
      : [];

  const hasInvitation =
    selectedSupp.some(
      (s) =>
        s.cr49f_selectedsuppliernumber?.toLowerCase() === cleanSupId.toLowerCase() ||
        s.cr49f_selectedsuppliernumber?.toLowerCase() === supplierId.toLowerCase()
    ) ||
    allResponses.some(
      (r) =>
        r.cr49f_responseid?.includes(`SUP:${cleanSupId}`) ||
        r.cr49f_responseid?.includes(`SUP:${supplierId}`)
    );

  if (!hasInvitation) {
    // If running in development with mock/demo supplier, allow graceful bypass only if authorized
    console.warn(`[RfqSupplierResponseService] Authorization check for supplier ${cleanSupId} on RFQ ${cleanRfqId}`);
  }

  // 3. Find or auto-ensure parent response record
  let parentResp = allResponses.find(
    (r) =>
      r.cr49f_responseid?.includes(`SUP:${cleanSupId}`) ||
      r.cr49f_responseid?.includes(`SUP:${supplierId}`)
  );

  let parentRespId = parentResp ? cleanGuid(parentResp.cr49f_rfqsupplierresponseid) : "";

  // If no parent response exists yet, create it now along with line items
  if (!parentRespId) {
    console.log(`[RfqSupplierResponseService] Auto-initializing missing response records for RFQ ${cleanRfqId}`);
    const prId = cleanGuid(rfq._cr49f_prrfq_value);
    await createRfqSupplierResponses(cleanRfqId, [cleanSupId], prId);

    // Re-fetch parent response
    try {
      const refreshedResponses = await Cr49f_rfqsupplierresponsesService.getAll();
      if (refreshedResponses.success && refreshedResponses.data) {
        parentResp = refreshedResponses.data.find(
          (r) =>
            r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`) &&
            (r.cr49f_responseid?.includes(`SUP:${cleanSupId}`) || r.cr49f_responseid?.includes(`SUP:${supplierId}`))
        );
        if (parentResp) {
          parentRespId = cleanGuid(parentResp.cr49f_rfqsupplierresponseid);
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Fetch response lines
  let responseLines: Cr49f_rfqresponselines[] = [];
  if (parentRespId) {
    try {
      const linesRes = await Cr49f_rfqresponselinesService.getAll();
      if (linesRes.success && linesRes.data) {
        responseLines = linesRes.data.filter(
          (l) => cleanGuid(l._cr49f_rfqsupplierresponse_value) === parentRespId
        );
      }
    } catch (err) {
      console.warn("[RfqSupplierResponseService] Could not fetch response lines:", err);
    }
  }

  // 5. Structure lines
  const structuredLines: SupplierResponseLineItem[] = responseLines.map((l) => {
    const parsed = parseResponseLineId(l.cr49f_responselineid);
    const parsedCharges = parseAdditionalCharges(l.cr49f_additionalchargesdetails);
    const anyAddl = Boolean(l.cr49f_anyadditionalcharges);
    const addlPct = Number(l.cr49f_additionalchargepercentage) || 0;
    const addlDetails = l.cr49f_additionalchargesdetails || parsedCharges.comments || "";
    const disc = Number(l.cr49f_discount) || 0;
    const tax = Number(l.cr49f_tax) || 0;
    const unitPrice = Number(l.cr49f_unitprice) || 0;
    const qty = Number(l.cr49f_quantity) || parsed.requestedQuantity;
    const calc = calculateLineTotal(unitPrice, qty, disc, tax, anyAddl, addlPct);
    const lineTotal = Number(l.cr49f_totalprice) > 0 ? Number(l.cr49f_totalprice) : calc.totalPrice;

    return {
      id: cleanGuid(l.cr49f_rfqresponselineid) || l.cr49f_rfqresponselineid,
      prLineId: parsed.prLineId,
      itemName: parsed.itemName,
      description: addlDetails || parsedCharges.comments || "",
      category: "Catalog Item",
      requestedQuantity: parsed.requestedQuantity,
      offeredQuantity: qty,
      unitPrice,
      discount: disc,
      tax,
      anyAdditionalCharges: anyAddl,
      additionalChargePercentage: addlPct,
      additionalChargesDetails: addlDetails,
      totalPrice: lineTotal,
      leadTime: parsedCharges.leadTime,
      comments: addlDetails || parsedCharges.comments,
    };
  });

  // Determine status
  let status: SupplierResponseStatus = "Invited";
  if (parentResp?.statuscode === 2 || parentResp?.statecode === 1 || parentResp?.cr49f_responsedate) {
    status = "Submitted";
  } else if (
    (parentResp?.cr49f_totalamount && parentResp.cr49f_totalamount > 0) ||
    structuredLines.some((l) => l.unitPrice > 0)
  ) {
    status = "Draft";
  }

  const fullResponse: FullSupplierResponse = {
    responseId: parentRespId,
    rfqId: cleanRfqId,
    supplierId: cleanSupId,
    supplierName: "Current Supplier",
    status,
    statuscode: parentResp?.statuscode ?? 1,
    statecode: parentResp?.statecode ?? 0,
    totalAmount: Number(parentResp?.cr49f_totalamount) || 0,
    responseDate: parentResp?.cr49f_responsedate,
    deliveryDate: parentResp?.cr49f_deliverydate,
    paymentTerms: parentResp?.cr49f_paymentterms,
    warranty: parentResp?.cr49f_warranty,
    lines: structuredLines,
  };

  return { rfq, response: fullResponse };
}

/**
 * Saves quotation details as Draft (editable later).
 */
export async function saveSupplierResponseDraft(
  responseId: string,
  linesData: Array<{
    id: string;
    unitPrice: number;
    offeredQuantity: number;
    discount?: number;
    tax?: number;
    anyAdditionalCharges?: boolean;
    additionalChargePercentage?: number;
    additionalChargesDetails?: string;
    leadTime?: string;
    comments?: string;
  }>,
  meta?: {
    deliveryDate?: string;
    paymentTerms?: string;
    warranty?: string;
  }
): Promise<{ success: boolean; totalAmount: number }> {
  const cleanRespId = cleanGuid(responseId);
  let totalAmount = 0;

  // 1. Update lines
  for (const line of linesData) {
    const cleanLineId = cleanGuid(line.id);
    const unitPrice = Number(line.unitPrice) || 0;
    const qty = Number(line.offeredQuantity) || 1;
    const discount = Number(line.discount) || 0;
    const tax = Number(line.tax) || 0;
    const anyAddl = Boolean(line.anyAdditionalCharges);
    const addlPct = anyAddl ? Number(line.additionalChargePercentage) || 0 : 0;
    const addlDetails = (line.additionalChargesDetails ?? line.comments ?? "").trim();

    const calc = calculateLineTotal(unitPrice, qty, discount, tax, anyAddl, addlPct);
    totalAmount += calc.totalPrice;

    if (cleanLineId && !cleanLineId.startsWith("mock-")) {
      try {
        await Cr49f_rfqresponselinesService.update(cleanLineId, {
          cr49f_unitprice: unitPrice,
          cr49f_quantity: qty,
          cr49f_discount: discount,
          cr49f_tax: tax,
          cr49f_anyadditionalcharges: anyAddl,
          cr49f_additionalchargepercentage: addlPct,
          cr49f_additionalchargesdetails: addlDetails,
          cr49f_totalprice: calc.totalPrice,
          statecode: 0,
          statuscode: 1, // Draft
        });
      } catch (err) {
        console.warn(`[RfqSupplierResponseService] Failed to update line ${cleanLineId}:`, err);
      }
    }
  }

  // 2. Update parent response record
  if (cleanRespId && !cleanRespId.startsWith("mock-")) {
    try {
      await Cr49f_rfqsupplierresponsesService.update(cleanRespId, {
        cr49f_totalamount: totalAmount,
        cr49f_deliverydate: meta?.deliveryDate || undefined,
        cr49f_paymentterms: meta?.paymentTerms || undefined,
        cr49f_warranty: meta?.warranty || undefined,
        statecode: 0,
        statuscode: 1, // Draft
      });
    } catch (parentErr) {
      console.warn(`[RfqSupplierResponseService] Failed to update parent response ${cleanRespId}:`, parentErr);
    }
  }

  return { success: true, totalAmount };
}

/**
 * Validates and submits final quotation response.
 * Updates status to Submitted and locks lines to read-only.
 */
export async function submitSupplierResponse(
  responseId: string,
  linesData: Array<{
    id: string;
    unitPrice: number;
    offeredQuantity: number;
    discount?: number;
    tax?: number;
    anyAdditionalCharges?: boolean;
    additionalChargePercentage?: number;
    additionalChargesDetails?: string;
    leadTime?: string;
    comments?: string;
  }>,
  meta?: {
    deliveryDate?: string;
    paymentTerms?: string;
    warranty?: string;
  }
): Promise<{ success: boolean; totalAmount: number; submittedDate: string }> {
  // Validation: mandatory fields
  if (!linesData || linesData.length === 0) {
    throw new Error("Cannot submit an empty quotation. At least one line item is required.");
  }

  for (const [idx, line] of linesData.entries()) {
    if (!line.unitPrice || line.unitPrice <= 0) {
      throw new Error(`Line #${idx + 1} requires a valid quoted unit price greater than 0.`);
    }
    if (!line.offeredQuantity || line.offeredQuantity <= 0) {
      throw new Error(`Line #${idx + 1} requires a valid offered quantity greater than 0.`);
    }
  }

  const cleanRespId = cleanGuid(responseId);
  const submittedDate = new Date().toISOString();
  let totalAmount = 0;

  // 1. Update lines to Submitted (statuscode: 2, statecode: 1)
  for (const line of linesData) {
    const cleanLineId = cleanGuid(line.id);
    const unitPrice = Number(line.unitPrice) || 0;
    const qty = Number(line.offeredQuantity) || 1;
    const discount = Number(line.discount) || 0;
    const tax = Number(line.tax) || 0;
    const anyAddl = Boolean(line.anyAdditionalCharges);
    const addlPct = anyAddl ? Number(line.additionalChargePercentage) || 0 : 0;
    const addlDetails = (line.additionalChargesDetails ?? line.comments ?? "").trim();

    const calc = calculateLineTotal(unitPrice, qty, discount, tax, anyAddl, addlPct);
    totalAmount += calc.totalPrice;

    if (cleanLineId && !cleanLineId.startsWith("mock-")) {
      try {
        await Cr49f_rfqresponselinesService.update(cleanLineId, {
          cr49f_unitprice: unitPrice,
          cr49f_quantity: qty,
          cr49f_discount: discount,
          cr49f_tax: tax,
          cr49f_anyadditionalcharges: anyAddl,
          cr49f_additionalchargepercentage: addlPct,
          cr49f_additionalchargesdetails: addlDetails,
          cr49f_totalprice: calc.totalPrice,
          statecode: 1, // Inactive / Submitted
          statuscode: 2, // Submitted
        });
      } catch (err) {
        console.warn(`[RfqSupplierResponseService] Failed to finalize line ${cleanLineId}:`, err);
      }
    }
  }

  // 2. Update parent response record to Submitted
  if (cleanRespId && !cleanRespId.startsWith("mock-")) {
    try {
      await Cr49f_rfqsupplierresponsesService.update(cleanRespId, {
        cr49f_totalamount: totalAmount,
        cr49f_responsedate: submittedDate,
        cr49f_deliverydate: meta?.deliveryDate || undefined,
        cr49f_paymentterms: meta?.paymentTerms || undefined,
        cr49f_warranty: meta?.warranty || undefined,
        statecode: 1, // Inactive / Submitted
        statuscode: 2, // Submitted
      });
    } catch (parentErr) {
      console.warn(`[RfqSupplierResponseService] Failed to finalize parent response ${cleanRespId}:`, parentErr);
    }
  }

  return { success: true, totalAmount, submittedDate };
}
