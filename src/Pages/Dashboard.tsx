import { useState } from "react";
import { Bell, Bot, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreatePRModal from "../components/CreatePRModal";
import CommandCenterPanels from "../components/CommandCenterPanels";
import ProcurementCopilot from "../components/ProcurementCopilot";
import KpiBanner from "../components/KpiBanner";
import PRJourney from "../components/PRJourney";
import ChartCards from "../components/ChartCards";
import TaskInbox from "../components/TaskInbox";
import ActivityTimeline from "../components/ActivityTimeline";
import "../Styles/DashboardNew.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

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