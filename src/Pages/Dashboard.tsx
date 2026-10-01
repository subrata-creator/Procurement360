import { useState } from "react";
import { Bell, Bot, CalendarDays, ChevronDown, HelpCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreatePRModal from "../components/CreatePRModal";
import CommandCenterPanels from "../components/CommandCenterPanels";
import ProcurementCopilot from "../components/ProcurementCopilot";
import KpiBanner from "../components/KpiBanner";
import PRJourney from "../components/PRJourney";
import ChartCards from "../components/ChartCards";
import TaskInbox from "../components/TaskInbox";
import ActivityTimeline from "../components/ActivityTimeline";
import { purchaseRequests } from "./Purchaserequestsdata";
import { taskInboxItems } from "../data/tasks";

import "../Styles/DashboardNew.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [department, setDepartment] = useState("All Departments");
  const [dateRange, setDateRange] = useState("Last 30 days");
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const searchResults = [
    ...purchaseRequests.map((request) => ({
      title: request.ref,
      detail: request.title,
      department: request.department,
      path: `/purchase-requests/${request.ref}`,
    })),
    ...taskInboxItems.map((task) => ({
      title: task.taskName,
      detail: `${task.taskType} · Assigned ${task.assignedOn}`,
      department: undefined,
      path: `/tasks/${task.id}`,
    })),
  ].filter((result) => {
    const matchesDepartment = department === "All Departments" || !result.department || result.department === department;
    const matchesQuery = !searchQuery.trim() || `${result.title} ${result.detail}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesDepartment && matchesQuery;
  }).slice(0, 6);

  return (
    <main className="dashboard-page">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <header className="dashboard-heading command-heading">
        <div className="command-title">
          <span className="command-eyebrow">PROCUREMENT INTELLIGENCE</span>
          <h1> Procurement 360 </h1>
          <p>{greeting}. Here’s what needs your attention today.</p>
          <div className="command-context-row">
            <span className="command-context-chip priority"><i />3 approvals need attention</span>
            <span className="command-context-chip budget"><i />IT budget at 85%</span>
            <span className="command-context-chip intelligence"><i />3 AI recommendations</span>
          </div>
        </div>
        <div className="command-tools">
          <div className="command-search" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsSearchOpen(false);
          }}>
            <Search size={15} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsSearchOpen(false);
                if (event.key === "Enter" && searchResults[0]) {
                  navigate(searchResults[0].path);
                  setIsSearchOpen(false);
                }
              }}
              placeholder="Search PRs, POs, RFQs, invoices..."
              aria-label="Search procurement records"
              aria-expanded={isSearchOpen && Boolean(searchQuery.trim())}
            />
            <kbd>Ctrl K</kbd>
            {isSearchOpen && searchQuery.trim() && (
              <div className="command-search-results" role="listbox" aria-label="Procurement search results">
                {searchResults.length ? searchResults.map((result) => (
                  <button type="button" role="option" key={`${result.path}-${result.title}`} onClick={() => { navigate(result.path); setSearchQuery(""); setIsSearchOpen(false); }}>
                    <strong>{result.title}</strong><span>{result.detail}</span>
                  </button>
                )) : <p>No matching procurement records.</p>}
              </div>
            )}
          </div>
          <label className="command-select-wrap">
            <CalendarDays size={14} aria-hidden="true" />
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Dashboard date range">
              <option>Last 30 days</option><option>Quarter to date</option><option>Year to date</option>
            </select><ChevronDown size={12} aria-hidden="true" />
          </label>
          <label className="command-select-wrap department-select-wrap">
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
              <option>All Departments</option><option>Information Technology</option><option>Administration</option>
            </select><ChevronDown size={12} aria-hidden="true" />
          </label>
          <button type="button" className="dashboard-icon-button command-notifications" aria-label="Notifications"><Bell size={17} strokeWidth={1.8} /><i /></button>
          <button type="button" className="dashboard-icon-button" aria-label="Help"><HelpCircle size={17} strokeWidth={1.8} /></button>
          <button type="button" className="dashboard-create-button" onClick={() => setIsCreatePROpen(true)}>
            <span className="create-plus">+</span>Create Purchase Request
          </button>
        </div>
      </header>


      {/* =====================================================
          KPI SECTION
      ===================================================== */}
      <section className="dashboard-kpi-section">
        <KpiBanner />
      </section>

      <CommandCenterPanels
        onViewPRs={() => navigate("/purchase-requests")}
        onOpenTask={(id) => navigate(`/tasks/${id}`)}
        onViewForecast={() => document.getElementById("dashboard-analytics")?.scrollIntoView({ behavior: "smooth" })}
      />


      {/* =====================================================
          PURCHASE REQUEST JOURNEY
      ===================================================== */}
      <section className="dashboard-journey-section">
        <PRJourney
          onViewPending={() => navigate("/purchase-requests")}
        />
      </section>


      {/* =====================================================
          CHARTS
      ===================================================== */}
      <section className="dashboard-chart-section" id="dashboard-analytics">
        <ChartCards />
      </section>


      {/* =====================================================
          TASK + ACTIVITY
      ===================================================== */}
      <section className="dashboard-bottom">

        <div className="dashboard-task-wrapper">
          <TaskInbox />
        </div>

        <div className="dashboard-activity-wrapper">
          <ActivityTimeline />
        </div>

      </section>


      {/* =====================================================
          CHATBOT
      ===================================================== */}
      <button
        type="button"
        className="dashboard-chatbot-button"
        aria-label="Open Procurement Copilot"
        aria-expanded={isCopilotOpen}
        title="Open Procurement Copilot"
        onClick={() => setIsCopilotOpen(true)}
      >
        <Bot size={23} strokeWidth={1.8} />
      </button>

      {isCopilotOpen && (
        <ProcurementCopilot
          onClose={() => setIsCopilotOpen(false)}
          onViewPending={() => {
            setIsCopilotOpen(false);
            navigate("/purchase-requests");
          }}
        />
      )}

      {isCreatePROpen && (
        <CreatePRModal onClose={() => setIsCreatePROpen(false)} />
      )}

    </main>
  );
}