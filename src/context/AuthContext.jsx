import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { AuthContext } from "./authContextDef";
import { loginWithEmail, logoutUser } from "../services/authService";
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
        const userRef = doc(db, "users", fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await logoutUser();
          setUser(null);
          setAuthError("Account not registered in the system. Contact the administrator.");
          setLoading(false);
          return;
        }

        const userData = userSnap.data();
        if (userData.status === "Inactive") {
          await logoutUser();
          setUser(null);
          setAuthError("Account deactivated. Contact the administrator.");
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

        const currentUser = {
          id: fbUser.uid,
          uid: fbUser.uid,
          code: userData.code || userData.id || "USR-0000",
          name: userData.name || fbUser.email?.split("@")[0] || "User",
          email: userData.email || fbUser.email,
          mobile: userData.mobile || userData.phone || "",
          role: userRole,
          roleId: userData.roleId || (isSuper ? "role_super_admin" : null),
          permissions: userData.permissions || (isSuper ? ALL_PERMISSIONS.map((p) => p.key) : []),
          status: userData.status || "Active",
          store: userData.store || "",
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

  const login = async (email, password) => {
    setAuthError("");
    await loginWithEmail(email, password);
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
    // e.g. checking 'deliveries.view' when user has 'deliveries'
    if (permissionKey.includes(".")) {
      const [moduleName] = permissionKey.split(".");
      if (userPerms.includes(moduleName)) return true;
      if (moduleName === "payments" && (userPerms.includes("paymentRequests") || userPerms.includes("paymentHistory"))) {
        return true;
      }
    }

    // 3. Module-level alias check when user has granular permissions
    // e.g. checking 'deliveries' when user has 'deliveries.view' or 'deliveries.create'
    if (permissionKey === "dashboard") {
      return userPerms.includes("dashboard.view") || userPerms.includes("dashboard");
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
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
