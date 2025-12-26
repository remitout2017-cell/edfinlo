// routes/kyc.routes.js
const router = require("express").Router();

const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/imageUpload"); // note: folder name matches your attachment [file:70]
const kyc = require("../../controllers/students/kyccontroller");

router.post(
  "/upload",
  auth,
  upload.fields([
    { name: "aadhaar_front", maxCount: 1 },
    { name: "aadhaar_back", maxCount: 1 },
    { name: "pan_front", maxCount: 1 },
    { name: "passport", maxCount: 1, optional: true }, // optional
  ]),
  kyc.submitKyc
);

router.get("/me", auth, kyc.getMyKyc);
router.delete("/me", auth, kyc.deleteKYC);

module.exports = router;
