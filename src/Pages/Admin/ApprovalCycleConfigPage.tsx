import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import type {
  Cr49f_procurementapprovalcycles,
} from "../../generated/models/Cr49f_procurementapprovalcyclesModel";
import {
  Cr49f_procurementapprovalcyclescr49f_objecttype,
} from "../../generated/models/Cr49f_procurementapprovalcyclesModel";
import type { Cr49f_taskses } from "../../generated/models/Cr49f_tasksesModel";
import { Cr49f_procurementapprovalcyclesService } from "../../generated/services/Cr49f_procurementapprovalcyclesService";
import { Cr49f_tasksesService } from "../../generated/services/Cr49f_tasksesService";
import ApprovalCycleModal from "../../components/ApprovalCycleModal";
import ModernSelect, { type ModernSelectOption } from "../../components/ModernSelect";
import "../../Styles/AdminPages.css";

const getObjectTypeName = (cycle: Cr49f_procurementapprovalcycles): string => {
  if (cycle.cr49f_objecttypename) return cycle.cr49f_objecttypename;
  if (cycle.cr49f_objecttype && Cr49f_procurementapprovalcyclescr49f_objecttype[cycle.cr49f_objecttype]) {
    return Cr49f_procurementapprovalcyclescr49f_objecttype[cycle.cr49f_objecttype];
  }
  return "—";
};

