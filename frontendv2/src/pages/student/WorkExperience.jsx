import { useEffect, useState } from "react";
import {
  Briefcase,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
  FileText,
  Calendar,
  DollarSign,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { useWorkExperience } from "../../context/WorkExperienceContext";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

const WorkExperience = () => {
  // Get work experience from context
  const {
    workExperience,
    loading,
    fetchWorkExperience,
    uploadWorkExperience,
    deleteWorkExperience,
  } = useWorkExperience();

  const [uploading, setUploading] = useState(false);

  const [files, setFiles] = useState({
    experience_letters: null,
    offer_letters: null,
    relieving_letters: null,
    salary_slips: null,
    other_documents: null,
  });

  useEffect(() => {
    fetchWorkExperience();
  }, [fetchWorkExperience]);

  // No need for fetchExperiences - using context's fetchWorkExperience

  const handleFileChange = (e, field) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      // Validate file sizes
      for (let file of fileList) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("Each file should be less than 5MB");
          return;
        }
        if (
          !file.type.startsWith("image/") &&
          file.type !== "application/pdf"
        ) {
          toast.error("Only image and PDF files are allowed");
          return;
        }
      }
    }
    setFiles((prev) => ({
      ...prev,
      [field]: fileList ? Array.from(fileList) : null,
    }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!files.experience_letters || files.experience_letters.length === 0) {
      toast.error("Experience letter is required");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      // Append multiple files for each category
      if (files.experience_letters) {
        files.experience_letters.forEach((file) => {
          formData.append("experience_letters", file);
        });
      }
      if (files.offer_letters) {
        files.offer_letters.forEach((file) => {
          formData.append("offer_letters", file);
        });
      }
      if (files.relieving_letters) {
        files.relieving_letters.forEach((file) => {
          formData.append("relieving_letters", file);
        });
      }
      if (files.salary_slips) {
        files.salary_slips.forEach((file) => {
          formData.append("salary_slips", file);
        });
      }
      if (files.other_documents) {
        files.other_documents.forEach((file) => {
          formData.append("other_documents", file);
        });
      }

      // Use context function
      await uploadWorkExperience(formData);

      // Reset form
      setFiles({
        experience_letters: null,
        offer_letters: null,
        relieving_letters: null,
        salary_slips: null,
        other_documents: null,
      });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete all work experience data?")) return;

    try {
      await deleteWorkExperience();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">
          Loading work experience...
        </div>
      </DashboardLayout>
    );
  }

  const hasExperiences =
    workExperience?.workExperiences &&
    workExperience.workExperiences.length > 0;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen">
        <StepperExample currentStep={5} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Work Experience
            </h2>
            <p className="text-gray-600">
              Upload your work experience documents (Optional)
            </p>
            {hasExperiences && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200">
                  <Briefcase size={14} className="mr-1" />
                  {workExperience.totalYearsExperience || 0} year(s) experience
                </span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Existing Experiences */}
            {hasExperiences && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Your Work History
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    {workExperience.validExperiences || 0} valid experience(s)
                  </span>
                </div>

                {workExperience.workExperiences.map((exp) => (
                  <div
                    key={exp._id}
                    className="border border-gray-200 rounded-xl p-4 md:p-6 bg-gray-50"
                  >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <Briefcase
                            className="text-purple-600 mt-0.5"
                            size={20}
                          />
                          <div>
                            <h4 className="text-base md:text-lg font-semibold text-gray-900">
                              {exp.companyName}
                            </h4>
                            <p className="text-sm text-gray-700 mt-0.5">
                              {exp.jobTitle}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-xs text-blue-700 border border-blue-200">
                                {exp.employmentType || "N/A"}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-xs text-green-700 border border-green-200">
                                {exp.isPaid ? "Paid" : "Unpaid"}
                              </span>
                              {exp.currentlyWorking && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-xs text-purple-700 border border-purple-200">
                                  Currently Working
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Duration</p>
                              <p className="font-medium text-gray-800">
                                {exp.monthsWorked} months (~
                                {exp.experienceYears} years)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Period</p>
                              <p className="font-medium text-gray-800">
                                {exp.startDate &&
                                  new Date(exp.startDate).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      year: "numeric",
                                    }
                                  )}{" "}
                                -{" "}
                                {exp.currentlyWorking
                                  ? "Present"
                                  : exp.endDate
                                  ? new Date(exp.endDate).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        year: "numeric",
                                      }
                                    )
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap ${
                            exp.extractionConfidence > 0.7
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {exp.extractionConfidence > 0.7 ? (
                            <>
                              <CheckCircle size={14} className="mr-1" />
                              Verified
                            </>
                          ) : (
                            <>
                              <AlertCircle size={14} className="mr-1" />
                              Uncertain
                            </>
                          )}
                        </span>
                        <button
                          onClick={handleDelete}
                          className="inline-flex items-center px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition whitespace-nowrap"
                        >
                          <Trash2 size={14} className="mr-1" />
                          Delete All
                        </button>
                      </div>
                    </div>

                    {/* Documents Section */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <p className="text-sm font-semibold text-gray-800 mb-3">
                        Source Document
                      </p>

                      {exp.documentUrl ? (
                        <div className="flex gap-3">
                          <a
                            href={exp.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                          >
                            <FileText size={14} className="mr-2" />
                            View {exp.sourceDocumentType || "Document"}
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No document URL available
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Form */}
            <div
              className={hasExperiences ? "border-t border-gray-200 pt-6" : ""}
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {hasExperiences
                  ? "Add New Work Experience"
                  : "Upload Your First Work Experience"}
              </h3>
              {hasExperiences && (
                <p className="text-sm text-gray-600 mb-4">
                  Upload documents for another work experience
                </p>
              )}

              <UploadForm
                files={files}
                onFileChange={handleFileChange}
                onSubmit={handleUpload}
                uploading={uploading}
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link to="/student/test-scores">
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
                onClick={() => (window.location.href = "/student/co-borrower")}
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

        {/* Footer */}
        <div className="flex gap-6 mt-8 text-gray-500 text-sm">
          <button className="hover:text-gray-700 transition">Support</button>
          <button className="hover:text-gray-700 transition">Help</button>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Document Status Component
const DocumentStatus = ({ label, uploaded, count }) => (
  <div className="text-xs">
    <p className="text-gray-600 mb-1">{label}</p>
    <p className="font-medium flex items-center gap-1">
      {uploaded ? (
        <>
          <CheckCircle size={12} className="text-emerald-600" />
          <span className="text-emerald-700">
            {count ? `${count} file(s)` : "Uploaded"}
          </span>
        </>
      ) : (
        <>
          <AlertCircle size={12} className="text-gray-400" />
          <span className="text-gray-500">Missing</span>
        </>
      )}
    </p>
  </div>
);

// Document Preview Component
const DocumentPreview = ({ url, label }) => (
  <div className="w-20 sm:w-24">
    <img
      src={url}
      alt={label}
      className="w-full h-24 sm:h-28 object-cover rounded-lg border border-gray-300"
    />
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 block text-center text-[10px] sm:text-xs text-purple-600 hover:text-purple-700 font-medium truncate"
    >
      {label}
    </a>
  </div>
);

// Upload Form Component
const UploadForm = ({ files, onFileChange, onSubmit, uploading }) => {
  const FileUploadField = ({
    field,
    label,
    required = false,
    icon: Icon,
    multiple = true,
  }) => (
    <div className="relative">
      <div className="absolute left-3 top-4 text-gray-400">
        <Icon size={20} />
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
        <label className="cursor-pointer block">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple={multiple}
            onChange={(e) => onFileChange(e, field)}
            className="hidden"
          />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Upload size={16} />
            <span className="truncate">
              {files[field] && files[field].length > 0
                ? `${files[field].length} file(s) selected`
                : "Click to upload"}
            </span>
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileUploadField
          field="experience_letters"
          label="Experience Letters"
          required
          icon={FileText}
        />
        <FileUploadField
          field="offer_letters"
          label="Offer Letters"
          icon={FileText}
        />
        <FileUploadField
          field="relieving_letters"
          label="Relieving Letters"
          icon={FileText}
        />
        <FileUploadField
          field="other_documents"
          label="Other Documents"
          icon={FileText}
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <FileUploadField
          field="salary_slips"
          label="Salary Slips (Optional)"
          icon={DollarSign}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Experience letter is required. All other
          documents are optional but recommended for better verification. Each
          file should be less than 5MB.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading}
          className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
        >
          {uploading ? "Uploading..." : "Upload Work Experience"}
        </button>
      </div>
    </form>
  );
};

export default WorkExperience;
