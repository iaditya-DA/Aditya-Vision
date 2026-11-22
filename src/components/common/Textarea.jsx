const Textarea = ({
  label,
  error,
  helperText,
  name,
  value,
  onChange,
  placeholder = "",
  rows = 3,
  required = false,
  disabled = false,
  className = "",
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
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className={`
          w-full rounded-lg text-sm bg-white border transition-colors duration-150
          p-3 shadow-2xs placeholder:text-gray-400
          ${
            error
              ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
              : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
          }
          ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "text-[#202124]"}
          focus:outline-none resize-none
        `}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-[#DC2626] font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-[#6B7280]">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Textarea;
