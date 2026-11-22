import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";
import { useToast } from "../../hooks/useToast";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

const PaymentDetailPage = () => {
  const { id } = useParams();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { voidPayment } = usePayments();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ref = doc(db, "paymentHistory", id);
    getDoc(ref)
      .then((snap) => {
        if (mounted) {
          if (snap.exists()) {
            setPayment({ id: snap.id, ...snap.data() });
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding this payment");
      return;
    }
    setVoiding(true);
    try {
      await voidPayment(id, voidReason);
      setPayment((prev) => ({
        ...prev,
        status: "Voided",
        voidReason: voidReason.trim(),
      }));
      setVoidDialogOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to void payment");
    } finally {
      setVoiding(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading payment voucher...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-[1100px] mx-auto text-center py-24">
        <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#202124] mb-2">Payment Not Found</h2>
        <p className="text-sm text-[#6B7280] mb-6">Payment {id} could not be found.</p>
        <Link
          to="/payment-history"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-sm font-semibold hover:bg-[#C62828]"
        >
          Back to Payment History
        </Link>
      </div>
    );
  }

  const fields = [
    ["Transaction ID", payment.id],
    ["Driver", payment.driverName],
    ["Associated Delivery", payment.deliveryId || "Advance / Direct Payout"],
    ["Payment Date", formatDate(payment.paymentDate)],
    ["Amount", formatCurrency(payment.amount)],
    ["Payment Mode", payment.paymentMode],
    ["Payment Type", payment.type || payment.paymentType],
    [
      "Reference (UTR / Chq / Recipient)",
      payment.utrNumber || payment.chequeNumber || payment.receivedBy || "—",
    ],
    ["Related Request", payment.relatedRequestId || "—"],
    ["Recorded By", payment.recordedByName || payment.recordedBy || "Staff"],
    ["Status", <StatusBadge key="st" status={payment.status} />],
    ...(payment.notes ? [["Notes", payment.notes]] : []),
    ...(payment.status === "Voided"
      ? [["Void Reason", payment.voidReason || "Voided by admin"]]
      : []),
  ];

  return (
    <FormPage
      title={`Payment: ${payment.id}`}
      backTo="/payment-history"
      backLabel="Payment History"
    >
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB] mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202124] mb-1">{payment.driverName}</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#16A34A]">
                  {formatCurrency(payment.amount)}
                </span>
                <StatusBadge status={payment.status} />
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                {payment.paymentMode} · {formatDate(payment.paymentDate)}
              </p>
            </div>
          </div>

          {isSuperAdmin && payment.status !== "Voided" && (
            <Button
              variant="danger"
              size="sm"
              icon={AlertTriangle}
              onClick={() => setVoidDialogOpen(true)}
            >
              Void Payment
            </Button>
          )}
        </div>

        {/* Detail fields */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[#6B7280] font-medium mb-0.5">{label}</dt>
              <dd className="text-sm font-semibold text-[#202124]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Void Modal */}
      {voidDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-[#202124]">
              Void Payment Voucher: {payment.id}
            </h3>
            <p className="text-xs text-[#6B7280]">
              Voiding reverses the payment amount in driver ledger calculations and delivery balance summaries. This action is irreversible.
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding (e.g. Disbursed via incorrect bank account, duplicate voucher)..."
              rows={3}
              className="w-full text-xs p-3 rounded-lg border border-[#E5E7EB] outline-none focus:border-[#E53935]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={voiding}
                onClick={() => setVoidDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={voiding}
                onClick={handleVoid}
              >
                Confirm Void
              </Button>
            </div>
          </div>
        </div>
      )}
    </FormPage>
  );
};

export default PaymentDetailPage;
