import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail as fbSendReset,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../config/firebase";

/**
 * Normalizes any phone number input to a pure 10-digit Indian mobile number
 * e.g. "+91 98765 43210" -> "9876543210"
 */
export const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "").slice(-10);
};

/**
 * Backward-compatible alias for 10-digit mobile extraction
 */
export const extract10DigitMobile = normalizePhone;

/**
 * Generates the internal Firebase Email/Password identifier for a mobile number.
 * Mandatory format: `${10DigitMobileNumber}@gmail.com`
 * The user never sees or enters this synthetic identifier.
 */
export const getInternalEmail = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  return `${normalized}@gmail.com`;
};

/**
 * Validates whether the given input is a valid 10-digit Indian mobile number
 * (Starts with 6, 7, 8, or 9 and has exactly 10 digits, with optional +91 or 0 prefix)
 */
export const isValidIndianMobile = (phone) => {
  if (!phone) return false;
  const cleaned = String(phone).trim().replace(/[^\d+]/g, "");
  let digits = cleaned.replace(/\D/g, "");

  if (cleaned.startsWith("+91")) {
    digits = cleaned.slice(3).replace(/\D/g, "");
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
};

/**
 * Normalizes Indian mobile phone numbers to standard E.164 international format (+91XXXXXXXXXX)
 */
export function normalizeIndianPhoneNumber(phone) {
  const d10 = normalizePhone(phone);
  if (/^[6-9]\d{9}$/.test(d10)) {
    return `+91${d10}`;
  }
  const raw = String(phone || "").trim().replace(/[^\d+]/g, "");
  return raw.startsWith("+") ? raw : (d10 ? `+91${d10}` : "");
}

/**
 * Checks whether an email address is a synthetic internal Firebase identifier
 */
export function isSyntheticInternalEmail(email) {
  if (!email) return false;
  return /^[6-9]\d{9}@gmail\.com$/i.test(email.trim());
}

/**
 * Authenticates a user using their Registered Mobile Number (or identifier) and Password.
 * Converts 10-digit mobile numbers to the internal Firebase identifier
 * `${clean10}@gmail.com` and signs in via Firebase Email/Password Authentication.
 */
export async function loginWithPhoneAndPassword(identifier, password) {
  const cleanInput = String(identifier || "").trim();
  if (!cleanInput) {
    throw new Error("Please enter your registered mobile number.");
  }

  if (!password) {
    throw new Error("Please enter your password.");
  }

  const clean10 = normalizePhone(cleanInput);
  let internalEmail = "";

  if (isValidIndianMobile(clean10) || (clean10 && clean10.length === 10)) {
    internalEmail = getInternalEmail(clean10);
  } else if (cleanInput.includes("@")) {
    internalEmail = cleanInput;
  } else {
    // If not a standard 10-digit mobile or email, check if it matches a registered user profile
    try {
      const user = await findUserByPhone(cleanInput);
      if (user?.mobile) {
        internalEmail = getInternalEmail(user.mobile);
      } else if (user?.email) {
        internalEmail = user.email;
      }
    } catch {
      // ignore
    }

    if (!internalEmail) {
      internalEmail = clean10 && clean10.length === 10 ? getInternalEmail(clean10) : `${cleanInput}@gmail.com`;
    }
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, internalEmail, password);
    return cred.user;
  } catch (err) {
    const code = err.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-email"
    ) {
      throw new Error("Incorrect mobile number or password.", { cause: err });
    }
    if (code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Please contact the Super Admin.", { cause: err });
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Too many failed login attempts. Please wait a few minutes before trying again.", { cause: err });
    }
    if (code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection.", { cause: err });
    }
    throw new Error(err.message || "Failed to sign in. Please verify your credentials.", { cause: err });
  }
}

/**
 * Finds user profile in Firestore by 10-digit mobile number or E.164 phone string
 */
export async function findUserByPhone(phone) {
  if (!phone) return null;
  const clean10 = normalizePhone(phone);
  const formatted = normalizeIndianPhoneNumber(phone);

  // 1. Search by 10-digit mobile number
  if (clean10) {
    const qMobile = query(collection(db, "users"), where("mobile", "==", clean10));
    const snapMobile = await getDocs(qMobile);
    if (!snapMobile.empty) {
      const d = snapMobile.docs[0];
      return { id: d.id, ...d.data() };
    }
  }

  // 2. Search by E.164 international format (+91...)
  if (formatted) {
    const qPhone = query(collection(db, "users"), where("phone", "==", formatted));
    const snapPhone = await getDocs(qPhone);
    if (!snapPhone.empty) {
      const d = snapPhone.docs[0];
      return { id: d.id, ...d.data() };
    }
  }

  return null;
}

/**
 * Legacy email-based login helper (maintained for backwards compatibility)
 */
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    const code = err.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-email"
    ) {
      throw new Error("Incorrect email or password.", { cause: err });
    }
    if (code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Contact the administrator.", { cause: err });
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts, try later.", { cause: err });
    }
    if (code === "auth/network-request-failed") {
      throw new Error("No internet connection.", { cause: err });
    }
    throw new Error(err.message || "Failed to sign in.", { cause: err });
  }
}

/**
 * Signs out the currently authenticated user
 */
export async function logoutUser() {
  await fbSignOut(auth);
}

/**
 * Sends a password reset email for real corporate email addresses.
 * Explicitly blocks synthetic internal Gmail identifiers to prevent sending emails to non-existent addresses.
 */
export async function sendUserPasswordReset(email) {
  if (!email) throw new Error("Email address is required.");
  if (isSyntheticInternalEmail(email)) {
    throw new Error(
      "Password reset emails cannot be dispatched to synthetic mobile identifiers. " +
      "Please request a password reset directly from the Super Admin."
    );
  }
  await fbSendReset(auth, email.trim());
}

/**
 * Updates the password of the currently logged-in user
 */
export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No active user session.");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
}

// Deprecated stubs maintained to ensure no breakages in any unmigrated references
export function getOrInitRecaptchaVerifier() { return null; }
export function setupRecaptcha() { return null; }
export function getRecaptchaVerifier() { return null; }
export function clearRecaptcha() {}
export async function sendPhoneOtp() {
  throw new Error("SMS OTP authentication has been deprecated in favor of Phone + Password authentication.");
}
export async function verifyPhoneOtp() {
  throw new Error("SMS OTP authentication has been deprecated in favor of Phone + Password authentication.");
}
export async function linkUserPhoneNumber() {
  throw new Error("Phone linking is no longer required with unified Phone + Password authentication.");
}
