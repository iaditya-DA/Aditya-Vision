import {
  collection,
  doc,
  getDocs,
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

export async function createPaymentRequest({
  deliveryId,
  driverId,
  driverName,
  requestedAmount,
  notes = "",
  creator,
}) {
  if (!driverId) {
    throw new Error("A request needs a delivery with an assigned driver");
  }

  const reqId = await generateEntityId("request");
  const reqRef = doc(db, "paymentRequests", reqId);

  await setDoc(reqRef, {
    id: reqId,
    deliveryId,
    driverId,
    driverName,
    requestedAmount: Math.round(Number(requestedAmount) || 0),
    notes: notes?.trim() || "",
    status: "Pending",
    requestedBy: creator?.uid || creator?.id,
    requestedByName: creator?.name || "Staff",
    requestedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    rejectionReason: null,
  });

  return reqId;
}

export async function reviewPaymentRequest(requestId, approve, rejectionReason = "", reviewer) {
  const reqRef = doc(db, "paymentRequests", requestId);
  if (approve) {
    await updateDoc(reqRef, {
      status: "Approved",
      reviewedBy: reviewer?.uid || reviewer?.id,
      reviewedByName: reviewer?.name || "Super Admin",
      reviewedAt: serverTimestamp(),
      rejectionReason: null,
    });
  } else {
    if (!rejectionReason.trim()) {
      throw new Error("Rejection reason is mandatory");
    }
    await updateDoc(reqRef, {
      status: "Rejected",
      reviewedBy: reviewer?.uid || reviewer?.id,
      reviewedByName: reviewer?.name || "Super Admin",
      reviewedAt: serverTimestamp(),
      rejectionReason: rejectionReason.trim(),
    });
  }
}

export async function getPaymentRequestsPaged({
  status = "",
  driverId = "",
  pageSize = 20,
  lastDoc = null,
} = {}) {
  let q = query(collection(db, "paymentRequests"), orderBy("requestedAt", "desc"));
  if (status) {
    q = query(q, where("status", "==", status));
  }
  if (driverId) {
    q = query(q, where("driverId", "==", driverId));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  q = query(q, fsLimit(pageSize));

  const snap = await getDocs(q);
  const requests = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));
  return {
    requests,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function getPendingRequestsCount() {
  const q = query(collection(db, "paymentRequests"), where("status", "==", "Pending"));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
