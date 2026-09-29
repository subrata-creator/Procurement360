import React, { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import Dashboard from "./Pages/Dashboard"; // <-- new AI dashboard page
import RfqPage from "./Pages/RfqPage";
import OrdersPage from "./Pages/OrdersPage";
import PurchaseRequest from "./Pages/PurchaseRequest";
import PurchaseRequestDetail from "./Pages/PRSummary";
import TaskDetail from "./Pages/TaskDetail";
import "./Styles/Styles.css";

const AppContent: React.FC = () => {
  const [fallbackNavigation, setFallbackNavigation] = useState("Dashboard");
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    try {
      return window.localStorage.getItem("procurement-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const isPurchaseRequestRoute = location.pathname.startsWith("/purchase-requests");
  const isTaskRoute = location.pathname.startsWith("/tasks/");
  const routeNavigation = isPurchaseRequestRoute
    ? "Purchase Requests"
    : location.pathname === "/rfqs"
      ? "RFQs"
      : location.pathname === "/orders"
        ? "Orders"
        : undefined;
  const activeNavigation = routeNavigation ?? fallbackNavigation;

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    try {
      window.localStorage.setItem("procurement-theme", themeMode);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [themeMode]);

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
      <Header
        activeItem={activeNavigation}
        onNavigate={handleNavigation}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((mode) => mode === "dark" ? "light" : "dark")}
      />
      <main className="dashboard">
        {isPurchaseRequestRoute ? (
          <Routes>
            <Route path="/purchase-requests" element={<PurchaseRequest />} />
            <Route path="/purchase-requests/:ref" element={<PurchaseRequestDetail />} />
          </Routes>
        ) : isTaskRoute ? (
          <Routes>
            <Route path="/tasks/:id" element={<TaskDetail />} />
          </Routes>
        ) : activeNavigation === "RFQs" ? (
          <RfqPage />
        ) : activeNavigation === "Orders" ? (
          <OrdersPage />
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;