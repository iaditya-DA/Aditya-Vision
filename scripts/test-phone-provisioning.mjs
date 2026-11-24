/**
 * Automated Test Suite: Phone Number-Based Staff Account Provisioning
 * Tests all 12 core scenarios specified in the requirements.
 */

import assert from "node:assert";

// 1. Pure Helper Functions (matching src/services/authService.js)
function normalizeIndianPhoneNumber(phone) {
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

function extract10DigitMobile(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isValidIndianMobile(phone) {
  const d10 = extract10DigitMobile(phone);
  return /^[6-9]\d{9}$/.test(d10);
}

// 2. Simulated In-Memory Database for User Profiles
const mockFirestoreUsers = new Map();

function checkEmailExists(email, excludeUid = null) {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  for (const [uid, user] of mockFirestoreUsers.entries()) {
    if (excludeUid && uid === excludeUid) continue;
    if (user.email && user.email.toLowerCase() === clean) return true;
  }
  return false;
}

function checkPhoneExists(mobile, excludeUid = null) {
  if (!mobile) return false;
  const clean10 = extract10DigitMobile(mobile);
  const formatted = normalizeIndianPhoneNumber(mobile);
  for (const [uid, user] of mockFirestoreUsers.entries()) {
    if (excludeUid && uid === excludeUid) continue;
    if (user.mobile && user.mobile === clean10) return true;
    if (user.phone && user.phone === formatted) return true;
  }
  return false;
}

function findUserByPhone(mobile) {
  const clean10 = extract10DigitMobile(mobile);
  const formatted = normalizeIndianPhoneNumber(mobile);
  for (const [uid, user] of mockFirestoreUsers.entries()) {
    if (user.phone === formatted || user.mobile === clean10) {
      return { id: uid, ...user };
    }
  }
  return null;
}

// 3. Simulated Staff Provisioning Service (matching src/services/userService.js)
function validateAndProvisionStaffUser(
  {
    name,
    email,
    mobile,
    authMethod = "email",
    role = "Staff",
    permissions = [],
    password,
    store = "Benipatti Branch",
    status = "Active",
  },
  callerUser = null
) {
  // Authorization check
  const isCallerSuperAdmin =
    callerUser?.role === "Super Admin" || callerUser?.roleId === "role_super_admin";
  const callerPerms = Array.isArray(callerUser?.permissions) ? callerUser.permissions : [];
  const canCreate =
    isCallerSuperAdmin ||
    callerPerms.includes("users.create") ||
    callerPerms.includes("users");

  if (callerUser && !canCreate) {
    throw new Error("Unauthorized: Only administrators with user provisioning privileges can create staff accounts.");
  }

  if (role === "Super Admin" && !isCallerSuperAdmin) {
    throw new Error("Only a Super Admin can create or assign the Super Admin role.");
  }

  if (!name || name.trim().length < 2) {
    throw new Error("Full employee name must be at least 2 characters.");
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error("Please assign at least one module privilege for this staff account.");
  }

  const clean10 = extract10DigitMobile(mobile);
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  const formattedPhone = clean10 ? normalizeIndianPhoneNumber(mobile) : "";

  // AuthMethod specific validations
  if (authMethod === "email") {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("A valid email address is required for Email + Password authentication.");
    }
    if (!password || password.length < 6) {
      throw new Error("Initial password must be at least 6 characters.");
    }
    if (mobile && !isValidIndianMobile(mobile)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }
  } else if (authMethod === "phone") {
    if (!clean10 || !isValidIndianMobile(mobile)) {
      throw new Error("A valid 10-digit Indian mobile number is mandatory for Phone OTP authentication.");
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Optional email address is not properly formatted.");
    }
  } else if (authMethod === "both") {
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Email address is mandatory for dual authentication.");
    }
    if (!clean10 || !isValidIndianMobile(mobile)) {
      throw new Error("A valid 10-digit Indian mobile number is mandatory for dual authentication.");
    }
    if (!password || password.length < 6) {
      throw new Error("Initial password must be at least 6 characters for dual authentication.");
    }
  } else {
    throw new Error(`Unsupported authentication method: "${authMethod}".`);
  }

  // Uniqueness verification
  if (cleanEmail && checkEmailExists(cleanEmail)) {
    throw new Error(`An account with email "${cleanEmail}" already exists in the system.`);
  }

  if (clean10 && checkPhoneExists(clean10)) {
    throw new Error(`An account with mobile number "${clean10}" already exists in the system.`);
  }

  const authMethods =
    authMethod === "both"
      ? ["email", "phone"]
      : authMethod === "phone"
      ? ["phone"]
      : ["email"];

  const uid = `uid_${Math.random().toString(36).substring(2, 9)}`;
  const userProfile = {
    code: `USR-${String(mockFirestoreUsers.size + 1).padStart(4, "0")}`,
    name: name.trim(),
    email: cleanEmail,
    mobile: clean10,
    phone: formattedPhone,
    role,
    roleId: role === "Super Admin" ? "role_super_admin" : null,
    permissions,
    status: status || "Active",
    isActive: (status || "Active") === "Active",
    store: store.trim(),
    assignedStore: store.trim(),
    authMethods,
    joinedDate: new Date().toISOString().split("T")[0],
  };

  mockFirestoreUsers.set(uid, userProfile);
  return { id: uid, ...userProfile };
}

