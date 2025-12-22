// src/pages/consultant/Profile.jsx
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Phone, Building, Calendar } from 'lucide-react';

const ConsultantProfile = () => {
    const { user } = useAuth();

    return (
        <ConsultantLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    {/* Profile Header */}
                    <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                        <div className="h-24 w-24 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {user?.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{user?.name || 'Consultant'}</h2>
                            <p className="text-gray-500">{user?.designation || 'Senior Consultant'}</p>
                            <p className="text-sm text-orange-600 mt-1">{user?.companyName || 'Your Company'}</p>
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <Mail className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium text-gray-900">{user?.email || 'email@example.com'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <Phone className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-sm text-gray-500">Phone</p>
                                <p className="font-medium text-gray-900">{user?.phone || 'Not provided'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <Building className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-sm text-gray-500">Company</p>
                                <p className="font-medium text-gray-900">{user?.companyName || 'Not provided'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <Calendar className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-sm text-gray-500">Experience</p>
                                <p className="font-medium text-gray-900">{user?.experienceYears || 0}+ years</p>
                            </div>
                        </div>
                    </div>

                    {/* Edit Button */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                        <button className="px-6 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors">
                            Edit Profile
                        </button>
                    </div>
                </div>
            </div>
        </ConsultantLayout>
    );
};

export default ConsultantProfile;
