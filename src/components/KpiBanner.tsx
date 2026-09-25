import React from "react";
import type { KpiItem } from "../types/dashboard";

const kpis: KpiItem[] = [
  {
    label: "Purchase Requests",
    value: "42",
    icon: "cart",
  },
  {
    label: "RFQs",
    value: "43",
    icon: "quote",
  },
  {
    label: "Orders",
    value: "20",
    icon: "order",
  },
  {
    label: "Invoice Submissions",
    value: "18",
    icon: "invoice",
  },
  {
    label: "Allocated Budget",
    value: "USD 10.00M",
    icon: "budget",
  },
  {
    label: "Remaining Budget",
    value: "USD 9.90M",
    icon: "money",
  },
];

const Icon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case "cart":
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M4 6H8L11 21H25L28 11H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13" cy="26" r="2" fill="currentColor" />
          <circle cx="23" cy="26" r="2" fill="currentColor" />
        </svg>
      );

    case "quote":
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <rect
            x="4"
            y="6"
            width="24"
            height="18"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M10 13H14M10 18H14M18 13H22M18 18H22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "order":
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M4 7H8L11 22H25L28 12H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="13" cy="27" r="2" fill="currentColor" />
          <circle cx="23" cy="27" r="2" fill="currentColor" />
          <path
            d="M16 7V3M12 5L16 1L20 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "invoice":
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <rect
            x="6"
            y="4"
            width="20"
            height="24"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M10 10H22M10 15H22M10 20H18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "budget":
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <rect
            x="4"
            y="8"
            width="24"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M9 8V5H23V8"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="16"
            cy="16"
            r="4"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 32 32" fill="none">
          <rect
            x="4"
            y="8"
            width="24"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M9 16H23"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
  }
};

const KpiBanner: React.FC = () => {
  return (
    <section className="kpi-banner">
      {kpis.map((kpi) => (
        <div className="kpi-card" key={kpi.label}>
          <div className="kpi-icon">
            <Icon type={kpi.icon} />
          </div>

          <div className="kpi-content">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default KpiBanner;