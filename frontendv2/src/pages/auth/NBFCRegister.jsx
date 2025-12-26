// src/pages/auth/NBFCRegister.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import {
    User,
    Mail,
    Phone,
    Building2,
    Eye,
    EyeOff,
    ArrowRight,
} from "lucide-react";

const NBFCRegister = () => {
    const navigate = useNavigate();
    const { registerNBFC } = useAuth();

    const [formData, setFormData] = useState({
        companyName: "",
        email: "",
        phoneNumber: "",
        contactPersonName: "",
        contactPersonDesignation: "",
        password: "",
        confirmPassword: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const validate = () => {
        if (!formData.companyName.trim()) {
            toast.error("Company name is required");
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
                companyName: formData.companyName.trim(),
                email: formData.email.trim(),
                phoneNumber: formData.phoneNumber.trim() || undefined,
                password: formData.password,
                contactPerson: {
                    name: formData.contactPersonName.trim() || undefined,
                    designation: formData.contactPersonDesignation.trim() || undefined,
                },
            };

            const result = await registerNBFC(payload);

            if (result.success) {
                toast.success("NBFC registration successful!");
                navigate("/login", {
                    state: { userType: "nbfc", email: formData.email },
                });
            } else {
                toast.error(result.message || "Registration failed");
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
                    Create NBFC account
                </h2>
                <p className="text-xs text-slate-300/80">
                    Register your institution to receive and manage loan requests.
                </p>
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200">
                    Company Name *
                </label>
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                        className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder="Your NBFC / Bank name"
                    />
                </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-200">
                    Business Email *
                </label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder="contact@nbfc.com"
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
                        className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder="+91 98765 43210"
                    />
                </div>
            </div>

            {/* Contact Person */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-200">
                        Contact Person Name
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            name="contactPersonName"
                            value={formData.contactPersonName}
                            onChange={handleChange}
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-200">
                        Designation
                    </label>
                    <input
                        type="text"
                        name="contactPersonDesignation"
                        value={formData.contactPersonDesignation}
                        onChange={handleChange}
                        className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder="Manager"
                    />
                </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-200">
                        Password *
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
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
                        Confirm Password *
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            className="block w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            placeholder="Re-enter password"
                        />
                    </div>
                </div>
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/30 hover:from-orange-400 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full border-2 border-slate-900 border-b-transparent animate-spin" />
                            Creating NBFC account...
                        </span>
                    </>
                ) : (
                    <>
                        Create NBFC account
                        <ArrowRight className="h-4 w-4" />
                    </>
                )}
            </button>

            {/* Bottom links */}
            <div className="space-y-2 text-center text-xs text-slate-300/90 pt-1">
                <div>
                    Already registered?{" "}
                    <a
                        href="/login"
                        className="font-semibold text-orange-300 hover:text-orange-200"
                    >
                        Log in
                    </a>
                </div>
            </div>
        </form>
    );
};

export default NBFCRegister;
