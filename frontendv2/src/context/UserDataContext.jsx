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

// Base URL for API calls
const API_BASE_URL = "http://localhost:5000";

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within UserDataProvider");
  }
  return ctx;
};

export const UserDataProvider = ({ children }) => {
  // Initialize from localStorage
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

  // Check if user is authenticated (has token)
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
      // Determine endpoint based on user type
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

        // Update state
        setUserData(freshUserData);

        // Update localStorage with fresh data
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

      // If 401/403, token might be invalid - clear auth
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
      console.log("data====",data);

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
    }
    return null;
  }, [userType]);

  // Refresh user data (can be called manually from any component)
  const refreshUserData = useCallback(async () => {
    const userData = await fetchUserData();
    // Also refresh completeness and KYC when user data is refreshed
    if (userType === "student") {
      await Promise.all([fetchCompleteness(), fetchKyc()]);
    }
    return userData;
  }, [fetchUserData, fetchCompleteness, fetchKyc, userType]);

  // Update user data locally (for optimistic updates)
  const updateUserData = useCallback((updates) => {
    setUserData((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear user data (for logout)
  const clearUserData = useCallback(() => {
    setUserData(null);
    setError(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userType");
  }, []);

  // Fetch fresh data when component mounts (if authenticated)
  useEffect(() => {
    if (isAuthenticated && !userData) {
      fetchUserData();
    }
  }, [isAuthenticated]);

  // Context value
  const value = {
    // User data
    userData,
    user: userData, // Alias for convenience

    // Loading and error states
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

    // Document completeness
    completeness,

    // KYC data
    kyc,

    // Computed properties for easy access
    firstName: userData?.firstName || "",
    lastName: userData?.lastName || "",
    fullName: userData
      ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
      : "",
    email: userData?.email || "",
    phoneNumber: userData?.phoneNumber || "",
    role: userData?.role || userType,

    // Student-specific data
    kycStatus: userData?.kycStatus || null,
    academicRecords: userData?.academicRecords || [],
    testScores: userData?.testScores || [],
    workExperience: userData?.workExperience || [],
    coBorrowers: userData?.coBorrowers || [],
    admissionLetters: userData?.admissionLetters || [],
    consultant: userData?.consultant || null,

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
