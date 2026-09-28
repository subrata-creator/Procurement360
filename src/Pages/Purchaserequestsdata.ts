export type PRStatus = "In Review" | "Approved" | "Rejected";

export interface ApprovalStep {
  step: number;
  title: string;
  date?: string;
  by?: string;
  department?: string;
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
  category?: string;
  priority?: "Low" | "Normal" | "High" | "Urgent";
  costCenter?: string;
  justification?: string;
  deliveryAddress?: string;
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
    category: "Workplace Safety",
    priority: "High",
    costCenter: "IT-OPS-240",
    justification: "Restock first aid supplies for the technology teams and shared work areas.",
    deliveryAddress: "IT Operations, Building A",
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
    category: "Workplace Safety",
    priority: "Normal",
    costCenter: "IT-OPS-240",
    justification: "Replace expiring first aid supplies at the main office and IT lab.",
    deliveryAddress: "IT Operations, Building A",
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
    category: "IT Hardware",
    priority: "High",
    costCenter: "IT-CAPEX-110",
    justification: "Provide shared printing and document handling equipment for the IT department.",
    deliveryAddress: "IT Operations, Building A",
    approvalSteps: [
      { step: 1, title: "PR creation - PR-2026-088", date: "4/1/2026, 11:12 AM", by: "Sakshi Paliwal | Business User", department: "Information Technology", status: "Completed" },
      { step: 2, title: "Review & Approval - Approve", date: "4/1/2026, 3:31 PM", by: "Ashish Bhatia | Procurement Head", department: "Information Technology", status: "Completed" },
      { step: 3, title: "Approved", date: "4/2/2026, 10:15 AM", by: "Procurement Head", department: "Information Technology", status: "Completed" },
      { step: 4, title: "RFQ Initiated", status: "Pending" },
      { step: 5, title: "PO Created", status: "Pending" },
      { step: 6, title: "Closed", status: "Pending" },
    ],
    subTasks: [
      { id: 1, task: "Final Review", status: "Completed", assignedTo: "Ashish Bhatia", remarks: "Approved for next stage", completedOn: "4/2/2026, 9:45 AM" },
      { id: 2, task: "Budget Validation", status: "Completed", assignedTo: "Procurement Head", remarks: "Budget available", completedOn: "4/2/2026, 10:05 AM" },
      { id: 3, task: "Final Approval", status: "Completed", assignedTo: "Procurement Head", remarks: "PR approved", completedOn: "4/3/2026, 10:15 AM" },
    ],
    lineItems: [
      { id: 1, itemCode: "PDT-2025-05", itemName: "Laser Printer", quantity: 5, previousContract: "USD 500.00", unitPrice: "USD 1,000.00", totalAmount: "USD 5,000.00", deliveryDate: "5/9/2026", deliveryAddress: "Door No. 12/1 Mylc" },
      { id: 2, itemCode: "PDT-2025-04", itemName: "Document Trays", quantity: 3, previousContract: "USD -", unitPrice: "USD 500.00", totalAmount: "USD 1,500.00", deliveryDate: "5/9/2026", deliveryAddress: "Green View Apart" },
      { id: 3, itemCode: "PDT-2025-06", itemName: "Flatbed Scanner", quantity: 6, previousContract: "USD 5,000.00", unitPrice: "USD 500.00", totalAmount: "USD 3,000.00", deliveryDate: "5/9/2026", deliveryAddress: "Green View Apart" },
      { id: 4, itemCode: "PDT-2025-013", itemName: "Dell Inspiron 15 3530", quantity: 5, previousContract: "USD 6,500.00", unitPrice: "USD 1,200.00", totalAmount: "USD 6,000.00", deliveryDate: "5/9/2026", deliveryAddress: "Sunrise Colony North" },
      { id: 5, itemCode: "PDT-2025-015", itemName: "Logitech MX Master 3S", quantity: 5, previousContract: "USD -", unitPrice: "USD 10.00", totalAmount: "USD 50.00", deliveryDate: "5/9/2026", deliveryAddress: "Sunrise Colony North" },
    ],
  },
  { ref: "PR-2026-087", title: "PR for IT equip.", rfq: "RFQ-2026-048", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "Approved", department: "Information Technology", requiredDate: "2/20/2026", totalAmount: "USD 8,400.00", category: "IT Hardware", priority: "High", costCenter: "IT-CAPEX-110", justification: "Equip support staff with reliable devices for daily service operations.", deliveryAddress: "IT Operations, Building A" },
  { ref: "PR-2026-086", title: "PR for Document Trays", rfq: "No RFQ available", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "In Review", department: "Administration", requiredDate: "2/18/2026", totalAmount: "USD 600.00", category: "Office Supplies", priority: "Normal", costCenter: "ADM-OFF-205", justification: "Organize incoming paperwork at the administration and reception desks.", deliveryAddress: "Administration, Floor 2" },
  { ref: "PR-2026-085", title: "PR for pens", rfq: "RFQ-2026-047", po: "PO-2026-028", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "Approved", department: "Administration", requiredDate: "2/15/2026", totalAmount: "USD 250.00", category: "Office Supplies", priority: "Low", costCenter: "ADM-OFF-205", justification: "Replenish daily-use writing supplies for office staff.", deliveryAddress: "Administration, Floor 2" },
  { ref: "PR-2026-084", title: "PR for Document Trays", rfq: "No RFQ available", po: "No PO available", createdBy: "Sakshi Paliwal", date: "2/3/2026", status: "In Review", department: "Administration", requiredDate: "2/18/2026", totalAmount: "USD 590.00", category: "Office Supplies", priority: "Normal", costCenter: "ADM-OFF-205", justification: "Add document trays to shared workstations to improve records handling.", deliveryAddress: "Administration, Floor 2" },
  { ref: "PR-2026-083", title: "PR for Laptop", rfq: "RFQ-2026-041", po: "PO-2026-018", createdBy: "Sakshi Paliwal", date: "1/28/2026", status: "Rejected", department: "Information Technology", requiredDate: "2/10/2026", totalAmount: "USD 4,200.00", category: "IT Hardware", priority: "High", costCenter: "IT-CAPEX-110", justification: "Replacement laptop request for a field support role; returned for budget clarification.", deliveryAddress: "IT Operations, Building A" },
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

