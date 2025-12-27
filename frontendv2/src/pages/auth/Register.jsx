// src/pages/auth/Register.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import ConsultantRegister from "./ConsultantRegister";
import NBFCRegister from "./NBFCRegister";
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Building2,
} from "lucide-react";

const Register = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteEmail = searchParams.get("email") || "";
  const inviteToken = searchParams.get("inviteToken") || "";
  const modeFromUrl = searchParams.get("mode"); // 'consultant' to open that tab directly

  const [activeTab, setActiveTab] = useState(
    modeFromUrl === "consultant"
      ? "consultant"
      : modeFromUrl === "nbfc"
      ? "nbfc"
      : "student"
  );

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: inviteEmail,
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    inviteToken: inviteToken,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // ✅ NEW
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ NEW: Google student registration (actually same Google OAuth flow)
  const handleGoogleRegister = async () => {
    if (activeTab !== "student") {
      toast.error("Google sign up is only for students.");
      return;
    }
    try {
      setGoogleLoading(true);
      const response = await fetch("http://localhost:5000/api/auth/google/url");
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url; // go to Google
      } else {
        toast.error(data.message || "Failed to start Google sign up.");
      }
    } catch (error) {
      console.error("Google register error:", error);
      toast.error("Google sign up failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      // Determine endpoint based on invite token
      const endpoint = formData.inviteToken
        ? "http://localhost:5000/api/auth/register-from-invite"
        : "http://localhost:5000/api/auth/register";

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber || undefined,
      };

      // Add token if registering from invite
      if (formData.inviteToken) {
        payload.token = formData.inviteToken;
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.data.success) {
        toast.success(
          response.data.message ||
            "Registration successful! Please verify your email."
        );

        // Store token if you want to auto-login
        if (response.data.data?.token) {
          localStorage.setItem("token", response.data.data.token);
          localStorage.setItem(
            "user",
            JSON.stringify(response.data.data.student)
          );
        }

        // Navigate to verify email page (manual registration flow)
        navigate("/verify-email", {
          state: { email: formData.email },
        });
      } else {
        toast.error(response.data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Registration failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-start">
        {/* Left Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              Start your education finance journey
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Create your <span className="text-emerald-400">EduFinance</span>{" "}
              account
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-md">
              Sign up either as a student to apply for loans or as a consultant
              to onboard and guide students through admission and finance
              workflows.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Student applications</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Consultant workflows</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">NBFC integrations</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Right Section - Tabs + forms */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
          {/* Tabs */}
          <div className="flex mb-6 bg-slate-950/60 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("student")}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                activeTab === "student"
                  ? "bg-slate-900 text-emerald-300 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consultant")}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                activeTab === "consultant"
                  ? "bg-slate-900 text-emerald-300 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Consultant
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("nbfc")}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                activeTab === "nbfc"
                  ? "bg-slate-900 text-emerald-300 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              NBFC
            </button>
          </div>

          {/* Student registration */}
          {activeTab === "student" && (
            <div className="space-y-4">
              {/* ✅ Google Sign Up */}
              <button
                type="button"
                onClick={handleGoogleRegister}
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
                    <span>Sign up with Google</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500">
                When you sign up with Google, your email is auto-verified and
                you go directly to the dashboard. No OTP required.
              </p>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-900 text-slate-500">
                    Or sign up with email
                  </span>
                </div>
              </div>

              {/* Existing student form (unchanged layout) */}
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      name="firstName"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

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
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    name="phoneNumber"
                    placeholder="Phone number (optional but recommended)"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      className="w-full bg-slate-950/80 border border-slate-800 text-slate-100 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60"
                >
                  <span>Sign up as student</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {activeTab === "consultant" && (
            <ConsultantRegister inviteEmail={inviteEmail} />
          )}

          {activeTab === "nbfc" && <NBFCRegister />}
        </div>
      </div>
    </div>
  );
};

export default Register;
