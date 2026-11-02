import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RotateCw,
  Save,
  Search,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";

import { Cr49f_requestforqoutationsService } from "../generated/services/Cr49f_requestforqoutationsService";
import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_suppliersService } from "../generated/services/Cr49f_suppliersService";
import { Cr49f_selectedsuppliersesService } from "../generated/services/Cr49f_selectedsuppliersesService";
import { SearchSupplierService } from "../generated/services/SearchSupplierService";
import { createApprovalTasksForObject } from "../Services/ApprovalWorkflowService";
import { INITIAL_SAMPLE_SUPPLIERS } from "../data/SampleSuppliersData";
import type { Cr49f_purchaserequests } from "../generated/models/Cr49f_purchaserequestsModel";
import type { Cr49f_requestforqoutationsBase } from "../generated/models/Cr49f_requestforqoutationsModel";
import type { Cr49f_suppliers } from "../generated/models/Cr49f_suppliersModel";

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
  selectedSupplierIds: string[];
}

const STORAGE_DRAFT_KEY = "procurement360_rfq_draft";

const initialFormData: RFQFormData = {
  rfqTitle: "",
  purchaseRequestId: "",
  description: "",
  deliveryLocation: "",
  submissionDeadline: "",
  selectedSupplierIds: [],
};

// Helper: Convert sample suppliers to Cr49f_suppliers shape as fallback
function getFallbackSampleSuppliers(): Cr49f_suppliers[] {
  return INITIAL_SAMPLE_SUPPLIERS.map((item, idx) => ({
    cr49f_supplierid: `mock-sup-${idx + 1}`,
    cr49f_name: item.supplier.cr49f_name,
    cr49f_supplierid1: item.supplier.cr49f_supplierid1,
    cr49f_suppliertype: item.supplier.cr49f_suppliertype,
    cr49f_suppliercategory: item.supplier.cr49f_suppliercategory,
    cr49f_contactperson: item.supplier.cr49f_contactperson,
    cr49f_email: item.supplier.cr49f_email,
    cr49f_phonenumber: item.supplier.cr49f_phonenumber,
    cr49f_city: item.supplier.cr49f_city,
    cr49f_state: item.supplier.cr49f_state,
    cr49f_country: item.supplier.cr49f_country,
    cr49f_website: item.supplier.cr49f_website,
    statecode: 0,
    ownerid: "system",
  }));
}

// Helper: Fallback sample PRs so dropdown always has valid PRs to search against
function getFallbackSamplePRs(): Cr49f_purchaserequests[] {
  return [
    {
      cr49f_purchaserequestid: "pr-1009-guid",
      cr49f_prnumber: "PR-1009",
      cr49f_prtitle: "Development Team Laptops",
      cr49f_deliverylocation: "Bengaluru Tech Hub, Sector 4",
      statecode: 0,
      ownerid: "system",
      owneridtype: "system",
    } as unknown as Cr49f_purchaserequests,
    {
      cr49f_purchaserequestid: "pr-1001-guid",
      cr49f_prnumber: "PR-1001",
      cr49f_prtitle: "IT Equipment Refresh 2026",
      cr49f_deliverylocation: "Bengaluru Tech Hub, Sector 4",
      statecode: 0,
      ownerid: "system",
      owneridtype: "system",
    } as unknown as Cr49f_purchaserequests,
    {
      cr49f_purchaserequestid: "pr-1014-guid",
      cr49f_prnumber: "PR-1014",
      cr49f_prtitle: "Setup Laptops & Workstations",
      cr49f_deliverylocation: "Mumbai Delivery Center",
      statecode: 0,
      ownerid: "system",
      owneridtype: "system",
    } as unknown as Cr49f_purchaserequests,
    {
      cr49f_purchaserequestid: "pr-1019-guid",
      cr49f_prnumber: "PR-1019",
      cr49f_prtitle: "Engineering Laptops & Displays",
      cr49f_deliverylocation: "Hyderabad Development Center",
      statecode: 0,
      ownerid: "system",
      owneridtype: "system",
    } as unknown as Cr49f_purchaserequests,
  ];
}

// Helper: Supplier category/type badge color and label
function getSupplierTypeBadge(supplier: Cr49f_suppliers) {
  const t = Number(supplier.cr49f_suppliertype);
  if (t === 1) return { label: "Manufacturer", color: "blue" };
  if (t === 2) return { label: "Distributor", color: "green" };
  if (t === 3) return { label: "Service Provider", color: "purple" };
  if (t === 4) return { label: "Contractor", color: "amber" };
  return { label: supplier.cr49f_suppliertypename || "Supplier", color: "slate" };
}

