import React, { useEffect, useState } from "react";
import {
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import { Cr49f_userrolesesService } from "../../generated/services/Cr49f_userrolesesService";
import type { Cr49f_userroleses } from "../../generated/models/Cr49f_userrolesesModel";
import "../../Styles/AdminPages.css";

const roleLabels: Record<string, string> = {
  "1": "Admin",
  "2": "User",
  "3": "Supplier",
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<Cr49f_userroleses[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await Cr49f_userrolesesService.getAll();
      if (!res.error && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const name = (u.cr49f_fullname ?? "").toLowerCase();
    const email = (u.cr49f_email ?? "").toLowerCase();
    const role = (roleLabels[String(u.cr49f_roles)] ?? "").toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  return (
    <div className="admin-page-container">
      {/* HEADER */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">
            <UsersIcon size={14} />
            <span>ADMINISTRATION</span>
          </div>
          <h1 className="admin-title">Users</h1>
          <p className="admin-subtitle">
            Manage user accounts, procurement roles, and system access
            permissions.
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
          <button type="button" className="admin-btn admin-btn-primary">
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
            <strong className="admin-stat-value">{users.length}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <ShieldCheck size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Admins</span>
            <strong className="admin-stat-value">
              {users.filter((u) => String(u.cr49f_roles) === "1").length}
            </strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <UserCheck size={18} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Users</span>
            <strong className="admin-stat-value">
              {users.filter((u) => u.statecode === 0).length}
            </strong>
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
              placeholder="Search users by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* USERS TABLE */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created On</th>
                <th style={{ width: 60, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Loading users from Dataverse...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    No user records found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleName =
                    roleLabels[String(user.cr49f_roles)] ?? "Unassigned";
                  const isAdminRole = roleName === "Admin";
                  return (
                    <tr key={user.cr49f_userrolesid}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            {(user.cr49f_fullname || "U")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <strong>{user.cr49f_fullname || "—"}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="admin-user-email">
                          {user.cr49f_email || "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-role-badge ${
                            isAdminRole ? "admin" : "user"
                          }`}
                        >
                          <Shield size={11} />
                          {roleName}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-status-pill ${
                            user.statecode === 0 ? "active" : "inactive"
                          }`}
                        >
                          {user.statecode === 0 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span className="admin-date">
                          {user.createdon
                            ? new Date(user.createdon).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          title="More options"
                        >
                          <MoreVertical size={14} />
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
    </div>
  );
};

export default UsersPage;
