const Input = ({
  label,
  error,
  helperText,
  icon: Icon = null,
  type = "text",
  name,
  value,
  onChange,
  placeholder = "",
  required = false,
  disabled = false,
  className = "",
  rightElement = null,
  ...props
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[#202124] mb-1.5">
          {label}
          {required && <span className="text-[#E53935] ml-1">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280]">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className={`
            w-full rounded-lg text-sm bg-white border transition-colors duration-150
            placeholder:text-gray-400
            ${Icon ? "pl-9" : "pl-3.5"}
            ${rightElement ? "pr-10" : "pr-3.5"}
            py-2 h-9
            ${
              error
                ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
            }
            ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "text-[#202124]"}
            focus:outline-none
          `}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-[#DC2626] font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-[#6B7280]">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Input;
