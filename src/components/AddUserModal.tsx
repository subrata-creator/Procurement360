import React, { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  CircleDollarSign,
  Laptop,
  Loader2,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Cr49f_usersesService } from "../generated/services/Cr49f_usersesService";
import type {
  Cr49f_userses,
  Cr49f_usersescr49f_department,
  Cr49f_usersescr49f_role,
} from "../generated/models/Cr49f_usersesModel";
import ModernSelect, { type ModernSelectOption } from "./ModernSelect";

export const DEPARTMENT_OPTIONS: {
  value: Cr49f_usersescr49f_department;
  label: string;
}[] = [
  { value: 1, label: "Finance" },
  { value: 2, label: "IT" },
  { value: 3, label: "Administrator" },
  { value: 4, label: "HR" },
];

export const ROLE_OPTIONS: {
  value: Cr49f_usersescr49f_role;
  label: string;
}[] = [
  { value: 1, label: "Requester" },
  { value: 2, label: "Procurement Admin" },
  { value: 3, label: "Finance Approver" },
  { value: 4, label: "Procurement Officer" },
];

export const DEPARTMENT_SELECT_OPTIONS: ModernSelectOption[] = [
  {
    value: "1",
    label: "Finance",
    icon: <CircleDollarSign size={13} style={{ color: "#10b981" }} />,
  },
  {
    value: "2",
    label: "IT",
    icon: <Laptop size={13} style={{ color: "#3b82f6" }} />,
  },
  {
    value: "3",
    label: "Administrator",
    icon: <ShieldAlert size={13} style={{ color: "#8b5cf6" }} />,
  },
  {
    value: "4",
    label: "HR",
    icon: <Users size={13} style={{ color: "#f43f5e" }} />,
  },
];

export const ROLE_SELECT_OPTIONS: ModernSelectOption[] = [
  {
    value: "1",
    label: "Requester",
    icon: <User size={13} style={{ color: "#0284c7" }} />,
  },
  {
    value: "2",
    label: "Procurement Admin",
    icon: <ShieldCheck size={13} style={{ color: "#a78bfa" }} />,
  },
  {
    value: "3",
    label: "Finance Approver",
    icon: <CheckCircle2 size={13} style={{ color: "#d97706" }} />,
  },
  {
    value: "4",
    label: "Procurement Officer",
    icon: <Briefcase size={13} style={{ color: "#0d9488" }} />,
  },
];

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: Cr49f_userses) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserAdded,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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

  const handleResetAndClose = () => {
    if (isSubmitting) return;
    setName("");
    setEmail("");
    setDepartment("");
    setRole("");
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
      // Primary name column populated with email/name automatically
      const finalUserId = (email.trim() || name.trim());

      const payload = {
        cr49f_name: name.trim(),
        cr49f_email: email.trim(),
        cr49f_userid: finalUserId,
        cr49f_department: selectedDeptNum,
        cr49f_role: selectedRoleNum,
        statecode: 0 as const,
        statuscode: 1 as const,
      };

      const result = await Cr49f_usersesService.create(
        payload as unknown as Parameters<typeof Cr49f_usersesService.create>[0]
      );

      if (result.error) {
        setServerError(
          result.error.message ||
            "Failed to create user record in Dataverse. Please check your permissions."
        );
        return;
      }

      if (result.data) {
        const deptLabel =
          DEPARTMENT_OPTIONS.find((d) => d.value === selectedDeptNum)?.label ||
          "";
        const roleLabel =
          ROLE_OPTIONS.find((r) => r.value === selectedRoleNum)?.label || "";

        const completeRecord: Cr49f_userses = {
          ...result.data,
          cr49f_name: result.data.cr49f_name || name.trim(),
          cr49f_email: result.data.cr49f_email || email.trim(),
          cr49f_department: selectedDeptNum,
          cr49f_departmentname: result.data.cr49f_departmentname || deptLabel,
          cr49f_role: selectedRoleNum,
          cr49f_rolename: result.data.cr49f_rolename || roleLabel,
          cr49f_userid: result.data.cr49f_userid || finalUserId,
          statecode: 0,
          createdon: result.data.createdon || new Date().toISOString(),
        };

        onUserAdded(completeRecord);
        handleResetAndClose();
      } else {
        setServerError("No data returned from Dataverse after user creation.");
      }
    } catch (err: unknown) {
      console.error("Error creating user in Dataverse:", err);
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
        if (e.target === e.currentTarget) handleResetAndClose();
      }}
    >
      <div className="admin-modal">
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-heading">
            <div className="admin-modal-icon">
              <UserPlus size={18} />
            </div>
            <div>
              <h2>Add New User</h2>
              <p>Create a new user account with role and department assignments.</p>
            </div>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={handleResetAndClose}
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
              <label className="admin-form-label" htmlFor="user-name">
                <User size={13} />
                <span>Full Name</span>
                <span className="required">*</span>
              </label>
              <input
                id="user-name"
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
                autoFocus
              />
              {errors.name && (
                <span className="admin-form-error-text">{errors.name}</span>
              )}
            </div>

            {/* Email */}
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="user-email">
                <Mail size={13} />
                <span>Email Address</span>
                <span className="required">*</span>
              </label>
              <input
                id="user-email"
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
          </div>

          {/* Footer Actions */}
          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={handleResetAndClose}
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
                  <UserPlus size={14} />
                  <span>Add User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
