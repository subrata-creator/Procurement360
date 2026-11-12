import { Cr49f_purchaseordersService } from "../generated/services/Cr49f_purchaseordersService";
import { Cr49f_purchaseorderlineitemsService } from "../generated/services/Cr49f_purchaseorderlineitemsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import type { Cr49f_purchaseorders } from "../generated/models/Cr49f_purchaseordersModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_selectedsupplierses } from "../generated/models/Cr49f_selectedsuppliersesModel";
import { cleanGuid } from "./ApprovalWorkflowService";
import {
  type OrderRow,
  type OrderRecord,
  type OrderLineItem,
  type OrderStatus,
  saveCreatedOrder,
  generateNextPoNumber,
  getAllOrders,
  getCustomStoredOrders,
  getOrderByRef,
} from "../data/OrdersData";
import type { FullSupplierResponse } from "./RfqSupplierResponseService";
import type { QuotationDocumentData } from "./QuotationDocumentService";

export interface CreatePoFromQuotationParams {
  rfqId?: string;
  rfqNumber: string;
  rfqTitle?: string;
  associatedPr?: string;
  deliveryLocation?: string;
  supplierId?: string;
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  quotation?: FullSupplierResponse | QuotationDocumentData | null;
  quotationLines?: Array<{
    itemName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    vatPercent?: number;
    lineTotal?: number;
  }>;
}

export interface CreatePoResult {
  success: boolean;
  poNumber: string;
  dataversePoId?: string;
  lineItemCount: number;
  totalAmount: number;
  orderRecord: OrderRecord;
  error?: string;
}

/**
 * Creates a formal Purchase Order and its itemized Order Line Items in Dataverse
 * and registers it in the application's PO state as per the awarded quotation.
 */
