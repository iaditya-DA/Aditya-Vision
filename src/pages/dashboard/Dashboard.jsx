import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PackagePlus,
  UserPlus,
  CreditCard,
  Download,
  ArrowRight,
  Truck,
  Users,
  AlertCircle,
  Wallet,
  Loader2,
} from "lucide-react";
import DeliveriesTable from "../../components/deliveries/DeliveriesTable";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { exportToCSV } from "../../utils/exportUtils";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDeliveriesPaged, getDashboardKpiStats } from "../../services/deliveryService";
import { getDriversPaged } from "../../services/driverService";

const Dashboard = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const { getPaymentStatus } = usePaymentStatus();

  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTableTab, setActiveTableTab] = useState("all");
  const [kpiStats, setKpiStats] = useState({
    todayCount: 0,
    inTransitCount: 0,
    deliveredMonthCount: 0,
    paymentDueCount: 0,
    paymentDueAmount: 0,
    statusCounts: {},
  });

  const canCreateDelivery = isSuperAdmin || hasPermission("deliveries");
  const canAddDriver = isSuperAdmin || hasPermission("drivers");
  const canRecordPayment = isSuperAdmin || hasPermission("paymentHistory");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [paged, stats, driversRes] = await Promise.all([
        getDeliveriesPaged({ pageSize: 30 }),
        getDashboardKpiStats(),
        getDriversPaged({ pageSize: 100 }).catch((err) => {
          console.warn("Could not load drivers for dashboard stats:", err);
          return { drivers: [] };
        }),
      ]);
      setDeliveries(paged.deliveries);
      setKpiStats(stats);
      setDrivers(driversRes.drivers || []);
    } catch (err) {
      console.warn("Error loading dashboard data:", err);
      toast.error("Could not load latest dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDashboardData();
    });
  }, [loadDashboardData]);

  // Deliveries filtered by active table tab (latest 10)
  const filteredLatestDeliveries = useMemo(() => {
    let result = deliveries;

    if (activeTableTab === "in-transit") {
      result = deliveries.filter(
        (d) => d.status === "In Transit" || d.status === "Picked Up"
      );
    } else if (activeTableTab === "delivered") {
      result = deliveries.filter((d) => d.status === "Delivered");
    } else if (activeTableTab === "payment-due") {
      result = deliveries.filter((d) => {
        const s = d.paymentSummary?.status || getPaymentStatus(d);
        return s === "Unpaid" || s === "Partially Paid" || s === "Partial";
      });
    }

    return result.slice(0, 10);
  }, [deliveries, activeTableTab, getPaymentStatus]);

  const handleDownloadReport = () => {
    if (filteredLatestDeliveries.length === 0) {
      toast.error("No deliveries available to export");
      return;
    }
    const csvRows = filteredLatestDeliveries.map((del) => {
      const totalCharges =
        del.totalCharges ||
        (Number(del.deliveryCharges) || 0) + (Number(del.additionalCharges) || 0);
      const pStatus = del.paymentSummary?.status || getPaymentStatus(del);
      return {
        "Delivery ID": del.id,
        "Invoice No": del.invoiceNumber,
        "Customer Name": del.customerName,
        "Customer Mobile": del.customerMobile,
        Product: del.productName,
        Category: del.category,
        "Assigned Driver": del.driverName || "Unassigned",
        Date: formatDate(del.deliveryDate),
        "Distance (KM)": del.distanceKm,
        "Total Charges (INR)": totalCharges,
        Status: del.status,
        "Payment Status": pStatus,
      };
    });

    exportToCSV(
      csvRows,
      `aditya-vision-deliveries-${new Date().toISOString().split("T")[0]}`
    );
    toast.success("Deliveries report CSV downloaded.");
  };

  // 1. Total Deliveries & Delivered count
  const totalDeliveriesCount = useMemo(() => {
    const statusCountsSum = Object.values(kpiStats.statusCounts || {}).reduce(
      (sum, val) => sum + (Number(val) || 0),
      0
    );
    return statusCountsSum > 0 ? statusCountsSum : deliveries.length;
  }, [kpiStats.statusCounts, deliveries.length]);

  const deliveredDeliveriesCount = useMemo(() => {
    if (kpiStats.statusCounts && typeof kpiStats.statusCounts["Delivered"] === "number") {
      return kpiStats.statusCounts["Delivered"];
    }
    return deliveries.filter(
      (d) => (d.status || "").trim().toLowerCase() === "delivered"
    ).length;
  }, [kpiStats.statusCounts, deliveries]);

  // 2. Total Active Drivers (Rule: active only if 0 non-completed deliveries)
  const { totalDriversCount, activeDriversCount } = useMemo(() => {
    const busyDriverIds = new Set();

    deliveries.forEach((d) => {
      if (!d.driverId) return;
      const status = (d.status || "").trim().toLowerCase();
      // Every status other than delivered/completed and cancelled is "not completed"
      const isCompleted =
        status === "delivered" ||
        status === "completed" ||
        status === "cancelled";
      if (!isCompleted) {
        busyDriverIds.add(String(d.driverId));
      }
    });

    const uniqueDriverIdsInDeliveries = new Set(
      deliveries.map((d) => String(d.driverId)).filter(Boolean)
    );
    const totalCount =
      drivers.length > 0 ? drivers.length : uniqueDriverIdsInDeliveries.size;

    const activeCount =
      drivers.length > 0
        ? drivers.filter((driver) => !busyDriverIds.has(String(driver.id))).length
        : Math.max(0, totalCount - busyDriverIds.size);

    return {
      totalDriversCount: totalCount,
      activeDriversCount: activeCount,
    };
  }, [drivers, deliveries]);

  // 4. Total Paid to Drivers & count of distinct drivers paid
  const { totalPaidToDrivers, paidDriversCount } = useMemo(() => {
    let totalPaid = 0;
    const paidDriverIds = new Set();

    deliveries.forEach((d) => {
      const paid = Number(d.paymentSummary?.totalPaid) || 0;
      if (paid > 0) {
        totalPaid += paid;
        if (d.driverId) {
          paidDriverIds.add(String(d.driverId));
        }
      }
    });

    return {
      totalPaidToDrivers: totalPaid,
      paidDriversCount: paidDriverIds.size,
    };
  }, [deliveries]);

  return (
    <div className="relative z-10 space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#202124] tracking-tight">
            Namaste, {user?.name || "Team"} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            Operations & delivery overview for Aditya Vision
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {/* Card 1: Total Deliveries */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-2xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[#6B7280] leading-tight">
                Total Deliveries
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 sm:h-9 w-16 sm:w-24 bg-gray-200 animate-pulse rounded-md mt-2" />
            ) : (
              <p className="text-2xl sm:text-3xl font-extrabold text-[#202124] mt-2 tracking-tight">
                {totalDeliveriesCount}
              </p>
            )}
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-3.5 w-16 bg-gray-100 animate-pulse rounded-sm mt-1" />
            ) : (
              <span className="text-[11px] sm:text-xs text-[#6B7280] font-medium block truncate">
                {deliveredDeliveriesCount} delivered
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Active Drivers */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-2xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[#6B7280] leading-tight">
                Total Active Drivers
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 sm:h-9 w-16 sm:w-24 bg-gray-200 animate-pulse rounded-md mt-2" />
            ) : (
              <p className="text-2xl sm:text-3xl font-extrabold text-[#202124] mt-2 tracking-tight">
                {activeDriversCount}
              </p>
            )}
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-3.5 w-20 bg-gray-100 animate-pulse rounded-sm mt-1" />
            ) : (
              <span className="text-[11px] sm:text-xs text-[#6B7280] font-medium block truncate">
                Out of {totalDriversCount} {totalDriversCount === 1 ? "driver" : "drivers"}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Payment Due */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-2xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[#6B7280] leading-tight">
                Payment Due
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E53935] flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 sm:h-9 w-20 sm:w-28 bg-gray-200 animate-pulse rounded-md mt-2" />
            ) : (
              <p className="text-2xl sm:text-3xl font-extrabold text-[#E53935] mt-2 tracking-tight">
                {formatCurrency(kpiStats.paymentDueAmount)}
              </p>
            )}
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-3.5 w-24 bg-gray-100 animate-pulse rounded-sm mt-1" />
            ) : (
              <span className="text-[11px] sm:text-xs text-[#6B7280] font-medium block truncate">
                Across {kpiStats.paymentDueCount} deliveries
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Total Paid to Drivers */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-100 shadow-2xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-[#6B7280] leading-tight">
                Total Paid to Drivers
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 sm:h-9 w-20 sm:w-28 bg-gray-200 animate-pulse rounded-md mt-2" />
            ) : (
              <p className="text-2xl sm:text-3xl font-extrabold text-[#16A34A] mt-2 tracking-tight">
                {formatCurrency(totalPaidToDrivers)}
              </p>
            )}
          </div>
          <div className="mt-1">
            {loading ? (
              <div className="h-3.5 w-16 bg-gray-100 animate-pulse rounded-sm mt-1" />
            ) : (
              <span className="text-[11px] sm:text-xs text-[#6B7280] font-medium block truncate">
                To {paidDriversCount} {paidDriversCount === 1 ? "driver" : "drivers"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* TOP THREE ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-1 pb-1">
        {canCreateDelivery && (
          <button
            type="button"
            onClick={() => navigate("/deliveries/new")}
            className="w-full sm:w-60 md:w-64 h-14 sm:h-16 px-6 rounded-2xl bg-white border-2 border-[#D1D5DB] hover:border-[#E53935] hover:bg-[#FFF8F7] text-[#202124] hover:text-[#E53935] font-semibold text-base sm:text-lg shadow-2xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer group focus:outline-hidden"
          >
            <PackagePlus className="w-5 h-5 text-[#6B7280] group-hover:text-[#E53935] transition-colors shrink-0" />
            <span>Create Delivery</span>
          </button>
        )}

        {canAddDriver && (
          <button
            type="button"
            onClick={() => navigate("/drivers/new")}
            className="w-full sm:w-60 md:w-64 h-14 sm:h-16 px-6 rounded-2xl bg-white border-2 border-[#D1D5DB] hover:border-[#E53935] hover:bg-[#FFF8F7] text-[#202124] hover:text-[#E53935] font-semibold text-base sm:text-lg shadow-2xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer group focus:outline-hidden"
          >
            <UserPlus className="w-5 h-5 text-[#6B7280] group-hover:text-[#E53935] transition-colors shrink-0" />
            <span>Add Driver</span>
          </button>
        )}

        {canRecordPayment && (
          <button
            type="button"
            onClick={() => navigate("/payment-history/new")}
            className="w-full sm:w-60 md:w-64 h-14 sm:h-16 px-6 rounded-2xl bg-white border-2 border-[#D1D5DB] hover:border-[#E53935] hover:bg-[#FFF8F7] text-[#202124] hover:text-[#E53935] font-semibold text-base sm:text-lg shadow-2xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer group focus:outline-hidden"
          >
            <CreditCard className="w-5 h-5 text-[#6B7280] group-hover:text-[#E53935] transition-colors shrink-0" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* RECENT DELIVERIES TABLE CONTAINER */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5">
          <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold text-[#6B7280]">
            <button
              type="button"
              onClick={() => setActiveTableTab("all")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTableTab === "all"
                ? "bg-white text-[#202124] shadow-2xs font-bold"
                : "hover:text-[#202124]"
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab("in-transit")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTableTab === "in-transit"
                ? "bg-white text-[#2563EB] shadow-2xs font-bold"
                : "hover:text-[#202124]"
                }`}
            >
              In Transit
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab("delivered")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTableTab === "delivered"
                ? "bg-white text-[#16A34A] shadow-2xs font-bold"
                : "hover:text-[#202124]"
                }`}
            >
              Delivered
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab("payment-due")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${activeTableTab === "payment-due"
                ? "bg-white text-[#E53935] shadow-2xs font-bold"
                : "hover:text-[#202124]"
                }`}
            >
              Payment Due
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#6B7280] hover:text-[#E53935] transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white self-end sm:self-auto"
            title="Download visible deliveries as CSV"
          >
            <Download className="w-4 h-4 text-[#E53935]" />
            <span>Download report</span>
          </button>
        </div>

        {/* Deliveries Table */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[#E53935] animate-spin" />
              <p className="text-xs text-[#6B7280]">Loading recent deliveries...</p>
            </div>
          ) : (
            <DeliveriesTable
              deliveries={filteredLatestDeliveries}
              onViewDetails={(row) => navigate(`/deliveries/${row.id}`)}
              onUpdateStatus={
                isSuperAdmin
                  ? (row) => navigate(`/deliveries/${row.id}/status`)
                  : null
              }
              onEdit={
                isSuperAdmin
                  ? (row) => navigate(`/deliveries/${row.id}/edit`)
                  : null
              }
              showPaymentStatus={false}
              emptyMessage="No deliveries found"
              emptyDescription="No orders recorded yet. Click 'Create Delivery' to log the first customer order."
            />
          )}

          {/* Card Footer: View All Deliveries Link */}
          <div className="p-4 border-t border-[#E5E7EB] bg-[#FAFBFD] flex items-center justify-between">
            <Link
              to="/deliveries"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E53935] hover:text-[#C62828] hover:underline"
            >
              <span>View all deliveries</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-[11px] text-[#6B7280] font-medium">
              Showing {filteredLatestDeliveries.length} recent orders
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
