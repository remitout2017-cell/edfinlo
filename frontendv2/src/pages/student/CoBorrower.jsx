// src/pages/student/CoBorrower.jsx
import React, { useEffect, useState } from "react";
import { coBorrowerAPI } from "../../services/api";
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
  Download,
  Eye,
  Plus,
} from "lucide-react";

const RELATIONS = [
  "father",
  "mother",
  "brother",
  "sister",
  "spouse",
  "uncle",
  "aunt",
  "grandfather",
  "grandmother",
  "guardian",
];

const CoBorrower = () => {
  const [coBorrowers, setCoBorrowers] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingBank, setUploadingBank] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Core form state
  const [form, setForm] = useState({
    relationToStudent: "",
    firstName: "",
    lastName: "",
  });

  // File inputs for core docs
  const [files, setFiles] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panFront: null,
    panBack: null,
    salarySlip1: null,
    salarySlip2: null,
    salarySlip3: null,
    itr2024: null,
    itr2023: null,
    form162024: null,
    form162023: null,
  });

  // Bank statement upload files per co-borrower
  const [bankFiles, setBankFiles] = useState({});

  // ========================================================================
  // Fetch Co-Borrowers
  // ========================================================================
  const fetchCoBorrowers = async () => {
    try {
      setLoadingList(true);
      const { data } = await coBorrowerAPI.getAll();
      if (data?.success) {
        setCoBorrowers(data.data || []);
      } else {
        toast.error("Failed to load co-borrowers");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to load co-borrowers");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchCoBorrowers();
  }, []);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: selected } = e.target;
    setFiles((prev) => ({ ...prev, [name]: selected }));
  };

  const handleBankFileChange = (coBorrowerId, e) => {
    const { files: selected } = e.target;
    setBankFiles((prev) => ({ ...prev, [coBorrowerId]: selected }));
  };

  const resetCoreForm = () => {
    setForm({ relationToStudent: "", firstName: "", lastName: "" });
    setFiles({
      aadhaarFront: null,
      aadhaarBack: null,
      panFront: null,
      panBack: null,
      salarySlip1: null,
      salarySlip2: null,
      salarySlip3: null,
      itr2024: null,
      itr2023: null,
      form162024: null,
      form162023: null,
    });
    setShowAddForm(false);
  };

  // ========================================================================
  // Submit: Create Co-Borrower
  // ========================================================================
  const handleCreateCoBorrower = async (e) => {
    e.preventDefault();
    if (!form.relationToStudent || !form.firstName) {
      toast.error("Relation and first name are required");
      return;
    }
    if (
      !files.aadhaarFront?.length ||
      !files.aadhaarBack?.length ||
      !files.panFront?.length
    ) {
      toast.error("Aadhaar (front & back) and PAN (front) are required");
      return;
    }
    if (
      !files.salarySlip1?.length ||
      !files.salarySlip2?.length ||
      !files.salarySlip3?.length
    ) {
      toast.error("All 3 months of salary slips are required");
      return;
    }
    if (!files.itr2024?.length || !files.itr2023?.length) {
      toast.error("ITR for 2024 and 2023 are required");
      return;
    }

    try {
      setCreating(true);
      const formData = new FormData();
      formData.append("relationToStudent", form.relationToStudent);
      formData.append("firstName", form.firstName);
      formData.append("lastName", form.lastName || "");

      const appendFiles = (fieldName, fileList) => {
        if (!fileList) return;
        Array.from(fileList).forEach((file) =>
          formData.append(fieldName, file)
        );
      };

      appendFiles("aadhaarFront", files.aadhaarFront);
      appendFiles("aadhaarBack", files.aadhaarBack);
      appendFiles("panFront", files.panFront);
      appendFiles("panBack", files.panBack);
      appendFiles("salarySlip1", files.salarySlip1);
      appendFiles("salarySlip2", files.salarySlip2);
      appendFiles("salarySlip3", files.salarySlip3);
      appendFiles("itr2024", files.itr2024);
      appendFiles("itr2023", files.itr2023);
      appendFiles("form162024", files.form162024);
      appendFiles("form162023", files.form162023);

      const { data } = await coBorrowerAPI.uploadCoreDocs(formData);
      if (data?.success) {
        toast.success(data.message || "Co-borrower created successfully");
        resetCoreForm();
        await fetchCoBorrowers();
      } else {
        toast.error(data?.error || "Failed to create co-borrower");
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

  // ========================================================================
  // Upload Bank Statements
  // ========================================================================
  const handleUploadBankStatements = async (coBorrowerId) => {
    const selected = bankFiles[coBorrowerId];
    if (!selected || selected.length === 0) {
      toast.error("Select at least 5 bank statement pages");
      return;
    }
    if (selected.length < 5) {
      toast.error("Minimum 5 bank statement pages required");
      return;
    }
    try {
      setUploadingBank(coBorrowerId);
      const formData = new FormData();
      Array.from(selected).forEach((file) =>
        formData.append("bankStatements", file)
      );
      const { data } = await coBorrowerAPI.uploadBankStatements(
        coBorrowerId,
        formData
      );
      if (data?.success) {
        toast.success(data.message || "Bank statements uploaded successfully");
        setBankFiles((prev) => ({ ...prev, [coBorrowerId]: null }));
        await fetchCoBorrowers();
      } else {
        toast.error(data?.error || "Failed to upload bank statements");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to upload bank statements"
      );
    } finally {
      setUploadingBank(null);
    }
  };

  // ========================================================================
  // Delete Co-Borrower
  // ========================================================================
  const handleDeleteCoBorrower = async (id) => {
    if (!window.confirm("Delete this co-borrower?")) return;
    try {
      await coBorrowerAPI.delete(id);
      toast.success("Co-borrower deleted successfully");
      await fetchCoBorrowers();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.error || "Failed to delete co-borrower"
      );
    }
  };

  if (loadingList) {
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
        <StepperExample currentStep={6} />{" "}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <option key={r} value={r} className="capitalize">
                        {r.charAt(0).toUpperCase() + r.slice(1)}
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
              </div>

              {/* Identity Documents */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Identity Documents <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {["aadhaarFront", "aadhaarBack", "panFront", "panBack"].map(
                    (fieldName) => (
                      <div key={fieldName}>
                        <label className="block text-xs font-medium text-gray-600 mb-2 capitalize">
                          {fieldName.replace(/([A-Z])/g, " $1").trim()}
                          {fieldName !== "panBack" && (
                            <span className="text-red-500"> *</span>
                          )}
                        </label>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <input
                            type="file"
                            name={fieldName}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*,.pdf"
                          />
                          {files[fieldName]?.length > 0 ? (
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
                    )
                  )}
                </div>
              </div>

              {/* Salary Slips */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Last 3 Months Salary Slips{" "}
                  <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["salarySlip1", "salarySlip2", "salarySlip3"].map(
                    (fieldName, idx) => (
                      <div key={fieldName}>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Month {idx + 1}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <input
                            type="file"
                            name={fieldName}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf"
                          />
                          {files[fieldName]?.length > 0 ? (
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
                                Upload PDF
                              </span>
                            </div>
                          )}
                        </label>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* ITR and Form 16 */}
              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ITR */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      ITR Documents <span className="text-red-500">*</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {["itr2024", "itr2023"].map((fieldName) => (
                        <div key={fieldName}>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            ITR {fieldName.slice(-4)}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <input
                              type="file"
                              name={fieldName}
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".pdf"
                            />
                            {files[fieldName]?.length > 0 ? (
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
                                  Upload PDF
                                </span>
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Form 16 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Form 16 (Optional)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {["form162024", "form162023"].map((fieldName) => (
                        <div key={fieldName}>
                          <label className="block text-xs font-medium text-gray-600 mb-2">
                            Form 16 ({fieldName.slice(-4)})
                          </label>
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <input
                              type="file"
                              name={fieldName}
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".pdf"
                            />
                            {files[fieldName]?.length > 0 ? (
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
                                  Upload PDF
                                </span>
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      {cb.firstName} {cb.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {cb.relationToStudent}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteCoBorrower(cb._id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Delete Co-Borrower"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Identity Documents */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Identity Documents
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Aadhaar Documents</span>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Uploaded
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">PAN Documents</span>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Uploaded
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Documents */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Financial Documents
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-gray-600 mb-1">Salary Slips</div>
                        <div className="font-medium text-gray-900">
                          {cb.financialInfo?.salarySlips?.length || 0} months
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-gray-600 mb-1">ITR Records</div>
                        <div className="font-medium text-gray-900">
                          {cb.financialInfo?.itrData?.length || 0} years
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-gray-600 mb-1">Form 16</div>
                        <div className="font-medium text-gray-900">
                          {cb.financialInfo?.form16Data?.length || 0} years
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bank Statement Upload/Analysis */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Bank Statement Analysis
                    </h4>

                    {cb.financialInfo?.bankStatement?.overallAnalysis ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-900 mb-2">
                              Bank Statement Analyzed
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <div className="text-green-700 text-xs">
                                  Avg Balance
                                </div>
                                <div className="font-semibold text-green-900">
                                  ₹
                                  {cb.financialInfo.bankStatement.overallAnalysis.averageMonthlyBalance?.toLocaleString() ||
                                    0}
                                </div>
                              </div>
                              <div>
                                <div className="text-green-700 text-xs">
                                  Pages Analyzed
                                </div>
                                <div className="font-semibold text-green-900">
                                  {cb.financialInfo.bankStatement.pageCount ||
                                    0}
                                </div>
                              </div>
                              <div>
                                <div className="text-green-700 text-xs">
                                  Total EMI
                                </div>
                                <div className="font-semibold text-green-900">
                                  ₹
                                  {cb.financialInfo.financialSummary?.totalExistingEmi?.toLocaleString() ||
                                    0}
                                </div>
                              </div>
                              <div>
                                <div className="text-green-700 text-xs">
                                  FOIR
                                </div>
                                <div className="font-semibold text-green-900">
                                  {cb.financialInfo.financialSummary?.foir?.toFixed(
                                    2
                                  ) || 0}
                                  %
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-4">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-900">
                              Bank Statement Required
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              Upload at least 5 pages of recent bank statements
                              (6-month period)
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-yellow-300 rounded-lg cursor-pointer hover:border-yellow-400 hover:bg-yellow-100 transition-colors bg-white">
                            <input
                              type="file"
                              multiple
                              onChange={(e) => handleBankFileChange(cb._id, e)}
                              className="hidden"
                              accept=".pdf"
                            />
                            {bankFiles[cb._id]?.length > 0 ? (
                              <div className="text-center">
                                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <span className="text-sm font-medium text-gray-900">
                                  {bankFiles[cb._id].length} files selected
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  Click upload button below
                                </p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                <span className="text-sm font-medium text-gray-700">
                                  Upload Bank Statements
                                </span>
                                <p className="text-xs text-gray-500 mt-1">
                                  PDF files only (min 5 pages)
                                </p>
                              </div>
                            )}
                          </label>

                          {bankFiles[cb._id]?.length > 0 && (
                            <button
                              onClick={() => handleUploadBankStatements(cb._id)}
                              disabled={uploadingBank === cb._id}
                              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {uploadingBank === cb._id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  Upload & Analyze
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between py-6 border-t border-gray-200">
          <Link to="/student/work-experience">
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
            onClick={() => (window.location.href = "/student/admission")}
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
    </DashboardLayout>
  );
};

export default CoBorrower;
