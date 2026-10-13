import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Globe, Menu, User, LogOut, Sliders, X, ShieldCheck, FileCheck2, Luggage, Sparkles, Building2, MessageCircle } from 'lucide-react';
import { subscribeToUnreadCount } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import MozBookLogo from './MozBookLogo';
import AppSettingsModal from './AppSettingsModal';

export default function Navbar() {
  const { user, isAdmin, login, logout } = useAuth();
  const { filters, totalGuests, isSearchActive, openSearchTab, clearFilters } = useSearch();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const unsubscribe = subscribeToUnreadCount(
      user.uid,
      user.displayName || 'MozBook User',
      (count) => {
        setUnreadCount(count);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Click-outside and keyboard escape dismiss
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const isDiscoverActive = location.pathname === '/discover';

  // Formatted labels for the capsule
  const destinationDisplay = filters.destination.trim() || 'Anywhere';
  const dateDisplay = filters.datePreset || (
    filters.checkIn && filters.checkOut
      ? `${filters.checkIn.slice(5)} – ${filters.checkOut.slice(5)}`
      : filters.checkIn
      ? `From ${filters.checkIn.slice(5)}`
      : 'Any week'
  );
  const guestsDisplay = totalGuests > 0 ? `${totalGuests} guest${totalGuests > 1 ? 's' : ''}` : 'Add guests';

  return (
    <nav className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 px-3 md:px-8 py-2.5 md:py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand Logo: Compact on mobile/tablet to avoid taking up too much room, full on desktop */}
        <Link to="/" className="flex items-center hover:opacity-90 transition-opacity shrink-0">
          <span className="hidden sm:inline">
            <MozBookLogo variant="full" size="md" />
          </span>
          <span className="inline sm:hidden">
            <MozBookLogo variant="compact" size="sm" />
          </span>
        </Link>

        {/* Desktop Interactive Search Bar */}
        <div 
          onClick={() => openSearchTab('where')}
          className="hidden md:flex items-center border border-gray-300 rounded-full py-1.5 px-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer gap-1 group bg-white hover:border-gray-400"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSearchTab('where');
            }}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              filters.destination.trim() ? 'font-bold text-[#009A60]' : 'font-semibold text-gray-800'
            } hover:bg-gray-100 cursor-pointer`}
          >
            {destinationDisplay}
          </button>
          
          <span className="h-4 w-px bg-gray-300"></span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSearchTab('when');
            }}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              filters.datePreset || filters.checkIn ? 'font-bold text-[#009A60]' : 'font-semibold text-gray-800'
            } hover:bg-gray-100 cursor-pointer`}
          >
            {dateDisplay}
          </button>

          <span className="h-4 w-px bg-gray-300"></span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSearchTab('who');
            }}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              totalGuests > 0 ? 'font-bold text-[#009A60]' : 'text-gray-500 font-medium'
            } hover:bg-gray-100 cursor-pointer`}
          >
            {guestsDisplay}
          </button>

          {isSearchActive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              title="Clear search filters"
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 ml-1 cursor-pointer transition-colors"
            >
              <X size={15} />
            </button>
          )}

          <div 
            onClick={(e) => {
              e.stopPropagation();
              openSearchTab('where');
            }}
            className="bg-[#009A60] p-2 rounded-full text-white hover:bg-[#008250] transition-colors ml-1 shadow-xs group-hover:scale-105"
          >
            <Search size={15} strokeWidth={2.5} />
          </div>
        </div>

        {/* Mobile & Tablet Compact Search Button - Expanded and prioritized */}
        <button
          type="button"
          onClick={() => openSearchTab('where')}
          className="flex md:hidden items-center border border-gray-300 rounded-full py-2 px-3 shadow-xs hover:shadow-md transition-all gap-2 text-left bg-white flex-1 max-w-[280px] xs:max-w-none min-w-0 cursor-pointer hover:border-gray-400 ml-1"
        >
          <div className="bg-[#009A60] p-1.5 rounded-full text-white shrink-0 shadow-2xs">
            <Search size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-bold text-gray-900 truncate">
              {destinationDisplay}
            </span>
            <span className="text-[10px] text-gray-500 truncate">
              {dateDisplay} · {guestsDisplay}
            </span>
          </div>
          {isSearchActive && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full shrink-0"
              title="Clear filters"
            >
              <X size={13} />
            </span>
          )}
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          <Link
            to="/host/create"
            className="hidden lg:block text-sm font-semibold hover:bg-[#e6f7f0] px-4 py-2.5 rounded-full cursor-pointer transition-colors text-gray-800 hover:text-[#009A60]"
          >
            Mozbook your home
          </Link>
          <Link 
            to="/discover"
            title="Discover Mozambique"
            aria-label="Discover"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-full cursor-pointer transition-colors ${
              isDiscoverActive
                ? 'bg-[#e6f7f0] text-[#009A60] font-bold shadow-2xs'
                : 'text-gray-700 hover:text-[#009A60] hover:bg-gray-100'
            }`}
          >
            <Globe size={18} />
            <span className="hidden md:inline text-sm font-semibold">Discover</span>
          </Link>
          
          <div className="relative" ref={menuRef}>
            <div 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="relative flex items-center gap-1.5 sm:gap-2 border border-gray-300 rounded-full p-1.5 sm:p-2 hover:shadow-md transition-shadow cursor-pointer select-none"
              aria-label="User Account Menu"
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
            >
              <Menu size={17} />
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="bg-gray-500 text-white rounded-full p-1">
                  <User size={16} />
                </div>
              )}
              {user && unreadCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-[#009A60] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs"
                  title="Unread messages"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            {isMenuOpen && (
              <div 
                id="mozbook-profile-dropdown"
                role="menu"
                aria-label="Profile navigation menu"
                className="absolute right-0 mt-2 w-64 sm:w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[min(82vh,620px)] overscroll-contain animate-in fade-in zoom-in-95 duration-100"
              >
                {user ? (
                  <>
                    <div className="shrink-0 px-4 py-3 bg-gray-50/90 border-b border-gray-100 backdrop-blur-xs">
                      <p className="font-bold text-sm text-gray-900 truncate">{user.displayName || 'MozBook Member'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>

                    <div className="overflow-y-auto overscroll-contain py-2 flex-1 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300">
                      <Link 
                        to="/my-bookings" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-[#e6f7f0] font-bold text-gray-900 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Luggage size={15} className="text-[#009A60]" />
                          <span>My Trips & Bookings</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-[#008250] font-bold px-2 py-0.5 rounded-full">Active</span>
                      </Link>

                      <Link 
                        to="/messages" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-[#e6f7f0] font-bold text-gray-900 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <MessageCircle size={15} className="text-[#009A60]" />
                          <span>Messages</span>
                        </span>
                        {unreadCount > 0 ? (
                          <span className="text-[10px] bg-[#009A60] text-white font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            {unreadCount}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Inbox</span>
                        )}
                      </Link>

                      <div className="h-px bg-gray-100 my-1"></div>
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Partner & Hosting
                      </div>

                      <Link 
                        to="/partner/dashboard" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-[#e6f7f0] font-bold text-gray-900 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5">
                          <Building2 size={15} className="text-[#009A60]" />
                          <span>Partner Business Dashboard</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-[#008250] font-bold px-2 py-0.5 rounded-full">Manage</span>
                      </Link>

                      <Link 
                        to="/partner" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-700 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={14} className="text-[#009A60]" />
                          <span>Partner Onboarding</span>
                        </span>
                      </Link>

                      <Link 
                        to="/host/create" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-800"
                      >
                        🏡 Mozbook your home (Properties)
                      </Link>

                      <Link 
                        to="/host/activities" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-emerald-50 font-medium text-[#009A60] flex items-center justify-between"
                      >
                        <span>🌴 Host Activities & Trips</span>
                        <span className="text-[10px] bg-[#e6f7f0] text-[#009A60] font-bold px-2 py-0.5 rounded-full">New</span>
                      </Link>

                      <Link 
                        to="/host" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-700"
                      >
                        Host Portal Hub
                      </Link>

                      <Link 
                        to="/host/verify" 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-800 flex items-center justify-between"
                      >
                        <span>Host Verification (ID & Docs)</span>
                        <span className="text-[10px] bg-[#e6f7f0] text-[#009A60] font-bold px-2 py-0.5 rounded-full">New</span>
                      </Link>

                      {isAdmin && (
                        <>
                          <div className="h-px bg-emerald-100 my-2"></div>
                          <div className="px-4 py-1 text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                            <span>Administration</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">Admin</span>
                          </div>
                          <Link 
                            to="/admin/dashboard" 
                            onClick={() => setIsMenuOpen(false)}
                            className="w-full block text-left px-4 py-2 text-sm hover:bg-emerald-50 font-bold text-emerald-900 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <ShieldCheck size={16} className="text-[#009A60]" />
                              <span>Admin Dashboard</span>
                            </span>
                            <span className="text-[10px] bg-[#009A60] text-white font-bold px-2 py-0.5 rounded-full">Console</span>
                          </Link>
                          <Link 
                            to="/admin/verifications" 
                            onClick={() => setIsMenuOpen(false)}
                            className="w-full block text-left px-4 py-2 text-sm hover:bg-emerald-50 font-medium text-gray-800 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <FileCheck2 size={16} className="text-[#009A60]" />
                              <span>Admin Verification Portal</span>
                            </span>
                          </Link>
                        </>
                      )}

                      <div className="h-px bg-gray-100 my-2"></div>
                      <button 
                        onClick={() => { setShowSettingsModal(true); setIsMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between font-medium text-gray-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Sliders size={15} className="text-[#009A60]" />
                          <span>App Permissions & Privacy</span>
                        </span>
                        <span className="text-[10px] bg-[#e6f7f0] text-[#009A60] font-bold px-2 py-0.5 rounded-full">Device</span>
                      </button>

                      <div className="h-px bg-gray-100 my-2"></div>
                      <button 
                        onClick={() => { logout(); setIsMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 text-[#009A60] hover:text-[#008250] font-medium cursor-pointer"
                      >
                        <LogOut size={16} /> Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="overflow-y-auto overscroll-contain py-2 flex-1 scrollbar-thin scrollbar-thumb-gray-200 max-h-[75vh]">
                    <button 
                      onClick={() => { login(); setIsMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[#e6f7f0] hover:text-[#009A60] font-semibold cursor-pointer"
                    >
                      Log in
                    </button>
                    <button 
                      onClick={() => { login(); setIsMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                    >
                      Sign up
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Partner & Hosting
                    </div>
                    <Link 
                      to="/partner" 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full block text-left px-4 py-2 text-sm hover:bg-[#e6f7f0] font-bold text-[#009A60] flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={14} />
                        <span>Become a Partner</span>
                      </span>
                      <span className="text-[10px] bg-[#009A60] text-white font-bold px-2 py-0.5 rounded-full">New</span>
                    </Link>
                    <Link 
                      to="/host/create" 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-800"
                    >
                      🏡 Mozbook your home (Properties)
                    </Link>
                    <Link 
                      to="/host/activities" 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full block text-left px-4 py-2 text-sm hover:bg-emerald-50 font-medium text-[#009A60] flex items-center justify-between"
                    >
                      <span>🌴 Host Activities & Trips</span>
                      <span className="text-[10px] bg-[#e6f7f0] text-[#009A60] font-bold px-2 py-0.5 rounded-full">New</span>
                    </Link>
                    <Link 
                      to="/host" 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full block text-left px-4 py-2 text-sm hover:bg-gray-100 font-medium text-gray-700"
                    >
                      Host Portal Hub
                    </Link>
                    <button 
                      onClick={() => { setShowSettingsModal(true); setIsMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between font-medium text-gray-800 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Sliders size={15} className="text-[#009A60]" />
                        <span>App Permissions</span>
                      </span>
                      <span className="text-[10px] bg-[#e6f7f0] text-[#009A60] font-bold px-2 py-0.5 rounded-full">Device</span>
                    </button>
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                    >
                      Help Center
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Centralized App Permissions & Phone Settings Modal */}
      {showSettingsModal && (
        <AppSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </nav>
  );
}
