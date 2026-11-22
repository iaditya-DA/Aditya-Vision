/**
 * Shared payment-reference validation.
 * Used in UpdateStatusPage, DeliveryFormPage (section 6), and RecordPaymentPage.
 *
 * Rules per payment mode when driverPaid = true:
 *  UPI          -> utrNumber required, 8-22 alphanumeric
 *  Bank Transfer-> utrNumber required, 10-22 alphanumeric
 *  Cheque       -> chequeNumber required, bankName required
 *  Cash         -> receivedBy required (name of person who received)
 *  Other        -> reference required
 *
 * Also always requires: amount > 0 and (unless type=Advance) amount <= balanceDue.
 */

/** Returns an error object. Empty object = valid. */
export const validatePaymentFields = ({
  paymentMode = "",
  amount = "",
  paymentType = "",
  balanceDue = Infinity,
  utrNumber = "",
  chequeNumber = "",
  bankName = "",
  receivedBy = "",
  reference = "",
}) => {
  const errs = {};
  const amountNum = Number(amount);

  if (!amountNum || amountNum <= 0) {
    errs.amount = "Enter a valid amount";
  } else if (paymentType !== "Advance" && paymentType !== "Advance Payment" && amountNum > balanceDue) {
    errs.amount = `Amount cannot exceed balance due (₹${balanceDue})`;
  }

  const mode = paymentMode.toLowerCase();

  if (mode === "upi") {
    const val = utrNumber.trim();
    if (!val) {
      errs.utrNumber = "UTR / UPI Transaction ID is required";
    } else if (!/^[A-Za-z0-9]{8,22}$/.test(val)) {
      errs.utrNumber = "Must be 8-22 alphanumeric characters";
    }
  } else if (mode === "bank transfer") {
    const val = utrNumber.trim();
    if (!val) {
      errs.utrNumber = "UTR / Reference No. is required";
    } else if (!/^[A-Za-z0-9]{10,22}$/.test(val)) {
      errs.utrNumber = "Must be 10-22 alphanumeric characters";
    }
  } else if (mode === "cheque") {
    if (!chequeNumber.trim()) errs.chequeNumber = "Cheque number is required";
    if (!bankName.trim()) errs.bankName = "Bank name is required";
  } else if (mode === "cash") {
    if (!receivedBy.trim()) errs.receivedBy = "Name of receiver is required";
  } else if (mode === "other") {
    if (!reference.trim()) errs.reference = "Reference is required";
  }

  return errs;
};

/** Merge payment-field errors into a parent errors object. Returns true if valid. */
export const mergePaymentErrors = (parentErrs, paymentFields) => {
  const payErrs = validatePaymentFields(paymentFields);
  Object.assign(parentErrs, payErrs);
  return Object.keys(payErrs).length === 0;
};
