import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users as UsersIcon,
  X,
  XCircle,
} from "lucide-react";
import { Cr49f_usersesService } from "../../generated/services/Cr49f_usersesService";
import type { Cr49f_userses } from "../../generated/models/Cr49f_usersesModel";
import AddUserModal, {
  DEPARTMENT_SELECT_OPTIONS,
  ROLE_SELECT_OPTIONS,
} from "../../components/AddUserModal";
import EditUserModal from "../../components/EditUserModal";
import ModernSelect, { type ModernSelectOption } from "../../components/ModernSelect";
import "../../Styles/AdminPages.css";

const roleDisplayMap: Record<number, { label: string; className: string }> = {
  1: { label: "Requester", className: "requester" },
  2: { label: "Procurement Admin", className: "procurementadmin" },
  3: { label: "Finance Approver", className: "financeapprover" },
  4: { label: "Procurement Officer", className: "procurementofficer" },
};

const deptDisplayMap: Record<number, { label: string; className: string }> = {
  1: { label: "Finance", className: "finance" },
  2: { label: "IT", className: "it" },
  3: { label: "Administrator", className: "administrator" },
  4: { label: "HR", className: "hr" },
};

export const getDepartmentInfo = (user: Cr49f_userses) => {
  const deptVal = Number(user.cr49f_department);
  if (deptDisplayMap[deptVal]) {
    return deptDisplayMap[deptVal];
  }
  if (user.cr49f_departmentname) {
    const key = user.cr49f_departmentname.toLowerCase();
    let className = "";
    if (key.includes("fin")) className = "finance";
    else if (key.includes("it")) className = "it";
    else if (key.includes("hr")) className = "hr";
    else if (key.includes("admin")) className = "administrator";

    return {
      label: user.cr49f_departmentname,
      className,
    };
  }
  return { label: "Unassigned", className: "" };
};

