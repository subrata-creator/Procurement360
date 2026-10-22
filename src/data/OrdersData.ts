// ---------------------------------------------------------------------
// Orders data/mock layer — mirrors the pattern already used for RFQ
// (Rfqdata.ts) and PR (Purchaserequestsdata.ts).
//
// `orders` below is the single source of truth for the order list (moved
// here from OrdersPage.tsx, which should now import it from this file
// instead of defining it inline — same relationship RfqPage.tsx has with
// Rfqdata.ts).
//
// Everything past the base OrderRow fields (utilized/remaining amount,
// start/end dates, the rewarded supplier's contact details, line items,
// payment terms, budget codes, approval history) is NOT backed by any
// real data source today — your current data only has refNo, rfq, pr,
// supplier, amount, createdBy, createdOn, status. These are generated
// deterministically (seeded from the order ref, not Math.random()) so
// the same PO always renders the same mock details, but they are
// illustrative only:
//   - Line items do not necessarily sum to the order's total `amount`.
//   - Supplier contact info / ranking is placeholder, except Logitech's
//     entry below, which matches the exact values from your reference
//     screenshot for PO-2026-032.
//   - Department is defaulted to "Information Technology" everywhere —
//     there's no per-order department field to draw from.
// Swapping in a real backend later only means rewriting `getOrderByRef`,
// not the consuming page.
// ---------------------------------------------------------------------

export type OrderStatus = "Approved" | "In Review" | "Rejected";

export interface OrderRow {
  refNo: string;
  rfq: string;
  pr: string;
  supplier: string;
  amount: number;
  createdBy: string;
  createdOn: string; // ISO yyyy-mm-dd
  status: OrderStatus;
}

