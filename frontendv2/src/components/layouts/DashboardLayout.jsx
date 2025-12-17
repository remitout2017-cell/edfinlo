import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../../components/common/NotificationBell";
import { ChevronDown, Menu, X } from "lucide-react";

const DashboardLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getNavigationItems = () => {
    const role = user?.role?.toLowerCase();

    switch (role) {
      case "student":
        return [
          { name: "KYC", href: "/student/kyc" },
          { name: "Academic Records", href: "/student/academic-records" },
          { name: "Work Experience", href: "/student/work-experience" },
          { name: "Co-Borrower", href: "/student/co-borrower" },
          { name: "Admission Letter", href: "/student/admission" },
          { name: "Dashboard", href: "/student/dashboard" },
          { name: "Profile", href: "/student/profile" },
          { name: "My Application", href: "/student/education-plan" },
          { name: "Loan Request", href: "/student/loan-request" },
          { name: "Loan Analysis", href: "/student/loan-analysis" },
        ];

      case "nbfc":
        return [
          { name: "Dashboard", href: "/nbfc/dashboard" },
          { name: "Loan Requests", href: "/nbfc/requests" },
          { name: "Profile", href: "/nbfc/profile" },
        ];

      case "admin":
      case "superadmin":
      case "subadmin":
        return [
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Students", href: "/admin/students" },
          { name: "NBFCs", href: "/admin/nbfcs" },
          ...(role === "superadmin"
            ? [{ name: "Sub-Admins", href: "/admin/sub-admins" }]
            : []),
        ];

      case "consultant":
        return [
          { name: "Dashboard", href: "/consultant/dashboard" },
          { name: "My Students", href: "/consultant/students" },
          { name: "Invite Students", href: "/consultant/invite" },
        ];

      default:
        return [];
    }
  };

  const navigation = getNavigationItems();

  const isActive = (href) => {
    if (!href) return false;
    return (
      location.pathname === href || location.pathname.startsWith(href + "/")
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Close button */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <span className="text-lg font-semibold text-gray-800">Menu</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* User info in sidebar */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName || user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role || ""}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content - Full width */}
      <div className="flex flex-col min-h-screen">
        {/* Top bar - Full width, no margin */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="h-16 px-6 flex items-center justify-between">
            {/* Left side - Menu button and Logo */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 transform rotate-45 flex items-center justify-center">
                  <div className="w-6 h-6 bg-white transform -rotate-45"></div>
                </div>
                <span className="text-xl font-bold text-gray-800">
                  REMITOUT
                </span>
              </div>
            </div>

            {/* Right side - Notification Bell and User Profile */}
            <div className="flex items-center gap-4">
              <NotificationBell />

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium text-sm">
                    {(
                      user?.firstName?.[0] ||
                      user?.name?.[0] ||
                      "U"
                    ).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900 hidden sm:block">
                    {user?.firstName || user?.name || "User"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.firstName || user?.name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 capitalize mt-1">
                          {user?.role || ""}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content - Full width, no margin */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
