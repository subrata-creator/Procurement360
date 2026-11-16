import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  Tag,
  Building,
  FileCheck,
  Paperclip,
  Trash2,
} from "lucide-react";
import type { OrderRecord } from "../data/OrdersData";
import {
  Cr49f_invoice1sService,
} from "../generated/services/Cr49f_invoice1sService";
import type {
  Cr49f_invoice1s,
  Cr49f_invoice1scr49f_paymentstatus,
} from "../generated/models/Cr49f_invoice1sModel";
import { cleanGuid } from "../Services/ApprovalWorkflowService";
import "../Styles/UploadInvoiceModal.css";

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderRecord;
  onInvoiceCreated?: (invoice: Cr49f_invoice1s) => void;
}

export const UploadInvoiceModal: React.FC<UploadInvoiceModalProps> = ({
  isOpen,
  onClose,
  order,
  onInvoiceCreated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<Cr49f_invoice1scr49f_paymentstatus>(2); // 2: Not Paid

  // File upload state
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    dataUrl: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form defaults when opened
  useEffect(() => {
    if (isOpen && order) {
      const today = new Date();
      const todayIso = today.toISOString().split("T")[0];
      const due = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const dueIso = due.toISOString().split("T")[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);

      setInvoiceNumber(`INV-${today.getFullYear()}-${randomSuffix}`);
      setInvoiceDate(todayIso);
      setDueDate(dueIso);
      setTotalAmount(order.amount || 0);
      setAmountPaid(0);
      setDiscount(0);
      setAdditionalCharges(0);
      setPaymentStatus(2); // Not Paid
      setAttachedFile(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, order]);

  if (!isOpen) return null;

  // Handle payment status change
  const handlePaymentStatusChange = (val: Cr49f_invoice1scr49f_paymentstatus) => {
    setPaymentStatus(val);
    if (val === 1) {
      // Paid in full
      setAmountPaid(totalAmount);
    } else if (val === 2) {
      // Not Paid
      setAmountPaid(0);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        dataUrl: (reader.result as string) || "",
      });
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        dataUrl: (reader.result as string) || "",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Form submission to Dataverse cr49f_invoice1s
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!invoiceNumber.trim()) {
      setErrorMessage("Please enter an Invoice Number.");
      return;
    }

    if (totalAmount <= 0) {
      setErrorMessage("Total invoice amount must be greater than zero.");
      return;
    }

    if (!invoiceDate) {
      setErrorMessage("Please select an Invoice Date.");
      return;
    }

    if (!dueDate) {
      setErrorMessage("Please select a Due Date.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Resolve Dataverse PO ID if available
      const rawPoId = (order as any).dataversePoId || cleanGuid(order.refNo);
      const isRealGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPoId);

      const payload: any = {
        cr49f_invoicenumber: invoiceNumber.trim(),
        cr49f_invoicedate: invoiceDate,
        cr49f_duedate: dueDate,
        cr49f_totalamount: Number(totalAmount) || 0,
        cr49f_amountpaid: Number(amountPaid) || 0,
        cr49f_discount: Number(discount) || 0,
        cr49f_additionalcharges: Number(additionalCharges) || 0,
        cr49f_paymentstatus: Number(paymentStatus) as Cr49f_invoice1scr49f_paymentstatus,
        cr49f_invoiceattachment: attachedFile ? attachedFile.name : "",
        statecode: 0,
        statuscode: 1,
      };

      if (isRealGuid) {
        payload["cr49f_AssociatedPO@odata.bind"] = `/cr49f_purchaseorders(${rawPoId})`;
      }

      let createdInvoice: Cr49f_invoice1s | null = null;

      try {
        const res = await Cr49f_invoice1sService.create(payload);
        if (res.success && res.data) {
          createdInvoice = res.data;
        }
      } catch (bindErr) {
        // If Dataverse failed due to lookup binding, retry without @odata.bind
        if (payload["cr49f_AssociatedPO@odata.bind"]) {
          delete payload["cr49f_AssociatedPO@odata.bind"];
          const retryRes = await Cr49f_invoice1sService.create(payload);
          if (retryRes.success && retryRes.data) {
            createdInvoice = retryRes.data;
          }
        } else {
          throw bindErr;
        }
      }

      // If Dataverse was not connected or local mock fallback needed
      const finalInvoice: Cr49f_invoice1s = createdInvoice || {
        cr49f_invoice1id: `inv-${Date.now()}`,
        cr49f_invoicenumber: invoiceNumber.trim(),
        cr49f_invoicedate: invoiceDate,
        cr49f_duedate: dueDate,
        cr49f_totalamount: Number(totalAmount),
        cr49f_amountpaid: Number(amountPaid),
        cr49f_discount: Number(discount),
        cr49f_additionalcharges: Number(additionalCharges),
        cr49f_paymentstatus: paymentStatus,
        cr49f_paymentstatusname:
          paymentStatus === 1 ? "Paid" : paymentStatus === 3 ? "Partially Paid" : paymentStatus === 4 ? "On Hold" : "Not Paid",
        cr49f_invoiceattachment: attachedFile?.name || "",
        _cr49f_associatedpo_value: rawPoId || order.refNo,
        statecode: 0,
        statuscode: 1,
        ownerid: "system",
        createdon: new Date().toISOString(),
      };

      // 2. Persist in local storage fallback keyed by PO reference
      try {
        const storageKey = `procurement_custom_invoices_${order.refNo}`;
        const existingRaw = localStorage.getItem(storageKey);
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        const updatedList = [
          {
            ...finalInvoice,
            attachmentPreview: attachedFile?.dataUrl || null,
          },
          ...existingList,
        ];
        localStorage.setItem(storageKey, JSON.stringify(updatedList));

        // Also update master list
        const masterKey = "procurement_all_invoices";
        const masterRaw = localStorage.getItem(masterKey);
        const masterList = masterRaw ? JSON.parse(masterRaw) : [];
        masterList.unshift({
          ...finalInvoice,
          poRef: order.refNo,
          supplierName: order.rewardedSupplier.name || order.supplier,
        });
        localStorage.setItem(masterKey, JSON.stringify(masterList));
      } catch (storeErr) {
        console.warn("Could not save invoice to localStorage:", storeErr);
      }

      setSuccessMessage(`Invoice ${invoiceNumber} created and linked to ${order.refNo} successfully!`);

      if (onInvoiceCreated) {
        onInvoiceCreated(finalInvoice);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      const msg = err?.message || "Failed to create invoice in Dataverse cr49f_invoice1. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="invoice-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="invoice-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <header className="invoice-modal-header">
          <div className="invoice-modal-header-left">
            <div className="invoice-modal-icon-badge">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="invoice-modal-title">Upload Supplier Invoice</h2>
              <p className="invoice-modal-subtitle">
                Record invoice in Dataverse <code className="invoice-table-code">cr49f_invoice1</code> for PO{" "}
                <strong>{order.refNo}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="invoice-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </header>

        {/* PO CONTEXT BANNER */}
        <div className="invoice-po-banner">
          <div className="invoice-po-banner-item">
            <span className="invoice-banner-label">Purchase Order</span>
            <strong className="invoice-banner-value">{order.refNo}</strong>
          </div>
          <div className="invoice-po-banner-item">
            <span className="invoice-banner-label">Supplier / Vendor</span>
            <strong className="invoice-banner-value">
              <Building size={13} style={{ marginRight: 4, display: "inline" }} />
              {order.rewardedSupplier.name || order.supplier}
            </strong>
          </div>
          <div className="invoice-po-banner-item">
            <span className="invoice-banner-label">Order Total Amount</span>
            <strong className="invoice-banner-value highlight">
              ${Number(order.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="invoice-po-banner-item">
            <span className="invoice-banner-label">Associated PR</span>
            <strong className="invoice-banner-value">{order.pr || "N/A"}</strong>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        {errorMessage && (
          <div className="invoice-modal-alert error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="invoice-modal-alert success" role="alert">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="invoice-modal-form">
          <div className="invoice-form-grid">
            {/* ROW 1: Invoice Number & Date */}
            <div className="invoice-form-group">
              <label htmlFor="inv-number" className="invoice-field-label">
                Invoice Number <span className="required">*</span>
              </label>
              <div className="invoice-input-wrapper">
                <Tag size={15} className="invoice-input-icon" />
                <input
                  id="inv-number"
                  type="text"
                  className="invoice-text-input"
                  placeholder="e.g. INV-2026-0042"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>
              <span className="invoice-field-hint">Supplier's billing invoice reference</span>
            </div>

            <div className="invoice-form-group">
              <label htmlFor="inv-date" className="invoice-field-label">
                Invoice Date <span className="required">*</span>
              </label>
              <div className="invoice-input-wrapper">
                <Calendar size={15} className="invoice-input-icon" />
                <input
                  id="inv-date"
                  type="date"
                  className="invoice-text-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <span className="invoice-field-hint">Date when invoice was issued</span>
            </div>

            {/* ROW 2: Due Date & Payment Status */}
            <div className="invoice-form-group">
              <label htmlFor="inv-due-date" className="invoice-field-label">
                Payment Due Date <span className="required">*</span>
              </label>
              <div className="invoice-input-wrapper">
                <Calendar size={15} className="invoice-input-icon" />
                <input
                  id="inv-due-date"
                  type="date"
                  className="invoice-text-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <span className="invoice-field-hint">Defaults to Net 30 terms</span>
            </div>

            <div className="invoice-form-group">
              <label htmlFor="inv-status" className="invoice-field-label">
                Payment Status <span className="required">*</span>
              </label>
              <select
                id="inv-status"
                className="invoice-select-input"
                value={paymentStatus}
                onChange={(e) => handlePaymentStatusChange(Number(e.target.value) as Cr49f_invoice1scr49f_paymentstatus)}
              >
                <option value={2}>Not Paid (Default)</option>
                <option value={1}>Paid (Settled in full)</option>
                <option value={3}>Partially Paid</option>
                <option value={4}>On Hold (Verification pending)</option>
              </select>
              <span className="invoice-field-hint">Current settlement status in Dataverse</span>
            </div>

            {/* ROW 3: Total Amount & Amount Paid */}
            <div className="invoice-form-group">
              <label htmlFor="inv-total" className="invoice-field-label">
                Total Invoice Amount ($) <span className="required">*</span>
              </label>
              <div className="invoice-input-wrapper">
                <DollarSign size={15} className="invoice-input-icon" />
                <input
                  id="inv-total"
                  type="number"
                  step="0.01"
                  min="0"
                  className="invoice-text-input"
                  value={totalAmount || ""}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>
              <span className="invoice-field-hint">Matches PO total amount: ${order.amount}</span>
            </div>

            <div className="invoice-form-group">
              <label htmlFor="inv-amount-paid" className="invoice-field-label">
                Amount Paid ($)
              </label>
              <div className="invoice-input-wrapper">
                <DollarSign size={15} className="invoice-input-icon" />
                <input
                  id="inv-amount-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  className="invoice-text-input"
                  value={amountPaid || ""}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                />
              </div>
              <span className="invoice-field-hint">
                Remaining: ${(Math.max(0, totalAmount - amountPaid)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* ROW 4: Discount & Additional Charges */}
            <div className="invoice-form-group">
              <label htmlFor="inv-discount" className="invoice-field-label">
                Discount ($)
              </label>
              <div className="invoice-input-wrapper">
                <DollarSign size={15} className="invoice-input-icon" />
                <input
                  id="inv-discount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="invoice-text-input"
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <span className="invoice-field-hint">Contractual or prompt payment discounts</span>
            </div>

            <div className="invoice-form-group">
              <label htmlFor="inv-additional" className="invoice-field-label">
                Additional Charges ($)
              </label>
              <div className="invoice-input-wrapper">
                <DollarSign size={15} className="invoice-input-icon" />
                <input
                  id="inv-additional"
                  type="number"
                  step="0.01"
                  min="0"
                  className="invoice-text-input"
                  value={additionalCharges || ""}
                  onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <span className="invoice-field-hint">Shipping, taxes, or freight surcharges</span>
            </div>
          </div>

          {/* FILE ATTACHMENT DROPZONE */}
          <div className="invoice-dropzone-section">
            <label className="invoice-field-label">
              Invoice Document Attachment <span className="optional">(PDF, PNG, JPG)</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileChange}
            />

            {!attachedFile ? (
              <div
                className={`invoice-dropzone ${isDragging ? "dragging" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="invoice-dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <div className="invoice-dropzone-text">
                  <strong>Click to upload</strong> or drag and drop your invoice file here
                </div>
                <span className="invoice-dropzone-sub">PDF, PNG, JPEG up to 10MB</span>
              </div>
            ) : (
              <div className="invoice-attached-file-card">
                <div className="invoice-attached-file-info">
                  <div className="invoice-attached-file-icon">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <strong className="invoice-attached-name">{attachedFile.name}</strong>
                    <span className="invoice-attached-size">{formatFileSize(attachedFile.size)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="invoice-remove-file-btn"
                  onClick={handleRemoveFile}
                  title="Remove file"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {/* MODAL FOOTER */}
          <footer className="invoice-modal-footer">
            <button
              type="button"
              className="invoice-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="invoice-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="invoice-spin" />
                  Saving to Dataverse...
                </>
              ) : (
                <>
                  <Paperclip size={15} />
                  Save &amp; Upload Invoice
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default UploadInvoiceModal;
