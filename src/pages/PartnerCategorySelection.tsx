import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  Compass, 
  Palmtree, 
  Car, 
  Globe, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  ArrowLeft,
  Info,
  Clock,
  ExternalLink,
  Layers
} from 'lucide-react';
import MozBookLogo from '../components/MozBookLogo';

export type PartnerCategoryKey = 
  | 'accommodation'
  | 'activities'
  | 'trips_tours'
  | 'transport'
  | 'travel_dmc';

export interface PartnerCategoryOption {
  key: PartnerCategoryKey;
  title: string;
  badge: string;
  description: string;
  examples: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  existingRoute?: string;
  isAvailableNow: boolean;
}

export const PARTNER_CATEGORIES: PartnerCategoryOption[] = [
  {
    key: 'accommodation',
    title: 'Accommodation',
    badge: 'Stays & Lodges',
    description: 'Offer stays such as hotels, lodges, villas, camps and other accommodation.',
    examples: 'Hotels · Safari Lodges · Beachfront Villas · Campsites · Glamping Domes',
    icon: Building2,
    existingRoute: '/host/create',
    isAvailableNow: true
  },
  {
    key: 'activities',
    title: 'Activities & Experiences',
    badge: 'Day Experiences',
    description: 'Offer activities and experiences such as diving, excursions, adventures and attractions.',
    examples: 'Scuba Diving · Dhow Sailing · Snorkeling · Quad Biking · Paragliding',
    icon: Compass,
    existingRoute: '/host/activities/create?type=activity',
    isAvailableNow: true
  },
  {
    key: 'trips_tours',
    title: 'Trips & Tours',
    badge: 'Multi-Day & Safaris',
    description: 'Offer organised trips, tours, safaris and guided journeys.',
    examples: 'Wildlife Safaris · Island Expeditions · Multi-Day Treks · Guided Circuits',
    icon: Palmtree,
    existingRoute: '/host/activities/create?type=trip',
    isAvailableNow: true
  },
  {
    key: 'transport',
    title: 'Transport',
    badge: 'Transfers & Logistics',
    description: 'Offer transfers, vehicle services, boats, drivers and other tourist transport.',
    examples: 'Airport Transfers · 4x4 Bush Shuttles · Boat Charters · Private Drivers',
    icon: Car,
    existingRoute: '/partner/transport/create',
    isAvailableNow: true
  },
  {
    key: 'travel_dmc',
    title: 'Travel / DMC',
    badge: 'Agency & Operations',
    description: 'Offer destination management, travel agency, tour operator or specialist tourism services.',
    examples: 'Destination Management (DMC) · Inbound Packages · Custom Itineraries',
    icon: Globe,
    isAvailableNow: false
  }
];

