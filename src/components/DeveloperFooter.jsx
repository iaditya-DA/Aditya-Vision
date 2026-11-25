import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const DeveloperFooter = () => {
  return (
    <div className="w-full flex justify-center py-6 px-4 select-none">
      <Link
        to="/about-developer"
        aria-label="About the developer, Aditya Kumar Jha"
        className="group flex items-center gap-3 w-full max-w-[420px] bg-white rounded-2xl border border-rose-100 shadow-sm px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E53935]"
      >
        {/* Left: Avatar with green availability dot */}
        <div className="relative shrink-0">
          <img
            src="/developer.jpg"
            onError={(e) => {
              if (e.currentTarget.src.endsWith(".jpg")) {
                e.currentTarget.src = "/developer.jpeg";
              }
            }}
            alt="Aditya Kumar Jha"
            className="w-11 h-11 rounded-full object-cover ring-2 ring-rose-100"
            style={{ objectPosition: "center 25%" }}
          />
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white animate-pulse"
            title="Open to opportunities"
          />
        </div>

        {/* Middle: Info */}
        <div className="min-w-0 flex-1 text-left">
          <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold leading-none mb-1">
            DEVELOPED BY
          </span>
          <p className="font-semibold text-gray-900 group-hover:text-[#E53935] transition-colors leading-tight truncate text-sm">
            Aditya Kumar Jha
          </p>
          <p className="text-xs text-gray-500 truncate leading-tight mt-0.5">
            Android Developer · Open to work
          </p>
        </div>

        {/* Right: Red circle with ArrowUpRight */}
        <span className="w-9 h-9 rounded-full bg-[#E53935] text-white flex items-center justify-center shrink-0 shadow-xs">
          <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </div>
  );
};

export default DeveloperFooter;
