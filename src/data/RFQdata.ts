import { rfqs, type RfqRow, type RfqStatus } from "./rfqs";

// ---------------------------------------------------------------------------
// RFQ Summary data layer
//
// `rfqs` (src/data/rfqs.ts) only carries the columns the RFQ list table
// needs: refNo, title, pr, po, responses, supplier, createdBy, createdDate,
// status. The RFQ Summary page needs more than that — a budget, a
// start/clarification/response-due/reward timeline, a full invited-supplier
// roster with contact details and ranking, and quotation line items — none
// of which exist in the real data model yet.
//
// Everything below is MOCK data, deterministically derived from the real
// row (same ref always produces the same enriched record — nothing is
// randomized on every render). When the backend starts returning this
// detail, replace the body of getRfqByRef with the real API call/mapping
// and the page itself (RfqDetail.tsx) does not need to change.
// ---------------------------------------------------------------------------

export type { RfqRow, RfqStatus };

export interface RfqSupplier {
  id: string;
  name: string;
  verified: boolean;
  email: string;
  phone: string;
  address: string;
  ranking: number;
  rewarded: boolean;
}

export interface RfqLineItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  deliveryAddress: string;
}

export type RfqApprovalStatus = "Completed" | "Current" | "Rejected" | "Pending";

export interface RfqApprovalStep {
  step: number;
  title: string;
  status: RfqApprovalStatus;
  by?: string;
  department?: string;
  date?: string;
}

