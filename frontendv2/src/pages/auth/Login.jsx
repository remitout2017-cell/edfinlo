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

        // Check verification status for students
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

  if (loading) {
    return <span className="loading loading-infinity loading-lg"></span>;
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
      {/* Left Hero - Updated with Admin */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-sky-500/20 to-indigo-500/30 mix-blend-screen" />
        <div className="absolute -top-32 -right-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-xl space-y-8 px-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/40 bg-slate-900/40 backdrop-blur">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-100">
              Smart education loan orchestration
            </span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight">
            Welcome back to{" "}
            <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              EduLoan Intelligence
            </span>
          </h1>
          <p className="text-slate-200/80 text-sm leading-relaxed">
            Log in as a student, consultant or admin to manage education
            journeys, loan workflows, and platform operations.
          </p>

          {/* Updated with Admin card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-emerald-200">
                <GraduationCap className="h-4 w-4" />
                <span className="font-semibold">For Students</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• Centralized KYC profile</li>
                <li>• Multi-NBFC loan comparison</li>
                <li>• Consultant guided workflows</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-sky-200">
                <Briefcase className="h-4 w-4" />
                <span className="font-semibold">For Consultants</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• Student onboarding invites</li>
                <li>• Loan request monitoring</li>
                <li>• Real-time notifications</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-purple-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-purple-200">
                <Shield className="h-4 w-4" />
                <span className="font-semibold">For Admins</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• Platform oversight</li>
                <li>• NBFC approvals</li>
                <li>• User management</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-orange-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-orange-200">
                <Building2 className="h-4 w-4" />
                <span className="font-semibold">For NBFCs</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• View loan requests</li>
                <li>• Send proposals</li>
                <li>• Manage disbursements</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Log in to your account
            </h2>
            <p className="text-xs text-slate-300/80">
              Use your registered email and password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-6">
            {/* User Type Toggle - Updated with Admin */}
            <div className="grid grid-cols-4 gap-2 text-xs bg-slate-900/80 border border-slate-700 rounded-2xl p-1">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, userType: "student" })
                }
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition ${formData.userType === "student"
                  ? "bg-emerald-500 text-slate-900 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
                  }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Student
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, userType: "consultant" })
                }
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition ${formData.userType === "consultant"
                  ? "bg-sky-500 text-slate-900 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
                  }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Consultant
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: "admin" })}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition ${formData.userType === "admin"
                  ? "bg-purple-500 text-slate-900 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
                  }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: "nbfc" })}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition ${formData.userType === "nbfc"
                  ? "bg-orange-500 text-slate-900 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
                  }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                NBFC
              </button>
            </div>

            {/* Email & Password fields */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !formData.email || !formData.password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="space-y-2 text-center text-xs text-slate-300/90 pt-1">
            <div>
              New student?{" "}
              <Link
                to="/register"
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Create student account
              </Link>
            </div>
            <div>
              Want to onboard students?{" "}
              <Link
                to="/register?mode=consultant"
                className="font-semibold text-sky-300 hover:text-sky-200"
              >
                Register as consultant
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
