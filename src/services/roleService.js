import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Module-grouped granular permission definitions
 */
export const MODULE_PERMISSIONS = {
  dashboard: {
    label: "Dashboard",
    description: "Business analytics, KPIs, and operational summary",
    permissions: [
      { key: "dashboard.view", label: "View Dashboard", description: "Access business metrics, revenue summary and KPIs" },
    ],
  },
  deliveries: {
    label: "Deliveries",
    description: "Customer delivery orders, assignments, and dispatching",
    permissions: [
      { key: "deliveries.view", label: "View Deliveries", description: "Browse deliveries list and view order details" },
      { key: "deliveries.create", label: "Create Deliveries", description: "Register new customer delivery orders" },
      { key: "deliveries.edit", label: "Edit Deliveries", description: "Update delivery details, assigned driver, and status" },
      { key: "deliveries.delete", label: "Delete Deliveries", description: "Cancel or remove delivery records" },
    ],
  },
  drivers: {
    label: "Drivers",
    description: "Fleet driver onboarding, documents, and directory",
    permissions: [
      { key: "drivers.view", label: "View Drivers", description: "Browse driver roster and profiles" },
      { key: "drivers.create", label: "Create Drivers", description: "Register new delivery drivers" },
      { key: "drivers.edit", label: "Edit Drivers", description: "Update driver contact, vehicle and profile details" },
      { key: "drivers.delete", label: "Delete Drivers", description: "Deactivate or remove drivers from roster" },
      { key: "drivers.viewBankDetails", label: "View Bank Details", description: "Access full unmasked bank account numbers (Sensitive)", sensitive: true },
      { key: "drivers.exportBankDetails", label: "Export Bank Details", description: "Include complete bank information in CSV/Excel/PDF exports (Sensitive)", sensitive: true },
      { key: "drivers.approveDrivers", label: "Approve Drivers", description: "Authorize pending driver onboarding submissions" },
    ],
  },
  payments: {
    label: "Payments & Finance",
    description: "Driver payout requisitions, disbursements, and ledger",
    permissions: [
      { key: "payments.view", label: "View Payments & Requests", description: "Access payment requests and disbursement history" },
      { key: "payments.create", label: "Record Payments & Requests", description: "Record driver disbursements and log payout requests" },
      { key: "payments.edit", label: "Edit Payments", description: "Update payment memos, references, and methods" },
      { key: "payments.approvePayments", label: "Approve Payments", description: "Authorize and approve driver payout requests" },
      { key: "payments.voidPayments", label: "Void Payments", description: "Reject payout requests or void recorded payments" },
    ],
  },
  reports: {
    label: "Reports",
    description: "Financial, delivery, and driver analytics and export",
    permissions: [
      { key: "reports.view", label: "View Reports", description: "Access business reports and custom report builder" },
      { key: "reports.export", label: "Export Reports", description: "Download CSV, Excel, and PDF reports" },
    ],
  },
  users: {
    label: "Users & Staff",
    description: "Internal staff accounts, roles, and security policies",
    permissions: [
      { key: "users.view", label: "View Users", description: "Browse staff directory and profile summaries" },
      { key: "users.create", label: "Create Staff", description: "Provision new staff user accounts with credentials" },
      { key: "users.edit", label: "Edit Staff", description: "Modify staff profile details and assigned permissions" },
      { key: "users.delete", label: "Deactivate/Delete Staff", description: "Suspend or delete staff accounts" },
    ],
  },
  settings: {
    label: "Settings",
    description: "System rules, payout rates, and store locations",
    permissions: [
      { key: "settings.view", label: "View Settings", description: "View company profile and payout configurations" },
      { key: "settings.edit", label: "Edit Settings", description: "Update delivery fee rates and business policies" },
    ],
  },
  van: {
    label: "VAN Number Management",
    description: "Lookup item codes from model numbers and manage company catalogues",
    permissions: [
      { key: "van.view", label: "View VAN Lookup", description: "Search model numbers and lookup item codes" },
      { key: "van.manage", label: "Manage VAN Catalogues", description: "Upload PDF price lists, configure presets and publish item codes", sensitive: true },
    ],
  },
};

/**
 * Flat list of all available permissions for tables and matrices
 */
export const ALL_PERMISSIONS = Object.entries(MODULE_PERMISSIONS).flatMap(
  ([moduleKey, mod]) =>
    mod.permissions.map((p) => ({
      ...p,
      module: moduleKey,
      moduleLabel: mod.label,
    }))
);

