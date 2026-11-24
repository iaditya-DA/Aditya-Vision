import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PackagePlus,
  UserPlus,
  CreditCard,
  Download,
  ArrowRight,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import DeliveriesTable from "../../components/deliveries/DeliveriesTable";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { exportToCSV } from "../../utils/exportUtils";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDeliveriesPaged, getDashboardKpiStats } from "../../services/deliveryService";

const Dashboard = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const { getPaymentStatus } = usePaymentStatus();

  const [deliveries, setDeliveries] = useState([]);
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
      const [paged, stats] = await Promise.all([
        getDeliveriesPaged({ pageSize: 30 }),
        getDashboardKpiStats(),
      ]);
      setDeliveries(paged.deliveries);
      setKpiStats(stats);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Today&apos;s Deliveries</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#202124] mt-2">
            {kpiStats.todayCount}
          </p>
          <span className="text-[11px] text-[#6B7280] font-medium">Scheduled today</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">In Transit</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#202124] mt-2">
            {kpiStats.inTransitCount}
          </p>
          <span className="text-[11px] text-[#6B7280] font-medium">Currently on the road</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Payment Due</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E53935] flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#E53935] mt-2">
            {formatCurrency(kpiStats.paymentDueAmount)}
          </p>
          <span className="text-[11px] text-[#6B7280] font-medium">
            Across {kpiStats.paymentDueCount} deliveries
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Delivered (This Month)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#16A34A] mt-2">
            {kpiStats.deliveredMonthCount}
          </p>
          <span className="text-[11px] text-[#6B7280] font-medium">Completed handovers</span>
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
