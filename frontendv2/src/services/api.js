import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      toast.error("Session expired. Please login again.");
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  registerFromInvite: (data) => api.post("/auth/register-from-invite", data),

  studentLogin: (email, password) =>
    api.post("/auth/login", { email, password }),
  adminLogin: (email, password) =>
    api.post("/admin/login", { email, password }),
  nbfcLogin: (email, password) => api.post("/nbfc/login", { email, password }),
  consultantLogin: (email, password) =>
    api.post("/consultant/login", { email, password }),
  register: (data) => api.post("/auth/register", data),
  verifyEmail: (email, otp) => api.post("/auth/verify-email", { email, otp }),
  verifyPhone: (phoneNumber, otp) =>
    api.post("/auth/verify-phone", { phoneNumber, otp }),
  resendEmailOTP: (email) =>
    api.post("/auth/resend-email-verification", { email }),
  resendPhoneOTP: (phoneNumber) =>
    api.post("/auth/resend-phone-otp", { phoneNumber }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (email, otp, newPassword) =>
    api.post("/auth/reset-password", { email, otp, newPassword }),
  consultantRegister: (data) => api.post("/consultant/register", data),
};

// KYC APIs
export const kycAPI = {
  uploadDocuments: (formData) =>
    api.post("/kyc/upload-docs", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getKYCDetails: () => api.get("/kyc/my-kyc"),
  deleteKYC: () => api.delete("/kyc/my-kyc"),
};

// Academic Records APIs
export const academicAPI = {
  uploadClass10: (formData) =>
    api.post("/academic/upload/class10", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadClass12: (formData) =>
    api.post("/academic/upload/class12", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadGraduation: (formData) =>
    api.post("/academic/upload/graduation", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getRecords: () => api.get("/academic/my-records"),
  deleteHigherEducation: (educationId) =>
    api.delete(`/academic/higher-education/${educationId}`),
};

// Work Experience APIs
export const workExperienceAPI = {
  uploadDocuments: (formData) =>
    api.post("/work-experience/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getExperiences: () => api.get("/work-experience/my-experience"),
  deleteExperience: (experienceId) =>
    api.delete(`/work-experience/${experienceId}`),
};

export const studentEducationPlanAPI = {
  getMyPlan: () => api.get("/students/education-plan"),
  upsertPlan: (data) => api.post("/students/education-plan", data),
};

// Co-Borrower APIs
export const coBorrowerAPI = {
  getAll: () => api.get("/co-borrower"),
  uploadCoreDocs: (formData) =>
    api.post("/co-borrower", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadBankStatements: (id, formData) =>
    api.post(`/co-borrower/${id}/bank-statements`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id) => api.delete(`/co-borrower/${id}`),
};

// Admission Letter APIs
export const admissionAPI = {
  upload: (formData) =>
    api.post("/admission/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getAdmission: () => api.get("/admission/my-admission"),
  delete: () => api.delete("/admission/my-admission"),
};

// Loan Request APIs (FIXED)
export const loanRequestAPI = {
  // Student creates loan request
  create: (nbfcId, analysisHistoryId = null) =>
    api.post("/loan-requests", { nbfcId, analysisHistoryId }),

  // Student accepts approved offer
  acceptOffer: (id) => api.post(`/loan-requests/${id}/accept`),

  // Get student's own loan requests (not implemented in backend yet)
  getStudentRequests: () => api.get("/loan-requests/student"),
};

// Loan Analysis APIs (FIXED)
export const loanAnalysisAPI = {
  // Run basic analysis
  analyze: () => api.post("/loan-analysis/analyze"),

  // Run enhanced analysis
  analyzeEnhanced: () => api.post("/loan-analysis/analyze-enhanced"),

  // Get analysis history with pagination
  getHistory: (page = 1, limit = 10) =>
    api.get(`/loan-analysis/history?page=${page}&limit=${limit}`),

  // Get single analysis by ID
  getById: (id) => api.get(`/loan-analysis/history/${id}`),

  // Delete analysis
  delete: (id) => api.delete(`/loan-analysis/history/${id}`),

  // Compare two analyses
  compare: (id1, id2) => api.get(`/loan-analysis/compare/${id1}/${id2}`),

  // Get application completeness
  getCompleteness: () => api.get("/loan-analysis/completeness"),

  // Get section recommendations
  getSectionRecommendations: (section) =>
    api.get(`/loan-analysis/recommendations/${section}`),
};

// NBFC APIs
export const nbfcAPI = {
  register: (data) => api.post("/nbfc/register", data),
  getProfile: () => api.get("/nbfc/profile"),
  updateProfile: (data) => api.put("/nbfc/profile", data),
  updateLoanConfig: (data) => api.put("/nbfc/loan-config", data),

  // NBFC views loan requests sent to them
  getRequests: (status) =>
    api.get(`/loan-requests/nbfc${status ? `?status=${status}` : ""}`),
  getRequestById: (id) => api.get(`/loan-requests/nbfc/${id}`),

  // NBFC decides on loan request
  decideRequest: (id, status, offeredAmount, offeredRoi, reason) =>
    api.post(`/loan-requests/${id}/decision`, {
      status,
      offeredAmount,
      offeredRoi,
      reason,
    }),

  // For students to see all approved NBFCs
  getAllForStudents: () => api.get("/admin/nbfcs?status=approved"),
};

// src/services/api.js - Admin APIs

export const adminAPI = {
  // Students
  listStudents: (page = 1, limit = 10, search = "") =>
    api.get(`/admin/students?page=${page}&limit=${limit}&search=${search}`),

  createStudent: (data) => api.post("/admin/students", data),

  updateStudent: (id, data) => api.put(`/admin/students/${id}`, data),

  deleteStudent: (id) => api.delete(`/admin/students/${id}`),

  // NBFCs
  listNBFCs: (page = 1, limit = 10, status = "", search = "") =>
    api.get(
      `/admin/nbfcs?page=${page}&limit=${limit}&status=${status}&search=${search}`
    ),

  approveNBFC: (id, approved) =>
    api.put(`/admin/nbfcs/${id}/approve`, { approved }),

  toggleNBFCStatus: (id) => api.put(`/admin/nbfcs/${id}/toggle-status`),

  // Sub-Admins (Super Admin only)
  createSubAdmin: (data) => api.post("/admin/sub-admin", data),

  listAdmins: () => api.get("/admin/admins"),

  updateSubAdmin: (id, data) =>
    api.patch(`/admin/admins/${id}/permissions`, data),

  deleteAdmin: (id) => api.delete(`/admin/admins/${id}`),
};
export const consultantAPI = {
  // ==================== AUTHENTICATION ====================
  register: (data) => api.post("/consultant/register", data),
  login: (email, password) =>
    api.post("/consultant/login", { email, password }),

  // ==================== DASHBOARD ====================
  getDashboardStats: () => api.get("/consultant/dashboard"),

  // ==================== STUDENTS MANAGEMENT ====================
  getStudents: (params = {}) => {
    const { page = 1, limit = 20, search = "", kycStatus = "" } = params;
    return api.get(
      `/consultant/students?page=${page}&limit=${limit}&search=${search}&kycStatus=${kycStatus}`
    );
  },

  getStudentById: (studentId) => api.get(`/consultant/students/${studentId}`),

  getStudentSummary: (studentId) =>
    api.get(`/consultant/students/${studentId}/summary`),

  // ==================== REGISTER STUDENTS ====================
  registerStudents: (data) => api.post("/consultant/register-students", data),

  // ==================== INVITE STUDENTS ====================
  inviteStudents: (data) => api.post("/consultant/invite-students", data),

  getInvites: (params = {}) => {
    const { page = 1, limit = 20 } = params;
    return api.get(`/consultant/invites?page=${page}&limit=${limit}`);
  },

  resendInvite: (inviteId) =>
    api.post(`/consultant/invites/${inviteId}/resend`),

  cancelInvite: (inviteId) => api.delete(`/consultant/invites/${inviteId}`),

  // ==================== LOAN REQUESTS ====================
  getLoanRequests: (params = {}) => {
    const { page = 1, limit = 20, status = "" } = params;
    return api.get(
      `/consultant/loan-requests?page=${page}&limit=${limit}&status=${status}`
    );
  },

  getLoanRequestById: (requestId) =>
    api.get(`/consultant/loan-requests/${requestId}`),

  getStudentLoanRequests: (studentId) =>
    api.get(`/consultant/students/${studentId}/loan-requests`),

  // ==================== ADMISSIONS ====================
  getAdmissions: (params = {}) => {
    const { page = 1, limit = 20, status = "" } = params;
    return api.get(
      `/consultant/admissions?page=${page}&limit=${limit}&status=${status}`
    );
  },

  getAdmissionById: (admissionId) =>
    api.get(`/consultant/admissions/${admissionId}`),

  getStudentAdmissions: (studentId) =>
    api.get(`/consultant/students/${studentId}/admissions`),

  // ==================== LOAN ANALYSIS ====================
  getLoanAnalysis: (params = {}) => {
    const { page = 1, limit = 20 } = params;
    return api.get(`/consultant/loan-analysis?page=${page}&limit=${limit}`);
  },

  getAnalysisHistory: (studentId) =>
    api.get(`/consultant/students/${studentId}/loan-analysis`),

  // ==================== REPORTS & EXPORTS ====================
  exportStudents: (filters = {}) =>
    api.get("/consultant/export/students", {
      params: filters,
      responseType: "blob",
    }),

  exportLoanRequests: (filters = {}) =>
    api.get("/consultant/export/loan-requests", {
      params: filters,
      responseType: "blob",
    }),
};
// Notification APIs
export const notificationAPI = {
  // ✅ FIXED: Changed /notification to /notifications (plural)
  getAll: (page = 1, limit = 20) =>
    api.get(`/notifications?page=${page}&limit=${limit}`),

  // ✅ FIXED: Changed PUT to PATCH to match backend
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),

  // ✅ FIXED: Changed PUT to PATCH and /read-all to match backend
  markAllAsRead: () => api.patch("/notifications/read-all"),

  // ✅ DELETE not implemented in backend yet, so comment it out for now
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get("/user/profile"),
  updateProfile: (data) => api.put("/user/profile", data),
  uploadProfilePicture: (formData) =>
    api.post("/user/profile/picture", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  changePassword: (currentPassword, newPassword) =>
    api.put("/user/change-password", { currentPassword, newPassword }),
};

export default api;
