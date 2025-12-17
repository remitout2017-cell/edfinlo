// controllers/adminController.js
const Admin = require("../models/Admin");
const User = require("../models/students");
const NBFC = require("../models/NBFC");
const generateToken = require("../utils/generateToken");
const AppError = require("../middlewares/errorMiddleware");
const cache = require("../utils/cache");

exports.secretRegisterSuperAdmin = async (req, res, next) => {
  try {
    const { name, email, password, secretKey } = req.body;

    // ✅ SECRET KEY - Change this to your own secret!
    const SUPER_ADMIN_SECRET =
      process.env.SUPER_ADMIN_SECRET || "MySecretKey@2025!Admin";

    if (secretKey !== SUPER_ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Invalid secret key. Unauthorized access.",
      });
    }

    // ✅ REMOVED: Check if super admin already exists
    // Now you can create multiple super admins with the secret key

    // Check if email already exists
    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    // Create super admin
    const superAdmin = await Admin.create({
      name,
      email,
      password,
      role: "superadmin",
      isActive: true,
      permissions: [], // Super admin has all permissions by default
    });

    res.status(201).json({
      success: true,
      message: "Super admin created successfully",
      admin: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Login super/sub admin
exports.loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });

    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin || !(await admin.comparePassword(password)))
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    if (!admin.isActive)
      return res
        .status(403)
        .json({ success: false, message: "Account deactivated" });

    admin.lastLogin = Date.now();
    await admin.save();

    const token = generateToken(admin.id, admin.role);
    const { password: _, ...data } = admin.toObject();
    res.json({
      success: true,
      message: "Login successful",
      token,
      admin: data,
    });
  } catch (err) {
    next(err);
  }
};

// Create sub-admin (superadmin only)
exports.createSubAdmin = async (req, res, next) => {
  try {
    const { name, email, password, permissions } = req.body;
    const exists = await Admin.findOne({ email });
    if (exists)
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });

    const sub = await Admin.create({
      name,
      email,
      password,
      role: "subadmin",
      permissions: Array.isArray(permissions) ? permissions : [],
    });
    res.status(201).json({
      success: true,
      message: "Sub-admin created",
      admin: { ...sub.toObject(), password: "Pass@123" },
    });
  } catch (err) {
    next(err);
  }
};

// List admins (superadmin)
exports.listAdmins = async (_req, res, next) => {
  try {
    const cacheKey = "all_admins";
    let admins = await cache.get(cacheKey);

    if (admins) {
      return res.json({ success: true, count: admins.length, admins });
    }

    admins = await Admin.find().select("+permissions");
    await cache.set(cacheKey, admins, 3600); // Cache for 1 hour

    res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    next(err);
  }
};

// Update sub-admin permissions (superadmin)
exports.updateSubAdminPermissions = async (req, res, next) => {
  try {
    const { permissions, role } = req.body; // role optional: promote/demote to subadmin
    const admin = await Admin.findById(req.params.id);
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    if (admin.role === "superadmin")
      return res.status(400).json({
        success: false,
        message: "Cannot modify superadmin with this endpoint",
      });

    if (Array.isArray(permissions)) admin.permissions = permissions;
    const allowedRoles = ["subadmin"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    await admin.save();
    res.json({ success: true, message: "Permissions updated", admin });
  } catch (err) {
    next(err);
  }
};

// Delete sub-admin (superadmin)
exports.deleteAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    if (admin.role === "superadmin")
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete superadmin" });
    await admin.deleteOne();
    res.json({ success: true, message: "Admin deleted" });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin-side Student management (permission-gated)
 */
exports.listStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const cacheKey = `admin:students:${page}:${limit}:${search || ""}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, fromCache: true });
    }

    const q = {};
    if (search) {
      q.$or = [
        { email: new RegExp(search, "i") },
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
      ];
    }

    const students = await User.find(q)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(q);

    const payload = {
      count: students.length,
      total,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      students,
    };

    await cache.set(cacheKey, payload, 60);

    res.json({ success: true, ...payload, fromCache: false });
  } catch (err) {
    next(err);
  }
};

exports.createStudent = async (req, res, next) => {
  try {
    const payload = req.body;
    // Minimal create; rely on existing Student schema validation/hooks
    const student = await User.create(payload);
    res
      .status(201)
      .json({ success: true, message: "Student created", student });
  } catch (err) {
    next(err);
  }
};

exports.updateStudent = async (req, res, next) => {
  try {
    const updates = req.body;
    // ❌ Block password update
    if (updates.password) {
      delete updates.password;
    }
    const student = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    res.json({ success: true, message: "Student updated", student });
  } catch (err) {
    next(err);
  }
};

exports.deleteStudent = async (req, res, next) => {
  try {
    const student = await User.findByIdAndDelete(req.params.id);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    res.json({ success: true, message: "Student deleted" });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin-side NBFC visibility and approval (permission-gated)
 */
exports.listNBFCs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    // Build a stable cache key based on query params
    const cacheKey = `admin:nbfcs:${page}:${limit}:${status || "all"}:${
      search || ""
    }`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, fromCache: true });
    }

    const query = {};
    if (status === "approved") query.isApprovedByAdmin = true;
    else if (status === "pending") query.isApprovedByAdmin = false;
    if (search)
      query.$or = [
        { companyName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];

    const nbfcs = await NBFC.find(query)
      .select("-password")
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const count = await NBFC.countDocuments(query);

    const payload = {
      count: nbfcs.length,
      total: count,
      currentPage: Number(page),
      totalPages: Math.ceil(count / limit),
      nbfcs,
    };

    // Store in cache for 60 seconds (override default TTL if you want)
    await cache.set(cacheKey, payload, 60);

    res.json({ success: true, ...payload, fromCache: false });
  } catch (err) {
    next(err);
  }
};

exports.approveNBFC = async (req, res, next) => {
  try {
    const { approved } = req.body;
    if (typeof approved !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "Approved must be boolean" });
    }

    const nbfc = await NBFC.findByIdAndUpdate(
      req.params.id,
      { isApprovedByAdmin: approved },
      { new: true }
    );

    if (!nbfc) {
      return res
        .status(404)
        .json({ success: false, message: "NBFC not found" });
    }

    // Invalidate NBFC admin list caches
    await cache.delByPrefix("admin:nbfcs:");

    res.json({
      success: true,
      message: `NBFC ${approved ? "approved" : "rejected"} successfully`,
      nbfc,
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleNBFCStatus = async (req, res, next) => {
  try {
    const nbfc = await NBFC.findById(req.params.id);
    if (!nbfc) {
      return res
        .status(404)
        .json({ success: false, message: "NBFC not found" });
    }

    nbfc.isActive = !nbfc.isActive;
    await nbfc.save();

    // Invalidate NBFC admin list caches
    await cache.delByPrefix("admin:nbfcs:");

    res.json({
      success: true,
      message: `NBFC ${
        nbfc.isActive ? "activated" : "deactivated"
      } successfully`,
      nbfc,
    });
  } catch (err) {
    next(err);
  }
};