export interface RfqRecord extends RfqRow {
  startDate: string;
  clarificationDate: string;
  responseDueDate: string;
  rewardDate: string;
  responsesReceived: number;
  responsesInvited: number;
  invitedSuppliers: RfqSupplier[];
  lineItems: RfqLineItem[];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function parseResponses(responses: string): { received: number; invited: number } {
  const [received, invited] = responses.split("/").map(Number);
  return {
    received: Number.isFinite(received) ? received : 0,
    invited: Number.isFinite(invited) ? invited : 0,
  };
}

function parseDmyDate(value: string): Date | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDmy(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

// Small deterministic hash so the same ref always draws the same mock
// suppliers/items — not Math.random(), which would reshuffle on every
// re-render.
function seedFromRef(ref: string): number {
  let seed = 0;
  for (let i = 0; i < ref.length; i += 1) seed = (seed * 31 + ref.charCodeAt(i)) >>> 0;
  return seed;
}

const SUPPLIER_POOL: Array<{ name: string; domain: string; phone: string; address: string }> = [
  { name: "Dell Inc.", domain: "dell.com", phone: "9988776655", address: "Dell International Services, 12/2A, Bengaluru, Karnataka, 560071, India" },
  { name: "Lenovo", domain: "lenovo.com", phone: "7598745648", address: "Divyasree Greens, 167 A, Jaipur, Rajasthan, 302004, India" },
  { name: "Logitech", domain: "logitech.com", phone: "9874455687", address: "A326, Vaishali Nagar, Jaipur, Jaipur, 302017, India" },
  { name: "HP Inc.", domain: "hp.com", phone: "9123456780", address: "HP Campus, Outer Ring Road, Bengaluru, Karnataka, 560103, India" },
  { name: "ITC Limited", domain: "itc.in", phone: "9988001122", address: "ITC Centre, Camac Street, Kolkata, West Bengal, 700016, India" },
  { name: "Epson India", domain: "epson.co.in", phone: "9012345678", address: "Epson House, Sector 44, Gurugram, Haryana, 122003, India" },
];

const LINE_ITEM_CATALOG: Array<{ code: string; name: string; unitPrice: number }> = [
  { code: "PDT-2025-04", name: "Document Trays", unitPrice: 500 },
  { code: "PDT-2025-05", name: "Laser Printer", unitPrice: 1000 },
  { code: "PDT-2025-06", name: "Flatbed Scanner", unitPrice: 500 },
  { code: "PDT-2025-07", name: "Wireless Mouse", unitPrice: 25 },
  { code: "PDT-2025-08", name: "Mechanical Keyboard", unitPrice: 60 },
  { code: "PDT-2025-09", name: "27\" Monitor", unitPrice: 220 },
  { code: "PDT-2025-10", name: "USB-C Dock", unitPrice: 90 },
];

const DELIVERY_ADDRESSES = [
  "Green View Apartments Sector 45, Gurugram, Haryana, 122003, India",
  "Door No. 12/1, Mylapore, Chennai, Tamil Nadu, 600004, India",
  "Tech Park One, Hinjewadi, Pune, Maharashtra, 411057, India",
];

function buildInvitedSuppliers(record: RfqRow, invited: number, seed: number): RfqSupplier[] {
  const count = Math.max(invited, 1);
  const startIndex = seed % SUPPLIER_POOL.length;
  const winnerName = record.supplier !== "N/A" ? record.supplier : null;

  const names: string[] = [];
  if (winnerName) names.push(winnerName);
  for (let i = 0; names.length < count; i += 1) {
    const candidate = SUPPLIER_POOL[(startIndex + i) % SUPPLIER_POOL.length].name;
    if (!names.includes(candidate)) names.push(candidate);
  }

  return names.slice(0, count).map((name, index) => {
    const pooled = SUPPLIER_POOL.find((s) => s.name === name);
    const emailLocal = name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) || "supplier";
    return {
      id: `${record.refNo}-supplier-${index + 1}`,
      name,
      verified: true,
      email: pooled ? `${emailLocal}@${pooled.domain}` : `${emailLocal}@gmail.com`,
      phone: pooled?.phone ?? "9900112233",
      address: pooled?.address ?? "Address on file",
      ranking: index + 1,
      rewarded: record.status === "Rewarded" && name === winnerName,
    };
  });
}

function buildLineItems(record: RfqRow, seed: number): RfqLineItem[] {
  const itemCount = 2 + (seed % 3); // 2-4 line items
  const startIndex = seed % LINE_ITEM_CATALOG.length;
  const items: RfqLineItem[] = [];

  for (let i = 0; i < itemCount; i += 1) {
    const catalogItem = LINE_ITEM_CATALOG[(startIndex + i) % LINE_ITEM_CATALOG.length];
    const quantity = 1 + ((seed + i * 7) % 6);
    items.push({
      id: `${record.refNo}-item-${i + 1}`,
      itemCode: catalogItem.code,
      itemName: catalogItem.name,
      quantity,
      unitPrice: catalogItem.unitPrice,
      totalAmount: quantity * catalogItem.unitPrice,
      deliveryAddress: DELIVERY_ADDRESSES[(seed + i) % DELIVERY_ADDRESSES.length],
    });
  }

  return items;
}

export function getRfqByRef(ref: string): RfqRecord | undefined {
  const record = rfqs.find((row) => row.refNo === ref);
  if (!record) return undefined;

  const seed = seedFromRef(record.refNo);
  const { received, invited } = parseResponses(record.responses);
  const created = parseDmyDate(record.createdDate) ?? new Date();

  const startDate = formatDmy(created);
  const clarificationDate = formatDmy(addDays(created, 5));
  const responseDueDate = formatDmy(addDays(created, 10));
  const rewardDate = record.status === "Rewarded" ? formatDmy(addDays(created, 14)) : "Pending";

  return {
    ...record,
    startDate,
    clarificationDate,
    responseDueDate,
    rewardDate,
    responsesReceived: received,
    responsesInvited: invited,
    invitedSuppliers: buildInvitedSuppliers(record, invited, seed),
    lineItems: buildLineItems(record, seed),
  };
}

export function buildRfqApprovalSteps(record: RfqRecord): RfqApprovalStep[] {
  const isRewarded = record.status === "Rewarded";
  const hasResponses = record.responsesReceived > 0;

  return [
    {
      step: 1,
      title: "RFQ Creation",
      status: "Completed",
      by: `${record.createdBy} | Procurement Head`,
      department: "Information Technology",
      date: record.startDate,
    },
    {
      step: 2,
      title: "Supplier Invitation",
      status: "Completed",
      by: `${record.createdBy} | Procurement Manager`,
      department: "Information Technology",
      date: record.startDate,
    },
    {
      step: 3,
      title: "Clarification Period",
      status: hasResponses || isRewarded ? "Completed" : "Current",
      date: record.clarificationDate,
    },
    {
      step: 4,
      title: "Response Collection",
      status: isRewarded ? "Completed" : hasResponses ? "Current" : "Pending",
      date: record.responseDueDate,
    },
    {
      step: 5,
      title: "Evaluation & Ranking",
      status: isRewarded ? "Completed" : "Pending",
      date: isRewarded ? record.responseDueDate : undefined,
    },
    {
      step: 6,
      title: "Reward Decision",
      status: isRewarded ? "Completed" : "Pending",
      by: isRewarded ? "Aman Jain | Procurement Manager" : undefined,
      department: isRewarded ? "Information Technology" : undefined,
      date: isRewarded ? record.rewardDate : undefined,
    },
  ];
}

export function totalBudgetFor(record: RfqRecord): number {
  return record.lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
}