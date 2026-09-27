export type PRStatus = "In Review" | "Approved" | "Rejected";

export interface ApprovalStep {
  step: number;
  title: string;
  date?: string;
  by?: string;
  status: "Completed" | "Current" | "Pending" | "Rejected" | "Skipped";
}

export interface SubTask {
  id: number;
  task: string;
  status: "Completed" | "In Progress" | "Pending";
  assignedTo: string;
  remarks: string;
  completedOn?: string;
}

export interface LineItem {
  id: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  previousContract: string;
  unitPrice: string;
  totalAmount: string;
  deliveryDate: string;
  deliveryAddress: string;
}

export interface PurchaseRequestRecord {
  ref: string;
  title: string;
  rfq: string;
  po: string;
  createdBy: string;
  date: string;
  status: PRStatus;
  requester?: string;
  department?: string;
  requiredDate?: string;
  totalAmount?: string;
  approvalSteps?: ApprovalStep[];
  subTasks?: SubTask[];
  lineItems?: LineItem[];
}

export const purchaseRequests: PurchaseRequestRecord[] = [
  {
    ref: "PR-2026-090",
    title: "PR for First Aid Kit",
    rfq: "No RFQ available",
    po: "No PO available",
    createdBy: "Sakshi Paliwal",
    date: "8/4/2026",
    status: "In Review",
    department: "Information Technology",
    requiredDate: "8/20/2026",
    totalAmount: "USD 1,200.00",
  },
  {
    ref: "PR-2026-089",
    title: "PR for First Aid Kit",
    rfq: "No RFQ available",
    po: "No PO available",
    createdBy: "Sakshi Paliwal",
    date: "8/4/2026",
    status: "In Review",
    department: "Information Technology",
    requiredDate: "8/20/2026",
    totalAmount: "USD 1,050.00",
  },
  {
    ref: "PR-2026-088",
    title: "PR - IT Equipments",
    rfq: "RFQ-2026-052",
    po: "PO-2026-032",
    createdBy: "Sakshi Paliwal",
    date: "4/1/2026",
    status: "Approved",
    requester: "Sakshi Paliwal",
    department: "Information Technology",
    requiredDate: "4/30/2026",
    totalAmount: "USD 15,610.00",
    approvalSteps: [
      { step: 1, title: "PR Creation", date: "4/1/2026, 11:12 AM", by: "Sakshi Paliwal", status: "Completed" },
      { step: 2, title: "Review & Approval", date: "4/1/2026, 3:31 PM", by: "Ashish Bhatia", status: "Completed" },
      { step: 3, title: "Approved", date: "4/2/2026, 10:15 AM", by: "Procurement Head", status: "Completed" },
      { step: 4, title: "RFQ Initiated", status: "Pending" },
      { step: 5, title: "PO Created", status: "Pending" },
      { step: 6, title: "Invoice Created", status: "Pending" },
      { step: 7, title: "Closed", status: "Pending" },
    ],
    subTasks: [
      { id: 1, task: "Final Review", status: "Completed", assignedTo: "Ashish Bhatia", remarks: "Approved for next stage", completedOn: "4/2/2026, 9:45 AM" },
      { id: 2, task: "Budget Validation", status: "Completed", assignedTo: "Procurement Head", remarks: "Budget available", completedOn: "4/2/2026, 10:05 AM" },
      { id: 3, task: "Final Approval", status: "Completed", assignedTo: "Procurement Head", remarks: "PR approved", completedOn: "4/3/2026, 10:15 AM" },
    ],
    lineItems: [
      { id: 1, itemCode: "PDT-2025-05", itemName: "Laser Printer", quantity: 5, previousContract: "USD 500.00", unitPrice: "USD 1,000.00", totalAmount: "USD 5,000.00", deliveryDate: "5/9/2026", deliveryAddress: "Door No. 12/1 Mylc" },
      { id: 2, itemCode: "PDT-2025-04", itemName: "Document Trays", quantity: 3, previousContract: "USD -", unitPrice: "USD 500.00", totalAmount: "USD 1,500.00", deliveryDate: "5/9/2026", deliveryAddress: "Green View Apart" },
    ],
  },
  { ref: "PR-2026-087", title: "PR for IT equip.", rfq: "RFQ-2026-048", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "Approved", department: "Information Technology", requiredDate: "2/20/2026", totalAmount: "USD 8,400.00" },
  { ref: "PR-2026-086", title: "PR for Document Trays", rfq: "No RFQ available", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "In Review", department: "Administration", requiredDate: "2/18/2026", totalAmount: "USD 600.00" },
  { ref: "PR-2026-085", title: "PR for pens", rfq: "RFQ-2026-047", po: "PO-2026-028", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "Approved", department: "Administration", requiredDate: "2/15/2026", totalAmount: "USD 250.00" },
  { ref: "PR-2026-084", title: "PR for Document Trays", rfq: "No RFQ available", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "In Review", department: "Administration", requiredDate: "2/18/2026", totalAmount: "USD 590.00" },
  { ref: "PR-2026-083", title: "PR for Laptop", rfq: "RFQ-2026-041", po: "PO-2026-018", createdBy: "Sakshi Paliwal", date: "1/28/2026", status: "Rejected", department: "Information Technology", requiredDate: "2/10/2026", totalAmount: "USD 4,200.00" },
];

