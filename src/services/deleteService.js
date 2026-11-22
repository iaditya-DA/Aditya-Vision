import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getCountFromServer,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Creates an immutable audit log record for every deletion or archival action
 */
export async function logAuditAction({
  action = "DELETE", // 'DELETE' | 'ARCHIVE' | 'BULK_DELETE'
  recordType, // 'delivery' | 'driver' | 'user' | 'paymentRequest' | 'savedReport' | 'notification'
  recordId, // string or array of strings
  recordTitle = "",
  performedBy = null,
  performedByName = "Super Admin",
  reason = "",
  result = "SUCCESS",
  details = null,
}) {
  try {
    const logsCol = collection(db, "auditLogs");
    const logDoc = doc(logsCol);
    await writeBatch(db)
      .set(logDoc, {
        action,
        recordType,
        recordId: Array.isArray(recordId) ? recordId.slice(0, 100) : recordId,
        recordCount: Array.isArray(recordId) ? recordId.length : 1,
        recordTitle: String(recordTitle || "").slice(0, 200),
        performedBy: performedBy || "system",
        performedByName: performedByName || "Super Admin",
        reason: reason ? String(reason).trim().slice(0, 500) : "Administrative cleanup",
        result,
        details: details || null,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      })
      .commit();
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

/**
 * Fetch immutable audit logs ordered by newest first
 */
export async function getAuditLogs({ limitCount = 50, recordType = "" } = {}) {
  try {
    let q = query(
      collection(db, "auditLogs"),
      orderBy("timestamp", "desc"),
      fsLimit(limitCount)
    );

    if (recordType) {
      q = query(
        collection(db, "auditLogs"),
        where("recordType", "==", recordType),
        orderBy("timestamp", "desc"),
        fsLimit(limitCount)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn("Could not load audit logs:", err);
    return [];
  }
}

/**
 * Fetch real-time document counts for Super Admin Data Management dashboard
 */
export async function getDataManagementStats() {
  try {
    const [
      delSnap,
      drvSnap,
      usrSnap,
      reqSnap,
      paySnap,
      repSnap,
      notifSnap,
      auditSnap,
    ] = await Promise.all([
      getCountFromServer(collection(db, "deliveries")),
      getCountFromServer(collection(db, "drivers")),
      getCountFromServer(collection(db, "users")),
      getCountFromServer(collection(db, "paymentRequests")),
      getCountFromServer(collection(db, "paymentHistory")),
      getCountFromServer(collection(db, "savedReports")),
      getCountFromServer(collection(db, "notifications")),
      getCountFromServer(collection(db, "auditLogs")),
    ]);

    return {
      deliveries: delSnap.data().count || 0,
      drivers: drvSnap.data().count || 0,
      users: usrSnap.data().count || 0,
      paymentRequests: reqSnap.data().count || 0,
      paymentHistory: paySnap.data().count || 0,
      savedReports: repSnap.data().count || 0,
      notifications: notifSnap.data().count || 0,
      auditLogs: auditSnap.data().count || 0,
    };
  } catch (err) {
    console.warn("Error getting data management stats:", err);
    return {
      deliveries: 0,
      drivers: 0,
      users: 0,
      paymentRequests: 0,
      paymentHistory: 0,
      savedReports: 0,
      notifications: 0,
      auditLogs: 0,
    };
  }
}

/**
 * Inspects driver relationship constraints to prevent orphaning deliveries or payments
 */
export async function checkDriverDeletionSafety(driverId) {
  if (!driverId) return { canDeletePermanently: true, deliveryCount: 0, paymentCount: 0 };

  const [delSnap, paySnap] = await Promise.all([
    getDocs(query(collection(db, "deliveries"), where("driverId", "==", driverId), fsLimit(10))),
    getDocs(query(collection(db, "paymentHistory"), where("driverId", "==", driverId), fsLimit(10))),
  ]);

  const deliveryCount = delSnap.size;
  const paymentCount = paySnap.size;
  const hasHistoricalRecords = deliveryCount > 0 || paymentCount > 0;

  return {
    canDeletePermanently: !hasHistoricalRecords,
    hasHistoricalRecords,
    deliveryCount,
    paymentCount,
    recommendation: hasHistoricalRecords
      ? "This driver has recorded delivery orders or financial payouts. Archiving the driver is strongly recommended to preserve historical reports."
      : "No historical deliveries or payments exist. Safe to permanently delete.",
  };
}

/**
 * Delete a single delivery order
 */
export async function deleteDelivery(deliveryId, user, reason = "") {
  if (!deliveryId) throw new Error("Delivery ID is required");

  const docRef = doc(db, "deliveries", deliveryId);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};

  await deleteDoc(docRef);

  await logAuditAction({
    action: "DELETE",
    recordType: "delivery",
    recordId: deliveryId,
    recordTitle: `${deliveryId} (${data.customerName || "Customer"})`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
    details: {
      invoiceNumber: data.invoiceNumber || "",
      orderValue: data.totalAmount || data.orderValue || 0,
      status: data.status || "",
    },
  });

  return { id: deliveryId, deleted: true };
}

/**
 * Chunked bulk deletion for deliveries (handles Firestore 500-op batch limit)
 */
export async function deleteDeliveriesBulk(deliveryIds, user, reason = "") {
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) return 0;

  const CHUNK_SIZE = 200;
  let deletedCount = 0;

  for (let i = 0; i < deliveryIds.length; i += CHUNK_SIZE) {
    const chunk = deliveryIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      const ref = doc(db, "deliveries", id);
      batch.delete(ref);
    });

    await batch.commit();
    deletedCount += chunk.length;
  }

  await logAuditAction({
    action: "BULK_DELETE",
    recordType: "delivery",
    recordId: deliveryIds,
    recordTitle: `${deletedCount} Delivery Orders`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
    details: { deletedCount },
  });

  return deletedCount;
}

