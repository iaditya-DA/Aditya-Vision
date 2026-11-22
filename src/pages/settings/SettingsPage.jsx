import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Store,
  Globe2,
  BellRing,
  ShieldAlert,
  SlidersHorizontal,
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  KeyRound,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Info,
  ShieldCheck,
  Check,
} from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Textarea from "../../components/common/Textarea";
import Select from "../../components/common/Select";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
  getAllSettings,
  updateSettingsSection,
  uploadBusinessLogo,
  DEFAULT_SETTINGS,
} from "../../services/settingsService";
import { changeUserPassword } from "../../services/authService";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SETTINGS_SECTIONS = [
  {
    id: "business",
    label: "Business Profile",
    icon: Building2,
    description: "Company trade details, GSTIN, PAN, branding logo and address",
  },
  {
    id: "operations",
    label: "Store Operations",
    icon: Store,
    description: "Operating schedule, delivery fees, service radius and dispatch rules",
  },
  {
    id: "regional",
    label: "Regional & Localization",
    icon: Globe2,
    description: "Currency (₹), date formats, timezone and Indian numeral grouping",
  },
  {
    id: "notifications",
    label: "Notification Routing",
    icon: BellRing,
    description: "Email, SMS, and in-app dispatches for orders, payouts and drivers",
  },
  {
    id: "security",
    label: "Security & Credentials",
    icon: ShieldAlert,
    description: "Password policies, session timeouts, lockout rules and password reset",
  },
  {
    id: "preferences",
    label: "System Preferences",
    icon: SlidersHorizontal,
    description: "Dashboard layout, pagination rows, auto-refresh and export defaults",
  },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("business");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dirtySections, setDirtySections] = useState({});

  // 6 Sections State
  const [business, setBusiness] = useState(DEFAULT_SETTINGS.business_profile);
  const [operations, setOperations] = useState(DEFAULT_SETTINGS.store_operations);
  const [regional, setRegional] = useState(DEFAULT_SETTINGS.regional);
  const [notifications, setNotifications] = useState(DEFAULT_SETTINGS.notifications);
  const [security, setSecurity] = useState(DEFAULT_SETTINGS.security);
  const [preferences, setPreferences] = useState(DEFAULT_SETTINGS.preferences);

  // Security: Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAllSettings()
      .then((data) => {
        if (!mounted) return;
        if (data.business_profile) setBusiness(data.business_profile);
        if (data.store_operations) setOperations(data.store_operations);
        if (data.regional) setRegional(data.regional);
        if (data.notifications) setNotifications(data.notifications);
        if (data.security) setSecurity(data.security);
        if (data.preferences) setPreferences(data.preferences);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load settings:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const markDirty = (sectionId) => {
    setDirtySections((prev) => ({ ...prev, [sectionId]: true }));
  };

  const clearDirty = (sectionId) => {
    setDirtySections((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  };

  // Section Change Handlers
  const handleBusinessChange = (field, value) => {
    setBusiness((prev) => ({ ...prev, [field]: value }));
    markDirty("business");
  };

  const handleOperationsChange = (field, value) => {
    setOperations((prev) => ({ ...prev, [field]: value }));
    markDirty("operations");
  };

  const handleOperatingDayToggle = (day) => {
    setOperations((prev) => {
      const exists = (prev.operatingDays || []).includes(day);
      const updated = exists
        ? prev.operatingDays.filter((d) => d !== day)
        : [...(prev.operatingDays || []), day];
      return { ...prev, operatingDays: updated };
    });
    markDirty("operations");
  };

  const handleRegionalChange = (field, value) => {
    setRegional((prev) => ({ ...prev, [field]: value }));
    markDirty("regional");
  };

  const handleNotificationChange = (field, value) => {
    setNotifications((prev) => ({ ...prev, [field]: value }));
    markDirty("notifications");
  };

  const handleNotificationEventToggle = (eventKey) => {
    setNotifications((prev) => ({
      ...prev,
      events: {
        ...(prev.events || {}),
        [eventKey]: !prev.events?.[eventKey],
      },
    }));
    markDirty("notifications");
  };

  const handleSecurityChange = (field, value) => {
    setSecurity((prev) => ({ ...prev, [field]: value }));
    markDirty("security");
  };

  const handlePreferencesChange = (field, value) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
    markDirty("preferences");
  };

  // Logo Upload & Remove Handlers
  const handleLogoFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const result = await uploadBusinessLogo(file);
      setBusiness((prev) => ({ ...prev, logoUrl: result.logoUrl }));
      toast.success("Branding logo uploaded and updated successfully.");
      clearDirty("business");
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error(err.message || "Failed to upload logo image");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettingsSection("business_profile", { logoUrl: "" });
      setBusiness((prev) => ({ ...prev, logoUrl: "" }));
      toast.success("Business branding logo removed.");
      clearDirty("business");
    } catch (err) {
      toast.error(err.message || "Failed to remove logo");
    }
  };

  // Save Current Active Section
  const handleSaveActiveSection = async () => {
    setSaving(true);
    try {
      if (activeTab === "business") {
        if (!business.name?.trim()) {
          toast.error("Business legal name is required.");
          setSaving(false);
          return;
        }
        await updateSettingsSection("business_profile", business);
        toast.success("Business Profile saved successfully.");
        clearDirty("business");
      } else if (activeTab === "operations") {
        await updateSettingsSection("store_operations", operations);
        toast.success("Store Operations & Dispatch parameters saved.");
        clearDirty("operations");
      } else if (activeTab === "regional") {
        await updateSettingsSection("regional", regional);
        toast.success("Regional and localization formats updated.");
        clearDirty("regional");
      } else if (activeTab === "notifications") {
        await updateSettingsSection("notifications", notifications);
        toast.success("Notification preferences and event routing saved.");
        clearDirty("notifications");
      } else if (activeTab === "security") {
        await updateSettingsSection("security", security);
        toast.success("Security policies saved.");
        clearDirty("security");
      } else if (activeTab === "preferences") {
        await updateSettingsSection("preferences", preferences);
        toast.success("System preferences saved.");
        clearDirty("preferences");
      }
    } catch (err) {
      console.error(`Failed to save ${activeTab} settings:`, err);
      toast.error(err.message || "Failed to save settings changes");
    } finally {
      setSaving(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      toast.error("Please enter your current account password.");
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success("Account password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("Change password error:", err);
      toast.error(err.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const isCurrentSectionDirty = Boolean(dirtySections[activeTab]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto mb-2" />
        <p className="text-sm text-[#6B7280]">Loading business settings and system policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Settings & System Policies"
        description="Manage business profile, store operations, regional formats, notifications and security preferences."
        action={
          <div className="flex items-center gap-3">
            {isCurrentSectionDirty && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Unsaved changes
              </span>
            )}
            <Button
              variant="primary"
              icon={saving ? Loader2 : Save}
              disabled={saving}
              onClick={handleSaveActiveSection}
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        }
      />

      {/* Main Settings Layout: Left Navigation + Right Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Navigation Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3 space-y-1.5 sticky top-20">
          <div className="px-3 py-2 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
            Configuration Modules
          </div>

          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeTab === section.id;
            const hasDirty = Boolean(dirtySections[section.id]);

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveTab(section.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                  isActive
                    ? "bg-[#FFF1F0] text-[#E53935] border border-[#FECACA] font-bold shadow-2xs"
                    : "text-[#374151] hover:bg-gray-50 border border-transparent font-medium"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isActive
                      ? "bg-[#E53935] text-white"
                      : "bg-gray-100 text-[#6B7280]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{section.label}</span>
                    {hasDirty && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] line-clamp-1 mt-0.5 leading-tight ${
                      isActive ? "text-[#E53935]/80" : "text-[#6B7280]"
                    }`}
                  >
                    {section.description}
                  </p>
                </div>
              </button>
            );
          })}

          <div className="pt-3 border-t border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280]">
            <span className="block font-semibold text-[#202124]">Aditya Vision OS</span>
            <span className="text-[11px]">System v2.4 • Benipatti Hub</span>
          </div>
        </div>

        {/* Right Content Pane */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* TAB 1: BUSINESS PROFILE */}
          {activeTab === "business" && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#E53935]" />
                    <span>Business Profile & Legal Credentials</span>
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Configure company name, tax registration (GSTIN/PAN), registered office address, and PDF report branding.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={saving ? Loader2 : Save}
                  disabled={saving}
                  onClick={handleSaveActiveSection}
                >
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>

              {/* Logo Upload Card */}
              <div className="p-5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex flex-col sm:flex-row items-center gap-6">
                <div className="w-36 h-28 rounded-xl bg-white border border-[#E5E7EB] p-2 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {business.logoUrl ? (
                    <img
                      src={business.logoUrl}
                      alt="Business Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 text-center">
                      <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                      <span className="text-[10px] font-semibold text-gray-400">No Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-sm font-bold text-[#202124]">Business Branding Logo</h3>
                    {business.logoUrl ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Not Set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1">
                    This logo appears in all formal PDF exports, customer delivery slips, and driver disbursement reports.
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    Recommended: PNG, JPG, or WebP up to 5MB (transparent background).
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileSelect}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      icon={uploadingLogo ? Loader2 : Upload}
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingLogo
                        ? "Uploading Logo..."
                        : business.logoUrl
                        ? "Replace Logo"
                        : "Upload Logo"}
                    </Button>

                    {business.logoUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Trash2}
                        disabled={uploadingLogo}
                        onClick={handleRemoveLogo}
                      >
                        Remove Logo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Registered Business / Legal Entity Name"
                  required
                  value={business.name || ""}
                  onChange={(e) => handleBusinessChange("name", e.target.value)}
                  placeholder="e.g. Aditya Vision Ltd."
                />

                <Input
                  label="Official Business Email"
                  required
                  type="email"
                  value={business.email || ""}
                  onChange={(e) => handleBusinessChange("email", e.target.value)}
                  placeholder="e.g. contact@adityavision.com"
                />

                <Input
                  label="Primary Contact Number"
                  required
                  value={business.contactNumber || ""}
                  onChange={(e) => handleBusinessChange("contactNumber", e.target.value)}
                  placeholder="e.g. +91 612 2500000"
                />

                <Input
                  label="Alternate / Support Mobile"
                  value={business.supportMobile || ""}
                  onChange={(e) => handleBusinessChange("supportMobile", e.target.value)}
                  placeholder="e.g. +91 9835012345"
                />

                <Input
                  label="Official Website URL"
                  value={business.website || ""}
                  onChange={(e) => handleBusinessChange("website", e.target.value)}
                  placeholder="e.g. https://www.adityavision.com"
                />

                <Input
                  label="GSTIN (Goods & Services Tax ID)"
                  value={business.gstin || ""}
                  onChange={(e) => handleBusinessChange("gstin", e.target.value.toUpperCase())}
                  placeholder="e.g. 10AAACA1234A1Z5"
                />

                <Input
                  label="Permanent Account Number (PAN)"
                  value={business.pan || ""}
                  onChange={(e) => handleBusinessChange("pan", e.target.value.toUpperCase())}
                  placeholder="e.g. AAACA1234A"
                />

                <Input
                  label="Assigned Retail Branch"
                  value={business.branch || "Benipatti Branch"}
                  onChange={(e) => handleBusinessChange("branch", e.target.value)}
                  placeholder="Benipatti Branch"
                />

                <div className="md:col-span-2">
                  <Input
                    label="Registered Office Address"
                    required
                    value={business.address || ""}
                    onChange={(e) => handleBusinessChange("address", e.target.value)}
                    placeholder="e.g. Benipatti Branch, Main Road, Near Block Chowk"
                  />
                </div>

                <Input
                  label="City / Town"
                  value={business.city || "Benipatti"}
                  onChange={(e) => handleBusinessChange("city", e.target.value)}
                  placeholder="Benipatti"
                />

                <Input
                  label="State / Province"
                  value={business.state || "Bihar"}
                  onChange={(e) => handleBusinessChange("state", e.target.value)}
                  placeholder="Bihar"
                />

                <Input
                  label="PIN / Postal Code"
                  value={business.pinCode || "847223"}
                  onChange={(e) => handleBusinessChange("pinCode", e.target.value)}
                  placeholder="847223"
                />

                <Input
                  label="Country"
                  value={business.country || "India"}
                  onChange={(e) => handleBusinessChange("country", e.target.value)}
                  placeholder="India"
                />

                <div className="md:col-span-2">
                  <Textarea
                    label="Business Profile & Summary Description"
                    value={business.description || ""}
                    onChange={(e) => handleBusinessChange("description", e.target.value)}
                    placeholder="Provide a concise description of business operations and retail appliance distribution network..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORE OPERATIONS */}
          {activeTab === "operations" && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                    <Store className="w-5 h-5 text-[#E53935]" />
                    <span>Store Operations & Dispatch Policies</span>
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Define business working schedule, standard customer delivery charges, radius coverage, and auto-dispatch rules.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={saving ? Loader2 : Save}
                  disabled={saving}
                  onClick={handleSaveActiveSection}
                >
                  {saving ? "Saving..." : "Save Operations"}
                </Button>
              </div>

              {/* Operating Days Selection */}
              <div>
                <label className="text-xs font-bold text-[#202124] uppercase tracking-wider block mb-2">
                  Business Operating Schedule (Working Days)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = (operations.operatingDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleOperatingDayToggle(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#FFF1F0] text-[#E53935] border-[#FCA5A5]"
                            : "bg-gray-50 text-[#6B7280] border-[#E5E7EB] hover:bg-gray-100"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours and Fees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Daily Opening Time"
                  type="time"
                  value={operations.openingTime || "09:30"}
                  onChange={(e) => handleOperationsChange("openingTime", e.target.value)}
                />

                <Input
                  label="Daily Closing Time"
                  type="time"
                  value={operations.closingTime || "20:30"}
                  onChange={(e) => handleOperationsChange("closingTime", e.target.value)}
                />

                <Input
                  label="Default Delivery Charge (₹)"
                  type="number"
                  value={operations.defaultDeliveryCharge ?? 250}
                  onChange={(e) => handleOperationsChange("defaultDeliveryCharge", Number(e.target.value))}
                  helperText="Standard delivery rate applied to new customer orders"
                />

                <Input
                  label="Maximum Allowed Delivery Distance (KM)"
                  type="number"
                  value={operations.maxDeliveryDistance ?? 60}
                  onChange={(e) => handleOperationsChange("maxDeliveryDistance", Number(e.target.value))}
                  helperText="Flag orders exceeding this delivery radius"
                />

                <div className="md:col-span-2">
                  <Input
                    label="Designated Delivery Service Area"
                    value={operations.serviceArea || ""}
                    onChange={(e) => handleOperationsChange("serviceArea", e.target.value)}
                    placeholder="e.g. Benipatti & Surrounding Districts (Madhubani, Darbhanga, Sitamarhi)"
                  />
                </div>

                <Select
                  label="Driver Assignment Behaviour"
                  value={operations.assignmentBehaviour || "Manual Dispatcher Assignment"}
                  onChange={(e) => handleOperationsChange("assignmentBehaviour", e.target.value)}
                  options={[
                    { value: "Manual Dispatcher Assignment", label: "Manual Dispatcher Assignment" },
                    { value: "Auto-Assign Nearest Available Driver", label: "Auto-Assign Nearest Available Driver" },
                    { value: "Round-Robin Driver Queue", label: "Round-Robin Driver Queue" },
                  ]}
                />

                <Select
                  label="Default Distance Measurement Unit"
                  value={operations.distanceUnit || "KM"}
                  onChange={(e) => handleOperationsChange("distanceUnit", e.target.value)}
                  options={[
                    { value: "KM", label: "Kilometers (KM)" },
                    { value: "Miles", label: "Miles" },
                  ]}
                />

                <Input
                  label="Delivery Sequential ID Prefix"
                  value={operations.deliveryIdPrefix || "DEL"}
                  onChange={(e) => handleOperationsChange("deliveryIdPrefix", e.target.value.toUpperCase())}
                  helperText="Prefix used in generated codes (e.g. DEL-2026-0001)"
                />

                <Input
                  label="Invoice Number Tracking Prefix"
                  value={operations.invoicePrefix || "INV-AV"}
                  onChange={(e) => handleOperationsChange("invoicePrefix", e.target.value.toUpperCase())}
                  helperText="Retail store billing invoice prefix"
                />
              </div>
            </div>
          )}

          {/* TAB 3: REGIONAL & LOCALIZATION */}
          {activeTab === "regional" && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                    <Globe2 className="w-5 h-5 text-[#E53935]" />
                    <span>Regional & Localization Preferences</span>
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Control currency symbols, calendar formats, timezone synchronization and Indian numeral groupings across the application.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={saving ? Loader2 : Save}
                  disabled={saving}
                  onClick={handleSaveActiveSection}
                >
                  {saving ? "Saving..." : "Save Regional"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Primary Operating Currency"
                  value={regional.currency || "INR"}
                  onChange={(e) => handleRegionalChange("currency", e.target.value)}
                  options={[
                    { value: "INR", label: "INR — Indian Rupee (₹)" },
                    { value: "USD", label: "USD — US Dollar ($)" },
                    { value: "EUR", label: "EUR — Euro (€)" },
                  ]}
                />

                <Input
                  label="Currency Symbol Display"
                  value={regional.currencySymbol || "₹"}
                  onChange={(e) => handleRegionalChange("currencySymbol", e.target.value)}
                  placeholder="₹"
                />

                <Select
                  label="Date Representation Format"
                  value={regional.dateFormat || "DD/MM/YYYY"}
                  onChange={(e) => handleRegionalChange("dateFormat", e.target.value)}
                  options={[
                    { value: "DD/MM/YYYY", label: "DD/MM/YYYY (Standard Indian Format)" },
                    { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO Format)" },
                    { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US Format)" },
                  ]}
                />

                <Select
                  label="Time Format"
                  value={regional.timeFormat || "12-hour"}
                  onChange={(e) => handleRegionalChange("timeFormat", e.target.value)}
                  options={[
                    { value: "12-hour", label: "12-Hour (02:30 PM)" },
                    { value: "24-hour", label: "24-Hour (14:30)" },
                  ]}
                />

                <Select
                  label="Standard Time Zone"
                  value={regional.timeZone || "Asia/Kolkata"}
                  onChange={(e) => handleRegionalChange("timeZone", e.target.value)}
                  options={[
                    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
                    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
                  ]}
                />

                <Select
                  label="Application Language"
                  value={regional.language || "English (India)"}
                  onChange={(e) => handleRegionalChange("language", e.target.value)}
                  options={[
                    { value: "English (India)", label: "English (India)" },
                    { value: "Hindi", label: "Hindi (हिंदी)" },
                  ]}
                />

                <Select
                  label="Number & Currency Grouping"
                  value={regional.numberFormatting || "Indian (Lakhs / Crores)"}
                  onChange={(e) => handleRegionalChange("numberFormatting", e.target.value)}
                  options={[
                    { value: "Indian (Lakhs / Crores)", label: "Indian Format (₹ 1,00,000.00)" },
                    { value: "International", label: "International Format ($ 100,000.00)" },
                  ]}
                />

                <Select
                  label="Distance Measurement Unit"
                  value={regional.distanceUnit || "KM"}
                  onChange={(e) => handleRegionalChange("distanceUnit", e.target.value)}
                  options={[
                    { value: "KM", label: "Kilometers (KM)" },
                    { value: "Miles", label: "Miles" },
                  ]}
                />
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Current Regional Configuration Active</span>
                  <span className="text-[11px] text-emerald-800">
                    Currency: ₹ (INR) • Dates: DD/MM/YYYY • Timezone: Asia/Kolkata (IST) • Numbering: Indian Grouping
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATION ROUTING */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[#E53935]" />
                    <span>Notification Preferences & Event Routing</span>
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Configure delivery dispatch notices, financial payout triggers, and driver authorization alerts.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={saving ? Loader2 : Save}
                  disabled={saving}
                  onClick={handleSaveActiveSection}
                >
                  {saving ? "Saving..." : "Save Notifications"}
                </Button>
              </div>

              {/* Delivery Channels Toggles */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-[#202124] uppercase tracking-wider block">
                  Notification Delivery Channels
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(notifications.emailNotifications)}
                      onChange={(e) => handleNotificationChange("emailNotifications", e.target.checked)}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#202124] block">Email Routing</span>
                      <span className="text-[10px] text-[#6B7280]">Dispatch reports & receipts</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(notifications.smsNotifications)}
                      onChange={(e) => handleNotificationChange("smsNotifications", e.target.checked)}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#202124] block">SMS Dispatches</span>
                      <span className="text-[10px] text-[#6B7280]">Real-time driver alerts</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(notifications.inAppNotifications)}
                      onChange={(e) => handleNotificationChange("inAppNotifications", e.target.checked)}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#202124] block">In-App Bell Alerts</span>
                      <span className="text-[10px] text-[#6B7280]">Live dashboard feed</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Channel Recipients */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email Notification Recipients (Comma-separated)"
                  value={notifications.emailRecipients || ""}
                  onChange={(e) => handleNotificationChange("emailRecipients", e.target.value)}
                  placeholder="dispatch@adityavision.com, finance@adityavision.com"
                />

                <Input
                  label="SMS Alert Target Numbers (Comma-separated)"
                  value={notifications.smsRecipients || ""}
                  onChange={(e) => handleNotificationChange("smsRecipients", e.target.value)}
                  placeholder="+91 9835012345"
                />
              </div>

              {/* Event Triggers Matrix */}
              <div className="pt-4 border-t border-[#E5E7EB]">
                <label className="text-xs font-bold text-[#202124] uppercase tracking-wider block mb-3">
                  Automatic Event Trigger Routing
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: "deliveryCreated", label: "Delivery Created", desc: "When staff logs a new appliance delivery" },
                    { key: "deliveryAssigned", label: "Delivery Assigned", desc: "When an order is assigned to a driver" },
                    { key: "deliveryStatusChange", label: "Status Changes", desc: "When delivery marked completed or failed" },
                    { key: "paymentReceived", label: "Payment Logged", desc: "When disbursement or settlement is recorded" },
                    { key: "paymentApproval", label: "Payment Requisition", desc: "When driver payout requires authorization" },
                    { key: "driverApproval", label: "Driver Onboarding", desc: "When a new driver submits registration" },
                  ].map((evt) => (
                    <label
                      key={evt.key}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E7EB] bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(notifications.events?.[evt.key])}
                        onChange={() => handleNotificationEventToggle(evt.key)}
                        className="w-4 h-4 mt-0.5 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-[#202124] block">{evt.label}</span>
                        <span className="text-[10px] text-[#6B7280] leading-snug block mt-0.5">{evt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Secure Provider Notice */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  <strong>Security Note:</strong> SMS and SMTP mail credentials are confidential and securely handled via backend environment secrets. No third-party provider credentials are exposed in client-accessible Firestore documents.
                </span>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & CREDENTIALS */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Security Policies Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                  <div>
                    <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-[#E53935]" />
                      <span>Authentication & Security Policies</span>
                    </h2>
                    <p className="text-xs text-[#6B7280] mt-1">
                      System-wide password complexity parameters, session timeouts, and lockout controls.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={saving ? Loader2 : Save}
                    disabled={saving}
                    onClick={handleSaveActiveSection}
                  >
                    {saving ? "Saving..." : "Save Policies"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Minimum Password Length"
                    value={String(security.minPasswordLength || 6)}
                    onChange={(e) => handleSecurityChange("minPasswordLength", Number(e.target.value))}
                    options={[
                      { value: "6", label: "6 Characters (Standard)" },
                      { value: "8", label: "8 Characters (Recommended)" },
                      { value: "10", label: "10 Characters" },
                      { value: "12", label: "12 Characters (High Security)" },
                    ]}
                  />

                  <Select
                    label="Inactivity Session Timeout"
                    value={String(security.sessionTimeoutMinutes || 60)}
                    onChange={(e) => handleSecurityChange("sessionTimeoutMinutes", Number(e.target.value))}
                    options={[
                      { value: "15", label: "15 Minutes" },
                      { value: "30", label: "30 Minutes" },
                      { value: "60", label: "1 Hour (Recommended)" },
                      { value: "120", label: "2 Hours" },
                      { value: "0", label: "Never (Browser Session Default)" },
                    ]}
                  />

                  <Select
                    label="Account Lockout Failed Threshold"
                    value={String(security.maxFailedLoginAttempts || 5)}
                    onChange={(e) => handleSecurityChange("maxFailedLoginAttempts", Number(e.target.value))}
                    options={[
                      { value: "3", label: "3 Failed Attempts" },
                      { value: "5", label: "5 Failed Attempts (Standard)" },
                      { value: "10", label: "10 Failed Attempts" },
                    ]}
                  />

                  <Select
                    label="Lockout Suspension Duration"
                    value={String(security.lockoutDurationMinutes || 15)}
                    onChange={(e) => handleSecurityChange("lockoutDurationMinutes", Number(e.target.value))}
                    options={[
                      { value: "15", label: "15 Minutes" },
                      { value: "30", label: "30 Minutes" },
                      { value: "60", label: "1 Hour" },
                    ]}
                  />

                  <Select
                    label="Two-Factor Authentication (2FA) Policy"
                    value={security.twoFactorStatus || "Disabled"}
                    onChange={(e) => handleSecurityChange("twoFactorStatus", e.target.value)}
                    options={[
                      { value: "Disabled", label: "Disabled" },
                      { value: "Optional", label: "Optional for Staff" },
                      { value: "Enforced", label: "Enforced for Super Admins" },
                    ]}
                  />

                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] bg-gray-50/50">
                    <input
                      type="checkbox"
                      id="singleSession"
                      checked={Boolean(security.enforceSingleActiveSession)}
                      onChange={(e) => handleSecurityChange("enforceSingleActiveSession", e.target.checked)}
                      className="w-4 h-4 rounded text-[#E53935] focus:ring-[#E53935] border-gray-300"
                    />
                    <label htmlFor="singleSession" className="cursor-pointer">
                      <span className="text-xs font-bold text-[#202124] block">Single Active Session</span>
                      <span className="text-[10px] text-[#6B7280]">Terminate prior session on new login</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                    <span>Staff role authorization is managed in the Users & Staff module</span>
                  </div>
                  <Link
                    to="/users"
                    className="text-xs font-bold text-[#E53935] hover:text-[#B71C1C] flex items-center gap-1"
                  >
                    <span>Manage Staff Roles</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Password Change Box */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-4">
                <div className="pb-3 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#E53935]" />
                    <span>Change Current User Password</span>
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Update the authentication password for your active session ({user?.email}).
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Current Password"
                      type="password"
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="••••••••"
                    />

                    <Input
                      label="New Password"
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Min. 6 characters"
                    />

                    <Input
                      label="Confirm New Password"
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={changingPassword}
                      icon={changingPassword ? Loader2 : KeyRound}
                    >
                      {changingPassword ? "Updating Password..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-[#E53935]" />
                    <span>System Preferences & Environment</span>
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-1">
                    Adjust default UI presentations, export file standards, table pagination limits and system-wide broadcast notices.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={saving ? Loader2 : Save}
                  disabled={saving}
                  onClick={handleSaveActiveSection}
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Default Landing Dashboard View"
                  value={preferences.defaultDashboardView || "Overview & Metrics"}
                  onChange={(e) => handlePreferencesChange("defaultDashboardView", e.target.value)}
                  options={[
                    { value: "Overview & Metrics", label: "Overview & Metrics" },
                    { value: "Deliveries Map View", label: "Deliveries Map View" },
                    { value: "Daily Dispatch Summary", label: "Daily Dispatch Summary" },
                  ]}
                />

                <Select
                  label="Table Default Rows Per Page"
                  value={String(preferences.tableRowsPerPage || 10)}
                  onChange={(e) => handlePreferencesChange("tableRowsPerPage", Number(e.target.value))}
                  options={[
                    { value: "10", label: "10 Rows" },
                    { value: "25", label: "25 Rows" },
                    { value: "50", label: "50 Rows" },
                    { value: "100", label: "100 Rows" },
                  ]}
                />

                <Select
                  label="Default Data Export Format"
                  value={preferences.defaultExportFormat || "xlsx"}
                  onChange={(e) => handlePreferencesChange("defaultExportFormat", e.target.value)}
                  options={[
                    { value: "xlsx", label: "Microsoft Excel (.xlsx)" },
                    { value: "pdf", label: "Adobe PDF Document (.pdf)" },
                    { value: "csv", label: "Comma-Separated Values (.csv)" },
                  ]}
                />

                <Select
                  label="Live Data Automatic Refresh Rate"
                  value={String(preferences.autoRefreshIntervalSeconds || 0)}
                  onChange={(e) => handlePreferencesChange("autoRefreshIntervalSeconds", Number(e.target.value))}
                  options={[
                    { value: "0", label: "Manual Refresh Only" },
                    { value: "30", label: "Every 30 Seconds" },
                    { value: "60", label: "Every 1 Minute" },
                    { value: "300", label: "Every 5 Minutes" },
                  ]}
                />

                <div className="md:col-span-2">
                  <Textarea
                    label="System Maintenance / Staff Announcement Notice"
                    value={preferences.systemMaintenanceNotice || ""}
                    onChange={(e) => handlePreferencesChange("systemMaintenanceNotice", e.target.value)}
                    placeholder="Leave blank for normal operations, or enter a system notice to broadcast to all staff members..."
                    rows={2}
                  />
                </div>
              </div>

              {/* System Diagnostics & Environment Summary */}
              <div className="pt-4 border-t border-[#E5E7EB]">
                <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider mb-3">
                  System Architecture & Runtime Diagnostics
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block text-[10px]">Cloud Provider</span>
                    <span className="font-bold text-[#202124]">Google Cloud / Firebase</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block text-[10px]">Database Engine</span>
                    <span className="font-bold text-[#202124]">Cloud Firestore (v13 SDK)</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block text-[10px]">Storage Bucket</span>
                    <span className="font-bold text-[#202124] truncate block">aditya-vision-bihar.appspot.com</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block text-[10px]">Active Hub Location</span>
                    <span className="font-bold text-[#E53935]">Benipatti Branch (Bihar)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
