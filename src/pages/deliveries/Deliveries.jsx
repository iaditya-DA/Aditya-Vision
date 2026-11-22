import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PackagePlus, Loader2 } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DateRangeFilter from "../../components/common/DateRangeFilter";
import DeliveriesTable from "../../components/deliveries/DeliveriesTable";
import Pagination from "../../components/common/Pagination";
import { deliveryStatuses } from "../../constants/appConstants";
import { useToast } from "../../hooks/useToast";
import { getDeliveriesPaged } from "../../services/deliveryService";
import { getActiveDrivers } from "../../services/driverService";

const Deliveries = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const querySearchParam = searchParams.get("search") || "";

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState([]);

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
              onViewDetails={(row) => navigate(`/deliveries/${row.id}`)}
              onUpdateStatus={(row) => navigate(`/deliveries/${row.id}/status`)}
              onEdit={(row) => navigate(`/deliveries/${row.id}/edit`)}
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
    </div>
  );
};

export default Deliveries;
