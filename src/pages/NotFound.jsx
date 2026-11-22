import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Button from "../components/common/Button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#FFF1F0] flex items-center justify-center text-[#E53935] mb-4 shadow-xs">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-[#202124] tracking-tight">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-sm text-[#6B7280] max-w-md">
        The page you are looking for does not exist or has been moved within the
        Aditya Vision portal.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
