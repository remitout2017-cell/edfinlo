// src/pages/LoanRequest.jsx

import { useState, useEffect } from "react";
import { useUserData } from "../../context/UserDataContext";
import axios from "axios";
import {
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  Building,
  Loader,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
// ✅ FIX: Use environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const LoanRequest = () => {
  const { user, getAuthHeaders } = useUserData();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [nbfcs, setNbfcs] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal states
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedNBFC, setSelectedNBFC] = useState(null);
  const [message, setMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    fetchMyRequests();
    fetchActiveNBFCs();
  }, []);

  const fetchMyRequests = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/student/loan-matching/my-requests`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        setRequests(response.data.requests || []);
      }
    } catch (err) {
      console.error("❌ Failed to fetch requests:", err);
      setError(err.response?.data?.message || "Failed to load loan requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveNBFCs = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // ✅ FIX: Fetch from correct endpoint (you might need to create this)
      const response = await axios.get(`${API_BASE_URL}/api/nbfc/active`, {
        headers: getAuthHeaders(),
      });

      if (response.data.success) {
        setNbfcs(response.data.nbfcs || []);
      }
    } catch (err) {
      console.error("❌ Failed to fetch NBFCs:", err);
    }
  };

  // ✅ FIX: Check if request already exists
  const canSendRequest = (nbfcId) => {
    return !requests.some(
      (r) => r.nbfc._id === nbfcId && ["pending", "approved"].includes(r.status)
    );
  };

  // ✅ FIX: Show NBFC details in modal
  const handleOpenSendModal = (nbfc) => {
    if (!canSendRequest(nbfc._id)) {
      setError(`You already have an active request with ${nbfc.companyName}`);
      setTimeout(() => setError(null), 5000);
      return;
    }

    setSelectedNBFC(nbfc);
    setMessage("");
    setShowSendModal(true);
  };

  const handleSendRequest = async () => {
    if (!selectedNBFC) return;

    setSendingRequest(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/student/loan-matching/send-request/${selectedNBFC._id}`,
        { message },
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        setSuccess(`Request sent to ${selectedNBFC.companyName} successfully!`);
        setShowSendModal(false);
        await fetchMyRequests();
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error("❌ Failed to send request:", err);
      setError(err.response?.data?.message || "Failed to send loan request");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptOffer = async (requestId) => {
    if (!confirm("Are you sure you want to accept this offer?")) return;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/student/loan-matching/accept-offer/${requestId}`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        setSuccess("Offer accepted successfully!");
        await fetchMyRequests();
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error("❌ Failed to accept offer:", err);
      setError(err.response?.data?.message || "Failed to accept offer");
      setTimeout(() => setError(null), 5000);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        icon: Clock,
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        label: "Pending Review",
      },
      approved: {
        icon: CheckCircle,
        color: "bg-green-100 text-green-800 border-green-200",
        label: "Approved",
      },
      rejected: {
        icon: XCircle,
        color: "bg-red-100 text-red-800 border-red-200",
        label: "Rejected",
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div
        className={`inline-flex items-center px-3 py-1 rounded-full border font-semibold text-sm ${config.color}`}
      >
        <Icon size={16} className="mr-1" />
        {config.label}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <StepperExample currentStep={9}/>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Loan Requests
          </h1>
          <p className="text-gray-600">
            Connect with lenders matched to your profile
          </p>
        </div>

        {/* Success/Error Alerts */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
            <CheckCircle
              className="text-green-500 mr-3 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <XCircle
              className="text-red-500 mr-3 flex-shrink-0 mt-0.5"
              size={20}
            />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* No Analysis Warning */}
        {requests.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <AlertCircle
                className="text-yellow-600 mr-3 flex-shrink-0 mt-1"
                size={24}
              />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">
                  No Loan Requests Yet
                </h3>
                <p className="text-yellow-700 text-sm mb-3">
                  You need to complete a loan analysis before you can send
                  requests.
                </p>
                <a
                  href="/loan-analysis"
                  className="inline-flex items-center bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                >
                  <TrendingUp className="mr-2" size={16} />
                  Go to Analysis
                </a>
              </div>
            </div>
          </div>
        )}

        {/* My Requests */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            My Loan Requests ({requests.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                {/* NBFC Info */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {request.nbfc.companyName}
                  </h3>
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <Mail size={14} className="mr-2" />
                    {request.nbfc.email}
                  </div>
                  {request.nbfc.contactPerson?.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone size={14} className="mr-2" />
                      {request.nbfc.contactPerson.phone}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="mb-4">{getStatusBadge(request.status)}</div>

                {/* Request Date */}
                <div className="text-sm text-gray-500 mb-4">
                  Applied on {new Date(request.createdAt).toLocaleDateString()}
                </div>

                {/* Approved Details */}
                {request.status === "approved" && request.nbfcDecision && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-green-900 mb-2">
                      Offer Details
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-600">Approved Amount</p>
                        <p className="text-lg font-bold text-green-700">
                          ₹{" "}
                          {request.nbfcDecision.offeredAmount?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Interest Rate</p>
                        <p className="text-lg font-bold text-green-700">
                          {request.nbfcDecision.offeredRoi}%
                        </p>
                      </div>
                    </div>

                    {!request.studentAcceptance?.accepted && (
                      <button
                        onClick={() => handleAcceptOffer(request._id)}
                        className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                      >
                        Accept Offer
                      </button>
                    )}

                    {request.studentAcceptance?.accepted && (
                      <div className="mt-3 text-center text-sm font-semibold text-green-700">
                        ✓ Offer Accepted
                      </div>
                    )}
                  </div>
                )}

                {/* Rejected Reason */}
                {request.status === "rejected" &&
                  request.nbfcDecision?.reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      <p className="font-semibold mb-1">Rejection Reason:</p>
                      <p>{request.nbfcDecision.reason}</p>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* Available NBFCs */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Available Lenders ({nbfcs.length})
          </h2>

          {nbfcs.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Building className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-600">
                There are currently no active lenders in the system.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nbfcs.map((nbfc) => {
                const hasActiveRequest = !canSendRequest(nbfc._id);

                return (
                  <div
                    key={nbfc._id}
                    className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {nbfc.companyName}
                        </h3>
                        {nbfc.brandName && (
                          <p className="text-sm text-gray-600">
                            {nbfc.brandName}
                          </p>
                        )}
                      </div>
                      <Building className="text-gray-400" size={24} />
                    </div>

                    {/* NBFC Contact */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Mail size={14} className="mr-2" />
                        {nbfc.email}
                      </div>
                      {nbfc.phoneNumber && (
                        <div className="flex items-center text-gray-600">
                          <Phone size={14} className="mr-2" />
                          {nbfc.phoneNumber}
                        </div>
                      )}
                    </div>

                    {/* Loan Config Snapshot */}
                    {nbfc.loanConfig && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min CIBIL:</span>
                          <span className="font-semibold">
                            {nbfc.loanConfig.cibil?.minScore || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max FOIR:</span>
                          <span className="font-semibold">
                            {nbfc.loanConfig.foir?.maxPercentage || "N/A"}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Interest Rate:</span>
                          <span className="font-semibold">
                            {nbfc.loanConfig.roi?.minRate || 0}% -{" "}
                            {nbfc.loanConfig.roi?.maxRate || 0}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Send Request Button */}
                    <button
                      onClick={() => handleOpenSendModal(nbfc)}
                      disabled={hasActiveRequest}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center ${
                        hasActiveRequest
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      <Send size={16} className="mr-2" />
                      {hasActiveRequest ? "Request Sent" : "Send Request"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ FIX: Improved Send Request Modal */}
        {showSendModal && selectedNBFC && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Send Loan Request
              </h3>
              <p className="text-gray-600 mb-4">
                Sending request to{" "}
                <span className="font-semibold">
                  {selectedNBFC.companyName}
                </span>
              </p>

              {/* Message Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add any additional information..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSendModal(false)}
                  disabled={sendingRequest}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
                >
                  {sendingRequest ? (
                    <>
                      <Loader className="animate-spin mr-2" size={16} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LoanRequest;
