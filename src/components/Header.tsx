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
    <header className="app-header">
      <div className="brand-section">
        <div className="xebia-logo">Xebia</div>
      </div>

      <nav className="main-navigation">
        {navigationItems.map((item) => (
          <button
            key={item}
            type="button"
            className={`nav-item ${
              activeItem === item ? "active" : ""
            }`}
            onClick={() => onNavigate?.(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="user-section">
        <div className="user-divider" />

        <div className="user-avatar">
          <span>SP</span>
        </div>

        <div className="user-details">
          <div className="user-name">Sakshi Paliwal</div>
          <div className="user-role">P 360 User</div>
        </div>

        <button
          type="button"
          className="logout-button"
          aria-label="Logout"
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M10 17L15 12L10 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 12H3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M21 19V5C21 3.89543 20.1046 3 19 3H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;