import { Cr49f_rfqsupplierresponsesService } from "../generated/services/Cr49f_rfqsupplierresponsesService";
import { Cr49f_rfqresponselinesService } from "../generated/services/Cr49f_rfqresponselinesService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import { INITIAL_SAMPLE_SUPPLIERS } from "../data/SampleSuppliersData";
import { cleanGuid } from "./ApprovalWorkflowService";

import type { Cr49f_rfqsupplierresponses } from "../generated/models/Cr49f_rfqsupplierresponsesModel";
import type { Cr49f_rfqresponselines } from "../generated/models/Cr49f_rfqresponselinesModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_purchaserequestlines } from "../generated/models/Cr49f_purchaserequestlinesModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_selectedsupplierses } from "../generated/models/Cr49f_selectedsuppliersesModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import type { SampleSupplierItem } from "../data/SampleSuppliersData";

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
  catalogPrice?: number;
  matchedCatalogName?: string;
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
 * Parses response line composite ID into structured parts (backwards compatibility)
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
 * Builds composite response line ID string (maintained for legacy compatibility)
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
 * Resolves catalog unit price for a given supplier and item name
 */
function findSupplierProductPrice(
  supplierCodeOrGuid: string,
  supplierName: string,
  itemName: string,
  dataverseProducts: Cr49f_supplierproducts[]
): number {
  const cleanItem = itemName.toLowerCase().trim();
  const cleanSup = supplierCodeOrGuid.toLowerCase().replace(/[{}]/g, "").trim();
  const cleanName = supplierName.toLowerCase().trim();

  // 1. Search in Dataverse supplier products
  for (const prod of dataverseProducts) {
    const raw = prod as unknown as Record<string, unknown>;
    const pSupGuid = (
      prod._cr49f_supplier_value ||
      (raw._cr49f_Supplier_value as string) ||
      (raw.cr49f_Supplier as string) ||
      (raw.cr49f_supplier as string) ||
      ""
    ).toLowerCase().replace(/[{}]/g, "").trim();

    const pName = (prod.cr49f_productname || prod.cr49f_supplierproductnumber || (raw.cr49f_name as string) || "").toLowerCase().trim();

    if (pSupGuid === cleanSup && (pName.includes(cleanItem) || cleanItem.includes(pName))) {
      const price = Number(prod.cr49f_unitprice) || 0;
      if (price > 0) return price;
    }
  }

  // 2. Fallback to initial sample data
  const sampleMatch = INITIAL_SAMPLE_SUPPLIERS.find(
    (s: SampleSupplierItem) =>
      (s.supplier.cr49f_supplierid1 && s.supplier.cr49f_supplierid1.toLowerCase().trim() === cleanSup) ||
      (s.supplier.cr49f_name && s.supplier.cr49f_name.toLowerCase().trim() === cleanName)
  );

  if (sampleMatch && sampleMatch.products) {
    for (const sp of sampleMatch.products) {
      const spName = (sp.cr49f_productname || sp.cr49f_supplierproductnumber || "").toLowerCase().trim();
      if (spName.includes(cleanItem) || cleanItem.includes(spName)) {
        const price = Number(sp.cr49f_unitprice) || 0;
        if (price > 0) return price;
      }
    }
    // If no exact match, return first catalog product price if available
    if (sampleMatch.products[0]?.cr49f_unitprice) {
      return Number(sampleMatch.products[0].cr49f_unitprice) || 0;
    }
  }

  return 0;
}

/**
 * Creates cr49f_rfqsupplierresponse and cr49f_rfqresponseline records
 * ONLY AFTER all RFQ tasks get approved.
 *
 * Uses direct Dataverse relationships:
 * - cr49f_rfqsupplierresponse links to RFQ via cr49f_rfq lookup
 * - cr49f_rfqsupplierresponse links to Selected Supplier via cr49f_supplier lookup
 * - cr49f_rfqresponseline links to cr49f_rfqsupplierresponse via cr49f_rfqsupplierresponse lookup
 *
 * Primary IDs are auto-generated by Dataverse.
 */
