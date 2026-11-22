import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export async function getSavedReports(ownerUid) {
  if (!ownerUid) return [];
  const q = query(
    collection(db, "savedReports"),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc")
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("getSavedReports warning:", err);
    return [];
  }
}

export async function saveCustomReport(ownerUid, reportDef) {
  const reportId = `REP-${Date.now()}`;
  const ref = doc(db, "savedReports", reportId);
  await setDoc(ref, {
    id: reportId,
    ownerUid,
    name: reportDef.name || "Untitled Report",
    definition: reportDef,
    createdAt: serverTimestamp(),
  });
  return reportId;
}

export async function deleteSavedReport(reportId) {
  const ref = doc(db, "savedReports", reportId);
  await deleteDoc(ref);
}
