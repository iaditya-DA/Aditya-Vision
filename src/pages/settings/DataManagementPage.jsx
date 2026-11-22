import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  CheckSquare,
  X,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Users,
  CreditCard,
  Lock,
  History,
  FileSpreadsheet,
  Package,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DataTable from "../../components/common/DataTable";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmptyState from "../../components/common/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { formatDate, formatCurrency } from "../../utils/formatters";
import {
  getDataManagementStats,
  getAuditLogs,
  checkDriverDeletionSafety,
  deleteDelivery,
  deleteDeliveriesBulk,
  deleteDriver,
  deleteDriversBulk,
  deletePaymentRequest,
  deletePaymentRequestsBulk,
  deleteSavedReport,
  deleteSavedReportsBulk,
} from "../../services/deleteService";
import { getDeliveriesPaged } from "../../services/deliveryService";
import { getDriversPaged } from "../../services/driverService";
import { getPaymentRequestsPaged } from "../../services/requestService";
import { getSavedReports } from "../../services/reportService";

const PAGE_SIZE = 10;

const DataManagementPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState("deliveries"); // 'deliveries' | 'drivers' | 'paymentRequests' | 'savedReports' | 'auditLogs'

  // Firestore Live Statistics
  const [stats, setStats] = useState({
    deliveriesCount: 0,
    driversCount: 0,
    customersCount: 0,
    usersCount: 0,
    paymentsCount: 0,
    savedReportsCount: 0,
    auditLogsCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Tab Data States
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Selection States per Tab
  const [selectedIds, setSelectedIds] = useState([]);

  // Dialog States
  const [singleTarget, setSingleTarget] = useState(null); // { id, name, type }
  const [driverSafetyInfo, setDriverSafetyInfo] = useState(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Load Live Collection Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getDataManagementStats();
      setStats(data);
    } catch (err) {
      console.warn("Failed to load data stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 2. Load Selected Tab Records
  const loadTabData = useCallback(async () => {
    setTabLoading(true);
    setSelectedIds([]);
    try {
      if (activeTab === "deliveries") {
        const res = await getDeliveriesPaged({ pageSize: 100 });
        setDeliveries(res.deliveries || []);
      } else if (activeTab === "drivers") {
        const res = await getDriversPaged({ pageSize: 100 });
        setDrivers(res.drivers || []);
      } else if (activeTab === "paymentRequests") {
        const res = await getPaymentRequestsPaged({ pageSize: 100 });
        setPaymentRequests(res.requests || []);
      } else if (activeTab === "savedReports") {
        const res = await getSavedReports();
        setSavedReports(res || []);
      } else if (activeTab === "auditLogs") {
        const res = await getAuditLogs({ pageSize: 100 });
        setAuditLogs(res || []);
      }
    } catch (err) {
      console.error(`Error loading ${activeTab}:`, err);
      toast.error(`Could not load ${activeTab} data`);
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadStats();
    });
  }, [loadStats]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadTabData();
      setCurrentPage(1);
      setSearchQuery("");
      setStatusFilter("");
    });
  }, [loadTabData]);

  // Tab Filtering & Pagination
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeTab === "deliveries") {
      return deliveries.filter((d) => {
        const matchQ =
          !q ||
          d.id?.toLowerCase().includes(q) ||
          d.invoiceNumber?.toLowerCase().includes(q) ||
          d.customerName?.toLowerCase().includes(q) ||
          d.productName?.toLowerCase().includes(q);
        const matchStatus = !statusFilter || d.status === statusFilter;
        return matchQ && matchStatus;
      });
    }

    if (activeTab === "drivers") {
      return drivers.filter((d) => {
        const matchQ =
          !q ||
          d.name?.toLowerCase().includes(q) ||
          d.code?.toLowerCase().includes(q) ||
          d.mobile?.includes(q) ||
          d.vehicleNumber?.toLowerCase().includes(q);
        const matchStatus = !statusFilter || d.status === statusFilter;
        return matchQ && matchStatus;
      });
    }

    if (activeTab === "paymentRequests") {
      return paymentRequests.filter((r) => {
        const matchQ =
          !q ||
          r.id?.toLowerCase().includes(q) ||
          r.driverName?.toLowerCase().includes(q) ||
          r.deliveryReference?.toLowerCase().includes(q);
        const matchStatus = !statusFilter || r.status === statusFilter;
        return matchQ && matchStatus;
      });
    }

    if (activeTab === "savedReports") {
      return savedReports.filter((r) => {
        return (
          !q ||
          r.name?.toLowerCase().includes(q) ||
          r.title?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q)
        );
      });
    }

    if (activeTab === "auditLogs") {
      return auditLogs.filter((log) => {
        return (
          !q ||
          log.action?.toLowerCase().includes(q) ||
          log.collection?.toLowerCase().includes(q) ||
          log.performedByName?.toLowerCase().includes(q) ||
          log.reason?.toLowerCase().includes(q) ||
          log.documentId?.toLowerCase().includes(q)
        );
      });
    }

    return [];
  }, [
    activeTab,
    deliveries,
    drivers,
    paymentRequests,
    savedReports,
    auditLogs,
    searchQuery,
    statusFilter,
  ]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  // Single Delete Initializer
  const handleInitiateSingleDelete = useCallback(async (record) => {
    if (activeTab === "drivers") {
      try {
        const safety = await checkDriverDeletionSafety(record.id);
        setDriverSafetyInfo(safety);
      } catch {
        setDriverSafetyInfo({ canHardDelete: false });
      }
    }
    setSingleTarget(record);
  }, [activeTab]);

  // Confirm Single Delete
  const handleConfirmSingleDelete = async ({ reason } = {}) => {
    if (!singleTarget) return;
    setIsDeleting(true);
    try {
      if (activeTab === "deliveries") {
        await deleteDelivery(singleTarget.id, currentUser, reason);
        setDeliveries((prev) => prev.filter((d) => d.id !== singleTarget.id));
        toast.success(`Delivery #${singleTarget.id} permanently deleted`);
      } else if (activeTab === "drivers") {
        const res = await deleteDriver(singleTarget.id, currentUser, { reason });
        if (res.action === "archived") {
          toast.success(
            `${singleTarget.name} safely archived to preserve dispatch history.`
          );
        } else {
          toast.success(`${singleTarget.name} permanently deleted.`);
        }
        setDrivers((prev) => prev.filter((d) => d.id !== singleTarget.id));
      } else if (activeTab === "paymentRequests") {
        await deletePaymentRequest(singleTarget.id, currentUser, reason);
        setPaymentRequests((prev) => prev.filter((r) => r.id !== singleTarget.id));
        toast.success(`Payment request #${singleTarget.id} deleted`);
      } else if (activeTab === "savedReports") {
        await deleteSavedReport(singleTarget.id, currentUser, reason);
        setSavedReports((prev) => prev.filter((r) => r.id !== singleTarget.id));
        toast.success(`Saved report "${singleTarget.name || singleTarget.title}" deleted`);
      }

      setSingleTarget(null);
      setSelectedIds((prev) => prev.filter((id) => id !== singleTarget.id));
      loadStats();
    } catch (err) {
      toast.error(err.message || "Failed to delete record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm Bulk Delete (Requires typing "DELETE")
  const handleConfirmBulkDelete = async ({ reason } = {}) => {
    if (!selectedIds.length) return;
    setIsDeleting(true);
    try {
      if (activeTab === "deliveries") {
        const res = await deleteDeliveriesBulk(selectedIds, currentUser, reason);
        const deletedSet = new Set(selectedIds);
        setDeliveries((prev) => prev.filter((d) => !deletedSet.has(d.id)));
        toast.success(`Permanently deleted ${res.count} deliveries`);
      } else if (activeTab === "drivers") {
        const res = await deleteDriversBulk(selectedIds, currentUser, reason);
        const deletedSet = new Set(selectedIds);
        setDrivers((prev) => prev.filter((d) => !deletedSet.has(d.id)));
        toast.success(
          `Processed ${res.count} drivers (${res.archivedCount} archived, ${res.deletedCount} deleted)`
        );
      } else if (activeTab === "paymentRequests") {
        const res = await deletePaymentRequestsBulk(selectedIds, currentUser, reason);
        const deletedSet = new Set(selectedIds);
        setPaymentRequests((prev) => prev.filter((r) => !deletedSet.has(r.id)));
        toast.success(`Deleted ${res.count} payment requests`);
      } else if (activeTab === "savedReports") {
        const res = await deleteSavedReportsBulk(selectedIds, currentUser, reason);
        const deletedSet = new Set(selectedIds);
        setSavedReports((prev) => prev.filter((r) => !deletedSet.has(r.id)));
        toast.success(`Deleted ${res.count} saved reports`);
      }

      setSelectedIds([]);
      setBulkDialogOpen(false);
      loadStats();
    } catch (err) {
      toast.error(err.message || "Bulk deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamic Column Definitions
  const columns = useMemo(() => {
    if (activeTab === "deliveries") {
      return [
        {
          key: "id",
          label: "Delivery ID",
          render: (val) => (
            <span className="font-mono font-bold text-[#202124] text-xs">
              {val}
            </span>
          ),
        },
        {
          key: "invoiceNumber",
          label: "Invoice No",
          render: (val) => (
            <span className="font-mono text-xs text-[#6B7280]">{val || "—"}</span>
          ),
        },
        {
          key: "customerName",
          label: "Customer",
          render: (val, row) => (
            <div>
              <div className="font-semibold text-xs text-[#202124]">{val}</div>
              <div className="text-[11px] text-[#6B7280] font-mono">
                {row.customerMobile || "—"}
              </div>
            </div>
          ),
        },
        {
          key: "productName",
          label: "Product",
          render: (val, row) => (
            <div>
              <div className="text-xs font-medium text-[#202124]">{val}</div>
              <div className="text-[11px] text-[#6B7280]">{row.category}</div>
            </div>
          ),
        },
        {
          key: "deliveryDate",
          label: "Date",
          render: (val) => (
            <span className="text-xs text-[#6B7280]">{formatDate(val)}</span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (val) => <StatusBadge status={val} size="sm" />,
        },
        {
          key: "actions",
          label: "Actions",
          align: "right",
          render: (_, row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleInitiateSingleDelete(row);
                }}
                className="p-1.5 text-gray-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Delivery"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
        },
      ];
    }

    if (activeTab === "drivers") {
      return [
        {
          key: "name",
          label: "Driver Name",
          render: (val, row) => (
            <div>
              <div className="font-semibold text-xs text-[#202124]">{val}</div>
              <div className="text-[11px] text-[#6B7280] font-mono">
                {row.code || row.id} • {row.mobile}
              </div>
            </div>
          ),
        },
        {
          key: "vehicle",
          label: "Vehicle",
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
          key: "city",
          label: "City / Branch",
          render: (val) => (
            <span className="text-xs text-[#202124]">{val || "Benipatti"}</span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (val) => <StatusBadge status={val} type="driver" size="sm" />,
        },
        {
          key: "actions",
          label: "Actions",
          align: "right",
          render: (_, row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleInitiateSingleDelete(row);
                }}
                className="p-1.5 text-gray-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete or Archive Driver"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
        },
      ];
    }

    if (activeTab === "paymentRequests") {
      return [
        {
          key: "id",
          label: "Request ID",
          render: (val) => (
            <span className="font-mono font-bold text-xs text-[#202124]">
              {val}
            </span>
          ),
        },
        {
          key: "driverName",
          label: "Driver",
          render: (val) => (
            <span className="text-xs font-semibold text-[#202124]">{val}</span>
          ),
        },
        {
          key: "requestedAmount",
          label: "Amount",
          render: (val) => (
            <span className="text-xs font-bold text-[#E53935]">
              {formatCurrency(val)}
            </span>
          ),
        },
        {
          key: "requestDate",
          label: "Date",
          render: (val) => (
            <span className="text-xs text-[#6B7280]">{formatDate(val)}</span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (val) => <StatusBadge status={val} size="sm" />,
        },
        {
          key: "actions",
          label: "Actions",
          align: "right",
          render: (_, row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleInitiateSingleDelete(row);
                }}
                className="p-1.5 text-gray-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Payment Request"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
        },
      ];
    }

    if (activeTab === "savedReports") {
      return [
        {
          key: "name",
          label: "Report Name",
          render: (val, row) => (
            <div>
              <div className="font-semibold text-xs text-[#202124]">
                {val || row.title}
              </div>
              <div className="text-[11px] text-[#6B7280]">
                {row.description || "Custom filter view"}
              </div>
            </div>
          ),
        },
        {
          key: "category",
          label: "Category",
          render: (val) => (
            <span className="text-xs text-[#6B7280]">{val || "General"}</span>
          ),
        },
        {
          key: "createdAt",
          label: "Saved Date",
          render: (val) => (
            <span className="text-xs text-[#6B7280]">
              {val ? formatDate(val) : "—"}
            </span>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          align: "right",
          render: (_, row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleInitiateSingleDelete(row);
                }}
                className="p-1.5 text-gray-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Saved Report"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
        },
      ];
    }

    if (activeTab === "auditLogs") {
      return [
        {
          key: "timestamp",
          label: "Timestamp",
          render: (val) => (
            <div className="text-xs text-[#202124] font-mono">
              {val ? new Date(val).toLocaleString("en-IN") : "Recorded"}
            </div>
          ),
        },
        {
          key: "action",
          label: "Action",
          render: (val) => {
            const isPurge = val?.includes("PERMANENT") || val?.includes("DELETE");
            return (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                  isPurge
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {val}
              </span>
            );
          },
        },
        {
          key: "performedByName",
          label: "Operator",
          render: (val, row) => (
            <div>
              <div className="font-semibold text-xs text-[#202124]">
                {val || "Super Admin"}
              </div>
              <div className="text-[11px] text-[#6B7280] font-mono">
                {row.performedByEmail || "—"}
              </div>
            </div>
          ),
        },
        {
          key: "collection",
          label: "Collection",
          render: (val) => (
            <span className="text-xs font-mono font-medium text-[#202124]">
              {val}
            </span>
          ),
        },
        {
          key: "target",
          label: "Record / Count",
          render: (_, row) => (
            <span className="text-xs font-mono text-[#6B7280]">
              {row.documentId ? `#${row.documentId}` : `${row.count} items`}
            </span>
          ),
        },
        {
          key: "reason",
          label: "Audit Note / Reason",
          render: (val) => (
            <span className="text-xs text-[#6B7280] italic">
              {val || "Standard admin cleanup"}
            </span>
          ),
        },
      ];
    }

    return [];
  }, [activeTab, handleInitiateSingleDelete]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Data Management & System Cleanup"
        description="Inspect Cloud Firestore collection metrics, archive historical entities, and permanently purge obsolete business records with full audit safety."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={statsLoading || tabLoading}
              onClick={() => {
                loadStats();
                loadTabData();
              }}
            >
              Refresh Counts
            </Button>
            <Link
              to="/settings"
              className="px-3 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#202124] hover:bg-gray-100 rounded-xl border border-[#E5E7EB] transition-colors"
            >
              Settings Hub
            </Link>
          </div>
        }
      />

      {/* 7 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Deliveries */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Deliveries</span>
            <Package className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.deliveriesCount}
          </div>
          <div className="text-[10px] text-[#6B7280]">Dispatch orders</div>
        </div>

        {/* Drivers */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Drivers</span>
            <Truck className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.driversCount}
          </div>
          <div className="text-[10px] text-[#6B7280]">Fleet personnel</div>
        </div>

        {/* Customers */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Customers</span>
            <Users className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.customersCount}
          </div>
          <div className="text-[10px] text-[#6B7280]">Unique clients</div>
        </div>

        {/* Users & Staff */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Users & Staff</span>
            <ShieldCheck className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.usersCount}
          </div>
          <div className="text-[10px] text-[#6B7280]">Console accounts</div>
        </div>

        {/* Payment History (Audit Locked) */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1 relative">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Payments</span>
            <Lock className="w-3.5 h-3.5 text-amber-600" title="Audit-locked: Hard deletes forbidden" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.paymentsCount}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Audit Locked
          </div>
        </div>

        {/* Saved Reports */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Reports</span>
            <FileSpreadsheet className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.savedReportsCount}
          </div>
          <div className="text-[10px] text-[#6B7280]">Saved templates</div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#6B7280]">
            <span className="text-[11px] font-bold uppercase">Audit Logs</span>
            <History className="w-4 h-4 text-[#E53935]" />
          </div>
          <div className="text-2xl font-bold text-[#202124]">
            {statsLoading ? "—" : stats.auditLogsCount}
          </div>
          <div className="text-[10px] text-[#16A34A] font-semibold">Immutable</div>
        </div>
      </div>

      {/* Compliance / Safety Notice */}
      <div className="bg-[#FFF8F7] border border-[#FCA5A5]/60 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#E53935] shrink-0 mt-0.5" />
        <div className="text-xs text-[#202124] leading-relaxed">
          <span className="font-bold text-[#E53935]">Data Integrity Safeguards Active: </span>
          Bulk deletions require strictly typing <code className="bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB] font-bold text-[#E53935]">DELETE</code> to prevent accidental loss. Drivers with completed deliveries or financial ledgers are automatically archived rather than deleted to protect historical GST and dispatch invoices. All actions are indelibly recorded in the immutable Audit Trail.
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("deliveries")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "deliveries"
              ? "bg-[#FFF1F0] text-[#E53935] shadow-2xs"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Deliveries ({stats.deliveriesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "drivers"
              ? "bg-[#FFF1F0] text-[#E53935] shadow-2xs"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Drivers ({stats.driversCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("paymentRequests")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "paymentRequests"
              ? "bg-[#FFF1F0] text-[#E53935] shadow-2xs"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Requests</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("savedReports")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "savedReports"
              ? "bg-[#FFF1F0] text-[#E53935] shadow-2xs"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Saved Reports ({stats.savedReportsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("auditLogs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "auditLogs"
              ? "bg-[#FFF1F0] text-[#E53935] shadow-2xs"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail ({stats.auditLogsCount})</span>
        </button>
      </div>

      {/* Tab Filter Toolbar (For manageable tabs) */}
      {activeTab !== "auditLogs" && (
        <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                setCurrentPage(1);
              }}
              placeholder={`Search ${activeTab}...`}
            />
          </div>

          {(activeTab === "deliveries" || activeTab === "drivers" || activeTab === "paymentRequests") && (
            <div className="w-48">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  ...(activeTab === "deliveries"
                    ? [
                        { value: "Pending", label: "Pending" },
                        { value: "Out for Delivery", label: "Out for Delivery" },
                        { value: "Delivered", label: "Delivered" },
                        { value: "Cancelled", label: "Cancelled" },
                      ]
                    : activeTab === "drivers"
                    ? [
                        { value: "Active", label: "Active" },
                        { value: "Inactive", label: "Inactive" },
                        { value: "Archived", label: "Archived" },
                      ]
                    : [
                        { value: "Pending", label: "Pending" },
                        { value: "Approved", label: "Approved" },
                        { value: "Rejected", label: "Rejected" },
                      ]),
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* Bulk Action Bar (when selectable tab and items selected) */}
      {activeTab !== "auditLogs" && selectedIds.length > 0 && (
        <div className="bg-[#FFF1F0] border border-[#FCA5A5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E53935]">
            <CheckSquare className="w-5 h-5 text-[#E53935]" />
            <span>
              Selected: {selectedIds.length}{" "}
              {activeTab === "deliveries"
                ? "Deliveries"
                : activeTab === "drivers"
                ? "Drivers"
                : activeTab === "paymentRequests"
                ? "Payment Requests"
                : "Reports"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={X}
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setBulkDialogOpen(true)}
            >
              Delete Selected ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        {tabLoading ? (
          <div className="py-20 text-center text-xs text-[#6B7280]">
            <RefreshCw className="w-6 h-6 text-[#E53935] animate-spin mx-auto mb-2" />
            Loading {activeTab} data...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title={`No ${activeTab} records found`}
              description="There are no records matching your current filter criteria."
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={paginatedData}
              keyField="id"
              selectable={activeTab !== "auditLogs"}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {filteredData.length > PAGE_SIZE && (
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
        open={Boolean(singleTarget)}
        title={
          activeTab === "drivers" && !driverSafetyInfo?.canHardDelete
            ? "Archive Driver (Data Integrity Safeguard)"
            : "Permanently Delete Record"
        }
        message={
          activeTab === "drivers" && !driverSafetyInfo?.canHardDelete
            ? `This driver has ${driverSafetyInfo?.deliveryCount || 0} deliveries and ${driverSafetyInfo?.paymentCount || 0} financial ledger records. To prevent orphan records, the driver will be archived rather than purged.`
            : "Are you sure you want to permanently delete this record? This action will remove the document directly from Firestore."
        }
        recordType={
          activeTab === "deliveries"
            ? "Delivery Order"
            : activeTab === "drivers"
            ? "Fleet Driver"
            : activeTab === "paymentRequests"
            ? "Payment Request"
            : "Saved Report"
        }
        recordTitle={
          singleTarget
            ? singleTarget.name ||
              singleTarget.title ||
              singleTarget.customerName ||
              `#${singleTarget.id}`
            : ""
        }
        confirmText={
          activeTab === "drivers" && !driverSafetyInfo?.canHardDelete
            ? "Archive Driver"
            : "Delete Record"
        }
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmSingleDelete}
        onCancel={() => setSingleTarget(null)}
      />

      {/* Bulk Delete Confirm Dialog with Keyword "DELETE" Gate */}
      <ConfirmDialog
        open={bulkDialogOpen}
        title={`Confirm Bulk Deletion (${selectedIds.length} Records)`}
        message="You are about to execute a bulk deletion on actual Firebase documents. This operation cannot be reversed."
        recordType={
          activeTab === "deliveries"
            ? "Customer Deliveries"
            : activeTab === "drivers"
            ? "Fleet Drivers (Archived if linked)"
            : activeTab === "paymentRequests"
            ? "Payment Requisitions"
            : "Saved Reports"
        }
        selectedCount={selectedIds.length}
        requireKeyword="DELETE"
        confirmText={`Delete ${selectedIds.length} Records`}
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDialogOpen(false)}
      />
    </div>
  );
};

export default DataManagementPage;
