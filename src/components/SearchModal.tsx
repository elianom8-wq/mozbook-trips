import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  X, 
  Palmtree, 
  Building, 
  Compass, 
  Trees, 
  Waves, 
  Sun,
  Plus,
  Minus,
  Check,
  Sparkles,
  Navigation,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useSearch } from '../context/SearchContext';
import { permissionService } from '../services/permissionService';
import PermissionPromptModal from './PermissionPromptModal';

const MOZAMBIQUE_REGIONS = [
  {
    id: 'all',
    name: 'All Mozambique',
    description: 'Explore all provinces, coasts & safari parks',
    query: '',
    icon: Compass,
    tag: 'All Stays'
  },
  {
    id: 'maputo',
    name: 'Maputo Cidade & Costa do Sol',
    description: 'Polana Cimento, Sommerschield, Baixa & Bayfront',
    query: 'Maputo',
    icon: Building,
    tag: 'Capital & Culture'
  },
  {
    id: 'tofo',
    name: 'Praia do Tofo & Barra',
    description: 'Inhambane coast, manta rays, whale sharks & surf',
    query: 'Tofo',
    icon: Palmtree,
    tag: 'Diving & Beaches'
  },
  {
    id: 'ponta',
    name: 'Ponta do Ouro & Malongane',
    description: 'Dolphin swims, deep-sea reefs & beach bars',
    query: 'Ponta do Ouro',
    icon: Waves,
    tag: 'Reefs & Dolphins'
  },
  {
    id: 'vilankulo',
    name: 'Vilankulo & Bazaruto',
    description: 'Bazaruto Archipelago, dhow sailing & turquoise sandbars',
    query: 'Vilankulo',
    icon: Sun,
    tag: 'Archipelago'
  },
  {
    id: 'gorongosa',
    name: 'Gorongosa National Park',
    description: 'Sofala province, wildlife game drives & bush lodges',
    query: 'Gorongosa',
    icon: Trees,
    tag: 'Safari Wildlife'
  },
  {
    id: 'inhambane',
    name: 'Inhambane Historical Town',
    description: 'Colonial architecture, coconut groves & dhow harbor',
    query: 'Inhambane',
    icon: MapPin,
    tag: 'Heritage'
  },
  {
    id: 'namaacha',
    name: 'Namaacha Mountains',
    description: 'Lebombo ranges, fresh waterfalls & country retreats',
    query: 'Namaacha',
    icon: Trees,
    tag: 'Country Escapes'
  }
];

const DATE_PRESETS = [
  { id: 'Any week', label: 'Any week (Flexible dates)' },
  { id: 'This weekend', label: 'This weekend (Fri – Sun)' },
  { id: 'Next week', label: 'Next week (7 nights)' },
  { id: 'Next month', label: 'Next month (Flexible)' },
];

