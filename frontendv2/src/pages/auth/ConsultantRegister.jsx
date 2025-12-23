// src/pages/auth/ConsultantRegister.jsx
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

const ConsultantRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  // Data coming from invite redirect (RegisterFromInvite / Register page)
  const inviteEmail = location.state?.email || "";
  const inviteToken = location.state?.inviteToken || null;

  const [formData, setFormData] = useState({
    name: "",
    email: inviteEmail,
    phoneNumber: "",
    companyName: "",
    designation: "",
    experienceYears: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If inviteEmail present later (after mount), sync it
  useEffect(() => {
    if (inviteEmail) {
      setFormData((prev) => ({ ...prev, email: inviteEmail }));
    }
  }, [inviteEmail]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validate = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      toast.error("Enter a valid email");
      return false;
    }
    if (!formData.companyName.trim()) {
      toast.error("Company name is required");
      return false;
    }
    if (!formData.designation.trim()) {
      toast.error("Designation is required");
      return false;
    }
    if (
      !formData.experienceYears ||
      Number.isNaN(Number(formData.experienceYears))
    ) {
      toast.error("Experience years must be a number");
      return false;
    }
    if (
      Number(formData.experienceYears) < 0 ||
      Number(formData.experienceYears) > 50
    ) {
      toast.error("Experience years must be between 0 and 50");
      return false;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim() || undefined,
        companyName: formData.companyName.trim(),
        designation: formData.designation.trim(),
        experienceYears: Number(formData.experienceYears),
        password: formData.password,
        // important: send inviteToken if present
        inviteToken: inviteToken || undefined,
      };

      const result = await register(payload, "consultant");

      if (result.success) {
        toast.success(
          "Consultant registration successful! Please verify your email."
        );
        navigate("/verify-email", {
          state: { email: formData.email, userType: "consultant" },
        });
      }
    } catch (error) {
      const message = error?.message || "Registration failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 mt-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Create consultant account
        </h2>
        <p className="text-xs text-slate-300/80">
          Onboard students, manage profiles and track loans from one
          dashboard.
        </p>
      </div>
      {/* Personal */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-200">
          Full name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            placeholder="Your full name"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-200">
          Work email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            readOnly={!!inviteEmail} // lock when coming from invite
            className={`block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 ${inviteEmail ? "opacity-80 cursor-not-allowed" : ""
              }`}
            placeholder="you@company.com"
          />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-200">
          Phone (optional)
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      {/* Company + Designation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-200">
            Company / firm
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="Consultancy name"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-200">
            Designation
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              required
              className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="Founder / Counselor"
            />
          </div>
        </div>
      </div>

      {/* Experience */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-200">
          Experience (years)
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="number"
            name="experienceYears"
            value={formData.experienceYears}
            onChange={handleChange}
            min={0}
            max={50}
            required
            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            placeholder="5"
          />
        </div>
      </div>

      {/* Passwords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-200">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="At least 8 characters"
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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="Re-enter password"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/30 hover:from-sky-400 hover:to-indigo-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
              Creating consultant account...
            </span>
          </>
        ) : (
          <>
            Create consultant account
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Bottom links */}
      <div className="space-y-2 text-center text-xs text-slate-300/90 pt-1">
        <div>
          Already registered?{" "}
          <a
            href="/login?mode=consultant"
            className="font-semibold text-sky-300 hover:text-sky-200"
          >
            Log in
          </a>
        </div>
      </div>
    </form>
  );
};

export default ConsultantRegister;
