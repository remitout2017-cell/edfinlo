import { useEffect, useState } from "react";
import axios from "axios";
import {
  FileText,
  CreditCard,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { useUserData } from "../../context/UserDataContext";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000";

const KYC = () => {
  // Get KYC data from context
  const { kyc, fetchKyc, refreshUserData } = useUserData();
  const kycData = kyc;
  const k = kycData?.kycData || {};

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [files, setFiles] = useState({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_front: null,
    passport: null,
  });

  useEffect(() => {
    loadKycData();
  }, []);

  const loadKycData = async () => {
    setLoading(true);
    try {
      await fetchKyc();
    } catch (error) {
      console.error("Failed to fetch KYC:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Each file should be less than 5MB");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Only image and PDF files are allowed");
      return;
    }

    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    // Validate required files
    if (!files.aadhaar_front || !files.aadhaar_back || !files.pan_front) {
      toast.error("Aadhaar front, Aadhaar back, and PAN front are required");
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      // Use field names that match the backend
      formData.append("aadhaar_front", files.aadhaar_front);
      formData.append("aadhaar_back", files.aadhaar_back);
      formData.append("pan_front", files.pan_front);
      if (files.passport) {
        formData.append("passport", files.passport);
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/user/kyc/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.verified) {
        toast.success("KYC verified successfully!");
      } else {
        toast.error(
          `KYC verification failed: ${
            response.data.reasons?.join(", ") || "Unknown reason"
          }`
        );
      }

      setFiles({
        aadhaar_front: null,
        aadhaar_back: null,
        pan_front: null,
        passport: null,
      });

      // Refresh KYC data from context
      await refreshUserData();
    } catch (error) {
      console.error("KYC upload failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to upload KYC documents"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "This will reset your KYC and remove stored documents. Continue?"
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/user/kyc/kyc/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("KYC deleted successfully");
      await refreshUserData();
    } catch (error) {
      console.error("Delete KYC failed:", error);
      toast.error(error.response?.data?.message || "Failed to delete KYC");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">
          Loading KYC details...
        </div>
      </DashboardLayout>
    );
  }

  const isVerified = kyc?.kycStatus === "verified";

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen ">
        <StepperExample currentStep={2} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {isVerified ? "KYC Verification Complete" : "KYC Verification"}
            </h2>
            <p className="text-gray-600">
              {isVerified
                ? "Your identity documents have been verified successfully"
                : "Upload your identity documents for verification"}
            </p>
          </div>

          {/* Verified KYC View */}
          {isVerified ? (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 mt-0.5" size={24} />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">
                      Verification Complete
                    </h3>
                    <p className="text-sm text-emerald-700 mt-1">
                      Verified on{" "}
                      {kycData.kycVerifiedAt
                        ? new Date(kycData.kycVerifiedAt).toLocaleDateString()
                        : "N/A"}
                    </p>
                    {k.verificationReason && (
                      <p className="text-xs text-emerald-600 mt-1">
                        {k.verificationReason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-xs bg-white text-red-600 rounded-lg hover:bg-red-50 transition border border-red-200"
                >
                  Reset KYC
                </button>
              </div>

              {/* Document Images Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Aadhaar Card */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="text-purple-600" size={20} />
                    <h3 className="text-sm font-semibold text-gray-800">
                      Aadhaar Card
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {k.aadhaarFrontUrl && (
                      <div>
                        <img
                          src={k.aadhaarFrontUrl}
                          alt="Aadhaar Front"
                          className="w-full h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <a
                          href={k.aadhaarFrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-xs text-purple-600 hover:text-purple-700 font-medium text-center"
                        >
                          View Front Side
                        </a>
                      </div>
                    )}
                    {k.aadhaarBackUrl && (
                      <div>
                        <img
                          src={k.aadhaarBackUrl}
                          alt="Aadhaar Back"
                          className="w-full h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <a
                          href={k.aadhaarBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-xs text-purple-600 hover:text-purple-700 font-medium text-center"
                        >
                          View Back Side
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN Card */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="text-purple-600" size={20} />
                    <h3 className="text-sm font-semibold text-gray-800">
                      PAN Card
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {k.panCardUrl && (
                      <div>
                        <img
                          src={k.panCardUrl}
                          alt="PAN Front"
                          className="w-full h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <a
                          href={k.panCardUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-xs text-purple-600 hover:text-purple-700 font-medium text-center"
                        >
                          View Front Side
                        </a>
                      </div>
                    )}
                    {k.panCardBackUrl && (
                      <div>
                        <img
                          src={k.panCardBackUrl}
                          alt="PAN Back"
                          className="w-full h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <a
                          href={k.panCardBackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-xs text-purple-600 hover:text-purple-700 font-medium text-center"
                        >
                          View Back Side
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Passport Photo */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="text-purple-600" size={20} />
                    <h3 className="text-sm font-semibold text-gray-800">
                      Passport Photo
                    </h3>
                  </div>
                  {k.passportUrl ? (
                    <div>
                      <img
                        src={k.passportUrl}
                        alt="Passport"
                        className="w-full h-40 object-cover rounded-lg border border-gray-300"
                      />
                      <a
                        href={k.passportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-xs text-purple-600 hover:text-purple-700 font-medium text-center"
                      >
                        View Full Image
                      </a>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-300">
                      <p className="text-xs text-gray-500">Not uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Details */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Extracted KYC Details
                </h3>

                {/* Aadhaar Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3">
                    Aadhaar Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Aadhaar Number
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Gender
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarGender || "N/A"}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Address
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarAddress || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PAN Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3">
                    PAN Card Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.panName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        PAN Number
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.panNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Father's Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.panFatherName || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Passport Section */}
                {(k.passportName || k.passportNumber || k.passportUrl) && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-purple-700 mb-3">
                      Passport Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Name
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {k.passportName || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Passport Number
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {k.passportNumber || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Upload Form View */
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Status Message */}
              {kycData?.kycStatus && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">
                      Current Status: {kycData.kycStatus}
                    </h3>
                    <p className="text-xs text-amber-700 mt-1">
                      Please upload your documents to proceed with verification
                    </p>
                  </div>
                </div>
              )}

              {/* File Upload Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Aadhaar Front */}
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <FileText size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Aadhaar Front <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "aadhaar_front")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.aadhaar_front
                            ? files.aadhaar_front.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Aadhaar Back */}
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <FileText size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Aadhaar Back <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "aadhaar_back")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.aadhaar_back
                            ? files.aadhaar_back.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* PAN Front */}
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <CreditCard size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        PAN Card <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "pan_front")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.pan_front
                            ? files.pan_front.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Passport Photo */}
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <Camera size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Passport (Optional)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "passport")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.passport
                            ? files.passport.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Each file should be less than 5MB.
                  Accepted formats: Images (JPG, PNG) and PDF. Aadhaar front &
                  PAN front are required for verification.
                </p>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                {/* <button
                  type="button"
                  onClick={fetchKyc}
                  className="flex items-center justify-center w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button> */}

                <button
                  type="submit"
                  disabled={uploading}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          )}
          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <Link to="/student/education-plan">
              <button
                type="button"
                className="flex items-center justify-center w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </Link>

            <Link to="/student/academic-records">
              <button
                type="button"
                className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 transition"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-6 mt-8 text-gray-500 text-sm">
          <button className="hover:text-gray-700 transition">Support</button>
          <button className="hover:text-gray-700 transition">Help</button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KYC;
