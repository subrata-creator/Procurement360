import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { taskInboxItems } from "../data/tasks";

const PAGE_SIZE = 5;
type Tab = "inbox" | "contract";
type Filters = { name: string; type: string; who: string; date: string };

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const badge = (t: string) =>
  t === "Invoice" ? "inv" : t === "Purchase Request" ? "pr" : t === "Purchase Order" ? "po" : "rfq";
const has = (v: string, q: string) => v.toLowerCase().includes(q.trim().toLowerCase());

const TaskInbox: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("inbox");
  const [f, setF] = useState<Filters>({ name: "", type: "", who: "", date: "" });
  const [page, setPage] = useState(1);

  const setFilter = (k: keyof Filters, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setPage(1);
  };

  const rows = useMemo(
    () =>
      tab === "inbox"
        ? taskInboxItems.filter(
            (t) => has(t.taskName, f.name) && has(t.taskType, f.type) && has(t.assignedTo, f.who) && has(t.assignedOn, f.date)
          )
        : [],
    [tab, f]
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = rows.length ? (page - 1) * PAGE_SIZE : 0;
  const shown = rows.slice(start, start + PAGE_SIZE);
  const heads: [string, keyof Filters][] = [["Task Name", "name"], ["Task Type", "type"], ["Assigned To", "who"], ["Assigned On", "date"]];

  return (
    <section className="xt">
      <div className="xt-tabs">
        <button type="button" className={tab === "inbox" ? "on" : ""} onClick={() => { setTab("inbox"); setPage(1); }}>
          TASK INBOX ({taskInboxItems.length})
        </button>
        <button type="button" className={tab === "contract" ? "on" : ""} onClick={() => { setTab("contract"); setPage(1); }}>
          CONTRACT SIGNATORY TASKS
        </button>
      </div>

      <div className="xt-grid xt-head">
        {heads.map(([label]) => <span key={label}>{label}</span>)}
      </div>
      <div className="xt-grid xt-filters">
        {heads.map(([label, key]) => (
          <input key={key} placeholder="--Search--" aria-label={`Filter ${label}`} value={f[key]} onChange={(e) => setFilter(key, e.target.value)} />
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="xt-empty">{tab === "contract" ? "No contract signatory tasks available." : "No task matches your filters."}</div>
      ) : (
        shown.map((t) => (
          <div className="xt-grid xt-row" key={t.id}>
            <button type="button" className="xt-link" title={t.taskName} onClick={() => navigate(`/tasks/${t.id}`)}>{t.taskName}</button>
            <span><span className={`xt-badge ${badge(t.taskType)}`}>{t.taskType}</span></span>
            <span className="xt-user"><span className="xt-av">{initials(t.assignedTo)}</span>{t.assignedTo}</span>
            <span className="xt-date"><CalendarDays size={14} />{t.assignedOn}</span>
          </div>
        ))
      )}

      <div className="xt-foot">
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={14} /></button>
        <span>Showing {rows.length ? start + 1 : 0} to {Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}</span>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}><ChevronRight size={14} /></button>
      </div>
    </section>
  );
};

export default TaskInbox;