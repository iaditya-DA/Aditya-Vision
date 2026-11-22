import { useState, useEffect } from "react";
import {
  X,
  Check,
  Banknote,
  Smartphone,
  Building2,
  FileText,
  MoreHorizontal,
  Info,
} from "lucide-react";
import StatusBadge from "../../components/common/StatusBadge";

import { formatCurrency, formatDateTime } from "../../utils/formatters";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";

// ─── Constants ───────────────────────────────────────────────────────────────

// Main ordered delivery statuses (shown as stepper)
const STEPPER_STATUSES = ["Created", "Assigned", "Picked Up", "In Transit", "Delivered"];
// Fallback statuses shown as outlined chips below
const ALT_STATUSES = ["Failed", "Cancelled"];

const PAYMENT_MODES = [
  { value: "Cash",          label: "Cash",         Icon: Banknote      },
  { value: "UPI",           label: "UPI",          Icon: Smartphone    },
  { value: "Bank Transfer", label: "Bank",         Icon: Building2     },
  { value: "Cheque",        label: "Cheque",       Icon: FileText      },
  { value: "Other",         label: "Other",        Icon: MoreHorizontal },
];

const PAYMENT_TYPES = ["Full", "Partial", "Advance"];

// ─── Utility ──────────────────────────────────────────────────────────────────
const stepperIndex = (status) => STEPPER_STATUSES.indexOf(status);

// ─── Sub-components (hoisted) ─────────────────────────────────────────────────

