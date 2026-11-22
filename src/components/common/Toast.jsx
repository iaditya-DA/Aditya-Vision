import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from "lucide-react";

const Toast = ({ type = "info", message, onClose }) => {
  const configs = {
    success: {
      icon: CheckCircle2,
      border: "border-[#16A34A]/20",
      bg: "bg-white",
      iconColor: "text-[#16A34A]",
      accent: "bg-[#16A34A]",
    },
    error: {
      icon: AlertCircle,
      border: "border-[#DC2626]/20",
      bg: "bg-white",
      iconColor: "text-[#DC2626]",
      accent: "bg-[#DC2626]",
    },
    warning: {
      icon: AlertTriangle,
      border: "border-[#F59E0B]/20",
      bg: "bg-white",
      iconColor: "text-[#F59E0B]",
      accent: "bg-[#F59E0B]",
    },
    info: {
      icon: Info,
      border: "border-[#2563EB]/20",
      bg: "bg-white",
      iconColor: "text-[#2563EB]",
      accent: "bg-[#2563EB]",
    },
  };

  const config = configs[type] || configs.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        relative overflow-hidden flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all duration-200
        ${config.bg} ${config.border}
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ml-1 ${config.iconColor}`} />
      <div className="flex-1 text-xs font-medium text-[#202124] leading-relaxed">
        {message}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
