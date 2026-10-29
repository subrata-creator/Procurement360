import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import type {
  Cr49f_procurementapprovalcycles,
} from "../generated/models/Cr49f_procurementapprovalcyclesModel";
import {
  Cr49f_procurementapprovalcyclescr49f_objecttype,
} from "../generated/models/Cr49f_procurementapprovalcyclesModel";
import type {
  Cr49f_taskses,
} from "../generated/models/Cr49f_tasksesModel";
import {
  Cr49f_tasksescr49f_department,
  Cr49f_tasksescr49f_role,
  Cr49f_tasksescr49f_slaunit,
} from "../generated/models/Cr49f_tasksesModel";
import { Cr49f_procurementapprovalcyclesService } from "../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../generated/services/Cr49f_tasksesService";
import ModernSelect, { type ModernSelectOption } from "./ModernSelect";

// Dataverse Picklist options for cr49f_objecttype
const OBJECT_TYPE_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_procurementapprovalcyclescr49f_objecttype
).map(([key, label]) => ({
  value: key,
  label: String(label),
  icon: <Layers size={13} />,
}));

// Dataverse Picklist options for cr49f_department
const DEPARTMENT_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_tasksescr49f_department
).map(([key, label]) => ({
  value: key,
  label: String(label),
  icon: <Briefcase size={13} />,
}));

// Dataverse Picklist options for cr49f_role
const ROLE_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_tasksescr49f_role
).map(([key, label]) => ({
  value: key,
  label: String(label),
  icon: <Shield size={13} />,
}));

// Dataverse Picklist options for cr49f_slaunit
const SLA_UNIT_OPTIONS: ModernSelectOption[] = Object.entries(
  Cr49f_tasksescr49f_slaunit
).map(([key, label]) => ({
  value: key,
  label: String(label),
}));

