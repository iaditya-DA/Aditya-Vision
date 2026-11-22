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
} from "firebase/firestore";
import { db } from "../config/firebase";
import { generateEntityId } from "./idService";

export async function addPaymentTx({
  deliveryId = null,
  driverId,
  driverName,
  amount,
  type = "Full",
  paymentMode,
  utrNumber = null,
  chequeNumber = null,
  receivedBy = null,
  notes = "",
  relatedRequestId = null,
  paymentDate,
  recorder,
}) {
  const payAmount = Math.round(Number(amount) || 0);
  if (payAmount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  if (!driverId) {
    throw new Error("Driver is required");
  }

  // Reference validations per payment mode
  if ((paymentMode === "UPI" || paymentMode === "Bank Transfer") && !utrNumber?.trim()) {
    throw new Error("UTR number is required for UPI and Bank Transfer");
  }
  if (paymentMode === "Cheque" && !chequeNumber?.trim()) {
    throw new Error("Cheque number is required");
  }
  if (paymentMode === "Cash" && !receivedBy?.trim()) {
    throw new Error("Recipient name is required for Cash payments");
  }

  return await runTransaction(db, async (tx) => {
    let deliveryData = null;
    let delRef = null;

    if (deliveryId) {
      delRef = doc(db, "deliveries", deliveryId);
      const delSnap = await tx.get(delRef);
      if (!delSnap.exists()) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }
      deliveryData = delSnap.data();

      if (type !== "Advance") {
        const currentBalance = deliveryData.paymentSummary?.balance ?? deliveryData.totalCharges;
        if (payAmount > currentBalance) {
          throw new Error(`Payment of ₹${payAmount} exceeds remaining balance of ₹${currentBalance}`);
        }
      }
    }

    const payId = await generateEntityId("payment", tx);
    const payRef = doc(db, "paymentHistory", payId);

    const newPayment = {
      id: payId,
      deliveryId: deliveryId || null,
      driverId,
      driverName: driverName || "Driver",
      amount: payAmount,
      type: type || "Full",
      paymentMode,
      utrNumber: utrNumber?.trim() || null,
      chequeNumber: chequeNumber?.trim() || null,
      receivedBy: receivedBy?.trim() || null,
      notes: notes?.trim() || "",
      relatedRequestId: relatedRequestId || null,
      status: "Recorded",
      voidReason: null,
      voidedBy: null,
      voidedAt: null,
      recordedBy: recorder?.uid || recorder?.id,
      recordedByName: recorder?.name || "Staff",
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      recordedAt: new Date(),
    };

    tx.set(payRef, newPayment);

    // If attached to delivery, update delivery paymentSummary
    if (delRef && deliveryData) {
      const currentPaid = deliveryData.paymentSummary?.totalPaid || 0;
      const newPaid = currentPaid + payAmount;
      const totalCharges = deliveryData.totalCharges || 0;
      const newBalance = Math.max(0, totalCharges - newPaid);

      const updatedSummary = {
        totalCharges,
        totalPaid: newPaid,
        balance: newBalance,
        status:
          newPaid > totalCharges
            ? "Overpaid"
            : newPaid === totalCharges
            ? "Paid"
            : newPaid > 0
            ? "Partially Paid"
            : "Unpaid",
        lastPaymentMode: paymentMode,
        lastPaymentDate: paymentDate || new Date().toISOString().split("T")[0],
        lastReference: utrNumber || chequeNumber || receivedBy || "Ref",
        paymentCount: (deliveryData.paymentSummary?.paymentCount || 0) + 1,
      };

      tx.update(delRef, {
        paymentSummary: updatedSummary,
        updatedAt: new Date(),
      });
    }

    return payId;
  });
}

export async function voidPaymentTx(paymentId, voidReason, user) {
  if (!voidReason?.trim()) {
    throw new Error("Void reason is mandatory");
  }

  return await runTransaction(db, async (tx) => {
    const payRef = doc(db, "paymentHistory", paymentId);
    const paySnap = await tx.get(payRef);
    if (!paySnap.exists()) throw new Error("Payment record not found");

    const payData = paySnap.data();
    if (payData.status === "Voided") {
      throw new Error("This payment is already voided");
    }

    tx.update(payRef, {
      status: "Voided",
      voidReason: voidReason.trim(),
      voidedBy: user?.uid || user?.id,
      voidedAt: new Date(),
    });

    // If attached to a delivery, recompute delivery payment summary
    if (payData.deliveryId) {
      const delRef = doc(db, "deliveries", payData.deliveryId);
      const delSnap = await tx.get(delRef);
      if (delSnap.exists()) {
        const delData = delSnap.data();
        const currentPaid = Math.max(0, (delData.paymentSummary?.totalPaid || 0) - payData.amount);
        const totalCharges = delData.totalCharges || 0;
        const newBalance = Math.max(0, totalCharges - currentPaid);

        const computedStatus =
          currentPaid > totalCharges
            ? "Overpaid"
            : currentPaid === totalCharges
            ? "Paid"
            : currentPaid > 0
            ? "Partially Paid"
            : "Unpaid";

        tx.update(delRef, {
          "paymentSummary.totalPaid": currentPaid,
          "paymentSummary.balance": newBalance,
          "paymentSummary.status": computedStatus,
          "paymentSummary.paymentCount": Math.max(
            0,
            (delData.paymentSummary?.paymentCount || 1) - 1
          ),
          updatedAt: new Date(),
        });
      }
    }
  });
}

