import React, { useEffect, useState } from "react";
import {
  BookOpen,
  GraduationCap,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import axios from "axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { useUserData } from "../../context/UserDataContext";

const API_BASE_URL = "http://localhost:5000";

const AcademicRecords = () => {
  const { academicData, setAcademicData, fetchAcademicRecords } = useUserData();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  //  File states for upload all
  const [class10File, setClass10File] = useState(null);
  const [class12File, setClass12File] = useState(null);
  const [graduationFile, setGraduationFile] = useState(null);

  // PDF viewer modal state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState("");
  const [currentPdfTitle, setCurrentPdfTitle] = useState("");

  // Load academic records on mount
  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      await fetchAcademicRecords();
      setLoading(false);
    };
    loadRecords();
  }, [fetchAcademicRecords]);

  // Open PDF viewer
  const openPdfViewer = (url, title) => {
    setCurrentPdfUrl(url);
    setCurrentPdfTitle(title);
    setPdfViewerOpen(true);
  };

  // Handle upload all 3 documents at once
  const handleUploadAll = async (e) => {
    e.preventDefault();

    const hasAnyFile = class10File || class12File || graduationFile;
    if (!hasAnyFile) {
      toast.error("Please select at least one document to upload");
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      if (class10File) formData.append("pdf_10th", class10File);
      if (class12File) formData.append("pdf_12th", class12File);
      if (graduationFile) formData.append("pdf_graduation", graduationFile);

      const res = await axios.post(
        `${API_BASE_URL}/api/user/academics/extract/complete`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (res.data?.success) {
        toast.success("Documents uploaded and processed successfully!");

        // Clear file selections
        setClass10File(null);
        setClass12File(null);
        setGraduationFile(null);

        // Refresh data
        await fetchAcademicRecords();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to upload documents"
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle delete individual section
  const handleDelete = async (recordType) => {
    const labels = {
      class10: "Class 10",
      class12: "Class 12",
      graduation: "Graduation",
    };

    if (
      !window.confirm(
        `Are you sure you want to delete your ${labels[recordType]} record?`
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/user/academics/${recordType}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success(`${labels[recordType]} record deleted successfully`);
      await fetchAcademicRecords();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Failed to delete ${labels[recordType]} record`
      );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-12 w-12 text-purple-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen">
        <StepperExample currentStep={3} />

        <div className="w-full max-w-6xl mt-4 bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Academic Records
            </h2>
            <p className="text-gray-600">
              Upload your 10th, 12th and graduation documents for verification
            </p>
          </div>

          {/* Upload Section */}
          <form onSubmit={handleUploadAll} className="mb-8">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Upload size={20} className="text-purple-600" />
                Upload Documents
              </h3>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {/* Class 10 Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white hover:border-purple-400 transition">
                  <label className="cursor-pointer block">
                    <div className="flex flex-col items-center">
                      <BookOpen className="text-purple-600 mb-2" size={32} />
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Class 10 Marksheet
                      </p>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setClass10File(e.target.files[0])}
                        className="hidden"
                      />
                      {class10File ? (
                        <p className="text-xs text-green-600 text-center">
                          ✓ {class10File.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">Click to upload</p>
                      )}
                    </div>
                  </label>
                </div>

                {/* Class 12 Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white hover:border-purple-400 transition">
                  <label className="cursor-pointer block">
                    <div className="flex flex-col items-center">
                      <BookOpen className="text-purple-600 mb-2" size={32} />
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Class 12 Marksheet
                      </p>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setClass12File(e.target.files[0])}
                        className="hidden"
                      />
                      {class12File ? (
                        <p className="text-xs text-green-600 text-center">
                          ✓ {class12File.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">Click to upload</p>
                      )}
                    </div>
                  </label>
                </div>

                {/* Graduation Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white hover:border-purple-400 transition">
                  <label className="cursor-pointer block">
                    <div className="flex flex-col items-center">
                      <GraduationCap
                        className="text-purple-600 mb-2"
                        size={32}
                      />
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Graduation Marksheet
                      </p>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setGraduationFile(e.target.files[0])}
                        className="hidden"
                      />
                      {graduationFile ? (
                        <p className="text-xs text-green-600 text-center">
                          ✓ {graduationFile.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">Click to upload</p>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing Documents...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Upload & Extract Data
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Display Sections */}
          {!academicData && !loading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <AlertCircle className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">
                No academic records uploaded yet. Upload your documents above to
                get started.
              </p>
            </div>
          )}

          {academicData && (
            <div className="space-y-6">
              {/* Class 10 Section */}
              {academicData.class10 && (
                <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <BookOpen className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          Class 10
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 mt-1">
                          <CheckCircle size={12} className="mr-1" />
                          Verified
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete("class10")}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Board
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class10.boardName || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Year of Passing
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class10.yearOfPassing || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Percentage / CGPA
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class10.percentage ||
                          academicData.class10.cgpa ||
                          "N/A"}
                        {academicData.class10.percentage && "%"}
                      </p>
                    </div>
                  </div>

                  {academicData.class10.documentUrl && (
                    <button
                      onClick={() =>
                        openPdfViewer(
                          academicData.class10.documentUrl,
                          "Class 10 Marksheet"
                        )
                      }
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <FileText size={16} />
                      View Document
                    </button>
                  )}
                </div>
              )}

              {/* Class 12 Section */}
              {academicData.class12 && (
                <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-pink-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-3 rounded-lg">
                        <BookOpen className="text-purple-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          Class 12
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 mt-1">
                          <CheckCircle size={12} className="mr-1" />
                          Verified
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete("class12")}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Board
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class12.boardName || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Stream
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class12.stream || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Year of Passing
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class12.yearOfPassing || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Percentage / CGPA
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.class12.percentage ||
                          academicData.class12.cgpa ||
                          "N/A"}
                        {academicData.class12.percentage && "%"}
                      </p>
                    </div>
                  </div>

                  {academicData.class12.documentUrl && (
                    <button
                      onClick={() =>
                        openPdfViewer(
                          academicData.class12.documentUrl,
                          "Class 12 Marksheet"
                        )
                      }
                      className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      <FileText size={16} />
                      View Document
                    </button>
                  )}
                </div>
              )}

              {/* Graduation Section */}
              {academicData.graduation && (
                <div className="border border-gray-200 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-3 rounded-lg">
                        <GraduationCap className="text-green-600" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          Graduation
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 mt-1">
                          <CheckCircle size={12} className="mr-1" />
                          Verified
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete("graduation")}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Degree
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.graduation.degree || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Institution
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.graduation.institutionName || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Year of Passing
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.graduation.yearOfPassing || "N/A"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase mb-1">
                        Final CGPA
                      </p>
                      <p className="font-semibold text-gray-800">
                        {academicData.graduation.finalCgpa || "N/A"}
                      </p>
                    </div>
                  </div>

                  {academicData.graduation.documentUrl && (
                    <button
                      onClick={() =>
                        openPdfViewer(
                          academicData.graduation.documentUrl,
                          "Graduation Marksheet"
                        )
                      }
                      className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      <FileText size={16} />
                      View Document
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200">
            <Link to="/student/kyc">
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

            <Link to="/student/test-scores">
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

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{currentPdfTitle}</h3>
              <button
                onClick={() => setPdfViewerOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(
                  currentPdfUrl
                )}&embedded=true`}
                className="w-full h-full"
                title={currentPdfTitle}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-between">
              <a
                href={currentPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Open in New Tab
              </a>
              <button
                onClick={() => setPdfViewerOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AcademicRecords;