// 4. Simulated Phone Login & Verification Service
function simulatePhoneOtpVerification(confirmationResult, otpCode) {
  if (!confirmationResult || confirmationResult.expired) {
    throw new Error("The OTP has expired. Please click 'Resend OTP' to receive a new code.");
  }
  if (!otpCode || otpCode.trim().length !== 6 || !/^\d{6}$/.test(otpCode)) {
    throw new Error("Please enter a valid 6-digit verification code.");
  }
  if (otpCode !== confirmationResult.expectedOtp) {
    throw new Error("Incorrect OTP. Please enter the valid 6-digit code received on your phone.");
  }
  return { uid: confirmationResult.authUid, phoneNumber: confirmationResult.phoneNumber };
}

// Simulated AuthContext Login Session Resolver
function simulateAuthContextResolution(fbUser) {
  // 1. Direct lookup by UID
  let userData = mockFirestoreUsers.get(fbUser.uid);

  // 2. If not found by UID, check phone lookup (account linking)
  if (!userData && fbUser.phoneNumber) {
    const found = findUserByPhone(fbUser.phoneNumber);
    if (found) {
      userData = { ...found };
      // Link to fbUser.uid
      mockFirestoreUsers.set(fbUser.uid, {
        ...userData,
        linkedAuthUids: [...(userData.linkedAuthUids || []), fbUser.uid, found.id],
      });
    }
  }

  if (!userData) {
    return {
      authenticated: false,
      error: "Account not registered in the system. Contact the administrator.",
    };
  }

  if (userData.status === "Inactive" || userData.isActive === false) {
    return {
      authenticated: false,
      error: "Account deactivated. Contact the administrator.",
    };
  }

  return {
    authenticated: true,
    user: userData,
    redirectUrl: "/dashboard",
  };
}

// ==========================================
// TEST EXECUTION
// ==========================================

console.log("===============================================================");
console.log("RUNNING PHONE NUMBER-BASED STAFF PROVISIONING TEST SUITE");
console.log("===============================================================");

let totalPassed = 0;
let totalFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    totalFailed++;
  }
}

const superAdminCaller = {
  id: "admin_1",
  role: "Super Admin",
  roleId: "role_super_admin",
  permissions: ["dashboard.view", "users.create", "users.view"],
};

const standardStaffCaller = {
  id: "staff_1",
  role: "Staff",
  permissions: ["dashboard.view", "deliveries.view"],
};

// Reset database before tests
mockFirestoreUsers.clear();

// SCENARIO 1: Phone number normalization and extraction
runTest("Scenario 1: Indian Phone Number Normalization & Validation", () => {
  assert.strictEqual(normalizeIndianPhoneNumber("9876543210"), "+919876543210");
  assert.strictEqual(normalizeIndianPhoneNumber("+91 98765 43210"), "+919876543210");
  assert.strictEqual(normalizeIndianPhoneNumber("09876543210"), "+919876543210");
  assert.strictEqual(normalizeIndianPhoneNumber("919876543210"), "+919876543210");
  assert.strictEqual(extract10DigitMobile("+919876543210"), "9876543210");
  assert.strictEqual(isValidIndianMobile("9876543210"), true);
  assert.strictEqual(isValidIndianMobile("5876543210"), false); // Indian mobiles start with 6, 7, 8, or 9
  assert.strictEqual(isValidIndianMobile("12345"), false);
});

