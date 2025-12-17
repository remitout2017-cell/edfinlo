import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Home1 from "../components/Home/Home1";
import Home2 from "../components/Home/Home2";
import Home3 from "../components/Home/Hero3";
import Home4 from "../components/Home/Hero4";
import Home5 from "../components/Home/Hero5";
import Home6 from "../components/Home/Home6";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";
const Home = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // If authenticated, redirect to dashboard based on role
    if (isAuthenticated && user) {
      const roleRoutes = {
        student: "/student/dashboard",
        admin: "/admin/dashboard",
        superadmin: "/admin/dashboard",
        subadmin: "/admin/dashboard",
        nbfc: "/nbfc/dashboard",
        consultant: "/consultant/dashboard",
      };

      const dashboardRoute = roleRoutes[user.role?.toLowerCase()] || "/login";
      navigate(dashboardRoute, { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Show blank page or a simple loader
  return (
    <div className="min-h-screen bg-white">
      {/* Blank page - you can add a loader if you want */}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
      <Navbar />
      <Home1 />
      <Home2 />
      <Home3 />
      <Home4 />
      <Home5 />
      <Home6 />
      <Footer />
    </div>
  );
};

export default Home;
