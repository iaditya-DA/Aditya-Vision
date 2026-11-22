import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { saveBusinessProfile as syncExportProfile } from "../utils/exportUtils";

export const DEFAULT_SETTINGS = {
  business_profile: {
    name: "Aditya Vision Ltd.",
    logoUrl: "",
    email: "contact@adityavision.com",
    contactNumber: "+91 612 2500000",
    supportMobile: "+91 9835012345",
    website: "https://www.adityavision.com",
    gstin: "10AAACA1234A1Z5",
    pan: "AAACA1234A",
    address: "Benipatti Branch, Main Road, Near Block Chowk",
    city: "Benipatti",
    state: "Bihar",
    pinCode: "847223",
    country: "India",
    description: "Bihar's leading electronics and home appliances consumer retail network with 150+ stores across Bihar and Jharkhand.",
    branch: "Benipatti Branch",
    accountantName: "Abhishek Kumar Jha",
  },
  store_operations: {
    operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    openingTime: "09:30",
    closingTime: "20:30",
    defaultDeliveryCharge: 250,
    distanceUnit: "KM",
    serviceArea: "Benipatti & Surrounding Districts (Madhubani, Darbhanga, Sitamarhi)",
    maxDeliveryDistance: 60,
    assignmentBehaviour: "Manual Dispatcher Assignment",
    deliveryIdPrefix: "DEL",
    invoicePrefix: "INV-AV",
  },
  regional: {
    currency: "INR",
    currencySymbol: "₹",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
    timeZone: "Asia/Kolkata",
    language: "English (India)",
    numberFormatting: "Indian (Lakhs / Crores)",
    distanceUnit: "KM",
  },
  notifications: {
    emailNotifications: true,
    emailRecipients: "dispatch@adityavision.com, finance@adityavision.com",
    smsNotifications: true,
    smsRecipients: "+91 9835012345",
    inAppNotifications: true,
    events: {
      deliveryCreated: true,
      deliveryAssigned: true,
      deliveryStatusChange: true,
      paymentReceived: true,
      paymentApproval: true,
      driverApproval: true,
    },
  },
  security: {
    minPasswordLength: 6,
    requireSpecialChar: false,
    requireNumber: true,
    sessionTimeoutMinutes: 60,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    twoFactorStatus: "Disabled",
    enforceSingleActiveSession: false,
  },
  preferences: {
    defaultDashboardView: "Overview & Metrics",
    tableRowsPerPage: 10,
    defaultExportFormat: "xlsx",
    autoRefreshIntervalSeconds: 0,
    systemMaintenanceNotice: "",
  },
};

export const DEFAULT_BUSINESS_PROFILE = DEFAULT_SETTINGS.business_profile;

/**
 * Ensures all settings collection documents exist in Firestore
 */
export async function ensureDefaultSettings() {
  for (const [sectionKey, defaultData] of Object.entries(DEFAULT_SETTINGS)) {
    const docRef = doc(db, "settings", sectionKey);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...defaultData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * Fetch a specific settings section document
 */
export async function getSettingsSection(sectionKey) {
  const defaults = DEFAULT_SETTINGS[sectionKey] || {};
  try {
    const docRef = doc(db, "settings", sectionKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { ...defaults, ...snap.data() };
    }
  } catch (err) {
    console.warn(`Error fetching settings section ${sectionKey}, using defaults:`, err);
  }
  return defaults;
}

/**
 * Fetch all application settings in parallel
 */
export async function getAllSettings() {
  const sectionKeys = Object.keys(DEFAULT_SETTINGS);
  const results = await Promise.all(
    sectionKeys.map((key) => getSettingsSection(key))
  );

  const all = {};
  sectionKeys.forEach((key, idx) => {
    all[key] = results[idx];
  });
  return all;
}

/**
 * Update a specific settings section
 */
export async function updateSettingsSection(sectionKey, updates) {
  const docRef = doc(db, "settings", sectionKey);
  const safeUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, safeUpdates, { merge: true });

  // If business profile is updated, synchronize in-memory export cache
  if (sectionKey === "business_profile") {
    syncExportProfile(updates);
  }
}

/**
 * Backward compatibility helpers
 */
export async function getBusinessProfile() {
  return await getSettingsSection("business_profile");
}

export async function updateBusinessProfile(updates) {
  return await updateSettingsSection("business_profile", updates);
}

/**
 * Uploads business logo image to Firebase Storage with a resilient DataURL fallback
 */
export async function uploadBusinessLogo(file) {
  if (!file) throw new Error("No image file provided.");

  if (!file.type.startsWith("image/")) {
    throw new Error("Invalid file type. Please upload a PNG, JPEG, or WebP image.");
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    throw new Error("File size exceeds 5MB limit. Please upload a smaller image.");
  }

  let downloadUrl;

  try {
    // 1. Attempt upload to Firebase Storage
    const ext = file.name.split(".").pop() || "png";
    const storageRef = ref(storage, `branding/logo_${Date.now()}.${ext}`);
    const uploadResult = await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000",
    });
    downloadUrl = await getDownloadURL(uploadResult.ref);
  } catch (storageErr) {
    console.warn("Firebase Storage upload failed or unavailable. Falling back to DataURL encoding:", storageErr);
    // 2. Resilient Base64 DataURL fallback
    downloadUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(new Error("Failed to read image file data", { cause: e }));
      reader.readAsDataURL(file);
    });
  }

  // 3. Persist logo URL in Firestore business profile
  await updateSettingsSection("business_profile", { logoUrl: downloadUrl });

  return { logoUrl: downloadUrl };
}
