
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  Flag,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Cr49f_purchaserequestsService } from "../generated/services/Cr49f_purchaserequestsService";
import { Cr49f_purchaserequestlinesService } from "../generated/services/Cr49f_purchaserequestlinesService";

import "../Styles/PRSummary.css";

type PurchaseRequest = {
  cr49f_purchaserequestid: string;
  cr49f_prnumber?: string;
  cr49f_prtitle?: string;
  cr49f_status?: number;
  cr49f_statusname?: string;
  cr49f_priority?: number;
  cr49f_priorityname?: string;
  cr49f_totalamount?: number;
  cr49f_businessjustification?: string;
  cr49f_deliverylocation?: string;
  cr49f_requireddeliverydate?: string;
  createdon?: string;
  createdbyname?: string;
};

type PurchaseRequestLine = {
  cr49f_purchaserequestlineid: string;
  cr49f_prlinenumber?: string;
  cr49f_itemname?: string;
  cr49f_itemdescription?: string;
  cr49f_category?: string;
  cr49f_quantity?: number;
  cr49f_unitprice?: number;
  _cr49f_purchaserequest_value?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function normalizeId(value?: string): string {
  return (value ?? "").replace(/[{}]/g, "").trim().toLowerCase();
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getStatus(request: PurchaseRequest): string {
  if (request.cr49f_statusname) return request.cr49f_statusname;

  switch (request.cr49f_status) {
    case 0:
      return "In Review";
    case 1:
      return "Approved";
    case 2:
      return "Changes Needed";
    case 3:
      return "Rejected";
    default:
      return "Unknown";
  }
}

function getPriority(request: PurchaseRequest): string {
  if (request.cr49f_priorityname) return request.cr49f_priorityname;

  switch (request.cr49f_priority) {
    case 0:
      return "Low";
    case 1:
      return "Normal";
    case 2:
      return "High";
    default:
      return "Not set";
  }
}

function statusPillClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";

  return "review";
}

export default function PurchaseRequestDetail() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [allLines, setAllLines] = useState<PurchaseRequestLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [requestResult, lineResult] = await Promise.all([
          Cr49f_purchaserequestsService.getAll(),
          Cr49f_purchaserequestlinesService.getAll(),
        ]);

        if (cancelled) return;

        if (!requestResult.success) {
          throw new Error("Unable to load purchase requests from Dataverse.");
        }

        if (!lineResult.success) {
          throw new Error("Unable to load purchase request line items from Dataverse.");
        }

        setRequests((requestResult.data ?? []) as PurchaseRequest[]);
        setAllLines((lineResult.data ?? []) as PurchaseRequestLine[]);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load purchase request summary:", err);
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading the purchase request."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const record = useMemo(() => {
    if (!ref) return undefined;

    const routeRef = normalizeId(ref);

    return requests.find(
      (request) =>
        normalizeId(request.cr49f_prnumber) === routeRef ||
        normalizeId(request.cr49f_purchaserequestid) === routeRef
    );
  }, [requests, ref]);

  const lineItems = useMemo(() => {
    if (!record) return [];

    const requestId = normalizeId(record.cr49f_purchaserequestid);

    return allLines.filter(
      (line) =>
        normalizeId(line._cr49f_purchaserequest_value) === requestId
    );
  }, [record, allLines]);

  const calculatedTotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, line) =>
          sum + (Number(line.cr49f_quantity) || 0) *
            (Number(line.cr49f_unitprice) || 0),
        0
      ),
    [lineItems]
  );

  if (loading) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Loading purchase request from Dataverse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/purchase-requests")}
          >
            Back to Purchase Requests
          </button>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="pr-detail-page">
        <div className="pr-detail-notfound">
          <p>Purchase Request not found in Dataverse.</p>
          <p>Route reference: {ref || "Not provided"}</p>
          <button
            type="button"
            onClick={() => navigate("/purchase-requests")}
          >
            Back to Purchase Requests
          </button>
        </div>
      </div>
    );
  }

  const status = getStatus(record);
  const priority = getPriority(record);
  const requestNumber = record.cr49f_prnumber || record.cr49f_purchaserequestid;
  const requestTitle = record.cr49f_prtitle || "Untitled Purchase Request";
  const requestAmount = record.cr49f_totalamount ?? calculatedTotal;

  const aiSummary = [
    `Purchase request ${requestNumber}: ${requestTitle}.`,
    `Current status is ${status}. Priority is ${priority}.`,
    `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"} found.`,
    `Calculated line-item total: ${currencyFormatter.format(calculatedTotal)}.`,
  ].join(" ");

  return (
    <div className="pr-detail-page">
      <div className="pr-detail-heading">
        <div className="pr-detail-heading-left">
          <button
            type="button"
            className="pr-detail-back"
            onClick={() => navigate("/purchase-requests")}
            aria-label="Back to purchase requests"
          >
            <ArrowLeft size={14} />
          </button>

          <div>
            <div className="pr-detail-title-row">
              <h1>{requestNumber}</h1>
              <span className={`pr-detail-status-pill ${statusPillClass(status)}`}>
                {status}
              </span>
            </div>
            <p className="pr-detail-subtitle">{requestTitle}</p>
          </div>
        </div>
      </div>

      <section className="pr-detail-card">
        <div className="pr-detail-card-header">
          <div className="pr-detail-card-header-left">
            <div className="pr-detail-card-icon">
              <ClipboardList size={14} />
            </div>
            <div className="pr-detail-card-title">
              <h2>Purchase Request Summary</h2>
              <p>Live details retrieved from Dataverse</p>
            </div>
          </div>
        </div>

        <section className="pr-summary-kpis" aria-label="Purchase request metrics">
          <article className="pr-summary-kpi amount">
            <span className="pr-summary-kpi-icon"><Coins size={15} /></span>
            <span className="pr-summary-kpi-copy">
              <small>Request Amount</small>
              <strong>{currencyFormatter.format(requestAmount)}</strong>
            </span>
          </article>

          <article className={`pr-summary-kpi ${statusPillClass(status)}`}>
            <span className="pr-summary-kpi-icon"><ShieldCheck size={15} /></span>
            <span className="pr-summary-kpi-copy">
              <small>Current Status</small>
              <strong>{status}</strong>
            </span>
          </article>

          <article className="pr-summary-kpi priority">
            <span className="pr-summary-kpi-icon"><Flag size={15} /></span>
            <span className="pr-summary-kpi-copy">
              <small>Priority</small>
              <strong>{priority}</strong>
            </span>
          </article>

          <article className="pr-summary-kpi due-date">
            <span className="pr-summary-kpi-icon"><CalendarDays size={15} /></span>
            <span className="pr-summary-kpi-copy">
              <small>Required By</small>
              <strong>{formatDate(record.cr49f_requireddeliverydate)}</strong>
            </span>
          </article>
        </section>

        <section className="pr-ai-summary" aria-labelledby="pr-ai-summary-title">
          <div className="pr-ai-summary-heading">
            <span><Sparkles size={14} /></span>
            <h2 id="pr-ai-summary-title">Request Overview</h2>
            <small>Dataverse-backed</small>
          </div>
          <p>{aiSummary}</p>
          <span className="pr-ai-summary-note">
            Summary values are calculated from the purchase request and related line items.
          </span>
        </section>

        <div className="pr-summary-top">
          <div className="pr-summary-title">
            <ClipboardList size={13} />
            Purchase Request Details
          </div>
        </div>

        <div className="pr-detail-grid">
          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><FileText size={11} /></div>
            <div>
              <span>PR Number</span>
              <strong>{requestNumber}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><User size={11} /></div>
            <div>
              <span>Created By</span>
              <strong>{record.createdbyname || "—"}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><Tag size={11} /></div>
            <div>
              <span>Title</span>
              <strong>{requestTitle}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
            <div>
              <span>Request Date</span>
              <strong>{formatDate(record.createdon)}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><CalendarDays size={11} /></div>
            <div>
              <span>Required Delivery Date</span>
              <strong>{formatDate(record.cr49f_requireddeliverydate)}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><Flag size={11} /></div>
            <div>
              <span>Priority</span>
              <strong>{priority}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><Building2 size={11} /></div>
            <div>
              <span>Delivery Location</span>
              <strong>{record.cr49f_deliverylocation || "—"}</strong>
            </div>
          </div>

          <div className="pr-detail-field">
            <div className="pr-detail-field-icon"><Coins size={11} /></div>
            <div>
              <span>Request Amount</span>
              <strong>
                {record.cr49f_totalamount == null
                  ? "Not recorded"
                  : currencyFormatter.format(record.cr49f_totalamount)}
              </strong>
            </div>
          </div>
        </div>

        <div className="pr-detail-justification">
          <span>Business Justification</span>
          <p>
            {record.cr49f_businessjustification ||
              "No business justification provided."}
          </p>
          <small>Delivery location: {record.cr49f_deliverylocation || "—"}</small>
        </div>

        <div className="pr-detail-lineitems-heading">
          <PackageCheck size={13} />
          Purchase Request Line Items ({lineItems.length})
        </div>

        <div className="pr-detail-table-wrapper">
          <table className="pr-detail-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Line Number</th>
                <th>Item Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>

            <tbody>
              {lineItems.length ? (
                lineItems.map((item, index) => {
                  const quantity = Number(item.cr49f_quantity) || 0;
                  const unitPrice = Number(item.cr49f_unitprice) || 0;
                  const lineTotal = quantity * unitPrice;

                  return (
                    <tr key={item.cr49f_purchaserequestlineid}>
                      <td>{index + 1}</td>
                      <td>{item.cr49f_prlinenumber || "—"}</td>
                      <td>{item.cr49f_itemname || "—"}</td>
                      <td>{item.cr49f_itemdescription || "—"}</td>
                      <td>{item.cr49f_category || "—"}</td>
                      <td>{quantity}</td>
                      <td>{currencyFormatter.format(unitPrice)}</td>
                      <td>{currencyFormatter.format(lineTotal)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    No line items are linked to this purchase request.
                  </td>
                </tr>
              )}
            </tbody>

            {lineItems.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ textAlign: "right", fontWeight: 700 }}>
                    Calculated Line Items Total
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {currencyFormatter.format(calculatedTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
