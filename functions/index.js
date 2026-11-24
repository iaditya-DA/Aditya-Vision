const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Normalizes Indian mobile number to E.164 format (+91XXXXXXXXXX)
 */
function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+91")) {
    const digits = cleaned.slice(3).replace(/\D/g, "");
    if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  }
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    const d10 = digitsOnly.slice(1);
    if (/^[6-9]\d{9}$/.test(d10)) return `+91${d10}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    const d10 = digitsOnly.slice(2);
    if (/^[6-9]\d{9}$/.test(d10)) return `+91${d10}`;
  }
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }
  return cleaned.startsWith("+") ? cleaned : `+91${digitsOnly}`;
}

/**
 * Extracts pure 10-digit Indian mobile number string
 */
function extract10Digit(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Secure Firebase Cloud Function: provisionStaffUser
 *
 * Requirements:
 * - Caller must be an authenticated Super Admin or have "users.create" permission.
 * - Non-Super Admins cannot create Super Admin accounts.
 * - Validates input fields and uniqueness of email/phone.
 * - Creates Firebase Auth user using Firebase Admin SDK.
 * - Writes user document to Firestore users/{uid}.
 * - Never stores passwords or OTPs in Firestore.
 */
exports.provisionStaffUser = functions.https.onCall(async (data, context) => {
  // 1. Verify caller authentication
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required to provision staff accounts."
    );
  }

  // 2. Verify caller authorization in Firestore
  const callerDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Caller record not found in system."
    );
  }

  const caller = callerDoc.data();
  const isCallerSuperAdmin =
    caller.role === "Super Admin" || caller.roleId === "role_super_admin";
  const callerPerms = Array.isArray(caller.permissions) ? caller.permissions : [];
  const hasCreatePerm =
    isCallerSuperAdmin ||
    callerPerms.includes("users.create") ||
    callerPerms.includes("users");

  if (!hasCreatePerm) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Unauthorized: Only administrators with user provisioning permissions can create staff accounts."
    );
  }

  // 3. Extract and validate request payload
  const {
    name,
    email,
    mobile,
    authMethod = "email", // "email" | "phone" | "both"
    role = "Staff",
    permissions = [],
    password,
    store = "Benipatti Branch",
    status = "Active",
  } = data || {};

  if (!name || name.trim().length < 2) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Employee name must be at least 2 characters."
    );
  }

  if (role === "Super Admin" && !isCallerSuperAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only a Super Admin can create or assign the Super Admin role."
    );
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Please assign at least one module privilege."
    );
  }

  const clean10 = extract10Digit(mobile);
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  const formattedPhone = clean10 ? normalizePhone(clean10) : "";

  // Validate per authentication method
  if (authMethod === "email") {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A valid email address is required for Email + Password authentication."
      );
    }
    if (!password || password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Initial password must be at least 6 characters."
      );
    }
  } else if (authMethod === "phone") {
    if (!clean10 || !/^[6-9]\d{9}$/.test(clean10)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A valid 10-digit Indian mobile number is mandatory for Phone OTP authentication."
      );
    }
  } else if (authMethod === "both") {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Email address is mandatory for dual authentication."
      );
    }
    if (!clean10 || !/^[6-9]\d{9}$/.test(clean10)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A valid 10-digit Indian mobile number is mandatory for dual authentication."
      );
    }
    if (!password || password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Initial password must be at least 6 characters for dual authentication."
      );
    }
  } else {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Unsupported authentication method: "${authMethod}".`
    );
  }

  // 4. Check email and phone uniqueness in Firestore
  if (cleanEmail) {
    const emailSnap = await db
      .collection("users")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();
    if (!emailSnap.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        `An account with email "${cleanEmail}" already exists.`
      );
    }
  }

  if (clean10) {
    const phoneSnap1 = await db
      .collection("users")
      .where("phone", "==", formattedPhone)
      .limit(1)
      .get();
    if (!phoneSnap1.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        `An account with mobile number "${clean10}" already exists.`
      );
    }
    const phoneSnap2 = await db
      .collection("users")
      .where("mobile", "==", clean10)
      .limit(1)
      .get();
    if (!phoneSnap2.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        `An account with mobile number "${clean10}" already exists.`
      );
    }
  }

  // 5. Create user in Firebase Authentication
  let authUserRecord = null;
  try {
    const authPayload = {
      displayName: name.trim(),
    };

    if (authMethod === "email") {
      authPayload.email = cleanEmail;
      authPayload.password = password;
    } else if (authMethod === "phone") {
      authPayload.phoneNumber = formattedPhone;
    } else if (authMethod === "both") {
      authPayload.email = cleanEmail;
      authPayload.password = password;
      authPayload.phoneNumber = formattedPhone;
    }

    authUserRecord = await admin.auth().createUser(authPayload);
  } catch (authErr) {
    console.error("Firebase Auth creation failed:", authErr);
    if (authErr.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "This email is already in use by another Firebase Authentication account."
      );
    }
    if (authErr.code === "auth/phone-number-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "This phone number is already registered in Firebase Authentication."
      );
    }
    throw new functions.https.HttpsError(
      "internal",
      authErr.message || "Failed to create Firebase Auth user."
    );
  }

  // 6. Generate sequential user ID code
  let userCode = "USR-0001";
  try {
    const counterRef = db.collection("counters").doc("user");
    userCode = await db.runTransaction(async (t) => {
      const snap = await t.get(counterRef);
      let nextSeq = 1;
      if (snap.exists) {
        nextSeq = (snap.data().lastSequence || 0) + 1;
      }
      t.set(counterRef, { lastSequence: nextSeq }, { merge: true });
      return `USR-${String(nextSeq).padStart(4, "0")}`;
    });
  } catch (idErr) {
    console.warn("Could not generate sequential code from counter, using timestamp fallback:", idErr);
    userCode = `USR-${Date.now().toString().slice(-4)}`;
  }

  // 7. Write Firestore user profile document
  const authMethods =
    authMethod === "both"
      ? ["email", "phone"]
      : authMethod === "phone"
      ? ["phone"]
      : ["email"];

  try {
    await db.collection("users").doc(authUserRecord.uid).set({
      code: userCode,
      name: name.trim(),
      email: cleanEmail,
      mobile: clean10,
      phone: formattedPhone,
      role: role,
      roleId: role === "Super Admin" ? "role_super_admin" : null,
      permissions: permissions,
      status: status || "Active",
      isActive: (status || "Active") === "Active",
      store: store?.trim() || "Benipatti Branch",
      assignedStore: store?.trim() || "Benipatti Branch",
      authMethods: authMethods,
      joinedDate: new Date().toISOString().split("T")[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      uid: authUserRecord.uid,
      code: userCode,
    };
  } catch (firestoreErr) {
    console.error("Firestore user write failed. Rolling back Firebase Auth user...", firestoreErr);
    try {
      await admin.auth().deleteUser(authUserRecord.uid);
    } catch (delErr) {
      console.error("Auth rollback error:", delErr);
    }
    throw new functions.https.HttpsError(
      "internal",
      `Failed to create Firestore profile: ${firestoreErr.message}`
    );
  }
});
