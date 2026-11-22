import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ShieldCheck,
  UserPlus,
  Shield,
  Eye,
  Edit2,
  Trash2,
  Lock,
  UserX,
  UserCheck,
  Loader2,
  Mail,
  RotateCcw,
  Phone,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DataTable from "../../components/common/DataTable";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ALL_PERMISSIONS, MODULE_PERMISSIONS, getRoles, deleteRole } from "../../services/roleService";
import { getUsers, toggleStaffUserStatus, deleteStaffUser } from "../../services/userService";
import { sendUserPasswordReset } from "../../services/authService";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 8;

const ROLE_COLOR_MAP = {
  "Super Admin": "bg-[#FFF1F0] text-[#E53935] border-[#FCA5A5]",
  "Operations Manager": "bg-purple-50 text-purple-700 border-purple-200",
  "Dispatcher": "bg-blue-50 text-blue-700 border-blue-200",
  "Accountant": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Staff": "bg-gray-100 text-[#374151] border-[#E5E7EB]",
};

const UsersStaff = () => {
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const toast = useToast();

  const canCreateStaff = isSuperAdmin || hasPermission("users.create");
  const canDeleteUsers = isSuperAdmin || hasPermission("users.delete") || hasPermission("users");

  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'roles'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Users Tab Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [statusDialog, setStatusDialog] = useState({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleteRoleDialog, setDeleteRoleDialog] = useState({ open: false, role: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uList, rList] = await Promise.all([getUsers(), getRoles()]);
      setUsers(uList);
      setRoles(rList);
    } catch (err) {
      console.error("Error loading user management data:", err);
      toast.error("Could not load users and roles");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "Active").length;
    const inactive = users.filter((u) => u.status === "Inactive").length;
    const rolesCount = roles.length;
    return { total, active, inactive, rolesCount };
  }, [users, roles]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.mobile?.includes(q) ||
        u.code?.toLowerCase().includes(q);
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  const handleToggleUserStatus = async () => {
    const target = statusDialog.user;
    if (!target) return;

    try {
      const next = await toggleStaffUserStatus(target.id, target.status, currentUser);
      toast.success(`${target.name} has been marked as ${next}.`);
      setStatusDialog({ open: false, user: null });
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  const handleDeleteUser = async () => {
    const target = deleteDialog.user;
    if (!target) return;

    try {
      await deleteStaffUser(target.id, currentUser);
      toast.success(`User ${target.name} removed successfully.`);
      setDeleteDialog({ open: false, user: null });
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete user account");
    }
  };

  const handleSendResetEmail = async (staffMember) => {
    try {
      await sendUserPasswordReset(staffMember.email);
      toast.success(`Password reset email dispatched to ${staffMember.email}`);
    } catch (err) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  const handleDeleteRole = async () => {
    const r = deleteRoleDialog.role;
    if (!r) return;
    try {
      await deleteRole(r.id);
      toast.success(`Custom role "${r.name}" deleted.`);
      setDeleteRoleDialog({ open: false, role: null });
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete role");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const userColumns = [
    {
      key: "user",
      label: "Staff Member",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FFF1F0] text-[#E53935] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FECACA]">
            {row.name
              ? row.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : "U"}
          </div>
          <div>
            <div className="font-semibold text-[#202124] hover:text-[#E53935] transition-colors cursor-pointer" onClick={() => navigate(`/users/${row.id}`)}>
              {row.name}
            </div>
            <div className="text-[11px] text-[#6B7280] flex items-center gap-2">
              <span className="font-mono bg-gray-100 px-1 py-0.2 rounded text-[10px]">
                {row.code || row.id.slice(0, 8)}
              </span>
              <span>•</span>
              <span>{row.email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "mobile",
      label: "Contact",
      render: (mobile) => (
        <span className="text-xs text-[#374151] flex items-center gap-1 font-mono">
          <Phone className="w-3 h-3 text-[#16A34A]" />
          {mobile || "—"}
        </span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (role) => {
        const colorClass = ROLE_COLOR_MAP[role] || "bg-gray-100 text-[#374151] border-[#E5E7EB]";
        return (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}
          >
            {role || "Staff"}
          </span>
        );
      },
    },
    {
      key: "permissions",
      label: "Module Access",
      render: (perms, row) => {
        if (row.role === "Super Admin") {
          return (
            <span className="text-[11px] font-semibold text-[#E53935] bg-[#FFF1F0] px-2 py-0.5 rounded-md border border-[#FCA5A5]">
              Master Access (All)
            </span>
          );
        }
        const permList = Array.isArray(perms) ? perms : [];
        // Extract distinct modules
        const distinctModules = Array.from(
          new Set(
            permList.map((p) => {
              const [mod] = p.split(".");
              return MODULE_PERMISSIONS[mod]?.label || mod;
            })
          )
        );

        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {distinctModules.slice(0, 2).map((modName) => (
              <span
                key={modName}
                className="text-[10px] font-medium bg-gray-50 text-[#4B5563] px-1.5 py-0.5 rounded border border-[#E5E7EB]"
              >
                {modName}
              </span>
            ))}
            {distinctModules.length > 2 && (
              <span className="text-[10px] font-semibold text-[#6B7280] bg-gray-100 px-1 py-0.5 rounded">
                +{distinctModules.length - 2} more
              </span>
            )}
            {distinctModules.length === 0 && (
              <span className="text-[10px] text-gray-400 italic">No modules</span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val) => <StatusBadge status={val || "Active"} />,
    },
    {
      key: "joinedDate",
      label: "Joined",
      render: (d) => (
        <span className="text-xs text-[#6B7280]">{formatDate(d)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (_, row) => {
        const isSelf = row.id === currentUser?.uid || row.id === currentUser?.id;
        const isTargetSuper = row.role === "Super Admin" || row.roleId === "role_super_admin";

        return (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleSendResetEmail(row)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
              title="Dispatch Password Reset Email"
            >
              <Mail className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate(`/users/${row.id}`)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#202124] hover:bg-gray-100 transition-colors"
              title="View Staff Profile"
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate(`/users/${row.id}/edit`)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E53935] hover:bg-[#FFF1F0] transition-colors"
              title="Edit Profile & Permissions"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {!isSelf && (
              <button
                type="button"
                onClick={() => setStatusDialog({ open: true, user: row })}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.status === "Active"
                    ? "text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50"
                    : "text-[#6B7280] hover:text-[#16A34A] hover:bg-emerald-50"
                }`}
                title={row.status === "Active" ? "Deactivate Account" : "Activate Account"}
              >
                {row.status === "Active" ? (
                  <UserX className="w-4 h-4" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
              </button>
            )}

            {!isSelf && !isTargetSuper && canDeleteUsers && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteDialog({ open: true, user: row });
                }}
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                title="Delete User Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Staff Management"
        description="Manage company employees, assign role-based access, and configure granular module permissions"
        action={
          activeTab === "users" ? (
            canCreateStaff && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => navigate("/users/new")}
              >
                Create Staff User
              </Button>
            )
          ) : (
            isSuperAdmin && (
              <Button
                variant="primary"
                icon={Shield}
                onClick={() => navigate("/users/roles/new")}
              >
                Create Custom Role
              </Button>
            )
          )
        }
      />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-[#202124]">{stats.total}</div>
            <div className="text-xs font-medium text-[#6B7280]">Total Staff Accounts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-[#202124]">{stats.active}</div>
            <div className="text-xs font-medium text-[#6B7280]">Active Users</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#DC2626] flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-[#202124]">{stats.inactive}</div>
            <div className="text-xs font-medium text-[#6B7280]">Deactivated Accounts</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-[#202124]">{stats.rolesCount}</div>
            <div className="text-xs font-medium text-[#6B7280]">Roles Defined</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "users"
              ? "border-[#E53935] text-[#E53935]"
              : "border-transparent text-[#6B7280] hover:text-[#202124]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("roles")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "roles"
              ? "border-[#E53935] text-[#E53935]"
              : "border-transparent text-[#6B7280] hover:text-[#202124]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Roles & Permissions ({roles.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
          <p className="text-sm text-[#6B7280]">Loading staff database and security policies...</p>
        </div>
      ) : activeTab === "users" ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SearchBar
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setCurrentPage(1);
                }}
                placeholder="Search staff by name, email, mobile, code..."
              />

              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "", label: "All Roles" },
                  ...roles.map((r) => ({ value: r.name, label: r.name })),
                ]}
              />

              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
              />
            </div>

            {(search || roleFilter || statusFilter) && (
              <Button
                variant="secondary"
                size="sm"
                icon={RotateCcw}
                onClick={clearFilters}
              >
                Reset
              </Button>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
            <DataTable
              columns={userColumns}
              data={paginatedUsers}
              keyField="id"
              emptyMessage="No staff members found matching your search."
              emptyDescription="Try clearing filters or click 'Create Staff User' to provision a staff account."
            />

            {filteredUsers.length > PAGE_SIZE && (
              <div className="p-4 border-t border-[#E5E7EB]">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Roles Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#202124]">
                      {role.name}
                    </span>
                    {role.isSystem ? (
                      <span className="text-[10px] font-bold text-[#E53935] bg-[#FFF1F0] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#FCA5A5]">
                        <Lock className="w-3 h-3" /> System Role
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Custom Role
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-[#6B7280]">
                    {users.filter((u) => u.role === role.name).length} Staff Members
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">{role.description}</p>

                <div className="mb-4">
                  <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider block mb-2">
                    Included Permissions ({role.permissions?.length || 0}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {(role.permissions || []).map((pKey) => {
                      const meta = ALL_PERMISSIONS.find((p) => p.key === pKey);
                      return (
                        <span
                          key={pKey}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-gray-50 text-[#374151] border border-[#E5E7EB]"
                        >
                          {meta ? meta.label : pKey}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!role.isSystem && canDeleteUsers && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Edit2}
                    onClick={() => navigate(`/users/roles/${role.id}/edit`)}
                  >
                    Edit Role
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDeleteRoleDialog({ open: true, role });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm Deactivation / Activation */}
      <ConfirmDialog
        isOpen={statusDialog.open}
        onClose={() => setStatusDialog({ open: false, user: null })}
        onConfirm={handleToggleUserStatus}
        type={statusDialog.user?.status === "Active" ? "danger" : "default"}
        title={
          statusDialog.user?.status === "Active"
            ? `Deactivate ${statusDialog.user?.name}?`
            : `Activate ${statusDialog.user?.name}?`
        }
        message={
          statusDialog.user?.status === "Active"
            ? "Deactivated users are blocked from signing in immediately. Historical delivery and payment records remain completely intact."
            : "Activating this user account restores full access to their authorized application modules."
        }
        confirmText={
          statusDialog.user?.status === "Active" ? "Deactivate User" : "Activate User"
        }
      />

      {/* Confirm Delete User */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={handleDeleteUser}
        type="danger"
        title={`Delete User "${deleteDialog.user?.name}"?`}
        message="Are you sure you want to remove this staff profile? This action will permanently remove their application profile record."
        confirmText="Delete User"
      />

      {/* Confirm Delete Role */}
      <ConfirmDialog
        isOpen={deleteRoleDialog.open}
        onClose={() => setDeleteRoleDialog({ open: false, role: null })}
        onConfirm={handleDeleteRole}
        type="danger"
        title={`Delete Role "${deleteRoleDialog.role?.name}"?`}
        message="This action cannot be undone. You cannot delete a role that is currently assigned to any staff members."
        confirmText="Delete Role"
      />
    </div>
  );
};

export default UsersStaff;
