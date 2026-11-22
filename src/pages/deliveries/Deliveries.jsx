import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PackagePlus, Loader2, Trash2, CheckSquare, X } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DateRangeFilter from "../../components/common/DateRangeFilter";
import DeliveriesTable from "../../components/deliveries/DeliveriesTable";
import Pagination from "../../components/common/Pagination";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { deliveryStatuses } from "../../constants/appConstants";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { getDeliveriesPaged } from "../../services/deliveryService";
import { getActiveDrivers } from "../../services/driverService";
import { deleteDelivery, deleteDeliveriesBulk } from "../../services/deleteService";

const Deliveries = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const canDelete = isSuperAdmin || hasPermission("deliveries.delete") || hasPermission("deliveries");
  const [searchParams] = useSearchParams();
  const querySearchParam = searchParams.get("search") || "";

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState([]);

  // Selection & Delete State
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState([]);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState(querySearchParam);
  const [statusFilter, setStatusFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [delResult, driversList] = await Promise.all([
        getDeliveriesPaged({
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
          driverId: driverFilter,
          startDate,
          endDate,
          pageSize: 100, // Fetch up to 100 recent rows for smooth client filtering
        }),
        getActiveDrivers(),
      ]);
      setDeliveries(delResult.deliveries);
      setActiveDrivers(driversList);
    } catch (err) {
      console.warn("Deliveries load error:", err);
      toast.error("Could not load deliveries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentStatusFilter, driverFilter, startDate, endDate, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, [loadData]);

  // Client-side search across loaded rows
  const filteredDeliveries = useMemo(() => {
    if (!searchQuery.trim()) return deliveries;
    const q = searchQuery.toLowerCase().trim();
    return deliveries.filter((d) => {
      const idMatch = d.id?.toLowerCase().includes(q);
      const invMatch = d.invoiceNumber?.toLowerCase().includes(q);
      const custMatch = d.customerName?.toLowerCase().includes(q);
      const mobMatch = d.customerMobile?.includes(q);
      const prodMatch = d.productName?.toLowerCase().includes(q);
      const drvMatch = d.driverName?.toLowerCase().includes(q);
      return idMatch || invMatch || custMatch || mobMatch || prodMatch || drvMatch;
    });
  }, [deliveries, searchQuery]);

  const totalPages = Math.ceil(filteredDeliveries.length / pageSize) || 1;
  const paginatedDeliveries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, currentPage, pageSize]);

  const handleConfirmSingleDelete = async ({ reason } = {}) => {
    if (!singleDeleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDelivery(singleDeleteTarget.id, currentUser, reason);
      setDeliveries((prev) => prev.filter((d) => d.id !== singleDeleteTarget.id));
      setSelectedDeliveryIds((prev) => prev.filter((id) => id !== singleDeleteTarget.id));
      toast.success(`Delivery #${singleDeleteTarget.id} deleted successfully`);
      setSingleDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || "Failed to delete delivery");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async ({ reason } = {}) => {
    if (!selectedDeliveryIds.length) return;
    setIsDeleting(true);
    try {
      const result = await deleteDeliveriesBulk(selectedDeliveryIds, currentUser, reason);
      const deletedSet = new Set(selectedDeliveryIds);
      setDeliveries((prev) => prev.filter((d) => !deletedSet.has(d.id)));
      setSelectedDeliveryIds([]);
      setBulkDeleteDialogOpen(false);
      toast.success(`Successfully deleted ${result.count} deliveries`);
    } catch (err) {
      toast.error(err.message || "Bulk deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Deliveries"
        description="Create, assign, track and monitor customer appliance orders"
        action={
          <Button
            variant="primary"
            icon={PackagePlus}
            onClick={() => navigate("/deliveries/new")}
          >
            Create Delivery
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchBar
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            placeholder="Search invoice, customer, ID..."
          />

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: "All Delivery Statuses" },
              ...deliveryStatuses.map((s) => ({ value: s, label: s })),
            ]}
          />

          <Select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: "All Payment Statuses" },
              { value: "Paid", label: "Paid" },
              { value: "Partially Paid", label: "Partially Paid" },
              { value: "Unpaid", label: "Unpaid" },
              { value: "Overpaid", label: "Overpaid" },
              { value: "Refunded", label: "Refunded" },
            ]}
          />

          <Select
            value={driverFilter}
            onChange={(e) => {
              setDriverFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: "All Drivers" },
              ...activeDrivers.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.code || d.id})`,
              })),
            ]}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB]">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(val) => {
              setStartDate(val);
              setCurrentPage(1);
            }}
            onEndDateChange={(val) => {
              setEndDate(val);
              setCurrentPage(1);
            }}
          />

          {(statusFilter || paymentStatusFilter || driverFilter || startDate || endDate || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setPaymentStatusFilter("");
                setDriverFilter("");
                setStartDate("");
                setEndDate("");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="text-xs text-[#E53935] hover:underline font-semibold self-end sm:self-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {canDelete && selectedDeliveryIds.length > 0 && (
        <div className="bg-[#FFF1F0] border border-[#FCA5A5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E53935]">
            <CheckSquare className="w-5 h-5 text-[#E53935]" />
            <span>Selected: {selectedDeliveryIds.length} Deliveries</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={X}
              onClick={() => setSelectedDeliveryIds([])}
            >
              Clear
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              Delete Selected ({selectedDeliveryIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Deliveries Table Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-[#E53935] animate-spin" />
            <p className="text-xs text-[#6B7280]">Loading orders from Firestore...</p>
          </div>
        ) : (
          <>
            <DeliveriesTable
              deliveries={paginatedDeliveries}
              selectable={canDelete}
              selectedIds={selectedDeliveryIds}
              onSelectionChange={setSelectedDeliveryIds}
              onViewDetails={(row) => navigate(`/deliveries/${row.id}`)}
              onUpdateStatus={(row) => navigate(`/deliveries/${row.id}/status`)}
              onEdit={(row) => navigate(`/deliveries/${row.id}/edit`)}
              onDelete={canDelete ? (row) => setSingleDeleteTarget(row) : null}
              emptyMessage="No deliveries found"
              emptyDescription="No customer orders recorded yet. Click 'Create Delivery' to log the first shipment."
            />

            {filteredDeliveries.length > pageSize && (
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

      {/* Single Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(singleDeleteTarget)}
        title="Delete Delivery Record"
        message="Are you sure you want to delete this delivery order? This action permanently removes the dispatch record from Firestore."
        recordType="Delivery Order"
        recordTitle={
          singleDeleteTarget
            ? `#${singleDeleteTarget.id} — ${singleDeleteTarget.customerName} (${singleDeleteTarget.productName})`
            : ""
        }
        confirmText="Delete Record"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmSingleDelete}
        onCancel={() => setSingleDeleteTarget(null)}
      />

      {/* Bulk Delete Confirm Dialog with Keyword Gate */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        title="Confirm Bulk Deletion of Deliveries"
        message="You are about to permanently delete multiple delivery records from the system. This action cannot be undone."
        recordType="Customer Deliveries"
        selectedCount={selectedDeliveryIds.length}
        requireKeyword="DELETE"
        confirmText={`Delete ${selectedDeliveryIds.length} Deliveries`}
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default Deliveries;
