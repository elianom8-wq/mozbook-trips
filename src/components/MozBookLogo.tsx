import React, { useState, useId } from 'react';

export interface MozBookLogoProps {
  variant?: 'full' | 'compact' | 'iconOnly';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  preferVector?: boolean;
}

export default function MozBookLogo({
  variant = 'full',
  size = 'md',
  className = '',
  theme = 'auto',
  preferVector = false,
}: MozBookLogoProps) {
  const [imgError, setImgError] = useState(false);
  const rawId = useId();
  const clipId = `mozbook-pin-clip-${rawId.replace(/:/g, '')}`;

  // Dimensions based on size
  const iconDimensions = {
    sm: 'w-6 h-7',
    md: 'w-8 h-9',
    lg: 'w-10 h-11',
  }[size];

  const titleSize = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }[size];

  const tagSize = {
    sm: 'text-[9.5px]',
    md: 'text-[11px]',
    lg: 'text-[13px]',
  }[size];

  const imgHeight = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
  }[size];

  // Auto-detect dark background context from theme or className
  const isDark = theme === 'dark' || className.includes('dark') || className.includes('text-white');

  // Official Mozambique Flag Colors
  const COLOR_GREEN = '#009739';
  const COLOR_YELLOW = '#FAB005'; // Golden amber flag yellow for high contrast and legibility on light backgrounds
  const COLOR_RED = '#D21034';
  const COLOR_DARK_TEXT = '#34495E';

  // Render official brand image asset for full variant on light backgrounds when not forced to vector
  if (variant === 'full' && !isDark && !preferVector && !imgError) {
    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <img
          src="/assets/aistudio/MozBook_Mozambique_Travel_Logo_2123e4fa.png"
          alt="MozBook - Discover Mozambique"
          className={`${imgHeight} w-auto object-contain shrink-0`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon: Mozambique Flag Tri-Color Location Pin */}
      <div className={`relative shrink-0 ${iconDimensions} flex items-center justify-center`}>
        <svg
          viewBox="0 0 32 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d="M16 2 C9.65 2 4.5 7.15 4.5 13.5 C4.5 19.5 9.5 25.5 16 34 C22.5 25.5 27.5 19.5 27.5 13.5 C27.5 7.15 22.35 2 16 2 Z" />
            </clipPath>
          </defs>

          {/* Tri-Color Clipped Pin Sectors */}
          <g clipPath={`url(#${clipId})`}>
            {/* Top-Left: Mozambique Flag Green (#009739) */}
            <path d="M16 0 L-2 0 L-2 22 L16 18.5 Z" fill={COLOR_GREEN} />
            {/* Top-Right: Mozambique Flag Yellow (#FAB005) */}
            <path d="M16 0 L34 0 L34 22 L16 18.5 Z" fill={COLOR_YELLOW} />
            {/* Bottom Chevron Wedge: Mozambique Flag Red (#D21034) */}
            <path d="M-2 22 L16 18.5 L34 22 L34 38 L-2 38 Z" fill={COLOR_RED} />
          </g>

          {/* Center Concentric White Ring */}
          <circle cx="16" cy="13.5" r="6.2" fill="#FFFFFF" />
          {/* Inner Center Dot: Green (#009739) */}
          <circle cx="16" cy="13.5" r="3.8" fill={COLOR_GREEN} />
        </svg>
      </div>

      {/* Brand Typography */}
      {variant !== 'iconOnly' && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`font-black tracking-tight ${titleSize} flex items-center leading-none`}
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            {/* "Moz" text in Mozambique Flag Green */}
            <span style={{ color: COLOR_GREEN }}>Moz</span>
            {/* "Bo" text in Mozambique Flag Yellow */}
            <span style={{ color: COLOR_YELLOW }}>Bo</span>
            {/* "ok" text in Mozambique Flag Red */}
            <span style={{ color: COLOR_RED }}>ok</span>
          </span>

          {/* Tagline: Exact wording "Discover Mozambique" */}
          {variant === 'full' && (
            <span
              className={`font-semibold tracking-wide mt-0.5 ${tagSize} ${
                isDark ? 'text-slate-300' : 'text-[#34495E]'
              }`}
              style={{
                letterSpacing: '0.015em',
                color: isDark ? '#E2E8F0' : COLOR_DARK_TEXT,
              }}
            >
              Discover Mozambique
            </span>
          )}
        </div>
      )}
    </div>
  );
}
