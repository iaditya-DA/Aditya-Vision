import { db } from "../config/firebase";
import { doc, runTransaction } from "firebase/firestore";

/**
 * Generate human-readable sequential ID inside an existing or new transaction.
 * @param {string} entity 'delivery' | 'driver' | 'request' | 'payment' | 'user' | 'role'
 * @param {import("firebase/firestore").Transaction} [existingTx] Optional existing transaction
 * @returns {Promise<string>} e.g. DEL-2026-0001, DRV-0001, REQ-0001, PAY-0001, USR-0001, ROLE-001
 */
export async function generateEntityId(entity, existingTx = null) {
  const currentYear = new Date().getFullYear();

  const runner = async (tx) => {
    if (entity === "delivery") {
      const counterRef = doc(db, "counters", "deliveries");
      const snap = await tx.get(counterRef);
      let lastYear = currentYear;
      let lastSeq = 0;

      if (snap.exists()) {
        const data = snap.data();
        lastYear = data.lastYear || currentYear;
        lastSeq = data.lastSeq || 0;
      }

      const seq = lastYear === currentYear ? lastSeq + 1 : 1;
      tx.set(
        counterRef,
        { lastYear: currentYear, lastSeq: seq, updatedAt: new Date() },
        { merge: true }
      );
      return `DEL-${currentYear}-${String(seq).padStart(4, "0")}`;
    }

    const configs = {
      driver: { docId: "drivers", prefix: "DRV", pad: 4 },
      request: { docId: "paymentRequests", prefix: "REQ", pad: 4 },
      payment: { docId: "paymentHistory", prefix: "PAY", pad: 4 },
      user: { docId: "users", prefix: "USR", pad: 4 },
      role: { docId: "roles", prefix: "ROLE", pad: 3 },
    };

    const cfg = configs[entity];
    if (!cfg) throw new Error(`Unknown entity counter: ${entity}`);

    const counterRef = doc(db, "counters", cfg.docId);
    const snap = await tx.get(counterRef);
    const lastSeq = snap.exists() ? snap.data().lastSeq || 0 : 0;
    const nextSeq = lastSeq + 1;

    tx.set(
      counterRef,
      { lastSeq: nextSeq, updatedAt: new Date() },
      { merge: true }
    );
    return `${cfg.prefix}-${String(nextSeq).padStart(cfg.pad, "0")}`;
  };

  if (existingTx) {
    return await runner(existingTx);
  }
  return await runTransaction(db, runner);
}
