import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Banknote,
  Smartphone,
  Building2,
  FileText,
  MoreHorizontal,
  Info,
} from "lucide-react";
import StatusBadge from "../../components/common/StatusBadge";
import { formatCurrency } from "../../utils/formatters";
import { validatePaymentFields } from "../../utils/paymentValidation";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";
import { useToast } from "../../hooks/useToast";
import { getDeliveryById, updateDeliveryStatusWithTx } from "../../services/deliveryService";

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPPER_STATUSES = ["Created", "Assigned", "Picked Up", "In Transit", "Delivered"];
const ALT_STATUSES = ["Failed", "Cancelled"];

const PAYMENT_MODES = [
  { value: "Cash",          label: "Cash",   Icon: Banknote       },
  { value: "UPI",           label: "UPI",    Icon: Smartphone     },
  { value: "Bank Transfer", label: "Bank",   Icon: Building2      },
  { value: "Cheque",        label: "Cheque", Icon: FileText       },
  { value: "Other",         label: "Other",  Icon: MoreHorizontal },
];

const PAYMENT_TYPES = ["Full", "Partial", "Advance"];

// ─── Small hoisted UI helpers ─────────────────────────────────────────────────

function SummaryStrip({ delivery, summary, paymentStatus }) {
  const bal = summary.balanceDue;
  return (
    <div className="rounded-xl bg-[#FFF1F0] border border-[#FECDD3] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-[#202124] text-sm truncate">{delivery.customerName}</p>
        <p className="text-xs text-[#6B7280] truncate mt-0.5">{delivery.productName}</p>
        {delivery.driverName && delivery.driverName !== "Unassigned" && (
          <p className="text-xs text-[#6B7280] mt-0.5">
            Driver: <span className="font-medium text-[#202124]">{delivery.driverName}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 shrink-0">
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
        <div className="flex gap-1.5 flex-wrap">
          <StatusBadge status={delivery.status} size="sm" />
          <StatusBadge status={paymentStatus} size="sm" />
        </div>
      </div>
    </div>
  );
}

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

function StatusStepper({ selected, onSelect }) {
  const selIdx = STEPPER_STATUSES.indexOf(selected);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STEPPER_STATUSES.map((s, i) => {
          const isCurrent = s === selected;
          const isDone = selIdx > i;
          return (
            <button key={s} type="button" onClick={() => onSelect(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
                ${isCurrent ? "bg-[#E53935] text-white border-[#E53935] shadow-sm"
                  : isDone ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#E53935] hover:text-[#E53935]"}`}
            >
              {isCurrent && <Check className="w-3 h-3" />}
              {isDone && !isCurrent && <Check className="w-3 h-3 text-emerald-500" />}
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
      <div className="flex gap-2">
        {ALT_STATUSES.map((s) => {
          const isCurrent = s === selected;
          return (
            <button key={s} type="button" onClick={() => onSelect(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
                ${isCurrent ? "bg-red-50 text-red-700 border-red-400"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-red-400 hover:text-red-600"}`}
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

function PaymentModeChips({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAYMENT_MODES.map(({ value: v, label, Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none
            ${v === value ? "bg-[#FFF1F0] text-[#E53935] border-[#E53935]"
              : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#E53935] hover:text-[#E53935]"}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function Segmented({ options, value, onChange, colorMap = {} }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E5E7EB] overflow-hidden">
      {options.map((opt) => {
        const sel = opt === value;
        const color = colorMap[opt] || "bg-[#E53935] text-white";
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`px-4 py-1.5 text-xs font-semibold transition-all focus:outline-none border-r border-[#E5E7EB] last:border-r-0
              ${sel ? color : "bg-white text-[#6B7280] hover:text-[#202124]"}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function PaymentReadOnly({ summary }) {
  if (!summary.lastPayment) return (
    <p className="text-xs text-[#6B7280] italic">No driver payments recorded.</p>
  );
  const p = summary.lastPayment;
  return (
    <div className="rounded-xl bg-[#F8F9FB] border border-[#E5E7EB] p-4 text-xs space-y-2">
      <p className="font-semibold text-[#202124] text-[11px] uppercase tracking-wide">Last Driver Payment</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div><p className="text-[#6B7280]">Mode</p><p className="font-medium text-[#202124]">{p.paymentMode}</p></div>
        {p.utrNumber && p.utrNumber !== "-" && (
          <div><p className="text-[#6B7280]">UTR / Ref</p><p className="font-mono text-[#202124]">{p.utrNumber}</p></div>
        )}
        <div><p className="text-[#6B7280]">Amount</p><p className="font-bold text-[#202124]">{formatCurrency(p.amount)}</p></div>
        <div><p className="text-[#6B7280]">Date</p><p className="text-[#202124]">{p.paymentDate}</p></div>
        {p.receivedBy && <div><p className="text-[#6B7280]">Received By</p><p className="text-[#202124]">{p.receivedBy}</p></div>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const UpdateStatusPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isSuperAdmin, user } = useAuth();
  const { getDeliveryPaymentSummary, getPaymentStatus } = usePayments();

  const [delivery, setDelivery] = useState(null);

  // Status state
  const [selectedStatus, setSelectedStatus] = useState(() => delivery?.status || "");
  const [note, setNote] = useState("");

  // Payment state
  const [driverPaid, setDriverPaid] = useState(false);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [paymentType, setPaymentType] = useState("Full");
  const [amount, setAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addingMore, setAddingMore] = useState(false);
  const [errors, setErrors] = useState({});

  // Refs for scroll-to-first-error
  const amountRef = useRef(null);
  const utrRef = useRef(null);
  const chequeRef = useRef(null);
  const bankRef = useRef(null);
  const receivedByRef = useRef(null);
  const referenceRef = useRef(null);

  // Reload if delivery changes
  useEffect(() => {
    let mounted = true;
    getDeliveryById(id).then((d) => {
      if (mounted && d) {
        setDelivery(d);
        setSelectedStatus(d.status || "");
        const total = (Number(d.deliveryCharges) || 0) + (Number(d.additionalCharges) || 0);
        setAmount(String(d.paymentSummary?.balance ?? total));
      }
    }).catch(console.error);
    return () => { mounted = false; };
  }, [id]);

  if (!delivery) {
    return (
      <div className="max-w-[900px] mx-auto text-center py-24">
        <p className="text-[#6B7280]">Delivery {id} not found.</p>
        <Link to="/deliveries" className="mt-4 inline-block text-sm text-[#E53935] font-semibold hover:underline">
          ← Back to Deliveries
        </Link>
      </div>
    );
  }

  const summary = getDeliveryPaymentSummary(delivery);
  const paymentStatus = getPaymentStatus(delivery);
  const hasDriver = delivery.driverId && delivery.driverId !== "" && delivery.driverId !== "Unassigned";
  const hasExistingPayments = summary.payments.length > 0;
  const amountNum = Number(amount) || 0;
  const afterThis = Math.max(0, summary.balanceDue - amountNum);
  const footerLive = isSuperAdmin && driverPaid && hasDriver && amountNum > 0
    ? `Recording ${formatCurrency(amountNum)} via ${paymentMode}`
    : null;

  const handleAddMore = () => {
    setAmount(String(summary.balanceDue));
    setDriverPaid(true);
    setAddingMore(true);
  };

  const scrollToFirstError = (errs) => {
    const refMap = {
      amount: amountRef,
      utrNumber: utrRef,
      chequeNumber: chequeRef,
      bankName: bankRef,
      receivedBy: receivedByRef,
      reference: referenceRef,
    };
    for (const key of Object.keys(errs)) {
      const ref = refMap[key];
      if (ref && ref.current) {
        ref.current.focus();
        ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  };

  const handleSave = async () => {
    const errs = {};
    if (!selectedStatus) errs.status = "Select a status";

    if (isSuperAdmin && driverPaid && hasDriver) {
      const payErrs = validatePaymentFields({
        paymentMode,
        amount,
        paymentType: `${paymentType} Payment`,
        balanceDue: summary.balanceDue,
        utrNumber,
        chequeNumber,
        bankName,
        receivedBy,
        reference,
      });
      Object.assign(errs, payErrs);
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      scrollToFirstError(errs);
      return;
    }

    try {
      let paymentPayload = null;
      if (isSuperAdmin && driverPaid && hasDriver && amountNum > 0) {
        paymentPayload = {
          amount: amountNum,
          paymentMode,
          paymentDate,
          utrNumber: utrNumber.trim() || null,
          chequeNumber: chequeNumber.trim() || null,
          bankName: bankName.trim() || null,
          receivedBy: receivedBy.trim() || null,
          notes: note.trim() || "",
        };
      }

      await updateDeliveryStatusWithTx({
        deliveryId: delivery.id,
        newStatus: selectedStatus,
        note: note.trim(),
        paymentData: paymentPayload,
        user,
      });

      toast.success(`Delivery ${delivery.id} status updated to ${selectedStatus}.`);
      navigate(-1);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update status. Check connection.");
    }
  };

  const handleCancel = () => navigate(-1);

  // UTR label per mode
  const utrLabel =
    paymentMode === "UPI" ? "UTR / UPI Transaction ID" :
    paymentMode === "Bank Transfer" ? "UTR / Reference No." : null;

  return (
    <div className="max-w-[900px] mx-auto pb-28 space-y-5">
      {/* ── Back + Title ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleCancel}
          className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#E53935] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-[#D1D5DB]">/</span>
        <h1 className="text-xl font-extrabold text-[#202124] font-heading">Update Status</h1>
        <span className="text-[11px] font-mono bg-gray-100 text-[#6B7280] px-2 py-0.5 rounded-full border border-[#E5E7EB]">
          {delivery.id}
        </span>
      </div>

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <SummaryStrip delivery={delivery} summary={summary} paymentStatus={paymentStatus} />

      {/* ── SECTION 1: Delivery Status ────────────────────────────────── */}
      <SectionCard number="1" title="Delivery Status">
        <div className="space-y-3">
          <StatusStepper selected={selectedStatus} onSelect={(s) => {
            setSelectedStatus(s);
            setErrors((prev) => ({ ...prev, status: undefined }));
          }} />
          <FieldError msg={errors.status} />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] transition-all"
          />
        </div>
      </SectionCard>

      {/* ── SECTION 2: Driver Payment ─────────────────────────────────── */}
      {isSuperAdmin ? (
        <SectionCard number="2" title="Driver Payment">
          {hasExistingPayments && !addingMore ? (
            <div className="space-y-3">
              <PaymentReadOnly summary={summary} />
              {summary.balanceDue > 0 && (
                <button type="button" onClick={handleAddMore}
                  className="text-xs text-[#E53935] font-semibold hover:underline"
                >
                  + Record another payment
                </button>
              )}
            </div>
          ) : !hasDriver ? (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Assign a driver first to record a driver payment.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Yes / No */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#202124]">Driver paid?</span>
                <Segmented
                  options={["Yes", "No"]}
                  value={driverPaid ? "Yes" : "No"}
                  onChange={(v) => setDriverPaid(v === "Yes")}
                  colorMap={{ Yes: "bg-emerald-600 text-white", No: "bg-gray-200 text-[#374151]" }}
                />
                <span className="text-xs text-[#6B7280]">Paid by Aditya Vision to the driver</span>
              </div>

              {driverPaid && (
                <div className="space-y-4">
                  {/* Payment mode */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-2">Payment Mode</label>
                    <PaymentModeChips value={paymentMode} onChange={(m) => {
                      setPaymentMode(m);
                      setErrors((p) => ({ ...p, utrNumber: undefined, chequeNumber: undefined, bankName: undefined, receivedBy: undefined, reference: undefined }));
                    }} />
                  </div>

                  {/* Payment type */}
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-2">Payment Type</label>
                    <Segmented
                      options={PAYMENT_TYPES}
                      value={paymentType}
                      onChange={setPaymentType}
                      colorMap={{ Full: "bg-[#E53935] text-white", Partial: "bg-[#E53935] text-white", Advance: "bg-[#E53935] text-white" }}
                    />
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1">Amount</label>
                      <div className="flex items-center h-11 border border-[#E5E7EB] rounded-[10px] overflow-hidden focus-within:ring-2 focus-within:ring-[#E53935]/30 focus-within:border-[#E53935]">
                        <span className="px-3 text-sm font-semibold text-[#6B7280] bg-[#F8F9FB] border-r border-[#E5E7EB] h-full flex items-center">₹</span>
                        <input
                          ref={amountRef}
                          type="number" min="0" value={amount}
                          onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: undefined })); }}
                          className="flex-1 h-full px-3 text-sm text-[#202124] bg-white focus:outline-none"
                        />
                      </div>
                      <FieldError msg={errors.amount} />
                      {amountNum > 0 && (
                        <p className="text-xs text-[#6B7280] mt-1">
                          Balance after this:{" "}
                          <span className={afterThis > 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                            {formatCurrency(afterThis)}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Payment date */}
                    <div>
                      <label className="block text-xs font-medium text-[#374151] mb-1">Payment Date</label>
                      <input
                        type="date" value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                      />
                    </div>

                    {/* UPI / Bank Transfer → UTR */}
                    {(paymentMode === "UPI" || paymentMode === "Bank Transfer") && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#374151] mb-1">
                          {utrLabel} <span className="text-red-500">*</span>
                        </label>
                        <input
                          ref={utrRef}
                          type="text" value={utrNumber}
                          onChange={(e) => { setUtrNumber(e.target.value); setErrors((p) => ({ ...p, utrNumber: undefined })); }}
                          placeholder={paymentMode === "UPI" ? "e.g. 123456789012" : "e.g. HDFC0012345678"}
                          className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                        />
                        <FieldError msg={errors.utrNumber} />
                      </div>
                    )}

                    {/* Cheque → cheque no + bank name */}
                    {paymentMode === "Cheque" && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-[#374151] mb-1">Cheque Number <span className="text-red-500">*</span></label>
                          <input
                            ref={chequeRef}
                            type="text" value={chequeNumber}
                            onChange={(e) => { setChequeNumber(e.target.value); setErrors((p) => ({ ...p, chequeNumber: undefined })); }}
                            placeholder="e.g. 004521"
                            className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                          />
                          <FieldError msg={errors.chequeNumber} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#374151] mb-1">Bank Name <span className="text-red-500">*</span></label>
                          <input
                            ref={bankRef}
                            type="text" value={bankName}
                            onChange={(e) => { setBankName(e.target.value); setErrors((p) => ({ ...p, bankName: undefined })); }}
                            placeholder="e.g. SBI, HDFC"
                            className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                          />
                          <FieldError msg={errors.bankName} />
                        </div>
                      </>
                    )}

                    {/* Cash → Received by */}
                    {paymentMode === "Cash" && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#374151] mb-1">Received By <span className="text-red-500">*</span></label>
                        <input
                          ref={receivedByRef}
                          type="text" value={receivedBy}
                          onChange={(e) => { setReceivedBy(e.target.value); setErrors((p) => ({ ...p, receivedBy: undefined })); }}
                          placeholder="Name of driver / person who received cash"
                          className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                        />
                        <FieldError msg={errors.receivedBy} />
                      </div>
                    )}

                    {/* Other → Reference */}
                    {paymentMode === "Other" && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#374151] mb-1">Reference <span className="text-red-500">*</span></label>
                        <input
                          ref={referenceRef}
                          type="text" value={reference}
                          onChange={(e) => { setReference(e.target.value); setErrors((p) => ({ ...p, reference: undefined })); }}
                          placeholder="Voucher number, transaction ref, etc."
                          className="w-full h-11 border border-[#E5E7EB] rounded-[10px] px-3 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935]"
                        />
                        <FieldError msg={errors.reference} />
                      </div>
                    )}
                  </div>

                  {addingMore && (
                    <button type="button"
                      onClick={() => { setAddingMore(false); setDriverPaid(false); }}
                      className="text-xs text-[#6B7280] hover:text-[#E53935]"
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
        <SectionCard number="2" title="Driver Payment">
          <PaymentReadOnly summary={summary} />
        </SectionCard>
      )}

      {/* ── Sticky bottom bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB] shadow-lg px-6 py-3 flex items-center justify-between gap-3">
        <span className="text-xs text-[#6B7280] italic truncate">{footerLive || "\u00A0"}</span>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#202124] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold shadow-xs transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateStatusPage;
