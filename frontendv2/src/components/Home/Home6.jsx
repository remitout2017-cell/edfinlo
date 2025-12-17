
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How can I apply for a loan with Remitout?",
    answer:
      "You can start your application online by visiting our loan application page and sharing a few basic details. Once submitted, our team reviews your request and contacts you with the next steps.",
  },
  {
    question: "What are the eligibility criteria for a loan?",
    answer:
      "Eligibility is based on factors like your income, documents, and repayment capacity. Exact criteria can vary by loan amount and partner.",
  },
  {
    question: "How long does the loan approval process take?",
    answer:
      "In most cases, you receive an update within a few business days once all documents are submitted and verified.",
  },
  {
    question: "What documents are required to apply for a loan?",
    answer:
      "Typically you need identity proof, address proof, income documents, and your academic or admission details if applying for an education loan.",
  },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="min-h-screen relative overflow-hidden bg-[#fdf8ff] py-24 lg:py-32 flex items-center">
      {/* soft abstract background blobs - scaled bigger */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-56 top-[-8rem] h-96 w-96 rounded-full bg-[#f4e4ff] opacity-80 blur-3xl lg:h-[28rem] lg:w-[28rem]" />
        <div className="absolute -right-56 bottom-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[#ffe4d6] opacity-80 blur-3xl lg:h-96 lg:w-96" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 lg:px-8 w-full flex flex-col items-center justify-center flex-1">
        <h2 className="text-center text-3xl font-bold text-slate-900 mb-12 lg:text-5xl lg:mb-16 leading-tight">
          Frequently asked questions
        </h2>

        <div className="w-full max-w-4xl lg:max-w-5xl rounded-3xl bg-white shadow-[0_35px_80px_rgba(15,23,42,0.20)] ring-1 ring-slate-100/50">
          <ul className="divide-y divide-slate-100">
            {faqs.map((item, index) => {
              const isOpen = index === openIndex;

              return (
                <li key={item.question}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between px-8 py-8 lg:px-12 lg:py-10 text-left text-base lg:text-lg font-semibold text-slate-900 hover:bg-slate-50/50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="leading-relaxed">{item.question}</span>
                    <span
                      className={`ml-6 flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all duration-200 hover:bg-slate-200 ${
                        isOpen ? "rotate-180 shadow-md" : "shadow-sm"
                      }`}
                    >
                      <ChevronDown className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={2} />
                    </span>
                  </button>

                  <div
                    className={`overflow-hidden px-8 pr-16 lg:px-12 lg:pr-24 text-base lg:text-lg text-slate-600 transition-all duration-300 ease-out ${
                      isOpen 
                        ? "max-h-48 lg:max-h-56 py-4 pb-8 opacity-100" 
                        : "max-h-0 py-0 opacity-0"
                    }`}
                  >
                    <p className="leading-relaxed lg:leading-loose">{item.answer}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
