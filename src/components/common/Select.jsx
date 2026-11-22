const Select = ({
  label,
  options = [],
  value,
  onChange,
  error,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  name,
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
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`
            w-full rounded-lg text-sm bg-white border appearance-none transition-colors duration-150
            pl-3.5 pr-8 py-2 h-9 shadow-2xs
            ${
              error
                ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
            }
            ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "text-[#202124]"}
            focus:outline-none
          `}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const isObj = typeof opt === "object" && opt !== null;
            const val = isObj ? opt.value : opt;
            const lbl = isObj ? opt.label : opt;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-xs text-[#DC2626] font-medium">{error}</p>
      )}
    </div>
  );
};

export default Select;
