const PageHeader = ({
  title,
  description,
  children = null,
  action = null,
  className = "",
}) => {
  const headerContent = children || action;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-[#E5E7EB] ${className}`}
    >
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-[#202124] font-heading">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-sm font-medium text-[#6B7280]">
            {description}
          </p>
        )}
      </div>
      {headerContent && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          {headerContent}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
