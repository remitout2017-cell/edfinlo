import React, { useEffect, useState } from "react";
import {
  Globe,
  GraduationCap,
  Calendar,
  FileText,
  DollarSign,
  Wallet,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import StepperExample from "../../components/common/stepper";
import { Link } from "react-router-dom";
import axios from "axios";
// Mock API for demonstration
const studentEducationPlanAPI = {
  getMyPlan: async () => {
    return { data: { data: null } };
  },
  upsertPlan: async (payload) => {
    console.log("Saving plan:", payload);
    return { data: { success: true } };
  },
};

const StudentEducationPlan = () => {
  const [form, setForm] = useState({
    targetCountry: "",
    degreeType: "",
    courseDurationMonths: "",
    courseDetails: "",
    loanAmountRequested: "",
    livingExpenseOption: "WITH_LIVING_EXPENSE",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        "http://localhost:5000/api/students/education-plan",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(res);
      const plan = res.data?.data;
      if (plan) {
        setForm({
          targetCountry: plan.targetCountry || "",
          degreeType: plan.degreeType || "",
          courseDurationMonths: plan.courseDurationMonths || "",
          courseDetails: plan.courseDetails || "",
          loanAmountRequested: plan.loanAmountRequested || "",
          livingExpenseOption:
            plan.livingExpenseOption || "WITH_LIVING_EXPENSE",
        });
      }
    } catch (error) {
      console.error("Failed to load education plan:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      courseDurationMonths: Number(form.courseDurationMonths) || 0,
      loanAmountRequested: Number(form.loanAmountRequested) || 0,
    };

    axios
      .post("http://localhost:5000/api/students/education-plan", payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      .then(() => {
        return loadPlan();
      })
      .catch((error) => {
        console.error("Failed to save education plan:", error);
        toast.error("Failed to save education plan");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-gray-600">
          Loading education plan...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center flex-col min-h-screen">
        <StepperExample currentStep={1} />

        <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              Education Plan Details
            </h2>
            <p className="text-gray-600">
              Please provide your education plan information
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Target Country */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Globe size={20} />
                </div>
                <input
                  type="text"
                  name="targetCountry"
                  value={form.targetCountry}
                  onChange={handleChange}
                  placeholder="Target Country"
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              {/* Degree Type */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <GraduationCap size={20} />
                </div>
                <input
                  type="text"
                  name="degreeType"
                  value={form.degreeType}
                  onChange={handleChange}
                  placeholder="Degree Type (e.g. Masters in Finance)"
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              {/* Course Duration */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Calendar size={20} />
                </div>
                <input
                  type="number"
                  name="courseDurationMonths"
                  value={form.courseDurationMonths}
                  onChange={handleChange}
                  placeholder="Course Duration (months)"
                  min={1}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              {/* Loan Amount */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <DollarSign size={20} />
                </div>
                <input
                  type="number"
                  name="loanAmountRequested"
                  value={form.loanAmountRequested}
                  onChange={handleChange}
                  placeholder="Loan Amount Requested (₹)"
                  min={0}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Course Details - Full Width */}
            <div className="relative">
              <div className="absolute left-3 top-4 text-gray-400">
                <FileText size={20} />
              </div>
              <textarea
                name="courseDetails"
                value={form.courseDetails}
                onChange={handleChange}
                rows={4}
                placeholder="Course Details - Briefly describe the university, course, and why you chose it."
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition resize-none"
                required
              />
            </div>

            {/* Living Expense Option */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Wallet size={20} />
              </div>
              <select
                name="livingExpenseOption"
                value={form.livingExpenseOption}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition appearance-none bg-white"
                required
              >
                <option value="WITH_LIVING_EXPENSE">With Living Expense</option>
                <option value="WITHOUT_LIVING_EXPENSE">
                  Without Living Expense
                </option>
              </select>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <Link to="/student/kyc">
                {" "}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Link to="/student/kyc">
                      {" "}
                      <button
                        type="button"
                        disabled={saving}
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
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
                        )}
                      </button>
                    </Link>
                  )}
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

export default StudentEducationPlan;