export default function PartnerCategorySelection() {
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<PartnerCategoryKey[]>([]);
  const [showMultiBranchModal, setShowMultiBranchModal] = useState(false);

  const toggleCategory = (key: PartnerCategoryKey) => {
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleContinue = () => {
    if (selectedKeys.length === 0) return;

    // Single category path
    if (selectedKeys.length === 1) {
      const selected = selectedKeys[0];
      if (selected === 'accommodation') {
        navigate('/host/create', { state: { partnerCategory: 'accommodation', partnerFlow: true } });
        return;
      }
      if (selected === 'activities') {
        navigate('/host/activities/create?type=activity', { state: { partnerCategory: 'activities', partnerFlow: true } });
        return;
      }
      if (selected === 'trips_tours') {
        navigate('/host/activities/create?type=trip', { state: { partnerCategory: 'trips_tours', partnerFlow: true } });
        return;
      }
      if (selected === 'transport') {
        navigate('/partner/transport/create', { state: { partnerCategory: 'transport', partnerFlow: true } });
        return;
      }
      // travel_dmc -> display branch screen
      setShowMultiBranchModal(true);
      return;
    }

    // Multiple categories selected -> show unified multi-branch launchpad
    setShowMultiBranchModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-28 pt-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/host"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to Host Portal</span>
          </Link>
          <Link
            to="/partner/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#008250] text-xs font-bold transition-colors"
          >
            <span>Partner Business Dashboard</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Header Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6f7f0] text-[#009A60] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>MozBook Partner Onboarding</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-950 tracking-tight">
            Become a MozBook Partner
          </h1>
          <p className="text-xl font-bold text-emerald-800">
            What does your business offer?
          </p>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            MozBook provides dedicated tools for tourism suppliers across Mozambique. Select one or more categories below that represent your offerings.
          </p>
        </div>

        {/* If viewing the Multi-Branch Launchpad */}
        {showMultiBranchModal ? (
          <div className="bg-white rounded-3xl border-2 border-[#009A60] shadow-xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#009A60] uppercase tracking-wider">
                  Partner Route Confirmation
                </span>
                <h2 className="text-2xl font-black text-gray-900 mt-1">
                  Your Selected Business Offerings
                </h2>
                <p className="text-sm text-gray-500">
                  You selected {selectedKeys.length} offering{selectedKeys.length > 1 ? 's' : ''}. Choose where you would like to begin your onboarding:
                </p>
              </div>
              <button
                onClick={() => setShowMultiBranchModal(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Change Categories
              </button>
            </div>

            {/* List of Selected Category Branches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PARTNER_CATEGORIES.filter(c => selectedKeys.includes(c.key)).map(category => {
                const Icon = category.icon;
                return (
                  <div
                    key={category.key}
                    className="p-5 rounded-2xl border-2 border-gray-200 hover:border-[#009A60] bg-gray-50/50 hover:bg-white transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center">
                          <Icon size={20} />
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {category.badge}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {category.title}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {category.description}
                      </p>
                    </div>

                    <div>
                      {category.isAvailableNow && category.existingRoute ? (
                        <Link
                          to={category.existingRoute}
                          state={{ partnerCategory: category.key, partnerFlow: true }}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                        >
                          <span>Start {category.title} Branch</span>
                          <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <div className="w-full text-center py-2 px-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-center gap-1.5">
                          <Clock size={14} />
                          <span>Specialized Branch (Stage 3E/3F)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* General Partner Portal Action */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={() => setShowMultiBranchModal(false)}
                className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Adjust Offerings Selection</span>
              </button>
              <Link
                to="/host"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#009A60] hover:underline"
              >
                <span>Or go to Partner Hub Dashboard</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          /* Category Selection Grid */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PARTNER_CATEGORIES.map(category => {
                const isSelected = selectedKeys.includes(category.key);
                const Icon = category.icon;

                return (
                  <div
                    key={category.key}
                    onClick={() => toggleCategory(category.key)}
                    className={`relative cursor-pointer rounded-2xl p-5 md:p-6 transition-all duration-200 border-2 flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#009A60] bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#009A60] text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            <Icon size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">
                              {category.title}
                            </h3>
                            <span className="text-[11px] font-semibold text-gray-500">
                              {category.badge}
                            </span>
                          </div>
                        </div>

                        {/* Checkbox Icon */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-[#009A60] border-[#009A60] text-white'
                            : 'border-gray-300 bg-white text-transparent'
                        }`}>
                          <CheckCircle2 size={16} className={isSelected ? 'block' : 'opacity-0'} />
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-gray-600 text-xs md:text-sm leading-relaxed">
                        {category.description}
                      </p>

                      {/* Examples */}
                      <p className="text-[11px] text-gray-400 font-mono">
                        {category.examples}
                      </p>
                    </div>

                    {/* Footer Tag */}
                    <div className="pt-4 mt-2 border-t border-gray-100/80 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-500">
                        {isSelected ? '✓ Selected offering' : 'Click to select'}
                      </span>
                      {category.isAvailableNow ? (
                        <span className="text-emerald-700 font-bold">Active Branch</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Coming in Stage 3E</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Invariant Note: Eateries Exclusion */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-start gap-2.5">
              <Info size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <span>
                <strong>Note on Restaurants & Eateries:</strong> Dining establishments are not partner inventory and are discovered directly by travelers through MozBook's Google Places map directory.
              </span>
            </div>

            {/* Bottom Actions Bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-semibold text-gray-900">
                  {selectedKeys.length} of {PARTNER_CATEGORIES.length}
                </span>
                <span className="text-gray-500 ml-1.5">
                  categories selected
                </span>
                {selectedKeys.length > 1 && (
                  <span className="ml-2 text-xs font-bold text-[#009A60] bg-[#e6f7f0] px-2 py-0.5 rounded-full">
                    Multi-service partner
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  to="/host"
                  className="w-full sm:w-auto text-center px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={selectedKeys.length === 0}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
                    selectedKeys.length > 0
                      ? 'bg-[#009A60] hover:bg-[#008250] text-white cursor-pointer hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
