import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckSquare,
  Square,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
  ALL_PERMISSIONS,
  MODULE_PERMISSIONS,
  getRoles,
} from "../../services/roleService";
import {
  getUserById,
  createStaffUser,
  updateStaffUser,
} from "../../services/userService";

const STORE_LOCATIONS = [
  "Benipatti Branch",
];

const UserFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser, isSuperAdmin } = useAuth();

  const isEditing = Boolean(id);
  const isSelf = isEditing && (id === currentUser?.uid || id === currentUser?.id);

  const [roles, setRoles] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "Staff",
    status: "Active",
    permissions: ["dashboard.view", "deliveries.view", "deliveries.create"],
    store: "Benipatti Branch",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getRoles(),
      isEditing ? getUserById(id) : Promise.resolve(null),
    ])
      .then(([rolesList, userData]) => {
        if (!mounted) return;
        setRoles(rolesList);
        if (userData) {
          setForm({
            name: userData.name || "",
            email: userData.email || "",
            mobile: userData.mobile || "",
            role: userData.role || "Staff",
            status: userData.status || "Active",
            permissions: Array.isArray(userData.permissions)
              ? userData.permissions
              : ["dashboard.view", "deliveries.view"],
            store: userData.store || "Benipatti Branch",
            password: "",
            confirmPassword: "",
          });
        }
        setLoadingInitial(false);
      })
      .catch((err) => {
        console.error("Failed to load user form data:", err);
        if (mounted) setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isEditing]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  /**
   * When a role is selected, populate its default permissions
   * while allowing the Super Admin to freely customize them.
   */
  const handleRoleChange = (newRole) => {
    const matched = roles.find((r) => r.name === newRole);
    let perms = [];

    if (newRole === "Super Admin") {
      perms = ALL_PERMISSIONS.map((p) => p.key);
    } else if (matched && matched.permissions) {
      perms = [...matched.permissions];
    } else {
      perms = ["dashboard.view", "deliveries.view", "deliveries.create"];
    }

    setForm((prev) => ({
      ...prev,
      role: newRole,
      permissions: perms,
    }));
    setIsDirty(true);
  };

  /**
   * Toggle an individual permission checkbox
   */
  const handleTogglePermission = (pKey) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(pKey);
      const updated = exists
        ? prev.permissions.filter((k) => k !== pKey)
        : [...prev.permissions, pKey];
      return { ...prev, permissions: updated };
    });
    setIsDirty(true);
  };

  /**
   * Toggle all permissions inside a specific module
   */
  const handleToggleModule = (moduleKey) => {
    const modulePermKeys = MODULE_PERMISSIONS[moduleKey]?.permissions.map((p) => p.key) || [];
    const allModuleSelected = modulePermKeys.every((k) => form.permissions.includes(k));

    setForm((prev) => {
      let updated;
      if (allModuleSelected) {
        // Deselect all in this module
        updated = prev.permissions.filter((k) => !modulePermKeys.includes(k));
      } else {
        // Select all in this module
        const toAdd = modulePermKeys.filter((k) => !prev.permissions.includes(k));
        updated = [...prev.permissions, ...toAdd];
      }
      return { ...prev, permissions: updated };
    });
    setIsDirty(true);
  };

  /**
   * Select All permissions across all modules
   */
  const handleSelectAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: ALL_PERMISSIONS.map((p) => p.key),
    }));
    setIsDirty(true);
  };

  /**
   * Clear All permissions
   */
  const handleClearAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: [],
    }));
    setIsDirty(true);
  };

  /**
   * Reset permissions to the currently selected role's standard defaults
   */
  const handleResetToRoleDefaults = useCallback(() => {
    const matched = roles.find((r) => r.name === form.role);
    if (form.role === "Super Admin") {
      setForm((prev) => ({
        ...prev,
        permissions: ALL_PERMISSIONS.map((p) => p.key),
      }));
    } else if (matched && matched.permissions) {
      setForm((prev) => ({
        ...prev,
        permissions: [...matched.permissions],
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        permissions: ["dashboard.view", "deliveries.view"],
      }));
    }
    setIsDirty(true);
  }, [form.role, roles]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = "Full name must be at least 2 characters";
    }

    if (!form.email.trim()) {
      errs.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Please enter a valid email address";
    }

    const cleanMobile = form.mobile.replace(/\D/g, "");
    if (!cleanMobile) {
      errs.mobile = "Mobile contact number is required";
    } else if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      errs.mobile = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }

    if (!isEditing) {
      if (!form.password) {
        errs.password = "Initial password is required";
      } else if (form.password.length < 6) {
        errs.password = "Password must be at least 6 characters";
      }

      if (!form.confirmPassword) {
        errs.confirmPassword = "Please confirm the password";
      } else if (form.password !== form.confirmPassword) {
        errs.confirmPassword = "Passwords do not match";
      }
    }

    if (form.permissions.length === 0) {
      errs.permissions = "Select at least one module privilege for this staff account";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please resolve highlighted form validation errors.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateStaffUser(
          id,
          {
            name: form.name.trim(),
            mobile: form.mobile.trim(),
            role: form.role,
            status: form.status,
            permissions: form.permissions,
            store: form.store.trim(),
          },
          currentUser
        );
        toast.success(`Staff user "${form.name}" updated successfully.`);
      } else {
        const res = await createStaffUser(
          {
            name: form.name.trim(),
            email: form.email.trim(),
            mobile: form.mobile.trim(),
            role: form.role,
            status: form.status,
            permissions: form.permissions,
            password: form.password,
            store: form.store.trim(),
          },
          currentUser
        );
        toast.success(`Staff account created for ${form.name} (${res.code}).`);
      }
      setIsDirty(false);
      navigate("/users");
    } catch (err) {
      console.error("Save staff user failed:", err);
      toast.error(err.message || "Failed to save user account");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Role options filter: ordinary staff cannot assign Super Admin
  const availableRoleOptions = useMemo(() => {
    return roles
      .filter((r) => isSuperAdmin || r.name !== "Super Admin")
      .map((r) => ({
        value: r.name,
        label: r.name,
      }));
  }, [roles, isSuperAdmin]);

  if (loadingInitial) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading staff account form...</p>
      </div>
    );
  }

  return (
    <FormPage
      title={isEditing ? `Edit Staff Member: ${form.name}` : "Provision New Staff Member"}
      subtitle={
        isEditing
          ? "Update staff contact details, assigned system role and fine-grained module privileges"
          : "Register a new internal staff account directly in Firebase Authentication and configure granular access control"
      }
      backTo="/users"
      backLabel="Users & Staff"
      isDirty={isDirty}
      onDiscard={() => setShowDiscard(true)}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal & Contact Information */}
        <FormSection
          title="Personal & Employment Information"
          description="Basic employee identity, corporate email credentials and assigned physical retail store"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Employee Name"
              required
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Ramesh Kumar Verma"
              error={errors.name}
            />

            <Input
              label="Email Address (Login Username)"
              required
              type="email"
              disabled={isEditing}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="e.g. ramesh.verma@adityavision.com"
              helperText={
                isEditing
                  ? "Authentication email is permanent and cannot be modified."
                  : "Used by the staff member to log in to the application."
              }
              error={errors.email}
            />

            <Input
              label="Mobile Number"
              required
              type="tel"
              value={form.mobile}
              onChange={(e) => handleChange("mobile", e.target.value)}
              placeholder="e.g. 9876543210"
              helperText="10-digit Indian mobile number"
              error={errors.mobile}
            />

            <Select
              label="Assigned Store / Distribution Hub"
              value={form.store}
              onChange={(e) => handleChange("store", e.target.value)}
              options={STORE_LOCATIONS.map((loc) => ({
                value: loc,
                label: loc,
              }))}
            />
          </div>

          {!isEditing && (
            <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
              <div className="mb-3">
                <span className="text-xs font-bold text-[#202124] uppercase tracking-wider block">
                  Initial Authentication Password
                </span>
                <span className="text-xs text-[#6B7280]">
                  Set a temporary password. The staff member can use this to sign in immediately or request a reset email.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    label="Initial Password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Minimum 6 characters"
                    error={errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-[#6B7280] hover:text-[#202124]"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label="Confirm Initial Password"
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) =>
                      handleChange("confirmPassword", e.target.value)
                    }
                    placeholder="Re-enter initial password"
                    error={errors.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-9 text-[#6B7280] hover:text-[#202124]"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </FormSection>

        {/* Section 2: Role & Account Status */}
        <FormSection
          title="System Role & Account State"
          description="Assign a predefined role preset and control whether this account can currently authenticate"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Assigned System Role"
                required
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                options={availableRoleOptions}
                helperText="Selecting a role pre-fills default permissions. You can customize them below."
              />
            </div>

            <div>
              <Select
                label="Account Status"
                required
                disabled={isSelf && isSuperAdmin}
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                options={[
                  { value: "Active", label: "Active (Sign-in Permitted)" },
                  { value: "Inactive", label: "Inactive (Sign-in Blocked)" },
                ]}
                helperText={
                  isSelf && isSuperAdmin
                    ? "You cannot deactivate your own Super Admin account."
                    : "Deactivated accounts are blocked from accessing the system immediately."
                }
              />
            </div>
          </div>
        </FormSection>

        {/* Section 3: Granular Permissions Matrix */}
        <FormSection
          title="Granular Module Permissions"
          description="Select exactly which features and operations this staff member is authorized to execute"
        >
          {errors.permissions && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.permissions}</span>
            </div>
          )}

          {/* Matrix Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-[#E5E7EB] mb-4">
            <div className="text-xs font-semibold text-[#374151] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#E53935]" />
              <span>
                Selected Permissions:{" "}
                <span className="font-bold text-[#E53935]">
                  {form.permissions.length}
                </span>{" "}
                of {ALL_PERMISSIONS.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-xs font-medium text-[#202124] bg-white border border-[#D1D5DB] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 text-xs font-medium text-[#DC2626] bg-white border border-[#D1D5DB] rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleResetToRoleDefaults}
                className="px-2.5 py-1 text-xs font-medium text-[#2563EB] bg-white border border-[#D1D5DB] rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset to Role Defaults
              </button>
            </div>
          </div>

          {/* Module Grid */}
          <div className="space-y-4">
            {Object.entries(MODULE_PERMISSIONS).map(([modKey, mod]) => {
              const modulePermKeys = mod.permissions.map((p) => p.key);
              const selectedCount = modulePermKeys.filter((k) =>
                form.permissions.includes(k)
              ).length;
              const isAllModuleSelected = selectedCount === modulePermKeys.length;
              const isSomeModuleSelected =
                selectedCount > 0 && selectedCount < modulePermKeys.length;

              return (
                <div
                  key={modKey}
                  className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                >
                  {/* Module Header */}
                  <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#202124]">
                          {mod.label}
                        </span>
                        <span className="text-[11px] font-semibold text-[#6B7280] bg-white px-2 py-0.5 rounded-full border border-[#E5E7EB]">
                          {selectedCount}/{modulePermKeys.length}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {mod.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleModule(modKey)}
                      className="text-xs font-semibold text-[#E53935] hover:text-[#B71C1C] flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      {isAllModuleSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4" /> Deselect Module
                        </>
                      ) : isSomeModuleSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4 opacity-70" /> Select
                          Remaining
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4" /> Select All in Module
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions Checkbox Grid */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mod.permissions.map((perm) => {
                      const isChecked = form.permissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked
                            ? "bg-red-50/40 border-[#FECACA] text-[#202124]"
                            : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-gray-300"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(perm.key)}
                            className="mt-0.5 w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold ${isChecked ? "text-[#202124]" : "text-[#4B5563]"
                                  }`}
                              >
                                {perm.label}
                              </span>
                              {perm.sensitive && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                                  Sensitive
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-snug">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (isDirty) {
                setShowDiscard(true);
              } else {
                navigate("/users");
              }
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            icon={isSubmitting ? Loader2 : null}
          >
            {isSubmitting
              ? isEditing
                ? "Updating Staff Record..."
                : "Provisioning Account..."
              : isEditing
                ? "Save User Changes"
                : "Provision Staff Account"}
          </Button>
        </div>
      </form>

      {/* Discard Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => navigate("/users")}
        type="warning"
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this staff form. Discarding will revert all modifications."
        confirmText="Discard Changes"
      />
    </FormPage>
  );
};

export default UserFormPage;
