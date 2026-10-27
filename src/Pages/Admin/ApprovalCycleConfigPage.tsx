import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  Settings2,
  Workflow,
} from "lucide-react";
import "../../Styles/AdminPages.css";

interface ApprovalTier {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  approvers: string[];
  slaHours: number;
  status: "Active" | "Draft";
}

const defaultTiers: ApprovalTier[] = [
  {
    id: "TIER-1",
    name: "Standard Purchases (Low Value)",
    minAmount: 0,
    maxAmount: 5000,
    approvers: ["Direct Manager", "Department Lead"],
    slaHours: 24,
    status: "Active",
  },
  {
    id: "TIER-2",
    name: "Mid-Value Procurement",
    minAmount: 5000,
    maxAmount: 25000,
    approvers: ["Department Head", "Finance Controller"],
    slaHours: 48,
    status: "Active",
  },
  {
    id: "TIER-3",
    name: "Executive & Strategic Capex",
    minAmount: 25000,
    maxAmount: null,
    approvers: ["VP of Finance", "Chief Procurement Officer (CPO)"],
    slaHours: 72,
    status: "Active",
  },
];

const ApprovalCycleConfigPage: React.FC = () => {
  const [tiers] = useState<ApprovalTier[]>(defaultTiers);

  return (
    <div className="admin-page-container">
      {/* HEADER */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">
            <Workflow size={14} />
            <span>WORKFLOW CONFIGURATION</span>
          </div>
          <h1 className="admin-title">Approval Cycle Configuration</h1>
          <p className="admin-subtitle">
            Configure multi-tier approval matrix, monetary thresholds, SLA
            deadlines, and routing logic for purchase requests.
          </p>
        </div>

        <div className="admin-actions">
          <button type="button" className="admin-btn admin-btn-primary">
            <Plus size={15} />
            <span>New Approval Tier</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <Layers size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Tiers</span>
            <strong className="admin-stat-value">{tiers.length}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <CheckCircle2 size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Automation Rate</span>
            <strong className="admin-stat-value">94.8%</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <Clock size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Average SLA</span>
            <strong className="admin-stat-value">48 Hours</strong>
          </div>
        </div>
      </div>

      {/* WORKFLOW TIERS LIST */}
      <div className="admin-cycle-list">
        {tiers.map((tier, idx) => (
          <div key={tier.id} className="admin-cycle-card">
            <div className="admin-cycle-card-header">
              <div className="admin-cycle-badge-wrap">
                <span className="admin-cycle-step-pill">Tier {idx + 1}</span>
                <span className="admin-status-pill active">{tier.status}</span>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ height: 30, padding: "0 10px", fontSize: 11 }}
              >
                <Settings2 size={13} />
                <span>Configure Rules</span>
              </button>
            </div>

            <div className="admin-cycle-body">
              <h3>{tier.name}</h3>
              <p className="admin-cycle-threshold">
                Threshold:{" "}
                <strong>
                  ${tier.minAmount.toLocaleString()}
                  {tier.maxAmount ? ` – $${tier.maxAmount.toLocaleString()}` : "+"}
                </strong>
                {" · "}
                SLA: <strong>{tier.slaHours}h response time</strong>
              </p>

              <div className="admin-cycle-steps">
                <span className="admin-cycle-steps-title">
                  Approval Route Sequence:
                </span>
                <div className="admin-cycle-chain">
                  {tier.approvers.map((approver, aIdx) => (
                    <React.Fragment key={approver}>
                      <div className="admin-cycle-node">
                        <span className="admin-cycle-node-num">{aIdx + 1}</span>
                        <span>{approver}</span>
                      </div>
                      {aIdx < tier.approvers.length - 1 && (
                        <span className="admin-cycle-arrow">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApprovalCycleConfigPage;
