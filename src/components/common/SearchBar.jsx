import { Search, X } from "lucide-react";

const SearchBar = ({
  value = "",
  onChange,
  onClear = null,
  placeholder = "Search records...",
  className = "",
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 h-9 text-sm rounded-lg bg-white border border-[#E5E7EB] placeholder:text-gray-400 text-[#202124] focus:outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
            else onChange("");
          }}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
