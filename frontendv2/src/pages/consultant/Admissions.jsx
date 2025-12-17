// src/pages/consultant/Admissions.jsx - COMPLETE VERSION
import { useState, useEffect } from 'react';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { consultantAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  GraduationCap, 
  Search, 
  Filter, 
  Calendar,
  MapPin,
  Award,
  CheckCircle,
  Clock
} from 'lucide-react';

const ConsultantAdmissions = () => {
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchAdmissions();
  }, [searchTerm, statusFilter]);

  const fetchAdmissions = async () => {
    try {
      setLoading(true);
      const response = await consultantAPI.getAdmissions({
        search: searchTerm,
        status: statusFilter
      });
      setAdmissions(response.data.admissions || []);
    } catch (error) {
      toast.error('Failed to fetch admissions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: Clock }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {status?.toUpperCase()}
      </span>
    );
  };

  return (
    <ConsultantLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Student Admissions</h1>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by university or program..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Offer Letter</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Admissions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill().map((_, i) => (
              <div key={i} className="bg-white/70 rounded-2xl p-6 animate-pulse shadow-lg h-64"></div>
            ))
          ) : admissions.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <GraduationCap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Admissions Found</h3>
            </div>
          ) : (
            admissions.map((admission) => (
              <div key={admission._id} className="group bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-white/50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold">
                      {admission.university?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{admission.program}</h4>
                      <p className="text-sm text-gray-600">{admission.university}</p>
                    </div>
                  </div>
                  {getStatusBadge(admission.status)}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>Start: {new Date(admission.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{admission.country}</span>
                  </div>
                  {admission.tuitionFees && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                      <Award className="h-4 w-4" />
                      <span>₹{admission.tuitionFees?.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <Link
                    to={`/consultant/admissions/${admission._id}`}
                    className="flex-1 text-center px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantAdmissions;
