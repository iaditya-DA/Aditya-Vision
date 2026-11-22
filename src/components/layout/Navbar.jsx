import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Truck,
  Users,
  FileCheck,
  History,
  UserCog,
  BarChart3,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  Database,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../../services/notificationService";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    logout,
    isSuperAdmin,
    hasPermission,
  } = useAuth();

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = subscribeUserNotifications(user, (list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, [user]);

  const unreadNotificationsCount = notifications.filter((n) => n.unread).length;

  // Desktop dropdown states
  const [openDropdown, setOpenDropdown] = useState(null); // 'operations' | 'finance' | 'admin' | null
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAccordions, setMobileAccordions] = useState({
    operations: true,
    finance: false,
    admin: false,
  });

  const navRef = useRef(null);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const closeAllMenus = () => {
    setOpenDropdown(null);
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation (Escape key closes dropdowns)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAllMenus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Check permissions
  const canDashboard = isSuperAdmin || hasPermission("dashboard");
  const canDeliveries = isSuperAdmin || hasPermission("deliveries");
  const canDrivers = isSuperAdmin || hasPermission("drivers");
  const canPaymentRequests = isSuperAdmin || hasPermission("paymentRequests");
  const canPaymentHistory = isSuperAdmin || hasPermission("paymentHistory");
  const canUsers = isSuperAdmin || hasPermission("users.view") || hasPermission("users");
  const canReports = isSuperAdmin || hasPermission("reports");
  const canSettings = isSuperAdmin || hasPermission("settings.view") || hasPermission("settings");

  // Group definitions with friendly one-line descriptions
  const operationsItems = [
    canDeliveries && {
      name: "Deliveries",
      path: "/deliveries",
      icon: Truck,
      description: "Track and manage customer deliveries",
    },
    canDrivers && {
      name: "Drivers",
      path: "/drivers",
      icon: Users,
      description: "Fleet driver roster, vehicles & wage balances",
    },
  ].filter(Boolean);

  const financeItems = [
    canPaymentRequests && {
      name: "Payment Requests",
      path: "/payment-requests",
      icon: FileCheck,
      description: "Driver payment requisitions & approvals",
    },
    canPaymentHistory && {
      name: "Payment History",
      path: "/payment-history",
      icon: History,
      description: "Disbursement records & driver payout ledger",
    },
  ].filter(Boolean);

  const adminItems = [
    canUsers && {
      name: "Users & Staff",
      path: "/users",
      icon: UserCog,
      description: "Staff accounts & custom role permissions",
    },
    canReports && {
      name: "Reports",
      path: "/reports",
      icon: BarChart3,
      description: "Business analytics & custom report builder",
    },
    canSettings && {
      name: "Settings",
      path: "/settings",
      icon: SettingsIcon,
      description: "Business profile, policies & credentials",
    },
    isSuperAdmin && {
      name: "Data Management",
      path: "/settings/data-management",
      icon: Database,
      description: "Archive, purge & audit system records",
    },
  ].filter(Boolean);

  // Active state helpers
  const isDashboardActive = location.pathname === "/dashboard";
  const isOperationsActive = ["/deliveries", "/drivers"].includes(
    location.pathname,
  );
  const isFinanceActive = ["/payment-requests", "/payment-history"].includes(
    location.pathname,
  );
  const isAdminActive = [
    "/users",
    "/reports",
    "/settings",
    "/settings/data-management",
  ].some((p) => location.pathname.startsWith(p));

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const toggleMobileAccordion = (key) => {
    setMobileAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-xs border-b border-[#E5E7EB]/80 shadow-2xs">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* ========================================================= */}
        {/* 1. LEFT COLUMN: Official Logo */}
        {/* ========================================================= */}
        <div className="flex items-center justify-start shrink-0">
          <Link
            to="/dashboard"
            onClick={closeAllMenus}
            className="flex items-center shrink-0 focus:outline-hidden group"
            title="Aditya Vision - Home"
          >
            <img
              src="/assets/logo.png"
              alt="Aditya Vision"
              className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>
        </div>

        {/* ========================================================= */}
        {/* 2. CENTER: Clean Top Navigation Bar with Underline       */}
        {/* ========================================================= */}
        <div className="hidden md:flex items-center justify-center flex-1 px-4">
          <nav ref={navRef} className="flex items-center gap-6 lg:gap-8">
            {/* Dashboard Link */}
            {canDashboard && (
              <Link
                to="/dashboard"
                onClick={closeAllMenus}
                className={`
                  relative py-2 text-sm sm:text-base font-semibold transition-all duration-150
                  ${
                    isDashboardActive
                      ? "text-[#202124] font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#202124]"
                      : "text-[#6B7280] hover:text-[#202124]"
                  }
                `}
              >
                Dashboard
              </Link>
            )}

            {/* Operations Dropdown */}
            {operationsItems.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown("operations")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDropdown("operations");
                    }
                  }}
                  className={`
                    relative py-2 text-sm sm:text-base font-semibold transition-all duration-150 inline-flex items-center gap-1 cursor-pointer
                    ${
                      isOperationsActive
                        ? "text-[#202124] font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#202124]"
                        : "text-[#6B7280] hover:text-[#202124]"
                    }
                  `}
                  aria-expanded={openDropdown === "operations"}
                >
                  <span>Operations</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openDropdown === "operations" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openDropdown === "operations" && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-2 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    <div className="space-y-1">
                      {operationsItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={closeAllMenus}
                            className={`
                              flex items-start gap-3 p-2.5 rounded-xl transition-all
                              ${
                                isActive
                                  ? "bg-[#FFF1F0] text-[#E53935]"
                                  : "text-[#202124] hover:bg-gray-50"
                              }
                            `}
                          >
                            <div
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                                ${
                                  isActive
                                    ? "bg-[#E53935] text-white"
                                    : "bg-gray-100 text-[#6B7280]"
                                }
                              `}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold ${
                                  isActive ? "text-[#E53935]" : "text-[#202124]"
                                }`}
                              >
                                {item.name}
                              </div>
                              <p className="text-[11px] text-[#6B7280] leading-snug line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Finance Dropdown */}
            {financeItems.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown("finance")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDropdown("finance");
                    }
                  }}
                  className={`
                    relative py-2 text-sm sm:text-base font-semibold transition-all duration-150 inline-flex items-center gap-1 cursor-pointer
                    ${
                      isFinanceActive
                        ? "text-[#202124] font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#202124]"
                        : "text-[#6B7280] hover:text-[#202124]"
                    }
                  `}
                  aria-expanded={openDropdown === "finance"}
                >
                  <span>Finance</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openDropdown === "finance" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openDropdown === "finance" && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-2 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    <div className="space-y-1">
                      {financeItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={closeAllMenus}
                            className={`
                              flex items-start gap-3 p-2.5 rounded-xl transition-all
                              ${
                                isActive
                                  ? "bg-[#FFF1F0] text-[#E53935]"
                                  : "text-[#202124] hover:bg-gray-50"
                              }
                            `}
                          >
                            <div
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                                ${
                                  isActive
                                    ? "bg-[#E53935] text-white"
                                    : "bg-gray-100 text-[#6B7280]"
                                }
                              `}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold ${
                                  isActive ? "text-[#E53935]" : "text-[#202124]"
                                }`}
                              >
                                {item.name}
                              </div>
                              <p className="text-[11px] text-[#6B7280] leading-snug line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Administration Dropdown */}
            {adminItems.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown("admin")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDropdown("admin");
                    }
                  }}
                  className={`
                    relative py-2 text-sm sm:text-base font-semibold transition-all duration-150 inline-flex items-center gap-1 cursor-pointer
                    ${
                      isAdminActive
                        ? "text-[#202124] font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#202124]"
                        : "text-[#6B7280] hover:text-[#202124]"
                    }
                  `}
                  aria-expanded={openDropdown === "admin"}
                >
                  <span>Administration</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      openDropdown === "admin" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {openDropdown === "admin" && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-2 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    <div className="space-y-1">
                      {adminItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={closeAllMenus}
                            className={`
                              flex items-start gap-3 p-2.5 rounded-xl transition-all
                              ${
                                isActive
                                  ? "bg-[#FFF1F0] text-[#E53935]"
                                  : "text-[#202124] hover:bg-gray-50"
                              }
                            `}
                          >
                            <div
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                                ${
                                  isActive
                                    ? "bg-[#E53935] text-white"
                                    : "bg-gray-100 text-[#6B7280]"
                                }
                              `}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold ${
                                  isActive ? "text-[#E53935]" : "text-[#202124]"
                                }`}
                              >
                                {item.name}
                              </div>
                              <p className="text-[11px] text-[#6B7280] leading-snug line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* ========================================================= */}
        {/* 3. RIGHT COLUMN: Notifications + User Avatar + Mobile Toggle */}
        {/* ========================================================= */}
        <div className="flex items-center justify-end gap-2.5">
          {/* Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              className="relative p-2 text-[#6B7280] hover:text-[#202124] hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Notifications & Pending Approvals"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#E53935] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl py-2 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#202124]">
                      Notifications
                    </span>
                    <span className="text-xs bg-[#FFF1F0] text-[#E53935] font-semibold px-2 py-0.5 rounded-full">
                      {unreadNotificationsCount}
                    </span>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsAsRead(notifications, user?.uid || user?.id)}
                      className="text-xs text-[#E53935] hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#6B7280]">
                      No new notifications or activity alerts.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markNotificationAsRead(notif.id, user?.uid || user?.id);
                          setNotificationsOpen(false);
                          if (notif.deliveryId) navigate(`/deliveries/${notif.deliveryId}`);
                          else if (notif.driverId) navigate(`/drivers/${notif.driverId}`);
                          else if (notif.requestId) navigate("/payment-requests");
                        }}
                        className={`
                          p-3 text-xs hover:bg-gray-50 cursor-pointer transition-colors
                          ${notif.unread ? "bg-[#FFF1F0]/40 font-medium" : "text-[#6B7280]"}
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[#202124] font-semibold">
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-[#6B7280] shrink-0">
                            {notif.time}
                          </span>
                        </div>
                        {Array.isArray(notif.lines) && notif.lines.map((line, lIdx) => (
                          <p key={lIdx} className="text-[11px] text-[#6B7280] mt-0.5">
                            {line}
                          </p>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar & Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-gray-100 transition-all cursor-pointer border border-[#E5E7EB] bg-white shadow-2xs"
              title="User Account"
            >
              <div className="w-8 h-8 rounded-full bg-[#E53935] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                  : "AV"}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl py-2 z-50 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                {/* User Info Header */}
                <div className="px-4 py-2.5 border-b border-[#E5E7EB]">
                  <p className="text-sm font-bold text-[#202124] truncate">
                    {user?.name || "Aditya Kumar"}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">
                    {user?.email || "admin@adityavision.in"}
                  </p>
                  <div className="mt-2">
                    <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FFF1F0] text-[#E53935]">
                      {user?.role || "Super Admin"}
                    </span>
                  </div>
                </div>

                {/* Profile Links */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      closeAllMenus();
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#202124] hover:bg-gray-50 transition-colors cursor-pointer text-left"
                  >
                    <User className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>My Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      closeAllMenus();
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#202124] hover:bg-gray-50 transition-colors cursor-pointer text-left"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Account Settings</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-[#E5E7EB] pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      closeAllMenus();
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer text-left font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-[#6B7280] hover:bg-gray-100 hover:text-[#202124] transition-colors cursor-pointer"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-[#E53935]" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. MOBILE / TABLET ACCORDION DRAWER */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E5E7EB] shadow-xl max-h-[calc(100vh-72px)] overflow-y-auto animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 space-y-2">
            {/* Dashboard Link */}
            {canDashboard && (
              <Link
                to="/dashboard"
                onClick={closeAllMenus}
                className={`
                  flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors
                  ${
                    isDashboardActive
                      ? "bg-[#E53935] text-white shadow-2xs"
                      : "text-[#202124] hover:bg-gray-50"
                  }
                `}
              >
                <span>Dashboard</span>
              </Link>
            )}

            {/* Mobile Operations Accordion */}
            {operationsItems.length > 0 && (
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion("operations")}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold transition-colors
                    ${
                      isOperationsActive
                        ? "text-[#E53935] bg-[#FFF1F0]/60"
                        : "text-[#202124] bg-gray-50/70"
                    }
                  `}
                >
                  <span>Operations</span>
                  {mobileAccordions.operations ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                {mobileAccordions.operations && (
                  <div className="p-2 space-y-1 bg-white">
                    {operationsItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={closeAllMenus}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors
                            ${
                              isActive
                                ? "bg-[#FFF1F0] text-[#E53935]"
                                : "text-[#202124] hover:bg-gray-50"
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Finance Accordion */}
            {financeItems.length > 0 && (
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion("finance")}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold transition-colors
                    ${
                      isFinanceActive
                        ? "text-[#E53935] bg-[#FFF1F0]/60"
                        : "text-[#202124] bg-gray-50/70"
                    }
                  `}
                >
                  <span>Finance</span>
                  {mobileAccordions.finance ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                {mobileAccordions.finance && (
                  <div className="p-2 space-y-1 bg-white">
                    {financeItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={closeAllMenus}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors
                            ${
                              isActive
                                ? "bg-[#FFF1F0] text-[#E53935]"
                                : "text-[#202124] hover:bg-gray-50"
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Administration Accordion */}
            {adminItems.length > 0 && (
              <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleMobileAccordion("admin")}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold transition-colors
                    ${
                      isAdminActive
                        ? "text-[#E53935] bg-[#FFF1F0]/60"
                        : "text-[#202124] bg-gray-50/70"
                    }
                  `}
                >
                  <span>Administration</span>
                  {mobileAccordions.admin ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                {mobileAccordions.admin && (
                  <div className="p-2 space-y-1 bg-white">
                    {adminItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={closeAllMenus}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors
                            ${
                              isActive
                                ? "bg-[#FFF1F0] text-[#E53935]"
                                : "text-[#202124] hover:bg-gray-50"
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
