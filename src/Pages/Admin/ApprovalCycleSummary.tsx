import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Workflow,
  XCircle,
} from "lucide-react";

import type {
  Cr49f_procurementapprovalcycles,
} from "../../generated/models/Cr49f_procurementapprovalcyclesModel";
import {
  Cr49f_procurementapprovalcyclescr49f_objecttype,
} from "../../generated/models/Cr49f_procurementapprovalcyclesModel";
import type { Cr49f_taskses } from "../../generated/models/Cr49f_tasksesModel";
import {
  Cr49f_tasksescr49f_department,
  Cr49f_tasksescr49f_role,
  Cr49f_tasksescr49f_slaunit,
} from "../../generated/models/Cr49f_tasksesModel";
import { Cr49f_procurementapprovalcyclesService } from "../../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../../generated/services/Cr49f_tasksesService";
import { Cr49f_approvaltasksesService } from "../../generated/services/Cr49f_approvaltasksesService";
import type { Cr49f_approvaltaskses } from "../../generated/models/Cr49f_approvaltasksesModel";
import ApprovalCycleModal from "../../components/ApprovalCycleModal";
import { cleanGuid } from "../../Services/ApprovalWorkflowService";
import "../../Styles/ApprovalCycleSummary.css";

const getObjectTypeName = (cycle: Cr49f_procurementapprovalcycles): string => {
  if (cycle.cr49f_objecttypename) return cycle.cr49f_objecttypename;
  if (
    cycle.cr49f_objecttype &&
    Cr49f_procurementapprovalcyclescr49f_objecttype[cycle.cr49f_objecttype]
  ) {
    return Cr49f_procurementapprovalcyclescr49f_objecttype[cycle.cr49f_objecttype];
  }
  return "Procurement Object";
};

const getDepartmentLabel = (code?: number): string => {
  if (code && Cr49f_tasksescr49f_department[code as keyof typeof Cr49f_tasksescr49f_department]) {
    return Cr49f_tasksescr49f_department[code as keyof typeof Cr49f_tasksescr49f_department];
  }
  return "General";
};

const getRoleLabel = (code?: number): string => {
  if (code && Cr49f_tasksescr49f_role[code as keyof typeof Cr49f_tasksescr49f_role]) {
    return Cr49f_tasksescr49f_role[code as keyof typeof Cr49f_tasksescr49f_role];
  }
  return "Approver";
};

const getSlaUnitLabel = (code?: number): string => {
  if (code && Cr49f_tasksescr49f_slaunit[code as keyof typeof Cr49f_tasksescr49f_slaunit]) {
    return Cr49f_tasksescr49f_slaunit[code as keyof typeof Cr49f_tasksescr49f_slaunit];
  }
  return "Hours";
};

const formatCurrency = (val?: number | null): string => {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
};

