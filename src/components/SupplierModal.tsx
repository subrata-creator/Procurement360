import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Receipt,
  Trash2,
  Truck,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import type {
  Cr49f_suppliers,
} from "../generated/models/Cr49f_suppliersModel";
import {
  Cr49f_supplierscr49f_paymentterms,
  Cr49f_supplierscr49f_suppliertype,
} from "../generated/models/Cr49f_suppliersModel";
import type {
  Cr49f_supplierproducts,
} from "../generated/models/Cr49f_supplierproductsModel";
import {
  Cr49f_supplierproductscr49f_availability,
  Cr49f_supplierproductscr49f_producttype,
} from "../generated/models/Cr49f_supplierproductsModel";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_supplierproductsService } from "../generated/services/Cr49f_supplierproductsService";
import ModernSelect, { type ModernSelectOption } from "./ModernSelect";

// Supplier Type options from Dataverse picklist
export const SUPPLIER_TYPE_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_supplierscr49f_suppliertype
).map(([key, label]) => ({
  value: key,
  label: String(label),
}));

// Payment Terms options from Dataverse picklist
export const PAYMENT_TERMS_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_supplierscr49f_paymentterms
).map(([key, label]) => ({
  value: key,
  label: String(label),
}));

// Product Type options from Dataverse picklist
export const PRODUCT_TYPE_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_supplierproductscr49f_producttype
).map(([key, label]) => ({
  value: key,
  label: String(label),
}));

// Product Availability options from Dataverse picklist
export const AVAILABILITY_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_supplierproductscr49f_availability
).map(([key, label]) => ({
  value: key,
  label: String(label),
}));

export const SUPPLIER_STATUS_OPTIONS: ModernSelectOption[] = [
  {
    value: "0",
    label: "Active",
    icon: <CheckCircle2 size={13} style={{ color: "#16a34a" }} />,
  },
  {
    value: "1",
    label: "Inactive",
    icon: <XCircle size={13} style={{ color: "#ef4444" }} />,
  },
];

export interface SupplierProductFormItem {
  cr49f_supplierproductid?: string;
  cr49f_productname: string;
  cr49f_supplierproductnumber: string;
  cr49f_producttype: number | string;
  cr49f_category: string;
  cr49f_unitprice: string;
  cr49f_warranty: string;
  cr49f_availability: number | string;
  cr49f_productdescription: string;
}

