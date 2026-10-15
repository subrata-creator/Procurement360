import { useState, type FormEvent } from "react";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  Clock,
  Coins,
  FileText,
  Flag,
  Hash,
  PackageCheck,
  Paperclip,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  X,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import {
  buildApprovalSteps,
  buildDefaultSubTasks,
  buildDefaultLineItems,
  buildMilestoneSubTasks,
  getInitials,
  getPurchaseRequestByRef,
  type ApprovalStep,
} from "./Purchaserequestsdata";
import { rfqs } from "../data/rfqs";

import "../Styles/PRSummary.css";

const TABS = ["Summary", "RFQs", "Associated Tasks", "Notes", "Attachments"];

// Milestones hidden from both the PR Journey timeline and the Approval
// History sidebar, per request: "Review & Approval" and "Approved" are
// dropped everywhere the journey's milestone list is shown.
const HIDDEN_MILESTONES = ["Review & Approval", "Approved"];

type RequestNote = {
  id: string;
  title: string;
  type: "Public" | "Private";
  description: string;
  attachmentName: string;
  taggedUsers: string[];
  author: string;
  createdAt: string;
};

function notesStorageKey(ref?: string): string {
  return `procurement360.notes.${ref ?? "unknown"}`;
}

function readRequestNotes(ref?: string): RequestNote[] {
  if (typeof window === "undefined" || !ref) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(notesStorageKey(ref)) || "[]");
    return Array.isArray(parsed) ? parsed.filter((note): note is RequestNote =>
      typeof note?.id === "string" &&
      typeof note?.title === "string" &&
      (note?.type === "Public" || note?.type === "Private") &&
      typeof note?.description === "string" &&
      Array.isArray(note?.taggedUsers) &&
      typeof note?.author === "string" &&
      typeof note?.createdAt === "string"
    ) : [];
  } catch {
    return [];
  }
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function createNoteId(): string {
  return `${Date.now()}`;
}

function statusPillClass(status: string) {
  if (status === "Approved") return "approved";
  if (status === "Rejected") return "rejected";
  return "review";
}

function subtaskStatusClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "In Progress") return "in-progress";
  return "pending";
}

function stepCircleClass(status: string) {
  if (status === "Completed") return "completed";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "";
}

function milestoneIconClass(status: string) {
  if (status === "Completed") return "green";
  if (status === "Current") return "current";
  if (status === "Rejected") return "rejected";
  return "pending";
}

