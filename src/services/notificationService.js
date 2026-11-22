import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export async function createNotification(notifData) {
  const notifsCol = collection(db, "notifications");
  await addDoc(notifsCol, {
    type: notifData.type,
    title: notifData.title,
    lines: Array.isArray(notifData.lines) ? notifData.lines : [],
    deliveryId: notifData.deliveryId || null,
    driverId: notifData.driverId || null,
    requestId: notifData.requestId || null,
    createdBy: notifData.createdBy || null,
    createdByName: notifData.createdByName || null,
    recipientRole: notifData.recipientRole || null,
    recipientUid: notifData.recipientUid || null,
    readBy: {},
    createdAt: serverTimestamp(),
  });
}

export function subscribeUserNotifications(user, callback) {
  if (!user) return () => {};

  let q;
  if (user.role === "Super Admin") {
    q = query(
      collection(db, "notifications"),
      where("recipientRole", "==", "Super Admin"),
      orderBy("createdAt", "desc"),
      fsLimit(30)
    );
  } else {
    q = query(
      collection(db, "notifications"),
      where("recipientUid", "==", user.uid || user.id),
      orderBy("createdAt", "desc"),
      fsLimit(30)
    );
  }

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const isRead = Boolean(data.readBy && data.readBy[user.uid || user.id]);
        return {
          id: d.id,
          ...data,
          unread: !isRead,
          time: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Just now",
        };
      });
      callback(list);
    },
    (err) => {
      console.warn("Notifications subscription warning:", err);
      callback([]);
    }
  );
}

export async function markNotificationAsRead(notifId, uid) {
  const ref = doc(db, "notifications", notifId);
  await updateDoc(ref, {
    [`readBy.${uid}`]: true,
  });
}

export async function markAllNotificationsAsRead(notifications, uid) {
  const promises = notifications
    .filter((n) => n.unread)
    .map((n) => markNotificationAsRead(n.id, uid));
  await Promise.all(promises);
}
