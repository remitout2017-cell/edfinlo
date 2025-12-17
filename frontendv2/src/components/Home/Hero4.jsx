

// Replace these with your actual image imports
import campusImg from "/images/homepage/uplayer.png"; // Top: Radcliffe Camera
import studentsImg from "/images/homepage/middlelayer.png"; // Middle: Students with tablet
import graduationImg from "/images/homepage/lowerlayer.png"; // Bottom: Graduation hats

const SafetySmartLendingSection = () => {
  const features = [
    {
      title: "Integrated Support, Anytime, Anywhere",
      desc: "Instant support builds trust and enhances experience!",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      title: "Rapid Processing",
      desc: "Easy student remittance in just a few steps!",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      ),
    },
    {
      title: "Best Price Commitment",
      desc: "Transparent, competitive exchange rates guaranteed!",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      ),
    },
    {
      title: "Absolutely Protected",
      desc: "Instant transfers, no fees, 24/7 support!",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  return (
    <section className="relative w-full overflow-hidden bg-[#fff9f4] py-16 md:py-24">
      {/* --- Decorative Background Elements --- */}

      {/* Top-left large peach blob */}
      <div className="absolute -left-[10%] -top-[10%] h-[600px] w-[600px] rounded-full bg-[#ffe8d4] opacity-60 blur-3xl" />

      {/* Bottom-right soft pink blob */}
      <div className="absolute -right-[10%] bottom-0 h-[500px] w-[500px] rounded-full bg-[#fff0f0] opacity-80 blur-3xl" />

      {/* Blue decorative dotted line running across */}
      <div className="absolute left-0 top-[68%] z-0 w-full border-t-2 border-dotted border-[#4d6b88]/30 hidden lg:block" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          {/* === LEFT COLUMN === */}
          <div className="w-full lg:w-[45%]">
            <h2 className="mb-8 text-3xl font-extrabold leading-[1.15] text-[#0f172a] md:text-4xl lg:text-5xl">
              Where your safety meets <br /> smart lending
            </h2>

            {/* Feature Card */}
            <div className="relative rounded-3xl bg-white p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] md:p-8">
              <ul className="space-y-8">
                {features.map((item) => (
                  <li key={item.title} className="flex items-start gap-5">
                    {/* Icon Box */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff8533] text-white shadow-md shadow-orange-200">
                      {item.icon}
                    </div>
                    {/* Text */}
                    <div className="pt-1">
                      <h3 className="text-lg font-bold text-[#1e1e1e]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-10">
              <button className="rounded-lg bg-[#702bf7] px-8 py-4 text-base font-bold text-white shadow-[0_10px_25px_-5px_rgba(112,43,247,0.4)] transition-transform hover:scale-105 hover:shadow-[0_15px_30px_-5px_rgba(112,43,247,0.5)] active:scale-95">
                Secure your loan now!
              </button>
            </div>
          </div>

          {/* === RIGHT COLUMN (Collage) === */}
          <div className="relative mt-16 flex w-full justify-center lg:mt-0 lg:w-[50%]">
            <div className="relative w-full max-w-lg lg:max-w-none">
              {/* 1. Purple Dashed Circle (Behind Top Image) */}
              <div className="absolute -right-4 top-[-20px] h-32 w-32 animate-spin-slow lg:right-[10%] lg:top-[-40px]">
                <svg viewBox="0 0 100 100" className="h-full w-full rotate-12">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="#702bf7"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 8"
                  />
                </svg>
              </div>

              {/* 2. Top Image: Radcliffe Camera */}
              <div className="relative z-10 ml-auto w-[75%] overflow-hidden rounded-t-[2.5rem] rounded-bl-[2.5rem] shadow-2xl">
                <img
                  src={campusImg}
                  alt="Radcliffe Camera"
                  className="h-auto w-full object-cover"
                />
              </div>

              {/* 3. Middle Image: Students (Overlapping) */}
              <div className="absolute left-0 top-[180px] z-20 w-[55%] overflow-hidden rounded-3xl border-4 border-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] lg:top-[220px]">
                <img
                  src={studentsImg}
                  alt="Students with tablet"
                  className="h-auto w-full object-cover"
                />
              </div>

              {/* 4. Bottom Image: Graduation (Below) */}
              <div className="relative z-0 ml-auto mt-[-40px] w-[75%] overflow-hidden rounded-b-[2.5rem] rounded-tr-[2.5rem] pt-24 shadow-xl lg:mt-[-60px]">
                {/* Note: pt-24 creates space for the overlap so we don't hide heads */}
                <div className="relative overflow-hidden rounded-3xl">
                  <img
                    src={graduationImg}
                    alt="Graduation"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SafetySmartLendingSection;
