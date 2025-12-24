// src/context/AuthContext.jsx
// Complete Auth Context with direct axios calls - no api.js dependency

import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const AuthContext = createContext(null);
const API_BASE_URL = "http://localhost:5000";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth state on mount
  useEffect(() => {
    if (token && !user) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem("user"));
      const userType = localStorage.getItem("userType") || "student";

      if (userData) {
        // Add role if missing
        if (!userData.role) {
          userData.role = userType;
        }
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  // Helper to clear auth data
  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userType");
  };

  // Helper to get auth headers
  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  });

  // Get dashboard route based on role
  const getDashboardRoute = (role) => {
    const roleRoutes = {
      student: "/student/dashboard",
      admin: "/admin/dashboard",
      superadmin: "/admin/dashboard",
      subadmin: "/admin/dashboard",
      nbfc: "/nbfc/dashboard",
      consultant: "/consultant/dashboard",
    };
    return roleRoutes[role?.toLowerCase()] || "/";
  };

  // ==================== LOGIN ====================
  const login = async (email, password, userType = "student") => {
    try {
      // Determine endpoint based on user type
      let endpoint = `${API_BASE_URL}/api/auth/login`;
      if (userType === "consultant") {
        endpoint = `${API_BASE_URL}/api/consultant/auth/login`;
      } else if (userType === "admin") {
        endpoint = `${API_BASE_URL}/api/admin/auth/login`;
      }

      const response = await axios.post(
        endpoint,
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        let newToken, userData;

        // Extract token and user data based on response structure
        if (userType === "student") {
          newToken = response.data.data?.token;
          userData = { ...response.data.data?.student, role: "student" };
        } else if (userType === "consultant") {
          newToken = response.data.data?.token || response.data.token;
          userData = {
            ...(response.data.data?.consultant || response.data.consultant),
            role: "consultant",
          };
        } else if (userType === "admin") {
          newToken = response.data.data?.token || response.data.token;
          userData = {
            ...(response.data.data?.admin || response.data.admin),
            role:
              response.data.data?.admin?.role ||
              response.data.admin?.role ||
              "admin",
          };
        }

        // Store auth data
        setToken(newToken);
        setUser(userData);
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("userType", userType);

        return { success: true, data: { token: newToken, user: userData } };
      } else {
        return {
          success: false,
          message: response.data.message || "Login failed",
        };
      }
    } catch (error) {
      console.error("Login error:", error);
      const message = error.response?.data?.message || "Login failed";
      return { success: false, message, data: error.response?.data };
    }
  };

  // ==================== REGISTER ====================
  const register = async (formData) => {
    try {
      const endpoint = formData.inviteToken
        ? `${API_BASE_URL}/api/auth/register-from-invite`
        : `${API_BASE_URL}/api/auth/register`;

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber || undefined,
      };

      if (formData.inviteToken) {
        payload.token = formData.inviteToken;
      }

      const response = await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.success) {
        // Store user data if returned
        if (response.data.data?.token) {
          localStorage.setItem("token", response.data.data.token);
          localStorage.setItem(
            "user",
            JSON.stringify(response.data.data.student)
          );
          localStorage.setItem("userType", "student");
        }
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Register error:", error);
      const message = error.response?.data?.message || "Registration failed";
      return { success: false, message };
    }
  };

  // ==================== CONSULTANT REGISTER ====================
  const registerConsultant = async (formData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/consultant/auth/register`,
        formData,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Consultant register error:", error);
      const message = error.response?.data?.message || "Registration failed";
      return { success: false, message };
    }
  };

  // ==================== VERIFY EMAIL ====================
  const verifyEmail = async (email, otp) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-email`,
        { email, otp },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Verify email error:", error);
      const message = error.response?.data?.message || "Verification failed";
      return { success: false, message };
    }
  };

  // ==================== RESEND EMAIL OTP ====================
  const resendEmailOTP = async (email) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/resend-email-otp`,
        { email },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Resend email OTP error:", error);
      const message = error.response?.data?.message || "Failed to resend OTP";
      return { success: false, message };
    }
  };

  // ==================== VERIFY PHONE ====================
  const verifyPhone = async (phoneNumber, otp) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-phone`,
        { phoneNumber, otp },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, data: response.data };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Verify phone error:", error);
      const message = error.response?.data?.message || "Verification failed";
      return { success: false, message };
    }
  };

  // ==================== RESEND PHONE OTP ====================
  const resendPhoneOTP = async (phoneNumber) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/resend-phone-otp`,
        { phoneNumber },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Resend phone OTP error:", error);
      const message = error.response?.data?.message || "Failed to resend OTP";
      return { success: false, message };
    }
  };

  // ==================== FORGOT PASSWORD ====================
  const forgotPassword = async (email) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/forgot-password`,
        { email },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      const message =
        error.response?.data?.message || "Failed to send reset email";
      return { success: false, message };
    }
  };

  // ==================== RESET PASSWORD ====================
  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/reset-password`,
        { email, otp, newPassword },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Reset password error:", error);
      const message =
        error.response?.data?.message || "Failed to reset password";
      return { success: false, message };
    }
  };

  // ==================== CONSULTANT FORGOT PASSWORD ====================
  const forgotPasswordConsultant = async (email) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/consultant/auth/forgot-password`,
        { email },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Consultant forgot password error:", error);
      const message =
        error.response?.data?.message || "Failed to send reset email";
      return { success: false, message };
    }
  };

  // ==================== CONSULTANT RESET PASSWORD ====================
  const resetPasswordConsultant = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/consultant/auth/reset-password`,
        { email, otp, newPassword },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Consultant reset password error:", error);
      const message =
        error.response?.data?.message || "Failed to reset password";
      return { success: false, message };
    }
  };

  // ==================== LOGOUT ====================
  const logout = () => {
    clearAuth();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  // Context value
  const value = {
    // State
    user,
    token,
    loading,

    // Auth methods
    login,
    register,
    registerConsultant,
    logout,

    // Verification methods
    verifyEmail,
    verifyPhone,
    resendEmailOTP,
    resendPhoneOTP,

    // Password methods
    forgotPassword,
    resetPassword,
    forgotPasswordConsultant,
    resetPasswordConsultant,

    // Helpers
    getDashboardRoute,
    getAuthHeaders,

    // Computed properties
    isAuthenticated: !!token,
    isStudent: user?.role?.toLowerCase() === "student",
    isAdmin: ["admin", "superadmin", "subadmin"].includes(
      user?.role?.toLowerCase()
    ),
    isNBFC: user?.role?.toLowerCase() === "nbfc",
    isConsultant: user?.role?.toLowerCase() === "consultant",
    userType: localStorage.getItem("userType") || "student",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
