// src/layouts/ConsultantLayout.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import {
  LayoutDashboard,
  User,
  FileText, 
  LogOut,
  Menu,
  X,
  Shield,
  Headphones
} from 'lucide-react';

const ConsultantLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/consultant/dashboard', icon: LayoutDashboard },
    { name: 'Profile', href: '/consultant/profile', icon: User },
    { name: 'Student Applications Status', href: '/consultant/students', icon: FileText },
    { name: 'Support', href: '/consultant/support', icon: Headphones },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
        border-r border-gray-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        backdrop-blur-xl bg-white/95
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-20 px-6 bg-gradient-to-r from-green-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/30 rounded-xl backdrop-blur-sm border border-white/50">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white truncate">Consultant Portal</h1>
              <p className="text-xs text-white/90 font-medium truncate">{user?.companyName || 'Your Company'}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/90 hover:text-white p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8 px-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-medium text-sm
                  ${isActive(item.href)
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg shadow-green-500/25'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-md hover:-translate-x-1'
                  }
                `}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive(item.href) ? 'text-white' : 'text-gray-500'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 to-transparent border-t border-gray-200">
          <div className="flex items-center gap-4 mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold text-lg shadow-lg">
              {user?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Consultant'}</p>
              <p className="text-xs text-gray-600 truncate">{user?.designation || 'Senior Consultant'}</p>
              <p className="text-xs text-gray-500">{user?.experienceYears || 0}+ years exp.</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
          <div className="flex items-center justify-between h-16 px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Page title */}
            <div className="flex-1 min-w-0 hidden md:block ml-8">
              <h2 className="text-xl font-bold text-gray-900 capitalize truncate">
                {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
              </h2>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="w-px h-6 bg-gray-200 hidden sm:block" />
              <button
                onClick={() => navigate('/')}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm rounded-2xl hover:bg-gray-50 shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-gray-300"
              >
                <span>← Go to Home</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ConsultantLayout;