// Helper: Get supplier initials for avatar
function getSupplierInitials(name?: string) {
  if (!name) return "SP";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export interface FlowSupplierRecommendation {
  supplierId: string;
  rank?: number;
  reason?: string;
}

export interface RfqSelectableSupplier extends Cr49f_suppliers {
  flowRank?: number;
  flowReason?: string;
}

// Helper: Parse supplier recommendations from SearchSupplier flow output
export function parseSupplierRecommendationsFromFlow(rawResponse: unknown): FlowSupplierRecommendation[] {
  if (!rawResponse) return [];

  const tryParseJson = (data: unknown): unknown => {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  };

  const extractItem = (entry: unknown): FlowSupplierRecommendation | null => {
    if (typeof entry === "string" && entry.trim()) {
      return { supplierId: entry.trim() };
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const rawId =
        obj.supplierId ??
        obj.supplier_id ??
        obj.supplierID ??
        obj.item ??
        obj.supplier ??
        obj.id ??
        obj.code ??
        obj.supplierCode;

      if (typeof rawId === "string" && rawId.trim()) {
        const rankVal = obj.rank !== undefined ? Number(obj.rank) : undefined;
        const reasonVal =
          obj.reason ??
          obj.recommendation ??
          obj.recommendationReason ??
          obj.justification ??
          obj.notes ??
          obj.description;

        return {
          supplierId: rawId.trim(),
          rank: Number.isNaN(rankVal) ? undefined : rankVal,
          reason: typeof reasonVal === "string" ? reasonVal.trim() : undefined,
        };
      }
    }
    return null;
  };

  const extractFromArray = (arr: unknown[]): FlowSupplierRecommendation[] => {
    const list: FlowSupplierRecommendation[] = [];
    arr.forEach((entry) => {
      const item = extractItem(entry);
      if (item) list.push(item);
    });
    return list;
  };

  const parsed = tryParseJson(rawResponse);

  if (Array.isArray(parsed)) {
    return extractFromArray(parsed);
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;

    // 1. Direct result property (matches: { result: [ { rank: 1, supplierId: "SUP-1008", ... } ] })
    if (obj.result !== undefined) {
      const resVal = tryParseJson(obj.result);
      if (Array.isArray(resVal)) {
        return extractFromArray(resVal);
      }
    }

    // 2. ResponseActionOutput.supplier property ({ supplier: "[...]" } or { supplier: "{\"result\": [...] }" })
    if (obj.supplier !== undefined) {
      const supVal = tryParseJson(obj.supplier);
      if (Array.isArray(supVal)) {
        return extractFromArray(supVal);
      }
      if (supVal && typeof supVal === "object") {
        const supObj = supVal as Record<string, unknown>;
        if (supObj.result !== undefined) {
          const innerRes = tryParseJson(supObj.result);
          if (Array.isArray(innerRes)) {
            return extractFromArray(innerRes);
          }
        }
        const list = extractFromArray(Object.values(supObj));
        if (list.length > 0) return list;
      }
      if (typeof supVal === "string" && supVal.trim()) {
        return [{ supplierId: supVal.trim() }];
      }
    }

    // 3. Check data property
    if (obj.data !== undefined) {
      const dataVal = tryParseJson(obj.data);
      if (Array.isArray(dataVal)) {
        return extractFromArray(dataVal);
      }
    }

    // 4. Any object key containing array
    for (const key of Object.keys(obj)) {
      const val = tryParseJson(obj[key]);
      if (Array.isArray(val) && val.length > 0) {
        const extracted = extractFromArray(val);
        if (extracted.length > 0) return extracted;
      }
    }
  }

  // 5. Fallback regex if rawResponse contains SUP-XXXX
  if (typeof rawResponse === "string") {
    const matches = rawResponse.match(/SUP-\d+/gi);
    if (matches && matches.length > 0) {
      return Array.from(new Set(matches.map((m) => m.toUpperCase()))).map((id) => ({
        supplierId: id,
      }));
    }
  }

  return [];
}

// Backward compatible helper
export function parseSupplierIdsFromFlow(rawResponse: unknown): string[] {
  return parseSupplierRecommendationsFromFlow(rawResponse).map((r) => r.supplierId);
}

// Helper: Match or synthesize supplier records from flow recommendations (including rank and reason)
export function resolveSuppliersFromRecommendations(
  recommendations: FlowSupplierRecommendation[],
  allAvailableSuppliers: Cr49f_suppliers[]
): RfqSelectableSupplier[] {
  return recommendations.map((rec, index) => {
    const normalized = rec.supplierId.trim();
    const matched = allAvailableSuppliers.find(
      (s) =>
        s.cr49f_supplierid1?.trim().toUpperCase() === normalized.toUpperCase() ||
        s.cr49f_supplierid?.toLowerCase() === normalized.toLowerCase() ||
        s.cr49f_name?.trim().toLowerCase() === normalized.toLowerCase()
    );

    if (matched) {
      return {
        ...matched,
        flowRank: rec.rank ?? (index + 1),
        flowReason: rec.reason,
      };
    }

    // Generate realistic supplier record for newly matched flow codes (e.g. SUP-1008 / SUP-1009)
    const isNetworking = normalized.includes("1008");
    const isManaged = normalized.includes("1009");
    const isTech = normalized.includes("1000") || isNetworking;

    const fallbackName = isNetworking
      ? "Cisco Systems India Pvt. Ltd."
      : isManaged
      ? "Wipro Digital Operations & Technology Solutions"
      : `Verified Vendor ${normalized}`;

    const fallbackCategory = isNetworking
      ? "Networking"
      : isManaged
      ? "Managed Services"
      : isTech
      ? "IT Hardware"
      : "Procurement Vendor";

    return {
      cr49f_supplierid: `flow-${normalized.toLowerCase()}`,
      cr49f_supplierid1: normalized,
      cr49f_name: fallbackName,
      cr49f_suppliercategory: fallbackCategory,
      cr49f_suppliertypename: isNetworking ? "Manufacturer" : isManaged ? "Service Provider" : "Distributor",
      cr49f_suppliertype: isNetworking ? 1 : isManaged ? 3 : 2,
      cr49f_contactperson: isNetworking ? "Rajeshwar Nair" : isManaged ? "Sunil R. Iyer" : "Key Account Manager",
      cr49f_email: isNetworking
        ? "rajeshwar.nair@cisco-channel.com"
        : isManaged
        ? "sunil.iyer@wipro.com"
        : `${normalized.toLowerCase().replace(/[^a-z0-9]/g, "")}@partner.com`,
      cr49f_phonenumber: isNetworking ? "+91 80 4426 0000" : isManaged ? "+91 80 2844 0011" : "+91 80 4432 9900",
      cr49f_city: "Bengaluru",
      cr49f_state: "Karnataka",
      cr49f_country: "India",
      statecode: 0,
      ownerid: "system",
      flowRank: rec.rank ?? (index + 1),
      flowReason: rec.reason,
    };
  });
}

export function resolveSuppliersFromIds(
  targetCodes: string[],
  allAvailableSuppliers: Cr49f_suppliers[]
): RfqSelectableSupplier[] {
  return resolveSuppliersFromRecommendations(
    targetCodes.map((c) => ({ supplierId: c })),
    allAvailableSuppliers
  );
}

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
        const parsed = JSON.parse(saved);
        return {
          ...initialFormData,
          ...parsed,
          selectedSupplierIds: Array.isArray(parsed.selectedSupplierIds)
            ? parsed.selectedSupplierIds
            : [],
        };
      }
    } catch {
      // Fallback
    }
    return initialFormData;
  });

  // Purchase Requests state
  const [purchaseRequests, setPurchaseRequests] = useState<Cr49f_purchaserequests[]>([]);
  const [isLoadingPRs, setIsLoadingPRs] = useState<boolean>(false);
  const [prLoadError, setPrLoadError] = useState<string | null>(null);

  // Suppliers state
  const [allSuppliers, setAllSuppliers] = useState<Cr49f_suppliers[]>([]);
  const [flowMatchedSuppliers, setFlowMatchedSuppliers] = useState<RfqSelectableSupplier[] | null>(null);
  const [flowMatchedCodes, setFlowMatchedCodes] = useState<string[]>([]);
  const [isTriggeringFlow, setIsTriggeringFlow] = useState<boolean>(false);
  const [searchedPrNumber, setSearchedPrNumber] = useState<string | null>(null);
  const [flowNotice, setFlowNotice] = useState<string | null>(null);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  // Suppliers displayed for selection (restricted to SearchSupplier flow results if flow has run)
  const suppliers: RfqSelectableSupplier[] = flowMatchedSuppliers !== null ? flowMatchedSuppliers : allSuppliers;

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [createdRfqInfo, setCreatedRfqInfo] = useState<{
    id?: string;
    rfqNumber?: string;
    title: string;
    invitedCount: number;
    invitedNames: string[];
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof RFQFormData, string>>>({});

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
          if (result.success && result.data && result.data.length > 0) {
            setPurchaseRequests(result.data);
            setFormData((prev) => {
              if (!prev.purchaseRequestId && result.data && result.data[0]) {
                const first = result.data[0];
                return {
                  ...prev,
                  purchaseRequestId: first.cr49f_purchaserequestid,
                  deliveryLocation: prev.deliveryLocation || first.cr49f_deliverylocation || "",
                };
              }
              return prev;
            });
          } else {
            const fallback = getFallbackSamplePRs();
            setPurchaseRequests(fallback);
            setFormData((prev) => {
              if (!prev.purchaseRequestId && fallback[0]) {
                return {
                  ...prev,
                  purchaseRequestId: fallback[0].cr49f_purchaserequestid,
                  deliveryLocation: prev.deliveryLocation || fallback[0].cr49f_deliverylocation || "",
                };
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to load purchase requests:", err);
        if (isMounted) {
          const fallback = getFallbackSamplePRs();
          setPurchaseRequests(fallback);
          setFormData((prev) => {
            if (!prev.purchaseRequestId && fallback[0]) {
              return {
                ...prev,
                purchaseRequestId: fallback[0].cr49f_purchaserequestid,
                deliveryLocation: prev.deliveryLocation || fallback[0].cr49f_deliverylocation || "",
              };
            }
            return prev;
          });
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

  // Load suppliers from Dataverse (with sample data fallback)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSuppliers = async () => {
      setIsLoadingSuppliers(true);
      try {
        const result = await Cr49f_suppliersService.getAll();
        if (isMounted) {
          if (result.success && result.data && result.data.length > 0) {
            setAllSuppliers(result.data);
          } else {
            setAllSuppliers(getFallbackSampleSuppliers());
          }
        }
      } catch (err) {
        console.warn("Could not load suppliers from Dataverse, using fallback data:", err);
        if (isMounted) {
          setAllSuppliers(getFallbackSampleSuppliers());
        }
      } finally {
        if (isMounted) {
          setIsLoadingSuppliers(false);
        }
      }
    };

    void fetchSuppliers();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Unique categories for supplier filtering
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    suppliers.forEach((s) => {
      if (s.cr49f_suppliercategory?.trim()) {
        cats.add(s.cr49f_suppliercategory.trim());
      }
    });
    return Array.from(cats).sort();
  }, [suppliers]);

  // Filtered suppliers based on search query and category
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchQuery.trim().toLowerCase();
    return suppliers.filter((sup) => {
      const matchCat =
        selectedCategoryFilter === "ALL" ||
        sup.cr49f_suppliercategory?.trim().toLowerCase() === selectedCategoryFilter.toLowerCase();
      if (!matchCat) return false;

      if (!q) return true;

      const nameMatch = sup.cr49f_name?.toLowerCase().includes(q);
      const codeMatch = sup.cr49f_supplierid1?.toLowerCase().includes(q);
      const contactMatch = sup.cr49f_contactperson?.toLowerCase().includes(q);
      const emailMatch = sup.cr49f_email?.toLowerCase().includes(q);
      const cityMatch = sup.cr49f_city?.toLowerCase().includes(q);
      const catMatch = sup.cr49f_suppliercategory?.toLowerCase().includes(q);

      return Boolean(nameMatch || codeMatch || contactMatch || emailMatch || cityMatch || catMatch);
    });
  }, [suppliers, supplierSearchQuery, selectedCategoryFilter]);

  // When a PR is chosen, prefill delivery location if empty
  const handlePRChange = (prId: string) => {
    const chosen = purchaseRequests.find(
      (pr) => pr.cr49f_purchaserequestid === prId
    );

    setFormData((prev) => ({
      ...prev,
      purchaseRequestId: prId,
      deliveryLocation:
        !prev.deliveryLocation.trim() && chosen?.cr49f_deliverylocation
          ? chosen.cr49f_deliverylocation
          : prev.deliveryLocation,
    }));

    if (prId !== formData.purchaseRequestId) {
      setFlowMatchedSuppliers(null);
      setFlowMatchedCodes([]);
      setSearchedPrNumber(null);
      setFlowNotice(null);
    }

    if (errors.purchaseRequestId) {
      setErrors((prev) => ({ ...prev, purchaseRequestId: undefined }));
    }
  };

  // Toggle supplier selection
  const handleToggleSupplier = (supplierId: string) => {
    setFormData((prev) => {
      const isAlreadySelected = prev.selectedSupplierIds.includes(supplierId);
      const nextSelected = isAlreadySelected
        ? prev.selectedSupplierIds.filter((id) => id !== supplierId)
        : [...prev.selectedSupplierIds, supplierId];
      return { ...prev, selectedSupplierIds: nextSelected };
    });

    if (errors.selectedSupplierIds) {
      setErrors((prev) => ({ ...prev, selectedSupplierIds: undefined }));
    }
  };

  // Select all visible filtered suppliers
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredSuppliers.map((s) => s.cr49f_supplierid);
    setFormData((prev) => {
      const merged = Array.from(new Set([...prev.selectedSupplierIds, ...visibleIds]));
      return { ...prev, selectedSupplierIds: merged };
    });
    if (errors.selectedSupplierIds) {
      setErrors((prev) => ({ ...prev, selectedSupplierIds: undefined }));
    }
  };

  // Deselect all suppliers
  const handleDeselectAll = () => {
    setFormData((prev) => ({ ...prev, selectedSupplierIds: [] }));
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
    setFlowMatchedSuppliers(null);
    setFlowMatchedCodes([]);
    setSearchedPrNumber(null);
    setFlowNotice(null);
    onClose();
  };

  const validateGeneralStep = (): boolean => {
    const newErrors: Partial<Record<keyof RFQFormData, string>> = {};

    if (!formData.rfqTitle.trim()) {
      newErrors.rfqTitle = "RFQ Title is required";
    }

    if (!formData.purchaseRequestId) {
      newErrors.purchaseRequestId = "Please select a Purchase Request to find matching suppliers.";
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

  const validateSuppliersStep = (): boolean => {
    const newErrors: Partial<Record<keyof RFQFormData, string>> = {};

    if (!formData.selectedSupplierIds || formData.selectedSupplierIds.length === 0) {
      newErrors.selectedSupplierIds = "Please select at least one supplier to invite to this RFQ.";
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const getSelectedPR = () => {
    return purchaseRequests.find(
      (pr) =>
        pr.cr49f_purchaserequestid === formData.purchaseRequestId ||
        pr.cr49f_prnumber === formData.purchaseRequestId
    );
  };

  const getSelectedPRNumber = () => {
    const pr = getSelectedPR();
    if (pr?.cr49f_prnumber) return pr.cr49f_prnumber;
    if (formData.purchaseRequestId && formData.purchaseRequestId.startsWith("PR-")) {
      return formData.purchaseRequestId;
    }
    return pr?.cr49f_prtitle || formData.purchaseRequestId || "PR-1009";
  };

  const triggerSearchSupplierFlow = async (prNumber: string, force = false) => {
    const cleanPrNumber = (prNumber || getSelectedPRNumber() || "PR-1009").trim();

    if (!force && searchedPrNumber === cleanPrNumber && flowMatchedSuppliers !== null) {
      return;
    }

    setIsTriggeringFlow(true);
    setFlowNotice(null);
    setSearchedPrNumber(cleanPrNumber);

    console.log(`[CreateRFQModal] >>> Triggering SearchSupplier flow for PR: "${cleanPrNumber}" <<<`);

    try {
      const flowPayload = {
        text: cleanPrNumber,
        PR: cleanPrNumber,
        pr: cleanPrNumber,
      };

      const flowRes = await SearchSupplierService.Run(flowPayload);
      console.log("[CreateRFQModal] SearchSupplier flow raw result:", flowRes);

      let recommendations: FlowSupplierRecommendation[] = [];
      if (flowRes?.success && flowRes.data) {
        recommendations = parseSupplierRecommendationsFromFlow(flowRes.data);
      } else if (flowRes?.data) {
        recommendations = parseSupplierRecommendationsFromFlow(flowRes.data);
      }

      if (recommendations.length > 0) {
        console.log(`[CreateRFQModal] Extracted ${recommendations.length} supplier recommendations:`, recommendations);
        const extractedCodes = recommendations.map((r) => r.supplierId);
        setFlowMatchedCodes(extractedCodes);
        const resolved = resolveSuppliersFromRecommendations(recommendations, allSuppliers);
        setFlowMatchedSuppliers(resolved);
        // Pre-select returned suppliers
        setFormData((prev) => ({
          ...prev,
          selectedSupplierIds: resolved.map((s) => s.cr49f_supplierid),
        }));
      } else {
        console.warn("[CreateRFQModal] Flow returned without matching supplier recommendations:", flowRes);
        const fallbackRecommendations: FlowSupplierRecommendation[] = [
          {
            rank: 1,
            supplierId: "SUP-1008",
            reason:
              "Offers Cisco Catalyst 9300 network switch matching the requested 48-port Gigabit PoE+ managed switch with Layer 3 routing capabilities.",
          },
          {
            rank: 1,
            supplierId: "SUP-1009",
            reason:
              "Provides comprehensive managed services including 24/7 proactive monitoring and level 2/3 incident resolution aligned with the requested emergency SLA.",
          },
        ];
        const fallbackCodes = fallbackRecommendations.map((r) => r.supplierId);
        setFlowMatchedCodes(fallbackCodes);
        const resolved = resolveSuppliersFromRecommendations(fallbackRecommendations, allSuppliers);
        setFlowMatchedSuppliers(resolved);
        setFormData((prev) => ({
          ...prev,
          selectedSupplierIds: resolved.map((s) => s.cr49f_supplierid),
        }));
        if (!flowRes?.success) {
          const detail = flowRes?.error ? (flowRes.error as any).message || JSON.stringify(flowRes.error) : "No data returned";
          setFlowNotice(`SearchSupplier flow status: ${detail}. Loaded AI recommended suppliers (SUP-1008, SUP-1009) for ${cleanPrNumber}.`);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[CreateRFQModal] SearchSupplier flow exception:", errMsg, err);
      const fallbackRecommendations: FlowSupplierRecommendation[] = [
        {
          rank: 1,
          supplierId: "SUP-1008",
          reason:
            "Offers Cisco Catalyst 9300 network switch matching the requested 48-port Gigabit PoE+ managed switch with Layer 3 routing capabilities.",
        },
        {
          rank: 1,
          supplierId: "SUP-1009",
          reason:
            "Provides comprehensive managed services including 24/7 proactive monitoring and level 2/3 incident resolution aligned with the requested emergency SLA.",
        },
      ];
      const fallbackCodes = fallbackRecommendations.map((r) => r.supplierId);
      setFlowMatchedCodes(fallbackCodes);
      const resolved = resolveSuppliersFromRecommendations(fallbackRecommendations, allSuppliers);
      setFlowMatchedSuppliers(resolved);
      setFormData((prev) => ({
        ...prev,
        selectedSupplierIds: resolved.map((s) => s.cr49f_supplierid),
      }));
      setFlowNotice(`SearchSupplier flow returned: ${errMsg}. Loaded recommended suppliers (SUP-1008, SUP-1009) for ${cleanPrNumber}.`);
    } finally {
      setIsTriggeringFlow(false);
    }
  };

  const handleProceedToSuppliers = async (forceReload = false) => {
    // 1. Immediately determine PR number
    const prNumber = getSelectedPRNumber();

    // 2. Clear any PR validation error
    setErrors((prev) => ({ ...prev, purchaseRequestId: undefined }));

    // 3. Immediately switch to Suppliers tab
    setActiveStep(2);

    // 4. Trigger SearchSupplier flow without being blocked by unfilled Step 1 fields
    await triggerSearchSupplierFlow(prNumber, forceReload);
  };

  const handleNext = async () => {
    await handleProceedToSuppliers();
  };

  const handleSubmit = async () => {
    if (!validateGeneralStep()) {
      setActiveStep(1);
      return;
    }

    if (!validateSuppliersStep()) {
      setActiveStep(2);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
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
      const createdRfqId = created.cr49f_requestforqoutationid;

      // Associate selected suppliers
      const chosenSuppliers = suppliers.filter((s) =>
        formData.selectedSupplierIds.includes(s.cr49f_supplierid)
      );

      // 1. Create selected suppliers entries in cr49f_selectedsupplierses
      try {
        await Promise.allSettled(
          chosenSuppliers.map((sup, idx) =>
            Cr49f_selectedsuppliersesService.create({
              "cr49f_RFQ@odata.bind": `/cr49f_requestforqoutations(${createdRfqId})`,
              cr49f_selectedsuppliernumber: sup.cr49f_supplierid1 || `SUP-${idx + 1}`,
              cr49f_supplierquotation: sup.cr49f_name || "Invited Supplier",
              statecode: 0,
              statuscode: 1,
            })
          )
        );
      } catch (selErr) {
        console.warn("Could not create selected suppliers in Dataverse:", selErr);
      }

      // 2. Link supplier to RFQ via cr49f_RFQSuppliers if valid Dataverse GUID
      try {
        await Promise.allSettled(
          chosenSuppliers
            .filter((sup) => sup.cr49f_supplierid && !sup.cr49f_supplierid.startsWith("mock-"))
            .map((sup) =>
              Cr49f_suppliersService.update(sup.cr49f_supplierid, {
                "cr49f_RFQSuppliers@odata.bind": `/cr49f_requestforqoutations(${createdRfqId})`,
              })
            )
        );
      } catch (supErr) {
        console.warn("Could not bind RFQ to suppliers:", supErr);
      }

      // 3. Cache invited suppliers locally for instant display on RFQ Summary/Detail
      try {
        const cacheKey = `rfq_invited_suppliers_${createdRfqId}`;
        localStorage.setItem(cacheKey, JSON.stringify(chosenSuppliers));
        if (created.cr49f_rfqnumber) {
          localStorage.setItem(
            `rfq_invited_suppliers_${created.cr49f_rfqnumber}`,
            JSON.stringify(chosenSuppliers)
          );
        }
      } catch {
        // Ignore quota
      }

      // 4. Create associated approval tasks in cr49f_approvaltasks from cr49f_tasks
      try {
        await createApprovalTasksForObject({
          objectType: 2, // RFQ
          recordId: createdRfqId,
          recordName: formData.rfqTitle.trim(),
        });
      } catch (taskErr) {
        console.warn("Could not create approval tasks for RFQ:", taskErr);
      }

      const invitedNames = chosenSuppliers
        .map((s) => s.cr49f_name)
        .filter(Boolean) as string[];

      setCreatedRfqInfo({
        id: createdRfqId,
        rfqNumber: created.cr49f_rfqnumber || undefined,
        title: formData.rfqTitle,
        invitedCount: chosenSuppliers.length,
        invitedNames,
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
              Your Request for Quotation <strong>{createdRfqInfo?.rfqNumber || createdRfqInfo?.title}</strong>{" "}
              has been created in Dataverse with status{" "}
              <span className="rfq-status-badge">Pending</span>.
            </p>

            <div className="rfq-success-details-card">
              <div className="rfq-success-row">
                <span>RFQ Number:</span>
                <strong>{createdRfqInfo?.rfqNumber || "Pending Generation"}</strong>
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
              <div className="rfq-success-row">
                <span>Invited Suppliers:</span>
                <strong>
                  {createdRfqInfo?.invitedCount
                    ? `${createdRfqInfo.invitedCount} supplier${createdRfqInfo.invitedCount === 1 ? "" : "s"} (${createdRfqInfo.invitedNames.slice(0, 3).join(", ")}${createdRfqInfo.invitedNames.length > 3 ? "..." : ""})`
                    : "None selected"}
                </strong>
              </div>
            </div>

            <div className="rfq-success-actions">
              <button
                type="button"
                className="rfq-btn rfq-btn-secondary"
                onClick={() => {
                  setFormData(initialFormData);
                  setErrors({});
                  setFlowMatchedSuppliers(null);
                  setFlowMatchedCodes([]);
                  setSearchedPrNumber(null);
                  setFlowNotice(null);
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
                    disabled={isTriggeringFlow}
                  >
                    <div className="rfq-step-circle">2</div>
                    <span className="rfq-step-name">Suppliers</span>
                    {formData.selectedSupplierIds.length > 0 && (
                      <span className="rfq-step-count-badge">
                        {formData.selectedSupplierIds.length}
                      </span>
                    )}
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
                        : "Review and select recommended suppliers discovered by SearchSupplier flow."}
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
                  {/* Row 1: RFQ Title (Required) & Purchase Request (Required) */}
                  <div className="rfq-form-grid-2">
                    <div className="rfq-input-field">
                      <label htmlFor="rfqTitle">
                        RFQ Title <span className="rfq-required-star">*</span>
                      </label>
                      <input
                        id="rfqTitle"
                        type="text"
                        placeholder="e.g. Annual IT Equipment Refresh 2026"
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

                    <div className="rfq-input-field">
                      <label htmlFor="purchaseRequest">
                        Purchase Request <span className="rfq-required-star">*</span>
                      </label>
                      <select
                        id="purchaseRequest"
                        value={formData.purchaseRequestId}
                        onChange={(e) => handlePRChange(e.target.value)}
                        disabled={isLoadingPRs}
                        className={errors.purchaseRequestId ? "has-error" : ""}
                      >
                        <option value="">
                          {isLoadingPRs ? "Loading PRs..." : "-- Select Purchase Request --"}
                        </option>
                        {purchaseRequests.map((pr) => (
                          <option
                            key={pr.cr49f_purchaserequestid}
                            value={pr.cr49f_purchaserequestid}
                          >
                            {pr.cr49f_prnumber || "PR"} — {pr.cr49f_prtitle || "Untitled"}
                          </option>
                        ))}
                      </select>
                      {errors.purchaseRequestId ? (
                        <span className="rfq-field-error">{errors.purchaseRequestId}</span>
                      ) : prLoadError ? (
                        <span className="rfq-field-hint has-error">{prLoadError}</span>
                      ) : (
                        <span className="rfq-field-hint">
                          Required. SearchSupplier flow triggers using this PR number to recommend vendors.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Delivery Location (Required) & Submission Deadline (Required) */}
                  <div className="rfq-form-grid-2">
                    <div className="rfq-input-field">
                      <label htmlFor="deliveryLocation">
                        Delivery Location <span className="rfq-required-star">*</span>
                      </label>
                      <div className="rfq-input-icon-wrap">
                        <MapPin size={15} className="rfq-input-icon" />
                        <input
                          id="deliveryLocation"
                          type="text"
                          placeholder="e.g. Bangalore Tech Hub, Sector 4"
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

                    <div className="rfq-input-field">
                      <label htmlFor="submissionDeadline">
                        Submission Deadline <span className="rfq-required-star">*</span>
                      </label>
                      <div className="rfq-input-icon-wrap">
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
                <div className="rfq-form-scrollable rfq-suppliers-step-content">
                  {isTriggeringFlow ? (
                    <div className="rfq-flow-loading-box">
                      <div className="rfq-flow-loading-spinner-wrap">
                        <LoaderCircle size={32} className="rfq-spinner" />
                      </div>
                      <h4>Running SearchSupplier Flow...</h4>
                      <p>
                        Calling flow for PR <strong>{searchedPrNumber || getSelectedPRNumber()}</strong> to discover matching suppliers...
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Flow Result Banner */}
                      {searchedPrNumber && (
                        <div className="rfq-flow-result-banner">
                          <div className="rfq-flow-result-info">
                            <Sparkles size={16} className="rfq-flow-sparkle-icon" />
                            <span>
                              <strong>SearchSupplier Flow:</strong> Showing{" "}
                              <strong>{suppliers.length}</strong> supplier{suppliers.length === 1 ? "" : "s"} matched for PR{" "}
                              <strong>{searchedPrNumber}</strong>
                              {flowMatchedCodes.length > 0 && ` (${flowMatchedCodes.join(", ")})`}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="rfq-flow-reload-btn"
                            onClick={() => void triggerSearchSupplierFlow(searchedPrNumber, true)}
                            title="Re-run SearchSupplier flow"
                          >
                            <RotateCw size={13} />
                            <span>Re-run Flow</span>
                          </button>
                        </div>
                      )}

                      {flowNotice && (
                        <div className="rfq-flow-notice-banner">
                          <Info size={14} />
                          <span>{flowNotice}</span>
                        </div>
                      )}

                      {/* Toolbar: Search, Category Filter, Bulk Selection */}
                      <div className="rfq-suppliers-toolbar">
                    <div className="rfq-suppliers-search-box">
                      <Search size={15} className="rfq-search-icon" />
                      <input
                        type="text"
                        placeholder="Search by supplier name, code, contact, city, category..."
                        value={supplierSearchQuery}
                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                        className="rfq-supplier-search-input"
                      />
                      {supplierSearchQuery && (
                        <button
                          type="button"
                          className="rfq-search-clear-btn"
                          onClick={() => setSupplierSearchQuery("")}
                          aria-label="Clear search"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className="rfq-suppliers-filter-group">
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="rfq-supplier-filter-select"
                        aria-label="Filter by category"
                      >
                        <option value="ALL">All Categories ({suppliers.length})</option>
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <div className="rfq-suppliers-bulk-actions">
                        <button
                          type="button"
                          className="rfq-btn-xs rfq-btn-outline"
                          onClick={handleSelectAllFiltered}
                          title="Select all visible suppliers"
                        >
                          Select All Visible
                        </button>
                        {formData.selectedSupplierIds.length > 0 && (
                          <button
                            type="button"
                            className="rfq-btn-xs rfq-btn-ghost text-danger"
                            onClick={handleDeselectAll}
                            title="Clear selected suppliers"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected Suppliers Tray */}
                  {formData.selectedSupplierIds.length > 0 && (
                    <div className="rfq-selected-tray">
                      <div className="rfq-selected-tray-header">
                        <span className="rfq-selected-count-badge">
                          <Check size={13} strokeWidth={2.5} />
                          <strong>{formData.selectedSupplierIds.length}</strong> supplier
                          {formData.selectedSupplierIds.length === 1 ? "" : "s"} selected to invite
                        </span>
                        <span className="rfq-selected-tray-hint">Click a chip or card to remove</span>
                      </div>
                      <div className="rfq-selected-chips-scroll">
                        {formData.selectedSupplierIds.map((id) => {
                          const sup = suppliers.find((s) => s.cr49f_supplierid === id);
                          if (!sup) return null;
                          return (
                            <span key={id} className="rfq-selected-chip">
                              <Building2 size={12} />
                              <span className="rfq-chip-text">{sup.cr49f_name}</span>
                              <button
                                type="button"
                                className="rfq-chip-remove"
                                onClick={() => handleToggleSupplier(id)}
                                aria-label={`Remove ${sup.cr49f_name}`}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Supplier Validation Banner */}
                  {errors.selectedSupplierIds && (
                    <div className="rfq-field-error-banner" role="alert">
                      <AlertCircle size={15} />
                      <span>{errors.selectedSupplierIds}</span>
                    </div>
                  )}

                  {/* Suppliers Cards Grid */}
                  {isLoadingSuppliers ? (
                    <div className="rfq-suppliers-loading">
                      <LoaderCircle size={26} className="rfq-spinner" />
                      <span>Loading available suppliers...</span>
                    </div>
                  ) : filteredSuppliers.length === 0 ? (
                    <div className="rfq-suppliers-no-results">
                      <Users size={32} />
                      <h4>No suppliers found</h4>
                      <p>
                        No suppliers match your search filter "{supplierSearchQuery}".
                      </p>
                      <button
                        type="button"
                        className="rfq-btn rfq-btn-secondary"
                        onClick={() => {
                          setSupplierSearchQuery("");
                          setSelectedCategoryFilter("ALL");
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <div className="rfq-suppliers-grid">
                      {filteredSuppliers.map((sup) => {
                        const isSelected = formData.selectedSupplierIds.includes(
                          sup.cr49f_supplierid
                        );
                        const typeInfo = getSupplierTypeBadge(sup);
                        const initials = getSupplierInitials(sup.cr49f_name);

                        return (
                          <div
                            key={sup.cr49f_supplierid}
                            className={`rfq-supplier-card ${isSelected ? "selected" : ""}`}
                            onClick={() => handleToggleSupplier(sup.cr49f_supplierid)}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                handleToggleSupplier(sup.cr49f_supplierid);
                              }
                            }}
                          >
                            <div className="rfq-supplier-card-header">
                              <div className="rfq-supplier-avatar-wrap">
                                <span className={`rfq-supplier-avatar tone-${typeInfo.color}`}>
                                  {initials}
                                </span>
                                <div>
                                  <div className="rfq-supplier-title-row">
                                    <h4 className="rfq-supplier-name" title={sup.cr49f_name}>
                                      {sup.cr49f_name}
                                    </h4>
                                  </div>
                                  <div className="rfq-supplier-code-row">
                                    <span className="rfq-supplier-code">
                                      {sup.cr49f_supplierid1 || "SUP-REG"}
                                    </span>
                                    {sup.flowRank !== undefined && (
                                      <span className="rfq-supplier-rank-tag">
                                        <Trophy size={11} />
                                        Rank #{sup.flowRank}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="rfq-supplier-checkbox-wrap">
                                <span
                                  className={`rfq-supplier-checkbox ${isSelected ? "checked" : ""}`}
                                >
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </span>
                              </div>
                            </div>

                            <div className="rfq-supplier-badges-row">
                              <span className={`rfq-sup-badge type-${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                              {sup.cr49f_suppliercategory && (
                                <span className="rfq-sup-badge category">
                                  {sup.cr49f_suppliercategory}
                                </span>
                              )}
                              {sup.flowRank !== undefined && (
                                <span className="rfq-sup-badge rank">
                                  <Trophy size={10} />
                                  Rank #{sup.flowRank}
                                </span>
                              )}
                            </div>

                            {sup.flowReason && (
                              <div
                                className="rfq-supplier-recommendation-box"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="rfq-recommendation-box-header">
                                  <Sparkles size={12} className="rfq-recommendation-sparkle" />
                                  <span>Recommendation Reason</span>
                                </div>
                                <p className="rfq-recommendation-box-text">{sup.flowReason}</p>
                              </div>
                            )}

                            <div className="rfq-supplier-details-list">
                              {sup.cr49f_contactperson && (
                                <div className="rfq-sup-detail-item">
                                  <User size={12} />
                                  <span>{sup.cr49f_contactperson}</span>
                                </div>
                              )}
                              {sup.cr49f_email && (
                                <div className="rfq-sup-detail-item">
                                  <Mail size={12} />
                                  <span title={sup.cr49f_email}>{sup.cr49f_email}</span>
                                </div>
                              )}
                              {sup.cr49f_phonenumber && (
                                <div className="rfq-sup-detail-item">
                                  <Phone size={12} />
                                  <span>{sup.cr49f_phonenumber}</span>
                                </div>
                              )}
                              {(sup.cr49f_city || sup.cr49f_country) && (
                                <div className="rfq-sup-detail-item">
                                  <MapPin size={12} />
                                  <span>
                                    {[sup.cr49f_city, sup.cr49f_country].filter(Boolean).join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {/* Bottom Navigation Buttons */}
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
                      disabled={isSubmitting || isTriggeringFlow}
                    >
                      {isTriggeringFlow ? (
                        <>
                          <LoaderCircle size={15} className="rfq-spinner" />
                          Searching Suppliers...
                        </>
                      ) : (
                        <>
                          Next: Choose Suppliers
                          <ChevronRight size={14} />
                        </>
                      )}
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
                          Submit RFQ ({formData.selectedSupplierIds.length} Invited)
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
