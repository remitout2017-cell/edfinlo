// context/WorkExperienceContext.jsx
import React, { createContext, useState, useContext, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const WorkExperienceContext = createContext();

const API_BASE_URL = "http://localhost:5000";

// Custom hook to use work experience context
export const useWorkExperience = () => {
  const context = useContext(WorkExperienceContext);
  if (!context) {
    throw new Error(
      "useWorkExperience must be used within WorkExperienceProvider"
    );
  }
  return context;
};

export const WorkExperienceProvider = ({ children }) => {
  const [workExperience, setWorkExperience] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to get auth token
  const getAuthToken = () => {
    return localStorage.getItem("token"); // Changed from "authToken" to "token"
  };

  // =========================================================================
  // FETCH WORK EXPERIENCE
  // =========================================================================
  const fetchWorkExperience = useCallback(async () => {
    console.log("📥 Fetching work experience...");
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}/api/user/workexperience/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        setWorkExperience(response.data.data);
        console.log("✅ Work experience fetched:", response.data.data);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      // 404 is OK - means no work experience yet
      if (error.response?.status === 404) {
        console.log("ℹ️ No work experience found");
        setWorkExperience(null);
        return { success: true, data: null };
      }

      console.error("❌ Fetch work experience failed:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to fetch work experience";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================================================================
  // UPLOAD WORK EXPERIENCE DOCUMENTS
  // =========================================================================
  const uploadWorkExperience = useCallback(
    async (formData) => {
      console.log("📤 Uploading work experience documents...");
      setLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const response = await axios.post(
          `${API_BASE_URL}/api/user/workexperience/submit`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.data?.success) {
          console.log("✅ Work experience uploaded successfully");
          toast.success(
            response.data.message || "Work experience uploaded successfully"
          );

          // Refresh data
          await fetchWorkExperience();

          return { success: true, data: response.data.data };
        }
      } catch (error) {
        console.error("❌ Upload work experience failed:", error);
        const errorMsg =
          error.response?.data?.message || "Failed to upload work experience";
        setError(errorMsg);
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [fetchWorkExperience]
  );

  // =========================================================================
  // DELETE WORK EXPERIENCE
  // =========================================================================
  const deleteWorkExperience = useCallback(async () => {
    console.log("🗑️ Deleting work experience...");
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await axios.delete(
        `${API_BASE_URL}/api/user/workexperience/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        console.log("✅ Work experience deleted");
        toast.success("Work experience deleted successfully");
        setWorkExperience(null);
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Delete work experience failed:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to delete work experience";
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================================================================
  // HEALTH CHECK (optional - check if Python agent is running)
  // =========================================================================
  const checkAgentHealth = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}/api/user/workexperience/health`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ Health check failed:", error);
      return { success: false, message: "Agent unreachable" };
    }
  }, []);

  const value = {
    workExperience,
    loading,
    error,
    fetchWorkExperience,
    uploadWorkExperience,
    deleteWorkExperience,
    checkAgentHealth,
  };

  return (
    <WorkExperienceContext.Provider value={value}>
      {children}
    </WorkExperienceContext.Provider>
  );
};
