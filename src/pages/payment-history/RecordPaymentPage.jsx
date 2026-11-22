import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Textarea from "../../components/common/Textarea";
import { usePayments } from "../../hooks/usePayments";
import { useToast } from "../../hooks/useToast";
import { getActiveDrivers } from "../../services/driverService";
import { getDeliveriesPaged } from "../../services/deliveryService";
import { Loader2 } from "lucide-react";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];
const PAYMENT_TYPES = [
  { value: "Full", label: "Full Payment" },
  { value: "Partial", label: "Partial Payment" },
  { value: "Advance", label: "Advance Payment" },
];

const RecordPaymentPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { paymentRequests, addPayment } = usePayments();

  const [activeDrivers, setActiveDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    driverId: "",
    deliveryId: "",
    amount: "",
    paymentMode: "UPI",
    type: "Full",
    utrNumber: "",
    chequeNumber: "",
    receivedBy: "",
    paymentDate: new Date().toISOString().split("T")[0],
    relatedRequestId: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Promise.all([
      getActiveDrivers(),
      getDeliveriesPaged({ pageSize: 50 }),
    ])
      .then(([driversList, delsPaged]) => {
        setActiveDrivers(driversList);
        setDeliveries(delsPaged.deliveries);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const driverOptions = [
    { value: "", label: "— Select Fleet Driver —" },
    ...activeDrivers.map((d) => ({
      value: d.id,
      label: `${d.name} (${d.code || d.id})`,
    })),
  ];

  const eligibleDeliveries = deliveries.filter(
    (d) => !form.driverId || d.driverId === form.driverId
  );

  const deliveryOptions = [
    { value: "", label: "— Advance / Standalone Payout (No Delivery) —" },
    ...eligibleDeliveries.map((d) => ({
      value: d.id,
      label: `${d.id} • ${d.customerName} (Bal: ₹${d.paymentSummary?.balance ?? d.totalCharges ?? 0})`,
    })),
  ];

  const approvedRequests = [
    { value: "", label: "— Direct Disbursement (No Request) —" },
    ...(paymentRequests || [])
      .filter((r) => r.status === "Approved")
      .map((r) => ({
        value: r.id,
        label: `${r.id} • ${r.driverName} (₹${r.requestedAmount})`,
      })),
  ];

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "relatedRequestId" && value) {
        const req = paymentRequests.find((r) => r.id === value);
        if (req) {
          next.driverId = req.driverId;
          next.deliveryId = req.deliveryId || "";
          next.amount = String(req.requestedAmount || "");
        }
      }
      if (field === "deliveryId" && value) {
        const del = deliveries.find((d) => d.id === value);
        if (del?.driverId) {
          next.driverId = del.driverId;
          if (!next.amount) {
            next.amount = String(del.paymentSummary?.balance ?? del.totalCharges ?? "");
          }
        }
      }
      return next;
    });
  };

  const validate = () => {
    const errs = {};
    if (!form.driverId) errs.driverId = "Driver is required.";
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Enter a valid disbursement amount (> 0).";
    }

    if (form.paymentMode === "UPI" || form.paymentMode === "Bank Transfer") {
      if (!form.utrNumber.trim()) {
        errs.utrNumber = "UTR reference number is required.";
      }
    } else if (form.paymentMode === "Cheque") {
      if (!form.chequeNumber.trim()) {
        errs.chequeNumber = "Cheque number is required.";
      }
    } else if (form.paymentMode === "Cash") {
      if (!form.receivedBy.trim()) {
        errs.receivedBy = "Recipient name is required for cash payouts.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const matchedDriver = activeDrivers.find((d) => d.id === form.driverId);

    try {
      await addPayment({
        deliveryId: form.deliveryId || null,
        driverId: form.driverId,
        driverName: matchedDriver ? matchedDriver.name : "Driver",
        amount: Math.round(Number(form.amount)),
        type: form.type,
        paymentMode: form.paymentMode,
        utrNumber: form.utrNumber.trim() || null,
        chequeNumber: form.chequeNumber.trim() || null,
        receivedBy: form.receivedBy.trim() || null,
        notes: form.notes.trim(),
        paymentDate: form.paymentDate,
        relatedRequestId: form.relatedRequestId || null,
      });

      navigate("/payment-history");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading drivers and orders...</p>
      </div>
    );
  }

  return (
    <FormPage
      title="Record Driver Disbursement"
      backTo="/payment-history"
      backLabel="Payment History"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection number="1" title="Driver & Requisition Link">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Fleet Driver"
              value={form.driverId}
              onChange={(e) => update("driverId", e.target.value)}
              options={driverOptions}
              error={errors.driverId}
              required
            />
            <Select
              label="Associated Order (Optional)"
              value={form.deliveryId}
              onChange={(e) => update("deliveryId", e.target.value)}
              options={deliveryOptions}
            />
            <Select
              label="Approved Requisition (Optional)"
              value={form.relatedRequestId}
              onChange={(e) => update("relatedRequestId", e.target.value)}
              options={approvedRequests}
            />
          </div>
        </FormSection>

        <FormSection number="2" title="Payment Details & Verification">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Disbursed Amount (₹)"
              type="number"
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              placeholder="e.g. 850"
              error={errors.amount}
              required
            />
            <Select
              label="Payment Mode"
              value={form.paymentMode}
              onChange={(e) => update("paymentMode", e.target.value)}
              options={PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
            />
            <Select
              label="Payment Classification"
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              options={PAYMENT_TYPES}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Input
              label="Payment Settlement Date"
              type="date"
              value={form.paymentDate}
              onChange={(e) => update("paymentDate", e.target.value)}
              required
            />

            {(form.paymentMode === "UPI" || form.paymentMode === "Bank Transfer") && (
              <Input
                label="Bank / UPI UTR Transaction Reference"
                value={form.utrNumber}
                onChange={(e) => update("utrNumber", e.target.value)}
                placeholder="e.g. 431092817291"
                error={errors.utrNumber}
                required
              />
            )}

            {form.paymentMode === "Cheque" && (
              <Input
                label="Cheque Number"
                value={form.chequeNumber}
                onChange={(e) => update("chequeNumber", e.target.value)}
                placeholder="e.g. CHQ-901821"
                error={errors.chequeNumber}
                required
              />
            )}

            {form.paymentMode === "Cash" && (
              <Input
                label="Cash Handover Recipient Name"
                value={form.receivedBy}
                onChange={(e) => update("receivedBy", e.target.value)}
                placeholder="e.g. Driver in Person / Signed Voucher"
                error={errors.receivedBy}
                required
              />
            )}
          </div>

          <div className="mt-4">
            <Textarea
              label="Disbursement Voucher Remarks"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. Weekly trip settlement cleared via NEFT..."
              rows={2}
            />
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => navigate("/payment-history")}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#202124] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Commit Disbursement</span>
          </button>
        </div>
      </form>
    </FormPage>
  );
};

export default RecordPaymentPage;
