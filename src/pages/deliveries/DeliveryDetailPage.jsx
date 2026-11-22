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
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { usePaymentStatus } from "../../hooks/usePaymentStatus";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { getDeliveryById } from "../../services/deliveryService";
import { recomputeDeliveryPaymentSummary } from "../../services/paymentService";

const DeliveryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { getPaymentStatus } = usePaymentStatus();

  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

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
          No delivery was found matching ID <span className="font-mono">{id}</span>.
        </p>
        <Link
          to="/deliveries"
          className="mt-4 inline-block px-4 py-2 bg-[#E53935] text-white text-sm font-semibold rounded-lg hover:bg-[#C62828]"
        >
          Back to Deliveries
        </Link>
      </div>
    );
  }

  const paymentStatus = delivery.paymentSummary?.status || getPaymentStatus(delivery);
  const totalCharges =
    delivery.totalCharges ||
    (Number(delivery.deliveryCharges) || 0) + (Number(delivery.additionalCharges) || 0);

  return (
    <FormPage
      title={`Delivery ${delivery.id}`}
      backTo="/deliveries"
      backLabel="Deliveries"
    >
      {/* Top Banner / Actions */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[#E53935]">
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
            Booked on {formatDate(delivery.deliveryDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={delivery.status} type="delivery" />
          <StatusBadge status={paymentStatus} type="payment" />

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

          {isSuperAdmin && (
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
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Details) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Route Card */}
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
              <div className="sm:col-span-2">
                <span className="text-[#6B7280] block">Delivery Address</span>
                <span className="font-medium text-[#202124] text-sm flex items-start gap-1.5 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#E53935] shrink-0 mt-0.5" />
                  {delivery.deliveryAddress}, {delivery.city} - {delivery.pinCode}
                </span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Pickup Location</span>
                  <span className="text-xs font-medium text-[#202124]">
                    {delivery.pickupAddress || "Aditya Vision Main Store"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#6B7280] block text-[11px]">Distance</span>
                  <span className="text-xs font-bold text-[#202124]">
                    {delivery.distanceKm} KM
                  </span>
                </div>
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
                  Category: {delivery.category} • Qty: {delivery.quantity || 1}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Product Value</span>
                <span className="font-semibold text-[#202124] text-sm">
                  {delivery.productAmount ? formatCurrency(delivery.productAmount) : "N/A"}
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
                <button
                  type="button"
                  onClick={() => navigate(`/deliveries/${delivery.id}/edit`)}
                  className="mt-2 text-xs font-bold text-[#E53935] hover:underline"
                >
                  Assign Driver Now
                </button>
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
                <span className="font-semibold text-[#202124]">{formatCurrency(totalCharges)}</span>
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
                  {formatCurrency(delivery.paymentSummary?.balance ?? totalCharges)}
                </span>
              </div>
              {delivery.paymentSummary?.lastPaymentMode && (
                <div className="text-[11px] text-[#6B7280] pt-1">
                  Last payment: {delivery.paymentSummary.lastPaymentMode}
                  {delivery.paymentSummary.lastReference ? ` (${delivery.paymentSummary.lastReference})` : ""}
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
                    <p className="font-bold text-[#202124]">{t.event || t.status}</p>
                    {t.note && <p className="text-[#6B7280] mt-0.5">{t.note}</p>}
                    <span className="text-[10px] text-[#9CA3AF] block mt-0.5">
                      {t.timestamp ? new Date(t.timestamp).toLocaleString("en-IN") : "Recorded"}
                      {t.byName && ` • by ${t.byName}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FormPage>
  );
};

export default DeliveryDetailPage;
