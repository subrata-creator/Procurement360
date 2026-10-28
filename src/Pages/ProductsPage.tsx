import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Layers,
  Loader2,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Sparkles,
  Tag,
  X,
  XCircle,
} from "lucide-react";
import type { Cr49f_productses } from "../generated/models/Cr49f_productsesModel";
import {
  Cr49f_productsescr49f_producttype,
} from "../generated/models/Cr49f_productsesModel";
import { Cr49f_productsesService } from "../generated/services/Cr49f_productsesService";
import ProductModal from "../components/ProductModal";
import ModernSelect, { type ModernSelectOption } from "../components/ModernSelect";
import "../Styles/AdminPages.css";

export const INITIAL_SAMPLE_PRODUCTS = [
  {
    cr49f_productname: "Dell Latitude 5540 Laptop",
    cr49f_productnumber: "PRD-1001",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Hardware",
    cr49f_unitofmeasure: "Unit",
    cr49f_productdescription: '15.6" FHD Display, Intel Core i7 13th Gen, 32GB DDR5 RAM, 512GB NVMe SSD, Windows 11 Pro Enterprise.',
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: 'Apple MacBook Pro 16" M3 Pro',
    cr49f_productnumber: "PRD-1002",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Hardware",
    cr49f_unitofmeasure: "Unit",
    cr49f_productdescription: "16.2-inch Liquid Retina XDR display, Apple M3 Pro 12-core CPU, 18-core GPU, 36GB Unified Memory, 512GB SSD.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Logitech MX Master 3S Wireless Mouse",
    cr49f_productnumber: "PRD-1003",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Peripherals",
    cr49f_unitofmeasure: "Each",
    cr49f_productdescription: "Ergonomic quiet-click wireless performance mouse, 8000 DPI Darkfield sensor, USB-C fast charging, MagSpeed scrolling.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: 'Dell UltraSharp 27" 4K USB-C Monitor',
    cr49f_productnumber: "PRD-1004",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Hardware",
    cr49f_unitofmeasure: "Unit",
    cr49f_productdescription: "27-inch 4K UHD IPS Black panel, 90W USB-C hub connectivity, RJ45 Ethernet, 100% sRGB color gamut coverage.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Ergonomic Mesh Office Executive Chair",
    cr49f_productnumber: "PRD-1005",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Office Furniture",
    cr49f_unitofmeasure: "Each",
    cr49f_productdescription: "High-back breathable mesh ergonomic office chair with dynamic lumbar support, 4D adjustable armrests, and pneumatic tilt-lock.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Microsoft 365 E5 Enterprise License",
    cr49f_productnumber: "PRD-1006",
    cr49f_producttype: 2 as const, // Services
    cr49f_category: "Software Licenses",
    cr49f_unitofmeasure: "License/Year",
    cr49f_productdescription: "Full suite cloud productivity, Microsoft Defender XDR security, Microsoft Purview information protection, and Teams Phone System.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Cloud Infrastructure Security Assessment",
    cr49f_productnumber: "PRD-1007",
    cr49f_producttype: 2 as const, // Services
    cr49f_category: "Consulting",
    cr49f_unitofmeasure: "Engagement",
    cr49f_productdescription: "Comprehensive cloud architecture vulnerability audit, penetration testing, compliance gap analysis (ISO 27001/SOC 2), and mitigation roadmap.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Quarterly Office HVAC Maintenance & Servicing",
    cr49f_productnumber: "PRD-1008",
    cr49f_producttype: 2 as const, // Services
    cr49f_category: "Facilities",
    cr49f_unitofmeasure: "Quarter",
    cr49f_productdescription: "Comprehensive HVAC inspection, air filter replacements, coil cleaning, refrigerant pressure checks, and thermal comfort calibration.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Enterprise Network Switch (Cisco Catalyst 9300)",
    cr49f_productnumber: "PRD-1009",
    cr49f_producttype: 1 as const, // Goods
    cr49f_category: "Networking",
    cr49f_unitofmeasure: "Unit",
    cr49f_productdescription: "48-port Gigabit PoE+ managed network switch, redundant modular power supplies, StackWise-480 architecture, Layer 3 routing.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
  {
    cr49f_productname: "Annual IT Helpdesk & Managed Support (Level 2/3)",
    cr49f_productnumber: "PRD-1010",
    cr49f_producttype: 2 as const, // Services
    cr49f_category: "Managed Services",
    cr49f_unitofmeasure: "Month",
    cr49f_productdescription: "24/7 proactive monitoring, dedicated level 2/3 incident resolution, user endpoint provisioning, and 15-minute emergency SLA response.",
    cr49f_status: 0 as const,
    statecode: 0 as const,
    statuscode: 1 as const,
  },
];

const getItemTypeInfo = (product: Cr49f_productses): { label: string; className: string } => {
  const typeVal = Number(product.cr49f_producttype);
  if (typeVal === 2) return { label: "Services", className: "services" };
  return { label: "Goods", className: "goods" };
};

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Cr49f_productses[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Seeding state
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Cr49f_productses | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await Cr49f_productsesService.getAll();
      if (res.error) {
        setLoadError(res.error.message || "Failed to load products from Dataverse.");
        setProducts([]);
      } else {
        setProducts(res.data ?? []);
      }
    } catch (err: unknown) {
      console.error("Failed to load products:", err);
      const msg = err instanceof Error ? err.message : "Failed to load products.";
      setLoadError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Cr49f_productses) => {
    setSelectedProduct(p);
    setIsModalOpen(true);
  };

  const handleSavedProduct = (savedProduct: Cr49f_productses) => {
    setProducts((prev) => {
      const exists = prev.some(
        (p) => p.cr49f_productsid === savedProduct.cr49f_productsid
      );
      if (exists) {
        return prev.map((p) =>
          p.cr49f_productsid === savedProduct.cr49f_productsid ? savedProduct : p
        );
      }
      return [savedProduct, ...prev];
    });

    setToastMessage(
      `Product "${savedProduct.cr49f_productname || "Item"}" was successfully saved!`
    );
  };

  // Add 10 sample products handler
  const handleAddSampleProducts = async () => {
    setSeeding(true);
    setSeedProgress("Preparing 10 products...");
    try {
      const added: Cr49f_productses[] = [];
      for (let i = 0; i < INITIAL_SAMPLE_PRODUCTS.length; i++) {
        const item = INITIAL_SAMPLE_PRODUCTS[i];
        setSeedProgress(`Adding item ${i + 1} of 10: "${item.cr49f_productname}"...`);
        const res = await Cr49f_productsesService.create(item);
        if (res.data) {
          added.push(res.data);
        }
      }
      setProducts((prev) => [...added, ...prev]);
      setToastMessage("Successfully created 10 products and services in Dataverse!");
    } catch (err: unknown) {
      console.error("Failed to add sample products:", err);
      const msg = err instanceof Error ? err.message : "Failed to add products.";
      setLoadError(`Error adding sample products: ${msg}`);
    } finally {
      setSeeding(false);
      setSeedProgress(null);
    }
  };

  // Distinct Categories derived from Dataverse records
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.cr49f_category && p.cr49f_category.trim()) {
        set.add(p.cr49f_category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Type filter options
  const typeFilterOptions = useMemo<ModernSelectOption[]>(() => {
    const list: ModernSelectOption[] = [
      { value: "ALL", label: "All Types", icon: <Layers size={12} /> },
    ];
    Object.entries(Cr49f_productsescr49f_producttype).forEach(([k, v]) => {
      list.push({
        value: k,
        label: String(v),
        icon: Number(k) === 2 ? <Briefcase size={12} /> : <Package size={12} />,
      });
    });
    return list;
  }, []);

  // Category filter options
  const categoryFilterOptions = useMemo<ModernSelectOption[]>(() => {
    return [
      {
        value: "ALL",
        label: `All Categories (${distinctCategories.length})`,
        icon: <Tag size={12} />,
      },
      ...distinctCategories.map((c) => ({
        value: c,
        label: c,
        icon: <Tag size={12} />,
      })),
    ];
  }, [distinctCategories]);

  // Status filter options
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

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (p.cr49f_productname || "").toLowerCase();
      const code = (p.cr49f_productnumber || "").toLowerCase();
      const cat = (p.cr49f_category || "").toLowerCase();
      const uom = (p.cr49f_unitofmeasure || "").toLowerCase();
      const desc = (p.cr49f_productdescription || "").toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        code.includes(q) ||
        cat.includes(q) ||
        uom.includes(q) ||
        desc.includes(q);

      if (!matchesSearch) return false;

      // Type filter
      if (selectedTypeFilter !== "ALL") {
        if (String(p.cr49f_producttype) !== selectedTypeFilter) return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "ALL") {
        if ((p.cr49f_category || "").trim() !== selectedCategoryFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        const isActive = p.statecode === 0;
        if (selectedStatusFilter === "ACTIVE" && !isActive) return false;
        if (selectedStatusFilter === "INACTIVE" && isActive) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedTypeFilter, selectedCategoryFilter, selectedStatusFilter]);

  // Statistics
  const totalItems = products.length;
  const totalGoods = products.filter((p) => Number(p.cr49f_producttype) === 1).length;
  const totalServices = products.filter((p) => Number(p.cr49f_producttype) === 2).length;
  const totalActive = products.filter((p) => p.statecode === 0).length;

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
            <PackageSearch size={14} />
            <span>CATALOG MANAGEMENT</span>
          </div>
          <h1 className="admin-title">Products & Services</h1>
          <p className="admin-subtitle">
            Manage standardized procurement product catalogs, goods, and services.
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchProducts}
            title="Refresh product catalog from Dataverse"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={handleAddSampleProducts}
            disabled={seeding || loading}
            title="Add 10 standardized products and services to Dataverse"
            style={{
              borderColor: "color-mix(in srgb, var(--primary-hex) 40%, var(--border-hex))",
              background: "color-mix(in srgb, var(--primary-hex) 8%, transparent)",
            }}
          >
            {seeding ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{seedProgress || "Adding..."}</span>
              </>
            ) : (
              <>
                <Sparkles size={14} style={{ color: "var(--primary-hex)" }} />
                <span>Add 10 Products</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleOpenCreate}
            disabled={seeding}
          >
            <Plus size={15} />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <PackageSearch size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Catalog Items</span>
            <strong className="admin-stat-value">{totalItems}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <Package size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Goods</span>
            <strong className="admin-stat-value">{totalGoods}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <Briefcase size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Services</span>
            <strong className="admin-stat-value">{totalServices}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <CheckCircle2 size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Items</span>
            <strong className="admin-stat-value">{totalActive}</strong>
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
              placeholder="Search by product name, SKU, category, UOM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-toolbar-filters">
            {/* Type Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 145 }}
              value={selectedTypeFilter}
              options={typeFilterOptions}
              onChange={(val) => setSelectedTypeFilter(val)}
              title="Filter by Type"
            />

            {/* Category Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 180 }}
              value={selectedCategoryFilter}
              options={categoryFilterOptions}
              onChange={(val) => setSelectedCategoryFilter(val)}
              title="Filter by Category"
            />

            {/* Status Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 140 }}
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
                <strong>Unable to retrieve products:</strong> {loadError}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ height: 28, fontSize: 11 }}
                onClick={fetchProducts}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* PRODUCTS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Unit of Measure</th>
                <th>Description</th>
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
                    Loading products from Dataverse...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    {searchQuery ||
                    selectedTypeFilter !== "ALL" ||
                    selectedCategoryFilter !== "ALL" ||
                    selectedStatusFilter !== "ALL" ? (
                      <div>
                        <p>No products matched your search filters.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ margin: "8px auto 0" }}
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedTypeFilter("ALL");
                            setSelectedCategoryFilter("ALL");
                            setSelectedStatusFilter("ALL");
                          }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p>No products found in Dataverse.</p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn-primary"
                            onClick={handleAddSampleProducts}
                            disabled={seeding}
                          >
                            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            <span>{seeding ? (seedProgress || "Adding 10 Products...") : "Add 10 Sample Products"}</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={handleOpenCreate}
                            disabled={seeding}
                          >
                            <Plus size={14} />
                            <span>Add Custom Product</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const typeInfo = getItemTypeInfo(p);
                  const isGoods = Number(p.cr49f_producttype) !== 2;

                  return (
                    <tr key={p.cr49f_productsid}>
                      {/* ITEM NAME & SKU */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: isGoods
                                ? "color-mix(in srgb, #3b82f6 12%, transparent)"
                                : "color-mix(in srgb, #10b981 12%, transparent)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: isGoods ? "#2563eb" : "#059669",
                            }}
                          >
                            {isGoods ? <Package size={16} /> : <Briefcase size={16} />}
                          </span>
                          <div>
                            <strong style={{ fontSize: 13, display: "block" }}>
                              {p.cr49f_productname || "Unnamed Item"}
                            </strong>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--muted-foreground-hex)",
                              }}
                            >
                              {p.cr49f_productnumber || "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* ITEM TYPE */}
                      <td>
                        <span className={`admin-type-badge ${typeInfo.className}`}>
                          {isGoods ? <Package size={11} /> : <Briefcase size={11} />}
                          <span>{typeInfo.label}</span>
                        </span>
                      </td>

                      {/* CATEGORY */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                          <Tag size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                          <span>{p.cr49f_category || "General"}</span>
                        </div>
                      </td>

                      {/* UNIT OF MEASURE */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                          <Ruler size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                          <span>{p.cr49f_unitofmeasure || "Each"}</span>
                        </div>
                      </td>

                      {/* DESCRIPTION */}
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--muted-foreground-hex)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            maxWidth: 260,
                          }}
                        >
                          {p.cr49f_productdescription || "—"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span
                          className={`admin-status-pill ${
                            p.statecode === 0 ? "active" : "inactive"
                          }`}
                        >
                          {p.statecode === 0 ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="admin-edit-btn"
                          onClick={() => handleOpenEdit(p)}
                          title={`Edit ${p.cr49f_productname || "Item"}`}
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

      {/* CREATE & EDIT MODAL */}
      <ProductModal
        isOpen={isModalOpen}
        product={selectedProduct}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
        onSaved={handleSavedProduct}
      />
    </div>
  );
};

export default ProductsPage;