export const getRoleInfo = (user: Cr49f_userses) => {
  const roleVal = Number(user.cr49f_role);
  if (roleDisplayMap[roleVal]) {
    return roleDisplayMap[roleVal];
  }
  if (user.cr49f_rolename) {
    const key = user.cr49f_rolename.toLowerCase();
    let className = "requester";
    if (key.includes("admin")) className = "procurementadmin";
    else if (key.includes("approv")) className = "financeapprover";
    else if (key.includes("officer")) className = "procurementofficer";

    return {
      label: user.cr49f_rolename,
      className,
    };
  }
  return { label: "Unassigned", className: "requester" };
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<Cr49f_userses[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Add User Modal & Notifications
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit User Modal State
  const [userToEdit, setUserToEdit] = useState<Cr49f_userses | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await Cr49f_usersesService.getAll();
      if (res.error) {
        setLoadError(res.error.message || "Failed to load users from Dataverse.");
      } else if (res.data) {
        setUsers(res.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load users from cr49f_users:", err);
      const msg = err instanceof Error ? err.message : "Failed to load users.";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const handleUserAdded = (newUser: Cr49f_userses) => {
    setUsers((prev) => [newUser, ...prev]);
    setToastMessage(`User "${newUser.cr49f_name || newUser.cr49f_email}" was added successfully!`);
  };

  const handleOpenEdit = (user: Cr49f_userses) => {
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };

  const handleUserUpdated = (updatedUser: Cr49f_userses) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.cr49f_usersid === updatedUser.cr49f_usersid ? updatedUser : u
      )
    );
    setToastMessage(
      `User "${updatedUser.cr49f_name || updatedUser.cr49f_email}" was updated successfully!`
    );
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const name = (u.cr49f_name ?? "").toLowerCase();
      const email = (u.cr49f_email ?? "").toLowerCase();
      const userId = (u.cr49f_userid ?? "").toLowerCase();
      const dept = getDepartmentInfo(u).label.toLowerCase();
      const role = getRoleInfo(u).label.toLowerCase();

      // Search matching
      const matchesSearch =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        userId.includes(q) ||
        dept.includes(q) ||
        role.includes(q);

      if (!matchesSearch) return false;

      // Department filter
      if (selectedDeptFilter !== "ALL") {
        if (String(u.cr49f_department) !== selectedDeptFilter) return false;
      }

      // Role filter
      if (selectedRoleFilter !== "ALL") {
        if (String(u.cr49f_role) !== selectedRoleFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== "ALL") {
        const isActive = u.statecode === 0;
        if (selectedStatusFilter === "ACTIVE" && !isActive) return false;
        if (selectedStatusFilter === "INACTIVE" && isActive) return false;
      }

      return true;
    });
  }, [users, searchQuery, selectedDeptFilter, selectedRoleFilter, selectedStatusFilter]);

  // Statistics
  const totalUsers = users.length;
  const activeUsersCount = users.filter((u) => u.statecode === 0).length;
  const adminUsersCount = users.filter((u) => Number(u.cr49f_role) === 2).length;
  const uniqueDepartmentsCount = useMemo(() => {
    const depts = new Set(
      users.map((u) => u.cr49f_department).filter((d) => d !== undefined && d !== null)
    );
    return depts.size;
  }, [users]);

  // Dynamic filter options
  const departmentFilterOptions = useMemo<ModernSelectOption[]>(() => {
    return [
      {
        value: "ALL",
        label: `All Departments (${uniqueDepartmentsCount || "0"})`,
        icon: <Briefcase size={12} />,
      },
      ...DEPARTMENT_SELECT_OPTIONS,
    ];
  }, [uniqueDepartmentsCount]);

  const roleFilterOptions = useMemo<ModernSelectOption[]>(() => {
    return [
      {
        value: "ALL",
        label: "All Roles",
        icon: <Shield size={12} />,
      },
      ...ROLE_SELECT_OPTIONS,
    ];
  }, []);

  const statusFilterOptions: ModernSelectOption[] = [
    { value: "ALL", label: "All Statuses", icon: <UserCheck size={12} /> },
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
            <UsersIcon size={14} />
            <span>ADMINISTRATION</span>
          </div>
          <h1 className="admin-title">Users Overview</h1>
          <p className="admin-subtitle">
            Manage user accounts, departments, procurement roles, and system access permissions.
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchUsers}
            title="Refresh users list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={15} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <UsersIcon size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Users</span>
            <strong className="admin-stat-value">{totalUsers}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <ShieldCheck size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Procurement Admins</span>
            <strong className="admin-stat-value">{adminUsersCount}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <UserCheck size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Users</span>
            <strong className="admin-stat-value">{activeUsersCount}</strong>
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
              placeholder="Search by name, email, department, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="admin-toolbar-filters">
            {/* Department Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 175 }}
              value={selectedDeptFilter}
              options={departmentFilterOptions}
              onChange={(val) => setSelectedDeptFilter(val)}
              title="Filter by Department"
              icon={<Briefcase size={12} />}
            />

            {/* Role Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 165 }}
              value={selectedRoleFilter}
              options={roleFilterOptions}
              onChange={(val) => setSelectedRoleFilter(val)}
              title="Filter by Role"
              icon={<Shield size={12} />}
            />

            {/* Status Filter */}
            <ModernSelect
              size="sm"
              style={{ width: 145 }}
              value={selectedStatusFilter}
              options={statusFilterOptions}
              onChange={(val) => setSelectedStatusFilter(val)}
              title="Filter by Status"
              icon={<UserCheck size={12} />}
            />
          </div>
        </div>

        {/* ERROR STATE */}
        {loadError && (
          <div style={{ padding: "16px 20px" }}>
            <div className="admin-banner-error">
              <AlertCircle size={16} className="flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <strong>Unable to retrieve users:</strong> {loadError}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                style={{ height: 28, fontSize: 11 }}
                onClick={fetchUsers}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* USERS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created On</th>
                <th style={{ width: 90, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    <RefreshCw
                      size={18}
                      className="animate-spin"
                      style={{ margin: "0 auto 8px", display: "block" }}
                    />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    {searchQuery ||
                    selectedDeptFilter !== "ALL" ||
                    selectedRoleFilter !== "ALL" ||
                    selectedStatusFilter !== "ALL" ? (
                      <div>
                        <p>No user records matched your search filters.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ margin: "8px auto 0" }}
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedDeptFilter("ALL");
                            setSelectedRoleFilter("ALL");
                            setSelectedStatusFilter("ALL");
                          }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p>No user records found.</p>
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary"
                          style={{ margin: "8px auto 0" }}
                          onClick={() => setIsAddModalOpen(true)}
                        >
                          <Plus size={14} />
                          <span>Add First User</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const deptInfo = getDepartmentInfo(user);
                  const roleInfo = getRoleInfo(user);
                  const displayName = user.cr49f_name || user.cr49f_userid || "Unnamed User";
                  const initials = displayName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase() || "")
                    .join("") || "U";

                  return (
                    <tr key={user.cr49f_usersid}>
                      {/* NAME */}
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">{initials}</div>
                          <div>
                            <strong>{displayName}</strong>
                            {user.cr49f_userid && user.cr49f_userid !== user.cr49f_name && (
                              <div className="admin-user-subid">
                                ID: {user.cr49f_userid}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* EMAIL */}
                      <td>
                        {user.cr49f_email ? (
                          <a
                            href={`mailto:${user.cr49f_email}`}
                            className="admin-user-email"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              textDecoration: "none",
                            }}
                            title={`Email ${user.cr49f_email}`}
                          >
                            <Mail size={12} />
                            <span>{user.cr49f_email}</span>
                          </a>
                        ) : (
                          <span className="admin-user-email">—</span>
                        )}
                      </td>

                      {/* DEPARTMENT */}
                      <td>
                        <span
                          className={`admin-dept-badge ${deptInfo.className}`}
                          title={`Department: ${deptInfo.label}`}
                        >
                          <Briefcase size={11} />
                          <span>{deptInfo.label}</span>
                        </span>
                      </td>

                      {/* ROLE */}
                      <td>
                        <span
                          className={`admin-role-badge ${roleInfo.className}`}
                          title={`Role: ${roleInfo.label}`}
                        >
                          <Shield size={11} />
                          <span>{roleInfo.label}</span>
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span
                          className={`admin-status-pill ${
                            user.statecode === 0 ? "active" : "inactive"
                          }`}
                        >
                          {user.statecode === 0 ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* CREATED ON */}
                      <td>
                        <span className="admin-date">
                          {user.createdon
                            ? new Date(user.createdon).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="admin-edit-btn"
                          onClick={() => handleOpenEdit(user)}
                          title={`Edit ${displayName}`}
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

      {/* ADD USER MODAL */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={handleUserAdded}
      />

      {/* EDIT USER MODAL */}
      <EditUserModal
        isOpen={isEditModalOpen}
        user={userToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setUserToEdit(null);
        }}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};

export default UsersPage;