interface SupplierModalProps {
  isOpen: boolean;
  supplier: Cr49f_suppliers | null; // null for Create, record for Edit
  onClose: () => void;
  onSaved: (
    savedSupplier: Cr49f_suppliers,
    savedProducts: Cr49f_supplierproducts[]
  ) => void;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  supplier,
  onClose,
  onSaved,
}) => {
  const isEditMode = !!supplier;

  // Active Tab
  const [activeTab, setActiveTab] = useState<"details" | "products">("details");

  // Supplier Form State
  const [companyName, setCompanyName] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierType, setSupplierType] = useState<string>("1"); // 1: Manufacturer
  const [category, setCategory] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [pan, setPan] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<string>("3"); // 3: Net 30
  const [status, setStatus] = useState<string>("0"); // 0: Active, 1: Inactive

  // Products State
  const [products, setProducts] = useState<SupplierProductFormItem[]>([]);
  const [deletedProductIds, setDeletedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Status & Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize modal state
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setServerError(null);
    setDeletedProductIds([]);
    setActiveTab("details");

    if (supplier) {
      setCompanyName(supplier.cr49f_name || "");
      setSupplierCode(supplier.cr49f_supplierid1 || "");
      setSupplierType(String(supplier.cr49f_suppliertype ?? "1"));
      setCategory(supplier.cr49f_suppliercategory || "");
      setContactPerson(supplier.cr49f_contactperson || "");
      setEmail(supplier.cr49f_email || "");
      setPhoneNumber(supplier.cr49f_phonenumber || "");
      setWebsite(supplier.cr49f_website || "");
      setAddress(supplier.cr49f_address || "");
      setCity(supplier.cr49f_city || "");
      setState(supplier.cr49f_state || "");
      setPostalCode(supplier.cr49f_postalcode || "");
      setCountry(supplier.cr49f_country || "");
      setPan(supplier.cr49f_pan || "");
      setRegistrationNumber(supplier.cr49f_registrationnumber || "");
      setPaymentTerms(String(supplier.cr49f_paymentterms ?? "3"));
      setStatus(supplier.statecode === 1 ? "1" : "0");

      // Fetch products for this supplier
      setLoadingProducts(true);
      const supplierId = supplier.cr49f_supplierid;

      const fetchSupplierProducts = async () => {
        try {
          let list: Cr49f_supplierproducts[] = [];
          try {
            const res = await Cr49f_supplierproductsService.getAll({
              filter: `_cr49f_supplier_value eq '${supplierId}'`,
            });
            if (res.data && res.data.length > 0) {
              list = res.data;
            }
          } catch {
            // fallback
          }

          if (list.length === 0) {
            const allRes = await Cr49f_supplierproductsService.getAll();
            if (allRes.data) {
              list = allRes.data.filter(
                (p) => p._cr49f_supplier_value === supplierId
              );
            }
          }

          if (list.length > 0) {
            setProducts(
              list.map((p) => ({
                cr49f_supplierproductid: p.cr49f_supplierproductid,
                cr49f_productname: p.cr49f_productname || "",
                cr49f_supplierproductnumber: p.cr49f_supplierproductnumber || "",
                cr49f_producttype: p.cr49f_producttype ?? 1,
                cr49f_category: p.cr49f_category || "",
                cr49f_unitprice: p.cr49f_unitprice || "",
                cr49f_warranty: p.cr49f_warranty || "",
                cr49f_availability: p.cr49f_availability ?? 1,
                cr49f_productdescription: p.cr49f_productdescription || "",
              }))
            );
          } else {
            setProducts([]);
          }
        } catch (err) {
          console.error("Failed to fetch supplier products:", err);
          setProducts([]);
        } finally {
          setLoadingProducts(false);
        }
      };

      void fetchSupplierProducts();
    } else {
      // Create mode
      setCompanyName("");
      setSupplierCode(`SUP-${Math.floor(1000 + Math.random() * 9000)}`);
      setSupplierType("1");
      setCategory("");
      setContactPerson("");
      setEmail("");
      setPhoneNumber("");
      setWebsite("");
      setAddress("");
      setCity("");
      setState("");
      setPostalCode("");
      setCountry("");
      setPan("");
      setRegistrationNumber("");
      setPaymentTerms("3");
      setStatus("0"); // Default Active
      setProducts([]);
    }
  }, [isOpen, supplier]);

  if (!isOpen) return null;

  // Add a product item
  const handleAddProduct = () => {
    const nextNum = products.length + 1;
    setProducts((prev) => [
      ...prev,
      {
        cr49f_productname: "",
        cr49f_supplierproductnumber: `PRD-${Date.now().toString().slice(-4)}-${nextNum}`,
        cr49f_producttype: 1, // Goods
        cr49f_category: category || "",
        cr49f_unitprice: "",
        cr49f_warranty: "1 Year",
        cr49f_availability: 1, // Available
        cr49f_productdescription: "",
      },
    ]);
    setActiveTab("products");
  };

  // Remove a product item
  const handleRemoveProduct = (index: number) => {
    const prodToRemove = products[index];
    if (prodToRemove?.cr49f_supplierproductid) {
      setDeletedProductIds((prev) => [...prev, prodToRemove.cr49f_supplierproductid!]);
    }
    setProducts((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Change product field
  const handleProductChange = (
    index: number,
    field: keyof SupplierProductFormItem,
    val: string | number
  ) => {
    setProducts((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, [field]: val } : p))
    );
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName = "Supplier name is required.";
      setActiveTab("details");
    }

    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
      setActiveTab("details");
    }

    // Check products
    for (let i = 0; i < products.length; i++) {
      if (!products[i].cr49f_productname.trim()) {
        newErrors[`product_${i}_name`] = "Product name is required.";
        setActiveTab("products");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const suppTypeNum = Number(supplierType) as keyof typeof Cr49f_supplierscr49f_suppliertype;
      const payTermsNum = Number(paymentTerms) as keyof typeof Cr49f_supplierscr49f_paymentterms;

      // Status: default Active on create (0), editable on edit
      const statecodeVal = isEditMode ? (Number(status) === 1 ? 1 : 0) : 0;
      const statuscodeVal = statecodeVal === 0 ? 1 : 2;
      const supplierstatusVal = statecodeVal === 1 ? 1 : 0;

      let savedSupplierRecord: Cr49f_suppliers;

      // STEP 1: Create or update Supplier in Dataverse (cr49f_suppliers)
      if (isEditMode && supplier) {
        const updatePayload = {
          cr49f_name: companyName.trim(),
          cr49f_supplierid1: supplierCode.trim() || undefined,
          cr49f_suppliertype: suppTypeNum,
          cr49f_suppliercategory: category.trim() || undefined,
          cr49f_contactperson: contactPerson.trim() || undefined,
          cr49f_email: email.trim() || undefined,
          cr49f_phonenumber: phoneNumber.trim() || undefined,
          cr49f_website: website.trim() || undefined,
          cr49f_address: address.trim() || undefined,
          cr49f_city: city.trim() || undefined,
          cr49f_state: state.trim() || undefined,
          cr49f_postalcode: postalCode.trim() || undefined,
          cr49f_country: country.trim() || undefined,
          cr49f_pan: pan.trim() || undefined,
          cr49f_registrationnumber: registrationNumber.trim() || undefined,
          cr49f_paymentterms: payTermsNum,
          cr49f_supplierstatus: supplierstatusVal as 0 | 1,
          statecode: statecodeVal as 0 | 1,
          statuscode: statuscodeVal as 1 | 2,
        };

        const updateRes = await Cr49f_suppliersService.update(
          supplier.cr49f_supplierid,
          updatePayload
        );

        if (updateRes.error || !updateRes.data) {
          throw new Error(updateRes.error?.message || "Failed to update supplier record in Dataverse.");
        }
        savedSupplierRecord = updateRes.data;
      } else {
        const createPayload = {
          cr49f_name: companyName.trim(),
          cr49f_supplierid1: supplierCode.trim() || `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
          cr49f_suppliertype: suppTypeNum,
          cr49f_suppliercategory: category.trim() || undefined,
          cr49f_contactperson: contactPerson.trim() || undefined,
          cr49f_email: email.trim() || undefined,
          cr49f_phonenumber: phoneNumber.trim() || undefined,
          cr49f_website: website.trim() || undefined,
          cr49f_address: address.trim() || undefined,
          cr49f_city: city.trim() || undefined,
          cr49f_state: state.trim() || undefined,
          cr49f_postalcode: postalCode.trim() || undefined,
          cr49f_country: country.trim() || undefined,
          cr49f_pan: pan.trim() || undefined,
          cr49f_registrationnumber: registrationNumber.trim() || undefined,
          cr49f_paymentterms: payTermsNum,
          cr49f_supplierstatus: 0 as const,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        const createRes = await Cr49f_suppliersService.create(createPayload);

        if (createRes.error || !createRes.data) {
          throw new Error(createRes.error?.message || "Failed to create supplier in Dataverse.");
        }
        savedSupplierRecord = createRes.data;
      }

      const targetSupplierId = savedSupplierRecord.cr49f_supplierid;

      // STEP 2: Delete removed products
      for (const removedId of deletedProductIds) {
        try {
          await Cr49f_supplierproductsService.delete(removedId);
        } catch (delErr) {
          console.warn("Failed to delete removed supplier product:", delErr);
        }
      }

      // STEP 3: Create or update products with lookup reference to the supplier
      const savedProductsList: Cr49f_supplierproducts[] = [];
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const prodPayload = {
          "cr49f_Supplier@odata.bind": `/cr49f_suppliers(${targetSupplierId})`,
          cr49f_productname: p.cr49f_productname.trim(),
          cr49f_supplierproductnumber:
            p.cr49f_supplierproductnumber.trim() ||
            `PRD-${Date.now().toString().slice(-4)}-${i + 1}`,
          cr49f_producttype: Number(p.cr49f_producttype) as keyof typeof Cr49f_supplierproductscr49f_producttype,
          cr49f_category: p.cr49f_category.trim() || undefined,
          cr49f_unitprice: p.cr49f_unitprice.trim() || undefined,
          cr49f_warranty: p.cr49f_warranty.trim() || undefined,
          cr49f_availability: Number(p.cr49f_availability) as keyof typeof Cr49f_supplierproductscr49f_availability,
          cr49f_productdescription: p.cr49f_productdescription.trim() || undefined,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        if (p.cr49f_supplierproductid) {
          const updatedProd = await Cr49f_supplierproductsService.update(
            p.cr49f_supplierproductid,
            prodPayload
          );
          if (updatedProd.data) savedProductsList.push(updatedProd.data);
        } else {
          const createdProd = await Cr49f_supplierproductsService.create(prodPayload);
          if (createdProd.data) savedProductsList.push(createdProd.data);
        }
      }

      onSaved(savedSupplierRecord, savedProductsList);
      onClose();
    } catch (err: unknown) {
      console.error("Error saving supplier to Dataverse:", err);
      const msg = err instanceof Error ? err.message : "Failed to save supplier record in Dataverse.";
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="admin-modal"
        style={{
          width: "min(780px, 100%)",
          maxHeight: "min(840px, calc(100dvh - 32px))",
        }}
      >
        {/* Modal Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-heading">
            <div className="admin-modal-icon">
              <Truck size={18} />
            </div>
            <div>
              <h2>{isEditMode ? "Edit Supplier" : "New Supplier"}</h2>
              <p>Register vendor details and assign catalog products/services.</p>
            </div>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="admin-tabs-bar">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "details" ? "active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            <Building2 size={14} />
            <span>Supplier Details</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === "products" ? "active" : ""}`}
            onClick={() => setActiveTab("products")}
          >
            <Package size={14} />
            <span>Products & Services</span>
            <span className="admin-tab-count">{products.length}</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="admin-modal-form">
          <div className="admin-modal-body">
            {serverError && (
              <div className="admin-banner-error">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* TAB 1: SUPPLIER DETAILS */}
            {activeTab === "details" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Company Name & Supplier Code */}
                <div className="admin-product-grid-2">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <Building2 size={13} />
                      <span>Company Name</span>
                      <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`admin-form-input ${errors.companyName ? "error" : ""}`}
                      placeholder="e.g. Acme Tech Solutions"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: "" }));
                      }}
                      disabled={isSubmitting}
                    />
                    {errors.companyName && (
                      <span className="admin-form-error-text">{errors.companyName}</span>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>Supplier Code / ID</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. SUP-1001"
                      value={supplierCode}
                      onChange={(e) => setSupplierCode(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Supplier Type & Category */}
                <div className="admin-product-grid-2">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <Truck size={13} />
                      <span>Supplier Type</span>
                    </label>
                    <ModernSelect
                      value={supplierType}
                      options={SUPPLIER_TYPE_OPTIONS}
                      onChange={(val) => setSupplierType(val)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>Category</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. Hardware, Consulting, Logistics"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Contact Person, Email, Phone */}
                <div className="admin-product-grid-3">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <User size={13} />
                      <span>Contact Person</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. John Doe"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <Mail size={13} />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      className={`admin-form-input ${errors.email ? "error" : ""}`}
                      placeholder="supplier@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      disabled={isSubmitting}
                    />
                    {errors.email && (
                      <span className="admin-form-error-text">{errors.email}</span>
                    )}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <Phone size={13} />
                      <span>Phone Number</span>
                    </label>
                    <input
                      type="tel"
                      className="admin-form-input"
                      placeholder="+1 (555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <Globe size={13} />
                    <span>Website</span>
                  </label>
                  <input
                    type="url"
                    className="admin-form-input"
                    placeholder="https://company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Street Address */}
                <div className="admin-form-group">
                  <label className="admin-form-label">
                    <MapPin size={13} />
                    <span>Street Address</span>
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="123 Corporate Blvd, Suite 400"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* City, State, Postal Code, Country */}
                <div className="admin-product-grid-2">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>City</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. New York"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>State / Province</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. NY"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="admin-product-grid-2">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>Postal / ZIP Code</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. 10001"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>Country</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. United States"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Registration & PAN & Payment Terms */}
                <div className="admin-product-grid-3">
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>Registration / Tax No.</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. REG-987654"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <span>PAN</span>
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. ABCDE1234F"
                      value={pan}
                      onChange={(e) => setPan(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <Receipt size={13} />
                      <span>Payment Terms</span>
                    </label>
                    <ModernSelect
                      value={paymentTerms}
                      options={PAYMENT_TERMS_OPTIONS}
                      onChange={(val) => setPaymentTerms(val)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Status: Only shown on Edit */}
                {isEditMode && (
                  <div className="admin-form-group">
                    <label className="admin-form-label">
                      <UserCheck size={13} />
                      <span>Status</span>
                    </label>
                    <ModernSelect
                      value={status}
                      options={SUPPLIER_STATUS_OPTIONS}
                      onChange={(val) => setStatus(val)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRODUCTS & SERVICES */}
            {activeTab === "products" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--foreground-hex)",
                      }}
                    >
                      <Package size={15} style={{ color: "var(--primary-hex)" }} />
                      <span>Supplier Products & Services</span>
                      <span className="admin-tab-count">{products.length}</span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-foreground-hex)" }}>
                      Configure catalog items provided by this supplier.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    style={{ height: 30, padding: "0 10px", fontSize: 11 }}
                    onClick={handleAddProduct}
                    disabled={isSubmitting}
                  >
                    <Plus size={13} />
                    <span>Add Product</span>
                  </button>
                </div>

                {loadingProducts ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: "var(--muted-foreground-hex)",
                      fontSize: 12,
                    }}
                  >
                    <Loader2
                      size={16}
                      className="animate-spin"
                      style={{ margin: "0 auto 6px", display: "block" }}
                    />
                    Loading supplier products...
                  </div>
                ) : products.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      border: "1px dashed var(--border-hex)",
                      borderRadius: 10,
                      background: "color-mix(in srgb, var(--card-hex) 60%, transparent)",
                    }}
                  >
                    <Package
                      size={24}
                      style={{
                        margin: "0 auto 8px",
                        display: "block",
                        color: "var(--muted-foreground-hex)",
                      }}
                    />
                    <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                      No Products Added Yet
                    </strong>
                    <p style={{ fontSize: 11.5, color: "var(--muted-foreground-hex)", margin: "0 0 12px" }}>
                      Add goods or services supplied by this vendor.
                    </p>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      style={{ margin: "0 auto", height: 30, fontSize: 11.5 }}
                      onClick={handleAddProduct}
                      disabled={isSubmitting}
                    >
                      <Plus size={13} />
                      <span>Add First Product</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {products.map((item, index) => {
                      const nameError = errors[`product_${index}_name`];
                      return (
                        <div key={item.cr49f_supplierproductid || index} className="admin-product-item-card">
                          <div className="admin-product-item-header">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  background: "color-mix(in srgb, var(--primary-hex) 15%, transparent)",
                                  color: "var(--primary-hex)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {index + 1}
                              </span>
                              <strong style={{ fontSize: 12.5 }}>
                                {item.cr49f_productname || `New Product #${index + 1}`}
                              </strong>
                            </div>

                            <button
                              type="button"
                              className="admin-icon-btn danger"
                              style={{ height: 26, width: 26 }}
                              onClick={() => handleRemoveProduct(index)}
                              disabled={isSubmitting}
                              title="Remove product"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Product Name & SKU */}
                          <div className="admin-product-grid-2">
                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Product / Service Name</span>
                                <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                className={`admin-form-input ${nameError ? "error" : ""}`}
                                placeholder="e.g. ThinkPad T14 Gen 4"
                                value={item.cr49f_productname}
                                onChange={(e) => {
                                  handleProductChange(index, "cr49f_productname", e.target.value);
                                  if (nameError) {
                                    setErrors((prev) => {
                                      const next = { ...prev };
                                      delete next[`product_${index}_name`];
                                      return next;
                                    });
                                  }
                                }}
                                disabled={isSubmitting}
                              />
                              {nameError && (
                                <span className="admin-form-error-text">{nameError}</span>
                              )}
                            </div>

                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Product SKU / Number</span>
                              </label>
                              <input
                                type="text"
                                className="admin-form-input"
                                placeholder="e.g. PRD-1001"
                                value={item.cr49f_supplierproductnumber}
                                onChange={(e) =>
                                  handleProductChange(index, "cr49f_supplierproductnumber", e.target.value)
                                }
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>

                          {/* Type, Category, Price, Warranty */}
                          <div className="admin-product-grid-2">
                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Product Type</span>
                              </label>
                              <ModernSelect
                                size="sm"
                                value={String(item.cr49f_producttype)}
                                options={PRODUCT_TYPE_OPTIONS}
                                onChange={(val) =>
                                  handleProductChange(index, "cr49f_producttype", Number(val))
                                }
                                disabled={isSubmitting}
                              />
                            </div>

                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Category</span>
                              </label>
                              <input
                                type="text"
                                className="admin-form-input"
                                placeholder="e.g. Laptops, Cloud, Peripherals"
                                value={item.cr49f_category}
                                onChange={(e) =>
                                  handleProductChange(index, "cr49f_category", e.target.value)
                                }
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>

                          <div className="admin-product-grid-3">
                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Unit Price</span>
                              </label>
                              <input
                                type="text"
                                className="admin-form-input"
                                placeholder="e.g. 1200.00"
                                value={item.cr49f_unitprice}
                                onChange={(e) =>
                                  handleProductChange(index, "cr49f_unitprice", e.target.value)
                                }
                                disabled={isSubmitting}
                              />
                            </div>

                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Warranty</span>
                              </label>
                              <input
                                type="text"
                                className="admin-form-input"
                                placeholder="e.g. 1 Year, 3 Years"
                                value={item.cr49f_warranty}
                                onChange={(e) =>
                                  handleProductChange(index, "cr49f_warranty", e.target.value)
                                }
                                disabled={isSubmitting}
                              />
                            </div>

                            <div className="admin-form-group">
                              <label className="admin-form-label">
                                <span>Availability</span>
                              </label>
                              <ModernSelect
                                size="sm"
                                value={String(item.cr49f_availability)}
                                options={AVAILABILITY_OPTIONS}
                                onChange={(val) =>
                                  handleProductChange(index, "cr49f_availability", Number(val))
                                }
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>

                          {/* Description */}
                          <div className="admin-form-group">
                            <label className="admin-form-label">
                              <span>Description</span>
                            </label>
                            <input
                              type="text"
                              className="admin-form-input"
                              placeholder="Key specifications, service level details, etc."
                              value={item.cr49f_productdescription}
                              onChange={(e) =>
                                handleProductChange(index, "cr49f_productdescription", e.target.value)
                              }
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isEditMode ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Update Supplier</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Create Supplier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierModal;

