// src/pages/student/CoBorrower.jsx

import React, { useEffect, useState } from "react";
import { useCoBorrowerData } from "../../context/CoBorrowerContext";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { Link } from "react-router-dom";
import {
  Users,
  FileText,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  DollarSign,
  TrendingUp,
  CreditCard,
  Activity,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CoBorrower = () => {
  const {
    coBorrowers,
    loading,
    fetchCoBorrowers,
    createCoBorrowerWithKyc,
    uploadFinancialDocuments,
    deleteCoBorrower,
    reverifyKyc,
    getFinancialAnalysis,
    resetFinancialDocuments,
  } = useCoBorrowerData();

  // UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedCoBorrower, setSelectedCoBorrower] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Form States
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    relationToStudent: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
  });

  const [kycFiles, setKycFiles] = useState({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_front: null,
    passport: null,
  });

  const [financialFiles, setFinancialFiles] = useState({
    salary_slips_pdf: null,
    bank_statement_pdf: null,
    itr_pdf_1: null,
    itr_pdf_2: null,
    form16_pdf: null,
    cibil_pdf: null, // ✅ ADDED CIBIL PDF
  });

  // Load co-borrowers on mount
  useEffect(() => {
    fetchCoBorrowers();
  }, [fetchCoBorrowers]);

  // Reset form
  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      relationToStudent: "",
      email: "",
      phoneNumber: "",
      dateOfBirth: "",
    });
    setKycFiles({
      aadhaar_front: null,
      aadhaar_back: null,
      pan_front: null,
      passport: null,
    });
    setFinancialFiles({
      salary_slips_pdf: null,
      bank_statement_pdf: null,
      itr_pdf_1: null,
      itr_pdf_2: null,
      form16_pdf: null,
      cibil_pdf: null, // ✅ ADDED
    });
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle file change
  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        e.target.value = "";
        return;
      }
      setKycFiles((prev) => ({ ...prev, [fileType]: file }));
    }
  };

  // Handle financial file change
  const handleFinancialFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        e.target.value = "";
        return;
      }
      setFinancialFiles((prev) => ({ ...prev, [fileType]: file }));
    }
  };

  // Submit KYC form
  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (
        !formData.firstName ||
        !formData.lastName ||
        !formData.relationToStudent
      ) {
        toast.error("Please fill all required fields");
        return;
      }

      if (
        !kycFiles.aadhaar_front ||
        !kycFiles.aadhaar_back ||
        !kycFiles.pan_front
      ) {
        toast.error("Please upload all required KYC documents");
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append("firstName", formData.firstName);
      formDataToSend.append("lastName", formData.lastName);
      formDataToSend.append("relationToStudent", formData.relationToStudent);
      if (formData.email) formDataToSend.append("email", formData.email);
      if (formData.phoneNumber)
        formDataToSend.append("phoneNumber", formData.phoneNumber);
      if (formData.dateOfBirth)
        formDataToSend.append("dateOfBirth", formData.dateOfBirth);

      formDataToSend.append("aadhaar_front", kycFiles.aadhaar_front);
      formDataToSend.append("aadhaar_back", kycFiles.aadhaar_back);
      formDataToSend.append("pan_front", kycFiles.pan_front);
      if (kycFiles.passport)
        formDataToSend.append("passport", kycFiles.passport);

      const result = await createCoBorrowerWithKyc(formDataToSend);

      if (result.verified) {
        toast.success("Co-borrower added and KYC verified successfully!");
      } else {
        toast.warning(
          "Co-borrower added but KYC verification failed. Please re-verify."
        );
      }

      setShowAddModal(false);
      resetForm();
      fetchCoBorrowers();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to add co-borrower");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Financial Documents
  const handleFinancialSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (
        !financialFiles.salary_slips_pdf ||
        !financialFiles.bank_statement_pdf ||
        !financialFiles.itr_pdf_1
      ) {
        toast.error("Please upload all required financial documents");
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append(
        "salary_slips_pdf",
        financialFiles.salary_slips_pdf
      );
      formDataToSend.append(
        "bank_statement_pdf",
        financialFiles.bank_statement_pdf
      );
      formDataToSend.append("itr_pdf_1", financialFiles.itr_pdf_1);
      if (financialFiles.itr_pdf_2)
        formDataToSend.append("itr_pdf_2", financialFiles.itr_pdf_2);
      if (financialFiles.form16_pdf)
        formDataToSend.append("form16_pdf", financialFiles.form16_pdf);
      if (financialFiles.cibil_pdf)
        formDataToSend.append("cibil_pdf", financialFiles.cibil_pdf); // ✅ ADDED

      const loadingToast = toast.loading(
        "Processing financial documents... This may take 2-5 minutes"
      );

      const result = await uploadFinancialDocuments(
        selectedCoBorrower._id,
        formDataToSend
      );

      toast.dismiss(loadingToast);

      if (result.status === "verified") {
        toast.success(
          "Financial documents processed and verified successfully!"
        );
      } else if (result.status === "partial") {
        toast.warning(
          "Financial documents processed with partial data. Please review."
        );
      } else {
        toast.error(
          "Financial verification failed. Please upload better quality documents."
        );
      }

      setShowFinancialModal(false);
      resetForm();
      fetchCoBorrowers();
    } catch (error) {
      toast.error(
        error.response?.data?.error || "Failed to upload financial documents"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Analysis
  const handleViewAnalysis = async (coBorrower) => {
    try {
      const data = await getFinancialAnalysis(coBorrower._id);
      setAnalysisData(data);
      setSelectedCoBorrower(coBorrower);
      setShowAnalysisModal(true);
    } catch (error) {
      toast.error("Failed to load financial analysis");
    }
  };

  // Delete Co-borrower
  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteCoBorrower(id);
        toast.success("Co-borrower deleted successfully");
        fetchCoBorrowers();
      } catch (error) {
        toast.error("Failed to delete co-borrower");
      }
    }
  };

  // Re-verify KYC
  const handleReverifyKyc = async (coBorrower) => {
    setSelectedCoBorrower(coBorrower);
    setShowAddModal(true);
  };

  // Reset Financial Documents
  const handleResetFinancial = async (id, name) => {
    if (
      window.confirm(
        `Reset financial documents for ${name}? This will delete all uploaded documents.`
      )
    ) {
      try {
        await resetFinancialDocuments(id);
        toast.success("Financial documents reset successfully");
        fetchCoBorrowers();
      } catch (error) {
        toast.error("Failed to reset financial documents");
      }
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "partial":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen">
        <StepperExample currentStep={6} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-semibold text-gray-800">
                Co-Borrowers
              </h2>
              <button
                onClick={() => {
                  resetForm();
                  setSelectedCoBorrower(null);
                  setShowAddModal(true);
                }}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
              >
                <Plus size={18} className="mr-1" />
                Add Co-Borrower
              </button>
            </div>
            <p className="text-gray-600">
              Add co-borrowers to strengthen your loan application
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading co-borrowers...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && coBorrowers.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Users className="mx-auto text-gray-400 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Co-Borrowers Added
              </h3>
              <p className="text-gray-600 mb-6">
                Add a co-borrower to strengthen your loan application
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg inline-flex items-center hover:bg-blue-700 transition-colors"
              >
                <Plus className="mr-2" size={20} />
                Add Your First Co-Borrower
              </button>
            </div>
          )}

          {/* Co-Borrowers List */}
          {!loading && coBorrowers.length > 0 && (
            <div className="space-y-4">
              {coBorrowers.map((cb) => (
                <div
                  key={cb._id}
                  className="border border-gray-200 rounded-xl p-4 md:p-6 bg-gray-50"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">
                        {cb.fullName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {cb.relationToStudent}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(cb._id, cb.fullName)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Delete co-borrower"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Contact Info */}
                  {(cb.email || cb.phoneNumber) && (
                    <div className="mb-4 space-y-1">
                      {cb.email && (
                        <p className="text-sm text-gray-600">📧 {cb.email}</p>
                      )}
                      {cb.phoneNumber && (
                        <p className="text-sm text-gray-600">
                          📱 {cb.phoneNumber}
                        </p>
                      )}
                    </div>
                  )}

                  {/* KYC Status */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        KYC Status
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          cb.kycStatus
                        )}`}
                      >
                        {cb.kycStatus?.toUpperCase()}
                      </span>
                    </div>

                    {cb.kycStatus === "rejected" && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                        <p className="text-sm text-red-800 font-semibold mb-2">
                          <XCircle className="inline mr-1" size={16} />
                          KYC Verification Failed
                        </p>
                        <p className="text-xs text-red-700 mb-3">
                          Please re-upload better quality documents
                        </p>
                        <button
                          onClick={() => handleReverifyKyc(cb)}
                          className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
                        >
                          <RefreshCw className="mr-1" size={14} />
                          Re-verify KYC
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Financial Status */}
                  {cb.kycStatus === "verified" && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Financial Status
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            cb.financialStatus
                          )}`}
                        >
                          {cb.financialStatus?.toUpperCase() || "PENDING"}
                        </span>
                      </div>

                      {cb.financialStatus === "verified" && (
                        <button
                          onClick={() => handleViewAnalysis(cb)}
                          className="w-full mt-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center text-sm font-medium"
                        >
                          <FileText className="mr-2" size={16} />
                          View Analysis
                        </button>
                      )}

                      {(!cb.financialStatus ||
                        cb.financialStatus === "pending") && (
                          <button
                            onClick={() => {
                              setSelectedCoBorrower(cb);
                              setShowFinancialModal(true);
                            }}
                            className="w-full mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-sm font-medium"
                          >
                            <Upload className="mr-2" size={16} />
                            Upload Financial Documents
                          </button>
                        )}

                      {(cb.financialStatus === "failed" ||
                        cb.financialStatus === "partial") && (
                          <div className="mt-2 space-y-2">
                            <button
                              onClick={() =>
                                handleResetFinancial(cb._id, cb.fullName)
                              }
                              className="w-full bg-orange-50 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center text-sm font-medium"
                            >
                              <RefreshCw className="mr-2" size={16} />
                              Reset & Re-upload
                            </button>
                            {cb.financialStatus === "partial" && (
                              <button
                                onClick={() => handleViewAnalysis(cb)}
                                className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center text-sm font-medium"
                              >
                                <FileText className="mr-2" size={16} />
                                View Partial Analysis
                              </button>
                            )}
                          </div>
                        )}

                      {cb.financialStatus === "processing" && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center text-sm text-blue-800">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Processing documents... (2-5 min)
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={() => navigate("/student/work-experience")}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-gray-300 hover:bg-gray-50 transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>

            <button
              onClick={() => navigate("/student/admission")}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 transition"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </div>

        </div> {/* Close Card */}

        {/* Footer */}
        <div className="flex gap-6 mt-8 text-gray-500 text-sm">
          <button className="hover:text-gray-700 transition">Support</button>
          <button className="hover:text-gray-700 transition">Help</button>
        </div>

        {/* Add/Edit KYC Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedCoBorrower ? "Re-verify KYC" : "Add Co-Borrower"}
                </h2>
              </div>

              <form onSubmit={handleKycSubmit} className="p-6 space-y-6">
                {/* Personal Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relation to Student *
                    </label>
                    <select
                      name="relationToStudent"
                      value={formData.relationToStudent}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select relation</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* KYC Documents */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    KYC Documents
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Aadhaar Front *
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, "aadhaar_front")}
                        required
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                      />
                      {kycFiles.aadhaar_front && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {kycFiles.aadhaar_front.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Aadhaar Back *
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, "aadhaar_back")}
                        required
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                      />
                      {kycFiles.aadhaar_back && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {kycFiles.aadhaar_back.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PAN Card *
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, "pan_front")}
                        required
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                      />
                      {kycFiles.pan_front && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {kycFiles.pan_front.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Passport (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, "passport")}
                        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                      />
                      {kycFiles.passport && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {kycFiles.passport.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2" size={18} />
                        {selectedCoBorrower ? "Re-verify KYC" : "Submit"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Financial Upload Modal */}
        {showFinancialModal && selectedCoBorrower && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-bold text-gray-900">
                  Upload Financial Documents
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  For: {selectedCoBorrower.fullName}
                </p>
              </div>

              <form onSubmit={handleFinancialSubmit} className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    📄 Upload clear PDF documents. Processing will take 2-5
                    minutes.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Required Documents */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Salary Slips (Last 3-6 months) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        handleFinancialFileChange(e, "salary_slips_pdf")
                      }
                      required
                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                    />
                    {financialFiles.salary_slips_pdf && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {financialFiles.salary_slips_pdf.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Statement (Last 6-12 months) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        handleFinancialFileChange(e, "bank_statement_pdf")
                      }
                      required
                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                    />
                    {financialFiles.bank_statement_pdf && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {financialFiles.bank_statement_pdf.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ITR (Most Recent Year) *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        handleFinancialFileChange(e, "itr_pdf_1")
                      }
                      required
                      className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                    />
                    {financialFiles.itr_pdf_1 && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {financialFiles.itr_pdf_1.name}
                      </p>
                    )}
                  </div>

                  {/* Optional Documents */}
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Optional Documents (Recommended)
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ITR (Previous Year)
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) =>
                            handleFinancialFileChange(e, "itr_pdf_2")
                          }
                          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                        />
                        {financialFiles.itr_pdf_2 && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {financialFiles.itr_pdf_2.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Form 16
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) =>
                            handleFinancialFileChange(e, "form16_pdf")
                          }
                          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                        />
                        {financialFiles.form16_pdf && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {financialFiles.form16_pdf.name}
                          </p>
                        )}
                      </div>

                      {/* ✅ ADDED: CIBIL PDF Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CIBIL Report
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) =>
                            handleFinancialFileChange(e, "cibil_pdf")
                          }
                          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Upload your CIBIL credit report for accurate scoring
                        </p>
                        {financialFiles.cibil_pdf && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {financialFiles.cibil_pdf.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinancialModal(false);
                      resetForm();
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2" size={18} />
                        Upload & Process
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ ENHANCED: Analysis Modal with CIBIL Details */}
        {showAnalysisModal && analysisData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-2xl font-bold text-gray-900">
                  Financial Analysis Report
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  For: {selectedCoBorrower?.fullName}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* FOIR Section */}
                {analysisData.analysis?.foir && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <DollarSign className="mr-2 text-blue-600" />
                      FOIR (Fixed Obligation to Income Ratio)
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">FOIR %</div>
                        <div
                          className={`text-3xl font-bold ${analysisData.analysis.foir.percentage <= 40
                            ? "text-green-600"
                            : analysisData.analysis.foir.percentage <= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                            }`}
                        >
                          {analysisData.analysis.foir.percentage?.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analysisData.analysis.foir.status}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">
                          Monthly Income
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          ₹
                          {analysisData.analysis.foir.monthlyIncome?.toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">
                          Monthly EMI
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          ₹
                          {analysisData.analysis.foir.monthlyEMI?.toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">
                          Available Income
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          ₹
                          {analysisData.analysis.foir.availableIncome?.toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ✅ NEW: CIBIL Score Section */}
                {analysisData.analysis?.cibil && (
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <CreditCard className="mr-2 text-purple-600" />
                      CIBIL Score Analysis
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Estimated Score */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">
                          Estimated Score
                        </div>
                        <div
                          className={`text-3xl font-bold ${analysisData.analysis.cibil.estimatedScore >= 750
                            ? "text-green-600"
                            : analysisData.analysis.cibil.estimatedScore >=
                              650
                              ? "text-yellow-600"
                              : "text-red-600"
                            }`}
                        >
                          {analysisData.analysis.cibil.estimatedScore || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {analysisData.analysis.cibil.estimatedBand ||
                            "Unknown"}
                        </div>
                      </div>

                      {/* Risk Level */}
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">
                          Risk Level
                        </div>
                        <div
                          className={`text-lg font-semibold ${analysisData.analysis.cibil.riskLevel === "low"
                            ? "text-green-600"
                            : analysisData.analysis.cibil.riskLevel ===
                              "medium"
                              ? "text-yellow-600"
                              : "text-red-600"
                            }`}
                        >
                          {analysisData.analysis.cibil.riskLevel?.toUpperCase() ||
                            "N/A"}
                        </div>
                      </div>

                      {/* Component Scores */}
                      <div className="col-span-2 bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-600 mb-3">
                          Component Scores
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              Payment History:
                            </span>
                            <span className="font-semibold text-blue-600">
                              {analysisData.analysis.cibil.paymentHistoryScore}
                              /10
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              Credit Utilization:
                            </span>
                            <span className="font-semibold text-blue-600">
                              {
                                analysisData.analysis.cibil
                                  .creditUtilizationScore
                              }
                              /10
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              Income Stability:
                            </span>
                            <span className="font-semibold text-blue-600">
                              {analysisData.analysis.cibil.incomeStabilityScore}
                              /10
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Credit Mix:</span>
                            <span className="font-semibold text-blue-600">
                              {analysisData.analysis.cibil.creditMixScore}/10
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Positive Factors */}
                    {analysisData.analysis.cibil.positiveFactors?.length >
                      0 && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-3">
                          <div className="text-sm font-semibold text-green-800 mb-2 flex items-center">
                            <CheckCircle className="mr-2" size={16} />
                            Positive Factors
                          </div>
                          <ul className="text-sm text-green-700 space-y-1">
                            {analysisData.analysis.cibil.positiveFactors.map(
                              (factor, idx) => (
                                <li key={idx}>• {factor}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {/* Negative Factors */}
                    {analysisData.analysis.cibil.negativeFactors?.length >
                      0 && (
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <div className="text-sm font-semibold text-red-800 mb-2 flex items-center">
                            <AlertCircle className="mr-2" size={16} />
                            Risk Factors
                          </div>
                          <ul className="text-sm text-red-700 space-y-1">
                            {analysisData.analysis.cibil.negativeFactors.map(
                              (factor, idx) => (
                                <li key={idx}>• {factor}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* Quality Metrics */}
                {analysisData.analysis?.quality && (
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Activity className="mr-2 text-gray-600" />
                      Analysis Quality
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">
                          Overall Confidence
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {(
                            analysisData.analysis.quality.overallConfidence *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>

                      {analysisData.analysis.quality.dataSourcesUsed?.length >
                        0 && (
                          <div>
                            <div className="text-sm text-gray-700 mb-2">
                              Data Sources Used:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {analysisData.analysis.quality.dataSourcesUsed.map(
                                (source, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                                  >
                                    {source}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {analysisData.analysis.quality.missingData?.length >
                        0 && (
                          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="text-sm font-semibold text-yellow-800 mb-2">
                              Missing Data:
                            </div>
                            <div className="text-sm text-yellow-700">
                              {analysisData.analysis.quality.missingData.join(
                                ", "
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                {analysisData.summary && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Financial Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {Object.entries(analysisData.summary).map(
                        ([key, value]) => {
                          if (typeof value === "object" && value !== null) return null;
                          return (
                            <div key={key}>
                              <div className="text-gray-600 capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </div>
                              <div className="font-semibold text-gray-900">
                                {typeof value === "number"
                                  ? value.toLocaleString("en-IN")
                                  : value || "N/A"}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowAnalysisModal(false);
                    setAnalysisData(null);
                  }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CoBorrower;
