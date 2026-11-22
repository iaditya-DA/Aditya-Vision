import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FileCheck2, Check, X } from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Modal from "../../components/common/Modal";
import Textarea from "../../components/common/Textarea";
import { useAuth } from "../../hooks/useAuth";
import { usePayments } from "../../hooks/usePayments";
import { useToast } from "../../hooks/useToast";
import { formatCurrency, formatDate } from "../../utils/formatters";

const PaymentRequestDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { paymentRequests, approvePaymentRequest, rejectPaymentRequest } =
    usePayments();

  const request = paymentRequests?.find((r) => r.id === id);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  const handleApprove = () => {
    approvePaymentRequest(id);
    toast.success(`Payment request ${id} approved.`);
    setApproveOpen(false);
    navigate("/payment-requests");
  };

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) {
      setRejectError("Rejection reason is mandatory.");
      return;
    }
    rejectPaymentRequest(id, rejectReason.trim());
    toast.error(`Payment request ${id} rejected.`);
    setRejectOpen(false);
    navigate("/payment-requests");
  };

  if (!request) {
    return (
      <div className="max-w-[1100px] mx-auto text-center py-24">
        <FileCheck2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#202124] mb-2">Request Not Found</h2>
        <p className="text-sm text-[#6B7280] mb-6">Payment request {id} could not be found.</p>
        <Link
          to="/payment-requests"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] text-white text-sm font-semibold hover:bg-[#C62828]"
        >
          Back to Payment Requests
        </Link>
      </div>
    );
  }

  const fields = [
    ["Request ID", request.id],
    ["Driver Name", request.driverName],
    ["Delivery Reference", request.deliveryReference || "-"],
    ["Requested Amount", formatCurrency(request.requestedAmount)],
    ["Request Date", formatDate(request.requestDate)],
    ["Requested By", request.requestedBy],
    ["Status", <StatusBadge key="st" status={request.status} />],
    ...(request.approvedDate ? [["Approved Date", formatDate(request.approvedDate)]] : []),
    ...(request.rejectionReason ? [["Rejection Reason", request.rejectionReason]] : []),
    ...(request.notes ? [["Notes", request.notes]] : []),
  ];

  return (
    <>
      <FormPage
        title={`Request: ${request.id}`}
        backTo="/payment-requests"
        backLabel="Payment Requests"
        actions={
          isSuperAdmin && request.status === "Pending" ? (
            <>
              <Button
                variant="primary"
                icon={Check}
                onClick={() => setApproveOpen(true)}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                icon={X}
                onClick={() => {
                  setRejectReason("");
                  setRejectError("");
                  setRejectOpen(true);
                }}
              >
                Reject
              </Button>
            </>
          ) : null
        }
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6">
          <div className="flex items-start gap-4 pb-5 border-b border-[#E5E7EB] mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#FFF1F0] text-[#E53935] flex items-center justify-center shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-[#202124]">{request.driverName}</h2>
                <StatusBadge status={request.status} />
              </div>
              <span className="text-2xl font-bold text-[#E53935]">
                {formatCurrency(request.requestedAmount)}
              </span>
              <p className="text-xs text-[#6B7280] mt-1">
                Submitted on {formatDate(request.requestDate)} by {request.requestedBy}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-[#6B7280] font-medium mb-0.5">{label}</dt>
                <dd className="text-sm font-semibold text-[#202124]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </FormPage>

      <ConfirmDialog
        isOpen={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        type="info"
        title="Authorize Payment Request"
        message={`Approve requisition ${request.id} for ${formatCurrency(request.requestedAmount)} for driver ${request.driverName}?\n\nNote: Approving authorizes the requisition. Record the actual disbursement in Payment History.`}
        confirmText="Authorize Request"
      />

      {rejectOpen && (
        <Modal
          isOpen={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title={`Reject Requisition – ${request.id}`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectSubmit}>
                Confirm Rejection
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#6B7280]">
              State the reason for declining this payment requisition. The requester will be notified.
            </p>
            <Textarea
              label="Rejection Reason (Mandatory)"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (e.target.value.trim()) setRejectError("");
              }}
              placeholder="e.g. Rate higher than agreed slab..."
              error={rejectError}
              rows={3}
              required
            />
          </div>
        </Modal>
      )}
    </>
  );
};

export default PaymentRequestDetailPage;
