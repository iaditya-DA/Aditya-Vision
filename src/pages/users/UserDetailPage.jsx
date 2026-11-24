import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone,
  Building,
  Edit,
  UserX,
  UserCheck,
  Trash2,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
  X,
  ShieldAlert,
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { MODULE_PERMISSIONS } from "../../services/roleService";
import {
  getUserById,
  toggleStaffUserStatus,
  deleteStaffUser,
  adminResetStaffUserPassword,
} from "../../services/userService";
import { formatDate } from "../../utils/formatters";

const ROLE_COLOR_MAP = {
  "Super Admin": "bg-[#FFF1F0] text-[#E53935] border-[#FCA5A5]",
  "Operations Manager": "bg-purple-50 text-purple-700 border-purple-200",
  Dispatcher: "bg-blue-50 text-blue-700 border-blue-200",
  Accountant: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Staff: "bg-gray-100 text-[#374151] border-[#E5E7EB]",
};

const UserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const canDelete = isSuperAdmin || hasPermission("users.delete") || hasPermission("users");
  const canEdit = isSuperAdmin || hasPermission("users.edit") || hasPermission("users");

  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [statusDialog, setStatusDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Admin Password Reset Modal State
  const [passwordResetDialog, setPasswordResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const isSelf = staff && (staff.id === currentUser?.uid || staff.id === currentUser?.id);
  const isTargetSuper = staff && (staff.role === "Super Admin" || staff.roleId === "role_super_admin");

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getUserById(id);
      setStaff(u);
    } catch (err) {
      console.error("Error loading user profile:", err);
      toast.error("Could not load staff profile details");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadUser();
    });
  }, [loadUser]);

  const handleToggleStatus = async () => {
    if (!staff) return;
    try {
      const next = await toggleStaffUserStatus(staff.id, staff.status, currentUser);
      toast.success(`${staff.name} is now ${next}.`);
      setStatusDialog(false);
      await loadUser();
    } catch (err) {
      toast.error(err.message || "Failed to update account status");
    }
  };

  const handleDeleteUser = async () => {
    if (!staff) return;
    try {
      await deleteStaffUser(staff.id, currentUser);
      toast.success(`Staff user ${staff.name} removed successfully.`);
      setDeleteDialog(false);
      navigate("/users");
    } catch (err) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError("");

    if (!newPassword || newPassword.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsResetting(true);
    try {
      await adminResetStaffUserPassword(staff.id, newPassword, currentUser);
      toast.success(`Password reset successfully for ${staff.name}.`);
      setPasswordResetDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Password reset failed:", err);
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading staff record...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-[#6B7280] mb-4">Staff member profile not found.</p>
        <Button variant="secondary" onClick={() => navigate("/users")}>
          Return to Staff Directory
        </Button>
      </div>
    );
  }

  const roleColor = ROLE_COLOR_MAP[staff.role] || "bg-gray-100 text-[#374151] border-[#E5E7EB]";
  const userPerms = Array.isArray(staff.permissions) ? staff.permissions : [];

  return (
    <FormPage
      title={`Staff Profile: ${staff.name}`}
      subtitle="View employee contact records, assigned role policies and authorized system modules"
      backTo="/users"
      backLabel="Users & Staff"
    >
      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF1F0] text-[#E53935] font-black text-xl flex items-center justify-center shrink-0 border border-[#FECACA]">
                {staff.name
                  ? staff.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#202124]">{staff.name}</h2>
                  <span className="text-xs font-mono bg-gray-100 text-[#4B5563] px-2 py-0.5 rounded border border-[#E5E7EB]">
                    {staff.code || staff.id.slice(0, 8)}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${roleColor}`}>
                    {staff.role}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-1 flex items-center gap-2">
                  <span className="font-semibold text-[#202124]">Login ID:</span>
                  <span className="font-mono bg-red-50 text-[#E53935] px-2 py-0.5 rounded border border-red-100">
                    +91 {staff.mobile || staff.phone?.slice(-10) || "—"}
                  </span>
                  {staff.email && (
                    <span className="text-gray-400">({staff.email})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={staff.status || "Active"} />

              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={KeyRound}
                  onClick={() => {
                    setResetError("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordResetDialog(true);
                  }}
                  title="Reset Staff Password"
                >
                  Reset Password
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                icon={Edit}
                onClick={() => navigate(`/users/${staff.id}/edit`)}
              >
                Edit Profile
              </Button>

              {!isSelf && (
                <Button
                  variant={staff.status === "Active" ? "danger" : "secondary"}
                  size="sm"
                  icon={staff.status === "Active" ? UserX : UserCheck}
                  onClick={() => setStatusDialog(true)}
                >
                  {staff.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
              )}

              {!isSelf && !isTargetSuper && canDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDeleteDialog(true);
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            <div className="bg-gray-50/60 p-3.5 rounded-xl border border-[#E5E7EB]">
              <span className="text-[#6B7280] block mb-1">Registered Mobile Number (Login ID)</span>
              <span className="font-semibold text-[#202124] flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-[#16A34A]" />
                +91 {staff.mobile || staff.phone?.slice(-10) || "Not specified"}
              </span>
            </div>

            <div className="bg-gray-50/60 p-3.5 rounded-xl border border-[#E5E7EB]">
              <span className="text-[#6B7280] block mb-1">Assigned Store / Hub</span>
              <span className="font-semibold text-[#202124] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#2563EB]" />
                {staff.store || staff.assignedStore || "Benipatti Branch"}
              </span>
            </div>

            <div className="bg-gray-50/60 p-3.5 rounded-xl border border-[#E5E7EB]">
              <span className="text-[#6B7280] block mb-1">Joined Date</span>
              <span className="font-semibold text-[#202124] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
                {formatDate(staff.joinedDate) || "—"}
              </span>
            </div>

            <div className="bg-gray-50/60 p-3.5 rounded-xl border border-[#E5E7EB]">
              <span className="text-[#6B7280] block mb-1">Last Profile Update</span>
              <span className="font-semibold text-[#202124] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                {formatDate(staff.updatedAt) || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Permissions Matrix Inspection View */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#E53935]" />
                <span>Authorized Module Privileges</span>
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Summary of specific actions and views accessible to this staff account
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-[#374151] border border-[#E5E7EB]">
              {isTargetSuper ? "Full Master Access" : `${userPerms.length} privileges granted`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(MODULE_PERMISSIONS).map(([modKey, mod]) => {
              const modulePerms = mod.permissions;
              const hasAnyInMod =
                isTargetSuper ||
                modulePerms.some((p) => userPerms.includes(p.key) || userPerms.includes(modKey));

              return (
                <div
                  key={modKey}
                  className={`p-4 rounded-xl border transition-all ${
                    hasAnyInMod
                      ? "bg-white border-[#E5E7EB]"
                      : "bg-gray-50/60 border-gray-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-[#202124]">
                      {mod.label}
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      {mod.description}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {modulePerms.map((perm) => {
                      const hasPerm =
                        isTargetSuper ||
                        userPerms.includes(perm.key) ||
                        userPerms.includes(modKey);

                      return (
                        <div
                          key={perm.key}
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                            hasPerm
                              ? "bg-emerald-50/60 text-emerald-950 border border-emerald-200/60"
                              : "bg-gray-100/50 text-gray-400 border border-transparent"
                          }`}
                        >
                          {hasPerm ? (
                            <CheckCircle className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold">{perm.label}</span>
                              {perm.sensitive && (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
                                  Sensitive
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500 block leading-tight">
                              {perm.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Reset Password Modal */}
      {passwordResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-6 relative">
            <button
              type="button"
              onClick={() => setPasswordResetDialog(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#202124]">
                  Reset Password: {staff.name}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Login Mobile: +91 {staff.mobile || staff.phone?.slice(-10)}
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl text-xs text-[#374151] mb-4">
              <p>
                Set a secure temporary password. The staff member can use their registered mobile number and this password to log in.
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#202124] mb-1.5">
                  New Password <span className="text-[#E53935]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-10 px-3.5 pr-10 rounded-lg text-sm bg-white border border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202124] mb-1.5">
                  Confirm New Password <span className="text-[#E53935]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full h-10 px-3.5 pr-10 rounded-lg text-sm bg-white border border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2 text-xs text-[#DC2626]">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPasswordResetDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isResetting}
                  icon={isResetting ? Loader2 : null}
                >
                  {isResetting ? "Updating Password..." : "Set New Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Status Change Dialog */}
      <ConfirmDialog
        isOpen={statusDialog}
        onClose={() => setStatusDialog(false)}
        onConfirm={handleToggleStatus}
        type={staff?.status === "Active" ? "danger" : "default"}
        title={
          staff?.status === "Active"
            ? `Deactivate ${staff?.name}?`
            : `Activate ${staff?.name}?`
        }
        message={
          staff?.status === "Active"
            ? "Deactivated users are blocked from signing in immediately. Historical delivery and payment records remain intact."
            : "Activating this user account restores full access to their authorized application modules."
        }
        confirmText={
          staff?.status === "Active" ? "Deactivate User" : "Activate User"
        }
      />

      {/* Confirm Delete User Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={handleDeleteUser}
        type="danger"
        title={`Delete User "${staff?.name}"?`}
        message="Are you sure you want to permanently remove this user account from the staff directory?"
        confirmText="Delete User"
      />
    </FormPage>
  );
};

export default UserDetailPage;
