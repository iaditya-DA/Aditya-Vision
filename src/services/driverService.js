import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { generateEntityId } from "./idService";

export const VEHICLE_TYPES = [
  "Tata Ace (Chhota Hathi)",
  "Mahindra Bolero Maxi Truck",
  "Piaggio Ape Loader",
  "Three Wheeler Auto",
  "E-Rickshaw Loader",
  "Two Wheeler Bike",
];

export async function getActiveDrivers() {
  const q = query(
    collection(db, "drivers"),
    where("status", "==", "Active")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getDriversPaged({
  status = "",
  vehicleType = "",
  pageSize = 15,
  lastDoc = null,
} = {}) {
  let q = query(collection(db, "drivers"), orderBy("createdAt", "desc"));

  if (status) {
    q = query(q, where("status", "==", status));
  }
  if (vehicleType) {
    q = query(q, where("vehicleType", "==", vehicleType));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  q = query(q, fsLimit(pageSize));

  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));
  return {
    drivers: list,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function getDriverById(driverId) {
  const ref = doc(db, "drivers", driverId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getDriverBankDetails(driverId) {
  const bankRef = doc(db, "drivers", driverId, "private", "bank");
  const snap = await getDoc(bankRef);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function createDriver(driverData, isSuperAdminUser, creator) {
  const driverId = await generateEntityId("driver");
  const driverRef = doc(db, "drivers", driverId);

  const status = isSuperAdminUser ? "Active" : "Pending Approval";
  const accNum = driverData.accountNumber?.trim() || "";
  const maskedAccount = accNum.length >= 4 ? `•••• •••• ${accNum.slice(-4)}` : accNum;

  // Public driver document
  const publicData = {
    id: driverId,
    code: driverId,
    name: driverData.name?.trim() || "",
    mobile: driverData.mobile?.trim() || "",
    alternateMobile: driverData.alternateMobile?.trim() || "",
    address: driverData.address?.trim() || "",
    city: driverData.city?.trim() || "",
    state: driverData.state?.trim() || "Bihar",
    pinCode: driverData.pinCode?.trim() || "",
    vehicleType: driverData.vehicleType || VEHICLE_TYPES[0],
    vehicleNumber: driverData.vehicleNumber?.trim()?.toUpperCase() || "",
    notes: driverData.notes?.trim() || "",
    status,
    requestedBy: isSuperAdminUser ? null : creator?.uid || null,
    requestedByName: isSuperAdminUser ? null : creator?.name || null,
    rejectionReason: null,
    bankName: driverData.bankName?.trim() || "",
    accountHolderName: driverData.accountHolderName?.trim() || driverData.name?.trim() || "",
    maskedAccount,
    ifscCode: driverData.ifscCode?.trim()?.toUpperCase() || "",
    branchName: driverData.branchName?.trim() || "",
    upiId: driverData.upiId?.trim() || "",
    joinedDate: new Date().toISOString().split("T")[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(driverRef, publicData);

  // Private bank document (readable/writable by Super Admin only)
  const bankRef = doc(db, "drivers", driverId, "private", "bank");
  await setDoc(bankRef, {
    accountHolderName: driverData.accountHolderName?.trim() || driverData.name?.trim() || "",
    bankName: driverData.bankName?.trim() || "",
    accountNumber: accNum,
    ifscCode: driverData.ifscCode?.trim()?.toUpperCase() || "",
    branchName: driverData.branchName?.trim() || "",
    upiId: driverData.upiId?.trim() || "",
    updatedAt: serverTimestamp(),
  });

  return driverId;
}

export async function updateDriver(driverId, updates, bankUpdates = null) {
  const driverRef = doc(db, "drivers", driverId);
  const safeUpdates = { ...updates, updatedAt: serverTimestamp() };

  if (bankUpdates) {
    if (bankUpdates.accountNumber) {
      const acc = bankUpdates.accountNumber.trim();
      safeUpdates.maskedAccount = acc.length >= 4 ? `•••• •••• ${acc.slice(-4)}` : acc;
    }
    if (bankUpdates.bankName !== undefined) safeUpdates.bankName = bankUpdates.bankName.trim();
    if (bankUpdates.accountHolderName !== undefined) safeUpdates.accountHolderName = bankUpdates.accountHolderName.trim();
    if (bankUpdates.ifscCode !== undefined) safeUpdates.ifscCode = bankUpdates.ifscCode.trim().toUpperCase();
    if (bankUpdates.branchName !== undefined) safeUpdates.branchName = bankUpdates.branchName.trim();
    if (bankUpdates.upiId !== undefined) safeUpdates.upiId = bankUpdates.upiId.trim();
  }

  await updateDoc(driverRef, safeUpdates);

  if (bankUpdates) {
    const bankRef = doc(db, "drivers", driverId, "private", "bank");
    await setDoc(
      bankRef,
      {
        ...bankUpdates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function reviewDriverApproval(driverId, approve, rejectionReason = "") {
  const driverRef = doc(db, "drivers", driverId);
  if (approve) {
    await updateDoc(driverRef, {
      status: "Active",
      rejectionReason: null,
      updatedAt: serverTimestamp(),
    });
  } else {
    if (!rejectionReason.trim()) {
      throw new Error("Rejection reason is mandatory");
    }
    await updateDoc(driverRef, {
      status: "Rejected",
      rejectionReason: rejectionReason.trim(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getPendingDriversCount() {
  const q = query(collection(db, "drivers"), where("status", "==", "Pending Approval"));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
