import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";
import {
  Cr49f_supplierscr49f_suppliertype,
} from "../generated/models/Cr49f_suppliersModel";
import type { Cr49f_supplierproducts } from "../generated/models/Cr49f_supplierproductsModel";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import SupplierModal from "../components/SupplierModal";
import ModernSelect, { type ModernSelectOption } from "../components/ModernSelect";
import "../Styles/AdminPages.css";

// Helper to get friendly supplier type
const getSupplierTypeName = (supplier: Cr49f_suppliers): { label: string; className: string } => {
  const typeVal = Number(supplier.cr49f_suppliertype);
  if (typeVal === 1) return { label: "Manufacturer", className: "manufacturer" };
  if (typeVal === 2) return { label: "Distributor", className: "distributor" };
  if (typeVal === 3) return { label: "Service Provider", className: "serviceprovider" };
  if (typeVal === 4) return { label: "Contractor", className: "contractor" };
  if (supplier.cr49f_suppliertypename) {
    const raw = supplier.cr49f_suppliertypename.toLowerCase();
    let cls = "manufacturer";
    if (raw.includes("dist")) cls = "distributor";
    else if (raw.includes("service")) cls = "serviceprovider";
    else if (raw.includes("contract")) cls = "contractor";
    return { label: supplier.cr49f_suppliertypename, className: cls };
  }
  return { label: "Unassigned", className: "" };
};

