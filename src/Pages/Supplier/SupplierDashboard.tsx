import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tag,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";

import {
  getSupplierInvitations,
  type SupplierRfqInvitation,
} from "../../Services/RfqSupplierResponseService";
import { Cr49f_suppliersService } from "../../generated/services/Cr49f_suppliersService";
import type { Cr49f_suppliers } from "../../generated/models/Cr49f_suppliersModel";
import { Cr49f_supplierscr49f_paymentterms } from "../../generated/models/Cr49f_suppliersModel";
import { Cr49f_supplierproductsService } from "../../generated/services/Cr49f_supplierproductsService";
import type { Cr49f_supplierproducts } from "../../generated/models/Cr49f_supplierproductsModel";
import { cleanGuid } from "../../Services/ApprovalWorkflowService";

import "../../Styles/SupplierPortal.css";

interface SupplierDashboardProps {
  userEmail?: string;
  userName?: string;
}

const getPaymentTermsLabel = (terms?: number): string => {
  if (!terms) return "Net 30 Days";
  return (
    Cr49f_supplierscr49f_paymentterms[
      terms as keyof typeof Cr49f_supplierscr49f_paymentterms
    ] || "Net 30 Days"
  );
};

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({
  userEmail,
  userName,
}) => {
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState<SupplierRfqInvitation[]>([]);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [suppliersList, setSuppliersList] = useState<Cr49f_suppliers[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Cr49f_suppliers | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: "rfqs" | "products"
  const [activeTab, setActiveTab] = useState<"rfqs" | "products">("rfqs");

  // RFQ filtering & search
  const [rfqSearch, setRfqSearch] = useState<string>("");
  const [rfqStatusFilter, setRfqStatusFilter] = useState<"All" | "Pending" | "Submitted" | "Rewarded">("All");

  // Products filtering & search
  const [productSearch, setProductSearch] = useState<string>("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("All");

  // 1. Resolve Active Supplier Identity
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
            (savedSupId &&
              allSupp.find(
                (s) => s.cr49f_supplierid === savedSupId || s.cr49f_supplierid1 === savedSupId
              )) ||
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

  // 2. Load Invitations & Supplier Products for Active Supplier
  const loadSupplierData = async (isManual = false) => {
    if (!selectedSupplier) return;
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const supId = selectedSupplier.cr49f_supplierid1 || selectedSupplier.cr49f_supplierid;
      const supGuid = cleanGuid(selectedSupplier.cr49f_supplierid);
      const supCode = (selectedSupplier.cr49f_supplierid1 || "").toLowerCase().trim();
      const supName = (selectedSupplier.cr49f_name || "").toLowerCase().trim();

      // Parallel fetch from Dataverse tables:
      // 1. Selected Suppliers + RFQs + Supplier Responses (via getSupplierInvitations)
      // 2. Supplier Product catalog (via Cr49f_supplierproductsService)
      const [invsRes, prodsRes] = await Promise.allSettled([
        getSupplierInvitations(supId, selectedSupplier.cr49f_email),
        Cr49f_supplierproductsService.getAll(),
      ]);

      if (invsRes.status === "fulfilled") {
        setInvitations(invsRes.value);
      } else {
        console.warn("Error loading RFQ invitations:", invsRes.reason);
      }

      if (prodsRes.status === "fulfilled" && prodsRes.value.success && prodsRes.value.data) {
        const allProds = prodsRes.value.data;
        const matched = allProds.filter((p) => {
          const raw = p as unknown as Record<string, unknown>;
          const pSupGuid =
            cleanGuid(p._cr49f_supplier_value) ||
            cleanGuid(raw._cr49f_Supplier_value as string) ||
            cleanGuid(raw.cr49f_Supplier as string) ||
            cleanGuid(raw.cr49f_supplier as string);
          const pSupCode = String(
            raw.cr49f_suppliernumber || raw.cr49f_suppliercode || ""
          ).toLowerCase().trim();
          const pSupName = String(raw.cr49f_suppliername || "").toLowerCase().trim();

          return (
            (supGuid && pSupGuid === supGuid) ||
            (supCode && pSupCode === supCode) ||
            (supName && pSupName === supName)
          );
        });

        setProducts(matched);
      } else {
        setProducts([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load supplier dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSupplierData();
  }, [selectedSupplier]);

  const handleSupplierChange = (supId: string) => {
    const chosen = suppliersList.find(
      (s) => s.cr49f_supplierid === supId || s.cr49f_supplierid1 === supId
    );
    if (chosen) {
      setSelectedSupplier(chosen);
      localStorage.setItem(
        "procurement360_active_supplier_id",
        chosen.cr49f_supplierid1 || chosen.cr49f_supplierid
      );
    }
  };

  // KPIs
  const totalRfqs = invitations.length;
  const totalProducts = products.length;
  const rewardedRfqs = invitations.filter((i) => i.status === "Rewarded" || i.isRewarded).length;
  const pendingRfqs = invitations.filter(
    (i) => i.status !== "Rewarded" && !i.isRewarded && (i.status === "Invited" || i.status === "Draft")
  ).length;
  const submittedRfqs = invitations.filter((i) => i.status === "Submitted").length;

  // Filtered RFQs list
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch =
        !rfqSearch ||
        inv.rfqNumber.toLowerCase().includes(rfqSearch.toLowerCase()) ||
        inv.title.toLowerCase().includes(rfqSearch.toLowerCase()) ||
        inv.deliveryLocation.toLowerCase().includes(rfqSearch.toLowerCase());

      const matchesStatus =
        rfqStatusFilter === "All"
          ? true
          : rfqStatusFilter === "Rewarded"
          ? inv.status === "Rewarded" || inv.isRewarded
          : rfqStatusFilter === "Pending"
          ? inv.status !== "Rewarded" && !inv.isRewarded && (inv.status === "Invited" || inv.status === "Draft")
          : inv.status === rfqStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invitations, rfqSearch, rfqStatusFilter]);

  // Unique product categories
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.cr49f_category) cats.add(p.cr49f_category);
    });
    return ["All", ...Array.from(cats)];
  }, [products]);

  // Filtered Products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !productSearch ||
        (p.cr49f_productname && p.cr49f_productname.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.cr49f_supplierproductnumber &&
          p.cr49f_supplierproductnumber.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.cr49f_category && p.cr49f_category.toLowerCase().includes(productSearch.toLowerCase()));

      const matchesCategory =
        productCategoryFilter === "All" || p.cr49f_category === productCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, productSearch, productCategoryFilter]);

  return (
    <div className="supplier-portal-container">
      {/* Top Header & Welcome Banner */}
      <header className="supplier-dashboard-header">
        <div className="supplier-dashboard-title-wrap">
          <div className="supplier-dashboard-title-row">
            <h1 className="supplier-portal-title">Dashboard</h1>
            <span className="supplier-badge-active">
              <ShieldCheck size={14} />
              Verified Supplier
            </span>
          </div>
          <p className="supplier-portal-subtitle">
            Welcome back, <strong>{selectedSupplier?.cr49f_name || userName || "Supplier"}</strong>. Overview of your product catalog and RFQ bidding activity.
          </p>

          {/* Supplier Profile Meta Pills */}
          {selectedSupplier && (
            <div className="supplier-profile-meta-pills">
              <span className="supplier-meta-pill">
                <Building2 size={12} />
                Code: <strong>{selectedSupplier.cr49f_supplierid1 || "SUP"}</strong>
              </span>
              {selectedSupplier.cr49f_email && (
                <span className="supplier-meta-pill">
                  <Mail size={12} />
                  {selectedSupplier.cr49f_email}
                </span>
              )}
              {selectedSupplier.cr49f_paymentterms && (
                <span className="supplier-meta-pill">
                  Payment: <strong>{getPaymentTermsLabel(selectedSupplier.cr49f_paymentterms)}</strong>
                </span>
              )}
              {selectedSupplier.cr49f_city && (
                <span className="supplier-meta-pill">
                  <MapPin size={12} />
                  {selectedSupplier.cr49f_city}
                  {selectedSupplier.cr49f_country ? `, ${selectedSupplier.cr49f_country}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="supplier-portal-header-actions">
          {/* Supplier Switcher (for testing/multi-vendor evaluation) */}
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
            onClick={() => loadSupplierData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={13} className={refreshing ? "rfq-spinner" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* 4 KPI Cards Grid */}
      <div className="supplier-kpi-grid">
        {/* KPI 1: Total RFQs */}
        <div
          className={`supplier-kpi-card interactive ${activeTab === "rfqs" && rfqStatusFilter === "All" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("All");
          }}
          role="button"
          tabIndex={0}
          title="Click to view all assigned RFQs"
        >
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Total RFQs</span>
            <span className="supplier-kpi-val">{totalRfqs}</span>
            <span className="supplier-kpi-subtext">Assigned &amp; invited requests</span>
          </div>
          <div className="supplier-kpi-icon-wrap blue">
            <ClipboardList size={22} />
          </div>
        </div>

        {/* KPI 2: Total Products */}
        <div
          className={`supplier-kpi-card interactive ${activeTab === "products" ? "selected" : ""}`}
          onClick={() => setActiveTab("products")}
          role="button"
          tabIndex={0}
          title="Click to view your product catalog"
        >
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Total Products</span>
            <span className="supplier-kpi-val">{totalProducts}</span>
            <span className="supplier-kpi-subtext">In your supplier catalog</span>
          </div>
          <div className="supplier-kpi-icon-wrap purple">
            <Package size={22} />
          </div>
        </div>

        {/* KPI 3: Rewarded RFQ */}
        <div
          className={`supplier-kpi-card interactive ${activeTab === "rfqs" && rfqStatusFilter === "Rewarded" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("Rewarded");
          }}
          role="button"
          tabIndex={0}
          title="Click to view rewarded RFQs"
        >
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Rewarded RFQ</span>
            <span className="supplier-kpi-val" style={{ color: "#059669" }}>
              {rewardedRfqs}
            </span>
            <span className="supplier-kpi-subtext">Successfully awarded bids</span>
          </div>
          <div className="supplier-kpi-icon-wrap emerald">
            <Award size={22} />
          </div>
        </div>

        {/* KPI 4: Pending RFQ */}
        <div
          className={`supplier-kpi-card interactive ${activeTab === "rfqs" && rfqStatusFilter === "Pending" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("Pending");
          }}
          role="button"
          tabIndex={0}
          title="Click to view pending RFQs"
        >
          <div className="supplier-kpi-info">
            <span className="supplier-kpi-label">Pending RFQ</span>
            <span className="supplier-kpi-val" style={{ color: "#d97706" }}>
              {pendingRfqs}
            </span>
            <span className="supplier-kpi-subtext">Awaiting quote or decision</span>
          </div>
          <div className="supplier-kpi-icon-wrap amber">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Interactive Tabs Header */}
      <div className="supplier-dashboard-tabs-bar">
        <button
          type="button"
          className={`supplier-dashboard-tab-btn ${activeTab === "rfqs" ? "active" : ""}`}
          onClick={() => setActiveTab("rfqs")}
        >
          <ClipboardList size={16} />
          <span>Assigned &amp; Invited RFQs</span>
          <span className="supplier-tab-count-badge">{invitations.length}</span>
        </button>

        <button
          type="button"
          className={`supplier-dashboard-tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          <Package size={16} />
          <span>Supplier Products Catalog</span>
          <span className="supplier-tab-count-badge">{products.length}</span>
        </button>
      </div>

      {/* TAB 1: Assigned RFQs Table */}
      {activeTab === "rfqs" && (
        <div className="supplier-dashboard-card">
          {/* Table Toolbar */}
          <div className="supplier-table-toolbar">
            <div className="supplier-search-input-wrap">
              <Search size={14} color="#64748b" />
              <input
                type="text"
                className="supplier-search-input"
                placeholder="Search RFQ by ID, title, delivery location..."
                value={rfqSearch}
                onChange={(e) => setRfqSearch(e.target.value)}
              />
            </div>

            <div className="supplier-filter-tabs">
              <button
                type="button"
                className={`supplier-filter-tab ${rfqStatusFilter === "All" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("All")}
              >
                All ({invitations.length})
              </button>
              <button
                type="button"
                className={`supplier-filter-tab ${rfqStatusFilter === "Pending" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Pending")}
              >
                Pending ({pendingRfqs})
              </button>
              <button
                type="button"
                className={`supplier-filter-tab ${rfqStatusFilter === "Submitted" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Submitted")}
              >
                Submitted ({submittedRfqs})
              </button>
              <button
                type="button"
                className={`supplier-filter-tab ${rfqStatusFilter === "Rewarded" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Rewarded")}
              >
                Rewarded ({rewardedRfqs})
              </button>
            </div>
          </div>

          {/* Table Body */}
          <div className="supplier-table-wrapper">
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
                <RefreshCw size={24} className="rfq-spinner" style={{ margin: "0 auto 12px" }} />
                Loading assigned RFQs from Dataverse...
              </div>
            ) : error ? (
              <div style={{ padding: 32, textAlign: "center", color: "#dc2626" }}>
                <AlertCircle size={24} style={{ margin: "0 auto 10px" }} />
                {error}
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
                <Mail size={36} style={{ margin: "0 auto 12px", opacity: 0.35 }} />
                <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  No RFQs Found
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {rfqSearch || rfqStatusFilter !== "All"
                    ? "Try adjusting your search query or status filter."
                    : "No RFQ invitations have been assigned to your supplier account yet."}
                </p>
              </div>
            ) : (
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>RFQ Number &amp; Title</th>
                    <th>Delivery Location</th>
                    <th>Invited Date</th>
                    <th>Deadline</th>
                    <th>Response Status</th>
                    <th>Quoted Value</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvitations.map((inv) => {
                    const isRewarded = inv.status === "Rewarded" || inv.isRewarded;

                    return (
                      <tr key={inv.rfqId}>
                        <td>
                          <div className="supplier-rfq-title-cell">
                            <span className="supplier-rfq-num">{inv.rfqNumber}</span>
                            <span className="supplier-rfq-title">{inv.title}</span>
                            {inv.description && (
                              <span className="supplier-rfq-desc">{inv.description}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                            <MapPin size={13} color="#64748b" />
                            <span>{inv.deliveryLocation}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 12.5, color: "#475569" }}>
                            {new Date(inv.invitationDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                            <Calendar size={13} color="#64748b" />
                            <span>
                              {inv.submissionDeadline
                                ? new Date(inv.submissionDeadline).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "Open"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`supplier-status-pill ${
                              isRewarded ? "rewarded" : inv.status.toLowerCase()
                            }`}
                          >
                            {isRewarded ? (
                              <>
                                <Award size={12} />
                                Rewarded
                              </>
                            ) : inv.status === "Submitted" ? (
                              <>
                                <CheckCircle2 size={12} />
                                Submitted
                              </>
                            ) : inv.status === "Draft" ? (
                              <>
                                <Clock size={12} />
                                Draft
                              </>
                            ) : (
                              <>
                                <Mail size={12} />
                                Invited
                              </>
                            )}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13, color: "#0f172a" }}>
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
                              isRewarded || inv.status === "Submitted" ? "" : "primary"
                            }`}
                            onClick={() => navigate(`/supplier-rfqs/${inv.rfqId}`)}
                          >
                            {isRewarded ? (
                              <>
                                <Award size={13} />
                                View Award
                              </>
                            ) : inv.status === "Submitted" ? (
                              <>
                                <FileText size={13} />
                                View Quote
                              </>
                            ) : inv.status === "Draft" ? (
                              <>
                                <Clock size={13} />
                                Resume Draft
                              </>
                            ) : (
                              <>
                                <Send size={13} />
                                Respond
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Supplier Products Catalog Table */}
      {activeTab === "products" && (
        <div className="supplier-dashboard-card">
          {/* Products Toolbar */}
          <div className="supplier-table-toolbar">
            <div className="supplier-search-input-wrap">
              <Search size={14} color="#64748b" />
              <input
                type="text"
                className="supplier-search-input"
                placeholder="Search products by code, name, category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {productCategories.length > 1 && (
                <div className="supplier-category-select-wrap">
                  <Tag size={13} color="#64748b" />
                  <select
                    className="supplier-category-select"
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                  >
                    {productCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === "All" ? "All Categories" : cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="supplier-product-count-badge">
                {filteredProducts.length} Product{filteredProducts.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Products Table Wrapper */}
          <div className="supplier-table-wrapper">
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
                <RefreshCw size={24} className="rfq-spinner" style={{ margin: "0 auto 12px" }} />
                Loading supplier product catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
                <Package size={36} style={{ margin: "0 auto 12px", opacity: 0.35 }} />
                <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                  No Products Found in Catalog
                </div>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {productSearch || productCategoryFilter !== "All"
                    ? "Try adjusting your product search query or category filter."
                    : "No products currently linked to this supplier profile in the Supplier Products table."}
                </p>
              </div>
            ) : (
              <table className="supplier-table">
                <thead>
                  <tr>
                    <th>Product Code</th>
                    <th>Product Name &amp; Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Unit Price</th>
                    <th>Warranty</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, idx) => {
                    const priceVal = Number(p.cr49f_unitprice) || 0;
                    const availName = p.cr49f_availabilityname || (p.cr49f_availability === 1 ? "Available" : "Not Available");
                    const isAvailable = availName.toLowerCase().includes("avail") && !availName.toLowerCase().includes("not");

                    return (
                      <tr key={p.cr49f_supplierproductid || idx}>
                        <td>
                          <span className="supplier-product-code-pill">
                            {p.cr49f_supplierproductnumber || `PRD-${String(idx + 1).padStart(3, "0")}`}
                          </span>
                        </td>
                        <td>
                          <div className="supplier-rfq-title-cell">
                            <span className="supplier-product-name">{p.cr49f_productname || "Catalog Product"}</span>
                            {p.cr49f_productdescription && (
                              <span className="supplier-rfq-desc">{p.cr49f_productdescription}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="supplier-product-cat-pill">
                            <Tag size={11} />
                            {p.cr49f_category || "General"}
                          </span>
                        </td>
                        <td>
                          <span className="supplier-product-type-label">
                            {p.cr49f_producttypename || (p.cr49f_producttype === 2 ? "Services" : "Goods")}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13.5, color: "#0f172a" }}>
                            {priceVal > 0
                              ? `₹${priceVal.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "Price on Request"}
                          </strong>
                        </td>
                        <td>
                          <span style={{ fontSize: 12.5, color: "#475569" }}>
                            {p.cr49f_warranty || "1 Year Standard"}
                          </span>
                        </td>
                        <td>
                          <span className={`supplier-avail-pill ${isAvailable ? "available" : "unavailable"}`}>
                            <span className="supplier-avail-dot" />
                            {availName}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDashboard;
