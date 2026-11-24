import { useMemo, useState } from "react";
import {
  Eye,
  RefreshCw,
  Edit,
  Trash2,
  Tv,
  Wind,
  Snowflake,
  Shirt,
  Microwave,
  Package,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Camera,
} from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { useAuth } from "../../hooks/useAuth";

// Helper for category icons
const getCategoryIcon = (category = "") => {
  const cat = category.toLowerCase();
  if (cat.includes("television") || cat.includes("audio")) return Tv;
  if (cat.includes("air condition")) return Wind;
  if (cat.includes("cooling") || cat.includes("refrigerator")) return Snowflake;
  if (cat.includes("washing")) return Shirt;
  if (cat.includes("kitchen") || cat.includes("microwave")) return Microwave;
  return Package;
};

const DeliveriesTable = ({
  deliveries = [],
  onViewDetails,
  onUpdateStatus,
  onEdit,
  onDelete = null,
  selectable = false,
  selectedIds = [],
  onSelectionChange = null,
  loading = false,
  emptyMessage = "No delivery records found",
  emptyDescription = "There are no deliveries matching the selected criteria.",
  showPaymentStatus = true,
  className = "",
}) => {
  const { getPaymentStatus } = usePaymentStatus();
  const { isSuperAdmin } = useAuth();
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("desc");

  const isAllSelected = useMemo(() => {
    if (!selectable || !deliveries.length) return false;
    return deliveries.every((d) => selectedIds.includes(d.id));
  }, [selectable, deliveries, selectedIds]);

  const handleToggleSelectAll = (e) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (isAllSelected) {
      const currentKeys = new Set(deliveries.map((d) => d.id));
      onSelectionChange(selectedIds.filter((id) => !currentKeys.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...deliveries.map((d) => d.id)]);
      onSelectionChange(Array.from(combined));
    }
  };

  const handleToggleRowSelect = (e, rowId) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(rowId)) {
      onSelectionChange(selectedIds.filter((id) => id !== rowId));
    } else {
      onSelectionChange([...selectedIds, rowId]);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedDeliveries = useMemo(() => {
    if (!sortKey) return deliveries;
    return [...deliveries].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === "charges") {
        aVal =
          (Number(a.deliveryCharges) || 0) + (Number(a.additionalCharges) || 0);
        bVal =
          (Number(b.deliveryCharges) || 0) + (Number(b.additionalCharges) || 0);
      } else if (sortKey === "paymentStatus") {
        aVal = getPaymentStatus(a);
        bVal = getPaymentStatus(b);
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));

      return sortDir === "asc" ? comp : -comp;
    });
  }, [deliveries, sortKey, sortDir, getPaymentStatus]);

  if (loading) {
    return <LoadingState message="Loading deliveries..." />;
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="p-8">
        <EmptyState title={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* ========================================================= */}
      {/* 1. DESKTOP / TABLET VIEW (640px and up)                   */}
      {/* Exact 10/11 columns matching wireframe                    */}
      {/* ========================================================= */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-[#FAFBFD] border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider select-none">
              {selectable && (
                <th className="px-3 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                    aria-label="Select all deliveries"
                  />
                </th>
              )}
              {/* 1. DELIVERY ID */}
              <th
                onClick={() => handleSort("id")}
                className="px-3.5 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[11%]"
              >
                <div className="flex items-center gap-1">
                  <span>DELIVERY ID</span>
                  {sortKey === "id" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 2. INVOICE NO. */}
              <th
                onClick={() => handleSort("invoiceNumber")}
                className="px-3.5 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[10%]"
              >
                <div className="flex items-center gap-1">
                  <span>INVOICE NO.</span>
                  {sortKey === "invoiceNumber" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 3. CUSTOMER NAME */}
              <th
                onClick={() => handleSort("customerName")}
                className="px-3.5 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[14%]"
              >
                <div className="flex items-center gap-1">
                  <span>CUSTOMER NAME</span>
                  {sortKey === "customerName" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 4. PRODUCT */}
              <th
                onClick={() => handleSort("productName")}
                className="px-3.5 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[18%]"
              >
                <div className="flex items-center gap-1">
                  <span>PRODUCT</span>
                  {sortKey === "productName" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 5. ASSIGNED DRIVER */}
              <th
                onClick={() => handleSort("driverName")}
                className="px-3.5 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[12%]"
              >
                <div className="flex items-center gap-1">
                  <span>ASSIGNED DRIVER</span>
                  {sortKey === "driverName" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 6. DATE */}
              <th
                onClick={() => handleSort("deliveryDate")}
                className="px-3 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[8%]"
              >
                <div className="flex items-center gap-1">
                  <span>DATE</span>
                  {sortKey === "deliveryDate" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 7. DISTANCE */}
              <th
                onClick={() => handleSort("distanceKm")}
                className="px-3 py-3.5 cursor-pointer hover:bg-gray-100/70 transition-colors w-[7%]"
              >
                <div className="flex items-center gap-1">
                  <span>DISTANCE</span>
                  {sortKey === "distanceKm" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 8. CHARGES */}
              <th
                onClick={() => handleSort("charges")}
                className="px-3 py-3.5 text-right cursor-pointer hover:bg-gray-100/70 transition-colors w-[7%]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>CHARGES</span>
                  {sortKey === "charges" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 9. STATUS */}
              <th
                onClick={() => handleSort("status")}
                className="px-3 py-3.5 text-center cursor-pointer hover:bg-gray-100/70 transition-colors w-[9%]"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>STATUS</span>
                  {sortKey === "status" ? (
                    sortDir === "asc" ? (
                      <ChevronUp className="w-3 h-3 text-[#E53935]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[#E53935]" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </th>

              {/* 10. PAYMENT STATUS (if enabled) */}
              {showPaymentStatus && (
                <th
                  onClick={() => handleSort("paymentStatus")}
                  className="px-3 py-3.5 text-center cursor-pointer hover:bg-gray-100/70 transition-colors w-[10%]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>PAYMENT STATUS</span>
                    {sortKey === "paymentStatus" ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="w-3 h-3 text-[#E53935]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[#E53935]" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                    )}
                  </div>
                </th>
              )}

              {/* ACTIONS */}
              <th className="px-3.5 py-3.5 text-right w-[8%]">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {sortedDeliveries.map((row) => {
              const CategoryIcon = getCategoryIcon(row.category);
              const totalCharges =
                (Number(row.deliveryCharges) || 0) +
                (Number(row.additionalCharges) || 0);
              const pStatus = getPaymentStatus(row);

              return (
                <tr
                  key={row.id}
                  className={`group hover:bg-[#FFF8F7] transition-colors duration-150 ${selectedIds.includes(row.id) ? "bg-red-50/40" : ""}`}
                >
                  {selectable && (
                    <td className="px-3 py-3.5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => handleToggleRowSelect(e, row.id)}
                        className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                        aria-label={`Select delivery ${row.id}`}
                      />
                    </td>
                  )}
                  {/* 1. DELIVERY ID */}
                  <td className="px-3.5 py-3.5 align-middle">
                    <span className="font-mono font-bold text-[#202124] text-[13px]">
                      {row.id}
                    </span>
                  </td>

                  {/* 2. INVOICE NO. */}
                  <td className="px-3.5 py-3.5 align-middle">
                    <span className="font-mono text-[12px] text-[#6B7280]">
                      {row.invoiceNumber}
                    </span>
                  </td>

                  {/* 3. CUSTOMER NAME (Name + Mobile below) */}
                  <td className="px-3.5 py-3.5 align-middle">
                    <span className="font-bold text-[#202124] text-[13px] block truncate">
                      {row.customerName}
                    </span>
                    <span className="text-[11px] text-[#6B7280] font-mono block mt-0.5">
                      {row.customerMobile || "-"}
                    </span>
                  </td>

                  {/* 4. PRODUCT (Title + Category below) */}
                  <td className="px-3.5 py-3.5 align-middle">
                    <span
                      className="font-medium text-[#202124] text-xs line-clamp-1 block"
                      title={row.productName}
                    >
                      {row.productName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] mt-0.5">
                      <CategoryIcon className="w-3 h-3 text-[#E53935] shrink-0" />
                      <span className="truncate">{row.category}</span>
                      {(row.image?.url || row.imageUrl) && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[#E53935] bg-[#FFF1F0] px-1.5 py-0.5 rounded font-medium text-[10px] shrink-0"
                          title="Product Photo Attached"
                        >
                          <Camera className="w-2.5 h-2.5" />
                          <span>Photo</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. ASSIGNED DRIVER */}
                  <td className="px-3.5 py-3.5 align-middle">
                    {row.driverName && row.driverName !== "Unassigned" ? (
                      <span className="font-medium text-[#202124] text-xs truncate block">
                        {row.driverName}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium italic block">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* 6. DATE */}
                  <td className="px-3 py-3.5 align-middle">
                    <span className="text-xs text-[#202124] block">
                      {formatDate(row.deliveryDate)}
                    </span>
                  </td>

                  {/* 7. DISTANCE */}
                  <td className="px-3 py-3.5 align-middle">
                    <span className="text-xs font-mono text-[#6B7280] block">
                      {row.distanceKm ? `${row.distanceKm} KM` : "-"}
                    </span>
                  </td>

                  {/* 8. CHARGES */}
                  <td className="px-3 py-3.5 align-middle text-right">
                    <span className="font-bold text-[#202124] text-sm">
                      {formatCurrency(totalCharges)}
                    </span>
                  </td>

                  {/* 9. STATUS */}
                  <td className="px-3 py-3.5 align-middle text-center">
                    <StatusBadge status={row.status} size="sm" />
                  </td>

                  {/* 10. PAYMENT STATUS (if enabled) */}
                  {showPaymentStatus && (
                    <td className="px-3 py-3.5 align-middle text-center">
                      <StatusBadge status={pStatus} size="sm" />
                    </td>
                  )}

                  {/* ACTIONS */}
                  <td className="px-3.5 py-3.5 align-middle text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {onViewDetails && (
                        <button
                          type="button"
                          onClick={() => onViewDetails(row)}
                          className="p-1.5 text-[#6B7280] hover:text-[#202124] hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#E5E7EB]"
                          title="View Details"
                          aria-label={`View details for delivery ${row.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {isSuperAdmin && onUpdateStatus && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(row)}
                          className="p-1.5 text-[#6B7280] hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                          title="Update Status"
                          aria-label={`Update status for delivery ${row.id}`}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {isSuperAdmin && onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-[#6B7280] hover:text-[#E53935] hover:bg-[#FFF1F0] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#E53935]/20"
                          title="Edit Order"
                          aria-label={`Edit delivery ${row.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDelete(row);
                          }}
                          className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
                          title="Delete Delivery"
                          aria-label={`Delete delivery ${row.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 2. MOBILE VIEW (<640px)                                   */}
      {/* Responsive stacked cards per delivery, 0 horizontal scroll */}
      {/* ========================================================= */}
      <div className="sm:hidden divide-y divide-[#E5E7EB]">
        {sortedDeliveries.map((row) => {
          const CategoryIcon = getCategoryIcon(row.category);
          const totalCharges =
            (Number(row.deliveryCharges) || 0) +
            (Number(row.additionalCharges) || 0);
          const pStatus = getPaymentStatus(row);

          return (
            <div key={row.id} className="p-4 space-y-3 hover:bg-[#FFF8F7]/50">
              {/* Header: ID, Invoice & Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleToggleRowSelect(e, row.id)}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                      aria-label={`Select delivery ${row.id}`}
                    />
                  )}
                  <span className="font-mono font-bold text-[#202124] text-xs">
                    {row.id}
                  </span>
                  <span className="text-[11px] text-[#6B7280] font-mono ml-1">
                    {row.invoiceNumber}
                  </span>
                </div>
                <span className="text-[11px] text-[#6B7280]">
                  {formatDate(row.deliveryDate)}
                </span>
              </div>

              {/* Product */}
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-[#202124] text-xs leading-snug">
                    {row.productName}
                  </p>
                  {(row.image?.url || row.imageUrl) && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[#E53935] bg-[#FFF1F0] px-1.5 py-0.5 rounded font-medium text-[10px] shrink-0"
                      title="Product Photo Attached"
                    >
                      <Camera className="w-2.5 h-2.5" />
                      <span>Photo</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] mt-1">
                  <CategoryIcon className="w-3 h-3 text-[#E53935] shrink-0" />
                  <span>{row.category}</span>
                </div>
              </div>

              {/* Customer & Driver row */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#E5E7EB]/70">
                <div>
                  <span className="text-[10px] text-[#6B7280] uppercase font-bold block">
                    Customer
                  </span>
                  <span className="font-semibold text-[#202124] block truncate">
                    {row.customerName}
                  </span>
                  <span className="text-[11px] text-[#6B7280] font-mono">
                    {row.customerMobile}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[#6B7280] uppercase font-bold block">
                    Driver
                  </span>
                  <span className="font-semibold text-[#202124] block truncate">
                    {row.driverName || "Unassigned"}
                  </span>
                  <span className="text-[11px] text-[#6B7280] font-mono">
                    {row.distanceKm ? `${row.distanceKm} KM` : "-"}
                  </span>
                </div>
              </div>

              {/* Badges & Charges */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]/70">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={row.status} size="sm" />
                  {showPaymentStatus && (
                    <StatusBadge status={pStatus} size="sm" />
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#202124]">
                    {formatCurrency(totalCharges)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]/50">
                {onViewDetails && (
                  <button
                    type="button"
                    onClick={() => onViewDetails(row)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#E5E7EB] text-[#202124] hover:bg-gray-100 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                )}
                {isSuperAdmin && onUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(row)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Status
                  </button>
                )}
                {isSuperAdmin && onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#E53935]/20 text-[#E53935] bg-[#FFF1F0] hover:bg-[#FFF1F0]/80 flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDelete(row);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeliveriesTable;
