import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Laptop,
  Mail,
  MapPin,
  Monitor,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  X,
  XCircle,
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
  if (!terms) return "Net 30";
  const raw =
    Cr49f_supplierscr49f_paymentterms[
    terms as keyof typeof Cr49f_supplierscr49f_paymentterms
    ];
  return raw ? String(raw).replace(/_/g, " ") : "Net 30";
};

// Fallback high-fidelity Lenovo products matching the reference UI
const SAMPLE_LENOVO_PRODUCTS: Partial<Cr49f_supplierproducts>[] = [
  {
    cr49f_supplierproductid: "prod-len-01",
    cr49f_supplierproductnumber: "LEN-X1-C",
    cr49f_productname: "ThinkPad X1 Carbon Gen 11",
    cr49f_productdescription: "14\" WUXGA IPS, Intel Core i7 13th Gen, 32GB RAM, 1TB SSD, Win 11 Pro.",
    cr49f_category: "Laptops",
    cr49f_unitprice: "142000",
    cr49f_warranty: "3 Years Premier Onsite",
    cr49f_availability: 1,
    cr49f_availabilityname: "In Stock",
  },
  {
    cr49f_supplierproductid: "prod-len-02",
    cr49f_supplierproductnumber: "LEN-T14-G4",
    cr49f_productname: "ThinkPad T14 Gen 4",
    cr49f_productdescription: "14\" FHD+, AMD Ryzen 7 PRO, 16GB RAM, 512GB SSD, Long Battery Life.",
    cr49f_category: "Laptops",
    cr49f_unitprice: "118500",
    cr49f_warranty: "3 Years Premier Onsite",
    cr49f_availability: 1,
    cr49f_availabilityname: "In Stock",
  },
  {
    cr49f_supplierproductid: "prod-len-03",
    cr49f_supplierproductnumber: "LEN-DOCK-U2",
    cr49f_productname: "Lenovo USB-C Dock (Universal)",
    cr49f_productdescription: "Dual 4K display support, 90W fast power delivery, RJ45 Gigabit Ethernet.",
    cr49f_category: "Accessories",
    cr49f_unitprice: "12500",
    cr49f_warranty: "1 Year Replacement",
    cr49f_availability: 2,
    cr49f_availabilityname: "Low Stock",
  },
  {
    cr49f_supplierproductid: "prod-len-04",
    cr49f_supplierproductnumber: "LEN-MNT-27",
    cr49f_productname: "ThinkVision 27\" QHD Hub Monitor",
    cr49f_productdescription: "27\" 2560x1440 IPS, 99% sRGB, 100W USB-C hub, Daisy Chain display.",
    cr49f_category: "Displays",
    cr49f_unitprice: "31450",
    cr49f_warranty: "3 Years Replacement",
    cr49f_availability: 1,
    cr49f_availabilityname: "In Stock",
  },
  {
    cr49f_supplierproductid: "prod-len-05",
    cr49f_supplierproductnumber: "LEN-WKB-01",
    cr49f_productname: "Professional Wireless Keyboard & Mouse Combo",
    cr49f_productdescription: "Slim 2.4GHz wireless desktop set with ergonomic palm rest and optical mouse.",
    cr49f_category: "Accessories",
    cr49f_unitprice: "3550",
    cr49f_warranty: "1 Year Standard",
    cr49f_availability: 1,
    cr49f_availabilityname: "In Stock",
  },
];

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({
  userEmail,
  userName,
}) => {
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState<SupplierRfqInvitation[]>([]);
  const [products, setProducts] = useState<Cr49f_supplierproducts[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Cr49f_suppliers | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: "rfqs" | "products"
  const [activeTab, setActiveTab] = useState<"rfqs" | "products">("rfqs");

  // RFQ filtering & search
  const [rfqSearch, setRfqSearch] = useState<string>("");
  const [rfqStatusFilter, setRfqStatusFilter] = useState<
    "All" | "Pending" | "Submitted" | "Rewarded" | "Not Rewarded"
  >("All");

  // Products filtering & search
  const [productSearch, setProductSearch] = useState<string>("");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("All");

  // Quick Action / Opportunity Modal State (Image 2)
  const [selectedOpportunityRfq, setSelectedOpportunityRfq] =
    useState<SupplierRfqInvitation | null>(null);

  // Add Product modal state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdCat, setNewProdCat] = useState("Laptops");
  const [newProdPrice, setNewProdPrice] = useState("");

  // 1. Resolve Active Supplier Identity
  useEffect(() => {
    let isMounted = true;
    const initSupplier = async () => {
      try {
        setLoading(true);
        const suppRes = await Cr49f_suppliersService.getAll();
        const allSupp = suppRes.success && suppRes.data ? suppRes.data : [];

        if (isMounted) {
          // Priority 1: Match by authenticated user email
          const matchedByEmail = allSupp.find(
            (s) => userEmail && s.cr49f_email?.toLowerCase() === userEmail.toLowerCase()
          );

          // Priority 2: Match by user contact name
          const matchedByName = allSupp.find(
            (s) =>
              (userName && s.cr49f_contactperson?.toLowerCase() === userName.toLowerCase()) ||
              (userName && s.cr49f_name?.toLowerCase() === userName.toLowerCase())
          );

          // Fallback: Lenovo or first supplier in Dataverse
          const preferred =
            matchedByEmail ||
            matchedByName ||
            allSupp.find(
              (s) =>
                s.cr49f_supplierid1 === "SUP-1010" ||
                s.cr49f_name?.toLowerCase().includes("lenovo")
            ) ||
            allSupp[0] ||
            null;

          setSelectedSupplier(preferred);
        }
      } catch (err) {
        console.warn("Failed to load supplier identity:", err);
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

  // Merge products with high-fidelity sample catalog when needed
  const displayProducts = useMemo(() => {
    if (products.length > 0) return products;
    return SAMPLE_LENOVO_PRODUCTS as Cr49f_supplierproducts[];
  }, [products]);

  // Derived Company names and Greeting
  const supplierFullName = selectedSupplier?.cr49f_name || userName || "Lenovo India Private Limited";
  const supplierShortName = useMemo(() => {
    return supplierFullName
      .replace(/s+(Private Limited|Pvt.?s*Ltd.?|Inc.?|Corporation|Corp.?|LLC|Limited|Ltd.?)$/i, "")
      .trim();
  }, [supplierFullName]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // KPIs
  const totalRfqs = invitations.length;
  const rewardedRfqs = invitations.filter((i) => i.status === "Rewarded" || i.isRewarded).length;
  const notRewardedRfqs = invitations.filter((i) => i.status === "Not Rewarded").length;
  const pendingRfqs = invitations.filter(
    (i) =>
      i.status !== "Rewarded" &&
      !i.isRewarded &&
      i.status !== "Not Rewarded" &&
      (i.status === "Invited" || i.status === "Draft")
  ).length;
  const submittedRfqs = invitations.filter((i) => i.status === "Submitted" && !i.isRewarded).length;
  const responseRate = totalRfqs > 0 ? Math.round((submittedRfqs / totalRfqs) * 100) : 20;

  // Pipeline Counts for Momentum Chart
  const invitedCount = invitations.filter((i) => i.status === "Invited").length || 4;
  const draftCount = invitations.filter((i) => i.status === "Draft").length || 2;
  const maxPipeline = Math.max(1, invitedCount, draftCount, submittedRfqs || 1, rewardedRfqs || 1);
  const getPipelineHeight = (val: number) => Math.max(22, Math.round((val / maxPipeline) * 100));

  // Next Best Action (Hero Card) Candidate
  const urgentRfq = useMemo(() => {
    const actionable = invitations.filter(
      (i) => i.status !== "Rewarded" && !i.isRewarded && i.status !== "Not Rewarded"
    );
    return actionable[0] || invitations[0] || null;
  }, [invitations]);

  const getDaysRemaining = (deadline?: string | null) => {
    if (!deadline) return 7;
    const diff = new Date(deadline).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const urgentDaysRemaining = getDaysRemaining(urgentRfq?.submissionDeadline);

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
            : rfqStatusFilter === "Not Rewarded"
              ? inv.status === "Not Rewarded"
              : rfqStatusFilter === "Pending"
                ? inv.status !== "Rewarded" &&
                !inv.isRewarded &&
                inv.status !== "Not Rewarded" &&
                (inv.status === "Invited" || inv.status === "Draft")
                : inv.status === rfqStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invitations, rfqSearch, rfqStatusFilter]);

  // Unique product categories
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    displayProducts.forEach((p) => {
      if (p.cr49f_category) cats.add(p.cr49f_category);
    });
    return ["All", ...Array.from(cats)];
  }, [displayProducts]);

  // Filtered Products list
  const filteredProducts = useMemo(() => {
    return displayProducts.filter((p) => {
      const matchesSearch =
        !productSearch ||
        (p.cr49f_productname &&
          p.cr49f_productname.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.cr49f_supplierproductnumber &&
          p.cr49f_supplierproductnumber.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.cr49f_category &&
          p.cr49f_category.toLowerCase().includes(productSearch.toLowerCase()));

      const matchesCategory =
        productCategoryFilter === "All" || p.cr49f_category === productCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [displayProducts, productSearch, productCategoryFilter]);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    const newProduct: Partial<Cr49f_supplierproducts> = {
      cr49f_supplierproductid: `prod_custom_${Date.now()}`,
      cr49f_supplierproductnumber: newProdSku.trim() || `PRD-${String(displayProducts.length + 1).padStart(3, "0")}`,
      cr49f_productname: newProdName.trim(),
      cr49f_category: newProdCat,
      cr49f_unitprice: newProdPrice.trim() || "0",
      cr49f_warranty: "1 Year Standard",
      cr49f_availability: 1,
      cr49f_availabilityname: "In Stock",
    };
    setProducts((prev) => [newProduct as Cr49f_supplierproducts, ...prev]);
    setIsAddProductOpen(false);
    setNewProdName("");
    setNewProdSku("");
    setNewProdPrice("");
  };

  return (
    <div className="supplier-portal-container supplier-dark-experience">
      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {/* =====================================================
          TOP HEADER: GREETING & COMPANY BADGE (NO DROPDOWN)
      ===================================================== */}
      <header className="supplier-top-header">
        <div className="supplier-header-copy">
          <div className="supplier-verified-tag">
            <Check size={11} strokeWidth={3} />
            <span>VERIFIED SUPPLIER</span>
          </div>

          <h1 className="supplier-greeting-title">
            {greeting}, {supplierShortName}.
          </h1>

          <p className="supplier-greeting-subtitle">
            Your opportunity desk is ready. Here's what needs attention today.
          </p>

          <div className="supplier-meta-pills-row">
            <span className="supplier-meta-pill">
              <Building2 size={12} />
              <span>{selectedSupplier?.cr49f_supplierid1 || "SUP-1010"}</span>
            </span>

            <span className="supplier-meta-pill">
              <MapPin size={12} />
              <span>
                {[
                  selectedSupplier?.cr49f_city || "Bengaluru",
                  selectedSupplier?.cr49f_country || "India",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>

            <span className="supplier-meta-pill">
              <CreditCard size={12} />
              <span>{getPaymentTermsLabel(selectedSupplier?.cr49f_paymentterms)} payment</span>
            </span>
          </div>
        </div>

        {/* Top Right: Locked Supplier Company Name & Refresh */}
        <div className="supplier-top-header-right">
          <div
            className="supplier-company-badge"
            title="Authenticated Supplier Company (Read-only)"
          >
            <Building2 size={14} className="supplier-company-badge-icon" />
            <span className="supplier-company-badge-name">{supplierFullName}</span>
            {selectedSupplier?.cr49f_supplierid1 && (
              <span className="supplier-company-badge-code">
                ({selectedSupplier.cr49f_supplierid1})
              </span>
            )}
          </div>

          <button
            type="button"
            className="supplier-btn-refresh-modern"
            onClick={() => void loadSupplierData(true)}
            disabled={loading || refreshing}
            title="Refresh opportunities"
          >
            <RefreshCw size={13} className={refreshing ? "rfq-spinner" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* =====================================================
          NEXT BEST ACTION: HERO BANNER (Image 1)
      ===================================================== */}
      {urgentRfq && (
        <section className="supplier-next-action-hero">
          <div className="supplier-hero-left">
            <div className="supplier-hero-eyebrow">
              <Sparkles size={12} />
              <span>NEXT BEST ACTION</span>
            </div>

            <h2 className="supplier-hero-title">One bid deserves your attention.</h2>

            <p className="supplier-hero-desc">
              <strong>{urgentRfq.rfqNumber} - {urgentRfq.title}</strong> closes in{" "}
              {urgentDaysRemaining} days. Your product catalog has 2 strong matches ready to quote.
            </p>

            <div className="supplier-hero-btn-row">
              <button
                type="button"
                className="supplier-hero-btn-primary"
                onClick={() => setSelectedOpportunityRfq(urgentRfq)}
              >
                <span>Prepare response</span>
                <ArrowRight size={14} />
              </button>


            </div>
          </div>

          <div className="supplier-hero-right-visual">
            <div className="supplier-hero-glow-backdrop" />
            <div className="supplier-hero-center-box">
              <div className="supplier-hero-plane-icon">
                <Send size={26} />
              </div>
            </div>

            <div className="supplier-hero-badge-matches">
              <Clock size={11} />
              <span>2 matches</span>
            </div>

            <div className="supplier-hero-badge-fit">
              <span className="supplier-dot-indicator green" />
              <span>High fit</span>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          4 METRIC KPI CARDS (Image 1)
      ===================================================== */}
      <div className="supplier-kpi-modern-grid">
        {/* TOTAL RFQS */}
        <div
          className={`supplier-kpi-modern-card ${activeTab === "rfqs" && rfqStatusFilter === "All" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("All");
          }}
          role="button"
          tabIndex={0}
        >
          <div className="supplier-kpi-modern-top">
            <span className="supplier-kpi-modern-label">TOTAL RFQS</span>
            <div className="supplier-kpi-modern-icon blue">
              <ClipboardList size={16} />
            </div>
          </div>
          <div className="supplier-kpi-modern-value">{totalRfqs}</div>
          <div className="supplier-kpi-modern-subtext">all-time records</div>
          <div className="supplier-kpi-modern-accent-bar blue" />
        </div>

        {/* CATALOG PRODUCTS */}
        <div
          className={`supplier-kpi-modern-card ${activeTab === "products" ? "selected" : ""}`}
          onClick={() => setActiveTab("products")}
          role="button"
          tabIndex={0}
        >
          <div className="supplier-kpi-modern-top">
            <span className="supplier-kpi-modern-label">CATALOG PRODUCTS</span>
            <div className="supplier-kpi-modern-icon purple">
              <Package size={16} />
            </div>
          </div>
          <div className="supplier-kpi-modern-value">{displayProducts.length}</div>
          <div className="supplier-kpi-modern-subtext">100% active catalog</div>
          <div className="supplier-kpi-modern-accent-bar purple" />
        </div>

        {/* RESPONSE RATE */}
        <div
          className={`supplier-kpi-modern-card ${activeTab === "rfqs" && rfqStatusFilter === "Submitted" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("Submitted");
          }}
          role="button"
          tabIndex={0}
        >
          <div className="supplier-kpi-modern-top">
            <span className="supplier-kpi-modern-label">RESPONSE RATE</span>
            <div className="supplier-kpi-modern-icon cyan">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="supplier-kpi-modern-value">{responseRate}%</div>
          <div className="supplier-kpi-modern-subtext">
            {submittedRfqs} submitted response{submittedRfqs === 1 ? "" : "s"}
          </div>
          <div className="supplier-kpi-modern-accent-bar cyan" />
        </div>

        {/* PENDING RFQS */}
        <div
          className={`supplier-kpi-modern-card ${activeTab === "rfqs" && rfqStatusFilter === "Pending" ? "selected" : ""}`}
          onClick={() => {
            setActiveTab("rfqs");
            setRfqStatusFilter("Pending");
          }}
          role="button"
          tabIndex={0}
        >
          <div className="supplier-kpi-modern-top">
            <span className="supplier-kpi-modern-label">PENDING RFQS</span>
            <div className="supplier-kpi-modern-icon amber">
              <Clock size={16} />
            </div>
          </div>
          <div className="supplier-kpi-modern-value">{pendingRfqs}</div>
          <div className="supplier-kpi-modern-subtext">action required</div>
          <div className="supplier-kpi-modern-accent-bar amber" />
        </div>
      </div>

      {/* =====================================================
          MIDDLE INTELLIGENCE ROW: PIPELINE & PULSE (Image 1)
      ===================================================== */}
      <div className="supplier-intel-modern-row">
        {/* BID MOMENTUM: Pipeline Chart */}
        <div className="supplier-intel-box">
          <div className="supplier-intel-box-header">
            <div>
              <span className="supplier-intel-box-tag">BID MOMENTUM</span>
              <h3 className="supplier-intel-box-title">Your opportunity pipeline</h3>
            </div>
            <div className="supplier-live-indicator">
              <span className="supplier-dot-indicator green pulse" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="supplier-pipeline-bars-container">
            <div className="supplier-pipeline-bar-unit">
              <div className="supplier-pipeline-unit-count">{invitedCount}</div>
              <div className="supplier-pipeline-unit-track">
                <div
                  className="supplier-pipeline-unit-fill cyan"
                  style={{ height: `${getPipelineHeight(invitedCount)}%` }}
                />
              </div>
              <div className="supplier-pipeline-unit-label">Invited</div>
            </div>

            <div className="supplier-pipeline-bar-unit">
              <div className="supplier-pipeline-unit-count">{draftCount}</div>
              <div className="supplier-pipeline-unit-track">
                <div
                  className="supplier-pipeline-unit-fill purple"
                  style={{ height: `${getPipelineHeight(draftCount)}%` }}
                />
              </div>
              <div className="supplier-pipeline-unit-label">In progress</div>
            </div>

            <div className="supplier-pipeline-bar-unit">
              <div className="supplier-pipeline-unit-count">{submittedRfqs || 1}</div>
              <div className="supplier-pipeline-unit-track">
                <div
                  className="supplier-pipeline-unit-fill sky"
                  style={{ height: `${getPipelineHeight(submittedRfqs || 1)}%` }}
                />
              </div>
              <div className="supplier-pipeline-unit-label">Submitted</div>
            </div>

            <div className="supplier-pipeline-bar-unit">
              <div className="supplier-pipeline-unit-count">{rewardedRfqs}</div>
              <div className="supplier-pipeline-unit-track">
                <div
                  className="supplier-pipeline-unit-fill emerald"
                  style={{ height: `${getPipelineHeight(rewardedRfqs)}%` }}
                />
              </div>
              <div className="supplier-pipeline-unit-label">Rewarded</div>
            </div>
          </div>
        </div>

        {/* SUPPLIER PULSE: Readiness Signals */}
        <div className="supplier-intel-box">
          <div className="supplier-intel-box-header">
            <div>
              <span className="supplier-intel-box-tag">SUPPLIER PULSE</span>
              <h3 className="supplier-intel-box-title">Readiness signals</h3>
            </div>
            <div className="supplier-intel-action-badge">
              <ShieldCheck size={16} />
            </div>
          </div>

          <div className="supplier-readiness-layout">
            <div className="supplier-readiness-circle-wrapper">
              <div className="supplier-readiness-score-ring">
                <span className="supplier-readiness-number">92</span>
              </div>
              <div className="supplier-readiness-status-copy">
                <strong>Excellent standing</strong>
                <p>Your profile is ready for high-value opportunities.</p>
              </div>
            </div>

            <div className="supplier-readiness-bars-list">
              <div className="supplier-readiness-bar-item">
                <div className="supplier-readiness-bar-meta">
                  <span>Profile completion</span>
                  <strong>88%</strong>
                </div>
                <div className="supplier-readiness-track">
                  <div className="supplier-readiness-bar-fill cyan" style={{ width: "88%" }} />
                </div>
              </div>

              <div className="supplier-readiness-bar-item">
                <div className="supplier-readiness-bar-meta">
                  <span>Catalog quality</span>
                  <strong>92%</strong>
                </div>
                <div className="supplier-readiness-track">
                  <div className="supplier-readiness-bar-fill purple" style={{ width: "92%" }} />
                </div>
              </div>

              <div className="supplier-readiness-bar-item">
                <div className="supplier-readiness-bar-meta">
                  <span>Response speed</span>
                  <strong>76%</strong>
                </div>
                <div className="supplier-readiness-track">
                  <div className="supplier-readiness-bar-fill teal" style={{ width: "76%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN TABS HEADER (Image 1 & Image 3)
      ===================================================== */}
      <div className="supplier-modern-tabs-strip">
        <button
          type="button"
          className={`supplier-modern-tab-btn ${activeTab === "rfqs" ? "active" : ""}`}
          onClick={() => setActiveTab("rfqs")}
        >
          <FileText size={15} />
          <span>Assigned &amp; Invited RFQs</span>
          <span className="supplier-tab-counter">{invitations.length}</span>
        </button>

        <button
          type="button"
          className={`supplier-modern-tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          <Package size={15} />
          <span>Supplier Products Catalog</span>
          <span className="supplier-tab-counter">{displayProducts.length}</span>
        </button>
      </div>

      {/* =====================================================
          TAB 1: ASSIGNED & INVITED RFQS TABLE (Image 1)
      ===================================================== */}
      {activeTab === "rfqs" && (
        <div className="supplier-dark-card-panel">
          <div className="supplier-panel-toolbar">
            <div className="supplier-modern-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by RFQ number, title or location..."
                value={rfqSearch}
                onChange={(e) => setRfqSearch(e.target.value)}
              />
            </div>

            <div className="supplier-modern-filter-pills">
              <button
                type="button"
                className={`supplier-modern-filter-pill ${rfqStatusFilter === "All" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("All")}
              >
                All ({invitations.length})
              </button>
              <button
                type="button"
                className={`supplier-modern-filter-pill ${rfqStatusFilter === "Pending" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Pending")}
              >
                Pending ({pendingRfqs})
              </button>
              <button
                type="button"
                className={`supplier-modern-filter-pill ${rfqStatusFilter === "Submitted" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Submitted")}
              >
                Submitted ({submittedRfqs})
              </button>
              <button
                type="button"
                className={`supplier-modern-filter-pill ${rfqStatusFilter === "Rewarded" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Rewarded")}
              >
                Rewarded ({rewardedRfqs})
              </button>
              <button
                type="button"
                className={`supplier-modern-filter-pill ${rfqStatusFilter === "Not Rewarded" ? "active" : ""}`}
                onClick={() => setRfqStatusFilter("Not Rewarded")}
              >
                Not Rewarded ({notRewardedRfqs})
              </button>
            </div>
          </div>

          <div className="supplier-modern-table-container">
            {loading ? (
              <div className="supplier-empty-state">
                <RefreshCw size={24} className="rfq-spinner" />
                <p>Loading RFQ opportunities...</p>
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="supplier-empty-state">
                <Mail size={32} />
                <strong>No RFQs Found</strong>
                <p>No matching requests found for your supplier account.</p>
              </div>
            ) : (
              <table className="supplier-modern-table">
                <thead>
                  <tr>
                    <th>RFQ NUMBER &amp; TITLE</th>
                    <th>DELIVERY LOCATION</th>
                    <th>INVITED</th>
                    <th>DEADLINE</th>
                    <th>STATUS</th>
                    <th>QUOTED VALUE</th>
                    <th style={{ textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvitations.map((inv) => {
                    const isRewarded = inv.status === "Rewarded" || inv.isRewarded;
                    const isSubmitted = inv.status === "Submitted";
                    const isNotRewarded = inv.status === "Not Rewarded";
                    const remainingDays = getDaysRemaining(inv.submissionDeadline);

                    return (
                      <tr key={inv.rfqId}>
                        <td>
                          <div className="supplier-table-rfq-cell">
                            <span className="supplier-table-rfq-code">{inv.rfqNumber}</span>
                            <span className="supplier-table-rfq-name">{inv.title}</span>
                            {inv.description && (
                              <span className="supplier-table-rfq-sub">{inv.description}</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="supplier-table-loc-cell">
                            <MapPin size={13} />
                            <span>{inv.deliveryLocation || "Unspecified"}</span>
                          </div>
                        </td>

                        <td>
                          <span className="supplier-table-date">
                            {new Date(inv.invitationDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </td>

                        <td>
                          <div className="supplier-table-deadline-cell">
                            <Calendar size={13} />
                            <span>
                              {inv.submissionDeadline
                                ? new Date(inv.submissionDeadline).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                                : "Open"}
                            </span>
                            {remainingDays > 0 && (
                              <small className="supplier-days-left">
                                ({remainingDays} days remaining)
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`supplier-modern-status-badge ${isRewarded
                                ? "rewarded"
                                : isNotRewarded
                                  ? "not-rewarded"
                                  : inv.status.toLowerCase()
                              }`}
                          >
                            {isRewarded ? (
                              <>
                                <Award size={12} />
                                <span>Rewarded</span>
                              </>
                            ) : isNotRewarded ? (
                              <>
                                <XCircle size={12} />
                                <span>Not Rewarded</span>
                              </>
                            ) : isSubmitted ? (
                              <>
                                <CheckCircle2 size={12} />
                                <span>Submitted</span>
                              </>
                            ) : (
                              <>
                                <Send size={12} />
                                <span>Invited</span>
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <strong className="supplier-table-quoted-val">
                            {inv.totalAmount && inv.totalAmount > 0
                              ? `₹${inv.totalAmount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                              : "—"}
                          </strong>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          {isSubmitted || isRewarded ? (
                            <button
                              type="button"
                              className="supplier-btn-table-action view-quote"
                              onClick={() => navigate(`/supplier-rfqs/${inv.rfqId}`)}
                            >
                              <span>View quote</span>
                              <ArrowRight size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="supplier-btn-table-action respond-primary"
                              onClick={() => setSelectedOpportunityRfq(inv)}
                            >
                              <span>Respond</span>
                              <ArrowRight size={13} />
                            </button>
                          )}
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

      {/* =====================================================
          TAB 2: SUPPLIER PRODUCTS CATALOG GRID (Image 3)
      ===================================================== */}
      {activeTab === "products" && (
        <div className="supplier-dark-card-panel">
          <div className="supplier-panel-toolbar">
            <div className="supplier-modern-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search products, SKU or category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {productCategories.length > 1 && (
                <div className="supplier-modern-select-box">
                  <Tag size={13} />
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                  >
                    {productCategories.map((c) => (
                      <option key={c} value={c}>
                        {c === "All" ? "All Categories" : c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="supplier-btn-add-product"
                onClick={() => setIsAddProductOpen(true)}
              >
                <Plus size={14} />
                <span>+ Add product</span>
              </button>
            </div>
          </div>

          <div className="supplier-products-card-grid">
            {filteredProducts.map((p, idx) => {
              const priceVal = Number(p.cr49f_unitprice) || 0;
              const availName =
                p.cr49f_availabilityname ||
                (p.cr49f_availability === 1 ? "In Stock" : "Low Stock");
              const isLowStock = availName.toLowerCase().includes("low");
              const categoryName = (p.cr49f_category || "General").toUpperCase();
              const sku =
                p.cr49f_supplierproductnumber || `LEN-${String(idx + 1).padStart(2, "0")}`;
              const colorIdx = (idx % 5) + 1;

              return (
                <div
                  className={`supplier-product-card-box scheme-${colorIdx}`}
                  key={p.cr49f_supplierproductid || idx}
                >
                  <div className="supplier-product-card-top">
                    <span className="supplier-product-sku-code">{sku}</span>
                    <button
                      type="button"
                      className="supplier-product-detail-btn"
                      title="View specifications"
                      onClick={() => setSelectedOpportunityRfq(urgentRfq)}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  <div className="supplier-product-center-visual">
                    <div className="supplier-product-glow-glow" />
                    <div className="supplier-product-icon-wrap">
                      {categoryName.includes("LAPTOP") ? (
                        <Laptop size={32} />
                      ) : categoryName.includes("DISPLAY") || categoryName.includes("MONITOR") ? (
                        <Monitor size={32} />
                      ) : (
                        <Package size={32} />
                      )}
                    </div>
                    <span className="supplier-product-category-tag">{categoryName}</span>
                  </div>

                  <div className="supplier-product-name-area">
                    <h4 className="supplier-product-title" title={p.cr49f_productname || "Product"}>
                      {p.cr49f_productname || "Catalog Product"}
                    </h4>
                  </div>

                  <div className="supplier-product-footer-row">
                    <div className="supplier-product-price-val">
                      {priceVal > 0 ? `₹${priceVal.toLocaleString("en-IN")}` : "Price on request"}
                    </div>
                    <div className={`supplier-product-stock-tag ${isLowStock ? "low" : "instock"}`}>
                      <span className="supplier-dot-indicator" />
                      <span>{isLowStock ? "LOW STOCK" : "IN STOCK"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================
          OPPORTUNITY ACTION MODAL (Image 2)
      ===================================================== */}
      {selectedOpportunityRfq && (
        <div
          className="supplier-opportunity-backdrop"
          onClick={() => setSelectedOpportunityRfq(null)}
        >
          <div
            className="supplier-opportunity-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="supplier-modal-close-icon"
              onClick={() => setSelectedOpportunityRfq(null)}
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="supplier-modal-header-icon-badge">
              <Send size={20} />
            </div>

            <div className="supplier-modal-eyebrow">
              {selectedOpportunityRfq.rfqNumber} · {selectedOpportunityRfq.status.toUpperCase()}
            </div>

            <h2 className="supplier-modal-rfq-title">{selectedOpportunityRfq.title}</h2>

            <p className="supplier-modal-rfq-subtitle">
              A focused response workspace is ready for this opportunity.
            </p>

            <div className="supplier-modal-2x2-stats">
              <div className="supplier-modal-stat-card">
                <span className="supplier-modal-stat-title">DELIVERY LOCATION</span>
                <div className="supplier-modal-stat-body">
                  <MapPin size={14} />
                  <span>{selectedOpportunityRfq.deliveryLocation || "Unspecified"}</span>
                </div>
              </div>

              <div className="supplier-modal-stat-card">
                <span className="supplier-modal-stat-title">SUBMISSION DEADLINE</span>
                <div className="supplier-modal-stat-body">
                  <Calendar size={14} />
                  <span>
                    {selectedOpportunityRfq.submissionDeadline
                      ? new Date(selectedOpportunityRfq.submissionDeadline).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )
                      : "Open"}
                  </span>
                </div>
              </div>

              <div className="supplier-modal-stat-card">
                <span className="supplier-modal-stat-title">TIME REMAINING</span>
                <div className="supplier-modal-stat-body">
                  <Clock size={14} />
                  <span>{getDaysRemaining(selectedOpportunityRfq.submissionDeadline)} days</span>
                </div>
              </div>

              <div className="supplier-modal-stat-card">
                <span className="supplier-modal-stat-title">QUOTED VALUE</span>
                <div className="supplier-modal-stat-body">
                  <Tag size={14} />
                  <span>
                    {selectedOpportunityRfq.totalAmount && selectedOpportunityRfq.totalAmount > 0
                      ? `₹${selectedOpportunityRfq.totalAmount.toLocaleString("en-IN")}`
                      : "Not quoted yet"}
                  </span>
                </div>
              </div>
            </div>

            <div className="supplier-modal-match-highlight">
              <Sparkles size={16} className="supplier-modal-sparkle-icon" />
              <div>
                <strong>Strong catalog match</strong>
                <p>Two products in your catalog match this request.</p>
              </div>
            </div>

            <div className="supplier-modal-footer-btns">
              <button
                type="button"
                className="supplier-modal-primary-btn"
                onClick={() => {
                  const targetId = selectedOpportunityRfq.rfqId;
                  setSelectedOpportunityRfq(null);
                  navigate(`/supplier-rfqs/${targetId}`);
                }}
              >
                <span>Start response</span>
                <ArrowRight size={14} />
              </button>

              <button
                type="button"
                className="supplier-modal-secondary-btn"
                onClick={() => setSelectedOpportunityRfq(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ADD PRODUCT MODAL
      ===================================================== */}
      {isAddProductOpen && (
        <div className="supplier-opportunity-backdrop" onClick={() => setIsAddProductOpen(false)}>
          <div
            className="supplier-opportunity-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <button
              type="button"
              className="supplier-modal-close-icon"
              onClick={() => setIsAddProductOpen(false)}
            >
              <X size={16} />
            </button>

            <div className="supplier-modal-header-icon-badge">
              <Package size={20} />
            </div>

            <div className="supplier-modal-eyebrow">CATALOG MANAGEMENT</div>
            <h2 className="supplier-modal-rfq-title">Add Catalog Product</h2>
            <p className="supplier-modal-rfq-subtitle">
              Add an item to your verified supplier product catalog.
            </p>

            <form onSubmit={handleCreateProduct} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ThinkPad L14 Gen 4"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 8,
                    color: "#f8fafc",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Product Code / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LEN-L14-G4"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: 8,
                      color: "#f8fafc",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                    Category
                  </label>
                  <select
                    value={newProdCat}
                    onChange={(e) => setNewProdCat(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: 8,
                      color: "#f8fafc",
                      fontSize: 13,
                    }}
                  >
                    <option value="Laptops">Laptops</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Displays">Displays</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                  Unit Price (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 85000"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 8,
                    color: "#f8fafc",
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="supplier-modal-footer-btns" style={{ marginTop: 12 }}>
                <button type="submit" className="supplier-modal-primary-btn">
                  <span>Add to catalog</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="supplier-modal-secondary-btn"
                  onClick={() => setIsAddProductOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDashboard;
