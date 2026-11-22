// Currency formatter for Indian Rupees (₹)
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "₹0";
  }
  const numericAmount = Number(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numericAmount);
};

// Date formatter for DD/MM/YYYY
export const formatDate = (dateInput) => {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
};

// Date with time formatter DD/MM/YYYY, hh:mm A
export const formatDateTime = (dateInput) => {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return String(dateInput);
  }
};

export { getDeliveryPaymentStatus } from "./paymentStatus.js";

// Status badge styling helper
export const getStatusVariant = (status) => {
  switch (status?.toLowerCase()) {
    case "delivered":
    case "completed":
    case "approved":
    case "active":
    case "success":
    case "paid":
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "in transit":
    case "picked up":
    case "assigned":
    case "processing":
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "partially paid":
    case "partial":
    case "pending":
    case "pending approval":
    case "created":
    case "pending payment":
    case "advance":
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    case "failed":
    case "unpaid":
    case "rejected":
    case "inactive":
    case "overdue":
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
    case "overpaid":
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    case "refunded":
    case "partially refunded":
      return {
        bg: "bg-gray-100 text-gray-700 border-gray-300",
        dot: "bg-gray-500",
      };
    case "cancelled":
      return {
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        dot: "bg-rose-400",
      };
    case "not requested":
    default:
      return {
        bg: "bg-gray-100 text-gray-700 border-gray-200",
        dot: "bg-gray-400",
      };
  }
};

// Generate realistic mock ID
export const generateId = (prefix = "REC") => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
};
