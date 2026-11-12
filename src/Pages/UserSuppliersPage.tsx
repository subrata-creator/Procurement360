import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  Factory,
  Globe,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Tag,
  Truck,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import {
  Cr49f_supplierscr49f_paymentterms,
  Cr49f_supplierscr49f_suppliertype,
} from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import ModernSelect, { type ModernSelectOption } from "../components/ModernSelect";
import "../Styles/UserSuppliersPage.css";

interface SupplierTypeMeta {
  label: string;
  className: string;
  icon: React.ReactNode;
}

function normalizeId(id?: string): string {
  if (!id) return "";
  return String(id).replace(/[{}]/g, "").toLowerCase().trim();
}

function getInitials(name?: string): string {
  if (!name?.trim()) return "SP";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getSupplierTypeMeta(supplier: Cr49f_suppliers): SupplierTypeMeta {
  const typeVal = Number(supplier.cr49f_suppliertype);
  if (typeVal === 1) {
    return { label: "Manufacturer", className: "manufacturer", icon: <Factory size={12} /> };
  }
  if (typeVal === 2) {
    return { label: "Distributor", className: "distributor", icon: <Truck size={12} /> };
  }
  if (typeVal === 3) {
    return { label: "Service Provider", className: "serviceprovider", icon: <Wrench size={12} /> };
  }
  if (typeVal === 4) {
    return { label: "Contractor", className: "contractor", icon: <Building2 size={12} /> };
  }
  if (supplier.cr49f_suppliertypename) {
    const raw = supplier.cr49f_suppliertypename.toLowerCase();
    let cls = "manufacturer";
    if (raw.includes("dist")) cls = "distributor";
    else if (raw.includes("service")) cls = "serviceprovider";
    else if (raw.includes("contract")) cls = "contractor";
    return { label: supplier.cr49f_suppliertypename, className: cls, icon: <Truck size={12} /> };
  }
  return { label: "Vendor", className: "manufacturer", icon: <Truck size={12} /> };
}

function getPaymentTermsLabel(supplier: Cr49f_suppliers): string | null {
  if (supplier.cr49f_paymenttermsname?.trim()) return supplier.cr49f_paymenttermsname.trim();
  if (!supplier.cr49f_paymentterms) return null;
  const label = Cr49f_supplierscr49f_paymentterms[supplier.cr49f_paymentterms];
  return label ? String(label) : null;
}

function getProductSupplierId(product: Cr49f_supplierproducts): string {
  const record = product as unknown as Record<string, unknown>;
  const nested = record.cr49f_supplier as { cr49f_supplierid?: string } | undefined;
  return normalizeId(
    product._cr49f_supplier_value ||
      (typeof record._cr49f_Supplier_value === "string" ? record._cr49f_Supplier_value : "") ||
      nested?.cr49f_supplierid ||
      ""
  );
}

function formatPrice(raw?: string): string {
  if (!raw?.trim()) return "—";
  const num = Number(raw);
  if (!Number.isNaN(num)) {
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return raw;
}

async function fetchSuppliersFromDataverse(): Promise<{
  suppliers: Cr49f_suppliers[];
  products: Cr49f_supplierproducts[];
  error: string | null;
}> {
  try {
    const [suppRes, prodRes] = await Promise.allSettled([
      Cr49f_suppliersService.getAll(),
      Cr49f_supplierproductsService.getAll(),
    ]);

    let suppliers: Cr49f_suppliers[] = [];
    let error: string | null = null;

    if (suppRes.status === "fulfilled" && !suppRes.value.error) {
      suppliers = suppRes.value.data ?? [];
    } else {
      const msg =
        suppRes.status === "fulfilled"
          ? suppRes.value.error?.message
          : suppRes.reason instanceof Error
            ? suppRes.reason.message
            : "Failed to load suppliers from Dataverse.";
      error = msg || "Failed to load suppliers from Dataverse.";
    }

    const products =
      prodRes.status === "fulfilled" && !prodRes.value.error
        ? prodRes.value.data ?? []
        : [];

    return { suppliers, products, error };
  } catch (err: unknown) {
    return {
      suppliers: [],
      products: [],
      error: err instanceof Error ? err.message : "Failed to load suppliers.",
    };
  }
}

/**
 * Read-only Supplier Directory page for standard portal users.
 * Displays registered Dataverse suppliers in a searchable, filterable card grid or table view
 * with quick access to each supplier's catalog products and detail profile.
 */
const UserSuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Cr49f_suppliers[]>([]);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [quickViewSupplier, setQuickViewSupplier] = useState<Cr49f_suppliers | null>(null);

  useEffect(() => {
    let active = true;
    void fetchSuppliersFromDataverse().then((result) => {
      if (!active) return;
      setSuppliers(result.suppliers);
      setProducts(result.products);
      setLoadError(result.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!quickViewSupplier) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickViewSupplier(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickViewSupplier]);

  const handleRefresh = () => {
    setLoading(true);
    setLoadError(null);
    void fetchSuppliersFromDataverse().then((result) => {
      setSuppliers(result.suppliers);
      setProducts(result.products);
      setLoadError(result.error);
      setLoading(false);
    });
  };

  const productsBySupplier = useMemo(() => {
    const map: Record<string, Cr49f_supplierproducts[]> = {};
    for (const product of products) {
      const supId = getProductSupplierId(product);
      if (supId) {
        if (!map[supId]) map[supId] = [];
        map[supId].push(product);
      }
    }
    return map;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of suppliers) {
      if (s.cr49f_suppliercategory?.trim()) {
        set.add(s.cr49f_suppliercategory.trim());
      }
    }
    return Array.from(set).sort();
  }, [suppliers]);

  const typeFilterOptions = useMemo<ModernSelectOption[]>(() => {
    const options: ModernSelectOption[] = [
      { value: "ALL", label: "All Types", icon: <Truck size={12} /> },
    ];
    Object.entries(Cr49f_supplierscr49f_suppliertype).forEach(([key, label]) => {
      options.push({
        value: key,
        label: String(label),
        icon: <Truck size={12} />,
      });
    });
    return options;
  }, []);

  const statusFilterOptions: ModernSelectOption[] = [
    { value: "ALL", label: "All Statuses" },
    {
      value: "ACTIVE",
      label: "Active Only",
      icon: <CheckCircle2 size={12} style={{ color: "#16a34a" }} />,
    },
    {
      value: "INACTIVE",
      label: "Inactive Only",
      icon: <XCircle size={12} style={{ color: "#ef4444" }} />,
    },
  ];

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter((s) => {
      if (q) {
        const haystack = [
          s.cr49f_name,
          s.cr49f_supplierid1,
          s.cr49f_contactperson,
          s.cr49f_email,
          s.cr49f_city,
          s.cr49f_country,
          s.cr49f_suppliercategory,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (selectedTypeFilter !== "ALL" && String(s.cr49f_suppliertype) !== selectedTypeFilter) {
        return false;
      }

      if (selectedStatusFilter !== "ALL") {
        const isActive = s.statecode === 0;
        if (selectedStatusFilter === "ACTIVE" && !isActive) return false;
        if (selectedStatusFilter === "INACTIVE" && isActive) return false;
      }

      if (selectedCategory !== "ALL") {
        if ((s.cr49f_suppliercategory || "").trim() !== selectedCategory) return false;
      }

      return true;
    });
  }, [suppliers, searchQuery, selectedTypeFilter, selectedStatusFilter, selectedCategory]);

  const totalSuppliers = suppliers.length;
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.statecode === 0).length,
    [suppliers]
  );
  const locationsCount = useMemo(() => {
    const cities = new Set<string>();
    for (const s of suppliers) {
      const loc = [s.cr49f_city?.trim(), s.cr49f_country?.trim()].filter(Boolean).join(", ");
      if (loc) cities.add(loc.toLowerCase());
    }
    return cities.size;
  }, [suppliers]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedTypeFilter !== "ALL" ||
    selectedStatusFilter !== "ALL" ||
    selectedCategory !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedTypeFilter("ALL");
    setSelectedStatusFilter("ALL");
    setSelectedCategory("ALL");
  };

  const openSupplierProfile = (supplier: Cr49f_suppliers) => {
    navigate(`/suppliers/${supplier.cr49f_supplierid1 || supplier.cr49f_supplierid}`);
  };

  const quickViewProducts = quickViewSupplier
    ? productsBySupplier[normalizeId(quickViewSupplier.cr49f_supplierid)] ?? []
    : [];

  return (
    <div className="usup-page">
      {/* Header */}
      <header className="usup-header">
        <div>
          <div className="usup-eyebrow">
            <Truck size={14} />
            <span>SUPPLIER DIRECTORY</span>
          </div>
          <h1 className="usup-title">Suppliers</h1>
          <p className="usup-subtitle">
            Browse registered suppliers, contact information, locations, and cataloged products.
          </p>
        </div>

        <div className="usup-header-actions">
          <div className="usup-view-toggle" role="group" aria-label="View layout">
            <button
              type="button"
              className={`usup-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`usup-view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <List size={14} />
              <span>List</span>
            </button>
          </div>

          <button
            type="button"
            className="usup-refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Summary KPI Strip */}
      <section className="usup-stats-grid" aria-label="Supplier directory summary">
        <div className="usup-stat-card blue">
          <div className="usup-stat-icon">
            <Truck size={20} />
          </div>
          <div className="usup-stat-meta">
            <span className="usup-stat-label">Total Suppliers</span>
            <strong className="usup-stat-value">{totalSuppliers}</strong>
            <span className="usup-stat-hint">Registered in Dataverse</span>
          </div>
        </div>

        <div className="usup-stat-card green">
          <div className="usup-stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div className="usup-stat-meta">
            <span className="usup-stat-label">Active Vendors</span>
            <strong className="usup-stat-value">{activeSuppliers}</strong>
            <span className="usup-stat-hint">
              {totalSuppliers > 0
                ? `${Math.round((activeSuppliers / totalSuppliers) * 100)}% ready for RFQs`
                : "Available for sourcing"}
            </span>
          </div>
        </div>

        <div className="usup-stat-card violet">
          <div className="usup-stat-icon">
            <Package size={20} />
          </div>
          <div className="usup-stat-meta">
            <span className="usup-stat-label">Cataloged Products</span>
            <strong className="usup-stat-value">{products.length}</strong>
            <span className="usup-stat-hint">Across all suppliers</span>
          </div>
        </div>

        <div className="usup-stat-card amber">
          <div className="usup-stat-icon">
            <MapPin size={20} />
          </div>
          <div className="usup-stat-meta">
            <span className="usup-stat-label">Locations Covered</span>
            <strong className="usup-stat-value">{locationsCount}</strong>
            <span className="usup-stat-hint">Unique vendor cities</span>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="usup-toolbar-card" aria-label="Search and filter suppliers">
        <div className="usup-toolbar-top">
          <div className="usup-search-wrap">
            <Search size={15} className="usup-search-icon" />
            <input
              type="text"
              className="usup-search-input"
              placeholder="Search by supplier name, code, category, contact, email, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="usup-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="usup-filters-row">
            <ModernSelect
              size="sm"
              style={{ width: 175 }}
              value={selectedTypeFilter}
              options={typeFilterOptions}
              onChange={setSelectedTypeFilter}
              title="Filter by Supplier Type"
              icon={<Truck size={12} />}
            />
            <ModernSelect
              size="sm"
              style={{ width: 145 }}
              value={selectedStatusFilter}
              options={statusFilterOptions}
              onChange={setSelectedStatusFilter}
              title="Filter by Status"
            />
          </div>
        </div>

        <div className="usup-toolbar-bottom">
          {categories.length > 0 && (
            <div className="usup-category-pills" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={`usup-cat-pill ${selectedCategory === "ALL" ? "active" : ""}`}
                onClick={() => setSelectedCategory("ALL")}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`usup-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory((prev) => (prev === cat ? "ALL" : cat))}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="usup-results-meta">
            <span>
              Showing {filteredSuppliers.length} of {totalSuppliers}{" "}
              {totalSuppliers === 1 ? "supplier" : "suppliers"}
            </span>
            {hasActiveFilters && (
              <button type="button" className="usup-reset-link" onClick={resetFilters}>
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Error Banner */}
      {loadError && (
        <div className="usup-error-banner" role="alert">
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>
            <strong>Unable to retrieve suppliers:</strong> {loadError}
          </span>
          <button type="button" className="usup-refresh-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="usup-empty-state">
          <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-hex)" }} />
          <h3>Loading Suppliers</h3>
          <p>Fetching registered vendors and product catalogs from Dataverse...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="usup-empty-state">
          <Truck size={28} />
          <h3>{hasActiveFilters ? "No matching suppliers" : "No suppliers found"}</h3>
          <p>
            {hasActiveFilters
              ? "Try adjusting your search keywords, supplier type, or category filters."
              : "No suppliers are currently registered in Dataverse."}
          </p>
          {hasActiveFilters && (
            <button type="button" className="usup-refresh-btn" onClick={resetFilters}>
              Reset all filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <section className="usup-cards-grid" aria-label="Suppliers card grid">
          {filteredSuppliers.map((s) => {
            const typeMeta = getSupplierTypeMeta(s);
            const isActive = s.statecode === 0;
            const normId = normalizeId(s.cr49f_supplierid);
            const supplierProducts = productsBySupplier[normId] ?? [];
            const paymentTerms = getPaymentTermsLabel(s);
            const location = [s.cr49f_city, s.cr49f_country].filter(Boolean).join(", ");

            return (
              <article
                key={s.cr49f_supplierid}
                className={`usup-card ${typeMeta.className}`}
                tabIndex={0}
                onClick={() => openSupplierProfile(s)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSupplierProfile(s);
                  }
                }}
              >
                <div className="usup-card-top">
                  <div className="usup-card-identity">
                    <div className="usup-avatar">{getInitials(s.cr49f_name)}</div>
                    <div className="usup-name-wrap">
                      <h2 className="usup-card-title" title={s.cr49f_name || "Unnamed Supplier"}>
                        {s.cr49f_name || "Unnamed Supplier"}
                      </h2>
                      <span className="usup-card-code">{s.cr49f_supplierid1 || "—"}</span>
                    </div>
                  </div>
                  <span className={`usup-status-pill ${isActive ? "active" : "inactive"}`}>
                    <span className="usup-status-dot" />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="usup-badges-row">
                  <span className="usup-type-badge">
                    {typeMeta.icon}
                    <span>{typeMeta.label}</span>
                  </span>
                  {s.cr49f_suppliercategory && (
                    <span className="usup-meta-chip">
                      <Tag size={11} />
                      <span>{s.cr49f_suppliercategory}</span>
                    </span>
                  )}
                  {paymentTerms && (
                    <span className="usup-meta-chip">
                      <CreditCard size={11} />
                      <span>{paymentTerms}</span>
                    </span>
                  )}
                </div>

                <div className="usup-info-box">
                  <div className="usup-info-row">
                    <User size={13} />
                    <span className="usup-info-text">
                      {s.cr49f_contactperson || "No primary contact listed"}
                    </span>
                  </div>
                  {s.cr49f_email && (
                    <div className="usup-info-row">
                      <Mail size={13} />
                      <a
                        href={`mailto:${s.cr49f_email}`}
                        className="usup-info-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.cr49f_email}
                      </a>
                    </div>
                  )}
                  {s.cr49f_phonenumber && (
                    <div className="usup-info-row">
                      <Phone size={13} />
                      <span className="usup-info-text">{s.cr49f_phonenumber}</span>
                    </div>
                  )}
                  <div className="usup-info-row">
                    <MapPin size={13} />
                    <span className="usup-info-text">{location || "Location not specified"}</span>
                  </div>
                  {s.cr49f_website && (
                    <div className="usup-info-row">
                      <Globe size={13} />
                      <span className="usup-info-text">{s.cr49f_website}</span>
                    </div>
                  )}
                </div>

                <div className="usup-card-footer">
                  <button
                    type="button"
                    className="usup-products-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewSupplier(s);
                    }}
                    title="Preview cataloged products"
                  >
                    <Package size={13} />
                    <span>
                      {supplierProducts.length}{" "}
                      {supplierProducts.length === 1 ? "Product" : "Products"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="usup-view-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSupplierProfile(s);
                    }}
                  >
                    <span>View Details</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="usup-table-card" aria-label="Suppliers list table">
          <div className="usup-table-wrap">
            <table className="usup-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Supplier Type</th>
                  <th>Category</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Profile</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => {
                  const typeMeta = getSupplierTypeMeta(s);
                  const isActive = s.statecode === 0;
                  const normId = normalizeId(s.cr49f_supplierid);
                  const supplierProducts = productsBySupplier[normId] ?? [];
                  const location = [s.cr49f_city, s.cr49f_country].filter(Boolean).join(", ");

                  return (
                    <tr key={s.cr49f_supplierid}>
                      <td>
                        <div
                          className="usup-table-company"
                          onClick={() => openSupplierProfile(s)}
                        >
                          <div className="usup-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                            {getInitials(s.cr49f_name)}
                          </div>
                          <div>
                            <strong>{s.cr49f_name || "Unnamed Supplier"}</strong>
                            <span>{s.cr49f_supplierid1 || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="usup-type-badge">
                          {typeMeta.icon}
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>
                      <td>{s.cr49f_suppliercategory || "—"}</td>
                      <td>
                        <div>
                          {s.cr49f_contactperson && (
                            <div style={{ fontWeight: 600 }}>{s.cr49f_contactperson}</div>
                          )}
                          {s.cr49f_email && (
                            <div style={{ fontSize: 12, color: "var(--muted-foreground-hex)" }}>
                              {s.cr49f_email}
                            </div>
                          )}
                          {!s.cr49f_contactperson && !s.cr49f_email && (s.cr49f_phonenumber || "—")}
                        </div>
                      </td>
                      <td>{location || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="usup-products-btn"
                          onClick={() => setQuickViewSupplier(s)}
                        >
                          <Package size={12} />
                          <span>
                            {supplierProducts.length}{" "}
                            {supplierProducts.length === 1 ? "Product" : "Products"}
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className={`usup-status-pill ${isActive ? "active" : "inactive"}`}>
                          <span className="usup-status-dot" />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="usup-table-view-btn"
                          onClick={() => openSupplierProfile(s)}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Read-Only Products Quick View Modal */}
      {quickViewSupplier && (
        <div
          className="usup-modal-overlay"
          onClick={() => setQuickViewSupplier(null)}
          role="presentation"
        >
          <section
            className="usup-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="usup-products-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="usup-modal-header">
              <div className="usup-modal-title-wrap">
                <div className="usup-stat-icon" style={{ width: 36, height: 36 }}>
                  <Package size={18} />
                </div>
                <div>
                  <h2 id="usup-products-modal-title">
                    {quickViewSupplier.cr49f_name || "Supplier"} Catalog
                  </h2>
                  <p>
                    {quickViewProducts.length}{" "}
                    {quickViewProducts.length === 1 ? "product" : "products"} registered
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="usup-modal-close"
                onClick={() => setQuickViewSupplier(null)}
                aria-label="Close catalog modal"
              >
                <X size={16} />
              </button>
            </header>

            <div className="usup-modal-body">
              {quickViewProducts.length === 0 ? (
                <div className="usup-empty-state" style={{ border: 0, padding: "28px 12px" }}>
                  <Package size={24} />
                  <h3>No catalog products listed</h3>
                  <p>This supplier does not have any products registered in the catalog yet.</p>
                </div>
              ) : (
                quickViewProducts.map((prod) => (
                  <div className="usup-modal-prod-item" key={prod.cr49f_supplierproductid}>
                    <div className="usup-modal-prod-info">
                      <strong>{prod.cr49f_productname || "Unnamed Product"}</strong>
                      <div className="usup-modal-prod-meta">
                        {prod.cr49f_supplierproductnumber && (
                          <span>SKU: {prod.cr49f_supplierproductnumber}</span>
                        )}
                        {prod.cr49f_category && <span>Category: {prod.cr49f_category}</span>}
                        {prod.cr49f_producttypename && <span>{prod.cr49f_producttypename}</span>}
                        {prod.cr49f_availabilityname && <span>{prod.cr49f_availabilityname}</span>}
                      </div>
                    </div>
                    <div className="usup-modal-prod-price">{formatPrice(prod.cr49f_unitprice)}</div>
                  </div>
                ))
              )}
            </div>

            <footer className="usup-modal-footer">
              <button
                type="button"
                className="usup-modal-btn secondary"
                onClick={() => setQuickViewSupplier(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="usup-modal-btn primary"
                onClick={() => {
                  const target = quickViewSupplier;
                  setQuickViewSupplier(null);
                  openSupplierProfile(target);
                }}
              >
                <span>Open Supplier Profile</span>
                <ArrowRight size={14} />
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default UserSuppliersPage;

