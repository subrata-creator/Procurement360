import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  MapPin,
  LoaderCircle,
  Save,
  Users,
  X,
  Info,
} from "lucide-react";

import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_requestforqoutationsBase } from "../generated/models/Cr49f_requestforqoutationsModel";

import "../Styles/CreateRFQModal.css";

export interface CreateRFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export interface RFQFormData {
  rfqTitle: string;
  purchaseRequestId: string;
  description: string;
  deliveryLocation: string;
  submissionDeadline: string;
}

const STORAGE_DRAFT_KEY = "procurement360_rfq_draft";

const initialFormData: RFQFormData = {
  rfqTitle: "",
  purchaseRequestId: "",
  description: "",
  deliveryLocation: "",
  submissionDeadline: "",
};

export const CreateRFQModal: React.FC<CreateRFQModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<RFQFormData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        return { ...initialFormData, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return initialFormData;
  });

  const [purchaseRequests, setPurchaseRequests] = useState<Cr49f_purchaserequests[]>([]);
  const [isLoadingPRs, setIsLoadingPRs] = useState<boolean>(false);
  const [prLoadError, setPrLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [createdRfqInfo, setCreatedRfqInfo] = useState<{
    id?: string;
    rfqNumber?: string;
    title: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof RFQFormData, string>>>({});

  const selectedPR = purchaseRequests.find(
    (pr) => pr.cr49f_purchaserequestid === formData.purchaseRequestId
  );

  // Load purchase requests from Dataverse
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchPRs = async () => {
      setIsLoadingPRs(true);
      setPrLoadError(null);
      try {
        const result = await Cr49f_purchaserequestsService.getAll();
        if (isMounted) {
          if (result.success && result.data) {
            setPurchaseRequests(result.data);
          } else {
            setPurchaseRequests([]);
          }
        }
      } catch (err) {
        console.error("Failed to load purchase requests:", err);
        if (isMounted) {
          setPrLoadError("Unable to load PRs from Dataverse.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPRs(false);
        }
      }
    };

    void fetchPRs();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // When a PR is chosen, if delivery location is empty, prefill it from PR
  const handlePRChange = (prId: string) => {
    const selectedPR = purchaseRequests.find(
      (pr) => pr.cr49f_purchaserequestid === prId
    );

    setFormData((prev) => ({
      ...prev,
      purchaseRequestId: prId,
      deliveryLocation:
        !prev.deliveryLocation.trim() && selectedPR?.cr49f_deliverylocation
          ? selectedPR.cr49f_deliverylocation
          : prev.deliveryLocation,
    }));

    if (errors.purchaseRequestId) {
      setErrors((prev) => ({ ...prev, purchaseRequestId: undefined }));
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(formData));
      showToast("Draft saved successfully!");
    } catch {
      showToast("Could not save draft.");
    }
  };

  const handleDiscard = () => {
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setFormData(initialFormData);
    setErrors({});
    onClose();
  };

  const validateGeneralStep = (): boolean => {
    const newErrors: Partial<Record<keyof RFQFormData, string>> = {};

    if (!formData.rfqTitle.trim()) {
      newErrors.rfqTitle = "RFQ Title is required";
    }

    if (!formData.deliveryLocation.trim()) {
      newErrors.deliveryLocation = "Delivery Location is required";
    }

    if (!formData.submissionDeadline) {
      newErrors.submissionDeadline = "Submission Deadline is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateGeneralStep()) {
      setActiveStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!validateGeneralStep()) {
      setActiveStep(1);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      /*
       * Dataverse entity: cr49f_requestforqoutations
       * Omit auto-managed/system fields like ownerid, cr49f_requestforqoutationid
       */
      const rfqPayload: Record<string, unknown> = {
        cr49f_rfqtitle: formData.rfqTitle.trim(),
        cr49f_description: formData.description.trim(),
        cr49f_deliverylocation: formData.deliveryLocation.trim(),
        cr49f_submissiondeadline: new Date(formData.submissionDeadline).toISOString(),
        cr49f_requestdate: new Date().toISOString(),
        cr49f_status: 0, // 0 = Pending
        statecode: 0, // Active
        statuscode: 1, // Active
      };

      if (formData.purchaseRequestId) {
        rfqPayload["cr49f_PRRFQ@odata.bind"] = `/cr49f_purchaserequests(${formData.purchaseRequestId})`;
      }

      const result = await Cr49f_requestforqoutationsService.create(
        rfqPayload as unknown as Omit<Cr49f_requestforqoutationsBase, "cr49f_requestforqoutationid">
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "Failed to create RFQ in Dataverse");
      }

      const created = result.data;
      setCreatedRfqInfo({
        id: created.cr49f_requestforqoutationid,
        rfqNumber: created.cr49f_rfqnumber || undefined,
        title: formData.rfqTitle,
      });

      // Clear saved draft on success
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      setIsSuccess(true);
      onCreated?.();
    } catch (err) {
      console.error("Error creating RFQ:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving the RFQ to Dataverse."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="rfq-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="rfq-modal-container" role="dialog" aria-modal="true">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="rfq-toast" role="status">
            <Check size={14} />
            <span>{toastMessage}</span>
          </div>
        )}

        {isSuccess ? (
          /* SUCCESS VIEW */
          <div className="rfq-success-container">
            <div className="rfq-success-icon-wrap">
              <CheckCircle2 size={44} className="rfq-success-icon" />
            </div>
            <h2 className="rfq-success-title">RFQ Created Successfully!</h2>
            <p className="rfq-success-desc">
              Your Request for Quotation <strong>{createdRfqInfo?.rfqNumber}</strong> (
              <em>{createdRfqInfo?.title}</em>) has been created in Dataverse with status{" "}
              <span className="rfq-status-badge">Pending</span>.
            </p>

            <div className="rfq-success-details-card">
              <div className="rfq-success-row">
                <span>RFQ Number:</span>
                <strong>{createdRfqInfo?.rfqNumber}</strong>
              </div>
              <div className="rfq-success-row">
                <span>Title:</span>
                <strong>{createdRfqInfo?.title}</strong>
              </div>
              <div className="rfq-success-row">
                <span>Delivery Location:</span>
                <span>{formData.deliveryLocation}</span>
              </div>
              <div className="rfq-success-row">
                <span>Submission Deadline:</span>
                <span>
                  {formData.submissionDeadline
                    ? new Date(formData.submissionDeadline).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>

            <div className="rfq-success-actions">
              <button
                type="button"
                className="rfq-btn rfq-btn-secondary"
                onClick={() => {
                  setFormData(initialFormData);
                  setErrors({});
                  setIsSuccess(false);
                  setActiveStep(1);
                }}
              >
                Create Another RFQ
              </button>
              <button
                type="button"
                className="rfq-btn rfq-btn-primary"
                onClick={onClose}
              >
                View in RFQ List
              </button>
            </div>
          </div>
        ) : (
          /* MULTI-STEP FORM LAYOUT */
          <div className="rfq-modal-body">
            {/* LEFT SIDEBAR */}
            <aside className="rfq-sidebar">
              <div className="rfq-sidebar-top">
                <div className="rfq-sidebar-brand">
                  <div className="rfq-brand-icon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="rfq-brand-title">New RFQ</h3>
                    <span className="rfq-brand-sub">Quotation Wizard</span>
                  </div>
                </div>

                <nav className="rfq-steps-nav" aria-label="RFQ steps">
                  <button
                    type="button"
                    className={`rfq-step-item ${activeStep === 1 ? "active" : "completed"}`}
                    onClick={() => setActiveStep(1)}
                  >
                    <div className="rfq-step-circle">
                      {activeStep > 1 ? <Check size={14} /> : 1}
                    </div>
                    <span className="rfq-step-name">General</span>
                  </button>

                  <div className="rfq-step-divider-line" />

                  <button
                    type="button"
                    className={`rfq-step-item ${activeStep === 2 ? "active" : ""}`}
                    onClick={handleNext}
                  >
                    <div className="rfq-step-circle">2</div>
                    <span className="rfq-step-name">Suppliers</span>
                  </button>
                </nav>
              </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="rfq-content-area">
              {/* Header */}
              <header className="rfq-content-header">
                <div className="rfq-title-badge-wrap">
                  <div className="rfq-title-pill" />
                  <div>
                    <h2 className="rfq-main-title">
                      {activeStep === 1 ? "General" : "Suppliers"}
                    </h2>
                    <p className="rfq-main-subtitle">
                      {activeStep === 1
                        ? "Fill out the form as precisely as possible. Fields marked with a * star are mandatory."
                        : "Manage suppliers and RFQ responses."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="rfq-close-btn"
                  onClick={onClose}
                  aria-label="Close modal"
                  disabled={isSubmitting}
                >
                  <X size={18} />
                </button>
              </header>

              {/* Error Banner */}
              {submitError && (
                <div className="rfq-error-alert" role="alert">
                  <Info size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* STEP 1: GENERAL */}
              {activeStep === 1 && (
                <div className="rfq-form-scrollable">
                  {/* Row 1: RFQ Title & Purchase Request No. */}
                  <div className="rfq-grid-row">
                    {/* RFQ Title (Required) */}
                    <div className="rfq-input-field">
                      <label htmlFor="rfqTitle">
                        RFQ Title <span className="rfq-required-star">*</span>
                      </label>
                      <input
                        id="rfqTitle"
                        type="text"
                        placeholder="e.g. Dell Laptops & Hardware Supply"
                        value={formData.rfqTitle}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, rfqTitle: e.target.value }));
                          if (errors.rfqTitle) {
                            setErrors((prev) => ({ ...prev, rfqTitle: undefined }));
                          }
                        }}
                        className={errors.rfqTitle ? "has-error" : ""}
                      />
                      {errors.rfqTitle && (
                        <span className="rfq-field-error">{errors.rfqTitle}</span>
                      )}
                    </div>

                    {/* Purchase Request Dropdown */}
                    <div className="rfq-input-field">
                      <label htmlFor="purchaseRequestId">Purchase Request No.</label>
                      <div className="rfq-select-wrap">
                        <select
                          id="purchaseRequestId"
                          value={formData.purchaseRequestId}
                          onChange={(e) => handlePRChange(e.target.value)}
                          disabled={isLoadingPRs}
                        >
                          <option value="">
                            {isLoadingPRs
                              ? "Loading PRs from Dataverse..."
                              : "-- Select Purchase Request (Optional) --"}
                          </option>
                          {purchaseRequests.map((pr) => {
                            const prNo = pr.cr49f_prnumber || "PR";
                            const title = pr.cr49f_prtitle || "Untitled";
                            return (
                              <option
                                key={pr.cr49f_purchaserequestid}
                                value={pr.cr49f_purchaserequestid}
                              >
                                {prNo} — {title}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      {prLoadError ? (
                        <span className="rfq-field-error">{prLoadError}</span>
                      ) : (
                        <span className="rfq-field-hint">
                          Links this RFQ to an existing Purchase Request
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Delivery Location & Submission Deadline */}
                  <div className="rfq-grid-row">
                    {/* Delivery Location (Required) */}
                    <div className="rfq-input-field">
                      <label htmlFor="deliveryLocation">
                        Delivery Location <span className="rfq-required-star">*</span>
                      </label>
                      <div className="rfq-icon-input">
                        <MapPin size={15} className="rfq-input-icon" />
                        <input
                          id="deliveryLocation"
                          type="text"
                          placeholder="e.g. Tech Hub, Building C, Floor 4"
                          value={formData.deliveryLocation}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              deliveryLocation: e.target.value,
                            }));
                            if (errors.deliveryLocation) {
                              setErrors((prev) => ({
                                ...prev,
                                deliveryLocation: undefined,
                              }));
                            }
                          }}
                          className={errors.deliveryLocation ? "has-error" : ""}
                        />
                      </div>
                      {errors.deliveryLocation && (
                        <span className="rfq-field-error">{errors.deliveryLocation}</span>
                      )}
                    </div>

                    {/* Submission Deadline (Required) */}
                    <div className="rfq-input-field">
                      <label htmlFor="submissionDeadline">
                        Submission Deadline <span className="rfq-required-star">*</span>
                      </label>
                      <div className="rfq-icon-input">
                        <Calendar size={15} className="rfq-input-icon" />
                        <input
                          id="submissionDeadline"
                          type="datetime-local"
                          value={formData.submissionDeadline}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              submissionDeadline: e.target.value,
                            }));
                            if (errors.submissionDeadline) {
                              setErrors((prev) => ({
                                ...prev,
                                submissionDeadline: undefined,
                              }));
                            }
                          }}
                          className={errors.submissionDeadline ? "has-error" : ""}
                        />
                      </div>
                      {errors.submissionDeadline ? (
                        <span className="rfq-field-error">{errors.submissionDeadline}</span>
                      ) : (
                        <span className="rfq-field-hint">
                          Defines when suppliers can submit their quotations
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Description (Required) */}
                  <div className="rfq-input-field rfq-full-width">
                    <label htmlFor="description">
                      Description <span className="rfq-required-star">*</span>
                    </label>
                    <div className="rfq-textarea-wrapper">
                      <div className="rfq-rich-toolbar" aria-hidden="true">
                        <button type="button" tabIndex={-1} title="Bold">
                          <strong>B</strong>
                        </button>
                        <button type="button" tabIndex={-1} title="Italic">
                          <em>I</em>
                        </button>
                        <button type="button" tabIndex={-1} title="Underline">
                          <u>U</u>
                        </button>
                        <span className="rfq-toolbar-sep" />
                        <span className="rfq-toolbar-info">
                          Specify scope of work, technical requirements, and conditions
                        </span>
                      </div>
                      <textarea
                        id="description"
                        rows={5}
                        placeholder="Add your description here..."
                        value={formData.description}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, description: e.target.value }));
                          if (errors.description) {
                            setErrors((prev) => ({ ...prev, description: undefined }));
                          }
                        }}
                        className={errors.description ? "has-error" : ""}
                      />
                    </div>
                    {errors.description && (
                      <span className="rfq-field-error">{errors.description}</span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: SUPPLIERS */}
              {activeStep === 2 && (
                <div className="rfq-form-scrollable rfq-suppliers-step">
                  <div className="rfq-empty-suppliers-card">
                    <div className="rfq-empty-suppliers-icon">
                      <Users size={36} />
                    </div>
                    <h3 className="rfq-empty-suppliers-title">RFQ not created yet</h3>
                    <p className="rfq-empty-suppliers-desc">
                      RFQ not created yet. Supplier data and invitations will be displayed
                      once the RFQ is submitted. You can review the details below and submit
                      now; supplier integration will be added here soon.
                    </p>

                    {/* Summary overview of General info */}
                    <div className="rfq-summary-pill-box">
                      <div className="rfq-summary-pill">
                        <span className="rfq-summary-label">Title</span>
                        <strong className="rfq-summary-val">{formData.rfqTitle || "—"}</strong>
                      </div>
                      <div className="rfq-summary-pill">
                        <span className="rfq-summary-label">Linked PR</span>
                        <strong className="rfq-summary-val">
                          {selectedPR
                            ? `${selectedPR.cr49f_prnumber || "PR"} — ${selectedPR.cr49f_prtitle || "Untitled"}`
                            : "None"}
                        </strong>
                      </div>
                      <div className="rfq-summary-pill">
                        <span className="rfq-summary-label">Location</span>
                        <strong className="rfq-summary-val">
                          {formData.deliveryLocation || "—"}
                        </strong>
                      </div>
                      <div className="rfq-summary-pill">
                        <span className="rfq-summary-label">Deadline</span>
                        <strong className="rfq-summary-val">
                          {formData.submissionDeadline
                            ? new Date(formData.submissionDeadline).toLocaleDateString()
                            : "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="rfq-suppliers-hint-box">
                      <Info size={16} />
                      <span>
                        Click <strong>Submit RFQ</strong> to save this request in Dataverse
                        and initiate the procurement process.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Navigation Buttons inside content for convenience */}
              <footer className="rfq-content-footer">
                <div className="rfq-footer-left">
                  <button
                    type="button"
                    className="rfq-btn rfq-btn-ghost"
                    onClick={handleDiscard}
                    disabled={isSubmitting}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="rfq-btn rfq-btn-outline"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                  >
                    <Save size={14} />
                    Save Draft
                  </button>
                </div>

                <div className="rfq-footer-right">
                  {activeStep === 2 && (
                    <button
                      type="button"
                      className="rfq-btn rfq-btn-outline"
                      onClick={() => setActiveStep(1)}
                      disabled={isSubmitting}
                    >
                      <ChevronLeft size={14} />
                      Back to General
                    </button>
                  )}

                  {activeStep === 1 ? (
                    <button
                      type="button"
                      className="rfq-btn rfq-btn-primary"
                      onClick={handleNext}
                      disabled={isSubmitting}
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rfq-btn rfq-btn-submit-main"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle size={15} className="rfq-spinner" />
                          Submitting RFQ...
                        </>
                      ) : (
                        <>
                          <Check size={15} />
                          Submit RFQ
                        </>
                      )}
                    </button>
                  )}
                </div>
              </footer>
            </main>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateRFQModal;
