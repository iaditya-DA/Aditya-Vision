import { getStatusVariant } from "../../utils/formatters";

const StatusBadge = ({
  status = "",
  size = "sm",
  showDot = true,
  className = "",
}) => {
  const variant = getStatusVariant(status);

  const sizeClasses = {
    sm: "text-xs px-2.5 py-0.5",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${variant.bg}
        ${sizeClasses[size] || sizeClasses.sm}
        ${className}
      `}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${variant.dot}`}
        />
      )}
      <span className="capitalize">{status}</span>
    </span>
  );
};

export default StatusBadge;
