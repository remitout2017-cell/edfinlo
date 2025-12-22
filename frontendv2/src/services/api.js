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

// ==================== STUDENT AUTH APIs ====================
export const authAPI = {
  // Student Authentication
  register: (data) => api.post("/auth/register", data),
  registerFromInvite: (data) => api.post("/auth/register-from-invite", data),
  login: (email, password) => api.post("/auth/login", { email, password }),

  // Email Verification
  verifyEmail: (email, otp) => api.post("/auth/verify-email", { email, otp }),
  resendEmailOTP: (email) => api.post("/auth/resend-email-otp", { email }),

  // Phone Verification
  verifyPhone: (phoneNumber, otp) =>
    api.post("/auth/verify-phone", { phoneNumber, otp }),
  resendPhoneOTP: (phoneNumber) =>
    api.post("/auth/resend-phone-otp", { phoneNumber }),

  // Password Reset
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (email, otp, newPassword) =>
    api.post("/auth/reset-password", { email, otp, newPassword }),
  resendResetOTP: (email) => api.post("/auth/resend-reset-otp", { email }),

  // Get Current User
  getMe: () => api.get("/auth/me"),
};

// ==================== USER PROFILE APIs ====================
export const userAPI = {
  getProfile: () => api.get("/user/profile"),
  updateProfile: (data) => api.put("/user/profile", data),
  changePassword: (currentPassword, newPassword) =>
    api.put("/user/change-password", { currentPassword, newPassword }),
  deleteAccount: () => api.delete("/user/account"),
};