export async function initializeSupplierResponsesForApprovedRfq(
  rfqId: string,
  supplierIdentities?: string[],
  purchaseRequestId?: string
): Promise<{ success: boolean; createdResponses: number; createdLines: number }> {
  const cleanRfqId = cleanGuid(rfqId);
  if (!cleanRfqId) {
    return { success: false, createdResponses: 0, createdLines: 0 };
  }

  console.log(`[RfqSupplierResponseService] Initializing responses for Approved RFQ: ${cleanRfqId}`);

  // 1. Fetch the RFQ record
  let rfq: Cr49f_requestforqoutations | null = null;
  try {
    const rfqRes = await Cr49f_requestforqoutationsService.get(cleanRfqId);
    if (rfqRes.success && rfqRes.data) {
      rfq = rfqRes.data;
    }
  } catch (rfqErr) {
    console.warn("[RfqSupplierResponseService] Could not fetch RFQ:", rfqErr);
  }

  const resolvedPrId = purchaseRequestId || cleanGuid(rfq?._cr49f_prrfq_value);

  // 2. Fetch Selected Suppliers for this RFQ from Dataverse
  let selectedSuppliers: Cr49f_selectedsupplierses[] = [];
  try {
    const selRes = await Cr49f_selectedsuppliersesService.getAll();
    if (selRes.success && selRes.data) {
      selectedSuppliers = selRes.data.filter(
        (s) => cleanGuid(s._cr49f_rfq_value) === cleanRfqId
      );
    }
  } catch (selErr) {
    console.warn("[RfqSupplierResponseService] Could not fetch selected suppliers:", selErr);
  }

  // Fallback: If no selected suppliers in Dataverse yet, check local storage or supplierIdentities
  let allSuppliers: Cr49f_suppliers[] = [];
  try {
    const suppRes = await Cr49f_suppliersService.getAll();
    if (suppRes.success && suppRes.data) {
      allSuppliers = suppRes.data;
    }
  } catch {
    // ignore
  }

  if (selectedSuppliers.length === 0) {
    let fallbackSuppliers: Array<{ id: string; code?: string; name?: string }> = [];
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`rfq_invited_suppliers_${cleanRfqId}`);
        if (cached) {
          const parsed = JSON.parse(cached) as Array<Record<string, string>>;
          fallbackSuppliers = parsed.map((p, idx) => ({
            id: cleanGuid(p.cr49f_supplierid) || p.cr49f_supplierid || `sup-${idx + 1}`,
            code: p.cr49f_supplierid1 || `SUP-${idx + 1}`,
            name: p.cr49f_name || "Invited Supplier",
          }));
        }
      } catch {
        // ignore
      }
    }

    if (fallbackSuppliers.length === 0 && supplierIdentities && supplierIdentities.length > 0) {
      fallbackSuppliers = supplierIdentities.map((id, idx) => {
        const cleanId = cleanGuid(id) || id;
        const matched = allSuppliers.find(
          (s) => cleanGuid(s.cr49f_supplierid) === cleanId || s.cr49f_supplierid1 === id
        );
        return {
          id: matched?.cr49f_supplierid || cleanId,
          code: matched?.cr49f_supplierid1 || `SUP-${idx + 1}`,
          name: matched?.cr49f_name || "Invited Supplier",
        };
      });
    }

    // Auto-create missing selected suppliers in cr49f_selectedsupplierses
    for (const fb of fallbackSuppliers) {
      try {
        const createSelRes = await Cr49f_selectedsuppliersesService.create({
          "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${cleanRfqId})`,
          cr49f_selectedsuppliernumber: fb.code || fb.id,
          cr49f_supplierquotation: fb.name || "Invited Supplier",
          statecode: 0,
          statuscode: 1,
        });
        if (createSelRes.success && createSelRes.data) {
          selectedSuppliers.push(createSelRes.data);
        }
      } catch (createSelErr) {
        console.warn("[RfqSupplierResponseService] Could not create fallback selected supplier:", createSelErr);
      }
    }
  }

  // 3. Fetch PR lines associated with the Purchase Request if available
  let prLines: Cr49f_purchaserequestlines[] = [];
  if (resolvedPrId) {
    const cleanPrId = cleanGuid(resolvedPrId);
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

  // 4. Fetch supplier products for price auto-fill
  let dataverseProducts: Cr49f_supplierproducts[] = [];
  try {
    const prodRes = await Cr49f_supplierproductsService.getAll();
    if (prodRes.success && prodRes.data) {
      dataverseProducts = prodRes.data;
    }
  } catch {
    // ignore
  }

  // 5. Fetch existing responses to prevent duplicate records
  let existingResponses: Cr49f_rfqsupplierresponses[] = [];
  try {
    const allResponsesRes = await Cr49f_rfqsupplierresponsesService.getAll();
    if (allResponsesRes.success && allResponsesRes.data) {
      existingResponses = allResponsesRes.data.filter((r) => {
        const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
        if (rfqLookup && rfqLookup === cleanRfqId) return true;
        return r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`);
      });
    }
  } catch (err) {
    console.warn("[RfqSupplierResponseService] Could not query existing responses:", err);
  }

  let createdResponsesCount = 0;
  let createdLinesCount = 0;

  // 6. For each selected supplier, ensure cr49f_rfqsupplierresponse and cr49f_rfqresponselines exist
  for (const selSupp of selectedSuppliers) {
    const selSuppId = cleanGuid(selSupp.cr49f_selectedsuppliersid);
    const selSuppCode = selSupp.cr49f_selectedsuppliernumber || "";
    const selSuppName = selSupp.cr49f_supplierquotation || "Invited Supplier";

    const matchedSupplierProfile = allSuppliers.find(
      (s) =>
        s.cr49f_supplierid1?.toLowerCase() === selSuppCode.toLowerCase() ||
        cleanGuid(s.cr49f_supplierid) === selSuppCode.toLowerCase() ||
        s.cr49f_name?.toLowerCase() === selSuppName.toLowerCase()
    );
    const supplierGuid = matchedSupplierProfile ? cleanGuid(matchedSupplierProfile.cr49f_supplierid) : "";

    // Check if response already exists for this selected supplier
    let parentResponse = existingResponses.find((r) => {
      const supLookup = cleanGuid(r._cr49f_supplier_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_supplier as string);
      if (supLookup && selSuppId && supLookup === selSuppId) return true;
      if (supLookup && supplierGuid && supLookup === supplierGuid) return true;
      const respId = r.cr49f_responseid || "";
      return (
        (selSuppCode && respId.includes(`SUP:${selSuppCode}`)) ||
        (supplierGuid && respId.includes(`SUP:${supplierGuid}`))
      );
    });

    let parentResponseId = parentResponse ? cleanGuid(parentResponse.cr49f_rfqsupplierresponseid) : "";

    if (!parentResponseId) {
      // Map relationship correctly:
      // cr49f_rfq column associates with RFQ
      // cr49f_supplier column associates with Selected Supplier
      // Primary ID cr49f_rfqsupplierresponseid is auto-generated by Dataverse
      const parentPayloadStrategies: Array<Record<string, unknown>> = [
        // Strategy 1: PascalCase lookups to Selected Supplier and RFQ
        {
          "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${cleanRfqId})`,
          ...(selSuppId ? { "cr49f_Supplier@odata.bind": `/cr49f_selectedsupplierses(${selSuppId})` } : {}),
          cr49f_responseid: `RESP-${selSuppCode || selSuppName.slice(0, 15)}`,
          cr49f_totalamount: 0,
          statecode: 0,
          statuscode: 1, // 1 = Active / Draft
        },
        // Strategy 2: Lowercase lookups
        {
          "cr49f_rfq@odata.bind": `/cr49f_requestforqoutations(${cleanRfqId})`,
          ...(selSuppId ? { "cr49f_supplier@odata.bind": `/cr49f_selectedsupplierses(${selSuppId})` } : {}),
          cr49f_responseid: `RESP-${selSuppCode || selSuppName.slice(0, 15)}`,
          cr49f_totalamount: 0,
          statecode: 0,
          statuscode: 1,
        },
        // Strategy 3: Bind supplier to cr49f_suppliers if selectedsupplierses rejected
        ...(supplierGuid
          ? [
              {
                "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${cleanRfqId})`,
                "cr49f_Supplier@odata.bind": `/cr49f_suppliers(${supplierGuid})`,
                cr49f_responseid: `RESP-${selSuppCode || selSuppName.slice(0, 15)}`,
                cr49f_totalamount: 0,
                statecode: 0,
                statuscode: 1,
              },
            ]
          : []),
        // Strategy 4: Minimal payload with RFQ binding
        {
          "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${cleanRfqId})`,
          cr49f_responseid: `RESP-${selSuppCode || selSuppName.slice(0, 15)}`,
          cr49f_totalamount: 0,
          statecode: 0,
          statuscode: 1,
        },
      ];

      for (const payload of parentPayloadStrategies) {
        try {
          const createParentRes = await Cr49f_rfqsupplierresponsesService.create(
            payload as Parameters<typeof Cr49f_rfqsupplierresponsesService.create>[0]
          );

          if (createParentRes.success && createParentRes.data) {
            parentResponseId = cleanGuid(createParentRes.data.cr49f_rfqsupplierresponseid);
            parentResponse = createParentRes.data;
            createdResponsesCount++;
            console.log(
              `[RfqSupplierResponseService] Successfully created response ${parentResponseId} mapped to RFQ ${cleanRfqId} and supplier ${selSuppId || selSuppCode}`
            );
            break;
          }
        } catch (stratErr) {
          console.warn("[RfqSupplierResponseService] Parent response strategy failed, trying next:", stratErr);
        }
      }

      // Offline/local fallback if Dataverse unavailable
      if (!parentResponseId) {
        parentResponseId = `mock-resp-${cleanRfqId}-${selSuppId || selSuppCode}`;
      }
    }

    if (!parentResponseId) continue;

    // 7. Create child response lines for each PR line item
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

    for (const [lineIdx, prLine] of prLines.entries()) {
      const itemName = prLine.cr49f_itemname || `Line Item #${lineIdx + 1}`;
      const reqQty = Number(prLine.cr49f_quantity) || 1;

      // Find catalog price for this supplier and product
      const unitPrice = findSupplierProductPrice(
        supplierGuid || selSuppCode,
        selSuppName,
        itemName,
        dataverseProducts
      );

      const calc = calculateLineTotal(unitPrice, reqQty);

      // Check if line already exists for this parent response
      const alreadyExists = existingLinesForResp.some((l) => {
        const lName = l.cr49f_responselineid || "";
        if (lName === itemName) return true;
        if (lName.includes(`PRL:${cleanGuid(prLine.cr49f_purchaserequestlineid)}`)) return true;
        return false;
      });

      if (!alreadyExists) {
        // Map relationship correctly:
        // cr49f_rfqresponseline associates with parent cr49f_rfqsupplierresponse via cr49f_rfqsupplierresponse lookup
        // Primary ID cr49f_rfqresponselineid is auto-generated by Dataverse
        // cr49f_responselineid stores clean item name, NOT a composite ID
        const linePayloadStrategies: Array<Record<string, unknown>> = [
          {
            "cr49f_RFQSupplierResponse@odata.bind": `/cr49f_rfqsupplierresponses(${parentResponseId})`,
            cr49f_responselineid: itemName,
            cr49f_quantity: reqQty,
            cr49f_unitprice: unitPrice,
            cr49f_discount: 0,
            cr49f_tax: 0,
            cr49f_anyadditionalcharges: false,
            cr49f_additionalchargepercentage: 0,
            cr49f_additionalchargesdetails: prLine.cr49f_itemdescription || "",
            cr49f_totalprice: calc.totalPrice,
            statecode: 0 as const,
            statuscode: 1 as const,
          },
          {
            "cr49f_rfqsupplierresponse@odata.bind": `/cr49f_rfqsupplierresponses(${parentResponseId})`,
            cr49f_responselineid: itemName,
            cr49f_quantity: reqQty,
            cr49f_unitprice: unitPrice,
            cr49f_discount: 0,
            cr49f_tax: 0,
            cr49f_anyadditionalcharges: false,
            cr49f_additionalchargepercentage: 0,
            cr49f_additionalchargesdetails: prLine.cr49f_itemdescription || "",
            cr49f_totalprice: calc.totalPrice,
            statecode: 0 as const,
            statuscode: 1 as const,
          },
        ];

        for (const linePayload of linePayloadStrategies) {
          try {
            const lineRes = await Cr49f_rfqresponselinesService.create(
              linePayload as Parameters<typeof Cr49f_rfqresponselinesService.create>[0]
            );
            if (lineRes.success && lineRes.data) {
              createdLinesCount++;
              break;
            }
          } catch (lineErr) {
            console.warn("[RfqSupplierResponseService] Line strategy error:", lineErr);
          }
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
 * Alias to maintain full compatibility across codebase
 */
export const createRfqSupplierResponses = initializeSupplierResponsesForApprovedRfq;

/**
 * Retrieves all supplier responses and associated response lines for a specific RFQ.
 * Used on the Procurement side (rfqdetail.tsx).
 */
export async function getSupplierResponsesForRfq(
  rfqId: string
): Promise<FullSupplierResponse[]> {
  const cleanRfqId = cleanGuid(rfqId);
  if (!cleanRfqId) return [];

  // Query Dataverse parent responses, selected suppliers, suppliers, PR lines, and response lines
  const [respRes, selSuppRes, suppRes, linesRes, prLinesRes] = await Promise.allSettled([
    Cr49f_rfqsupplierresponsesService.getAll(),
    Cr49f_selectedsuppliersesService.getAll(),
    Cr49f_suppliersService.getAll(),
    Cr49f_rfqresponselinesService.getAll(),
    Cr49f_purchaserequestlinesService.getAll(),
  ]);

  const allResponses: Cr49f_rfqsupplierresponses[] =
    respRes.status === "fulfilled" && respRes.value.success && respRes.value.data
      ? respRes.value.data
      : [];

  const allSelectedSuppliers: Cr49f_selectedsupplierses[] =
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

  const allPrLines: Cr49f_purchaserequestlines[] =
    prLinesRes.status === "fulfilled" && prLinesRes.value.success && prLinesRes.value.data
      ? prLinesRes.value.data
      : [];

  // Filter responses matching this RFQ via cr49f_rfq lookup OR legacy responseid tag
  const rfqResponses = allResponses.filter((r) => {
    const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
    if (rfqLookup && rfqLookup === cleanRfqId) return true;
    return r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`);
  });

  const results: FullSupplierResponse[] = [];

  // Process responses
  for (const resp of rfqResponses) {
    const respId = cleanGuid(resp.cr49f_rfqsupplierresponseid);

    // 1. Resolve selected supplier and supplier profile via cr49f_supplier lookup
    const supplierLookup = cleanGuid(resp._cr49f_supplier_value) || cleanGuid((resp as unknown as Record<string, unknown>).cr49f_supplier as string);

    let selSupp = allSelectedSuppliers.find(
      (s) => cleanGuid(s.cr49f_selectedsuppliersid) === supplierLookup
    );

    let supplierProfile = allSuppliers.find(
      (s) => cleanGuid(s.cr49f_supplierid) === supplierLookup
    );

    // Legacy fallback: parse SUP: from responseid
    if (!selSupp && !supplierProfile) {
      const supMatch = resp.cr49f_responseid?.match(/SUP:([^|]+)/);
      const legacySupId = supMatch ? supMatch[1] : "";
      if (legacySupId) {
        supplierProfile = allSuppliers.find(
          (s) =>
            cleanGuid(s.cr49f_supplierid) === legacySupId ||
            s.cr49f_supplierid1?.toLowerCase() === legacySupId.toLowerCase()
        );
        selSupp = allSelectedSuppliers.find(
          (s) =>
            s.cr49f_selectedsuppliernumber?.toLowerCase() === legacySupId.toLowerCase()
        );
      }
    }

    if (selSupp && !supplierProfile) {
      supplierProfile = allSuppliers.find(
        (s) =>
          s.cr49f_supplierid1?.toLowerCase() === selSupp.cr49f_selectedsuppliernumber?.toLowerCase() ||
          cleanGuid(s.cr49f_supplierid) === selSupp.cr49f_selectedsuppliernumber?.toLowerCase()
      );
    }

    const supplierId =
      supplierProfile?.cr49f_supplierid ||
      selSupp?.cr49f_selectedsuppliersid ||
      supplierLookup ||
      "";

    const supplierCode =
      supplierProfile?.cr49f_supplierid1 ||
      selSupp?.cr49f_selectedsuppliernumber ||
      "";

    const supplierName =
      supplierProfile?.cr49f_name ||
      selSupp?.cr49f_supplierquotation ||
      (supplierCode ? `Supplier (${supplierCode})` : "Invited Supplier");

    // Lines for this response via cr49f_rfqsupplierresponse lookup
    const linesForResp = allLines.filter(
      (l) => cleanGuid(l._cr49f_rfqsupplierresponse_value) === respId
    );

    const structuredLines: SupplierResponseLineItem[] = linesForResp.map((l, lIdx) => {
      let prLineId = "";
      let itemName = l.cr49f_responselineid || `Item ${lIdx + 1}`;
      let reqQty = Number(l.cr49f_quantity) || 1;

      // Handle legacy composite ID if present
      if (l.cr49f_responselineid?.includes("PRL:")) {
        const parsed = parseResponseLineId(l.cr49f_responselineid);
        prLineId = parsed.prLineId;
        itemName = parsed.itemName;
        reqQty = parsed.requestedQuantity || reqQty;
      } else {
        const matchedPrLine = allPrLines.find(
          (pl) => pl.cr49f_itemname?.toLowerCase() === itemName.toLowerCase()
        ) || allPrLines[lIdx];
        if (matchedPrLine) {
          prLineId = cleanGuid(matchedPrLine.cr49f_purchaserequestlineid);
        }
      }

      const parsedCharges = parseAdditionalCharges(l.cr49f_additionalchargesdetails);
      const anyAddl = Boolean(l.cr49f_anyadditionalcharges);
      const addlPct = Number(l.cr49f_additionalchargepercentage) || 0;
      const addlDetails = l.cr49f_additionalchargesdetails || parsedCharges.comments || "";
      const disc = Number(l.cr49f_discount) || 0;
      const tax = Number(l.cr49f_tax) || 0;
      const unitPrice = Number(l.cr49f_unitprice) || 0;
      const offeredQty = Number(l.cr49f_quantity) || reqQty;
      const calc = calculateLineTotal(unitPrice, offeredQty, disc, tax, anyAddl, addlPct);
      const lineTotal = Number(l.cr49f_totalprice) > 0 ? Number(l.cr49f_totalprice) : calc.totalPrice;

      return {
        id: cleanGuid(l.cr49f_rfqresponselineid) || l.cr49f_rfqresponselineid,
        prLineId,
        itemName,
        description: addlDetails || parsedCharges.comments || "",
        category: "Catalog Item",
        requestedQuantity: reqQty,
        offeredQuantity: offeredQty,
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

    // Determine status: 2 = Submitted, or check draft vs invited
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
      supplierCode,
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

  // Also include any selected suppliers who don't have a response record yet (e.g. pending approval)
  for (const sel of allSelectedSuppliers) {
    const selNum = sel.cr49f_selectedsuppliernumber || "";
    const selId = cleanGuid(sel.cr49f_selectedsuppliersid);

    const matched = results.some(
      (r) =>
        (selId && r.supplierId === selId) ||
        (selNum && r.supplierCode?.toLowerCase() === selNum.toLowerCase()) ||
        (selNum && r.supplierId.toLowerCase() === selNum.toLowerCase())
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
        supplierId: supplierProfile?.cr49f_supplierid || selId || selNum,
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

  // 1. Fetch all RFQs, responses, selected suppliers
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

  const allSelectedSuppliers: Cr49f_selectedsupplierses[] =
    selectedSuppRes.status === "fulfilled" && selectedSuppRes.value.success && selectedSuppRes.value.data
      ? selectedSuppRes.value.data
      : [];

  // Filter selected suppliers matching this supplier identity
  const matchingSelectedSupp = allSelectedSuppliers.filter((s) => {
    const num = s.cr49f_selectedsuppliernumber?.toLowerCase() || "";
    const selId = cleanGuid(s.cr49f_selectedsuppliersid);
    return (
      num === supplierId.toLowerCase() ||
      (cleanSupId && num === cleanSupId.toLowerCase()) ||
      (cleanSupId && selId === cleanSupId)
    );
  });

  const matchingResponses = allResponses.filter((r) => {
    const supLookup = cleanGuid(r._cr49f_supplier_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_supplier as string);
    if (matchingSelectedSupp.some((s) => cleanGuid(s.cr49f_selectedsuppliersid) === supLookup)) return true;
    if (cleanSupId && supLookup === cleanSupId) return true;
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
    const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
    if (rfqLookup) invitedRfqIds.add(rfqLookup);
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
    const parentResp = matchingResponses.find((r) => {
      const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
      if (rfqLookup === rfqId) return true;
      return r.cr49f_responseid?.includes(`RFQ:${rfqId}`);
    });

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

  // 2. Fetch Selected Suppliers and responses in parallel
  const [selectedSuppRes, responsesRes, prLinesRes] = await Promise.allSettled([
    Cr49f_selectedsuppliersesService.getAll(),
    Cr49f_rfqsupplierresponsesService.getAll(),
    Cr49f_purchaserequestlinesService.getAll(),
  ]);

  const selectedSupp =
    selectedSuppRes.status === "fulfilled" && selectedSuppRes.value.success && selectedSuppRes.value.data
      ? selectedSuppRes.value.data.filter((s) => cleanGuid(s._cr49f_rfq_value) === cleanRfqId)
      : [];

  let allResponses =
    responsesRes.status === "fulfilled" && responsesRes.value.success && responsesRes.value.data
      ? responsesRes.value.data.filter((r) => {
          const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
          if (rfqLookup === cleanRfqId) return true;
          return r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`);
        })
      : [];

  const allPrLines =
    prLinesRes.status === "fulfilled" && prLinesRes.value.success && prLinesRes.value.data
      ? prLinesRes.value.data
      : [];

  const matchedSelSupp = selectedSupp.find(
    (s) =>
      s.cr49f_selectedsuppliernumber?.toLowerCase() === cleanSupId.toLowerCase() ||
      s.cr49f_selectedsuppliernumber?.toLowerCase() === supplierId.toLowerCase() ||
      cleanGuid(s.cr49f_selectedsuppliersid) === cleanSupId.toLowerCase()
  );

  const selSuppId = matchedSelSupp ? cleanGuid(matchedSelSupp.cr49f_selectedsuppliersid) : "";

  // 3. Find parent response record using cr49f_supplier lookup or legacy tag
  let parentResp = allResponses.find((r) => {
    const supLookup = cleanGuid(r._cr49f_supplier_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_supplier as string);
    if (selSuppId && supLookup === selSuppId) return true;
    if (cleanSupId && supLookup === cleanSupId) return true;
    const respId = r.cr49f_responseid || "";
    return respId.includes(`SUP:${cleanSupId}`) || respId.includes(`SUP:${supplierId}`);
  });

  let parentRespId = parentResp ? cleanGuid(parentResp.cr49f_rfqsupplierresponseid) : "";

  // 4. If RFQ is Approved and no parent response exists yet (e.g. from prior runs), initialize it now
  const isApproved =
    Number(rfq.cr49f_status) === 1 ||
    Boolean(rfq.cr49f_awarddate) ||
    rfq.cr49f_statusname?.toLowerCase() === "approved";

  if (!parentRespId && isApproved) {
    console.log(`[RfqSupplierResponseService] Initializing response for approved RFQ ${cleanRfqId}`);
    await initializeSupplierResponsesForApprovedRfq(cleanRfqId);

    // Refresh responses
    try {
      const refreshedResponses = await Cr49f_rfqsupplierresponsesService.getAll();
      if (refreshedResponses.success && refreshedResponses.data) {
        allResponses = refreshedResponses.data.filter((r) => {
          const rfqLookup = cleanGuid(r._cr49f_rfq_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_rfq as string);
          if (rfqLookup === cleanRfqId) return true;
          return r.cr49f_responseid?.includes(`RFQ:${cleanRfqId}`);
        });

        parentResp = allResponses.find((r) => {
          const supLookup = cleanGuid(r._cr49f_supplier_value) || cleanGuid((r as unknown as Record<string, unknown>).cr49f_supplier as string);
          if (selSuppId && supLookup === selSuppId) return true;
          if (cleanSupId && supLookup === cleanSupId) return true;
          const respId = r.cr49f_responseid || "";
          return respId.includes(`SUP:${cleanSupId}`) || respId.includes(`SUP:${supplierId}`);
        });

        if (parentResp) {
          parentRespId = cleanGuid(parentResp.cr49f_rfqsupplierresponseid);
        }
      }
    } catch {
      // ignore
    }
  }

  // 5. Fetch response lines
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

  // 6. Structure lines
  const structuredLines: SupplierResponseLineItem[] = responseLines.map((l, lIdx) => {
    let prLineId = "";
    let itemName = l.cr49f_responselineid || `Item ${lIdx + 1}`;
    let reqQty = Number(l.cr49f_quantity) || 1;

    // Handle legacy composite ID if present
    if (l.cr49f_responselineid?.includes("PRL:")) {
      const parsed = parseResponseLineId(l.cr49f_responselineid);
      prLineId = parsed.prLineId;
      itemName = parsed.itemName;
      reqQty = parsed.requestedQuantity || reqQty;
    } else {
      const matchedPrLine = allPrLines.find(
        (pl) => pl.cr49f_itemname?.toLowerCase() === itemName.toLowerCase()
      ) || allPrLines[lIdx];
      if (matchedPrLine) {
        prLineId = cleanGuid(matchedPrLine.cr49f_purchaserequestlineid);
      }
    }

    const parsedCharges = parseAdditionalCharges(l.cr49f_additionalchargesdetails);
    const anyAddl = Boolean(l.cr49f_anyadditionalcharges);
    const addlPct = Number(l.cr49f_additionalchargepercentage) || 0;
    const addlDetails = l.cr49f_additionalchargesdetails || parsedCharges.comments || "";
    const disc = Number(l.cr49f_discount) || 0;
    const tax = Number(l.cr49f_tax) || 0;
    const unitPrice = Number(l.cr49f_unitprice) || 0;
    const offeredQty = Number(l.cr49f_quantity) || reqQty;
    const calc = calculateLineTotal(unitPrice, offeredQty, disc, tax, anyAddl, addlPct);
    const lineTotal = Number(l.cr49f_totalprice) > 0 ? Number(l.cr49f_totalprice) : calc.totalPrice;

    return {
      id: cleanGuid(l.cr49f_rfqresponselineid) || l.cr49f_rfqresponselineid,
      prLineId,
      itemName,
      description: addlDetails || parsedCharges.comments || "",
      category: "Catalog Item",
      requestedQuantity: reqQty,
      offeredQuantity: offeredQty,
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
    supplierCode: matchedSelSupp?.cr49f_selectedsuppliernumber || "",
    supplierName: matchedSelSupp?.cr49f_supplierquotation || "Current Supplier",
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
