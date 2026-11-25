import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import MainLayout from "../layouts/MainLayout";
import Login from "../pages/auth/Login";
import Dashboard from "../pages/dashboard/Dashboard";
import Deliveries from "../pages/deliveries/Deliveries";
import DeliveryFormPage from "../pages/deliveries/DeliveryFormPage";
import DeliveryDetailPage from "../pages/deliveries/DeliveryDetailPage";
import UpdateStatusPage from "../pages/deliveries/UpdateStatusPage";
import Drivers from "../pages/drivers/Drivers";
import DriverFormPage from "../pages/drivers/DriverFormPage";
import DriverDetailPage from "../pages/drivers/DriverDetailPage";
import PaymentRequests from "../pages/payment-requests/PaymentRequests";
import PaymentRequestFormPage from "../pages/payment-requests/PaymentRequestFormPage";
import PaymentRequestDetailPage from "../pages/payment-requests/PaymentRequestDetailPage";
import PaymentHistory from "../pages/payment-history/PaymentHistory";
import RecordPaymentPage from "../pages/payment-history/RecordPaymentPage";
import PaymentDetailPage from "../pages/payment-history/PaymentDetailPage";
import UsersStaff from "../pages/users/UsersStaff";
import UserFormPage from "../pages/users/UserFormPage";
import UserDetailPage from "../pages/users/UserDetailPage";
import RoleFormPage from "../pages/users/RoleFormPage";
import Reports from "../pages/reports/Reports";
import SettingsPage from "../pages/settings/SettingsPage";
import DataManagementPage from "../pages/settings/DataManagementPage";
import VanSearchPage from "../pages/van/VanSearchPage";
import VanAdminPage from "../pages/van/VanAdminPage";
import AboutDeveloper from "../pages/AboutDeveloper";
import AccessDenied from "../pages/AccessDenied";
import NotFound from "../pages/NotFound";

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Permission Route Wrapper
const PermissionRoute = ({
  permissionKey,
  superAdminOnly = false,
  children,
}) => {
  const { hasPermission, isSuperAdmin } = useAuth();

  if (superAdminOnly && !isSuperAdmin) {
    return <AccessDenied />;
  }

  if (permissionKey && !hasPermission(permissionKey)) {
    return <AccessDenied />;
  }

  return children;
};

// Public Route (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes wrapped inside MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Default route redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* OVERVIEW */}
        <Route
          path="/dashboard"
          element={
            <PermissionRoute permissionKey="dashboard">
              <Dashboard />
            </PermissionRoute>
          }
        />

        {/* OPERATIONS MODULES */}
        <Route
          path="/deliveries"
          element={
            <PermissionRoute permissionKey="deliveries">
              <Deliveries />
            </PermissionRoute>
          }
        />
        <Route
          path="/deliveries/new"
          element={
            <PermissionRoute permissionKey="deliveries">
              <DeliveryFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/deliveries/:id/edit"
          element={
            <PermissionRoute permissionKey="deliveries" superAdminOnly={true}>
              <DeliveryFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/deliveries/:id"
          element={
            <PermissionRoute permissionKey="deliveries">
              <DeliveryDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/deliveries/:id/status"
          element={
            <PermissionRoute permissionKey="deliveries" superAdminOnly={true}>
              <UpdateStatusPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <PermissionRoute permissionKey="drivers">
              <Drivers />
            </PermissionRoute>
          }
        />
        <Route
          path="/drivers/new"
          element={
            <PermissionRoute permissionKey="drivers">
              <DriverFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/drivers/:id/edit"
          element={
            <PermissionRoute permissionKey="drivers">
              <DriverFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <PermissionRoute permissionKey="drivers">
              <DriverDetailPage />
            </PermissionRoute>
          }
        />

        {/* FINANCE MODULES */}
        <Route
          path="/payment-requests"
          element={
            <PermissionRoute permissionKey="paymentRequests">
              <PaymentRequests />
            </PermissionRoute>
          }
        />
        <Route
          path="/payment-requests/new"
          element={
            <PermissionRoute permissionKey="paymentRequests">
              <PaymentRequestFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/payment-requests/:id"
          element={
            <PermissionRoute permissionKey="paymentRequests">
              <PaymentRequestDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/payment-history"
          element={
            <PermissionRoute permissionKey="paymentHistory">
              <PaymentHistory />
            </PermissionRoute>
          }
        />
        <Route
          path="/payment-history/new"
          element={
            <PermissionRoute permissionKey="paymentHistory">
              <RecordPaymentPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/payment-history/:id"
          element={
            <PermissionRoute permissionKey="paymentHistory">
              <PaymentDetailPage />
            </PermissionRoute>
          }
        />

        {/* ADMINISTRATION MODULES */}
        <Route
          path="/users/roles/new"
          element={
            <PermissionRoute superAdminOnly={true}>
              <RoleFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/users/roles/:id/edit"
          element={
            <PermissionRoute superAdminOnly={true}>
              <RoleFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <PermissionRoute permissionKey="users.create">
              <UserFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/users/:id/edit"
          element={
            <PermissionRoute permissionKey="users.edit">
              <UserFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <PermissionRoute permissionKey="users.view">
              <UserDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/users"
          element={
            <PermissionRoute permissionKey="users.view">
              <UsersStaff />
            </PermissionRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PermissionRoute permissionKey="reports">
              <Reports />
            </PermissionRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PermissionRoute permissionKey="settings.view">
              <SettingsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/settings/data-management"
          element={
            <PermissionRoute superAdminOnly={true}>
              <DataManagementPage />
            </PermissionRoute>
          }
        />

        {/* VAN NUMBER / ITEM CODES */}
        <Route
          path="/van"
          element={
            <PermissionRoute permissionKey="van.view">
              <VanSearchPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/van/admin"
          element={
            <PermissionRoute superAdminOnly={true}>
              <VanAdminPage />
            </PermissionRoute>
          }
        />

        {/* ABOUT DEVELOPER */}
        <Route path="/about-developer" element={<AboutDeveloper />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
