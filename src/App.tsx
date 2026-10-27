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
import OrdersPage from "./Pages/OrdersPage";
import OrderDetail from "./Pages/OrderDetail";
import PurchaseRequest from "./Pages/PurchaseRequest";
import PurchaseRequestDetail from "./Pages/PRSummary";
import TaskDetail from "./Pages/TaskDetail";
import RfqDetail from "./Pages/rfqdetail";

import { Cr49f_userrolesesService } from "../src/generated/services/Cr49f_userrolesesService";

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

  const isPurchaseRequestRoute =
    location.pathname.startsWith("/purchase-requests");

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

  // Existing navigation remains unchanged.
  const handleNavigation = (item: string) => {
    setFallbackNavigation(item);

    if (item === "Dashboard") {
      navigate("/");
    } else if (item === "Purchase Requests") {
      navigate("/purchase-requests");
    } else if (item === "RFQs") {
      navigate("/rfqs");
    } else if (item === "Orders") {
      navigate("/orders");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />

      <Sidebar
        activeItem={activeNavigation}
        onNavigate={handleNavigation}
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
          {isPurchaseRequestRoute ? (
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
          ) : (
            <Dashboard />
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