export default function SearchModal() {
  const {
    filters,
    updateFilters,
    clearFilters,
    searchModalOpen,
    setSearchModalOpen,
    activeTab,
    setActiveTab,
    executeSearch,
    totalGuests
  } = useSearch();

  const destinationInputRef = useRef<HTMLInputElement>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const handleAroundYouClick = () => {
    setLocationError(null);
    const isGranted = permissionService.isGranted('location');
    const hasSolicited = permissionService.hasBeenSolicited('location');

    if (isGranted) {
      executeLocationDetect();
    } else if (!hasSolicited) {
      setShowLocationPrompt(true);
    } else {
      executeLocationDetect();
    }
  };

  const executeLocationDetect = async () => {
    setIsLocating(true);
    setLocationError(null);
    const res = await permissionService.requestLocation();
    setIsLocating(false);
    if (res.success && res.coords) {
      updateFilters({ destination: 'Near Current Location' });
      setActiveTab('when');
    } else {
      setLocationError(res.error || 'Location access was denied. You can manually select any region below.');
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchModalOpen(false);
      }
    };
    if (searchModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto-focus input when opened in 'where' tab
      if (activeTab === 'where') {
        setTimeout(() => destinationInputRef.current?.focus(), 100);
      }
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchModalOpen, activeTab, setSearchModalOpen]);

  if (!searchModalOpen) return null;

  // Format destination label
  const getDestinationLabel = () => {
    if (!filters.destination.trim()) return 'Anywhere';
    return filters.destination;
  };

  // Format date label
  const getDateLabel = () => {
    if (filters.datePreset) return filters.datePreset;
    if (filters.checkIn && filters.checkOut) {
      return `${filters.checkIn.slice(5)} – ${filters.checkOut.slice(5)}`;
    }
    if (filters.checkIn) return `From ${filters.checkIn.slice(5)}`;
    return 'Any week';
  };

  // Format guests label
  const getGuestLabel = () => {
    if (totalGuests === 0) return 'Add guests';
    return `${totalGuests} guest${totalGuests > 1 ? 's' : ''}${filters.pets > 0 ? `, ${filters.pets} pet` : ''}`;
  };

  const handleSelectRegion = (regionQuery: string) => {
    updateFilters({ destination: regionQuery });
    setActiveTab('when');
  };

  const handleSelectDatePreset = (presetId: string) => {
    updateFilters({ datePreset: presetId, checkIn: '', checkOut: '' });
    setActiveTab('who');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-start justify-center pt-4 md:pt-14 px-3 sm:px-4 pb-12 animate-fade-in">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl md:rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Close */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#009A60]"></span>
            <span className="font-bold text-sm tracking-wide text-gray-900">
              Find Your Stay in Mozambique
            </span>
          </div>

          <button
            onClick={() => setSearchModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <X size={19} />
          </button>
        </div>

        {/* Interactive Segmented Pill Bar */}
        <div className="p-3 md:p-4 bg-gray-50/70 border-b border-gray-200">
          <div className="bg-white rounded-full p-1.5 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Where Segment */}
            <button
              type="button"
              onClick={() => setActiveTab('where')}
              className={`flex-1 text-left px-4 py-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'where'
                  ? 'bg-gray-100 shadow-xs ring-1 ring-gray-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Where
              </span>
              <span className="block text-sm font-semibold text-gray-900 truncate">
                {getDestinationLabel()}
              </span>
            </button>

            {/* When Segment */}
            <button
              type="button"
              onClick={() => setActiveTab('when')}
              className={`flex-1 text-left px-4 py-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'when'
                  ? 'bg-gray-100 shadow-xs ring-1 ring-gray-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                When
              </span>
              <span className="block text-sm font-semibold text-gray-900 truncate">
                {getDateLabel()}
              </span>
            </button>

            {/* Who Segment */}
            <button
              type="button"
              onClick={() => setActiveTab('who')}
              className={`flex-1 text-left px-4 py-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'who'
                  ? 'bg-gray-100 shadow-xs ring-1 ring-gray-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Who
              </span>
              <span className="block text-sm font-semibold text-gray-900 truncate">
                {getGuestLabel()}
              </span>
            </button>

            {/* Direct Search Action Button */}
            <div className="p-1 sm:pl-2 flex items-center justify-end">
              <button
                type="button"
                onClick={executeSearch}
                className="w-full sm:w-auto px-6 py-3 bg-[#009A60] hover:bg-[#008250] text-white rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search size={16} strokeWidth={2.5} />
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Specific Content Panels */}
        <div className="p-5 md:p-8 flex-1 max-h-[60vh] overflow-y-auto">
          {/* TAB: WHERE */}
          {activeTab === 'where' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Search by Destination, City or Landmark
                </label>
                <div className="relative">
                  <Search
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    ref={destinationInputRef}
                    type="text"
                    value={filters.destination}
                    onChange={(e) => updateFilters({ destination: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        executeSearch();
                      }
                    }}
                    placeholder="e.g. Maputo, Tofo Beach, Ponta do Ouro, Vilankulo, Gorongosa..."
                    className="w-full pl-12 pr-10 py-3.5 bg-white border border-gray-300 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60] transition-all"
                  />
                  {filters.destination && (
                    <button
                      type="button"
                      onClick={() => updateFilters({ destination: '' })}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* What's Around You Fast Card */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-[#009A60] shadow-2xs">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-emerald-950">
                      What's Around You? (Current Location)
                    </h5>
                    <p className="text-[11px] text-emerald-800">
                      Auto-detect your location to find stays, lodges & activities nearby
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAroundYouClick}
                  disabled={isLocating}
                  className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isLocating ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Navigation size={13} />
                  )}
                  <span>{isLocating ? 'Detecting...' : 'Use My Location'}</span>
                </button>
              </div>

              {/* Error notice if denied (Non-blocking) */}
              {locationError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Location access not enabled: </span>
                    <span>{locationError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationError(null)}
                    className="text-amber-700 hover:text-amber-950"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Popular Destinations in Mozambique
                  </h4>
                  <span className="text-[11px] text-[#009A60] font-semibold">
                    Click to select & continue
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {MOZAMBIQUE_REGIONS.map((region) => {
                    const Icon = region.icon;
                    const isSelected = filters.destination.toLowerCase() === region.query.toLowerCase() && (region.query !== '' || filters.destination === '');
                    return (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() => handleSelectRegion(region.query)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'border-[#009A60] bg-[#e6f7f0] shadow-xs ring-1 ring-[#009A60]'
                            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'}`}>
                            <Icon size={18} />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {region.tag}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-gray-900 leading-tight">
                            {region.name}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                            {region.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: WHEN */}
          {activeTab === 'when' && (
            <div className="space-y-6">
              {/* Quick Presets */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                  Quick Travel Windows
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DATE_PRESETS.map((preset) => {
                    const isSelected = filters.datePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectDatePreset(preset.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#009A60] bg-[#e6f7f0] text-[#009A60] font-bold shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium'
                        }`}
                      >
                        <Calendar size={18} className={isSelected ? 'text-[#009A60] mb-2' : 'text-gray-400 mb-2'} />
                        <div className="text-xs font-bold">{preset.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exact Dates */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Or Select Specific Check-In & Check-Out
                  </h4>
                  {(filters.checkIn || filters.checkOut) && (
                    <button
                      type="button"
                      onClick={() => updateFilters({ checkIn: '', checkOut: '' })}
                      className="text-xs font-semibold text-[#009A60] hover:underline cursor-pointer"
                    >
                      Clear dates
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Check-in Date
                    </label>
                    <input
                      type="date"
                      min={todayStr}
                      value={filters.checkIn}
                      onChange={(e) => {
                        updateFilters({ checkIn: e.target.value, datePreset: '' });
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Check-out Date
                    </label>
                    <input
                      type="date"
                      min={filters.checkIn || todayStr}
                      value={filters.checkOut}
                      onChange={(e) => {
                        updateFilters({ checkOut: e.target.value, datePreset: '' });
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-gray-500">
                  Tip: Many coastal residences in Mozambique have minimum night stays (e.g. 2 nights) during holiday seasons.
                </p>
              </div>
            </div>
          )}

          {/* TAB: WHO */}
          {activeTab === 'who' && (
            <div className="space-y-4 max-w-lg mx-auto">
              {/* Adults */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Adults</h4>
                  <p className="text-xs text-gray-500">Ages 13 or above</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateFilters({ adults: Math.max(0, filters.adults - 1) })}
                    disabled={filters.adults <= 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{filters.adults}</span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ adults: filters.adults + 1 })}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Children */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Children</h4>
                  <p className="text-xs text-gray-500">Ages 2–12</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateFilters({ children: Math.max(0, filters.children - 1) })}
                    disabled={filters.children <= 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{filters.children}</span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ children: filters.children + 1 })}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Infants</h4>
                  <p className="text-xs text-gray-500">Under 2</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateFilters({ infants: Math.max(0, filters.infants - 1) })}
                    disabled={filters.infants <= 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{filters.infants}</span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ infants: filters.infants + 1 })}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Pets */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Pets</h4>
                  <p className="text-xs text-gray-500">Bringing a pet or service animal</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateFilters({ pets: Math.max(0, filters.pets - 1) })}
                    disabled={filters.pets <= 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{filters.pets}</span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ pets: filters.pets + 1 })}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
          >
            Clear all filters
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={executeSearch}
              className="px-6 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Search size={14} />
              <span>Search MozBook Stays</span>
            </button>
          </div>
        </div>
      </div>

      {/* Location Permission Rationale Modal */}
      {showLocationPrompt && (
        <PermissionPromptModal
          isOpen={showLocationPrompt}
          type="location"
          title="Allow MozBook to Access Location?"
          rationale="Allow location access so MozBook can show what's around you and help you find nearby stays, activities and places."
          detail="MozBook uses your device GPS to detect your approximate location and find stays and safari escapes in your area."
          onClose={() => setShowLocationPrompt(false)}
          onGranted={(data) => {
            setShowLocationPrompt(false);
            if (data?.coords) {
              updateFilters({ destination: 'Near Current Location' });
              setActiveTab('when');
            } else {
              executeLocationDetect();
            }
          }}
          onDenied={(err) => {
            setShowLocationPrompt(false);
            setLocationError(err || 'Location access was denied. You can manually select any region.');
          }}
        />
      )}
    </div>
  );
}
