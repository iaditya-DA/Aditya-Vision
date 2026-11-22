import { useContext } from "react";
import { PaymentsContext } from "../context/paymentsContextDef";

export const usePayments = () => {
  const context = useContext(PaymentsContext);
  if (!context) {
    throw new Error("usePayments must be used within a PaymentsProvider");
  }
  return context;
};

export default usePayments;
