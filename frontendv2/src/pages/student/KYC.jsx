import { useEffect, useState } from "react";
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
import { kycAPI } from "../../services/api";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

const KYC = () => {
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [files, setFiles] = useState({
    frontAadhar: null,
    backAadhar: null,
    frontPan: null,
    backPan: null,
    passportPhoto: null,
  });

  useEffect(() => {
    fetchKyc();
  }, []);

  const fetchKyc = async () => {
    setLoading(true);
    try {
      const res = await kycAPI.getKYCDetails();
      setKyc(res.data.kyc || null);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch KYC:", error);
        toast.error(
          error.response?.data?.message || "Failed to fetch KYC details"
        );
      } else {
        setKyc(null);
      }
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

    if (!files.frontAadhar || !files.frontPan) {
      toast.error("Aadhaar front and PAN front are required");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      if (files.frontAadhar) formData.append("frontAadhar", files.frontAadhar);
      if (files.backAadhar) formData.append("backAadhar", files.backAadhar);
      if (files.frontPan) formData.append("frontPan", files.frontPan);
      if (files.backPan) formData.append("backPan", files.backPan);
      if (files.passportPhoto)
        formData.append("passportPhoto", files.passportPhoto);

      await kycAPI.uploadDocuments(formData);
      toast.success("KYC documents uploaded successfully");
      setFiles({
        frontAadhar: null,
        backAadhar: null,
        frontPan: null,
        backPan: null,
        passportPhoto: null,
      });
      await fetchKyc();
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
      await kycAPI.deleteKYC();
      toast.success("KYC deleted successfully");
      setKyc(null);
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
  const k = kyc?.kycData || {};

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
                      {kyc.kycVerifiedAt
                        ? new Date(kyc.kycVerifiedAt).toLocaleDateString()
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Aadhaar Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Aadhaar DOB
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.aadhaarDOB
                          ? new Date(k.aadhaarDOB).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        PAN Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.panName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        PAN DOB
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.panDOB
                          ? new Date(k.panDOB).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Passport Name
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.passportName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Passport DOB
                      </p>
                      <p className="text-sm font-medium text-gray-800">
                        {k.passportDOB
                          ? new Date(k.passportDOB).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Form View */
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Status Message */}
              {kyc?.kycStatus && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">
                      Current Status: {kyc.kycStatus}
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
                        onChange={(e) => handleFileChange(e, "frontAadhar")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.frontAadhar
                            ? files.frontAadhar.name
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
                        Aadhaar Back (Optional)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "backAadhar")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.backAadhar
                            ? files.backAadhar.name
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
                        PAN Front <span className="text-red-500">*</span>
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "frontPan")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.frontPan
                            ? files.frontPan.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* PAN Back */}
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <CreditCard size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        PAN Back (Optional)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "backPan")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.backPan
                            ? files.backPan.name
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Passport Photo */}
                <div className="relative md:col-span-2">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <Camera size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Passport Photo (Optional)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "passportPhoto")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Upload size={16} />
                        <span>
                          {files.passportPhoto
                            ? files.passportPhoto.name
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
                <button
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
                </button>

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
                        d="M9 5l7 7-7 7"
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