/**
 * Delete or Archive a driver with subcollection handling
 */
export async function deleteDriver(driverId, user, { forcePermanent = false, reason = "" } = {}) {
  if (!driverId) throw new Error("Driver ID is required");

  const docRef = doc(db, "drivers", driverId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return { id: driverId, deleted: true };
  const data = snap.data();

  const safety = await checkDriverDeletionSafety(driverId);

  // If driver has historical orders and permanent deletion was not explicitly forced: ARCHIVE
  if (safety.hasHistoricalRecords && !forcePermanent) {
    await updateDoc(docRef, {
      status: "Archived",
      archivedAt: serverTimestamp(),
      archivedBy: user?.uid || user?.id,
      archivedReason: reason || "Archived via Delete Management",
    });

    await logAuditAction({
      action: "ARCHIVE",
      recordType: "driver",
      recordId: driverId,
      recordTitle: `${data.name || "Driver"} (${data.code || driverId})`,
      performedBy: user?.uid || user?.id,
      performedByName: user?.name || "Super Admin",
      reason: reason || "Archived to preserve historical delivery ledgers",
      result: "SUCCESS",
      details: {
        deliveryCount: safety.deliveryCount,
        paymentCount: safety.paymentCount,
      },
    });

    return { id: driverId, archived: true, message: "Driver safely archived to protect historical records." };
  }

  // Permanent deletion: explicitly clean up private subcollection first
  try {
    const bankDocRef = doc(db, "drivers", driverId, "private", "bank");
    await deleteDoc(bankDocRef);
  } catch (subErr) {
    console.warn("Subcollection cleanup warning:", subErr);
  }

  await deleteDoc(docRef);

  await logAuditAction({
    action: "DELETE",
    recordType: "driver",
    recordId: driverId,
    recordTitle: `${data.name || "Driver"} (${data.code || driverId})`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
    details: { forcePermanent: true },
  });

  return { id: driverId, deleted: true };
}

/**
 * Chunked bulk deletion / archival for drivers
 */
export async function deleteDriversBulk(driverIds, user, { forcePermanent = false, reason = "" } = {}) {
  if (!Array.isArray(driverIds) || driverIds.length === 0) return 0;

  let processedCount = 0;
  for (const driverId of driverIds) {
    await deleteDriver(driverId, user, { forcePermanent, reason });
    processedCount++;
  }

  await logAuditAction({
    action: "BULK_DELETE",
    recordType: "driver",
    recordId: driverIds,
    recordTitle: `${processedCount} Drivers Processed`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
    details: { processedCount, forcePermanent },
  });

  return processedCount;
}

/**
 * Delete a payment request
 */
export async function deletePaymentRequest(requestId, user, reason = "") {
  if (!requestId) throw new Error("Request ID is required");

  const docRef = doc(db, "paymentRequests", requestId);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};

  await deleteDoc(docRef);

  await logAuditAction({
    action: "DELETE",
    recordType: "paymentRequest",
    recordId: requestId,
    recordTitle: `Payment Request ${requestId} (Rs. ${data.amount || 0})`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
    details: { amount: data.amount, driverName: data.driverName },
  });

  return { id: requestId, deleted: true };
}

