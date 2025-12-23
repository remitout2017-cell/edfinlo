// src/context/UserDataContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import axios from "axios";

const UserDataContext = createContext(null);

const API_BASE_URL = "http://localhost:5000";

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within UserDataProvider");
  }
  return ctx;
};

export const UserDataProvider = ({ children }) => {
  const [userData, setUserData] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Document completeness state
  const [completeness, setCompleteness] = useState({
    percentage: 0,
    completedFields: 0,
    totalFields: 13,
    sections: {},
    nextAction: "",
    readyForAnalysis: false,
  });

  // KYC state
  const [kyc, setKyc] = useState({
    kycStatus: null,
    kycData: null,
    kycVerifiedAt: null,
    kycRejectedAt: null,
  });

  // Academic records state
  const [academicData, setAcademicData] = useState(null);

  // ✅ NEW: Test scores state
  const [testScoresData, setTestScoresData] = useState(null);

  // ✅ NEW: Admission data state
  const [admissionData, setAdmissionData] = useState(null);

  const isAuthenticated = !!localStorage.getItem("token");
  const userType = localStorage.getItem("userType") || "student";

  // Fetch fresh user data from API
  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUserData(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      let endpoint = `${API_BASE_URL}/api/auth/me`;
      if (userType === "consultant") {
        endpoint = `${API_BASE_URL}/api/consultant/auth/me`;
      } else if (userType === "admin") {
        endpoint = `${API_BASE_URL}/api/admin/auth/me`;
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.success) {
        const freshUserData = response.data.data;
        setUserData(freshUserData);
        localStorage.setItem("user", JSON.stringify(freshUserData));
        console.log("✅ User data refreshed from API");
        return freshUserData;
      } else {
        throw new Error(response.data.message || "Failed to fetch user data");
      }
    } catch (err) {
      console.error("❌ Failed to fetch user data:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load user data"
      );

      if (err.response?.status === 401 || err.response?.status === 403) {
        console.warn("⚠️ Token invalid, clearing auth...");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("userType");
        setUserData(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [userType]);

  // Fetch document completeness
  const fetchCompleteness = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || userType !== "student") return null;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/loan-analysis/completeness`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const data = response.data.data;
        setCompleteness(data);
        console.log("✅ Completeness data fetched");
        return data;
      }
    } catch (err) {
      console.error("❌ Failed to fetch completeness:", err);
    }
    return null;
  }, [userType]);

  // Fetch KYC data
  const fetchKyc = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || userType !== "student") return null;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/kyc/kyc/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = response.data;
      setKyc({
        kycStatus: data.kycStatus || null,
        kycData: data.kycData || null,
        kycVerifiedAt: data.kycVerifiedAt || null,
        kycRejectedAt: data.kycRejectedAt || null,
      });
      console.log("✅ KYC data fetched", data.kycStatus);
      return data;
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("❌ Failed to fetch KYC:", err);
      }
      return null;
    }
  }, [userType]);

  // Fetch academic records
  const fetchAcademicRecords = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || userType !== "student") return null;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/user/academics/records`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const data = response.data.data;
        setAcademicData(data);
        console.log("✅ Academic records fetched");
        return data;
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("❌ Failed to fetch academic records:", err);
      } else {
        setAcademicData(null);
      }
      return null;
    }
  }, [userType]);

  // ✅ NEW: Fetch test scores
  const fetchTestScores = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || userType !== "student") return null;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/testscores`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.success) {
        const data = response.data.data;
        setTestScoresData(data);
        console.log("✅ Test scores fetched");
        return data;
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("❌ Failed to fetch test scores:", err);
      } else {
        setTestScoresData(null);
      }
      return null;
    }
  }, [userType]);

  // ✅ NEW: Fetch admission data
  const fetchAdmission = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || userType !== "student") return null;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/user/admission/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const data = response.data.data;
        setAdmissionData(data);
        console.log("✅ Admission data fetched");
        return data;
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("❌ Failed to fetch admission:", err);
      } else {
        setAdmissionData(null);
      }
      return null;
    }
  }, [userType]);

  // Refresh all user data
  const refreshUserData = useCallback(async () => {
    const userData = await fetchUserData();

    if (userType === "student") {
      await Promise.all([
        fetchCompleteness(),
        fetchKyc(),
        fetchAcademicRecords(),
        fetchTestScores(),
        fetchAdmission(),
      ]);
    }
    return userData;
  }, [
    fetchUserData,
    fetchCompleteness,
    fetchKyc,
    fetchAcademicRecords,
    fetchTestScores,
    fetchAdmission,
    userType,
  ]);

  // Update user data locally
  const updateUserData = useCallback((updates) => {
    setUserData((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear user data
  const clearUserData = useCallback(() => {
    setUserData(null);
    setError(null);
    setAcademicData(null);
    setTestScoresData(null);
    setAdmissionData(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
  }, []);

  // Fetch fresh data when component mounts
  useEffect(() => {
    if (isAuthenticated && !userData) {
      fetchUserData();
    }
  }, [isAuthenticated]);

  // Context value
  const value = {
    // User data
    userData,
    user: userData,
    loading,
    error,
    isAuthenticated,
    userType,

    // Actions
    refreshUserData,
    updateUserData,
    clearUserData,
    fetchCompleteness,
    fetchKyc,
    fetchAcademicRecords,
    fetchTestScores,
    fetchAdmission,
    setAcademicData,
    setTestScoresData,
    setAdmissionData,

    // State data
    completeness,
    kyc,
    academicData,
    testScoresData,
    admissionData,

    // Computed properties
    firstName: userData?.firstName || "",
    lastName: userData?.lastName || "",
    fullName: userData
      ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
      : "",
    email: userData?.email || "",
    phoneNumber: userData?.phoneNumber || "",
    role: userData?.role || userType,

    // Verification status
    isEmailVerified: userData?.isEmailVerified || false,
    isPhoneVerified: userData?.isPhoneVerified || false,
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};

export default UserDataContext;
