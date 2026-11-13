import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Factory,
  Globe,
  Hash,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";

import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import {
  Cr49f_supplierscr49f_paymentterms,
} from "../generated/models/Cr49f_suppliersModel";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";

import SupplierModal from "../components/SupplierModal";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import "../Styles/SupplierSummary.css";

const getSupplierTypeName = (supplier: Cr49f_suppliers): { label: string; icon: React.ReactNode; className: string } => {
  const typeVal = Number(supplier.cr49f_suppliertype);
  if (typeVal === 1) return { label: "Manufacturer", icon: <Factory size={13} />, className: "manufacturer" };
  if (typeVal === 2) return { label: "Distributor", icon: <Truck size={13} />, className: "distributor" };
  if (typeVal === 3) return { label: "Service Provider", icon: <Wrench size={13} />, className: "service-provider" };
  if (typeVal === 4) return { label: "Contractor", icon: <Building2 size={13} />, className: "contractor" };
  if (supplier.cr49f_suppliertypename) {
    return { label: supplier.cr49f_suppliertypename, icon: <Truck size={13} />, className: "default" };
  }
  return { label: "Supplier", icon: <Truck size={13} />, className: "default" };
};

const getPaymentTermsName = (terms?: number): string => {
  if (!terms) return "Net 30";
  return Cr49f_supplierscr49f_paymentterms[terms as keyof typeof Cr49f_supplierscr49f_paymentterms] || "Net 30";
};

