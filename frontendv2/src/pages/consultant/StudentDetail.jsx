// src/pages/consultant/StudentDetail.jsx - COMPLETE VERSION
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  GraduationCap,
  Briefcase,
  FileText,
  Award,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

const ConsultantStudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchStudentDetails();
  }, [id]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      const [profileRes, summaryRes] = await Promise.all([
        consultantAPI.getStudentById(id),
        consultantAPI.getStudentSummary(id)
      ]);
      
      setStudent(profileRes.data.student);
      setSummary(summaryRes.data.summary);
    } catch (error) {
      toast.error('Failed to load student details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getKYCBadge = (status) => {
    const badges = {
      verified: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${badge.bg} ${badge.text}`}>
        <Icon className="h-4 w-4" />
        {status?.toUpperCase() || 'PENDING'}
      </span>
    );
  };

  if (loading) {
    return (
      <ConsultantLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading student details...</p>
          </div>
        </div>
      </ConsultantLayout>
    );
  }

  if (!student) {
    return (
      <ConsultantLayout>
        <div className="text-center py-16">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Student Not Found</h3>
          <button
            onClick={() => navigate('/consultant/students')}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
          >
            Back to Students
          </button>
        </div>
      </ConsultantLayout>
    );
  }

  return (
    <ConsultantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/consultant/students')}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Student Profile</h1>
            <p className="text-gray-600 mt-1">Complete student information and progress</p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Avatar & Basic Info */}
            <div className="flex flex-col items-center lg:items-start gap-4">
              <div className="h-32 w-32 rounded-3xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white text-5xl font-bold shadow-2xl">
                {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
              </div>
              {getKYCBadge(student.kycStatus)}
            </div>

            {/* Details */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Full Name</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {student.firstName} {student.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <p className="text-gray-900">{student.email}</p>
                </div>
                {student.phoneNumber && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </p>
                    <p className="text-gray-900">{student.phoneNumber}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {student.dateOfBirth && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date of Birth
                    </p>
                    <p className="text-gray-900">
                      {new Date(student.dateOfBirth).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
                {student.address && (
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </p>
                    <p className="text-gray-900">{student.address}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Joined Date</p>
                  <p className="text-gray-900">
                    {new Date(student.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Academic Records</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{summary.academicRecords || 0}</p>
                </div>
                <GraduationCap className="h-10 w-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Work Experience</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{summary.workExperience || 0}</p>
                </div>
                <Briefcase className="h-10 w-10 text-purple-500" />
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Loan Requests</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{summary.loanRequests || 0}</p>
                </div>
                <FileText className="h-10 w-10 text-green-500" />
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Analysis Run</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{summary.analysisCount || 0}</p>
                </div>
                <Award className="h-10 w-10 text-orange-500" />
              </div>
            </div>
          </div>
        )}

        {/* Additional Info Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KYC Documents */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
            <h3 className="text-xl font-bold text-gray-900 mb-4">KYC Documents</h3>
            <div className="space-y-3">
              {student.kycDocuments && student.kycDocuments.length > 0 ? (
                student.kycDocuments.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-700">{doc.type}</span>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No documents uploaded yet</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Profile Updated</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantStudentDetail;