export const ApprovalCycleSummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<Cr49f_procurementapprovalcycles | null>(null);
  const [tasks, setTasks] = useState<Cr49f_taskses[]>([]);
  const [executions, setExecutions] = useState<Cr49f_approvaltaskses[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"steps" | "executions" | "governance">("steps");
  const [stepSearch, setStepSearch] = useState("");
  const [executionSearch, setExecutionSearch] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    try {
      const cycleCleanId = cleanGuid(id).toLowerCase();

      // Fetch cycles and tasks in parallel
      const [cycleRes, tasksRes, executionsRes] = await Promise.allSettled([
        Cr49f_procurementapprovalcyclesService.getAll(),
        Cr49f_tasksesService.getAll(),
        Cr49f_approvaltasksesService.getAll(),
      ]);

      let matchedCycle: Cr49f_procurementapprovalcycles | null = null;
      if (cycleRes.status === "fulfilled" && cycleRes.value?.data) {
        matchedCycle =
          cycleRes.value.data.find(
            (c) =>
              cleanGuid(c.cr49f_procurementapprovalcycleid).toLowerCase() === cycleCleanId ||
              (c.cr49f_id && c.cr49f_id.toLowerCase() === id.toLowerCase())
          ) ?? null;
      }

      if (!matchedCycle) {
        setCycle(null);
        setTasks([]);
        setExecutions([]);
        setLoading(false);
        return;
      }

      setCycle(matchedCycle);

      // Filter tasks associated with this cycle
      const currentCycleId = cleanGuid(matchedCycle.cr49f_procurementapprovalcycleid).toLowerCase();
      let matchedTasks: Cr49f_taskses[] = [];

      if (tasksRes.status === "fulfilled" && tasksRes.value?.data) {
        matchedTasks = tasksRes.value.data.filter((t) => {
          const raw = t as unknown as Record<string, unknown>;
          const parentVal =
            cleanGuid(t._cr49f_procurementapprovalcycle_value) ||
            cleanGuid(raw._cr49f_ProcurementApprovalCycle_value as string) ||
            cleanGuid(raw["_cr49f_procurementapprovalcycle_value@odata.bind"] as string);
          return parentVal.toLowerCase() === currentCycleId;
        });

        // Sort ascending by sequence number
        matchedTasks.sort((a, b) => (a.cr49f_sequencenumber ?? 0) - (b.cr49f_sequencenumber ?? 0));
      }

      setTasks(matchedTasks);

      // Match executions for this object type
      if (executionsRes.status === "fulfilled" && executionsRes.value?.data) {
        const objectTypeNum = matchedCycle.cr49f_objecttype;
        const matchingExecutions = executionsRes.value.data.filter((e) => {
          if (objectTypeNum != null && e.cr49f_object === objectTypeNum) return true;
          // Also match PR or RFQ lookups if object type matches
          if (objectTypeNum === 1 && e._cr49f_pr_value) return true;
          if (objectTypeNum === 2 && e._cr49f_rfq_value) return true;
          return false;
        });
        setExecutions(matchingExecutions);
      } else {
        setExecutions([]);
      }
    } catch (err: unknown) {
      console.error("Failed to load approval cycle details:", err);
      const msg = err instanceof Error ? err.message : "Failed to load approval cycle details.";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  // Filtered steps
  const filteredSteps = useMemo(() => {
    if (!stepSearch.trim()) return tasks;
    const q = stepSearch.toLowerCase();
    return tasks.filter(
      (t) =>
        t.cr49f_task?.toLowerCase().includes(q) ||
        getDepartmentLabel(t.cr49f_department).toLowerCase().includes(q) ||
        getRoleLabel(t.cr49f_role).toLowerCase().includes(q) ||
        String(t.cr49f_sequencenumber).includes(q)
    );
  }, [tasks, stepSearch]);

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    if (!executionSearch.trim()) return executions;
    const q = executionSearch.toLowerCase();
    return executions.filter(
      (e) =>
        e.cr49f_task?.toLowerCase().includes(q) ||
        e.cr49f_id?.toLowerCase().includes(q) ||
        e.cr49f_rolename?.toLowerCase().includes(q) ||
        e.cr49f_departmentname?.toLowerCase().includes(q)
    );
  }, [executions, executionSearch]);

  if (loading) {
    return (
      <div className="cycle-detail-page">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, color: "var(--muted-foreground-hex)" }}>
          <RefreshCw size={18} className="animate-spin" />
          <span>Loading approval cycle details...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="cycle-detail-page">
        <div className="cycle-detail-notfound">
          <AlertCircle size={40} style={{ color: "#ef4444", marginBottom: 12 }} />
          <h2>Unable to Load Cycle</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className="cycle-detail-back-btn"
            style={{ marginTop: 16 }}
            onClick={() => void loadData()}
          >
            <RefreshCw size={14} /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="cycle-detail-page">
        <div className="cycle-detail-notfound">
          <Workflow size={48} style={{ color: "var(--muted-foreground-hex)", marginBottom: 12 }} />
          <h2>Approval Cycle Not Found</h2>
          <p>
            No approval cycle exists matching ID &quot;{id}&quot;. It may have been removed or reconfigured.
          </p>
          <button
            type="button"
            className="cycle-detail-back-btn"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/approval-cycle-configuration")}
          >
            <ArrowLeft size={14} /> Back to Approval Cycles
          </button>
        </div>
      </div>
    );
  }

  const objName = getObjectTypeName(cycle);
  const isActive = cycle.statecode === 0;

  return (
    <main className="cycle-detail-page">
      {/* HEADER SECTION */}
      <header className="cycle-detail-header">
        <div className="cycle-detail-header-left">
          <button
            type="button"
            className="cycle-detail-back-btn"
            onClick={() => navigate("/approval-cycle-configuration")}
          >
            <ArrowLeft size={14} />
            <span>All Approval Cycles</span>
          </button>

          <div className="cycle-detail-title-row">
            <h1>{objName} Approval Cycle</h1>
            <span className="cycle-object-badge">
              <Layers size={12} />
              <span>{objName}</span>
            </span>
            <span className={`cycle-status-pill ${isActive ? "active" : "inactive"}`}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <p className="cycle-detail-subtitle">
            {`Configured governance workflow and sequential approval stages for ${objName}.`}
          </p>
        </div>

        <div className="cycle-detail-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => void loadData()}
            title="Refresh details from Dataverse"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Pencil size={14} />
            <span>Edit Workflow</span>
          </button>
        </div>
      </header>

      {/* KPI METRIC CARDS */}
      <section className="cycle-kpi-grid">
        {/* KPI 1: Target Object */}
        <div className="cycle-kpi-card">
          <div className="cycle-kpi-icon indigo">
            <Layers size={18} />
          </div>
          <div className="cycle-kpi-content">
            <span className="cycle-kpi-label">Target Object</span>
            <strong className="cycle-kpi-val">{objName}</strong>
          </div>
        </div>

        {/* KPI 2: Total Steps */}
        <div className="cycle-kpi-card">
          <div className="cycle-kpi-icon purple">
            <Workflow size={18} />
          </div>
          <div className="cycle-kpi-content">
            <span className="cycle-kpi-label">Configured Steps</span>
            <strong className="cycle-kpi-val">
              {tasks.length} {tasks.length === 1 ? "Stage Gate" : "Stage Gates"}
            </strong>
          </div>
        </div>

        {/* KPI 3: Threshold Limits */}
        <div className="cycle-kpi-card">
          <div className="cycle-kpi-icon emerald">
            <DollarSign size={18} />
          </div>
          <div className="cycle-kpi-content">
            <span className="cycle-kpi-label">Amount Thresholds</span>
            <strong className="cycle-kpi-val">
              {cycle.cr49f_minamount != null || cycle.cr49f_maxamount != null
                ? `${formatCurrency(cycle.cr49f_minamount)} — ${
                    cycle.cr49f_maxamount ? formatCurrency(cycle.cr49f_maxamount) : "No Limit"
                  }`
                : "All Amounts"}
            </strong>
          </div>
        </div>

        {/* KPI 4: Live Executions */}
        <div className="cycle-kpi-card">
          <div className="cycle-kpi-icon blue">
            <ShieldCheck size={18} />
          </div>
          <div className="cycle-kpi-content">
            <span className="cycle-kpi-label">Enforced Executions</span>
            <strong className="cycle-kpi-val">{executions.length} Tasks</strong>
          </div>
        </div>
      </section>

      {/* VISUAL SEQUENTIAL STEPPER */}
      <section className="cycle-stepper-card">
        <div className="cycle-stepper-title">
          <Workflow size={16} style={{ color: "var(--primary-hex)" }} />
          <div>
            <strong>Stage-Gate Authorization Flow</strong>
            <span style={{ fontSize: 12, color: "var(--muted-foreground-hex)", marginLeft: 8 }}>
              Sequential approval progression enforced when this cycle triggers
            </span>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              background: "var(--background-hex)",
              borderRadius: 8,
              border: "1px dashed var(--border-hex)",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted-foreground-hex)" }}>
              No approval task steps configured for this cycle yet.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Plus size={13} />
              <span>Configure Steps</span>
            </button>
          </div>
        ) : (
          <div className="cycle-stepper-track">
            {tasks.map((task, idx) => {
              const seq = task.cr49f_sequencenumber ?? idx + 1;
              const deptLabel = getDepartmentLabel(task.cr49f_department);
              const roleLabel = getRoleLabel(task.cr49f_role);
              const slaDuration = task.cr49f_slanumber ?? 24;
              const slaUnit = getSlaUnitLabel(task.cr49f_slaunit);

              return (
                <React.Fragment key={task.cr49f_tasksid || idx}>
                  <div className="cycle-stepper-node">
                    <div className="cycle-node-bubble">
                      <span className="cycle-node-seq">Step #{seq}</span>
                      <strong className="cycle-node-title" title={task.cr49f_task || "Step"}>
                        {task.cr49f_task || `Step ${seq}`}
                      </strong>

                      <div className="cycle-node-role">
                        <UserCheck size={11} />
                        <span>{roleLabel}</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <Briefcase size={11} />
                        <span>{deptLabel}</span>
                      </div>

                      <div className="cycle-node-sla">
                        <Clock size={11} />
                        <span>
                          SLA: {slaDuration} {slaUnit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {idx < tasks.length - 1 && (
                    <div className="cycle-stepper-arrow" aria-hidden="true">
                      <ChevronRight size={20} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* TAB NAVIGATION */}
      <div className="cycle-detail-tabs">
        <button
          type="button"
          className={`cycle-tab-btn ${activeTab === "steps" ? "active" : ""}`}
          onClick={() => setActiveTab("steps")}
        >
          <Workflow size={14} />
          <span>Configured Steps ({tasks.length})</span>
        </button>

        <button
          type="button"
          className={`cycle-tab-btn ${activeTab === "executions" ? "active" : ""}`}
          onClick={() => setActiveTab("executions")}
        >
          <ShieldCheck size={14} />
          <span>Live Executions ({executions.length})</span>
        </button>

        <button
          type="button"
          className={`cycle-tab-btn ${activeTab === "governance" ? "active" : ""}`}
          onClick={() => setActiveTab("governance")}
        >
          <Info size={14} />
          <span>Governance &amp; Limits</span>
        </button>
      </div>

      {/* TAB 1: CONFIGURED STEPS TABLE */}
      {activeTab === "steps" && (
        <section className="cycle-table-card">
          <div className="cycle-table-header">
            <h3>Configured Workflow Tasks ({filteredSteps.length})</h3>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="admin-search-wrapper" style={{ width: 220 }}>
                <Search size={13} className="admin-search-icon" />
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Filter steps..."
                  value={stepSearch}
                  onChange={(e) => setStepSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Pencil size={12} />
                <span>Modify Steps</span>
              </button>
            </div>
          </div>

          <div className="cycle-table-wrapper">
            <table className="cycle-data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Seq</th>
                  <th>Task Title</th>
                  <th>Department</th>
                  <th>Assigned Role</th>
                  <th>SLA Window</th>
                  <th>Mandatory</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSteps.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                      No workflow steps match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredSteps.map((t, idx) => {
                    const seq = t.cr49f_sequencenumber ?? idx + 1;
                    const dept = getDepartmentLabel(t.cr49f_department);
                    const role = getRoleLabel(t.cr49f_role);
                    const slaDuration = t.cr49f_slanumber ?? 24;
                    const slaUnit = getSlaUnitLabel(t.cr49f_slaunit);

                    return (
                      <tr key={t.cr49f_tasksid || idx}>
                        <td>
                          <span className="cycle-step-seq-pill">#{seq}</span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13, color: "var(--foreground-hex)" }}>
                            {t.cr49f_task || "Untitled Step"}
                          </strong>
                        </td>
                        <td>
                          <span className="cycle-dept-pill">
                            <Briefcase size={11} />
                            <span>{dept}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <UserCheck size={12} style={{ color: "var(--primary-hex)" }} />
                            <span>{role}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <Clock size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                            <span>
                              {slaDuration} {slaUnit}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: "#0284c7", fontWeight: 600, fontSize: 11.5 }}>
                            Required
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-status-pill ${
                              t.statecode === 0 ? "active" : "inactive"
                            }`}
                          >
                            {t.statecode === 0 ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: LIVE EXECUTIONS TABLE */}
      {activeTab === "executions" && (
        <section className="cycle-table-card">
          <div className="cycle-table-header">
            <h3>Live Approvals Enforced on {objName} ({filteredExecutions.length})</h3>

            <div className="admin-search-wrapper" style={{ width: 240 }}>
              <Search size={13} className="admin-search-icon" />
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search executions..."
                value={executionSearch}
                onChange={(e) => setExecutionSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="cycle-table-wrapper">
            <table className="cycle-data-table">
              <thead>
                <tr>
                  <th>Task Ref</th>
                  <th>Target Object</th>
                  <th>Step Title</th>
                  <th>Department &amp; Role</th>
                  <th>Status</th>
                  <th>Created On</th>
                </tr>
              </thead>
              <tbody>
                {filteredExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                      No live executions found for this workflow cycle yet.
                    </td>
                  </tr>
                ) : (
                  filteredExecutions.map((e) => {
                    const statusVal = e.cr49f_approvalstatus;
                    const statusText =
                      statusVal === 1
                        ? "Approved"
                        : statusVal === 2
                        ? "Rejected"
                        : "Pending";
                    const statusBadgeClass =
                      statusVal === 1
                        ? "active"
                        : statusVal === 2
                        ? "inactive"
                        : "pending";

                    return (
                      <tr key={e.cr49f_approvaltasksid}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>
                            {e.cr49f_id || e.cr49f_approvaltasksid.slice(0, 8)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <FileText size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                            <span>
                              {e._cr49f_pr_value
                                ? `PR Record`
                                : e._cr49f_rfq_value
                                ? `RFQ Record`
                                : objName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: 12.5 }}>{e.cr49f_task || "Approval Step"}</strong>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground-hex)" }}>
                            {[e.cr49f_rolename, e.cr49f_departmentname].filter(Boolean).join(" · ") ||
                              "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${statusBadgeClass}`}>
                            {statusVal === 1 ? (
                              <CheckCircle2 size={11} style={{ marginRight: 3 }} />
                            ) : statusVal === 2 ? (
                              <XCircle size={11} style={{ marginRight: 3 }} />
                            ) : (
                              <Clock size={11} style={{ marginRight: 3 }} />
                            )}
                            {statusText}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground-hex)" }}>
                            {formatDate(e.createdon)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: GOVERNANCE & METADATA */}
      {activeTab === "governance" && (
        <section className="cycle-table-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>
            Cycle Governance &amp; Configuration Parameters
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Target Object Type
              </div>
              <strong style={{ fontSize: 14, marginTop: 4, display: "block" }}>{objName}</strong>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Cycle Reference Code
              </div>
              <strong style={{ fontSize: 14, marginTop: 4, display: "block" }}>
                {cycle.cr49f_id || "CYC-DEFAULT"}
              </strong>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Minimum Threshold Limit
              </div>
              <strong style={{ fontSize: 14, marginTop: 4, display: "block" }}>
                {formatCurrency(cycle.cr49f_minamount)}
              </strong>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Maximum Threshold Limit
              </div>
              <strong style={{ fontSize: 14, marginTop: 4, display: "block" }}>
                {cycle.cr49f_maxamount ? formatCurrency(cycle.cr49f_maxamount) : "No Maximum Limit"}
              </strong>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                System Dataverse GUID
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", marginTop: 4, display: "block" }}>
                {cycle.cr49f_procurementapprovalcycleid}
              </span>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Status &amp; Enforcement
              </div>
              <strong style={{ fontSize: 14, marginTop: 4, display: "block", color: isActive ? "#16a34a" : "#dc2626" }}>
                {isActive ? "Active & Enforced" : "Inactive / Draft"}
              </strong>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Created On
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Calendar size={13} style={{ color: "var(--muted-foreground-hex)" }} />
                <span>{formatDate(cycle.createdon)}</span>
              </div>
            </div>

            <div style={{ background: "var(--background-hex)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#64748b", fontWeight: 600 }}>
                Last Modified
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Calendar size={13} style={{ color: "var(--muted-foreground-hex)" }} />
                <span>{formatDate(cycle.modifiedon)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Workflow Description</h4>
            <p style={{ fontSize: 13, color: "var(--muted-foreground-hex)", lineHeight: 1.6, margin: 0 }}>
              {`Configured stage-gate authorization flow for ${objName}. Tasks trigger sequentially in increasing sequence order.`}
            </p>
          </div>
        </section>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <ApprovalCycleModal
          isOpen={isEditModalOpen}
          cycle={cycle}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(savedCycle, savedTasks) => {
            setCycle(savedCycle);
            if (savedTasks) {
              setTasks(savedTasks);
            }
            setIsEditModalOpen(false);
          }}
        />
      )}
    </main>
  );
};

export default ApprovalCycleSummary;
