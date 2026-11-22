import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const FormPage = ({ title, backTo, backLabel = "Back", actions, children }) => {
  return (
    <div className="max-w-[1100px] mx-auto space-y-6 pb-24">
      {/* Back + Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={backTo}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#E53935] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          <span className="text-[#D1D5DB]">/</span>
          <h1 className="text-xl font-extrabold text-[#202124] font-heading">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
};

export default FormPage;