const milestoneTaskSets: Record<string, string[][]> = {
  "PR Creation": [
    ["Validate request details", "Confirm business justification", "Attach supporting documents"],
    ["Check required-by date", "Verify requester information", "Confirm delivery location"],
    ["Review line item quantities", "Check supplier catalog", "Submit request for review"],
  ],
  "Review & Approval": [
    ["Review scope and specifications", "Validate budget availability", "Confirm policy compliance"],
    ["Check cost center allocation", "Review delivery timeline", "Record approver comments"],
    ["Compare requested quantities", "Confirm procurement route", "Complete approval checklist"],
  ],
  Approved: [
    ["Record approval decision", "Notify requester", "Release request to procurement"],
    ["Confirm approved amount", "Update purchasing register", "Prepare sourcing handoff"],
    ["Archive approval documents", "Notify department owner", "Open sourcing activity"],
  ],
  "RFQ Initiated": [
    ["Prepare supplier invitation", "Confirm quotation deadline", "Publish RFQ package"],
    ["Select eligible suppliers", "Attach technical requirements", "Send quotation request"],
    ["Review supplier list", "Set response due date", "Track supplier invitations"],
  ],
  "PO Created": [
    ["Confirm selected supplier", "Validate final pricing", "Issue purchase order"],
    ["Review commercial terms", "Confirm delivery address", "Send PO for acknowledgement"],
    ["Match award to approved scope", "Verify tax and shipping", "Release order to supplier"],
  ],
  "Invoice Created": [
    ["Match invoice to purchase order", "Verify received quantities", "Route invoice for approval"],
    ["Check invoice documentation", "Confirm payment terms", "Record invoice reference"],
    ["Validate billed amount", "Confirm goods receipt", "Submit invoice to finance"],
  ],
  Closed: [
    ["Confirm all items received", "Reconcile final invoice", "Archive procurement record"],
    ["Complete request closeout", "Capture supplier performance", "Notify request owner"],
    ["Verify outstanding actions", "Close purchase order", "Store final documents"],
  ],
  Rejected: [
    ["Document review findings", "Notify requester of decision", "Record follow-up actions"],
    ["Review budget exception", "Add rejection rationale", "Return request to owner"],
    ["Capture approver comments", "Close approval workflow", "Notify department owner"],
  ],
};

const milestoneOwners = ["Ashish Bhatia", "Procurement Head", "Aman Jain", "Finance Manager"];

function stableIndex(value: string, size: number): number {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0) % size;
}

export function buildMilestoneSubTasks(record: PurchaseRequestRecord, step: ApprovalStep): SubTask[] {
  const title = step.title === "Rejected" ? "Rejected" : step.title;
  const taskSets = milestoneTaskSets[title] ?? milestoneTaskSets["Review & Approval"];
  const variation = stableIndex(`${record.ref}-${step.step}`, taskSets.length);
  const tasks = taskSets[variation];
  const ownerOffset = stableIndex(record.ref, milestoneOwners.length);

  return tasks.map((task, index) => {
    const status: SubTask["status"] = step.status === "Completed"
      ? "Completed"
      : step.status === "Current"
        ? index === 0 ? "Completed" : index === 1 ? "In Progress" : "Pending"
        : step.status === "Rejected"
          ? index === 0 ? "Completed" : "In Progress"
          : "Pending";

    const remarks = status === "Completed"
      ? "Completed for this approval stage"
      : status === "In Progress"
        ? step.status === "Rejected" ? "Stopped when the request was returned" : "Awaiting reviewer action"
        : step.status === "Skipped"
          ? "This stage was not reached"
          : "Queued for the next workflow action";

    return {
      id: step.step * 10 + index + 1,
      task,
      status,
      assignedTo: index === 0 ? record.requester || record.createdBy : milestoneOwners[(ownerOffset + index) % milestoneOwners.length],
      remarks,
      ...(status === "Completed" && { completedOn: step.date || record.date }),
    };
  });
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
