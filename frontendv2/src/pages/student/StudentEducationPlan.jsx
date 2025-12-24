// src/pages/student/StudentEducationPlan.jsx
// Redesigned as "My Application" page matching the design mockup

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";

import { useAuth } from "../../context/AuthContext";
import {
  studentEducationPlanAPI,
  kycAPI,
  academicAPI,
  admissionAPI,
  workExperienceAPI,
  coBorrowerAPI,
  userAPI,
  loanRequestAPI,
  nbfcAPI,
} from "../../services/api";
import toast from "react-hot-toast";

const StudentEducationPlan = () => {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Course details form
  const [form, setForm] = useState({
    targetCountry: "",
    degreeType: "",
    degreeTypeOther: "",
    courseDurationMonths: "",
    loanAmountRequested: "",
    referralCode: "",
    courseDetails: "",
    livingExpenseOption: "WITH_LIVING_EXPENSE",
  });

  // Documents state
  const [kycDocs, setKycDocs] = useState(null);
  const [academicDocs, setAcademicDocs] = useState(null);
  const [admissionDocs, setAdmissionDocs] = useState(null);
  const [workExperience, setWorkExperience] = useState([]);
  const [coBorrowers, setCoBorrowers] = useState([]);

  // Accordion states
  const [expandedSections, setExpandedSections] = useState({
    kycDocuments: true,
    academicMarksheets: true,
    securedAdmissions: false,
    workExperience: false,
    coBorrowerDocuments: false,
  });

  // Modal state
  const [previewModal, setPreviewModal] = useState({
    open: false,
    url: "",
    title: "",
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [
        planRes,
        kycRes,
        academicRes,
        admissionRes,
        workRes,
        coRes,
        profileRes,
      ] = await Promise.allSettled([
        studentEducationPlanAPI.getMyPlan(),
        kycAPI.getKYCDetails(),
        academicAPI.getRecords(),
        admissionAPI.getAdmission(),
        workExperienceAPI.getExperiences(),
        coBorrowerAPI.getAll(),
        userAPI.getProfile(),
      ]);

      // Process education plan
      if (planRes.status === "fulfilled") {
        const plan = planRes.value.data?.data;
        if (plan) {
          setForm({
            targetCountry: plan.targetCountry || "",
            degreeType: plan.degreeType || "",
            degreeTypeOther: "",
            courseDurationMonths: plan.courseDurationMonths || "",
            loanAmountRequested: plan.loanAmountRequested || "",
            referralCode: plan.referralCode || "",
            courseDetails: plan.courseDetails || "",
            livingExpenseOption:
              plan.livingExpenseOption || "WITH_LIVING_EXPENSE",
          });
        }
      }

      // Process KYC documents
      if (kycRes.status === "fulfilled") {
        setKycDocs(kycRes.value.data);
      }

      // Process academic records
      if (academicRes.status === "fulfilled") {
        setAcademicDocs(academicRes.value.data?.data || null);
      }

      // Process admission
      if (admissionRes.status === "fulfilled") {
        setAdmissionDocs(admissionRes.value.data?.data || null);
      }

      // Process work experience
      if (workRes.status === "fulfilled") {
        setWorkExperience(workRes.value.data?.data || []);
      }

      // Process co-borrowers
      if (coRes.status === "fulfilled") {
        setCoBorrowers(coRes.value.data?.data || []);
      }

      // Process profile
      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.data.data?.user || null);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, degreeType: checked ? name : "" }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (
      !form.targetCountry ||
      !form.degreeType ||
      !form.courseDurationMonths ||
      !form.courseDetails ||
      !form.loanAmountRequested
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await studentEducationPlanAPI.upsertPlan({
        targetCountry: form.targetCountry,
        degreeType: form.degreeType,
        courseDurationMonths: Number(form.courseDurationMonths) || 1,
        loanAmountRequested: Number(form.loanAmountRequested) || 0,
        courseDetails: form.courseDetails,
        livingExpenseOption: form.livingExpenseOption || "WITH_LIVING_EXPENSE",
      });
      toast.success("Course details saved successfully");
      setEditing(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save course details"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendToNBFCs = async () => {
    try {
      // Get list of NBFCs
      const nbfcsRes = await nbfcAPI.getAllForStudents();
      const nbfcs = nbfcsRes.data?.data || [];

      if (nbfcs.length === 0) {
        toast.error("No NBFCs available at the moment");
        return;
      }

      // Create loan requests to all NBFCs
      toast.loading("Sending application to NBFCs...");
      const results = await Promise.allSettled(
        nbfcs.slice(0, 3).map((nbfc) => loanRequestAPI.create(nbfc._id))
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      toast.dismiss();

      if (successful > 0) {
        toast.success(`Application sent to ${successful} NBFC(s)`);
      } else {
        toast.error("Failed to send application");
      }
    } catch (error) {
      toast.dismiss();
      toast.error(
        error.response?.data?.message || "Failed to send application"
      );
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const openPreview = (url, title) => {
    setPreviewModal({ open: true, url, title });
  };

  const closePreview = () => {
    setPreviewModal({ open: false, url: "", title: "" });
  };

  const DocumentCard = ({ label, filename, url }) => (
    <div className="space-y-1">
      <p className="text-sm text-gray-600">{label}</p>
      <div
        className={`flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg ${url ? "cursor-pointer hover:bg-gray-50" : "bg-gray-50"
          }`}
        onClick={() => url && openPreview(url, label)}
      >
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 truncate max-w-[150px]">
            {filename || "No file"}
          </span>
        </div>
        {url && <Eye className="w-4 h-4 text-gray-400" />}
      </div>
      {url && (
        <p className="text-xs text-green-500">✓ Uploaded - Click to preview</p>
      )}
    </div>
  );

  const AccordionSection = ({ title, sectionKey, children }) => (
    <div className="border-t border-gray-200">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <h3 className="font-medium text-gray-800">{title}</h3>
        {expandedSections[sectionKey] ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expandedSections[sectionKey] && <div className="pb-4">{children}</div>}
    </div>
  );

  const displayUser = profile || authUser;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen">
        <StepperExample currentStep={1} />


        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-8">

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-orange-500">
              Course Details
            </h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-1.5 border border-gray-800 text-gray-800 text-sm rounded-md hover:bg-gray-50"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Question 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. Where are you planning to study?
              </label>
              <input
                type="text"
                name="targetCountry"
                value={form.targetCountry}
                onChange={handleChange}
                disabled={!editing}
                placeholder="e.g., USA, UK, Canada, Australia"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Question 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2. Type of Degree?
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="Bachelors"
                    checked={form.degreeType === "Bachelors"}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">
                    Bachelors (only secured loan)
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="Masters"
                    checked={form.degreeType === "Masters"}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Masters</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="Others"
                    checked={form.degreeType === "Others"}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Others</span>
                </label>
              </div>
              {form.degreeType && (
                <input
                  type="text"
                  name="degreeTypeOther"
                  value={form.degreeTypeOther || form.degreeType}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Specify your degree type"
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50"
                />
              )}
            </div>

            {/* Question 3 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3. What is the duration of the course?
              </label>
              <input
                type="text"
                name="courseDurationMonths"
                value={form.courseDurationMonths}
                onChange={handleChange}
                disabled={!editing}
                placeholder="e.g., 12, 24, 36 months"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Question 4 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                4. What is the Loan amount required?
              </label>
              <input
                type="text"
                name="loanAmountRequested"
                value={form.loanAmountRequested}
                onChange={handleChange}
                disabled={!editing}
                placeholder="e.g., ₹15,00,000"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Living Expense Option */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                5. Do you need living expenses included?
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="livingExpenseOption"
                    value="WITH_LIVING_EXPENSE"
                    checked={
                      form.livingExpenseOption === "WITH_LIVING_EXPENSE"
                    }
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">
                    Yes, include living expenses
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="livingExpenseOption"
                    value="WITHOUT_LIVING_EXPENSE"
                    checked={
                      form.livingExpenseOption ===
                      "WITHOUT_LIVING_EXPENSE"
                    }
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">
                    No, tuition fee only
                  </span>
                </label>
              </div>
            </div>

            {/* Referral Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code
              </label>
              <input
                type="text"
                name="referralCode"
                value={form.referralCode}
                onChange={handleChange}
                disabled={!editing}
                placeholder="Enter referral code (optional)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Course Details Textarea */}
            <div>
              <textarea
                name="courseDetails"
                value={form.courseDetails}
                onChange={handleChange}
                disabled={!editing}
                rows={4}
                placeholder="Describe your course, university details, program specifics, and any additional information about your education plan..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 resize-none"
              />
            </div>
          </div>


          {/* Navigation Buttons */}
          <div className="flex items-center justify-end pt-4 pb-6">
            <Link to="/student/kyc">
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
      </div>

      {/* Document Preview Modal */}
      {previewModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {previewModal.title}
              </h3>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                ✕
              </button>
            </div>
            {previewModal.url.endsWith(".pdf") ? (
              <iframe
                src={previewModal.url}
                className="w-full h-[70vh]"
                title={previewModal.title}
              />
            ) : (
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-w-full max-h-[70vh] object-contain mx-auto"
              />
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentEducationPlan;