// Summary strip
function SummaryStrip({ delivery, summary, paymentStatus }) {
  const bal = summary.balanceDue;
  return (
    <div className="rounded-xl bg-[#FFF1F0] border border-[#FECDD3] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left: customer + product */}
      <div className="min-w-0">
        <p className="font-semibold text-[#202124] text-sm truncate">{delivery.customerName}</p>
        <p className="text-xs text-[#6B7280] truncate mt-0.5">{delivery.productName}</p>
        {delivery.driverName && delivery.driverName !== "Unassigned" && (
          <p className="text-xs text-[#6B7280] mt-0.5">
            Driver:{" "}
            <span className="font-medium text-[#202124]">{delivery.driverName}</span>
          </p>
        )}
      </div>

      {/* Right: figures + badges */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Financial row */}
        <div className="flex gap-3 text-xs">
          <div className="text-center">
            <p className="text-[#6B7280] text-[10px] font-medium uppercase tracking-wide">Charges</p>
            <p className="font-bold text-[#202124] text-sm">{formatCurrency(summary.charges)}</p>
          </div>
          <div className="w-px bg-[#FECDD3]" />
          <div className="text-center">
            <p className="text-[#6B7280] text-[10px] font-medium uppercase tracking-wide">Paid</p>
            <p className="font-bold text-emerald-600 text-sm">{formatCurrency(summary.totalPaid)}</p>
          </div>
          <div className="w-px bg-[#FECDD3]" />
          <div className="text-center">
            <p className="text-[#6B7280] text-[10px] font-medium uppercase tracking-wide">Balance</p>
            <p className={`font-bold text-sm ${bal > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(bal)}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-1.5 flex-wrap">
          <StatusBadge status={delivery.status} size="sm" />
          <StatusBadge status={paymentStatus} size="sm" />
        </div>
      </div>
    </div>
  );
}

// Status stepper
function StatusStepper({ selected, onSelect }) {
  const selIdx = stepperIndex(selected);

  return (
    <div className="space-y-3">
      {/* Main stepper chips */}
      <div className="flex flex-wrap gap-2">
        {STEPPER_STATUSES.map((s, i) => {
          const isCurrent = s === selected;
          const isDone = selIdx > i && !isCurrent;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelect(s)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
                ${isCurrent
                  ? "bg-[#E53935] text-white border-[#E53935] shadow-sm"
                  : isDone
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#E53935] hover:text-[#E53935]"
                }
              `}
            >
              {isCurrent && <Check className="w-3 h-3" />}
              {isDone && <Check className="w-3 h-3 text-emerald-500" />}
              {!isCurrent && !isDone && (
                <span className="w-3 h-3 rounded-full border border-current inline-flex items-center justify-center text-[8px] font-bold">
                  {i + 1}
                </span>
              )}
              {s}
            </button>
          );
        })}
      </div>

      {/* Alt status chips */}
      <div className="flex gap-2">
        {ALT_STATUSES.map((s) => {
          const isCurrent = s === selected;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelect(s)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
                ${isCurrent
                  ? "bg-red-50 text-red-700 border-red-400"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-red-400 hover:text-red-600"
                }
              `}
            >
              {isCurrent && <Check className="w-3 h-3" />}
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Payment mode chips
function PaymentModeChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAYMENT_MODES.map(({ value: v, label, Icon }) => {
        const sel = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
              ${sel
                ? "bg-[#FFF1F0] text-[#E53935] border-[#E53935]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#E53935] hover:text-[#E53935]"
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Segmented control (Payment Type / Yes-No)
function Segmented({ options, value, onChange, colorMap = {} }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E5E7EB] overflow-hidden">
      {options.map((opt) => {
        const sel = opt === value;
        const color = colorMap[opt] || "bg-[#E53935] text-white";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`
              px-4 py-1.5 text-xs font-semibold transition-all focus:outline-none border-r border-[#E5E7EB] last:border-r-0
              ${sel ? color : "bg-white text-[#6B7280] hover:text-[#202124]"}
            `}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Read-only summary (non-SA)
function PaymentReadOnly({ summary }) {
  if (!summary.lastPayment) return null;
  const p = summary.lastPayment;
  return (
    <div className="rounded-xl bg-[#F8F9FB] border border-[#E5E7EB] p-4 text-xs space-y-2">
      <p className="font-semibold text-[#202124] text-[11px] uppercase tracking-wide">Last Driver Payment</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-[#6B7280]">Mode</p>
          <p className="font-medium text-[#202124]">{p.paymentMode}</p>
        </div>
        {p.utrNumber && p.utrNumber !== "-" && (
          <div>
            <p className="text-[#6B7280]">UTR / Ref</p>
            <p className="font-mono text-[#202124]">{p.utrNumber}</p>
          </div>
        )}
        <div>
          <p className="text-[#6B7280]">Amount</p>
          <p className="font-bold text-[#202124]">{formatCurrency(p.amount)}</p>
        </div>
        <div>
          <p className="text-[#6B7280]">Date</p>
          <p className="text-[#202124]">{p.paymentDate}</p>
        </div>
      </div>
    </div>
  );
}

// Section card wrapper
function SectionCard({ number, title, children }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFBFD]">
        <span className="w-5 h-5 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {number}
        </span>
        <span className="text-sm font-semibold text-[#202124]">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const UpdateStatusModal = ({ isOpen, onClose, delivery, onUpdateStatus }) => {
  const { isSuperAdmin, user } = useAuth();
  const { addPayment, getDeliveryPaymentSummary, getPaymentStatus } = usePayments();

  // ── Status state ─────────────────────────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState(delivery?.status || "");
  const [note, setNote] = useState("");

  // ── Payment state ─────────────────────────────────────────────────────────
  const [driverPaid, setDriverPaid]       = useState(false);
  const [paymentMode, setPaymentMode]     = useState("UPI");
  const [paymentType, setPaymentType]     = useState("Full");
  const [amount, setAmount]               = useState("");
  const [utrNumber, setUtrNumber]         = useState("");
  const [paymentDate, setPaymentDate]     = useState(() => new Date().toISOString().split("T")[0]);
  const [addingMore, setAddingMore]       = useState(false);
  const [errors, setErrors]               = useState({});

  // Reset when delivery/open changes
  useEffect(() => {
    if (!delivery || !isOpen) return;
    const total =
      (Number(delivery.deliveryCharges) || 0) +
      (Number(delivery.additionalCharges) || 0);
    Promise.resolve().then(() => {
      setSelectedStatus(delivery.status || "");
      setNote("");
      setDriverPaid(false);
      setPaymentMode("UPI");
      setPaymentType("Full");
      setUtrNumber("");
      setAddingMore(false);
      setAmount(String(total));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setErrors({});
    });
  }, [delivery?.id, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !delivery) return null;

  // ── Computed ─────────────────────────────────────────────────────────────
  const summary       = getDeliveryPaymentSummary(delivery);
  const paymentStatus = getPaymentStatus(delivery);
  const hasDriver     =
    delivery.driverId &&
    delivery.driverId !== "" &&
    delivery.driverId !== "Unassigned";
  const hasExistingPayments = summary.payments.length > 0;
  const amountNum     = Number(amount) || 0;
  const afterThis     = Math.max(0, summary.balanceDue - amountNum);
  const needsUtr      = paymentMode === "UPI" || paymentMode === "Bank Transfer" || paymentMode === "Cheque";
  const utrLabel =
    paymentMode === "UPI"           ? "UPI Transaction ID / UTR" :
    paymentMode === "Bank Transfer" ? "NEFT / RTGS / IMPS UTR"  :
    paymentMode === "Cheque"        ? "Cheque Number"            : null;

  const footerLive = isSuperAdmin && driverPaid && hasDriver && amountNum > 0
    ? `Recording ${formatCurrency(amountNum)} via ${paymentMode}`
    : null;

  // ── Validation & submit ──────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!selectedStatus) errs.status = "Select a status";
    if (isSuperAdmin && driverPaid && hasDriver) {
      if (!amountNum || amountNum <= 0) errs.amount = "Enter a valid amount";
      if (needsUtr && !utrNumber.trim()) errs.utr = `${utrLabel} is required`;
    }
    return errs;
  };

  const isSaveDisabled =
    !selectedStatus ||
    (isSuperAdmin && driverPaid && hasDriver && (!amountNum || (needsUtr && !utrNumber.trim())));

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // 1. Status update
    const timelineItem = {
      status: selectedStatus,
      timestamp: formatDateTime(new Date()),
      note: note.trim() ||
        `Status updated to ${selectedStatus} by ${user?.name || "supervisor"}.`,
    };
    onUpdateStatus(delivery.id, selectedStatus, timelineItem);

    // 2. Payment (SA only)
    if (isSuperAdmin && driverPaid && hasDriver && amountNum > 0) {
      addPayment({
        deliveryId:  delivery.id,
        driverId:    delivery.driverId,
        driverName:  delivery.driverName,
        amount:      amountNum,
        paymentMode,
        paymentType: `${paymentType} Payment`,
        utrNumber:   utrNumber.trim(),
        paymentDate,
        recordedBy:  user?.name || "Super Admin",
      });
    }

    onClose();
  };

  const handleAddMore = () => {
    setAmount(String(summary.balanceDue));
    setDriverPaid(true);
    setAddingMore(true);
  };

  const handleCancelAddMore = () => {
    setAddingMore(false);
    setDriverPaid(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[720px] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] flex flex-col max-h-[calc(100vh-80px)] my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-semibold text-[#202124] leading-none">
              Update Status
            </h2>
            <span className="text-[11px] font-mono bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-full border border-[#E5E7EB] shrink-0">
              {delivery.id}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-gray-100 hover:text-[#202124] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Subtitle */}
          <p className="text-xs text-[#6B7280]">Update status and driver payment</p>

          {/* Summary strip */}
          <SummaryStrip
            delivery={delivery}
            summary={summary}
            paymentStatus={paymentStatus}
          />

          {/* ── SECTION 1: Delivery Status ─────────────────────────── */}
          <SectionCard number="1" title="Delivery Status">
            <div className="space-y-3">
              <StatusStepper
                selected={selectedStatus}
                onSelect={(s) => {
                  setSelectedStatus(s);
                  setErrors((prev) => ({ ...prev, status: undefined }));
                }}
              />
              {errors.status && (
                <p className="text-xs text-red-600">{errors.status}</p>
              )}
              {/* Remarks — single line, short */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] transition-all"
              />
            </div>
          </SectionCard>

          {/* ── SECTION 2: Driver Payment ──────────────────────────── */}
          {isSuperAdmin ? (
            <SectionCard number="2" title="Driver Payment">
              {/* Show existing payment summary + "add more" if balance > 0 */}
              {hasExistingPayments && !addingMore ? (
                <div className="space-y-3">
                  <PaymentReadOnly summary={summary} />
                  {summary.balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={handleAddMore}
                      className="text-xs text-[#E53935] font-semibold hover:underline"
                    >
                      + Record another payment
                    </button>
                  )}
                </div>
              ) : !hasDriver ? (
                /* No driver */
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Assign a driver first to record a driver payment.</span>
                </div>
              ) : (
                /* Full payment form */
                <div className="space-y-4">
                  {/* Yes / No segmented */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm font-medium text-[#202124]">Driver paid?</span>
                    <Segmented
                      options={["Yes", "No"]}
                      value={driverPaid ? "Yes" : "No"}
                      onChange={(v) => setDriverPaid(v === "Yes")}
                      colorMap={{ Yes: "bg-emerald-600 text-white", No: "bg-gray-200 text-[#374151]" }}
                    />
                    <span className="text-xs text-[#6B7280]">Paid by Aditya Vision to the driver</span>
                  </div>

                  {/* Collapsible payment fields */}
                  {driverPaid && (
                    <div className="space-y-4 animate-fade-in">
                      {/* Payment mode chips */}
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-2">Payment Mode</label>
                        <PaymentModeChips value={paymentMode} onChange={setPaymentMode} />
                      </div>

                      {/* Payment type segmented */}
                      <div>
                        <label className="block text-xs font-medium text-[#374151] mb-2">Payment Type</label>
                        <Segmented
                          options={PAYMENT_TYPES}
                          value={paymentType}
                          onChange={setPaymentType}
                          colorMap={{ Full: "bg-[#E53935] text-white", Partial: "bg-[#E53935] text-white", Advance: "bg-[#E53935] text-white" }}
                        />
                      </div>

                      {/* Amount + mode-specific fields in grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Amount */}
                        <div>
                          <label className="block text-xs font-medium text-[#374151] mb-1">Amount</label>
                          <div className="flex items-center h-11 border border-[#E5E7EB] rounded-[10px] overflow-hidden focus-within:ring-2 focus-within:ring-[#E53935]/30 focus-within:border-[#E53935] transition-all">
                            <span className="px-3 text-sm font-semibold text-[#6B7280] bg-[#F8F9FB] border-r border-[#E5E7EB] h-full flex items-center">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={amount}
                              onChange={(e) => {
                                setAmount(e.target.value);
                                setErrors((prev) => ({ ...prev, amount: undefined }));
                              }}
                              className="flex-1 h-full px-3 text-sm text-[#202124] bg-white focus:outline-none"
                            />
                          </div>
                          {errors.amount && (
                            <p className="text-xs text-red-600 mt-1">{errors.amount}</p>
                          )}
                          {amountNum > 0 && (
                            <p className="text-xs text-[#6B7280] mt-1">
                              Balance after this:{" "}
                              <span className={afterThis > 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                                {formatCurrency(afterThis)}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* UTR / Cheque No */}
                        {utrLabel && (
                          <div>
                            <label className="block text-xs font-medium text-[#374151] mb-1">
                              {utrLabel}
                            </label>
                            <input
                              type="text"
                              value={utrNumber}
                              onChange={(e) => {
                                setUtrNumber(e.target.value);
                                setErrors((prev) => ({ ...prev, utr: undefined }));
                              }}
                              placeholder={
                                paymentMode === "UPI" ? "e.g. 123456789012" :
                                paymentMode === "Bank Transfer" ? "e.g. HDFC0012345" :
                                "e.g. 004521"
                              }
                              className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] transition-all"
                            />
                            {errors.utr && (
                              <p className="text-xs text-red-600 mt-1">{errors.utr}</p>
                            )}
                          </div>
                        )}

                        {/* Payment Date */}
                        <div>
                          <label className="block text-xs font-medium text-[#374151] mb-1">Payment Date</label>
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] transition-all"
                          />
                        </div>
                      </div>

                      {addingMore && (
                        <button
                          type="button"
                          onClick={handleCancelAddMore}
                          className="text-xs text-[#6B7280] hover:text-[#E53935] transition-colors"
                        >
                          ✕ Cancel this payment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          ) : (
            /* Non-SA: read-only summary */
            hasExistingPayments && (
              <SectionCard number="2" title="Driver Payment">
                <PaymentReadOnly summary={summary} />
              </SectionCard>
            )
          )}
        </div>

        {/* ── STICKY FOOTER ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-6 py-3.5 bg-[#F8F9FB] border-t border-[#E5E7EB] shrink-0 rounded-b-2xl">
          {/* Live recording hint */}
          <span className="text-xs text-[#6B7280] italic truncate">
            {footerLive || "\u00A0"}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-gray-50 transition-colors focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaveDisabled}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all focus:outline-none ${
                isSaveDisabled
                  ? "bg-[#E53935]/40 text-white cursor-not-allowed"
                  : "bg-[#E53935] text-white hover:bg-[#C62828] shadow-sm"
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateStatusModal;
