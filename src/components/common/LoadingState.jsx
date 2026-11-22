import { Loader2 } from "lucide-react";

const LoadingState = ({
  message = "Loading data...",
  rows = 3,
  className = "",
}) => {
  return (
    <div
      className={`p-8 bg-white rounded-xl border border-[#E5E7EB] flex flex-col items-center justify-center ${className}`}
    >
      <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mb-3" />
      <p className="text-xs font-medium text-[#6B7280]">{message}</p>

      {rows > 0 && (
        <div className="w-full max-w-md mt-6 space-y-2.5 animate-pulse">
          <div className="h-3.5 bg-gray-100 rounded w-full"></div>
          <div className="h-3.5 bg-gray-100 rounded w-4/5"></div>
          <div className="h-3.5 bg-gray-100 rounded w-2/3"></div>
        </div>
      )}
    </div>
  );
};

export default LoadingState;
