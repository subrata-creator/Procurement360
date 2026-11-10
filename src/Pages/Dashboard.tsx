import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Bot, Plus } from "lucide-react";
import CreatePRModal from "../components/CreatePRModal";
import CommandCenterPanels from "../components/CommandCenterPanels";
import KpiBanner from "../components/KpiBanner";
import PRJourney from "../components/PRJourney";
import ChartCards from "../components/ChartCards";
import TaskInbox from "../components/TaskInbox";
import "../Styles/DashboardNew.css";
import "../Styles/HeroBanner.css";

interface DashboardProps {
  isAdmin?: boolean;
  userName?: string;
}

export default function Dashboard({ isAdmin = false, userName }: DashboardProps) {
  const navigate = useNavigate();
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  const displayName = useMemo(() => {
    if (!userName || userName.toLowerCase().includes("loading") || userName.toLowerCase().includes("unknown")) {
      return "Alex";
    }
    const parts = userName.trim().split(/\s+/);
    return parts[0] || "Alex";
  }, [userName]);

  return (
    <main className="dashboard-page">

      {/* =====================================================
          AI INTELLIGENCE HERO HEADER
      ===================================================== */}
      <header className="dashboard-hero-banner" aria-label="Procurement Intelligence Overview">
        <div className="hero-content-left">
          <div className="hero-eyebrow">
            <Sparkles size={13} className="hero-sparkle-icon" />
            <span>PROCUREMENT INTELLIGENCE</span>
          </div>

          <h1 className="hero-greeting">
            {greeting}, {displayName}.
          </h1>
          <p className="hero-subline">
            Here’s what needs your attention.
          </p>

          <div className="hero-chips-row">
            <span className="hero-chip priority">
              <i className="chip-dot dot-priority" />
              <span>3 approvals need attention</span>
            </span>
            <span className="hero-chip budget">
              <i className="chip-dot dot-budget" />
              <span>IT budget at 81%</span>
            </span>
            <span className="hero-chip intelligence">
              <i className="chip-dot dot-ai" />
              <span>3 AI recommendations</span>
            </span>
          </div>
        </div>

        <div className="hero-content-right">
          {/* AI Revolving Circular Motion Graphic */}
          <div className="hero-ai-orbit-container" aria-hidden="true">
            {/* Concentric rotating orbital rings */}
            <div className="hero-orbit-ring ring-outer">
              <span className="hero-orbit-node node-1" />
            </div>
            <div className="hero-orbit-ring ring-middle">
              <span className="hero-orbit-node node-2" />
            </div>
            <div className="hero-orbit-ring ring-inner" />

            {/* Glowing Bot Badge in Center */}
            <div className="hero-ai-bot-avatar">
              <Bot size={24} strokeWidth={1.9} />
            </div>
          </div>

          {!isAdmin && (
            <button
              type="button"
              className="hero-create-pr-btn"
              onClick={() => setIsCreatePROpen(true)}
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>Create purchase request</span>
            </button>
          )}
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
        onOpenTask={() => {
          const el = document.getElementById("work-queue") || document.querySelector(".work-queue");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
        onViewSuppliers={() => navigate("/suppliers")}
        onViewForecast={() => navigate("/rfq-forecast")}
      />


      {/* =====================================================
          PURCHASE REQUEST JOURNEY
      ===================================================== */}
      <section className="dashboard-journey-section">
        <PRJourney
          onViewPending={() => navigate("/purchase-requests?status=In Review")}
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
      <section className="dashboard-bottom" id="work-queue">

        <div className="dashboard-task-wrapper">
          <TaskInbox />
        </div>

      </section>

      {isCreatePROpen && (
        <CreatePRModal
          onClose={() => setIsCreatePROpen(false)}
          onViewPurchaseRequest={() => navigate("/purchase-requests")} />
      )}

    </main>
  );
}
