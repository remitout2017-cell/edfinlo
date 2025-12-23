// src/pages/auth/ForgotPassword.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../../services/api";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.forgotPassword(email.toLowerCase());

      if (response.data?.success) {
        toast.success(response.data.message || "OTP sent to your email");
        // Navigate to reset password page with email as state
        navigate("/reset-password", { state: { email: email.toLowerCase() } });
      } else {
        toast.error(response.data?.message || "Failed to send OTP");
      }
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to send OTP. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
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
              Forgot Password?
            </h1>
            <p className="text-sm text-slate-300/80">
              Enter your email and we'll send you a 6-digit OTP to reset your
              password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
                  Sending OTP...
                </span>
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-xs text-slate-300/80 hover:text-emerald-300"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
