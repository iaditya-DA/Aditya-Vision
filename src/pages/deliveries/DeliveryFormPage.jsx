import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  UserPlus,
  Loader2,
  Camera,
  UploadCloud,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Textarea from "../../components/common/Textarea";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AccessDenied from "../AccessDenied";
import { deliveryCategories } from "../../constants/appConstants";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { getActiveDrivers } from "../../services/driverService";
import { getDeliveryById, createDeliveryWithTx } from "../../services/deliveryService";
import { uploadImage, thumbUrl, compressImage } from "../../services/cloudinaryService";
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
  image: delivery?.image || null,
});

const DeliveryFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isSuperAdmin } = useAuth();

  const isEditing = Boolean(id);
  const [formData, setFormData] = useState(() => getInitialForm(null));
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cloudinary image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [fileMeta, setFileMeta] = useState(null);
  const [lastFile, setLastFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    getActiveDrivers()
      .then((list) => {
        if (mounted) setActiveDrivers(list);
      })
      .catch(console.error);

    if (isEditing) {
      getDeliveryById(id)
        .then((del) => {
          if (mounted && del) {
            setFormData(getInitialForm(del));
            if (del.image?.url) {
              setFileMeta({
                name: "Product Photo",
                size: "Uploaded",
              });
            }
            setLoadingInitial(false);
          }
        })
        .catch((err) => {
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

  const processAndUploadFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files (JPG, PNG, WebP) are supported.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image file size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    setLastFile(file);
    setUploadError("");
    setUploading(true);
    setUploadProgress(10);

    try {
      // 1. Client-side compression to max 1600px, 0.8 quality JPEG
      const compressed = await compressImage(file, 1600, 0.8);
      setUploadProgress(30);

      // 2. Upload to Cloudinary unsigned preset
      const result = await uploadImage(compressed, (percent) => {
        // Map upload progress 30% -> 95%
        const mapped = Math.round(30 + (percent * 65) / 100);
        setUploadProgress(mapped);
      });

      setUploadProgress(100);
      setFormData((prev) => ({
        ...prev,
        image: {
          url: result.url,
          publicId: result.publicId,
        },
      }));
      setFileMeta({
        name: file.name,
        size: `${Math.round(compressed.size / 1024)} KB`,
      });
      setIsDirty(true);
      toast.success("Product photo uploaded successfully.");
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      setUploadError(err.message || "Failed to upload photo. Please retry.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndUploadFile(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setFileMeta(null);
    setUploadError("");
    setIsDirty(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRetryUpload = () => {
    if (lastFile) {
      processAndUploadFile(lastFile);
    }
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
    if (!formData.productName.trim())
      errs.productName = "Product name is required";
    if (!formData.invoiceNumber.trim())
      errs.invoiceNumber = "Invoice number is required";
    if (!formData.city.trim()) errs.city = "Destination city is required";
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
    if (uploading) {
      toast.warning("Please wait for product photo upload to complete.");
      return;
    }

    setIsSubmitting(true);
    const matchedDriver = activeDrivers.find(
      (d) => d.id === formData.driverId
    );

    let derivedStatus = formData.status;
    if (formData.driverId && derivedStatus === "Created") {
      derivedStatus = "Assigned";
    }

    const payload = {
      customerName: formData.customerName.trim(),
      customerMobile: formData.customerMobile.trim(),
      alternateMobile: formData.alternateMobile?.trim() || "",
      productName: formData.productName.trim(),
      category: formData.category,
      quantity: Number(formData.quantity) || 1,
      invoiceNumber: formData.invoiceNumber.trim(),
      city: formData.city.trim(),
      pinCode: formData.pinCode.trim(),
      distanceKm: Number(formData.distanceKm),
      deliveryDate: formData.deliveryDate,
      driverId: formData.driverId || "",
      driverName: matchedDriver ? matchedDriver.name : "Unassigned",
      deliveryCharges: Number(formData.deliveryCharges) || 0,
      additionalCharges: Number(formData.additionalCharges) || 0,
      notes: formData.notes?.trim() || "",
      status: derivedStatus,
      image: formData.image || null,
    };

    try {
      if (isEditing) {
        const delRef = doc(db, "deliveries", id);
        await updateDoc(delRef, {
          ...payload,
          totalCharges:
            (payload.deliveryCharges || 0) + (payload.additionalCharges || 0),
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

  // Staff cannot edit deliveries - Super Admin only
  if (isEditing && !isSuperAdmin) {
    return <AccessDenied />;
  }

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
        <FormSection number="1" title="Customer Details">
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
        <FormSection number="2" title="Product Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              label="Quantity"
              type="number"
              value={String(formData.quantity)}
              onChange={(e) => update("quantity", e.target.value)}
              error={errors.quantity}
              required
            />
          </div>
        </FormSection>

        {/* Section 3: Product Photo Upload (Optional) */}
        <FormSection number="3" title="Product Photo (Optional)">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {!formData.image?.url && !uploading && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                  ${
                    isDragging
                      ? "border-[#E53935] bg-[#FFF8F7]"
                      : "border-[#D1D5DB] hover:border-[#E53935] hover:bg-[#FFF8F7]/40 bg-gray-50/50"
                  }
                `}
              >
                <div className="w-12 h-12 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[#202124]">
                  Drag and drop product photo, or{" "}
                  <span className="text-[#E53935] underline underline-offset-2">
                    browse from device / camera
                  </span>
                </p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Supports JPG, PNG, WebP up to 5MB. Automatically compressed for fast delivery.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-xs font-semibold text-[#202124] hover:bg-gray-50 shadow-2xs cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Choose Photo / Open Camera</span>
                </button>
              </div>
            )}

            {/* Uploading progress bar state */}
            {uploading && (
              <div className="p-5 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#202124] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#E53935] animate-spin" />
                    Compressing & uploading photo...
                  </span>
                  <span className="font-mono font-bold text-[#E53935]">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#E53935] h-full transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded photo preview */}
            {formData.image?.url && !uploading && (
              <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E5E7EB] bg-gray-50 shrink-0 shadow-2xs">
                    <img
                      src={thumbUrl(formData.image.url, 200)}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-xs font-bold text-[#202124] truncate max-w-[200px] sm:max-w-[280px]">
                        {fileMeta?.name || "Product Photo Attached"}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#6B7280] font-mono mt-0.5">
                      Size: {fileMeta?.size || "Compressed"} • Cloudinary Hosted
                    </p>
                    <a
                      href={formData.image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#E53935] hover:underline inline-block mt-0.5"
                    >
                      View full photo
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-xs font-semibold text-[#202124] hover:bg-gray-50 shadow-2xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 shadow-2xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error display with Retry */}
            {uploadError && !uploading && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                  <span>{uploadError}</span>
                </div>
                {lastFile && (
                  <button
                    type="button"
                    onClick={handleRetryUpload}
                    className="px-2.5 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* Section 4: Route */}
        <FormSection number="4" title="Route & Destination">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Destination City"
              value={formData.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="e.g. Patna"
              error={errors.city}
              required
            />
            <Input
              label="Destination PIN Code"
              value={formData.pinCode}
              onChange={(e) => update("pinCode", e.target.value)}
              placeholder="e.g. 800001"
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
              label="Scheduled Delivery Date"
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => update("deliveryDate", e.target.value)}
              error={errors.deliveryDate}
              required
            />
          </div>
        </FormSection>

        {/* Section 5: Driver */}
        <FormSection number="5" title="Assigned Fleet Driver">
          {activeDrivers.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[#D1D5DB] text-center bg-gray-50">
              <p className="text-sm font-semibold text-[#202124]">
                No active drivers available
              </p>
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

        {/* Section 6: Charges */}
        <FormSection number="6" title="Charges & Notes">
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
          disabled={isSubmitting || uploading}
          className="px-5 py-2.5 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#202124] hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || uploading}
          className="px-6 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