// SCENARIO 2: Create a staff account using Email + Password
runTest("Scenario 2: Create Staff Account with Email + Password", () => {
  const result = validateAndProvisionStaffUser(
    {
      name: "Ramesh Sharma",
      email: "ramesh.sharma@adityavision.com",
      mobile: "9876543210",
      authMethod: "email",
      role: "Staff",
      permissions: ["dashboard.view", "deliveries.view"],
      password: "password123",
      store: "Benipatti Branch",
      status: "Active",
    },
    superAdminCaller
  );

  assert.ok(result.id);
  assert.strictEqual(result.email, "ramesh.sharma@adityavision.com");
  assert.deepStrictEqual(result.authMethods, ["email"]);
  assert.strictEqual(result.status, "Active");
  assert.strictEqual(result.isActive, true);
  assert.strictEqual(result.phone, "+919876543210");
});

// SCENARIO 3: Create a staff account using Phone + OTP (no password asked, email optional)
runTest("Scenario 3: Create Staff Account with Phone Number + OTP", () => {
  const result = validateAndProvisionStaffUser(
    {
      name: "Suresh Kumar",
      mobile: "9876543211",
      authMethod: "phone",
      role: "Dispatcher",
      permissions: ["dashboard.view", "deliveries.view", "deliveries.create"],
      // no password provided!
      store: "Benipatti Branch",
      status: "Active",
    },
    superAdminCaller
  );

  assert.ok(result.id);
  assert.strictEqual(result.mobile, "9876543211");
  assert.strictEqual(result.phone, "+919876543211");
  assert.strictEqual(result.email, ""); // email was optional
  assert.deepStrictEqual(result.authMethods, ["phone"]);
  assert.strictEqual(result.role, "Dispatcher");
});

// SCENARIO 4: Create an account supporting both methods (Email + Password AND Phone + OTP)
runTest("Scenario 4: Create Staff Account with Dual Authentication (Both)", () => {
  const result = validateAndProvisionStaffUser(
    {
      name: "Anita Verma",
      email: "anita.verma@adityavision.com",
      mobile: "9876543212",
      authMethod: "both",
      role: "Accountant",
      permissions: ["dashboard.view", "payments.view"],
      password: "securePassword456",
      store: "Benipatti Branch",
      status: "Active",
    },
    superAdminCaller
  );

  assert.ok(result.id);
  assert.strictEqual(result.email, "anita.verma@adityavision.com");
  assert.strictEqual(result.mobile, "9876543212");
  assert.deepStrictEqual(result.authMethods, ["email", "phone"]);
});

// SCENARIO 5: Login using existing Email/Gmail credentials
runTest("Scenario 5: Login with Existing Email Credentials", () => {
  const existingUser = findUserByPhone("9876543210"); // Ramesh from Scenario 2
  assert.ok(existingUser);
  const session = simulateAuthContextResolution({
    uid: existingUser.id,
    email: existingUser.email,
  });

  assert.strictEqual(session.authenticated, true);
  assert.strictEqual(session.user.name, "Ramesh Sharma");
  assert.strictEqual(session.redirectUrl, "/dashboard");
});

// SCENARIO 6: Login using Phone OTP
runTest("Scenario 6: Login with Phone OTP Verification", () => {
  const phoneUser = findUserByPhone("9876543211"); // Suresh from Scenario 3
  assert.ok(phoneUser);

  const confirmation = {
    authUid: phoneUser.id,
    phoneNumber: "+919876543211",
    expectedOtp: "654321",
    expired: false,
  };

  const verifiedUser = simulatePhoneOtpVerification(confirmation, "654321");
  assert.strictEqual(verifiedUser.phoneNumber, "+919876543211");

  const session = simulateAuthContextResolution(verifiedUser);
  assert.strictEqual(session.authenticated, true);
  assert.strictEqual(session.user.role, "Dispatcher");
});

