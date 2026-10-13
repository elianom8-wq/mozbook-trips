import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Globe, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ChevronDown,
  Info,
  Clock,
  ShieldCheck,
  Plane,
  FileText,
  MapPin,
  CheckSquare,
  Square,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { 
  NATIONALITIES, 
  NationalityEntry, 
  PassportType, 
  TravelPurpose, 
  VisaEvaluationResult, 
  evaluateVisaRequirement,
  BORDER_POSTS,
  BORDER_POST_INFO,
  OFFICIAL_SOURCE,
  VISA_DISCLAIMER
} from '../data/visaEngine';

interface Props {
  initialNationality?: string;
  onNationalityChange?: (nationality: string) => void;
}

const PASSPORT_OPTIONS: { id: PassportType; label: string; description: string }[] = [
  { id: 'ORDINARY', label: 'Ordinary passport', description: 'Standard citizen tourist or travel passport' },
  { id: 'DIPLOMATIC', label: 'Diplomatic passport', description: 'Issued to accredited diplomats and government officials' },
  { id: 'SERVICE', label: 'Service / Official passport', description: 'Official government, ministerial, or consular service' }
];

const TRAVEL_PURPOSES: { id: TravelPurpose; label: string; icon: string }[] = [
  { id: 'TOURISM', label: 'Tourism', icon: '🏖️' },
  { id: 'BUSINESS', label: 'Business', icon: '💼' },
  { id: 'VISITING', label: 'Visiting family/friends', icon: '🏡' },
  { id: 'INVESTMENT', label: 'Investment', icon: '📈' },
  { id: 'WORK', label: 'Work', icon: '🔨' },
  { id: 'STUDY', label: 'Study', icon: '🎓' },
  { id: 'TRANSIT', label: 'Transit', icon: '✈️' },
  { id: 'SPORT_CULTURE', label: 'Sport/Culture', icon: '⚽' },
  { id: 'HUMANITARIAN', label: 'Humanitarian', icon: '🤝' },
  { id: 'OTHER', label: 'Other', icon: '🧭' }
];