export default function PurchaseRequestDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Summary");
  const [noteCollection, setNoteCollection] = useState(() => ({ ref, notes: readRequestNotes(ref) }));
  const notes = noteCollection.ref === ref ? noteCollection.notes : readRequestNotes(ref);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteType, setNoteType] = useState<RequestNote["type"]>("Public");
  const [noteDescription, setNoteDescription] = useState("");
  const [noteTaggedUsers, setNoteTaggedUsers] = useState("");
  const [noteAttachment, setNoteAttachment] = useState<File | null>(null);
  const [subTasksOpen, setSubTasksOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<ApprovalStep | null>(null);

  const record = ref ? getPurchaseRequestByRef(ref) : undefined;

  if (!record) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Purchase Request not found.</p>
          <button type="button" onClick={() => navigate("/purchase-requests")}>Back to Purchase Requests</button>
        </div>
      </div>
    );
  }

  const approvalSteps = buildApprovalSteps(record);
  // PR Journey timeline: drop the Review & Approval and Approved stages,
  // renumbering what's left so the circles read 1..n with no gaps.
  const visibleApprovalSteps = approvalSteps.filter(
    (step) => !HIDDEN_MILESTONES.some((hidden) => step.title.startsWith(hidden))
  );
  // Approval History (sidebar): previously filtered independently by a
  // hardcoded title regex that only ever matched PR Creation / Review &
  // Approval / Approved / Rejected, so it never reflected RFQ Initiated,
  // PO Created, Invoice Created or Closed even once those stages were
  // completed — this is the bug reported ("timeline shows RFQ/PO completed
  // but Approval History still shows the old PR Creation/Review/Approved
  // flow"). Fixed by sourcing it from the same visibleApprovalSteps list the
  // timeline uses, so both stay in sync and the hidden milestones are
  // dropped here too.
  const historyEvents = visibleApprovalSteps.filter(
    (step) => step.status === "Completed" || step.status === "Current" || step.status === "Rejected"
  );
  const subTasks = selectedMilestone ? buildMilestoneSubTasks(record, selectedMilestone) : [];
  const lineItems = buildDefaultLineItems(record);
  const associatedRfqs = record.rfq.startsWith("RFQ-")
    ? rfqs.filter((rfq) => rfq.refNo === record.rfq)
    : [];
  // Associated Tasks: only the PR Creation stage's tasks that are still
  // In Progress or Pending (not the completed ones).
  const prCreationActiveTasks = buildDefaultSubTasks(record).filter(
    (task) => task.status === "In Progress" || task.status === "Pending"
  );
  const summaryItems = record.lineItems?.map((item) => `${item.quantity} × ${item.itemName}`).join(", ");
  const associationSummary = [
    `RFQ ${record.rfq.startsWith("RFQ-") ? record.rfq : "not linked"}`,
    `PO ${record.po.startsWith("PO-") ? record.po : "not linked"}`,
  ].join(" · ");
  const aiSummary = [
    summaryItems ? `This request covers ${summaryItems}.` : record.title,
    `${record.department ? `${record.department} department. ` : ""}${record.category ? `${record.category} category. ` : ""}${record.totalAmount ? `Recorded amount is ${record.totalAmount}. ` : "Amount is not recorded. "}${record.status === "In Review" ? "It is awaiting review." : `Current status is ${record.status.toLowerCase()}.`}`,
    `${associationSummary}.`,
  ].join(" ");

  const subTasksCompleted = subTasks.length > 0 && subTasks.every((task) => task.status === "Completed");

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note: RequestNote = {
      id: createNoteId(),
      title: noteTitle.trim(),
      type: noteType,
      description: noteDescription.trim(),
      attachmentName: noteAttachment?.name ?? "",
      taggedUsers: [...new Set(noteTaggedUsers.split(",").map((user) => user.trim()).filter(Boolean))],
      author: record.requester || record.createdBy,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [note, ...notes];
    setNoteCollection({ ref: record.ref, notes: updatedNotes });
    try {
      window.localStorage.setItem(notesStorageKey(record.ref), JSON.stringify(updatedNotes));
    } catch {
      // Keep the new note available for this session if browser storage is unavailable.
    }
    setNoteTitle("");
    setNoteType("Public");
    setNoteDescription("");
    setNoteTaggedUsers("");
    setNoteAttachment(null);
    setIsNoteFormOpen(false);
  };

  const removeNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    setNoteCollection({ ref: record.ref, notes: updatedNotes });
    try {
      window.localStorage.setItem(notesStorageKey(record.ref), JSON.stringify(updatedNotes));
    } catch {
      // Note stays removed for this session even if browser storage is unavailable.
    }
  };

  const toggleMilestone = (step: ApprovalStep) => {
    if (subTasksOpen && selectedMilestone?.step === step.step) {
      setSubTasksOpen(false);
      setSelectedMilestone(null);
      return;
    }

    setSelectedMilestone(step);
    setSubTasksOpen(true);
  };

  return (
    <div className="pr-detail-page">
      <div className="pr-detail-heading">
        <div className="pr-detail-heading-left">
          <button type="button" className="pr-detail-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />
          </button>

          <div>
            <div className="pr-detail-title-row">
              <h1>{record.ref}</h1>
              <span className={`pr-detail-status-pill ${statusPillClass(record.status)}`}>{record.status}</span>
            </div>
            <p className="pr-detail-subtitle">{record.title}</p>
          </div>
        </div>

        <div className="pr-detail-actions">

          <button type="button" className="pr-detail-primary-btn">
            <FileText size={11} />
            Initiate RFQ
          </button>
        </div>
      </div>

      <section className="pr-detail-card pr-journey-card">
        <div className="pr-detail-card-header">
          <div className="pr-detail-card-header-left">
            <div className="pr-detail-card-icon">
              <Clock size={12} />
            </div>
            <div className="pr-detail-card-title">
              <h2>PR Journey</h2>
              <p>Track progress from PR creation through closure</p>
            </div>
          </div>
        </div>

        <div className="approval-timeline">
          {visibleApprovalSteps.map((step, index) => (
            <button
              className={`approval-step ${selectedMilestone?.step === step.step ? "selected" : ""}`}
              key={step.step}
              type="button"
              aria-label={`${step.title}, ${step.status}. View milestone tasks`}
              aria-pressed={selectedMilestone?.step === step.step}
              aria-expanded={subTasksOpen && selectedMilestone?.step === step.step}
              onClick={() => toggleMilestone(step)}
            >
              <div className={`approval-step-line ${step.status === "Completed" ? "done" : ""}`} />
              <div className={`approval-step-circle ${stepCircleClass(step.status)}`}>{index + 1}</div>

              <div className="approval-step-label">
                <strong>{step.title}</strong>
                <span className={`approval-step-status ${step.status.toLowerCase().replace(" ", "-")}`}>
                  {step.status === "Skipped" ? "Not Applicable" : step.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedMilestone && (
        <>
          <section className="pr-detail-card">
            <div className="pr-detail-card-header">
              <div className="pr-detail-card-header-left">
                <div className={`pr-detail-card-icon ${milestoneIconClass(selectedMilestone.status)}`}>
                  <ShieldCheck size={12} />
                </div>
                <div className="pr-detail-card-title">
                  <h2>{selectedMilestone.title} - Sub Tasks</h2>
                  <p>{selectedMilestone.date ? `Milestone activity on ${selectedMilestone.date}` : `Milestone status: ${selectedMilestone.status}`}{selectedMilestone.by ? ` · ${selectedMilestone.by}` : ""}</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                {subTasksCompleted && (
                  <span className="pr-detail-status-tag">
                    <ShieldCheck size={9} />
                    Completed
                  </span>
                )}

                <button
                  type="button"
                  className="pr-detail-collapse-btn"
                  onClick={() => setSubTasksOpen((open) => !open)}
                  style={{ transform: subTasksOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                >
                  <ChevronUp size={12} />
                </button>
              </div>
            </div>

            {subTasksOpen && (
              <div className="pr-detail-table-wrapper">
                <table className="pr-detail-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Remarks</th>
                      <th>Completed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subTasks.map((task, index) => (
                      <tr key={task.id}>
                        <td>{index + 1}</td>
                        <td>{task.task}</td>
                        <td>
                          <span className={`subtask-status ${subtaskStatusClass(task.status)}`}>{task.status}</span>
                        </td>
                        <td>
                          <div className="pr-detail-table-avatar">
                            <span>{getInitials(task.assignedTo)}</span>
                            {task.assignedTo}
                          </div>
                        </td>
                        <td>{task.remarks}</td>
                        <td>{task.completedOn || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="pr-detail-card">
        <div className="pr-detail-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "RFQs" && (
          <div className="pr-rfq-section">
            <div className="pr-rfq-card-header">
              <div>
                <div className="pr-rfq-title-row">
                  <span className="pr-rfq-icon">✦</span>
                  <h3>Request For Quotations ({associatedRfqs.length})</h3>
                </div>
                <p>RFQ records linked to this purchase request</p>
              </div>
            </div>

            {associatedRfqs.length ? (
              <div className="pr-rfq-table-wrap">
                <table className="pr-rfq-table">
                  <thead>
                    <tr>
                      <th>Ref No</th>
                      <th>Title</th>
                      <th>Associated PR</th>
                      <th>Associated PO</th>
                      <th>Responses</th>
                      <th>Supplier</th>
                      <th>Created By</th>
                      <th>Created Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associatedRfqs.map((rfq) => (
                      <tr key={rfq.refNo}>
                        <td className="pr-rfq-ref">{rfq.refNo}</td>
                        <td>{rfq.title}</td>
                        <td>{rfq.pr.startsWith("PR-") ? rfq.pr : "—"}</td>
                        <td>{rfq.po.startsWith("PO-") ? rfq.po : "—"}</td>
                        <td>{rfq.responses}</td>
                        <td>{rfq.supplier === "N/A" ? "—" : rfq.supplier}</td>
                        <td>{rfq.createdBy}</td>
                        <td>{rfq.createdDate}</td>
                        <td><span className={`pr-rfq-status ${rfq.status.toLowerCase()}`}>{rfq.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-rfq-empty">
                <FileText size={19} />
                <strong>{record.rfq.startsWith("RFQ-") ? "RFQ details unavailable" : "No RFQ linked"}</strong>
                <span>{record.rfq.startsWith("RFQ-") ? `${record.rfq} is referenced, but no matching RFQ record exists.` : "This purchase request does not have an associated RFQ."}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === "Associated Tasks" && (
          <div className="pr-associated-tasks">
            <div className="pr-associated-tasks-heading">
              <div>
                <h3>PR Creation — Pending Tasks</h3>
                <p>Tasks still in progress or pending for the PR Creation stage</p>
              </div>
              <span>{prCreationActiveTasks.length} pending</span>
            </div>
            {prCreationActiveTasks.length ? (
              <div className="pr-detail-table-wrapper">
                <table className="pr-detail-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th>Completed On</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prCreationActiveTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.task}</td>
                        <td><span className={`subtask-status ${subtaskStatusClass(task.status)}`}>{task.status}</span></td>
                        <td>
                          <div className="pr-detail-table-avatar">
                            <span>{getInitials(task.assignedTo)}</span>
                            {task.assignedTo}
                          </div>
                        </td>
                        <td>{task.completedOn || "—"}</td>
                        <td>{task.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-associated-tasks-empty">No in-progress or pending tasks recorded for the PR Creation stage.</div>
            )}
          </div>
        )}

        {activeTab === "Notes" && (
          <div className="pr-notes-section">
            <div className="pr-notes-heading">
              <div>
                <h3>Notes</h3>
                <p>Notes and updates for {record.ref}</p>
              </div>
              <button type="button" className="pr-note-create-btn" onClick={() => setIsNoteFormOpen(true)}>
                <Plus size={14} />New note
              </button>
            </div>

            {notes.length ? (
              <div className="pr-note-list">
                {notes.map((note) => (
                  <article className="pr-note-card" key={note.id}>
                    <div className="pr-note-card-top">
                      <span className="pr-note-author-avatar">{getInitials(note.author)}</span>
                      <div className="pr-note-author">
                        <strong>{note.author}</strong>
                        <time dateTime={note.createdAt}>{formatNoteDate(note.createdAt)}</time>
                      </div>
                      <span className={`pr-note-visibility ${note.type.toLowerCase()}`}>{note.type}</span>
                      <button
                        type="button"
                        className="pr-note-remove-btn"
                        aria-label={`Remove note: ${note.title}`}
                        onClick={() => removeNote(note.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <h4>{note.title}</h4>
                    {note.description && <p>{note.description}</p>}
                    {note.attachmentName && <span className="pr-note-attachment"><Paperclip size={12} />{note.attachmentName}</span>}
                    {note.taggedUsers.length > 0 && (
                      <div className="pr-note-tags">
                        <span>Tagged</span>
                        {note.taggedUsers.map((user) => <span className="pr-note-tag" key={user}>{user}</span>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="pr-notes-empty">
                <ClipboardList size={20} />
                <strong>No notes yet</strong>
                <span>Add a note to keep request context with this PR.</span>
              </div>
            )}

            {isNoteFormOpen && (
              <div className="pr-note-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsNoteFormOpen(false); }}>
                <section className="pr-note-modal" role="dialog" aria-modal="true" aria-labelledby="pr-note-modal-title">
                  <header className="pr-note-modal-header">
                    <h2 id="pr-note-modal-title">New note</h2>
                    <button type="button" onClick={() => setIsNoteFormOpen(false)} aria-label="Close new note form"><X size={16} /></button>
                  </header>
                  <form onSubmit={saveNote}>
                    <label className="pr-note-field">
                      <span>Title <b>*</b></span>
                      <input autoFocus required maxLength={120} value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Type <b>*</b></span>
                      <select value={noteType} onChange={(event) => setNoteType(event.target.value as RequestNote["type"])}>
                        <option value="Public">Public</option>
                        <option value="Private">Private</option>
                      </select>
                    </label>
                    <label className="pr-note-field">
                      <span>Attachment</span>
                      <input type="file" onChange={(event) => setNoteAttachment(event.target.files?.[0] ?? null)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Description <b>*</b></span>
                      <textarea required rows={4} maxLength={2000} value={noteDescription} onChange={(event) => setNoteDescription(event.target.value)} />
                    </label>
                    <label className="pr-note-field">
                      <span>Tag users</span>
                      <input placeholder="Enter names separated by commas" value={noteTaggedUsers} onChange={(event) => setNoteTaggedUsers(event.target.value)} />
                    </label>
                    <footer className="pr-note-modal-actions">
                      <button type="button" className="secondary" onClick={() => setIsNoteFormOpen(false)}>Cancel</button>
                      <button type="submit" className="primary">Save note</button>
                    </footer>
                  </form>
                </section>
              </div>
            )}
          </div>
        )}

        {activeTab === "Attachments" && (
          <div className="pr-detail-tab-empty">No {activeTab.toLowerCase()} linked to this purchase request yet.</div>
        )}

        {activeTab === "Summary" && (
          <>
            <section className="pr-summary-kpis" aria-label="Purchase request summary metrics">
              <article className="pr-summary-kpi amount">
                <span className="pr-summary-kpi-icon"><Coins size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Request Amount</small><strong>{record.totalAmount || "Not recorded"}</strong></span>
              </article>
              <article className={`pr-summary-kpi ${statusPillClass(record.status)}`}>
                <span className="pr-summary-kpi-icon"><ShieldCheck size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Current Status</small><strong>{record.status}</strong></span>
              </article>
              <article className="pr-summary-kpi priority">
                <span className="pr-summary-kpi-icon"><Flag size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Priority</small><strong>{record.priority || "Not set"}</strong></span>
              </article>
              <article className="pr-summary-kpi due-date">
                <span className="pr-summary-kpi-icon"><CalendarDays size={15} /></span>
                <span className="pr-summary-kpi-copy"><small>Required By</small><strong>{record.requiredDate || "Not set"}</strong></span>
              </article>
            </section>

            <div className="pr-summary-layout">
              <div className="pr-summary-main-column">
            <section className="pr-ai-summary" aria-labelledby="pr-ai-summary-title">
              <div className="pr-ai-summary-heading">
                <span><Sparkles size={14} /></span>
                <h2 id="pr-ai-summary-title">AI Summary</h2>
                <small>Record-backed</small>
              </div>
              <p>{aiSummary}</p>
              <span className="pr-ai-summary-note">Generated from the fields and procurement links recorded on this request.</span>
            </section>

            <div className="pr-summary-top">
              <div className="pr-summary-title">
                <ClipboardList size={13} />
                Purchase Request Details
              </div>
            </div>

            <div className="pr-detail-grid">
              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><FileText size={11} /></div>
                <div>
                  <span>PR Number</span>
                  <strong>{record.ref}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><User size={11} /></div>
                <div>
                  <span>Requester</span>
                  <strong>{record.requester || record.createdBy}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Tag size={11} /></div>
                <div>
                  <span>Title</span>
                  <strong>{record.title}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Building2 size={11} /></div>
                <div>
                  <span>Department</span>
                  <strong>{record.department || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                <div>
                  <span>Request Date</span>
                  <strong>{record.date}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
                <div>
                  <span>Required Date</span>
                  <strong>{record.requiredDate || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><PackageCheck size={11} /></div>
                <div>
                  <span>Category</span>
                  <strong>{record.category || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Flag size={11} /></div>
                <div>
                  <span>Priority</span>
                  <strong>{record.priority || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><Hash size={11} /></div>
                <div>
                  <span>Cost Center</span>
                  <strong>{record.costCenter || "—"}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><ClipboardList size={11} /></div>
                <div>
                  <span>Associated RFQ</span>
                  <strong>{record.rfq}</strong>
                </div>
              </div>

              <div className="pr-detail-field">
                <div className="pr-detail-field-icon"><FileText size={11} /></div>
                <div>
                  <span>Associated PO</span>
                  <strong>{record.po}</strong>
                </div>
              </div>
            </div>

            <div className="pr-detail-justification">
              <span>Business Justification</span>
              <p>{record.justification || "No business justification provided."}</p>
              <small>Delivery location: {record.deliveryAddress || "—"}</small>
            </div>

            <div className="pr-detail-lineitems-heading">
              <Coins size={11} />
              Purchase Request Line Items ({lineItems.length})
            </div>

            <div className="pr-detail-table-wrapper">
              <table className="pr-detail-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Previous Contract</th>
                    <th>Unit Price</th>
                    <th>Total Amount</th>
                    <th>Delivery Date</th>
                    <th>Delivery Address</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.itemCode}</td>
                      <td>{item.itemName}</td>
                      <td>{item.quantity}</td>
                      <td>{item.previousContract}</td>
                      <td>{item.unitPrice}</td>
                      <td>{item.totalAmount}</td>
                      <td>{item.deliveryDate}</td>
                      <td>{item.deliveryAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </div>

              <aside className="pr-summary-approval-card">
                <div className="pr-summary-approval-heading">
                  <Clock size={17} />
                  <h2>Approval History</h2>
                </div>
                <div className="pr-summary-approval-list">
                  {historyEvents.length > 0 ? historyEvents.map((step, index) => {
                    const [actor, role] = (step.by ?? "").split("|").map((part) => part.trim());
                    return (
                    <button
                      type="button"
                      className={`pr-summary-approval-step ${step.status.toLowerCase()} ${selectedMilestone?.step === step.step ? "selected" : ""}`}
                      key={step.step}
                      aria-label={`${step.title}, ${step.status}. View milestone tasks`}
                      aria-expanded={subTasksOpen && selectedMilestone?.step === step.step}
                      onClick={() => toggleMilestone(step)}
                    >
                      <span className="pr-summary-approval-rail">
                        <span className="pr-summary-approval-node">{step.status === "Completed" ? "✓" : index + 1}</span>
                      </span>
                      <span className="pr-summary-approval-copy">
                        <strong>{step.title}</strong>
                          <span className={`pr-summary-approval-badge ${step.status.toLowerCase()}`}>
                            {step.status === "Current" ? "In progress" : step.status}
                          </span>
                        {actor && <span><b>{actor}</b>{role && <>: <em>{role}</em></>}</span>}
                        {step.department && <span>{step.department}</span>}
                        {step.date && <small>{step.date}</small>}
                      </span>
                    </button>
                    );
                  }) : <p className="pr-summary-approval-empty">No approval actions recorded yet.</p>}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}