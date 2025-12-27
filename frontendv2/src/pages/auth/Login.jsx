// src/pages/auth/Login.jsx - Uses AuthContext for all login types
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Shield,
  Building2,
} from "lucide-react";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    userType: "student",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // ✅ NEW
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use AuthContext login method - handles all user types
      const result = await login(
        formData.email,
        formData.password,
        formData.userType
      );

      if (result.success) {
        toast.success("Login successful!");

        // Check verification status for students (email/pass flow only)
        if (formData.userType === "student") {
          const student = result.data?.user;
          if (student && !student.isEmailVerified) {
            toast.error("Please verify your email first");
            navigate("/verify-email", { state: { email: formData.email } });
            return;
          }
          if (student?.phoneNumber && !student.isPhoneVerified) {
            toast.error("Please verify your phone number");
            navigate("/verify-phone");
            return;
          }
        }

        // Navigate based on user type - use window.location for full reload
        // This ensures all contexts re-read the token from localStorage
        switch (formData.userType) {
          case "student":
            window.location.href = "/student";
            break;
          case "consultant":
            window.location.href = "/consultant/dashboard";
            break;
          case "admin":
            window.location.href = "/admin/dashboard";
            break;
          case "nbfc":
            window.location.href = "/nbfc/dashboard";
            break;
          default:
            window.location.href = "/dashboard";
        }
      } else {
        toast.error(result.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please check your credentials.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Google OAuth login (students only)
  const handleGoogleLogin = async () => {
    if (formData.userType !== "student") {
      toast.error("Google login is available for students only.");
      return;
    }
    try {
      setGoogleLoading(true);
      const response = await fetch("http://localhost:5000/api/auth/google/url");
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url; // redirect to Google
      } else {
        toast.error(data.message || "Failed to start Google login.");
      }
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Google login failed. Please try again.");
    } finally {
      // do not reset here if redirecting, but safe for error cases
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Marketing / description */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              Secure education finance platform
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Log into your <span className="text-emerald-400">EduFinance</span>{" "}
              account
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-md">
              Log in as a student, consultant or admin to manage education
              journeys, loan workflows, and platform operations.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Student loan workflows</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Consultant operations</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">NBFC management</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Use your registered email and password to continue.
          </p>
        </div>

        {/* Right side - Login form */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="space-y-2 mb-6">
            <h2 className="text-xl font-semibold text-slate-50">
              Welcome back
            </h2>
            <p className="text-sm text-slate-400">
              Choose your role and log in to continue.
            </p>
          </div>

          {/* User type toggle */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {["student", "consultant", "admin", "nbfc"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, userType: type }))
                }
                className={`text-xs px-2 py-2 rounded-lg border transition-colors ${
                  formData.userType === type
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700"
                }`}
              >
                {type === "student"
                  ? "Student"
                  : type === "consultant"
                  ? "Consultant"
                  : type === "admin"
                  ? "Admin"
                  : "NBFC"}
              </button>
            ))}
          </div>

          {/* ✅ Google login button - only meaningful for student, but visible for all */}
          {formData.userType === "student" && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition text-sm text-slate-100 disabled:opacity-60"
              >
                {googleLoading ? (
                  <span className="text-xs">Redirecting to Google...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
              <p className="mt-1 text-[11px] text-slate-500">
                No email/phone OTP needed when signing in with Google.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-500">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <Link
                to="/forgot-password"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60"
            >
              <span>Sign in</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500 text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
