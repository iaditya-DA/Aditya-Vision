import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { isValidIndianMobile } from "../../services/authService";

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, authError, setAuthError } = useAuth();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // If already authenticated, redirect directly to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateForm = () => {
    const errs = {};
    const cleanDigits = mobile.replace(/\D/g, "");

    if (!cleanDigits) {
      errs.mobile = "Please enter your registered mobile number";
    } else if (!isValidIndianMobile(cleanDigits)) {
      errs.mobile = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }

    if (!password) {
      errs.password = "Enter your password";
    } else if (password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (setAuthError) setAuthError("");

    if (!validateForm()) return;

    const cleanDigits = mobile.replace(/\D/g, "");
    setIsSubmitting(true);

    try {
      await login(cleanDigits, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login failed:", err);
      const msg = err.message || "";
      if (
        msg.toLowerCase().includes("wrong") ||
        msg.toLowerCase().includes("incorrect") ||
        msg.toLowerCase().includes("user-not-found") ||
        msg.toLowerCase().includes("invalid-credential")
      ) {
        setLocalError("Incorrect mobile number or password. Please try again.");
      } else if (msg.toLowerCase().includes("disabled") || msg.toLowerCase().includes("deactivated")) {
        setLocalError("This account has been deactivated or suspended. Please contact the Super Admin.");
      } else if (msg.toLowerCase().includes("network")) {
        setLocalError("Network error. Please check your internet connection.");
      } else {
        setLocalError(msg || "Failed to authenticate. Please verify your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-center items-center px-4 sm:px-6">
      {/* Centered Brand Logo */}
      <div className="mb-6 flex justify-center">
        <img
          src="/assets/logo.png"
          alt="Aditya Vision"
          className="h-14 sm:h-16 w-auto object-contain"
        />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
        {/* Card Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124]">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Sign in to Aditya Vision Portal
          </p>
        </div>

        {/* Single Phone + Password Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Registered Mobile Number */}
          <div>
            <label
              htmlFor="login-mobile"
              className="block text-xs font-semibold text-[#202124] mb-1.5"
            >
              Registered Mobile Number
            </label>
            <div className="relative flex items-center">
              <span className="inline-flex items-center px-3.5 h-11 text-xs font-bold text-[#374151] bg-gray-50 border border-r-0 border-[#E5E7EB] rounded-l-lg select-none">
                +91
              </span>
              <input
                id="login-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setMobile(digits);
                  if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: "" }));
                  if (localError) setLocalError("");
                }}
                placeholder="Enter 10-digit mobile number"
                className={`w-full h-11 px-3.5 rounded-r-lg text-sm bg-white border transition-colors outline-none placeholder:text-gray-400 font-mono ${
                  errors.mobile
                    ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                    : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
                }`}
              />
            </div>
            {errors.mobile && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.mobile}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#202124]"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                  if (localError) setLocalError("");
                }}
                placeholder="Enter your password"
                className={`w-full h-11 pl-3.5 pr-10 rounded-lg text-sm bg-white border transition-colors outline-none placeholder:text-gray-400 ${
                  errors.password
                    ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                    : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.password}</p>
            )}
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs text-[#E53935] hover:text-[#C62828] font-medium hover:underline focus:outline-none cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Error Message Alert */}
          {displayedError && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-[#DC2626] leading-relaxed">
                {displayedError}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>LOGGING IN...</span>
                </>
              ) : (
                <span>LOGIN</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Guidance Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pt-2 pb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#202124]">Password Recovery</h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Aditya Vision Staff Credential Policy
              </p>
            </div>

            <div className="space-y-3 text-xs text-[#374151] leading-relaxed bg-[#F8F9FB] p-4 rounded-xl border border-[#E5E7EB]">
              <p>
                Aditya Vision staff accounts are authenticated exclusively using your <strong>Registered Mobile Number</strong> and encrypted password.
              </p>
              <p>
                To maintain portal security, self-service OTP and synthetic email resets are disabled.
              </p>
              <p className="font-semibold text-[#202124]">
                To reset your password:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[#4B5563]">
                <li>Contact your Branch Manager or System Super Admin.</li>
                <li>Your administrator will verify your staff credentials.</li>
                <li>A secure temporary password will be re-issued for your mobile number.</li>
              </ol>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full h-10 rounded-lg bg-[#E53935] hover:bg-[#C62828] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
