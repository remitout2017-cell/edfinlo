// src/pages/LoanAnalysis.jsx

import { useState, useEffect } from "react";
import { useUserData } from "../../context/UserDataContext";
import axios from "axios";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  TrendingUp,
  Clock,
  FileText,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
// ✅ FIX: Use environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  // ✅ FIX: Add retry state
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Fetch analysis history on mount
  useEffect(() => {
    fetchAnalysisHistory();
    refreshUserData();
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

  // ✅ FIX: Add retry logic and better loading states
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
    setRetryCount(0);

    try {
      console.log("🚀 Starting NBFC matching analysis...");
      const response = await axios.post(
        `${API_BASE_URL}/api/student/loan-matching/analyze`,
        {},
        {
          headers: getAuthHeaders(),
          timeout: 30000, // ✅ FIX: 30 second timeout
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
        setRetryCount(0);
      }
    } catch (err) {
      console.error("❌ Analysis failed:", err);

      // ✅ FIX: Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`⏳ Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        setRetryCount((prev) => prev + 1);
        setTimeout(() => handleRunAnalysis(), 2000);
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to run analysis. Please try again."
      );
    } finally {
      if (retryCount >= MAX_RETRIES || error) {
        setAnalysisLoading(false);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "eligible":
        return <CheckCircle className="text-green-500" size={20} />;
      case "borderline":
        return <AlertCircle className="text-yellow-500" size={20} />;
      case "not_eligible":
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "eligible":
        return "Eligible";
      case "borderline":
        return "Borderline";
      case "not_eligible":
        return "Not Eligible";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "eligible":
        return "bg-green-100 text-green-800 border-green-200";
      case "borderline":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "not_eligible":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // ✅ FIX: Better loading state with progress indicator
  if (analysisLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader className="animate-spin mx-auto text-blue-600" size={48} />
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Analyzing Your Profile...
            </h3>
            <p className="text-gray-600 mt-2">Matching against active NBFCs</p>
            <p className="text-sm text-gray-500 mt-1">
              This usually takes 8-15 seconds
            </p>
            {retryCount > 0 && (
              <p className="text-sm text-yellow-600 mt-2">
                Retrying... ({retryCount}/{MAX_RETRIES})
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <StepperExample currentStep={8} />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Loan Eligibility Analysis
          </h1>
          <p className="text-gray-600">
            Check your current loan eligibility based on updated profile data.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <XCircle
              className="text-red-500 mr-3 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Document Completeness Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Document Completeness
            </h2>
            <span className="text-2xl font-bold text-blue-600">
              {completeness.percentage}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completeness.percentage}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-sm">
              <span className="text-gray-600">Completed Fields:</span>
              <span className="font-semibold text-gray-900 ml-2">
                {completeness.completedFields} / {completeness.totalFields}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Next Action:</span>
              <span className="font-semibold text-gray-900 ml-2">
                {completeness.nextAction}
              </span>
            </div>
          </div>

          {/* ✅ FIX: Better button state handling */}
          <button
            onClick={handleRunAnalysis}
            disabled={!completeness.readyForAnalysis || analysisLoading}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center ${
              completeness.readyForAnalysis
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <TrendingUp className="mr-2" size={20} />
            {analysisLoading
              ? "Analyzing..."
              : completeness.readyForAnalysis
              ? "Run New Analysis"
              : "Complete Profile First"}
          </button>

          {!completeness.readyForAnalysis && (
            <p className="text-sm text-amber-600 mt-2 text-center">
              Complete all required documents to unlock analysis
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Analysis History */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Analysis History
              </h2>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Highest Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.highestScore}%
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Runs</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalAnalyses}
                  </p>
                </div>
              </div>

              {/* History List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader className="animate-spin mx-auto text-gray-400" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText
                      className="mx-auto mb-2 text-gray-400"
                      size={40}
                    />
                    <p className="text-sm">No analyses yet</p>
                    <p className="text-xs mt-1">
                      Run your first analysis above
                    </p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => setSelectedAnalysis(item)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedAnalysis?._id === item._id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <Clock size={12} className="mr-1" />
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">
                          {item.overallSummary?.eligibleCount || 0} Eligible
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {item.overallSummary?.topMatchPercentage || 0}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Analysis Details */}
          <div className="lg:col-span-2">
            {selectedAnalysis ? (
              <div className="space-y-6">
                {/* Overall Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Analysis Results
                  </h2>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">
                        {selectedAnalysis.overallSummary?.eligibleCount || 0}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Eligible</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-3xl font-bold text-yellow-600">
                        {selectedAnalysis.overallSummary?.borderlineCount || 0}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Borderline</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-3xl font-bold text-red-600">
                        {selectedAnalysis.overallSummary?.notEligibleCount || 0}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Not Eligible</p>
                    </div>
                  </div>

                  {selectedAnalysis.overallSummary?.topMatchNBFC && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Top Match</p>
                      <p className="text-lg font-bold text-blue-900">
                        {selectedAnalysis.overallSummary.topMatchNBFC}
                      </p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {selectedAnalysis.overallSummary.topMatchPercentage}%
                        Match
                      </p>
                    </div>
                  )}
                </div>

                {/* ✅ FIX: Display NBFCs by category */}
                {["eligible", "borderline", "notEligible"].map((category) => {
                  const nbfcs =
                    selectedAnalysis.nbfcMatches?.[category] ||
                    selectedAnalysis[category] ||
                    [];
                  if (nbfcs.length === 0) return null;

                  const categoryLabels = {
                    eligible: "Eligible NBFCs",
                    borderline: "Borderline NBFCs",
                    notEligible: "Not Eligible NBFCs",
                  };

                  return (
                    <div
                      key={category}
                      className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {categoryLabels[category]} ({nbfcs.length})
                      </h3>

                      <div className="space-y-4">
                        {nbfcs.map((nbfc, idx) => (
                          <div
                            key={idx}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900 text-lg">
                                  {nbfc.nbfcName}
                                </h4>
                                {nbfc.nbfcEmail && (
                                  <p className="text-sm text-gray-600">
                                    {nbfc.nbfcEmail}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                  {nbfc.matchPercentage}%
                                </div>
                                <div
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mt-2 ${getStatusColor(
                                    nbfc.eligibilityStatus
                                  )}`}
                                >
                                  {getStatusIcon(nbfc.eligibilityStatus)}
                                  <span className="ml-1">
                                    {getStatusLabel(nbfc.eligibilityStatus)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Analysis Details */}
                            {nbfc.analysis && (
                              <div className="mt-4 space-y-3">
                                {/* Strengths */}
                                {nbfc.analysis.strengths?.length > 0 && (
                                  <div>
                                    <p className="text-sm font-semibold text-green-700 mb-1">
                                      ✓ Strengths:
                                    </p>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                      {nbfc.analysis.strengths.map((s, i) => (
                                        <li
                                          key={i}
                                          className="flex items-start"
                                        >
                                          <span className="mr-2">•</span>
                                          <span>{s}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Gaps */}
                                {nbfc.analysis.gaps?.length > 0 && (
                                  <div>
                                    <p className="text-sm font-semibold text-red-700 mb-1">
                                      ⚠ Gaps:
                                    </p>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                      {nbfc.analysis.gaps.map((g, i) => (
                                        <li
                                          key={i}
                                          className="flex items-start"
                                        >
                                          <span className="mr-2">•</span>
                                          <span>{g}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* ROI */}
                                {nbfc.analysis.estimatedROI && (
                                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                                    <span className="text-sm text-gray-600">
                                      Estimated Interest Rate:
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {nbfc.analysis.estimatedROI.min}% -{" "}
                                      {nbfc.analysis.estimatedROI.max}%
                                    </span>
                                  </div>
                                )}

                                {/* Send Request Button */}
                                {category === "eligible" && (
                                  <button
                                    onClick={() =>
                                      (window.location.href = `/loan-requests?nbfc=${nbfc.nbfcId}`)
                                    }
                                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
                                  >
                                    Send Loan Request
                                    <ArrowRight className="ml-2" size={16} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 border border-gray-200 text-center">
                <FileText className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Analysis Selected
                </h3>
                <p className="text-gray-600">
                  Select an analysis from your history or run a new one to see
                  detailed insights about your loan eligibility.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoanAnalysis;
