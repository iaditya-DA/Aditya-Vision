import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FileText,
  Sliders,
  Download,
  FileSpreadsheet,
  Printer,
  Bookmark,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import SearchBar from "../../components/common/SearchBar";
import Select from "../../components/common/Select";
import DataTable from "../../components/common/DataTable";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDeliveriesPaged } from "../../services/deliveryService";
import { getDriversPaged, getDriverBankDetails } from "../../services/driverService";
import { getDriverLedgerData } from "../../services/paymentService";
import { getSavedReports, saveCustomReport, deleteSavedReport } from "../../services/reportService";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  printReport,
} from "../../utils/exportUtils";

const PAGE_SIZE = 8;

// Custom Report Builder Available Columns Definition
const AVAILABLE_COLUMNS = [
  // Deliveries Group
  {
    group: "Deliveries",
    key: "id",
    label: "Delivery ID",
    type: "text",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "invoiceNumber",
    label: "Invoice No",
    type: "text",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "customerName",
    label: "Customer Name",
    type: "text",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "customerMobile",
    label: "Customer Mobile",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Deliveries",
    key: "productName",
    label: "Product",
    type: "text",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "category",
    label: "Category",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Deliveries",
    key: "quantity",
    label: "Quantity",
    type: "number",
    defaultSelected: false,
  },
  {
    group: "Deliveries",
    key: "deliveryDate",
    label: "Delivery Date",
    type: "date",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "distanceKm",
    label: "Distance (KM)",
    type: "number",
    defaultSelected: false,
  },
  {
    group: "Deliveries",
    key: "deliveryCharges",
    label: "Delivery Charges (₹)",
    type: "amount",
    defaultSelected: true,
  },
  {
    group: "Deliveries",
    key: "status",
    label: "Delivery Status",
    type: "status",
    defaultSelected: true,
  },

  // Drivers Group (Joined)
  {
    group: "Drivers",
    key: "driverName",
    label: "Driver Name",
    type: "text",
    defaultSelected: true,
  },
  {
    group: "Drivers",
    key: "driverMobile",
    label: "Driver Mobile",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "vehicleType",
    label: "Vehicle Type",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "vehicleNumber",
    label: "Vehicle Number",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "accountHolderName",
    label: "Account Holder Name",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "bankName",
    label: "Bank Name",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "accountNumber",
    label: "Account Number",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "ifscCode",
    label: "IFSC Code",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "branchName",
    label: "Branch Name",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Drivers",
    key: "upiId",
    label: "UPI ID",
    type: "text",
    defaultSelected: false,
  },

  // Payments Group (Joined & Computed)
  {
    group: "Payments",
    key: "paymentStatus",
    label: "Payment Status",
    type: "status",
    defaultSelected: true,
  },
  {
    group: "Payments",
    key: "requestStatus",
    label: "Payment Req Status",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Payments",
    key: "requestedAmount",
    label: "Requested Amount (₹)",
    type: "amount",
    defaultSelected: false,
  },
  {
    group: "Payments",
    key: "amountPaid",
    label: "Amount Paid (₹)",
    type: "amount",
    defaultSelected: true,
  },
  {
    group: "Payments",
    key: "paymentMode",
    label: "Payment Mode",
    type: "text",
    defaultSelected: false,
  },
  {
    group: "Payments",
    key: "paymentDate",
    label: "Payment Date",
    type: "date",
    defaultSelected: false,
  },
];

