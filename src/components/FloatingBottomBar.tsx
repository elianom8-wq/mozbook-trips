import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Info, Utensils, AlertTriangle } from 'lucide-react';

export default function FloatingBottomBar() {
  const location = useLocation();

  const navItems = [
    {
      id: 'info',
      label: 'Information Hub',
      path: '/info-hub',
      icon: (isActive: boolean) => (
        <Info
          size={24}
          strokeWidth={2}
          className={`transition-all duration-200 ${
            isActive
              ? 'text-[#009A60] scale-110 drop-shadow-[0_2px_8px_rgba(0,154,96,0.3)]'
              : 'text-[#00C49F] hover:text-[#009A60]'
          }`}
        />
      ),
      hoverColor: 'hover:bg-[#e6f7f0]',
      activeBg: 'bg-[#e6f7f0]/80',
    },
    {
      id: 'eateries',
      label: 'Eateries & Check-in',
      path: '/eateries',
      icon: (isActive: boolean) => (
        <Utensils
          size={24}
          strokeWidth={2}
          className={`transition-all duration-200 ${
            isActive
              ? 'text-[#009A60] scale-110 drop-shadow-[0_2px_8px_rgba(0,154,96,0.3)]'
              : 'text-[#00C49F] hover:text-[#009A60]'
          }`}
        />
      ),
      hoverColor: 'hover:bg-[#e6f7f0]',
      activeBg: 'bg-[#e6f7f0]/80',
    },
    {
      id: 'trips',
      label: 'MozBook Trips',
      path: '/trips',
      icon: (isActive: boolean) => (
        /* Custom SUV / 4x4 Vehicle matching the user's icon image */
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-all duration-200 ${
            isActive
              ? 'text-[#009A60] scale-110 drop-shadow-[0_2px_8px_rgba(0,154,96,0.3)]'
              : 'text-[#00C49F] hover:text-[#009A60]'
          }`}
        >
          {/* 4x4 / SUV vehicle silhouette matching the provided screenshot */}
          <path d="M3 13h1m3 0h8m3 0h3l1 3v2a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3a1 1 0 0 1-1-1v-4l2-1z" />
          <path d="M5 13l2-5h9l3 5" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="7" cy="18" r="1.7" />
          <circle cx="17" cy="18" r="1.7" />
        </svg>
      ),
      hoverColor: 'hover:bg-[#e6f7f0]',
      activeBg: 'bg-[#e6f7f0]/80',
    },
    {
      id: 'travel-companion',
      label: 'Travel Companion',
      path: '/travel-companion',
      icon: (isActive: boolean) => (
        /* Two-person / group icon matching reference screenshot */
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-all duration-200 ${
            isActive
              ? 'text-[#009A60] scale-110 drop-shadow-[0_2px_8px_rgba(0,154,96,0.3)]'
              : 'text-[#00C49F] hover:text-[#009A60]'
          }`}
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      hoverColor: 'hover:bg-[#e6f7f0]',
      activeBg: 'bg-[#e6f7f0]/80',
    },
    {
      id: 'emergency',
      label: 'Emergency Directory',
      path: '/emergency',
      icon: (isActive: boolean) => (
        <AlertTriangle
          size={24}
          strokeWidth={2}
          className={`transition-all duration-200 ${
            isActive
              ? 'text-[#EF4444] scale-110 drop-shadow-[0_2px_8px_rgba(239,68,68,0.3)]'
              : 'text-[#F87171] hover:text-[#EF4444]'
          }`}
        />
      ),
      hoverColor: 'hover:bg-red-50',
      activeBg: 'bg-red-50/80',
    },
  ];

  return (
    <div 
      id="mozbook-floating-quickbar-root"
      aria-label="Quick Navigation"
      className="fixed bottom-4 md:bottom-6 left-0 right-0 z-[99999] pointer-events-none flex justify-center items-center"
      style={{
        position: 'fixed',
        bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        pointerEvents: 'none',
        transform: 'translate3d(0, 0, 0)',
        WebkitTransform: 'translate3d(0, 0, 0)',
      }}
    >
      <nav 
        role="navigation"
        aria-label="Bottom Quick Bar"
        className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.22)] border border-gray-200/90 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center divide-x divide-gray-100 transition-all hover:shadow-[0_16px_45px_rgba(0,0,0,0.26)] max-w-[calc(100vw-1.5rem)]"
      >
        {navItems.map((item) => {
          const isActive = item.id === 'travel-companion'
            ? location.pathname.startsWith('/travel-companion')
            : location.pathname === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              id={`floating-nav-${item.id}`}
              className={`group relative flex items-center justify-center gap-1.5 px-3.5 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full transition-all duration-200 cursor-pointer select-none ${
                isActive ? item.activeBg : item.hoverColor
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <div className="shrink-0 scale-90 sm:scale-95 md:scale-100">
                {item.icon(isActive)}
              </div>

              {/* Tablet & Desktop text label for immediate clarity */}
              <span className={`hidden md:inline-block text-xs font-semibold tracking-tight transition-colors ${
                isActive 
                  ? (item.id === 'emergency' ? 'text-red-700 font-bold' : 'text-[#009A60] font-bold') 
                  : 'text-gray-700'
              }`}>
                {item.label}
              </span>

              {/* Tooltip on hover (large desktop) */}
              <div className="pointer-events-none hidden lg:block absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 bg-gray-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap z-50">
                {item.label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>

              {/* Subtle active dot for mobile */}
              {isActive && (
                <span
                  className={`md:hidden absolute -bottom-0.5 sm:-bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                    item.id === 'emergency' ? 'bg-[#EF4444]' : 'bg-[#009A60]'
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
