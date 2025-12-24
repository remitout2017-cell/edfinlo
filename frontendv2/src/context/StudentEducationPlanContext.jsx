// context/StudentEducationPlanContext.jsx
import React, { createContext, useState, useContext, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const StudentEducationPlanContext = createContext();

const API_BASE_URL = "http://localhost:5000";

// Custom hook to use education plan context
export const useStudentEducationPlan = () => {
  const context = useContext(StudentEducationPlanContext);
  if (!context) {
    throw new Error(
      "useStudentEducationPlan must be used within StudentEducationPlanProvider"
    );
  }
  return context;
};

export const StudentEducationPlanProvider = ({ children }) => {
  const [educationPlan, setEducationPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to get auth token
  const getAuthToken = () => {
    return localStorage.getItem("token");
  };

  // =========================================================================
  // FETCH EDUCATION PLAN
  // =========================================================================
  const fetchEducationPlan = useCallback(async () => {
    console.log("📥 Fetching education plan...");
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await axios.get(
        `${API_BASE_URL}/api/user/educationplanet/education-plan`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        setEducationPlan(response.data.data);
        console.log("✅ Education plan fetched:", response.data.data);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      // 404 is OK - means no plan yet
      if (error.response?.status === 404) {
        console.log("ℹ️ No education plan found");
        setEducationPlan(null);
        return { success: true, data: null };
      }

      console.error("❌ Fetch education plan failed:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to fetch education plan";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // =========================================================================
  // SAVE/UPDATE EDUCATION PLAN (Upsert)
  // =========================================================================
  const saveEducationPlan = useCallback(async (planData) => {
    console.log("📤 Saving education plan...");
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const response = await axios.post(
        `${API_BASE_URL}/api/user/educationplanet/education-plan`,
        planData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.success) {
        console.log("✅ Education plan saved successfully");
        toast.success(
          response.data.message || "Education plan saved successfully"
        );

        // Update local state
        setEducationPlan(response.data.data);

        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error("❌ Save education plan failed:", error);
      const errorMsg =
        error.response?.data?.message || "Failed to save education plan";
      setError(errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    educationPlan,
    loading,
    error,
    fetchEducationPlan,
    saveEducationPlan,
  };

  return (
    <StudentEducationPlanContext.Provider value={value}>
      {children}
    </StudentEducationPlanContext.Provider>
  );
};
