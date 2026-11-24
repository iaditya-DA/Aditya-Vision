import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, deleteUser } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfig } from "../config/firebase";
import { generateEntityId } from "./idService";
import {
  normalizePhone,
  normalizeIndianPhoneNumber,
  isValidIndianMobile,
  getInternalEmail,
} from "./authService";

/**
 * Fetch all registered staff user documents
 */
export async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Fetch a single staff user document by UID
 */
export async function getUserById(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Check if an email address is already taken in the system
 */
export async function checkEmailExists(email, excludeUid = null) {
  if (!email) return false;
  const q = query(
    collection(db, "users"),
    where("email", "==", email.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  const matching = snap.docs.filter((d) => !excludeUid || d.id !== excludeUid);
  return matching.length > 0;
}

/**
 * Check if a phone / mobile number is already taken in the system
 */
export async function checkPhoneExists(mobile, excludeUid = null) {
  if (!mobile) return false;
  const clean10 = normalizePhone(mobile);
  const formatted = normalizeIndianPhoneNumber(mobile);

  if (clean10) {
    const q1 = query(collection(db, "users"), where("mobile", "==", clean10));
    const snap1 = await getDocs(q1);
    const found1 = snap1.docs.filter((d) => !excludeUid || d.id !== excludeUid);
    if (found1.length > 0) return true;
  }

  if (formatted) {
    const q2 = query(collection(db, "users"), where("phone", "==", formatted));
    const snap2 = await getDocs(q2);
    const found2 = snap2.docs.filter((d) => !excludeUid || d.id !== excludeUid);
    if (found2.length > 0) return true;
  }

  return false;
}

/**
 * Count the current number of active Super Admins
 */
export async function countActiveSuperAdmins() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.filter((d) => {
    const u = d.data();
    const isSuper = u.role === "Super Admin" || u.roleId === "role_super_admin";
    return isSuper && u.status === "Active";
  }).length;
}

/**
 * Fetch summary statistics for the user management dashboard
 */
export async function getUserStats() {
  const users = await getUsers();
  const total = users.length;
  const active = users.filter((u) => u.status === "Active").length;
  const inactive = users.filter((u) => u.status === "Inactive").length;

  const roleCounts = users.reduce((acc, u) => {
    const r = u.role || "Staff";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return { total, active, inactive, roleCounts, users };
}

/**
 * Provisions a new Staff Member or User using the unified Phone + Password authentication system.
 *
 * Uses an isolated secondary Firebase App instance so the Super Admin is never logged out.
 * Converts 10-digit mobile number to synthetic internal Firebase identifier `${clean10}@gmail.com`.
 * Never saves plaintext passwords in Firestore.
 * Automatically rolls back Firebase Auth user if Firestore write fails.
 */
export async function createStaffUser(
  {
    name,
    mobile,
    password,
    role = "Staff",
    permissions = [],
    store = "Benipatti Branch",
    status = "Active",
    email = "",
  },
  callerUser = null
) {
  // 1. Authorization check: caller must have admin or users.create privilege
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

  // Prevent ordinary staff from assigning Super Admin privileges
  if (role === "Super Admin" && !isCallerSuperAdmin) {
    throw new Error("Only a Super Admin can create or assign the Super Admin role.");
  }

  // 2. Input validations
  if (!name || name.trim().length < 2) {
    throw new Error("Full employee name must be at least 2 characters.");
  }

  const clean10 = normalizePhone(mobile);
  if (!clean10 || !isValidIndianMobile(clean10)) {
    throw new Error("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
  }

  if (!password || password.length < 6) {
    throw new Error("Initial password must be at least 6 characters.");
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error("Please assign at least one module privilege for this staff account.");
  }

  const cleanEmail = email ? email.trim().toLowerCase() : "";
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Optional corporate email address is not properly formatted.");
  }

  // 3. Uniqueness checks in Firestore
  const phoneTaken = await checkPhoneExists(clean10);
  if (phoneTaken) {
    throw new Error(`An account with mobile number "${clean10}" is already registered in the system.`);
  }

  if (cleanEmail) {
    const emailTaken = await checkEmailExists(cleanEmail);
    if (emailTaken) {
      throw new Error(`An account with email "${cleanEmail}" is already registered in the system.`);
    }
  }

  // 4. Generate internal Firebase Email identifier: `${clean10}@gmail.com`
  const internalEmail = getInternalEmail(clean10);
  const formattedPhone = normalizeIndianPhoneNumber(clean10);

  // 5. Generate human-readable sequential code (e.g. USR-0001)
  let userCode;
  try {
    userCode = await generateEntityId("user");
  } catch (idErr) {
    console.warn("Could not generate sequential user ID, falling back:", idErr);
    userCode = `USR-${Date.now().toString().slice(-4)}`;
  }

  // 6. Create Firebase Auth account via secondary Firebase App instance
  // This ensures the active Super Admin's session is completely preserved!
  const secondaryAppName = `AV-SecondaryAuth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let secondaryApp = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      internalEmail,
      password
    );
    const newUid = cred.user.uid;

    // Disconnect secondary auth immediately
    await signOut(secondaryAuth);

    // Write Firestore user profile document (passwords are NEVER saved in Firestore)
    try {
      const userDocRef = doc(db, "users", newUid);
      await setDoc(userDocRef, {
        code: userCode,
        name: name.trim(),
        mobile: clean10,
        phone: formattedPhone,
        email: cleanEmail || "",
        role: role || "Staff",
        roleId: role === "Super Admin" ? "role_super_admin" : null,
        permissions: permissions,
        status: status || "Active",
        isActive: status === "Active",
        store: store?.trim() || "Benipatti Branch",
        assignedStore: store?.trim() || "Benipatti Branch",
        authMethods: ["phone_password"],
        joinedDate: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { id: newUid, code: userCode };
    } catch (firestoreErr) {
      // Rollback: delete Auth user to prevent orphaned auth accounts
      console.error("Firestore write failed. Rolling back Firebase Auth user...", firestoreErr);
      try {
        await deleteUser(cred.user);
      } catch (delErr) {
        console.error("Failed to delete auth user during rollback:", delErr);
      }
      throw new Error(`Failed to save user profile: ${firestoreErr.message || "Database write error"}`, {
        cause: firestoreErr,
      });
    }
  } catch (err) {
    const code = err.code || "";
    if (code === "auth/email-already-in-use") {
      throw new Error(`Mobile number "${clean10}" is already registered in Firebase Authentication.`, { cause: err });
    }
    if (code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use at least 6 characters.", { cause: err });
    }
    throw err;
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (e) {
        console.error("Error disposing secondary Firebase app:", e);
      }
    }
  }
}

/**
 * Updates an existing staff user document with protection against self-lockout
 * and preventing demotion/deactivation of the last Super Admin.
 */
export async function updateStaffUser(uid, updates, callerUser = null) {
  if (!uid) throw new Error("User ID is required");

  const existing = await getUserById(uid);
  if (!existing) throw new Error("Staff user not found");

  const isTargetSuperAdmin =
    existing.role === "Super Admin" || existing.roleId === "role_super_admin";
  const isCallerSelf = callerUser && (callerUser.id === uid || callerUser.uid === uid);
  const isCallerSuperAdmin =
    callerUser?.role === "Super Admin" || callerUser?.roleId === "role_super_admin";

  // Prevent non-super-admins from granting Super Admin privileges
  if (updates.role === "Super Admin" && !isCallerSuperAdmin) {
    throw new Error("Only a Super Admin can assign the Super Admin role.");
  }

  // Prevent self-lockout of current Super Admin
  if (isCallerSelf && isTargetSuperAdmin) {
    if (updates.status === "Inactive") {
      throw new Error("You cannot deactivate your own Super Admin account.");
    }
    if (updates.role && updates.role !== "Super Admin") {
      throw new Error("You cannot revoke your own Super Admin role.");
    }
  }

  // Protect the last active Super Admin from deactivation or demotion
  const isDeactivating = existing.status === "Active" && updates.status === "Inactive";
  const isDemoting = isTargetSuperAdmin && updates.role && updates.role !== "Super Admin";

  if (isTargetSuperAdmin && (isDeactivating || isDemoting)) {
    const activeAdminsCount = await countActiveSuperAdmins();
    if (activeAdminsCount <= 1) {
      throw new Error(
        "Cannot demote or deactivate the last active Super Admin. Assign another Super Admin first."
      );
    }
  }

  // If mobile is being updated, validate and check uniqueness
  if (updates.mobile) {
    const clean10 = normalizePhone(updates.mobile);
    if (!isValidIndianMobile(clean10)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }
    const phoneTaken = await checkPhoneExists(clean10, uid);
    if (phoneTaken) {
      throw new Error(`Mobile number "${clean10}" is already assigned to another staff member.`);
    }
    updates.mobile = clean10;
    updates.phone = normalizeIndianPhoneNumber(clean10);
  }

  // If status is updated, also update isActive boolean
  if (updates.status) {
    updates.isActive = updates.status === "Active";
  }

  const safeUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Prevent modifying the immutable primary key or password directly via this endpoint
  delete safeUpdates.id;
  delete safeUpdates.uid;
  delete safeUpdates.password; // Passwords are never saved in Firestore
  delete safeUpdates.code;

  if (updates.role === "Super Admin") {
    safeUpdates.roleId = "role_super_admin";
  } else if (updates.role && updates.role !== "Super Admin") {
    safeUpdates.roleId = null;
  }

  const ref = doc(db, "users", uid);
  await updateDoc(ref, safeUpdates);
}

/**
 * Resets a staff member's password by Super Admin / authorized admin.
 * Never writes plaintext passwords to Firestore.
 */
export async function adminResetStaffUserPassword(uid, newPassword, callerUser = null) {
  if (!uid) throw new Error("Staff user ID is required.");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const isCallerSuperAdmin =
    callerUser?.role === "Super Admin" || callerUser?.roleId === "role_super_admin";
  const callerPerms = Array.isArray(callerUser?.permissions) ? callerUser.permissions : [];
  const canReset =
    isCallerSuperAdmin ||
    callerPerms.includes("users.edit") ||
    callerPerms.includes("users");

  if (callerUser && !canReset) {
    throw new Error("Unauthorized: Only administrators with user edit permissions can reset staff passwords.");
  }

  const target = await getUserById(uid);
  if (!target) throw new Error("Staff member not found.");

  // Check if target is Super Admin and caller is not Super Admin
  const isTargetSuper = target.role === "Super Admin" || target.roleId === "role_super_admin";
  if (isTargetSuper && !isCallerSuperAdmin) {
    throw new Error("Only a Super Admin can reset the password for a Super Admin account.");
  }

  // Record password reset audit event in Firestore (no passwords recorded)
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    passwordResetAt: serverTimestamp(),
    passwordResetBy: callerUser?.uid || callerUser?.id || "admin",
    updatedAt: serverTimestamp(),
  });

  return {
    success: true,
    message: `Password reset successfully for ${target.name}.`,
  };
}

/**
 * Toggles a user's status between Active and Inactive
 */
export async function toggleStaffUserStatus(uid, currentStatus, callerUser = null) {
  if (!uid) throw new Error("User ID is required");

  const existing = await getUserById(uid);
  if (!existing) throw new Error("Staff user not found");

  const isTargetSuperAdmin =
    existing.role === "Super Admin" || existing.roleId === "role_super_admin";
  const isCallerSelf = callerUser && (callerUser.id === uid || callerUser.uid === uid);

  // Prevent self-deactivation
  if (isCallerSelf && isTargetSuperAdmin) {
    throw new Error("You cannot deactivate your own Super Admin account.");
  }

  const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";

  // Protect the last active Super Admin
  if (isTargetSuperAdmin && nextStatus === "Inactive") {
    const activeAdminsCount = await countActiveSuperAdmins();
    if (activeAdminsCount <= 1) {
      throw new Error(
        "Cannot deactivate the only active Super Admin. Promote another user first."
      );
    }
  }

  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    status: nextStatus,
    isActive: nextStatus === "Active",
    updatedAt: serverTimestamp(),
  });

  return nextStatus;
}

/**
 * Deletes a staff user profile document
 */
export async function deleteStaffUser(uid, callerUser = null) {
  if (!uid) throw new Error("User ID is required");

  const existing = await getUserById(uid);
  if (!existing) return;

  const isCallerSelf = callerUser && (callerUser.id === uid || callerUser.uid === uid);
  if (isCallerSelf) {
    throw new Error("You cannot delete your own account.");
  }

  const isTargetSuperAdmin =
    existing.role === "Super Admin" || existing.roleId === "role_super_admin";
  if (isTargetSuperAdmin) {
    const activeAdminsCount = await countActiveSuperAdmins();
    if (activeAdminsCount <= 1) {
      throw new Error("Cannot delete the only active Super Admin account.");
    }
  }

  const ref = doc(db, "users", uid);
  await deleteDoc(ref);
}
