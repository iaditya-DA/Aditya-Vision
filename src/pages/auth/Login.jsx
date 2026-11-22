import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, authError } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = () => {
    const errs = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = "Enter a valid email";
    }

    if (!password) {
      errs.password = "Enter your password";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setLocalError(err.message || "Wrong email or password");
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
      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email Field */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-[#202124] mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: "" }));
                }
                if (localError) setLocalError("");
              }}
              placeholder="name@example.com"
              className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border transition-colors outline-none placeholder:text-gray-400 ${
                errors.email
                  ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                  : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
              }`}
            />
            {errors.email && (
              <p className="text-xs text-[#DC2626] mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-[#202124] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }
                  if (localError) setLocalError("");
                }}
                placeholder="Password"
                className={`w-full h-11 pl-3.5 pr-10 rounded-lg text-sm bg-white border transition-colors outline-none placeholder:text-gray-400 ${
                  errors.password
                    ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                    : "border-[#E5E7EB] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
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

          {/* Auth Failure Error Message */}
          {displayedError && (
            <p className="text-xs font-medium text-[#DC2626] pt-1">
              {displayedError}
            </p>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-lg bg-[#E53935] hover:bg-[#C62828] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:ring-offset-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
