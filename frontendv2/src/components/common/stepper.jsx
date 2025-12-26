import React from "react";
import { Link } from "react-router-dom";

const Stepper = ({ currentStep = 1, steps = [] }) => {
  const defaultSteps = [
    { id: 1, title: "Personal Info", label: "01", path: "/student/profile" },
    { id: 2, title: "KYC", label: "02", path: "/student/kyc" },
    {
      id: 3,
      title: "Academic",
      label: "03",
      path: "/student/academic-records",
    },
    { id: 4, title: "Education", label: "04", path: "/student/education-plan" },
    {
      id: 5,
      title: "Work Experience",
      label: "05",
      path: "/student/work-experience",
    },
    { id: 6, title: "Co-borrower", label: "06", path: "/student/coborrower" },
    { id: 7, title: "Admission", label: "07", path: "/student/admission" },
    { id: 8, title: "Analysis", label: "08", path: "/student/loan-analysis" },
    {
      id: 9,
      title: "NbFC Matches",
      label: "09",
      path: "/student/loan-request",
    },
  ];

  const stepsList = steps.length > 0 ? steps : defaultSteps;

  // --- CONFIGURATION ---
  // Desktop Arrow Size
  const DESKTOP_ARROW = 30;
  // Mobile Arrow Size (slightly smaller for compactness)
  const MOBILE_ARROW = 16;

  const getStepStyles = (step) => {
    if (step.id === currentStep) {
      return "bg-orange-500/90 backdrop-blur-md border-orange-600 text-white shadow-orange-500/50";
    } else if (step.id < currentStep) {
      return "bg-purple-500/90 backdrop-blur-md border-purple-500 text-white";
    } else {
      return "bg-slate-800/80 backdrop-blur-md border-slate-700 text-gray-400";
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-purple-400 via-purple-600 to-purple-900 shadow-2xl overflow-hidden relative">
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-300/30 rounded-full blur-3xl"></div>
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-pink-300/20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-950/50 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-900/40 rounded-full blur-3xl translate-x-1/4"></div>
        {/* Diagonal stripe overlay */}
        <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
      </div>

      {/* Content Container */}
      <div className="relative pt-4 sm:pt-5 md:pt-6 lg:pt-8">
        {/* Header Section */}
        <div className="mb-3 sm:mb-4 md:mb-5 lg:mb-6">
          <h2 className="text-white text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 md:mb-2">
            Let's Get you Registered
          </h2>
          <p className="text-purple-100 text-xs sm:text-sm md:text-base">
            Let us know you better to find you the best offers and services!
          </p>
        </div>

        {/* ----------------- DESKTOP/TABLET VIEW (Titles) ----------------- */}
        <div className="hidden sm:flex items-center justify-start filter drop-shadow-lg w-full">
          {stepsList.map((step, index) => (
            <div
              key={step.id}
              className="flex-1 min-w-0 relative"
              style={{
                marginLeft: index === 0 ? "0" : `-${DESKTOP_ARROW}px`,
                zIndex: stepsList.length - index,
              }}
            >
              <Link to={step.path || "#"} className="block">
                <div
                  className={`
                  relative h-10 sm:h-11 md:h-12 lg:h-14 flex items-center justify-center
                  transition-all duration-300 cursor-pointer hover:opacity-90
                  ${getStepStyles(step)}
                `}
                  style={{
                    clipPath:
                      index === 0
                        ? `polygon(0% 0%, calc(100% - ${DESKTOP_ARROW}px) 0%, 100% 50%, calc(100% - ${DESKTOP_ARROW}px) 100%, 0% 100%)`
                        : `polygon(0% 0%, calc(100% - ${DESKTOP_ARROW}px) 0%, 100% 50%, calc(100% - ${DESKTOP_ARROW}px) 100%, 0% 100%, ${DESKTOP_ARROW}px 50%)`,

                    paddingLeft:
                      index === 0 ? "1rem" : `calc(1rem + ${DESKTOP_ARROW}px)`,
                    paddingRight: "1rem",
                  }}
                >
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

                  <span className="text-xs sm:text-xs md:text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                    {step.title}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* ----------------- MOBILE VIEW (Numbers Only) ----------------- */}
        <div className="flex sm:hidden items-center justify-between filter drop-shadow-md w-full overflow-x-auto">
          {stepsList.map((step, index) => (
            <div
              key={step.id}
              className="relative flex-shrink-0"
              style={{
                width: `calc((100% / ${stepsList.length}) + ${MOBILE_ARROW}px)`,
                marginLeft: index === 0 ? "0" : `-${MOBILE_ARROW}px`,
                zIndex: stepsList.length - index,
              }}
            >
              <Link to={step.path || "#"} className="block">
                <div
                  className={`
                  relative h-8 flex items-center justify-center
                  transition-all duration-300 cursor-pointer hover:opacity-90
                  ${getStepStyles(step)}
                `}
                  style={{
                    clipPath:
                      index === 0
                        ? `polygon(0% 0%, calc(100% - ${MOBILE_ARROW}px) 0%, 100% 50%, calc(100% - ${MOBILE_ARROW}px) 100%, 0% 100%)`
                        : `polygon(0% 0%, calc(100% - ${MOBILE_ARROW}px) 0%, 100% 50%, calc(100% - ${MOBILE_ARROW}px) 100%, 0% 100%, ${MOBILE_ARROW}px 50%)`,

                    paddingLeft: index === 0 ? "0" : `${MOBILE_ARROW}px`,
                  }}
                >
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

                  <span className="text-xs font-bold">{step.label}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Example Wrapper - NOW ACCEPTS currentStep PROP ---
const StepperExample = ({ currentStep = 1 }) => {
  const steps = [
    { id: 1, title: "Education", label: "01", path: "/student/education-plan" },
    { id: 2, title: "KYC", label: "02", path: "/student/kyc" },
    {
      id: 3,
      title: "Academic",
      label: "03",
      path: "/student/academic-records",
    },
    { id: 4, title: "Test Scores", label: "04", path: "/student/test-scores" },
    {
      id: 5,
      title: "Work Experience",
      label: "05",
      path: "/student/work-experience",
    },
    { id: 6, title: "Co-borrower", label: "06", path: "/student/co-borrower" },
    { id: 7, title: "Admission", label: "07", path: "/student/admission" },
    { id: 8, title: "Analysis", label: "08", path: "/student/loan-analysis" },
    {
      id: 9,
      title: "NbFC Matches",
      label: "09",
      path: "/student/loan-request",
    },
  ];

  return <Stepper currentStep={currentStep} steps={steps} />;
};

export default StepperExample;
