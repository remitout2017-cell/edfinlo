// src/pages/LoanAnalysis.jsx

import React, { useState, useEffect } from "react";
import { loanAnalysisAPI } from "../../services/api";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import toast from "react-hot-toast";
import {
  Activity,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

const LoanAnalysis = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await loanAnalysisAPI.getHistory(page, 10);
      if (response.data.success) {
        const analyses = response.data.data?.analyses || [];
        setHistory(analyses);
        setStats(response.data.data?.stats || null);
        setPagination(response.data.data?.pagination || null);

        // Auto-select latest analysis if none selected
        if (analyses.length > 0 && !selectedAnalysis) {
          handleViewDetails(analyses[0]._id);
        }
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error("Failed to load analysis history");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (type = "enhanced") => {
    setAnalyzing(true);
    try {
      const response =
        type === "enhanced"
          ? await loanAnalysisAPI.analyzeEnhanced()
          : await loanAnalysisAPI.analyze();

      toast.success("Analysis completed successfully");
      await fetchHistory();

      if (response.data.historyId) {
        handleViewDetails(response.data.historyId);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to analyze eligibility"
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await loanAnalysisAPI.getById(id);
      setSelectedAnalysis(response.data.data);
      setShowHistory(false); // Close history on mobile/view switch
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error("Failed to fetch details");
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this analysis record?")) return;

    try {
      await loanAnalysisAPI.delete(id);
      toast.success("Record deleted");
      await fetchHistory();
      if (selectedAnalysis?.analysis?._id === id) {
        setSelectedAnalysis(null);
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-amber-600";
    return "text-rose-600";
  };

  const getScoreBg = (score) => {
    if (score >= 80) return "bg-emerald-50 border-emerald-200";
    if (score >= 60) return "bg-blue-50 border-blue-200";
    if (score >= 40) return "bg-amber-50 border-amber-200";
    return "bg-rose-50 border-rose-200";
  };

  if (loading && !history.length) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading your analysis...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center min-h-screen  pb-12">
        <StepperExample currentStep={8} />

        <div className="w-full max-w-6xl mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Actions & History */}
          <div className="lg:col-span-1 space-y-6">
            {/* Action Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                New Analysis
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Check your current loan eligibility based on updated profile
                data.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleAnalyze("enhanced")}
                  disabled={analyzing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50 font-medium shadow-sm hover:shadow-md"
                >
                  {analyzing ? (
                    "Analyzing..."
                  ) : (
                    <>
                      <Activity size={18} /> Run Enhanced Analysis
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAnalyze("basic")}
                  disabled={analyzing}
                  className="w-full py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm font-medium"
                >
                  Run Basic Check
                </button>
              </div>
            </div>

            {/* Stats Card */}
            {stats && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Highest Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.highestScore}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">Total Runs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalAnalyses}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* History List (Mobile Collapsible / Desktop Always) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-pointer lg:cursor-default"
                onClick={() => setShowHistory(!showHistory)}
              >
                <h3 className="font-semibold text-gray-800">History</h3>
                <ChevronDown
                  className={`lg:hidden transition ${
                    showHistory ? "rotate-180" : ""
                  }`}
                  size={20}
                />
              </div>

              <div
                className={`${
                  showHistory ? "block" : "hidden"
                } lg:block max-h-96 overflow-y-auto`}
              >
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No history yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {history.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => handleViewDetails(item._id)}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                          selectedAnalysis?.analysis?._id === item._id
                            ? "bg-purple-50 border-l-4 border-purple-500"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-xs font-bold ${getScoreColor(
                                  item.overallScore
                                )}`}
                              >
                                Score: {item.overallScore}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500 capitalize">
                                {item.analysisType}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleDelete(item._id, e)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Analysis View */}
          <div className="lg:col-span-2">
            {selectedAnalysis ? (
              <div className="space-y-6">
                {/* Score Header */}
                <div
                  className={`rounded-2xl p-8 text-center border ${getScoreBg(
                    selectedAnalysis.analysis.overallScore
                  )}`}
                >
                  <p className="text-gray-600 font-medium mb-2">
                    Overall Eligibility Score
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`text-6xl font-bold ${getScoreColor(
                        selectedAnalysis.analysis.overallScore
                      )}`}
                    >
                      {selectedAnalysis.analysis.overallScore}
                    </span>
                    <span className="text-2xl text-gray-400 font-light">
                      /100
                    </span>
                  </div>

                  {selectedAnalysis.comparison?.hasPrevious && (
                    <div className="mt-4 inline-flex items-center gap-1 px-3 py-1 bg-white/60 rounded-full text-sm font-medium">
                      {selectedAnalysis.comparison.scoreChange >= 0 ? (
                        <TrendingUp size={16} className="text-green-600" />
                      ) : (
                        <TrendingUp
                          size={16}
                          className="text-red-600 rotate-180"
                        />
                      )}
                      <span
                        className={
                          selectedAnalysis.comparison.scoreChange >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {Math.abs(selectedAnalysis.comparison.scoreChange)}{" "}
                        points since last check
                      </span>
                    </div>
                  )}
                </div>

                {/* Section Scores Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(
                    selectedAnalysis.analysis.sectionScores || {}
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
                    >
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p
                        className={`text-xl font-bold ${getScoreColor(
                          value.score
                        )}`}
                      >
                        {value.score || 0}%
                      </p>
                    </div>
                  ))}
                </div>

                {/* NBFC Matches Section */}
                {selectedAnalysis.analysis.nbfcMatches?.eligible?.length >
                  0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Award className="text-purple-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-800">
                          Matched Lenders (
                          {
                            selectedAnalysis.analysis.nbfcMatches.eligible
                              .length
                          }
                          )
                        </h3>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {selectedAnalysis.analysis.nbfcMatches.eligible.map(
                        (nbfc, idx) => (
                          <div
                            key={idx}
                            className="p-6 hover:bg-gray-50 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                          >
                            <div>
                              <h4 className="font-bold text-gray-900 text-lg">
                                {nbfc.nbfcName}
                              </h4>
                              <p className="text-sm text-gray-500 mb-2">
                                {nbfc.brandName}
                              </p>
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {nbfc.matchPercentage}% Match
                                </span>
                              </div>
                            </div>
                            <div className="text-right w-full sm:w-auto">
                              <p className="text-xs text-gray-500 uppercase mb-1">
                                Estimated Offer
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                ₹
                                {nbfc.estimatedLoanAmount.min?.toLocaleString()}{" "}
                                - ₹
                                {nbfc.estimatedLoanAmount.max?.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 text-center">
                      <a
                        href="/student/loan-request"
                        className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium text-sm"
                      >
                        Proceed to Loan Requests{" "}
                        <ArrowRight size={16} className="ml-1" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Improvement Actions */}
                {selectedAnalysis.analysis.masterRecommendations
                  ?.immediateActions?.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="text-amber-500" size={20} />
                      <h3 className="text-lg font-bold text-gray-800">
                        Recommended Actions
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {selectedAnalysis.analysis.masterRecommendations.immediateActions.map(
                        (action, idx) => (
                          <div
                            key={idx}
                            className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100"
                          >
                            <div className="min-w-[24px] pt-0.5">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-xs font-bold">
                                {idx + 1}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm text-gray-800 font-medium">
                                {action.action}
                              </p>
                              {action.estimatedTime && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Clock size={12} /> {action.estimatedTime}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Empty State
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                  <BarChart2 className="text-purple-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  No Analysis Selected
                </h3>
                <p className="text-gray-500 max-w-md">
                  Select an analysis from your history or run a new one to see
                  detailed insights about your loan eligibility.
                </p>
                <button
                  onClick={() => handleAnalyze("enhanced")}
                  className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Start New Analysis
                </button>
              </div>
            )}
          </div>
          {/* Navigation Buttons */}
          <div className="flex items-center justify-between py-6 border-t border-gray-200">
            <Link to="/student/admission">
              {" "}
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

            <button
              type="button"
              onClick={() => (window.location.href = "/student/loan-request")}
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoanAnalysis;
