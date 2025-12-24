// src/pages/consultant/Profile.jsx
// Complete Profile page with UI matching reference - uses ConsultantDataContext
import { useState, useEffect } from 'react';
import ConsultantLayout from '../../components/layouts/ConsultantLayout';
import { useConsultantData } from '../../context/ConsultantDataContext';
import {
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Edit,
    ArrowUpDown,
    MessageSquare
} from 'lucide-react';

const ConsultantProfile = () => {
    const {
        consultantData,
        stats,
        loading,
        fetchConsultantProfile
    } = useConsultantData();

    const [queries, setQueries] = useState([]);
    const [sortOrder, setSortOrder] = useState('desc');
    const [showEditModal, setShowEditModal] = useState(false);

    // Mock data for performance stats (will come from backend later)
    const [performance, setPerformance] = useState({
        averageLeadsPerMonth: 10,
        totalLeads: 20,
        totalCommission: 10,
        pendingAmount: 2000
    });

    // Mock queries data
    const mockQueries = [
        { id: 1, text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et', source: 'Student' },
        { id: 2, text: 'Lorem ipsum dolor sit amet, consectetur elit,', source: 'NBFC' },
        { id: 3, text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et', source: 'Student' },
        { id: 4, text: 'Lorem ipsum dolor sit amet, consectetur elit,', source: 'NBFC' },
    ];

    useEffect(() => {
        if (!consultantData) {
            fetchConsultantProfile();
        }
        setQueries(mockQueries);
    }, []);

    // Generate referral number from ID
    const referralNumber = consultantData?._id
        ? `HYU${consultantData._id.slice(-8).toUpperCase()}`
        : 'HYU67994003';

    // Full name
    const fullName = consultantData
        ? `${consultantData.firstName || ''} ${consultantData.lastName || ''}`.trim()
        : 'Consultant';

    // Get initials for avatar
    const getInitials = () => {
        if (consultantData?.firstName && consultantData?.lastName) {
            return `${consultantData.firstName.charAt(0)}${consultantData.lastName.charAt(0)}`.toUpperCase();
        }
        return 'C';
    };

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    };

    if (loading) {
        return (
            <ConsultantLayout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Loading profile...</p>
                    </div>
                </div>
            </ConsultantLayout>
        );
    }

    return (
        <ConsultantLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Section - Profile Info */}
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        {/* Profile Photo */}
                        <div className="flex justify-center mb-6">
                            <div className="h-32 w-32 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden">
                                {consultantData?.photoUrl ? (
                                    <img
                                        src={consultantData.photoUrl}
                                        alt={fullName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    getInitials()
                                )}
                            </div>
                        </div>

                        {/* Designation with Edit */}
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Student Counsellor</h2>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="px-3 py-1 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                            >
                                Edit
                            </button>
                        </div>

                        {/* Referral Number */}
                        <p className="text-center text-gray-600 mb-4">
                            <span className="font-medium">Referral Number:</span> {referralNumber}
                        </p>

                        {/* Date */}
                        <div className="flex items-center justify-center gap-2 text-gray-500 mb-6">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">
                                {consultantData?.createdAt
                                    ? new Date(consultantData.createdAt).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                    })
                                    : 'DD/MM/YYYY'}
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200 my-4"></div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-gray-400" />
                                <span className="text-gray-900">{fullName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-gray-400" />
                                <span className="text-gray-900">{consultantData?.phoneNumber || '+91 76374 86793'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-gray-400" />
                                <span className="text-gray-900">{consultantData?.email || 'email@gmail.com'}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                <span className="text-gray-900">
                                    {consultantData?.address || '234, Sweet Life Apt., Cross Rd, Bengaluru, Karnataka 560982'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Section - Performance & Queries */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Performance Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-orange-500">Performance</h2>
                                <button className="px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors">
                                    Edit
                                </button>
                            </div>

                            {/* Performance Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <span className="text-gray-600">Average Leads/month</span>
                                    <span className="text-xl font-bold text-gray-900">{performance.averageLeadsPerMonth}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <span className="text-gray-600">Total Leads</span>
                                    <span className="text-xl font-bold text-gray-900">{performance.totalLeads}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <span className="text-gray-600">Total Commission</span>
                                    <span className="text-xl font-bold text-gray-900">{performance.totalCommission}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                    <span className="text-gray-600">Pending Amount</span>
                                    <span className="text-xl font-bold text-orange-500">₹{performance.pendingAmount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Queries Raised Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Queries Raised</h2>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={toggleSortOrder}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Sort by
                                        <ArrowUpDown className="h-4 w-4" />
                                    </button>
                                    <button className="px-4 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors">
                                        Raise Query
                                    </button>
                                </div>
                            </div>

                            {/* Queries List */}
                            <div className="space-y-3">
                                {queries.map((query) => (
                                    <div key={query.id} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0">
                                        <p className="text-gray-700 text-sm flex-1 pr-4">{query.text}</p>
                                        <span className="text-gray-500 text-sm whitespace-nowrap">{query.source}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ConsultantLayout>
    );
};

export default ConsultantProfile;
