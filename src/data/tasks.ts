import type { Task } from "../types/dashboard";

export const taskInboxItems: Task[] = [
  {
    id: 1,
    taskName: "Invoice Approvals for Business Owner - Invoice Approval for INV-2026-031",
    taskType: "Invoice",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "3/22/2026",
    description: "Review the invoice details, supporting documents, and coding before approving payment.",
    priority: "High",
  },
  {
    id: 2,
    taskName: "Invoice Approvals for Business Owner - Invoice Approval for INV-2026-030",
    taskType: "Invoice",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "3/20/2026",
    description: "Confirm the invoice matches the approved purchase order and received goods.",
    priority: "Normal",
  },
  {
    id: 3,
    taskName: "Purchase Request Approval - PR-2026-088 IT Equipment",
    taskType: "Purchase Request",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "4/1/2026",
    description: "Review the IT equipment request, validate the supporting quotation, and confirm budget availability.",
    priority: "Normal",
  },
  {
    id: 4,
    taskName: "Purchase Order Approval - PO-2026-032 Logitech",
    taskType: "Purchase Order",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "4/3/2026",
    description: "Verify supplier, quantities, delivery terms, and final pricing before approving the purchase order.",
    priority: "High",
  },
  {
    id: 5,
    taskName: "RFQ Approvals for RFQ-2025-019",
    taskType: "Request for Quotation",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "10/6/2025",
    description: "Review supplier responses and approve the quotation recommendation.",
    priority: "Normal",
  },
  {
    id: 6,
    taskName: "RFQ Approvals for RFQ-2025-018",
    taskType: "Request for Quotation",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "8/7/2025",
    description: "Check the RFQ evaluation and supplier response summary before approval.",
    priority: "Low",
  },
  {
    id: 7,
    taskName: "Purchase Request Approval - PR-2026-090 First Aid Kit",
    taskType: "Purchase Request",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "8/4/2026",
    description: "Review the First Aid Kit request, confirm the required-by date and validate the department budget.",
    priority: "High",
  },
  {
    id: 8,
    taskName: "RFQ Approvals for RFQ-2025-020",
    taskType: "Request for Quotation",
    assignedTo: "Sakshi Paliwal",
    assignedOn: "10/8/2025",
    description: "Review supplier quotations for the office equipment request and approve the sourcing recommendation.",
    priority: "Normal",
  },
];

export function getTaskById(id: number): Task | undefined {
  return taskInboxItems.find((task) => task.id === id);
}