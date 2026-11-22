import { useEffect } from "react";
import { X } from "lucide-react";

const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer = null,
  showCloseButton = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={`
            relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all
            w-full ${sizeClasses[size] || sizeClasses.md} my-8 border border-[#E5E7EB]
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white">
              <div>
                {title && (
                  <h3 className="text-base font-semibold text-[#202124]">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-[#6B7280] hover:bg-gray-100 hover:text-[#202124] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-3.5 bg-[#F8F9FB] border-t border-[#E5E7EB]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
