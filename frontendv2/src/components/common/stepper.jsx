import React from "react";

const Stepper = ({ currentStep = 1, steps = [] }) => {
  const defaultSteps = [
    { id: 1, title: "Personal Info", label: "01" },
    { id: 2, title: "KYC", label: "02" },
    { id: 3, title: "Academic", label: "03" },
    { id: 4, title: "Education", label: "04" },
    { id: 5, title: "Work Experience", label: "05" },
    { id: 6, title: "Co-borrower", label: "06" },
    { id: 7, title: "Admission", label: "07" },
    { id: 8, title: "Analysis", label: "08" },
    { id: 9, title: "NbFC Matches", label: "09" },
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
    <div className="w-full">
      {/* ----------------- DESKTOP VIEW (Titles) ----------------- */}
      <div className="hidden md:flex items-center justify-start filter drop-shadow-lg w-full">
        {stepsList.map((step, index) => (
          <div
            key={step.id}
            className="flex-1 min-w-0 relative"
            style={{
              marginLeft: index === 0 ? "0" : `-${DESKTOP_ARROW}px`,
              zIndex: stepsList.length - index,
            }}
          >
            <div
              className={`
                relative h-14 flex items-center justify-center
                transition-all duration-300
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

              <span className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                {step.title}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ----------------- MOBILE VIEW (Numbers Only) ----------------- */}
      <div className="flex md:hidden items-center justify-between filter drop-shadow-md w-full overflow-x-auto pb-2">
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
            <div
              className={`
                relative h-10 flex items-center justify-center
                transition-all duration-300
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
          </div>
        ))}
      </div>

      {/* Mobile Current Step Title */}
      <div className="md:hidden mt-4 text-center">
        <span className="text-sm font-medium text-gray-400">
          Step {currentStep}:{" "}
          <span className="text-orange-400 font-bold">
            {stepsList[currentStep - 1]?.title}
          </span>
        </span>
      </div>
    </div>
  );
};

// --- Example Wrapper - NOW ACCEPTS currentStep PROP ---
const StepperExample = ({ currentStep = 1 }) => {
  const steps = [
    { id: 1, title: "Personal Info", label: "01" },
    { id: 2, title: "KYC", label: "02" },
    { id: 3, title: "Academic", label: "03" },
    { id: 4, title: "Education", label: "04" },
    { id: 5, title: "Work Experience", label: "05" },
    { id: 6, title: "Co-borrower", label: "06" },
    { id: 7, title: "Admission", label: "07" },
    { id: 8, title: "Analysis", label: "08" },
    { id: 9, title: "NbFC Matches", label: "09" },
  ];

  return <Stepper currentStep={currentStep} steps={steps} />;
};

export default StepperExample;
