import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  startAfter,
  runTransaction,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { generateEntityId } from "./idService";
import { createNotification } from "./notificationService";

export const DELIVERY_STATUSES = [
  "Created",
  "Assigned",
  "Picked Up",
  "In Transit",
  "Delivered",
  "Failed",
  "Cancelled",
];

export async function getDeliveriesPaged({
  status = "",
  paymentStatus = "",
  driverId = "",
  startDate = "",
  endDate = "",
  pageSize = 20,
  lastDoc = null,
} = {}) {
  let q = query(collection(db, "deliveries"), orderBy("createdAt", "desc"));

  if (status) {
    q = query(q, where("status", "==", status));
  }
  if (paymentStatus) {
    if (Array.isArray(paymentStatus)) {
      q = query(q, where("paymentSummary.status", "in", paymentStatus));
    } else {
      q = query(q, where("paymentSummary.status", "==", paymentStatus));
    }
  }
  if (driverId) {
    q = query(q, where("driverId", "==", driverId));
  }
  if (startDate) {
    q = query(q, where("deliveryDate", ">=", startDate));
  }
  if (endDate) {
    q = query(q, where("deliveryDate", "<=", endDate));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  q = query(q, fsLimit(pageSize));

  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    // If composite index is missing or query fails, fallback to simple query without server-side filter
    console.warn("getDeliveriesPaged falling back to simple query:", err.message);
    const fallbackQ = query(collection(db, "deliveries"), fsLimit(pageSize));
    snap = await getDocs(fallbackQ);
  }
  let deliveries = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));

  // Apply in-memory sorting/filtering if fallback happened
  if (status) {
    deliveries = deliveries.filter((d) => d.status === status);
  }
  if (paymentStatus) {
    const pStatuses = Array.isArray(paymentStatus) ? paymentStatus : [paymentStatus];
    deliveries = deliveries.filter((d) => pStatuses.includes(d.paymentSummary?.status));
  }
  if (driverId) {
    deliveries = deliveries.filter((d) => d.driverId === driverId);
  }
  if (startDate) {
    deliveries = deliveries.filter((d) => d.deliveryDate >= startDate);
  }
  if (endDate) {
    deliveries = deliveries.filter((d) => d.deliveryDate <= endDate);
  }

  // Ensure latest created first
  deliveries.sort((a, b) => {
    const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
    const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return {
    deliveries,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function getDeliveryById(id) {
  const ref = doc(db, "deliveries", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Creates delivery inside transaction, with initial timeline and paymentSummary.
 * If driver payment is also recorded on create, executes payment in the SAME transaction.
 */
export async function createDeliveryWithTx(deliveryData, paymentData = null, creator) {
  const result = await runTransaction(db, async (tx) => {
    const deliveryId = await generateEntityId("delivery", tx);
    const delCharges = Math.round(Number(deliveryData.deliveryCharges) || 0);
    const addCharges = Math.round(Number(deliveryData.additionalCharges) || 0);
    const totalCharges = delCharges + addCharges;

    let initialPaymentSummary = {
      totalCharges,
      totalPaid: 0,
      balance: totalCharges,
      status: "Unpaid",
      lastPaymentMode: null,
      lastPaymentDate: null,
      lastReference: null,
      paymentCount: 0,
    };

    let newPayDocId = null;

    if (paymentData && Number(paymentData.amount) > 0) {
      if (!deliveryData.driverId) {
        throw new Error("Assign a driver first before recording payment");
      }
      const payAmount = Math.round(Number(paymentData.amount));
      newPayDocId = await generateEntityId("payment", tx);

      const payRef = doc(db, "paymentHistory", newPayDocId);
      tx.set(payRef, {
        id: newPayDocId,
        deliveryId,
        driverId: deliveryData.driverId,
        driverName: deliveryData.driverName || "Driver",
        amount: payAmount,
        type: payAmount >= totalCharges ? "Full" : "Partial",
        paymentMode: paymentData.paymentMode || "Cash",
        utrNumber: paymentData.utrNumber?.trim() || null,
        chequeNumber: paymentData.chequeNumber?.trim() || null,
        receivedBy: paymentData.receivedBy?.trim() || null,
        notes: paymentData.notes?.trim() || "",
        relatedRequestId: null,
        status: "Recorded",
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
        recordedBy: creator?.uid || creator?.id,
        recordedByName: creator?.name || "Staff",
        paymentDate: paymentData.paymentDate || new Date().toISOString().split("T")[0],
        recordedAt: new Date(),
      });

      const newBalance = Math.max(0, totalCharges - payAmount);
      const computedPayStatus =
        payAmount > totalCharges
          ? "Overpaid"
          : payAmount === totalCharges
          ? "Paid"
          : payAmount > 0
          ? "Partially Paid"
          : "Unpaid";

      initialPaymentSummary = {
        totalCharges,
        totalPaid: payAmount,
        balance: newBalance,
        status: computedPayStatus,
        lastPaymentMode: paymentData.paymentMode || "Cash",
        lastPaymentDate: paymentData.paymentDate || new Date().toISOString().split("T")[0],
        lastReference:
          paymentData.utrNumber ||
          paymentData.chequeNumber ||
          paymentData.receivedBy ||
          "Ref",
        paymentCount: 1,
      };
    }

    const delRef = doc(db, "deliveries", deliveryId);
    tx.set(delRef, {
      ...deliveryData,
      id: deliveryId,
      deliveryCharges: delCharges,
      additionalCharges: addCharges,
      totalCharges,
      status: deliveryData.status || "Created",
      paymentSummary: initialPaymentSummary,
      timeline: [
        {
          event: "Delivery Created",
          note: deliveryData.notes || "Order registered into system",
          timestamp: new Date().toISOString(),
          by: creator?.uid || creator?.id,
          byName: creator?.name || "Staff",
        },
      ],
      createdBy: creator?.uid || creator?.id,
      createdByName: creator?.name || "Staff",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { deliveryId, paymentId: newPayDocId };
  });

  // Create notifications for Super Admin
  try {
    await createNotification({
      type: "DELIVERY_CREATED",
      title: `New Delivery #${result.deliveryId} Created`,
      lines: [
        `Customer: ${deliveryData.customerName}`,
        `Product: ${deliveryData.productName}`,
        `Driver: ${deliveryData.driverName || "Unassigned"}`,
      ],
      deliveryId: result.deliveryId,
      createdBy: creator?.uid || creator?.id,
      createdByName: creator?.name || "Staff",
      recipientRole: "Super Admin",
    });

    if (paymentData && Number(paymentData.amount) > 0) {
      await createNotification({
        type: "PAYMENT_RECORDED",
        title: `Driver Payment Recorded for #${result.deliveryId}`,
        lines: [
          `Amount: ₹${paymentData.amount}`,
          `Driver: ${deliveryData.driverName || "Driver"}`,
          `Mode: ${paymentData.paymentMode || "Cash"}`,
        ],
        deliveryId: result.deliveryId,
        createdBy: creator?.uid || creator?.id,
        createdByName: creator?.name || "Staff",
        recipientRole: "Super Admin",
      });
    }
  } catch (notifErr) {
    console.warn("Could not dispatch delivery notification:", notifErr);
  }

  return result;
}

export async function updateDeliveryStatusWithTx({
  deliveryId,
  newStatus,
  note = "",
  paymentData = null,
  user,
}) {
  return await runTransaction(db, async (tx) => {
    const delRef = doc(db, "deliveries", deliveryId);
    const delSnap = await tx.get(delRef);
    if (!delSnap.exists()) throw new Error("Delivery not found");

    const delData = delSnap.data();
    const timeline = Array.isArray(delData.timeline) ? [...delData.timeline] : [];

    timeline.push({
      event: `Status changed to ${newStatus}`,
      note: note || `Updated by ${user?.name || "Staff"}`,
      timestamp: new Date().toISOString(),
      by: user?.uid || user?.id,
      byName: user?.name || "Staff",
    });

    let paymentSummary = delData.paymentSummary || {
      totalCharges: delData.totalCharges || 0,
      totalPaid: 0,
      balance: delData.totalCharges || 0,
      status: "Not Requested",
      paymentCount: 0,
    };

    let newPayDocId = null;

    if (paymentData && Number(paymentData.amount) > 0) {
      if (!delData.driverId) {
        throw new Error("Assign a driver first before recording payment");
      }
      const payAmount = Math.round(Number(paymentData.amount));
      newPayDocId = await generateEntityId("payment", tx);

      const payRef = doc(db, "paymentHistory", newPayDocId);
      tx.set(payRef, {
        id: newPayDocId,
        deliveryId,
        driverId: delData.driverId,
        driverName: delData.driverName || "Driver",
        amount: payAmount,
        type: payAmount >= (paymentSummary.balance || delData.totalCharges) ? "Full" : "Partial",
        paymentMode: paymentData.paymentMode || "Cash",
        utrNumber: paymentData.utrNumber?.trim() || null,
        chequeNumber: paymentData.chequeNumber?.trim() || null,
        receivedBy: paymentData.receivedBy?.trim() || null,
        notes: paymentData.notes?.trim() || "",
        relatedRequestId: null,
        status: "Recorded",
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
        recordedBy: user?.uid || user?.id,
        recordedByName: user?.name || "Staff",
        paymentDate: paymentData.paymentDate || new Date().toISOString().split("T")[0],
        recordedAt: new Date(),
      });

      const updatedPaid = (paymentSummary.totalPaid || 0) + payAmount;
      const updatedBalance = Math.max(0, (delData.totalCharges || 0) - updatedPaid);

      paymentSummary = {
        ...paymentSummary,
        totalPaid: updatedPaid,
        balance: updatedBalance,
        status: updatedPaid >= (delData.totalCharges || 0) ? "Paid" : "Partial",
        lastPaymentMode: paymentData.paymentMode || "Cash",
        lastPaymentDate: paymentData.paymentDate || new Date().toISOString().split("T")[0],
        lastReference:
          paymentData.utrNumber ||
          paymentData.chequeNumber ||
          paymentData.receivedBy ||
          "Ref",
        paymentCount: (paymentSummary.paymentCount || 0) + 1,
      };
    }

    tx.update(delRef, {
      status: newStatus,
      timeline,
      paymentSummary,
      updatedAt: new Date(),
    });

    return { deliveryId, paymentId: newPayDocId };
  });
}

export async function getDashboardKpiStats() {
  const todayStr = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = todayStr.slice(0, 8) + "01";

  try {
    // 1. Today's deliveries count
    let todayCount = 0;
    try {
      const todayQ = query(collection(db, "deliveries"), where("deliveryDate", "==", todayStr));
      const todaySnap = await getCountFromServer(todayQ);
      todayCount = todaySnap.data().count;
    } catch {
      // fallback
    }

    // 2. In Transit count
    let inTransitCount = 0;
    try {
      const transitQ = query(collection(db, "deliveries"), where("status", "==", "In Transit"));
      const transitSnap = await getCountFromServer(transitQ);
      inTransitCount = transitSnap.data().count;
    } catch {
      // fallback
    }

    // 3. Delivered this month count
    let deliveredMonthCount = 0;
    try {
      const deliveredMonthQ = query(
        collection(db, "deliveries"),
        where("status", "==", "Delivered"),
        where("deliveryDate", ">=", firstDayOfMonth)
      );
      const deliveredMonthSnap = await getCountFromServer(deliveredMonthQ);
      deliveredMonthCount = deliveredMonthSnap.data().count;
    } catch {
      // fallback if composite index required
    }

    // 4. Payment Due count & sum
    let paymentDueCount = 0;
    let dueAmountSum = 0;
    try {
      const paymentDueQ = query(
        collection(db, "deliveries"),
        where("paymentSummary.status", "in", ["Unpaid", "Partial"])
      );
      const dueCountSnap = await getCountFromServer(paymentDueQ);
      paymentDueCount = dueCountSnap.data().count;

      try {
        const dueSumSnap = await getAggregateFromServer(paymentDueQ, {
          totalDue: sum("paymentSummary.balance"),
        });
        dueAmountSum = dueSumSnap.data().totalDue || 0;
      } catch {
        const listSnap = await getDocs(paymentDueQ);
        dueAmountSum = listSnap.docs.reduce(
          (acc, d) => acc + (d.data().paymentSummary?.balance || 0),
          0
        );
      }
    } catch {
      // fallback
    }

    // 5. Status distribution
    const statusCounts = {};
    for (const st of DELIVERY_STATUSES) {
      try {
        const stQ = query(collection(db, "deliveries"), where("status", "==", st));
        const stSnap = await getCountFromServer(stQ);
        statusCounts[st] = stSnap.data().count;
      } catch {
        statusCounts[st] = 0;
      }
    }

    return {
      todayCount,
      inTransitCount,
      deliveredMonthCount,
      paymentDueCount,
      paymentDueAmount: dueAmountSum,
      statusCounts,
    };
  } catch (err) {
    console.warn("getDashboardKpiStats failed, attempting memory scan fallback:", err);
    try {
      const allSnap = await getDocs(query(collection(db, "deliveries"), fsLimit(100)));
      const docs = allSnap.docs.map((d) => d.data());
      const statusCounts = {};
      DELIVERY_STATUSES.forEach((st) => (statusCounts[st] = 0));

      let todayCount = 0;
      let inTransitCount = 0;
      let deliveredMonthCount = 0;
      let paymentDueCount = 0;
      let dueAmountSum = 0;

      for (const d of docs) {
        if (d.status && statusCounts[d.status] !== undefined) {
          statusCounts[d.status]++;
        }
        if (d.deliveryDate === todayStr) todayCount++;
        if (d.status === "In Transit") inTransitCount++;
        if (d.status === "Delivered" && d.deliveryDate >= firstDayOfMonth) deliveredMonthCount++;
        const pStatus = d.paymentSummary?.status;
        if (pStatus === "Unpaid" || pStatus === "Partial") {
          paymentDueCount++;
          dueAmountSum += Number(d.paymentSummary?.balance) || 0;
        }
      }

      return {
        todayCount,
        inTransitCount,
        deliveredMonthCount,
        paymentDueCount,
        paymentDueAmount: dueAmountSum,
        statusCounts,
      };
    } catch {
      return {
        todayCount: 0,
        inTransitCount: 0,
        deliveredMonthCount: 0,
        paymentDueCount: 0,
        paymentDueAmount: 0,
        statusCounts: {},
      };
    }
  }
}