const STATUS_SELECT_OPTIONS: ModernSelectOption[] = [
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

export interface TaskFormItem {
  cr49f_tasksid?: string;
  cr49f_task: string;
  cr49f_role: number | string;
  cr49f_department: number | string;
  cr49f_sequencenumber: number;
  cr49f_slanumber: number;
  cr49f_slaunit: number | string;
}

interface ApprovalCycleModalProps {
  isOpen: boolean;
  cycle: Cr49f_procurementapprovalcycles | null; // null for Create, object for Edit
  onClose: () => void;
  onSaved: (
    savedCycle: Cr49f_procurementapprovalcycles,
    tasks: Cr49f_taskses[]
  ) => void;
}

export const ApprovalCycleModal: React.FC<ApprovalCycleModalProps> = ({
  isOpen,
  cycle,
  onClose,
  onSaved,
}) => {
  const isEditMode = !!cycle;

  // Form State
  const [objectType, setObjectType] = useState<string>("1");
  const [status, setStatus] = useState<string>("0");

  // Tasks State
  const [tasks, setTasks] = useState<TaskFormItem[]>([]);
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Errors & Submitting
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize cycle & tasks when opening
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setServerError(null);
    setDeletedTaskIds([]);

    if (cycle) {
      setObjectType(String(cycle.cr49f_objecttype ?? "1"));
      setStatus(cycle.statecode === 1 ? "1" : "0");

      // Load tasks associated with this cycle from cr49f_tasks
      setLoadingTasks(true);
      const cycleId = cycle.cr49f_procurementapprovalcycleid;

      const fetchTasks = async () => {
        try {
          let list: Cr49f_taskses[] = [];
          try {
            const res = await Cr49f_tasksesService.getAll({
              filter: `_cr49f_procurementapprovalcycle_value eq '${cycleId}'`,
              orderBy: ["cr49f_sequencenumber asc"],
            });
            if (res.data && res.data.length > 0) {
              list = res.data;
            }
          } catch {
            // fallback to get all
          }

          if (list.length === 0) {
            const allRes = await Cr49f_tasksesService.getAll();
            if (allRes.data) {
              list = allRes.data.filter(
                (t) => t._cr49f_procurementapprovalcycle_value === cycleId
              );
            }
          }

          if (list.length > 0) {
            setTasks(
              list
                .sort((a, b) => (a.cr49f_sequencenumber ?? 0) - (b.cr49f_sequencenumber ?? 0))
                .map((t) => ({
                  cr49f_tasksid: t.cr49f_tasksid,
                  cr49f_task: t.cr49f_task || "",
                  cr49f_role: t.cr49f_role ?? 3,
                  cr49f_department: t.cr49f_department ?? 1,
                  cr49f_sequencenumber: t.cr49f_sequencenumber ?? 1,
                  cr49f_slanumber: t.cr49f_slanumber ?? 24,
                  cr49f_slaunit: t.cr49f_slaunit ?? 1,
                }))
            );
          } else {
            setTasks([]);
          }
        } catch (err) {
          console.error("Failed to load tasks:", err);
          setTasks([]);
        } finally {
          setLoadingTasks(false);
        }
      };

      void fetchTasks();
    } else {
      // Create mode: no status field (default Active: 0)
      setObjectType("1"); // Default: Purchase Request
      setStatus("0");
      setTasks([
        {
          cr49f_task: "",
          cr49f_role: 2, // Procurement Admin
          cr49f_department: 3, // Administrator
          cr49f_sequencenumber: 1,
          cr49f_slanumber: 24,
          cr49f_slaunit: 1, // Hours
        },
        {
          cr49f_task: "",
          cr49f_role: 4, // Procurement Officer
          cr49f_department: 2, // IT
          cr49f_sequencenumber: 2,
          cr49f_slanumber: 48,
          cr49f_slaunit: 1, // Hours
        },
        {
          cr49f_task: "",
          cr49f_role: 3, // Finance Approver
          cr49f_department: 1, // Finance
          cr49f_sequencenumber: 3,
          cr49f_slanumber: 24,
          cr49f_slaunit: 1, // Hours
        },
      ]);
    }
  }, [isOpen, cycle]);

  if (!isOpen) return null;

  const handleAddTask = () => {
    if (tasks.length >= 5) return;
    const nextStep = tasks.length + 1;
    setTasks((prev) => [
      ...prev,
      {
        cr49f_task: "",
        cr49f_role: 2, // Procurement Admin
        cr49f_department: 1, // Finance
        cr49f_sequencenumber: nextStep,
        cr49f_slanumber: 24,
        cr49f_slaunit: 1, // Hours
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    const taskToRemove = tasks[index];
    if (taskToRemove?.cr49f_tasksid) {
      setDeletedTaskIds((prev) => [...prev, taskToRemove.cr49f_tasksid!]);
    }
    setTasks((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((t, idx) => ({ ...t, cr49f_sequencenumber: idx + 1 }))
    );
  };

  const handleMoveTask = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    setTasks((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((t, idx) => ({ ...t, cr49f_sequencenumber: idx + 1 }));
    });
  };

  const handleTaskChange = (
    index: number,
    field: keyof TaskFormItem,
    val: string | number
  ) => {
    setTasks((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, [field]: val } : t))
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!objectType) {
      newErrors.objectType = "Please select the target object.";
    }

    if (tasks.length < 3) {
      newErrors.tasks = "Approval cycle requires a minimum of 3 tasks.";
    } else if (tasks.length > 5) {
      newErrors.tasks = "Approval cycle allows a maximum of 5 tasks.";
    } else {
      const emptyName = tasks.some((t) => !t.cr49f_task.trim());
      if (emptyName) {
        newErrors.tasks = "All tasks must have a task title/action.";
      }
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
      const objectTypeInt = Number(objectType) as keyof typeof Cr49f_procurementapprovalcyclescr49f_objecttype;

      // Status: default Active on create (0), editable on edit mode
      const statecodeVal = isEditMode ? (Number(status) === 1 ? 1 : 0) : 0;
      const statuscodeVal = statecodeVal === 0 ? 1 : 2;

      let savedCycle: Cr49f_procurementapprovalcycles;

      // STEP 1: First create/update cr49f_procurementapprovalcycle in Dataverse
      if (isEditMode && cycle) {
        const updatePayload = {
          cr49f_objecttype: objectTypeInt,
          statecode: statecodeVal as 0 | 1,
          statuscode: statuscodeVal as 1 | 2,
        };

        const updateRes = await Cr49f_procurementapprovalcyclesService.update(
          cycle.cr49f_procurementapprovalcycleid,
          updatePayload
        );

        if (updateRes.error || !updateRes.data) {
          throw new Error(updateRes.error?.message || "Failed to update approval cycle in Dataverse.");
        }
        savedCycle = updateRes.data;
      } else {
        const createPayload = {
          cr49f_objecttype: objectTypeInt,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        const createRes = await Cr49f_procurementapprovalcyclesService.create(createPayload);

        if (createRes.error || !createRes.data) {
          throw new Error(createRes.error?.message || "Failed to create approval cycle in Dataverse.");
        }
        savedCycle = createRes.data;
      }

      const cycleId = savedCycle.cr49f_procurementapprovalcycleid;

      // STEP 2: Delete any removed tasks from Dataverse
      for (const removedId of deletedTaskIds) {
        try {
          await Cr49f_tasksesService.delete(removedId);
        } catch (delErr) {
          console.warn("Failed to delete removed task:", delErr);
        }
      }

      // STEP 3: Save each task on cr49f_tasks with lookup reference to the approval cycle
      const savedTasks: Cr49f_taskses[] = [];
      for (let idx = 0; idx < tasks.length; idx++) {
        const t = tasks[idx];
        const taskPayload = {
          "cr49f_ProcurementApprovalCycle@odata.bind": `/cr49f_procurementapprovalcycles(${cycleId})`,
          cr49f_task: t.cr49f_task.trim(),
          cr49f_role: Number(t.cr49f_role) as keyof typeof Cr49f_tasksescr49f_role,
          cr49f_department: Number(t.cr49f_department) as keyof typeof Cr49f_tasksescr49f_department,
          cr49f_sequencenumber: idx + 1,
          cr49f_slanumber: Number(t.cr49f_slanumber) || 24,
          cr49f_slaunit: Number(t.cr49f_slaunit) as keyof typeof Cr49f_tasksescr49f_slaunit,
          statecode: 0 as const,
          statuscode: 1 as const,
        };

        if (t.cr49f_tasksid) {
          const updated = await Cr49f_tasksesService.update(t.cr49f_tasksid, taskPayload);
          if (updated.data) savedTasks.push(updated.data);
        } else {
          const created = await Cr49f_tasksesService.create(taskPayload);
          if (created.data) savedTasks.push(created.data);
        }
      }

      onSaved(savedCycle, savedTasks);
      onClose();
    } catch (err: unknown) {
      console.error("Error saving approval cycle to Dataverse:", err);
      const msg = err instanceof Error ? err.message : "Failed to save record in Dataverse.";
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
          width: "min(720px, 100%)",
          maxHeight: "min(780px, calc(100dvh - 32px))",
        }}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-heading">
            <div className="admin-modal-icon">
              <Workflow size={18} />
            </div>
            <div>
              <h2>{isEditMode ? "Edit Approval Cycle" : "New Approval Cycle"}</h2>
              <p>Configure target object and approval tasks.</p>
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

            {/* Target Object: uses cr49f_objecttype from cr49f_procurementapprovalcycles */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <Layers size={13} />
                <span>Target Object</span>
                <span className="required">*</span>
              </label>

              <ModernSelect
                placeholder="Select object..."
                value={objectType}
                options={OBJECT_TYPE_OPTIONS}
                onChange={(val) => {
                  setObjectType(val);
                  if (errors.objectType) {
                    setErrors((prev) => ({ ...prev, objectType: "" }));
                  }
                }}
                disabled={isSubmitting}
                error={!!errors.objectType}
                icon={<Layers size={13} />}
              />

              {errors.objectType && (
                <span className="admin-form-error-text">{errors.objectType}</span>
              )}
            </div>

            {/* STATUS FIELD: ONLY DISPLAYED ON EDIT FORM */}
            {isEditMode && (
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <UserCheck size={13} />
                  <span>Status</span>
                </label>
                <ModernSelect
                  placeholder="Select status..."
                  value={status}
                  options={STATUS_SELECT_OPTIONS}
                  onChange={(val) => setStatus(val)}
                  disabled={isSubmitting}
                  placement="auto"
                />
              </div>
            )}

            {/* TASKS CONFIGURATION SECTION (cr49f_tasks) */}
            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--border-hex)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
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
                    <Workflow size={14} style={{ color: "var(--primary-hex)" }} />
                    <span>Approval Tasks</span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--primary-hex) 15%, transparent)",
                        color: "var(--primary-hex)",
                        fontWeight: 700,
                      }}
                    >
                      {tasks.length}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-foreground-hex)" }}>
                    Define sequential approval tasks (minimum 3, maximum 5) with role, department, and SLA duration.
                  </p>
                </div>

                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  style={{ height: 30, padding: "0 10px", fontSize: 11 }}
                  onClick={handleAddTask}
                  disabled={isSubmitting || tasks.length >= 5}
                  title={tasks.length >= 5 ? "Maximum 5 tasks allowed" : "Add Task"}
                >
                  <Plus size={13} />
                  <span>{tasks.length >= 5 ? "Max 5 Tasks" : "Add Task"}</span>
                </button>
              </div>

              {errors.tasks && (
                <span className="admin-form-error-text">{errors.tasks}</span>
              )}

              {loadingTasks ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 0",
                    color: "var(--muted-foreground-hex)",
                    fontSize: 12,
                  }}
                >
                  <Loader2
                    size={16}
                    className="animate-spin"
                    style={{ margin: "0 auto 6px", display: "block" }}
                  />
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    border: "1px dashed var(--border-hex)",
                    borderRadius: 8,
                    color: "var(--muted-foreground-hex)",
                    fontSize: 12,
                  }}
                >
                  <p style={{ margin: 0 }}>No approval tasks added yet.</p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    style={{ height: 28, fontSize: 11, marginTop: 8 }}
                    onClick={handleAddTask}
                  >
                    <Plus size={12} />
                    <span>Add First Task</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tasks.map((task, idx) => (
                    <div key={idx} className="admin-task-card">
                      {/* Task Header: Step Badge + Name Input + Actions */}
                      <div className="admin-task-card-header">
                        <div className="admin-task-card-title">
                          <span className="admin-task-step-badge">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            className="admin-form-input admin-task-name-input"
                            placeholder="Task name / action (e.g. Department Lead Review)"
                            value={task.cr49f_task}
                            onChange={(e) =>
                              handleTaskChange(idx, "cr49f_task", e.target.value)
                            }
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="admin-task-card-actions">
                          <button
                            type="button"
                            className="admin-icon-btn"
                            disabled={idx === 0 || isSubmitting}
                            onClick={() => handleMoveTask(idx, "up")}
                            title="Move step up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn"
                            disabled={idx === tasks.length - 1 || isSubmitting}
                            onClick={() => handleMoveTask(idx, "down")}
                            title="Move step down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn danger"
                            disabled={isSubmitting}
                            onClick={() => handleRemoveTask(idx)}
                            title="Remove task"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Task Body: Role, Department, and SLA Unit */}
                      <div className="admin-task-card-body">
                        {/* Approver Role Dropdown */}
                        <div className="admin-task-field">
                          <label className="admin-task-sublabel">
                            <Shield size={11} />
                            <span>Approver Role</span>
                          </label>
                          <ModernSelect
                            size="sm"
                            placeholder="Select role..."
                            value={String(task.cr49f_role)}
                            options={ROLE_OPTIONS}
                            onChange={(val) =>
                              handleTaskChange(idx, "cr49f_role", val)
                            }
                            placement="auto"
                            disabled={isSubmitting}
                            icon={<Shield size={11} />}
                          />
                        </div>

                        {/* Department Dropdown */}
                        <div className="admin-task-field">
                          <label className="admin-task-sublabel">
                            <Briefcase size={11} />
                            <span>Department</span>
                          </label>
                          <ModernSelect
                            size="sm"
                            placeholder="Select department..."
                            value={String(task.cr49f_department)}
                            options={DEPARTMENT_OPTIONS}
                            onChange={(val) =>
                              handleTaskChange(idx, "cr49f_department", val)
                            }
                            placement="auto"
                            disabled={isSubmitting}
                            icon={<Briefcase size={11} />}
                          />
                        </div>

                        {/* SLA Value + SLA Unit Dropdown */}
                        <div className="admin-task-field">
                          <label className="admin-task-sublabel">
                            <Clock size={11} />
                            <span>SLA Duration</span>
                          </label>
                          <div className="admin-task-sla-group">
                            <input
                              type="number"
                              min="1"
                              className="admin-form-input admin-task-sla-input"
                              placeholder="24"
                              value={task.cr49f_slanumber}
                              onChange={(e) =>
                                handleTaskChange(
                                  idx,
                                  "cr49f_slanumber",
                                  Number(e.target.value) || 1
                                )
                              }
                              disabled={isSubmitting}
                            />
                            <div style={{ flex: 1, minWidth: 90 }}>
                              <ModernSelect
                                size="sm"
                                value={String(task.cr49f_slaunit || "1")}
                                options={SLA_UNIT_OPTIONS}
                                onChange={(val) =>
                                  handleTaskChange(idx, "cr49f_slaunit", val)
                                }
                                placement="auto"
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
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
              ) : (
                <>
                  <Workflow size={14} />
                  <span>{isEditMode ? "Save Changes" : "Create Approval Cycle"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApprovalCycleModal;
