import React, { useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import KpiBanner from "./components/KpiBanner";
import TaskInbox from "./components/TaskInbox";
import ActivityTimeline from "./components/ActivityTimeline";
import RfqPage from "./Pages/RfqPage";
import OrdersPage from "./Pages/OrdersPage";
import PurchaseRequest from "./Pages/PurchaseRequest";
import PurchaseRequestDetail from "./Pages/PRSummary";
import "./Styles/Styles.css";

const chartData = [
  { title: "RFQ Breakout By Months", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], values: [6, 4, 9, 12, 18, 25, 21, 12, 17, 10, 14, 9], max: 24, color: "blue" },
  { title: "Suppliers By Orders", labels: ["Dell Inc.", "TechScan", "ITC", "Logitech", "Pidilite"], values: [25, 62, 100, 88, 39], max: 100, color: "blue" },
  { title: "Orders By Department", labels: ["ADM", "HR", "PDT", "IT"], values: [75, 185, 120, 145], max: 200, color: "blue" },
];

const chartTicks = (max: number) => [0, max * 0.25, max * 0.5, max * 0.75, max];

const DashboardHome: React.FC = () => (
  <>
    <div className="page-heading">
      <div>
        <h1>Dashboard</h1>
        <p>Overview of your procurement activities</p>
      </div>
      <div className="page-actions" aria-label="Dashboard actions">
        <button type="button" aria-label="Search">⌕</button>
        <button type="button" aria-label="Notifications">♧</button>
        <button type="button" aria-label="Help">?</button>
      </div>
    </div>
    <KpiBanner />

    <div className="dashboard-content">
      <div className="task-area">
        <TaskInbox />
      </div>
      <ActivityTimeline />
    </div>

    <section className="charts-grid" aria-label="Procurement charts">
      {chartData.map((chart) => (
        <article className="chart-card" key={chart.title}>
          <h2>{chart.title}</h2>
          <div className="chart-area">
            <div className="chart-y-axis">
              {chartTicks(chart.max).reverse().map((tick) => <span key={tick}>{Math.round(tick)}</span>)}
            </div>
            <div className="chart-plot">
              <div className="chart-grid-lines">
                {chartTicks(chart.max).map((tick) => <span key={tick} />)}
              </div>
              <div className={`bar-list ${chart.values.length > 6 ? "monthly" : ""}`}>
                {chart.values.map((value, index) => (
                  <div className="bar-column" key={chart.labels[index]}>
                    <div className="bar" style={{ height: `${(value / chart.max) * 100}%` }} title={`${chart.labels[index]}: ${value}`} />
                    <span>{chart.labels[index]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-axis-label">{chart.title === "Suppliers By Orders" ? "Suppliers" : chart.title === "Orders By Department" ? "Departments" : "RFQ breakout by months"}</div>
        </article>
      ))}
    </section>
  </>
);

const AppContent: React.FC = () => {
  const [fallbackNavigation, setFallbackNavigation] = useState("Dashboard");
  const location = useLocation();
  const navigate = useNavigate();
  const isPurchaseRequestRoute = location.pathname.startsWith("/purchase-requests");
  const routeNavigation = isPurchaseRequestRoute
    ? "Purchase Requests"
    : location.pathname === "/rfqs"
      ? "RFQs"
      : location.pathname === "/orders"
        ? "Orders"
        : undefined;
  const activeNavigation = routeNavigation ?? fallbackNavigation;

  const handleNavigation = (item: string) => {
    setFallbackNavigation(item);
    if (item === "Dashboard") navigate("/");
    else if (item === "Purchase Requests") navigate("/purchase-requests");
    else if (item === "RFQs") navigate("/rfqs");
    else if (item === "Orders") navigate("/orders");
    else navigate("/");
  };

  return (
    <div className="app">
      <Header activeItem={activeNavigation} onNavigate={handleNavigation} />
      <main className="dashboard">
        {isPurchaseRequestRoute ? (
          <Routes>
            <Route path="/purchase-requests" element={<PurchaseRequest />} />
            <Route path="/purchase-requests/:ref" element={<PurchaseRequestDetail />} />
          </Routes>
        ) : activeNavigation === "RFQs" ? (
          <RfqPage />
        ) : activeNavigation === "Orders" ? (
          <OrdersPage />
        ) : (
          <DashboardHome />
        )}
      </main>
      <button type="button" className="floating-chat" aria-label="Open assistant">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
          <path d="M7 7H25C26.657 7 28 8.343 28 10V21C28 22.657 26.657 24 25 24H16L10 28V24H7C5.343 24 4 22.657 4 21V10C4 8.343 5.343 7 7 7Z" stroke="white" strokeWidth="1.8" />
          <circle cx="12" cy="16" r="1.5" fill="white" />
          <circle cx="16" cy="16" r="1.5" fill="white" />
          <circle cx="20" cy="16" r="1.5" fill="white" />
        </svg>
      </button>
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;