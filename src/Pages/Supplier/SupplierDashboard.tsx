import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import {
  getSupplierInvitations,
  type SupplierRfqInvitation,
} from "../../Services/RfqSupplierResponseService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";

import "../../Styles/SupplierPortal.css";

interface SupplierDashboardProps {
  userEmail?: string;
  userName?: string;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({
  userEmail,
  userName,
}) => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<SupplierRfqInvitation[]>([]);
  const [suppliersList, setSuppliersList] = useState<Cr49f_suppliers[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Cr49f_suppliers | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Resolve Supplier identity
  useEffect(() => {
    let isMounted = true;
    const initSupplier = async () => {
      try {
        setLoading(true);
        const suppRes = await Cr49f_suppliersService.getAll();
        const allSupp = suppRes.success && suppRes.data ? suppRes.data : [];

        if (isMounted) {
          setSuppliersList(allSupp);

          // Find match by email or contact person
          const matched = allSupp.find(
            (s) =>
              (userEmail && s.cr49f_email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && s.cr49f_contactperson?.toLowerCase() === userName.toLowerCase()) ||
              (userName && s.cr49f_name?.toLowerCase() === userName.toLowerCase())
          );

          // If no direct email match (e.g. testing with admin user), use first supplier or saved preference
          const savedSupId = localStorage.getItem("procurement360_active_supplier_id");
          const preferred =
            (savedSupId && allSupp.find((s) => s.cr49f_supplierid === savedSupId || s.cr49f_supplierid1 === savedSupId)) ||
            matched ||
            allSupp[0] ||
            null;

          setSelectedSupplier(preferred);
        }
      } catch (err) {
        console.warn("Failed to load suppliers:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void initSupplier();
    return () => {
      isMounted = false;
    };
  }, [userEmail, userName]);

  // 2. Load invitations for the active supplier
  useEffect(() => {
    let isMounted = true;
    if (!selectedSupplier) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const supId = selectedSupplier.cr49f_supplierid1 || selectedSupplier.cr49f_supplierid;
        const invs = await getSupplierInvitations(supId, selectedSupplier.cr49f_email);

        if (isMounted) {
          setInvitations(invs);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load supplier RFQs.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedSupplier]);

  const handleSupplierChange = (supId: string) => {
    const chosen = suppliersList.find(
      (s) => s.cr49f_supplierid === supId || s.cr49f_supplierid1 === supId
    );
    if (chosen) {
      setSelectedSupplier(chosen);
      localStorage.setItem("procurement360_active_supplier_id", chosen.cr49f_supplierid1 || chosen.cr49f_supplierid);
    }
  };

  // KPIs
  const totalInvitations = invitations.length;
  const pendingQuotations = invitations.filter((i) => i.status !== "Submitted").length;
  const submittedBids = invitations.filter((i) => i.status === "Submitted").length;
  const totalQuotedValue = invitations
    .filter((i) => i.status === "Submitted")
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  return (
    <div className="supplier-portal-container">
      {/* Top Header */}
      <header className="supplier-portal-header">
        <div className="supplier-portal-title-wrap">
          <div className="supplier-portal-title-row">
            <h1 className="supplier-portal-title">Supplier Portal</h1>
            <span className="supplier-badge-active">
              <ShieldCheck size={13} />
              Verified Vendor
            </span>
          </div>
          <p className="supplier-portal-subtitle">
            Welcome, <strong>{selectedSupplier?.cr49f_name || userName || "Supplier"}</strong>. Manage your invited RFQs and submit quotations.
          </p>
        </div>

        <div className="supplier-portal-header-actions">
          {/* Supplier Switcher (Helps testing between different invited suppliers) */}
          {suppliersList.length > 0 && (
            <div className="supplier-switcher-box" title="Switch active supplier profile for testing">
              <Building2 size={14} color="#64748b" />
              <select
                className="supplier-switcher-select"
                value={selectedSupplier?.cr49f_supplierid1 || selectedSupplier?.cr49f_supplierid || ""}
                onChange={(e) => handleSupplierChange(e.target.value)}
              >
                {suppliersList.map((sup) => (
                  <option
                    key={sup.cr49f_supplierid}
                    value={sup.cr49f_supplierid1 || sup.cr49f_supplierid}
                  >
                    {sup.cr49f_name} ({sup.cr49f_supplierid1 || "SUP"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="supplier-btn-action"
            onClick={() => {
              if (selectedSupplier) {
                const supId = selectedSupplier.cr49f_supplierid1 || selectedSupplier.cr49f_supplierid;
                void getSupplierInvitations(supId, selectedSupplier.cr49f_email).then(setInvitations);
              }
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="supplier-kpi-grid">
        <div className="supplier-kpi-card">
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Active RFQ Invitations</span>
            <span className="supplier-kpi-val">{totalInvitations}</span>
          </div>
          <div className="supplier-kpi-icon-wrap blue">
            <Mail size={20} />
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Awaiting Quotation</span>
            <span className="supplier-kpi-val">{pendingQuotations}</span>
          </div>
          <div className="supplier-kpi-icon-wrap amber">
            <Clock size={20} />
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Submitted Quotations</span>
            <span className="supplier-kpi-val">{submittedBids}</span>
          </div>
          <div className="supplier-kpi-icon-wrap emerald">
            <FileCheck2 size={20} />
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Total Quoted Value</span>
            <span className="supplier-kpi-val">
              ${totalQuotedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="supplier-kpi-icon-wrap purple">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Recent RFQs Section */}
      <div className="supplier-editor-card">
        <div className="supplier-editor-header">
          <div className="supplier-editor-title">
            <FileText size={15} color="#2563eb" />
            Recent RFQ Invitations
          </div>
          <button
            type="button"
            className="supplier-btn-action"
            onClick={() => navigate("/supplier-rfqs")}
          >
            View All ({invitations.length})
            <ChevronRight size={13} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            <RefreshCw size={20} className="rfq-spinner" style={{ margin: "0 auto 8px" }} />
            Loading RFQ invitations...
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>
            <AlertCircle size={20} style={{ margin: "0 auto 8px" }} />
            {error}
          </div>
        ) : invitations.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <Mail size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
              No RFQ Invitations Found
            </div>
            <p style={{ fontSize: 13, margin: 0 }}>
              Your supplier account currently has no active RFQ invitations.
            </p>
          </div>
        ) : (
          <div className="supplier-table-wrapper" style={{ border: "none" }}>
            <table className="supplier-table">
              <thead>
                <tr>
                  <th>RFQ Number &amp; Title</th>
                  <th>Location</th>
                  <th>Invited On</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Quoted Value</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.slice(0, 5).map((inv) => (
                  <tr key={inv.rfqId}>
                    <td>
                      <div className="supplier-rfq-title-cell">
                        <span className="supplier-rfq-num">{inv.rfqNumber}</span>
                        <span className="supplier-rfq-title">{inv.title}</span>
                      </div>
                    </td>
                    <td>{inv.deliveryLocation}</td>
                    <td>{new Date(inv.invitationDate).toLocaleDateString()}</td>
                    <td>
                      {inv.submissionDeadline
                        ? new Date(inv.submissionDeadline).toLocaleDateString()
                        : "Open"}
                    </td>
                    <td>
                      <span className={`supplier-status-pill ${inv.status.toLowerCase()}`}>
                        {inv.status === "Submitted" ? (
                          <CheckCircle2 size={11} />
                        ) : inv.status === "Draft" ? (
                          <Clock size={11} />
                        ) : (
                          <Mail size={11} />
                        )}
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {inv.totalAmount && inv.totalAmount > 0
                          ? `$${inv.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`supplier-btn-action ${inv.status === "Submitted" ? "" : "primary"}`}
                        onClick={() => navigate(`/supplier-rfqs/${inv.rfqId}`)}
                      >
                        {inv.status === "Submitted" ? (
                          <>
                            <FileText size={12} />
                            View Quotation
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            Respond
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierDashboard;
