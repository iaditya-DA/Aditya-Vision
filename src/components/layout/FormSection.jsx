const FormSection = ({ number, title, children }) => {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs">
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-full bg-[#E53935] text-white text-xs font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <h2 className="text-sm font-bold text-[#202124]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
};

export default FormSection;
