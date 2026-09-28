import { Bell, CalendarDays, ChevronDown, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import KpiBanner from "../components/KpiBanner";
import AIInsights from "../components/AIInsights";
import PRJourney from "../components/PRJourney";
import ChartCards from "../components/ChartCards";
import TaskInbox from "../components/TaskInbox";
import ActivityTimeline from "../components/ActivityTimeline";
import "../Styles/DashboardNew.css";

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="xd-page">
      <header className="xd-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your procurement activities with AI insights</p>
        </div>
        <div className="xd-header-actions">
          <button type="button" className="xd-date"><CalendarDays size={15} /> Apr 1, 2026 - Apr 30, 2026 <ChevronDown size={14} /></button>
          <button type="button" className="xd-icon-btn xd-bell" aria-label="Notifications"><Bell size={16} /></button>
          <button type="button" className="xd-icon-btn" aria-label="Help"><HelpCircle size={16} /></button>
        </div>
      </header>

      <KpiBanner />
      <AIInsights />
      <PRJourney onViewPending={() => navigate("/purchase-requests")} />
      <ChartCards />

      <div className="xd-bottom">
        <TaskInbox />
        <ActivityTimeline />
      </div>
    </div>
  );
}