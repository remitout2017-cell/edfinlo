// src/pages/auth/Register.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import ConsultantRegister from "./ConsultantRegister";
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
} from "lucide-react";

const Register = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteEmail = searchParams.get("email") || "";
  const inviteToken = searchParams.get("inviteToken") || "";
  const modeFromUrl = searchParams.get("mode"); // 'consultant' to open that tab directly

  const [activeTab, setActiveTab] = useState(
    modeFromUrl === "consultant" ? "consultant" : "student"
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
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    const result = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      phoneNumber: formData.phoneNumber,
      inviteToken: formData.inviteToken || undefined,
    });

    if (result.success) {
      navigate("/verify-email", { state: { email: formData.email } });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
      {/* Left: Hero (same structure as login) */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-sky-500/20 to-indigo-500/30 mix-blend-screen" />
        <div className="absolute -top-32 -right-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-xl space-y-8 px-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/40 bg-slate-900/40 backdrop-blur">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-100">
              One platform, two roles
            </span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight">
            Create your
            <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              EduLoan account
            </span>
          </h1>

          <p className="text-slate-200/80 text-sm leading-relaxed">
            Sign up either as a student to apply for loans or as a consultant to
            onboard and guide students through admission and finance workflows.
          </p>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-emerald-200">
                <GraduationCap className="h-4 w-4" />
                <span className="font-semibold">Student account</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• Build complete academic & KYC profile</li>
                <li>• Request & compare loan offers</li>
                <li>• Track admission & disbursement</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-sky-500/40 bg-slate-900/40 p-4 space-y-2">
              <div className="inline-flex items-center gap-2 text-sky-200">
                <Briefcase className="h-4 w-4" />
                <span className="font-semibold">Consultant account</span>
              </div>
              <ul className="space-y-1 text-slate-200/80">
                <li>• Send invites to students</li>
                <li>• Monitor loan & admission status</li>
                <li>• Collaborate with NBFC partners</li>
              </ul>
            </div>
          </div>

          {inviteEmail && (
            <div className="flex items-center gap-2 text-xs text-emerald-100 bg-slate-900/70 border border-emerald-400/50 rounded-2xl px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>
                You’ve been invited by a consultant. Continue sign-up with{" "}
                <span className="font-semibold">{inviteEmail}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Tabs + Forms */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md space-y-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 border border-slate-700 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setActiveTab("student")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition
                ${
                  activeTab === "student"
                    ? "bg-emerald-500 text-slate-900 font-semibold"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Student
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consultant")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition
                ${
                  activeTab === "consultant"
                    ? "bg-sky-500 text-slate-900 font-semibold"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Consultant
            </button>
          </div>

          {activeTab === "student" ? (
            <form onSubmit={handleStudentSubmit} className="space-y-5 mt-2">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  Create student account
                </h2>
                <p className="text-xs text-slate-300/80">
                  Use your primary email; you’ll verify it in the next step.
                </p>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-200">
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      placeholder="Aryan"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-200">
                    Last name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    placeholder="Madkar"
                  />
                </div>
              </div>

              {/* Email */}
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

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200">
                  Phone number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-2 gap-3">
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
                      onClick={() => setShowPassword((s) => !s)}
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
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-200">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <>
                    Create student account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Bottom links */}
              <div className="space-y-2 text-center text-xs text-slate-300/90 pt-1">
                <div>
                  Already registered?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Log in
                  </Link>
                </div>
                <div>
                  Want to onboard students instead?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("consultant")}
                    className="font-semibold text-sky-300 hover:text-sky-200"
                  >
                    Switch to consultant registration
                  </button>
                </div>
              </div>
            </form>
          ) : (
            // Use your existing ConsultantRegister but it will sit in the same right panel
            <ConsultantRegister />
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
