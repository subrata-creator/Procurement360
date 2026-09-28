import React from "react";

const navigationItems = [
  "Dashboard",
  "Purchase Requests",
  "RFQs",
  "Orders",
  "Invoices",
  "Products / Services",
  "Suppliers",
  "Contracts",
];

interface HeaderProps {
  activeItem: string;
  onNavigate?: (item: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  activeItem,
  onNavigate,
}) => {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="brand-mark">X</span><strong>Xebia</strong></div>
        <nav className="side-navigation" aria-label="Main navigation">
          {navigationItems.map((item, index) => (
            <button key={item} type="button" className={`nav-item ${activeItem === item ? "active" : ""}`} onClick={() => onNavigate?.(item)}>
              <span className="nav-icon">{["⌂", "🛒", "▣", "▱", "▤", "◇", "♧", "▱"][index]}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>
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