import { Loader2 } from "lucide-react";

const Button = ({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  icon: Icon = null,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  onClick,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeStyles = {
    sm: "text-xs px-2.5 py-1.5 h-8 gap-1.5",
    md: "text-sm px-3.5 py-2 h-9 gap-2",
    lg: "text-base px-5 py-2.5 h-11 gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-[#E53935] hover:bg-[#C62828] text-white shadow-xs focus:ring-[#E53935]",
    secondary:
      "bg-white hover:bg-gray-50 text-[#202124] border border-[#E5E7EB] shadow-xs focus:ring-gray-300",
    outline:
      "bg-transparent hover:bg-[#FFF1F0] text-[#E53935] border border-[#E53935] focus:ring-[#E53935]",
    ghost:
      "bg-transparent hover:bg-gray-100 text-[#6B7280] hover:text-[#202124] focus:ring-gray-200",
    danger:
      "bg-[#DC2626] hover:bg-red-700 text-white shadow-xs focus:ring-red-500",
    success:
      "bg-[#16A34A] hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${sizeStyles[size] || sizeStyles.md}
        ${variantStyles[variant] || variantStyles.primary}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        Icon && iconPosition === "left" && <Icon className="w-4 h-4 shrink-0" />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === "right" && (
        <Icon className="w-4 h-4 shrink-0" />
      )}
    </button>
  );
};

export default Button;
