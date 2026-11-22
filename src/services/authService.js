import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail as fbSendReset,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../config/firebase";

export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    const code = err.code || "";
    if (
      code === "auth/invalid-credential" ||
      code === "auth/user-not-found" ||
      code === "auth/wrong-password" ||
      code === "auth/invalid-email"
    ) {
      throw new Error("Wrong email or password", { cause: err });
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts, try later", { cause: err });
    }
    if (code === "auth/network-request-failed") {
      throw new Error("No internet connection", { cause: err });
    }
    throw new Error(err.message || "Failed to sign in", { cause: err });
  }
}

export async function logoutUser() {
  await fbSignOut(auth);
}

export async function sendUserPasswordReset(email) {
  await fbSendReset(auth, email.trim());
}

export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No active user session");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPassword);
}
