import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("🔹 GoogleCallback triggered:", location.search);

    const handleGoogleCallback = () => {
      try {
        // Parse ALL URL params
        const urlParams = new URLSearchParams(location.search);
        const token = urlParams.get("token");
        const error = urlParams.get("error");

        console.log("🔹 Frontend received:", {
          token: token ? `${token.substring(0, 20)}...` : "MISSING",
          error: error || "none",
          fullSearch: location.search,
        });

        // Error case
        if (error) {
          console.error("🔹 Google login error:", error);
          toast.error("❌ Google login failed. Please try again.");
          navigate("/login", { replace: true });
          return;
        }

        // SUCCESS case - token present
        if (token) {
          console.log("✅ Token received, saving to localStorage...");

          // Save token & metadata
          localStorage.setItem("token", token);
          localStorage.setItem("authProvider", "google");

          // Success toast
          toast.success("✅ Welcome back! Google login successful!");

          // Redirect to dashboard
          setTimeout(() => {
            navigate("/student/dashboard", { replace: true });
          }, 1500); // Small delay for toast visibility
        } else {
          // No token received
          console.error("❌ NO TOKEN IN URL:", location.search);
          toast.error("❌ Login failed - no token received");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error("💥 GoogleCallback ERROR:", err);
        toast.error("❌ Login processing failed");
        navigate("/login", { replace: true });
      }
    };

    // Run callback
    handleGoogleCallback();
  }, [location.search, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center p-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/50 max-w-md w-full mx-4">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Completing Login...
        </h2>
        <p className="text-gray-600">Finishing Google authentication</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
