import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  getSupplierInvitations,
  type SupplierRfqInvitation,
} from "../../Services/RfqSupplierResponseService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";

import "../../Styles/SupplierPortal.css";

interface SupplierRfqsPageProps {
  userEmail?: string;
  userName?: string;
  defaultFilter?: "All" | "Pending" | "Draft" | "Submitted" | "Rewarded";
}

export const SupplierRfqsPage: React.FC<SupplierRfqsPageProps> = ({
  userEmail,
  userName,
  defaultFilter = "All",
}) => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<SupplierRfqInvitation[]>([]);
  const [suppliersList, setSuppliersList] = useState<Cr49f_suppliers[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Cr49f_suppliers | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(defaultFilter);

  // 1. Resolve active supplier
  useEffect(() => {
    let isMounted = true;
    const initSupplier = async () => {
      try {
        setLoading(true);
        const suppRes = await Cr49f_suppliersService.getAll();
        const allSupp = suppRes.success && suppRes.data ? suppRes.data : [];

        if (isMounted) {
          setSuppliersList(allSupp);

          const matched = allSupp.find(
            (s) =>
              (userEmail && s.cr49f_email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && s.cr49f_contactperson?.toLowerCase() === userName.toLowerCase()) ||
              (userName && s.cr49f_name?.toLowerCase() === userName.toLowerCase())
          );

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

  // 2. Load invitations
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

  // Filtered invitations (sorted by date, newest first)
  const filteredInvitations = useMemo(() => {
    const list = invitations.filter((item) => {
      const matchesSearch =
        item.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "Pending") {
        return item.status === "Invited" && !item.isRewarded;
      }
      if (statusFilter === "Draft") {
        return item.status === "Draft" && !item.isRewarded;
      }
      if (statusFilter === "Submitted") {
        return item.status === "Submitted" && !item.isRewarded;
      }
      if (statusFilter === "Rewarded") {
        return item.status === "Rewarded" || Boolean(item.isRewarded);
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : 0;
      const timeB = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : 0;
      const validA = Number.isNaN(timeA) ? 0 : timeA;
      const validB = Number.isNaN(timeB) ? 0 : timeB;
      if (validA !== validB) return validB - validA;
      return (b.rfqNumber || "").localeCompare(a.rfqNumber || "");
    });
  }, [invitations, searchQuery, statusFilter]);

  return (
    <div className="supplier-portal-container">
      {/* Page Header */}
      <header className="supplier-portal-header">
        <div className="supplier-portal-title-wrap">
          <div className="supplier-portal-title-row">
            <h1 className="supplier-portal-title">RFQ Invitations &amp; Quotations</h1>
            <span className="supplier-badge-active">
              <ShieldCheck size={13} />
              {selectedSupplier?.cr49f_name || "Supplier"}
            </span>
          </div>
          <p className="supplier-portal-subtitle">
            View all Requests for Quotations invited to your organization and submit competitive bids.
          </p>
        </div>

        <div className="supplier-portal-header-actions">
          {suppliersList.length > 0 && (
            <div className="supplier-switcher-box" title="Switch active supplier profile">
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

      {/* Toolbar: Search + Filter Tabs */}
      <div className="supplier-table-toolbar">
        <div className="supplier-search-input-wrap">
          <Search size={14} color="#64748b" />
          <input
            type="text"
            className="supplier-search-input"
            placeholder="Search by RFQ number, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="supplier-filter-tabs">
          <button
            type="button"
            className={`supplier-filter-tab ${statusFilter === "All" ? "active" : ""}`}
            onClick={() => setStatusFilter("All")}
          >
            All ({invitations.length})
          </button>
          <button
            type="button"
            className={`supplier-filter-tab ${statusFilter === "Pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("Pending")}
          >
            Invited ({invitations.filter((i) => i.status === "Invited" && !i.isRewarded).length})
          </button>
          <button
            type="button"
            className={`supplier-filter-tab ${statusFilter === "Draft" ? "active" : ""}`}
            onClick={() => setStatusFilter("Draft")}
          >
            Drafts ({invitations.filter((i) => i.status === "Draft" && !i.isRewarded).length})
          </button>
          <button
            type="button"
            className={`supplier-filter-tab ${statusFilter === "Submitted" ? "active" : ""}`}
            onClick={() => setStatusFilter("Submitted")}
          >
            Submitted ({invitations.filter((i) => i.status === "Submitted" && !i.isRewarded).length})
          </button>
          <button
            type="button"
            className={`supplier-filter-tab ${statusFilter === "Rewarded" ? "active" : ""}`}
            onClick={() => setStatusFilter("Rewarded")}
          >
            Rewarded ({invitations.filter((i) => i.status === "Rewarded" || i.isRewarded).length})
          </button>
        </div>
      </div>

      {/* RFQ Listing Table */}
      <div className="supplier-table-wrapper">
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
            <RefreshCw size={22} className="rfq-spinner" style={{ margin: "0 auto 10px" }} />
            Loading RFQ invitations...
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: "center", color: "#dc2626" }}>
            <AlertCircle size={22} style={{ margin: "0 auto 10px" }} />
            {error}
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
            <Mail size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
              No RFQs Match Your Criteria
            </div>
            <p style={{ fontSize: 13, margin: 0 }}>
              Try clearing your search filters or check back later for new procurement invitations.
            </p>
          </div>
        ) : (
          <table className="supplier-table">
            <thead>
              <tr>
                <th>RFQ Number</th>
                <th>Title &amp; Scope Description</th>
                <th>Delivery Location</th>
                <th>Invited On</th>
                <th>Deadline</th>
                <th>Response Status</th>
                <th>Quoted Value</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvitations.map((inv) => (
                <tr key={inv.rfqId}>
                  <td>
                    <span className="supplier-rfq-num">{inv.rfqNumber}</span>
                  </td>
                  <td>
                    <div className="supplier-rfq-title-cell">
                      <span className="supplier-rfq-title">{inv.title}</span>
                      <span className="supplier-rfq-desc">{inv.description}</span>
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
                    <span
                      className={`supplier-status-pill ${
                        inv.status === "Rewarded" || inv.isRewarded
                          ? "rewarded"
                          : inv.status.toLowerCase()
                      }`}
                    >
                      {inv.status === "Rewarded" || inv.isRewarded ? (
                        <Award size={11} />
                      ) : inv.status === "Submitted" ? (
                        <CheckCircle2 size={11} />
                      ) : inv.status === "Draft" ? (
                        <Clock size={11} />
                      ) : (
                        <Mail size={11} />
                      )}
                      {inv.status === "Rewarded" || inv.isRewarded ? "Rewarded" : inv.status}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {inv.totalAmount && inv.totalAmount > 0
                        ? `₹${inv.totalAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "—"}
                    </strong>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className={`supplier-btn-action ${
                        inv.status === "Rewarded" || inv.isRewarded || inv.status === "Submitted"
                          ? ""
                          : "primary"
                      }`}
                      onClick={() => navigate(`/supplier-rfqs/${inv.rfqId}`)}
                    >
                      {inv.status === "Rewarded" || inv.isRewarded ? (
                        <>
                          <Award size={12} />
                          View Award
                        </>
                      ) : inv.status === "Submitted" ? (
                        <>
                          <FileText size={12} />
                          View Quotation
                        </>
                      ) : inv.status === "Draft" ? (
                        <>
                          <Clock size={12} />
                          Resume Draft
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
        )}
      </div>
    </div>
  );
};

export default SupplierRfqsPage;
