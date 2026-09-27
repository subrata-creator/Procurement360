import { useRef, useState } from "react";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  getInitials,
  purchaseRequests,
  type PRStatus,
} from "./Purchaserequestsdata";

import "../Styles/PurchaseRequest.css";

const stats = [
  { title: "Total Requests", value: "8", type: "blue" },
  { title: "Approved Requests", value: "3", type: "green" },
  { title: "Requests in Review", value: "4", type: "orange" },
  { title: "Rejected Requests", value: "1", type: "red" },
];

const STATUS_OPTIONS: ("All Status" | PRStatus)[] = [
  "All Status",
  "In Review",
  "Approved",
  "Rejected",
];

function isoToUsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Approved") {
    return (
      <span className="pr-status approved">
        <span className="status-icon">✓</span>
        Approved
      </span>
    );
  }

  if (status === "Rejected") {
    return (
      <span className="pr-status rejected">
        <span className="status-icon">×</span>
        Rejected
      </span>
    );
  }

  return (
    <span className="pr-status review">
      <span className="status-icon">⌛</span>
      In Review
    </span>
  );
}

export default function PurchaseRequest() {
  const navigate = useNavigate();
  const createdOnDateRef = useRef<HTMLInputElement>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [titleQuery, setTitleQuery] = useState("");
  const [rfqQuery, setRfqQuery] = useState("");
  const [poQuery, setPoQuery] = useState("");
  const [createdByQuery, setCreatedByQuery] = useState("");
  const [createdOnQuery, setCreatedOnQuery] = useState("");
  const [statusQuery, setStatusQuery] = useState<(typeof STATUS_OPTIONS)[number]>("All Status");

  const filteredRequests = purchaseRequests.filter((request) => {
    const haystack = [request.ref, request.title, request.rfq, request.po, request.createdBy, request.date, request.status].join(" ").toLowerCase();

    const matchesGlobal = haystack.includes(globalQuery.trim().toLowerCase());
    const matchesRef = request.ref.toLowerCase().includes(refQuery.trim().toLowerCase());
    const matchesTitle = request.title.toLowerCase().includes(titleQuery.trim().toLowerCase());
    const matchesRfq = request.rfq.toLowerCase().includes(rfqQuery.trim().toLowerCase());
    const matchesPo = request.po.toLowerCase().includes(poQuery.trim().toLowerCase());
    const matchesCreatedBy = request.createdBy.toLowerCase().includes(createdByQuery.trim().toLowerCase());
    const matchesCreatedOn = request.date.toLowerCase().includes(createdOnQuery.trim().toLowerCase());
    const matchesStatus = statusQuery === "All Status" || request.status === statusQuery;

    return matchesGlobal && matchesRef && matchesTitle && matchesRfq && matchesPo && matchesCreatedBy && matchesCreatedOn && matchesStatus;
  });

  return (
    <div className="purchase-page">
      <div className="purchase-heading">
        <div>
          <h1>Purchase Requests</h1>
          <p>Manage and track all purchase requests</p>
        </div>

        <div className="purchase-search">
          <Search size={12} />
          <input
            placeholder="Search purchase requests..."
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="purchase-stats">
        {stats.map((stat) => (
          <div className={`purchase-stat ${stat.type}`} key={stat.title}>
            <div className="purchase-stat-icon">
              {stat.type === "blue" && "▥"}
              {stat.type === "green" && "✓"}
              {stat.type === "orange" && "♧"}
              {stat.type === "red" && "×"}
            </div>

            <div className="purchase-stat-content">
              <span>{stat.title}</span>
              <strong>{stat.value}</strong>
            </div>

            <div className={`purchase-stat-bars ${stat.type}`}>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>

      <section className="purchase-card">
        <div className="purchase-card-heading">
          <div className="purchase-title">
            <ShoppingCart size={12} />
            Purchase Requests
          </div>

          <div className="purchase-actions">
            <button type="button" className="export-button" aria-label="Export">
              <Download size={12} />
            </button>
            <button type="button" className="create-button">
              <Plus size={12} />
              Create PR
            </button>
          </div>
        </div>

        <div className="pr-filters">
          <div className="filter-field">
            <label>Ref No</label>
            <div className="filter-input">
              <input value={refQuery} onChange={(event) => setRefQuery(event.target.value)} placeholder="Search..." />
            </div>
          </div>

          <div className="filter-field">
            <label>Title</label>
            <div className="filter-input">
              <input value={titleQuery} onChange={(event) => setTitleQuery(event.target.value)} placeholder="Search..." />
            </div>
          </div>

          <div className="filter-field">
            <label>Associated RFQ</label>
            <div className="filter-input">
              <input value={rfqQuery} onChange={(event) => setRfqQuery(event.target.value)} placeholder="Search..." />
            </div>
          </div>

          <div className="filter-field">
            <label>Associated PO</label>
            <div className="filter-input">
              <input value={poQuery} onChange={(event) => setPoQuery(event.target.value)} placeholder="Search..." />
            </div>
          </div>

          <div className="filter-field">
            <label>Created By</label>
            <div className="filter-input">
              <input value={createdByQuery} onChange={(event) => setCreatedByQuery(event.target.value)} placeholder="Search..." />
            </div>
          </div>

          <div className="filter-field">
            <label>Created On</label>
            <div className="filter-input">
              <input
                ref={createdOnDateRef}
                type="date"
                className="pr-hidden-date-input"
                value={createdOnQuery}
                onChange={(event) => setCreatedOnQuery(event.target.value)}
              />
              <input
                readOnly
                placeholder="Select date"
                value={createdOnQuery ? isoToUsDate(createdOnQuery) : ""}
                onClick={() => createdOnDateRef.current?.showPicker?.()}
              />
              <button type="button" className="filter-calendar-btn" onClick={() => createdOnDateRef.current?.showPicker?.()}>
                <CalendarDays size={11} />
              </button>
            </div>
          </div>

          <div className="filter-field">
            <label>Status</label>
            <div className="filter-input">
              <select
                value={statusQuery}
                onChange={(event) => setStatusQuery(event.target.value as (typeof STATUS_OPTIONS)[number])}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <ChevronDown size={11} />
            </div>
          </div>
        </div>

        <div className="purchase-table-wrap">
          <table className="purchase-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ref No</th>
                <th>Title</th>
                <th>Associated RFQ</th>
                <th>Associated PO</th>
                <th>Created By</th>
                <th>Created On</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request, index) => (
                <tr key={request.ref}>
                  <td>{index + 1}</td>
                  <td className="purchase-link" onClick={() => navigate(`/purchase-requests/${request.ref}`)}>{request.ref}</td>
                  <td>{request.title}</td>
                  <td className={request.rfq.startsWith("RFQ-") ? "purchase-link" : "purchase-muted"}>{request.rfq}</td>
                  <td className={request.po.startsWith("PO-") ? "purchase-link" : "purchase-muted"}>{request.po}</td>
                  <td>
                    <span className="creator-pill">
                      <span>{getInitials(request.createdBy)}</span>
                      {request.createdBy}
                    </span>
                  </td>
                  <td>{request.date}</td>
                  <td><StatusBadge status={request.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="purchase-footer">
          <span>Showing <strong>1-{filteredRequests.length}</strong> of <strong>{purchaseRequests.length}</strong> results</span>
          <div className="purchase-pagination">
            <button type="button"><ChevronLeft size={11} /></button>
            <button type="button" className="selected">1</button>
            <button type="button"><ChevronRight size={11} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
