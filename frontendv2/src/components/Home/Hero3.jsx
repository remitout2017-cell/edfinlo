import { useEffect, useState } from "react";
import earth from "/images/homepage/earth.png";
import process from "/images/homepage/process.png";
const HeroSection = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Mobile/Smaller Screens: Exact Original Layout */}
      <div className="block lg:hidden min-h-screen w-screen bg-[#1b1525] py-4 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center px-2 ml-2 justify-center h-[50%] w-full">
          <h1 className="font-bold text-4xl text-orange-500">
            Your Smart Route to <br /> Study Loans
          </h1>
          <h3 className="text-gray-500 font-semibold text-md w-fit tracking-wider mt-4">
            Bespoke Loan Options from Trusted <br /> NBFCs Your international
            Education.
          </h3>
        </div>
        <div className="w-full p-8 space-y-10">
          {[
            {
              number: "01",
              title: "Profile Assessment",
              desc: "Our experts assess your academic and financial profile to determine the best loan options for your overseas education.",
            },
            {
              number: "02",
              title: "Get Matched With Top NBFCs",
              desc: "We connect you with multiple non-banking financial companies (NBFCs) offering competitive study loans.",
            },
            {
              number: "03",
              title: "Choose Your Loan Offers",
              desc: "Browse and compare personalized loan offers based on your eligibility and repayment preferences.",
            },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-6">
              <div className="text-orange-500 font-bold text-4xl w-16">
                {step.number}
              </div>
              <div className="flex flex-col">
                <h3 className="font-semibold text-lg text-gray-100">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="w-full h-full">
          <img
            src={earth}
            alt="earth"
            className="w-full h-full object-cover invert brightness-0 drop-shadow-[0_0_25px_#6366F1] drop-shadow-[0_0_50px_#A78BFA]"
          />
        </div>
        <div className="w-full p-8 space-y-10">
          {[
            {
              number: "04",
              title: "Submit Document With Ease",
              text: "Upload your required documents securely through our platform for a seamless process.",
            },
            {
              number: "05",
              title: "Fast-Track Approval",
              text: "Experience quick approvals with minimal delays, ensuring you stay on track for your educational goals.",
            },
            {
              number: "06",
              title: "Guaranteed Disbursement",
              text: "Once approved, your loan is disbursed directly to your institution on time, securing your admission.",
            },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-6">
              <div className="flex flex-col">
                <h3 className="font-semibold text-lg text-gray-100">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                  {step.text}
                </p>
              </div>
              <div className="text-orange-500 font-bold text-4xl w-16">
                {step.number}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Larger Monitor Screens: Empty Div (Matching BG, Full Height) */}
      <div className="hidden lg:block min-h-screen pt-4  bg-[#1b1525] flex flex-col items-center justify-center">
        <div className="flex flex-row items-center justify-around px-2 h-1/2 w-full">
          <div className="flex flex-col items-start px-2 justify-center h-fit w-1/2">
            <h1 className="font-bold text-6xl text-orange-500">
              Your Smart Route to <br /> Study Loans
            </h1>
            <h3 className="text-gray-500 font-medium text-3xl w-fit  mt-4">
              Bespoke Loan Options from Trusted <br /> NBFCs Your international
              Education.
            </h3>
          </div>
          <div className="w-1/2 h-full">
            <img
              src={earth}
              alt="earth"
              className="w-2xl h-auto mt-3 object-contain invert brightness-0 drop-shadow-[0_0_25px_#6366F1] drop-shadow-[0_0_50px_#A78BFA]"
            />
          </div>{" "}
        </div>
        <div className=" p-1  h-1/2 w-full flex items-center justify-center pb-4">
          <img
            src={process}
            alt="process"
            className="w-[80%] h-full mt-3 object-contain mx-2 "
          />
        </div>
      </div>
    </>
  );
};

export default HeroSection;
