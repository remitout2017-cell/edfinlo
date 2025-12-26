// src/pages/nbfc/Questionnaire.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
    LayoutDashboard,
    Settings,
    Users,
    Save,
    Loader,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Bell,
    LogOut,
} from "lucide-react";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
    ? rawBaseUrl.slice(0, -4)
    : rawBaseUrl.replace(/\/$/, "");

const Questionnaire = () => {
    const { user, logout, getAuthHeaders } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Collapsible sections
    const [expandedSections, setExpandedSections] = useState({
        cibil: true,
        foir: false,
        income: false,
        academics: false,
        tests: false,
        coBorrower: false,
        roi: false,
    });

    // Form state matching backend loanConfig schema
    const [config, setConfig] = useState({
        enabled: true,
        cibil: {
            minScore: 650,
            allowOverdue: false,
            checkBounceInOwnBank: false,
        },
        foir: {
            maxPercentage: 75,
            borderlineStart: 60,
            actionWhenBorderline: "Clarification",
        },
        incomeItr: {
            itrRequired: true,
            minAnnualIncome: 500000,
            minMonthlySalary: 0,
            itrYearsRequired: 2,
        },
        bankBalance: {
            required: false,
            minAvgBalance: 10000,
            statementMonthsRequired: 6,
        },
        academics: {
            minPercentage10th: 55,
            minPercentage12th: 55,
            minPercentageGrad: 55,
            maxGapYears: 2,
            gapYearsAction: "Clarification",
        },
        tests: {
            greMinScore: 0,
            ieltsMinScore: 0,
            toeflMinScore: 0,
            othersOptional: true,
        },
        coBorrower: {
            mandatory: true,
            allowedRelations: ["father", "mother", "brother", "sister", "spouse"],
        },
        roi: {
            minRate: 9.0,
            maxRate: 14.0,
            currency: "INR",
        },
    });

    useEffect(() => {
        fetchQuestionnaire();
    }, []);

    const fetchQuestionnaire = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${API_BASE_URL}/api/nbfc/questionnaire`,
                { headers: getAuthHeaders() }
            );

            if (response.data.success && response.data.data?.loanConfig) {
                setConfig((prev) => ({ ...prev, ...response.data.data.loanConfig }));
            }
        } catch (err) {
            console.error("Failed to fetch questionnaire:", err);
            setError(err.response?.data?.message || "Failed to load configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/nbfc/questionnaire`,
                { loanConfig: config },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                setSuccess("Configuration saved successfully!");
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save configuration");
        } finally {
            setSaving(false);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const updateConfig = (section, field, value) => {
        setConfig((prev) => ({
            ...prev,
            [section]: { ...prev[section], [field]: value },
        }));
    };

    // Collapsible Section Component
    const Section = ({ title, sectionKey, children }) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
            <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
            >
                <span className="font-semibold text-gray-800">{title}</span>
                {expandedSections[sectionKey] ? (
                    <ChevronUp className="text-gray-400" size={20} />
                ) : (
                    <ChevronDown className="text-gray-400" size={20} />
                )}
            </button>
            {expandedSections[sectionKey] && (
                <div className="p-4 pt-0 border-t border-gray-100">{children}</div>
            )}
        </div>
    );

    // Input Component
    const FormInput = ({ label, value, onChange, type = "number", ...props }) => (
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) =>
                    onChange(type === "number" ? Number(e.target.value) : e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                {...props}
            />
        </div>
    );

    // Toggle Component
    const FormToggle = ({ label, checked, onChange }) => (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative w-12 h-6 rounded-full transition ${checked ? "bg-orange-500" : "bg-gray-300"
                    }`}
            >
                <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${checked ? "translate-x-6" : ""
                        }`}
                />
            </button>
        </div>
    );

    // Select Component
    const FormSelect = ({ label, value, onChange, options }) => (
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="animate-spin mx-auto text-orange-500" size={48} />
                    <p className="mt-4 text-gray-600">Loading configuration...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-4">
                            <Link to="/nbfc/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">E</span>
                                </div>
                                <span className="text-xl font-bold text-gray-800">EDULOAN</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="p-2 text-gray-500 hover:text-gray-700">
                                <Bell className="h-5 w-5" />
                            </button>
                            <span className="text-sm font-medium text-gray-700">
                                {user?.companyName || "NBFC"}
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="flex">
                {/* Sidebar */}
                <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
                    <nav className="p-4 space-y-2">
                        <Link
                            to="/nbfc/dashboard"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl"
                        >
                            <LayoutDashboard className="h-5 w-5" />
                            Dashboard
                        </Link>
                        <Link
                            to="/nbfc/questionnaire"
                            className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium"
                        >
                            <Settings className="h-5 w-5" />
                            Loan Criteria
                        </Link>
                        <Link
                            to="/nbfc/students"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl"
                        >
                            <Users className="h-5 w-5" />
                            Students
                        </Link>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Loan Criteria Setup
                                </h1>
                                <p className="text-gray-600 text-sm mt-1">
                                    Configure your eligibility parameters for student matching
                                </p>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader className="animate-spin" size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>

                        {/* Alerts */}
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                                {success}
                            </div>
                        )}

                        {/* CIBIL Section */}
                        <Section title="CIBIL Score Requirements" sectionKey="cibil">
                            <div className="space-y-4 pt-4">
                                <FormInput
                                    label="Minimum CIBIL Score (300-900)"
                                    value={config.cibil.minScore}
                                    onChange={(v) => updateConfig("cibil", "minScore", v)}
                                    min={300}
                                    max={900}
                                />
                                <FormToggle
                                    label="Allow applicants with overdue history"
                                    checked={config.cibil.allowOverdue}
                                    onChange={(v) => updateConfig("cibil", "allowOverdue", v)}
                                />
                                <FormToggle
                                    label="Check for cheque bounce in own bank"
                                    checked={config.cibil.checkBounceInOwnBank}
                                    onChange={(v) =>
                                        updateConfig("cibil", "checkBounceInOwnBank", v)
                                    }
                                />
                            </div>
                        </Section>

                        {/* FOIR Section */}
                        <Section title="FOIR (Fixed Obligation to Income Ratio)" sectionKey="foir">
                            <div className="space-y-4 pt-4">
                                <FormInput
                                    label="Maximum FOIR Percentage"
                                    value={config.foir.maxPercentage}
                                    onChange={(v) => updateConfig("foir", "maxPercentage", v)}
                                    min={0}
                                    max={100}
                                />
                                <FormInput
                                    label="Borderline Start Percentage"
                                    value={config.foir.borderlineStart}
                                    onChange={(v) => updateConfig("foir", "borderlineStart", v)}
                                    min={0}
                                    max={100}
                                />
                                <FormSelect
                                    label="Action when Borderline"
                                    value={config.foir.actionWhenBorderline}
                                    onChange={(v) =>
                                        updateConfig("foir", "actionWhenBorderline", v)
                                    }
                                    options={["Clarification", "Rejected", "Approved"]}
                                />
                            </div>
                        </Section>

                        {/* Income Section */}
                        <Section title="Income & ITR Requirements" sectionKey="income">
                            <div className="space-y-4 pt-4">
                                <FormToggle
                                    label="ITR Required"
                                    checked={config.incomeItr.itrRequired}
                                    onChange={(v) => updateConfig("incomeItr", "itrRequired", v)}
                                />
                                <FormInput
                                    label="Minimum Annual Income (₹)"
                                    value={config.incomeItr.minAnnualIncome}
                                    onChange={(v) =>
                                        updateConfig("incomeItr", "minAnnualIncome", v)
                                    }
                                />
                                <FormInput
                                    label="Minimum Monthly Salary (₹)"
                                    value={config.incomeItr.minMonthlySalary}
                                    onChange={(v) =>
                                        updateConfig("incomeItr", "minMonthlySalary", v)
                                    }
                                />
                                <FormInput
                                    label="ITR Years Required"
                                    value={config.incomeItr.itrYearsRequired}
                                    onChange={(v) =>
                                        updateConfig("incomeItr", "itrYearsRequired", v)
                                    }
                                    min={0}
                                    max={5}
                                />
                            </div>
                        </Section>

                        {/* Academics Section */}
                        <Section title="Academic Requirements" sectionKey="academics">
                            <div className="space-y-4 pt-4">
                                <FormInput
                                    label="Minimum 10th Percentage"
                                    value={config.academics.minPercentage10th}
                                    onChange={(v) =>
                                        updateConfig("academics", "minPercentage10th", v)
                                    }
                                    min={0}
                                    max={100}
                                />
                                <FormInput
                                    label="Minimum 12th Percentage"
                                    value={config.academics.minPercentage12th}
                                    onChange={(v) =>
                                        updateConfig("academics", "minPercentage12th", v)
                                    }
                                    min={0}
                                    max={100}
                                />
                                <FormInput
                                    label="Minimum Graduation Percentage"
                                    value={config.academics.minPercentageGrad}
                                    onChange={(v) =>
                                        updateConfig("academics", "minPercentageGrad", v)
                                    }
                                    min={0}
                                    max={100}
                                />
                                <FormInput
                                    label="Maximum Gap Years Allowed"
                                    value={config.academics.maxGapYears}
                                    onChange={(v) => updateConfig("academics", "maxGapYears", v)}
                                    min={0}
                                    max={10}
                                />
                                <FormSelect
                                    label="Action when Gap Years Exceeded"
                                    value={config.academics.gapYearsAction}
                                    onChange={(v) =>
                                        updateConfig("academics", "gapYearsAction", v)
                                    }
                                    options={["Clarification", "Rejected", "Approved"]}
                                />
                            </div>
                        </Section>

                        {/* Tests Section */}
                        <Section title="Test Score Requirements" sectionKey="tests">
                            <div className="space-y-4 pt-4">
                                <FormInput
                                    label="Minimum GRE Score"
                                    value={config.tests.greMinScore}
                                    onChange={(v) => updateConfig("tests", "greMinScore", v)}
                                />
                                <FormInput
                                    label="Minimum IELTS Score"
                                    value={config.tests.ieltsMinScore}
                                    onChange={(v) => updateConfig("tests", "ieltsMinScore", v)}
                                />
                                <FormInput
                                    label="Minimum TOEFL Score"
                                    value={config.tests.toeflMinScore}
                                    onChange={(v) => updateConfig("tests", "toeflMinScore", v)}
                                />
                                <FormToggle
                                    label="Other tests optional"
                                    checked={config.tests.othersOptional}
                                    onChange={(v) => updateConfig("tests", "othersOptional", v)}
                                />
                            </div>
                        </Section>

                        {/* Co-Borrower Section */}
                        <Section title="Co-Borrower Requirements" sectionKey="coBorrower">
                            <div className="space-y-4 pt-4">
                                <FormToggle
                                    label="Co-Borrower Mandatory"
                                    checked={config.coBorrower.mandatory}
                                    onChange={(v) => updateConfig("coBorrower", "mandatory", v)}
                                />
                                <div className="text-sm text-gray-600">
                                    Allowed relations: {config.coBorrower.allowedRelations?.join(", ")}
                                </div>
                            </div>
                        </Section>

                        {/* ROI Section */}
                        <Section title="Interest Rate (ROI)" sectionKey="roi">
                            <div className="space-y-4 pt-4">
                                <FormInput
                                    label="Minimum Rate (%)"
                                    value={config.roi.minRate}
                                    onChange={(v) => updateConfig("roi", "minRate", v)}
                                    step="0.1"
                                />
                                <FormInput
                                    label="Maximum Rate (%)"
                                    value={config.roi.maxRate}
                                    onChange={(v) => updateConfig("roi", "maxRate", v)}
                                    step="0.1"
                                />
                            </div>
                        </Section>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Questionnaire;
