import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  MapPin,
  Package,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";

import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import {
  Cr49f_supplierscr49f_paymentterms,
} from "../generated/models/Cr49f_suppliersModel";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import type { Cr49f_requestforqoutations } from "../generated/models/Cr49f_requestforqoutationsModel";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";

import SupplierModal from "../components/SupplierModal";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import "../Styles/SupplierSummary.css";

const getSupplierTypeName = (supplier: Cr49f_suppliers): { label: string; className: string } => {
  const typeVal = Number(supplier.cr49f_suppliertype);
  if (typeVal === 1) return { label: "Manufacturer", className: "manufacturer" };
  if (typeVal === 2) return { label: "Distributor", className: "distributor" };
  if (typeVal === 3) return { label: "Service Provider", className: "service-provider" };
  if (typeVal === 4) return { label: "Contractor", className: "contractor" };
  if (supplier.cr49f_suppliertypename) return { label: supplier.cr49f_suppliertypename, className: "default" };
  return { label: "Supplier", className: "default" };
};

const getPaymentTermsName = (terms?: number): string => {
  if (!terms) return "Net 30";
  return Cr49f_supplierscr49f_paymentterms[terms as keyof typeof Cr49f_supplierscr49f_paymentterms] || "Net 30";
};

const SupplierSummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Cr49f_suppliers | null>(null);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [relatedRfqs, setRelatedRfqs] = useState<Cr49f_requestforqoutations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "rfqs">("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    try {
      const [supRes, prodRes, rfqRes, selRes] = await Promise.allSettled([
        Cr49f_suppliersService.getAll(),
        Cr49f_supplierproductsService.getAll(),
        Cr49f_requestforqoutationsService.getAll(),
        Cr49f_selectedsuppliersesService.getAll(),
      ]);

      const allSuppliers = supRes.status === "fulfilled" && supRes.value.data ? supRes.value.data : [];
      const cleanSearchId = cleanGuid(id);
      const searchIdLower = id.toLowerCase().trim();

      const matchedSup = allSuppliers.find((s) => {
        const sGuid = cleanGuid(s.cr49f_supplierid);
        const sCode = (s.cr49f_supplierid1 || "").toLowerCase().trim();
        return sGuid === cleanSearchId || sCode === searchIdLower;
      });

      if (!matchedSup) {
        setSupplier(null);
        setLoadError(`Supplier "${id}" could not be found.`);
        return;
      }

      setSupplier(matchedSup);
      const supGuid = cleanGuid(matchedSup.cr49f_supplierid);

      // Match products catalog
      const allProducts = prodRes.status === "fulfilled" && prodRes.value.data ? prodRes.value.data : [];
      const supProducts = allProducts.filter((p) => {
        const raw = p as unknown as Record<string, unknown>;
        const pSupGuid =
          cleanGuid(p._cr49f_supplier_value) ||
          cleanGuid(raw._cr49f_Supplier_value as string) ||
          cleanGuid(raw.cr49f_Supplier as string) ||
          cleanGuid(raw.cr49f_supplier as string);
        return pSupGuid === supGuid;
      });
      setProducts(supProducts);

      // Match related RFQs
      const allRfqs = rfqRes.status === "fulfilled" && rfqRes.value.data ? rfqRes.value.data : [];
      const allSelected = selRes.status === "fulfilled" && selRes.value.data ? selRes.value.data : [];

      const rfqIdSet = new Set<string>();
      allSelected.forEach((sel) => {
        const raw = sel as unknown as Record<string, unknown>;
        const selSup = cleanGuid(raw._cr49f_supplier_value as string) || cleanGuid(raw.cr49f_supplier as string);
        const selRfq = cleanGuid(sel._cr49f_rfq_value) || cleanGuid(raw._cr49f_RFQ_value as string);
        if (selSup === supGuid && selRfq) {
          rfqIdSet.add(selRfq);
        }
      });

      const matchedRfqs = allRfqs.filter((rfq) => {
        const rId = cleanGuid(rfq.cr49f_requestforqoutationid);
        const raw = rfq as unknown as Record<string, unknown>;
        const rfqSup = cleanGuid(raw._cr49f_supplier_value as string);
        return rfqIdSet.has(rId) || rfqSup === supGuid;
      });
      setRelatedRfqs(matchedRfqs);
    } catch (err) {
      console.error("Failed to load supplier details:", err);
      setLoadError("An unexpected error occurred while loading supplier details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        (p.cr49f_productname || "").toLowerCase().includes(q) ||
        (p.cr49f_supplierproductnumber || "").toLowerCase().includes(q) ||
        (p.cr49f_category || "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  if (loading) {
    return (
      <main className="supplier-detail-page">
        <div className="supplier-detail-notfound">
          <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-hex, #2563eb)", marginBottom: 12 }} />
          <p>Loading supplier details from Dataverse...</p>
        </div>
      </main>
    );
  }

  if (loadError || !supplier) {
    return (
      <main className="supplier-detail-page">
        <div className="supplier-detail-notfound">
          <Building2 size={36} style={{ color: "var(--muted-foreground-hex, #94a3b8)", marginBottom: 12 }} />
          <h2>Supplier Not Found</h2>
          <p>{loadError || `Could not find a supplier matching "${id}".`}</p>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate("/suppliers")}
          >
            <ArrowLeft size={14} />
            <span>Back to Suppliers</span>
          </button>
        </div>
      </main>
    );
  }

  const typeInfo = getSupplierTypeName(supplier);
  const paymentTerms = getPaymentTermsName(supplier.cr49f_paymentterms);
  const locationString = [supplier.cr49f_city, supplier.cr49f_state, supplier.cr49f_country].filter(Boolean).join(", ") || "Location not specified";

  return (
    <main className="supplier-detail-page">
      {/* HEADER BANNER */}
      <header className="supplier-detail-header">
        <div className="supplier-detail-header-left">
          <button
            type="button"
            className="supplier-detail-back-btn"
            onClick={() => navigate("/suppliers")}
            aria-label="Back to Suppliers"
            title="Back to Suppliers"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="supplier-detail-title-row">
              <h1>{supplier.cr49f_name || "Unnamed Supplier"}</h1>
              {supplier.cr49f_supplierid1 && (
                <span className="supplier-detail-code-badge">
                  {supplier.cr49f_supplierid1}
                </span>
              )}
              <span className="supplier-detail-type-badge">
                <Truck size={12} />
                <span>{typeInfo.label}</span>
              </span>
              <span className={`supplier-detail-status-pill ${supplier.statecode === 0 ? "active" : "inactive"}`}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: supplier.statecode === 0 ? "#16a34a" : "#dc2626" }} />
                <span>{supplier.statecode === 0 ? "Active Supplier" : "Inactive"}</span>
              </span>
            </div>
            <div className="supplier-detail-subtitle">
              <span>{supplier.cr49f_suppliercategory || "General Procurement"}</span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <MapPin size={12} /> {locationString}
              </span>
              {supplier.createdon && (
                <>
                  <span>•</span>
                  <span>Registered {new Date(supplier.createdon).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="supplier-detail-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={loadData}
            title="Refresh details"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setIsEditModalOpen(true)}
            title="Edit Supplier Information"
          >
            <Pencil size={14} />
            <span>Edit Supplier</span>
          </button>
        </div>
      </header>

      {/* TOP KPI CARDS */}
      <section className="supplier-kpi-grid">
        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon blue">
            <Package size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Catalog Products</span>
            <strong className="supplier-kpi-val">{products.length} Items</strong>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon purple">
            <User size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Primary Contact</span>
            <strong className="supplier-kpi-val">{supplier.cr49f_contactperson || "Not Listed"}</strong>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon emerald">
            <CreditCard size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Payment Terms</span>
            <strong className="supplier-kpi-val">{paymentTerms}</strong>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon amber">
            <ClipboardList size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Associated RFQs</span>
            <strong className="supplier-kpi-val">{relatedRfqs.length} Bids</strong>
          </div>
        </div>
      </section>

      {/* TABS */}
      <nav className="supplier-detail-tabs" aria-label="Supplier sections">
        <button
          type="button"
          className={`supplier-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Building2 size={14} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`supplier-tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          <Package size={14} />
          <span>Products &amp; Services ({products.length})</span>
        </button>
        <button
          type="button"
          className={`supplier-tab-btn ${activeTab === "rfqs" ? "active" : ""}`}
          onClick={() => setActiveTab("rfqs")}
        >
          <ClipboardList size={14} />
          <span>RFQs &amp; Quotes ({relatedRfqs.length})</span>
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <section className="supplier-detail-content">
          <div className="supplier-overview-grid">
            {/* Left: General & Contact Information */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <span className="supplier-card-title">
                    <Building2 size={16} />
                    <span>Company &amp; Organization Details</span>
                  </span>
                </div>
                <div className="supplier-fields-grid">
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Legal Name</span>
                    <strong className="supplier-field-value">{supplier.cr49f_name || "—"}</strong>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Supplier Code</span>
                    <strong className="supplier-field-value">{supplier.cr49f_supplierid1 || "—"}</strong>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Supplier Type</span>
                    <span className="supplier-field-value">{typeInfo.label}</span>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Category</span>
                    <span className="supplier-field-value">{supplier.cr49f_suppliercategory || "General"}</span>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Payment Terms</span>
                    <span className="supplier-field-value">{paymentTerms}</span>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Tax / PAN Number</span>
                    <span className="supplier-field-value">{supplier.cr49f_pan || supplier.cr49f_registrationnumber || "—"}</span>
                  </div>
                  {supplier.cr49f_website && (
                    <div className="supplier-field-item full-width">
                      <span className="supplier-field-label">Official Website</span>
                      <span className="supplier-field-value">
                        <a href={supplier.cr49f_website.startsWith("http") ? supplier.cr49f_website : `https://${supplier.cr49f_website}`} target="_blank" rel="noreferrer">
                          {supplier.cr49f_website} <ExternalLink size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                        </a>
                      </span>
                    </div>
                  )}
                </div>
              </article>

              <article className="supplier-card">
                <div className="supplier-card-header">
                  <span className="supplier-card-title">
                    <MapPin size={16} />
                    <span>Contact Information &amp; Address</span>
                  </span>
                </div>
                <div className="supplier-fields-grid">
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Contact Person</span>
                    <strong className="supplier-field-value">{supplier.cr49f_contactperson || "—"}</strong>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Email Address</span>
                    <span className="supplier-field-value">
                      {supplier.cr49f_email ? (
                        <a href={`mailto:${supplier.cr49f_email}`}>{supplier.cr49f_email}</a>
                      ) : "—"}
                    </span>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Phone Number</span>
                    <span className="supplier-field-value">
                      {supplier.cr49f_phonenumber ? (
                        <a href={`tel:${supplier.cr49f_phonenumber}`}>{supplier.cr49f_phonenumber}</a>
                      ) : "—"}
                    </span>
                  </div>
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Postal Code</span>
                    <span className="supplier-field-value">{supplier.cr49f_postalcode || "—"}</span>
                  </div>
                  <div className="supplier-field-item full-width">
                    <span className="supplier-field-label">Street Address</span>
                    <span className="supplier-field-value">{supplier.cr49f_address || "—"}</span>
                  </div>
                </div>
              </article>
            </div>

            {/* Right: Quick Catalog Preview */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <span className="supplier-card-title">
                    <Package size={16} />
                    <span>Top Catalog Products</span>
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: 12, color: "var(--primary-hex, #2563eb)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                    onClick={() => setActiveTab("products")}
                  >
                    View All ({products.length})
                  </button>
                </div>
                {products.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted-foreground-hex, #64748b)" }}>
                    No catalog products registered yet for this supplier.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {products.slice(0, 5).map((p) => (
                      <div
                        key={p.cr49f_supplierproductid}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: 8 }}>
                          <strong style={{ fontSize: 12.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.cr49f_productname || "Item"}
                          </strong>
                          <span style={{ fontSize: 11, color: "var(--muted-foreground-hex, #64748b)" }}>
                            {p.cr49f_category || "General"}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground-hex, #0f172a)", whiteSpace: "nowrap" }}>
                          {p.cr49f_unitprice ? `$${Number(p.cr49f_unitprice).toLocaleString()}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="supplier-card">
                <div className="supplier-card-header">
                  <span className="supplier-card-title">
                    <ShieldCheck size={16} />
                    <span>Compliance &amp; Status</span>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted-foreground-hex, #64748b)" }}>Verification</span>
                    <strong style={{ color: "#16a34a" }}>Verified Vendor</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted-foreground-hex, #64748b)" }}>Account State</span>
                    <strong>{supplier.statecode === 0 ? "Active" : "Inactive"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted-foreground-hex, #64748b)" }}>Dataverse ID</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                      {supplier.cr49f_supplierid.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: CATALOG PRODUCTS */}
      {activeTab === "products" && (
        <section className="supplier-table-card">
          <div className="supplier-table-header">
            <h3>Supplier Catalog Products &amp; Services</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 220 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 30px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="supplier-table-wrapper">
            <table className="supplier-data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Item Code</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Unit Price</th>
                  <th>Warranty</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "36px 20px", color: "var(--muted-foreground-hex, #64748b)" }}>
                      <Package size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                      <p style={{ margin: 0 }}>No catalog products found matching your search.</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const price = p.cr49f_unitprice ? Number(p.cr49f_unitprice) : 0;
                    return (
                      <tr key={p.cr49f_supplierproductid}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: "#2563eb" }}>
                            {p.cr49f_supplierproductnumber || "—"}
                          </span>
                        </td>
                        <td>
                          <strong>{p.cr49f_productname || "Unnamed Item"}</strong>
                          {p.cr49f_productdescription && (
                            <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground-hex, #64748b)", marginTop: 2 }}>
                              {p.cr49f_productdescription}
                            </span>
                          )}
                        </td>
                        <td>{p.cr49f_category || "General"}</td>
                        <td>{Number(p.cr49f_producttype) === 2 ? "Services" : "Goods"}</td>
                        <td>
                          <strong>{price > 0 ? `$${price.toLocaleString()}` : "—"}</strong>
                        </td>
                        <td>{p.cr49f_warranty || "1 Year Standard"}</td>
                        <td>
                          <span className={`supplier-avail-pill ${Number(p.cr49f_availability) === 2 ? "unavailable" : "available"}`}>
                            {Number(p.cr49f_availability) === 2 ? "Unavailable" : "Available"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: RFQS & QUOTATIONS */}
      {activeTab === "rfqs" && (
        <section className="supplier-table-card">
          <div className="supplier-table-header">
            <h3>Associated Request For Quotations (RFQs)</h3>
          </div>
          <div className="supplier-table-wrapper">
            <table className="supplier-data-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>RFQ Number</th>
                  <th>Title</th>
                  <th>Deadline</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center", width: 90 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {relatedRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px 20px", color: "var(--muted-foreground-hex, #64748b)" }}>
                      <ClipboardList size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                      <p style={{ margin: 0 }}>This supplier has not been invited to any RFQs yet.</p>
                    </td>
                  </tr>
                ) : (
                  relatedRfqs.map((rfq) => {
                    const rfqNum = rfq.cr49f_rfqnumber || rfq.cr49f_requestforqoutationid;
                    return (
                      <tr key={rfq.cr49f_requestforqoutationid}>
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate(`/rfqs/${rfqNum}`)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#2563eb",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            {rfqNum}
                          </button>
                        </td>
                        <td>
                          <strong>{rfq.cr49f_rfqtitle || "Request for Quotation"}</strong>
                        </td>
                        <td>
                          {rfq.cr49f_submissiondeadline
                            ? new Date(rfq.cr49f_submissiondeadline).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          {rfq.createdon
                            ? new Date(rfq.createdon).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <span className="supplier-detail-status-pill active">
                            Active
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="admin-edit-btn"
                            onClick={() => navigate(`/rfqs/${rfqNum}`)}
                          >
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {isEditModalOpen && (
        <SupplierModal
          isOpen={isEditModalOpen}
          supplier={supplier}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(updatedSup, updatedProds) => {
            setSupplier(updatedSup);
            if (updatedProds && updatedProds.length > 0) {
              setProducts(updatedProds);
            }
            setIsEditModalOpen(false);
          }}
        />
      )}
    </main>
  );
};

export default SupplierSummary;
