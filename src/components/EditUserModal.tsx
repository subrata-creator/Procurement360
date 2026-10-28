import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  Shield,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Cr49f_usersesService } from "../generated/services/Cr49f_usersesService";
import type {
  Cr49f_userses,
  Cr49f_usersesBase,
  Cr49f_usersescr49f_department,
  Cr49f_usersescr49f_role,
  Cr49f_usersesstatecode,
} from "../generated/models/Cr49f_usersesModel";
import ModernSelect, { type ModernSelectOption } from "./ModernSelect";
import {
  DEPARTMENT_OPTIONS,
  DEPARTMENT_SELECT_OPTIONS,
  ROLE_OPTIONS,
  ROLE_SELECT_OPTIONS,
} from "./AddUserModal";

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

interface EditUserModalProps {
  isOpen: boolean;
  user: Cr49f_userses | null;
  onClose: () => void;
  onUserUpdated: (updatedUser: Cr49f_userses) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onUserUpdated,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("0");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever the selected user changes or modal opens
  useEffect(() => {
    if (user && isOpen) {
      setName(user.cr49f_name || "");
      setEmail(user.cr49f_email || "");
      setDepartment(
        user.cr49f_department !== undefined ? String(user.cr49f_department) : ""
      );
      setRole(user.cr49f_role !== undefined ? String(user.cr49f_role) : "");
      setStatus(user.statecode === 1 ? "1" : "0");
      setErrors({});
      setServerError(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Full name is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!department) {
      newErrors.department = "Please select a department.";
    }

    if (!role) {
      newErrors.role = "Please select a role.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setErrors({});
    setServerError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const selectedDeptNum = Number(department) as Cr49f_usersescr49f_department;
      const selectedRoleNum = Number(role) as Cr49f_usersescr49f_role;
      const statecodeVal = Number(status) as Cr49f_usersesstatecode;

      const changedFields: Partial<Omit<Cr49f_usersesBase, "cr49f_usersid">> = {
        cr49f_name: name.trim(),
        cr49f_email: email.trim(),
        cr49f_department: selectedDeptNum,
        cr49f_role: selectedRoleNum,
        statecode: statecodeVal,
        statuscode: statecodeVal === 0 ? 1 : 2,
      };

      const result = await Cr49f_usersesService.update(
        user.cr49f_usersid,
        changedFields
      );

      if (result.error) {
        setServerError(
          result.error.message ||
            "Failed to update user in Dataverse. Please check your permissions."
        );
        return;
      }

      // Compute display labels
      const deptLabel =
        DEPARTMENT_OPTIONS.find((d) => d.value === selectedDeptNum)?.label ||
        "";
      const roleLabel =
        ROLE_OPTIONS.find((r) => r.value === selectedRoleNum)?.label || "";

      const updatedRecord: Cr49f_userses = {
        ...user,
        ...changedFields,
        cr49f_departmentname: deptLabel,
        cr49f_rolename: roleLabel,
        statecode: statecodeVal,
      };

      onUserUpdated(updatedRecord);
      handleClose();
    } catch (err: unknown) {
      console.error("Error updating user in Dataverse:", err);
      const errMsg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setServerError(errMsg);
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
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="admin-modal">
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-heading">
            <div className="admin-modal-icon">
              <Pencil size={18} />
            </div>
            <div>
              <h2>Edit User</h2>
              <p>
                Update details for{" "}
                <strong>{user.cr49f_name || user.cr49f_email}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="admin-modal-form">
          <div className="admin-modal-body">
            {serverError && (
              <div className="admin-banner-error">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Name */}
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="edit-user-name">
                <User size={13} />
                <span>Full Name</span>
                <span className="required">*</span>
              </label>
              <input
                id="edit-user-name"
                type="text"
                className={`admin-form-input ${errors.name ? "error" : ""}`}
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.name && (
                <span className="admin-form-error-text">{errors.name}</span>
              )}
            </div>

            {/* Email */}
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="edit-user-email">
                <Mail size={13} />
                <span>Email Address</span>
                <span className="required">*</span>
              </label>
              <input
                id="edit-user-email"
                type="email"
                className={`admin-form-input ${errors.email ? "error" : ""}`}
                placeholder="e.g. john.doe@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }
                }}
                disabled={isSubmitting}
              />
              {errors.email && (
                <span className="admin-form-error-text">{errors.email}</span>
              )}
            </div>

            {/* Department and Role (2 Columns) */}
            <div className="admin-form-row">
              {/* Department */}
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <Briefcase size={13} />
                  <span>Department</span>
                  <span className="required">*</span>
                </label>
                <ModernSelect
                  placeholder="Select department..."
                  value={department}
                  options={DEPARTMENT_SELECT_OPTIONS}
                  onChange={(val) => {
                    setDepartment(val);
                    if (errors.department) {
                      setErrors((prev) => ({ ...prev, department: "" }));
                    }
                  }}
                  placement="auto"
                  error={!!errors.department}
                  disabled={isSubmitting}
                  icon={<Briefcase size={13} />}
                />
                {errors.department && (
                  <span className="admin-form-error-text">
                    {errors.department}
                  </span>
                )}
              </div>

              {/* Role */}
              <div className="admin-form-group">
                <label className="admin-form-label">
                  <Shield size={13} />
                  <span>Role</span>
                  <span className="required">*</span>
                </label>
                <ModernSelect
                  placeholder="Select role..."
                  value={role}
                  options={ROLE_SELECT_OPTIONS}
                  onChange={(val) => {
                    setRole(val);
                    if (errors.role) {
                      setErrors((prev) => ({ ...prev, role: "" }));
                    }
                  }}
                  placement="auto"
                  error={!!errors.role}
                  disabled={isSubmitting}
                  icon={<Shield size={13} />}
                />
                {errors.role && (
                  <span className="admin-form-error-text">{errors.role}</span>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="admin-form-group">
              <label className="admin-form-label">
                <UserCheck size={13} />
                <span>Account Status</span>
              </label>
              <ModernSelect
                placeholder="Select status..."
                value={status}
                options={STATUS_SELECT_OPTIONS}
                onChange={(val) => setStatus(val)}
                placement="auto"
                disabled={isSubmitting}
                icon={<UserCheck size={13} />}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={handleClose}
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
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Pencil size={14} />
                  <span>Update User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;

