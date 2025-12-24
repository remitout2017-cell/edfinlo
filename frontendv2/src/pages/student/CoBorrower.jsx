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
} from "lucide-react";

const RELATIONS = [
  "Father",
  "Mother",
  "Guardian",
  "Spouse",
  "Sibling",
  "Other",
];

const CoBorrower = () => {
  // Get coborrower data from context
  const {
    coBorrowers,
    loading,
    fetchCoBorrowers,
    createCoBorrowerWithKyc,
    uploadFinancialDocuments,
    deleteCoBorrower,
    reverifyKyc,
    resetFinancialDocuments,
  } = useCoBorrowerData();

  const [creating, setCreating] = useState(false);
  const [uploadingFinancial, setUploadingFinancial] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reverifying, setReverifying] = useState(null);

  // Core form state - only KYC info (split from financial docs)
  const [form, setForm] = useState({
    relationToStudent: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
  });

  // KYC files only
  const [kycFiles, setKycFiles] = useState({
    aadhaar_front: null,
    aadhaar_back: null,
    pan_front: null,
    passport: null,
  });

  // Financial files per co-borrower
  const [financialFiles, setFinancialFiles] = useState({});

  // Fetch coborrowers on mount
  useEffect(() => {
    fetchCoBorrowers();
  }, [fetchCoBorrowers]);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleKycFileChange = (e) => {
    const { name, files: selected } = e.target;
    setKycFiles((prev) => ({ ...prev, [name]: selected }));
  };

  const handleFinancialFileChange = (coBorrowerId, field, e) => {
    const { files: selected } = e.target;
    setFinancialFiles((prev) => ({
      ...prev,
      [coBorrowerId]: {
        ...prev[coBorrowerId],
        [field]: selected,
      },
    }));
  };

  const resetKycForm = () => {
    setForm({
      relationToStudent: "",
      firstName: "",
      lastName: "",
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
    setShowAddForm(false);
  };

  // ============================================================================
  // Submit: Create Co-Borrower with KYC (Step 1)
  // ============================================================================
  const handleCreateCoBorrower = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!form.relationToStudent || !form.firstName) {
      toast.error("Relation and first name are required");
      return;
    }

    if (
      !kycFiles.aadhaar_front?.length ||
      !kycFiles.aadhaar_back?.length ||
      !kycFiles.pan_front?.length
    ) {
      toast.error("Aadhaar (front, back) and PAN are required");
      return;
    }

    try {
      setCreating(true);
      const formData = new FormData();

      // Append personal info
      formData.append("relationToStudent", form.relationToStudent);
      formData.append("firstName", form.firstName);
      formData.append("lastName", form.lastName);
      if (form.email) formData.append("email", form.email);
      if (form.phoneNumber) formData.append("phoneNumber", form.phoneNumber);
      if (form.dateOfBirth) formData.append("dateOfBirth", form.dateOfBirth);

      // Append KYC documents
      if (kycFiles.aadhaar_front)
        formData.append("aadhaar_front", kycFiles.aadhaar_front[0]);
      if (kycFiles.aadhaar_back)
        formData.append("aadhaar_back", kycFiles.aadhaar_back[0]);
      if (kycFiles.pan_front)
        formData.append("pan_front", kycFiles.pan_front[0]);
      if (kycFiles.passport) formData.append("passport", kycFiles.passport[0]);

      // Call context function
      const result = await createCoBorrowerWithKyc(formData);

      if (result?.success) {
        if (result.verified) {
          toast.success(
            result.message || "Co-borrower created and KYC verified!"
          );
        } else {
          toast.error(
            result.message ||
              "Co-borrower created but KYC verification failed. Please re-verify."
          );
        }
        resetKycForm();
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to create co-borrower"
      );
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // Re-verify KYC for rejected co-borrower
  // ============================================================================
  const handleReverifyKyc = async (coBorrowerId) => {
    const files = financialFiles[coBorrowerId];

    if (
      !files?.aadhaar_front?.length ||
      !files?.aadhaar_back?.length ||
      !files?.pan_front?.length
    ) {
      toast.error(
        "Aadhaar (front, back) and PAN are required for re-verification"
      );
      return;
    }

    try {
      setReverifying(coBorrowerId);
      const formData = new FormData();

      formData.append("aadhaar_front", files.aadhaar_front[0]);
      formData.append("aadhaar_back", files.aadhaar_back[0]);
      formData.append("pan_front", files.pan_front[0]);
      if (files.passport) formData.append("passport", files.passport[0]);

      const result = await reverifyKyc(coBorrowerId, formData);

      if (result?.success) {
        if (result.verified) {
          toast.success("KYC re-verified successfully!");
        } else {
          toast.error(
            "KYC verification failed. " + (result.reasons?.join(", ") || "")
          );
        }
        // Clear files
        setFinancialFiles((prev) => {
          const updated = { ...prev };
          delete updated[coBorrowerId];
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to re-verify KYC");
    } finally {
      setReverifying(null);
    }
  };

  // ============================================================================
  // Upload Financial Documents (Step 2 - after KYC is done)
  // ============================================================================
  const handleUploadFinancialDocs = async (coBorrowerId) => {
    const files = financialFiles[coBorrowerId];

    // Validate required files
    if (!files?.salary_slips_pdf?.length) {
      toast.error("Salary slips PDF is required");
      return;
    }
    if (!files?.bank_statement_pdf?.length) {
      toast.error("Bank statement PDF is required");
      return;
    }
    if (!files?.itr_pdf_1?.length) {
      toast.error("At least ITR 1 is required");
      return;
    }

    try {
      setUploadingFinancial(coBorrowerId);
      const formData = new FormData();

      // Append financial documents
      formData.append("salary_slips_pdf", files.salary_slips_pdf[0]);
      formData.append("bank_statement_pdf", files.bank_statement_pdf[0]);
      formData.append("itr_pdf_1", files.itr_pdf_1[0]);
      if (files.itr_pdf_2) formData.append("itr_pdf_2", files.itr_pdf_2[0]);
      if (files.form16_pdf) formData.append("form16_pdf", files.form16_pdf[0]);

      // Call context function
      const result = await uploadFinancialDocuments(coBorrowerId, formData);

      if (result?.success) {
        toast.success(
          result.message ||
            "Financial documents uploaded and analyzed successfully!"
        );
        // Clear files for this coborrower
        setFinancialFiles((prev) => {
          const updated = { ...prev };
          delete updated[coBorrowerId];
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to upload financial documents"
      );
    } finally {
      setUploadingFinancial(null);
    }
  };

  // ============================================================================
  // Reset Financial Documents
  // ============================================================================
  const handleResetFinancial = async (coBorrowerId) => {
    if (
      !window.confirm(
        "Reset financial documents? This will delete all uploaded files and analysis."
      )
    )
      return;

    try {
      const result = await resetFinancialDocuments(coBorrowerId);
      if (result?.success) {
        toast.success("Financial documents reset. You can re-upload now.");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to reset financial documents"
      );
    }
  };

  // ============================================================================
  // Delete Co-Borrower
  // ============================================================================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this co-borrower?")) return;

    try {
      await deleteCoBorrower(id);
      toast.success("Co-borrower deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to delete co-borrower"
      );
    }
  };

  // ============================================================================
  // Helper: Get Status Badge
  // ============================================================================
  const getStatusBadge = (status) => {
    const styles = {
      verified: "bg-green-100 text-green-700 border-green-200",
      pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
      processing: "bg-blue-100 text-blue-700 border-blue-200",
      failed: "bg-red-100 text-red-700 border-red-200",
    };

    return (
      <span
        className={`px-3 py-1 text-xs font-semibold rounded-full border ${
          styles[status] || styles.pending
        }`}
      >
        {status?.toUpperCase() || "UNKNOWN"}
      </span>
    );
  };

  if (loading && coBorrowers.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading co-borrowers...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <StepperExample currentStep={6} />
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Co-Borrower Information
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Add co-borrowers to strengthen your loan application
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                showAddForm
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? "Cancel" : "Add Co-Borrower"}
            </button>
          </div>
        </div>

        {/* Add New Co-Borrower Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">
                Add New Co-Borrower
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Provide co-borrower details and upload required documents
              </p>
            </div>

            <form onSubmit={handleCreateCoBorrower} className="p-6 space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relation to Student <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="relationToStudent"
                    value={form.relationToStudent}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Relation</option>
                    {RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter first name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={form.phoneNumber}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={form.dateOfBirth}
                    onChange={handleTextChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* KYC Documents */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  KYC Documents <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      name: "aadhaar_front",
                      label: "Aadhaar Front",
                      required: true,
                    },
                    {
                      name: "aadhaar_back",
                      label: "Aadhaar Back",
                      required: true,
                    },
                    { name: "pan_front", label: "PAN Card", required: true },
                    { name: "passport", label: "Passport", required: false },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500"> *</span>
                        )}
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <input
                          type="file"
                          name={field.name}
                          onChange={handleKycFileChange}
                          className="hidden"
                          accept="image/*,.pdf"
                        />
                        {kycFiles[field.name]?.length > 0 ? (
                          <div className="text-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                            <span className="text-xs text-green-600 font-medium">
                              Uploaded
                            </span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                            <span className="text-xs text-gray-500">
                              Upload
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save Co-Borrower
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Co-Borrowers List */}
        {coBorrowers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Co-Borrowers Added
            </h3>
            <p className="text-gray-500 text-sm">
              Add a co-borrower to strengthen your loan application
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {coBorrowers.map((cb) => (
              <div
                key={cb._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Co-Borrower Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {cb.fullName || `${cb.firstName} ${cb.lastName}`}
                    </h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {cb.relationToStudent}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(cb.kycStatus)}
                    <button
                      onClick={() => handleDelete(cb._id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Delete Co-Borrower"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* KYC Status */}
                  {cb.kycStatus === "rejected" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-900">
                            KYC Verification Failed
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            Please re-upload better quality documents
                          </p>
                        </div>
                      </div>

                      {/* Re-verify Form */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { name: "aadhaar_front", label: "Aadhaar Front" },
                            { name: "aadhaar_back", label: "Aadhaar Back" },
                            { name: "pan_front", label: "PAN Card" },
                          ].map((field) => (
                            <div key={field.name}>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                {field.label}
                              </label>
                              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                <input
                                  type="file"
                                  onChange={(e) =>
                                    handleFinancialFileChange(
                                      cb._id,
                                      field.name,
                                      e
                                    )
                                  }
                                  className="hidden"
                                  accept="image/*,.pdf"
                                />
                                {financialFiles[cb._id]?.[field.name]?.length >
                                0 ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <Upload className="w-4 h-4 text-gray-400" />
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleReverifyKyc(cb._id)}
                          disabled={reverifying === cb._id}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {reverifying === cb._id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Re-verifying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Re-verify KYC
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Financial Documents Section - Only show if KYC is verified */}
                  {cb.kycStatus === "verified" && (
                    <>
                      <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-900">
                            Financial Documents
                          </h4>
                          {getStatusBadge(
                            cb.financialVerificationStatus || "pending"
                          )}
                        </div>

                        {/* Show Financial Summary if verified */}
                        {cb.financialVerificationStatus === "verified" &&
                          cb.financialSummary && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                              <div className="flex items-start gap-3 mb-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-green-900 mb-2">
                                    Financial Analysis Complete
                                  </p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Avg Monthly Salary
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        ₹
                                        {cb.financialSummary.avgMonthlySalary?.toLocaleString() ||
                                          0}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Annual Income
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        ₹
                                        {cb.financialSummary.estimatedAnnualIncome?.toLocaleString() ||
                                          0}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Total EMI
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        ₹
                                        {cb.financialSummary.totalExistingEmi?.toLocaleString() ||
                                          0}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        FOIR
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        {cb.financialSummary.foir?.toFixed(2) ||
                                          0}
                                        %
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        CIBIL Estimate
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        {cb.financialSummary.cibilEstimate ||
                                          "N/A"}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Avg Bank Balance
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        ₹
                                        {cb.financialSummary.avgBankBalance?.toLocaleString() ||
                                          0}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Min Balance
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        ₹
                                        {cb.financialSummary.minBankBalance?.toLocaleString() ||
                                          0}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-green-700 text-xs">
                                        Bounce Count
                                      </div>
                                      <div className="font-semibold text-green-900">
                                        {cb.financialSummary.bounceCount || 0}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleResetFinancial(cb._id)}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Reset & Re-upload
                              </button>
                            </div>
                          )}

                        {/* Show Upload Form if not verified */}
                        {cb.financialVerificationStatus !== "verified" && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-4">
                              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-yellow-900">
                                  Financial Documents Required
                                </p>
                                <p className="text-xs text-yellow-700 mt-1">
                                  Upload salary slips, bank statement, and ITR
                                  for financial analysis
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                  {
                                    name: "salary_slips_pdf",
                                    label: "Salary Slips (PDF)",
                                    required: true,
                                  },
                                  {
                                    name: "bank_statement_pdf",
                                    label: "Bank Statement (PDF)",
                                    required: true,
                                  },
                                  {
                                    name: "itr_pdf_1",
                                    label: "ITR 1 (PDF)",
                                    required: true,
                                  },
                                  {
                                    name: "itr_pdf_2",
                                    label: "ITR 2 (PDF)",
                                    required: false,
                                  },
                                  {
                                    name: "form16_pdf",
                                    label: "Form 16 (PDF)",
                                    required: false,
                                  },
                                ].map((field) => (
                                  <div key={field.name}>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      {field.label}
                                      {field.required && (
                                        <span className="text-red-500"> *</span>
                                      )}
                                    </label>
                                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                                      <input
                                        type="file"
                                        onChange={(e) =>
                                          handleFinancialFileChange(
                                            cb._id,
                                            field.name,
                                            e
                                          )
                                        }
                                        className="hidden"
                                        accept=".pdf"
                                      />
                                      {financialFiles[cb._id]?.[field.name]
                                        ?.length > 0 ? (
                                        <div className="text-center">
                                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                                          <span className="text-xs text-green-600 font-medium">
                                            Selected
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="text-center">
                                          <Upload className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                                          <span className="text-xs text-gray-500">
                                            Upload
                                          </span>
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                ))}
                              </div>

                              <button
                                onClick={() =>
                                  handleUploadFinancialDocs(cb._id)
                                }
                                disabled={uploadingFinancial === cb._id}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {uploadingFinancial === cb._id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Uploading & Analyzing...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    Upload & Analyze
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between py-6 border-t border-gray-200">
          <Link to="/student/work-experience">
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

          <Link to="/student/admission">
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
    </DashboardLayout>
  );
};

export default CoBorrower;
