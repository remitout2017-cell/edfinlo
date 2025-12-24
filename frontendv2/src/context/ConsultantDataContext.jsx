// src/context/ConsultantDataContext.jsx
// Dedicated context for consultant-specific data - separate from student contexts
import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
} from "react";
import axios from "axios";

const ConsultantDataContext = createContext(null);

const API_BASE_URL = "http://localhost:5000";

export const useConsultantData = () => {
    const ctx = useContext(ConsultantDataContext);
    if (!ctx) {
        throw new Error(
            "useConsultantData must be used within ConsultantDataProvider"
        );
    }
    return ctx;
};

export const ConsultantDataProvider = ({ children }) => {
    const [consultantData, setConsultantData] = useState(() => {
        try {
            const storedUser = localStorage.getItem("user");
            const userType = localStorage.getItem("userType");
            if (userType === "consultant" && storedUser) {
                return JSON.parse(storedUser);
            }
            return null;
        } catch {
            return null;
        }
    });

    const [students, setStudents] = useState([]);
    const [invitedStudents, setInvitedStudents] = useState([]);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        completedProfiles: 0,
        pendingInvites: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const userType = localStorage.getItem("userType");
    const isConsultant = userType === "consultant";

    // Get auth header
    const getAuthHeader = useCallback(() => {
        const token = localStorage.getItem("token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    // ============================================================================
    // Fetch consultant profile from /api/consultant/auth/me
    // ============================================================================
    const fetchConsultantProfile = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token || !isConsultant) {
            return null;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/consultant/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.data.success) {
                const data = response.data.data;
                setConsultantData(data);
                localStorage.setItem("user", JSON.stringify(data));

                // Update stats if available
                if (data.stats) {
                    setStats(data.stats);
                }

                // Update invited students if available
                if (data.invitedStudents) {
                    setInvitedStudents(data.invitedStudents);
                }

                console.log("✅ Consultant profile fetched");
                return data;
            } else {
                throw new Error(response.data.message || "Failed to fetch profile");
            }
        } catch (err) {
            console.error("❌ Failed to fetch consultant profile:", err);
            setError(
                err.response?.data?.message || err.message || "Failed to load profile"
            );

            if (err.response?.status === 401 || err.response?.status === 403) {
                console.warn("⚠️ Token invalid, clearing auth...");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("userType");
                setConsultantData(null);
            }
            return null;
        } finally {
            setLoading(false);
        }
    }, [isConsultant]);

    // ============================================================================
    // Fetch students managed by this consultant
    // ============================================================================
    const fetchStudents = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token || !isConsultant) {
            return [];
        }

        setLoading(true);
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/consultant/students`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.data.success) {
                const data = response.data.data || [];
                setStudents(data);
                console.log("✅ Consultant students fetched:", data.length);
                return data;
            }
        } catch (err) {
            console.error("❌ Failed to fetch students:", err);
            if (err.response?.status !== 404) {
                setError(err.response?.data?.message || "Failed to load students");
            }
        } finally {
            setLoading(false);
        }
        return [];
    }, [isConsultant]);

    // ============================================================================
    // Invite a student
    // ============================================================================
    const inviteStudent = useCallback(
        async (email) => {
            const token = localStorage.getItem("token");
            if (!token || !isConsultant) {
                throw new Error("Unauthorized");
            }

            setLoading(true);
            setError(null);
            try {
                const response = await axios.post(
                    `${API_BASE_URL}/api/consultant/students/invite`,
                    { email },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (response.data.success) {
                    console.log("✅ Student invited:", email);
                    // Refresh profile to get updated invitedStudents
                    await fetchConsultantProfile();
                    return response.data;
                } else {
                    throw new Error(response.data.message || "Failed to invite student");
                }
            } catch (err) {
                console.error("❌ Failed to invite student:", err);
                const errorMsg =
                    err.response?.data?.message ||
                    err.message ||
                    "Failed to invite student";
                setError(errorMsg);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [isConsultant, fetchConsultantProfile]
    );

    // ============================================================================
    // Get student details
    // ============================================================================
    const getStudentDetails = useCallback(
        async (studentId) => {
            const token = localStorage.getItem("token");
            if (!token || !isConsultant) {
                throw new Error("Unauthorized");
            }

            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/consultant/students/${studentId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (response.data.success) {
                    return response.data.data;
                } else {
                    throw new Error(
                        response.data.message || "Failed to fetch student details"
                    );
                }
            } catch (err) {
                console.error("❌ Failed to fetch student details:", err);
                throw err;
            }
        },
        [isConsultant]
    );

    // ============================================================================
    // Refresh all consultant data
    // ============================================================================
    const refreshConsultantData = useCallback(async () => {
        if (!isConsultant) return null;

        const profile = await fetchConsultantProfile();
        await fetchStudents();
        return profile;
    }, [isConsultant, fetchConsultantProfile, fetchStudents]);

    // ============================================================================
    // Clear consultant data
    // ============================================================================
    const clearConsultantData = useCallback(() => {
        setConsultantData(null);
        setStudents([]);
        setInvitedStudents([]);
        setStats({
            totalStudents: 0,
            activeStudents: 0,
            completedProfiles: 0,
            pendingInvites: 0,
        });
        setError(null);
    }, []);

    // Fetch data on mount if consultant
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token && isConsultant && !consultantData) {
            fetchConsultantProfile();
        }
    }, [isConsultant]);

    // Context value
    const value = {
        // Data
        consultantData,
        consultant: consultantData,
        students,
        invitedStudents,
        stats,
        loading,
        error,
        isConsultant,

        // Actions
        fetchConsultantProfile,
        fetchStudents,
        inviteStudent,
        getStudentDetails,
        refreshConsultantData,
        clearConsultantData,

        // Computed properties
        firstName: consultantData?.firstName || "",
        lastName: consultantData?.lastName || "",
        fullName: consultantData
            ? `${consultantData.firstName || ""} ${consultantData.lastName || ""}`.trim()
            : "",
        email: consultantData?.email || "",
        companyName: consultantData?.companyName || "",
    };

    return (
        <ConsultantDataContext.Provider value={value}>
            {children}
        </ConsultantDataContext.Provider>
    );
};

export default ConsultantDataContext;
