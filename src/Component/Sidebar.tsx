import {
  BarChart3,
  ClipboardList,
  FileText,
  Home,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";

import "./Sidebar.css";

const menuItems = [
  { label: "Dashboard", icon: Home, path: "/dashboard" },
  { label: "Purchase Requests", icon: ShoppingCart, path: "/purchase-requests" },
  { label: "RFQs", icon: ClipboardList, path: "/rfqs" },
  { label: "Orders", icon: Package, path: "/orders" },
  { label: "Invoices", icon: FileText, path: "/invoices" },
  { label: "Products / Services", icon: BarChart3, path: "/products-services" },
  { label: "Suppliers", icon: Users, path: "/suppliers" },
  { label: "Contracts", icon: FileText, path: "/contracts" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="procurement-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-x">X</div>
        <span>Xebia</span>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);

          return (
            <button
              key={item.label}
              type="button"
              className={`sidebar-menu-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={13} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-profile">
        <div className="sidebar-profile-avatar">SD</div>
        <div className="sidebar-profile-info">
          <strong>Subrat Dey</strong>
          <span>P 360 User</span>
        </div>
        <button type="button" className="sidebar-profile-action">↪</button>
      </div>
    </aside>
  );
}
