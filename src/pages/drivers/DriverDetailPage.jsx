import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone,
  Truck,
  Landmark,
  Edit,
  UserX,
  UserCheck,
  Loader2,
  Trash2,
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  getDriverById,
  getDriverBankDetails,
  updateDriver,
} from "../../services/driverService";
import { getDriverLedgerData } from "../../services/paymentService";
import { getDeliveriesPaged } from "../../services/deliveryService";
import {
  deleteDriver,
  checkDriverDeletionSafety,
} from "../../services/deleteService";

const DriverDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const canViewBank = isSuperAdmin || hasPermission("drivers.viewBankDetails");
  const canDelete = isSuperAdmin || hasPermission("drivers.delete") || hasPermission("drivers");

  const [driver, setDriver] = useState(null);
  const [bank, setBank] = useState(null);
  const [ledger, setLedger] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    totalEarnings: 0,
    totalPaid: 0,
    outstandingBalance: 0,
    advanceAmount: 0,
    recentPayments: [],
  });
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("deliveries");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [safetyInfo, setSafetyInfo] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [driverDoc, bankDoc, ledgerData, deliveriesPaged] = await Promise.all([
        getDriverById(id),
        canViewBank ? getDriverBankDetails(id) : Promise.resolve(null),
        getDriverLedgerData(id),
        getDeliveriesPaged({ driverId: id, pageSize: 50 }),
      ]);
      setDriver(driverDoc);
      setBank(bankDoc);
      setLedger(ledgerData);
      setDeliveries(deliveriesPaged.deliveries);
    } catch (err) {
      console.error(err);
      toast.error("Could not load driver details");
    } finally {
      setLoading(false);
    }
  }, [id, canViewBank, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadAllData();
    });
  }, [loadAllData]);

  const handleToggleStatus = async () => {
    if (!driver) return;
    const newStatus = driver.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDriver(driver.id, { status: newStatus });
      toast.success(`${driver.name} status updated to ${newStatus}.`);
      setConfirmOpen(false);
      await loadAllData();
    } catch (err) {
      toast.error(err.message || "Failed to update driver status");
    }
  };

  const handleInitiateDelete = async () => {
    try {
      const safety = await checkDriverDeletionSafety(driver.id);
      setSafetyInfo(safety);
      setDeleteDialogOpen(true);
    } catch (err) {
      console.error(err);
      setSafetyInfo({ canHardDelete: false, reason: "Error evaluating safety" });
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async ({ reason } = {}) => {
    setIsDeleting(true);
    try {
      const res = await deleteDriver(driver.id, currentUser, { reason });
      if (res.action === "archived") {
        toast.success(
          `${driver.name} has been archived to preserve historical delivery records.`
        );
      } else {
        toast.success(`${driver.name} has been deleted permanently.`);
      }
      navigate("/drivers");
    } catch (err) {
      toast.error(err.message || "Failed to delete driver");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading driver record...</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="max-w-[800px] mx-auto text-center py-24 bg-white rounded-2xl border border-[#E5E7EB] p-8">
        <Truck className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#202124]">Driver Not Found</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          No driver was found matching ID <span className="font-mono">{id}</span>.
        </p>
      </div>
    );
  }

  return (
    <FormPage
      title={driver.name}
      backTo="/drivers"
      backLabel="Drivers"
    >
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[#E53935]">
              {driver.code || driver.id}
            </span>
            <span className="text-xs text-[#9CA3AF]">•</span>
            <span className="text-xs font-mono text-[#6B7280]">
              {driver.vehicleNumber}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#202124]">{driver.name}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>{driver.mobile}</span>
            {driver.city && ` • ${driver.city}`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusBadge status={driver.status} type="driver" />

          {isSuperAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={Edit}
              onClick={() => navigate(`/drivers/${driver.id}/edit`)}
            >
              Edit
            </Button>
          )}

          {isSuperAdmin && (
            <>
              <Button
                variant={driver.status === "Active" ? "danger" : "secondary"}
                size="sm"
                icon={driver.status === "Active" ? UserX : UserCheck}
                onClick={() => setConfirmOpen(true)}
              >
                {driver.status === "Active" ? "Deactivate" : "Activate"}
              </Button>

              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Trash2}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleInitiateDelete();
                  }}
                  className="text-[#DC2626] border-[#FCA5A5] hover:bg-red-50 cursor-pointer"
                >
                  Delete / Archive
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Cards (Derived directly from deliveries & payments) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <span className="text-xs text-[#6B7280]">Total Deliveries</span>
          <p className="text-2xl font-bold text-[#202124] mt-1">{ledger.totalDeliveries}</p>
          <span className="text-[11px] text-[#16A34A]">{ledger.completedDeliveries} completed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <span className="text-xs text-[#6B7280]">Total Earnings (₹)</span>
          <p className="text-2xl font-bold text-[#202124] mt-1">{formatCurrency(ledger.totalEarnings)}</p>
          <span className="text-[11px] text-[#6B7280]">From all assigned trips</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <span className="text-xs text-[#6B7280]">Total Disbursed (₹)</span>
          <p className="text-2xl font-bold text-[#16A34A] mt-1">{formatCurrency(ledger.totalPaid)}</p>
          <span className="text-[11px] text-[#6B7280]">Paid out to driver</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <span className="text-xs text-[#6B7280]">Outstanding Due (₹)</span>
          <p className={`text-2xl font-bold mt-1 ${ledger.outstandingBalance > 0 ? "text-[#DC2626]" : "text-[#16A34A]"}`}>
            {formatCurrency(ledger.outstandingBalance)}
          </p>
          <span className="text-[11px] text-[#6B7280]">Balance payable</span>
        </div>
      </div>

      {/* Details & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider">
            Driver Profile
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[#6B7280] block text-[11px]">Vehicle Type</span>
              <span className="font-semibold text-[#202124]">{driver.vehicleType}</span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px]">Plate Number</span>
              <span className="font-mono font-semibold text-[#202124]">{driver.vehicleNumber}</span>
            </div>
            <div>
              <span className="text-[#6B7280] block text-[11px]">Address</span>
              <span className="text-[#202124]">{driver.address}, {driver.city} - {driver.pinCode}</span>
            </div>

            {/* Bank details block */}
            <div className="pt-3 border-t border-[#E5E7EB]">
              <span className="text-xs font-bold text-[#202124] flex items-center gap-1.5 mb-2">
                <Landmark className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Banking Credentials</span>
              </span>

              {canViewBank && bank ? (
                <div className="space-y-1.5 bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <span className="text-[#6B7280] block text-[10px]">Bank & Branch</span>
                    <span className="font-semibold text-[#202124]">{bank.bankName} - {bank.branchName}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block text-[10px]">A/C Number</span>
                    <span className="font-mono font-semibold text-[#202124]">{bank.accountNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block text-[10px]">IFSC Code</span>
                    <span className="font-mono font-semibold text-[#202124]">{bank.ifscCode}</span>
                  </div>
                  {bank.upiId && (
                    <div>
                      <span className="text-[#6B7280] block text-[10px]">UPI VPA</span>
                      <span className="font-mono text-[#E53935]">{bank.upiId}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[#6B7280] text-xs">
                  Account: <span className="font-mono">{driver.maskedAccount || "—"}</span>
                </div>
              )}
            </div>

            {driver.notes && (
              <div className="pt-2 border-t border-[#E5E7EB]">
                <span className="text-[#6B7280] block text-[11px]">Operational Notes</span>
                <p className="text-[#202124] mt-0.5">{driver.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabbed Activity Ledger (Deliveries vs Payments) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden flex flex-col">
          <div className="flex border-b border-[#E5E7EB] bg-[#FAFBFD] px-4 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("deliveries")}
              className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${activeTab === "deliveries"
                ? "border-[#E53935] text-[#E53935]"
                : "border-transparent text-[#6B7280] hover:text-[#202124]"
                }`}
            >
              Trip Deliveries ({deliveries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-4 py-2 font-bold text-xs border-b-2 cursor-pointer transition-colors ${activeTab === "ledger"
                ? "border-[#E53935] text-[#E53935]"
                : "border-transparent text-[#6B7280] hover:text-[#202124]"
                }`}
            >
              Payout Disbursements ({ledger.recentPayments.length})
            </button>
          </div>

          <div className="p-4 flex-1 overflow-x-auto">
            {activeTab === "deliveries" && (
              deliveries.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7280]">
                  No delivery trips assigned to this driver yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-gray-50/50">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Charges</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#E53935]">
                          {del.id}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#202124]">
                          {del.customerName}
                        </td>
                        <td className="py-2.5 px-3 text-[#6B7280] truncate max-w-[180px]">
                          {del.productName}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#202124]">
                          {formatCurrency(del.totalCharges || 0)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={del.status} type="delivery" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === "ledger" && (
              ledger.recentPayments.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B7280]">
                  No payment disbursements recorded for this driver yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-gray-50/50">
                      <th className="py-2.5 px-3">Payment ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Mode & Ref</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {ledger.recentPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#202124]">
                          {pay.id}
                        </td>
                        <td className="py-2.5 px-3 text-[#6B7280]">
                          {formatDate(pay.paymentDate)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[#202124] block">{pay.paymentMode}</span>
                          <span className="text-[11px] font-mono text-[#6B7280]">
                            {pay.utrNumber || pay.chequeNumber || pay.receivedBy || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#16A34A]">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {pay.status || "Recorded"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        type={driver.status === "Active" ? "danger" : "default"}
        title={driver.status === "Active" ? `Deactivate ${driver.name}?` : `Activate ${driver.name}?`}
        message={
          driver.status === "Active"
            ? "Deactivated drivers are hidden from delivery assignment dropdowns."
            : "Activating this driver makes them selectable for trips."
        }
        confirmText={driver.status === "Active" ? "Deactivate" : "Activate"}
      />

      {/* Delete / Archive Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title={
          safetyInfo?.canHardDelete
            ? "Delete Driver Record"
            : "Archive Driver (Safeguard Records)"
        }
        message={
          safetyInfo?.canHardDelete
            ? "Are you sure you want to permanently delete this driver? All registration and bank details will be purged from Firestore."
            : `This driver has ${safetyInfo?.deliveryCount || 0} deliveries and ${safetyInfo?.paymentCount || 0} financial ledger records. To safeguard audit integrity, this driver will be safely archived (soft-deleted).`
        }
        recordType="Fleet Driver"
        recordTitle={`${driver.name} (${driver.code || driver.id})`}
        confirmText={safetyInfo?.canHardDelete ? "Delete Driver" : "Archive Driver Safely"}
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </FormPage>
  );
};

export default DriverDetailPage;
