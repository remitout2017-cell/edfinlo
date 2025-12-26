// src/pages/nbfc/RequestDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
    User,
    Phone,
    Mail,
    MapPin,
    ChevronDown,
    ChevronUp,
    Download,
    ArrowLeft,
    Loader,
    FileText,
    GraduationCap,
    Briefcase,
    Users,
    Building2,
    Send,
    MessageSquare,
    XCircle,
    CheckCircle,
} from "lucide-react";

// Use environment variable with fallback
const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
    ? rawBaseUrl.slice(0, -4)
    : rawBaseUrl.replace(/\/$/, "");

const RequestDetail = () => {
    const { requestId } = useParams();
    const navigate = useNavigate();
    const { getAuthHeaders } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [requestData, setRequestData] = useState(null);

    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        kycDocuments: false,
        academicMarksheets: false,
        securedAdmissions: false,
        workExperience: false,
        coBorrowerDocs: false,
        salariedDocs: false,
        businessDocs: false,
    });

    // Modal states
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [proposalData, setProposalData] = useState({
        offeredAmount: "",
        offeredRoi: "",
        remarks: "",
    });
    const [rejectReason, setRejectReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchRequestDetails();
    }, [requestId]);

    const fetchRequestDetails = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${API_BASE_URL}/api/nbfc/loan-requests/${requestId}`,
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                setRequestData(response.data.request);
            }
        } catch (err) {
            console.error("Failed to fetch request details:", err);
            setError(err.response?.data?.message || "Failed to load request details");
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const handleSendProposal = async () => {
        if (!proposalData.offeredAmount || !proposalData.offeredRoi) {
            alert("Please fill in all required fields");
            return;
        }

        setSubmitting(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/nbfc/loan-requests/${requestId}/decide`,
                {
                    decision: "approved",
                    offeredAmount: parseFloat(proposalData.offeredAmount),
                    offeredRoi: parseFloat(proposalData.offeredRoi),
                    reason: proposalData.remarks,
                },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                alert("Proposal sent successfully!");
                setShowProposalModal(false);
                navigate("/nbfc/dashboard");
            }
        } catch (err) {
            alert(err.response?.data?.message || "Failed to send proposal");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        setSubmitting(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/nbfc/loan-requests/${requestId}/decide`,
                {
                    decision: "rejected",
                    reason: rejectReason,
                },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                alert("Request rejected");
                setShowRejectModal(false);
                navigate("/nbfc/dashboard");
            }
        } catch (err) {
            alert(err.response?.data?.message || "Failed to reject request");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader className="animate-spin mx-auto text-purple-600" size={48} />
                    <p className="mt-4 text-gray-600">Loading request details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <XCircle className="mx-auto text-red-500" size={48} />
                    <p className="mt-4 text-red-600">{error}</p>
                    <button
                        onClick={() => navigate("/nbfc/dashboard")}
                        className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const student = requestData?.student || {};
    const studyPlan = student.studyPlan || {};

    // Collapsible Section Component
    const CollapsibleSection = ({ title, sectionKey, icon: Icon, children }) => (
        <div className="border-b border-gray-200">
            <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between py-4 px-2 hover:bg-gray-50 transition"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="text-gray-500" size={18} />}
                    <span className="font-medium text-gray-800">{title}</span>
                </div>
                {expandedSections[sectionKey] ? (
                    <ChevronUp className="text-gray-400" size={20} />
                ) : (
                    <ChevronDown className="text-gray-400" size={20} />
                )}
            </button>
            {expandedSections[sectionKey] && (
                <div className="px-4 pb-4 bg-gray-50">{children}</div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate("/nbfc/dashboard")}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <ArrowLeft className="text-gray-600" size={20} />
                            </button>
                            <h1 className="text-xl font-semibold text-gray-800">
                                Request Details
                            </h1>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                            {requestData?.status || "pending"}
                        </span>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Student Profile */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Profile Photo Placeholder */}
                            <div className="h-32 bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                                <div className="w-20 h-20 bg-purple-200 rounded-full flex items-center justify-center">
                                    <User className="text-purple-500" size={40} />
                                </div>
                            </div>

                            <div className="p-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-4">
                                    Student Profile
                                </h2>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="text-gray-500 text-sm w-24">Unique ID:</span>
                                        <span className="font-mono text-sm text-gray-900">
                                            {student._id?.slice(-10).toUpperCase() || "N/A"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <User className="text-gray-400" size={16} />
                                        <span className="text-gray-900">
                                            {student.firstName} {student.lastName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Phone className="text-gray-400" size={16} />
                                        <span className="text-gray-900">
                                            {student.phoneNumber || "N/A"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Mail className="text-gray-400" size={16} />
                                        <span className="text-gray-900 text-sm break-all">
                                            {student.email || "N/A"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <MapPin className="text-gray-400" size={16} />
                                        <span className="text-gray-900">
                                            {student.kycData?.permanentAddress?.state || "N/A"}
                                        </span>
                                    </div>
                                </div>

                                <hr className="my-4" />

                                <h3 className="font-semibold text-gray-800 mb-3">Education</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">1. Course</span>
                                        <span className="text-gray-900">
                                            {studyPlan.intendedCourse || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">2. University</span>
                                        <span className="text-gray-900">
                                            {studyPlan.targetUniversity || "N/A"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Application Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Application Details Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-orange-500 mb-6">
                                Application Details
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        1. Country of preference
                                    </label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        {studyPlan.targetCountry || "N/A"}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        2. Type of Degree
                                    </label>
                                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg">
                                        <span className="w-3 h-3 bg-orange-400 rounded-sm"></span>
                                        <span className="text-gray-900">
                                            {studyPlan.degreeLevel || "N/A"}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        3. Duration of the course
                                    </label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        {studyPlan.courseDurationMonths || "N/A"} months
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        4. Loan amount required
                                    </label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                                        ₹{(studyPlan.estimatedTotalCost || 0).toLocaleString("en-IN")}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        5. Referral Code
                                    </label>
                                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-mono">
                                        {student.referralCode || "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attached Documents Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <h2 className="text-lg font-bold text-purple-600">
                                    Attached Documents
                                </h2>
                                <button className="px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition">
                                    Download All
                                </button>
                            </div>

                            <CollapsibleSection
                                title="Student KYC Document"
                                sectionKey="kycDocuments"
                                icon={FileText}
                            >
                                <div className="space-y-2 text-sm">
                                    {student.kycData?.documents ? (
                                        Object.entries(student.kycData.documents).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between py-2">
                                                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                                                {value ? (
                                                    <a
                                                        href={value}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-purple-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <Download size={14} /> View
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">Not uploaded</span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No KYC documents available</p>
                                    )}
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection
                                title="Academic Marksheets"
                                sectionKey="academicMarksheets"
                                icon={GraduationCap}
                            >
                                <div className="space-y-2 text-sm">
                                    {student.academicRecords ? (
                                        <>
                                            <div className="flex justify-between py-2">
                                                <span>10th Marksheet</span>
                                                <span className="text-gray-600">
                                                    {student.academicRecords.tenth?.percentage}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-2">
                                                <span>12th Marksheet</span>
                                                <span className="text-gray-600">
                                                    {student.academicRecords.twelfth?.percentage}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-2">
                                                <span>Graduation</span>
                                                <span className="text-gray-600">
                                                    {student.academicRecords.graduation?.cgpa} CGPA
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-gray-500">No academic records available</p>
                                    )}
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection
                                title="Secured Admissions"
                                sectionKey="securedAdmissions"
                                icon={Building2}
                            >
                                <div className="space-y-2 text-sm">
                                    {student.admissionLetters?.length > 0 ? (
                                        student.admissionLetters.map((admission, idx) => (
                                            <div key={idx} className="py-2 border-b last:border-0">
                                                <p className="font-medium">{admission.universityName}</p>
                                                <p className="text-gray-500 text-xs">{admission.courseName}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No admission letters available</p>
                                    )}
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection
                                title="Work Experience"
                                sectionKey="workExperience"
                                icon={Briefcase}
                            >
                                <div className="space-y-2 text-sm">
                                    {student.workExperience?.experiences?.length > 0 ? (
                                        student.workExperience.experiences.map((exp, idx) => (
                                            <div key={idx} className="py-2 border-b last:border-0">
                                                <p className="font-medium">{exp.companyName}</p>
                                                <p className="text-gray-500 text-xs">
                                                    {exp.designation} ({exp.duration} months)
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No work experience available</p>
                                    )}
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection
                                title="Co-borrower Documents"
                                sectionKey="coBorrowerDocs"
                                icon={Users}
                            >
                                <div className="space-y-2 text-sm">
                                    {student.coBorrowers?.length > 0 ? (
                                        student.coBorrowers.map((cb, idx) => (
                                            <div key={idx} className="py-2 border-b last:border-0">
                                                <p className="font-medium">{cb.fullName}</p>
                                                <p className="text-gray-500 text-xs">
                                                    {cb.relationship} • {cb.occupation}
                                                </p>
                                                {cb.financialSummary && (
                                                    <p className="text-xs text-green-600 mt-1">
                                                        Monthly Income: ₹
                                                        {cb.financialSummary.monthlyIncome?.toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">No co-borrowers available</p>
                                    )}
                                </div>
                            </CollapsibleSection>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4">
                            <button
                                onClick={() => setShowProposalModal(true)}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
                            >
                                <Send size={18} />
                                Send Proposal
                            </button>

                            <div className="flex items-center gap-3">
                                <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2">
                                    <MessageSquare size={18} />
                                    Message
                                </button>
                                <button
                                    onClick={() => setShowRejectModal(true)}
                                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Send Proposal Modal */}
            {showProposalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Send Loan Proposal
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Offered Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    value={proposalData.offeredAmount}
                                    onChange={(e) =>
                                        setProposalData({ ...proposalData, offeredAmount: e.target.value })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g. 1500000"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Interest Rate (%) *
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={proposalData.offeredRoi}
                                    onChange={(e) =>
                                        setProposalData({ ...proposalData, offeredRoi: e.target.value })
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g. 10.5"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Remarks
                                </label>
                                <textarea
                                    value={proposalData.remarks}
                                    onChange={(e) =>
                                        setProposalData({ ...proposalData, remarks: e.target.value })
                                    }
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Any additional notes..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowProposalModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendProposal}
                                disabled={submitting}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {submitting ? "Sending..." : "Send Proposal"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Reject Request
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason for rejection
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                placeholder="Provide a reason..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={submitting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {submitting ? "Rejecting..." : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestDetail;
