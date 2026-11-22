import Input from "./Input";
import Select from "./Select";

const PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Other",
];

/**
 * Reusable Payment Details form fields component.
 * Used for recording driver payments with mode-specific requirements.
 *
 * @param {object} props
 * @param {object} props.values - { paymentMode, amount, paymentDate, utrNumber, upiId, bankName, chequeNumber, receivedBy, reference, notes }
 * @param {function} props.onChange - (field, value) => void
 * @param {object} [props.errors] - validation error map
 * @param {number} [props.balanceDue] - available balance due for hint
 * @param {boolean} [props.disabled] - disable all inputs
 * @param {string} [props.className] - container className
 */
const PaymentDetailsFields = ({
  values = {},
  onChange,
  errors = {},
  balanceDue = 0,
  disabled = false,
  className = "",
}) => {
  const currentMode = values.paymentMode || "UPI";

  const handleChange = (field) => (e) => {
    if (onChange) {
      onChange(field, e.target.value);
    }
  };

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Primary Row: Mode, Amount, Date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Payment Mode */}
        <Select
          label="Payment Mode"
          value={currentMode}
          onChange={handleChange("paymentMode")}
          options={PAYMENT_MODES}
          error={errors.paymentMode}
          disabled={disabled}
          required
        />

        {/* Amount Paid */}
        <div>
          <Input
            label="Amount Paid (₹)"
            type="number"
            min="1"
            step="any"
            value={values.amount ?? ""}
            onChange={handleChange("amount")}
            placeholder={balanceDue ? String(balanceDue) : "Amount"}
            error={errors.amount}
            disabled={disabled}
            required
          />
          {balanceDue > 0 && (
            <p className="text-[11px] text-[#6B7280] mt-1">
              Balance due: <span className="font-semibold text-[#202124]">₹{balanceDue}</span>
            </p>
          )}
        </div>

        {/* Payment Date */}
        <Input
          label="Payment Date"
          type="date"
          value={values.paymentDate || new Date().toISOString().split("T")[0]}
          onChange={handleChange("paymentDate")}
          error={errors.paymentDate}
          disabled={disabled}
          required
        />
      </div>

      {/* Mode-specific Fields Row */}
      {currentMode === "UPI" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
          <Input
            label="UTR / UPI Transaction ID"
            value={values.utrNumber || ""}
            onChange={handleChange("utrNumber")}
            placeholder="e.g. 412398291048"
            error={errors.utrNumber}
            disabled={disabled}
            required
          />
          <Input
            label="UPI ID (Optional)"
            value={values.upiId || ""}
            onChange={handleChange("upiId")}
            placeholder="driver@okhdfcbank"
            error={errors.upiId}
            disabled={disabled}
          />
        </div>
      )}

      {currentMode === "Bank Transfer" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
          <Input
            label="UTR / Reference No."
            value={values.utrNumber || ""}
            onChange={handleChange("utrNumber")}
            placeholder="e.g. NEFT/PUNBR5202611"
            error={errors.utrNumber}
            disabled={disabled}
            required
          />
          <Input
            label="Bank Name (Optional)"
            value={values.bankName || ""}
            onChange={handleChange("bankName")}
            placeholder="e.g. State Bank of India"
            error={errors.bankName}
            disabled={disabled}
          />
        </div>
      )}

      {currentMode === "Cheque" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
          <Input
            label="Cheque Number"
            value={values.chequeNumber || ""}
            onChange={handleChange("chequeNumber")}
            placeholder="e.g. 000492"
            error={errors.chequeNumber}
            disabled={disabled}
            required
          />
          <Input
            label="Bank Name"
            value={values.bankName || ""}
            onChange={handleChange("bankName")}
            placeholder="e.g. HDFC Bank Ltd"
            error={errors.bankName}
            disabled={disabled}
            required
          />
        </div>
      )}

      {currentMode === "Cash" && (
        <div className="bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
          <Input
            label="Received By (Optional)"
            value={values.receivedBy || ""}
            onChange={handleChange("receivedBy")}
            placeholder="Driver signature / cash hand-over note"
            error={errors.receivedBy}
            disabled={disabled}
          />
        </div>
      )}

      {currentMode === "Other" && (
        <div className="bg-[#FAFBFD] p-3 rounded-xl border border-[#E5E7EB]">
          <Input
            label="Reference"
            value={values.reference || ""}
            onChange={handleChange("reference")}
            placeholder="Voucher or manual voucher code"
            error={errors.reference}
            disabled={disabled}
            required
          />
        </div>
      )}
    </div>
  );
};

export default PaymentDetailsFields;