export const orders: OrderRow[] = [
  { refNo: "PO-2026-032", rfq: "RFQ-2026-052", pr: "PR-2026-088", supplier: "Logitech", amount: 17171, createdBy: "Ashish Bhatia", createdOn: "2026-04-03", status: "Approved" },
  { refNo: "PO-2026-031", rfq: "No RFQ available", pr: "No PR available", supplier: "Logitech", amount: 187, createdBy: "Ashish Bhatia", createdOn: "2026-03-22", status: "Approved" },
  { refNo: "PO-2026-030", rfq: "No RFQ available", pr: "No PR available", supplier: "Classmate", amount: 209, createdBy: "Ashish Bhatia", createdOn: "2026-03-22", status: "In Review" },
  { refNo: "PO-2026-029", rfq: "No RFQ available", pr: "No PR available", supplier: "ITC", amount: 71500, createdBy: "Ashish Bhatia", createdOn: "2026-03-19", status: "In Review" },
  { refNo: "PO-2026-028", rfq: "RFQ-2026-047", pr: "PR-2026-085", supplier: "ITC", amount: 495, createdBy: "Ashish Bhatia", createdOn: "2026-02-03", status: "Approved" },
  { refNo: "PO-2026-027", rfq: "RFQ-2026-042", pr: "PR-2026-083", supplier: "Logitech", amount: 6600, createdBy: "Ashish Bhatia", createdOn: "2026-01-28", status: "Approved" },
  { refNo: "PO-2026-026", rfq: "RFQ-2026-041", pr: "PR-2026-081", supplier: "Dell Inc.", amount: 5500, createdBy: "Ashish Bhatia", createdOn: "2026-01-27", status: "Approved" },
];

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function seedFromRef(ref: string): number {
  let hash = 0;
  for (let i = 0; i < ref.length; i++) {
    hash = (hash * 31 + ref.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatUsDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export interface RewardedSupplier {
  name: string;
  email: string;
  phone: string;
  address: string;
  ranking: "Gold" | "Silver" | "Bronze";
  active: boolean;
}

// Known contact card from the reference screenshot — used verbatim
// whenever the order's supplier is Logitech. Other suppliers fall back
// to a deterministic placeholder directory below.
const SUPPLIER_DIRECTORY: Record<string, RewardedSupplier> = {
  Logitech: {
    name: "Logitech",
    email: "logitech@gmail.com",
    phone: "+91 9874455687",
    address: "A326, Jaipur, Jaipur, India, 302017",
    ranking: "Gold",
    active: true,
  },
};

const RANKINGS: RewardedSupplier["ranking"][] = ["Gold", "Silver", "Bronze"];
const CITIES = ["Jaipur, India", "Pune, India", "Bengaluru, India", "Gurugram, India"];

function buildSupplier(name: string, seed: number): RewardedSupplier {
  const known = SUPPLIER_DIRECTORY[name];
  if (known) return known;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const city = CITIES[seed % CITIES.length];
  const houseNo = 100 + (seed % 800);
  return {
    name,
    email: `${slug}@example.com`,
    phone: `+91 ${9000000000 + (seed % 99999999)}`,
    address: `${houseNo}, ${city.split(",")[0]} Estate, ${city}`,
    ranking: RANKINGS[seed % RANKINGS.length],
    active: seed % 5 !== 0,
  };
}

export interface OrderLineItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  vatPercent: number;
  amount: number;
  deliveryAddress: string;
}

// Matches the exact two line items visible in the PO-2026-032 reference
// screenshot (6 × USD 500 @ 10% VAT = 3300; 5 × USD 12 @ 10% VAT = 66).
const REFERENCE_LINE_ITEMS: Record<string, Omit<OrderLineItem, "deliveryAddress">[]> = {
  "PO-2026-032": [
    { id: "li-1", itemCode: "PDT-2025-06", itemName: "Flatbed Scanner", quantity: 6, unitPrice: 500, vatPercent: 10, amount: 3300 },
    { id: "li-2", itemCode: "PDT-2025-014", itemName: "Logitech H390 Wired Headset", quantity: 5, unitPrice: 12, vatPercent: 10, amount: 66 },
  ],
};

const ITEM_CATALOG: { itemCode: string; itemName: string; unitPrice: number }[] = [
  { itemCode: "PDT-2025-01", itemName: "Wireless Mouse", unitPrice: 18 },
  { itemCode: "PDT-2025-04", itemName: "Mechanical Keyboard", unitPrice: 45 },
  { itemCode: "PDT-2025-06", itemName: "Flatbed Scanner", unitPrice: 500 },
  { itemCode: "PDT-2025-09", itemName: "27-inch Monitor", unitPrice: 210 },
  { itemCode: "PDT-2025-011", itemName: "USB-C Dock", unitPrice: 85 },
  { itemCode: "PDT-2025-014", itemName: "Logitech H390 Wired Headset", unitPrice: 12 },
  { itemCode: "PDT-2025-017", itemName: "Laser Printer", unitPrice: 320 },
];

const DELIVERY_ADDRESSES = ["Green View Apart", "Corporate Tower B", "Warehouse 4, Industrial Area", "Head Office Annex"];

function buildLineItems(record: OrderRow, seed: number): OrderLineItem[] {
  const reference = REFERENCE_LINE_ITEMS[record.refNo];
  if (reference) {
    return reference.map((item, index) => ({
      ...item,
      deliveryAddress: DELIVERY_ADDRESSES[(seed + index) % DELIVERY_ADDRESSES.length],
    }));
  }

  const itemCount = 1 + (seed % 3);
  return Array.from({ length: itemCount }, (_, index) => {
    const catalogItem = ITEM_CATALOG[(seed + index * 3) % ITEM_CATALOG.length];
    const quantity = 1 + ((seed + index) % 6);
    const vatPercent = 10;
    const amount = Math.round(quantity * catalogItem.unitPrice * (1 + vatPercent / 100) * 100) / 100;
    return {
      id: `li-${index + 1}`,
      itemCode: catalogItem.itemCode,
      itemName: catalogItem.itemName,
      quantity,
      unitPrice: catalogItem.unitPrice,
      vatPercent,
      amount,
      deliveryAddress: DELIVERY_ADDRESSES[(seed + index) % DELIVERY_ADDRESSES.length],
    };
  });
}

export interface PaymentTerm {
  termName: string;
  description: string;
  percent: number;
  amount: number;
}

function buildPaymentTerms(record: OrderRow): PaymentTerm[] {
  // Single-term model (100% on CHEQUE), matching the reference screenshot.
  // Extend this if multi-installment payment terms are needed later.
  return [{ termName: "CHEQUE", description: "", percent: 100, amount: record.amount }];
}

export interface BudgetCode {
  abbreviation: string;
  code: string;
  department: string;
  percent: number;
  amount: number;
}

function buildBudgetCodes(record: OrderRow): BudgetCode[] {
  // Department is defaulted to "Information Technology" for every order —
  // there's no per-order department field in the source data yet.
  return [{ abbreviation: "Inf-IT -IT", code: "2-3-10", department: "Information Technology", percent: 100, amount: record.amount }];
}

export type OrderApprovalStatus = "completed" | "current" | "rejected";

export interface OrderApprovalStep {
  id: string;
  label: string;
  actor: string;
  role: string;
  department: string;
  timestamp: string;
  status: OrderApprovalStatus;
}

const APPROVER_POOL = ["Aman Jain", "Priya Sharma", "Rohit Verma", "Neha Kapoor"];

function buildApprovalSteps(record: OrderRow, seed: number, timestamp: string): OrderApprovalStep[] {
  const approver = APPROVER_POOL[seed % APPROVER_POOL.length];

  const creation: OrderApprovalStep = {
    id: "creation",
    label: `PO creation - ${record.refNo}`,
    actor: record.createdBy,
    role: "Procurement Head",
    department: "Information Technology",
    timestamp,
    status: "completed",
  };

  if (record.status === "Rejected") {
    return [
      creation,
      {
        id: "final",
        label: "Final Approval - Rejected",
        actor: approver,
        role: "Procurement Manager",
        department: "Information Technology",
        timestamp,
        status: "rejected",
      },
    ];
  }

  if (record.status === "In Review") {
    return [
      creation,
      {
        id: "final",
        label: "Final Approval - Pending",
        actor: approver,
        role: "Procurement Manager",
        department: "Information Technology",
        timestamp: "",
        status: "current",
      },
    ];
  }

  return [
    creation,
    {
      id: "final",
      label: "Final Approval - Approve",
      actor: approver,
      role: "Procurement Manager",
      department: "Information Technology",
      timestamp,
      status: "completed",
    },
  ];
}

export interface OrderRecord extends OrderRow {
  utilizedAmount: number;
  remainingAmount: number;
  startDate: string;
  endDate: string;
  rewardedSupplier: RewardedSupplier;
  lineItems: OrderLineItem[];
  paymentTerms: PaymentTerm[];
  budgetCodes: BudgetCode[];
  approvalSteps: OrderApprovalStep[];
}

export function getOrderByRef(ref: string): OrderRecord | undefined {
  const record = orders.find((row) => row.refNo === ref);
  if (!record) return undefined;

  const seed = seedFromRef(record.refNo);
  const createdDate = parseIsoDate(record.createdOn);
  const startDate = addDays(createdDate, 3);
  const endDate = addDays(startDate, 5);
  const timestamp = `${formatUsDate(createdDate)}, 12:17PM`;

  const utilizedAmount = record.status === "Approved" ? record.amount : 0;
  const remainingAmount = record.amount - utilizedAmount;

  return {
    ...record,
    utilizedAmount,
    remainingAmount,
    startDate: formatUsDate(startDate),
    endDate: formatUsDate(endDate),
    rewardedSupplier: buildSupplier(record.supplier, seed),
    lineItems: buildLineItems(record, seed),
    paymentTerms: buildPaymentTerms(record),
    budgetCodes: buildBudgetCodes(record),
    approvalSteps: buildApprovalSteps(record, seed, timestamp),
  };
}