import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { getContext } from "@microsoft/power-apps/app";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Dashboard from "./Pages/Dashboard";
import RfqPage from "./Pages/RfqPage";
import RfqForecastPage from "./Pages/RfqForecastPage";
import OrdersPage from "./Pages/OrdersPage";
import OrderDetail from "./Pages/OrderDetail";
import PurchaseRequest from "./Pages/PurchaseRequest";
import PurchaseRequestDetail from "./Pages/PRSummary";
import TaskDetail from "./Pages/TaskDetail";
import RfqDetail from "./Pages/rfqdetail";
import UsersPage from "./Pages/Admin/UsersPage";
import ApprovalCycleConfigPage from "./Pages/Admin/ApprovalCycleConfigPage";
import SuppliersPage from "./Pages/SuppliersPage";
import UserSuppliersPage from "./Pages/UserSuppliersPage";
import ProductsPage from "./Pages/ProductsPage";
import SupplierSummary from "./Pages/SupplierSummary";
import SupplierDashboard from "./Pages/Supplier/SupplierDashboard";
import SupplierRfqsPage from "./Pages/Supplier/SupplierRfqsPage";
import SupplierRfqResponsePage from "./Pages/Supplier/SupplierRfqResponsePage";

import { Cr49f_userrolesesService } from "../src/generated/services/Cr49f_userrolesesService";

import ProcurementCopilot from "./components/ProcurementCopilot";
import FloatingCopilotButton from "./components/FloatingCopilotButton";
import "./Styles/Styles.css";

interface LoggedInUser {
  userName: string;
  userRole: string;
  userEmail: string;
  userInitials: string;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
};

