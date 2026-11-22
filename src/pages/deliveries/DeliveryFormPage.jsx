import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { UserPlus, Loader2 } from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Textarea from "../../components/common/Textarea";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { deliveryCategories } from "../../constants/appConstants";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { getActiveDrivers } from "../../services/driverService";
import { getDeliveryById, createDeliveryWithTx } from "../../services/deliveryService";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

const getInitialForm = (delivery) => ({
  customerName: delivery?.customerName || "",
  customerMobile: delivery?.customerMobile || "",
  alternateMobile: delivery?.alternateMobile || "",
  productName: delivery?.productName || "",
  category: delivery?.category || "Television",
  quantity: delivery?.quantity || 1,
  invoiceNumber: delivery?.invoiceNumber || "",
  productAmount: delivery?.productAmount ? String(delivery.productAmount) : "",
  pickupAddress:
    delivery?.pickupAddress || "Aditya Vision Mega Store, Boring Road Crossing",
  deliveryAddress: delivery?.deliveryAddress || "",
  city: delivery?.city || "Patna",
  pinCode: delivery?.pinCode || "",
  distanceKm: delivery?.distanceKm ? String(delivery.distanceKm) : "",
  deliveryDate:
    delivery?.deliveryDate || new Date().toISOString().split("T")[0],
  driverId: delivery?.driverId || "",
  deliveryCharges: delivery?.deliveryCharges
    ? String(delivery.deliveryCharges)
    : "",
  additionalCharges: delivery?.additionalCharges
    ? String(delivery.additionalCharges)
    : "0",
  notes: delivery?.notes || "",
  status: delivery?.status || "Created",
});

const DeliveryFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const isEditing = Boolean(id);
  const [formData, setFormData] = useState(() => getInitialForm(null));
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    getActiveDrivers().then((list) => {
      if (mounted) setActiveDrivers(list);
    }).catch(console.error);

    if (isEditing) {
      getDeliveryById(id).then((del) => {
        if (mounted && del) {
          setFormData(getInitialForm(del));
          setLoadingInitial(false);
        }
      }).catch((err) => {
        if (mounted) {
          toast.error("Could not load delivery order");
          setLoadingInitial(false);
        }
        console.error(err);
      });
    }

    return () => {
      mounted = false;
    };
  }, [id, isEditing, toast]);

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.customerName.trim())
      errs.customerName = "Customer name is required";
    if (!formData.customerMobile.trim()) {
      errs.customerMobile = "Customer mobile is required";
    } else if (!/^\d{10}$/.test(formData.customerMobile.trim())) {
      errs.customerMobile = "Must be a 10-digit mobile number";
    }
    if (
      formData.alternateMobile.trim() &&
      !/^\d{10}$/.test(formData.alternateMobile.trim())
    ) {
      errs.alternateMobile = "Must be a 10-digit mobile number";
    }
    if (!formData.productName.trim())
      errs.productName = "Product name is required";
    if (!formData.invoiceNumber.trim())
      errs.invoiceNumber = "Invoice number is required";
    if (!formData.quantity || Number(formData.quantity) < 1)
      errs.quantity = "Min quantity is 1";
    if (!formData.pickupAddress.trim())
      errs.pickupAddress = "Pickup address is required";
    if (!formData.deliveryAddress.trim())
      errs.deliveryAddress = "Delivery address is required";
    if (!formData.city.trim()) errs.city = "City is required";
    if (!formData.pinCode.trim()) {
      errs.pinCode = "PIN code is required";
    } else if (!/^\d{6}$/.test(formData.pinCode.trim())) {
      errs.pinCode = "Must be a 6-digit PIN code";
    }
    if (
      !formData.distanceKm ||
      isNaN(formData.distanceKm) ||
      Number(formData.distanceKm) <= 0
    ) {
      errs.distanceKm = "Please enter distance in KM (e.g. 5.5)";
    }
    if (!formData.deliveryDate) errs.deliveryDate = "Delivery date is required";
    if (
      !formData.deliveryCharges ||
      isNaN(formData.deliveryCharges) ||
      Number(formData.deliveryCharges) < 0
    ) {
      errs.deliveryCharges = "Valid delivery charges required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    const matchedDriver = activeDrivers.find(
      (d) => d.id === formData.driverId
    );

    let derivedStatus = formData.status;
    if (formData.driverId && derivedStatus === "Created") {
      derivedStatus = "Assigned";
    }

    const payload = {
      ...formData,
      quantity: Number(formData.quantity),
      productAmount: formData.productAmount ? Number(formData.productAmount) : 0,
      distanceKm: Number(formData.distanceKm),
      deliveryCharges: Number(formData.deliveryCharges),
      additionalCharges: Number(formData.additionalCharges) || 0,
      driverName: matchedDriver ? matchedDriver.name : "Unassigned",
      status: derivedStatus,
    };

    try {
      if (isEditing) {
        const delRef = doc(db, "deliveries", id);
        await updateDoc(delRef, {
          ...payload,
          totalCharges: (payload.deliveryCharges || 0) + (payload.additionalCharges || 0),
          updatedAt: new Date(),
        });
        toast.success(`Delivery ${id} updated successfully.`);
        navigate("/deliveries");
      } else {
        const result = await createDeliveryWithTx(payload, null, user);
        toast.success(`Delivery ${result.deliveryId} booked successfully.`);
        navigate("/deliveries");
      }
    } catch (err) {
      console.error("Delivery submission error:", err);
      toast.error(err.message || "Failed to save delivery. Check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      navigate("/deliveries");
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading delivery order...</p>
      </div>
    );
  }

  return (
    <>
      <FormPage
        title={isEditing ? `Edit Delivery (${id})` : "Create New Delivery"}
        backTo="/deliveries"
        backLabel="Deliveries"
      >
        {/* Section 1: Customer */}
        <FormSection number="1" title="Customer">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Customer Full Name"
              value={formData.customerName}
              onChange={(e) => update("customerName", e.target.value)}
              placeholder="e.g. Dr. Alok Verma"
              error={errors.customerName}
              required
            />
            <Input
              label="Primary Mobile Number"
              value={formData.customerMobile}
              onChange={(e) => update("customerMobile", e.target.value)}
              placeholder="e.g. 9835012345"
              maxLength={10}
              error={errors.customerMobile}
              required
            />
            <Input
              label="Alternate Mobile (Optional)"
              value={formData.alternateMobile}
              onChange={(e) => update("alternateMobile", e.target.value)}
              placeholder="e.g. 9431098765"
              maxLength={10}
              error={errors.alternateMobile}
            />
          </div>
        </FormSection>

        {/* Section 2: Product */}
        <FormSection number="2" title="Product">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Product Name"
              value={formData.productName}
              onChange={(e) => update("productName", e.target.value)}
              placeholder="e.g. Sony Bravia 65 Inch 4K Google TV"
              error={errors.productName}
              required
            />
            <Select
              label="Product Category"
              value={formData.category}
              onChange={(e) => update("category", e.target.value)}
              options={deliveryCategories.map((c) => ({ label: c, value: c }))}
            />
            <Input
              label="Quantity"
              type="number"
              value={String(formData.quantity)}
              onChange={(e) => update("quantity", e.target.value)}
              error={errors.quantity}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Input
              label="Invoice Number"
              value={formData.invoiceNumber}
              onChange={(e) => update("invoiceNumber", e.target.value)}
              placeholder="e.g. INV-2026-0891"
              error={errors.invoiceNumber}
              required
            />
            <Input
              label="Product Price / Value (₹)"
              type="number"
              value={formData.productAmount}
              onChange={(e) => update("productAmount", e.target.value)}
              placeholder="e.g. 84990"
            />
          </div>
        </FormSection>

        {/* Section 3: Route */}
        <FormSection number="3" title="Route & Logistics">
          <div className="space-y-4">
            <Input
              label="Pickup Warehouse / Showroom Location"
              value={formData.pickupAddress}
              onChange={(e) => update("pickupAddress", e.target.value)}
              placeholder="e.g. Aditya Vision Central Warehouse"
              error={errors.pickupAddress}
              required
            />
            <Textarea
              label="Customer Handover Doorstep Address"
              value={formData.deliveryAddress}
              onChange={(e) => update("deliveryAddress", e.target.value)}
              placeholder="e.g. Flat 402, Royal Residency, Boring Canal Road"
              error={errors.deliveryAddress}
              rows={2}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Input
                label="Destination City"
                value={formData.city}
                onChange={(e) => update("city", e.target.value)}
                error={errors.city}
                required
              />
              <Input
                label="Destination PIN Code"
                value={formData.pinCode}
                onChange={(e) => update("pinCode", e.target.value)}
                maxLength={6}
                error={errors.pinCode}
                required
              />
              <Input
                label="Transit Distance (KM)"
                type="number"
                value={formData.distanceKm}
                onChange={(e) => update("distanceKm", e.target.value)}
                placeholder="e.g. 8.5"
                error={errors.distanceKm}
                required
              />
              <Input
                label="Scheduled Date"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => update("deliveryDate", e.target.value)}
                error={errors.deliveryDate}
                required
              />
            </div>
          </div>
        </FormSection>

        {/* Section 4: Driver */}
        <FormSection number="4" title="Assigned Fleet Driver">
          {activeDrivers.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[#D1D5DB] text-center bg-gray-50">
              <p className="text-sm font-semibold text-[#202124]">No active drivers available</p>
              <p className="text-xs text-[#6B7280] mt-1">
                You can save this delivery as Unassigned now and assign later.
              </p>
              <Link
                to="/drivers/new"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#E53935] hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Driver Now</span>
              </Link>
            </div>
          ) : (
            <Select
              label="Select Active Fleet Driver"
              value={formData.driverId}
              onChange={(e) => update("driverId", e.target.value)}
              options={[
                { value: "", label: "— Assign Later (Unassigned) —" },
                ...activeDrivers.map((d) => ({
                  label: `${d.name} — ${d.vehicleType} — ${d.mobile}`,
                  value: d.id,
                })),
              ]}
            />
          )}
        </FormSection>

        {/* Section 5: Charges */}
        <FormSection number="5" title="Charges">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Trip Delivery Charges (₹)"
              type="number"
              value={formData.deliveryCharges}
              onChange={(e) => update("deliveryCharges", e.target.value)}
              placeholder="e.g. 650"
              error={errors.deliveryCharges}
              required
            />
            <Input
              label="Additional Charges (₹) - Toll / Floor Carry"
              type="number"
              value={formData.additionalCharges}
              onChange={(e) => update("additionalCharges", e.target.value)}
              placeholder="e.g. 100"
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Handling Instructions / Customer Notes"
              value={formData.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. Fragile glass panel, carry to 4th floor using elevator..."
              rows={2}
            />
          </div>
        </FormSection>
      </FormPage>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB] shadow-lg px-6 py-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#202124] hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isEditing ? "Update Delivery" : "Schedule Delivery"}</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => {
          setShowDiscard(false);
          navigate("/deliveries");
        }}
        type="warning"
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Discard Changes"
      />
    </>
  );
};

export default DeliveryFormPage;
