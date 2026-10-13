import React, { useState, useId } from 'react';
import { 
  MapPin, 
  Compass, 
  ExternalLink, 
  Check, 
  Sparkles, 
  Building2, 
  Navigation,
  Info,
  Maximize2
} from 'lucide-react';
import { 
  MOZAMBIQUE_PROVINCE_MAP_ENTRIES, 
  MOZAMBIQUE_MAP_VIEWBOX, 
  ProvinceMapEntry 
} from '../data/mozambiqueMapData';

export interface MozambiqueInteractiveMapProps {
  selectedProvince: string;
  onSelectProvince: (provinceId: string) => void;
  listingCounts?: Record<string, number>;
  onExploreListings?: (provinceName: string, capital: string) => void;
  className?: string;
}

export const MozambiqueInteractiveMap: React.FC<MozambiqueInteractiveMapProps> = ({
  selectedProvince,
  onSelectProvince,
  listingCounts = {},
  onExploreListings,
  className = ''
}) => {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<'All' | 'North' | 'Central' | 'South'>('All');
  const gradientId = useId();

  // Find currently active province details
  const activeEntry: ProvinceMapEntry | undefined = MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(
    p => p.id.toLowerCase() === selectedProvince.toLowerCase()
  ) || MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(p => p.id === 'Maputo City');

  const hoveredEntry: ProvinceMapEntry | undefined = hoveredProvince
    ? MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(p => p.id.toLowerCase() === hoveredProvince.toLowerCase())
    : undefined;

  // Filtered provinces if user selects a region chip
  const displayedEntries = MOZAMBIQUE_PROVINCE_MAP_ENTRIES;

  const getRegionBaseColor = (region: 'North' | 'Central' | 'South', isSelected: boolean, isHovered: boolean) => {
    if (isSelected) {
      return '#009A60'; // MozBook Primary Green
    }
    if (isHovered) {
      return '#34D399'; // Emerald-400
    }
    switch (region) {
      case 'North':
        return '#e2f4ea'; // Soft coastal emerald tint
      case 'Central':
        return '#d1fae5'; // Fresh savanna green tint
      case 'South':
        return '#ecfdf5'; // Light southern subtropical tint
      default:
        return '#f1f5f9';
    }
  };

  const getRegionBorderColor = (region: 'North' | 'Central' | 'South', isSelected: boolean, isHovered: boolean) => {
    if (isSelected) return '#005f3b';
    if (isHovered) return '#059669';
    return '#94a3b8';
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-3xl p-5 sm:p-7 lg:p-8 shadow-xs ${className}`}>
      
      {/* Top Controls: Region Filters & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-gray-100">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1">
            Interactive Territorial Cartography
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              Select Province on Map ({MOZAMBIQUE_PROVINCE_MAP_ENTRIES.length} Divisions)
            </span>
          </div>
        </div>

        {/* Region Filter Chips */}
        <div className="flex items-center flex-wrap gap-1.5 bg-gray-100/80 p-1 rounded-xl">
          {(['All', 'North', 'Central', 'South'] as const).map(region => (
            <button
              key={region}
              type="button"
              onClick={() => setSelectedRegionFilter(region)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRegionFilter === region
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {region === 'All' ? 'All Divisions' : `${region} Region`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Real Geographic Map (Left) + Selected Territory Dossier (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* =============================================================== */}
        {/* LEFT COLUMN: THE REAL GEOGRAPHIC SVG MAP */}
        {/* =============================================================== */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          {/* Cartographic Canvas Wrapper */}
          <div className="relative w-full max-w-[540px] bg-gradient-to-b from-sky-50/60 via-slate-50/50 to-emerald-50/30 border border-sky-100/70 rounded-2xl p-4 sm:p-6 overflow-hidden shadow-inner">
            
            {/* Subtle Ocean & Coordinates Backdrop */}
            <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[10px] font-mono text-sky-800/60 pointer-events-none">
              <Compass size={13} className="text-sky-600 animate-spin-slow" />
              <span>10°S - 27°S · 30°E - 41°E</span>
            </div>

            <div className="absolute bottom-6 right-6 text-right pointer-events-none opacity-40 select-none">
              <p className="text-[11px] font-black uppercase tracking-widest text-sky-900 font-serif">
                Oceano Índico
              </p>
              <p className="text-[9px] font-sans text-sky-800 tracking-wider">
                Indian Ocean (2,500 km Coastline)
              </p>
            </div>

            {/* Lake Niassa Water Indicator (Northwest) */}
            <div className="absolute top-10 left-8 text-left pointer-events-none opacity-50 select-none">
              <span className="text-[9px] font-bold text-sky-700 block italic">
                Lago Niassa
              </span>
            </div>

            {/* Hover Tooltip Overlay */}
            {hoveredEntry && (
              <div 
                className="absolute top-3 right-4 z-20 bg-gray-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-lg border border-white/10 pointer-events-none transition-all text-xs"
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#009A60]"></span>
                  {hoveredEntry.name}
                  {hoveredEntry.isCityProvince && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal">
                      Capital City Province
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-300 flex items-center gap-2 mt-0.5">
                  <span>Cap: {hoveredEntry.capital}</span>
                  <span>·</span>
                  <span className="text-emerald-400 font-medium">
                    {listingCounts[hoveredEntry.id] || 0} stays
                  </span>
                </div>
              </div>
            )}

            {/* Interactive SVG Render */}
            <svg
              viewBox={MOZAMBIQUE_MAP_VIEWBOX}
              className="w-full h-auto filter drop-shadow-sm select-none"
              style={{ maxHeight: '680px' }}
              aria-label="Geographic Map of Mozambique with 11 provincial divisions"
              role="region"
            >
              <defs>
                <linearGradient id={`${gradientId}-selected`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#009A60" />
                  <stop offset="100%" stopColor="#007a4c" />
                </linearGradient>
                <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#009A60" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* 1. Map Outline / Provinces Paths */}
              <g className="transition-all duration-200">
                {displayedEntries.map((entry) => {
                  const isSelected = selectedProvince.toLowerCase() === entry.id.toLowerCase();
                  const isHovered = hoveredProvince?.toLowerCase() === entry.id.toLowerCase();
                  const isMutedByFilter = selectedRegionFilter !== 'All' && entry.region !== selectedRegionFilter;
                  const isCity = !!entry.isCityProvince;

                  const fillColor = isSelected
                    ? `url(#${gradientId}-selected)`
                    : getRegionBaseColor(entry.region, false, isHovered);

                  const strokeColor = getRegionBorderColor(entry.region, isSelected, isHovered);

                  return (
                    <path
                      key={entry.id}
                      d={entry.path}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? (isCity ? 2.5 : 2) : (isCity ? 1.5 : 1)}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={isMutedByFilter ? 0.35 : 1}
                      filter={isSelected ? `url(#${gradientId}-glow)` : undefined}
                      className="cursor-pointer transition-colors duration-150 focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={`${entry.name} province, capital ${entry.capital}`}
                      onMouseEnter={() => setHoveredProvince(entry.id)}
                      onMouseLeave={() => setHoveredProvince(null)}
                      onClick={() => onSelectProvince(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectProvince(entry.id);
                        }
                      }}
                    />
                  );
                })}
              </g>

              {/* 2. Capital Cities & Province Text Labels */}
              <g className="pointer-events-none select-none">
                {displayedEntries.map((entry) => {
                  const isSelected = selectedProvince.toLowerCase() === entry.id.toLowerCase();
                  const isCity = !!entry.isCityProvince;
                  const isMuted = selectedRegionFilter !== 'All' && entry.region !== selectedRegionFilter;

                  if (isMuted) return null;

                  return (
                    <g key={`marker-${entry.id}`} opacity={isMuted ? 0.2 : 1}>
                      {/* Capital City Dot (skip Maputo City here since it has callout below) */}
                      {!isCity && (
                        <>
                          <circle
                            cx={entry.capitalPos.x}
                            cy={entry.capitalPos.y}
                            r={isSelected ? 4.5 : 3}
                            fill={isSelected ? '#ffffff' : '#009A60'}
                            stroke={isSelected ? '#007a4c' : '#ffffff'}
                            strokeWidth={1.5}
                          />
                        </>
                      )}

                      {/* Province Label Text (For all non-city provinces) */}
                      {!isCity && (
                        <g transform={`translate(${entry.labelPos.x}, ${entry.labelPos.y})`}>
                          {/* Label background pill for superior contrast */}
                          <rect
                            x={- (entry.name.length * 3.8) - 5}
                            y={-9}
                            width={entry.name.length * 7.6 + 10}
                            height={17}
                            rx={4}
                            fill={isSelected ? '#007a4c' : 'rgba(255,255,255,0.85)'}
                            stroke={isSelected ? '#ffffff' : 'rgba(203,213,225,0.6)'}
                            strokeWidth={0.8}
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fontSize={isSelected ? "11" : "10"}
                            fontWeight={isSelected ? "800" : "700"}
                            fill={isSelected ? "#ffffff" : "#1e293b"}
                            className="font-sans tracking-tight"
                          >
                            {entry.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* 3. Dedicated Callout for Maputo City (Autonomous Capital Territory) */}
              {/* Ensures Maputo City has full visual prominence and huge clickability */}
              {(() => {
                const maputoCity = MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(p => p.id === 'Maputo City');
                if (!maputoCity) return null;
                const isSelected = selectedProvince.toLowerCase() === 'maputo city';
                const isHovered = hoveredProvince?.toLowerCase() === 'maputo city';

                // Callout line points from Maputo City centroid (157, 841) out to the bay (240, 845)
                const targetX = 230;
                const targetY = 842;

                return (
                  <g className="cursor-pointer" onClick={() => onSelectProvince('Maputo City')}>
                    {/* Visual leader line */}
                    <line
                      x1={158}
                      y1={840}
                      x2={targetX}
                      y2={targetY}
                      stroke={isSelected ? '#009A60' : '#64748b'}
                      strokeWidth={1.5}
                      strokeDasharray="3,3"
                    />

                    {/* Anchor dot on Maputo Bay */}
                    <circle
                      cx={158}
                      cy={840}
                      r={isSelected ? 5 : 4}
                      fill={isSelected ? '#ffffff' : '#009A60'}
                      stroke={isSelected ? '#007a4c' : '#ffffff'}
                      strokeWidth={1.5}
                    />

                    {/* Interactive Callout Badge */}
                    <g 
                      transform={`translate(${targetX}, ${targetY - 14})`}
                      onMouseEnter={() => setHoveredProvince('Maputo City')}
                      onMouseLeave={() => setHoveredProvince(null)}
                      tabIndex={0}
                      role="button"
                      aria-label="Select Maputo City Capital Province"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectProvince('Maputo City');
                        }
                      }}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={130}
                        height={28}
                        rx={7}
                        fill={isSelected ? '#009A60' : (isHovered ? '#10b981' : '#1e293b')}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                      />
                      <circle
                        cx={14}
                        cy={14}
                        r={4}
                        fill="#ffffff"
                      />
                      <text
                        x={24}
                        y={12}
                        fontSize="9.5"
                        fontWeight="800"
                        fill="#ffffff"
                        className="font-sans"
                      >
                        MAPUTO CITY
                      </text>
                      <text
                        x={24}
                        y={22}
                        fontSize="7.5"
                        fontWeight="600"
                        fill={isSelected ? '#d1fae5' : '#94a3b8'}
                        className="font-sans"
                      >
                        National Capital
                      </text>
                    </g>
                  </g>
                );
              })()}
            </svg>

            {/* Map Legend (Bottom Left) */}
            <div className="mt-3 pt-3 border-t border-sky-100 flex flex-wrap items-center justify-between text-[11px] text-gray-500 gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#009A60]"></span>
                  <span className="font-medium text-gray-700">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                  <span className="font-medium text-gray-600">Province Boundary</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full border border-gray-400 bg-white"></span>
                  <span className="font-medium text-gray-600">Capital</span>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 italic">
                Source: geoBoundaries MOZ ADM1
              </span>
            </div>

          </div>

          {/* Quick province chips for fast access */}
          <div className="w-full max-w-[540px] mt-4 flex flex-wrap items-center gap-1.5 justify-center">
            {MOZAMBIQUE_PROVINCE_MAP_ENTRIES.map(p => {
              const isSelected = selectedProvince.toLowerCase() === p.id.toLowerCase();
              return (
                <button
                  key={`chip-${p.id}`}
                  type="button"
                  onClick={() => onSelectProvince(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#009A60] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

        </div>


        {/* =============================================================== */}
        {/* RIGHT COLUMN: DETAILED PROVINCIAL DOSSIER & ACTIONS */}
        {/* =============================================================== */}
        <div className="lg:col-span-5 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between min-h-[580px]">
          
          <div>
            {/* Dossier Header */}
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} />
                Selected Territorial Division
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 font-semibold text-[10px]">
                {activeEntry?.region} Mozambique
              </span>
            </div>

            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-white tracking-tight">
                {activeEntry?.name}
              </h3>
            </div>

            {activeEntry?.isCityProvince && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold">
                <Check size={13} />
                Autonomous Capital Province (Cidade de Maputo)
              </div>
            )}

            <p className="text-sm text-gray-300 mt-4 leading-relaxed font-normal">
              {activeEntry?.description}
            </p>

            {/* Geographic & Statistical Facts */}
            <div className="mt-6 pt-5 border-t border-gray-800 space-y-3.5">
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Building2 size={13} className="text-emerald-400" />
                  Provincial Capital:
                </span>
                <span className="font-bold text-white text-sm">
                  {activeEntry?.capital}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Navigation size={13} className="text-emerald-400" />
                  Territorial Center:
                </span>
                <span className="font-mono text-emerald-300">
                  {activeEntry
                    ? `${activeEntry.center.lat.toFixed(2)}° S, ${activeEntry.center.lng.toFixed(2)}° E`
                    : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <MapPin size={13} className="text-emerald-400" />
                  Active MozBook Stays:
                </span>
                <span className="font-bold text-white">
                  {listingCounts[activeEntry?.id || ''] || 0} listings in this division
                </span>
              </div>
            </div>

            {/* Must-Visit Highlights */}
            {activeEntry && activeEntry.highlights.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-800">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2.5">
                  Top Provincial Highlights:
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeEntry.highlights.map((hl) => (
                    <span
                      key={hl}
                      className="px-3 py-1 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-semibold text-white transition-colors"
                    >
                      {hl}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-400 text-left w-full sm:w-auto">
              <span className="block font-semibold text-white">
                Browsing {activeEntry?.name}
              </span>
              <span className="text-[11px] text-gray-400">
                Click other provinces to inspect
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onExploreListings && activeEntry) {
                  onExploreListings(activeEntry.name, activeEntry.capital);
                }
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-emerald-900/30"
            >
              <span>Explore All in {activeEntry?.name}</span>
              <ExternalLink size={14} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default MozambiqueInteractiveMap;
