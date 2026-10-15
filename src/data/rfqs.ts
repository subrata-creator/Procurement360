export type RfqStatus = "Rewarded" | "Approved";

export interface RfqRow {
  refNo: string;
  title: string;
  pr: string;
  po: string;
  responses: string;
  supplier: string;
  createdBy: string;
  createdDate: string;
  status: RfqStatus;
}

export const rfqs: RfqRow[] = [
  { refNo: "RFQ-2026-052", title: "RFQ - IT Equipments", pr: "PR-2026-088", po: "PO-2026-032", responses: "3/3", supplier: "Logitech", createdBy: "Ashish Bhatia", createdDate: "01/04/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-051", title: "RFQ for Printer", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "18/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-050", title: "RFQ", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "17/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-049", title: "RFQ", pr: "No PR available", po: "No PO available", responses: "0/2", supplier: "N/A", createdBy: "Ashish Bhatia", createdDate: "17/03/2026", status: "Approved" },
  { refNo: "RFQ-2026-048", title: "RFQ", pr: "PR-2026-087", po: "No PO available", responses: "1/2", supplier: "Dell Inc.", createdBy: "Ashish Bhatia", createdDate: "03/02/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-047", title: "RFQ Pens", pr: "PR-2026-085", po: "PO-2026-028", responses: "2/2", supplier: "ITC", createdBy: "Ashish Bhatia", createdDate: "03/02/2026", status: "Rewarded" },
  { refNo: "RFQ-2026-046", title: "RFQ ST - IT", pr: "No PR available", po: "No PO available", responses: "1/2", supplier: "Dell Inc.", createdBy: "Ashish Bhatia", createdDate: "30/01/2026", status: "Rewarded" },
];