const Reports = () => {
  const { hasPermission, isSuperAdmin, user } = useAuth();
  const { paymentRequests, paymentHistory, getPaymentStatus } = usePaymentStatus();
  const toast = useToast();

  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getDeliveriesPaged({ pageSize: 100 }),
      getDriversPaged({ pageSize: 100 }),
    ]).then(async ([delRes, drvRes]) => {
      if (!mounted) return;
      const rawDrivers = drvRes.drivers || [];
      const rawDeliveries = delRes.deliveries || [];

      // Enrich driver list with ledger data (totalEarnings, totalPaid, outstandingBalance)
      const enrichedDrivers = await Promise.all(
        rawDrivers.map(async (drv) => {
          try {
            const ledger = await getDriverLedgerData(drv.id);
            return {
              ...drv,
              totalDeliveries: ledger.totalDeliveries || 0,
              totalEarnings: ledger.totalEarnings || 0,
              totalPaid: ledger.totalPaid || 0,
              outstandingBalance: ledger.outstandingBalance || 0,
            };
          } catch {
            return drv;
          }
        })
      );

      if (mounted) {
        setDeliveries(rawDeliveries);
        setDrivers(enrichedDrivers);
      }
    }).catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  const [activeTab, setActiveTab] = useState("standard"); // 'standard' | 'builder'

  // Access check for source tables in Custom Builder
  const canAccessDeliveries = isSuperAdmin || hasPermission("deliveries");
  const canAccessDrivers = isSuperAdmin || hasPermission("drivers");
  const canAccessPayments = isSuperAdmin || hasPermission("paymentHistory");
  const canExportBankDetails = isSuperAdmin || hasPermission("drivers.exportBankDetails") || hasPermission("drivers.viewBankDetails");

  // -------------------------------------------------------------
  // TAB 1: STANDARD REPORTS STATE
  // -------------------------------------------------------------
  const [standardType, setStandardType] = useState("delivery");
  const [stdStartDate, setStdStartDate] = useState("");
  const [stdEndDate, setStdEndDate] = useState("");
  const [stdDriver, setStdDriver] = useState("");
  const [stdStatus, setStdStatus] = useState("");
  const [stdCurrentPage, setStdCurrentPage] = useState(1);

  // Compute Standard Report Data
  const standardReportResult = useMemo(() => {
    let raw = [];
    let cols = [];
    let chartData = [];
    let summaryStats = [];

    // Filter helpers
    const filterByDateAndDriver = (items, dateKey, driverKey) => {
      return items.filter((item) => {
        const itemDate = item[dateKey];
        const matchStart = !stdStartDate || itemDate >= stdStartDate;
        const matchEnd = !stdEndDate || itemDate <= stdEndDate;
        const matchDriver = !stdDriver || item[driverKey] === stdDriver;
        const matchStatus = !stdStatus || item.status === stdStatus;
        return matchStart && matchEnd && matchDriver && matchStatus;
      });
    };

    if (standardType === "delivery") {
      raw = filterByDateAndDriver(
        deliveries,
        "deliveryDate",
        "driverId",
      );
      cols = [
        { key: "id", label: "Order ID", sortable: true },
        { key: "invoiceNumber", label: "Invoice", sortable: true },
        { key: "customerName", label: "Customer", sortable: true },
        { key: "city", label: "City", sortable: true },
        { key: "productName", label: "Product", sortable: false },
        {
          key: "deliveryDate",
          label: "Date",
          sortable: true,
          render: (v) => formatDate(v),
        },
        {
          key: "deliveryCharges",
          label: "Charges",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "status",
          label: "Status",
          sortable: true,
          render: (v) => <StatusBadge status={v} />,
        },
        { key: "driverName", label: "Driver", sortable: true },
      ];

      const totalCharges = raw.reduce(
        (sum, d) => sum + (Number(d.deliveryCharges) || 0),
        0,
      );
      const deliveredCount = raw.filter((d) => d.status === "Delivered").length;

      summaryStats = [
        { label: "Total Deliveries", value: raw.length },
        { label: "Delivered Successfully", value: deliveredCount },
        { label: "Total Freight Value", value: formatCurrency(totalCharges) },
        {
          label: "Avg Delivery Charge",
          value: formatCurrency(raw.length ? totalCharges / raw.length : 0),
        },
      ];

      // Chart by category
      const catMap = {};
      raw.forEach((d) => {
        catMap[d.category] = (catMap[d.category] || 0) + 1;
      });
      chartData = Object.entries(catMap).map(([name, count]) => ({
        name,
        count,
      }));
    } else if (standardType === "driver-wise") {
      raw = drivers.filter((d) => {
        const matchDriver = !stdDriver || d.id === stdDriver;
        const matchStatus = !stdStatus || d.status === stdStatus;
        return matchDriver && matchStatus;
      });
      cols = [
        { key: "code", label: "Code", sortable: true },
        { key: "name", label: "Driver Name", sortable: true },
        { key: "vehicleType", label: "Vehicle", sortable: false },
        {
          key: "totalDeliveries",
          label: "Trips Done",
          sortable: true,
          align: "center",
        },
        {
          key: "totalEarnings",
          label: "Total Earnings",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "totalPaid",
          label: "Total Paid",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "outstandingBalance",
          label: "Outstanding",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "status",
          label: "Status",
          sortable: true,
          render: (v) => <StatusBadge status={v} />,
        },
      ];

      const sumEarnings = raw.reduce((s, d) => s + (d.totalEarnings || 0), 0);
      const sumPaid = raw.reduce((s, d) => s + (d.totalPaid || 0), 0);
      const sumOut = raw.reduce((s, d) => s + (d.outstandingBalance || 0), 0);

      summaryStats = [
        { label: "Drivers in Scope", value: raw.length },
        { label: "Cumulative Earnings", value: formatCurrency(sumEarnings) },
        { label: "Total Disbursed", value: formatCurrency(sumPaid) },
        { label: "Total Outstanding", value: formatCurrency(sumOut) },
      ];

      chartData = raw.slice(0, 8).map((d) => ({
        name: d.name.split(" ")[0],
        earnings: d.totalEarnings,
        paid: d.totalPaid,
      }));
    } else if (standardType === "payment") {
      raw = paymentHistory.filter((p) => {
        const matchStart = !stdStartDate || p.paymentDate >= stdStartDate;
        const matchEnd = !stdEndDate || p.paymentDate <= stdEndDate;
        const matchDriver = !stdDriver || p.driverId === stdDriver;
        return matchStart && matchEnd && matchDriver;
      });
      cols = [
        { key: "id", label: "Payment ID", sortable: true },
        { key: "driverName", label: "Driver", sortable: true },
        {
          key: "paymentDate",
          label: "Date",
          sortable: true,
          render: (v) => formatDate(v),
        },
        {
          key: "amount",
          label: "Amount",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        { key: "paymentMode", label: "Mode", sortable: true },
        { key: "paymentType", label: "Type", sortable: false },
        { key: "utrNumber", label: "UTR / Reference", sortable: false },
        { key: "recordedBy", label: "Recorded By", sortable: false },
      ];

      const totalDisbursed = raw.reduce((s, p) => s + (p.amount || 0), 0);
      summaryStats = [
        { label: "Disbursement Count", value: raw.length },
        { label: "Total Paid Out", value: formatCurrency(totalDisbursed) },
        {
          label: "Average Transaction",
          value: formatCurrency(raw.length ? totalDisbursed / raw.length : 0),
        },
      ];

      const modeMap = {};
      raw.forEach((p) => {
        modeMap[p.paymentMode] = (modeMap[p.paymentMode] || 0) + p.amount;
      });
      chartData = Object.entries(modeMap).map(([name, amount]) => ({
        name,
        amount,
      }));
    } else if (standardType === "outstanding-payment") {
      raw = drivers.filter((d) => (d.outstandingBalance || 0) > 0);
      cols = [
        { key: "code", label: "Code", sortable: true },
        { key: "name", label: "Driver Name", sortable: true },
        { key: "mobile", label: "Mobile", sortable: false },
        {
          key: "totalEarnings",
          label: "Earned",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "totalPaid",
          label: "Paid",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "outstandingBalance",
          label: "Outstanding Due",
          sortable: true,
          align: "right",
          render: (v) => (
            <span className="font-bold text-[#DC2626]">
              {formatCurrency(v)}
            </span>
          ),
        },
        {
          key: "status",
          label: "Status",
          sortable: true,
          render: (v) => <StatusBadge status={v} />,
        },
      ];

      const totalDue = raw.reduce((s, d) => s + (d.outstandingBalance || 0), 0);
      summaryStats = [
        { label: "Drivers with Dues", value: raw.length },
        { label: "Total Unpaid Wage Dues", value: formatCurrency(totalDue) },
      ];

      chartData = raw.slice(0, 6).map((d) => ({
        name: d.name.split(" ")[0],
        due: d.outstandingBalance,
      }));
    } else if (standardType === "daily-business") {
      // Daily aggregate
      raw = deliveries.slice(0, 15);
      cols = [
        {
          key: "deliveryDate",
          label: "Date",
          sortable: true,
          render: (v) => formatDate(v),
        },
        { key: "id", label: "Delivery ID", sortable: true },
        { key: "customerName", label: "Customer", sortable: true },
        { key: "productName", label: "Product", sortable: false },
        {
          key: "productAmount",
          label: "Bill Value",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "deliveryCharges",
          label: "Freight",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "status",
          label: "Status",
          sortable: true,
          render: (v) => <StatusBadge status={v} />,
        },
      ];

      const sumBill = raw.reduce(
        (s, d) => s + (Number(d.productAmount) || 0),
        0,
      );
      const sumFreight = raw.reduce(
        (s, d) => s + (Number(d.deliveryCharges) || 0),
        0,
      );

      summaryStats = [
        { label: "Orders Dispatched", value: raw.length },
        { label: "Total Merchandise Value", value: formatCurrency(sumBill) },
        { label: "Total Freight Collected", value: formatCurrency(sumFreight) },
      ];

      chartData = raw.slice(0, 7).map((d) => ({
        name: d.customerName.split(" ")[0],
        amount: d.productAmount,
      }));
    } else if (standardType === "monthly-business") {
      // Monthly aggregate
      raw = [
        {
          month: "Jun 2026",
          orders: 180,
          revenue: 8450000,
          freight: 112000,
          driverPayouts: 245000,
        },
        {
          month: "Jul 2026",
          orders: 210,
          revenue: 9820000,
          freight: 135000,
          driverPayouts: 288000,
        },
        {
          month: "Aug 2026",
          orders: 245,
          revenue: 11450000,
          freight: 158000,
          driverPayouts: 312000,
        },
        {
          month: "Sep 2026",
          orders: 280,
          revenue: 13200000,
          freight: 184000,
          driverPayouts: 345000,
        },
        {
          month: "Oct 2026",
          orders: 320,
          revenue: 15800000,
          freight: 215000,
          driverPayouts: 395000,
        },
        {
          month: "Nov 2026",
          orders: 193,
          revenue: 9450000,
          freight: 128000,
          driverPayouts: 384500,
        },
      ];

      cols = [
        { key: "month", label: "Month", sortable: true },
        { key: "orders", label: "Dispatches", sortable: true, align: "center" },
        {
          key: "revenue",
          label: "Merchandise Revenue",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "freight",
          label: "Freight Collected",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
        {
          key: "driverPayouts",
          label: "Driver Wages Paid",
          sortable: true,
          align: "right",
          render: (v) => formatCurrency(v),
        },
      ];

      summaryStats = [
        { label: "Tracked Months", value: 6 },
        { label: "Cumulative Revenue", value: "₹6.81 Cr" },
        { label: "Total Freight Charges", value: "₹9.32 L" },
        { label: "Total Driver Payouts", value: "₹19.69 L" },
      ];

      chartData = raw.map((m) => ({
        name: m.month.split(" ")[0],
        freight: m.freight,
        payouts: m.driverPayouts,
      }));
    }

    return { raw, cols, chartData, summaryStats };
  }, [
    standardType,
    stdStartDate,
    stdEndDate,
    stdDriver,
    stdStatus,
    deliveries,
    drivers,
    paymentHistory,
  ]);

  const stdTotalPages =
    Math.ceil(standardReportResult.raw.length / PAGE_SIZE) || 1;
  const stdPaginated = standardReportResult.raw.slice(
    (stdCurrentPage - 1) * PAGE_SIZE,
    stdCurrentPage * PAGE_SIZE,
  );

  // Standard Exports Handlers
  const handleStandardExportCSV = () => {
    exportToCSV(
      standardReportResult.raw,
      `AdityaVision_${standardType}_report.csv`,
      standardReportResult.cols,
    );
    toast.success("Standard report exported to CSV.");
  };

  const handleStandardExportExcel = () => {
    exportToExcel(
      standardReportResult.raw,
      `AdityaVision_${standardType}_report.xlsx`,
      standardReportResult.cols,
    );
    toast.success("Standard report exported to Excel (.xlsx).");
  };

  const handleStandardExportPDF = async () => {
    const filterSummary = [
      stdDriver
        ? `Driver: ${drivers.find((d) => d.id === stdDriver)?.name || stdDriver}`
        : "",
      stdStatus ? `Status: ${stdStatus}` : "",
      stdStartDate ? `From: ${stdStartDate}` : "",
      stdEndDate ? `To: ${stdEndDate}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await exportToPDF(
      `${standardType.toUpperCase().replace("-", " ")} REPORT`,
      standardReportResult.cols,
      standardReportResult.raw,
      `AdityaVision_${standardType}_report.pdf`,
      filterSummary,
    );
    toast.success("Standard report exported to PDF.");
  };

  const handleStandardPrint = () => {
    printReport(
      `${standardType.toUpperCase().replace("-", " ")} REPORT`,
      standardReportResult.cols,
      standardReportResult.raw,
    );
  };

  // -------------------------------------------------------------
  // TAB 2: CUSTOM REPORT BUILDER STATE
  // -------------------------------------------------------------
  const [baseTable, setBaseTable] = useState("Deliveries");
  const [selectedColumnKeys, setSelectedColumnKeys] = useState(() =>
    AVAILABLE_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key),
  );
  const [customColumnLabels, setCustomColumnLabels] = useState({});

  // Builder Filters
  const [builderSearch, setBuilderSearch] = useState("");
  const [builderDriver, setBuilderDriver] = useState("");
  const [builderDelivStatus, setBuilderDelivStatus] = useState("");
  const [builderPaymentStatus, setBuilderPaymentStatus] = useState("");
  const [builderDateFrom, setBuilderDateFrom] = useState("");
  const [builderDateTo, setBuilderDateTo] = useState("");
  const [builderCurrentPage, setBuilderCurrentPage] = useState(1);

  // Saved Reports State (from Firestore)
  const [savedReports, setSavedReports] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [reportTitleInput, setReportTitleInput] = useState("");
  const [savedReportsModalOpen, setSavedReportsModalOpen] = useState(false);

  useEffect(() => {
    if (user?.uid || user?.id) {
      getSavedReports(user.uid || user.id).then(setSavedReports).catch(console.error);
    }
  }, [user]);

  // Column reordering
  const handleMoveColumn = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= selectedColumnKeys.length) return;
    const newKeys = [...selectedColumnKeys];
    const temp = newKeys[index];
    newKeys[index] = newKeys[targetIdx];
    newKeys[targetIdx] = temp;
    setSelectedColumnKeys(newKeys);
  };

  // Toggle single column checkbox
  const handleToggleColumn = (key) => {
    if (selectedColumnKeys.includes(key)) {
      setSelectedColumnKeys((p) => p.filter((k) => k !== key));
    } else {
      setSelectedColumnKeys((p) => [...p, key]);
    }
  };

  // Mask account number helper: authorized roles see full, unauthorized see masked
  const maskAccountNumber = (acc, driverObj) => {
    if (!acc || acc === "-") {
      if (driverObj?.maskedAccount) return driverObj.maskedAccount;
      return "-";
    }
    const clean = String(acc).trim();
    if (clean.length <= 4) return clean;
    return `•••• •••• ${clean.slice(-4)}`;
  };

  // Perform Frontend Joins across Deliveries, Drivers, & Payments
  const joinedData = useMemo(() => {
    if (baseTable === "Deliveries") {
      return deliveries.map((delivery) => {
        // 1. Join Driver
        const matchedDriver = drivers.find((d) => d.id === delivery.driverId);

        // 2. Join Payment Request strictly by deliveryId (only Pending and Approved count)
        const matchedReq = paymentRequests.find(
          (r) =>
            r.deliveryId &&
            r.deliveryId === delivery.id &&
            (r.status === "Pending" || r.status === "Approved"),
        );

        // 3. Join Payment History strictly by deliveryId
        const matchedPayments = paymentHistory.filter(
          (p) => p.deliveryId && p.deliveryId === delivery.id,
        );
        const matchedPayment = matchedPayments[0];
        const totalAmountPaid = matchedPayments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0,
        );

        // Compute Payment Status using live status hook
        const paymentStatus = getPaymentStatus(delivery);

        const rawAcc = matchedDriver?.accountNumber || matchedDriver?.maskedAccount || "-";
        const displayAcc = canExportBankDetails
          ? (matchedDriver?.accountNumber || matchedDriver?.maskedAccount || "-")
          : maskAccountNumber(rawAcc, matchedDriver);

        return {
          ...delivery,
          driverMobile: matchedDriver?.mobile || "-",
          vehicleType: matchedDriver?.vehicleType || "-",
          vehicleNumber: matchedDriver?.vehicleNumber || "-",
          accountHolderName: matchedDriver?.accountHolderName || matchedDriver?.name || "-",
          bankName: matchedDriver?.bankName || "-",
          accountNumber: displayAcc,
          ifscCode: matchedDriver?.ifscCode || matchedDriver?.ifsc || "-",
          branchName: matchedDriver?.branchName || "-",
          upiId: matchedDriver?.upiId || "-",
          paymentStatus,
          requestStatus: matchedReq?.status || "None",
          requestedAmount: matchedReq?.requestedAmount || 0,
          amountPaid: totalAmountPaid,
          paymentMode: matchedPayment?.paymentMode || "-",
          paymentDate: matchedPayment?.paymentDate || "-",
        };
      });
    }

    if (baseTable === "Drivers") {
      return drivers.map((d) => {
        const rawAcc = d.accountNumber || d.maskedAccount || "-";
        const displayAcc = canExportBankDetails
          ? (d.accountNumber || d.maskedAccount || "-")
          : maskAccountNumber(rawAcc, d);
        return {
          id: d.id,
          driverName: d.name,
          driverMobile: d.mobile,
          vehicleType: d.vehicleType,
          vehicleNumber: d.vehicleNumber || "-",
          accountHolderName: d.accountHolderName || d.name || "-",
          bankName: d.bankName || "-",
          accountNumber: displayAcc,
          ifscCode: d.ifscCode || d.ifsc || "-",
          branchName: d.branchName || "-",
          upiId: d.upiId || "-",
          deliveryCharges: d.totalEarnings || 0,
          amountPaid: d.totalPaid || 0,
          status: d.status,
          paymentStatus: d.outstandingBalance > 0 ? "Unpaid" : "Paid",
        };
      });
    }

    if (baseTable === "Payment History") {
      return paymentHistory.map((p) => ({
        id: p.id,
        driverName: p.driverName,
        paymentDate: p.paymentDate,
        amountPaid: p.amount,
        paymentMode: p.paymentMode,
        paymentStatus: "Paid",
        status: p.status,
      }));
    }

    return [];
  }, [baseTable, deliveries, drivers, paymentRequests, paymentHistory, canExportBankDetails, getPaymentStatus]);

  // Filter Joined Data
  const filteredJoinedData = useMemo(() => {
    return joinedData.filter((row) => {
      const q = builderSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (row.id && String(row.id).toLowerCase().includes(q)) ||
        (row.customerName && row.customerName.toLowerCase().includes(q)) ||
        (row.productName && row.productName.toLowerCase().includes(q)) ||
        (row.driverName && row.driverName.toLowerCase().includes(q));

      const matchDriver = !builderDriver || row.driverId === builderDriver;
      const matchDelivStatus =
        !builderDelivStatus || row.status === builderDelivStatus;
      const matchPaymentStatus =
        !builderPaymentStatus || row.paymentStatus === builderPaymentStatus;

      const dateField = row.deliveryDate || row.paymentDate;
      const matchFrom =
        !builderDateFrom || (dateField && dateField >= builderDateFrom);
      const matchTo =
        !builderDateTo || (dateField && dateField <= builderDateTo);

      return (
        matchSearch &&
        matchDriver &&
        matchDelivStatus &&
        matchPaymentStatus &&
        matchFrom &&
        matchTo
      );
    });
  }, [
    joinedData,
    builderSearch,
    builderDriver,
    builderDelivStatus,
    builderPaymentStatus,
    builderDateFrom,
    builderDateTo,
  ]);

  // Selected Columns Configuration
  const activeColumns = useMemo(() => {
    return selectedColumnKeys
      .map((key) => {
        const def = AVAILABLE_COLUMNS.find((c) => c.key === key);
        if (!def) return null;
        return {
          ...def,
          label: customColumnLabels[key] || def.label,
        };
      })
      .filter(Boolean);
  }, [selectedColumnKeys, customColumnLabels]);

  const builderTotalPages =
    Math.ceil(filteredJoinedData.length / PAGE_SIZE) || 1;
  const paginatedBuilderData = filteredJoinedData.slice(
    (builderCurrentPage - 1) * PAGE_SIZE,
    builderCurrentPage * PAGE_SIZE,
  );

  // Compute Totals Row for numeric columns
  const totalsRow = useMemo(() => {
    const sums = {};
    activeColumns.forEach((col) => {
      if (col.type === "amount" || col.type === "number") {
        sums[col.key] = filteredJoinedData.reduce(
          (acc, row) => acc + (Number(row[col.key]) || 0),
          0,
        );
      }
    });
    return sums;
  }, [activeColumns, filteredJoinedData]);

  // Custom Builder Exports
  const getPreparedBuilderData = async () => {
    // If user has export bank details permission, fetch actual private bank credentials
    if (!canExportBankDetails) {
      return filteredJoinedData;
    }

    try {
      const bankDetailsMap = {};
      const uniqueDriverIds = [
        ...new Set(
          filteredJoinedData
            .map((r) => r.driverId || (baseTable === "Drivers" ? r.id : null))
            .filter(Boolean)
        ),
      ];

      await Promise.all(
        uniqueDriverIds.map(async (id) => {
          try {
            const b = await getDriverBankDetails(id);
            if (b) bankDetailsMap[id] = b;
          } catch {
            // ignore
          }
        })
      );

      return filteredJoinedData.map((row) => {
        const dId = row.driverId || (baseTable === "Drivers" ? row.id : null);
        const b = dId ? bankDetailsMap[dId] : null;
        if (!b) return row;
        return {
          ...row,
          bankName: b.bankName || row.bankName,
          accountHolderName: b.accountHolderName || row.accountHolderName,
          accountNumber: b.accountNumber || row.accountNumber,
          ifscCode: b.ifscCode || row.ifscCode,
          branchName: b.branchName || row.branchName,
          upiId: b.upiId || row.upiId,
        };
      });
    } catch {
      return filteredJoinedData;
    }
  };

  const handleBuilderExportCSV = async () => {
    const data = await getPreparedBuilderData();
    exportToCSV(
      data,
      `Custom_Report_${baseTable}.csv`,
      activeColumns,
    );
    toast.success("Custom report exported to CSV.");
  };

  const handleBuilderExportExcel = async () => {
    const data = await getPreparedBuilderData();
    exportToExcel(
      data,
      `Custom_Report_${baseTable}.xlsx`,
      activeColumns,
    );
    toast.success("Custom report exported to Excel (.xlsx).");
  };

  const handleBuilderExportPDF = async () => {
    const data = await getPreparedBuilderData();
    const filterSummary = [
      builderDriver
        ? `Driver: ${drivers.find((d) => d.id === builderDriver)?.name || builderDriver}`
        : "",
      builderDelivStatus ? `Status: ${builderDelivStatus}` : "",
      builderPaymentStatus ? `Payment: ${builderPaymentStatus}` : "",
      builderDateFrom ? `From: ${builderDateFrom}` : "",
      builderDateTo ? `To: ${builderDateTo}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await exportToPDF(
      `Custom Report - ${baseTable}`,
      activeColumns,
      data,
      `Custom_Report_${baseTable}.pdf`,
      filterSummary,
      totalsRow,
    );
    toast.success("Custom report exported to PDF.");
  };

  // Saved Reports Logic
  const handleSaveReportTemplate = async () => {
    if (!reportTitleInput.trim()) {
      toast.error("Please enter a name for this custom report.");
      return;
    }
    const template = {
      title: reportTitleInput.trim(),
      name: reportTitleInput.trim(),
      baseTable,
      selectedColumnKeys,
      customColumnLabels,
      savedAt: new Date().toISOString(),
    };
    try {
      const id = await saveCustomReport(user?.uid || user?.id, template);
      setSavedReports((prev) => [{ ...template, id }, ...prev]);
      setSaveModalOpen(false);
      setReportTitleInput("");
      toast.success(`Report template "${template.title}" saved.`);
    } catch (err) {
      toast.error(err.message || "Failed to save template");
    }
  };

  const handleLoadSavedReport = (template) => {
    setBaseTable(template.baseTable || template.definition?.baseTable || "Deliveries");
    setSelectedColumnKeys(template.selectedColumnKeys || template.definition?.selectedColumnKeys || []);
    setCustomColumnLabels(template.customColumnLabels || template.definition?.customColumnLabels || {});
    setSavedReportsModalOpen(false);
    toast.info(`Loaded report template: "${template.title || template.name}"`);
  };

  const handleDeleteSavedReport = async (id) => {
    try {
      await deleteSavedReport(id);
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Saved report template removed.");
    } catch (err) {
      toast.error(err.message || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive operational statements, audit ledgers, and interactive client-side report generator."
      >
        <div className="flex items-center gap-2">
          {activeTab === "builder" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={Bookmark}
                onClick={() => setSavedReportsModalOpen(true)}
              >
                Saved Templates ({savedReports.length})
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={() => setSaveModalOpen(true)}
              >
                Save This Report
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("standard")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "standard"
              ? "bg-[#FFF1F0] text-[#E53935]"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Standard Statements</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("builder")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "builder"
              ? "bg-[#FFF1F0] text-[#E53935]"
              : "text-[#6B7280] hover:text-[#202124] hover:bg-gray-100"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Custom Report Builder</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STANDARD REPORTS */}
      {/* ========================================================= */}
      {activeTab === "standard" && (
        <div className="space-y-5">
          {/* Controls Ribbon */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-center">
              <Select
                label="Report Type"
                value={standardType}
                onChange={(e) => {
                  setStandardType(e.target.value);
                  setStdCurrentPage(1);
                }}
                options={[
                  { value: "daily-business", label: "Daily Business Summary" },
                  {
                    value: "monthly-business",
                    label: "Monthly Business Overview",
                  },
                  { value: "delivery", label: "Delivery Log Statement" },
                  { value: "driver-wise", label: "Driver Performance & Wages" },
                  { value: "payment", label: "Payment Disbursements Register" },
                  {
                    value: "outstanding-payment",
                    label: "Outstanding Driver Settlements",
                  },
                ]}
              />

              <div>
                <label className="text-xs font-semibold text-[#202124] mb-1 block">
                  Date From
                </label>
                <input
                  type="date"
                  value={stdStartDate}
                  onChange={(e) => setStdStartDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#202124] mb-1 block">
                  Date To
                </label>
                <input
                  type="date"
                  value={stdEndDate}
                  onChange={(e) => setStdEndDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
                />
              </div>

              <Select
                label="Driver Filter"
                value={stdDriver}
                onChange={(e) => setStdDriver(e.target.value)}
                placeholder="All Drivers"
                options={[
                  { value: "", label: "All Drivers" },
                  ...drivers.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />

              <Select
                label="Status Filter"
                value={stdStatus}
                onChange={(e) => {
                  setStdStatus(e.target.value);
                  setStdCurrentPage(1);
                }}
                placeholder="All Statuses"
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "Delivered", label: "Delivered" },
                  { value: "Pending", label: "Pending" },
                  { value: "In Transit", label: "In Transit" },
                  { value: "Active", label: "Active" },
                  { value: "Completed", label: "Completed" },
                ]}
              />

              <div className="pt-5 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => setStdCurrentPage(1)}
                >
                  Generate Report
                </Button>
              </div>
            </div>

            {/* Export Actions Strip */}
            <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#6B7280]">
                Showing {standardReportResult.raw.length} records matching
                parameters
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={handleStandardExportCSV}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={handleStandardExportExcel}
                >
                  Excel (.xlsx)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FileText}
                  onClick={handleStandardExportPDF}
                >
                  PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Printer}
                  onClick={handleStandardPrint}
                >
                  Print
                </Button>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards */}
          {standardReportResult.summaryStats.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {standardReportResult.summaryStats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs"
                >
                  <div className="text-xs text-[#6B7280] font-medium">
                    {stat.label}
                  </div>
                  <div className="text-lg font-bold text-[#202124] mt-1">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart Visualization */}
          {standardReportResult.chartData.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-2xs">
              <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-4">
                Analytical Breakdown
              </h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={standardReportResult.chartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F1F3F5"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar
                      dataKey="count"
                      name="Deliveries"
                      fill="#E53935"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="amount"
                      name="Amount (₹)"
                      fill="#16A34A"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="earnings"
                      name="Total Wages"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="paid"
                      name="Disbursed"
                      fill="#16A34A"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="due"
                      name="Dues"
                      fill="#DC2626"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="freight"
                      name="Freight"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="payouts"
                      name="Wages Paid"
                      fill="#E53935"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Standard Report Table */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-2xs">
            <DataTable
              columns={standardReportResult.cols}
              data={stdPaginated}
              keyField="id"
              emptyMessage="No records found"
              emptyDescription="Adjust your dates or filter options to generate report rows."
            />
            <Pagination
              currentPage={stdCurrentPage}
              totalPages={stdTotalPages}
              totalItems={standardReportResult.raw.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setStdCurrentPage(p)}
              className="px-4 border-t border-[#E5E7EB]"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CUSTOM REPORT BUILDER */}
      {/* ========================================================= */}
      {activeTab === "builder" && (
        <div className="space-y-5">
          {/* Source Selector & Browser State Note */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-2xs">
            <Info className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
            <p className="text-xs text-blue-900 leading-relaxed">
              <span className="font-semibold">Custom Query Engine:</span>{" "}
              Combine fields from Deliveries, Drivers and linked Payments.
              Reorder columns, apply custom labels, and export directly to CSV
              or Excel (.xlsx). Saved templates live in this browser only.
            </p>
          </div>

          {/* Builder Step 1: Base Entity Selection */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs">
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-[#E53935]" />
              <span className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                1. Select Base Entity (What each row represents):
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { name: "Deliveries", allowed: canAccessDeliveries },
                { name: "Drivers", allowed: canAccessDrivers },
                { name: "Payment History", allowed: canAccessPayments },
              ]
                .filter((b) => b.allowed)
                .map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => {
                      setBaseTable(b.name);
                      setBuilderCurrentPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      baseTable === b.name
                        ? "bg-[#FFF1F0] border-[#E53935] text-[#E53935]"
                        : "bg-[#F8F9FB] border-[#E5E7EB] text-[#202124] hover:bg-white"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Builder Step 2: Column Picker with Groups */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                2. Choose Fields to Include ({selectedColumnKeys.length}{" "}
                selected):
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedColumnKeys(AVAILABLE_COLUMNS.map((c) => c.key))
                }
                className="text-xs text-[#E53935] font-semibold hover:underline"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["Deliveries", "Drivers", "Payments"].map((grp) => (
                <div
                  key={grp}
                  className="p-3 bg-[#F8F9FB] rounded-xl border border-[#E5E7EB] space-y-2"
                >
                  <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                    {grp} Fields
                  </div>
                  <div className="space-y-1.5">
                    {AVAILABLE_COLUMNS.filter((c) => c.group === grp).map(
                      (col) => {
                        const isChecked = selectedColumnKeys.includes(col.key);
                        return (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 text-xs text-[#202124] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleColumn(col.key)}
                              className="rounded text-[#E53935] focus:ring-[#E53935] h-3.5 w-3.5"
                            />
                            <span>{col.label}</span>
                          </label>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Columns Reorder Strip */}
            {selectedColumnKeys.length > 0 && (
              <div className="pt-3 border-t border-[#E5E7EB]">
                <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                  Reorder or Rename Columns:
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeColumns.map((col, idx) => (
                    <div
                      key={col.key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E5E7EB] rounded-lg text-xs shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, -1)}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-black disabled:opacity-30"
                        title="Move Left / Up"
                      >
                        <ArrowUp className="w-3 h-3 rotate-270" />
                      </button>
                      <span className="font-medium text-[#202124]">
                        {col.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(idx, 1)}
                        disabled={idx === activeColumns.length - 1}
                        className="text-gray-400 hover:text-black disabled:opacity-30"
                        title="Move Right / Down"
                      >
                        <ArrowDown className="w-3 h-3 rotate-270" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newName = prompt(
                            `Rename column "${col.label}" to:`,
                            col.label,
                          );
                          if (newName && newName.trim()) {
                            setCustomColumnLabels((p) => ({
                              ...p,
                              [col.key]: newName.trim(),
                            }));
                          }
                        }}
                        className="text-gray-400 hover:text-[#2563EB]"
                        title="Rename Column Label"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleColumn(col.key)}
                        className="text-gray-400 hover:text-[#DC2626]"
                        title="Remove Column"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Builder Step 3: Filters Ribbon */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-2xs flex flex-wrap gap-3 items-center">
            <SearchBar
              value={builderSearch}
              onChange={(v) => {
                setBuilderSearch(v);
                setBuilderCurrentPage(1);
              }}
              placeholder="Search across row values..."
              className="flex-1 min-w-[200px]"
            />

            <Select
              value={builderDriver}
              onChange={(e) => {
                setBuilderDriver(e.target.value);
                setBuilderCurrentPage(1);
              }}
              placeholder="Filter Driver"
              options={[
                { value: "", label: "All Drivers" },
                ...drivers.map((d) => ({ value: d.id, label: d.name })),
              ]}
              className="w-40"
            />

            <Select
              value={builderDelivStatus}
              onChange={(e) => {
                setBuilderDelivStatus(e.target.value);
                setBuilderCurrentPage(1);
              }}
              placeholder="Delivery Status"
              options={[
                { value: "", label: "All Delivery Statuses" },
                { value: "Delivered", label: "Delivered" },
                { value: "In Transit", label: "In Transit" },
                { value: "Out for Delivery", label: "Out for Delivery" },
                { value: "Scheduled", label: "Scheduled" },
                { value: "Pending", label: "Pending" },
              ]}
              className="w-40"
            />

            <Select
              value={builderPaymentStatus}
              onChange={(e) => {
                setBuilderPaymentStatus(e.target.value);
                setBuilderCurrentPage(1);
              }}
              placeholder="Payment Status"
              options={["Paid", "Partial", "Unpaid", "Not Requested"]}
              className="w-40"
            />

            <input
              type="date"
              value={builderDateFrom}
              onChange={(e) => {
                setBuilderDateFrom(e.target.value);
                setBuilderCurrentPage(1);
              }}
              className="h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
            />
            <input
              type="date"
              value={builderDateTo}
              onChange={(e) => {
                setBuilderDateTo(e.target.value);
                setBuilderCurrentPage(1);
              }}
              className="h-9 px-3 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935]"
            />

            {(builderSearch ||
              builderDriver ||
              builderPaymentStatus ||
              builderDateFrom ||
              builderDateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBuilderSearch("");
                  setBuilderDriver("");
                  setBuilderPaymentStatus("");
                  setBuilderDateFrom("");
                  setBuilderDateTo("");
                  setBuilderCurrentPage(1);
                }}
              >
                Reset
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={handleBuilderExportCSV}
              >
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleBuilderExportExcel}
              >
                Excel (.xlsx)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={FileText}
                onClick={handleBuilderExportPDF}
              >
                PDF (.pdf)
              </Button>
            </div>
          </div>

          {/* Builder Step 4: Live Preview Table with Totals */}
          {activeColumns.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
              Please check at least one column above to preview your custom
              report.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FB] border-b border-[#E5E7EB] text-[#6B7280]">
                      {activeColumns.map((c) => (
                        <th
                          key={c.key}
                          className={`py-2.5 px-3 font-semibold ${
                            c.type === "amount" || c.type === "number"
                              ? "text-right"
                              : "text-left"
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {paginatedBuilderData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={activeColumns.length}
                          className="py-8 text-center text-xs text-[#6B7280]"
                        >
                          No matching records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedBuilderData.map((row, idx) => (
                        <tr
                          key={row.id || idx}
                          className="hover:bg-gray-50/70 transition-colors"
                        >
                          {activeColumns.map((col) => {
                            const val = row[col.key];
                            if (col.type === "amount") {
                              return (
                                <td
                                  key={col.key}
                                  className="py-2.5 px-3 text-right font-semibold text-[#202124]"
                                >
                                  {formatCurrency(val)}
                                </td>
                              );
                            }
                            if (col.type === "status") {
                              return (
                                <td key={col.key} className="py-2.5 px-3">
                                  <StatusBadge status={val} size="sm" />
                                </td>
                              );
                            }
                            if (col.type === "date") {
                              return (
                                <td
                                  key={col.key}
                                  className="py-2.5 px-3 text-[#6B7280]"
                                >
                                  {formatDate(val)}
                                </td>
                              );
                            }
                            return (
                              <td
                                key={col.key}
                                className={`py-2.5 px-3 text-[#202124] ${
                                  col.type === "number"
                                    ? "text-right font-mono"
                                    : ""
                                }`}
                              >
                                {val ?? "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Totals Summary Row */}
                  {filteredJoinedData.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#F8F9FB] border-t-2 border-[#E5E7EB] font-bold text-xs text-[#202124]">
                        {activeColumns.map((col, idx) => {
                          if (idx === 0) {
                            return (
                              <td key={col.key} className="py-2.5 px-3">
                                TOTALS ({filteredJoinedData.length} rows)
                              </td>
                            );
                          }
                          if (col.type === "amount") {
                            return (
                              <td
                                key={col.key}
                                className="py-2.5 px-3 text-right text-[#E53935]"
                              >
                                {formatCurrency(totalsRow[col.key] || 0)}
                              </td>
                            );
                          }
                          if (col.type === "number") {
                            return (
                              <td
                                key={col.key}
                                className="py-2.5 px-3 text-right font-mono"
                              >
                                {totalsRow[col.key] || 0}
                              </td>
                            );
                          }
                          return <td key={col.key} className="py-2.5 px-3" />;
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <Pagination
                currentPage={builderCurrentPage}
                totalPages={builderTotalPages}
                totalItems={filteredJoinedData.length}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setBuilderCurrentPage(p)}
                className="px-4 border-t border-[#E5E7EB]"
              />
            </div>
          )}
        </div>
      )}

      {/* MODAL: SAVE REPORT TEMPLATE */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Custom Report Template"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveReportTemplate}>
              Save to Browser
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Report Title"
            value={reportTitleInput}
            onChange={(e) => setReportTitleInput(e.target.value)}
            placeholder="e.g. Monthly Outstation Freight by Driver"
            required
          />
          <p className="text-[11px] text-[#6B7280]">
            Saves your chosen base table, selected columns, custom headers, and
            order to your local browser storage.
          </p>
        </div>
      </Modal>

      {/* MODAL: SAVED REPORT TEMPLATES LIST */}
      <Modal
        isOpen={savedReportsModalOpen}
        onClose={() => setSavedReportsModalOpen(false)}
        title="Saved Report Templates"
        size="md"
      >
        <div className="space-y-3">
          {savedReports.length === 0 ? (
            <p className="text-xs text-[#6B7280] text-center py-6">
              No custom reports saved yet. Build a query and click "Save This
              Report".
            </p>
          ) : (
            <div className="space-y-2">
              {savedReports.map((rpt) => (
                <div
                  key={rpt.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <h5 className="font-bold text-xs text-[#202124]">
                      {rpt.title}
                    </h5>
                    <div className="text-[11px] text-[#6B7280] mt-0.5">
                      Base: {rpt.baseTable} •{" "}
                      {rpt.selectedColumnKeys?.length || 0} columns • Saved{" "}
                      {formatDate(rpt.savedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLoadSavedReport(rpt)}
                    >
                      Load
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteSavedReport(rpt.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-[#DC2626] rounded-lg transition-colors cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Reports;
