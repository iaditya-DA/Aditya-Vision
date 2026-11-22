import { Calendar, RotateCcw } from "lucide-react";

const DateRangeFilter = ({
  startDate = "",
  endDate = "",
  onStartDateChange,
  onEndDateChange,
  onReset = null,
  className = "",
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="pl-8 pr-2.5 py-1.5 h-9 text-xs rounded-lg bg-white border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
          title="Start Date"
        />
      </div>
      <span className="text-xs text-[#6B7280]">to</span>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="pl-8 pr-2.5 py-1.5 h-9 text-xs rounded-lg bg-white border border-[#E5E7EB] text-[#202124] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
          title="End Date"
        />
      </div>
      {(startDate || endDate) && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="p-1.5 text-gray-400 hover:text-[#E53935] hover:bg-[#FFF1F0] rounded-lg transition-colors"
          title="Reset Dates"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default DateRangeFilter;
