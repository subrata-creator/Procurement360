import type {
  Cr49f_procurementapprovalcyclescr49f_objecttype,
} from "../generated/models/Cr49f_procurementapprovalcyclesModel";
import type {
  Cr49f_tasksescr49f_department,
  Cr49f_tasksescr49f_role,
  Cr49f_tasksescr49f_slaunit,
} from "../generated/models/Cr49f_tasksesModel";

export interface SampleTaskItem {
  cr49f_task: string;
  cr49f_role: keyof typeof Cr49f_tasksescr49f_role;
  cr49f_department: keyof typeof Cr49f_tasksescr49f_department;
  cr49f_sequencenumber: number;
  cr49f_slanumber: number;
  cr49f_slaunit: keyof typeof Cr49f_tasksescr49f_slaunit;
}

export interface SampleApprovalCycleItem {
  code: string;
  objectType: keyof typeof Cr49f_procurementapprovalcyclescr49f_objecttype;
  objectTypeName: string;
  minAmount?: number;
  maxAmount?: number;
  tasks: SampleTaskItem[];
}

export const SAMPLE_APPROVAL_CYCLES: SampleApprovalCycleItem[] = [
  // 1. Purchase Request (PR) Approval Cycle - 4 tasks (within 3-5)
  {
    code: "AC-PR-001",
    objectType: 1, // Purchase Request
    objectTypeName: "Purchase Request",
    tasks: [
      {
        cr49f_task: "Initial PR Review & Budget Verification",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 1,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Technical Specifications & Need Assessment",
        cr49f_role: 4, // Procurement Officer
        cr49f_department: 2, // IT
        cr49f_sequencenumber: 2,
        cr49f_slanumber: 48,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Finance & Cost Center Allocation Approval",
        cr49f_role: 3, // Finance Approver
        cr49f_department: 1, // Finance
        cr49f_sequencenumber: 3,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Procurement Lead Final Sign-Off",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 4,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
    ],
  },

  // 2. Request for Quotation (RFQ) Approval Cycle - 3 tasks (within 3-5)
  {
    code: "AC-RFQ-001",
    objectType: 2, // RFQ
    objectTypeName: "RFQ",
    tasks: [
      {
        cr49f_task: "Review Sourcing Scope & Vendor Bidding List",
        cr49f_role: 4, // Procurement Officer
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 1,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Technical & Compliance Bid Evaluation",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 2, // IT
        cr49f_sequencenumber: 2,
        cr49f_slanumber: 48,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Commercial Comparison & Vendor Selection Approval",
        cr49f_role: 3, // Finance Approver
        cr49f_department: 1, // Finance
        cr49f_sequencenumber: 3,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
    ],
  },

  // 3. Purchase Order (Orders) Approval Cycle - 5 tasks (within 3-5)
  {
    code: "AC-PO-001",
    objectType: 3, // Orders
    objectTypeName: "Orders",
    tasks: [
      {
        cr49f_task: "PO Generation & Contract Line Validation",
        cr49f_role: 4, // Procurement Officer
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 1,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Supplier Risk, Compliance & Terms Verification",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 2,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Financial Controller Budget Commitment Sign-Off",
        cr49f_role: 3, // Finance Approver
        cr49f_department: 1, // Finance
        cr49f_sequencenumber: 3,
        cr49f_slanumber: 48,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "Executive Procurement Director Authorization",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 4,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
      {
        cr49f_task: "PO Dispatch & Vendor Confirmation Acknowledgment",
        cr49f_role: 4, // Procurement Officer
        cr49f_department: 3, // Administrator
        cr49f_sequencenumber: 5,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
    ],
  },
];

