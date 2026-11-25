import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import BackgroundDecor from "../components/layout/BackgroundDecor";
import DeveloperFooter from "../components/DeveloperFooter";

const MainLayout = () => {
  const location = useLocation();
  const isVanRoute = location.pathname === "/van";

  return (
    <div
      className={`relative min-h-screen flex flex-col overflow-x-hidden ${
        isVanRoute ? "bg-[#F9FAFB]" : ""
      }`}
    >
      {/* Decorative background graphics: suppressed on /van for a calm, neutral surface */}
      {!isVanRoute && <BackgroundDecor />}

      {/* Centered Top Navigation Bar with dropdowns */}
      <Navbar />

      {/* Page Content */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto flex flex-col">
        <div className="flex-1">
          <Outlet />
        </div>
        <DeveloperFooter />
      </main>
    </div>
  );
};

export default MainLayout;
