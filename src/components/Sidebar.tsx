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
  { label: "Users", icon: Users },
  { label: "Approval Cycle", icon: Workflow },
  { label: "Products / Services", icon: PackageSearch },
  { label: "Suppliers", icon: Truck },
];

export const userNavigationItems = [
  { label: "Dashboard", icon: Home },
  { label: "Purchase Requests", icon: ShoppingCart },
  { label: "RFQs", icon: ClipboardList },
  { label: "Orders", icon: ShoppingBag },
  { label: "Suppliers", icon: Truck },
  { label: "Invoices", icon: ReceiptText },
  { label: "Contracts", icon: FileSignature },
];

export const supplierNavigationItems = [
  { label: "Dashboard", icon: Home },
  { label: "My RFQs", icon: ClipboardList },
  { label: "My Quotations", icon: FileSignature },
];

export interface SidebarProps {
  activeItem: string;
  onNavigate?: (item: string) => void;
  isAdmin?: boolean;
  isSupplier?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  onNavigate,
  isAdmin = false,
  isSupplier = false,
}) => {
  const items = isSupplier
    ? supplierNavigationItems
    : isAdmin
    ? adminNavigationItems
    : userNavigationItems;

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
