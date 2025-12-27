// src/pages/LoanAnalysis.jsx

import { useState, useEffect, useRef } from "react";
import { useUserData } from "../../context/UserDataContext";
import axios from "axios";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  ArrowRight,
  TrendingUp,
  Trash2,
  FileText,
  Clock,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import toast from "react-hot-toast";

// ✅ FIX: Use environment variable with fallback and ensure no trailing /api
const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawBaseUrl.endsWith("/api")
  ? rawBaseUrl.slice(0, -4)
  : rawBaseUrl.replace(/\/$/, "");

const LoanAnalysis = () => {
  const { completeness, refreshUserData, getAuthHeaders } = useUserData();
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    highestScore: 0,
    lastRunDate: null,
  });

  // ✅ CHANGE 1: Prevent duplicate calls in React StrictMode
  const hasFetched = useRef(false);

  // Fetch analysis history on mount
  useEffect(() => {
    // ✅ CHANGE 2: Only fetch once
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAnalysisHistory();
      refreshUserData();
    }
  }, []);

  const fetchAnalysisHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/student/loan-matching/history`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        const historyData = response.data.history || [];
        setHistory(historyData);

        // Calculate stats
        if (historyData.length > 0) {
          const highestScore = Math.max(
            ...historyData.map((h) => h.overallSummary?.topMatchPercentage || 0)
          );
          setStats({
            totalAnalyses: historyData.length,
            highestScore: Math.round(highestScore),
            lastRunDate: historyData[0]?.createdAt,
          });

          // Auto-select most recent
          setSelectedAnalysis(historyData[0]);
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch history:", err);
      setError(
        err.response?.data?.message || "Failed to load analysis history"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to run analysis");
      return;
    }

    if (!completeness.readyForAnalysis) {
      setError(
        "Please complete all required documents before running analysis"
      );
      return;
    }

    setAnalysisLoading(true);
    setError(null);

    try {
      console.log("🚀 Starting NBFC matching analysis...");
      const response = await axios.post(
        `${API_BASE_URL}/api/student/loan-matching/analyze`,
        {},
        {
          headers: getAuthHeaders(),
          timeout: 120000, // 120 second timeout for AI analysis
        }
      );

      if (response.data.success) {
        console.log("✅ Analysis completed successfully");
        setSelectedAnalysis({
          _id: response.data.analysisId,
          ...response.data.results,
          createdAt: new Date().toISOString(),
          overallSummary: response.data.results.summary,
        });

        // Refresh history
        await fetchAnalysisHistory();
      }
    } catch (err) {
      console.error("❌ Analysis failed:", err);

      // ✅ CHANGE 3: Removed window.location.reload() and setTimeout
      if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
        toast.error("Analysis timed out. Please try again.");
      } else {
        toast.error("Analysis failed. Please try again.");
      }

      setError(
        err.response?.data?.message || err.message || "Failed to run analysis"
      );
    } finally {
      // ✅ CHANGE 4: Always stop loading
      setAnalysisLoading(false);
    }
  };

  const handleDeleteAnalysis = async (e, id) => {
    e.stopPropagation(); // Prevent selecting the analysis when clicking delete

    try {
      setLoading(true);
      const response = await axios.delete(
        `${API_BASE_URL}/api/student/loan-matching/history/${id}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        // Remove from local state
        setHistory((prev) => prev.filter((item) => item._id !== id));

        // If the deleted one was selected, clear selection
        if (selectedAnalysis?._id === id) {
          setSelectedAnalysis(null);
        }

        // Refresh stats
        fetchAnalysisHistory();
      }
    } catch (err) {
      console.error("❌ Failed to delete analysis:", err);
      alert(err.response?.data?.message || "Failed to delete analysis");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "eligible":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "borderline":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "not_eligible":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "eligible":
        return "bg-green-50 border-green-200 text-green-800";
      case "borderline":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "not_eligible":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loan Analysis</h1>
            <p className="text-gray-600 mt-1">
              AI-powered NBFC matching based on your profile
            </p>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={analysisLoading || !completeness.readyForAnalysis}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              analysisLoading || !completeness.readyForAnalysis
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105"
            }`}
          >
            {analysisLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Run New Analysis
              </>
            )}
          </button>
        </div>

        {/* Analysis in progress message */}
        {analysisLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  Analyzing Your Profile
                </h3>
                <p className="text-blue-700 text-sm mt-1">
                  Matching against active NBFCs
                </p>
                <p className="text-blue-600 text-xs mt-1">
                  This usually takes 8-15 seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stepper */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <StepperExample />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Check your current loan eligibility based on updated profile data.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!completeness.readyForAnalysis && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <p className="text-yellow-800 text-sm">
                Complete all required documents to unlock analysis
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Highest Score</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {stats.highestScore}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Runs</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">
                  {stats.totalAnalyses}
                </p>
              </div>
              <FileText className="w-10 h-10 text-indigo-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Last Run</p>
                <p className="text-sm font-medium text-gray-800 mt-1">
                  {stats.lastRunDate
                    ? new Date(stats.lastRunDate).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
              <Clock className="w-10 h-10 text-gray-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* History Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 max-h-[600px] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Analysis History</h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No analyses yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Run your first analysis above
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => setSelectedAnalysis(item)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedAnalysis?._id === item._id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteAnalysis(e, item._id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        {item.overallSummary?.eligibleCount || 0} Eligible
                      </span>
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                        {item.overallSummary?.borderlineCount || 0} Borderline
                      </span>
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                        {item.overallSummary?.notEligibleCount || 0} Not
                        Eligible
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            {!selectedAnalysis ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TrendingUp className="w-20 h-20 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Analysis Selected
                </h3>
                <p className="text-gray-500 max-w-md">
                  Select an analysis from your history or run a new one to see
                  detailed insights about your loan eligibility.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                    <p className="text-3xl font-bold text-green-600">
                      {selectedAnalysis.overallSummary?.eligibleCount || 0}
                    </p>
                    <p className="text-sm text-green-700 mt-1">Eligible</p>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
                    <p className="text-3xl font-bold text-yellow-600">
                      {selectedAnalysis.overallSummary?.borderlineCount || 0}
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">Borderline</p>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                    <p className="text-3xl font-bold text-red-600">
                      {selectedAnalysis.overallSummary?.notEligibleCount || 0}
                    </p>
                    <p className="text-sm text-red-700 mt-1">Not Eligible</p>
                  </div>
                </div>

                {/* Top Match */}
                {selectedAnalysis.overallSummary?.topMatchNBFC && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium mb-1">
                          Top Match
                        </p>
                        <h3 className="text-2xl font-bold text-blue-900">
                          {selectedAnalysis.overallSummary.topMatchNBFC}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-bold text-blue-600">
                          {selectedAnalysis.overallSummary.topMatchPercentage}%
                        </p>
                        <p className="text-sm text-blue-700">Match</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* NBFC Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Detailed Results
                  </h3>

                  {/* Eligible NBFCs */}
                  {selectedAnalysis.nbfcMatches?.eligible?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-green-700 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Eligible NBFCs
                      </h4>
                      {selectedAnalysis.nbfcMatches.eligible.map(
                        (nbfc, idx) => (
                          <div
                            key={idx}
                            className="border-2 border-green-200 rounded-lg p-4 bg-green-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-bold text-gray-900">
                                  {nbfc.nbfcName}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {nbfc.nbfcEmail}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">
                                  {nbfc.matchPercentage}%
                                </p>
                                <p className="text-xs text-green-700">Match</p>
                              </div>
                            </div>

                            {nbfc.analysis?.strengths?.length > 0 && (
                              <div className="mb-2">
                                <p className="text-sm font-semibold text-green-800 mb-1">
                                  ✓ Strengths:
                                </p>
                                <ul className="text-sm text-green-700 space-y-1">
                                  {nbfc.analysis.strengths.map((s, i) => (
                                    <li key={i}>• {s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {nbfc.analysis?.gaps?.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-yellow-800 mb-1">
                                  ⚠ Gaps:
                                </p>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                  {nbfc.analysis.gaps.map((g, i) => (
                                    <li key={i}>• {g}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Borderline NBFCs */}
                  {selectedAnalysis.nbfcMatches?.borderline?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-yellow-700 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Borderline NBFCs
                      </h4>
                      {selectedAnalysis.nbfcMatches.borderline.map(
                        (nbfc, idx) => (
                          <div
                            key={idx}
                            className="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-bold text-gray-900">
                                  {nbfc.nbfcName}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {nbfc.nbfcEmail}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-yellow-600">
                                  {nbfc.matchPercentage}%
                                </p>
                                <p className="text-xs text-yellow-700">Match</p>
                              </div>
                            </div>

                            {nbfc.analysis?.recommendations?.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-yellow-800 mb-1">
                                  💡 Recommendations:
                                </p>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                  {nbfc.analysis.recommendations.map((r, i) => (
                                    <li key={i}>• {r}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Not Eligible NBFCs */}
                  {selectedAnalysis.nbfcMatches?.notEligible?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-red-700 flex items-center gap-2">
                        <XCircle className="w-5 h-5" />
                        Not Eligible NBFCs
                      </h4>
                      {selectedAnalysis.nbfcMatches.notEligible.map(
                        (nbfc, idx) => (
                          <div
                            key={idx}
                            className="border-2 border-red-200 rounded-lg p-4 bg-red-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-bold text-gray-900">
                                  {nbfc.nbfcName}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {nbfc.nbfcEmail}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-red-600">
                                  {nbfc.matchPercentage}%
                                </p>
                                <p className="text-xs text-red-700">Match</p>
                              </div>
                            </div>

                            {nbfc.analysis?.gaps?.length > 0 && (
                              <div>
                                <p className="text-sm font-semibold text-red-800 mb-1">
                                  ❌ Missing Requirements:
                                </p>
                                <ul className="text-sm text-red-700 space-y-1">
                                  {nbfc.analysis.gaps.map((g, i) => (
                                    <li key={i}>• {g}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* General Tips */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-5 h-5" />
                      Tips to Improve Eligibility
                    </h4>
                    <div className="space-y-3 text-sm text-blue-800">
                      <p>
                        <strong>Add a Co-borrower:</strong> Adding a financially
                        stable co-borrower (parent/guardian) significantly
                        boosts eligibility.
                      </p>
                      <p>
                        <strong>Complete Profile:</strong> Ensure all work
                        experience and test scores are added. Verify your
                        academic records.
                      </p>
                      <p>
                        <strong>Test Scores:</strong> A high GRE/GMAT score can
                        sometimes offset lower academic percentages or gaps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoanAnalysis;
