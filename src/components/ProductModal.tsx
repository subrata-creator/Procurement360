import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Layers,
  Loader2,
  Package,
  Plus,
  Ruler,
  Tag,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import type { Cr49f_productses } from "../generated/models/Cr49f_productsesModel";
import {
  Cr49f_productsescr49f_producttype,
} from "../generated/models/Cr49f_productsesModel";
import { Cr49f_productsesService } from "../generated/services/Cr49f_productsesService";
import ModernSelect, { type ModernSelectOption } from "./ModernSelect";

// Product Type options directly from Dataverse picklist
export const PRODUCT_TYPE_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_productsescr49f_producttype
).map(([key, label]) => ({
  value: key,
  label: String(label),
  icon: Number(key) === 2 ? <Briefcase size={13} /> : <Package size={13} />,
}));

export const STATUS_OPTIONS: ModernSelectOption[] = [
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

interface ProductModalProps {
  isOpen: boolean;
  product: Cr49f_productses | null; // null for Create, record for Edit
  onClose: () => void;
  onSaved: (savedProduct: Cr49f_productses) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSaved,
}) => {
  const isEditMode = !!product;

  // Form State
  const [productName, setProductName] = useState("");
  const [productNumber, setProductNumber] = useState("");
  const [productType, setProductType] = useState<string>("1"); // 1: Goods, 2: Services
  const [category, setCategory] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [status, setStatus] = useState<string>("0"); // 0: Active, 1: Inactive

  // Validation & Submitting
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setServerError(null);

    if (product) {
      setProductName(product.cr49f_productname || "");
      setProductNumber(product.cr49f_productnumber || "");
      setProductType(String(product.cr49f_producttype ?? "1"));
      setCategory(product.cr49f_category || "");
      setUnitOfMeasure(product.cr49f_unitofmeasure || "");
      setProductDescription(product.cr49f_productdescription || "");
      setStatus(product.statecode === 1 ? "1" : "0");
    } else {
      setProductName("");
      setProductNumber(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
      setProductType("1");
      setCategory("");
      setUnitOfMeasure("Each");
      setProductDescription("");
      setStatus("0"); // Default Active
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!productName.trim()) {
      newErrors.productName = "Product name is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const typeNum = Number(productType) as keyof typeof Cr49f_productsescr49f_producttype;

      if (isEditMode && product) {
        const statecodeVal = Number(status) === 1 ? 1 : 0;
        const statuscodeVal = statecodeVal === 0 ? 1 : 2;
        const statusVal = statecodeVal === 1 ? 1 : 0;

        const updatePayload = {
          cr49f_productname: productName.trim(),
          cr49f_productnumber: productNumber.trim() || undefined,
          cr49f_producttype: typeNum,
          cr49f_category: category.trim() || undefined,
          cr49f_unitofmeasure: unitOfMeasure.trim() || undefined,
          cr49f_productdescription: productDescription.trim() || undefined,
          cr49f_status: statusVal as 0 | 1,
          statecode: statecodeVal as 0 | 1,
          statuscode: statuscodeVal as 1 | 2,
        };

        const res = await Cr49f_productsesService.update(
          product.cr49f_productsid,
          updatePayload
        );

        if (res.error || !res.data) {
          throw new Error(res.error?.message || "Failed to update product in Dataverse.");
        }
        onSaved(res.data);
      } else {
        const createPayload = {
          cr49f_productname: productName.trim(),
          cr49f_productnumber: productNumber.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
          cr49f_producttype: typeNum,
          cr49f_category: category.trim() || undefined,
          cr49f_unitofmeasure: unitOfMeasure.trim() || undefined,
          cr49f_productdescription: productDescription.trim() || undefined,
          cr49f_status: 0 as const,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        const res = await Cr49f_productsesService.create(createPayload);

        if (res.error || !res.data) {
          throw new Error(res.error?.message || "Failed to create product in Dataverse.");
        }
        onSaved(res.data);
      }

      onClose();
    } catch (err: unknown) {
      console.error("Error saving product to Dataverse:", err);
      const msg = err instanceof Error ? err.message : "Failed to save product in Dataverse.";
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
          width: "min(600px, 100%)",
          maxHeight: "min(720px, calc(100dvh - 32px))",
        }}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-heading">
            <div className="admin-modal-icon">
              {Number(productType) === 2 ? <Briefcase size={18} /> : <Package size={18} />}
            </div>
            <div>
              <h2>{isEditMode ? "Edit Product / Service" : "New Product / Service"}</h2>
              <p>Add or update catalog items for procurement requests and orders.</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="admin-modal-form">
          <div className="admin-modal-body">
            {serverError && (
              <div className="admin-banner-error">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Product Name & SKU */}
            <div className="admin-product-grid-2">
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <Package size={13} />
                  <span>Item Name</span>
                  <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`admin-form-input ${errors.productName ? "error" : ""}`}
                  placeholder="e.g. Dell UltraSharp 27-inch Monitor"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    if (errors.productName) setErrors((prev) => ({ ...prev, productName: "" }));
                  }}
                  disabled={isSubmitting}
                />
                {errors.productName && (
                  <span className="admin-form-error-text">{errors.productName}</span>
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
                  value={productNumber}
                  onChange={(e) => setProductNumber(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Product Type & Category */}
            <div className="admin-product-grid-2">
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <Layers size={13} />
                  <span>Item Type</span>
                </label>
                <ModernSelect
                  value={productType}
                  options={PRODUCT_TYPE_OPTIONS}
                  onChange={(val) => setProductType(val)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  <Tag size={13} />
                  <span>Category</span>
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. Hardware, Software, Consulting"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Unit of Measure */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Ruler size={13} />
                <span>Unit of Measure</span>
              </label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="e.g. Each, Unit, Box, Hours, License"
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Description */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <span>Description / Scope</span>
              </label>
              <textarea
                className="admin-form-input"
                rows={3}
                style={{ resize: "vertical", height: "auto", minHeight: 70 }}
                placeholder="Product specifications, standard scope of work, warranty info, etc."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Status: Only shown on Edit Form */}
            {isEditMode && (
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <UserCheck size={13} />
                  <span>Status</span>
                </label>
                <ModernSelect
                  value={status}
                  options={STATUS_OPTIONS}
                  onChange={(val) => setStatus(val)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Footer */}
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
                  <span>Update Item</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add Product</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;

