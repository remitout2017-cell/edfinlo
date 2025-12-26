// src/pages/nbfc/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
    LayoutDashboard,
    Search,
    Eye,
    Bell,
    ChevronDown,
    Filter,
    LogOut,
    Loader,
    RefreshCw,
    Settings,
    Users,
} from "lucide-react";

// Use environment variable with fallback
const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
    ? rawBaseUrl.slice(0, -4)
    : rawBaseUrl.replace(/\/$/, "");

const NBFCDashboard = () => {
    const { user, logout, getAuthHeaders } = useAuth();
    const navigate = useNavigate();

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Loan requests data
    const [pendingRequests, setPendingRequests] = useState([]);
    const [approvedRequests, setApprovedRequests] = useState([]);
    const [stats, setStats] = useState(null);

    // Fetch data on mount
    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);

        try {
            const headers = getAuthHeaders();

            // Fetch all loan requests
            const [requestsRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/nbfc/loan-requests`, { headers }),
                axios.get(`${API_BASE_URL}/api/nbfc/loan-requests/dashboard/stats`, {
                    headers,
                }),
            ]);

            if (requestsRes.data.success) {
                const allRequests = requestsRes.data.requests || [];
                // Separate by status
                setPendingRequests(allRequests.filter((r) => r.status === "pending"));
                setApprovedRequests(allRequests.filter((r) => r.status === "approved"));
            }

            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            }
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
            setError(err.response?.data?.message || "Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleView = (id) => {
        navigate(`/nbfc/requests/${id}`);
    };

    const handleReject = async (id) => {
        if (!window.confirm("Are you sure you want to reject this request?"))
            return;

        try {
            const headers = getAuthHeaders();
            await axios.put(
                `${API_BASE_URL}/api/nbfc/loan-requests/${id}/decide`,
                { decision: "rejected", reason: "Rejected from dashboard" },
                { headers }
            );

            // Refresh data after rejection
            fetchDashboardData();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to reject request");
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="animate-spin mx-auto text-orange-500" size={48} />
                    <p className="mt-4 text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/nbfc/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">E</span>
                                </div>
                                <span className="text-xl font-bold text-gray-800">EDULOAN</span>
                            </Link>
                        </div>

                        {/* Search Bar */}
                        <div className="flex-1 max-w-lg mx-8 flex items-center">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={fetchDashboardData}
                                className="p-2 text-gray-500 hover:text-gray-700"
                                title="Refresh"
                            >
                                <RefreshCw className="h-5 w-5" />
                            </button>

                            <button className="p-2 text-gray-500 hover:text-gray-700 relative">
                                <Bell className="h-5 w-5" />
                                {stats?.pendingApplications > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                                        {stats.pendingApplications}
                                    </span>
                                )}
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                                >
                                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                        <span className="text-white font-medium text-sm">
                                            {user?.companyName?.[0] || "N"}
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {user?.companyName || "NBFC"}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="flex">
                {/* Sidebar */}
                <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16">
                    <nav className="p-4 space-y-2">
                        <Link
                            to="/nbfc/dashboard"
                            className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium"
                        >
                            <LayoutDashboard className="h-5 w-5" />
                            Dashboard
                        </Link>
                        <Link
                            to="/nbfc/questionnaire"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl"
                        >
                            <Settings className="h-5 w-5" />
                            Loan Criteria
                        </Link>
                        <Link
                            to="/nbfc/students"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl"
                        >
                            <Users className="h-5 w-5" />
                            Students
                        </Link>
                    </nav>

                    {/* Stats Card */}
                    {stats && (
                        <div className="mx-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
                            <h3 className="text-sm font-semibold text-gray-600 mb-3">
                                Statistics
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total</span>
                                    <span className="font-semibold">
                                        {stats.totalApplications || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Pending</span>
                                    <span className="font-semibold text-yellow-600">
                                        {stats.pendingApplications || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Approved</span>
                                    <span className="font-semibold text-green-600">
                                        {stats.approvedApplications || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Rejected</span>
                                    <span className="font-semibold text-red-600">
                                        {stats.rejectedApplications || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pending Requests Column */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-orange-500">
                                        Pending Requests ({pendingRequests.length})
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                            <Filter className="h-4 w-4" />
                                            Filters
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                                {pendingRequests.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <p>No pending requests</p>
                                        <p className="text-sm mt-1">
                                            New loan requests from students will appear here
                                        </p>
                                    </div>
                                ) : (
                                    pendingRequests.map((request) => (
                                        <div
                                            key={request._id}
                                            className="p-4 hover:bg-gray-50 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">
                                                        {request.student?.firstName}{" "}
                                                        {request.student?.lastName}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {request.student?.email}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {new Date(request.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleView(request._id)}
                                                        className="p-2 border border-gray-300 rounded-lg text-orange-500 hover:bg-orange-50 transition"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(request._id)}
                                                        className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Approved/Proposals Column */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-green-600">
                                        Approved Proposals ({approvedRequests.length})
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                            <Filter className="h-4 w-4" />
                                            Filters
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                                {approvedRequests.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <p>No approved proposals yet</p>
                                        <p className="text-sm mt-1">
                                            Approved loan requests will appear here
                                        </p>
                                    </div>
                                ) : (
                                    approvedRequests.map((request) => (
                                        <div
                                            key={request._id}
                                            className="p-4 hover:bg-gray-50 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">
                                                        {request.student?.firstName}{" "}
                                                        {request.student?.lastName}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {request.student?.email}
                                                    </p>
                                                    {request.nbfcDecision && (
                                                        <div className="mt-1 text-xs">
                                                            <span className="text-green-600">
                                                                ₹
                                                                {request.nbfcDecision.offeredAmount?.toLocaleString()}{" "}
                                                                @ {request.nbfcDecision.offeredRoi}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleView(request._id)}
                                                        className="p-2 border border-gray-300 rounded-lg text-green-600 hover:bg-green-50 transition"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                        Approved
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default NBFCDashboard;
