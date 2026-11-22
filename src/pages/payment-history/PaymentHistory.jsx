import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Users,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DataTable from "../../components/common/DataTable";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDriversPaged } from "../../services/driverService";

const PAGE_SIZE = 10;
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Other"];

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = useAuth();
  const { paymentHistory } = usePayments();
  const payments = useMemo(() => Array.isArray(paymentHistory) ? paymentHistory : [], [paymentHistory]);

  const [drivers, setDrivers] = useState([]);
  const [activeTab, setActiveTab] = useState("transactions"); // 'transactions' | 'ledger'
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadDrivers = useCallback(async () => {
    try {
      const res = await getDriversPaged({ pageSize: 100 });
      setDrivers(res.drivers || []);
    } catch (err) {
      console.warn("Failed to load drivers in PaymentHistory:", err);
      setDrivers([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDrivers();
    });
  }, [loadDrivers]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.driverName.toLowerCase().includes(q) ||
        (p.utrNumber && p.utrNumber.toLowerCase().includes(q));
      const matchMode = !modeFilter || p.paymentMode === modeFilter;
      const matchFrom = !dateFrom || p.paymentDate >= dateFrom;
      const matchTo = !dateTo || p.paymentDate <= dateTo;
      return matchSearch && matchMode && matchFrom && matchTo;
    });
  }, [payments, search, modeFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  const resetFilters = () => {
    setSearch("");
    setModeFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // Ledger data: per driver summary
  const ledgerData = useMemo(() => {
    const driverMap = {};
    (drivers || []).forEach((d) => {
      driverMap[d.id] = {
        driverId: d.id,
        driverName: d.name,
        vehicleType: d.vehicleType,
        totalEarnings: d.totalEarnings,
        totalPaid: d.totalPaid,
        outstandingBalance: d.outstandingBalance,
        advance: 0,
      };
    });
    payments.forEach((p) => {
      if (driverMap[p.driverId] && p.paymentType === "Advance Payment") {
        driverMap[p.driverId].advance += p.amount;
      }
    });
    return Object.values(driverMap);
  }, [drivers, payments]);

  const modeColor = {
    Cash: "bg-emerald-50 text-emerald-700",
    UPI: "bg-blue-50 text-blue-700",
    "Bank Transfer": "bg-purple-50 text-purple-700",
    Other: "bg-gray-100 text-gray-700",
  };

  const paymentTypeColor = {
    "Full Payment": "bg-emerald-50 text-emerald-700",
    "Partial Payment": "bg-amber-50 text-amber-700",
    "Advance Payment": "bg-blue-50 text-blue-700",
  };

  const columns = [
    { key: "id", label: "Transaction ID", sortable: true },
    { key: "driverName", label: "Driver", sortable: true },
    {
      key: "paymentDate",
      label: "Payment Date",
      sortable: true,
      render: (val) => formatDate(val),
    },
    {
      key: "amount",
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
      key: "paymentMode",
      label: "Mode",
      sortable: true,
      render: (val) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${modeColor[val] || "bg-gray-100 text-gray-700"}`}
        >
          {val}
        </span>
      ),
    },
    {
      key: "paymentType",
      label: "Type",
      sortable: false,
      render: (val) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentTypeColor[val] || "bg-gray-100 text-gray-700"}`}
        >
          {val}
        </span>
      ),
    },
    { key: "utrNumber", label: "UTR / Reference", sortable: false },
    { key: "relatedRequestId", label: "Request Ref", sortable: false },
    { key: "recordedBy", label: "Recorded By", sortable: false },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      align: "center",
      render: (_, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/payment-history/${row.id}`);
          }}
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const ledgerColumns = [
    { key: "driverName", label: "Driver", sortable: true },
    { key: "vehicleType", label: "Vehicle", sortable: false },
    {
      key: "totalEarnings",
      label: "Total Earnings",
      sortable: true,
      align: "right",
      render: (val) => (
        <span className="font-semibold">{formatCurrency(val)}</span>
      ),
    },
    {
      key: "totalPaid",
      label: "Total Paid",
      sortable: true,
      align: "right",
      render: (val) => (
        <span className="font-semibold text-emerald-700">
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "outstandingBalance",
      label: "Outstanding",
      sortable: true,
      align: "right",
      render: (val) => (
        <span
          className={`font-semibold ${val > 0 ? "text-[#DC2626]" : "text-[#16A34A]"}`}
        >
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: "advance",
      label: "Advance Paid",
      sortable: true,
      align: "right",
      render: (val) => (
        <span className="text-blue-700 font-medium">{formatCurrency(val)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payment History"
        description="Record of actual payouts made to drivers across all payment modes."
        action={
          (isSuperAdmin || hasPermission("paymentHistory")) && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate("/payment-history/new")}
            >
              Record Payment
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-5">
        {[
          { key: "transactions", label: "Transactions", icon: Wallet },
          { key: "ledger", label: "Driver Ledger", icon: Users },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-white text-[#E53935] shadow-xs"
                : "text-[#6B7280] hover:text-[#202124]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "transactions" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-5 flex flex-wrap gap-3">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setCurrentPage(1);
              }}
              placeholder="Search by driver, ID, UTR..."
              className="flex-1 min-w-48"
            />
            <Select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={PAYMENT_MODES}
              placeholder="All Modes"
              className="w-40"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
            />
            {(search || modeFilter || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <DataTable columns={columns} data={paginated} keyField="id" />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              className="px-4 border-t border-[#E5E7EB]"
            />
          </div>
        </>
      )}

      {activeTab === "ledger" && (
        <div>
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Ledger balances are based on mock data from driver records. In
              production these will reflect live transaction data.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              {
                label: "Total Earnings",
                val: ledgerData.reduce((s, d) => s + d.totalEarnings, 0),
                icon: TrendingUp,
                color: "text-[#202124]",
              },
              {
                label: "Total Paid Out",
                val: ledgerData.reduce((s, d) => s + d.totalPaid, 0),
                icon: Wallet,
                color: "text-emerald-700",
              },
              {
                label: "Total Outstanding",
                val: ledgerData.reduce((s, d) => s + d.outstandingBalance, 0),
                icon: AlertTriangle,
                color: "text-[#DC2626]",
              },
              {
                label: "Total Advances",
                val: ledgerData.reduce((s, d) => s + d.advance, 0),
                icon: Users,
                color: "text-blue-700",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-[#E5E7EB] px-4 py-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-xs text-[#6B7280] font-medium">
                    {card.label}
                  </span>
                </div>
                <div className={`text-xl font-bold ${card.color}`}>
                  {formatCurrency(card.val)}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <DataTable
              columns={ledgerColumns}
              data={ledgerData}
              keyField="driverId"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
