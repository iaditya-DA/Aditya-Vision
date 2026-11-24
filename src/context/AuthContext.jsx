import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { AuthContext } from "./authContextDef";
import {
  loginWithPhoneAndPassword,
  loginWithEmail,
  logoutUser,
  findUserByPhone,
  normalizePhone,
  isValidIndianMobile,
  isSyntheticInternalEmail,
} from "../services/authService";
import { ensureDefaultRoles, ALL_PERMISSIONS } from "../services/roleService";
import { ensureDefaultSettings } from "../services/settingsService";
import { Loader2 } from "lucide-react";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setAuthError("");
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        let userRef = doc(db, "users", fbUser.uid);
        let userSnap = await getDoc(userRef);

        // If direct UID lookup didn't find the user profile, check if this is a phone/synthetic email user
        // whose profile was provisioned by phone number or linked from an existing account
        if (!userSnap.exists()) {
          const rawEmail = fbUser.email || "";
          let phoneToFind = "";

          if (isSyntheticInternalEmail(rawEmail)) {
            phoneToFind = normalizePhone(rawEmail.split("@")[0]);
          } else if (fbUser.phoneNumber) {
            phoneToFind = normalizePhone(fbUser.phoneNumber);
          }

          if (phoneToFind) {
            const staffByPhone = await findUserByPhone(phoneToFind);
            if (staffByPhone) {
              const existingData = { ...staffByPhone };
              const originalDocId = staffByPhone.id;
              delete existingData.id;

              // Mirror / link user profile under fbUser.uid for instant O(1) lookups
              await setDoc(
                doc(db, "users", fbUser.uid),
                {
                  ...existingData,
                  linkedAuthUids: [
                    ...(staffByPhone.linkedAuthUids || []),
                    fbUser.uid,
                    originalDocId,
                  ],
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
              userSnap = await getDoc(doc(db, "users", fbUser.uid));
            }
          }
        }

        if (!userSnap.exists()) {
          await logoutUser();
          setUser(null);
          setAuthError("Account not registered in the system. Contact the administrator.");
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        const isInactive =
          userData.status === "Inactive" ||
          userData.status === "Disabled" ||
          userData.status === "Suspended" ||
          userData.isActive === false;

        if (isInactive) {
          await logoutUser();
          setUser(null);
          setAuthError("Your account has been deactivated or suspended. Please contact the Super Admin.");
          setLoading(false);
          return;
        }

        const userRole = userData.role || (userData.roleId === "role_super_admin" ? "Super Admin" : "Staff");
        const isSuper =
          userRole === "Super Admin" ||
          userData.roleId === "role_super_admin" ||
          userRole?.toLowerCase()?.trim() === "super admin" ||
          userRole?.toLowerCase()?.trim() === "superadmin" ||
          userRole?.toLowerCase()?.trim() === "super_admin" ||
          userRole?.toLowerCase()?.trim() === "admin";

        const mobileNumber =
          userData.mobile ||
          normalizePhone(userData.phone) ||
          (isSyntheticInternalEmail(fbUser.email) ? normalizePhone(fbUser.email.split("@")[0]) : "");

        const currentUser = {
          id: fbUser.uid,
          uid: fbUser.uid,
          code: userData.code || userData.id || "USR-0000",
          name: userData.name || fbUser.displayName || "Staff Member",
          mobile: mobileNumber,
          phone: userData.phone || (mobileNumber ? `+91${mobileNumber}` : ""),
          email: userData.email || (isSyntheticInternalEmail(fbUser.email) ? "" : fbUser.email || ""),
          role: userRole,
          roleId: userData.roleId || (isSuper ? "role_super_admin" : null),
          permissions: userData.permissions || (isSuper ? ALL_PERMISSIONS.map((p) => p.key) : []),
          status: userData.status || "Active",
          isActive: !isInactive,
          store: userData.store || userData.assignedStore || "Benipatti Branch",
          assignedStore: userData.assignedStore || userData.store || "Benipatti Branch",
          joinedDate: userData.joinedDate || "",
        };

        setUser(currentUser);

        // Bootstrap system roles and business settings on Super Admin first login
        if (isSuper) {
          ensureDefaultRoles().catch(console.error);
          ensureDefaultSettings().catch(console.error);
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
        setAuthError(err.message || "Failed to load user profile");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Unified login handler. Accepts Registered Mobile Number or Email + Password.
   * If mobile number is provided, automatically uses Phone + Password authentication.
   */
  const login = async (identifier, password) => {
    setAuthError("");
    const cleanInput = String(identifier || "").trim();

    if (isValidIndianMobile(cleanInput) || /^\d{10}$/.test(normalizePhone(cleanInput))) {
      return await loginWithPhoneAndPassword(cleanInput, password);
    }

    if (cleanInput.includes("@")) {
      return await loginWithEmail(cleanInput, password);
    }

    // Default to mobile login validation
    return await loginWithPhoneAndPassword(cleanInput, password);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const isSuperAdmin =
    user?.role === "Super Admin" ||
    user?.roleId === "role_super_admin" ||
    user?.role?.toLowerCase()?.trim() === "super admin" ||
    user?.role?.toLowerCase()?.trim() === "superadmin" ||
    user?.role?.toLowerCase()?.trim() === "super_admin" ||
    user?.role?.toLowerCase()?.trim() === "admin";

  /**
   * Resolves whether the current user has access to a specific permission key.
   * Supports both granular keys ('deliveries.view', 'drivers.approveDrivers')
   * and module aliases ('deliveries', 'drivers', 'reports', 'payments').
   */
  const hasPermission = (permissionKey) => {
    if (!user) return false;
    if (isSuperAdmin) return true;

    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

    // 1. Direct exact permission match
    if (userPerms.includes(permissionKey)) return true;

    // 2. Granular key check when user has legacy module-level grant
    if (permissionKey.includes(".")) {
      const [moduleName] = permissionKey.split(".");
      if (userPerms.includes(moduleName)) return true;
      if (moduleName === "payments" && (userPerms.includes("paymentRequests") || userPerms.includes("paymentHistory"))) {
        return true;
      }
    }

    // 3. Module-level alias check when user has granular permissions
    if (permissionKey === "dashboard") {
      return userPerms.includes("dashboard.view") || userPerms.includes("dashboard");
    }
    if (permissionKey === "van") {
      return (
        userPerms.includes("van.view") ||
        userPerms.includes("van.upload") ||
        userPerms.includes("van.search") ||
        userPerms.includes("van.export") ||
        userPerms.includes("van")
      );
    }
    if (permissionKey === "deliveries") {
      return (
        userPerms.includes("deliveries.view") ||
        userPerms.includes("deliveries.create") ||
        userPerms.includes("deliveries.edit") ||
        userPerms.includes("deliveries.delete") ||
        userPerms.includes("deliveries")
      );
    }
    if (permissionKey === "drivers") {
      return (
        userPerms.includes("drivers.view") ||
        userPerms.includes("drivers.create") ||
        userPerms.includes("drivers.edit") ||
        userPerms.includes("drivers.delete") ||
        userPerms.includes("drivers")
      );
    }
    if (permissionKey === "paymentRequests") {
      return (
        userPerms.includes("payments.view") ||
        userPerms.includes("payments.create") ||
        userPerms.includes("payments.approvePayments") ||
        userPerms.includes("paymentRequests")
      );
    }
    if (permissionKey === "paymentHistory") {
      return (
        userPerms.includes("payments.view") ||
        userPerms.includes("payments.create") ||
        userPerms.includes("payments.edit") ||
        userPerms.includes("paymentHistory")
      );
    }
    if (permissionKey === "payments") {
      return (
        userPerms.includes("payments.view") ||
        userPerms.includes("payments.create") ||
        userPerms.includes("payments.approvePayments") ||
        userPerms.includes("payments")
      );
    }
    if (permissionKey === "reports") {
      return (
        userPerms.includes("reports.view") ||
        userPerms.includes("reports.export") ||
        userPerms.includes("reports")
      );
    }
    if (permissionKey === "users") {
      return (
        userPerms.includes("users.view") ||
        userPerms.includes("users.create") ||
        userPerms.includes("users.edit") ||
        userPerms.includes("users.delete") ||
        userPerms.includes("users")
      );
    }
    if (permissionKey === "settings") {
      return (
        userPerms.includes("settings.view") ||
        userPerms.includes("settings.edit") ||
        userPerms.includes("settings")
      );
    }

    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#E53935] animate-spin" />
        <p className="text-sm font-medium text-[#6B7280]">
          Loading Aditya Vision...
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isSuperAdmin,
        loading,
        authError,
        setAuthError,
        login,
        loginWithPhoneAndPassword,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