// SCENARIO 7: Verify that both methods access the same account when linked
runTest("Scenario 7: Both Authentication Methods Access Same User Record", () => {
  const dualUser = findUserByPhone("9876543212"); // Anita from Scenario 4
  assert.ok(dualUser);

  // Login via email UID
  const emailSession = simulateAuthContextResolution({
    uid: dualUser.id,
    email: dualUser.email,
  });
  assert.strictEqual(emailSession.authenticated, true);
  assert.strictEqual(emailSession.user.code, dualUser.code);

  // Login via Phone OTP with a newly generated Phone Auth UID
  const newPhoneAuthUid = "firebase_phone_uid_999";
  const phoneSession = simulateAuthContextResolution({
    uid: newPhoneAuthUid,
    phoneNumber: "+919876543212",
  });
  assert.strictEqual(phoneSession.authenticated, true);
  // Must link and resolve to the exact same employee record and code
  assert.strictEqual(phoneSession.user.code, dualUser.code);
  assert.strictEqual(phoneSession.user.name, dualUser.name);
});

// SCENARIO 8: Reject incorrect OTP and expired OTP
runTest("Scenario 8: Reject Incorrect OTP and Expired OTP", () => {
  const confirmation = {
    authUid: "some_uid",
    phoneNumber: "+919876543211",
    expectedOtp: "123456",
    expired: false,
  };

  // 1. Wrong OTP
  assert.throws(
    () => simulatePhoneOtpVerification(confirmation, "999999"),
    /Incorrect OTP/
  );

  // 2. Malformed OTP length
  assert.throws(
    () => simulatePhoneOtpVerification(confirmation, "123"),
    /valid 6-digit verification code/
  );

  // 3. Expired OTP
  const expiredConfirmation = { ...confirmation, expired: true };
  assert.throws(
    () => simulatePhoneOtpVerification(expiredConfirmation, "123456"),
    /The OTP has expired/
  );
});

// SCENARIO 9: Reject unregistered phone numbers
runTest("Scenario 9: Reject Unregistered Phone Numbers", () => {
  const unregistered = findUserByPhone("9999999999");
  assert.strictEqual(unregistered, null);

  const session = simulateAuthContextResolution({
    uid: "random_uid_unregistered",
    phoneNumber: "+919999999999",
  });
  assert.strictEqual(session.authenticated, false);
  assert.match(session.error, /Account not registered/);
});

// SCENARIO 10: Prevent duplicate phone and email registration
runTest("Scenario 10: Prevent Duplicate Phone & Email Registration", () => {
  // Duplicate email
  assert.throws(
    () =>
      validateAndProvisionStaffUser(
        {
          name: "Duplicate Email User",
          email: "ramesh.sharma@adityavision.com", // already registered in Scenario 2
          mobile: "9876543299",
          authMethod: "email",
          role: "Staff",
          permissions: ["dashboard.view"],
          password: "password123",
        },
        superAdminCaller
      ),
    /already exists/
  );

  // Duplicate mobile
  assert.throws(
    () =>
      validateAndProvisionStaffUser(
        {
          name: "Duplicate Mobile User",
          email: "unique@adityavision.com",
          mobile: "9876543210", // already registered in Scenario 2
          authMethod: "phone",
          role: "Staff",
          permissions: ["dashboard.view"],
        },
        superAdminCaller
      ),
    /already exists/
  );
});

// SCENARIO 11: Prevent inactive users from accessing dashboard
runTest("Scenario 11: Prevent Inactive Users From Accessing Dashboard", () => {
  // Provision an inactive staff member
  const inactiveUser = validateAndProvisionStaffUser(
    {
      name: "Deactivated Staff",
      email: "deactivated@adityavision.com",
      mobile: "9876543215",
      authMethod: "both",
      role: "Staff",
      permissions: ["dashboard.view"],
      password: "password123",
      status: "Inactive",
    },
    superAdminCaller
  );

  assert.strictEqual(inactiveUser.status, "Inactive");
  assert.strictEqual(inactiveUser.isActive, false);

  // Attempt login via email UID
  const sessionEmail = simulateAuthContextResolution({
    uid: inactiveUser.id,
    email: inactiveUser.email,
  });
  assert.strictEqual(sessionEmail.authenticated, false);
  assert.match(sessionEmail.error, /Account deactivated/);

  // Attempt login via Phone OTP
  const sessionPhone = simulateAuthContextResolution({
    uid: "phone_auth_uid_inactive",
    phoneNumber: "+919876543215",
  });
  assert.strictEqual(sessionPhone.authenticated, false);
  assert.match(sessionPhone.error, /Account deactivated/);
});

