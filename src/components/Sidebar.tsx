import React from "react";
import {
  ClipboardList,
  FileSignature,
  Home,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Workflow,
} from "lucide-react";

export const adminNavigationItems = [
  { label: "Dashboard", icon: Home },
  { label: "Users", icon: Users },
  { label: "Approval Cycle", icon: Workflow },
];

export const userNavigationItems = [
  { label: "Dashboard", icon: Home },
  { label: "Purchase Requests", icon: ShoppingCart },
  { label: "RFQs", icon: ClipboardList },
  { label: "Orders", icon: ShoppingBag },
  { label: "Invoices", icon: ReceiptText },
  { label: "Products / Services", icon: PackageSearch },
  { label: "Suppliers", icon: Truck },
  { label: "Contracts", icon: FileSignature },
];

export interface SidebarProps {
  activeItem: string;
  onNavigate?: (item: string) => void;
  isAdmin?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  onNavigate,
  isAdmin = false,
}) => {
  const items = isAdmin ? adminNavigationItems : userNavigationItems;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">X</span>
        <strong>Xebia</strong>
      </div>
      <nav className="side-navigation" aria-label="Main navigation">
        {items.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${activeItem === label ? "active" : ""}`}
            onClick={() => onNavigate?.(label)}
          >
            <span className="nav-icon">
              <Icon size={15} strokeWidth={1.8} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
