import React, { useEffect, useState } from "react";
import {
  BookOpen,
  GraduationCap,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { academicAPI } from "../../services/api";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

const AcademicRecords = () => {
  const [academicData, setAcademicData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [uploading10, setUploading10] = useState(false);
  const [uploading12, setUploading12] = useState(false);
  const [uploadingGrad, setUploadingGrad] = useState(false);

  const [class10File, setClass10File] = useState(null);
  const [class12File, setClass12File] = useState(null);
  const [class12Stream, setClass12Stream] = useState("");

  const [gradForm, setGradForm] = useState({
    educationType: "",
    courseName: "",
    specialization: "",
    duration: "",
  });
  const [gradFiles, setGradFiles] = useState([]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await academicAPI.getRecords();
      const record = res.data?.data || res.data?.academicRecord || null;
      setAcademicData(record);
    } catch (error) {
      if (error.response?.status === 404) {
        setAcademicData(null);
      } else {
        console.error("Failed to fetch academic records:", error);
        toast.error(
          error.response?.data?.message || "Failed to fetch academic records"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const hasClass10 =
    academicData?.class10?.marksheets &&
    academicData.class10.marksheets.length > 0;

  const hasClass12 =
    academicData?.class12?.marksheets &&
    academicData.class12.marksheets.length > 0;

  const higherEducationList = academicData?.higherEducation || [];

  // ------------ Class 10 ------------
  const handleUploadClass10 = async (e) => {
    e.preventDefault();
    if (!class10File) {
      toast.error("Please select a Class 10 marksheet file");
      return;
    }

    if (
      hasClass10 &&
      !window.confirm(
        "You have already uploaded Class 10 marksheet. This will REPLACE the existing one. Continue?"
      )
    ) {
      return;
    }

    setUploading10(true);
    try {
      const formData = new FormData();
      formData.append("document", class10File);

      const res = await academicAPI.uploadClass10(formData);
      const updatedClass10 = res.data?.data?.class10;

      if (!updatedClass10) {
        throw new Error("Invalid response for Class 10 upload");
      }

      setAcademicData((prev) => ({
        ...(prev || {}),
        class10: updatedClass10,
      }));

      setClass10File(null);
      toast.success("Class 10 marksheet uploaded successfully");
    } catch (error) {
      console.error("Class 10 upload failed:", error);
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to upload Class 10 marksheet"
      );
    } finally {
      setUploading10(false);
    }
  };

  // ------------ Class 12 ------------
  const handleUploadClass12 = async (e) => {
    e.preventDefault();
    if (!class12File) {
      toast.error("Please select a Class 12 marksheet file");
      return;
    }
    if (!class12Stream) {
      toast.error("Please select your Class 12 stream");
      return;
    }

    if (
      hasClass12 &&
      !window.confirm(
        "You have already uploaded Class 12 marksheet. This will REPLACE the existing one. Continue?"
      )
    ) {
      return;
    }

    setUploading12(true);
    try {
      const formData = new FormData();
      formData.append("document", class12File);
      formData.append("stream", class12Stream);

      const res = await academicAPI.uploadClass12(formData);
      const updatedClass12 = res.data?.data?.class12;

      if (!updatedClass12) {
        throw new Error("Invalid response for Class 12 upload");
      }

      setAcademicData((prev) => ({
        ...(prev || {}),
        class12: updatedClass12,
      }));

      setClass12File(null);
      toast.success("Class 12 marksheet uploaded successfully");
    } catch (error) {
      console.error("Class 12 upload failed:", error);
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to upload Class 12 marksheet"
      );
    } finally {
      setUploading12(false);
    }
  };

  // ------------ Graduation / Higher Ed ------------
  const handleGraduationChange = (e) => {
    const { name, value } = e.target;
    setGradForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGraduationFilesChange = (e) => {
    setGradFiles(Array.from(e.target.files || []));
  };

  const handleUploadGraduation = async (e) => {
    e.preventDefault();

    if (!gradForm.educationType) {
      toast.error("Please select education type");
      return;
    }
    if (!gradForm.courseName.trim()) {
      toast.error("Course name is required");
      return;
    }
    if (!gradFiles.length) {
      toast.error("Please select at least one marksheet");
      return;
    }

    setUploadingGrad(true);
    try {
      const formData = new FormData();
      formData.append("educationType", gradForm.educationType);
      formData.append("courseName", gradForm.courseName.trim());
      if (gradForm.specialization.trim()) {
        formData.append("specialization", gradForm.specialization.trim());
      }
      if (gradForm.duration.trim()) {
        formData.append("duration", gradForm.duration.trim());
      }

      gradFiles.forEach((file) => {
        formData.append("documents", file);
      });

      const res = await academicAPI.uploadGraduation(formData);
      const newEdu = res.data?.data?.higherEducation;

      if (!newEdu) {
        throw new Error("Invalid response for graduation upload");
      }

      setAcademicData((prev) => {
        const prevList = prev?.higherEducation || [];
        const filtered = prevList.filter(
          (edu) =>
            !(
              edu.educationType === newEdu.educationType &&
              (edu.courseName || "").toLowerCase() ===
                (newEdu.courseName || "").toLowerCase()
            )
        );
        return {
          ...(prev || {}),
          higherEducation: [...filtered, newEdu],
        };
      });

      setGradForm({
        educationType: "",
        courseName: "",
        specialization: "",
        duration: "",
      });
      setGradFiles([]);
      toast.success("Graduation / higher-education documents uploaded");
    } catch (error) {
      console.error("Graduation upload failed:", error);
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to upload graduation documents"
      );
    } finally {
      setUploadingGrad(false);
    }
  };

  const handleDeleteHigherEducation = async (educationId) => {
    if (
      !window.confirm(
        "This will delete the selected higher-education record and its documents. Continue?"
      )
    ) {
      return;
    }

    try {
      await academicAPI.deleteHigherEducation(educationId);
      toast.success("Higher-education record deleted");
      await fetchRecords();
    } catch (error) {
      console.error("Delete higher-education failed:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to delete higher-education record"
      );
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">
          Loading academic records...
        </div>
      </DashboardLayout>
    );
  }

  const class10Marksheet = hasClass10
    ? academicData.class10.marksheets[0]
    : null;
  const class12Marksheet = hasClass12
    ? academicData.class12.marksheets[0]
    : null;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen ">
        <StepperExample currentStep={3} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Academic Records
            </h2>
            <p className="text-gray-600">
              Upload your 10th, 12th and higher-education documents for
              verification
            </p>
          </div>

          <div className="space-y-6">
            {/* Class 10 Section */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-purple-600" size={24} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Class 10
                    </h3>
                    <p className="text-sm text-gray-600">
                      Upload your Class 10 marksheet
                    </p>
                  </div>
                </div>
                {hasClass10 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircle size={14} className="mr-1" />
                    Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200">
                    <AlertCircle size={14} className="mr-1" />
                    Pending
                  </span>
                )}
              </div>

              {hasClass10 && class10Marksheet ? (
                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Board / University
                      </p>
                      <p className="font-medium text-gray-800">
                        {class10Marksheet.boardUniversity || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Institution
                      </p>
                      <p className="font-medium text-gray-800">
                        {class10Marksheet.institutionName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Year of Passing
                      </p>
                      <p className="font-medium text-gray-800">
                        {class10Marksheet.yearOfPassing || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Percentage / CGPA
                      </p>
                      <p className="font-medium text-gray-800">
                        {class10Marksheet.percentage ??
                          class10Marksheet.cgpa ??
                          "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-3">
                      Uploaded Document
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {academicData.class10.marksheets.map((m) => (
                        <div key={m._id}>
                          <img
                            src={m.documentUrl}
                            alt="Class 10 Marksheet"
                            className="w-32 h-40 object-cover rounded-lg border border-gray-300"
                          />
                          <a
                            href={m.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-center text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            View Full
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleUploadClass10} className="space-y-4">
                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <Upload size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {hasClass10
                          ? "Re-upload Class 10 Marksheet"
                          : "Upload Class 10 Marksheet"}
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setClass10File(e.target.files[0] || null)
                        }
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>
                          {class10File ? class10File.name : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading10}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploading10
                    ? hasClass10
                      ? "Re-uploading..."
                      : "Uploading..."
                    : hasClass10
                    ? "Re-upload Class 10"
                    : "Upload Class 10"}
                </button>
              </form>
            </div>

            {/* Class 12 Section */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-purple-600" size={24} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Class 12
                    </h3>
                    <p className="text-sm text-gray-600">
                      Upload your Class 12 marksheet with stream
                    </p>
                  </div>
                </div>
                {hasClass12 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircle size={14} className="mr-1" />
                    Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200">
                    <AlertCircle size={14} className="mr-1" />
                    Pending
                  </span>
                )}
              </div>

              {hasClass12 && class12Marksheet ? (
                <div className="grid md:grid-cols-2 gap-6 mb-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Board / University
                      </p>
                      <p className="font-medium text-gray-800">
                        {class12Marksheet.boardUniversity || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Institution
                      </p>
                      <p className="font-medium text-gray-800">
                        {class12Marksheet.institutionName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Stream</p>
                      <p className="font-medium text-gray-800">
                        {academicData.class12.stream || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Year of Passing
                      </p>
                      <p className="font-medium text-gray-800">
                        {class12Marksheet.yearOfPassing || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">
                        Percentage / CGPA
                      </p>
                      <p className="font-medium text-gray-800">
                        {class12Marksheet.percentage ??
                          class12Marksheet.cgpa ??
                          "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-3">
                      Uploaded Document
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {academicData.class12.marksheets.map((m) => (
                        <div key={m._id}>
                          <img
                            src={m.documentUrl}
                            alt="Class 12 Marksheet"
                            className="w-32 h-40 object-cover rounded-lg border border-gray-300"
                          />
                          <a
                            href={m.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-center text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            View Full
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleUploadClass12} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BookOpen size={20} />
                    </div>
                    <select
                      value={class12Stream}
                      onChange={(e) => setClass12Stream(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition appearance-none bg-white"
                    >
                      <option value="">Select Stream</option>
                      <option value="Science">Science</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Arts">Arts</option>
                    </select>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-4 text-gray-400">
                      <Upload size={20} />
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                      <label className="cursor-pointer block">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {hasClass12
                            ? "Re-upload Marksheet"
                            : "Upload Marksheet"}
                        </p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) =>
                            setClass12File(e.target.files[0] || null)
                          }
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>
                            {class12File ? class12File.name : "Click to upload"}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading12}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploading12
                    ? hasClass12
                      ? "Re-uploading..."
                      : "Uploading..."
                    : hasClass12
                    ? "Re-upload Class 12"
                    : "Upload Class 12"}
                </button>
              </form>
            </div>

            {/* Higher Education Section */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-purple-600" size={24} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Graduation & Higher Education
                    </h3>
                    <p className="text-sm text-gray-600">
                      Add diploma, bachelor, master or other records
                    </p>
                  </div>
                </div>
                {higherEducationList.length > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                    {higherEducationList.length} course
                    {higherEducationList.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200">
                    No courses added
                  </span>
                )}
              </div>

              {/* Existing Higher Education Records */}
              {higherEducationList.length > 0 && (
                <div className="space-y-3 mb-6">
                  {higherEducationList.map((edu) => (
                    <div
                      key={edu._id}
                      className="border border-gray-300 rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {edu.courseName}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {edu.educationType}
                            {edu.specialization && ` · ${edu.specialization}`}
                            {edu.duration && ` · ${edu.duration}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHigherEducation(edu._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {edu.marksheets?.length > 0 && (
                        <div className="flex gap-3 flex-wrap">
                          {edu.marksheets.map((m) => (
                            <div key={m._id}>
                              <img
                                src={m.documentUrl}
                                alt={`${edu.courseName} Marksheet`}
                                className="w-28 h-36 object-cover rounded-lg border border-gray-300"
                              />
                              <a
                                href={m.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 block text-center text-xs text-purple-600 hover:text-purple-700 font-medium"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Higher Education Form */}
              <form
                onSubmit={handleUploadGraduation}
                className="space-y-4 pt-4 border-t border-gray-200"
              >
                <h4 className="text-sm font-semibold text-gray-800">
                  Add New Course
                </h4>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <GraduationCap size={20} />
                    </div>
                    <select
                      name="educationType"
                      value={gradForm.educationType}
                      onChange={handleGraduationChange}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition appearance-none bg-white"
                    >
                      <option value="">Education Type</option>
                      <option value="diploma">Diploma</option>
                      <option value="bachelor">Bachelor</option>
                      <option value="master">Master</option>
                      <option value="phd">PhD</option>
                      <option value="postgraduate_diploma">
                        Postgraduate Diploma
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    name="courseName"
                    value={gradForm.courseName}
                    onChange={handleGraduationChange}
                    placeholder="Course Name (e.g., B.Tech in CS)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  />

                  <input
                    type="text"
                    name="specialization"
                    value={gradForm.specialization}
                    onChange={handleGraduationChange}
                    placeholder="Specialization (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  />

                  <input
                    type="text"
                    name="duration"
                    value={gradForm.duration}
                    onChange={handleGraduationChange}
                    placeholder="Duration (e.g., 4 years)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-3 top-4 text-gray-400">
                    <Upload size={20} />
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 pl-11 hover:border-purple-400 transition">
                    <label className="cursor-pointer block">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Upload Marksheets (multiple files allowed)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleGraduationFilesChange}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>
                          {gradFiles.length > 0
                            ? `${gradFiles.length} file(s) selected`
                            : "Click to upload"}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploadingGrad}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploadingGrad ? "Uploading..." : "Upload Course"}
                </button>
              </form>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link to="/student/kyc">
                <button
                  type="button"
                  onClick={fetchRecords}
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

              <Link to="/student/work-experience">
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

        {/* Footer */}
        <div className="flex gap-6 mt-8 text-gray-500 text-sm">
          <button className="hover:text-gray-700 transition">Support</button>
          <button className="hover:text-gray-700 transition">Help</button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AcademicRecords;