export async function recomputeDeliveryPaymentSummary(deliveryId) {
  const delRef = doc(db, "deliveries", deliveryId);
  const delSnap = await getDoc(delRef);
  if (!delSnap.exists()) throw new Error("Delivery not found");

  const delData = delSnap.data();
  const totalCharges = delData.totalCharges || 0;

  const q = query(
    collection(db, "paymentHistory"),
    where("deliveryId", "==", deliveryId)
  );
  const paySnap = await getDocs(q);

  let activePaid = 0;
  let activeCount = 0;
  let lastMode = null;
  let lastDate = null;
  let lastRef = null;

  paySnap.docs.forEach((d) => {
    const p = d.data();
    if (p.status !== "Voided") {
      activePaid += p.amount || 0;
      activeCount += 1;
      lastMode = p.paymentMode;
      lastDate = p.paymentDate;
      lastRef = p.utrNumber || p.chequeNumber || p.receivedBy || lastRef;
    }
  });

  const balance = Math.max(0, totalCharges - activePaid);
  const status =
    activePaid > totalCharges
      ? "Overpaid"
      : activePaid === totalCharges && totalCharges > 0
      ? "Paid"
      : activePaid > 0
      ? "Partially Paid"
      : "Unpaid";

  const updatedSummary = {
    totalCharges,
    totalPaid: activePaid,
    balance,
    status,
    lastPaymentMode: lastMode,
    lastPaymentDate: lastDate,
    lastReference: lastRef,
    paymentCount: activeCount,
  };

  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(delRef, {
    paymentSummary: updatedSummary,
    updatedAt: new Date(),
  });

  return updatedSummary;
}

export async function getPaymentsPaged({
  driverId = "",
  deliveryId = "",
  paymentMode = "",
  startDate = "",
  endDate = "",
  pageSize = 20,
  lastDoc = null,
} = {}) {
  let q = query(collection(db, "paymentHistory"), orderBy("recordedAt", "desc"));
  if (driverId) {
    q = query(q, where("driverId", "==", driverId));
  }
  if (deliveryId) {
    q = query(q, where("deliveryId", "==", deliveryId));
  }
  if (paymentMode) {
    q = query(q, where("paymentMode", "==", paymentMode));
  }
  if (startDate) {
    q = query(q, where("paymentDate", ">=", startDate));
  }
  if (endDate) {
    q = query(q, where("paymentDate", "<=", endDate));
  }
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  q = query(q, fsLimit(pageSize));

  const snap = await getDocs(q);
  const payments = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc: d }));
  return {
    payments,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function getDriverLedgerData(driverId) {
  // 1. Deliveries assigned to driver
  const delQ = query(
    collection(db, "deliveries"),
    where("driverId", "==", driverId)
  );
  const delSnap = await getDocs(delQ);
  let totalEarnings = 0;
  let completedCount = 0;
  let pendingCount = 0;

  delSnap.docs.forEach((d) => {
    const data = d.data();
    totalEarnings += data.totalCharges || 0;
    if (data.status === "Delivered") completedCount++;
    else if (data.status !== "Cancelled" && data.status !== "Failed") pendingCount++;
  });

  // 2. Payments made to driver
  const payQ = query(
    collection(db, "paymentHistory"),
    where("driverId", "==", driverId)
  );
  const paySnap = await getDocs(payQ);
  let totalPaid = 0;
  let advanceAmount = 0;

  const payments = paySnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.status !== "Voided");

  payments.forEach((p) => {
    totalPaid += p.amount || 0;
    if (p.type === "Advance") advanceAmount += p.amount || 0;
  });

  const outstandingBalance = Math.max(0, totalEarnings - totalPaid);

  return {
    totalDeliveries: delSnap.docs.length,
    completedDeliveries: completedCount,
    pendingDeliveries: pendingCount,
    totalEarnings,
    totalPaid,
    outstandingBalance,
    advanceAmount,
    recentPayments: payments.slice(0, 10),
  };
}
