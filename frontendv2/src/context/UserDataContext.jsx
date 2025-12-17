import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { userAPI, nbfcAPI } from "../services/api"; // adjust paths/names if needed
import toast from "react-hot-toast";

const UserDataContext = createContext(null);

export const useUserData = () => {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within UserDataProvider");
  }
  return ctx;
};

export const UserDataProvider = ({ children }) => {
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = async () => {
    if (!isAuthenticated || !authUser) {
      setProfile(null);
      return;
    }

    const role = authUser.role?.toLowerCase();
    setLoading(true);

    try {
      // STUDENT: /api/users/profile -> { success, data: { user } }
      if (role === "student") {
        const res = await userAPI.getProfile();
        setProfile(res.data.data.user);
        return;
      }

      // NBFC: /api/nbfc/profile -> { success, nbfc }
      if (role === "nbfc") {
        const res = await nbfcAPI.getProfile();
        setProfile(res.data.nbfc);
        return;
      }

      // ADMIN / CONSULTANT: no profile endpoint; use authUser
      setProfile(authUser);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      toast.error(error.response?.data?.message || "Failed to load profile");
      // Fallback to authUser so app still works
      setProfile(authUser);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadProfile();
    }
  }, [authLoading, authUser?.role]);

  useEffect(() => {
    if (profile) {
      console.log("Profile loaded:", profile);
    }
  }, [profile]);

  const value = {
    profile, // normalized user object for any role
    profileLoading: loading,
    refreshProfile: loadProfile,
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};
