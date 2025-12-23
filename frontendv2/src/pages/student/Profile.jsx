import React, { useEffect, useState } from 'react'
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
const Profile = () => {
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

        <div className="w-full p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column - My Profile */}
            <div className="w-full lg:w-80">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                {/* Profile Photo */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    {displayUser?.profilePicture ? (
                      <img
                        src={displayUser.profilePicture}
                        alt="Profile"
                        className="w-32 h-32 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-lg bg-teal-500 flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">
                          {displayUser?.firstName?.[0] || "U"}
                          {displayUser?.lastName?.[0] || ""}
                        </span>
                      </div>
                    )}
                    <button className="absolute bottom-2 right-2 p-1.5 bg-white rounded-full shadow-md">
                      <Edit2 className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    My Profile
                  </h3>
                  <Link
                    to="/student/profile"
                    className="px-3 py-1 border border-gray-300 text-sm text-gray-600 rounded-md hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                </div>

                {/* Unique ID */}
                <p className="text-xs text-gray-500 mb-4">
                  Unique ID:{" "}
                  <span className="font-medium text-gray-800">
                    {displayUser?._id?.slice(-10).toUpperCase() || "N/A"}
                  </span>
                </p>

                {/* Contact Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {displayUser?.firstName} {displayUser?.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {displayUser?.phoneNumber || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 break-all">
                      {displayUser?.email || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">
                      {displayUser?.address || "Address not provided"}
                    </span>
                  </div>
                </div>

                {/* Education */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">Education</h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    {academicDocs?.class10?.marksheetUrl && <li>10th Grade</li>}
                    {academicDocs?.class12?.marksheetUrl && <li>12th Grade</li>}
                    {academicDocs?.higherEducation?.length > 0 && (
                      <li>Graduation</li>
                    )}
                    {!academicDocs?.class10?.marksheetUrl &&
                      !academicDocs?.class12?.marksheetUrl &&
                      !academicDocs?.higherEducation?.length && (
                        <li className="text-gray-400">No education records</li>
                      )}
                  </ol>
                </div>

                {/* Test Scores */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">
                    Test Scores
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>IELTS</li>
                    <li>GRE</li>
                    <li>TOEFL</li>
                    <li>Others</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Right Column - Course Details + Documents */}
            <div className="flex-1 space-y-6">
              {/* Course Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
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
              </div>

              {/* Attached Documents */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-xl font-semibold text-orange-500 mb-4">
                  Attached Documents
                </h2>

                {/* Student KYC Documents */}
                <div className="mb-4">
                  <h3 className="font-medium text-gray-800 mb-3">
                    Student KYC Document
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DocumentCard
                      label="Pan Card"
                      filename={
                        kycDocs?.pancardUrl ? "pan_card.jpg" : "No file"
                      }
                      url={kycDocs?.pancardUrl}
                    />
                    <DocumentCard
                      label="Aadhar Card"
                      filename={
                        kycDocs?.aadhaarUrl ? "aadhar_card.jpg" : "No file"
                      }
                      url={kycDocs?.aadhaarUrl}
                    />
                  </div>
                  <div className="mt-4">
                    <DocumentCard
                      label="Passport"
                      filename={
                        kycDocs?.passportUrl ? "Passport.pdf" : "No file"
                      }
                      url={kycDocs?.passportUrl}
                      size="470 MB uploaded"
                    />
                  </div>
                </div>

                {/* Academic Marksheets */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h3 className="font-medium text-gray-800 mb-3">
                    Academic Marksheets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DocumentCard
                      label="10th grade marksheet"
                      filename={
                        academicDocs?.class10?.marksheetUrl
                          ? "10th grade marksheet"
                          : "No file"
                      }
                      url={academicDocs?.class10?.marksheetUrl}
                    />
                    <DocumentCard
                      label="12th grade marksheet"
                      filename={
                        academicDocs?.class12?.marksheetUrl
                          ? "12th grade marksheet"
                          : "No file"
                      }
                      url={academicDocs?.class12?.marksheetUrl}
                    />
                  </div>
                  <div className="mt-4">
                    <DocumentCard
                      label="Graduation marksheet"
                      filename={
                        academicDocs?.higherEducation?.[0]?.marksheetUrl
                          ? "Graduation Marksheet"
                          : "No file"
                      }
                      url={academicDocs?.higherEducation?.[0]?.marksheetUrl}
                      size="470 MB uploaded"
                    />
                  </div>
                </div>

                {/* Collapsible Sections */}
                <AccordionSection
                  title="Secured Admissions"
                  sectionKey="securedAdmissions"
                >
                  {admissionDocs ? (
                    <DocumentCard
                      label="Admission Letter"
                      filename="admission_letter.pdf"
                      url={admissionDocs.admissionLetterUrl}
                    />
                  ) : (
                    <p className="text-sm text-gray-500">
                      No admission documents uploaded
                    </p>
                  )}
                </AccordionSection>

                <AccordionSection
                  title="Work Experience"
                  sectionKey="workExperience"
                >
                  {workExperience.length > 0 ? (
                    <div className="space-y-2">
                      {workExperience.map((exp, idx) => (
                        <DocumentCard
                          key={idx}
                          label={`Experience ${idx + 1}`}
                          filename={
                            exp.documentUrl
                              ? `experience_${idx + 1}.pdf`
                              : "No file"
                          }
                          url={exp.documentUrl}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No work experience documents uploaded
                    </p>
                  )}
                </AccordionSection>

                <AccordionSection
                  title="Co-borrower Documents"
                  sectionKey="coBorrowerDocuments"
                >
                  {coBorrowers.length > 0 ? (
                    <div className="space-y-2">
                      {coBorrowers.map((cb, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4">
                          <DocumentCard
                            label={`Co-borrower ${idx + 1} - PAN`}
                            filename={
                              cb.panCardUrl ? "pan_card.pdf" : "No file"
                            }
                            url={cb.panCardUrl}
                          />
                          <DocumentCard
                            label={`Co-borrower ${idx + 1} - Aadhaar`}
                            filename={
                              cb.aadhaarCardUrl ? "aadhaar.pdf" : "No file"
                            }
                            url={cb.aadhaarCardUrl}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No co-borrower documents uploaded
                    </p>
                  )}
                </AccordionSection>

                {/* Pagination + Send Email Button */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      className="p-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      className="p-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleSendToNBFCs}
                    className="px-4 py-2 border border-purple-600 text-purple-600 text-sm rounded-md hover:bg-purple-50"
                  >
                    Send Email to NBFCs
                  </button>
                </div>
              </div>
            </div>
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
}

export default Profile