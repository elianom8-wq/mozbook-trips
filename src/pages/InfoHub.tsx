import React, { useState } from 'react';
import { 
  Info, 
  Compass, 
  CreditCard, 
  Wifi, 
  Car, 
  ShieldCheck, 
  Sun, 
  Languages, 
  Search, 
  CheckCircle2,
  AlertCircle,
  Tag,
  FileText,
  Shield,
  CheckSquare,
  Users,
  Building2,
  FileCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { VEHICLE_FACTS, MINORS_AND_OWNERSHIP_FACTS, InfoHubFact } from '../data/infoHubData';
import VisaExemptionChecker from '../components/VisaExemptionChecker';
import { useSectionScroll } from '../hooks/useSectionScroll';

interface InfoSection {
  id: string;
  category: string;
  title: string;
  summary: string;
  badge?: string;
  icon: React.ElementType;
  details: string[];
  tips: string[];
}

const INFO_SECTIONS: InfoSection[] = [
  {
    id: 'visa',
    category: 'Entry & Visas',
    title: 'Mozambique Tourist Visa & Entry Protocols',
    summary: 'Streamlined tourism entry requirements for international and regional travelers.',
    badge: 'Updated 2026',
    icon: Compass,
    details: [
      'Citizens from 29 exempt countries (including South Africa, Portugal, UK, USA, Germany, Italy, Japan) pay a nominal processing fee (~650 MZN / ~$10 USD) upon arrival or via the official platform.',
      'All other international visitors should apply via the official Mozambique eVisa portal (evisa.gov.mz) at least 5 days prior to arrival.',
      'Passport must have at least 6 months validity remaining and at least 3 blank pages.',
      'Return or onward ticket along with proof of accommodation booking (e.g. your MozBook reservation voucher) is required at border control.'
    ],
    tips: [
      'Keep a printed copy or offline screenshot of your MozBook stay confirmation on your phone when passing immigration at Maputo (MPM) or land borders.'
    ]
  },
  {
    id: 'money',
    category: 'Money & Currency',
    title: 'Meticais (MZN), Cards & Cash Guidelines',
    summary: 'Practical guidance for payments, cash exchanges, and ATM reliability.',
    badge: 'Essential',
    icon: CreditCard,
    details: [
      'The official currency is the Mozambican Metical (MZN). Symbol: MT / MZN.',
      'South African Rand (ZAR) is widely accepted in southern holiday towns like Ponta do Ouro and Malongane. US Dollars (USD) are standard for high-end safari lodges and ocean excursions.',
      'Major ATMs (Millennium BIM, BCI, Standard Bank) are available in all major cities (Maputo, Inhambane, Vilankulo, Beira). Visa is accepted almost everywhere; Mastercard works at most BIM & Standard Bank ATMs.',
      'Notify your bank before traveling to prevent international transaction fraud blocks.'
    ],
    tips: [
      'Carry enough cash Meticais when driving outside major towns or heading to remote beach lodges where card terminals can occasionally lose cellular signal.'
    ]
  },
  {
    id: 'telecom',
    category: 'SIM Cards & Internet',
    title: 'Mobile SIM Cards & 4G/5G Connectivity',
    summary: 'How to purchase reliable mobile data cards upon landing or at local kiosks.',
    badge: 'Vodacom & Movitel',
    icon: Wifi,
    details: [
      'Vodacom Mozambique has the fastest and most widespread 4G LTE coverage across Maputo, EN1 highway corridors, and coastal resort hubs.',
      'Movitel offers solid coverage in rural villages, inland provinces, and national park perimeters.',
      'SIM cards cost approximately 50 to 100 MZN and require your passport for mandatory biometric registration (available right inside Maputo International Airport arrivals hall).',
      'Data packages are affordable: ~500 MZN ($8 USD) gets you roughly 10GB to 15GB of valid data.'
    ],
    tips: [
      'Most MozBook properties offer complimentary Wi-Fi, but having a local Vodacom SIM allows you to navigate GPS smoothly when exploring back-roads.'
    ]
  },
  {
    id: 'driving',
    category: 'Road Travel & 4x4',
    title: 'Driving Regulations, 4x4 Tips & Police Checkpoints',
    summary: 'Everything you need to know about driving on Mozambican roads and sandy tracks.',
    badge: 'Safety Alert',
    icon: Car,
    details: [
      'Traffic drives on the left-hand side of the road. Speed limits: 60 km/h in towns/villages, 100 km/h or 120 km/h on open highways.',
      'Southern sand roads (e.g., Ponta do Ouro, Inhaca, Macaneta) strictly require a 4x4 vehicle. Deflate tires to 1.2 – 1.4 bar before hitting loose sand tracks.',
      'Compulsory vehicle equipment: 2 reflective warning triangles, reflective safety vests for occupants, and valid third-party insurance (available at border crossings).',
      'Police checkpoints (PRM) are routine along the EN1. Always be polite, produce your valid driver’s license (International Driving Permit recommended), passport, and vehicle registration with temporary import permit (TIP).'
    ],
    tips: [
      'Never drive at night on rural highways due to unlit livestock, pedestrians, and occasional potholes.'
    ]
  },
  {
    id: 'health',
    category: 'Health & Wellness',
    title: 'Malaria Prevention, Drinking Water & Medical Care',
    summary: 'Stay healthy and safe during your beach holidays and bush adventures.',
    badge: 'Health Advice',
    icon: ShieldCheck,
    details: [
      'Mozambique is in a malaria transmission zone. Consult a travel clinic for preventative prophylaxis (e.g., Malarone or Doxycycline) before departure.',
      'Use mosquito repellent (DEET 30%+) at dusk and sleep under insect netting provided in all MozBook guest bedrooms.',
      'Drink bottled or filtered water in rural and coastal areas. High-end Maputo accommodations usually have treated water systems.',
      'Comprehensive travel insurance with medical evacuation cover (such as MARS or Netcare 911) is strongly recommended.'
    ],
    tips: [
      'Check the Emergency tab on the bottom bar for direct one-tap dialing to Mozambique emergency services and regional hospitals.'
    ]
  },
  {
    id: 'climate',
    category: 'Climate & Seasons',
    title: 'Best Time to Visit Mozambique',
    summary: 'Seasonal weather patterns, whale watching windows, and scuba diving calendar.',
    badge: 'Weather Guide',
    icon: Sun,
    details: [
      'May to October (Dry & Mild Season): The optimal time for pleasant sunny weather, minimal rain, and low humidity. Temperatures average 24°C–28°C.',
      'July to October: Peak Humpback Whale migration along the Mozambican coastline (Ponta do Ouro, Tofo, Bazaruto).',
      'November to April (Warm & Tropical Summer): Hotter weather (30°C–34°C) with occasional afternoon thunderstorms. Ideal sea temperatures for warm-water diving.',
      'Year-Round: Tofo is famous worldwide for year-round whale shark and manta ray sightings.'
    ],
    tips: [
      'Bring a light windbreaker jacket for breezy evening ocean dhow cruises and morning boat launches.'
    ]
  },
  {
    id: 'language',
    category: 'Culture & Language',
    title: 'Local Customs, Portuguese & Changana Phrases',
    summary: 'Warm greetings and respectful cultural etiquette to connect with locals.',
    badge: 'Phrases & Etiquette',
    icon: Languages,
    details: [
      'Portuguese is the official language. Local languages like Changana (South), Sena (Central), and Makhuwa (North) are spoken warmly across communities.',
      'Greetings are very important: always greet someone with "Bom dia" (Good morning) or "Boa tarde" (Good afternoon) before asking questions or making transactions.',
      'Tipping: 10% is customary and appreciated in restaurants and for private boat skippers, safari trackers, and transfer drivers.'
    ],
    tips: [
      'A friendly "Obrigado" (Thank you - male) or "Obrigada" (female) and "Khanimambo" (Changana for "Thank you") goes a long way!'
    ]
  }
];

export default function InfoHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { navigateToSection } = useSectionScroll();

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);

    // Auto-scroll to corresponding section
    if (cat === 'all') {
      navigateToSection('info-hub-content');
    } else if (cat === 'Visa Checker') {
      navigateToSection('mozambique-visa-checker');
    } else if (cat === 'Travel Documents & Minors') {
      navigateToSection('travel-documents-minors-section');
    } else if (cat === 'Vehicle & Ownership') {
      navigateToSection('vehicle-facts-section');
    } else {
      const match = INFO_SECTIONS.find(
        (s) => s.category.toLowerCase() === cat.toLowerCase()
      );
      if (match) {
        navigateToSection(`info-card-${match.id}`);
      } else {
        navigateToSection('info-hub-content');
      }
    }
  };

  const categories = [
    'all', 
    'Visa Checker',
    'Travel Documents & Minors',
    'Vehicle & Ownership', 
    'Road Travel & 4x4', 
    'Entry & Visas', 
    'Money & Currency', 
    'SIM Cards & Internet', 
    'Health & Wellness', 
    'Climate & Seasons', 
    'Culture & Language'
  ];

  const travelDocFacts = MINORS_AND_OWNERSHIP_FACTS.filter(f => f.factType === 'Travel Document');
  const ownershipFacts = MINORS_AND_OWNERSHIP_FACTS.filter(f => f.factType === 'Vehicle');
  const allVehicleFacts = [...VEHICLE_FACTS, ...ownershipFacts];

  const filteredTravelDocFacts = travelDocFacts.filter((fact) => {
    if (selectedCategory === 'Visa Checker') {
      return false;
    }
    if (selectedCategory !== 'all' && selectedCategory !== 'Travel Documents & Minors') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        fact.title.toLowerCase().includes(q) ||
        fact.description.toLowerCase().includes(q) ||
        fact.factType.toLowerCase().includes(q) ||
        fact.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  }).sort((a, b) => a.priority - b.priority);

  const filteredVehicleFacts = allVehicleFacts.filter((fact) => {
    if (selectedCategory === 'Visa Checker') {
      return false;
    }
    if (selectedCategory !== 'all' && selectedCategory !== 'Vehicle & Ownership') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        fact.title.toLowerCase().includes(q) ||
        fact.description.toLowerCase().includes(q) ||
        fact.factType.toLowerCase().includes(q) ||
        fact.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  }).sort((a, b) => a.priority - b.priority);

  const filteredSections = INFO_SECTIONS.filter((section) => {
    if (selectedCategory === 'Visa Checker' || selectedCategory === 'Vehicle & Ownership' || selectedCategory === 'Travel Documents & Minors') {
      return false;
    }
    if (selectedCategory !== 'all' && section.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        section.title.toLowerCase().includes(q) ||
        section.summary.toLowerCase().includes(q) ||
        section.category.toLowerCase().includes(q) ||
        section.details.some((d) => d.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalResults = filteredTravelDocFacts.length + filteredVehicleFacts.length + filteredSections.length;

  return (
    <div className="min-h-screen bg-gray-50/60 pb-32 pt-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-br from-[#009A60] via-[#008250] to-[#005e3a] rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-semibold">
              <Info size={14} />
              <span>MozBook Traveler Guide</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Mozambique Information Hub
            </h1>
            <p className="text-white/85 text-sm md:text-base leading-relaxed">
              Everything you need for a safe, smooth, and unforgettable journey — from visa protocols and 4x4 driving tips to local currencies, telecom SIMs, and cultural etiquette.
            </p>

            {/* Quick search input */}
            <div className="pt-2">
              <div className="relative max-w-lg">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search visas, currency, 4x4, SIM cards, malaria..."
                  className="w-full pl-11 pr-4 py-3 bg-white text-gray-900 rounded-2xl text-sm placeholder-gray-400 shadow-md focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Filter Categories */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleSelectCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#009A60] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat === 'all' ? 'All Information' : cat}
            </button>
          ))}
        </div>

        <div id="info-hub-content" className="space-y-8 scroll-mt-24">
          {/* Priority Tool: Mozambique Visa Exemption & ETA Checker */}
          {(selectedCategory === 'all' || 
            selectedCategory === 'Visa Checker' || 
            selectedCategory === 'Entry & Visas' || 
            selectedCategory === 'Travel Documents & Minors') && (
            <div id="visa-checker-section" className="scroll-mt-24">
              <VisaExemptionChecker />
            </div>
          )}

          {/* Travel Documents & Minors Section */}
          {filteredTravelDocFacts.length > 0 && (
            <section id="travel-documents-minors-section" className="space-y-4 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Users size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                      Travel Documents & Minors Checklist
                    </h2>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      FactType: Travel Document
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Passport validity, unabridged birth certificates & parental consent affidavits (Annexure A, C & D) for minors.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100">
                  {filteredTravelDocFacts.length} Required Protocols
                </span>
              </div>
            </div>

            {/* Travel Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredTravelDocFacts.map((fact) => {
                const isMinorsCard = fact.title.toLowerCase().includes('children') || fact.tags.includes('children');

                return (
                  <article
                    key={fact.id}
                    id={`travel-doc-fact-${fact.priority}`}
                    className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
                  >
                    <div>
                      {/* Fact Header: FactType & Priority Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
                          <FileText size={13} />
                          <span>{fact.factType}</span>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950 text-white text-[11px] font-extrabold shadow-2xs">
                          <span>Priority {fact.priority}</span>
                        </div>
                      </div>

                      {/* Fact Title */}
                      <h3 className="text-base font-bold text-gray-900 leading-snug mb-3 group-hover:text-indigo-600 transition-colors">
                        {fact.title}
                      </h3>

                      {/* Description */}
                      <div className="text-xs text-gray-700 leading-relaxed mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-normal">
                        {fact.description}
                      </div>

                      {/* Key Annexures Highlight for Minors */}
                      {isMinorsCard && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 mb-4">
                          <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <AlertCircle size={13} className="text-amber-600" />
                            <span>Mandatory Legal Annexures & Certificates</span>
                          </span>
                          <ul className="text-xs text-amber-950 space-y-1.5 font-medium">
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span><strong>Unabridged Birth Certificate (UBC)</strong> or Passport listing both parents' details</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span><strong>Annexure A Letter:</strong> If applied for UBC and pending issuance by Dept of Home Affairs</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span><strong>Annexure C (Parental Consent Affidavit):</strong> If one or both parents are not accompanying</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-600 font-bold">•</span>
                              <span><strong>Annexure D:</strong> Consent Affidavit specifically in respect of School Tours</span>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Tags Footer */}
                    <div className="pt-3 border-t border-gray-100 mt-auto">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag size={12} className="text-gray-400 shrink-0" />
                        {fact.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSearchQuery(tag)}
                            title={`Filter by tag: #${tag}`}
                            className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Vehicle Facts Section */}
        {filteredVehicleFacts.length > 0 && (
          <section id="vehicle-facts-section" className="space-y-4 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#009A60] text-white flex items-center justify-center shadow-xs">
                  <Car size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                      Vehicle & Ownership Protocols
                    </h2>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e6f7f0] text-[#006b42] border border-[#a4e4c7]">
                      FactType: Vehicle
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Official cross-border requirements, SORCA insurance, TIP permits, safety gear & ownership authorizations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700">
                  {filteredVehicleFacts.length} Verified Facts • Priority Ordered
                </span>
              </div>
            </div>

            {/* Vehicle Facts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVehicleFacts.map((fact) => {
                // If description contains semicolons or is the checklist, split into clean items
                const isChecklist = fact.priority === 7 || fact.title.toLowerCase().includes('checklist');
                const checklistItems = isChecklist 
                  ? fact.description.split(';').map(item => item.trim()).filter(Boolean)
                  : [];

                const isOwnership = fact.title.toLowerCase().includes('ownership');

                return (
                  <article
                    key={fact.id}
                    id={`vehicle-fact-${fact.id}`}
                    className={`bg-white rounded-3xl p-6 border ${
                      isOwnership ? 'border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/20' : 'border-gray-200/90'
                    } shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group`}
                  >
                    <div>
                      {/* Fact Header: FactType & Priority Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-[#006b42] text-[11px] font-bold border border-emerald-200/80">
                          {isOwnership ? <Building2 size={13} /> : <Car size={13} />}
                          <span>{fact.factType}</span>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-extrabold shadow-2xs">
                          <span>Priority {fact.priority}</span>
                        </div>
                      </div>

                      {/* Fact Title */}
                      <h3 className="text-base font-bold text-gray-900 leading-snug mb-3 group-hover:text-[#009A60] transition-colors">
                        {fact.title}
                      </h3>

                      {/* Fact Description */}
                      {isChecklist && checklistItems.length > 0 ? (
                        <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/90 mb-4 space-y-2">
                          <div className="text-[11px] font-bold text-[#006b42] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <CheckSquare size={13} />
                            <span>Required Border & Customs Items</span>
                          </div>
                          {checklistItems.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle2 size={14} className="text-[#009A60] shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-800 font-medium leading-relaxed">
                                {item.replace(/^✅\s*/, '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-700 leading-relaxed mb-4 whitespace-pre-line bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100 font-normal">
                          {fact.description}
                        </div>
                      )}
                    </div>

                    {/* Tags Footer */}
                    <div className="pt-3 border-t border-gray-100 mt-auto">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag size={12} className="text-gray-400 shrink-0" />
                        {fact.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSearchQuery(tag)}
                            title={`Filter by tag: #${tag}`}
                            className="text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-[#e6f7f0] hover:text-[#006b42] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* General Guidelines Section Header if showing both */}
        {filteredSections.length > 0 && selectedCategory === 'all' && (
          <div className="pt-4 border-t border-gray-200">
            <h2 className="text-xl font-black text-gray-900 tracking-tight mb-1">
              General Travel & Regional Guidelines
            </h2>
            <p className="text-xs text-gray-600">
              Passports, currency exchange, mobile connectivity, health advisories, and local customs.
            </p>
          </div>
        )}

        {/* Info Grid */}
        {filteredSections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  id={`info-card-${section.id}`}
                  className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center shadow-xs">
                          <Icon size={24} />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                            {section.category}
                          </span>
                          <h2 className="text-lg font-bold text-gray-900 leading-snug">
                            {section.title}
                          </h2>
                        </div>
                      </div>

                      {section.badge && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                          {section.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                      {section.summary}
                    </p>

                    {/* Bullet points */}
                    <div className="space-y-2.5 mb-6">
                      {section.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="text-[#009A60] shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-700 leading-relaxed">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MozBook Host Pro Tip Box */}
                  {section.tips.length > 0 && (
                    <div className="bg-[#e6f7f0]/60 border border-[#a4e4c7] rounded-2xl p-3.5 mt-auto flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-[#009A60] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-bold text-[#008250] block">
                          MozBook Travel Tip
                        </span>
                        <p className="text-xs text-gray-700 mt-0.5">
                          {section.tips[0]}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state if nothing matches search */}
        {totalResults === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <Search size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">No matching guides found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No results for "{searchQuery}". Try searching for driving, insurance, sorca, visa, or SIM cards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-5 py-2.5 bg-[#009A60] text-white text-xs font-bold rounded-xl hover:bg-[#008250] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
        </div>

        {/* Quick Links Footer Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-gray-900">
              Need personalized assistance or emergency support?
            </h3>
            <p className="text-xs text-gray-500">
              Our local concierge and verified MozBook hosts are always here to help you navigate Mozambique.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to="/emergency"
              className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors text-center border border-red-200"
            >
              Emergency Directory
            </Link>
            <Link
              to="/trips"
              className="flex-1 md:flex-none px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-colors text-center shadow-xs"
            >
              Explore MozBook Trips
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
