// src/pages/consultant/Profiles.jsx - Uses ConsultantDataContext
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useConsultantData } from '../../context/ConsultantDataContext';
import toast from 'react-hot-toast';
import {
  UserCheck,
  Search,
  Filter,
  GraduationCap,
  Briefcase,
  FileText,
  Shield,
  Eye
} from 'lucide-react';

const ConsultantProfiles = () => {
  const { fetchStudentsWithParams } = useConsultantData();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileType, setProfileType] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, [searchTerm, profileType, completionFilter]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const result = await fetchStudentsWithParams({
        search: searchTerm,
        profileType,
        completion: completionFilter
      });
      setProfiles(result.students || []);
    } catch (error) {
      toast.error('Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  const profileTypes = [
    { value: 'all', label: 'All Profiles', icon: UserCheck },
    { value: 'kyc', label: 'KYC Complete', icon: Shield },
    { value: 'academic', label: 'Academic Records', icon: GraduationCap },
    { value: 'work', label: 'Work Experience', icon: Briefcase },
    { value: 'loan', label: 'Loan Requests', icon: FileText }
  ];

  const getCompletionBadge = (completion) => {
    const percentage = Math.round(completion || 0);
    let color, label;

    if (percentage === 100) {
      color = 'bg-green-100 text-green-800';
      label = 'Complete';
    } else if (percentage >= 75) {
      color = 'bg-blue-100 text-blue-800';
      label = 'Advanced';
    } else if (percentage >= 50) {
      color = 'bg-yellow-100 text-yellow-800';
      label = 'Moderate';
    } else {
      color = 'bg-gray-100 text-gray-800';
      label = 'Basic';
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
        {percentage}% {label}
      </span>
    );
  };

  return (
    <ConsultantLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Student Profiles</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
              {profiles.length} profiles
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Profile Type Filter */}
            <select
              value={profileType}
              onChange={(e) => setProfileType(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              {profileTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Completion Filter */}
            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Completion Levels</option>
              <option value="complete">100% Complete</option>
              <option value="advanced">75%+</option>
              <option value="moderate">50%+</option>
            </select>
          </div>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array(6).fill().map((_, i) => (
              <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-8 animate-pulse shadow-lg border border-white/50">
                <div className="h-24 bg-gray-200 rounded-xl mb-4"></div>
                <div className="h-6 bg-gray-200 rounded-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded-full mb-4 w-3/4"></div>
                <div className="h-10 bg-gray-200 rounded-xl"></div>
              </div>
            ))
          ) : profiles.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <UserCheck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Profiles Found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
            </div>
          ) : (
            profiles.map((profile) => (
              <div key={profile._id} className="group bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all border border-white/50">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform">
                  {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2 truncate">
                  {profile.firstName} {profile.lastName}
                </h3>
                <p className="text-sm text-gray-600 text-center mb-4 truncate">{profile.email}</p>

                <div className="flex items-center justify-center mb-6">
                  {getCompletionBadge(profile.profileCompletion)}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {profile.kycComplete && (
                    <div className="flex flex-col items-center p-2 bg-green-50 rounded-xl">
                      <Shield className="h-5 w-5 text-green-600 mb-1" />
                      <span className="text-xs text-green-800 font-medium">KYC</span>
                    </div>
                  )}
                  {profile.academicRecords > 0 && (
                    <div className="flex flex-col items-center p-2 bg-blue-50 rounded-xl">
                      <GraduationCap className="h-5 w-5 text-blue-600 mb-1" />
                      <span className="text-xs text-blue-800 font-medium">Academic</span>
                    </div>
                  )}
                  {profile.workExperience > 0 && (
                    <div className="flex flex-col items-center p-2 bg-purple-50 rounded-xl">
                      <Briefcase className="h-5 w-5 text-purple-600 mb-1" />
                      <span className="text-xs text-purple-800 font-medium">Work</span>
                    </div>
                  )}
                </div>

                <Link
                  to={`/consultant/students/${profile._id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg group-hover:shadow-xl"
                >
                  <Eye className="h-4 w-4" />
                  View Full Profile
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </ConsultantLayout>
  );
};

export default ConsultantProfiles;
