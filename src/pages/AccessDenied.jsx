import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from "lucide-react";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";

const AccessDenied = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const fallbackRoute = hasPermission("dashboard")
    ? "/dashboard"
    : hasPermission("deliveries")
      ? "/deliveries"
      : "/login";

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-8 text-center shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto mb-4 border border-red-100">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-[#202124] tracking-tight">
          Access Restricted
        </h2>
        <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
          You do not possess the required module privileges to view this
          section.
        </p>

        {user && (
          <div className="my-5 p-3.5 rounded-xl bg-[#F8F9FB] border border-[#E5E7EB] text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Active Account</span>
              <span className="font-semibold text-[#202124]">{user.name}</span>
            </div>
            <div className="flex items-center justify-between text-[#6B7280]">
              <span>Assigned Role</span>
              <span className="font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-[#E53935]">
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Security Rule Note */}
        <div className="mb-6 p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-left flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900 leading-relaxed">
            <span className="font-semibold">Security Notice:</span> Frontend
            route guarding is for workflow presentation. Production data
            integrity and authorization will be enforced at the database level
            with Firebase Security Rules in Phase 2.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={LayoutDashboard}
            onClick={() => navigate(fallbackRoute)}
          >
            Return to Allowed Module
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