const ApprovalCycleConfigPage: React.FC = () => {
  const [cycles, setCycles] = useState<Cr49f_procurementapprovalcycles[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObjectFilter, setSelectedObjectFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<Cr49f_procurementapprovalcycles | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCycles = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cycleRes, taskRes] = await Promise.allSettled([
        Cr49f_procurementapprovalcyclesService.getAll(),
        Cr49f_tasksesService.getAll(),
      ]);

      if (cycleRes.status === "fulfilled" && !cycleRes.value.error) {
        setCycles(cycleRes.value.data ?? []);
      } else {
        const errMsg =
          cycleRes.status === "fulfilled"
            ? cycleRes.value.error?.message
            : cycleRes.reason instanceof Error
            ? cycleRes.reason.message
            : "Failed to load approval cycles from Dataverse.";
        setLoadError(errMsg || "Failed to load approval cycles from Dataverse.");
        setCycles([]);
      }

      if (taskRes.status === "fulfilled" && !taskRes.value.error && taskRes.value.data) {
        const counts: Record<string, number> = {};
        for (const t of taskRes.value.data) {
          const cycleId = t._cr49f_procurementapprovalcycle_value;
          if (cycleId) {
            counts[cycleId] = (counts[cycleId] || 0) + 1;
          }
        }
        setTaskCounts(counts);
      }
    } catch (err: unknown) {
      console.error("Failed to load approval cycles:", err);
      const msg = err instanceof Error ? err.message : "Failed to load approval cycles.";
      setLoadError(msg);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCycles();
  }, []);

  const handleOpenCreate = () => {
    setSelectedCycle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cycle: Cr49f_procurementapprovalcycles) => {
    setSelectedCycle(cycle);
    setIsModalOpen(true);
  };

  const handleSavedCycle = (
    savedCycle: Cr49f_procurementapprovalcycles,
    savedTasks: Cr49f_taskses[] = []
  ) => {
    setCycles((prev) => {
      const exists = prev.some(
        (c) => c.cr49f_procurementapprovalcycleid === savedCycle.cr49f_procurementapprovalcycleid
      );
      if (exists) {
        return prev.map((c) =>
          c.cr49f_procurementapprovalcycleid === savedCycle.cr49f_procurementapprovalcycleid
            ? savedCycle
            : c
        );
      }
      return [savedCycle, ...prev];
    });

    if (savedCycle.cr49f_procurementapprovalcycleid) {
      setTaskCounts((prev) => ({
        ...prev,
        [savedCycle.cr49f_procurementapprovalcycleid]: savedTasks.length,
      }));
    }

    const cycleObjName = getObjectTypeName(savedCycle);
    setToastMessage(
      `Approval cycle for "${cycleObjName}" has been successfully saved!`
    );
  };

  // Distinct objects present in Dataverse records
  const distinctObjects = useMemo(() => {
    const set = new Set<string>();
    cycles.forEach((c) => {
      const name = getObjectTypeName(c);
      if (name && name !== "—") set.add(name);
    });
    return Array.from(set);
  }, [cycles]);

  // Object filter options derived dynamically from Dataverse records
  const objectFilterOptions = useMemo<ModernSelectOption[]>(() => {
    return [
      {
        value: "ALL",
        label: `All Objects (${distinctObjects.length})`,
        icon: <Layers size={12} />,
      },
      ...distinctObjects.map((obj) => ({
        value: obj,
        label: obj,
        icon: <Layers size={12} />,
      })),
    ];
  }, [distinctObjects]);

  const statusFilterOptions: ModernSelectOption[] = [
    { value: "ALL", label: "All Statuses" },
    {
      value: "ACTIVE",
      label: "Active Only",
      icon: <CheckCircle2 size={12} style={{ color: "#16a34a" }} />,
    },
    {
      value: "INACTIVE",
      label: "Inactive Only",
      icon: <XCircle size={12} style={{ color: "#ef4444" }} />,
    },
  ];

  // Filtered Cycles
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const objName = getObjectTypeName(c).toLowerCase();

      const matchesSearch = !q || objName.includes(q);

      if (!matchesSearch) return false;

      // Object filter
      if (selectedObjectFilter !== "ALL") {
        if (getObjectTypeName(c) !== selectedObjectFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        const isActive = c.statecode === 0;
        if (selectedStatusFilter === "ACTIVE" && !isActive) return false;
        if (selectedStatusFilter === "INACTIVE" && isActive) return false;
      }

      return true;
    });
  }, [cycles, searchQuery, selectedObjectFilter, selectedStatusFilter]);

  // Statistics
  const totalCycles = cycles.length;
  const activeCycles = cycles.filter((c) => c.statecode === 0).length;
  const configuredObjectsCount = distinctObjects.length;

  return (
    <div className="admin-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          <div className="admin-toast-content">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            className="admin-toast-close"
            onClick={() => setToastMessage(null)}
            title="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">
            <Workflow size={14} />
            <span>ADMINISTRATION</span>
          </div>
          <h1 className="admin-title">Approval Cycle Configuration</h1>
          <p className="admin-subtitle">
            Configure target procurement objects and approval tasks.
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchCycles}
            title="Refresh approval cycles from Dataverse"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>New Approval Cycle</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <Workflow size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Cycles</span>
            <strong className="admin-stat-value">{totalCycles}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <CheckCircle2 size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Cycles</span>
            <strong className="admin-stat-value">{activeCycles}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <Layers size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Objects Configured</span>
            <strong className="admin-stat-value">{configuredObjectsCount}</strong>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="admin-card">
        <div className="admin-toolbar">
          <div className="admin-search-wrap">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by object..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-toolbar-filters">
            {/* Object Filter (Dynamic from Dataverse) */}
            <ModernSelect
              size="sm"
              style={{ width: 190 }}
              value={selectedObjectFilter}
              options={objectFilterOptions}
              onChange={(val) => setSelectedObjectFilter(val)}
              title="Filter by Object"
              icon={<Layers size={12} />}
            />

            {/* Status Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 145 }}
              value={selectedStatusFilter}
              options={statusFilterOptions}
              onChange={(val) => setSelectedStatusFilter(val)}
              title="Filter by Status"
            />
          </div>
        </div>

        {/* ERROR STATE */}
        {loadError && (
          <div style={{ padding: "16px 20px" }}>
            <div className="admin-banner-error">
              <AlertCircle size={16} className="flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <strong>Unable to retrieve approval cycles:</strong> {loadError}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ height: 28, fontSize: 11 }}
                onClick={fetchCycles}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* OVERVIEW TABLE: OBJECT, TASKS, STATUS, ACTION TO EDIT */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Tasks</th>
                <th>Status</th>
                <th style={{ width: 90, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    <RefreshCw
                      size={18}
                      className="animate-spin"
                      style={{ margin: "0 auto 8px", display: "block" }}
                    />
                    Loading approval cycles from Dataverse...
                  </td>
                </tr>
              ) : filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    {searchQuery ||
                    selectedObjectFilter !== "ALL" ||
                    selectedStatusFilter !== "ALL" ? (
                      <div>
                        <p>No approval cycles matched your filters.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ margin: "8px auto 0" }}
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedObjectFilter("ALL");
                            setSelectedStatusFilter("ALL");
                          }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p>No approval cycles found in Dataverse.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary"
                          style={{ margin: "8px auto 0" }}
                          onClick={handleOpenCreate}
                        >
                          <Plus size={14} />
                          <span>Add First Approval Cycle</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCycles.map((c) => {
                  const count = taskCounts[c.cr49f_procurementapprovalcycleid] ?? 0;
                  return (
                    <tr key={c.cr49f_procurementapprovalcycleid}>
                      {/* OBJECT */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: "color-mix(in srgb, var(--primary-hex) 12%, transparent)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Layers size={13} style={{ color: "var(--primary-hex)" }} />
                          </span>
                          <strong style={{ fontSize: 13 }}>
                            {getObjectTypeName(c)}
                          </strong>
                        </div>
                      </td>

                      {/* TASKS COUNT */}
                      <td>
                        <span className="admin-tasks-badge">
                          <Workflow size={11} />
                          <span>
                            {count} {count === 1 ? "Task" : "Tasks"}
                          </span>
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span
                          className={`admin-status-pill ${
                            c.statecode === 0 ? "active" : "inactive"
                          }`}
                        >
                          {c.statecode === 0 ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="admin-edit-btn"
                          onClick={() => handleOpenEdit(c)}
                          title={`Edit ${getObjectTypeName(c)} cycle`}
                        >
                          <Pencil size={12} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE & EDIT APPROVAL CYCLE MODAL */}
      <ApprovalCycleModal
        isOpen={isModalOpen}
        cycle={selectedCycle}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCycle(null);
        }}
        onSaved={handleSavedCycle}
      />
    </div>
  );
};

export default ApprovalCycleConfigPage;
