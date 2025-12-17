// backend/routes/adminRoutes.js

const express = require("express");

const {
  protect,
  restrictTo,
  authorizePermissions,
} = require("../middlewares/authMiddleware");

const {
  loginAdmin,
  secretRegisterSuperAdmin,
  createSubAdmin,
  listAdmins,
  updateSubAdminPermissions,
  deleteAdmin,
  // Students
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  // NBFCs
  listNBFCs,
  approveNBFC,
  toggleNBFCStatus,
} = require("../controllers/adminController");

const router = express.Router();

// ========================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ========================================

// SECRET SUPER ADMIN REGISTRATION
router.post("/secret-register-superadmin", secretRegisterSuperAdmin);

// Admin Login
router.post("/login", loginAdmin);

// ========================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ========================================

// ALL ROUTES BELOW THIS LINE REQUIRE AUTHENTICATION
router.use(protect);

// ========================================
// SUPERADMIN ONLY ROUTES
// ========================================

// Sub-admin management
router.post("/sub-admin", restrictTo("superadmin"), createSubAdmin);
router.get("/admins", restrictTo("superadmin"), listAdmins);
router.patch(
  "/admins/:id/permissions",
  restrictTo("superadmin"),
  updateSubAdminPermissions
);
router.delete("/admins/:id", restrictTo("superadmin"), deleteAdmin);

// ========================================
// ADMIN & SUBADMIN ROUTES (WITH PERMISSIONS)
// ========================================

// NBFC Management
router.get(
  "/nbfcs",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("nbfcs:read"),
  listNBFCs
);

router.put(
  "/nbfcs/:id/approve",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("nbfcs:approve"),
  approveNBFC
);

router.put(
  "/nbfcs/:id/toggle-status",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("nbfcs:update"),
  toggleNBFCStatus
);

// Student Management
router.get(
  "/students",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("students:read"),
  listStudents
);

router.post(
  "/students",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("students:create"),
  createStudent
);

router.put(
  "/students/:id",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("students:update"),
  updateStudent
);

router.delete(
  "/students/:id",
  restrictTo("superadmin", "subadmin"),
  authorizePermissions("students:delete"),
  deleteStudent
);

module.exports = router;
