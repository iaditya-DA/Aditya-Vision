import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Loader2, ShieldAlert } from "lucide-react";
import FormPage from "../../components/layout/FormPage";
import FormSection from "../../components/layout/FormSection";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Textarea from "../../components/common/Textarea";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { vehicleTypes } from "../../constants/appConstants";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
  getDriverById,
  getDriverBankDetails,
  createDriver,
  updateDriver,
} from "../../services/driverService";

const getInitialForm = (driver, bank) => ({
  name: driver?.name || "",
  mobile: driver?.mobile || "",
  alternateMobile: driver?.alternateMobile || "",
  address: driver?.address || "",
  city: driver?.city || "Patna",
  state: driver?.state || "Bihar",
  pinCode: driver?.pinCode || "",
  vehicleType: driver?.vehicleType || "Tata Ace (Chhota Hathi)",
  vehicleNumber: driver?.vehicleNumber || "",
  accountHolderName: bank?.accountHolderName || driver?.name || "",
  bankName: bank?.bankName || "",
  accountNumber: bank?.accountNumber || "",
  ifscCode: bank?.ifscCode || "",
  branchName: bank?.branchName || "",
  upiId: bank?.upiId || "",
  notes: driver?.notes || "",
  status: driver?.status || "Active",
});

const DriverFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isSuperAdmin, user } = useAuth();

  const isEditing = Boolean(id);
  const [formData, setFormData] = useState(() => getInitialForm(null, null));
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (isEditing) {
      Promise.all([
        getDriverById(id),
        isSuperAdmin ? getDriverBankDetails(id) : Promise.resolve(null),
      ])
        .then(([driver, bank]) => {
          if (mounted && driver) {
            setFormData(getInitialForm(driver, bank));
            setLoadingInitial(false);
          }
        })
        .catch((err) => {
          if (mounted) {
            toast.error("Could not load driver details");
            setLoadingInitial(false);
          }
          console.error(err);
        });
    }
    return () => {
      mounted = false;
    };
  }, [id, isEditing, isSuperAdmin, toast]);

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Driver name is required";
    if (!formData.mobile.trim()) {
      errs.mobile = "Mobile number is required";
    } else if (!/^\d{10}$/.test(formData.mobile.trim())) {
      errs.mobile = "Must be a 10-digit mobile number";
    }
    if (
      formData.alternateMobile.trim() &&
      !/^\d{10}$/.test(formData.alternateMobile.trim())
    ) {
      errs.alternateMobile = "Must be a 10-digit mobile number";
    }
    if (!formData.address.trim()) errs.address = "Address is required";
    if (!formData.city.trim()) errs.city = "City is required";
    if (!formData.pinCode.trim()) {
      errs.pinCode = "PIN code is required";
    } else if (!/^\d{6}$/.test(formData.pinCode.trim())) {
      errs.pinCode = "Must be a 6-digit PIN code";
    }
    if (!formData.vehicleNumber.trim()) {
      errs.vehicleNumber = "Vehicle number is required (e.g. BR-01-GB-4592)";
    }

    if (isSuperAdmin) {
      if (!formData.accountNumber.trim()) {
        errs.accountNumber = "Bank account number is required";
      }
      if (!formData.ifscCode.trim()) {
        errs.ifscCode = "IFSC code is required";
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode.trim().toUpperCase())) {
        errs.ifscCode = "Invalid IFSC format (e.g. SBIN0000152)";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      if (isEditing) {
        const publicUpdates = {
          name: formData.name.trim(),
          mobile: formData.mobile.trim(),
          alternateMobile: formData.alternateMobile.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pinCode: formData.pinCode.trim(),
          vehicleType: formData.vehicleType,
          vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
          notes: formData.notes.trim(),
        };

        let bankUpdates = null;
        if (isSuperAdmin) {
          bankUpdates = {
            accountHolderName: formData.accountHolderName.trim() || formData.name.trim(),
            bankName: formData.bankName.trim(),
            accountNumber: formData.accountNumber.trim(),
            ifscCode: formData.ifscCode.trim().toUpperCase(),
            branchName: formData.branchName.trim(),
            upiId: formData.upiId.trim(),
          };
        }

        await updateDriver(id, publicUpdates, bankUpdates);
        toast.success(`Driver ${formData.name} updated.`);
        navigate("/drivers");
      } else {
        const driverId = await createDriver(formData, isSuperAdmin, user);
        if (isSuperAdmin) {
          toast.success(`Driver ${formData.name} onboarded as Active (${driverId}).`);
        } else {
          toast.info(`Driver ${formData.name} submitted for Super Admin approval (${driverId}).`);
        }
        navigate("/drivers");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save driver profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      navigate("/drivers");
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading driver record...</p>
      </div>
    );
  }

  return (
    <>
      <FormPage
        title={isEditing ? `Edit Driver (${id})` : "Add New Fleet Driver"}
        backTo="/drivers"
        backLabel="Drivers"
      >
        {/* Pending Approval notice for non-Super Admin */}
        {!isSuperAdmin && !isEditing && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Approval Required</p>
              <p className="mt-0.5 text-amber-700">
                New drivers submitted by staff will be saved as &quot;Pending Approval&quot;. A Super Admin must approve this driver before they can be assigned to customer deliveries.
              </p>
            </div>
          </div>
        )}

        {/* Section 1: Personal Details */}
        <FormSection number="1" title="Driver Personal & Contact Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Full Name"
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Rajesh Kumar Singh"
              error={errors.name}
              required
            />
            <Input
              label="Primary Mobile"
              value={formData.mobile}
              onChange={(e) => update("mobile", e.target.value)}
              placeholder="e.g. 9835012345"
              maxLength={10}
              error={errors.mobile}
              required
            />
            <Input
              label="Alternate Contact Mobile"
              value={formData.alternateMobile}
              onChange={(e) => update("alternateMobile", e.target.value)}
              placeholder="e.g. 9431098765"
              maxLength={10}
              error={errors.alternateMobile}
            />
          </div>
        </FormSection>

        {/* Section 2: Address */}
        <FormSection number="2" title="Residential & Service Location">
          <div className="space-y-4">
            <Textarea
              label="Street Address / Mohalla"
              value={formData.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="e.g. Mohalla Ranipur, Near Golghar"
              error={errors.address}
              rows={2}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => update("city", e.target.value)}
                error={errors.city}
                required
              />
              <Input
                label="State"
                value={formData.state}
                onChange={(e) => update("state", e.target.value)}
                required
              />
              <Input
                label="Postal PIN Code"
                value={formData.pinCode}
                onChange={(e) => update("pinCode", e.target.value)}
                maxLength={6}
                error={errors.pinCode}
                required
              />
            </div>
          </div>
        </FormSection>

        {/* Section 3: Vehicle */}
        <FormSection number="3" title="Assigned Delivery Vehicle">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Vehicle Type"
              value={formData.vehicleType}
              onChange={(e) => update("vehicleType", e.target.value)}
              options={vehicleTypes.map((v) => ({ label: v, value: v }))}
            />
            <Input
              label="Vehicle Registration Plate"
              value={formData.vehicleNumber}
              onChange={(e) => update("vehicleNumber", e.target.value.toUpperCase())}
              placeholder="e.g. BR-01-GB-4592"
              error={errors.vehicleNumber}
              required
            />
          </div>
        </FormSection>

        {/* Section 4: Bank Details (Super Admin Only) */}
        {isSuperAdmin ? (
          <FormSection number="4" title="Bank Account & Payout Details (Confidential)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Account Holder Name"
                value={formData.accountHolderName}
                onChange={(e) => update("accountHolderName", e.target.value)}
                placeholder="e.g. Rajesh Kumar Singh"
              />
              <Input
                label="Bank Name"
                value={formData.bankName}
                onChange={(e) => update("bankName", e.target.value)}
                placeholder="e.g. State Bank of India"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <Input
                label="Account Number"
                value={formData.accountNumber}
                onChange={(e) => update("accountNumber", e.target.value)}
                placeholder="e.g. 30987654321"
                error={errors.accountNumber}
                required
              />
              <Input
                label="IFSC Code"
                value={formData.ifscCode}
                onChange={(e) => update("ifscCode", e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0000152"
                error={errors.ifscCode}
                required
              />
              <Input
                label="Branch Name"
                value={formData.branchName}
                onChange={(e) => update("branchName", e.target.value)}
                placeholder="e.g. Patna Main Branch"
              />
            </div>
            <div className="mt-4">
              <Input
                label="Virtual Payment Address / UPI ID"
                value={formData.upiId}
                onChange={(e) => update("upiId", e.target.value)}
                placeholder="e.g. rajeshsingh@oksbi"
              />
            </div>
          </FormSection>
        ) : (
          <div className="bg-gray-50 border border-[#E5E7EB] rounded-2xl p-5 flex items-center gap-3 text-xs text-[#6B7280]">
            <ShieldAlert className="w-5 h-5 text-gray-400 shrink-0" />
            <p>
              Sensitive banking details are protected and only accessible by Super Admin.
            </p>
          </div>
        )}

        {/* Section 5: Notes */}
        <FormSection number={isSuperAdmin ? "5" : "4"} title="Operational Notes">
          <Textarea
            label="Driver Performance & Appliance Handling Notes"
            value={formData.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="e.g. Handles double door fridges with care, experienced with staircase delivery..."
            rows={3}
          />
        </FormSection>
      </FormPage>

      {/* Sticky Bottom Bar */}
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
          <span>{isEditing ? "Save Driver Profile" : "Register Driver"}</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDiscard}
        onClose={() => setShowDiscard(false)}
        onConfirm={() => {
          setShowDiscard(false);
          navigate("/drivers");
        }}
        type="warning"
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Discard Changes"
      />
    </>
  );
};

export default DriverFormPage;
