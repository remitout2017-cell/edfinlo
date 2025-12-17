// src/context/AuthContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem("user"));
      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const navigateByRole = (role) => {
    const roleRoutes = {
      student: "/student/dashboard",
      admin: "/admin/dashboard",
      superadmin: "/admin/dashboard",
      subadmin: "/admin/dashboard",
      nbfc: "/nbfc/dashboard",
      consultant: "/consultant/dashboard",
    };
    navigate(roleRoutes[role?.toLowerCase()] || "/");
  };

  const login = async (email, password, userType = "student") => {
    try {
      let response;
      let newToken;
      let userData;

      switch (userType) {
        case "admin":
          response = await authAPI.adminLogin(email, password);
          newToken = response.data.token;
          userData = { ...response.data.admin, role: response.data.admin.role };
          break;
        case "nbfc":
          response = await authAPI.nbfcLogin(email, password);
          newToken = response.data.token;
          userData = { ...response.data.nbfc, role: "nbfc" };
          break;
        case "consultant":
          response = await authAPI.consultantLogin(email, password);
          newToken = response.data.token;
          userData = {
            ...response.data.consultant,
            role: response.data.consultant.role,
          };
          break;
        default:
          response = await authAPI.studentLogin(email, password);
          newToken = response.data.data.token;
          userData = { ...response.data.data.user, role: "student" };
          break;
      }

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Login successful!");
      navigateByRole(userData.role);

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || "Login failed";
      toast.error(message);
      return { success: false, message, data: error.response?.data };
    }
  };

  // Unified register with userType
  const register = async (formData, userType = "student") => {
    try {
      let response;
      if (userType === "consultant") {
        response = await authAPI.consultantRegister(formData);
      } else {
        response = await authAPI.register(formData);
      }

      toast.success("Registration successful! Please verify your email.");
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || "Registration failed";
      toast.error(message);
      return { success: false, message, data: error.response?.data };
    }
  };

  const verifyEmail = async (email, otp) => {
    try {
      await authAPI.verifyEmail(email, otp);
      toast.success("Email verified successfully!");
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || "Verification failed";
      toast.error(message);
      return { success: false, message };
    }
  };

  const verifyPhone = async (phoneNumber, otp) => {
    try {
      await authAPI.verifyPhone(phoneNumber, otp);
      toast.success("Phone verified successfully!");
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || "Verification failed";
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/login");
  };

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

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    getDashboardRoute,
    verifyEmail,
    verifyPhone,
    isAuthenticated: !!token,
    isStudent: user?.role?.toLowerCase() === "student",
    isAdmin: ["admin", "superadmin", "subadmin"].includes(
      user?.role?.toLowerCase()
    ),
    isNBFC: user?.role?.toLowerCase() === "nbfc",
    isConsultant: user?.role?.toLowerCase() === "consultant",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