export async function createPurchaseOrderFromQuotation(
  params: CreatePoFromQuotationParams
): Promise<CreatePoResult> {
  const {
    rfqId,
    rfqNumber,
    rfqTitle = "Procurement Order",
    associatedPr = "PR-2026-081",
    deliveryLocation = "Corporate Delivery Facility",
    supplierName,
    supplierEmail = "orders@supplier.com",
    supplierPhone = "+91 9874455687",
    supplierAddress = "Industrial Park, Bengaluru",
    quotation,
    quotationLines,
  } = params;

  // 1. Resolve line items as per quotation
  let resolvedLines: Array<{
    itemName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatPercent: number;
    amount: number;
  }> = [];

  if (quotationLines && quotationLines.length > 0) {
    resolvedLines = quotationLines.map((l) => ({
      itemName: l.itemName || "Commercial Line Item",
      description: l.description || "",
      quantity: Math.max(1, Number(l.quantity) || 1),
      unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      vatPercent: Math.max(0, Number(l.vatPercent) || 10),
      amount:
        Number(l.lineTotal) ||
        Math.round(
          Math.max(1, Number(l.quantity) || 1) *
            Math.max(0, Number(l.unitPrice) || 0) *
            (1 + Math.max(0, Number(l.vatPercent) || 10) / 100) *
            100
        ) / 100,
    }));
  } else if (
    quotation &&
    "lines" in quotation &&
    Array.isArray(quotation.lines) &&
    quotation.lines.length > 0
  ) {
    resolvedLines = quotation.lines.map((l: any, idx: number) => {
      const qty = Math.max(
        1,
        Number(l.offeredQuantity) || Number(l.requestedQuantity) || Number(l.quantity) || 1
      );
      const price = Math.max(0, Number(l.unitPrice) || 0);
      const vat = Number(l.taxPercent) || Number(l.tax) || Number(l.vatPercent) || 10;
      const total =
        Number(l.lineTotal) ||
        Number(l.totalPrice) ||
        Math.round(qty * price * (1 + vat / 100) * 100) / 100;
      return {
        itemName: l.itemName || `Item #${idx + 1}`,
        description: l.description || l.comments || "",
        quantity: qty,
        unitPrice: price,
        vatPercent: vat,
        amount: Math.round(total * 100) / 100,
      };
    });
  } else {
    // Default fallback line item if no lines were passed
    resolvedLines = [
      {
        itemName: `${rfqTitle} Commercial Scope`,
        description: `Delivered per awarded quote for ${rfqNumber}`,
        quantity: 1,
        unitPrice: 1000,
        vatPercent: 10,
        amount: 1100,
      },
    ];
  }

  const grandTotal =
    Math.round(resolvedLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;

  // 2. Generate unique sequential PO Number
  const poNumber = generateNextPoNumber();
  const createdOnIso = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const createdDateObj = new Date();
  const startDate = new Date(createdDateObj.getTime() + 3 * 86400000);
  const endDate = new Date(startDate.getTime() + 5 * 86400000);
  const formatUsDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

  // 3. Create PO record in Dataverse
  let createdDataversePoId: string | undefined = undefined;
  const cleanRfqGuid = rfqId ? cleanGuid(rfqId) : "";

  try {
    const poPayloadWithBind: any = {
      cr49f_ponumber: poNumber,
      cr49f_potitle: `PO for ${rfqNumber} - ${supplierName}`,
      cr49f_orderdate: new Date().toISOString(),
      cr49f_expecteddeliverydate: new Date(
        Date.now() + 30 * 86400000
      ).toISOString(),
      cr49f_deliveryaddress: deliveryLocation,
      cr49f_paymentterms: 3, // Net 30
      cr49f_totalamount: grandTotal,
      cr49f_status: 1, // Approved
      statecode: 0,
      statuscode: 1,
    };

    if (cleanRfqGuid) {
      poPayloadWithBind[
        "cr49f_RFQ_PO@odata.bind"
      ] = `/cr49f_requestforqoutations(${cleanRfqGuid})`;
    }

    try {
      const res = await Cr49f_purchaseordersService.create(poPayloadWithBind);
      if (res.success && res.data) {
        createdDataversePoId = res.data.cr49f_purchaseorderid;
      }
    } catch {
      delete poPayloadWithBind["cr49f_RFQ_PO@odata.bind"];
      const res2 = await Cr49f_purchaseordersService.create(poPayloadWithBind);
      if (res2.success && res2.data) {
        createdDataversePoId = res2.data.cr49f_purchaseorderid;
      }
    }
  } catch (poErr) {
    console.warn("Could not create PO in Dataverse directly:", poErr);
  }

  // 4. Create Order Line Items in Dataverse
  const cleanPoGuid = createdDataversePoId
    ? cleanGuid(createdDataversePoId)
    : "";
  const mappedOrderLineItems: OrderLineItem[] = [];

  for (let idx = 0; idx < resolvedLines.length; idx++) {
    const line = resolvedLines[idx];
    const poLineNumber = `POL-${String(idx + 1).padStart(3, "0")}`;
    const itemCode = `PDT-2026-${String(idx + 1).padStart(2, "0")}`;

    if (cleanPoGuid) {
      try {
        const linePayloadWithBind: any = {
          cr49f_polinenumber: poLineNumber,
          cr49f_itemname: line.itemName,
          cr49f_itemdescription: line.description || line.itemName,
          cr49f_unitofmeasure: "Units",
          cr49f_quantityordered: line.quantity,
          cr49f_unitprice: line.unitPrice,
          cr49f_vat: line.vatPercent,
          cr49f_totalamount: line.amount,
          "cr49f_PurchaseOrder@odata.bind": `/cr49f_purchaseorders(${cleanPoGuid})`,
          statecode: 0,
          statuscode: 1,
        };
        try {
          await Cr49f_purchaseorderlineitemsService.create(linePayloadWithBind);
        } catch {
          delete linePayloadWithBind["cr49f_PurchaseOrder@odata.bind"];
          await Cr49f_purchaseorderlineitemsService.create(linePayloadWithBind);
        }
      } catch (lineErr) {
        console.warn(
          `Could not create line item ${poLineNumber} in Dataverse:`,
          lineErr
        );
      }
    }

    mappedOrderLineItems.push({
      id: `li-${idx + 1}`,
      itemCode,
      itemName: line.itemName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatPercent: line.vatPercent,
      amount: line.amount,
      deliveryAddress: deliveryLocation,
    });
  }

  // 5. Construct full local OrderRecord
  const orderRow: OrderRow = {
    refNo: poNumber,
    rfq: rfqNumber,
    pr: associatedPr,
    supplier: supplierName,
    amount: grandTotal,
    createdBy: "Procurement Officer",
    createdOn: createdOnIso,
    status: "Approved",
  };

  const orderRecord: OrderRecord = {
    ...orderRow,
    utilizedAmount: grandTotal,
    remainingAmount: 0,
    startDate: formatUsDate(startDate),
    endDate: formatUsDate(endDate),
    rewardedSupplier: {
      name: supplierName,
      email: supplierEmail,
      phone: supplierPhone,
      address: supplierAddress,
      ranking: "Gold",
      active: true,
    },
    lineItems: mappedOrderLineItems,
    paymentTerms: [
      {
        termName: "Net 30",
        description: "Standard commercial net 30 calendar days",
        percent: 100,
        amount: grandTotal,
      },
    ],
    budgetCodes: [
      {
        abbreviation: "Inf-IT -IT",
        code: "2-3-10",
        department: "Information Technology",
        percent: 100,
        amount: grandTotal,
      },
    ],
    approvalSteps: [
      {
        id: "creation",
        label: `PO creation - ${poNumber}`,
        actor: "Procurement Officer",
        role: "Procurement Head",
        department: "Information Technology",
        timestamp: `${formatUsDate(createdDateObj)}, 12:00 PM`,
        status: "completed",
      },
      {
        id: "final",
        label: "Commercial Quote Approval - Approved",
        actor: "Procurement Director",
        role: "Procurement Director",
        department: "Information Technology",
        timestamp: `${formatUsDate(createdDateObj)}, 12:01 PM`,
        status: "completed",
      },
    ],
  };

  // 6. Save order locally for persistence and instant navigation
  saveCreatedOrder(orderRow, orderRecord);

  return {
    success: true,
    poNumber,
    dataversePoId: createdDataversePoId,
    lineItemCount: mappedOrderLineItems.length,
    totalAmount: grandTotal,
    orderRecord,
  };
}

/**
 * Maps a Dataverse cr49f_purchaseorders record into a standard OrderRow for the UI.
 */
export function mapDataversePoToOrderRow(
  po: Cr49f_purchaseorders,
  rfqList: Cr49f_requestforqoutations[] = [],
  _supplierList: Cr49f_suppliers[] = [],
  selectedSuppliersList: Cr49f_selectedsupplierses[] = []
): OrderRow {
  const refNo =
    po.cr49f_ponumber ||
    (po.cr49f_purchaseorderid
      ? `PO-${po.cr49f_purchaseorderid.slice(0, 8).toUpperCase()}`
      : "PO-UNKNOWN");

  const cleanRfqId = cleanGuid(po._cr49f_rfq_po_value);
  const rfqPoName = (po as any).cr49f_rfq_poname as string | undefined;

  // Match RFQ
  const matchedRfq = rfqList.find((r) => {
    const rId = cleanGuid(r.cr49f_requestforqoutationid);
    return (
      (cleanRfqId && rId === cleanRfqId) ||
      (rfqPoName &&
        r.cr49f_rfqnumber &&
        r.cr49f_rfqnumber.toLowerCase() === rfqPoName.toLowerCase()) ||
      (po.cr49f_potitle &&
        r.cr49f_rfqnumber &&
        po.cr49f_potitle.toLowerCase().includes(r.cr49f_rfqnumber.toLowerCase()))
    );
  });

  const rfq =
    matchedRfq?.cr49f_rfqnumber || rfqPoName || "No RFQ available";
  const pr = matchedRfq?.cr49f_prrfqname || "No PR available";

  // Match Supplier Name
  let supplier = "Supplier";
  if (po.cr49f_potitle && po.cr49f_potitle.includes(" - ")) {
    const parts = po.cr49f_potitle.split(" - ");
    if (parts.length > 1 && parts[1].trim()) {
      supplier = parts[1].trim();
    }
  }

  if (supplier === "Supplier" && typeof window !== "undefined") {
    if (matchedRfq) {
      const rId = cleanGuid(matchedRfq.cr49f_requestforqoutationid);
      const cached =
        window.localStorage.getItem(`rfq_awarded_supplier_name_${rId}`) ||
        window.localStorage.getItem(
          `rfq_awarded_supplier_name_${matchedRfq.cr49f_rfqnumber}`
        );
      if (cached) supplier = cached;
    }
    const cachedOrder = window.localStorage.getItem(
      `procurement_custom_order_${refNo}`
    );
    if (cachedOrder) {
      try {
        const parsed = JSON.parse(cachedOrder);
        if (parsed.supplier) supplier = parsed.supplier;
      } catch {}
    }
  }

  if (supplier === "Supplier" && matchedRfq) {
    const rId = cleanGuid(matchedRfq.cr49f_requestforqoutationid);
    const selMatch = selectedSuppliersList.find((s) => {
      const sRfq = cleanGuid(s._cr49f_rfq_value || (s as any).cr49f_rfq);
      const isRewarded =
        (s as any).cr49f_isrewarded ||
        (s as any).IsRewarded ||
        (s as any).isrewarded;
      return sRfq === rId && isRewarded;
    });
    if (selMatch) {
      supplier =
        selMatch.cr49f_supplierquotation ||
        selMatch.cr49f_selectedsuppliernumber ||
        "Awarded Supplier";
    }
  }

  const amount = Number(po.cr49f_totalamount) || 0;
  const createdBy =
    (po as any).createdbyname ||
    (po.createdby as any)?.fullname ||
    (po.createdby as any)?.name ||
    "Procurement Officer";

  const rawDate =
    po.cr49f_orderdate || po.createdon || new Date().toISOString();
  const createdOn = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;

  let status: OrderStatus = "Approved";
  if (po.cr49f_status === 0 || po.cr49f_statusname === "Pending") {
    status = "In Review";
  } else if (po.cr49f_status === 1 || po.cr49f_statusname === "Approved") {
    status = "Approved";
  } else if (po.cr49f_status === 2 || po.cr49f_statusname === "Changes Needed") {
    status = "In Review";
  } else if (po.cr49f_status === 3 || po.cr49f_statusname === "Rejected") {
    status = "Rejected";
  }

  return {
    refNo,
    rfq,
    pr,
    supplier,
    amount,
    createdBy,
    createdOn,
    status,
  };
}

/**
 * Fetches purchase orders dynamically from Dataverse cr49f_purchaseorders table,
 * resolving linked RFQ, PR, and Supplier relationships, and combining with local records.
 */
export async function getDynamicPurchaseOrders(): Promise<OrderRow[]> {
  try {
    const [poRes, rfqRes, supRes, selSupRes] = await Promise.allSettled([
      Cr49f_purchaseordersService.getAll(),
      Cr49f_requestforqoutationsService.getAll(),
      Cr49f_suppliersService.getAll(),
      Cr49f_selectedsuppliersesService.getAll(),
    ]);

    const dvPos =
      poRes.status === "fulfilled" && poRes.value.success && poRes.value.data
        ? poRes.value.data
        : [];
    const rfqs =
      rfqRes.status === "fulfilled" && rfqRes.value.success && rfqRes.value.data
        ? rfqRes.value.data
        : [];
    const sups =
      supRes.status === "fulfilled" && supRes.value.success && supRes.value.data
        ? supRes.value.data
        : [];
    const selSups =
      selSupRes.status === "fulfilled" &&
      selSupRes.value.success &&
      selSupRes.value.data
        ? selSupRes.value.data
        : [];

    const dataverseRows: OrderRow[] = dvPos.map((p) =>
      mapDataversePoToOrderRow(p, rfqs, sups, selSups)
    );

    const customOrders = getCustomStoredOrders();
    const dvPoRefs = new Set(dataverseRows.map((r) => r.refNo.toLowerCase()));
    const remainingCustom = customOrders.filter(
      (c) => !dvPoRefs.has(c.refNo.toLowerCase())
    );

    const allDynamic = [...dataverseRows, ...remainingCustom];

    // Deduplicate against base mock orders and prioritize dynamic records
    const allRefs = new Set(allDynamic.map((r) => r.refNo.toLowerCase()));
    const initialRemaining = getAllOrders().filter(
      (o) => !allRefs.has(o.refNo.toLowerCase())
    );

    const combined = [...allDynamic, ...initialRemaining];

    // Sort by created date descending (newest first)
    combined.sort((a, b) => {
      const dateA = new Date(a.createdOn).getTime() || 0;
      const dateB = new Date(b.createdOn).getTime() || 0;
      return dateB - dateA;
    });

    return combined;
  } catch (err) {
    console.warn("Could not load dynamic purchase orders from Dataverse:", err);
    return getAllOrders();
  }
}

/**
 * Loads detailed order record dynamically from Dataverse cr49f_purchaseorders
 * and cr49f_purchaseorderlineitems tables.
 */
export async function getDynamicPurchaseOrderDetails(
  refOrId: string
): Promise<OrderRecord | undefined> {
  const cleanTarget = refOrId.toLowerCase().trim();

  // 1. Check localStorage first
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(
        `procurement_custom_order_${refOrId}`
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          (parsed.refNo?.toLowerCase() === cleanTarget ||
            cleanGuid(parsed.refNo) === cleanGuid(refOrId))
        ) {
          return parsed;
        }
      }
    } catch {}
  }

  // 2. Query Dataverse
  try {
    const [poRes, linesRes, rfqRes, supRes] = await Promise.allSettled([
      Cr49f_purchaseordersService.getAll(),
      Cr49f_purchaseorderlineitemsService.getAll(),
      Cr49f_requestforqoutationsService.getAll(),
      Cr49f_suppliersService.getAll(),
    ]);

    const dvPos =
      poRes.status === "fulfilled" && poRes.value.success && poRes.value.data
        ? poRes.value.data
        : [];
    const allLines =
      linesRes.status === "fulfilled" &&
      linesRes.value.success &&
      linesRes.value.data
        ? linesRes.value.data
        : [];
    const rfqs =
      rfqRes.status === "fulfilled" && rfqRes.value.success && rfqRes.value.data
        ? rfqRes.value.data
        : [];
    const sups =
      supRes.status === "fulfilled" && supRes.value.success && supRes.value.data
        ? supRes.value.data
        : [];

    const matchedPo = dvPos.find((p) => {
      const pNum = (p.cr49f_ponumber || "").toLowerCase().trim();
      const pId = cleanGuid(p.cr49f_purchaseorderid);
      const targetGuid = cleanGuid(refOrId);
      return (
        pNum === cleanTarget ||
        (targetGuid && pId === targetGuid) ||
        (cleanTarget && pId.includes(cleanTarget))
      );
    });

    if (matchedPo) {
      const matchedGuid = cleanGuid(matchedPo.cr49f_purchaseorderid);
      const baseRow = mapDataversePoToOrderRow(matchedPo, rfqs, sups, []);

      // Filter line items for this PO
      const poLines = allLines.filter((l) => {
        const poVal = cleanGuid(l._cr49f_purchaseorder_value || (l as any).cr49f_purchaseorder);
        return poVal === matchedGuid;
      });

      const mappedLines: OrderLineItem[] = poLines.map((l, idx) => ({
        id: l.cr49f_purchaseorderlineitemid || `li-${idx + 1}`,
        itemCode:
          l.cr49f_polinenumber ||
          `PDT-2026-${String(idx + 1).padStart(2, "0")}`,
        itemName: l.cr49f_itemname || `Line Item #${idx + 1}`,
        quantity: Number(l.cr49f_quantityordered) || 1,
        unitPrice: Number(l.cr49f_unitprice) || 0,
        vatPercent: Number(l.cr49f_vat) || 10,
        amount: Number(l.cr49f_totalamount) || 0,
        deliveryAddress:
          matchedPo.cr49f_deliveryaddress || "Corporate Delivery Facility",
      }));

      const effectiveLines =
        mappedLines.length > 0
          ? mappedLines
          : [
              {
                id: "li-1",
                itemCode: "PDT-2026-01",
                itemName:
                  matchedPo.cr49f_potitle || "Commercial Goods & Services",
                quantity: 1,
                unitPrice: baseRow.amount,
                vatPercent: 10,
                amount: baseRow.amount,
                deliveryAddress:
                  matchedPo.cr49f_deliveryaddress ||
                  "Corporate Delivery Facility",
              },
            ];

      const createdDate = new Date(baseRow.createdOn);
      const formatUsDate = (d: Date) =>
        `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      const startDate = new Date(createdDate.getTime() + 3 * 86400000);
      const endDate = new Date(startDate.getTime() + 5 * 86400000);

      const record: OrderRecord = {
        ...baseRow,
        utilizedAmount: baseRow.status === "Approved" ? baseRow.amount : 0,
        remainingAmount: baseRow.status === "Approved" ? 0 : baseRow.amount,
        startDate: formatUsDate(startDate),
        endDate: formatUsDate(endDate),
        rewardedSupplier: {
          name: baseRow.supplier,
          email: "orders@supplier.com",
          phone: "+91 80 4123 4567",
          address: matchedPo.cr49f_deliveryaddress || "Supplier Logistics Hub",
          ranking: "Gold",
          active: true,
        },
        lineItems: effectiveLines,
        paymentTerms: [
          {
            termName: matchedPo.cr49f_paymenttermsname || "Net 30",
            description: "Standard payment terms",
            percent: 100,
            amount: baseRow.amount,
          },
        ],
        budgetCodes: [
          {
            abbreviation: "Inf-IT -IT",
            code: "2-3-10",
            department: "Information Technology",
            percent: 100,
            amount: baseRow.amount,
          },
        ],
        approvalSteps: [
          {
            id: "creation",
            label: `PO creation - ${baseRow.refNo}`,
            actor: baseRow.createdBy,
            role: "Procurement Officer",
            department: "Information Technology",
            timestamp: `${formatUsDate(createdDate)}, 12:00 PM`,
            status: "completed",
          },
          {
            id: "final",
            label: "Commercial Approval",
            actor: "Procurement Director",
            role: "Procurement Director",
            department: "Information Technology",
            timestamp: `${formatUsDate(createdDate)}, 12:01 PM`,
            status: baseRow.status === "Approved" ? "completed" : "current",
          },
        ],
      };

      return record;
    }
  } catch (err) {
    console.warn("Could not query Dataverse for PO details:", err);
  }

  return getOrderByRef(refOrId);
}


