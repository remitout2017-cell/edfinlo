
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import mark from "/images/homepage/mark.png";
import bajaj from "/images/homepage/bajaj.png";
import chola from "/images/homepage/chola.png";
import finance from "/images/homepage/finance.png";
import tata from "/images/homepage/tata.png";
import ghairam from "/images/homepage/ghairam.png";
// --- Data ---
const testimonials = [
  {
    id: 1,
    name: "Mark Debrovski",
    designation: "CEO, FinTech Global",
    image: mark ,
    text: "The loan process was incredibly smooth. I expected hurdles, but Remitout made it seamless. Highly recommended for any student abroad.",
  },
  {
    id: 2,
    name: "Sarah Jenkins",
    designation: "Student, Oxford Univ",
    image:  mark ,
    text: "Transparent fees and fast transfers. It saved me so much anxiety during my first semester tuition payment. Truly a lifesaver.",
  },
  {
    id: 3,
    name: "Rahul Sharma",
    designation: "MS Student, Berlin",
    image: mark ,
    text: "I love the dashboard! Tracking my loan disbursement in real-time gave me peace of mind. The support team is also very responsive.",
  },
  {
    id: 4,
    name: "Emily Chen",
    designation: "Parent",
    image: mark ,
    text: "As a parent, sending money abroad is stressful. Remitout's security features and instant notifications kept me assured throughout.",
  },
  {
    id: 5,
    name: "David Okonjo",
    designation: "Entrepreneur",
    image: mark ,
    text: "They offer the best FX rates in the market. I compared multiple vendors, but Remitout was the clear winner for business transactions.",
  },
  {
    id: 6,
    name: "Priya Patel",
    designation: "Design Student, NY",
    image:  mark ,
    text: "Fast, simple, and reliable. The mobile interface is beautiful and easy to use. I wouldn't use any other service for my education loans.",
  },
];

const partners = [
  { name: "Bajaj Finserv", src: bajaj },
  { name: "Jio Financial", src: finance },
  { name: "Shriram Finance", src: ghairam },
  { name: "Chola", src: chola },
  { name: "Tata Capital", src: tata },
];

// --- Sub-Components ---
const StarRating = () => (
  <div className="flex gap-1 text-yellow-400">
    {[...Array(5)].map((_, i) => (
      <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const Hero2 = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(2);

  // Handle responsive items to show (1 on mobile, 2 on desktop)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setItemsToShow(1);
      } else {
        setItemsToShow(2);
      }
    };
    handleResize(); // Set initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate max index based on items visible
  const maxIndex = testimonials.length - itemsToShow;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? maxIndex : prev - 1));
  };

  // Auto-slide every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 4000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <section className="relative w-full overflow-hidden bg-white py-20">
      {/* Decorative Background Blobs */}
      <div className="absolute -left-24 top-10 -z-0 h-96 w-96 rounded-full bg-orange-50 opacity-60 blur-3xl" />
      <div className="absolute -right-24 top-0 -z-0 h-96 w-96 rounded-full bg-orange-50 opacity-60 blur-3xl" />

      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col lg:flex-row lg:gap-8">
          {/* --- Left Side: Typography --- */}
          {/* Moved closer to the right by adjusting width and margins */}
          <div className="relative mb-12 flex shrink-0 flex-col justify-center lg:mb-0 lg:w-[30%] lg:pl-8">
            {/* Left Bracket */}
            <div className="absolute -left-4 top-0 hidden h-full w-12 border-y-2 border-l-2 border-orange-200 lg:block" />

            {/* Made text darker (gray-400 -> gray-500/800) and aligned right-ish relative to container */}
            <div className="pl-6 lg:pl-8">
              <h2 className="text-5xl font-bold italic leading-tight text-gray-400 lg:text-6xl">
                Hear
                <br />
                What
                <br />
                <span className="not-italic text-orange-500">They</span>
                <br />
                <span className="not-italic text-gray-800">Say</span>
              </h2>
            </div>
          </div>

          {/* --- Right Side: Carousel Window --- */}
          <div className="relative lg:w-[70%]">
            {/* Right Bracket */}
            <div className="absolute -right-4 top-0 z-0 hidden h-full w-12 border-y-2 border-r-2 border-orange-200 lg:block" />

            {/* Slider Container */}
            <div className="overflow-hidden px-2 py-4">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${
                    currentIndex * (100 / itemsToShow)
                  }%)`,
                }}
              >
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="min-w-full px-3 lg:min-w-[50%]"
                  >
                    <div className="relative h-full rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-shadow hover:shadow-xl">
                      <Quote className="mb-6 h-10 w-10 rotate-180 fill-orange-400 text-orange-400" />

                      <div className="mb-6 flex items-center gap-4">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-white">
                          <img
                            src={testimonial.image}
                            alt={testimonial.name}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {testimonial.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {testimonial.designation}
                          </p>
                          <div className="mt-1">
                            <StarRating />
                          </div>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed text-gray-600">
                        {testimonial.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls: Dots & Arrows */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 px-4 lg:justify-end">
              {/* Dots Indicator */}
              <div className="flex gap-2">
                {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2.5 rounded-full transition-all ${
                      currentIndex === idx
                        ? "w-8 bg-orange-500"
                        : "w-2.5 bg-gray-300 hover:bg-orange-300"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Arrow Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={prevSlide}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:border-orange-500 hover:text-orange-500 active:scale-95"
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  onClick={nextSlide}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-700 text-white shadow-lg transition-all hover:bg-purple-800 active:scale-95"
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- Bottom: Partner Logos --- */}
        <div className="mt-24 border-t border-gray-100 pt-12">
          <div className="flex flex-wrap items-center justify-center gap-8 transition-all duration-500 hover:grayscale-0 md:justify-between md:gap-12 lg:px-12">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="relative h-8 w-28 opacity-60 transition-opacity hover:opacity-100 sm:h-10 sm:w-36"
              >
                <img
                  src={partner.src}
                  alt={partner.name}
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero2;