/**
 * Bulk delete payment requests
 */
export async function deletePaymentRequestsBulk(requestIds, user, reason = "") {
  if (!Array.isArray(requestIds) || requestIds.length === 0) return 0;

  const CHUNK_SIZE = 200;
  let deletedCount = 0;

  for (let i = 0; i < requestIds.length; i += CHUNK_SIZE) {
    const chunk = requestIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.delete(doc(db, "paymentRequests", id));
    });
    await batch.commit();
    deletedCount += chunk.length;
  }

  await logAuditAction({
    action: "BULK_DELETE",
    recordType: "paymentRequest",
    recordId: requestIds,
    recordTitle: `${deletedCount} Payment Requests`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
  });

  return deletedCount;
}

/**
 * Delete a saved custom report
 */
export async function deleteSavedReport(reportId, user, reason = "") {
  if (!reportId) throw new Error("Report ID is required");

  const docRef = doc(db, "savedReports", reportId);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};

  await deleteDoc(docRef);

  await logAuditAction({
    action: "DELETE",
    recordType: "savedReport",
    recordId: reportId,
    recordTitle: data.title || `Report ${reportId}`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
  });

  return { id: reportId, deleted: true };
}

/**
 * Bulk delete saved reports
 */
export async function deleteSavedReportsBulk(reportIds, user, reason = "") {
  if (!Array.isArray(reportIds) || reportIds.length === 0) return 0;

  const batch = writeBatch(db);
  reportIds.forEach((id) => {
    batch.delete(doc(db, "savedReports", id));
  });
  await batch.commit();

  await logAuditAction({
    action: "BULK_DELETE",
    recordType: "savedReport",
    recordId: reportIds,
    recordTitle: `${reportIds.length} Saved Reports`,
    performedBy: user?.uid || user?.id,
    performedByName: user?.name || "Super Admin",
    reason,
    result: "SUCCESS",
  });

  return reportIds.length;
}

/**
 * Delete notification document
 */
export async function deleteNotification(notifId, user, reason = "") {
  if (!notifId) return;
  await deleteDoc(doc(db, "notifications", notifId));
  if (user) {
    await logAuditAction({
      action: "DELETE_SINGLE",
      collection: "notifications",
      documentId: notifId,
      performedBy: user,
      reason: reason || "User notification cleared",
    });
  }
}

export async function deleteNotificationsBulk(notifIds, user, reason = "") {
  if (!Array.isArray(notifIds) || notifIds.length === 0) return 0;
  const batch = writeBatch(db);
  notifIds.forEach((id) => batch.delete(doc(db, "notifications", id)));
  await batch.commit();
  if (user) {
    await logAuditAction({
      action: "DELETE_BULK",
      collection: "notifications",
      documentId: `bulk_${notifIds.length}`,
      performedBy: user,
      reason: reason || `Bulk cleared ${notifIds.length} notifications`,
      metadata: { count: notifIds.length },
    });
  }
  return notifIds.length;
}
