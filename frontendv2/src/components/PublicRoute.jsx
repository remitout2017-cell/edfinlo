import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show nothing while loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If authenticated, redirect to appropriate dashboard
  if (isAuthenticated && user) {
    const roleRoutes = {
      student: "/student/dashboard",
      admin: "/admin/dashboard",
      superadmin: "/admin/dashboard",
      subadmin: "/admin/dashboard",
      nbfc: "/nbfc/dashboard",
      consultant: "/consultant/dashboard",
    };

    const dashboardRoute = roleRoutes[user.role?.toLowerCase()] || "/";
    return <Navigate to={dashboardRoute} replace />;
  }

  // Not authenticated, show the public page
  return children;
};
