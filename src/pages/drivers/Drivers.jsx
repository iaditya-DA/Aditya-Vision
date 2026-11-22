import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Eye,
  Edit,
  UserX,
  UserCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Landmark,
  Download,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  Trash2,
  CheckSquare,
  X,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DataTable from "../../components/common/DataTable";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Modal from "../../components/common/Modal";
import { vehicleTypes } from "../../constants/appConstants";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import {
  getDriversPaged,
  updateDriver,
  reviewDriverApproval,
  getDriverBankDetails,
} from "../../services/driverService";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
} from "../../utils/exportUtils";
import {
  deleteDriver,
  deleteDriversBulk,
  checkDriverDeletionSafety,
} from "../../services/deleteService";

const Drivers = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection & Delete State
  const [selectedDriverIds, setSelectedDriverIds] = useState([]);
  const [driverToDelete, setDriverToDelete] = useState(null);
  const [driverSafetyInfo, setDriverSafetyInfo] = useState(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forcePermanent, setForcePermanent] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Deactivate/Activate Confirm Dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [driverToToggle, setDriverToToggle] = useState(null);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [driverToReject, setDriverToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canAddDriver = isSuperAdmin || hasPermission("drivers");
  const canViewBankDetails = isSuperAdmin || hasPermission("drivers.viewBankDetails");
  const canExportBankDetails = isSuperAdmin || hasPermission("drivers.exportBankDetails");

  // Bank details view modal state
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedDriverBank, setSelectedDriverBank] = useState(null);
  const [loadingBankDoc, setLoadingBankDoc] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDriversPaged({
        status: statusFilter,
        vehicleType: vehicleFilter,
        pageSize: 100,
      });
      setDrivers(result.drivers);
    } catch (err) {
      console.error(err);
      toast.error("Could not load drivers roster");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vehicleFilter, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDrivers();
    });
  }, [loadDrivers]);

  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;
    const query = searchQuery.toLowerCase().trim();
    return drivers.filter((driver) => {
      return (
        driver.name?.toLowerCase().includes(query) ||
        driver.code?.toLowerCase().includes(query) ||
        driver.mobile?.includes(query) ||
        driver.vehicleNumber?.toLowerCase().includes(query) ||
        driver.city?.toLowerCase().includes(query)
      );
    });
  }, [drivers, searchQuery]);

  const totalPages = Math.ceil(filteredDrivers.length / pageSize) || 1;
  const paginatedDrivers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDrivers.slice(start, start + pageSize);
  }, [filteredDrivers, currentPage, pageSize]);

  const handleOpenBankDetails = async (driver) => {
    setSelectedDriverBank({ driver, bank: null });
    setBankModalOpen(true);

    if (!canViewBankDetails) {
      return;
    }

    setLoadingBankDoc(true);
    try {
      const bankData = await getDriverBankDetails(driver.id);
      setSelectedDriverBank({ driver, bank: bankData });
    } catch (err) {
      console.error("Failed to load driver bank details:", err);
      toast.error("Could not load confidential bank information");
    } finally {
      setLoadingBankDoc(false);
    }
  };

  const handleExport = async (format = "csv") => {
    if (filteredDrivers.length === 0) {
      toast.error("No drivers available to export");
      return;
    }

    setExporting(true);
    try {
      let bankDetailsMap = {};

      if (canExportBankDetails) {
        // Fetch private bank details in parallel for drivers
        const bankPromises = filteredDrivers.map(async (d) => {
          try {
            const b = await getDriverBankDetails(d.id);
            return { id: d.id, bank: b };
          } catch {
            return { id: d.id, bank: null };
          }
        });
        const results = await Promise.all(bankPromises);
        results.forEach((r) => {
          if (r.bank) bankDetailsMap[r.id] = r.bank;
        });
      }

      const rows = filteredDrivers.map((d) => {
        const b = bankDetailsMap[d.id] || {};
        const baseRow = {
          "Driver ID": d.code || d.id,
          Name: d.name,
          Mobile: d.mobile,
          "Alternate Mobile": d.alternateMobile || "",
          Vehicle: d.vehicleType,
          "Vehicle No": d.vehicleNumber,
          City: d.city,
          Address: d.address,
          Status: d.status,
        };

        if (canExportBankDetails) {
          baseRow["Bank Name"] = b.bankName || d.bankName || "";
          baseRow["Account Holder"] = b.accountHolderName || d.accountHolderName || d.name || "";
          baseRow["Full Account Number"] = b.accountNumber ? `="${b.accountNumber}"` : "";
          baseRow["IFSC Code"] = b.ifscCode || d.ifscCode || "";
          baseRow["Branch"] = b.branchName || d.branchName || "";
          baseRow["UPI ID"] = b.upiId || d.upiId || "";
        }

        return baseRow;
      });

      const fileName = `aditya-vision-drivers-${new Date().toISOString().split("T")[0]}`;

      if (format === "csv") {
        exportToCSV(rows, fileName);
        toast.success("Driver roster exported to CSV");
      } else if (format === "excel") {
        exportToExcel(rows, `${fileName}.xlsx`);
        toast.success("Driver roster exported to Excel");
      } else if (format === "pdf") {
        const pdfCols = [
          { label: "Driver ID", key: "Driver ID" },
          { label: "Name", key: "Name" },
          { label: "Mobile", key: "Mobile" },
          { label: "Vehicle", key: "Vehicle" },
          { label: "Vehicle No", key: "Vehicle No" },
          { label: "City", key: "City" },
          { label: "Status", key: "Status" },
        ];

        if (canExportBankDetails) {
          pdfCols.push(
            { label: "Bank", key: "Bank Name" },
            { label: "A/C Holder", key: "Account Holder" },
            { label: "A/C Number", key: "Full Account Number" },
            { label: "IFSC", key: "IFSC Code" },
            { label: "UPI", key: "UPI ID" }
          );
        }

        // Clean excel formula escaping for PDF display
        const pdfRows = rows.map((r) => ({
          ...r,
          "Full Account Number": r["Full Account Number"]
            ? String(r["Full Account Number"]).replace(/[="]/g, "")
            : "",
        }));

        await exportToPDF(
          "Driver Fleet Roster & Ledger",
          pdfCols,
          pdfRows,
          `${fileName}.pdf`,
          `Filter: ${statusFilter || "All"} | Total: ${filteredDrivers.length}`
        );
        toast.success("Driver roster exported to PDF");
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to generate export");
    } finally {
      setExporting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!driverToToggle) return;
    const newStatus = driverToToggle.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDriver(driverToToggle.id, { status: newStatus });
      toast.success(`${driverToToggle.name} status updated to ${newStatus}.`);
      setConfirmDialogOpen(false);
      setDriverToToggle(null);
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to update driver status");
    }
  };

  const handleApprove = async (driver) => {
    try {
      await reviewDriverApproval(driver.id, true);
      toast.success(`${driver.name} approved and activated`);
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to approve driver");
    }
  };

  const handleReject = async () => {
    if (!driverToReject || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await reviewDriverApproval(driverToReject.id, false, rejectionReason);
      toast.success(`${driverToReject.name} application rejected`);
      setRejectModalOpen(false);
      setDriverToReject(null);
      setRejectionReason("");
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to reject driver");
    }
  };

  const handleInitiateDelete = async (driver) => {
    try {
      const safety = await checkDriverDeletionSafety(driver.id);
      setDriverSafetyInfo(safety);
      setForcePermanent(false);
      setDriverToDelete(driver);
    } catch (err) {
      console.error("Safety check error:", err);
      setDriverSafetyInfo({ canHardDelete: false, reason: "Error checking safety" });
      setDriverToDelete(driver);
    }
  };

  const handleConfirmDeleteDriver = async ({ reason } = {}) => {
    if (!driverToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteDriver(driverToDelete.id, currentUser, {
        forcePermanent,
        reason,
      });
      if (res.action === "archived") {
        toast.success(
          `${driverToDelete.name} has been archived to preserve historical delivery and payment records.`
        );
      } else {
        toast.success(`${driverToDelete.name} was permanently removed.`);
      }
      setDriverToDelete(null);
      setSelectedDriverIds((prev) => prev.filter((id) => id !== driverToDelete.id));
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to delete driver");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async ({ reason } = {}) => {
    if (!selectedDriverIds.length) return;
    setIsDeleting(true);
    try {
      const result = await deleteDriversBulk(selectedDriverIds, currentUser, reason);
      setSelectedDriverIds([]);
      setBulkDeleteDialogOpen(false);
      toast.success(
        `Processed ${result.count} drivers (${result.archivedCount} archived, ${result.deletedCount} purged)`
      );
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Bulk deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: "driver",
      label: "Driver Info",
      render: (_, row) => (
        <div>
          <div className="font-semibold text-[#202124]">{row.name}</div>
          <div className="text-[11px] text-[#6B7280] flex items-center gap-2 mt-0.5">
            <span className="font-mono">{row.code || row.id}</span>
            <span>•</span>
            <span>{row.mobile}</span>
          </div>
        </div>
      ),
    },
    {
      key: "vehicle",
      label: "Vehicle Details",
      render: (_, row) => (
        <div>
          <div className="text-xs text-[#202124]">{row.vehicleType}</div>
          <div className="text-[11px] font-mono text-[#6B7280]">
            {row.vehicleNumber || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      label: "City / Area",
      render: (_, row) => (
        <div>
          <div className="text-xs text-[#202124]">{row.city}</div>
          <div className="text-[11px] text-[#6B7280] truncate max-w-[150px]">
            {row.address}
          </div>
        </div>
      ),
    },
    {
      key: "bank",
      label: "Bank Details",
      render: (_, row) => (
        <div className="space-y-0.5 min-w-[210px] text-[11px] leading-tight py-0.5">
          {row.bankName ? (
            <div className="font-semibold text-[#202124] flex items-center gap-1">
              <Landmark className="w-3 h-3 text-[#E53935] shrink-0" />
              <span>{row.bankName}</span>
            </div>
          ) : (
            <div className="font-semibold text-[#202124]">Bank: —</div>
          )}
          {row.accountHolderName && (
            <div className="text-[#6B7280]">
              <span className="text-[#9CA3AF]">A/C Holder:</span> {row.accountHolderName}
            </div>
          )}
          <div className="font-mono text-[#202124]">
            <span className="text-[#9CA3AF] font-sans">A/C:</span> {row.maskedAccount || "—"}
          </div>
          {row.ifscCode && (
            <div className="font-mono text-[#6B7280]">
              <span className="text-[#9CA3AF] font-sans">IFSC:</span> {row.ifscCode}
            </div>
          )}
          {row.branchName && (
            <div className="text-[#6B7280]">
              <span className="text-[#9CA3AF]">Branch:</span> {row.branchName}
            </div>
          )}
          {row.upiId && (
            <div className="text-[#E53935] font-mono">
              <span className="text-[#9CA3AF] font-sans">UPI:</span> {row.upiId}
            </div>
          )}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handleOpenBankDetails(row)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E53935] hover:text-[#C62828] hover:underline cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              <span>View Details</span>
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (val) => <StatusBadge status={val} type="driver" />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* Quick Approval for Pending Status */}
          {isSuperAdmin && row.status === "Pending Approval" && (
            <>
              <button
                type="button"
                onClick={() => handleApprove(row)}
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Approve Driver"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDriverToReject(row);
                  setRejectModalOpen(true);
                }}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Reject Driver"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate(`/drivers/${row.id}`)}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#202124] hover:bg-gray-100 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => navigate(`/drivers/${row.id}/edit`)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E53935] hover:bg-[#FFF1F0] transition-colors"
              title="Edit Driver"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          {isSuperAdmin && row.status !== "Pending Approval" && (
            <button
              type="button"
              onClick={() => {
                setDriverToToggle(row);
                setConfirmDialogOpen(true);
              }}
              className={`p-1.5 rounded-lg transition-colors ${row.status === "Active"
                ? "text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50"
                : "text-[#6B7280] hover:text-[#16A34A] hover:bg-emerald-50"
                }`}
              title={row.status === "Active" ? "Deactivate Driver" : "Activate Driver"}
            >
              {row.status === "Active" ? (
                <UserX className="w-4 h-4" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => handleInitiateDelete(row)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
              title="Delete or Archive Driver"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Drivers"
        description="Internal delivery personnel roster, vehicles, and payment ledgers"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={exporting || filteredDrivers.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#202124] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Export CSV (Full bank details included for authorized roles)"
              >
                <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={exporting || filteredDrivers.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#16A34A] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Export Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exporting || filteredDrivers.length === 0}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Export PDF Document"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>

            {canAddDriver && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => navigate("/drivers/new")}
              >
                Add Driver
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            placeholder="Search name, mobile, vehicle, city..."
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
              { value: "Pending Approval", label: "Pending Approval" },
              { value: "Rejected", label: "Rejected" },
            ]}
          />

          <Select
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: "All Vehicle Types" },
              ...vehicleTypes.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {isSuperAdmin && selectedDriverIds.length > 0 && (
        <div className="bg-[#FFF1F0] border border-[#FCA5A5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E53935]">
            <CheckSquare className="w-5 h-5 text-[#E53935]" />
            <span>Selected: {selectedDriverIds.length} Drivers</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={X}
              onClick={() => setSelectedDriverIds([])}
            >
              Clear
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              Archive / Delete Selected ({selectedDriverIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-[#E53935] animate-spin" />
            <p className="text-xs text-[#6B7280]">Loading driver roster...</p>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={paginatedDrivers}
              keyField="id"
              selectable={isSuperAdmin}
              selectedIds={selectedDriverIds}
              onSelectionChange={setSelectedDriverIds}
              emptyMessage="No drivers registered yet."
              emptyDescription="Click 'Add Driver' above to onboard the first delivery driver into the fleet."
            />

            {filteredDrivers.length > pageSize && (
              <div className="p-4 border-t border-[#E5E7EB]">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggle Status Confirmation */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setDriverToToggle(null);
        }}
        onConfirm={handleToggleStatus}
        type={driverToToggle?.status === "Active" ? "danger" : "default"}
        title={
          driverToToggle?.status === "Active"
            ? `Deactivate ${driverToToggle?.name}?`
            : `Activate ${driverToToggle?.name}?`
        }
        message={
          driverToToggle?.status === "Active"
            ? "Deactivated drivers will no longer appear in the delivery assignment dropdowns."
            : "Activating this driver will make them immediately available for new delivery dispatches."
        }
        confirmText={
          driverToToggle?.status === "Active" ? "Deactivate" : "Activate"
        }
      />

      {/* Rejection Modal */}
      {rejectModalOpen && driverToReject && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-[#202124]">
              Reject Driver Application: {driverToReject.name}
            </h3>
            <p className="text-xs text-[#6B7280]">
              Please provide a clear reason for rejection (required).
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Incomplete KYC documentation, invalid vehicle insurance..."
              rows={3}
              className="w-full text-xs p-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#E53935]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRejectModalOpen(false);
                  setDriverToReject(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Complete Bank Details Modal */}
      <Modal
        isOpen={bankModalOpen}
        onClose={() => {
          setBankModalOpen(false);
          setSelectedDriverBank(null);
        }}
        title={`Banking Credentials: ${selectedDriverBank?.driver?.name || "Driver"}`}
        description="Confidential payment remittance details"
        size="md"
        footer={
          <div className="flex items-center justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setBankModalOpen(false);
                setSelectedDriverBank(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {!canViewBankDetails ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  Access Restricted
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your account does not possess the <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">drivers.viewBankDetails</code> authorization required to view complete confidential banking accounts.
                </p>
                <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-800">
                  <span className="font-semibold">Masked Record:</span>{" "}
                  <span className="font-mono">{selectedDriverBank?.driver?.maskedAccount || "—"}</span>
                </div>
              </div>
            </div>
          ) : loadingBankDoc ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[#E53935] animate-spin" />
              <p className="text-xs text-[#6B7280]">
                Fetching private banking credentials from secure storage...
              </p>
            </div>
          ) : (
            <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#E5E7EB] space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
                <Landmark className="w-5 h-5 text-[#E53935]" />
                <div>
                  <div className="text-sm font-bold text-[#202124]">
                    {selectedDriverBank?.bank?.bankName || selectedDriverBank?.driver?.bankName || "Bank Account"}
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    Branch: {selectedDriverBank?.bank?.branchName || selectedDriverBank?.driver?.branchName || "Main"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Account Holder Name</span>
                  <span className="font-semibold text-[#202124]">
                    {selectedDriverBank?.bank?.accountHolderName ||
                      selectedDriverBank?.driver?.accountHolderName ||
                      selectedDriverBank?.driver?.name ||
                      "—"}
                  </span>
                </div>

                <div>
                  <span className="text-[#6B7280] block text-[11px]">IFSC Code</span>
                  <span className="font-mono font-semibold text-[#202124]">
                    {selectedDriverBank?.bank?.ifscCode || selectedDriverBank?.driver?.ifscCode || "—"}
                  </span>
                </div>

                <div className="col-span-2 bg-white p-3 rounded-lg border border-[#E5E7EB]">
                  <span className="text-[#6B7280] block text-[11px]">Full Account Number</span>
                  <span className="font-mono font-bold text-sm text-[#202124] tracking-wider select-all">
                    {selectedDriverBank?.bank?.accountNumber ||
                      selectedDriverBank?.driver?.maskedAccount ||
                      "—"}
                  </span>
                </div>

                {selectedDriverBank?.bank?.upiId || selectedDriverBank?.driver?.upiId ? (
                  <div className="col-span-2">
                    <span className="text-[#6B7280] block text-[11px]">UPI Virtual Payment Address</span>
                    <span className="font-mono font-semibold text-[#E53935] select-all">
                      {selectedDriverBank?.bank?.upiId || selectedDriverBank?.driver?.upiId}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Driver Delete / Archive Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(driverToDelete)}
        title={
          driverSafetyInfo?.canHardDelete
            ? "Delete Driver Record"
            : "Archive Driver (Safeguard History)"
        }
        message={
          driverSafetyInfo?.canHardDelete
            ? "Are you sure you want to permanently delete this driver? All registration and bank details will be purged from Firestore."
            : `This driver has ${driverSafetyInfo?.deliveryCount || 0} deliveries and ${driverSafetyInfo?.paymentCount || 0} financial ledger records. To safeguard audit integrity, this driver will be safely archived (soft-deleted).`
        }
        recordType="Fleet Driver"
        recordTitle={
          driverToDelete
            ? `${driverToDelete.name} (${driverToDelete.code || driverToDelete.id})`
            : ""
        }
        confirmText={
          driverSafetyInfo?.canHardDelete ? "Delete Driver" : "Archive Driver Safely"
        }
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDeleteDriver}
        onCancel={() => setDriverToDelete(null)}
      />

      {/* Driver Bulk Delete / Archive Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        title="Confirm Bulk Driver Deletion / Archiving"
        message="You are about to process multiple driver records. Drivers with associated deliveries or payments will be safely archived, while unlinked drivers will be deleted. This operation updates real Firestore data."
        recordType="Fleet Drivers"
        selectedCount={selectedDriverIds.length}
        requireKeyword="DELETE"
        confirmText={`Process ${selectedDriverIds.length} Drivers`}
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default Drivers;
