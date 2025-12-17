import { Link } from "react-router-dom";
import { Briefcase, PlayCircle } from "lucide-react";
// Make sure to install lucide-react: npm install lucide-react
import home1bg from "/images/homepage/home1bg.png";
const Hero = () => {
  return (
    <section
      style={{
        backgroundImage: "url(/images/homepage/home1bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      className="relative flex min-h-screen w-full items-center bg-purple-900/60  mix-blend-multiply justify-center overflow-hidden pt-20"
    >
      {/* 2. Purple/Dark Overlay */}
      {/* This creates the 'purplish' dark tint seen in the design */}
      {/* <div className="absolute inset-0 -z-10 bg-purple-900/60 mix-blend-multiply" />
      <div className="absolute inset-0 -z-10 bg-black/40" /> */}

      {/* 3. Content Container */}
      <div className="container mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2 md:px-12">
        {/* Left Side: Main Text */}
        <div className="flex flex-col items-start text-left">
          <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            <span className="text-orange-500">Secure Fast,</span>
            <br />
            <span className="text-orange-500">Simple</span> Loans
            <br />
            for a Brighter
            <br />
            Future.
          </h1>
        </div>

        {/* Right Side: Tagline & Subtext & Buttons */}
        <div className="flex flex-col items-start justify-center space-y-8 md:pl-10 lg:pl-16">
          {/* Floating Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            <Briefcase size={16} className="text-white" />
            <span>Fuel Your Global Journey</span>
          </div>

          {/* Description */}
          <p className="max-w-md text-lg leading-relaxed text-gray-200">
            Trusted by 15,000+ students across India, Remitout is your partner
            in securing the financial support you need to succeed in your
            studies.
          </p>

          {/* Hero Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Purple Button */}
            <Link
              href="/loan"
              className="rounded-lg bg-purple-600 px-8 py-4 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-purple-700"
            >
              Secure your loan now!
            </Link>

            {/* Glass/Outline Button */}
            <button className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20">
              <PlayCircle size={20} />
              <span>Watch Demo</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
