import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Package,
  User,
  Phone,
  MapPin,
  Truck,
  Edit,
  RefreshCw,
  Clock,
  Loader2,
  Calculator,
  Trash2,
  Camera,
  ExternalLink,
  X,
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDeliveryById } from "../../services/deliveryService";
import { recomputeDeliveryPaymentSummary } from "../../services/paymentService";
import { deleteDelivery } from "../../services/deleteService";
import { thumbUrl } from "../../services/cloudinaryService";

const DeliveryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser, isSuperAdmin, hasPermission } = useAuth();
  const canDelete = isSuperAdmin || hasPermission("deliveries.delete");
  const { getPaymentStatus } = usePaymentStatus();

  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const loadDelivery = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeliveryById(id);
      setDelivery(data);
    } catch (err) {
      console.error(err);
      toast.error("Could not load delivery details");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDelivery();
    });
  }, [loadDelivery]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeDeliveryPaymentSummary(id);
      toast.success("Payment summary recomputed from transaction records");
      await loadDelivery();
    } catch (err) {
      toast.error(err.message || "Failed to recompute payment summary");
    } finally {
      setRecomputing(false);
    }
  };

  const handleDelete = async ({ reason } = {}) => {
    setIsDeleting(true);
    try {
      await deleteDelivery(delivery.id, currentUser, reason);
      toast.success(`Delivery #${delivery.id} deleted successfully`);
      navigate("/deliveries");
    } catch (err) {
      toast.error(err.message || "Failed to delete delivery");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading delivery order...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="max-w-[800px] mx-auto text-center py-24 bg-white rounded-2xl border border-[#E5E7EB] p-8">
        <Package className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#202124]">Delivery Not Found</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          The delivery order #{id} does not exist or was removed.
        </p>
        <Link
          to="/deliveries"
          className="mt-4 inline-block px-4 py-2 bg-[#E53935] text-white text-xs font-semibold rounded-xl"
        >
          Back to Deliveries
        </Link>
      </div>
    );
  }

  const paymentStatus = getPaymentStatus(delivery);
  const totalCharges =
    (Number(delivery.deliveryCharges) || 0) +
    (Number(delivery.additionalCharges) || 0);

  return (
    <FormPage
      title={`Delivery Order #${delivery.id}`}
      backTo="/deliveries"
      backLabel="Deliveries"
    >
      {/* Top Overview Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[#E53935] bg-[#FFF1F0] px-2 py-0.5 rounded">
              {delivery.id}
            </span>
            <span className="text-xs text-[#9CA3AF]">•</span>
            <span className="text-xs font-mono text-[#6B7280]">
              Invoice: {delivery.invoiceNumber}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#202124]">
            {delivery.customerName}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Scheduled for {formatDate(delivery.deliveryDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={delivery.status} type="delivery" />
          <StatusBadge status={paymentStatus} type="payment" />

          {/* Edit & Update Status strictly restricted to Super Admin */}
          {isSuperAdmin && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={Edit}
                onClick={() => navigate(`/deliveries/${delivery.id}/edit`)}
              >
                Edit
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={() => navigate(`/deliveries/${delivery.id}/status`)}
              >
                Update Status
              </Button>

              <Button
                variant="outline"
                size="sm"
                icon={Calculator}
                loading={recomputing}
                onClick={handleRecompute}
                title="Recalculate payment totals from live payments"
              >
                Recompute Summary
              </Button>

              {canDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDeleteDialogOpen(true);
                  }}
                  title="Delete delivery permanently"
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Details) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Destination Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#E53935]" />
              <span>Customer & Destination</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B7280] block">Customer Name</span>
                <span className="font-semibold text-[#202124] text-sm">
                  {delivery.customerName}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Contact Mobile</span>
                <span className="font-semibold text-[#202124] text-sm flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#16A34A]" />
                  {delivery.customerMobile}
                  {delivery.alternateMobile && ` / ${delivery.alternateMobile}`}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Destination City & PIN</span>
                <span className="font-medium text-[#202124] text-sm flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#E53935] shrink-0" />
                  {delivery.city} - {delivery.pinCode}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Transit Distance</span>
                <span className="font-semibold text-[#202124] text-sm mt-0.5 block">
                  {delivery.distanceKm} KM
                </span>
              </div>
            </div>
          </div>

          {/* Product & Charges Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-[#E53935]" />
              <span>Appliance Product & Charges</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B7280] block">Product</span>
                <span className="font-semibold text-[#202124] text-sm">
                  {delivery.productName}
                </span>
                <span className="text-[#6B7280] block text-[11px] mt-0.5">
                  Category: {delivery.category} • Quantity: {delivery.quantity || 1}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Invoice Reference</span>
                <span className="font-semibold font-mono text-[#202124] text-sm">
                  {delivery.invoiceNumber}
                </span>
                <span className="text-[#6B7280] block text-[11px] mt-0.5">
                  Scheduled: {formatDate(delivery.deliveryDate)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] grid grid-cols-3 gap-2 bg-[#FAFBFD] p-3 rounded-xl text-xs">
              <div>
                <span className="text-[#6B7280] block text-[11px]">Delivery Fee</span>
                <span className="font-bold text-[#202124]">
                  {formatCurrency(delivery.deliveryCharges || 0)}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[11px]">Addl. Toll/Carry</span>
                <span className="font-bold text-[#202124]">
                  {formatCurrency(delivery.additionalCharges || 0)}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[11px]">Total Trip Fee</span>
                <span className="font-extrabold text-[#E53935]">
                  {formatCurrency(totalCharges)}
                </span>
              </div>
            </div>

            {delivery.notes && (
              <div className="text-xs bg-[#FFF8F7] p-3 rounded-xl border border-[#FEE2E2]">
                <span className="font-bold text-[#991B1B] block mb-0.5">Special Handling Notes:</span>
                <p className="text-[#7F1D1D]">{delivery.notes}</p>
              </div>
            )}
          </div>

          {/* Product Photo Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#E53935]" />
              <span>Product Photo</span>
            </h3>

            {delivery.image?.url ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-[#E5E7EB]">
                <div
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setLightboxOpen(true)}
                  title="Click to view full photo"
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D1D5DB] bg-white shrink-0 shadow-2xs group-hover:border-[#E53935] transition-colors">
                    <img
                      src={thumbUrl(delivery.image.url, 200)}
                      alt={delivery.productName || "Product"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#202124] block group-hover:text-[#E53935] transition-colors">
                      {delivery.productName}
                    </span>
                    <span className="text-[11px] text-[#6B7280] block mt-0.5">
                      Cloudinary Verified Image
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E53935] mt-1">
                      <ExternalLink className="w-3 h-3" /> Click to enlarge
                    </span>
                  </div>
                </div>

                <a
                  href={delivery.image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end sm:self-center px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-xs font-semibold text-[#202124] hover:bg-gray-100 shadow-2xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Open in Tab</span>
                </a>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[#D1D5DB] bg-gray-50/50 text-center text-xs text-[#6B7280]">
                No product photo attached to this delivery order.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Driver, Payment & Timeline) */}
        <div className="space-y-6">
          {/* Driver Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#E53935]" />
              <span>Assigned Driver</span>
            </h3>

            {delivery.driverId ? (
              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#202124] text-sm">
                    {delivery.driverName}
                  </span>
                  <span className="font-mono text-[11px] text-[#6B7280]">
                    {delivery.driverId}
                  </span>
                </div>
                <Link
                  to={`/drivers/${delivery.driverId}`}
                  className="inline-block text-xs font-semibold text-[#E53935] hover:underline"
                >
                  View Driver Profile & Ledger →
                </Link>
              </div>
            ) : (
              <div className="text-xs text-[#6B7280]">
                <p>No driver assigned to this order yet.</p>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate(`/deliveries/${delivery.id}/edit`)}
                    className="mt-2 text-xs font-bold text-[#E53935] hover:underline cursor-pointer"
                  >
                    Assign Driver Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Payment Summary Snapshot Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider">
                Driver Payment Summary
              </h3>
              <StatusBadge status={paymentStatus} type="payment" />
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Total Charges</span>
                <span className="font-semibold text-[#202124]">
                  {formatCurrency(totalCharges)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Amount Paid to Driver</span>
                <span className="font-semibold text-[#16A34A]">
                  {formatCurrency(delivery.paymentSummary?.totalPaid || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#E5E7EB] pt-1.5">
                <span className="text-[#6B7280] font-bold">Balance Due</span>
                <span
                  className={`font-bold ${
                    (delivery.paymentSummary?.balance ?? totalCharges) > 0
                      ? "text-[#DC2626]"
                      : "text-[#16A34A]"
                  }`}
                >
                  {formatCurrency(
                    delivery.paymentSummary?.balance ?? totalCharges
                  )}
                </span>
              </div>
              {delivery.paymentSummary?.lastPaymentMode && (
                <div className="text-[11px] text-[#6B7280] pt-1">
                  Last payment: {delivery.paymentSummary.lastPaymentMode}
                  {delivery.paymentSummary.lastReference
                    ? ` (${delivery.paymentSummary.lastReference})`
                    : ""}
                </div>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#202124] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E53935]" />
              <span>Milestone Audit Timeline</span>
            </h3>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {(delivery.timeline || []).map((t, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full bg-[#E53935] ring-4 ring-white" />
                  <div className="text-xs">
                    <p className="font-bold text-[#202124]">
                      {t.event || t.status}
                    </p>
                    {t.note && (
                      <p className="text-[#6B7280] mt-0.5">{t.note}</p>
                    )}
                    <span className="text-[10px] text-[#9CA3AF] block mt-0.5">
                      {t.timestamp
                        ? new Date(t.timestamp).toLocaleString("en-IN")
                        : "Recorded"}
                      {t.byName && ` • by ${t.byName}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Photo */}
      {lightboxOpen && delivery.image?.url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-bold text-[#202124]">
                {delivery.productName} — Photo Preview
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={delivery.image.url}
                alt={delivery.productName}
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Delivery Order"
        message="Are you sure you want to permanently delete this delivery order? This action removes the order from Firestore."
        recordType="Delivery Order"
        recordTitle={`#${delivery.id} — ${delivery.customerName}`}
        confirmText="Delete Order"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </FormPage>
  );
};

export default DeliveryDetailPage;