// SCENARIO 12: Verify role-based authorization & non-admin blocking
runTest("Scenario 12: Non-Admin Users Cannot Provision Accounts", () => {
  // Ordinary staff cannot create accounts
  assert.throws(
    () =>
      validateAndProvisionStaffUser(
        {
          name: "Hacker Attempt",
          email: "hacker@adityavision.com",
          mobile: "9876543219",
          authMethod: "email",
          role: "Staff",
          permissions: ["dashboard.view"],
          password: "password123",
        },
        standardStaffCaller // not Super Admin, lacks users.create
      ),
    /Unauthorized/
  );

  // Non-super-admin cannot create Super Admin role
  const dispatcherCaller = {
    id: "disp_1",
    role: "Dispatcher",
    permissions: ["dashboard.view", "users.create"], // has users.create, but NOT Super Admin
  };

  assert.throws(
    () =>
      validateAndProvisionStaffUser(
        {
          name: "Elevated Admin",
          email: "elevated@adityavision.com",
          mobile: "9876543218",
          authMethod: "email",
          role: "Super Admin", // attempted escalation
          permissions: ["dashboard.view"],
          password: "password123",
        },
        dispatcherCaller
      ),
    /Only a Super Admin can create or assign the Super Admin role/
  );
});

// =====================================================================
// SIMULATED RECAPTCHA & PHONE AUTH LIFECYCLE HARNESS (Matching authService.js + Login.jsx)
// =====================================================================

// Simulated DOM Node
class MockElement {
  constructor(id) {
    this.id = id;
    this.childNodes = [];
    this.innerHTML = "";
    this._renderedWidgets = new Set();
  }

  appendChild(child) {
    this.childNodes.push(child);
    this.innerHTML += "<div>[widget]</div>";
  }

  removeChild(child) {
    this.childNodes = this.childNodes.filter((c) => c !== child);
    if (this.childNodes.length === 0) this.innerHTML = "";
  }
}

// Simulated Document Environment
const mockDocument = {
  elements: new Map(),
  body: {
    contains(el) {
      if (!el) return false;
      return mockDocument.elements.has(el.id);
    },
  },
  getElementById(id) {
    return mockDocument.elements.get(id) || null;
  },
  createElement(tag) {
    return new MockElement(`mock_${tag}_${Math.random().toString(36).slice(2, 6)}`);
  },
};

// Simulated Google reCAPTCHA / Firebase RecaptchaVerifier
let globalSimulatedVerifier = null;

class MockFirebaseRecaptchaVerifier {
  constructor(authInstance, containerOrId, parameters = {}) {
    this.auth = authInstance;
    this.parameters = parameters;
    this.type = "recaptcha";
    this.destroyed = false;
    this.isInvisible = parameters.size === "invisible";

    const container =
      typeof containerOrId === "string"
        ? mockDocument.getElementById(containerOrId)
        : containerOrId;

    if (!container) {
      throw new Error(`reCAPTCHA container with DOM id "${containerOrId}" was not found.`);
    }

    // Google reCAPTCHA throws if rendered on an element that is already rendered and not cleared
    if (container.childNodes.length > 0 && container._renderedWidgets.size > 0) {
      throw new Error("reCAPTCHA has already been rendered in this element");
    }

    this.container = container;
    this.widgetId = Math.floor(Math.random() * 100000);
    this.container._renderedWidgets.add(this.widgetId);
    this.container.appendChild({ id: `recaptcha_widget_${this.widgetId}` });
  }

  verify() {
    if (this.destroyed) throw new Error("Verifier is destroyed");
    return Promise.resolve("mock_recaptcha_token_xyz");
  }

  clear() {
    if (this.destroyed) throw new Error("Verifier is already destroyed");
    this.destroyed = true;
    if (this.container) {
      this.container._renderedWidgets.delete(this.widgetId);
      // NOTE: Firebase SDK internally does NOT remove invisible child nodes,
      // which is why clearRecaptcha explicitly resets container.innerHTML = ""
    }
  }
}