const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Cr49f_suppliers[]>([]);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Cr49f_suppliers | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick View Products Modal
  const [viewProductsSupplier, setViewProductsSupplier] = useState<Cr49f_suppliers | null>(null);

  const fetchSuppliersData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [suppRes, prodRes] = await Promise.allSettled([
        Cr49f_suppliersService.getAll(),
        Cr49f_supplierproductsService.getAll(),
      ]);

      if (suppRes.status === "fulfilled" && !suppRes.value.error) {
        setSuppliers(suppRes.value.data ?? []);
      } else {
        const errMsg =
          suppRes.status === "fulfilled"
            ? suppRes.value.error?.message
            : suppRes.reason instanceof Error
            ? suppRes.reason.message
            : "Failed to load suppliers from Dataverse.";
        setLoadError(errMsg || "Failed to load suppliers from Dataverse.");
        setSuppliers([]);
      }

      if (prodRes.status === "fulfilled" && !prodRes.value.error) {
        setProducts(prodRes.value.data ?? []);
      }
    } catch (err: unknown) {
      console.error("Failed to load suppliers:", err);
      const msg = err instanceof Error ? err.message : "Failed to load suppliers.";
      setLoadError(msg);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSuppliersData();
  }, []);

  // Map products by supplier id
  const productsBySupplier = useMemo(() => {
    const map: Record<string, Cr49f_supplierproducts[]> = {};
    for (const p of products) {
      const supId = p._cr49f_supplier_value;
      if (supId) {
        if (!map[supId]) map[supId] = [];
        map[supId].push(p);
      }
    }
    return map;
  }, [products]);

  // Open Create
  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setIsModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (sup: Cr49f_suppliers) => {
    setSelectedSupplier(sup);
    setIsModalOpen(true);
  };

  // Handle Saved Supplier
  const handleSavedSupplier = (
    savedSupplier: Cr49f_suppliers,
    savedProducts: Cr49f_supplierproducts[]
  ) => {
    setSuppliers((prev) => {
      const exists = prev.some(
        (s) => s.cr49f_supplierid === savedSupplier.cr49f_supplierid
      );
      if (exists) {
        return prev.map((s) =>
          s.cr49f_supplierid === savedSupplier.cr49f_supplierid ? savedSupplier : s
        );
      }
      return [savedSupplier, ...prev];
    });

    // Update products state
    setProducts((prev) => {
      const otherProducts = prev.filter(
        (p) => p._cr49f_supplier_value !== savedSupplier.cr49f_supplierid
      );
      return [...savedProducts, ...otherProducts];
    });

    setToastMessage(
      `Supplier "${savedSupplier.cr49f_name || "Supplier"}" was successfully saved!`
    );
  };

  // Dynamic filter options for supplier types
  const typeFilterOptions = useMemo<ModernSelectOption[]>(() => {
    const list: ModernSelectOption[] = [
      { value: "ALL", label: "All Types", icon: <Truck size={12} /> },
    ];
    Object.entries(Cr49f_supplierscr49f_suppliertype).forEach(([k, v]) => {
      list.push({
        value: k,
        label: String(v),
        icon: <Truck size={12} />,
      });
    });
    return list;
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

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (s.cr49f_name || "").toLowerCase();
      const code = (s.cr49f_supplierid1 || "").toLowerCase();
      const contact = (s.cr49f_contactperson || "").toLowerCase();
      const email = (s.cr49f_email || "").toLowerCase();
      const city = (s.cr49f_city || "").toLowerCase();
      const category = (s.cr49f_suppliercategory || "").toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        code.includes(q) ||
        contact.includes(q) ||
        email.includes(q) ||
        city.includes(q) ||
        category.includes(q);

      if (!matchesSearch) return false;

      // Type filter
      if (selectedTypeFilter !== "ALL") {
        if (String(s.cr49f_suppliertype) !== selectedTypeFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        const isActive = s.statecode === 0;
        if (selectedStatusFilter === "ACTIVE" && !isActive) return false;
        if (selectedStatusFilter === "INACTIVE" && isActive) return false;
      }

      return true;
    });
  }, [suppliers, searchQuery, selectedTypeFilter, selectedStatusFilter]);

  // Statistics
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.statecode === 0).length;
  const totalProducts = products.length;

  return (
    <div className="admin-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          <div className="admin-toast-content">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            className="admin-toast-close"
            onClick={() => setToastMessage(null)}
            title="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">
            <Truck size={14} />
            <span>SUPPLIER MANAGEMENT</span>
          </div>
          <h1 className="admin-title">Suppliers</h1>
          <p className="admin-subtitle">
            Manage registered suppliers and their catalog of products and services.
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchSuppliersData}
            title="Refresh suppliers from Dataverse"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>New Supplier</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <Truck size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Suppliers</span>
            <strong className="admin-stat-value">{totalSuppliers}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <CheckCircle2 size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Suppliers</span>
            <strong className="admin-stat-value">{activeSuppliers}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <Package size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Cataloged Products</span>
            <strong className="admin-stat-value">{totalProducts}</strong>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="admin-card">
        <div className="admin-toolbar">
          <div className="admin-search-wrap">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by supplier name, contact person, email, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-toolbar-filters">
            {/* Type Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 175 }}
              value={selectedTypeFilter}
              options={typeFilterOptions}
              onChange={(val) => setSelectedTypeFilter(val)}
              title="Filter by Type"
              icon={<Truck size={12} />}
            />

            {/* Status Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 145 }}
              value={selectedStatusFilter}
              options={statusFilterOptions}
              onChange={(val) => setSelectedStatusFilter(val)}
              title="Filter by Status"
            />
          </div>
        </div>

        {/* ERROR STATE */}
        {loadError && (
          <div style={{ padding: "16px 20px" }}>
            <div className="admin-banner-error">
              <AlertCircle size={16} className="flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <strong>Unable to retrieve suppliers:</strong> {loadError}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ height: 28, fontSize: 11 }}
                onClick={fetchSuppliersData}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* SUPPLIERS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Supplier Type</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Products</th>
                <th>Status</th>
                <th style={{ width: 90, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    <RefreshCw
                      size={18}
                      className="animate-spin"
                      style={{ margin: "0 auto 8px", display: "block" }}
                    />
                    Loading suppliers from Dataverse...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    {searchQuery ||
                    selectedTypeFilter !== "ALL" ||
                    selectedStatusFilter !== "ALL" ? (
                      <div>
                        <p>No suppliers matched your search filters.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ margin: "8px auto 0" }}
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedTypeFilter("ALL");
                            setSelectedStatusFilter("ALL");
                          }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p>No suppliers found in Dataverse.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary"
                          style={{ margin: "8px auto 0" }}
                          onClick={handleOpenCreate}
                        >
                          <Plus size={14} />
                          <span>Register First Supplier</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const typeInfo = getSupplierTypeName(s);
                  const supplierProducts = productsBySupplier[s.cr49f_supplierid] ?? [];
                  const prodCount = supplierProducts.length;

                  return (
                    <tr key={s.cr49f_supplierid}>
                      {/* COMPANY NAME & CODE */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: "color-mix(in srgb, var(--primary-hex) 12%, transparent)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: "var(--primary-hex)",
                            }}
                          >
                            <Building2 size={16} />
                          </span>
                          <div>
                            <strong style={{ fontSize: 13, display: "block" }}>
                              {s.cr49f_name || "Unnamed Supplier"}
                            </strong>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--muted-foreground-hex)",
                              }}
                            >
                              {s.cr49f_supplierid1 || "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SUPPLIER TYPE */}
                      <td>
                        <span className={`admin-suppliertype-badge ${typeInfo.className}`}>
                          <Truck size={11} />
                          <span>{typeInfo.label}</span>
                        </span>
                      </td>

                      {/* CONTACT PERSON & DETAILS */}
                      <td>
                        <div style={{ fontSize: 12.5 }}>
                          {s.cr49f_contactperson ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <User size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                              <strong>{s.cr49f_contactperson}</strong>
                            </div>
                          ) : null}
                          {s.cr49f_email ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--muted-foreground-hex)",
                                fontSize: 11.5,
                                marginTop: 2,
                              }}
                            >
                              <Mail size={11} />
                              <span>{s.cr49f_email}</span>
                            </div>
                          ) : null}
                          {s.cr49f_phonenumber && !s.cr49f_email ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--muted-foreground-hex)",
                                fontSize: 11.5,
                              }}
                            >
                              <Phone size={11} />
                              <span>{s.cr49f_phonenumber}</span>
                            </div>
                          ) : null}
                          {!s.cr49f_contactperson && !s.cr49f_email && !s.cr49f_phonenumber && "—"}
                        </div>
                      </td>

                      {/* LOCATION */}
                      <td>
                        <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} style={{ color: "var(--muted-foreground-hex)", flexShrink: 0 }} />
                          <span>
                            {[s.cr49f_city, s.cr49f_country].filter(Boolean).join(", ") || "—"}
                          </span>
                        </div>
                      </td>

                      {/* PRODUCTS COUNT */}
                      <td>
                        <button
                          type="button"
                          className="admin-products-badge"
                          onClick={() => setViewProductsSupplier(s)}
                          title="Click to view catalog products"
                        >
                          <Package size={12} />
                          <span>
                            {prodCount} {prodCount === 1 ? "Product" : "Products"}
                          </span>
                        </button>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span
                          className={`admin-status-pill ${
                            s.statecode === 0 ? "active" : "inactive"
                          }`}
                        >
                          {s.statecode === 0 ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="admin-edit-btn"
                          onClick={() => handleOpenEdit(s)}
                          title={`Edit ${s.cr49f_name || "Supplier"}`}
                        >
                          <Pencil size={12} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK VIEW PRODUCTS MODAL */}
      {viewProductsSupplier && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewProductsSupplier(null);
          }}
        >
          <div
            className="admin-modal"
            style={{
              width: "min(680px, 100%)",
              maxHeight: "min(650px, calc(100dvh - 32px))",
            }}
          >
            <div className="admin-modal-header">
              <div className="admin-modal-heading">
                <div className="admin-modal-icon">
                  <Package size={18} />
                </div>
                <div>
                  <h2>{viewProductsSupplier.cr49f_name || "Supplier"} Products</h2>
                  <p>Catalog items supplied by this vendor.</p>
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setViewProductsSupplier(null)}
                title="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ maxHeight: 420, overflowY: "auto" }}>
              {(() => {
                const suppProducts = productsBySupplier[viewProductsSupplier.cr49f_supplierid] ?? [];
                if (suppProducts.length === 0) {
                  return (
                    <div
                      style={{
                        padding: "36px 16px",
                        textAlign: "center",
                        color: "var(--muted-foreground-hex)",
                      }}
                    >
                      <Package size={28} style={{ margin: "0 auto 8px", display: "block" }} />
                      <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                        No Products Registered
                      </strong>
                      <p style={{ fontSize: 11.5, margin: 0 }}>
                        No catalog items have been added for this supplier yet.
                      </p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {suppProducts.map((p) => (
                      <div
                        key={p.cr49f_supplierproductid}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          border: "1px solid var(--border-hex)",
                          background: "var(--card-hex)",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 13, display: "block" }}>
                            {p.cr49f_productname || "Unnamed Product"}
                          </strong>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 11.5,
                              color: "var(--muted-foreground-hex)",
                              marginTop: 4,
                            }}
                          >
                            {p.cr49f_supplierproductnumber && (
                              <span>SKU: {p.cr49f_supplierproductnumber}</span>
                            )}
                            {p.cr49f_category && <span>Category: {p.cr49f_category}</span>}
                            {p.cr49f_warranty && <span>Warranty: {p.cr49f_warranty}</span>}
                          </div>
                          {p.cr49f_productdescription && (
                            <p
                              style={{
                                fontSize: 11.5,
                                color: "var(--muted-foreground-hex)",
                                margin: "6px 0 0",
                              }}
                            >
                              {p.cr49f_productdescription}
                            </p>
                          )}
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {p.cr49f_unitprice && (
                            <strong style={{ fontSize: 14, color: "var(--primary-hex)", display: "block" }}>
                              ${p.cr49f_unitprice}
                            </strong>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              display: "inline-block",
                              marginTop: 4,
                              color: p.cr49f_availability === 1 ? "#16a34a" : "#ef4444",
                              fontWeight: 600,
                            }}
                          >
                            {p.cr49f_availability === 1 ? "Available" : "Not Available"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setViewProductsSupplier(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  const s = viewProductsSupplier;
                  setViewProductsSupplier(null);
                  handleOpenEdit(s);
                }}
              >
                <Pencil size={13} />
                <span>Edit Supplier & Products</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      <SupplierModal
        isOpen={isModalOpen}
        supplier={selectedSupplier}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSupplier(null);
        }}
        onSaved={handleSavedSupplier}
      />
    </div>
  );
};

export default SuppliersPage;
