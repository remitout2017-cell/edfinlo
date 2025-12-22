// src/pages/consultant/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import RegisterStudentsModal from '../../components/modals/RegisterStudentsModal';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Eye,
  Edit,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  Calendar,
  Wallet
} from 'lucide-react';

const ConsultantDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAmount: 0,
    amountInRs: 0,
    currentMonth: ''
  });
  const [students, setStudents] = useState([]);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [referralCode] = useState('45628'); // Static for now, can be fetched from API
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, studentsRes] = await Promise.all([
        consultantAPI.getDashboardStats(),
        consultantAPI.getStudents({ page: 1, limit: 10 })
      ]);

      // Get current month name
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });

      setStats({
        totalStudents: statsRes.data?.stats?.totalStudents || studentsRes.data?.pagination?.total || 0,
        totalAmount: statsRes.data?.stats?.totalAmount || 100000,
        amountInRs: statsRes.data?.stats?.amountInRs || 50000,
        currentMonth
      });
      setStudents(studentsRes.data?.students || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (studentId) => {
    setExpandedStudent(expandedStudent === studentId ? null : studentId);
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
          <h1 className="text-2xl font-bold text-gray-900">Track Progress</h1>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Month Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-orange-200 hover:border-orange-400 transition-colors shadow-sm">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-5 w-5 text-orange-500 mr-2" />
            </div>
            <p className="text-3xl font-bold text-orange-500 text-center">{stats.currentMonth}</p>
            <p className="text-sm text-gray-500 text-center mt-2">month</p>
          </div>

          {/* No. of Students Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-orange-200 hover:border-orange-400 transition-colors shadow-sm">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-orange-500 mr-2" />
            </div>
            <p className="text-3xl font-bold text-orange-500 text-center">
              {stats.totalStudents.toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">no. student</p>
          </div>

          {/* Amount in Rs Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-orange-200 hover:border-orange-400 transition-colors shadow-sm">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="h-5 w-5 text-orange-500 mr-2" />
            </div>
            <p className="text-3xl font-bold text-orange-500 text-center">
              {stats.amountInRs.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">amount in rs.</p>
          </div>

          {/* Total Amount Card */}
          <div className="bg-white rounded-xl p-6 border-2 border-orange-200 hover:border-orange-400 transition-colors shadow-sm">
            <div className="flex items-center justify-center mb-2">
              <Wallet className="h-5 w-5 text-orange-500 mr-2" />
            </div>
            <p className="text-3xl font-bold text-orange-500 text-center">
              {stats.totalAmount.toLocaleString('en-IN')}
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
            <Wallet className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700 font-medium">Track Commission</span>
          </button>
        </div>

        {/* Applications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Applications Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Applications</h2>
            <div className="flex items-center gap-3">
              <Link
                to="/consultant/students"
                className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
              >
                See All
              </Link>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Start New Registration
              </button>
            </div>
          </div>

          {/* Student Applications List */}
          <div className="divide-y divide-gray-100">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No students yet</p>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition"
                >
                  Register First Student
                </button>
              </div>
            ) : (
              students.map((student) => (
                <div key={student._id} className="p-6">
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

      {/* Register Students Modal */}
      <RegisterStudentsModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={fetchDashboardData}
      />
    </ConsultantLayout>
  );
};

export default ConsultantDashboard;
