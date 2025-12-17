// src/pages/student/Dashboard.jsx

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { kycAPI, academicAPI, loanAnalysisAPI } from "../../services/api";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import {
  UserCheck,
  BookOpen,
  Briefcase,
  Activity,
  ArrowRight,
  Upload,
  Users,
  CreditCard,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle,
} from "lucide-react";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    kycStatus: "pending",
    academicRecordsStatus: "pending",
    loanAnalysis: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [kycRes, academicRes] = await Promise.allSettled([
        kycAPI.getKYCDetails(),
        academicAPI.getRecords(),
      ]);

      setStats({
        kycStatus:
          kycRes.status === "fulfilled"
            ? kycRes.value.data.kycStatus
            : "pending",
        academicRecordsStatus:
          academicRes.status === "fulfilled" ? "completed" : "pending",
      });
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    const styles = {
      verified: "bg-green-100 text-green-700 border-green-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
      processing: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return styles[status] || styles.pending;
  };

  const getStatusIcon = (status) => {
    if (status === "verified" || status === "completed")
      return <CheckCircle size={14} className="mr-1" />;
    if (status === "rejected")
      return <AlertCircle size={14} className="mr-1" />;
    return <Clock size={14} className="mr-1" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.firstName || "Student"}!
            </h1>
            <p className="mt-2 text-orange-100 text-lg max-w-xl">
              Track your loan application progress, manage your documents, and
              get AI-powered insights for your education loan.
            </p>
          </div>
          <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 transform origin-bottom-right"></div>
          <div className="absolute right-20 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform origin-bottom-right"></div>
        </div>

        {/* Status Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KYC Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                <UserCheck className="text-orange-500" size={24} />
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(
                  stats.kycStatus
                )}`}
              >
                {getStatusIcon(stats.kycStatus)}
                {stats.kycStatus}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">KYC Status</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Identity verification status
            </p>
            <Link
              to="/student/kyc"
              className="text-orange-600 font-medium text-sm hover:text-orange-700 flex items-center gap-1 group"
            >
              Manage KYC{" "}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Academic Records Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <BookOpen className="text-blue-500" size={24} />
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(
                  stats.academicRecordsStatus
                )}`}
              >
                {getStatusIcon(stats.academicRecordsStatus)}
                {stats.academicRecordsStatus === "completed"
                  ? "UPDATED"
                  : "PENDING"}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              Academic Records
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Marksheets and certificates
            </p>
            <Link
              to="/student/academic-records"
              className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center gap-1 group"
            >
              View Records{" "}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Work Experience Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                <Briefcase className="text-purple-500" size={24} />
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                OPTIONAL
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              Work Experience
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Employment history details
            </p>
            <Link
              to="/student/work-experience"
              className="text-purple-600 font-medium text-sm hover:text-purple-700 flex items-center gap-1 group"
            >
              Manage Experience{" "}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>

          {/* Loan Analysis Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition hover:shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <Activity className="text-green-500" size={24} />
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                AI POWERED
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">
              Loan Eligibility
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Check approval chances
            </p>
            <Link
              to="/student/loan-analysis"
              className="text-green-600 font-medium text-sm hover:text-green-700 flex items-center gap-1 group"
            >
              Run Analysis{" "}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/student/co-borrower"
              className="flex items-center p-5 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-4 group-hover:bg-orange-500 transition-colors">
                <Users
                  size={20}
                  className="text-orange-600 group-hover:text-white transition-colors"
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Add Co-Borrower</h4>
                <p className="text-xs text-gray-500">
                  Boost your loan eligibility
                </p>
              </div>
            </Link>

            <Link
              to="/student/admission"
              className="flex items-center p-5 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-4 group-hover:bg-orange-500 transition-colors">
                <FileText
                  size={20}
                  className="text-orange-600 group-hover:text-white transition-colors"
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">
                  Upload Admission Letter
                </h4>
                <p className="text-xs text-gray-500">
                  Verify your university admit
                </p>
              </div>
            </Link>

            <Link
              to="/student/loan-request"
              className="flex items-center p-5 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-4 group-hover:bg-orange-500 transition-colors">
                <CreditCard
                  size={20}
                  className="text-orange-600 group-hover:text-white transition-colors"
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Request Loan</h4>
                <p className="text-xs text-gray-500">
                  Apply to matched lenders
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
