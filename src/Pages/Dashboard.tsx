import { useState } from "react";
import { Bell, Bot, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CreatePRModal from "../components/CreatePRModal";
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

  return (
    <main className="dashboard-page">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <header className="dashboard-heading">

        <div className="dashboard-title-group">
          <h1>Dashboard</h1>

          <p>
            Procurement performance with insights built into your KPIs
          </p>
        </div>

        <div className="dashboard-actions">

          <button
            type="button"
            className="dashboard-icon-button"
            aria-label="Notifications"
          >
            <Bell size={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="dashboard-icon-button"
            aria-label="Help"
          >
            <HelpCircle size={17} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="dashboard-create-button"
            onClick={() => setIsCreatePROpen(true)}
          >
            <span className="create-plus">+</span>
            Create Purchase Request
          </button>

        </div>

      </header>


      {/* =====================================================
          KPI SECTION
      ===================================================== */}
      <section className="dashboard-kpi-section">
        <KpiBanner />
      </section>


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
      <section className="dashboard-chart-section">
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