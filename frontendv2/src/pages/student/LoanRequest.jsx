// src/pages/LoanRequest.jsx

import React, { useState, useEffect } from "react";
import { loanRequestAPI, nbfcAPI, loanAnalysisAPI } from "../../services/api";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import toast from "react-hot-toast";
import {
  Send,
  Building,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";

const LoanRequest = () => {
  const [nbfcs, setNbfcs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [nbfcRes, analysisRes] = await Promise.allSettled([
        nbfcAPI.getAllForStudents(),
        loanAnalysisAPI.getHistory(1, 1),
      ]);

      if (nbfcRes.status === "fulfilled") {
        setNbfcs(nbfcRes.value.data.nbfcs || nbfcRes.value.data.data || []);
      }

      if (analysisRes.status === "fulfilled") {
        const analyses = analysisRes.value.data.data?.analyses || [];
        if (analyses.length > 0) {
          setLatestAnalysis(analyses[0]);
        }
      }

      try {
        const requestsRes = await loanRequestAPI.getStudentRequests();
        setRequests(requestsRes.data.data || []);
      } catch (err) {
        setRequests([]);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (nbfcId) => {
    if (!latestAnalysis) {
      toast.error("Please run a loan analysis first");
      return;
    }

    if (!window.confirm("Send a formal loan request to this lender?")) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await loanRequestAPI.create(nbfcId, latestAnalysis._id);
      toast.success(response.data.message || "Request sent successfully");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async (requestId) => {
    if (
      !window.confirm(
        "Accept this offer? This will cancel all other pending requests."
      )
    ) {
      return;
    }

    try {
      const response = await loanRequestAPI.acceptOffer(requestId);
      toast.success(response.data.message || "Offer accepted!");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to accept offer");
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case "approved":
        return {
          color: "text-green-700",
          bg: "bg-green-50",
          icon: CheckCircle,
        };
      case "rejected":
        return { color: "text-red-700", bg: "bg-red-50", icon: XCircle };
      case "cancelled":
        return { color: "text-gray-500", bg: "bg-gray-100", icon: XCircle };
      default:
        return { color: "text-amber-700", bg: "bg-amber-50", icon: Clock };
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading lenders...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center min-h-screen pb-12">
        <StepperExample currentStep={9} />

        <div className="w-full max-w-5xl mt-6 space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Loan Requests</h1>
            <p className="mt-2 text-gray-600">
              Connect with lenders matched to your profile
            </p>
          </div>

          {!latestAnalysis && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800">
                  Analysis Required
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  You need to complete a loan analysis before you can send
                  requests.
                </p>
                <a
                  href="/student/loan-analysis"
                  className="inline-block mt-2 text-sm font-medium text-amber-900 underline"
                >
                  Go to Analysis
                </a>
              </div>
            </div>
          )}

          {/* Active Requests Section */}
          {requests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 pl-1">
                Your Applications
              </h2>
              <div className="grid gap-4">
                {requests.map((request) => {
                  const StatusIcon = getStatusInfo(request.status).icon;
                  const styles = getStatusInfo(request.status);

                  return (
                    <div
                      key={request._id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition hover:shadow-md"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        {/* Left: Info */}
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <Building className="text-gray-500" size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">
                              {request.snapshot?.nbfcMatch?.nbfcName ||
                                "Lender"}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Applied on{" "}
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>

                            <div
                              className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${styles.bg} ${styles.color}`}
                            >
                              <StatusIcon size={16} />
                              <span className="capitalize">
                                {request.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions / Details */}
                        <div className="flex-1 md:text-right">
                          {request.status === "approved" &&
                          request.nbfcDecision ? (
                            <div className="bg-green-50 rounded-lg p-4 inline-block text-left border border-green-100">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-3">
                                <div>
                                  <p className="text-xs text-green-700 uppercase">
                                    Approved Amount
                                  </p>
                                  <p className="font-bold text-green-900 text-lg">
                                    ₹
                                    {request.nbfcDecision.offeredAmount?.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-green-700 uppercase">
                                    Interest Rate
                                  </p>
                                  <p className="font-bold text-green-900 text-lg">
                                    {request.nbfcDecision.offeredRoi}%
                                  </p>
                                </div>
                              </div>
                              {!request.studentAcceptance?.accepted && (
                                <button
                                  onClick={() => handleAcceptOffer(request._id)}
                                  className="w-full py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition"
                                >
                                  Accept Offer
                                </button>
                              )}
                              {request.studentAcceptance?.accepted && (
                                <p className="text-sm font-medium text-green-800 flex items-center gap-1">
                                  <CheckCircle size={16} /> Offer Accepted
                                </p>
                              )}
                            </div>
                          ) : request.status === "rejected" ? (
                            <div className="text-sm text-red-600 max-w-md ml-auto bg-red-50 p-3 rounded-lg">
                              Reason:{" "}
                              {request.nbfcDecision?.reason ||
                                "Criteria not met"}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic mt-2">
                              Awaiting lender decision...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Lenders Grid */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 pl-1 flex items-center justify-between">
              <span>Available Lenders</span>
              {latestAnalysis?.nbfcMatches?.eligibleCount > 0 && (
                <span className="text-sm font-normal text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  {latestAnalysis.nbfcMatches.eligibleCount} Recommended for You
                </span>
              )}
            </h2>

            {nbfcs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nbfcs.map((nbfc) => {
                  // Check existing request
                  const existingReq = requests.find(
                    (r) =>
                      (r.nbfc?._id === nbfc._id || r.nbfc === nbfc._id) &&
                      r.status !== "rejected" &&
                      r.status !== "cancelled"
                  );

                  // Check eligibility from analysis
                  const matchData = latestAnalysis?.nbfcMatches?.eligible?.find(
                    (m) => String(m.nbfcId) === String(nbfc._id)
                  );

                  const isEligible = !!matchData;

                  return (
                    <div
                      key={nbfc._id}
                      className={`relative flex flex-col bg-white rounded-xl border-2 transition-all hover:shadow-lg ${
                        isEligible
                          ? "border-green-100 shadow-sm"
                          : "border-gray-100 opacity-80"
                      }`}
                    >
                      {isEligible && (
                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                          {matchData.matchPercentage}% MATCH
                        </div>
                      )}

                      <div className="p-6 flex-1">
                        <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mb-4">
                          <Building className="text-gray-400" size={24} />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">
                          {nbfc.companyName}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                          {nbfc.email}
                        </p>

                        {/* Loan Config Snapshot */}
                        <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4">
                          <div className="flex justify-between">
                            <span>Interest:</span>
                            <span className="font-medium text-gray-900">
                              {nbfc.loanConfig?.roi?.minRate}% -{" "}
                              {nbfc.loanConfig?.roi?.maxRate}%
                            </span>
                          </div>
                          {matchData?.estimatedLoanAmount && (
                            <div className="flex justify-between text-green-700">
                              <span>Est. Loan:</span>
                              <span className="font-medium">
                                ₹
                                {matchData.estimatedLoanAmount.min?.toLocaleString() /
                                  1000}
                                k+
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 border-t border-gray-100 mt-auto">
                        {existingReq ? (
                          <button
                            disabled
                            className="w-full py-2.5 bg-gray-100 text-gray-500 rounded-lg font-medium text-sm cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Request Sent
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCreateRequest(nbfc._id)}
                            disabled={submitting || !latestAnalysis}
                            className={`w-full py-2.5 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${
                              isEligible
                                ? "bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-200"
                                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {submitting ? "Sending..." : "Send Request"}{" "}
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Info className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  No Lenders Found
                </h3>
                <p className="text-gray-500">
                  There are currently no active lenders in the system.
                </p>
              </div>
            )}
          </div>
          {/* Navigation Buttons */}
          <div className="flex items-center justify-between py-6 border-t border-gray-200">
            <Link to="/student/loan-analysis">
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
              onClick={() => (window.location.href = "/student")}
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

export default LoanRequest;
