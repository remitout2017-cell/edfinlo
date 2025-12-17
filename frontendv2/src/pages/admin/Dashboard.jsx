// src/pages/admin/Dashboard.jsx - COMPLETE VERSION
import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import {
  Users,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  UserCheck,
  Settings,
  Activity,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import toast from "react-hot-toast";
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    students: { total: 0, verified: 0, pending: 0, rejected: 0, active: 0 },
    nbfcs: { total: 0, approved: 0, pending: 0, active: 0, inactive: 0 },
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentNBFCs, setRecentNBFCs] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch students
      const studentsRes = await adminAPI.listStudents(1, 100);
      const students = studentsRes.data.students || [];

      // Fetch NBFCs
      const nbfcsRes = await adminAPI.listNBFCs(1, 100);
      const nbfcs = nbfcsRes.data.nbfcs || [];

      setStats({
        students: {
          total: students.length,
          verified: students.filter((s) => s.kycStatus === "verified").length,
          pending: students.filter((s) => s.kycStatus === "pending").length,
          rejected: students.filter((s) => s.kycStatus === "rejected").length,
          active: students.filter((s) => s.isActive).length,
        },
        nbfcs: {
          total: nbfcs.length,
          approved: nbfcs.filter((n) => n.isApprovedByAdmin).length,
          pending: nbfcs.filter((n) => !n.isApprovedByAdmin).length,
          active: nbfcs.filter((n) => n.isActive).length,
          inactive: nbfcs.filter((n) => !n.isActive).length,
        },
      });

      // Get recent 5 students and NBFCs
      setRecentStudents(students.slice(0, 5));
      setRecentNBFCs(nbfcs.slice(0, 5));
    } catch (error) {
      toast.error("Failed to fetch dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trend && (
              <span className="text-xs text-green-600 font-medium">
                +{trend}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div
          className={`p-3 rounded-xl ${color
            .replace("text", "bg")
            .replace("600", "100")}`}
        >
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to Admin Dashboard
          </h1>
          <p className="text-blue-100">
            Monitor and manage your platform's operations
          </p>
        </div>

        {/* Students Stats */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Student Overview
            </h2>
            <Link
              to="/admin/students"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <span>→</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
              title="Total Students"
              value={stats.students.total}
              icon={Users}
              color="text-blue-600"
              subtitle="All registered"
            />
            <StatCard
              title="KYC Verified"
              value={stats.students.verified}
              icon={CheckCircle}
              color="text-green-600"
              subtitle="Fully verified"
            />
            <StatCard
              title="Pending KYC"
              value={stats.students.pending}
              icon={Clock}
              color="text-yellow-600"
              subtitle="Awaiting verification"
            />
            <StatCard
              title="Rejected"
              value={stats.students.rejected}
              icon={XCircle}
              color="text-red-600"
              subtitle="KYC rejected"
            />
            <StatCard
              title="Active Users"
              value={stats.students.active}
              icon={Activity}
              color="text-purple-600"
              subtitle="Currently active"
            />
          </div>
        </div>

        {/* NBFCs Stats */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">NBFC Overview</h2>
            <Link
              to="/admin/nbfcs"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All
              <span>→</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
              title="Total NBFCs"
              value={stats.nbfcs.total}
              icon={Building2}
              color="text-purple-600"
              subtitle="All registered"
            />
            <StatCard
              title="Approved"
              value={stats.nbfcs.approved}
              icon={CheckCircle}
              color="text-green-600"
              subtitle="Admin approved"
            />
            <StatCard
              title="Pending Approval"
              value={stats.nbfcs.pending}
              icon={AlertCircle}
              color="text-orange-600"
              subtitle="Awaiting approval"
            />
            <StatCard
              title="Active"
              value={stats.nbfcs.active}
              icon={TrendingUp}
              color="text-blue-600"
              subtitle="Currently active"
            />
            <StatCard
              title="Inactive"
              value={stats.nbfcs.inactive}
              icon={XCircle}
              color="text-gray-600"
              subtitle="Disabled accounts"
            />
          </div>
        </div>

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Students */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Students
            </h3>
            {recentStudents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No students yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentStudents.map((student) => (
                  <div
                    key={student._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                        {student.firstName?.charAt(0)}
                        {student.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                    </div>
                    <span
                      className={`
                      px-2 py-1 text-xs font-medium rounded-full
                      ${
                        student.kycStatus === "verified"
                          ? "bg-green-100 text-green-800"
                          : ""
                      }
                      ${
                        student.kycStatus === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : ""
                      }
                      ${
                        student.kycStatus === "rejected"
                          ? "bg-red-100 text-red-800"
                          : ""
                      }
                    `}
                    >
                      {student.kycStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent NBFCs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent NBFCs
            </h3>
            {recentNBFCs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No NBFCs yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentNBFCs.map((nbfc) => (
                  <div
                    key={nbfc._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {nbfc.companyName}
                        </p>
                        <p className="text-xs text-gray-500">{nbfc.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`
                        px-2 py-1 text-xs font-medium rounded-full
                        ${
                          nbfc.isApprovedByAdmin
                            ? "bg-green-100 text-green-800"
                            : "bg-orange-100 text-orange-800"
                        }
                      `}
                      >
                        {nbfc.isApprovedByAdmin ? "Approved" : "Pending"}
                      </span>
                      {nbfc.isActive ? (
                        <span className="text-xs text-green-600">Active</span>
                      ) : (
                        <span className="text-xs text-gray-500">Inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/admin/students"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition group"
            >
              <Users className="h-6 w-6 text-gray-600 group-hover:text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Manage Students</p>
                <p className="text-xs text-gray-500">
                  View and edit student accounts
                </p>
              </div>
            </Link>
            <Link
              to="/admin/nbfcs"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition group"
            >
              <Building2 className="h-6 w-6 text-gray-600 group-hover:text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Manage NBFCs</p>
                <p className="text-xs text-gray-500">
                  Approve and manage NBFCs
                </p>
              </div>
            </Link>
            <Link
              to="/admin/sub-admins"
              className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition group"
            >
              <Settings className="h-6 w-6 text-gray-600 group-hover:text-green-600" />
              <div>
                <p className="font-medium text-gray-900">Manage Admins</p>
                <p className="text-xs text-gray-500">
                  Add and manage sub-admins
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
