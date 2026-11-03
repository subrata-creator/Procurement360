import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Clock,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Workflow,
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

export const ApprovalCycleSummary: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<Cr49f_procurementapprovalcycles | null>(null);
  const [tasks, setTasks] = useState<Cr49f_taskses[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepSearch, setStepSearch] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);

    try {
      const cycleCleanId = cleanGuid(id).toLowerCase();

      // Fetch cycles and tasks in parallel
      const [cycleRes, tasksRes] = await Promise.allSettled([
        Cr49f_procurementapprovalcyclesService.getAll(),
        Cr49f_tasksesService.getAll(),
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
            className="admin-btn admin-btn-secondary"
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
            className="admin-btn admin-btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/approval-cycle-configuration")}
          >
            <ArrowLeft size={14} /> Back to All Cycles
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
            title="Back to All Approval Cycles"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="cycle-detail-title-col">
            <div className="cycle-detail-title-row">
              <h1>{objName} Approval Cycle</h1>
              <span className="cycle-object-badge">
                <Layers size={12} />
                <span>{objName}</span>
              </span>
              <span className={`cycle-status-pill ${isActive ? "active" : "inactive"}`}>
                <span className="cycle-status-dot" />
                <span>{isActive ? "Active" : "Inactive"}</span>
              </span>
            </div>
          </div>
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
      </section>

      {/* VISUAL SEQUENTIAL STEPPER */}
      <section className="cycle-stepper-card">
        <div className="cycle-stepper-header">
          <div className="cycle-stepper-title-group">
            <div className="cycle-stepper-icon-bubble">
              <Workflow size={16} />
            </div>
            <div>
              <h3>Stage-Gate Authorization Flow</h3>
              <p>Sequential approval progression enforced when this cycle triggers</p>
            </div>
          </div>

          {tasks.length > 0 && (
            <span className="cycle-stepper-badge">
              Enforced in Order (1 → {tasks.length})
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <div
            style={{
              padding: "36px 16px",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1.5px dashed #cbd5e1",
            }}
          >
            <Workflow size={28} style={{ color: "#94a3b8", margin: "0 auto 8px", display: "block" }} />
            <strong style={{ fontSize: 13.5, display: "block", marginBottom: 4 }}>
              No Approval Steps Configured
            </strong>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted-foreground-hex)" }}>
              Add sequential authorization tasks for this cycle to activate the workflow.
            </p>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              style={{ margin: "0 auto" }}
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
                  <div className="cycle-step-card">
                    <div className="cycle-step-card-top">
                      <span className="cycle-step-stage-tag">Step #{seq}</span>
                      <span className="cycle-step-sla-tag">
                        <Clock size={11} />
                        <span>
                          {slaDuration} {slaUnit}
                        </span>
                      </span>
                    </div>

                    <h4 className="cycle-step-title" title={task.cr49f_task || `Step ${seq}`}>
                      {task.cr49f_task || `Step ${seq}`}
                    </h4>

                    <div className="cycle-step-meta-row">
                      <span className="cycle-step-meta-pill">
                        <UserCheck size={11} />
                        <span>{roleLabel}</span>
                      </span>
                      <span className="cycle-step-meta-pill">
                        <Briefcase size={11} />
                        <span>{deptLabel}</span>
                      </span>
                    </div>
                  </div>

                  {idx < tasks.length - 1 && (
                    <div className="cycle-step-connector" aria-hidden="true">
                      <ChevronRight size={15} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* CONFIGURED WORKFLOW TASKS TABLE CARD */}
      <section className="cycle-table-card">
        <div className="cycle-table-header">
          <div className="cycle-table-title-group">
            <h3>Configured Workflow Tasks ({filteredSteps.length})</h3>
            <p>Sequential authorization stages required for {objName} approval sign-off</p>
          </div>

          <div className="cycle-table-actions">
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
                <th style={{ width: 70, textAlign: "center" }}>Seq</th>
                <th>Task Title</th>
                <th>Department</th>
                <th>Assigned Role</th>
                <th>SLA Window</th>
                <th>Requirement</th>
                <th style={{ width: 100 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSteps.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#64748b" }}>
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
                      <td style={{ textAlign: "center" }}>
                        <span className="cycle-seq-badge">#{seq}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: "var(--foreground-hex)" }}>
                          {t.cr49f_task || "Untitled Step"}
                        </strong>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                          <Briefcase size={12} style={{ color: "var(--muted-foreground-hex)" }} />
                          <span>{dept}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
                          <UserCheck size={12} style={{ color: "var(--primary-hex)" }} />
                          <span style={{ fontWeight: 600 }}>{role}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <Clock size={12} style={{ color: "#059669" }} />
                          <span>
                            {slaDuration} {slaUnit}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="cycle-req-tag">Required</span>
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
