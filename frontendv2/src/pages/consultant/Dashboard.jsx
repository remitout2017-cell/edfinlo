// src/pages/consultant/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Users, 
  UserPlus, 
  FileText, 
  GraduationCap, 
  Award, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Activity
} from 'lucide-react';

const ConsultantDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    invitedStudents: 0,
    verifiedStudents: 0,
    pendingStudents: 0,
    loanRequests: 0,
    approvedLoans: 0,
    totalAnalysis: 0
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const statsRes = await consultantAPI.dashboardStats();
      const studentsRes = await consultantAPI.getStudents(1, 5);
      const requestsRes = await consultantAPI.getLoanRequests(1, 5);

      setStats(statsRes.data.stats);
      setRecentStudents(studentsRes.data.students || []);
      setRecentRequests(requestsRes.data.loanRequests || []);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
    <div className="group bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trend && (
              <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                +{trend}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-2xl bg-gradient-to-br ${color} shadow-lg group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <ConsultantLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </ConsultantLayout>
    );
  }

  return (
    <ConsultantLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-3xl p-8 text-white shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
              <p className="text-green-100 text-lg">Manage your students and track loan progress</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-2xl">
                <Activity className="h-4 w-4" />
                <span>Live</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-2xl">
                {stats.totalStudents} students
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              icon={Users}
              color="from-blue-500 to-indigo-600 bg-blue-500/10"
            />
            <StatCard
              title="Invited"
              value={stats.invitedStudents}
              icon={UserPlus}
              color="from-orange-500 to-yellow-500 bg-orange-500/10"
            />
            <StatCard
              title="Verified"
              value={stats.verifiedStudents}
              icon={CheckCircle}
              color="from-green-500 to-emerald-500 bg-green-500/10"
            />
            <StatCard
              title="Pending"
              value={stats.pendingStudents}
              icon={Clock}
              color="from-yellow-500 to-amber-500 bg-yellow-500/10"
            />
            <StatCard
              title="Loan Requests"
              value={stats.loanRequests}
              icon={FileText}
              color="from-purple-500 to-violet-500 bg-purple-500/10"
            />
            <StatCard
              title="Approved Loans"
              value={stats.approvedLoans}
              icon={Award}
              color="from-emerald-500 to-teal-500 bg-emerald-500/10"
              trend={12}
            />
            <StatCard
              title="Analysis Run"
              value={stats.totalAnalysis}
              icon={TrendingUp}
              color="from-pink-500 to-rose-500 bg-pink-500/10"
              trend={8}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Students */}
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Recent Students</h3>
              <Link
                to="/consultant/students"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All → 
              </Link>
            </div>
            <div className="space-y-4">
              {recentStudents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No students yet</p>
                  <Link
                    to="/consultant/invite"
                    className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-2xl hover:bg-green-700 transition"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite First Student
                  </Link>
                </div>
              ) : (
                recentStudents.map((student) => (
                  <Link
                    key={student._id}
                    to={`/consultant/students/${student._id}`}
                    className="group flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl hover:shadow-md transition-all hover:-translate-y-1"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                      {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{student.email}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      student.kycStatus === 'verified' 
                        ? 'bg-green-100 text-green-800' 
                        : student.kycStatus === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.kycStatus || 'Pending'}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Loan Requests */}
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Recent Requests</h3>
              <Link
                to="/consultant/loan-requests"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All → 
              </Link>
            </div>
            <div className="space-y-4">
              {recentRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No loan requests yet</p>
                </div>
              ) : (
                recentRequests.map((request) => (
                  <div
                    key={request._id}
                    className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">
                          ₹{request.loanAmount?.toLocaleString()} Loan
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.student?.firstName} {request.student?.lastName}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link
              to="/consultant/invite"
              className="group flex flex-col items-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-green-200"
            >
              <UserPlus className="h-12 w-12 text-green-600 bg-green-200 p-3 rounded-2xl group-hover:scale-110 transition-transform mb-4" />
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 mb-1">Invite Students</h4>
                <p className="text-sm text-gray-600">Send invites to new students</p>
              </div>
            </Link>
            <Link
              to="/consultant/students"
              className="group flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-blue-200"
            >
              <Users className="h-12 w-12 text-blue-600 bg-blue-200 p-3 rounded-2xl group-hover:scale-110 transition-transform mb-4" />
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 mb-1">View Students</h4>
                <p className="text-sm text-gray-600">Manage all your students</p>
              </div>
            </Link>
            <Link
              to="/consultant/loan-requests"
              className="group flex flex-col items-center p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-purple-200"
            >
              <FileText className="h-12 w-12 text-purple-600 bg-purple-200 p-3 rounded-2xl group-hover:scale-110 transition-transform mb-4" />
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 mb-1">Loan Requests</h4>
                <p className="text-sm text-gray-600">Track loan applications</p>
              </div>
            </Link>
            <Link
              to="/consultant/profiles"
              className="group flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-emerald-200"
            >
              <GraduationCap className="h-12 w-12 text-emerald-600 bg-emerald-200 p-3 rounded-2xl group-hover:scale-110 transition-transform mb-4" />
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 mb-1">Student Profiles</h4>
                <p className="text-sm text-gray-600">Complete KYC profiles</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantDashboard;
