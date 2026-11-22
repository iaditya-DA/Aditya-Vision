import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import LoadingState from "./LoadingState";
import EmptyState from "./EmptyState";

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = "No records found",
  emptyDescription = "Try adjusting your filters or search criteria.",
  onRowClick = null,
  keyField = "id",
  className = "",
  selectable = false,
  selectedIds = [],
  onSelectionChange = null,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (columnKey, isSortable) => {
    if (!isSortable) return;
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        if (prev.direction === "asc")
          return { key: columnKey, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  // Selection helpers
  const isAllSelected = useMemo(() => {
    if (!selectable || !data || data.length === 0) return false;
    return data.every((row) => selectedIds.includes(row[keyField]));
  }, [selectable, data, selectedIds, keyField]);

  const handleToggleSelectAll = (e) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (isAllSelected) {
      // Remove all current rows from selection
      const currentKeys = new Set(data.map((r) => r[keyField]));
      onSelectionChange(selectedIds.filter((id) => !currentKeys.has(id)));
    } else {
      // Add all current rows to selection
      const combined = new Set([...selectedIds, ...data.map((r) => r[keyField])]);
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

  if (loading) {
    return <LoadingState message="Loading data..." />;
  }

  if (!loading && (!data || data.length === 0)) {
    return <EmptyState title={emptyMessage} description={emptyDescription} />;
  }

  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs ${className}`}
    >
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-[#FAFBFD] border-b border-[#E5E7EB]">
            {selectable && (
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  aria-label="Select all rows"
                  className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                />
              </th>
            )}

            {columns.map((col) => {
              const isSorted = sortConfig.key === col.key;
              const isSortable = col.sortable !== false;
              return (
                <th
                  key={col.key || col.label}
                  onClick={() => handleSort(col.key, isSortable)}
                  className={`
                    px-4 py-3 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider
                    ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                    ${isSortable ? "cursor-pointer select-none hover:bg-gray-100/70 transition-colors" : ""}
                    ${col.className || ""}
                  `}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === "right"
                        ? "justify-end w-full"
                        : col.align === "center"
                          ? "justify-center w-full"
                          : ""
                    }`}
                  >
                    <span>{col.label}</span>
                    {isSortable && (
                      <span className="text-gray-400">
                        {isSorted ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#E53935]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#E53935]" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB] bg-white">
          {sortedData.map((row, index) => {
            const rowKey = row[keyField] || index;
            const isRowSelected = selectable && selectedIds.includes(rowKey);

            return (
              <tr
                key={rowKey}
                onClick={() => onRowClick && onRowClick(row)}
                className={`
                  transition-colors duration-150
                  ${isRowSelected ? "bg-red-50/30" : "hover:bg-[#FFF8F7]"}
                  ${onRowClick ? "cursor-pointer" : ""}
                `}
              >
                {selectable && (
                  <td
                    className="w-10 px-3 py-3.5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={(e) => handleToggleRowSelect(e, rowKey)}
                      aria-label={`Select row ${rowKey}`}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300 cursor-pointer"
                    />
                  </td>
                )}

                {columns.map((col) => (
                  <td
                    key={col.key || col.label}
                    className={`
                      px-4 py-3.5 text-[#202124] text-sm
                      ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                      ${col.className || ""}
                    `}
                  >
                    {col.render
                      ? col.render(row[col.key], row, index)
                      : (row[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