export default function VisaExemptionChecker({ initialNationality, onNationalityChange }: Props) {
  // Navigation tabs: 'requirements' | 'arrival_check' | 'border_posts'
  const [activeTab, setActiveTab] = useState<'requirements' | 'arrival_check' | 'border_posts'>('requirements');

  // Nationality MUST start empty with no default country
  const [selectedNationalityKey, setSelectedNationalityKey] = useState<string>(() => {
    if (initialNationality) {
      const match = NATIONALITIES.find(n => 
        n.key.toLowerCase() === initialNationality.toLowerCase() ||
        n.country_name.toLowerCase() === initialNationality.toLowerCase()
      );
      if (match) return match.key;
    }
    return ''; // Initial state must be empty - no default country
  });

  const [passportType, setPassportType] = useState<PassportType>('ORDINARY');
  const [travelPurpose, setTravelPurpose] = useState<TravelPurpose>('TOURISM');
  const [stayDays, setStayDays] = useState<number>(14);

  // Search & Selector State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [showValidationWarning, setShowValidationWarning] = useState<boolean>(false);

  // Interactive Arrival Checklist State
  const [checkedArrivalItems, setCheckedArrivalItems] = useState<Record<string, boolean>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Filtered nationalities based on user search
  const filteredNationalities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return NATIONALITIES;
    return NATIONALITIES.filter(n => 
      n.country_name.toLowerCase().includes(q) ||
      n.nationality_name.toLowerCase().includes(q) ||
      n.country_code.toLowerCase() === q
    );
  }, [searchQuery]);

  const selectedNationality = useMemo(() => {
    if (!selectedNationalityKey) return null;
    return NATIONALITIES.find(n => n.key === selectedNationalityKey) || null;
  }, [selectedNationalityKey]);

  // Evaluate result through strict visa engine ONLY when nationality is selected
  const evaluation: VisaEvaluationResult | null = useMemo(() => {
    if (!selectedNationalityKey) {
      return null;
    }
    return evaluateVisaRequirement({
      nationalityKey: selectedNationalityKey,
      passportType,
      travelPurpose,
      stayDays
    });
  }, [selectedNationalityKey, passportType, travelPurpose, stayDays]);

  // Sync with prop when changes
  useEffect(() => {
    if (initialNationality) {
      const match = NATIONALITIES.find(n => 
        n.key.toLowerCase() === initialNationality.toLowerCase() ||
        n.country_name.toLowerCase() === initialNationality.toLowerCase()
      );
      if (match && match.key !== selectedNationalityKey) {
        setSelectedNationalityKey(match.key);
      }
    }
  }, [initialNationality]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectNationality = (entry: NationalityEntry) => {
    setSelectedNationalityKey(entry.key);
    setShowValidationWarning(false);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setCheckedArrivalItems({});
    if (onNationalityChange) {
      onNationalityChange(entry.country_name);
    }
  };

  const handleCheckRequirementsClick = () => {
    if (!selectedNationalityKey) {
      setShowValidationWarning(true);
      setIsDropdownOpen(true);
      return;
    }
    setShowValidationWarning(false);
    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleChecklistItem = (item: string) => {
    setCheckedArrivalItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  const allArrivalChecked = useMemo(() => {
    if (!evaluation || !evaluation.arrival_checklist.length) return false;
    return evaluation.arrival_checklist.every(item => Boolean(checkedArrivalItems[item]));
  }, [evaluation, checkedArrivalItems]);

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden" id="mozambique-visa-checker">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#005e3a] p-6 md:p-8 text-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
              <Globe size={14} />
              <span>Mozambique Visa Checker</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              Mozambique Visa & Entry Requirements
            </h2>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl">
              Official travel entry guide for Mozambique. Check whether your nationality requires a visa, an Electronic Travel Authorisation (eTA), or is eligible for visa-free entry.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs: Requirements vs Arrival Mode vs Border Posts */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'requirements'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            <ShieldCheck size={14} className={activeTab === 'requirements' ? 'text-emerald-600' : 'text-slate-300'} />
            <span>Check My Entry Requirements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('arrival_check')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'arrival_check'
                ? 'bg-[#009A60] text-white shadow-md'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            <Plane size={14} />
            <span>I'm Arriving in Mozambique</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('border_posts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'border_posts'
                ? 'bg-amber-500 text-slate-900 shadow-md'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            <MapPin size={14} />
            <span>Authorised Border Posts ({BORDER_POSTS.length})</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Form Body */}
      <div className="p-6 md:p-8 space-y-8 bg-slate-50/40">
        
        {/* Step-by-Step Inputs Grid */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Country & Nationality Selector (MUST START EMPTY) */}
            <div className="space-y-1.5 relative" ref={dropdownRef}>
              <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                1. Nationality / Passport
              </label>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100/80 border rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    showValidationWarning && !selectedNationality
                      ? 'border-red-400 bg-red-50/50 text-red-900 ring-2 ring-red-200'
                      : selectedNationality
                      ? 'border-gray-300 text-gray-900'
                      : 'border-emerald-500/80 text-gray-600 bg-white ring-1 ring-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedNationality ? (
                      <>
                        <span className="text-lg">{selectedNationality.flag}</span>
                        <span className="truncate text-gray-900 font-extrabold">{selectedNationality.country_name}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-base text-gray-400">🌐</span>
                        <span className="truncate text-gray-500 font-medium">Select nationality</span>
                      </>
                    )}
                  </div>
                  <ChevronDown size={15} className={`text-gray-500 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Searchable Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute z-40 left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden max-h-72 flex flex-col">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search country or nationality..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1 divide-y divide-gray-50 p-1">
                      {filteredNationalities.length > 0 ? (
                        filteredNationalities.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSelectNationality(item)}
                            className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                              selectedNationalityKey === item.key 
                                ? 'bg-emerald-50 text-emerald-900 font-bold' 
                                : 'hover:bg-gray-100 text-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{item.flag}</span>
                              <span>{item.country_name}</span>
                              <span className="text-[10px] text-gray-400">({item.nationality_name})</span>
                            </div>
                            {selectedNationalityKey === item.key && (
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-gray-500">
                          No country found matching "{searchQuery}".
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-500 block">
                Explicit selection required
              </span>
            </div>

            {/* 2. Passport Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                2. Passport Type
              </label>
              <select
                value={passportType}
                onChange={(e) => setPassportType(e.target.value as PassportType)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {PASSPORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500 block">
                Exemptions may vary by passport type
              </span>
            </div>

            {/* 3. Purpose of Travel */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                3. Purpose of Travel
              </label>
              <select
                value={travelPurpose}
                onChange={(e) => setTravelPurpose(e.target.value as TravelPurpose)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {TRAVEL_PURPOSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500 block">
                Tourism & business vs work or study
              </span>
            </div>

            {/* 4. Planned Length of Stay */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                4. Length of Stay (Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={stayDays}
                  onChange={(e) => setStayDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-1">
                  {[7, 14, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setStayDays(d)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                        stayDays === d ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 block">
                Stay limits apply to exemptions
              </span>
            </div>

          </div>

          {/* Action Trigger Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              {!selectedNationalityKey ? (
                <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                  <Info size={14} className="text-amber-600" />
                  Select your nationality to check visa and eTA requirements.
                </span>
              ) : (
                <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#009A60]" />
                  Checking entry rules for {selectedNationality?.country_name} ({passportType.toLowerCase()} passport).
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCheckRequirementsClick}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <span>Check Requirements</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Friendly Validation Message if user tries to check without selecting nationality */}
        {showValidationWarning && !selectedNationalityKey && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-3 animate-fadeIn">
            <AlertCircle size={20} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-extrabold text-amber-950">Please select your nationality to continue.</p>
              <p className="font-normal text-amber-800 mt-0.5">
                Mozambique entry rules depend directly on your country of citizenship and passport. Choose your nationality from the list above to view your personalized requirements.
              </p>
            </div>
          </div>
        )}

        {/* View Mode 1: Detailed Visa Evaluation Result */}
        {activeTab === 'requirements' && (
          <div ref={resultRef} className="space-y-6">
            {!selectedNationalityKey || !evaluation ? (
              /* Initial State: Waiting for user to select nationality */
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-8 md:p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#009A60] flex items-center justify-center mx-auto border border-emerald-100">
                  <Globe size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-lg font-black text-gray-900">
                    Ready to check your entry requirements?
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Please select your nationality above. We'll instantly check if you can travel visa-free, require an Electronic Travel Authorisation (eTA), or need to apply for a Mozambique eVisa.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(true);
                      window.scrollTo({ top: 100, behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <span>Select Nationality</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            ) : (
              /* Real Evaluated Result Card from Database */
              <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-sm p-6 md:p-8 space-y-6 animate-fadeIn">
                
                {/* Top Meta Details Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 text-xs">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Destination</span>
                      <span className="font-extrabold text-gray-900">🇲🇿 Mozambique</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Nationality</span>
                      <span className="font-extrabold text-gray-900 flex items-center gap-1.5">
                        <span>{evaluation.flag}</span>
                        <span>{evaluation.country_name}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Passport Type</span>
                      <span className="font-extrabold text-gray-900">
                        {evaluation.passport_type === 'ORDINARY' ? 'Ordinary Passport' : evaluation.passport_type === 'DIPLOMATIC' ? 'Diplomatic Passport' : 'Service / Official Passport'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Purpose</span>
                      <span className="font-extrabold text-gray-900">
                        {TRAVEL_PURPOSES.find(p => p.id === evaluation.travel_purpose)?.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black shadow-xs ${evaluation.status_badge_color}`}>
                      <span>{evaluation.status_title}</span>
                    </span>
                  </div>
                </div>

                {/* Big Status Headline */}
                <div className="space-y-2">
                  <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-snug">
                    {evaluation.headline}
                  </h3>

                  {evaluation.purpose_note && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{evaluation.purpose_note}</span>
                    </div>
                  )}

                  {evaluation.stay_exceeded && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-medium flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Planned Stay Exceeds Permitted Allowance</strong>
                        <span>
                          Your planned stay of <strong>{evaluation.stay_days} days</strong> exceeds the allowed exemption of <strong>{evaluation.max_stay_allowed} days</strong>. You must apply for an extended visa category or renew your permit upon arrival through SENAMI (National Migration Service).
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirement Breakdown Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Visa Required</span>
                    <span className={`text-sm font-black ${evaluation.visa_required ? 'text-orange-600' : 'text-emerald-700'}`}>
                      {evaluation.visa_required ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">eTA Required</span>
                    <span className={`text-sm font-black ${evaluation.eta_required ? 'text-amber-600' : 'text-gray-700'}`}>
                      {evaluation.eta_required ? 'Yes (Mandatory)' : 'No'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Max Permitted Stay</span>
                    <span className="text-sm font-black text-gray-900">
                      {evaluation.max_stay_allowed ? `${evaluation.max_stay_allowed} Days` : 'Category Dependent'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Passport Requirement</span>
                    <span className="text-sm font-black text-gray-900">
                      {evaluation.passport_validity_months} Months Validity
                    </span>
                  </div>
                </div>

                {/* Consumer Travel eTA vs eVisa Information Callout */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase">
                        Travel Information
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>eTA (Electronic Travel Authorisation):</strong> A pre-travel registration for eligible visa-exempt travelers (~650 MZN fee). <em>It is not a visa.</em><br/>
                      <strong>eVisa:</strong> An official electronic visa issued by Mozambique for travelers from nationalities where a visa is required.
                    </p>
                  </div>

                  {evaluation.status !== 'VISA_FREE' && evaluation.status !== 'EMBASSY_REQUIRED' && (
                    <a
                      href={evaluation.official_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span>{evaluation.eta_required ? 'Apply for eTA Online' : 'Apply for eVisa Online'}</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {/* Two Column Section: Required Documents & What To Do Before Travel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Required Documents */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={15} className="text-[#009A60]" />
                      <span>Required Documents</span>
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.required_documents.map((doc, idx) => (
                        <li key={idx} className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
                          <CheckCircle2 size={14} className="text-[#009A60] shrink-0 mt-0.5" />
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What To Do Before Travelling */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Clock size={15} className="text-amber-600" />
                      <span>What To Do Before Travelling</span>
                    </h4>
                    <ul className="space-y-2">
                      {evaluation.what_to_do_before_travel.map((step, idx) => (
                        <li key={idx} className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2.5">
                          <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                {/* Final Admission Discretion Notice */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                  <Info size={16} className="text-slate-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">
                    "Immigration officers make the final decision on entry."
                  </span>
                </div>

              </div>
            )}
          </div>
        )}

        {/* View Mode 2: "I'm Arriving in Mozambique" Checklist */}
        {activeTab === 'arrival_check' && (
          <div className="bg-white rounded-3xl border-2 border-emerald-200/80 shadow-sm p-6 md:p-8 space-y-6 animate-fadeIn">
            {!selectedNationalityKey || !evaluation ? (
              <div className="text-center py-8 space-y-3">
                <Plane size={36} className="mx-auto text-emerald-600" />
                <h3 className="text-base font-extrabold text-gray-900">
                  Please select your nationality above to view your personalized arrival checklist.
                </h3>
                <p className="text-xs text-gray-600 max-w-md mx-auto">
                  Different nationalities require specific entry authorisations (such as an approved eTA, eVisa paper, or consular sticker) before approaching the immigration desk.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-gray-900">
                        {evaluation.flag} {evaluation.country_name}
                      </span>
                      <span className="text-xs font-bold text-gray-600">
                        • {evaluation.passport_type === 'ORDINARY' ? 'Ordinary Passport' : 'Diplomatic/Service'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mt-1">
                      Arrival Protocol Checklist for Immigration
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Check each physical item before approaching the border counter at Maputo Airport or land borders.
                    </p>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${evaluation.status_badge_color}`}>
                      <span>{evaluation.status_title}</span>
                    </span>
                  </div>
                </div>

                {/* Checklist Items */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Before Going to Immigration Counter:
                  </span>

                  {evaluation.arrival_checklist.map((item) => {
                    const isChecked = Boolean(checkedArrivalItems[item]);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleChecklistItem(item)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-emerald-50/70 border-emerald-300 text-gray-900' 
                            : 'bg-white border-gray-200 hover:border-gray-300 text-gray-800'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare size={20} className="text-[#009A60] shrink-0 mt-0.5" />
                        ) : (
                          <Square size={20} className="text-gray-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span className={`text-xs md:text-sm font-semibold leading-relaxed ${isChecked ? 'line-through text-gray-500' : ''}`}>
                            {item}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* All Clear or Pending Banner */}
                {allArrivalChecked ? (
                  <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-2xl text-emerald-950 font-bold text-xs md:text-sm flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-[#009A60] shrink-0" />
                    <span>All documents verified! You are prepared to proceed through Mozambique immigration control.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0" />
                    <span>Please confirm and check off each required document above prior to presenting your passport to the immigration official.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* View Mode 3: Authorised Border Posts Directory */}
        {activeTab === 'border_posts' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                <MapPin size={14} />
                <span>Travel Information</span>
              </div>
              <h3 className="text-xl font-black text-gray-900">
                Authorised Border Posts
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
                View Mozambique border posts where border visa services may be available. Eligibility and issuance are subject to applicable immigration rules and immigration authority decisions.
              </p>
              <p className="text-xs font-bold text-red-600">
                ⚠️ Never assume that visa on arrival is guaranteed. Final issuance is subject to Mozambique immigration authorities and the requirements applicable at each border post.
              </p>
            </div>

            {/* Grid of Border Posts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {BORDER_POSTS.map((post, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#006b42] text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate">{post}</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <a
                href={BORDER_POST_INFO.official_source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#009A60] hover:underline inline-flex items-center gap-1"
              >
                <span>Official Mozambique border information</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Consumer-Facing Official Source & Legal Information Footer */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">Official Source:</span>
              <a 
                href={OFFICIAL_SOURCE.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#009A60] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Official Mozambique immigration information (evisa.gov.mz)</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <div className="text-[11px] text-gray-500 italic max-w-md">
            {VISA_DISCLAIMER}
          </div>
        </div>

      </div>
    </div>
  );
}

