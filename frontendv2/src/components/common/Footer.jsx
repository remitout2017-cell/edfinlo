import {Link} from "react-router-dom";
import { 
  Github, 
  Linkedin, 
  Twitter, 
  Instagram, 
  Mail, 
  Phone, 
  MapPin 
} from "lucide-react";


const Footer = () => {
  return (
    <footer className="relative bg-gradient-to-b from-[#1a1528] via-[#241c35] to-[#2a2438] backdrop-blur-xl border-t border-[#3d3650]/50 overflow-hidden">
      {/* smaller violet blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[10%] h-48 w-48 rounded-full bg-[#3d3650]/40 blur-2xl lg:h-64 lg:w-64" />
        <div className="absolute right-[-8%] bottom-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-[#ff8a29]/20 to-[#4a3f6e]/30 blur-2xl lg:h-72 lg:w-72" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-10">
          {/* Logo & Description */}
          <div className="lg:col-span-1">
            <div className="flex flex-col items-start space-y-3">
              <div className="flex items-center space-x-2 lg:space-x-3">
                <div className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl bg-gradient-to-br from-[#ff8a29] to-[#ff6b00] flex items-center justify-center shadow-xl shadow-[#ff8a29]/30">
                  <span className="text-xl lg:text-2xl font-bold text-white">R</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  Remitout
                </h3>
              </div>
              <p className="text-xs lg:text-sm text-gray-300 leading-relaxed max-w-xs">
                Effortless global transfers and loans. Secure, fast, no fees.
              </p>
            </div>
          </div>

          {/* Nav Columns - tighter */}
          <div>
            <h4 className="text-base lg:text-lg font-bold text-white mb-4 tracking-tight">Company</h4>
            <ul className="space-y-2 text-xs lg:text-sm text-gray-300 [&>li>a]:hover:text-[#ff8a29] [&>li>a]:hover:underline [&>li>a]:underline-offset-2 [&>li>a]:transition-all">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/careers">Careers</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-base lg:text-lg font-bold text-white mb-4 tracking-tight">Products</h4>
            <ul className="space-y-2 text-xs lg:text-sm text-gray-300 [&>li>a]:hover:text-[#ff8a29] [&>li>a]:hover:underline [&>li>a]:underline-offset-2 [&>li>a]:transition-all">
              <li><Link href="/loans">Loans</Link></li>
              <li><Link href="/transfers">Transfers</Link></li>
              <li><Link href="/education">Education</Link></li>
              <li><Link href="/business">Business</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-base lg:text-lg font-bold text-white mb-4 tracking-tight">Support</h4>
            <ul className="space-y-2 text-xs lg:text-sm text-gray-300 [&>li>a]:hover:text-[#ff8a29] [&>li>a]:hover:underline [&>li>a]:underline-offset-2 [&>li>a]:transition-all">
              <li><Link href="/help">Help Center</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>

        {/* Thinner divider */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-[#3d3650]/40 to-transparent" />

        {/* Bottom Row - compact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-center">
          {/* Social - smaller pads */}
          <div className="flex space-x-3 lg:space-x-4">
            {[
              [Github, "#"],
              [Linkedin, "#"],
              [Twitter, "#"],
              [Instagram, "#"]
            ].map(([Icon, href]) => (
              <Link
                key={Icon}
                href={href}
                className="group p-3 lg:p-3.5 rounded-xl bg-[#2a2438]/90 hover:bg-[#ff8a29]/10 backdrop-blur-sm shadow-lg border border-[#3d3650]/70 hover:border-[#ff8a29]/40 hover:shadow-[#ff8a29]/20 hover:scale-[1.05] transition-all duration-200"
              >
                <Icon className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400 group-hover:text-[#ff8a29]" />
              </Link>
            ))}
          </div>

          {/* Newsletter - shorter */}
          <form className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto w-full">
            <input
              type="email"
              placeholder="Your email"
              className="flex-1 px-4 py-3 rounded-xl border bg-[#2a2438]/90 border-[#3d3650] text-white placeholder-gray-400 text-xs lg:text-sm focus:border-[#ff8a29] focus:outline-none focus:ring-1 focus:ring-[#ff8a29]/40 transition-all backdrop-blur-sm"
            />
            <button
              type="submit"
              className="px-6 lg:px-7 py-3 bg-gradient-to-r from-[#ff8a29] to-[#ff6b00] hover:from-[#ff6b00] text-white font-semibold rounded-xl shadow-lg hover:shadow-[#ff8a29]/25 hover:scale-[1.02] active:scale-98 transition-all duration-200 text-xs lg:text-sm whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>

          {/* Contact - tighter */}
          <div className="flex flex-col space-y-2 text-xs lg:text-sm text-gray-300 md:justify-self-end">
            <div className="flex items-center space-x-2 lg:space-x-3 group hover:text-[#ff8a29] transition-colors">
              <Mail className="h-4 w-4 lg:h-4.5 lg:w-4.5 flex-shrink-0 text-gray-400" />
              <span>hello@remitout.com</span>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-3 group hover:text-[#ff8a29] transition-colors">
              <Phone className="h-4 w-4 lg:h-4.5 lg:w-4.5 flex-shrink-0 text-gray-400" />
              <span>+91 22-1234 5678</span>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-3 group hover:text-[#ff8a29] transition-colors">
              <MapPin className="h-4 w-4 lg:h-4.5 lg:w-4.5 flex-shrink-0 text-gray-400" />
              <span>Mumbai, India</span>
            </div>
          </div>
        </div>

        {/* Copyright - slimmer */}
        <div className="mt-10 pt-6 border-t border-[#3d3650]/40 text-center text-xs text-gray-400 md:flex md:justify-between md:items-center md:text-sm">
          <p>&copy; 2025 Remitout. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-6 mt-2 sm:mt-0">
            <Link href="/privacy" className="hover:text-[#ff8a29] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#ff8a29] transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
