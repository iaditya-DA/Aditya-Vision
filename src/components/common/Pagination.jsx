import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  pageSize = 10,
  totalItems = 0,
  className = "",
}) => {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 ${className}`}
    >
      <div className="text-xs text-[#6B7280]">
        Showing{" "}
        <span className="font-semibold text-[#202124]">{startItem}</span> to{" "}
        <span className="font-semibold text-[#202124]">{endItem}</span> of{" "}
        <span className="font-semibold text-[#202124]">{totalItems}</span>{" "}
        entries
      </div>

      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`
              min-w-8 h-8 text-xs font-medium rounded-lg transition-colors
              ${
                page === currentPage
                  ? "bg-[#E53935] text-white"
                  : "bg-white border border-[#E5E7EB] text-[#202124] hover:bg-gray-50"
              }
            `}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