// Mirroring src/services/authService.js
function testGetOrInitRecaptchaVerifier(containerId = "login-recaptcha-container", options = {}) {
  const container =
    typeof containerId === "string"
      ? mockDocument.getElementById(containerId)
      : containerId;

  if (!container) {
    throw new Error(`reCAPTCHA container with DOM id "${containerId}" was not found.`);
  }

  // 1. If an active, non-destroyed verifier already exists for this container, reuse it directly
  if (
    globalSimulatedVerifier &&
    !globalSimulatedVerifier.destroyed &&
    globalSimulatedVerifier.container === container &&
    mockDocument.body.contains(container)
  ) {
    return globalSimulatedVerifier;
  }

  // 2. Clear any stale instance before initializing
  testClearRecaptcha(containerId);

  // 3. Ensure container DOM children are cleared before creating new verifier
  container.innerHTML = "";
  container.childNodes = [];
  container._renderedWidgets.clear();

  globalSimulatedVerifier = new MockFirebaseRecaptchaVerifier(null, containerId, {
    size: "invisible",
    ...options,
  });

  return globalSimulatedVerifier;
}

function testClearRecaptcha(containerId = null) {
  if (globalSimulatedVerifier) {
    try {
      if (!globalSimulatedVerifier.destroyed) {
        globalSimulatedVerifier.clear();
      }
    } catch {
      // ignore
    }
    globalSimulatedVerifier = null;
  }

  const target = containerId
    ? (typeof containerId === "string" ? mockDocument.getElementById(containerId) : containerId)
    : mockDocument.getElementById("login-recaptcha-container");

  if (target) {
    target.innerHTML = "";
    target.childNodes = [];
    target._renderedWidgets.clear();
  }
}

// SCENARIO 13: First OTP Request - Clean Initialization
runTest("Scenario 13: First OTP Request - Clean Verifier Initialization", () => {
  // Set up container in DOM
  const container = new MockElement("login-recaptcha-container");
  mockDocument.elements.set("login-recaptcha-container", container);

  testClearRecaptcha("login-recaptcha-container");
  assert.strictEqual(globalSimulatedVerifier, null);

  const verifier = testGetOrInitRecaptchaVerifier("login-recaptcha-container");
  assert.ok(verifier, "Verifier must be created");
  assert.strictEqual(verifier.destroyed, false);
  assert.strictEqual(verifier.container, container);
  assert.strictEqual(container.childNodes.length, 1);
});

// SCENARIO 14: OTP Resend - Reuses Active Verifier Without Re-render Collision
runTest("Scenario 14: OTP Resend - Reuses Existing Verifier Instance (Zero Collisions)", () => {
  const container = mockDocument.getElementById("login-recaptcha-container");
  assert.ok(container, "Container should exist from Scenario 13");

  const initialVerifier = globalSimulatedVerifier;
  assert.ok(initialVerifier, "Existing verifier should be active");

  // Simulate user waiting for 30s cooldown and clicking 'Resend OTP'
  // Instead of calling new RecaptchaVerifier, getOrInitRecaptchaVerifier is called
  const resendVerifier = testGetOrInitRecaptchaVerifier("login-recaptcha-container");

  // Must return the exact same instance without throwing "reCAPTCHA has already been rendered"
  assert.strictEqual(resendVerifier, initialVerifier, "Verifier instance must be reused on resend");
  assert.strictEqual(container._renderedWidgets.size, 1, "Only one widget should be rendered");
});

// SCENARIO 15: Multiple Rapid Clicks - Atomic Lock Prevents Duplicate Dispatches
runTest("Scenario 15: Rapid Button Clicks - Prevent Duplicate In-Flight OTP Dispatches", async () => {
  let isSendingOtp = false;
  let dispatchCallCount = 0;

  async function simulatedHandleSendOtp() {
    // Atomic synchronous lock (matches isSendingOtpRef.current in Login.jsx)
    if (isSendingOtp) {
      return { status: "ignored_duplicate_click" };
    }
    isSendingOtp = true;
    try {
      dispatchCallCount++;
      // Simulate network latency for SMS API
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { status: "dispatched" };
    } finally {
      isSendingOtp = false;
    }
  }

  // Fire 5 rapid clicks concurrently
  const promises = [
    simulatedHandleSendOtp(),
    simulatedHandleSendOtp(),
    simulatedHandleSendOtp(),
    simulatedHandleSendOtp(),
    simulatedHandleSendOtp(),
  ];

  const results = await Promise.all(promises);

  const dispatched = results.filter((r) => r.status === "dispatched");
  const ignored = results.filter((r) => r.status === "ignored_duplicate_click");

  assert.strictEqual(dispatched.length, 1, "Exactly one OTP dispatch should succeed");
  assert.strictEqual(ignored.length, 4, "Four rapid double-clicks must be safely dropped");
  assert.strictEqual(dispatchCallCount, 1, "Underlying SMS API must only be called once");
});