const STEP_LABELS = ["PR Creation", "Review & Approval", "Approved", "RFQ Initiated", "PO Created", "Invoice Created", "Closed"];

export function getPurchaseRequestByRef(ref: string): PurchaseRequestRecord | undefined {
  return purchaseRequests.find((pr) => pr.ref === ref);
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

export function buildApprovalSteps(record: PurchaseRequestRecord): ApprovalStep[] {
  if (record.approvalSteps) return record.approvalSteps;

  const hasRFQ = record.rfq !== "No RFQ available";
  const hasPO = record.po !== "No PO available";

  if (record.status === "Rejected") {
    return STEP_LABELS.map((title, index) => {
      const step = index + 1;
      if (step === 1 || step === 2) return { step, title, status: "Completed" };
      if (step === 3) return { step, title: "Rejected", date: record.date, status: "Rejected" };
      return { step, title, status: "Skipped" };
    });
  }

  if (record.status === "In Review") {
    return STEP_LABELS.map((title, index) => {
      const step = index + 1;
      if (step === 1) return { step, title, date: record.date, by: record.createdBy, status: "Completed" };
      if (step === 2) return { step, title, status: "Current" };
      return { step, title, status: "Pending" };
    });
  }

  return STEP_LABELS.map((title, index) => {
    const step = index + 1;
    if (step <= 3) return { step, title, status: "Completed" };
    if (step === 4) return { step, title, status: hasRFQ ? "Completed" : "Pending" };
    if (step === 5) return { step, title, status: hasPO ? "Completed" : "Pending" };
    return { step, title, status: "Pending" };
  });
}

export function buildDefaultSubTasks(record: PurchaseRequestRecord): SubTask[] {
  if (record.subTasks) return record.subTasks;

  if (record.status === "Rejected") {
    return [
      { id: 1, task: "Final Review", status: "Completed", assignedTo: record.createdBy, remarks: "Sent for review", completedOn: record.date },
      { id: 2, task: "Final Approval", status: "Completed", assignedTo: "Procurement Head", remarks: "Request rejected", completedOn: record.date },
    ];
  }

  if (record.status === "In Review") {
    return [{ id: 1, task: "Final Review", status: "In Progress", assignedTo: record.createdBy, remarks: "Awaiting reviewer action" }];
  }

  return [
    { id: 1, task: "Final Review", status: "Completed", assignedTo: record.createdBy, remarks: "Approved for next stage", completedOn: record.date },
    { id: 2, task: "Final Approval", status: "Completed", assignedTo: "Procurement Head", remarks: "PR approved", completedOn: record.date },
  ];
}

export function buildDefaultLineItems(record: PurchaseRequestRecord): LineItem[] {
  if (record.lineItems) return record.lineItems;

  return [{
    id: 1,
    itemCode: "GEN-0000",
    itemName: record.title,
    quantity: 1,
    previousContract: "USD -",
    unitPrice: record.totalAmount || "USD -",
    totalAmount: record.totalAmount || "USD -",
    deliveryDate: record.requiredDate || "-",
    deliveryAddress: "-",
  }];
}
