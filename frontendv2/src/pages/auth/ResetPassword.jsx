// src/pages/auth/ResetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { authAPI } from "../../services/api";
import toast from "react-hot-toast";
import { Lock, KeyRound, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from navigation state (from ForgotPassword page)
  const emailFromState = location.state?.email || "";

  const [formData, setFormData] = useState({
    email: emailFromState,
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If no email in state, redirect back to forgot password
    if (!emailFromState) {
      toast.error("Please enter your email first");
      navigate("/forgot-password");
    }
  }, [emailFromState, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.otp || formData.otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.resetPassword(
        formData.email,
        formData.otp,
        formData.newPassword
      );

      if (response.data?.success) {
        toast.success("Password reset successful! Please login.");
        navigate("/login");
      } else {
        toast.error(response.data?.message || "Failed to reset password");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await authAPI.forgotPassword(formData.email);
      if (response.data?.success) {
        toast.success("New OTP sent to your email");
      }
    } catch (error) {
      toast.error("Failed to resend OTP");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Reset Password
            </h1>
            <p className="text-sm text-slate-300/80">
              Enter the OTP sent to{" "}
              <span className="font-medium text-emerald-300">{formData.email}</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* OTP Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                6-Digit OTP
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  maxLength={6}
                  required
                  autoFocus
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 tracking-widest text-center font-mono"
                  placeholder="• • • • • •"
                />
              </div>
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                Didn't receive OTP? Resend
              </button>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 pr-9 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Min 8 characters"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Re-enter password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
                  Resetting...
                </span>
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Back link */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1 text-xs text-slate-300/80 hover:text-emerald-300"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to forgot password
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