// SCENARIO 16: React Strict Mode & Component Unmount / Remount Lifecycle
runTest("Scenario 16: React Strict Mode & Component Unmount/Remount Cleanup", () => {
  const container = mockDocument.getElementById("login-recaptcha-container");

  // Step 1: Active verifier exists
  let componentVerifierRef = testGetOrInitRecaptchaVerifier("login-recaptcha-container");
  assert.ok(componentVerifierRef);
  assert.strictEqual(componentVerifierRef.destroyed, false);

  // Step 2: Component unmounts (React Strict Mode unmount phase)
  // useEffect cleanup runs
  if (componentVerifierRef) {
    componentVerifierRef.clear();
    componentVerifierRef = null;
  }
  testClearRecaptcha("login-recaptcha-container");

  assert.strictEqual(componentVerifierRef, null);
  assert.strictEqual(globalSimulatedVerifier, null);
  assert.strictEqual(container.childNodes.length, 0);
  assert.strictEqual(container._renderedWidgets.size, 0);

  // Step 3: Component remounts (React Strict Mode remount phase)
  // Fresh verifier initialized on clean container without error
  let remountVerifierRef = testGetOrInitRecaptchaVerifier("login-recaptcha-container");
  assert.ok(remountVerifierRef);
  assert.strictEqual(remountVerifierRef.destroyed, false);
  assert.strictEqual(remountVerifierRef.container, container);
  assert.strictEqual(container._renderedWidgets.size, 1);
});

// SCENARIO 17: Invalid OTP Code Handling
runTest("Scenario 17: Invalid OTP Code Handling & Rejection", () => {
  const activeConfirmation = {
    authUid: "uid_valid_user",
    phoneNumber: "+919876543210",
    expectedOtp: "456789",
    expired: false,
  };

  // Less than 6 digits
  assert.throws(
    () => simulatePhoneOtpVerification(activeConfirmation, "12345"),
    /valid 6-digit/
  );

  // Non-digit characters
  assert.throws(
    () => simulatePhoneOtpVerification(activeConfirmation, "12a456"),
    /valid 6-digit/
  );

  // Incorrect 6-digit OTP
  assert.throws(
    () => simulatePhoneOtpVerification(activeConfirmation, "000000"),
    /Incorrect OTP/
  );

  // Expired session
  const expiredConfirmation = { ...activeConfirmation, expired: true };
  assert.throws(
    () => simulatePhoneOtpVerification(expiredConfirmation, "456789"),
    /expired/
  );
});

// SCENARIO 18: Successful OTP Verification & Staff Session Creation
runTest("Scenario 18: Successful OTP Verification & Staff Session Authentication", () => {
  const activeConfirmation = {
    authUid: "uid_scenario_18_user",
    phoneNumber: "+919876543210",
    expectedOtp: "654321",
    expired: false,
  };

  // Verify OTP
  const verifiedResult = simulatePhoneOtpVerification(activeConfirmation, "654321");
  assert.strictEqual(verifiedResult.uid, "uid_scenario_18_user");
  assert.strictEqual(verifiedResult.phoneNumber, "+919876543210");

  // Authenticate session via AuthContext resolver
  const session = simulateAuthContextResolution(verifiedResult);
  assert.strictEqual(session.authenticated, true);
  assert.strictEqual(session.user.mobile, "9876543210");
  assert.strictEqual(session.redirectUrl, "/dashboard");
});

console.log("===============================================================");
console.log(`TEST SUITE COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log("===============================================================");

if (totalFailed > 0) {
  process.exit(1);
}
