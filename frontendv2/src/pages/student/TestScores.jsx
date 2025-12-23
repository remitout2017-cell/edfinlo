// src/pages/TestScores.jsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { useUserData } from "../../context/UserDataContext";
import axios from "axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  FileText,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000";

const TestScores = () => {
  const { testScoresData, fetchTestScores, isAuthenticated } = useUserData();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({
    toefl_report: null,
    gre_report: null,
    ielts_report: null,
  });
  const [loading, setLoading] = useState(false);

  // Load test scores on mount
  useEffect(() => {
    const loadScores = async () => {
      if (isAuthenticated) {
        setLoading(true);
        await fetchTestScores();
        setLoading(false);
      }
    };
    loadScores();
  }, [isAuthenticated]);

  const handleFileSelect = (testType, e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [testType]: null }));
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be less than 10MB");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, JPEG, and PNG files are allowed");
      return;
    }

    setSelectedFiles((prev) => ({
      ...prev,
      [testType]: file,
    }));
    setUploadError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    const hasFiles = Object.values(selectedFiles).some((file) => file !== null);

    if (!hasFiles) {
      setUploadError("Please select at least one test score document");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();

      // Append only selected files
      Object.entries(selectedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      const response = await axios.post(
        `${API_BASE_URL}/api/user/testscores/extract`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setUploadSuccess(
          `Successfully processed ${response.data.data.processed.length} test score(s)`
        );
        setSelectedFiles({
          toefl_report: null,
          gre_report: null,
          ielts_report: null,
        });

        // Refresh test scores data
        await fetchTestScores();

        // Clear file inputs
        document.getElementById("toefl-upload").value = "";
        document.getElementById("gre-upload").value = "";
        document.getElementById("ielts-upload").value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error.response?.data?.message || "Failed to upload test scores"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (testType) => {
    if (
      !window.confirm(
        `Are you sure you want to delete your ${testType.toUpperCase()} score?`
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/user/testscores/${testType}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await fetchTestScores();
      toast.success(`${testType.toUpperCase()} score deleted successfully`);
    } catch (error) {
      toast.error(
        error.response?.data?.message || `Failed to delete ${testType} score`
      );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <StepperExample currentStep={4} />

        <div className="bg-white rounded-lg shadow-lg p-8 mt-6">
          <h1 className="text-3xl font-bold mb-2">Test Scores</h1>
          <p className="text-gray-600 mb-8">
            Upload your TOEFL, GRE, and IELTS test scores for automated
            extraction and verification
          </p>

          {/* Upload Section */}
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              {/* TOEFL Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <FileText className="mx-auto mb-2 text-gray-400" size={32} />
                <h3 className="font-semibold mb-2">TOEFL</h3>
                <input
                  id="toefl-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelect("toefl_report", e)}
                  className="text-sm w-full"
                />
                {selectedFiles.toefl_report && (
                  <p className="text-green-600 text-sm mt-2">
                    ✓ {selectedFiles.toefl_report.name}
                  </p>
                )}
              </div>

              {/* GRE Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <FileText className="mx-auto mb-2 text-gray-400" size={32} />
                <h3 className="font-semibold mb-2">GRE</h3>
                <input
                  id="gre-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelect("gre_report", e)}
                  className="text-sm w-full"
                />
                {selectedFiles.gre_report && (
                  <p className="text-green-600 text-sm mt-2">
                    ✓ {selectedFiles.gre_report.name}
                  </p>
                )}
              </div>

              {/* IELTS Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <FileText className="mx-auto mb-2 text-gray-400" size={32} />
                <h3 className="font-semibold mb-2">IELTS</h3>
                <input
                  id="ielts-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelect("ielts_report", e)}
                  className="text-sm w-full"
                />
                {selectedFiles.ielts_report && (
                  <p className="text-green-600 text-sm mt-2">
                    ✓ {selectedFiles.ielts_report.name}
                  </p>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload Test Scores
                </>
              )}
            </button>

            {/* Messages */}
            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <XCircle
                  className="text-red-600 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <p className="text-red-800 text-sm">{uploadError}</p>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <CheckCircle
                  className="text-green-600 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <p className="text-green-800 text-sm">{uploadSuccess}</p>
              </div>
            )}
          </form>
        </div>

        {/* Display Existing Scores */}
        {testScoresData && (
          <div className="space-y-6 mt-6">
            {/* TOEFL Score */}
            {testScoresData.toeflScore && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <FileText className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">TOEFL Score</h2>
                      {testScoresData.toeflScore.testDate && (
                        <p className="text-sm text-gray-600">
                          Test Date:{" "}
                          {new Date(
                            testScoresData.toeflScore.testDate
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("toefl")}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Reading</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.toeflScore.reading || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Listening</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.toeflScore.listening || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Speaking</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.toeflScore.speaking || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Writing</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.toeflScore.writing || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                  <p className="text-gray-600 text-sm mb-2">Total Score</p>
                  <p className="text-4xl font-bold text-blue-600">
                    {testScoresData.toeflScore.totalScore || "N/A"}
                  </p>
                </div>

                {testScoresData.toeflScore.verificationIssues?.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Verification Issues:
                    </p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                      {testScoresData.toeflScore.verificationIssues.map(
                        (issue, idx) => (
                          <li key={idx}>{issue}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* GRE Score */}
            {testScoresData.greScore && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <FileText className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">GRE Score</h2>
                      {testScoresData.greScore.testDate && (
                        <p className="text-sm text-gray-600">
                          Test Date:{" "}
                          {new Date(
                            testScoresData.greScore.testDate
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("gre")}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      Verbal Reasoning
                    </p>
                    <p className="text-3xl font-bold text-purple-600">
                      {testScoresData.greScore.verbalReasoning || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      Quantitative Reasoning
                    </p>
                    <p className="text-3xl font-bold text-purple-600">
                      {testScoresData.greScore.quantitativeReasoning || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      Analytical Writing
                    </p>
                    <p className="text-3xl font-bold text-purple-600">
                      {testScoresData.greScore.analyticalWriting || "N/A"}
                    </p>
                  </div>
                </div>

                {testScoresData.greScore.verificationIssues?.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Verification Issues:
                    </p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                      {testScoresData.greScore.verificationIssues.map(
                        (issue, idx) => (
                          <li key={idx}>{issue}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* IELTS Score */}
            {testScoresData.ieltsScore && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <FileText className="text-green-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">IELTS Score</h2>
                      {testScoresData.ieltsScore.testDate && (
                        <p className="text-sm text-gray-600">
                          Test Date:{" "}
                          {new Date(
                            testScoresData.ieltsScore.testDate
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("ielts")}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Listening</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.ieltsScore.listening || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Reading</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.ieltsScore.reading || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Writing</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.ieltsScore.writing || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-sm mb-1">Speaking</p>
                    <p className="text-2xl font-bold">
                      {testScoresData.ieltsScore.speaking || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
                  <p className="text-gray-600 text-sm mb-2">
                    Overall Band Score
                  </p>
                  <p className="text-4xl font-bold text-green-600">
                    {testScoresData.ieltsScore.overallBandScore || "N/A"}
                  </p>
                </div>

                {testScoresData.ieltsScore.verificationIssues?.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} />
                      Verification Issues:
                    </p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                      {testScoresData.ieltsScore.verificationIssues.map(
                        (issue, idx) => (
                          <li key={idx}>{issue}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Scores Message */}
        {!testScoresData && !loading && !uploading && (
          <div className="bg-gray-50 rounded-lg p-12 text-center mt-6">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Test Scores Uploaded
            </h3>
            <p className="text-gray-600">
              Upload your test scores above to get started
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Link
            to="/admission"
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            ← Previous
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Complete →
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TestScores;
