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

const PaymentRequestFormPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { addPaymentRequest } = usePayments();

  const [activeDrivers, setActiveDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    driverId: "",
    deliveryId: "",
    requestedAmount: "",
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
    { value: "", label: "— Select Active Driver —" },
    ...activeDrivers.map((d) => ({
      value: d.id,
      label: `${d.name} (${d.code || d.id})`,
    })),
  ];

  // Deliveries matching selected driver or all with assigned drivers
  const eligibleDeliveries = deliveries.filter(
    (d) => !form.driverId || d.driverId === form.driverId
  );

  const deliveryOptions = [
    { value: "", label: "— Select Assigned Delivery —" },
    ...eligibleDeliveries.map((d) => ({
      value: d.id,
      label: `${d.id} • ${d.customerName} • ${d.productName} (Charges: ₹${d.totalCharges || 0})`,
    })),
  ];

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-set driver if delivery selected
      if (field === "deliveryId" && value) {
        const found = deliveries.find((d) => d.id === value);
        if (found?.driverId) {
          next.driverId = found.driverId;
          // Pre-fill amount with balance if available
          if (!next.requestedAmount) {
            next.requestedAmount = String(found.paymentSummary?.balance ?? found.totalCharges ?? "");
          }
        }
      }
      return next;
    });
  };

  const validate = () => {
    const errs = {};
    if (!form.driverId) errs.driverId = "Driver selection is required.";
    if (!form.deliveryId) errs.deliveryId = "A delivery with an assigned driver is required.";
    const amt = Number(form.requestedAmount);
    if (!form.requestedAmount || isNaN(amt) || amt <= 0) {
      errs.requestedAmount = "Please enter a valid payout amount (> 0).";
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
      await addPaymentRequest({
        driverId: form.driverId,
        driverName: matchedDriver ? matchedDriver.name : "Driver",
        deliveryId: form.deliveryId,
        requestedAmount: Math.round(Number(form.requestedAmount)),
        notes: form.notes.trim(),
      });
      navigate("/payment-requests");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to submit payment request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading available drivers & orders...</p>
      </div>
    );
  }

  return (
    <FormPage
      title="Submit Driver Payment Request"
      backTo="/payment-requests"
      backLabel="Payment Requests"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection number="1" title="Driver & Associated Trip">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Assigned Customer Delivery"
              value={form.deliveryId}
              onChange={(e) => update("deliveryId", e.target.value)}
              options={deliveryOptions}
              error={errors.deliveryId}
              required
            />
            <Select
              label="Fleet Driver"
              value={form.driverId}
              onChange={(e) => update("driverId", e.target.value)}
              options={driverOptions}
              error={errors.driverId}
              required
            />
          </div>
        </FormSection>

        <FormSection number="2" title="Requisition Amount & Justification">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Requested Requisition Amount (₹)"
              type="number"
              value={form.requestedAmount}
              onChange={(e) => update("requestedAmount", e.target.value)}
              placeholder="e.g. 750"
              error={errors.requestedAmount}
              required
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Purpose / Trip Particulars / Notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. Outstation trip delivery charges + floor carry allowance..."
              rows={3}
            />
          </div>
        </FormSection>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => navigate("/payment-requests")}
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
            <span>Submit Requisition</span>
          </button>
        </div>
      </form>
    </FormPage>
  );
};

export default PaymentRequestFormPage;
