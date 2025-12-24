// src/pages/consultant/Dashboard.jsx
// Complete Dashboard with UI matching reference - uses ConsultantDataContext
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useConsultantData } from '../../context/ConsultantDataContext';
import toast from 'react-hot-toast';
import {
  Eye,
  Edit,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Wallet,
  IndianRupee,
  Link2,
  Copy,
  X,
  ClipboardList
} from 'lucide-react';

const ConsultantDashboard = () => {
  const {
    consultantData,
    students,
    stats,
    loading,
    fetchConsultantProfile,
    fetchStudents,
    inviteStudent
  } = useConsultantData();

  const [expandedStudent, setExpandedStudent] = useState(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);

  // Dashboard stats
  const [dashboardStats, setDashboardStats] = useState({
    currentMonth: '',
    totalStudents: 0,
    amountInRs: 0,
    totalAmount: 0
  });

  // Referral code from consultant data
  const referralCode = consultantData?._id?.slice(-5)?.toUpperCase() || '45628';

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    await fetchConsultantProfile();
    await fetchStudents();

    // Get current month name
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    setDashboardStats({
      currentMonth,
      totalStudents: stats?.totalStudents || students?.length || 0,
      amountInRs: stats?.amountInRs || 50000,
      totalAmount: stats?.totalAmount || 100000
    });
  };

  const toggleExpand = (studentId) => {
    setExpandedStudent(expandedStudent === studentId ? null : studentId);
  };

  const generateReferralLink = async () => {
    setGeneratingLink(true);
    try {
      // Generate link based on consultant ID
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/register/invite?ref=${referralCode}`;
      setReferralLink(link);
    } catch (error) {
      toast.error('Failed to generate referral link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link copied to clipboard!');
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'verified':
        return 'bg-green-100 text-green-700 border border-green-300';
      case 'pending':
        return 'bg-orange-100 text-orange-700 border border-orange-300';
      case 'rejected':
        return 'bg-red-100 text-red-700 border border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  if (loading) {
    return (
      <ConsultantLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </ConsultantLayout>
    );
  }

  return (
    <ConsultantLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Track Progress Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-orange-500">Track Progress</h1>
          <button
            onClick={() => setShowReferralModal(true)}
            className="px-5 py-2 text-sm font-medium text-orange-500 border-2 border-orange-500 rounded-lg hover:bg-orange-50 transition-colors"
          >
            Generate Referral Link
          </button>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Month Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-orange-400 transition-colors shadow-sm">
            <p className="text-3xl font-bold text-orange-500 text-center">{dashboardStats.currentMonth}</p>
            <p className="text-sm text-gray-500 text-center mt-2">month</p>
          </div>

          {/* No. of Students Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-orange-400 transition-colors shadow-sm">
            <p className="text-3xl font-bold text-orange-500 text-center">
              {dashboardStats.totalStudents.toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">no. student</p>
          </div>

          {/* Amount in Rs Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-orange-400 transition-colors shadow-sm">
            <p className="text-3xl font-bold text-orange-500 text-center">
              {dashboardStats.amountInRs.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">amount in rs.</p>
          </div>

          {/* Total Amount Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-orange-400 transition-colors shadow-sm">
            <p className="text-3xl font-bold text-orange-500 text-center">
              {dashboardStats.totalAmount.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">total amount</p>
          </div>
        </div>

        {/* Referral Code & Track Commission Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700 font-medium">Referral Code: {referralCode}</span>
          </div>
          <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
            <ClipboardList className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700 font-medium">Track Commission</span>
          </button>
        </div>

        {/* Applications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Applications Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-orange-500">Applications</h2>
            <div className="flex items-center gap-3">
              <Link
                to="/consultant/students"
                className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
              >
                See All
              </Link>
              <Link
                to="/consultant/invite"
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Start New Registration
              </Link>
            </div>
          </div>

          {/* Student Applications List */}
          <div className="divide-y divide-gray-100">
            {(students || []).length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No students yet</p>
                <Link
                  to="/consultant/invite"
                  className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                >
                  Invite First Student
                </Link>
              </div>
            ) : (
              (students || []).slice(0, 5).map((student, index) => (
                <div key={student._id || `student-${index}`} className="p-6">
                  {/* Student Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {student.firstName} {student.lastName}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>NBFC: {student.nbfcName || 'NBFC name'}</span>
                        <span className="flex items-center gap-2">
                          Status:
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(student.kycStatus)}`}>
                            {student.kycStatus || 'Pending'}
                          </span>
                        </span>
                        {student.missingDocuments > 0 && (
                          <span className="text-orange-600">
                            Missing Documents: {student.missingDocuments.toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/consultant/students/${student._id}`}
                        className="px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        View
                      </Link>
                      <button className="px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors">
                        Edit
                      </button>
                      <button
                        onClick={() => toggleExpand(student._id)}
                        className="p-1.5 text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        {expandedStudent === student._id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedStudent === student._id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Email:</span>
                          <span className="ml-2 text-gray-900">{student.email}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phone:</span>
                          <span className="ml-2 text-gray-900">{student.phoneNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Joined:</span>
                          <span className="ml-2 text-gray-900">
                            {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">KYC Status:</span>
                          <span className="ml-2 text-gray-900">{student.kycStatus || 'Pending'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Generate Referral Link Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-orange-500">Generate Referral Link</h3>
              <button
                onClick={() => setShowReferralModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 min-h-[80px] flex items-center justify-center mb-4">
              {referralLink ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="flex-1 text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 border border-gray-200"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-orange-500 hover:bg-orange-50 rounded"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center">
                  Click on generate link and Copy Link here
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setReferralLink('');
                  setShowReferralModal(false);
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={generateReferralLink}
                disabled={generatingLink}
                className="px-6 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {generatingLink ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConsultantLayout>
  );
};

export default ConsultantDashboard;
