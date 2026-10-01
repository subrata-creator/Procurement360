import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileText, ReceiptText, ScrollText } from "lucide-react";
import { taskInboxItems } from "../data/tasks";

const PAGE_SIZE = 4;
type Tab = "Needs Action" | "Approvals" | "Contracts" | "Invoices" | "Completed";

const tabs: Tab[] = ["Needs Action", "Approvals", "Contracts", "Invoices", "Completed"];

const badge = (t: string) =>
  t === "Invoice" ? "inv" : t === "Purchase Request" ? "pr" : t === "Purchase Order" ? "po" : "rfq";

const TaskInbox: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Needs Action");
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () => taskInboxItems.filter((task) => {
      if (tab === "Completed" || tab === "Contracts") return false;
      if (tab === "Invoices") return task.taskType === "Invoice";
      if (tab === "Approvals") return task.taskType !== "Invoice";
      return true;
    }),
    [tab],
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = rows.length ? (page - 1) * PAGE_SIZE : 0;
  const shown = rows.slice(start, start + PAGE_SIZE);
  const countForTab = (target: Tab) => taskInboxItems.filter((task) => {
    if (target === "Completed" || target === "Contracts") return false;
    if (target === "Invoices") return task.taskType === "Invoice";
    if (target === "Approvals") return task.taskType !== "Invoice";
    return true;
  }).length;
  const taskIcon = (taskType: string) => taskType === "Invoice"
    ? <ReceiptText size={14} />
    : taskType === "Purchase Order"
      ? <ClipboardCheck size={14} />
      : taskType === "Request for Quotation"
        ? <ScrollText size={14} />
        : <FileText size={14} />;

  return (
    <section className="xt work-queue">
      <header className="work-queue-heading">
        <div>
          <span className="cc-eyebrow">WORK QUEUE</span>
          <h2>My Procurement Tasks</h2>
        </div>
        <span className="work-queue-total">{taskInboxItems.length} open</span>
      </header>

      <nav className="work-queue-tabs" aria-label="Task categories">
        {tabs.map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            aria-pressed={tab === item}
            onClick={() => { setTab(item); setPage(1); }}
          >
            {item}<span>{countForTab(item)}</span>
          </button>
        ))}
      </nav>

      <div className="work-queue-list">
        {shown.length ? shown.map((task) => (
          <article className="work-queue-row" key={task.id}>
            <span className={`work-queue-task-icon ${badge(task.taskType)}`}>{taskIcon(task.taskType)}</span>
            <div className="work-queue-task-copy">
              <button type="button" className="work-queue-task-link" title={task.taskName} onClick={() => navigate(`/tasks/${task.id}`)}>{task.taskName}</button>
              <div className="work-queue-task-meta">
                <span>{task.taskType}</span>
                <span><CalendarDays size={11} /> Assigned {task.assignedOn}</span>
              </div>
            </div>
            <span className={`work-queue-priority ${task.priority?.toLowerCase() ?? "normal"}`}>{task.priority ?? "Normal"}</span>
            <button className="work-queue-review" type="button" onClick={() => navigate(`/tasks/${task.id}`)}>Review <ArrowUpRight size={12} /></button>
          </article>
        )) : (
          <div className="work-queue-empty">
            <span>{tab === "Completed" ? "Completed task history is not available in this sample." : tab === "Contracts" ? "No contract signatory tasks are currently listed." : "No tasks in this view."}</span>
          </div>
        )}
      </div>

      <footer className="xt-foot work-queue-footer">
        <span>Assigned date shown; due dates are not available.</span>
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /></button>
        <span>{rows.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}</span>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}><ChevronRight size={14} /></button>
      </footer>
    </section>
  );
};

export default TaskInbox;