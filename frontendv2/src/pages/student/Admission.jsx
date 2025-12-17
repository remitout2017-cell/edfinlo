// src/pages/Admission.jsx

import React, { useEffect, useState } from "react";
import {
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
  School,
  Globe,
  Calendar,
  DollarSign,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { admissionAPI } from "../../services/api";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { formatDate } from "../../utils/helpers";

const Admission = () => {
  const [admissionData, setAdmissionData] = useState(null); // full document from backend
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const fetchAdmission = async () => {
    setLoading(true);
    try {
      const res = await admissionAPI.getAdmission();
      setAdmissionData(res.data?.data || null);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch admission letter:", error);
        toast.error(
          error.response?.data?.message || "Failed to fetch admission letter"
        );
      } else {
        setAdmissionData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmission();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setFile(null);
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      toast.error("File should be less than 10MB");
      return;
    }
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      toast.error("Only image and PDF files are allowed");
      return;
    }

    setFile(f);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select an admission letter file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("admissionLetter", file);

      const res = await admissionAPI.upload(formData);

      if (res.data?.success) {
        toast.success(res.data.message || "Admission letter uploaded");
      } else {
        toast.success("Admission letter processed");
      }

      setFile(null);
      await fetchAdmission();
    } catch (error) {
      console.error("Upload failed:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to upload admission letter";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete your stored admission letter and re-upload?")) {
      return;
    }
    try {
      await admissionAPI.delete();
      toast.success("Admission letter deleted");
      setAdmissionData(null);
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete admission letter"
      );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">
          Loading admission details...
        </div>
      </DashboardLayout>
    );
  }

  const status = admissionData?.status || "verified";
  const extracted = admissionData?.extractedFields || {};
  const hasUrl = !!admissionData?.admissionLetterUrl;
  const isUploaded = !!admissionData;
  const isFailed = status !== "verified";

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen ">
        {/* Adjusted step to 4 based on logical flow between Academic (3) and Work (5) */}
        <StepperExample currentStep={7} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Admission Letter
            </h2>
            <p className="text-gray-600">
              Upload your university admission letter for automated analysis and
              loan suitability checks.
            </p>
          </div>

          <div className="space-y-6">
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              {/* Section Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="text-purple-600" size={24} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      University Admission
                    </h3>
                    <p className="text-sm text-gray-600">
                      {isUploaded
                        ? "Verified Admission Details"
                        : "Upload your admission document"}
                    </p>
                  </div>
                </div>

                {/* Status Badges */}
                {isUploaded ? (
                  isFailed ? (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-200">
                      <XCircle size={14} className="mr-1" />
                      Validation Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircle size={14} className="mr-1" />
                      Uploaded & Verified
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200">
                    <AlertCircle size={14} className="mr-1" />
                    Pending
                  </span>
                )}
              </div>

              {/* Data Display Section */}
              {isUploaded ? (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <School size={12} /> University
                          </p>
                          <p className="font-medium text-gray-800">
                            {admissionData.universityName ||
                              extracted.universityName ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <FileText size={12} /> Program
                          </p>
                          <p className="font-medium text-gray-800">
                            {admissionData.programName ||
                              extracted.programName ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <Globe size={12} /> Country
                          </p>
                          <p className="font-medium text-gray-800">
                            {admissionData.country ||
                              extracted.country ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <Calendar size={12} /> Intake
                          </p>
                          <p className="font-medium text-gray-800">
                            {(admissionData.intakeTerm ||
                              extracted.intakeTerm ||
                              "N/A") +
                              " " +
                              (admissionData.intakeYear ||
                                extracted.intakeYear ||
                                "")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <DollarSign size={12} /> Tuition Fee
                          </p>
                          <p className="font-medium text-gray-800">
                            {extracted.tuitionFee || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
                            <AlertTriangle size={12} /> Risk Level
                          </p>
                          <p
                            className={`font-medium ${
                              (
                                admissionData.riskLevel ||
                                extracted.riskLevel ||
                                ""
                              ).toLowerCase() === "high"
                                ? "text-red-600"
                                : "text-gray-800"
                            }`}
                          >
                            {admissionData.riskLevel ||
                              extracted.riskLevel ||
                              "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Issues Section if Failed */}
                      {isFailed && (
                        <div className="mt-4 p-4 bg-rose-50 rounded-lg border border-rose-100">
                          <h4 className="text-sm font-semibold text-rose-800 mb-2">
                            Attention Required
                          </h4>
                          <p className="text-xs text-gray-700 mb-3">
                            {admissionData.failureReason ||
                              "The AI validation reported issues with this document."}
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {(admissionData.validationIssues || []).length >
                              0 && (
                              <div>
                                <p className="text-xs font-semibold text-rose-700">
                                  Validation Issues:
                                </p>
                                <ul className="list-disc list-inside text-xs text-gray-600">
                                  {admissionData.validationIssues.map(
                                    (issue, i) => (
                                      <li key={i}>{issue}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Document Preview */}
                    <div>
                      <p className="text-sm font-medium text-gray-800 mb-3">
                        Uploaded Document
                      </p>
                      {hasUrl && (
                        <div className="relative group">
                          <img
                            src={admissionData.admissionLetterUrl}
                            alt="Admission Letter"
                            className="w-full h-64 object-cover rounded-lg border border-gray-300 shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <a
                              href={admissionData.admissionLetterUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 bg-white text-gray-900 rounded-md text-sm font-medium hover:bg-gray-100"
                            >
                              View Full Document
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delete / Re-upload Action */}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100"
                    >
                      <Trash2 size={16} />
                      Delete & Re-upload
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload Form */
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-4 text-gray-400">
                      <Upload size={20} />
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition bg-white">
                      <label className="cursor-pointer block">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Upload Admission Letter
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          Supported: JPG, PNG, PDF (Max 10MB)
                        </p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                          <span className="truncate max-w-[200px]">
                            {file ? file.name : "No file selected"}
                          </span>
                          {file && (
                            <span className="text-xs text-gray-400">
                              ({Math.round(file.size / 1024)} KB)
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-purple-600 font-medium">
                          Click to browse files
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {uploading ? "Uploading..." : "Upload & Analyze"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link to="/student/co-borrower">
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

              <Link to="/student/loan-analysis">
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

export default Admission;