const getInitials = (name?: string) => {
  if (!name) return "SP";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

interface SupplierSummaryProps {
  readOnly?: boolean;
}

const SupplierSummary: React.FC<SupplierSummaryProps> = ({ readOnly = false }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Cr49f_suppliers | null>(null);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "products">("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    try {
      void navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  const loadData = async (isManualRefresh = false) => {
    if (!id) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const [supRes, prodRes] = await Promise.allSettled([
        Cr49f_suppliersService.getAll(),
        Cr49f_supplierproductsService.getAll(),
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
        setLoadError(`Supplier "${id}" could not be found in Dataverse.`);
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
    } catch (err) {
      console.error("Failed to load supplier details:", err);
      setLoadError("An unexpected error occurred while loading supplier details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.cr49f_category?.trim()) cats.add(p.cr49f_category.trim());
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        (p.cr49f_productname || "").toLowerCase().includes(productSearch.toLowerCase().trim()) ||
        (p.cr49f_supplierproductnumber || "").toLowerCase().includes(productSearch.toLowerCase().trim()) ||
        (p.cr49f_category || "").toLowerCase().includes(productSearch.toLowerCase().trim());
      const matchCategory =
        selectedCategory === "All" ||
        (p.cr49f_category || "").toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCategory;
    });
  }, [products, productSearch, selectedCategory]);

  if (loading) {
    return (
      <main className="supplier-detail-page">
        <div className="supplier-detail-notfound">
          <RefreshCw size={28} className="animate-spin" style={{ color: "var(--primary-hex, #2563eb)", marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Retrieving Supplier Record</h3>
          <p style={{ color: "var(--muted-foreground-hex, #64748b)", margin: 0, fontSize: 13 }}>Connecting to Dataverse supplier catalog...</p>
        </div>
      </main>
    );
  }

  if (loadError || !supplier) {
    return (
      <main className="supplier-detail-page">
        <div className="supplier-detail-notfound">
          <Building2 size={40} style={{ color: "var(--muted-foreground-hex, #94a3b8)", marginBottom: 14 }} />
          <h2>Supplier Not Found</h2>
          <p>{loadError || `Could not find a supplier matching "${id}".`}</p>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => navigate("/suppliers")}
            style={{ marginTop: 8 }}
          >
            <ArrowLeft size={14} />
            <span>Back to Suppliers Directory</span>
          </button>
        </div>
      </main>
    );
  }

  const typeInfo = getSupplierTypeName(supplier);
  const paymentTerms = getPaymentTermsName(supplier.cr49f_paymentterms);
  const locationString = [supplier.cr49f_city, supplier.cr49f_state, supplier.cr49f_country].filter(Boolean).join(", ") || "Location not specified";
  const initials = getInitials(supplier.cr49f_name);

  return (
    <main className="supplier-detail-page">
      {/* BREADCRUMBS */}
      <nav className="supplier-breadcrumb" aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => navigate("/suppliers")}
          className="supplier-breadcrumb-link"
        >
          Suppliers
        </button>
        <span className="supplier-breadcrumb-sep">/</span>
        <span className="supplier-breadcrumb-current">{supplier.cr49f_name || "Supplier Summary"}</span>
      </nav>

      {/* ENHANCED HERO HEADER */}
      <header className="supplier-detail-header-card">
        <div className="supplier-header-main-group">
          {/* Back button */}
          <button
            type="button"
            className="supplier-detail-back-btn"
            onClick={() => navigate("/suppliers")}
            aria-label="Back to Suppliers"
            title="Back to Suppliers Directory"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Supplier Monogram / Brand Avatar */}
          <div className="supplier-brand-avatar" title={supplier.cr49f_name || "Supplier"}>
            <span>{initials}</span>
          </div>

          {/* Details & Badges */}
          <div className="supplier-header-title-box">
            <div className="supplier-detail-title-row">
              <h1 className="supplier-title-text">{supplier.cr49f_name || "Unnamed Supplier"}</h1>

              {supplier.cr49f_supplierid1 && (
                <button
                  type="button"
                  className="supplier-code-badge-interactive"
                  onClick={() => copyToClipboard(supplier.cr49f_supplierid1 || "", "code")}
                  title="Click to copy Supplier Code"
                >
                  <Hash size={11} />
                  <span>{supplier.cr49f_supplierid1}</span>
                  {copiedField === "code" ? (
                    <Check size={11} style={{ color: "#10b981" }} />
                  ) : (
                    <Copy size={11} className="copy-icon" />
                  )}
                </button>
              )}

              <span className={`supplier-detail-type-badge ${typeInfo.className}`}>
                {typeInfo.icon}
                <span>{typeInfo.label}</span>
              </span>

              <span className={`supplier-detail-status-pill ${supplier.statecode === 0 ? "active" : "inactive"}`}>
                <span className="supplier-pulse-dot" />
                <span>{supplier.statecode === 0 ? "Active Supplier" : "Inactive"}</span>
              </span>
            </div>

            <div className="supplier-detail-subtitle">
              <span className="supplier-meta-pill category">
                <Tag size={12} />
                {supplier.cr49f_suppliercategory || "Computer Equipment"}
              </span>

              <span className="supplier-meta-dot">•</span>

              <span className="supplier-meta-pill location">
                <MapPin size={12} />
                {locationString}
              </span>

              {supplier.createdon && (
                <>
                  <span className="supplier-meta-dot">•</span>
                  <span className="supplier-meta-pill date">
                    <Calendar size={12} />
                    Registered {new Date(supplier.createdon).toLocaleDateString()}
                  </span>
                </>
              )}

              <span className="supplier-meta-dot">•</span>

              <span className="supplier-verified-pill">
                <ShieldCheck size={12} />
                Verified Vendor
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="supplier-detail-header-actions">
          <button
            type="button"
            className="supplier-btn-hdr secondary"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh details from Dataverse"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          {!readOnly && (
            <button
              type="button"
              className="supplier-btn-hdr primary"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit Supplier Information"
            >
              <Pencil size={13} />
              <span>Edit Supplier</span>
            </button>
          )}
        </div>
      </header>

      {/* TOP KPI BANNER CARDS */}
      <section className="supplier-kpi-grid">
        <div
          className="supplier-kpi-card interactive"
          onClick={() => setActiveTab("products")}
          title="Click to view all catalog products"
        >
          <div className="supplier-kpi-icon blue">
            <Package size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Catalog Products</span>
            <strong className="supplier-kpi-val">{products.length} Items</strong>
            <span className="supplier-kpi-hint">View full product catalog &rarr;</span>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon purple">
            <User size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Primary Contact</span>
            <strong className="supplier-kpi-val">{supplier.cr49f_contactperson || "Not Listed"}</strong>
            <span className="supplier-kpi-hint">
              {supplier.cr49f_email ? (
                <a href={`mailto:${supplier.cr49f_email}`} onClick={(e) => e.stopPropagation()}>
                  {supplier.cr49f_email}
                </a>
              ) : "Direct representative"}
            </span>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon emerald">
            <CreditCard size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Payment Terms</span>
            <strong className="supplier-kpi-val">{paymentTerms}</strong>
            <span className="supplier-kpi-hint">Standard procurement credit terms</span>
          </div>
        </div>

        <div className="supplier-kpi-card">
          <div className="supplier-kpi-icon amber">
            <ShieldCheck size={20} />
          </div>
          <div className="supplier-kpi-content">
            <span className="supplier-kpi-label">Compliance &amp; Tax</span>
            <strong className="supplier-kpi-val">{supplier.cr49f_pan || "On Record"}</strong>
            <span className="supplier-kpi-hint">Verified corporate PAN / Tax code</span>
          </div>
        </div>
      </section>

      {/* TABS NAVIGATION */}
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
          <span>Products &amp; Services</span>
          <span className="supplier-tab-count-badge">{products.length}</span>
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <section className="supplier-detail-content">
          <div className="supplier-overview-grid">
            {/* Left Column: Organization & Contact Cards */}
            <div className="supplier-overview-col-left">
              {/* Company & Organization Details Card */}
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <div className="supplier-card-title">
                    <div className="supplier-card-icon-wrap blue">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h3>Company &amp; Organization Details</h3>
                      <p>Corporate identity, business category, and registered legal credentials</p>
                    </div>
                  </div>
                </div>

                <div className="supplier-fields-grid">
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Legal Name</span>
                    <strong className="supplier-field-value">{supplier.cr49f_name || "—"}</strong>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Supplier Code</span>
                    <div className="supplier-copyable-val">
                      <strong className="supplier-field-value">{supplier.cr49f_supplierid1 || "—"}</strong>
                      {supplier.cr49f_supplierid1 && (
                        <button
                          type="button"
                          className="supplier-inline-copy-btn"
                          onClick={() => copyToClipboard(supplier.cr49f_supplierid1 || "", "code_body")}
                          title="Copy Code"
                        >
                          {copiedField === "code_body" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Supplier Type</span>
                    <span className="supplier-field-value">
                      <span className={`supplier-detail-type-badge ${typeInfo.className}`} style={{ display: "inline-flex" }}>
                        {typeInfo.icon}
                        <span>{typeInfo.label}</span>
                      </span>
                    </span>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Category</span>
                    <span className="supplier-field-value">{supplier.cr49f_suppliercategory || "Computer Equipment"}</span>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Payment Terms</span>
                    <span className="supplier-field-value">{paymentTerms}</span>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Tax / PAN Number</span>
                    <div className="supplier-copyable-val">
                      <span className="supplier-field-value" style={{ fontFamily: "monospace", letterSpacing: "0.03em" }}>
                        {supplier.cr49f_pan || supplier.cr49f_registrationnumber || "—"}
                      </span>
                      {(supplier.cr49f_pan || supplier.cr49f_registrationnumber) && (
                        <button
                          type="button"
                          className="supplier-inline-copy-btn"
                          onClick={() => copyToClipboard(supplier.cr49f_pan || supplier.cr49f_registrationnumber || "", "pan")}
                          title="Copy PAN Number"
                        >
                          {copiedField === "pan" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {supplier.cr49f_website && (
                    <div className="supplier-field-item full-width">
                      <span className="supplier-field-label">Official Website</span>
                      <span className="supplier-field-value">
                        <a
                          href={supplier.cr49f_website.startsWith("http") ? supplier.cr49f_website : `https://${supplier.cr49f_website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="supplier-link-external"
                        >
                          <Globe size={13} />
                          <span>{supplier.cr49f_website}</span>
                          <ExternalLink size={12} />
                        </a>
                      </span>
                    </div>
                  )}
                </div>
              </article>

              {/* Contact Information & Address Card */}
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <div className="supplier-card-title">
                    <div className="supplier-card-icon-wrap emerald">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <h3>Contact Information &amp; Address</h3>
                      <p>Key liaison personnel and registered physical headquarters</p>
                    </div>
                  </div>
                </div>

                <div className="supplier-fields-grid">
                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Contact Person</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="supplier-contact-avatar">
                        <User size={13} />
                      </div>
                      <strong className="supplier-field-value">{supplier.cr49f_contactperson || "—"}</strong>
                    </div>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Email Address</span>
                    <span className="supplier-field-value">
                      {supplier.cr49f_email ? (
                        <a href={`mailto:${supplier.cr49f_email}`} className="supplier-contact-link">
                          <Mail size={13} />
                          <span>{supplier.cr49f_email}</span>
                        </a>
                      ) : "—"}
                    </span>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Phone Number</span>
                    <span className="supplier-field-value">
                      {supplier.cr49f_phonenumber ? (
                        <a href={`tel:${supplier.cr49f_phonenumber}`} className="supplier-contact-link">
                          <Phone size={13} />
                          <span>{supplier.cr49f_phonenumber}</span>
                        </a>
                      ) : "—"}
                    </span>
                  </div>

                  <div className="supplier-field-item">
                    <span className="supplier-field-label">Postal / ZIP Code</span>
                    <span className="supplier-field-value">{supplier.cr49f_postalcode || "—"}</span>
                  </div>

                  <div className="supplier-field-item full-width">
                    <span className="supplier-field-label">Street Address &amp; Facility</span>
                    <span className="supplier-field-value" style={{ display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.5 }}>
                      <MapPin size={14} style={{ color: "#64748b", flexShrink: 0, marginTop: 2 }} />
                      <span>{supplier.cr49f_address || locationString}</span>
                    </span>
                  </div>
                </div>
              </article>
            </div>

            {/* Right Column: Quick Products & Compliance */}
            <div className="supplier-overview-col-right">
              {/* Top Catalog Products Preview Card */}
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <div className="supplier-card-title">
                    <div className="supplier-card-icon-wrap indigo">
                      <Package size={16} />
                    </div>
                    <div>
                      <h3>Top Catalog Products</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="supplier-link-btn"
                    onClick={() => setActiveTab("products")}
                  >
                    View All ({products.length})
                  </button>
                </div>

                {products.length === 0 ? (
                  <div className="supplier-empty-preview">
                    <Package size={32} style={{ opacity: 0.35, marginBottom: 6 }} />
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                      No catalog products registered yet.
                    </p>
                  </div>
                ) : (
                  <div className="supplier-preview-products-list">
                    {products.slice(0, 4).map((p) => (
                      <div key={p.cr49f_supplierproductid} className="supplier-preview-product-item">
                        <div className="supplier-preview-product-icon">
                          <Package size={15} />
                        </div>
                        <div className="supplier-preview-product-info">
                          <strong className="supplier-preview-product-name">
                            {p.cr49f_productname || "Item"}
                          </strong>
                          <span className="supplier-preview-product-cat">
                            {p.cr49f_category || "General"}
                          </span>
                        </div>
                        <div className="supplier-preview-product-price">
                          {p.cr49f_unitprice ? `$${Number(p.cr49f_unitprice).toLocaleString()}` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              {/* Compliance & Status Governance Card */}
              <article className="supplier-card">
                <div className="supplier-card-header">
                  <div className="supplier-card-title">
                    <div className="supplier-card-icon-wrap emerald">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h3>Compliance &amp; Status</h3>
                    </div>
                  </div>
                </div>

                <div className="supplier-compliance-list">
                  <div className="supplier-compliance-row">
                    <span className="supplier-compliance-label">Verification Standing</span>
                    <span className="supplier-verified-badge">
                      <CheckCircle2 size={12} />
                      Verified Vendor
                    </span>
                  </div>

                  <div className="supplier-compliance-row">
                    <span className="supplier-compliance-label">Account State</span>
                    <strong style={{ color: supplier.statecode === 0 ? "#15803d" : "#b91c1c" }}>
                      {supplier.statecode === 0 ? "Active & Authorized" : "Inactive"}
                    </strong>
                  </div>

                  <div className="supplier-compliance-row">
                    <span className="supplier-compliance-label">Dataverse Record ID</span>
                    <div className="supplier-copyable-val">
                      <span className="supplier-id-mono" title={supplier.cr49f_supplierid}>
                        {supplier.cr49f_supplierid.slice(0, 14)}...
                      </span>
                      <button
                        type="button"
                        className="supplier-inline-copy-btn"
                        onClick={() => copyToClipboard(supplier.cr49f_supplierid, "guid")}
                        title="Copy Dataverse GUID"
                      >
                        {copiedField === "guid" ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: CATALOG PRODUCTS & SERVICES */}
      {activeTab === "products" && (
        <section className="supplier-table-card">
          <div className="supplier-table-header">
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Supplier Catalog Products &amp; Services
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                Showing {filteredProducts.length} of {products.length} registered catalog offerings
              </p>
            </div>

            <div className="supplier-table-controls">
              {/* Category Filter Pills */}
              {availableCategories.length > 0 && (
                <div className="supplier-category-pills">
                  <button
                    type="button"
                    className={`supplier-cat-pill ${selectedCategory === "All" ? "active" : ""}`}
                    onClick={() => setSelectedCategory("All")}
                  >
                    All
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`supplier-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="supplier-table-search-wrap">
                <Search size={14} className="supplier-table-search-icon" />
                <input
                  type="text"
                  placeholder="Search products by name, code, category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="supplier-table-search-input"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch("")}
                    className="supplier-table-search-clear"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="supplier-table-wrapper">
            <table className="supplier-data-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Item Code</th>
                  <th>Product Name &amp; Description</th>
                  <th style={{ width: 140 }}>Category</th>
                  <th style={{ width: 100 }}>Type</th>
                  <th style={{ width: 130 }}>Unit Price</th>
                  <th style={{ width: 140 }}>Warranty</th>
                  <th style={{ width: 110, textAlign: "right" }}>Availability</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="supplier-table-empty-row">
                      <Package size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
                      <p style={{ margin: 0, fontWeight: 600, color: "#334155" }}>
                        No catalog items found matching your criteria.
                      </p>
                      {(productSearch || selectedCategory !== "All") && (
                        <button
                          type="button"
                          className="supplier-btn-hdr secondary"
                          style={{ marginTop: 12, padding: "5px 12px" }}
                          onClick={() => {
                            setProductSearch("");
                            setSelectedCategory("All");
                          }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const price = p.cr49f_unitprice ? Number(p.cr49f_unitprice) : 0;
                    return (
                      <tr key={p.cr49f_supplierproductid}>
                        <td>
                          <span className="supplier-item-code-tag">
                            {p.cr49f_supplierproductnumber || "—"}
                          </span>
                        </td>
                        <td>
                          <strong className="supplier-item-name">{p.cr49f_productname || "Unnamed Item"}</strong>
                          {p.cr49f_productdescription && (
                            <span className="supplier-item-desc">
                              {p.cr49f_productdescription}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="supplier-category-tag">
                            {p.cr49f_category || "General"}
                          </span>
                        </td>
                        <td>
                          <span className={`supplier-type-tag ${Number(p.cr49f_producttype) === 2 ? "services" : "goods"}`}>
                            {Number(p.cr49f_producttype) === 2 ? "Services" : "Goods"}
                          </span>
                        </td>
                        <td>
                          <strong className="supplier-item-price">
                            {price > 0 ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                          </strong>
                        </td>
                        <td>
                          <span className="supplier-warranty-tag">
                            {p.cr49f_warranty || "1 Year Standard"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
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

      {/* EDIT SUPPLIER MODAL */}
      {!readOnly && isEditModalOpen && (
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
