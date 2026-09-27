import { useRef, useState } from "react";

import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  HelpCircle,
  Search,
  ShoppingCart,
} from "lucide-react";

import "../Styles/Dashboard.css";

const stats = [
  { title: "Purchase Requests", value: "42", icon: ShoppingCart, type: "blue" },
  { title: "RFQs", value: "43", icon: ClipboardList, type: "purple" },
  { title: "Orders", value: "20", icon: ShoppingCart, type: "orange" },
  { title: "Invoice Submissions", value: "18", icon: FileText, type: "pink" },
  { title: "Allocated Budget", value: "USD 10.00M", icon: BarChart3, type: "blue budget" },
  { title: "Remaining Budget", value: "USD 9.90M", icon: BarChart3, type: "purple budget" },
];

const tasks = [
  { title: "Invoice Approval for Business Dinner - Invoice Approval for INV-2026-01", type: "Invoice", assigned: "Subrat Dey", date: "10/22/2025" },
  { title: "Invoice Approval for Business Dinner - Invoice Approval for INV-2026-02", type: "Invoice", assigned: "Subrat Dey", date: "10/22/2025" },
  { title: "Changes needed for PR - Edi Equipment 5630", type: "Purchase Request", assigned: "Subrat Dey", date: "10/15/2025" },
  { title: "Changes needed for PR - Lenovo V15 Gen 4", type: "Purchase Request", assigned: "Subrat Dey", date: "10/15/2025" },
  { title: "RFQ Approval for RFQ-2025-019", type: "Request for Quotation", assigned: "Subrat Dey", date: "10/12/2025" },
  { title: "RFQ Approval for RFQ-2025-018", type: "Request for Quotation", assigned: "Subrat Dey", date: "10/12/2025" },
];

const activities = [
  { text: "PR-2025-019 for IT First Aid Kit has been initiated by Sakshi Paliwal", time: "Today, 10:24 AM" },
  { text: "PR-2025-018 for IT First Aid Kit has been initiated by Sakshi Paliwal", time: "Today, 10:15 AM" },
  { text: "RFQ-2025-052 has been approved by Finance Manager - Information Technology", time: "Yesterday, 4:20 PM" },
  { text: "RFQ-2025-051 has been approved by Procurement Manager - Information Technology", time: "Yesterday, 3:45 PM" },
  { text: "PR-2025-016 has been approved by Business User - Information Technology", time: "Yesterday, 2:30 PM" },
];

const monthlyData = [6, 4, 9, 12, 17, 24, 20, 12, 16, 10, 14, 9];
const MONTHLY_MAX = 24;
const MONTHLY_AXIS = [24, 18, 12, 6, 0];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const supplierData = [
  { name: "Dell Inc.", value: 25 },
  { name: "TechScan", value: 60 },
  { name: "ITC", value: 100 },
  { name: "Logitech", value: 90 },
  { name: "Pidilite", value: 40 },
];

const SUPPLIER_MAX = 100;
const SUPPLIER_AXIS = [100, 75, 50, 25, 0];

const departmentData = [
  { name: "ADM", value: 70 },
  { name: "HR", value: 180 },
  { name: "PDT", value: 120 },
  { name: "IT", value: 145 },
];

const DEPARTMENT_MAX = 200;
const DEPARTMENT_AXIS = [200, 150, 100, 50, 0];

