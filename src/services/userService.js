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
export async function checkEmailExists(email) {
  if (!email) return false;
  const q = query(
    collection(db, "users"),
    where("email", "==", email.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
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
 * Creates user in Firebase Auth via an isolated secondary app instance
 * without logging out the currently authenticated Super Admin.
 * 
 * If Firestore write fails, safely rolls back by deleting the newly created Auth user.
 * Passwords are NEVER written to Firestore or persisted in application logs.
 */
export async function createStaffUser(
  {
    name,
    email,
    mobile,
    role = "Staff",
    permissions = [],
    password,
    store = "Benipatti Branch",
    status = "Active",
  },
  callerUser = null
) {
  // Input validations
  if (!name || name.trim().length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("A valid email address is required.");
  }
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile.replace(/\D/g, ""))) {
    throw new Error("Please enter a valid 10-digit Indian mobile number.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error("Please assign at least one module permission.");
  }

  // Prevent ordinary staff from assigning Super Admin privileges
  const isCallerSuperAdmin =
    callerUser?.role === "Super Admin" || callerUser?.roleId === "role_super_admin";
  if (role === "Super Admin" && !isCallerSuperAdmin) {
    throw new Error("Only a Super Admin can create or assign the Super Admin role.");
  }

  // Pre-check email uniqueness in Firestore
  const emailTaken = await checkEmailExists(email);
  if (emailTaken) {
    throw new Error(`An account with email ${email.trim()} already exists in the system.`);
  }

  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `AV-SecondaryAuth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let secondaryApp = null;

  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    // 1. Create account in Firebase Authentication
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      password
    );
    const newUid = cred.user.uid;

    // Sign out from the secondary auth instance immediately
    await signOut(secondaryAuth);

    // 2. Generate sequential user ID code (USR-0001)
    let userCode = "USR-0001";
    try {
      userCode = await generateEntityId("user");
    } catch (idErr) {
      console.warn("Could not generate sequential user ID, falling back:", idErr);
      userCode = `USR-${Date.now().toString().slice(-4)}`;
    }

    // 3. Write Firestore user profile document (never storing the password)
    try {
      const userDocRef = doc(db, "users", newUid);
      await setDoc(userDocRef, {
        code: userCode,
        name: name.trim(),
        email: cleanEmail,
        mobile: mobile.trim(),
        role: role,
        roleId: role === "Super Admin" ? "role_super_admin" : null,
        permissions: permissions,
        status: status || "Active",
        store: store?.trim() || "Benipatti Branch",
        joinedDate: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { id: newUid, code: userCode };
    } catch (firestoreErr) {
      // ROLLBACK: If Firestore document creation fails, delete the Firebase Auth user to prevent orphaned auth accounts
      console.error("Firestore user creation failed. Rolling back Firebase Auth account...", firestoreErr);
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
      throw new Error("This email is already in use by another Firebase authentication account.", { cause: err });
    }
    if (code === "auth/weak-password") {
      throw new Error("The password is too weak. Please use at least 6 characters with letters and numbers.", { cause: err });
    }
    if (code === "auth/invalid-email") {
      throw new Error("The email address provided is not properly formatted.", { cause: err });
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

  const safeUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Prevent modifying the immutable primary key or email via this endpoint
  delete safeUpdates.id;
  delete safeUpdates.uid;
  delete safeUpdates.email;
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
