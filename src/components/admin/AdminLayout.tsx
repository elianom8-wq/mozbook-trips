import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Users, 
  Home, 
  Compass, 
  CalendarCheck, 
  Utensils, 
  MapPin, 
  CreditCard, 
  FileCheck2, 
  LifeBuoy, 
  ScrollText, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowLeft
} from 'lucide-react';
import MozBookLogo from '../MozBookLogo';
import { useAuth } from '../../context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300 font-sans">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Checking Authorization...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {user ? (
              <>You are signed in as <strong className="text-slate-200 font-mono">{user.email}</strong>. This account does not have administrator privileges to access this area.</>
            ) : (
              <>Authentication required. Please sign in with an authorized administrator account.</>
            )}
          </p>
          <div className="space-y-3">
            {user && (
              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign out / Switch account</span>
              </button>
            )}
            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Return to MozBook Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navGroups = [
    {
      group: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, enabled: true },
      ],
    },
    {
      group: 'MANAGEMENT',
      items: [
        { label: 'Users', path: '/admin/users', icon: Users, enabled: true, badge: 'Live' },
        { label: 'Hosts', path: '/admin/hosts', icon: Home, enabled: true, badge: 'Live' },
        { label: 'Properties', path: '/admin/properties', icon: Home, enabled: true, badge: 'Live' },
        { label: 'Activities & Trips', path: '/admin/activities', icon: Compass, enabled: true, badge: 'Live' },
        { label: 'Bookings', path: '/admin/bookings', icon: CalendarCheck, enabled: true, badge: 'Live' },
        { label: 'Eateries', path: '#eateries', icon: Utensils, enabled: false },
      ],
    },
    {
      group: 'DISCOVERY',
      items: [
        { label: 'Discovery', path: '#discovery', icon: MapPin, enabled: false },
      ],
    },
    {
      group: 'FINANCE',
      items: [
        { label: 'Financials', path: '/admin/financials', icon: CreditCard, enabled: true, badge: 'Live' },
      ],
    },
    {
      group: 'COMPLIANCE',
      items: [
        { 
          label: 'Verification & Compliance', 
          path: '/admin/verifications', 
          icon: FileCheck2, 
          enabled: true,
          badge: 'Live'
        },
        { 
          label: 'Legal & Contracts', 
          path: '/admin/legal', 
          icon: ScrollText, 
          enabled: true,
          badge: '28A'
        },
      ],
    },
    {
      group: 'OPERATIONS',
      items: [
        { label: 'Support / Issues', path: '#support', icon: LifeBuoy, enabled: false },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { label: 'Audit Logs', path: '/admin/dashboard#audit-logs', icon: ScrollText, enabled: true },
        { label: 'System Settings', path: '#settings', icon: Settings, enabled: false },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <MozBookLogo variant="compact" size="sm" theme="dark" preferVector />
            </Link>
            <div className="h-5 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tracking-wider uppercase font-bold text-slate-100 hidden sm:inline">
                MOZBOOK OPERATIONS CONSOLE
              </span>
              <span className="font-mono text-xs tracking-wider uppercase font-bold text-slate-100 sm:hidden">
                OPERATIONS CONSOLE
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} />
                Admin
              </span>
            </div>
          </div>
        </div>

        {/* Right Admin User & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">
              {user?.displayName || 'Administrator'}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {user?.email || 'Administrator'}
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs border border-emerald-400/40">
            A
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700 hover:border-rose-700/50 transition-colors cursor-pointer"
            title="Secure Logout"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-64 bg-slate-950/80 border-r border-slate-800 flex-shrink-0 hidden lg:flex flex-col justify-between overflow-y-auto">
          <div className="p-4 space-y-6">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <span className="text-[10px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3">
                  {group.group}
                </span>

                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    if (!item.enabled) {
                      return (
                        <div
                          key={item.label}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-600 cursor-not-allowed select-none"
                          title="Module coming in later phase"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} className="text-slate-700" />
                            <span>{item.label}</span>
                          </div>
                              <span className="text-[9px] bg-slate-900 text-slate-500 border border-slate-800/80 px-1.5 py-0.5 rounded font-mono">
                                Coming Soon
                              </span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                          <span>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Sidebar Notice */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950">
            <Link
              to="/"
              className="flex items-center justify-between text-xs text-slate-400 hover:text-emerald-400 font-medium py-1 transition-colors"
            >
              <span>Back to Public MozBook</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
              onClick={() => setMobileMenuOpen(false)} 
            />
            <div className="relative w-72 bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between z-10 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-mono text-xs font-bold text-slate-400">NAVIGATION</span>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                {navGroups.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <span className="text-[10px] font-bold tracking-wider font-mono text-slate-500 uppercase px-3">
                      {group.group}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        if (!item.enabled) {
                          return (
                            <div
                              key={item.label}
                              className="flex items-center justify-between px-3 py-2 text-xs text-slate-600"
                            >
                              <div className="flex items-center gap-2">
                                <Icon size={16} />
                                <span>{item.label}</span>
                              </div>
                              <span className="text-[9px] bg-slate-900 text-slate-500 border border-slate-800/80 px-1.5 py-0.5 rounded font-mono">Coming Soon</span>
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={item.label}
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={16} />
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-slate-900 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
