"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
// Ensure you have your logo in public/images/logo.png or similar
import logo from "/images/homepage/logo.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  // Get dashboard route based on user role
  const getDashboardRoute = () => {
    if (!user) return "/login";
    const roleRoutes = {
      student: "/student/dashboard",
      admin: "/admin/dashboard",
      superadmin: "/admin/dashboard",
      subadmin: "/admin/dashboard",
      nbfc: "/nbfc/dashboard",
      consultant: "/consultant/dashboard",
    };
    return roleRoutes[user.role?.toLowerCase()] || "/login";
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate("/");
    setIsOpen(false);
  };

  // Add background blur when scrolling down
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", to: "/" },
    { name: "Resource", to: "/resource" },
    { name: "Special Deals", to: "/deals" },
    { name: "Our Service", to: "/service" },
    { name: "Schedule Call", to: "/schedule" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${scrolled
          ? "bg-gray-900/80 backdrop-blur-md py-2"
          : "bg-transparent py-4"
        }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-12">
        {/* 1. Logo */}
        <div className="flex shrink-0 items-center justify-center">
          <Link to="/" className="flex items-center justify-center">
            {/* Adjust width/height as needed for your specific logo file */}
            <div className="relative h-12 w-48 sm:h-16 sm:w-64">
              <img
                src={logo}
                alt="Remitout"
                className="object-cover border-black"
              />
            </div>
          </Link>
        </div>

        {/* 2. Desktop Links */}
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.to}
              className="text-sm font-medium text-gray-200 transition-colors hover:text-white"
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* 3. Desktop Buttons - Different for authenticated vs guest users */}
        <div className="hidden items-center gap-4 lg:flex">
          {isAuthenticated ? (
            <>
              {/* Dashboard Button */}
              <Link
                to={getDashboardRoute()}
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-2 text-sm font-bold text-gray-900 transition-all hover:bg-gray-100"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-red-600"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg bg-white px-6 py-2 text-sm font-bold text-gray-900 transition-hover hover:bg-gray-100"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-orange-500 px-6 py-2 text-sm font-bold text-white transition-hover hover:bg-orange-600"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* 4. Mobile Toggle */}
        <div className="flex lg:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white transition-transform hover:scale-110"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* 5. Mobile Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-gray-900/95 px-6 py-6 shadow-xl backdrop-blur-xl lg:hidden">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className="text-base font-medium text-gray-200 hover:text-white"
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
              {isAuthenticated ? (
                <>
                  {/* Mobile Dashboard Button */}
                  <Link
                    to={getDashboardRoute()}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-gray-900"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                  {/* Mobile Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-red-500 px-4 py-3 text-sm font-bold text-white"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-gray-900"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsOpen(false)}
                    className="w-full rounded-lg bg-orange-500 px-4 py-3 text-center text-sm font-bold text-white"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
