// src/pages/nbfc/Dashboard.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
    LayoutDashboard,
    Search,
    Eye,
    X,
    Bell,
    ChevronDown,
    Filter,
    LogOut,
} from "lucide-react";

const NBFCDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [requestsFilter, setRequestsFilter] = useState("");
    const [proposalsFilter, setProposalsFilter] = useState("");
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Mock data for demonstration
    const mockRequests = [
        { id: "REQ001", studentName: "Aryan Sharma", studentId: "HYUIUJ756738" },
        { id: "REQ002", studentName: "Priya Patel", studentId: "HYUIUJ756739" },
        { id: "REQ003", studentName: "Rahul Verma", studentId: "HYUIUJ756740" },
        { id: "REQ004", studentName: "Sneha Gupta", studentId: "HYUIUJ756741" },
        { id: "REQ005", studentName: "Vikram Singh", studentId: "HYUIUJ756742" },
    ];

    const mockProposals = [
        { id: "PROP001", studentName: "Amit Kumar", studentId: "HYUIUJ756743" },
        { id: "PROP002", studentName: "Neha Joshi", studentId: "HYUIUJ756744" },
        { id: "PROP003", studentName: "Rohan Das", studentId: "HYUIUJ756745" },
        { id: "PROP004", studentName: "Kavya Nair", studentId: "HYUIUJ756746" },
        { id: "PROP005", studentName: "Aditya Roy", studentId: "HYUIUJ756747" },
    ];

    const handleView = (id, type) => {
        // Navigate to request detail page
        navigate(`/nbfc/requests/${id}`);
    };

    const handleReject = (id, type) => {
        console.log(`Reject ${type}:`, id);
        // TODO: Implement reject logic
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

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
                                    <span className="text-white font-bold text-sm">R</span>
                                </div>
                                <span className="text-xl font-bold text-gray-800">REMITOUT</span>
                            </Link>
                        </div>

                        {/* Search Bar */}
                        <div className="flex-1 max-w-lg mx-8 flex items-center">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-4">
                            <button className="p-2 text-gray-500 hover:text-gray-700 relative">
                                <Bell className="h-5 w-5" />
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
                                        {user?.companyName || "Bank Rep"}
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
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Requests Column */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-orange-500">
                                        Requests
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                            <Filter className="h-4 w-4" />
                                            Filters
                                        </button>
                                        <button className="p-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                                            <Search className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {mockRequests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="p-4 hover:bg-gray-50 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">
                                                    {request.studentName}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {request.studentId}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleView(request.id, "request")}
                                                    className="p-2 border border-gray-300 rounded-lg text-orange-500 hover:bg-orange-50 transition"
                                                    title="View"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleReject(request.id, "request")}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proposals Column */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-orange-500">
                                        Proposals
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                            <Filter className="h-4 w-4" />
                                            Filters
                                        </button>
                                        <button className="p-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                                            <Search className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {mockProposals.map((proposal) => (
                                    <div
                                        key={proposal.id}
                                        className="p-4 hover:bg-gray-50 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">
                                                    {proposal.studentName}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {proposal.studentId}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleView(proposal.id, "proposal")}
                                                    className="p-2 border border-gray-300 rounded-lg text-orange-500 hover:bg-orange-50 transition"
                                                    title="View"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleReject(proposal.id, "proposal")}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default NBFCDashboard;
