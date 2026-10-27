import React, { useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Header from "./components/Header";
import Dashboard from "./Pages/Dashboard";
import RfqPage from "./Pages/RfqPage";
import OrdersPage from "./Pages/OrdersPage";
import OrderDetail from "./Pages/OrderDetail";
import PurchaseRequest from "./Pages/PurchaseRequest";
import PurchaseRequestDetail from "./Pages/PRSummary";
import TaskDetail from "./Pages/TaskDetail";
import RfqDetail from "./Pages/rfqdetail";
import "./Styles/Styles.css";

const AppContent: React.FC = () => {
  const [fallbackNavigation, setFallbackNavigation] = useState("Dashboard");
  const location = useLocation();
  const navigate = useNavigate();
  const isPurchaseRequestRoute = location.pathname.startsWith("/purchase-requests");
  const isRfqRoute = location.pathname.startsWith("/rfqs");
  const isOrdersRoute = location.pathname.startsWith("/orders");
  const isTaskRoute = location.pathname.startsWith("/tasks/");
  const routeNavigation = isPurchaseRequestRoute
    ? "Purchase Requests"
    : isRfqRoute
      ? "RFQs"
      : isOrdersRoute
        ? "Orders"
        : undefined;
  const activeNavigation = routeNavigation ?? fallbackNavigation;

  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    try {
      return (window.localStorage.getItem("procurement-theme") as "dark" | "light") || "light";
    } catch {
      return "light";
    }
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    try {
      window.localStorage.setItem("procurement-theme", themeMode);
    } catch {
      // storage unavailable
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
      <div className="ambient" aria-hidden="true" />
      <Header
        activeItem={activeNavigation}
        onNavigate={handleNavigation}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
      />
      <main className="dashboard">
        {isPurchaseRequestRoute ? (
          <Routes>
            <Route path="/purchase-requests" element={<PurchaseRequest />} />
            <Route path="/purchase-requests/:ref" element={<PurchaseRequestDetail />} />
          </Routes>
        ) : isRfqRoute ? (
          <Routes>
            <Route path="/rfqs" element={<RfqPage />} />
            <Route path="/rfqs/:ref" element={<RfqDetail />} />
          </Routes>
        ) : isOrdersRoute ? (
          <Routes>
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:ref" element={<OrderDetail />} />
          </Routes>
        ) : isTaskRoute ? (
          <Routes>
            <Route path="/tasks/:id" element={<TaskDetail />} />
          </Routes>
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