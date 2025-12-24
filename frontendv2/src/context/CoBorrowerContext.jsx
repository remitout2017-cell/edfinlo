// src/context/CoBorrowerContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import axios from "axios";

const CoBorrowerContext = createContext(null);

const API_BASE_URL = "http://localhost:5000";

export const useCoBorrowerData = () => {
  const ctx = useContext(CoBorrowerContext);
  if (!ctx) {
    throw new Error("useCoBorrowerData must be used within CoBorrowerProvider");
  }
  return ctx;
};

export const CoBorrowerProvider = ({ children }) => {
  const [coBorrowers, setCoBorrowers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCoBorrower, setSelectedCoBorrower] = useState(null);

  // Get auth token
  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // ============================================================================
  // Fetch all coborrowers for the logged-in student
  // ============================================================================
  const fetchCoBorrowers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCoBorrowers([]);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/coborrower/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.success) {
        const data = response.data.data || [];
        setCoBorrowers(data);
        console.log("✅ Co-borrowers fetched:", data.length);
        return data;
      } else {
        throw new Error(response.data.error || "Failed to fetch co-borrowers");
      }
    } catch (err) {
      console.error("❌ Failed to fetch co-borrowers:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        "Failed to load co-borrowers";
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Create coborrower with KYC documents
  // ============================================================================
  const createCoBorrowerWithKyc = useCallback(
    async (formData) => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/coborrower/kyc/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ Co-borrower created with KYC");
          // Refresh the list
          await fetchCoBorrowers();
          return response.data;
        } else {
          throw new Error(
            response.data.error || "Failed to create co-borrower"
          );
        }
      } catch (err) {
        console.error("❌ Failed to create co-borrower:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to create co-borrower";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchCoBorrowers]
  );

  // ============================================================================
  // Upload financial documents and auto-process via agent
  // ============================================================================
  const uploadFinancialDocuments = useCallback(
    async (coBorrowerId, formData) => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/coborrower/${coBorrowerId}/financial/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ Financial documents uploaded and processed");
          // Refresh the list to get updated financial data
          await fetchCoBorrowers();
          return response.data;
        } else {
          throw new Error(
            response.data.error || "Failed to upload financial documents"
          );
        }
      } catch (err) {
        console.error("❌ Failed to upload financial documents:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to upload financial documents";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchCoBorrowers]
  );

  // ============================================================================
  // Get coborrower by ID
  // ============================================================================
  const getCoBorrowerById = useCallback(async (coBorrowerId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Unauthorized");
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/coborrower/${coBorrowerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("✅ Co-borrower details fetched:", coBorrowerId);
        setSelectedCoBorrower(response.data.data);
        return response.data.data;
      } else {
        throw new Error(
          response.data.error || "Failed to fetch co-borrower details"
        );
      }
    } catch (err) {
      console.error("❌ Failed to fetch co-borrower details:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        "Failed to fetch co-borrower details";
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // Delete coborrower
  // ============================================================================
  const deleteCoBorrower = useCallback(
    async (coBorrowerId) => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.delete(
          `${API_BASE_URL}/api/coborrower/${coBorrowerId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ Co-borrower deleted:", coBorrowerId);
          // Refresh the list
          await fetchCoBorrowers();
          return response.data;
        } else {
          throw new Error(
            response.data.error || "Failed to delete co-borrower"
          );
        }
      } catch (err) {
        console.error("❌ Failed to delete co-borrower:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to delete co-borrower";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchCoBorrowers]
  );

  // ============================================================================
  // Re-verify KYC for rejected coborrower
  // ============================================================================
  const reverifyKyc = useCallback(
    async (coBorrowerId, formData) => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.put(
          `${API_BASE_URL}/api/coborrower/${coBorrowerId}/kyc/reverify`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ KYC re-verified for co-borrower:", coBorrowerId);
          // Refresh the list
          await fetchCoBorrowers();
          return response.data;
        } else {
          throw new Error(response.data.error || "Failed to re-verify KYC");
        }
      } catch (err) {
        console.error("❌ Failed to re-verify KYC:", err);
        const errorMsg =
          err.response?.data?.error || err.message || "Failed to re-verify KYC";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchCoBorrowers]
  );

  // ============================================================================
  // Get financial verification status
  // ============================================================================
  const getFinancialStatus = useCallback(async (coBorrowerId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Unauthorized");
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/coborrower/${coBorrowerId}/financial/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("✅ Financial status fetched:", coBorrowerId);
        return response.data.data;
      } else {
        throw new Error(
          response.data.error || "Failed to fetch financial status"
        );
      }
    } catch (err) {
      console.error("❌ Failed to fetch financial status:", err);
      return null;
    }
  }, []);

  // ============================================================================
  // Get complete financial analysis
  // ============================================================================
  const getFinancialAnalysis = useCallback(async (coBorrowerId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Unauthorized");
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/coborrower/${coBorrowerId}/financial/analysis`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("✅ Financial analysis fetched:", coBorrowerId);
        return response.data.data;
      } else {
        throw new Error(
          response.data.error || "Failed to fetch financial analysis"
        );
      }
    } catch (err) {
      console.error("❌ Failed to fetch financial analysis:", err);
      return null;
    }
  }, []);

  // ============================================================================
  // Reset financial documents (allows re-upload)
  // ============================================================================
  const resetFinancialDocuments = useCallback(
    async (coBorrowerId) => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.delete(
          `${API_BASE_URL}/api/coborrower/${coBorrowerId}/financial/reset`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ Financial documents reset:", coBorrowerId);
          // Refresh the list
          await fetchCoBorrowers();
          return response.data;
        } else {
          throw new Error(
            response.data.error || "Failed to reset financial documents"
          );
        }
      } catch (err) {
        console.error("❌ Failed to reset financial documents:", err);
        const errorMsg =
          err.response?.data?.error ||
          err.message ||
          "Failed to reset financial documents";
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchCoBorrowers]
  );

  // ============================================================================
  // Clear error
  // ============================================================================
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    // State
    coBorrowers,
    loading,
    error,
    selectedCoBorrower,

    // Actions
    fetchCoBorrowers,
    createCoBorrowerWithKyc,
    uploadFinancialDocuments,
    getCoBorrowerById,
    deleteCoBorrower,
    reverifyKyc,
    getFinancialStatus,
    getFinancialAnalysis,
    resetFinancialDocuments,
    clearError,
    setSelectedCoBorrower,
  };

  return (
    <CoBorrowerContext.Provider value={value}>
      {children}
    </CoBorrowerContext.Provider>
  );
};

export default CoBorrowerContext;
