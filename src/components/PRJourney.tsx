import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle2,
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  Calendar,
  Lightbulb,
  ArrowRight,
  Columns,
  List,
} from "lucide-react";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import { getDynamicPurchaseOrders } from "../Services/PurchaseOrderService";
import type { OrderRow } from "../data/OrdersData";
import "../Styles/PRJourney.css";

type Props = {
  onViewPending?: () => void;
};

function parseDateMs(value?: string | null): number | null {
  if (!value) return null;
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return new Date(Number(usMatch[3]), Number(usMatch[1]) - 1, Number(usMatch[2])).getTime();
  }
  const d = new Date(value);
  const t = d.getTime();
  return isNaN(t) ? null : t;
}

export default function PRJourney({ onViewPending }: Props) {
  const navigate = useNavigate();

  // Filters
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");

  // Dataverse state
  const [prs, setPrs] = useState<Cr49f_purchaserequests[]>([]);
  const [rfqs, setRfqs] = useState<Cr49f_requestforqoutations[]>([]);
  const [dynamicOrders, setDynamicOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [prsRes, rfqsRes, posRes] = await Promise.allSettled([
          Cr49f_purchaserequestsService.getAll(),
          Cr49f_requestforqoutationsService.getAll(),
          getDynamicPurchaseOrders(),
        ]);
        if (!active) return;
        if (prsRes.status === "fulfilled" && prsRes.value.success && prsRes.value.data) {
          setPrs(prsRes.value.data);
        }
        if (rfqsRes.status === "fulfilled" && rfqsRes.value.success && rfqsRes.value.data) {
          setRfqs(rfqsRes.value.data);
        }
        if (posRes.status === "fulfilled") {
          setDynamicOrders(posRes.value);
        }
      } catch (err) {
        console.warn("[PRJourney] Error loading Dataverse records:", err);
      }
    }

    void loadData();
    window.addEventListener("focus", loadData);
    return () => {
      active = false;
      window.removeEventListener("focus", loadData);
    };
  }, []);

  // Filter helper by date range
  const rangeDays = range === "all" ? null : Number(range);
  const now = useMemo(() => Date.now(), []);

  const isWithinRange = (dateStr?: string | null): boolean => {
    if (!rangeDays) return true;
    if (!dateStr) return true;
    const t = parseDateMs(dateStr);
    if (!t) return true;
    const diffDays = (now - t) / (1000 * 60 * 60 * 24);
    return diffDays <= rangeDays;
  };

  // Filtered PRs
  const activePrs = useMemo(() => {
    return (prs || []).filter((p) => p.statecode === 0 || p.statecode === undefined);
  }, [prs]);

  const filteredPrs = useMemo(() => {
    return activePrs.filter((p) => isWithinRange(p.createdon || p.overriddencreatedon));
  }, [activePrs, range]);

  // Filtered RFQs
  const activeRfqs = useMemo(() => {
    return (rfqs || []).filter((r) => r.statecode === 0 || r.statecode === undefined);
  }, [rfqs]);

  const filteredRfqs = useMemo(() => {
    return activeRfqs.filter((r) => isWithinRange(r.createdon || r.overriddencreatedon));
  }, [activeRfqs, range]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return (dynamicOrders || []).filter((o) => isWithinRange(o.createdOn));
  }, [dynamicOrders, range]);

  // Lifecycle Stage Counts (completely dynamic from real Dataverse records - NO fake static fallbacks)
  // 1. Created: Total PRs initiated in period
  const createdCount = filteredPrs.length;

  // 2. Under Review: PRs awaiting approval (status 0: Pending, 2: ChangesNeeded)
  const underReviewCount = useMemo(() => {
    return filteredPrs.filter(
      (p) => p.cr49f_status === 0 || p.cr49f_status === 2 || p.statuscode === 1
    ).length;
  }, [filteredPrs]);

  // 3. Approved: PRs approved
  const approvedCount = useMemo(() => {
    return filteredPrs.filter(
      (p) => p.cr49f_status === 1 || p.statuscode === 2
    ).length;
  }, [filteredPrs]);

  // 4. RFQ Initiated: RFQs entering sourcing
  const rfqCount = filteredRfqs.length;

  // 5. PO Created: Purchase orders generated
  const poCount = filteredOrders.length;

  // 6. Invoice Created: Orders with completed / invoice stage
  const invoiceCount = useMemo(() => {
    return filteredOrders.filter((o) => o.status === "Approved").length;
  }, [filteredOrders]);

  // Aging PRs for AI insight (pending > 7 days)
  const agingPrsCount = useMemo(() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return filteredPrs.filter((p) => {
      const isPending = p.cr49f_status === 0 || p.cr49f_status === 2 || p.statuscode === 1;
      if (!isPending) return false;
      const t = parseDateMs(p.createdon || p.overriddencreatedon);
      if (!t) return false;
      return (now - t) > sevenDaysMs;
    }).length;
  }, [filteredPrs, now]);

  // Stage configurations (compact & clickable)
  const stages = [
    {
      step: 1,
      label: "Created",
      count: createdCount,
      color: "blue",
      desc: "Purchase requests initiated",
      icon: <FileText size={18} />,
      onClick: () => navigate("/purchase-requests"),
    },
    {
      step: 2,
      label: "Under Review",
      count: underReviewCount,
      color: "amber",
      desc: "Currently awaiting review",
      icon: <Clock size={18} />,
      onClick: () => {
        if (onViewPending) {
          onViewPending();
        } else {
          navigate("/purchase-requests?status=In Review");
        }
      },
    },
    {
      step: 3,
      label: "Approved",
      count: approvedCount,
      color: "green",
      desc: "Requests approved",
      icon: <CheckCircle2 size={18} />,
      onClick: () => navigate("/purchase-requests?status=Approved"),
    },
    {
      step: 4,
      label: "RFQ Initiated",
      count: rfqCount,
      color: "purple",
      desc: "Requests entering sourcing",
      icon: <ClipboardList size={18} />,
      onClick: () => navigate("/rfqs"),
    },
    {
      step: 5,
      label: "PO Created",
      count: poCount,
      color: "orange",
      desc: "Purchase orders generated",
      icon: <ShoppingCart size={18} />,
      onClick: () => navigate("/orders"),
    },
    {
      step: 6,
      label: "Invoice Created",
      count: invoiceCount,
      color: "teal",
      desc: "Invoices generated",
      icon: <PackageCheck size={18} />,
      onClick: () => navigate("/orders"),
    },
  ];

  return (
    <section className="prj-panel" aria-label="Purchase Request Journey">
      {/* Header */}
      <header className="prj-head">
        <div className="prj-title-group">
          <div className="prj-icon-badge">
            <FileText size={20} />
          </div>
          <div className="prj-title-text">
            <h2>Purchase Request Journey</h2>
            <p>Track the status of all purchase requests from creation to invoice.</p>
          </div>
        </div>

        <div className="prj-controls">
          {/* View mode toggle (Horizontal vs Vertical) */}
          <div className="prj-view-toggle" role="group" aria-label="Journey layout toggle">
            <button
              type="button"
              className={`prj-toggle-btn ${viewMode === "horizontal" ? "active" : ""}`}
              onClick={() => setViewMode("horizontal")}
              title="Horizontal pipeline view"
              aria-label="Horizontal pipeline view"
            >
              <Columns size={14} />
            </button>
            <button
              type="button"
              className={`prj-toggle-btn ${viewMode === "vertical" ? "active" : ""}`}
              onClick={() => setViewMode("vertical")}
              title="Vertical timeline view"
              aria-label="Vertical timeline view"
            >
              <List size={14} />
            </button>
          </div>

          {/* Date range filter dropdown */}
          <div className="prj-select-wrap">
            <Calendar size={13} className="prj-select-icon" />
            <select
              className="prj-select"
              value={range}
              onChange={(e) => setRange(e.target.value as "7" | "30" | "90" | "all")}
              aria-label="Filter journey period"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content: Horizontal Pipeline (Image 2 style) or Vertical Timeline (Image 1 style) */}
      {viewMode === "horizontal" ? (
        <div className="prj-horizontal-flow">
          {/* Stepper connecting line */}
          <div className="prj-stepper-track" aria-hidden="true">
            {stages.map((stage, idx) => (
              <React.Fragment key={stage.label}>
                <div className="prj-step-pill">
                  <span className={`prj-step-num ${stage.color}`}>{stage.step}</span>
                  <span className="prj-step-label">{stage.label}</span>
                </div>
                {idx < stages.length - 1 && <span className="prj-step-line" />}
              </React.Fragment>
            ))}
          </div>

          {/* 6 Clickable Cards */}
          <div className="prj-cards-grid" role="list" aria-label="Purchase Request Lifecycle Stages">
            {stages.map((s) => (
              <div
                key={s.label}
                className="prj-card"
                role="listitem"
                tabIndex={0}
                onClick={s.onClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") s.onClick();
                }}
                title={`Click to view ${s.label} records`}
              >
                <div className="prj-card-head">
                  <div className={`prj-card-icon ${s.color}`}>{s.icon}</div>
                  <ArrowRight size={13} className="prj-card-drill" />
                </div>
                <strong className="prj-card-val">{s.count}</strong>
                <span className="prj-card-note">of {createdCount} total requests</span>
                <span className={`prj-card-accent ${s.color}`} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Vertical Timeline View (Image 1 style) */
        <div className="prj-vertical-flow" role="list" aria-label="Purchase Request Lifecycle Timeline">
          {stages.map((s) => (
            <div
              key={s.label}
              className="prj-vert-row"
              role="listitem"
              tabIndex={0}
              onClick={s.onClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") s.onClick();
              }}
              title={`Click to view ${s.label} records`}
            >
              <div className="prj-vert-left">
                <span className={`prj-vert-num ${s.color}`}>{s.step}</span>
                <div className="prj-vert-meta">
                  <span className="prj-vert-title">{s.label}</span>
                  <span className="prj-vert-desc">{s.desc}</span>
                </div>
              </div>
              <div className="prj-vert-right">
                <strong className="prj-vert-val">{s.count}</strong>
                <ArrowRight size={14} className="prj-vert-arrow" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Insight Footer Banner */}
      <div className="prj-ai-banner">
        <div className="prj-ai-content">
          <div className="prj-ai-icon">
            <Lightbulb size={14} />
          </div>
          <p className="prj-ai-text">
            <b>AI Insight:</b>{" "}
            {agingPrsCount > 0
              ? `${agingPrsCount} PR${agingPrsCount === 1 ? " is" : "s are"} pending in review for more than 7 days. Consider follow-up to avoid delays in procurement cycle.`
              : "All active purchase requests are progressing on schedule. No aging approval bottlenecks detected."}
          </p>
        </div>
        <button
          type="button"
          className="prj-ai-btn"
          onClick={() => {
            if (onViewPending) {
              onViewPending();
            } else {
              navigate("/purchase-requests?status=In Review");
            }
          }}
        >
          View Pending PRs <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
