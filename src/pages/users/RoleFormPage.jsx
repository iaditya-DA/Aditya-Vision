import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Textarea from "../../components/common/Textarea";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useToast } from "../../hooks/useToast";
import {
  ALL_PERMISSIONS,
  MODULE_PERMISSIONS,
  getRoles,
  createRole,
  updateRole,
} from "../../services/roleService";
import { generateEntityId } from "../../services/idService";
import {
  Loader2,
  CheckSquare,
  Square,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

const RoleFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const isEditing = Boolean(id);
  const [form, setForm] = useState({
    name: "",
    description: "",
    permissions: ["dashboard.view", "deliveries.view"],
  });
  const [isSystemRole, setIsSystemRole] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing) {
      getRoles()
        .then((roles) => {
          const r = roles.find((x) => x.id === id);
          if (r) {
            setForm({
              name: r.name || "",
              description: r.description || "",
              permissions: Array.isArray(r.permissions) ? r.permissions : [],
            });
            setIsSystemRole(Boolean(r.isSystem));
          }
          setLoadingInitial(false);
        })
        .catch((err) => {
          console.error("Error loading role:", err);
          setLoadingInitial(false);
        });
    }
  }, [id, isEditing]);

  const handleTogglePermission = (pKey) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(pKey);
      const updated = exists
        ? prev.permissions.filter((k) => k !== pKey)
        : [...prev.permissions, pKey];
      return { ...prev, permissions: updated };
    });
    setIsDirty(true);
    if (errors.permissions) {
      setErrors((prev) => ({ ...prev, permissions: null }));
    }
  };

  const handleToggleModule = (moduleKey) => {
    const modulePermKeys =
      MODULE_PERMISSIONS[moduleKey]?.permissions.map((p) => p.key) || [];
    const allSelected = modulePermKeys.every((k) =>
      form.permissions.includes(k)
    );

    setForm((prev) => {
      let updated;
      if (allSelected) {
        updated = prev.permissions.filter((k) => !modulePermKeys.includes(k));
      } else {
        const toAdd = modulePermKeys.filter((k) => !prev.permissions.includes(k));
        updated = [...prev.permissions, ...toAdd];
      }
      return { ...prev, permissions: updated };
    });
    setIsDirty(true);
  };

  const handleSelectAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: ALL_PERMISSIONS.map((p) => p.key),
    }));
    setIsDirty(true);
  };

  const handleClearAll = () => {
    setForm((prev) => ({
      ...prev,
      permissions: [],
    }));
    setIsDirty(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Role title is required";
    if (!form.description.trim())
      errs.description = "Role description is required";
    if (form.permissions.length === 0) {
      errs.permissions = "Select at least one module privilege for this role";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateRole(id, {
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: form.permissions,
        });
        toast.success(`Role "${form.name}" updated successfully.`);
      } else {
        const roleId = await generateEntityId("role");
        await createRole({
          id: roleId,
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: form.permissions,
        });
        toast.success(`Custom role "${form.name}" created successfully.`);
      }
      setIsDirty(false);
      navigate("/users");
    } catch (err) {
      console.error("Save role error:", err);
      toast.error(err.message || "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading role details...</p>
      </div>
    );
  }

  return (
    <FormPage
      title={isEditing ? `Edit Role: ${form.name}` : "Create Custom Role"}
      subtitle="Define permission bundles that can be assigned across staff members"
      backTo="/users"
      backLabel="Users & Staff"
      isDirty={isDirty}
      onDiscard={() => setShowDiscard(true)}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection
          title="Role Information"
          description="Designate the title and administrative scope of this role preset"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Role Title"
              required
              disabled={isSystemRole}
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setIsDirty(true);
              }}
              placeholder="e.g. Warehouse Supervisor"
              helperText={
                isSystemRole
                  ? "System role names cannot be modified."
                  : "Unique identifier for this group of permissions."
              }
              error={errors.name}
            />

            <div className="md:col-span-2">
              <Textarea
                label="Role Description"
                required
                value={form.description}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, description: e.target.value }));
                  setIsDirty(true);
                }}
                placeholder="Explain the job responsibilities and operational boundaries for staff assigned to this role..."
                rows={3}
                error={errors.description}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Module Permissions Configuration"
          description="Select which capabilities are granted to accounts assigned this role"
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
                Selected Privileges:{" "}
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
            </div>
          </div>

          {/* Module Grid */}
          <div className="space-y-4">
            {Object.entries(MODULE_PERMISSIONS).map(([modKey, mod]) => {
              const modulePermKeys = mod.permissions.map((p) => p.key);
              const selectedCount = modulePermKeys.filter((k) =>
                form.permissions.includes(k)
              ).length;
              const isAllSelected = selectedCount === modulePermKeys.length;
              const isSomeSelected =
                selectedCount > 0 && selectedCount < modulePermKeys.length;

              return (
                <div
                  key={modKey}
                  className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                >
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
                      {isAllSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4" /> Deselect Module
                        </>
                      ) : isSomeSelected ? (
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

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mod.permissions.map((perm) => {
                      const isChecked = form.permissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
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
                                className={`text-xs font-bold ${
                                  isChecked ? "text-[#202124]" : "text-[#4B5563]"
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
              ? "Saving Role..."
              : isEditing
              ? "Update Role"
              : "Create Role"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => navigate("/users")}
        type="warning"
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this role form. Discarding will revert all changes."
        confirmText="Discard Changes"
      />
    </FormPage>
  );
};

export default RoleFormPage;