// ==================== KYC APIs ====================
export const kycAPI = {
  uploadDocuments: (formData) =>
    api.post("/user/kyc/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getKYCDetails: () => api.get("/user/kyc/kyc/me"),
};

// ==================== ACADEMIC RECORDS APIs ====================
export const academicAPI = {
  // Extract academic records from PDFs
  extractComplete: (formData) =>
    api.post("/user/academics/extract/complete", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  extractClass10: (formData) =>
    api.post("/user/academics/extract/class10", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  extractClass12: (formData) =>
    api.post("/user/academics/extract/class12", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Get and Delete
  getRecords: () => api.get("/user/academics/records"),
  deleteRecord: (recordType) => api.delete(`/user/academics/${recordType}`), // recordType: class10, class12, graduation

  // Health Check
  healthCheck: () => api.get("/user/academics/health"),
};

// ==================== TEST SCORES APIs ====================
export const testScoresAPI = {
  // Smart extraction - upload any combination of test scores
  extract: (formData) =>
    api.post("/user/testscores/extract", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  getTestScores: () => api.get("/user/testscores"),
  deleteTestScore: (testType) => api.delete(`/user/testscores/${testType}`), // testType: toefl, gre, ielts

  // Health Check
  healthCheck: () => api.get("/user/testscores/health"),
};

// ==================== WORK EXPERIENCE APIs ====================
export const workExperienceAPI = {
  submit: (formData) =>
    api.post("/user/workexperience/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getExperience: () => api.get("/user/workexperience/me"),
  deleteExperience: () => api.delete("/user/workexperience/me"),

  // Health Check
  healthCheck: () => api.get("/user/workexperience/health"),
};

// ==================== ADMISSION LETTER APIs ====================
export const admissionAPI = {
  submit: (formData) =>
    api.post("/user/admission/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getAdmission: () => api.get("/user/admission/me"),
  deleteAdmission: () => api.delete("/user/admission/me"),

  // Score Analysis
  getScoreAnalysis: () => api.get("/user/admission/analysis"),
  getScoreComparison: () => api.get("/user/admission/analysis/comparison"),

  // Health Check
  healthCheck: () => api.get("/user/admission/health"),
};

// ==================== STUDENT EDUCATION PLAN APIs ====================
export const studentEducationPlanAPI = {
  getMyPlan: () => api.get("/user/educationplan"),
  upsertPlan: (data) => api.post("/user/educationplan", data),
};

// ==================== CO-BORROWER APIs ====================
export const coBorrowerAPI = {
  // Get all co-borrowers
  getAll: () => api.get("/coborrower/list"),
  getById: (coBorrowerId) => api.get(`/coborrower/${coBorrowerId}`),
  delete: (coBorrowerId) => api.delete(`/coborrower/${coBorrowerId}`),

  // KYC Upload (multipart with JSON fields + files)
  uploadKYC: (formData) =>
    api.post("/coborrower/kyc/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Re-verify KYC
  reverifyKYC: (coBorrowerId, formData) =>
    api.put(`/coborrower/${coBorrowerId}/kyc/reverify`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Financial Documents Upload (triggers Python server automatically)
  uploadFinancialDocs: (coBorrowerId, formData) =>
    api.post(`/coborrower/${coBorrowerId}/financial/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Get Financial Status & Analysis
  getFinancialStatus: (coBorrowerId) =>
    api.get(`/coborrower/${coBorrowerId}/financial/status`),
  getFinancialAnalysis: (coBorrowerId) =>
    api.get(`/coborrower/${coBorrowerId}/financial/analysis`),

  // Reset Financial Documents
  resetFinancialDocs: (coBorrowerId) =>
    api.delete(`/coborrower/${coBorrowerId}/financial/reset`),
};

// ==================== NBFC MATCHING & LOAN REQUEST APIs ====================
export const loanMatchingAPI = {
  // Run AI matching algorithm (takes ~5-10 seconds)
  analyzeMatches: () => api.post("/student/loan-matching/analyze"),

  // Send loan request to specific NBFC
  sendRequest: (nbfcId, data) =>
    api.post(`/student/loan-matching/send-request/${nbfcId}`, data),

  // Get student's loan requests
  getMyRequests: () => api.get("/student/loan-matching/my-requests"),

  // Accept approved NBFC offer
  acceptOffer: (requestId) =>
    api.post(`/student/loan-matching/accept-offer/${requestId}`),

  // Get analysis history
  getHistory: () => api.get("/student/loan-matching/history"),
};

// ==================== NBFC APIs ====================
export const nbfcAPI = {
  // Authentication
  register: (data) => api.post("/nbfc/auth/register", data),
  login: (email, password) => api.post("/nbfc/auth/login", { email, password }),
  verifyEmail: (email, otp) =>
    api.post("/nbfc/auth/verify-email", { email, otp }),
  resendEmailOTP: (email) => api.post("/nbfc/auth/resend-email-otp", { email }),
  getMe: () => api.get("/nbfc/auth/me"),

  // Loan Criteria Management
  createCriteria: (data) => api.post("/nbfc/criteria", data),
  getCriteria: () => api.get("/nbfc/criteria"),
  updateCriteria: (criterionType, data) =>
    api.put(`/nbfc/criteria/${criterionType}`, data), // criterionType: cibil, foir, income, etc.

  // Loan Request Management
  getPendingRequests: () => api.get("/nbfc/loan-requests/pending"),
  getRequestById: (requestId) => api.get(`/nbfc/loan-requests/${requestId}`),
  approveRequest: (requestId, data) =>
    api.put(`/nbfc/loan-requests/${requestId}/approve`, data),
  rejectRequest: (requestId, data) =>
    api.put(`/nbfc/loan-requests/${requestId}/reject`, data),
  requestAdditionalDocs: (requestId, data) =>
    api.put(`/nbfc/loan-requests/${requestId}/request-docs`, data),
};

// ==================== CONSULTANT APIs ====================
export const consultantAPI = {
  // Authentication
  register: (data) => api.post("/consultant/auth/register", data),
  login: (email, password) =>
    api.post("/consultant/auth/login", { email, password }),
  verifyEmail: (email, otp) =>
    api.post("/consultant/auth/verify-email", { email, otp }),
  resendEmailOTP: (email) =>
    api.post("/consultant/auth/resend-email-otp", { email }),
  getMe: () => api.get("/consultant/auth/me"),

  // Student Invitation
  inviteStudent: (data) => api.post("/consultant/students/invite", data),
  getInvitations: () => api.get("/consultant/students/invitations"),
  resendInvite: (inviteId) =>
    api.post(`/consultant/students/invite/${inviteId}/resend`),

  // Student Management
  getMyStudents: (params = {}) => {
    const { status = "all", page = 1, limit = 10 } = params;
    return api.get(
      `/consultant/students/my-students?status=${status}&page=${page}&limit=${limit}`
    );
  },
  getStudentById: (studentId) => api.get(`/consultant/students/${studentId}`),
  getStudentProgress: (studentId) =>
    api.get(`/consultant/students/${studentId}/progress`),
  getStudentMatches: (studentId) =>
    api.get(`/consultant/students/${studentId}/matches`),
};

// ==================== NOTIFICATION APIs (if implemented) ====================
export const notificationAPI = {
  getAll: (page = 1, limit = 20) =>
    api.get(`/notifications?page=${page}&limit=${limit}`),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/notifications/read-all"),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

export default api;
