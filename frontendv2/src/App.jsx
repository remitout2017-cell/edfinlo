// src/App.jsx - COMPLETE VERSION WITH CONSULTANT
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { UserDataProvider } from "./context/UserDataContext";
import RegisterFromInvite from "./pages/auth/RegisterFromInvite";

// ==================== AUTH PAGES ====================
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyEmail from "./pages/auth/VerifyEmail";
import VerifyPhone from "./pages/auth/VerifyPhone";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// ==================== HOME PAGE ====================
import Home from "./pages/Home";

// ==================== STUDENT PAGES ====================
import StudentDashboard from "./pages/student/Dashboard";
import StudentKYC from "./pages/student/KYC";
import StudentAcademicRecords from "./pages/student/AcademicRecords";
import StudentWorkExperience from "./pages/student/WorkExperience";
import StudentCoBorrower from "./pages/student/CoBorrower";
import StudentAdmission from "./pages/student/Admission";
import StudentLoanRequest from "./pages/student/LoanRequest";
import StudentLoanAnalysis from "./pages/student/LoanAnalysis";
import StudentProfile from "./pages/student/Profile";

// ==================== ADMIN PAGES ====================
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStudents from "./pages/admin/Students";
import AdminNBFCs from "./pages/admin/NBFCs";
import AdminSubAdmins from "./pages/admin/SubAdmins";

// ==================== CONSULTANT PAGES ====================
import ConsultantDashboard from "./pages/consultant/Dashboard";
import ConsultantStudents from "./pages/consultant/Students";
import ConsultantInvite from "./pages/consultant/Invite";
import ConsultantProfiles from "./pages/consultant/Profiles";
import ConsultantLoanRequests from "./pages/consultant/LoanRequestDetail";
import ConsultantAdmissions from "./pages/consultant/Admissions";
import ConsultantLoanAnalysis from "./pages/consultant/LoanAnalysis";
import ConsultantStudentDetail from "./pages/consultant/StudentDetail";
import Studyeducationplan from "./pages/student/StudentEducationPlan";
// ==================== COMMON PAGES ====================
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <div>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <UserDataProvider>
              <Toaster position="top-right" />
              <Routes>
                {/* ==================== PUBLIC ROUTES ==================== */}
                <Route path="/" element={<Home />} />

                {/* Auth Routes */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register/invite"
                  element={<RegisterFromInvite />}
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />

                {/* Verification Routes */}
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/verify-phone" element={<VerifyPhone />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* ==================== STUDENT ROUTES ==================== */}
                <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
                  <Route
                    path="/student"
                    element={<Navigate to="/student/dashboard" replace />}
                  />
                  <Route
                    path="/student/dashboard"
                    element={<StudentDashboard />}
                  />
                  <Route
                    path="/student/education-plan"
                    element={<Studyeducationplan />}
                  />
                  <Route path="/student/kyc" element={<StudentKYC />} />
                  <Route
                    path="/student/academic-records"
                    element={<StudentAcademicRecords />}
                  />
                  <Route
                    path="/student/work-experience"
                    element={<StudentWorkExperience />}
                  />
                  <Route
                    path="/student/co-borrower"
                    element={<StudentCoBorrower />}
                  />
                  <Route
                    path="/student/admission"
                    element={<StudentAdmission />}
                  />
                  <Route
                    path="/student/loan-request"
                    element={<StudentLoanRequest />}
                  />
                  <Route
                    path="/student/loan-analysis"
                    element={<StudentLoanAnalysis />}
                  />
                  <Route path="/student/profile" element={<StudentProfile />} />
                </Route>

                {/* ==================== CONSULTANT ROUTES ==================== */}
                <Route
                  element={<ProtectedRoute allowedRoles={["consultant"]} />}
                >
                  <Route
                    path="/consultant"
                    element={<Navigate to="/consultant/dashboard" replace />}
                  />
                  <Route
                    path="/consultant/dashboard"
                    element={<ConsultantDashboard />}
                  />
                  <Route
                    path="/consultant/students"
                    element={<ConsultantStudents />}
                  />
                  <Route
                    path="/consultant/students/:id"
                    element={<ConsultantStudentDetail />}
                  />
                  <Route
                    path="/consultant/invite"
                    element={<ConsultantInvite />}
                  />
                  <Route
                    path="/consultant/profiles"
                    element={<ConsultantProfiles />}
                  />
                  <Route
                    path="/consultant/loan-requests"
                    element={<ConsultantLoanRequests />}
                  />
                  <Route
                    path="/consultant/admissions"
                    element={<ConsultantAdmissions />}
                  />
                  <Route
                    path="/consultant/loan-analysis"
                    element={<ConsultantLoanAnalysis />}
                  />
                </Route>

                {/* ==================== ADMIN ROUTES ==================== */}
                <Route
                  element={
                    <ProtectedRoute allowedRoles={["superadmin", "subadmin"]} />
                  }
                >
                  <Route
                    path="/admin"
                    element={<Navigate to="/admin/dashboard" replace />}
                  />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/students" element={<AdminStudents />} />
                  <Route path="/admin/nbfcs" element={<AdminNBFCs />} />
                </Route>

                {/* ==================== SUPERADMIN ONLY ==================== */}
                <Route
                  element={<ProtectedRoute allowedRoles={["superadmin"]} />}
                >
                  <Route
                    path="/admin/sub-admins"
                    element={<AdminSubAdmins />}
                  />
                </Route>

                {/* ==================== 404 ==================== */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UserDataProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
