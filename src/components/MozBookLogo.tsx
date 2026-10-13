import React from 'react';

interface MozBookLogoProps {
  variant?: 'full' | 'compact' | 'iconOnly';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function MozBookLogo({
  variant = 'full',
  size = 'md',
  className = '',
}: MozBookLogoProps) {
  // Dimensions based on size
  const iconDimensions = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  }[size];

  const titleSize = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size];

  const tagSize = {
    sm: 'text-[9.5px]',
    md: 'text-[11px]',
    lg: 'text-[13px]',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon: Location Pin with Concentric Ring Pointing Straight Down */}
      <div className={`relative shrink-0 ${iconDimensions} text-[#009A60] flex items-center justify-center`}>
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <g>
            <path
              d="M18 4.5C12.2 4.5 7.5 9.2 7.5 15c0 8 10.5 16.5 10.5 16.5S28.5 23 28.5 15c0-5.8-4.7-10.5-10.5-10.5z"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="18"
              cy="14.5"
              r="3.5"
              stroke="currentColor"
              strokeWidth="2.75"
            />
          </g>
        </svg>
      </div>

      {/* Brand Typography */}
      {variant !== 'iconOnly' && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`font-black tracking-tight text-[#009A60] ${titleSize}`}
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            MozBook
          </span>
          {variant === 'full' && (
            <span
              className={`font-medium text-slate-500 tracking-normal mt-0.5 ${tagSize}`}
            >
              Discover Mozambique
            </span>
          )}
        </div>
      )}
    </div>
  );
}
