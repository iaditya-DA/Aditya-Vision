import { useState, useEffect } from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";

const ConfirmDialog = ({
  open,
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger",
  variant,
  loading = false,
  requireKeyword = false,
  keyword = "DELETE",
  recordType = "",
  recordTitle = "",
  selectedCount = 0,
  showReasonInput = false,
  reason: controlledReason = "",
  onReasonChange = null,
}) => {
  const isModalOpen = Boolean(open !== undefined ? open : isOpen);
  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const [keywordInput, setKeywordInput] = useState("");
  const [internalReason, setInternalReason] = useState("");

  useEffect(() => {
    if (isModalOpen) {
      Promise.resolve().then(() => {
        setKeywordInput("");
        setInternalReason("");
      });
    }
  }, [isModalOpen]);

  const activeReason = controlledReason || internalReason || "";

  const iconConfig = {
    danger: {
      icon: AlertTriangle,
      color: "text-[#DC2626]",
      bg: "bg-red-50",
      btnVariant: "danger",
    },
    warning: {
      icon: AlertCircle,
      color: "text-[#F59E0B]",
      bg: "bg-amber-50",
      btnVariant: "primary",
    },
    info: {
      icon: Info,
      color: "text-[#2563EB]",
      bg: "bg-blue-50",
      btnVariant: "primary",
    },
    default: {
      icon: Info,
      color: "text-[#2563EB]",
      bg: "bg-blue-50",
      btnVariant: "primary",
    },
  };

  const resolvedType = variant || type || "danger";
  const currentConfig = iconConfig[resolvedType] || iconConfig.danger;
  const Icon = currentConfig.icon;

  const isKeywordMatching =
    !requireKeyword ||
    keywordInput.trim().toUpperCase() === keyword.toUpperCase();
  const canConfirm = !loading && isKeywordMatching;

  const handleConfirmAction = () => {
    if (canConfirm && onConfirm) {
      onConfirm({ reason: activeReason });
    }
  };

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={handleClose}
      size="sm"
      showCloseButton={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={currentConfig.btnVariant}
            onClick={handleConfirmAction}
            loading={loading}
            disabled={!canConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${currentConfig.bg}`}
          >
            <Icon className={`w-5 h-5 ${currentConfig.color}`} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-[#202124]">{title}</h4>
            <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
              {message}
            </p>

            {(recordTitle || recordType || selectedCount > 0) && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-gray-50 border border-[#E5E7EB] text-xs">
                {recordType && (
                  <div className="text-[11px] text-[#6B7280]">
                    Target Type: <strong className="text-[#202124]">{recordType}</strong>
                  </div>
                )}
                {recordTitle && (
                  <div className="text-[11px] text-[#202124] font-medium truncate mt-0.5">
                    Target: {recordTitle}
                  </div>
                )}
                {selectedCount > 0 && (
                  <div className="text-[11px] text-[#DC2626] font-bold mt-0.5">
                    Selected Records: {selectedCount}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Require Keyword (Type DELETE to confirm) */}
        {requireKeyword && (
          <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
            <label className="text-xs font-bold text-[#374151] block">
              Type <span className="font-mono text-[#DC2626] font-black">{keyword}</span> to confirm deletion:
            </label>
            <input
              type="text"
              autoFocus
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={`Type "${keyword}"`}
              className="w-full text-xs font-mono px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-[#DC2626] uppercase"
            />
          </div>
        )}

        {/* Optional Deletion Reason Input */}
        {showReasonInput && (
          <div className="pt-1">
            <Input
              label="Reason for Audit Log (Optional)"
              value={activeReason}
              onChange={(e) => {
                setInternalReason(e.target.value);
                if (onReasonChange) onReasonChange(e.target.value);
              }}
              placeholder="e.g. Duplicate order entry, Customer cancellation"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