function MiniBars({ type }: { type: string }) {
  return (
    <div className={`mini-bars ${type}`}>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function AxisChart({ items, axisTicks, maxValue, barMaxWidth }: { items: { label: string; value: number }[]; axisTicks: number[]; maxValue: number; barMaxWidth: number }) {
  return (
    <div className="chart-area">
      <div className="chart-y-axis">
        {axisTicks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div className="bar-chart">
        <div className="horizontal-lines">
          {axisTicks.map((tick) => (
            <span key={tick} />
          ))}
        </div>

        <div className="bars">
          {items.map((item) => (
            <div className="bar-column" key={item.label}>
              <div
                className="bar"
                style={{
                  height: `${(item.value / maxValue) * 100}%`,
                  maxWidth: `${barMaxWidth}px`,
                }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isoToUsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

export default function Dashboard() {
  const assignedOnRef = useRef<HTMLInputElement>(null);
  const [taskNameQuery, setTaskNameQuery] = useState("");
  const [taskTypeQuery, setTaskTypeQuery] = useState("");
  const [assignedToQuery, setAssignedToQuery] = useState("");
  const [assignedOnQuery, setAssignedOnQuery] = useState("");

  const filteredTasks = tasks.filter((task) => {
    const matchesName = task.title.toLowerCase().includes(taskNameQuery.trim().toLowerCase());
    const matchesType = task.type.toLowerCase().includes(taskTypeQuery.trim().toLowerCase());
    const matchesAssignedTo = task.assigned.toLowerCase().includes(assignedToQuery.trim().toLowerCase());
    const matchesAssignedOn = assignedOnQuery === "" || task.date === isoToUsDate(assignedOnQuery);

    return matchesName && matchesType && matchesAssignedTo && matchesAssignedOn;
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your procurement activities</p>
        </div>

        <div className="dashboard-actions">
          <button type="button"><Search size={12} /></button>
          <button type="button" className="has-badge"><Bell size={12} /></button>
          <button type="button"><HelpCircle size={12} /></button>
        </div>
      </div>

      <div className="dashboard-stats">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.title} className={`stat-card ${stat.type}`}>
              <div className="stat-card-top">
                <div className="stat-icon"><Icon size={13} /></div>
                <div className="stat-content">
                  <span>{stat.title}</span>
                  <strong>{stat.value}</strong>
                </div>
              </div>

              {!stat.type.includes("budget") && <MiniBars type={stat.type} />}

              {stat.type.includes("budget") && (
                <div className="budget-progress">
                  <div className="budget-track">
                    <div className={`budget-fill ${stat.type}`} />
                  </div>
                  <span>{stat.title === "Allocated Budget" ? "95% used" : "10% left"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="dashboard-middle">
        <section className="task-card">
          <div className="task-tabs">
            <button className="active">Task Inbox</button>
            <button>Contract Signatory Tasks</button>
          </div>

          <div className="task-header">
            <span>Task Name</span>
            <span>Task Type</span>
            <span>Assigned To</span>
            <span>Assigned On</span>
          </div>

          <div className="task-filters">
            <input placeholder="Search..." value={taskNameQuery} onChange={(e) => setTaskNameQuery(e.target.value)} />
            <input placeholder="Search..." value={taskTypeQuery} onChange={(e) => setTaskTypeQuery(e.target.value)} />
            <input placeholder="Search..." value={assignedToQuery} onChange={(e) => setAssignedToQuery(e.target.value)} />
            <div className="date-search">
              <input
                ref={assignedOnRef}
                type="date"
                value={assignedOnQuery}
                onChange={(event) => setAssignedOnQuery(event.target.value)}
              />
              <button type="button" className="date-search-icon" onClick={() => assignedOnRef.current?.showPicker?.()}>
                <CalendarDays size={11} />
              </button>
            </div>
          </div>

          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="task-empty">No task matches your filters.</div>
            ) : (
              filteredTasks.map((task, index) => (
                <div className="task-row" key={`${task.title}-${index}`}>
                  <span>{task.title}</span>
                  <span className="task-type-pill">{task.type}</span>
                  <span>{task.assigned}</span>
                  <span>{task.date}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="activity-card">
          <div className="activity-header">
            <div className="activity-title-wrap">
              <span className="activity-mark">◌</span>
              <h2>Activity Timeline</h2>
            </div>
            <div className="activity-nav">
              <button type="button"><ChevronLeft size={11} /></button>
              <button type="button"><ChevronRight size={11} /></button>
            </div>
          </div>

          <div className="activity-list">
            {activities.map((activity, index) => (
              <div className="activity-item" key={`${activity.text}-${index}`}>
                <div className="activity-dot" />
                <div className="activity-copy">
                  <p>{activity.text}</p>
                  <span>{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="dashboard-charts">
        <div className="chart-card">
          <h3>RFQ Breakout By Months</h3>
          <AxisChart items={monthLabels.map((label, index) => ({ label, value: monthlyData[index] }))} axisTicks={MONTHLY_AXIS} maxValue={MONTHLY_MAX} barMaxWidth={32} />
        </div>

        <div className="chart-card">
          <h3>Suppliers By Orders</h3>
          <AxisChart items={supplierData.map((item) => ({ label: item.name, value: item.value }))} axisTicks={SUPPLIER_AXIS} maxValue={SUPPLIER_MAX} barMaxWidth={42} />
        </div>

        <div className="chart-card">
          <h3>Orders By Department</h3>
          <AxisChart items={departmentData.map((item) => ({ label: item.name, value: item.value }))} axisTicks={DEPARTMENT_AXIS} maxValue={DEPARTMENT_MAX} barMaxWidth={52} />
        </div>
      </div>

      <div className="dashboard-footer-row">
        <button type="button" className="dashboard-footer-button"><CheckCircle2 size={12} /> Success</button>
      </div>
    </div>
  );
}
