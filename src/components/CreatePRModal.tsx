import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Package,
  Search,
  X,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";

import { Cr49f_productsesService } from "../generated/services/Cr49f_productsesService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";

import type { Cr49f_productses } from "../generated/models/Cr49f_productsesModel";

import "../Styles/CreatePRModal.css";

interface CreatePRModalProps {
  onClose: () => void;
  onCreated?: () => void;
  onViewPurchaseRequest?: (id?: string) => void;
}

interface RequestForm {
  title: string;
  justification: string;
  deliveryLocation: string;
  requiredDeliveryDate: string;
}

interface SelectedProduct {
  product: Cr49f_productses;
  quantity: number;
}
const initialForm: RequestForm = {
  title: "",
  justification: "",
  deliveryLocation: "",
  requiredDeliveryDate: "",
};

const getToday = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
};

export default function CreatePRModal({
  onClose,
  onCreated,
  onViewPurchaseRequest,
}: CreatePRModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdPRRecordId, setCreatedPRRecordId] = useState<string | null>(null);
  const [createdPRTitle, setCreatedPRTitle] = useState("");
  const [createdItemCount, setCreatedItemCount] = useState(0);

  const [form, setForm] = useState<RequestForm>(initialForm);

  const [products, setProducts] = useState<Cr49f_productses[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, SelectedProduct>
  >({});

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<
    Partial<Record<keyof RequestForm, string>>
  >({});

  const [submitError, setSubmitError] = useState("");

  // Load the catalog when the modal opens.
  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setSubmitError("");

      try {
        const result = await Cr49f_productsesService.getAll();

        if (!result.data) {
          throw new Error("The product catalog could not be loaded.");
        }

        if (cancelled) return;

        // Only display active products.
        const activeProducts = result.data.filter((product) => {
          const isActive =
            product.statecode === 0 &&
            (product.cr49f_status === undefined ||
              product.cr49f_status === 0);

          return isActive && Boolean(product.cr49f_productname);
        });

        setProducts(activeProducts);
      } catch (error: unknown) {
        if (!cancelled) {
          setSubmitError(
            `Unable to load products. ${getErrorMessage(error)}`
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Build category filters from the real Dataverse values.
  const categories = useMemo(() => {
    const values = products
      .map((product) => product.cr49f_category?.trim())
      .filter((category): category is string => Boolean(category));

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [products]);

  // Search and category filtering.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const category = product.cr49f_category?.trim() || "";

      const matchesCategory =
        selectedCategory === "All" ||
        category === selectedCategory;

      const matchesSearch =
        !normalizedSearch ||
        [
          product.cr49f_productname,
          product.cr49f_productdescription,
          product.cr49f_productnumber,
          category,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch)
          );

      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  const selectedItems = useMemo(
    () => Object.values(selectedProducts),
    [selectedProducts]
  );

  const selectedCount = selectedItems.length;

  const updateField = (
    field: keyof RequestForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setSubmitError("");
  };

  const validateRequestDetails = (): boolean => {
    const nextErrors: Partial<Record<keyof RequestForm, string>> = {};

    if (!form.title.trim()) {
      nextErrors.title = "PR Title is required.";
    }

    if (!form.justification.trim()) {
      nextErrors.justification = "Business Justification is required.";
    }

    if (!form.deliveryLocation.trim()) {
      nextErrors.deliveryLocation = "Delivery Location is required.";
    }

    if (!form.requiredDeliveryDate) {
      nextErrors.requiredDeliveryDate =
        "Required Delivery Date is required.";
    } else if (form.requiredDeliveryDate < getToday()) {
      nextErrors.requiredDeliveryDate =
        "Delivery Date cannot be in the past.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  // Step 1 -> Step 2. IMPORTANT: No Dataverse creation here.
  const handleNext = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateRequestDetails()) return;

    setSubmitError("");
    setStep(2);
  };

  const toggleProduct = (product: Cr49f_productses) => {
    const id = product.cr49f_productsid;

    setSelectedProducts((previous) => {
      const next = { ...previous };

      if (next[id]) {
        delete next[id];
      } else {
        next[id] = {
          product,
          quantity: 1,
        };
      }

      return next;
    });

    setSubmitError("");
  };

  const updateQuantity = (id: string, change: number) => {
    setSelectedProducts((previous) => {
      const existing = previous[id];

      if (!existing) return previous;

      const nextQuantity = existing.quantity + change;

      if (nextQuantity < 1) return previous;

      return {
        ...previous,
        [id]: {
          ...existing,
          quantity: nextQuantity,
        },
      };
    });

    setSubmitError("");
  };

  const handleBack = () => {
    if (isSubmitting) return;

    setSubmitError("");
    setStep(1);
  };

  const handleDiscard = () => {
    if (isSubmitting) return;

    setForm(initialForm);
    setSelectedProducts({});
    setErrors({});
    setSubmitError("");

    onClose();
  };

  // Step 2 Submit: create the PR, then create its line items.
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!validateRequestDetails()) {
      setStep(1);
      return;
    }

    if (selectedCount === 0) {
      setSubmitError("Please select at least one product.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    let createdPRId: string | undefined;

    try {
      /*
       * Generated models mark owner fields as required, but Dataverse
       * manages ownership on creation. Do not send ownerid or owneridtype.
       *
       * Cast to the generated service's accepted shape because its
       * autogenerated interface marks these system-managed fields required.
       */
      const prPayload = {
        cr49f_prtitle: form.title.trim(),
        cr49f_businessjustification: form.justification.trim(),
        cr49f_deliverylocation: form.deliveryLocation.trim(),
        cr49f_requireddeliverydate: form.requiredDeliveryDate,
        cr49f_status: 0,
        cr49f_priority: 1,
        cr49f_totalamount: 0,
        statecode: 0,
        statuscode: 1,
      };

      const prResult = await Cr49f_purchaserequestsService.create(
        prPayload as Parameters<
          typeof Cr49f_purchaserequestsService.create
        >[0]
      );

      if (!prResult.data) {
        throw new Error("Dataverse did not return the created PR record.");
      }

      createdPRId = prResult.data.cr49f_purchaserequestid;

      if (!createdPRId) {
        throw new Error(
          "The PR was created, but its record ID was not returned."
        );
      }

      /*
       * The lookup uses the parent PR's GUID.
       * No product price or total amount is included in line records.
       */
      for (const item of selectedItems) {
        const product = item.product;

        const linePayload = {
          cr49f_itemname: product.cr49f_productname || "",
          cr49f_itemdescription:
            product.cr49f_productdescription || "",
          cr49f_category: product.cr49f_category || "",
          cr49f_quantity: item.quantity,
          "cr49f_PurchaseRequest@odata.bind":
            `/cr49f_purchaserequests(${createdPRId})`,
          statecode: 0,
          statuscode: 1,
        };

        const lineResult =
          await Cr49f_purchaserequestlinesService.create(
            linePayload as Parameters<
              typeof Cr49f_purchaserequestlinesService.create
            >[0]
          );

        if (!lineResult.data) {
          throw new Error(
            `Could not save line item "${product.cr49f_productname}".`
          );
        }
      }

      // All records have been created successfully. Keep the modal open
      // and show the success screen only after every line item is saved.
      setCreatedPRRecordId(createdPRId);
      setCreatedPRTitle(form.title.trim());
      setCreatedItemCount(
        selectedItems.reduce((sum, item) => sum + item.quantity, 0)
      );
      setIsSuccess(true);
      onCreated?.();
    } catch (error: unknown) {
      console.error("Purchase request submission failed:", error);

      const message = getErrorMessage(error);

      setSubmitError(
        createdPRId
          ? `The PR was created, but a line item could not be saved. PR ID: ${createdPRId}. ${message}`
          : `Unable to create the purchase request. ${message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="create-pr-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className={`create-pr-modal ${isSuccess || step === 2 ? "create-pr-modal-products" : ""} ${isSuccess ? "create-pr-success-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={isSuccess ? "create-pr-success-title" : "create-pr-title"}
      >
        {isSuccess ? (
          <div className="create-pr-success">
            <div className="create-pr-success-icon">
              <Check size={25} strokeWidth={2.5} />
            </div>

            <h2 id="create-pr-success-title">Purchase Request submitted</h2>

            <p>
              <strong>{createdPRTitle}</strong> was created with {createdItemCount}{" "}
              {createdItemCount === 1 ? "item" : "items"}.
            </p>

            {createdPRRecordId && (
              <span className="create-pr-success-id">
                Request ID: {createdPRRecordId}
              </span>
            )}

            <div className="create-pr-success-actions">
              <button
                type="button"
                className="create-pr-discard"
                onClick={() => {
                  setForm(initialForm);
                  setSelectedProducts({});
                  setErrors({});
                  setSearch("");
                  setSelectedCategory("All");
                  setSubmitError("");
                  setCreatedPRRecordId(null);
                  setCreatedPRTitle("");
                  setCreatedItemCount(0);
                  setStep(1);
                  setIsSuccess(false);
                }}
              >
                Create Another
              </button>

              <button
                type="button"
                className="create-pr-view-request"
                onClick={() => {
                  onClose();
                  onViewPurchaseRequest?.(createdPRRecordId || undefined);
                }}
              >
                View Purchase Request
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="create-pr-header">
              <div className="create-pr-heading">
                <div className="create-pr-icon">
                  <CheckSquare size={19} />
                </div>

                <div>
                  <h2 id="create-pr-title">
                    Create Purchase Request
                  </h2>

                  <p>
                    Step {step} of 2 ·{" "}
                    {step === 1 ? "Request Details" : "Select Products"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="create-pr-close"
                aria-label="Close"
                onClick={onClose}
                disabled={isSubmitting}
              >
                <X size={17} />
              </button>
            </header>

            {/* Stepper */}
            <div className="create-pr-stepper">
              <div
                className={`create-pr-step ${step === 1
                  ? "create-pr-step-active"
                  : "create-pr-step-complete"
                  }`}
              >
                <span className="create-pr-step-number">
                  {step === 1 ? "1" : <Check size={12} />}
                </span>

                <span className="create-pr-step-label">
                  Request Details
                </span>
              </div>

              <div className="create-pr-step-line" />

              <div
                className={`create-pr-step ${step === 2
                  ? "create-pr-step-active"
                  : "create-pr-step-upcoming"
                  }`}
              >
                <span className="create-pr-step-number">2</span>

                <span className="create-pr-step-label">
                  Select Products
                </span>
              </div>
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <form
                className="create-pr-form"
                onSubmit={handleNext}
                noValidate
              >
                <div className="create-pr-fields">
                  <div className="create-pr-field">
                    <label htmlFor="pr-title">
                      PR Title <span className="required">*</span>
                    </label>

                    <input
                      id="pr-title"
                      value={form.title}
                      maxLength={200}
                      placeholder="e.g. PR for IT Equipment Refresh"
                      onChange={(event) =>
                        updateField("title", event.target.value)
                      }
                      aria-invalid={Boolean(errors.title)}
                    />

                    {errors.title && (
                      <span className="create-pr-field-error">
                        {errors.title}
                      </span>
                    )}
                  </div>

                  <div className="create-pr-field">
                    <label htmlFor="pr-justification">
                      Business Justification{" "}
                      <span className="required">*</span>
                    </label>

                    <textarea
                      id="pr-justification"
                      rows={3}
                      value={form.justification}
                      placeholder="Explain the business need for this purchase..."
                      onChange={(event) =>
                        updateField("justification", event.target.value)
                      }
                      aria-invalid={Boolean(errors.justification)}
                    />

                    {errors.justification && (
                      <span className="create-pr-field-error">
                        {errors.justification}
                      </span>
                    )}
                  </div>

                  <div className="create-pr-field-row">
                    <div className="create-pr-field">
                      <label htmlFor="pr-location">
                        Delivery Location{" "}
                        <span className="required">*</span>
                      </label>

                      <input
                        id="pr-location"
                        value={form.deliveryLocation}
                        placeholder="e.g. IT Operations, Building A"
                        onChange={(event) =>
                          updateField(
                            "deliveryLocation",
                            event.target.value
                          )
                        }
                        aria-invalid={Boolean(errors.deliveryLocation)}
                      />

                      {errors.deliveryLocation && (
                        <span className="create-pr-field-error">
                          {errors.deliveryLocation}
                        </span>
                      )}
                    </div>

                    <div className="create-pr-field">
                      <label htmlFor="pr-date">
                        Required Delivery Date{" "}
                        <span className="required">*</span>
                      </label>

                      <input
                        id="pr-date"
                        type="date"
                        min={getToday()}
                        value={form.requiredDeliveryDate}
                        onChange={(event) =>
                          updateField(
                            "requiredDeliveryDate",
                            event.target.value
                          )
                        }
                        aria-invalid={Boolean(
                          errors.requiredDeliveryDate
                        )}
                      />

                      {errors.requiredDeliveryDate && (
                        <span className="create-pr-field-error">
                          {errors.requiredDeliveryDate}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="create-pr-info">
                    <span className="create-pr-info-dot">i</span>

                    <p>
                      Next, you&apos;ll pick the products this request
                      covers and set quantities for each.
                    </p>
                  </div>

                  {submitError && (
                    <div className="create-pr-submit-error" role="alert">
                      {submitError}
                    </div>
                  )}
                </div>

                <footer className="create-pr-footer">
                  <button
                    type="button"
                    className="create-pr-discard"
                    onClick={handleDiscard}
                  >
                    Discard
                  </button>

                  <button
                    type="submit"
                    className="create-pr-next"
                  >
                    Next: Select Products
                    <ChevronRight size={17} />
                  </button>
                </footer>
              </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="create-pr-product-step">
                <div className="create-pr-product-toolbar">
                  <div className="create-pr-search">
                    <Search size={15} />

                    <input
                      type="search"
                      aria-label="Search products"
                      placeholder="Search products..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />

                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="create-pr-category-filters">
                    {categories.map((category) => (
                      <button
                        type="button"
                        key={category}
                        className={
                          selectedCategory === category
                            ? "create-pr-category active"
                            : "create-pr-category"
                        }
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="create-pr-product-scroll">
                  {isLoadingProducts ? (
                    <div className="create-pr-empty">
                      <LoaderCircle className="create-pr-spinner" size={25} />
                      <p>Loading products...</p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="create-pr-empty">
                      <Package size={28} />
                      <p>No products found.</p>
                      <span>Try another search or category.</span>
                    </div>
                  ) : (
                    <div className="create-pr-product-grid">
                      {filteredProducts.map((product) => {
                        const id = product.cr49f_productsid;
                        const selected = selectedProducts[id];
                        const name = product.cr49f_productname || "Unnamed product";

                        return (
                          <article
                            key={id}
                            className={`create-pr-product-card ${selected ? "selected" : ""
                              }`}
                            onClick={() => toggleProduct(product)}
                          >
                            <div className="create-pr-product-card-top">
                              <div className="create-pr-product-icon">
                                <Package size={17} />
                              </div>

                              <button
                                type="button"
                                className={`create-pr-product-check ${selected ? "checked" : ""
                                  }`}
                                aria-label={
                                  selected
                                    ? `Remove ${name}`
                                    : `Select ${name}`
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleProduct(product);
                                }}
                              >
                                {selected && <Check size={13} />}
                              </button>
                            </div>

                            <h3>{name}</h3>

                            <p className="create-pr-product-category">
                              {product.cr49f_category || "Uncategorized"}
                            </p>

                            {product.cr49f_productdescription && (
                              <p className="create-pr-product-description">
                                {product.cr49f_productdescription}
                              </p>
                            )}

                            {selected && (
                              <div
                                className="create-pr-quantity"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease ${name} quantity`}
                                  disabled={selected.quantity <= 1}
                                  onClick={() => updateQuantity(id, -1)}
                                >
                                  <Minus size={12} />
                                </button>

                                <span>{selected.quantity}</span>

                                <button
                                  type="button"
                                  aria-label={`Increase ${name} quantity`}
                                  onClick={() => updateQuantity(id, 1)}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected line items: no prices or total amounts */}
                <div className="create-pr-line-summary">
                  <div className="create-pr-line-summary-heading">
                    <div>
                      <ShoppingCart size={15} />
                      <strong>
                        Line Items{selectedCount > 0 ? ` (${selectedCount})` : ""}
                      </strong>
                    </div>

                    <span>
                      {selectedItems.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}{" "}
                      total units
                    </span>
                  </div>

                  {selectedCount === 0 ? (
                    <p className="create-pr-line-empty">
                      No products selected yet — tap a product card to add it.
                    </p>
                  ) : (
                    <div className="create-pr-line-chips">
                      {selectedItems.map(({ product, quantity }) => (
                        <div
                          className="create-pr-line-chip"
                          key={product.cr49f_productsid}
                        >
                          <span className="create-pr-line-quantity">
                            {quantity}
                          </span>

                          <span className="create-pr-line-name">
                            {product.cr49f_productname}
                          </span>

                          <button
                            type="button"
                            aria-label={`Remove ${product.cr49f_productname}`}
                            onClick={() =>
                              toggleProduct(product)
                            }
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {submitError && (
                  <div className="create-pr-submit-error create-pr-product-error" role="alert">
                    {submitError}
                  </div>
                )}

                <footer className="create-pr-footer create-pr-product-footer">
                  <button
                    type="button"
                    className="create-pr-back"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft size={15} />
                    Back
                  </button>

                  <div className="create-pr-footer-actions">
                    <button
                      type="button"
                      className="create-pr-discard"
                      onClick={handleDiscard}
                      disabled={isSubmitting}
                    >
                      Discard
                    </button>

                    <button
                      type="button"
                      className="create-pr-submit"
                      onClick={handleSubmit}
                      disabled={isSubmitting || isLoadingProducts}
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle
                            size={15}
                            className="create-pr-spinner"
                          />
                          Submitting...
                        </>
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </footer>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}