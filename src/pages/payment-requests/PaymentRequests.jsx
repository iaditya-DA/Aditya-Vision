import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Info,
  FileCheck2,
  ShieldAlert,
  Clock,
  Truck,
  Check,
  X,
  Trash2,
  CheckSquare,
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
import Textarea from "../../components/common/Textarea";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";
import { useToast } from "../../hooks/useToast";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDriversPaged, reviewDriverApproval } from "../../services/driverService";
import {
  deletePaymentRequest,
  deletePaymentRequestsBulk,
} from "../../services/deleteService";

const PAGE_SIZE = 10;

const PaymentRequests = () => {
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const {
    paymentRequests = [],
    approvePaymentRequest,
    rejectPaymentRequest,
    refreshPayments,
  } = usePayments();

  const toast = useToast();

  const [drivers, setDrivers] = useState([]);

  // Selection & Delete state
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDrivers = useCallback(async () => {
    try {
      const res = await getDriversPaged({ pageSize: 100 });
      setDrivers(res.drivers || []);
    } catch (err) {
      console.warn("Failed to load drivers in PaymentRequests:", err);
      setDrivers([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDrivers();
    });
  }, [loadDrivers]);

  const [activeTab, setActiveTab] = useState("requests"); // 'requests' | 'approvals'

  // Payment Requests Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Approve & Reject Dialog States
  const [approveItem, setApproveItem] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Driver Approval States
  const [viewDriver, setViewDriver] = useState(null);
  const [approveDriverItem, setApproveDriverItem] = useState(null);
  const [rejectDriverItem, setRejectDriverItem] = useState(null);
  const [driverRejectReason, setDriverRejectReason] = useState("");
  const [driverRejectError, setDriverRejectError] = useState("");

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return paymentRequests.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.deliveryReference?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchFrom = !dateFrom || r.requestDate >= dateFrom;
      const matchTo = !dateTo || r.requestDate <= dateTo;
      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [paymentRequests, search, statusFilter, dateFrom, dateTo]);

  const handleConfirmDeleteSingle = async ({ reason } = {}) => {
    if (!requestToDelete) return;
    setIsDeleting(true);
    try {
      await deletePaymentRequest(requestToDelete.id, currentUser, reason);
      toast.success(`Payment request #${requestToDelete.id} deleted successfully`);
      setRequestToDelete(null);
      setSelectedRequestIds((prev) => prev.filter((id) => id !== requestToDelete.id));
      await refreshPayments();
    } catch (err) {
      toast.error(err.message || "Failed to delete payment request");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async ({ reason } = {}) => {
    if (!selectedRequestIds.length) return;
    setIsDeleting(true);
    try {
      const result = await deletePaymentRequestsBulk(selectedRequestIds, currentUser, reason);
      setSelectedRequestIds([]);
      setBulkDeleteDialogOpen(false);
      toast.success(`Deleted ${result.count} payment requests`);
      await refreshPayments();
    } catch (err) {
      toast.error(err.message || "Bulk deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE) || 1;
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Pending Items for Approvals Tab
  const pendingDrivers = drivers.filter((d) => d.status === "Pending Approval");
  const pendingRequests = paymentRequests.filter((r) => r.status === "Pending");

  // Payment Request Approval Flow
  const handleApproveRequest = () => {
    if (!approveItem) return;
    approvePaymentRequest(approveItem.id);
    toast.success(`Payment request ${approveItem.id} approved.`);
    setApproveItem(null);
  };

  const handleRejectRequestSubmit = () => {
    if (!rejectReason.trim()) {
      setRejectError("Rejection reason is mandatory.");
      return;
    }
    rejectPaymentRequest(rejectItem.id, rejectReason.trim());
    toast.error(`Payment request ${rejectItem.id} rejected.`);
    setRejectItem(null);
    setRejectReason("");
    setRejectError("");
  };

  // Driver Approval Flow
  const handleApproveDriverConfirm = async () => {
    if (!approveDriverItem) return;
    try {
      await reviewDriverApproval(approveDriverItem.id, true);
      toast.success(
        `Driver ${approveDriverItem.name} approved and marked Active.`,
      );
      setApproveDriverItem(null);
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to approve driver");
    }
  };

  const handleRejectDriverSubmit = async () => {
    if (!driverRejectReason.trim()) {
      setDriverRejectError("Rejection reason is mandatory.");
      return;
    }
    const targetId = approveDriverItem?.id || rejectDriverItem?.id;
    try {
      await reviewDriverApproval(targetId, false, driverRejectReason.trim());
      toast.error(`Driver ${rejectDriverItem?.name || "Driver"} registration rejected.`);
      setRejectDriverItem(null);
      setDriverRejectReason("");
      setDriverRejectError("");
      await loadDrivers();
    } catch (err) {
      toast.error(err.message || "Failed to reject driver");
    }
  };

  // Requests Table Columns
  const columns = [
    { key: "id", label: "Request ID", sortable: true },
    { key: "driverName", label: "Driver", sortable: true },
    { key: "deliveryReference", label: "Delivery Ref", sortable: false },
    {
      key: "requestedAmount",
      label: "Amount",
      sortable: true,
      align: "right",
      render: (val) => (
        <span className="font-semibold text-[#202124]">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "requestDate",
      label: "Request Date",
      sortable: true,
      render: (val) => formatDate(val),
    },
    { key: "requestedBy", label: "Requested By", sortable: false },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate(`/payment-requests/${row.id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isSuperAdmin && row.status === "Pending" && (
            <>
              <button
                type="button"
                onClick={() => setApproveItem(row)}
                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Approve Requisition"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectItem(row);
                  setRejectReason("");
                  setRejectError("");
                }}
                className="p-1.5 rounded-lg text-[#DC2626] hover:bg-red-50 transition-colors"
                title="Reject Requisition"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setRequestToDelete(row)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#DC2626] hover:bg-red-50 transition-colors"
              title="Delete Requisition"
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
        title="Payment Requests & Approvals"
        description="Submit, review and authorize driver trip allowances and requisitions before payment."
        action={
          (isSuperAdmin || hasPermission("paymentRequests")) && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate("/payment-requests/new")}
            >
              New Request
            </Button>
          )
        }
      />

      {/* Super Admin Tab Switcher */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "requests"
              ? "bg-[#FFF1F0] text-[#E53935]"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
              }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>All Requests ({paymentRequests.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "approvals"
              ? "bg-[#FFF1F0] text-[#E53935]"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
              }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Pending Approvals Hub</span>
            {(pendingDrivers.length + pendingRequests.length) > 0 && (
              <span className="px-1.5 py-0.2 bg-[#E53935] text-white text-[10px] font-bold rounded-full">
                {pendingDrivers.length + pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: PAYMENT REQUESTS TABLE */}
      {activeTab === "requests" && (
        <>
          {/* Business Rule Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 shadow-2xs">
            <Info className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <span className="font-semibold">Important Rule:</span> Approving a
              payment request authorizes the requisition but does{" "}
              <span className="font-semibold">not</span> mean the driver has
              received money. Record the actual physical disbursement in{" "}
              <span className="font-semibold">Payment History</span>.
            </p>
          </div>

          {/* Filters Ribbon */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex flex-wrap gap-3 items-center">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setCurrentPage(1);
              }}
              placeholder="Search by ID, driver, delivery ref..."
              className="flex-1 min-w-[200px]"
            />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={["Pending", "Approved", "Rejected"]}
              placeholder="All Statuses"
              className="w-40"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
            />
            {(search || statusFilter || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setCurrentPage(1);
                }}
              >
                Reset
              </Button>
            )}
          </div>

          {/* Bulk Selection Bar */}
          {isSuperAdmin && selectedRequestIds.length > 0 && (
            <div className="bg-[#FFF1F0] border border-[#FCA5A5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#E53935]">
                <CheckSquare className="w-5 h-5 text-[#E53935]" />
                <span>Selected: {selectedRequestIds.length} Payment Requests</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={X}
                  onClick={() => setSelectedRequestIds([])}
                >
                  Clear
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  Delete Selected ({selectedRequestIds.length})
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-2xs">
            <DataTable
              columns={columns}
              data={paginatedRequests}
              keyField="id"
              selectable={isSuperAdmin}
              selectedIds={selectedRequestIds}
              onSelectionChange={setSelectedRequestIds}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRequests.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setCurrentPage(p)}
              className="px-4 border-t border-[#E5E7EB]"
            />
          </div>
        </>
      )}

      {/* TAB 2: PENDING APPROVALS HUB (SUPER ADMIN ONLY) */}
      {activeTab === "approvals" && isSuperAdmin && (
        <div className="space-y-6">
          {/* Approvals Reminder Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-2xs">
            <Clock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">Super Admin Master Queue:</span>{" "}
              Items listed below were submitted by store personnel and godown
              supervisors. Approving drivers activates them on fleet routes.
              Approving payment requests authorizes financial settlement in
              Payment History.
            </p>
          </div>

          {/* SECTION A: PENDING DRIVERS */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#E53935]" />
                <h3 className="font-bold text-sm text-[#202124]">
                  Driver Registrations Pending Approval ({pendingDrivers.length}
                  )
                </h3>
              </div>
              <span className="text-[11px] text-[#6B7280]">
                Submitted by non-admin staff
              </span>
            </div>

            {pendingDrivers.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#6B7280]">
                No pending driver registrations requiring authorization.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDrivers.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#202124]">
                          {d.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#6B7280]">
                          ({d.code})
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                          Pending Approval
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-1 flex flex-wrap gap-x-3">
                        <span>Mobile: {d.mobile}</span>
                        <span>•</span>
                        <span>Vehicle: {d.vehicleType}</span>
                        <span>•</span>
                        <span>City: {d.city}</span>
                        <span>•</span>
                        <span className="text-[#E53935] font-medium">
                          Submitted by: {d.requestedBy || "Staff"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => setViewDriver(d)}
                      >
                        Inspect
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Check}
                        onClick={() => setApproveDriverItem(d)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={X}
                        onClick={() => {
                          setRejectDriverItem(d);
                          setDriverRejectReason("");
                          setDriverRejectError("");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: PENDING PAYMENT REQUESTS */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#E53935]" />
                <h3 className="font-bold text-sm text-[#202124]">
                  Payment Requisitions Pending Authorization (
                  {pendingRequests.length})
                </h3>
              </div>
              <span className="text-[11px] text-[#6B7280]">
                Awaiting requisition signoff
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#6B7280]">
                No pending payment requests awaiting approval.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#202124]">
                          {r.id}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-xs text-[#202124]">
                          {r.driverName}
                        </span>
                        <span className="font-bold text-xs text-[#E53935]">
                          {formatCurrency(r.requestedAmount)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-1 flex flex-wrap gap-x-3">
                        <span>Ref: {r.deliveryReference}</span>
                        <span>•</span>
                        <span>Requested on: {formatDate(r.requestDate)}</span>
                        <span>•</span>
                        <span className="text-blue-700 font-medium">
                          By: {r.requestedBy}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-[11px] text-[#6B7280] mt-1 italic">
                          "{r.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => navigate(`/payment-requests/${r.id}`)}
                      >
                        Details
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Check}
                        onClick={() => setApproveItem(r)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={X}
                        onClick={() => {
                          setRejectItem(r);
                          setRejectReason("");
                          setRejectError("");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VIEW DRIVER DETAILS IN APPROVALS */}
      {viewDriver && (
        <Modal
          isOpen={!!viewDriver}
          onClose={() => setViewDriver(null)}
          title={`Driver Verification – ${viewDriver.name}`}
          size="md"
        >
          <dl className="space-y-3 text-xs">
            {[
              ["Driver Name", viewDriver.name],
              ["Driver Code", viewDriver.code],
              ["Mobile Number", viewDriver.mobile],
              ["Vehicle Model", viewDriver.vehicleType],
              ["Vehicle Reg No.", viewDriver.vehicleNumber || "-"],
              ["Operating City", `${viewDriver.city}, ${viewDriver.state}`],
              ["PIN Code", viewDriver.pinCode],
              ["Bank for Payouts", viewDriver.bankName || "-"],
              ["IFSC Code", viewDriver.ifscCode || "-"],
              ["Submitted By", viewDriver.requestedBy || "Staff"],
              ["Notes", viewDriver.notes || "None"],
            ].map(([label, val]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-36 shrink-0 text-[#6B7280] font-medium">
                  {label}
                </dt>
                <dd className="text-[#202124] font-medium">{val}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {/* CONFIRM APPROVE PAYMENT REQUEST */}
      <ConfirmDialog
        isOpen={!!approveItem}
        onClose={() => setApproveItem(null)}
        onConfirm={handleApproveRequest}
        type="info"
        title="Authorize Payment Request"
        message={`Approve requisition ${approveItem?.id} for ${formatCurrency(approveItem?.requestedAmount)} for driver ${approveItem?.driverName}?\n\nNote: Approving authorizes the requisition. Record the actual disbursement in Payment History.`}
        confirmText="Authorize Request"
      />

      {/* REJECT PAYMENT REQUEST MODAL (MANDATORY REASON) */}
      {rejectItem && (
        <Modal
          isOpen={!!rejectItem}
          onClose={() => {
            setRejectItem(null);
            setRejectReason("");
            setRejectError("");
          }}
          title={`Reject Requisition – ${rejectItem.id}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectItem(null);
                  setRejectReason("");
                  setRejectError("");
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectRequestSubmit}>
                Confirm Rejection
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#6B7280]">
              State the reason for declining this payment requisition. The
              requester will be notified.
            </p>
            <Textarea
              label="Rejection Reason (Mandatory)"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (e.target.value.trim()) setRejectError("");
              }}
              placeholder="e.g. Rate higher than agreed slab, duplicate invoice number..."
              error={rejectError}
              rows={3}
              required
            />
          </div>
        </Modal>
      )}

      {/* CONFIRM APPROVE DRIVER */}
      <ConfirmDialog
        isOpen={!!approveDriverItem}
        onClose={() => setApproveDriverItem(null)}
        onConfirm={handleApproveDriverConfirm}
        type="info"
        title="Approve Driver Registration"
        message={`Approve ${approveDriverItem?.name} (${approveDriverItem?.code})? Their status will become Active and they will be available for delivery dispatch.`}
        confirmText="Approve Driver"
      />

      {/* REJECT DRIVER MODAL (MANDATORY REASON) */}
      {rejectDriverItem && (
        <Modal
          isOpen={!!rejectDriverItem}
          onClose={() => {
            setRejectDriverItem(null);
            setDriverRejectReason("");
            setDriverRejectError("");
          }}
          title={`Reject Driver – ${rejectDriverItem.name}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectDriverItem(null);
                  setDriverRejectReason("");
                  setDriverRejectError("");
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectDriverSubmit}>
                Reject Driver
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#6B7280]">
              Provide a reason for rejecting this driver onboarding. The godown
              supervisor will be notified.
            </p>
            <Textarea
              label="Rejection Reason (Mandatory)"
              value={driverRejectReason}
              onChange={(e) => {
                setDriverRejectReason(e.target.value);
                if (e.target.value.trim()) setDriverRejectError("");
              }}
              placeholder="e.g. Commercial RC verification failed, invalid driving license..."
              error={driverRejectError}
              rows={3}
              required
            />
          </div>
        </Modal>
      )}

      {/* Delete Single Payment Request Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(requestToDelete)}
        title="Delete Payment Request"
        message="Are you sure you want to delete this payment request? The requisition will be permanently removed from Firestore."
        recordType="Payment Requisition"
        recordTitle={
          requestToDelete
            ? `#${requestToDelete.id} — ${requestToDelete.driverName} (${formatCurrency(requestToDelete.requestedAmount)})`
            : ""
        }
        confirmText="Delete Request"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDeleteSingle}
        onCancel={() => setRequestToDelete(null)}
      />

      {/* Bulk Delete Payment Requests Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        title="Confirm Bulk Deletion of Payment Requests"
        message="You are about to permanently purge multiple payment requisitions from the system. This cannot be undone."
        recordType="Payment Requisitions"
        selectedCount={selectedRequestIds.length}
        requireKeyword="DELETE"
        confirmText={`Delete ${selectedRequestIds.length} Requests`}
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default PaymentRequests;
