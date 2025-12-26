// src/pages/nbfc/AcceptedStudents.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import {
    LayoutDashboard,
    Settings,
    Users,
    Loader,
    Bell,
    Search,
    Filter,
    ChevronDown,
    Mail,
    Phone,
    RefreshCw,
    CheckCircle,
    Clock,
    XCircle,
} from "lucide-react";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
    ? rawBaseUrl.slice(0, -4)
    : rawBaseUrl.replace(/\/$/, "");

const AcceptedStudents = () => {
    const { user, getAuthHeaders } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [students, setStudents] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_BASE_URL}/api/nbfc/students`, {
                headers: getAuthHeaders(),
            });

            if (response.data.success) {
                setStudents(response.data.data?.acceptedStudents || []);
            }
        } catch (err) {
            console.error("Failed to fetch students:", err);
            setError(err.response?.data?.message || "Failed to load students");
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (studentId, newStatus) => {
        setUpdatingId(studentId);

        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/nbfc/students/${studentId}`,
                { loanStatus: newStatus },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                // Update local state
                setStudents((prev) =>
                    prev.map((s) =>
                        s.studentId._id === studentId || s.studentId === studentId
                            ? { ...s, loanStatus: newStatus }
                            : s
                    )
                );
            }
        } catch (err) {
            alert(err.response?.data?.message || "Failed to update status");
        } finally {
            setUpdatingId(null);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "approved":
                return <CheckCircle className="text-green-500" size={16} />;
            case "pending":
                return <Clock className="text-yellow-500" size={16} />;
            case "rejected":
                return <XCircle className="text-red-500" size={16} />;
            case "disbursed":
                return <CheckCircle className="text-blue-500" size={16} />;
            default:
                return <Clock className="text-gray-400" size={16} />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "approved":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "rejected":
                return "bg-red-100 text-red-800";
            case "disbursed":
                return "bg-blue-100 text-blue-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    // Filter students
    const filteredStudents = students.filter((s) => {
        const student = s.studentId || {};
        const name = `${student.firstName || ""} ${student.lastName || ""}`.toLowerCase();
        const email = (student.email || "").toLowerCase();
        const matchesSearch =
            searchTerm === "" ||
            name.includes(searchTerm.toLowerCase()) ||
            email.includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === "all" || s.loanStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="animate-spin mx-auto text-orange-500" size={48} />
                    <p className="mt-4 text-gray-600">Loading students...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-4">
                            <Link to="/nbfc/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">E</span>
                                </div>
                                <span className="text-xl font-bold text-gray-800">EDULOAN</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={fetchStudents}
                                className="p-2 text-gray-500 hover:text-gray-700"
                                title="Refresh"
                            >
                                <RefreshCw className="h-5 w-5" />
                            </button>
                            <button className="p-2 text-gray-500 hover:text-gray-700">
                                <Bell className="h-5 w-5" />
                            </button>
                            <span className="text-sm font-medium text-gray-700">
                                {user?.companyName || "NBFC"}
                            </span>
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
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl"
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
                            className="flex items-center gap-3 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium"
                        >
                            <Users className="h-5 w-5" />
                            Students
                        </Link>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    <div className="max-w-6xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Accepted Students
                                </h1>
                                <p className="text-gray-600 text-sm mt-1">
                                    Track and manage loans for approved students
                                </p>
                            </div>
                            <span className="px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium">
                                {students.length} Students
                            </span>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="disbursed">Disbursed</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Students Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {filteredStudents.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Users className="mx-auto text-gray-300 mb-4" size={48} />
                                    <p className="text-lg font-medium">No students found</p>
                                    <p className="text-sm mt-1">
                                        {students.length === 0
                                            ? "Approved students will appear here"
                                            : "Try adjusting your filters"}
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Student
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Contact
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Accepted On
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredStudents.map((item, idx) => {
                                            const student = item.studentId || {};
                                            const studentId =
                                                typeof student === "object" ? student._id : student;

                                            return (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                                                <span className="text-orange-600 font-semibold">
                                                                    {student.firstName?.[0] || "?"}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900">
                                                                    {student.firstName} {student.lastName}
                                                                </p>
                                                                <p className="text-sm text-gray-500">
                                                                    ID: {studentId?.slice(-8) || "N/A"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                <Mail size={14} />
                                                                {student.email || "N/A"}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                <Phone size={14} />
                                                                {student.phoneNumber || "N/A"}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {item.acceptedAt
                                                            ? new Date(item.acceptedAt).toLocaleDateString()
                                                            : "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                                                item.loanStatus
                                                            )}`}
                                                        >
                                                            {getStatusIcon(item.loanStatus)}
                                                            {item.loanStatus || "pending"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <select
                                                            value={item.loanStatus || "pending"}
                                                            onChange={(e) =>
                                                                updateStatus(studentId, e.target.value)
                                                            }
                                                            disabled={updatingId === studentId}
                                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="approved">Approved</option>
                                                            <option value="disbursed">Disbursed</option>
                                                            <option value="rejected">Rejected</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AcceptedStudents;