/**
 * Predefined System Roles
 */
export const SYSTEM_ROLES = [
  {
    id: "ROLE-001",
    name: "Super Admin",
    description: "Full master access to all operations, finance, drivers, and user management.",
    permissions: ALL_PERMISSIONS.map((p) => p.key),
    isSystem: true,
  },
  {
    id: "ROLE-002",
    name: "Operations Manager",
    description: "Manages day-to-day deliveries, driver fleet, onboarding approvals, and operations reports.",
    permissions: [
      "dashboard.view",
      "deliveries.view",
      "deliveries.create",
      "deliveries.edit",
      "deliveries.delete",
      "drivers.view",
      "drivers.create",
      "drivers.edit",
      "drivers.approveDrivers",
      "drivers.viewBankDetails",
      "payments.view",
      "reports.view",
      "reports.export",
      "users.view",
      "van.view",
    ],
    isSystem: true,
  },
  {
    id: "ROLE-003",
    name: "Dispatcher",
    description: "Responsible for logging orders, assigning drivers, and updating delivery dispatch statuses.",
    permissions: [
      "dashboard.view",
      "deliveries.view",
      "deliveries.create",
      "deliveries.edit",
      "drivers.view",
      "van.view",
    ],
    isSystem: true,
  },
  {
    id: "ROLE-004",
    name: "Accountant",
    description: "Handles driver payouts, disbursement history, bank details review, and financial reconciliations.",
    permissions: [
      "dashboard.view",
      "deliveries.view",
      "drivers.view",
      "drivers.viewBankDetails",
      "drivers.exportBankDetails",
      "payments.view",
      "payments.create",
      "payments.edit",
      "payments.approvePayments",
      "payments.voidPayments",
      "reports.view",
      "reports.export",
    ],
    isSystem: true,
  },
  {
    id: "ROLE-005",
    name: "Staff",
    description: "Standard retail store associate with rights to view dashboard and log deliveries.",
    permissions: [
      "dashboard.view",
      "deliveries.view",
      "deliveries.create",
      "van.view",
    ],
    isSystem: true,
  },
];

/**
 * Ensures system roles exist in Firestore
 */
export async function ensureDefaultRoles() {
  for (const role of SYSTEM_ROLES) {
    const roleRef = doc(db, "roles", role.id);
    const snap = await getDoc(roleRef);
    if (!snap.exists()) {
      await setDoc(roleRef, {
        ...role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

/**
 * Fetch all roles from Firestore
 */
export async function getRoles() {
  const snap = await getDocs(collection(db, "roles"));
  const roles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return roles.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Create a new custom role
 */
export async function createRole(roleData) {
  const roleId = roleData.id || `ROLE-${Date.now()}`;
  const ref = doc(db, "roles", roleId);
  await setDoc(ref, {
    ...roleData,
    id: roleId,
    isSystem: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return roleId;
}

/**
 * Update an existing role
 */
export async function updateRole(roleId, updates) {
  const roleRef = doc(db, "roles", roleId);
  const snap = await getDoc(roleRef);
  if (!snap.exists()) throw new Error("Role not found");

  const existing = snap.data();
  if (existing.isSystem && updates.name && updates.name !== existing.name) {
    throw new Error("System role titles cannot be renamed");
  }

  const batch = writeBatch(db);

  batch.update(roleRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // If permissions updated, cascade to all users holding this role
  if (updates.permissions) {
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.docs.forEach((uDoc) => {
      if (uDoc.data().role === existing.name) {
        batch.update(uDoc.ref, {
          permissions: updates.permissions,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  await batch.commit();
}

/**
 * Delete a custom role (system roles cannot be deleted)
 */
export async function deleteRole(roleId) {
  const roleRef = doc(db, "roles", roleId);
  const snap = await getDoc(roleRef);
  if (!snap.exists()) return;
  const roleData = snap.data();
  if (roleData.isSystem) throw new Error("System roles cannot be deleted");

  // Check if any users have this role
  const usersSnap = await getDocs(collection(db, "users"));
  const hasUsers = usersSnap.docs.some((uDoc) => uDoc.data().role === roleData.name);
  if (hasUsers) {
    throw new Error("Cannot delete a role assigned to active staff members");
  }

  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(roleRef);
}
