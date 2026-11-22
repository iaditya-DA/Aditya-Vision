const colorVariants = {
  red: {
    bg: "bg-[#FFF1F0]",
    text: "text-[#E53935]",
    border: "border-[#E53935]/15",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200/60",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200/60",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200/60",
  },
};

const StatCard = ({
  title,
  value,
  subtext = "",
  icon: Icon,
  variant = "red",
  className = "",
}) => {
  const v = colorVariants[variant] || colorVariants.red;

  return (
    <div
      className={`
        bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${v.bg} ${v.text} ${v.border}`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="text-2xl font-extrabold text-[#202124] tracking-tight font-heading">
          {value}
        </div>
        {subtext && (
          <p className="text-[11px] text-[#6B7280] font-medium mt-0.5 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
