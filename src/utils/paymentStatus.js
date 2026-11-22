/**
 * Pure calculation functions for delivery payment status and financial summary.
 * "Payment" = the payment Aditya Vision makes TO THE DRIVER for a delivery.
 *
 * Rules:
 * - Matching payments/requests to deliveries is strictly by deliveryId.
 * - Advance payments have deliveryId = null and count only in driver ledger.
 * - Rejected payment requests do NOT count as "request exists" (only Pending and Approved count).
 * - Voided payments do NOT count towards paid total.
 * - Unpaid (red): paid === 0 and payable > 0
 * - Partially Paid (orange): paid > 0 and paid < payable
 * - Paid (green): paid === payable (and payable > 0)
 * - Overpaid (purple): paid > payable
 * - Refunded (neutral): valid refund/cancellation
 */

/**
 * Calculates delivery payment status.
 *
 * @param {object} delivery
 * @param {Array} paymentRequests
 * @param {Array} paymentHistory
 * @returns {"Paid"|"Partially Paid"|"Unpaid"|"Overpaid"|"Refunded"|"Partially Refunded"|"Not Requested"}
 */
export const getDeliveryPaymentStatus = (
  delivery,
  paymentRequests = [],
  paymentHistory = [],
) => {
  if (!delivery) return "Unpaid";

  // Check if an active payment request exists (Pending or Approved)
  const deliveryId = delivery.id;
  const hasActiveRequest = (paymentRequests || []).some(
    (r) =>
      Boolean(r && r.deliveryId && r.deliveryId === deliveryId) &&
      (r.status === "Pending" || r.status === "Approved"),
  );

  // Use embedded summary status when present and valid
  const summaryStatus = delivery.paymentSummary?.status;
  if (
    summaryStatus &&
    [
      "Paid",
      "Partially Paid",
      "Unpaid",
      "Overpaid",
      "Refunded",
      "Partially Refunded",
    ].includes(summaryStatus)
  ) {
    return summaryStatus;
  }

  // If status is legacy "Partial", map to "Partially Paid"
  if (summaryStatus === "Partial") {
    return "Partially Paid";
  }

  // Check refunded delivery status
  if (
    delivery.status === "Cancelled" ||
    delivery.status === "Returned" ||
    delivery.isRefunded
  ) {
    return "Refunded";
  }

  const charges =
    (Number(delivery.deliveryCharges) || 0) +
    (Number(delivery.additionalCharges) || 0) ||
    Number(delivery.totalCharges) ||
    0;

  // If no deliveryId or summary directly provides totalPaid
  if (delivery.paymentSummary && typeof delivery.paymentSummary.totalPaid === "number") {
    const totalPaid = Number(delivery.paymentSummary.totalPaid) || 0;
    if (charges === 0 && totalPaid === 0) return "Unpaid";
    if (totalPaid === 0) return "Unpaid";
    if (totalPaid > charges) return "Overpaid";
    if (totalPaid === charges) return "Paid";
    return "Partially Paid";
  }

  if (!deliveryId) return "Unpaid";

  // Match payments strictly by deliveryId, excluding voided
  const payments = (paymentHistory || []).filter(
    (p) =>
      Boolean(p && p.deliveryId && p.deliveryId === deliveryId) &&
      p.status !== "Voided",
  );

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );

  if (charges === 0 && totalPaid === 0) {
    return hasActiveRequest ? "Unpaid" : "Unpaid";
  }

  if (totalPaid > charges && charges > 0) {
    return "Overpaid";
  }

  if (totalPaid === charges && charges > 0) {
    return "Paid";
  }

  if (totalPaid > 0 && totalPaid < charges) {
    return "Partially Paid";
  }

  return "Unpaid";
};

// Alias export for backward and component compatibility
export const getPaymentStatus = getDeliveryPaymentStatus;

/**
 * Calculates financial summary for a delivery.
 *
 * @param {object} delivery
 * @param {Array} paymentRequests
 * @param {Array} paymentHistory
 * @returns {{
 *   charges: number,
 *   totalPaid: number,
 *   balanceDue: number,
 *   status: string,
 *   lastPayment: object|null,
 *   payments: Array
 * }}
 */
export const getDeliveryPaymentSummary = (
  delivery,
  paymentRequests = [],
  paymentHistory = [],
) => {
  if (!delivery) {
    return {
      charges: 0,
      totalPaid: 0,
      balanceDue: 0,
      status: "Unpaid",
      lastPayment: null,
      payments: [],
    };
  }

  const deliveryId = delivery.id;
  const charges =
    (Number(delivery.deliveryCharges) || 0) +
    (Number(delivery.additionalCharges) || 0) ||
    Number(delivery.totalCharges) ||
    0;

  const payments = (paymentHistory || [])
    .filter(
      (p) =>
        Boolean(p && p.deliveryId && p.deliveryId === deliveryId) &&
        p.status !== "Voided",
    )
    .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));

  const totalPaid = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );

  const balanceDue = Math.max(0, charges - totalPaid);
  const status = getDeliveryPaymentStatus(
    delivery,
    paymentRequests,
    paymentHistory,
  );
  const lastPayment = payments.length > 0 ? payments[0] : null;

  return {
    charges,
    totalPaid,
    balanceDue,
    status,
    lastPayment,
    payments,
  };
};
