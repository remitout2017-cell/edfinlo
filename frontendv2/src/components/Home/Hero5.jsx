
import { User, Building2, Flag, Smile } from "lucide-react";

// swap this with your actual PNG of the girl + suitcase (with transparent background)
import travelerImg from "/images/homepage/travelingstudent.png";

const stats = [
  { value: "500+", label: "Students", icon: User },
  { value: "100", label: "NBFCs", icon: Building2 },
  { value: "40+", label: "Countries", icon: Flag },
  { value: "2k+", label: "Happy customers", icon: Smile },
];

const GlobalTransfersSection = () => {
  return (
    <section className="relative h-[135vh] lg:h-[70vh] bg-[#1a1528] text-white">
      {/* main content */}
      <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-24 md:pt-16 md:pb-32 lg:px-8 h-full">
        {/* Grid wrapper for responsive columns + heights */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12 lg:min-h-[170vh] h-fit">
          {/* IMAGE COLUMN (bottom on mobile, top-left 100vh on desktop) */}
          <div className="order-2 lg:order-1 relative flex justify-center lg:justify-start lg:h-[100vh]">
            <div className="relative w-full max-w-md mx-auto lg:max-w-lg lg:w-auto">
              {/* traveler image */}
              <div className="relative z-10">
                <img
                  src={travelerImg}
                  alt="Student traveler sitting on suitcase"
                  className="h-auto w-full w-auto object-contain mx-auto lg:mx-0 lg:h-[86vh] lg:w-auto lg:max-w-none"
                />
              </div>
            </div>
          </div>

          {/* TEXT + STATS COLUMN (top on mobile, right side bottom 70vh on desktop) */}
          <div className="order-1 lg:order-2 lg:h-[70vh]">
            <div className="max-w-xl mx-auto lg:mx-0">
              <h2 className="text-2xl font-extrabold leading-tight md:text-3xl lg:text-[2.5rem] lg:leading-[1.15]">
                <span className="text-[#ff8a29]">
                  Effortless and affordable
                </span>
                <br />
                <span className="text-[#ff8a29]">global transfers!</span>
              </h2>

              <p className="mt-5 text-sm leading-relaxed text-gray-300 md:text-[15px] md:leading-7">
                Support loved ones abroad by sending money from India for
                education and expenses. Transfer to 40+ countries with real
                exchange rates, no hidden fees. Sign up easily online with your
                PAN and address.
              </p>
            </div>

            {/* stats grid - 2x2 on mobile, 4 columns on desktop */}
            <div className="mt-10 grid grid-cols-2 gap-4 max-w-xl mx-auto lg:mx-0 lg:grid-cols-4 lg:max-w-none">
              {stats.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.label} className="flex flex-col items-center">
                    {/* icon above card */}
                    <div className="mb-3 flex items-center justify-center">
                      <IconComponent
                        className="h-5 w-5 text-gray-500/40 md:h-6 md:w-6"
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="w-full rounded-xl border border-[#3d3650] bg-[#2a2438]/90 px-4 py-4 text-center backdrop-blur-sm">
                      <div className="text-xl font-extrabold text-[#ff8a29] md:text-2xl">
                        {item.value}
                      </div>
                      <div className="mt-1 text-[11px] font-medium tracking-wide text-gray-300 md:text-xs">
                        {item.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GlobalTransfersSection;
