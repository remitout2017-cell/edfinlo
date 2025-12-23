// src/pages/student/Dashboard.jsx
// Redesigned to match the design mockup with Track Progress, Loan Proposals, and Profile sections

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useUserData } from "../../context/UserDataContext";
import { kycAPI, loanAnalysisAPI, loanRequestAPI } from "../../services/api";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { User, Phone, Mail, MapPin, Upload, FileText } from "lucide-react";

const StudentDashboard = () => {
  // Get user data from context
  const {
    userData,
    loading: userLoading,
    refreshUserData,
    firstName,
    lastName,
    email,
    phoneNumber,
  } = useUserData();

  const [loading, setLoading] = useState(true);
  const [loanProposals, setLoanProposals] = useState([]);
  const [loanStats, setLoanStats] = useState({
    received: 0,
    onHold: 0,
    rejected: 0,
  });
  const [documentStatus, setDocumentStatus] = useState("pending");
  const [completeness, setCompleteness] = useState({
    percentage: 0,
    totalDocs: 0,
    uploadedDocs: 0,
  });

  useEffect(() => {
    // Refresh user data from API when dashboard loads
    refreshUserData();
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [loanRes, kycRes, completenessRes] = await Promise.allSettled([
        loanRequestAPI.getStudentRequests(),
        kycAPI.getKYCDetails(),
        loanAnalysisAPI.getCompleteness(),
      ]);

      // Process loan requests
      if (loanRes.status === "fulfilled") {
        const requests = loanRes.value.data.data || [];
        setLoanProposals(requests);

        // Calculate stats
        const received = requests.filter((r) => r.status === "approved").length;
        const onHold = requests.filter((r) => r.status === "pending").length;
        const rejected = requests.filter((r) => r.status === "rejected").length;
        setLoanStats({ received, onHold, rejected });
      }

      // Process KYC status
      if (kycRes.status === "fulfilled") {
        const kycData = kycRes.value.data;
        setDocumentStatus(kycData.kycStatus || "pending");
      }

      // Process completeness
      if (completenessRes.status === "fulfilled") {
        const data = completenessRes.value.data.data || {};
        setCompleteness({
          percentage: data.percentage || 0,
          totalDocs: data.totalFields || 13,
          uploadedDocs: data.completedFields || 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-orange-100 text-orange-600 border border-orange-200",
      approved: "bg-green-100 text-green-600 border border-green-200",
      rejected: "bg-red-100 text-red-600 border border-red-200",
    };
    return styles[status] || styles.pending;
  };

  if (loading || userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Use user data from context directly

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - Track Progress + Loan Proposals */}
          <div className="flex-1 space-y-6">
            {/* Track Progress Header */}
            <h2 className="text-2xl font-semibold text-orange-500">
              Track Progress
            </h2>

            {/* Status Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Loan Status Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">
                  Loan Status
                </h3>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">
                      {String(loanStats.received).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-gray-500">Received</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">
                      {String(loanStats.onHold).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-gray-500">On Hold</p>
                  </div>
                  <div className="text-center relative">
                    <p className="text-2xl font-bold text-gray-400">
                      {String(loanStats.rejected).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-gray-500">Rejected</p>
                    {loanStats.rejected > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Status Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">
                  Document Status
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Status:{" "}
                      <span
                        className={`font-medium ${
                          documentStatus === "verified"
                            ? "text-green-600"
                            : "text-orange-500"
                        }`}
                      >
                        {documentStatus === "verified" ? "Verified" : "Pending"}
                      </span>
                    </span>
                  </div>
                  <Link
                    to="/student/kyc"
                    className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </Link>
                </div>
              </div>
            </div>

            {/* Loan Proposals Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-orange-500">
                  Loan Proposals
                </h3>
                <span className="text-sm text-gray-500">
                  {String(loanProposals.length).padStart(2, "0")}
                </span>
              </div>

              {loanProposals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No loan proposals yet.</p>
                  <Link
                    to="/student/loan-analysis"
                    className="text-orange-500 hover:underline mt-2 inline-block"
                  >
                    Run loan analysis to get started
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {loanProposals.map((proposal) => (
                    <div
                      key={proposal._id}
                      className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800">
                            {proposal.nbfc?.name || "Bank Name"}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {proposal.nbfc?.description ||
                              "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              Status:
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                                proposal.status
                              )}`}
                            >
                              {proposal.status}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              to={`/student/loan-request`}
                              className="px-4 py-1.5 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700"
                            >
                              View
                            </Link>
                            {proposal.status === "approved" && (
                              <>
                                <button className="px-4 py-1.5 border border-gray-800 text-gray-800 text-sm rounded-md hover:bg-gray-50">
                                  Accept
                                </button>
                                <button className="px-4 py-1.5 border border-red-500 text-red-500 text-sm rounded-md hover:bg-red-50">
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - My Profile */}
          <div className="w-full lg:w-80">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Profile Photo */}
              <div className="h-48 bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                {userData?.profilePicture ? (
                  <img
                    src={userData.profilePicture}
                    alt="Profile"
                    className="w-32 h-32 rounded-lg object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-white flex items-center justify-center border-4 border-white shadow-lg">
                    <span className="text-4xl font-bold text-teal-500">
                      {firstName?.[0] || "U"}
                      {lastName?.[0] || ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Details */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    My Profile
                  </h3>
                  <Link
                    to="/student/profile"
                    className="px-3 py-1 border border-gray-300 text-sm text-gray-600 rounded-md hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Unique ID:{" "}
                    <span className="font-medium text-gray-800">
                      {userData?._id?.slice(-10).toUpperCase() || "N/A"}
                    </span>
                  </p>

                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {firstName} {lastName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {phoneNumber || "Not provided"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 break-all">
                      {email || "Not provided"}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">
                      {userData?.address || "Address not provided"}
                    </span>
                  </div>
                </div>

                {/* Profile Status */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-800 mb-4">
                    Profile Status
                  </h4>
                  <div className="flex items-center justify-between">
                    {/* Circular Progress */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="#e5e7eb"
                            strokeWidth="4"
                            fill="none"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="#f97316"
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={`${
                              completeness.percentage * 1.76
                            } 176`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-orange-500">
                            {completeness.percentage}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Profile Complete
                      </p>
                    </div>

                    {/* Documents Count */}
                    <div className="flex flex-col items-center">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-400">
                          {String(completeness.uploadedDocs).padStart(2, "0")}
                        </p>
                        <p className="text-sm text-gray-400">
                          /{completeness.totalDocs}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Documents Uploaded
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
