import { useState } from "react";
import { ArrowLeft, CalendarDays, Check, ClipboardList, Eye, FileText, Flag, List, MapPin, Paperclip, Send, ShieldCheck, Tag, UserRound, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getTaskById } from "../data/tasks";
import type { Task } from "../types/dashboard";
import "../Styles/TaskDetail.css";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const task = id ? getTaskById(Number(id)) : undefined;

  if (!task) {
    return (
      <section className="task-detail-page">
        <button type="button" className="task-detail-back" onClick={() => navigate("/")}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="task-detail-empty">Task not found.</div>
      </section>
    );
  }

  const relatedReference = task.taskName.match(/(?:INV|PR|RFQ|PO)-\d{4}-\d{3}/)?.[0] ?? "—";

  if (task.taskType === "Request for Quotation") {
    return <RfqApprovalTask task={task} onBack={() => navigate(-1)} />;
  }

  if (task.taskType === "Invoice" || task.taskType === "Purchase Request" || task.taskType === "Purchase Order") {
    return <OtherApprovalTask task={task} onBack={() => navigate(-1)} />;
  }

  return (
    <section className="task-detail-page">
      <button type="button" className="task-detail-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back to Task Inbox
      </button>

      <header className="task-detail-heading">
        <div>
          <span className="task-detail-eyebrow">{task.taskType}</span>
          <h1>{task.taskName}</h1>
          <p>Review the assigned action and its related procurement record.</p>
        </div>
        <span className="task-detail-status">Pending action</span>
      </header>

      <article className="task-detail-card">
        <div className="task-detail-card-heading">
          <ClipboardList size={18} />
          <h2>Task details</h2>
        </div>

        <div className="task-detail-fields">
          <div className="task-detail-field">
            <UserRound size={16} />
            <div><span>Assigned to</span><strong>{task.assignedTo}</strong></div>
          </div>
          <div className="task-detail-field">
            <CalendarDays size={16} />
            <div><span>Assigned on</span><strong>{task.assignedOn}</strong></div>
          </div>
          <div className="task-detail-field">
            <ClipboardList size={16} />
            <div><span>Related reference</span><strong>{relatedReference}</strong></div>
          </div>
          <div className="task-detail-field">
            <Flag size={16} />
            <div><span>Priority</span><strong>{task.priority ?? "Normal"}</strong></div>
          </div>
        </div>

        <div className="task-detail-description">
          <h3>Requested action</h3>
          <p>{task.description ?? "Review the assigned record and complete the required workflow action."}</p>
        </div>
      </article>
    </section>
  );
}

function RfqApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const [status, setStatus] = useState("In Review");
  const [assignee, setAssignee] = useState(task.id === 5 ? "Rushi Pardeshi" : "Aman Jain");
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/RFQ-\d{4}-\d{3}/)?.[0] ?? "RFQ-2025-019";
  const isTestingRfq = reference.endsWith("019");
  const rfqTitle = isTestingRfq ? "testing" : "Office supplies quotation";

  const addComment = () => {
    const comment = commentDraft.trim();
    if (!comment) return;
    setComments((existing) => [...existing, comment]);
    setCommentDraft("");
  };

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`RFQ ${reference} marked ${nextStatus.toLowerCase()}.`);
  };

  const reassign = () => {
    setAssignee((current) => current === "Rushi Pardeshi" ? "Aman Jain" : "Rushi Pardeshi");
    setNotice("Task reassigned.");
  };

  return (
    <section className="task-detail-page rfq-review-page">
      <header className="rfq-review-heading">
        <button type="button" className="task-detail-back rfq-review-back" onClick={onBack} aria-label="Back to Task Inbox">
          <ArrowLeft size={17} />
        </button>
        <div className="rfq-review-title-group">
          <h1>REQUEST FOR QUOTATION APPROVAL FOR {reference} | {rfqTitle.toUpperCase()}</h1>
          <span className={`rfq-review-status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
        </div>
      </header>

      <section className="rfq-approval-track" aria-label="Approval progress">
        {[
          { label: "Form Review", assigned: "Neha Sharma", status: "Completed" },
          { label: "Manager Approval", assigned: assignee, status: status === "In Review" ? "Current" : "Pending" },
          { label: "Final Approval", assigned: "Akash Singh", status: "Pending" },
        ].map((step, index) => (
          <div className={`rfq-approval-step ${step.status.toLowerCase()}`} key={step.label}>
            <div className="rfq-approval-node">{step.status === "Completed" ? <Check size={15} /> : index + 1}</div>
            <strong>{step.label}</strong>
            <span>Assignee: {step.assigned} <i /> Department: Information Technology</span>
          </div>
        ))}
      </section>

      <div className="rfq-review-columns">
        <div className="rfq-review-main-column">
          <section className="rfq-review-panel requester-panel">
            <PanelHeading icon={<Users size={15} />} title="Requester Details" />
            <div className="requester-summary-grid">
              <InfoTile icon={<UserRound size={17} />} label="Requester Name" value="Neha Sharma" tone="violet" />
              <InfoTile icon={<ClipboardList size={17} />} label="Requester Department" value="Information Technology" tone="blue" />
              <InfoTile icon={<UserRound size={17} />} label="Requester Role" value="Business User" tone="green" />
            </div>
          </section>

          <section className="rfq-review-panel basic-details-panel">
            <PanelHeading icon={<List size={15} />} title="Basic Details" />
            <div className="rfq-basic-grid">
              <InfoTile icon={<List size={16} />} label="RFQ Number" value={reference} tone="blue" />
              <InfoTile icon={<Tag size={16} />} label="RFQ Title" value={rfqTitle} tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label="Response Due Date" value="10/25/2025" tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label="Start Date" value="10/23/2025" tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label="Clarification Due Date" value="10/24/2025" tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label="Rewarded Date" value="10/26/2025" tone="blue" />
              <InfoTile icon={<FileText size={16} />} label="Total Amount" value="INR 21,516.00" tone="violet" />
              <InfoTile icon={<ShieldCheck size={16} />} label="Status" value={status} tone="red" />
            </div>
          </section>
        </div>

        <aside className="rfq-review-panel assignee-panel">
          <PanelHeading icon={<UserRound size={15} />} title="Assignee Details" />
          <div className="rfq-assignee-row">
            <div className="rfq-person-avatar">{assignee.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
            <strong>{assignee}</strong>
            <button type="button" onClick={reassign}>Reassign</button>
          </div>
          <div className="rfq-started-row">
            <div className="rfq-info-icon"><CalendarDays size={17} /></div>
            <div><strong>Started On</strong><span>{task.assignedOn}, 1:17 PM</span></div>
          </div>
        </aside>
      </div>

      <DataPanel icon={<Users size={15} />} title="Invited Suppliers" className="supplier-panel">
        <div className="rfq-table-scroll">
          <table className="rfq-review-table">
            <thead><tr><th>#</th><th></th><th>Name</th><th>Email</th><th>Phone Number</th><th>Ranking</th><th>Address</th></tr></thead>
            <tbody>
              <tr><td>1</td><td><Building2Icon /></td><td>Dell Inc.</td><td>contact@dell.com</td><td>+91 98765 43210</td><td>1</td><td>Bangalore, India</td></tr>
              <tr><td>2</td><td><Building2Icon /></td><td>TechScan Devices</td><td>info@techscan.com</td><td>+91 98765 67890</td><td>2</td><td>Delhi, India</td></tr>
            </tbody>
          </table>
        </div>
        <TablePagination label="Showing 1–2 of 2" />
      </DataPanel>

      <DataPanel icon={<List size={15} />} title="Quotation Line Items" className="quotation-panel">
        <div className="rfq-table-scroll">
          <table className="rfq-review-table quote-table">
            <thead><tr><th>#</th><th></th><th>Item Code</th><th>Item Name</th><th>Quantity</th><th>Unit Price</th><th>Total Amount</th><th>Delivery Address</th></tr></thead>
            <tbody>
              <tr><td>1</td><td><span className="rfq-product-thumb">▧</span></td><td>PDT-2025-04</td><td>Document Trays</td><td>22</td><td>INR 543.00</td><td>INR 11,946.00</td><td><MapPin size={13} /> Door No. 12/1...</td></tr>
              <tr><td>2</td><td><span className="rfq-product-thumb dark">▰</span></td><td>PDT-2025-05</td><td>Laser Printer</td><td>22</td><td>INR 435.00</td><td>INR 9,570.00</td><td><MapPin size={13} /> Opp. SBI Ban...</td></tr>
            </tbody>
          </table>
        </div>
        <TablePagination label="Showing 1–2 of 2" />
      </DataPanel>

      <DataPanel icon={<Paperclip size={15} />} title="Attachments" className="attachment-panel">
        <div className="rfq-table-scroll">
          <table className="rfq-review-table">
            <thead><tr><th>#</th><th>Documents</th><th>Description</th><th>Uploaded By</th><th>Uploaded On</th><th>Actions</th></tr></thead>
            <tbody><tr><td>1</td><td><span className="rfq-file-icon">PNG</span><a href="/process.png" onClick={(event) => { event.preventDefault(); setNotice("Attachment preview is not available in this sample."); }}>process.png</a></td><td>—</td><td>Neha Sharma</td><td>10/6/2025</td><td><button type="button" className="rfq-icon-action" aria-label="Preview attachment" onClick={() => setNotice("Attachment preview is not available in this sample.")}><Eye size={14} /></button></td></tr></tbody>
          </table>
        </div>
        <TablePagination label="Showing 1–1 of 1" />
      </DataPanel>

      <DataPanel icon={<ClipboardList size={15} />} title="Comments" className="comments-panel">
        {comments.map((comment, index) => <p className="rfq-comment" key={`${comment}-${index}`}>{comment}</p>)}
        {notice && <p className="rfq-task-notice" role="status">{notice}</p>}
        <form className="rfq-comment-form" onSubmit={(event) => { event.preventDefault(); addComment(); }}>
          <input aria-label="Leave a comment" placeholder="Leave a comment..." value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
          <button type="submit" aria-label="Send comment"><Send size={16} /></button>
        </form>
      </DataPanel>

      <footer className="rfq-decision-bar">
        <button type="button" className="rfq-close-action" onClick={onBack}>Close</button>
        <div className="rfq-decision-actions">
          <button type="button" className="rfq-reject-action" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="rfq-changes-action" onClick={() => updateStatus("Changes Needed")}>Changes needed</button>
          <button type="button" className="rfq-approve-action" onClick={() => updateStatus("Approved")}>Approve</button>
        </div>
      </footer>
    </section>
  );
}

function OtherApprovalTask({ task, onBack }: { task: Task; onBack: () => void }) {
  const isInvoice = task.taskType === "Invoice";
  const isPurchaseOrder = task.taskType === "Purchase Order";
  const [status, setStatus] = useState("In Review");
  const [assignee, setAssignee] = useState(task.assignedTo);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const reference = task.taskName.match(/(?:INV|PR|PO)-\d{4}-\d{3}/)?.[0]
    ?? (isInvoice ? `INV-2026-0${31 - task.id}` : isPurchaseOrder ? "PO-2026-032" : `PR-2026-0${90 - task.id}`);
  const requestTitle = task.id === 3 ? "IT Equipment package"
    : isPurchaseOrder ? "Logitech IT equipment"
      : task.id === 7 ? "First Aid Kit"
        : isInvoice ? "IT equipment invoice" : "Purchase request";
  const requester = task.id === 3 ? "Raj Mehta"
    : task.id === 4 ? "Ayesha Khan"
      : task.id === 7 ? "Neha Sharma"
        : task.id === 1 ? "Aman Jain" : "Rhea Nair";
  const amount = task.id === 3 ? "USD 15,610.00"
    : isPurchaseOrder ? "USD 17,171.00"
      : task.id === 7 ? "USD 1,200.00"
        : task.id === 1 ? "USD 3,480.00" : "USD 2,175.00";
  const stageNames = isInvoice
    ? ["Invoice Submitted", "Business Owner Review", "Finance Approval"]
    : isPurchaseOrder
      ? ["PO Created", "Manager Review", "Final Approval"]
      : ["Request Submitted", "Manager Approval", "Procurement Review"];
  const relatedRows = isPurchaseOrder
    ? [
      { name: "Logitech IT equipment", description: "Approved RFQ-2026-052 award", quantity: "1", unitPrice: amount, total: amount },
      { name: "Delivery and handling", description: "Supplier delivery charge", quantity: "1", unitPrice: "USD 171.00", total: "USD 171.00" },
    ]
    : isInvoice
    ? [
      { name: "Equipment and supplies", description: "Invoice line items", quantity: "1", unitPrice: amount, total: amount },
      { name: "Freight and handling", description: "Delivery charge", quantity: "1", unitPrice: "USD 45.00", total: "USD 45.00" },
    ]
    : [{ name: requestTitle, description: task.description ?? "Requested item", quantity: task.id === 7 ? "12" : "1", unitPrice: amount, total: amount }];

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setNotice(`${reference} marked ${nextStatus.toLowerCase()}.`);
  };

  const addComment = () => {
    const comment = commentDraft.trim();
    if (!comment) return;
    setComments((existing) => [...existing, comment]);
    setCommentDraft("");
  };

  const reassign = () => {
    setAssignee((current) => current === "Aman Jain" ? "Sakshi Paliwal" : "Aman Jain");
    setNotice("Task reassigned.");
  };

  return (
    <section className="task-detail-page rfq-review-page">
      <header className="rfq-review-heading">
        <button type="button" className="task-detail-back rfq-review-back" onClick={onBack} aria-label="Back to Task Inbox"><ArrowLeft size={17} /></button>
        <div className="rfq-review-title-group">
          <h1>{isInvoice ? "INVOICE APPROVAL" : isPurchaseOrder ? "PURCHASE ORDER APPROVAL" : "PURCHASE REQUEST APPROVAL"} FOR {reference} | {requestTitle.toUpperCase()}</h1>
          <span className={`rfq-review-status ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
        </div>
      </header>

      <section className="rfq-approval-track" aria-label="Approval progress">
        {stageNames.map((label, index) => {
          const stageStatus = index === 0 ? "Completed" : index === 1 && (status === "In Review" || status === "Changes Needed") ? "Current" : "Pending";
          const assigned = index === 0 ? requester : index === 1 ? assignee : "Finance Manager";
          return (
            <div className={`rfq-approval-step ${stageStatus.toLowerCase()}`} key={label}>
              <div className="rfq-approval-node">{stageStatus === "Completed" ? <Check size={15} /> : index + 1}</div>
              <strong>{label}</strong>
              <span>Assignee: {assigned}<i />Department: Information Technology</span>
            </div>
          );
        })}
      </section>

      <div className="rfq-review-columns">
        <div className="rfq-review-main-column">
          <section className="rfq-review-panel requester-panel">
            <PanelHeading icon={<Users size={15} />} title="Requester Details" />
            <div className="requester-summary-grid">
              <InfoTile icon={<UserRound size={17} />} label="Requester Name" value={requester} tone="violet" />
              <InfoTile icon={<ClipboardList size={17} />} label="Department" value="Information Technology" tone="blue" />
              <InfoTile icon={<UserRound size={17} />} label="Requester Role" value="Business User" tone="green" />
            </div>
          </section>

          <section className="rfq-review-panel basic-details-panel">
            <PanelHeading icon={<List size={15} />} title={isInvoice ? "Invoice Details" : isPurchaseOrder ? "Purchase Order Details" : "Purchase Request Details"} />
            <div className="rfq-basic-grid">
              <InfoTile icon={<List size={16} />} label={isInvoice ? "Invoice Number" : isPurchaseOrder ? "PO Number" : "PR Number"} value={reference} tone="blue" />
              <InfoTile icon={<Tag size={16} />} label={isInvoice || isPurchaseOrder ? "Supplier" : "Request Title"} value={isInvoice ? "Dell Inc." : isPurchaseOrder ? "Logitech" : requestTitle} tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label={isInvoice ? "Invoice Date" : isPurchaseOrder ? "PO Date" : "Request Date"} value={task.assignedOn} tone="blue" />
              <InfoTile icon={<CalendarDays size={16} />} label={isInvoice ? "Payment Due" : isPurchaseOrder ? "Expected Delivery" : "Required Date"} value={isInvoice ? "4/15/2026" : isPurchaseOrder ? "4/30/2026" : "4/30/2026"} tone="blue" />
              <InfoTile icon={<ClipboardList size={16} />} label={isInvoice ? "Purchase Order" : isPurchaseOrder ? "Associated PR" : "Category"} value={isInvoice ? "PO-2026-032" : isPurchaseOrder ? "PR-2026-088" : task.id === 7 ? "Workplace Safety" : "IT Hardware"} tone="blue" />
              <InfoTile icon={<Flag size={16} />} label="Priority" value={task.priority ?? "Normal"} tone="violet" />
              <InfoTile icon={<FileText size={16} />} label="Total Amount" value={amount} tone="violet" />
              <InfoTile icon={<ShieldCheck size={16} />} label="Status" value={status} tone="red" />
            </div>
          </section>
        </div>

        <aside className="rfq-review-panel assignee-panel">
          <PanelHeading icon={<UserRound size={15} />} title="Assignee Details" />
          <div className="rfq-assignee-row">
            <div className="rfq-person-avatar">{assignee.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
            <strong>{assignee}</strong>
            <button type="button" onClick={reassign}>Reassign</button>
          </div>
          <div className="rfq-started-row">
            <div className="rfq-info-icon"><CalendarDays size={17} /></div>
            <div><strong>Assigned On</strong><span>{task.assignedOn}</span></div>
          </div>
        </aside>
      </div>

      <DataPanel icon={<List size={15} />} title={isInvoice ? "Invoice Line Items" : isPurchaseOrder ? "Purchase Order Items" : "Requested Items"} className="quotation-panel">
        <div className="rfq-table-scroll">
          <table className="rfq-review-table quote-table">
            <thead><tr><th>#</th><th>Item</th><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Total Amount</th></tr></thead>
            <tbody>{relatedRows.map((row, index) => <tr key={row.name}><td>{index + 1}</td><td>{row.name}</td><td>{row.description}</td><td>{row.quantity}</td><td>{row.unitPrice}</td><td>{row.total}</td></tr>)}</tbody>
          </table>
        </div>
        <TablePagination label={`Showing 1–${relatedRows.length} of ${relatedRows.length}`} />
      </DataPanel>

      <DataPanel icon={<Paperclip size={15} />} title="Attachments" className="attachment-panel">
        <div className="rfq-table-scroll">
          <table className="rfq-review-table">
            <thead><tr><th>#</th><th>Document</th><th>Description</th><th>Uploaded By</th><th>Uploaded On</th><th>Actions</th></tr></thead>
            <tbody><tr><td>1</td><td><span className="rfq-file-icon">PDF</span><a href="#attachment" onClick={(event) => { event.preventDefault(); setNotice("Attachment preview is not available in this sample."); }}>{reference.toLowerCase()}_supporting-document.pdf</a></td><td>Supporting documentation</td><td>{requester}</td><td>{task.assignedOn}</td><td><button type="button" className="rfq-icon-action" aria-label="Preview attachment" onClick={() => setNotice("Attachment preview is not available in this sample.")}><Eye size={14} /></button></td></tr></tbody>
          </table>
        </div>
        <TablePagination label="Showing 1–1 of 1" />
      </DataPanel>

      <DataPanel icon={<ClipboardList size={15} />} title="Comments" className="comments-panel">
        {comments.map((comment, index) => <p className="rfq-comment" key={`${comment}-${index}`}>{comment}</p>)}
        {notice && <p className="rfq-task-notice" role="status">{notice}</p>}
        <form className="rfq-comment-form" onSubmit={(event) => { event.preventDefault(); addComment(); }}>
          <input aria-label="Leave a comment" placeholder="Leave a comment..." value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
          <button type="submit" aria-label="Send comment"><Send size={16} /></button>
        </form>
      </DataPanel>

      <footer className="rfq-decision-bar">
        <button type="button" className="rfq-close-action" onClick={onBack}>Close</button>
        <div className="rfq-decision-actions">
          <button type="button" className="rfq-reject-action" onClick={() => updateStatus("Rejected")}>Reject</button>
          <button type="button" className="rfq-changes-action" onClick={() => updateStatus("Changes Needed")}>Changes needed</button>
          <button type="button" className="rfq-approve-action" onClick={() => updateStatus("Approved")}>Approve</button>
        </div>
      </footer>
    </section>
  );
}

function PanelHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="rfq-review-panel-heading"><span>{icon}</span><h2>{title}</h2></div>;
}

function InfoTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <div className={`rfq-info-tile ${tone}`}><span className="rfq-info-tile-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function DataPanel({ icon, title, className, children }: { icon: React.ReactNode; title: string; className: string; children: React.ReactNode }) {
  return <section className={`rfq-review-panel rfq-data-panel ${className}`}><PanelHeading icon={icon} title={title} />{children}</section>;
}

function TablePagination({ label }: { label: string }) {
  return <div className="rfq-table-pagination"><span>{label}</span><button type="button" disabled aria-label="Previous page">‹</button><button type="button" className="current" aria-current="page">1</button><button type="button" disabled aria-label="Next page">›</button></div>;
}

function Building2Icon() {
  return <span className="rfq-building-icon">▦</span>;
}