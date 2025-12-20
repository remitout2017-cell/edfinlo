# ============================================================================
# FILE 1: agent_server.py (CORRECTED - Admission Only)
# ============================================================================

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from typing import List
from pathlib import Path
import shutil
import time
from datetime import datetime

from config import Config
from session_manager import session_manager
from main import AdmissionLetterProcessor


app = FastAPI(
    title="Admission Letter Extraction API",
    description="AI-powered admission letter extraction ONLY + university ranking",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processor
processor = AdmissionLetterProcessor(threshold_strength="none")


def save_upload_file(upload_file: UploadFile, destination: Path) -> Path:
    """Save uploaded file to destination path."""
    try:
        with destination.open("wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        return destination
    finally:
        try:
            upload_file.file.close()
        except Exception:
            pass


def save_many(upload_files: List[UploadFile], dest_dir: Path, prefix: str) -> List[str]:
    """Save a list of UploadFile into dest_dir and return list of filesystem paths."""
    if not upload_files:
        return []

    out: List[str] = []
    for idx, f in enumerate(upload_files, start=1):
        if not f or not f.filename:
            continue
        safe_name = f.filename.replace("/", "_").replace("\\", "_")
        dst = dest_dir / f"{prefix}_{idx}_{safe_name}"
        save_upload_file(f, dst)
        out.append(str(dst))
    return out


@app.get("/")
async def root():
    return {
        "service": "Admission Letter Extraction API",
        "status": "operational",
        "version": "2.0.0",
        "features": [
            "Admission letter extraction ONLY",
            "University ranking via Google Search",
            "No optional documents processed"
        ],
        "endpoints": {
            "extract": "/extract/admission-letter",
            "health": "/health",
        },
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "config": {
            "gemini_configured": bool(Config.GEMINI_API_KEY),
            "openrouter_configured": bool(Config.OPENROUTER_API_KEY),
            "groq_configured": bool(Config.GROQ_API_KEY),
            "auto_cleanup": bool(Config.AUTO_CLEANUP),
        },
        "active_sessions": session_manager.get_active_sessions(),
    }


@app.post("/extract/admission-letter")
async def extract_admission_letter(
    # ONLY admission letters - no optional documents
    admissionletters: List[UploadFile] = File(
        ..., description="MANDATORY: Admission/Offer letter PDFs or images (at least 1 required)"),
):
    """
    Extract ONLY from admission/offer letters.
    Returns extracted data + university ranking via Google Search.
    """
    start_time = time.time()
    session_id = session_manager.create_session()
    session_dir = session_manager.get_session_dir(session_id)

    try:
        # Save uploads inside the session folder
        admission_paths = save_many(
            admissionletters, session_dir, "admissionletter")

        if not admission_paths:
            raise HTTPException(
                status_code=400,
                detail="admissionletters is required (at least 1 file)."
            )

        # Run processor - ONLY admission letters
        record = processor.process_documents(
            admission_letters=admission_paths
        )

        return {
            "success": True,
            "session_id": record.session_id,
            "processing_time_seconds": round(time.time() - start_time, 2),
            "data": record.model_dump(mode="json"),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if Config.AUTO_CLEANUP:
            session_manager.cleanup_session(session_id)


if __name__ == "__main__":
    import uvicorn

    print("="*70)
    print("🎓 ADMISSION LETTER EXTRACTION API SERVER")
    print("="*70)
    print("Features:")
    print("  ✅ Admission letters ONLY (no optional documents)")
    print("  ✅ University ranking via Google Search")
    print("  ✅ Automatic data validation")
    print("")
    print("Server: http://localhost:7000")
    print("Docs:   http://localhost:7000/docs")
    print("="*70)

    uvicorn.run(
        "agent_server:app",
        host="0.0.0.0",
        port=7000,
        reload=True,
        log_level="info",
    )


# ============================================================================
# FILE 2: admission.controller.js (CORRECTED - Node.js Backend)
# ============================================================================

"""
// controllers/students/admission.controller.js
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const crypto = require("crypto");

const AdmissionLetter = require("../../models/student/AdmissionLetter");
const Student = require("../../models/student/students");
const { asyncHandler, AppError } = require("../../middleware/errorMiddleware");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../services/imageService");

const ADMISSION_AGENT_URL =
  process.env.ADMISSION_AGENT_URL || "http://localhost:7000";

function safePublicId(userId) {
  return `students_${userId}_admission_${Date.now()}_${crypto
    .randomBytes(6)
    .toString("hex")}`;
}

function cleanupTempFiles(files) {
  if (!files) return;
  const all = Object.values(files).flat();
  all.forEach((f) => {
    try {
      if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
    } catch (err) {
      // best-effort cleanup
    }
  });
}

async function callAdmissionAgent(files) {
  const form = new FormData();

  // ONLY admissionletters - no optional documents
  if (files.admissionletters?.length) {
    files.admissionletters.forEach((f) => {
      form.append(
        "admissionletters",
        fs.createReadStream(f.path),
        f.originalname
      );
    });
  } else {
    throw new AppError("admissionletters file is required", 400);
  }

  try {
    const resp = await axios.post(
      `${ADMISSION_AGENT_URL}/extract/admission-letter`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return resp.data;
  } catch (error) {
    throw new AppError(
      `Admission agent failed: ${ 
        error.response?.data?.detail || error.message
      }`,
      500
    );
  }
}

async function uploadAdmissionDocument(filePath, userId) {
  if (!fs.existsSync(filePath))
    throw new AppError(`File not found: ${filePath}`, 400);

  const publicId = safePublicId(userId);

  const result = await uploadToCloudinary(filePath, {
    folder: `students/${userId}/admission`,
    resource_type: "raw",
    type: "authenticated",
    public_id: publicId,
  });

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id || publicId,
    resourceType: result.resource_type || "raw",
    type: "authenticated",
  };
}

async function deletePreviousAdmissionCloudinary(existingDoc) {
  const cloud = existingDoc?.extractedFields?.cloudinary;
  if (!cloud?.publicId) return;

  await deleteFromCloudinary(
    cloud.publicId,
    cloud.resourceType || "raw",
    cloud.type || "authenticated"
  );
}

// POST /submit - ONLY admission letters
exports.submitAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Unauthorized", 401);

  if (!req.files?.admissionletters?.length) {
    throw new AppError("admissionletters file is required", 400);
  }

  try {
    // 1) Call python agent
    const agentResponse = await callAdmissionAgent(req.files);
    if (!agentResponse?.success || !agentResponse?.data) {
      throw new AppError("Extraction failed - no data returned", 422);
    }

    // 2) Upload original admission letter to Cloudinary
    const uploadRes = await uploadAdmissionDocument(
      req.files.admissionletters[0].path,
      userId
    );

    // 3) Map fields from agent response
    const record = agentResponse.data;
    const first = record?.admission_letters?.[0] || {};

    const computedStatus =
      record?.status === "success" && (record?.valid_admissions ?? 0) > 0
        ? "verified"
        : record?.status === "partial"
        ? "pending"
        : "failed";

    // 4) Extract university ranking from notes (if present)
    const rankingInfo = extractRankingFromNotes(first.notes);

    // 5) One admission letter per user
    const existing = await AdmissionLetter.findOne({ user: userId });
    if (existing) await deletePreviousAdmissionCloudinary(existing);

    const update = {
      user: userId,
      status: computedStatus,
      admissionLetterUrl: uploadRes.url,
      universityName: first.university_name || null,
      programName: first.program_name || null,
      intakeTerm: first.intake_term || null,
      intakeYear: first.intake_year || null,
      country: first.country || null,
      failureReason:
        Array.isArray(record?.errors) && record.errors.length
          ? record.errors[0]
          : null,

      // Store university ranking
      universityReputation: rankingInfo,

      // Store full agent output
      extractedFields: {
        agentRecord: record,
        cloudinary: uploadRes,
        savedAt: new Date(),
      },

      evaluationSource: "admission-letter-agent-v2",
      evaluatedAt: new Date(),
    };

    const saved = await AdmissionLetter.findOneAndUpdate(
      { user: userId },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Link on Student
    await Student.findByIdAndUpdate(userId, { admissionLetters: saved._id });

    return res.status(200).json({
      success: true,
      message: "Admission letter processed successfully",
      processingTime: agentResponse.processing_time_seconds,
      data: saved,
    });
  } finally {
    cleanupTempFiles(req.files);
  }
});

// Helper to extract ranking from notes field
function extractRankingFromNotes(notes) {
  if (!notes) return null;

  const ranking = {
    qsWorldRanking: null,
    theWorldRanking: null,
    usNewsRanking: null,
    rankingYear: null,
  };

  // Parse QS ranking
  const qsMatch = notes.match(/QS World Ranking:\s*#?(\d+)/i);
  if (qsMatch) ranking.qsWorldRanking = parseInt(qsMatch[1]);

  // Parse THE ranking
  const theMatch = notes.match(/THE World Ranking:\s*#?(\d+)/i);
  if (theMatch) ranking.theWorldRanking = parseInt(theMatch[1]);

  // Parse US News ranking
  const usMatch = notes.match(/US News Ranking:\s*#?(\d+)/i);
  if (usMatch) ranking.usNewsRanking = parseInt(usMatch[1]);

  // Parse year
  const yearMatch = notes.match(/Year:\s*(\d{4})/i);
  if (yearMatch) ranking.rankingYear = parseInt(yearMatch[1]);

  return ranking;
}

// GET /me
exports.getMyAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Unauthorized", 401);

  const doc = await AdmissionLetter.findOne({ user: userId }).lean();
  if (!doc) throw new AppError("No admission letter found", 404);

  return res.status(200).json({ success: true, data: doc });
});

// DELETE /me
exports.deleteMyAdmissionLetter = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Unauthorized", 401);

  const doc = await AdmissionLetter.findOne({ user: userId });
  if (!doc) throw new AppError("No admission letter found", 404);

  await deletePreviousAdmissionCloudinary(doc);
  await AdmissionLetter.deleteOne({ _id: doc._id });

  await Student.findByIdAndUpdate(userId, { $unset: { admissionLetters: "" } });

  return res
    .status(200)
    .json({ success: true, message: "Admission letter deleted" });
});

// GET /health (public)
exports.healthCheck = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${ADMISSION_AGENT_URL}/health`, {
      timeout: 5000,
    });
    return res.status(200).json({
      success: true,
      message: "Admission python agent is reachable",
      agentStatus: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Admission python agent is unreachable",
      error: error.message,
    });
  }
});
"""


# ============================================================================
# FILE 3: admission.routes.js (CORRECTED - Node.js Routes)
# ============================================================================

"""
// routes/students/admission.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const upload = require("../../middleware/imageUpload");

const {
  submitAdmissionLetter,
  getMyAdmissionLetter,
  deleteMyAdmissionLetter,
  healthCheck,
} = require("../../controllers/students/admission.controller");

// Public
router.get("/health", healthCheck);

// Protected
router.use(authMiddleware);

// ONLY admission letters - no optional documents
router.post(
  "/submit",
  upload.fields([
    { name: "admissionletters", maxCount: 3 }  // ONLY this field
  ]),
  submitAdmissionLetter
);

router.get("/me", getMyAdmissionLetter);
router.delete("/me", deleteMyAdmissionLetter);

module.exports = router;
"""


# ============================================================================
# FILE 4: server.js (CORRECTED - Add Admission Routes)
# ============================================================================

"""
// server.js (ADD THIS LINE)

// ... existing imports and middleware ...

// âœ… ROUTES FIRST (must come before notFound/errorHandler)
app.use("/api/auth", require("./routes/students/auth.routes"));
app.use("/api/user", require("./routes/students/userRoutes"));
app.use(
  "/api/user/educationplanet",
  require("./routes/students/studentEducationPlanRoutes")
);
app.use("/api/user/kyc", require("./routes/students/kyc.routes"));
app.use("/api/user/academics", academicRoutes);

// âœ… ADD THIS LINE - Register admission routes
app.use("/api/user/admission", require("./routes/students/admission.routes"));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// ... rest of server.js ...
"""


# ============================================================================
# SUMMARY OF CHANGES
# ============================================================================

"""
CHANGES MADE:

1. agent_server.py:
   ✅ Removed all optional document parameters (i20, coe, fee receipts, etc.)
   ✅ Only accepts 'admissionletters' field
   ✅ Simplified endpoint to /extract/admission-letter
   ✅ Updated descriptions to reflect "admission only"

2. admission.controller.js:
   ✅ Removed optional document handling from callAdmissionAgent()
   ✅ Only processes 'admissionletters' field
   ✅ Added extractRankingFromNotes() helper to parse university rankings
   ✅ Stores ranking in universityReputation field
   ✅ Cleaner error handling

3. admission.routes.js:
   ✅ Removed all optional document fields from upload.fields()
   ✅ Only accepts 'admissionletters' (maxCount: 3)
   ✅ Simplified route definition

4. server.js:
   ✅ Added missing admission route registration
   ✅ Now accessible at: /api/user/admission/submit

API USAGE:

POST /api/user/admission/submit
Headers:
  - Authorization: Bearer <token>
  - Content-Type: multipart/form-data

Body (form-data):
  - admissionletters: file (required, up to 3 files)

Response:
{
  "success": true,
  "message": "Admission letter processed successfully",
  "processingTime": 15.23,
  "data": {
    "universityName": "University College Cork",
    "programName": "Business Analytics - MSc",
    "country": "Ireland",
    "universityReputation": {
      "qsWorldRanking": 292,
      "theWorldRanking": 301,
      "usNewsRanking": 450,
      "rankingYear": 2024
    }
  }
}
"""
