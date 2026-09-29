import React from "react";
import { ClipboardList, FileSignature, Home, Moon, PackageSearch, ReceiptText, ShoppingBag, ShoppingCart, Sun, Truck } from "lucide-react";

const navigationItems = [
  { label: "Dashboard", icon: Home },
  { label: "Purchase Requests", icon: ShoppingCart },
  { label: "RFQs", icon: ClipboardList },
  { label: "Orders", icon: ShoppingBag },
  { label: "Invoices", icon: ReceiptText },
  { label: "Products / Services", icon: PackageSearch },
  { label: "Suppliers", icon: Truck },
  { label: "Contracts", icon: FileSignature },
];

interface HeaderProps {
  activeItem: string;
  onNavigate?: (item: string) => void;
  themeMode: "dark" | "light";
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeItem,
  onNavigate,
  themeMode,
  onToggleTheme,
}) => {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark">X</span><strong>Xebia</strong></div>
        <nav className="side-navigation" aria-label="Main navigation">
          {navigationItems.map(({ label, icon: Icon }) => (
            <button key={label} type="button" className={`nav-item ${activeItem === label ? "active" : ""}`} onClick={() => onNavigate?.(label)}>
              <span className="nav-icon"><Icon size={15} strokeWidth={1.8} /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          className="sidebar-theme-toggle"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
        >
          {themeMode === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          <span>{themeMode === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="sidebar-user">
          <div className="user-avatar">SD</div>
          <div className="user-details"><strong>Subrat Dey</strong><span>P 360 User</span></div>
          <button type="button" className="logout-button" aria-label="Logout">↪</button>
        </div>
      </aside>
    </>
  );
};

export default Header;