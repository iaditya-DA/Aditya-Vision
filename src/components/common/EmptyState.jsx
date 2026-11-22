import { Inbox } from "lucide-react";
import Button from "./Button";

const EmptyState = ({
  icon: Icon = Inbox,
  title = "No records found",
  description = "There is currently no data to display here.",
  actionLabel = null,
  onAction = null,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-[#E5E7EB] ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3.5">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-[#202124]">{title}</h3>
      <p className="mt-1 text-xs text-[#6B7280] max-w-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
