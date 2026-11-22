import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger",
  loading = false,
}) => {
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
  };

  const currentConfig = iconConfig[type] || iconConfig.danger;
  const Icon = currentConfig.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={currentConfig.btnVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${currentConfig.bg}`}
        >
          <Icon className={`w-5 h-5 ${currentConfig.color}`} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-[#202124]">{title}</h4>
          <p className="mt-1.5 text-xs text-[#6B7280] leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
