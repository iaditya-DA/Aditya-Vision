import { Outlet } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import BackgroundDecor from "../components/layout/BackgroundDecor";

const MainLayout = () => {
  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden">
      {/* Decorative background graphics */}
      <BackgroundDecor />

      {/* Centered Top Navigation Bar with dropdowns */}
      <Navbar />

      {/* Page Content */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