const AppContent: React.FC = () => {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [hasOpenedCopilot, setHasOpenedCopilot] = useState(false);
  const [fallbackNavigation, setFallbackNavigation] =
    useState("Dashboard");

  const [loggedInUser, setLoggedInUser] =
    useState<LoggedInUser>({
      userName: "Loading user...",
      userRole: "Loading...",
      userEmail: "",
      userInitials: "...",
    });

  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    try {
      return window.localStorage.getItem("procurement-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  const location = useLocation();
  const navigate = useNavigate();

  const isUsersRoute = location.pathname.startsWith("/users");
  const isApprovalCycleRoute =
    location.pathname.startsWith("/approval-cycle-configuration") ||
    location.pathname.startsWith("/approval-cycles");

  const isSuppliersRoute = location.pathname.startsWith("/suppliers");
  const isProductsRoute = location.pathname.startsWith("/products-services") || location.pathname.startsWith("/products");

  const isPurchaseRequestRoute =
    location.pathname.startsWith("/purchase-requests");

  const isForecastRoute = location.pathname.startsWith("/rfq-forecast");
  const isRfqRoute = location.pathname.startsWith("/rfqs");
  const isOrdersRoute = location.pathname.startsWith("/orders");
  const isTaskRoute = location.pathname.startsWith("/tasks/");

  const isRoleLoading = loggedInUser.userRole === "Loading...";
  const isAdmin =
    loggedInUser.userRole?.trim().toLowerCase() === "admin";
  const isSupplier =
    loggedInUser.userRole?.trim().toLowerCase() === "supplier";

  const isSupplierDashboardRoute =
    location.pathname === "/supplier-dashboard" ||
    (isSupplier && location.pathname === "/");
  const isSupplierQuotationsRoute =
    location.pathname.startsWith("/supplier-quotations");
  const isSupplierRfqsRoute =
    location.pathname.startsWith("/supplier-rfqs") || isSupplierQuotationsRoute;

  // Chatbot floating should only be visible in user portal (disabled for both admin and supplier)
  const showChatbot =
    !isRoleLoading &&
    !isAdmin &&
    !isSupplier &&
    !isSupplierDashboardRoute &&
    !isSupplierRfqsRoute;

  const routeNavigation = isSupplierDashboardRoute
    ? "Dashboard"
    : isSupplierQuotationsRoute
    ? "My Quotations"
    : isSupplierRfqsRoute
    ? "My RFQs"
    : isUsersRoute
    ? "Users"
    : isApprovalCycleRoute ? "Approval Cycle" : isSuppliersRoute ? "Suppliers" : isProductsRoute ? "Products / Services" : isPurchaseRequestRoute
      ? "Purchase Requests"
      : isForecastRoute ? "RFQs" : isRfqRoute
        ? "RFQs"
        : isOrdersRoute
          ? "Orders"
          : undefined;

  const activeNavigation =
    routeNavigation ?? (isAdmin ? "Users" : fallbackNavigation);

  // Load the actual signed-in user's profile.
  useEffect(() => {
    let isMounted = true;

    const loadLoggedInUser = async () => {
      try {
        // 1. Get the current user's identity from Code Apps.
        const context = await getContext();

        const contextName = context.user.fullName?.trim() ?? "";
        const contextEmail =
          context.user.userPrincipalName?.trim().toLowerCase() ?? "";

        if (!isMounted) return;

        // Show the authenticated identity while looking up the role.
        setLoggedInUser({
          userName: contextName || contextEmail || "Unknown User",
          userRole: "Loading...",
          userEmail: contextEmail,
          userInitials: getInitials(contextName || contextEmail),
        });

        if (!contextEmail) {
          throw new Error(
            "The signed-in user's email could not be retrieved."
          );
        }

        // 2. Retrieve users from the Dataverse User Roles table.
        const result = await Cr49f_userrolesesService.getAll();

        if (result.error) {
          throw new Error("Unable to retrieve user roles from Dataverse.");
        }

        const users = result.data ?? [];

        // 3. Match the signed-in user's email with Dataverse.
        const matchedUser = users.find(
          (user) =>
            user.cr49f_email?.trim().toLowerCase() === contextEmail &&
            user.statecode === 0
        );

        if (!isMounted) return;

        if (!matchedUser) {
          // Do not silently assign a role if no user record exists.
          setLoggedInUser({
            userName: contextName || contextEmail,
            userRole: "Not registered",
            userEmail: contextEmail,
            userInitials: getInitials(contextName || contextEmail),
          });

          console.warn(
            "No active Dataverse user record matches:",
            contextEmail
          );

          return;
        }

        // 4. Convert the Dataverse role value into its display name.
        const roleLabels: Record<string, string> = {
          "1": "Admin",
          "2": "User",
          "3": "Supplier",
        };

        const role =
          roleLabels[String(matchedUser.cr49f_roles)] ??
          "Unassigned";

        // 5. Update the Header with the matched Dataverse profile.
        const fullName =
          matchedUser.cr49f_fullname?.trim() ||
          contextName ||
          contextEmail;

        setLoggedInUser({
          userName: fullName,
          userRole: role,
          userEmail: contextEmail,
          userInitials: getInitials(fullName),
        });
      } catch (error) {
        console.error("Failed to load the logged-in user:", error);

        if (!isMounted) return;

        setLoggedInUser((current) => ({
          ...current,
          userRole: "Unavailable",
        }));
      }
    };

    void loadLoggedInUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // Apply the selected theme.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      themeMode === "dark"
    );

    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;

    try {
      window.localStorage.setItem("procurement-theme", themeMode);
    } catch {
      // Theme still applies for this session.
    }
  }, [themeMode]);

  // Keep Admin users off the User Dashboard route and land them on Users.
  useEffect(() => {
    if (isAdmin && location.pathname === "/") {
      navigate("/users", { replace: true });
    }
  }, [isAdmin, location.pathname, navigate]);

  // Ensure copilot is closed if role is Admin or Supplier
  useEffect(() => {
    if (isAdmin || isSupplier) {
      setIsCopilotOpen(false);
    }
  }, [isAdmin, isSupplier]);

  // Reset scroll position to top when switching routes/tabs.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  // Navigation handler
  const handleNavigation = (item: string) => {
    setFallbackNavigation(item);

    if (item === "Dashboard") {
      navigate(isAdmin ? "/users" : isSupplier ? "/supplier-dashboard" : "/");
    } else if (item === "My RFQs") {
      navigate("/supplier-rfqs");
    } else if (item === "My Quotations") {
      navigate("/supplier-quotations");
    } else if (item === "Users") {
      navigate("/users");
    } else if (
      item === "Approval Cycle" ||
      item === "Approval Cycle Configuration"
    ) {
      navigate("/approval-cycle-configuration");
    } else if (item === "Purchase Requests") {
      navigate("/purchase-requests");
    } else if (item === "RFQs") {
      navigate("/rfqs");
    } else if (item === "Suppliers") {
      navigate("/suppliers");
    } else if (item === "Products / Services" || item === "Products") {
      navigate("/products-services");
    } else if (item === "Orders") {
      navigate("/orders");
    } else {
      navigate(isAdmin ? "/users" : "/");
    }
  };

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />

      <Sidebar
        activeItem={activeNavigation}
        onNavigate={handleNavigation}
        isAdmin={isAdmin}
        isSupplier={isSupplier}
      />

      <div className="app-main-layout">
        <Header
          activeItem={activeNavigation}
          themeMode={themeMode}
          onToggleTheme={() =>
            setThemeMode((mode) =>
              mode === "dark" ? "light" : "dark"
            )
          }
          userName={loggedInUser.userName}
          userRole={loggedInUser.userRole}
          userEmail={loggedInUser.userEmail}
          userInitials={loggedInUser.userInitials}
        />

        <main className="dashboard">
          {isForecastRoute ? (
            <Routes>
              <Route path="/rfq-forecast" element={<RfqForecastPage />} />
            </Routes>
          ) : isSupplierRfqsRoute ? (
            <Routes>
              <Route
                path="/supplier-rfqs"
                element={
                  <SupplierRfqsPage
                    userEmail={loggedInUser.userEmail}
                    userName={loggedInUser.userName}
                  />
                }
              />
              <Route
                path="/supplier-quotations"
                element={
                  <SupplierRfqsPage
                    userEmail={loggedInUser.userEmail}
                    userName={loggedInUser.userName}
                    defaultFilter="Submitted"
                  />
                }
              />
              <Route
                path="/supplier-rfqs/:id"
                element={
                  <SupplierRfqResponsePage
                    userEmail={loggedInUser.userEmail}
                    userName={loggedInUser.userName}
                  />
                }
              />
            </Routes>
          ) : isSupplierDashboardRoute ? (
            <SupplierDashboard
              userEmail={loggedInUser.userEmail}
              userName={loggedInUser.userName}
            />
          ) : isUsersRoute ? (
            <Routes>
              <Route path="/users" element={<UsersPage />} />
            </Routes>
          ) : isApprovalCycleRoute ? (
            <Routes>
              <Route
                path="/approval-cycle-configuration"
                element={<ApprovalCycleConfigPage />}
              />
              <Route
                path="/approval-cycles"
                element={<ApprovalCycleConfigPage />}
              />
            </Routes>
          ) : isSuppliersRoute ? (
            <Routes>
              <Route
                path="/suppliers"
                element={isAdmin ? <SuppliersPage /> : <UserSuppliersPage />}
              />
              <Route
                path="/suppliers/:id"
                element={<SupplierSummary readOnly={!isAdmin} />}
              />
            </Routes>
          ) : isProductsRoute ? (
            <Routes>
              <Route path="/products-services" element={<ProductsPage />} />
              <Route path="/products" element={<ProductsPage />} />
            </Routes>
          ) : isPurchaseRequestRoute ? (
            <Routes>
              <Route
                path="/purchase-requests"
                element={<PurchaseRequest />}
              />
              <Route
                path="/purchase-requests/:ref"
                element={<PurchaseRequestDetail />}
              />
            </Routes>
          ) : isRfqRoute ? (
            <Routes>
              <Route path="/rfqs" element={<RfqPage />} />
              <Route path="/rfqs/new" element={<RfqPage openCreateModal />} />
              <Route
                path="/rfqs/:ref"
                element={<RfqDetail />}
              />
            </Routes>
          ) : isOrdersRoute ? (
            <Routes>
              <Route path="/orders" element={<OrdersPage />} />
              <Route
                path="/orders/:ref"
                element={<OrderDetail />}
              />
            </Routes>
          ) : isTaskRoute ? (
            <Routes>
              <Route
                path="/tasks/:id"
                element={<TaskDetail />}
              />
            </Routes>
          ) : isRoleLoading && location.pathname === "/" ? (
            <div
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: "60vh",
                color: "var(--muted-foreground-hex, #64748b)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Loading workspace...
            </div>
          ) : isAdmin ? (
            <UsersPage />
          ) : isSupplier ? (
            <SupplierDashboard
              userEmail={loggedInUser.userEmail}
              userName={loggedInUser.userName}
            />
          ) : (
            <Dashboard
              isAdmin={isAdmin}
              userName={loggedInUser.userName}
            />
          )}
        </main>
      </div>

      {/* =====================================================
          USER PORTAL CHATBOT (Disabled for supplier & admin)
      ===================================================== */}
      {showChatbot && (
        <>
          <FloatingCopilotButton
            isOpen={isCopilotOpen}
            resetKey={location.pathname}
            onOpen={() => {
              setHasOpenedCopilot(true);
              setIsCopilotOpen(true);
            }}
          />

          <ProcurementCopilot
            isOpen={isCopilotOpen}
            mountFrame={hasOpenedCopilot}
            onClose={() => setIsCopilotOpen(false)}
          />
        </>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
