import { useState, useEffect, useCallback, useMemo } from "react";
import { PaymentsContext } from "./paymentsContextDef";
import { getPaymentRequestsPaged, createPaymentRequest, reviewPaymentRequest } from "../services/requestService";
import { getPaymentsPaged, addPaymentTx, voidPaymentTx } from "../services/paymentService";
import { getDeliveryPaymentStatus, getDeliveryPaymentSummary } from "../utils/paymentStatus";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";

export const PaymentsProvider = ({ children }) => {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshPayments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [reqsResult, paysResult] = await Promise.all([
        getPaymentRequestsPaged({ pageSize: 50 }),
        getPaymentsPaged({ pageSize: 50 }),
      ]);
      setPaymentRequests(reqsResult.requests);
      setPaymentHistory(paysResult.payments);
    } catch (err) {
      console.warn("Failed to load payments data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshPayments();
    });
  }, [refreshPayments]);

  const addPaymentRequest = useCallback(
    async (requestData) => {
      try {
        const id = await createPaymentRequest({
          ...requestData,
          creator: user,
        });
        toast.success(`Payment request ${id} submitted`);
        await refreshPayments();
        return id;
      } catch (err) {
        toast.error(err.message || "Failed to submit payment request");
        throw err;
      }
    },
    [user, toast, refreshPayments]
  );

  const approvePaymentRequest = useCallback(
    async (requestId) => {
      try {
        await reviewPaymentRequest(requestId, true, "", user);
        toast.success(`Payment request ${requestId} approved`);
        await refreshPayments();
      } catch (err) {
        toast.error(err.message || "Failed to approve payment request");
        throw err;
      }
    },
    [user, toast, refreshPayments]
  );

  const rejectPaymentRequest = useCallback(
    async (requestId, reason) => {
      try {
        await reviewPaymentRequest(requestId, false, reason, user);
        toast.success(`Payment request ${requestId} rejected`);
        await refreshPayments();
      } catch (err) {
        toast.error(err.message || "Failed to reject payment request");
        throw err;
      }
    },
    [user, toast, refreshPayments]
  );

  const addPayment = useCallback(
    async (paymentData) => {
      try {
        const id = await addPaymentTx({
          ...paymentData,
          recorder: user,
        });
        toast.success(`Payment ${id} recorded`);
        await refreshPayments();
        return id;
      } catch (err) {
        toast.error(err.message || "Failed to record payment");
        throw err;
      }
    },
    [user, toast, refreshPayments]
  );

  const voidPayment = useCallback(
    async (paymentId, voidReason) => {
      try {
        await voidPaymentTx(paymentId, voidReason, user);
        toast.success(`Payment ${paymentId} voided`);
        await refreshPayments();
      } catch (err) {
        toast.error(err.message || "Failed to void payment");
        throw err;
      }
    },
    [user, toast, refreshPayments]
  );

  const getStatus = useCallback(
    (delivery) => {
      if (!delivery) return "Not Requested";
      if (delivery.paymentSummary?.status) {
        return delivery.paymentSummary.status;
      }
      return getDeliveryPaymentStatus(delivery, paymentRequests, paymentHistory);
    },
    [paymentRequests, paymentHistory]
  );

  const getSummary = useCallback(
    (delivery) => {
      if (!delivery) {
        return {
          totalCharges: 0,
          paidAmount: 0,
          balance: 0,
          status: "Not Requested",
          payments: [],
          requests: [],
        };
      }
      return getDeliveryPaymentSummary(delivery, paymentRequests, paymentHistory);
    },
    [paymentRequests, paymentHistory]
  );

  const value = useMemo(
    () => ({
      paymentRequests,
      paymentHistory,
      loading,
      refreshPayments,
      addPaymentRequest,
      approvePaymentRequest,
      rejectPaymentRequest,
      addPayment,
      voidPayment,
      getDeliveryPaymentStatus: getStatus,
      getPaymentStatus: getStatus,
      getDeliveryPaymentSummary: getSummary,
      isSuperAdmin,
    }),
    [
      paymentRequests,
      paymentHistory,
      loading,
      refreshPayments,
      addPaymentRequest,
      approvePaymentRequest,
      rejectPaymentRequest,
      addPayment,
      voidPayment,
      getStatus,
      getSummary,
      isSuperAdmin,
    ]
  );

  return (
    <PaymentsContext.Provider value={value}>
      {children}
    </PaymentsContext.Provider>
  );
};

export default PaymentsProvider;
