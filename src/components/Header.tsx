import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  ExternalLink,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import "../Styles/Header.css";

export interface HeaderProps {
  activeItem?: string;
  themeMode?: "dark" | "light";
  onToggleTheme?: () => void;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  userEmail?: string;
}

const mockNotifications = [
  {
    id: 1,
    title: "PR-1002 Approval Required",
    subtitle: "High priority IT Hardware purchase awaits your review",
    time: "10m ago",
    badge: "priority",
  },
  {
    id: 2,
    title: "RFQ-2026-08 Quotes Received",
    subtitle: "2 new vendor quotes submitted for review",
    time: "45m ago",
    badge: "info",
  },
  {
    id: 3,
    title: "PO-4091 Shipped",
    subtitle: "Dell Technologies dispatched 25 Monitors",
    time: "2h ago",
    badge: "success",
  },
];

const Header: React.FC<HeaderProps> = ({
  activeItem = "Dashboard",
  themeMode = "light",
  onToggleTheme,
  userName = "Loading user...",
  userRole = "Loading...",
  userInitials = "...",
  userEmail = "",
}) => {
  const [openMenu, setOpenMenu] = useState<"notifications" | "help" | "profile" | null>(null);
  const headerRightRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        headerRightRef.current &&
        !headerRightRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  const toggleMenu = (menu: "notifications" | "help" | "profile") => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <header className="app-top-header" role="banner">
      {/* LEFT: BREADCRUMB NAVIGATION */}
      <div className="top-header-left">
        <div className="top-header-breadcrumb">
          <span className="top-header-app-badge">
            <Sparkles size={12} strokeWidth={2.2} />
            Procurement 360
          </span>
          <span className="top-header-slash">/</span>
          <span className="top-header-active-page">{activeItem}</span>
        </div>
      </div>

      {/* RIGHT: ALARM, HELP, THEME TOGGLE, AND LOGGED-IN USER */}
      <div className="top-header-right" ref={headerRightRef}>
        {/* Alarm / Notifications Button with badge matching screenshot */}
        <button
          type="button"
          className="top-header-icon-btn top-header-alarm"
          aria-label="Notifications"
          title="Notifications"
          aria-expanded={openMenu === "notifications"}
          onClick={() => toggleMenu("notifications")}
        >
          <Bell size={18} strokeWidth={1.8} />
          <span className="top-header-notification-dot" aria-hidden="true" />
        </button>

        {/* Notifications Dropdown */}
        {openMenu === "notifications" && (
          <div className="top-header-dropdown top-header-notifications-menu" role="menu">
            <div className="top-header-dropdown-header">
              <h4>Notifications</h4>
              <small onClick={() => setOpenMenu(null)}>Mark all read</small>
            </div>
            <div className="top-header-dropdown-list">
              {mockNotifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  className="top-header-dropdown-item"
                  onClick={() => setOpenMenu(null)}
                >
                  <span className={`top-header-dropdown-item-badge ${notif.badge}`} />
                  <div className="top-header-dropdown-item-text">
                    <strong>{notif.title}</strong>
                    <span>{notif.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help Button matching screenshot */}
        <button
          type="button"
          className="top-header-icon-btn top-header-help"
          aria-label="Help and Documentation"
          title="Help & Resources"
          aria-expanded={openMenu === "help"}
          onClick={() => toggleMenu("help")}
        >
          <HelpCircle size={18} strokeWidth={1.8} />
        </button>

        {/* Help Dropdown */}
        {openMenu === "help" && (
          <div className="top-header-dropdown top-header-help-menu" role="menu">
            <div className="top-header-dropdown-header">
              <h4>Help & Resources</h4>
            </div>
            <div className="top-header-dropdown-list">
              <a
                href="#guide"
                className="top-header-help-item"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenMenu(null);
                }}
              >
                <BookOpen size={14} />
                <span>Procurement User Guide</span>
                <ExternalLink size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
              </a>
              <a
                href="#shortcuts"
                className="top-header-help-item"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenMenu(null);
                }}
              >
                <Keyboard size={14} />
                <span>Command Center</span>
                <kbd>Ctrl + K</kbd>
              </a>
              <a
                href="#support"
                className="top-header-help-item"
                onClick={(e) => {
                  e.preventDefault();
                  setOpenMenu(null);
                }}
              >
                <LifeBuoy size={14} />
                <span>Support & Feedback</span>
              </a>
            </div>
          </div>
        )}

        {/* Theme Toggle (Light / Dark mode) */}
        {onToggleTheme && (
          <button
            type="button"
            className="top-header-icon-btn top-header-theme"
            onClick={onToggleTheme}
            aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          >
            {themeMode === "dark" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
          </button>
        )}

        {/* Divider */}
        <div className="top-header-divider" aria-hidden="true" />

        {/* Logged-in User Profile Capsule */}
        <div
          className="top-header-user"
          role="button"
          tabIndex={0}
          aria-label={`Logged in as ${userName}, ${userRole}`}
          aria-expanded={openMenu === "profile"}
          onClick={() => toggleMenu("profile")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleMenu("profile");
            }
          }}
        >
          <div className="top-header-user-avatar" aria-hidden="true">
            {userInitials}
          </div>
          <div className="top-header-user-info">
            <strong className="top-header-user-name">{userName}</strong>
            <span className="top-header-user-role">{userRole}</span>
          </div>
          <span className="top-header-user-action" aria-hidden="true">
            ↪
          </span>
        </div>

        {/* Profile Dropdown */}
        {openMenu === "profile" && (
          <div className="top-header-dropdown top-header-profile-menu" role="menu">
            <div className="top-header-profile-body">
              <strong>{userName}</strong>
              <span>{userEmail}</span>
              <small>Role: {userRole}</small>
            </div>
            <div className="top-header-profile-footer">
              <button
                type="button"
                className="top-header-logout-action"
                onClick={() => {
                  setOpenMenu(null);
                  alert("Logged out successfully");
                }}
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;