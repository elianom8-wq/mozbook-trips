import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Phone, 
  ShieldAlert, 
  Flame, 
  HeartPulse, 
  MapPin, 
  Search, 
  Copy, 
  Check, 
  Navigation, 
  Radio, 
  Building2,
  ExternalLink,
  Compass,
  Mail,
  Hospital,
  Globe2,
  Ambulance,
  Map,
  X,
  Share2,
  MessageSquare,
  Lock,
  EyeOff
} from 'lucide-react';
import { 
  EMERGENCY_SERVICES_DATA, 
  HOSPITALS_DATA, 
  EMBASSIES_DATA, 
  EmergencyEntry, 
  HospitalEntry, 
  EmbassyEntry 
} from '../data/emergencyDirectory';
import { permissionService } from '../services/permissionService';

type DirectoryTab = 'services' | 'hospitals' | 'embassies';

export default function EmergencyDirectory() {
  const [activeTab, setActiveTab] = useState<DirectoryTab>('services');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters for Emergency Services & Hospitals
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedOwnership, setSelectedOwnership] = useState<string>('all');

  // Filters for Embassies
  const [selectedEmbassyRole, setSelectedEmbassyRole] = useState<string>('all');

  // GPS Coordinates Sharing
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsCopied, setCoordsCopied] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleGetGps = async () => {
    setLoadingGps(true);
    setGpsError(null);
    const res = await permissionService.requestLocation();
    setLoadingGps(false);
    if (res.success && res.coords) {
      setCurrentCoords(res.coords);
    } else {
      setGpsError(res.error || 'Unable to retrieve your location. Please check location permissions in phone settings.');
    }
  };

  const getEmergencyMessage = (coords: { lat: number; lng: number }) => {
    return `EMERGENCY SOS: My exact GPS location in Mozambique is Latitude: ${coords.lat}, Longitude: ${coords.lng} (Maps: https://maps.google.com/?q=${coords.lat},${coords.lng})`;
  };

  const handleCopyCoords = () => {
    if (!currentCoords) return;
    const text = getEmergencyMessage(currentCoords);
    navigator.clipboard.writeText(text);
    setCoordsCopied(true);
    setTimeout(() => setCoordsCopied(false), 3000);
  };

  const handleShareWhatsApp = () => {
    if (!currentCoords) return;
    const msg = encodeURIComponent(getEmergencyMessage(currentCoords));
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleShareSms = () => {
    if (!currentCoords) return;
    const msg = encodeURIComponent(getEmergencyMessage(currentCoords));
    window.location.href = `sms:?&body=${msg}`;
  };

  const handleNativeShare = async () => {
    if (!currentCoords) return;
    const msg = getEmergencyMessage(currentCoords);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SOS Emergency Location - Mozambique',
          text: msg,
          url: `https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`
        });
      } catch {
        handleCopyCoords();
      }
    } else {
      handleCopyCoords();
    }
  };

  const handleClearCoords = () => {
    setCurrentCoords(null);
    setCoordsCopied(false);
    setGpsError(null);
  };

  const handleCopyContact = (id: string, contact: string) => {
    navigator.clipboard.writeText(contact);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Provinces list
  const provinces = [
    'all',
    'Maputo City',
    'Maputo Province',
    'Gaza',
    'Inhambane',
    'Sofala',
    'Manica',
    'Tete',
    'Zambézia',
    'Nampula',
    'Niassa',
    'Cabo Delgado'
  ];

  // Distinct roles for Emergency Services
  const serviceRoles = [
    'all',
    'Police / Law Enforcement',
    'Ambulance / Medical Emergency',
    'Fire / Rescue',
    'Disaster Coordination',
    'Administration'
  ];

  // Distinct roles for Hospitals & Clinics
  const hospitalRoles = [
    'all',
    'Central Hospital',
    'General Hospital',
    'Provincial Hospital',
    'Health Center',
    'Clinic',
    'Private Hospital',
    'Specialty Clinic',
    'Psychiatric Hospital'
  ];

  // National Quick Lines (Emergency Services)
  const nationalLines = EMERGENCY_SERVICES_DATA.filter((e) => e.level === 'National');

  // Filter Emergency Services
  const filteredServices = EMERGENCY_SERVICES_DATA.filter((entry) => {
    if (selectedLevel !== 'all' && entry.level.toLowerCase() !== selectedLevel.toLowerCase()) return false;
    if (selectedProvince !== 'all' && entry.province !== 'All' && entry.province.toLowerCase() !== selectedProvince.toLowerCase()) return false;
    if (selectedRole !== 'all' && !entry.role.toLowerCase().includes(selectedRole.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (
        entry.service.toLowerCase().includes(q) ||
        entry.city.toLowerCase().includes(q) ||
        entry.province.toLowerCase().includes(q) ||
        entry.role.toLowerCase().includes(q) ||
        entry.contact.toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    return true;
  });

  // Filter Hospitals & Clinics
  const filteredHospitals = HOSPITALS_DATA.filter((entry) => {
    if (selectedLevel !== 'all' && entry.level.toLowerCase() !== selectedLevel.toLowerCase()) return false;
    if (selectedOwnership !== 'all' && entry.ownership.toLowerCase() !== selectedOwnership.toLowerCase()) return false;
    if (selectedProvince !== 'all' && entry.province !== 'All' && entry.province.toLowerCase() !== selectedProvince.toLowerCase()) return false;
    if (selectedRole !== 'all' && !entry.role.toLowerCase().includes(selectedRole.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (
        entry.facilityName.toLowerCase().includes(q) ||
        entry.city.toLowerCase().includes(q) ||
        entry.province.toLowerCase().includes(q) ||
        entry.role.toLowerCase().includes(q) ||
        entry.ownership.toLowerCase().includes(q) ||
        entry.address.toLowerCase().includes(q) ||
        entry.contact.toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    return true;
  });

  // Filter Embassies
  const filteredEmbassies = EMBASSIES_DATA.filter((entry) => {
    if (selectedEmbassyRole !== 'all' && entry.role.toLowerCase() !== selectedEmbassyRole.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (
        entry.country.toLowerCase().includes(q) ||
        entry.facilityName.toLowerCase().includes(q) ||
        entry.address.toLowerCase().includes(q) ||
        entry.contact.toLowerCase().includes(q) ||
        (entry.email && entry.email.toLowerCase().includes(q))
      );
      if (!match) return false;
    }
    return true;
  });

  const getServiceRoleIcon = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('police')) return ShieldAlert;
    if (r.includes('ambulance') || r.includes('medical')) return HeartPulse;
    if (r.includes('fire') || r.includes('rescue')) return Flame;
    if (r.includes('disaster')) return Radio;
    return Building2;
  };

  const getServiceBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('police')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (r.includes('ambulance') || r.includes('medical')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (r.includes('fire') || r.includes('rescue')) return 'bg-red-50 text-red-700 border-red-200';
    if (r.includes('disaster')) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getHospitalBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('central')) return 'bg-red-50 text-red-700 border-red-200 font-bold';
    if (r.includes('private')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (r.includes('clinic')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (r.includes('provincial')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (r.includes('health center')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const resetFilters = () => {
    setSelectedProvince('all');
    setSelectedRole('all');
    setSelectedLevel('all');
    setSelectedOwnership('all');
    setSelectedEmbassyRole('all');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-36 pt-6 px-4 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Main Urgent Header Banner */}
        <div className="bg-gradient-to-br from-red-600 via-red-700 to-rose-900 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold">
              <AlertTriangle size={14} className="text-amber-300" />
              <span>Official Mozambique Directory · Emergency Services, Hospitals & Diplomatic Missions</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Emergency Services & Directory
            </h1>
            <p className="text-white/90 text-sm md:text-base leading-relaxed">
              Verified directory for rapid emergency contacts across Mozambique. Access nationwide police (PRM), ambulances (INEM), fire stations (SNSP), 24/7 central hospitals with GPS coordinates, and foreign embassies in Maputo.
            </p>

            {/* Quick 1-Tap National Calling Grid */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {nationalLines.map((nat) => {
                const Icon = getServiceRoleIcon(nat.role);
                return (
                  <div
                    key={nat.id}
                    className="bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm rounded-2xl p-3.5 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 text-white/90">
                        <Icon size={16} className="text-amber-300 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                          {nat.role.split('/')[0].trim()}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-white line-clamp-1">
                        {nat.service}
                      </h4>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/15">
                      <span className="font-mono font-black text-sm text-white">
                        {nat.displayContact || nat.contact}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${nat.primaryDial}`}
                          className="px-2.5 py-1 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                          title={`Dial ${nat.primaryDial}`}
                        >
                          <Phone size={11} />
                          <span>{nat.primaryDial}</span>
                        </a>
                        {nat.altDial && (
                          <a
                            href={`tel:${nat.altDial}`}
                            className="px-2 py-1 bg-white/20 text-white hover:bg-white/30 rounded-lg text-xs font-bold cursor-pointer"
                            title={`Dial alternative ${nat.altDial}`}
                          >
                            <span>{nat.altDial}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GPS Emergency Broadcast Tool */}
        <div className="bg-white rounded-3xl p-6 border-2 border-red-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <Navigation size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block">
                  Traveler Safety · Rapid Location Sharing
                </span>
                <h3 className="font-bold text-gray-900 text-base">
                  Broadcast Exact Coordinates to Responders
                </h3>
                <p className="text-xs text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
                  Quickly copy your current latitude and longitude to send via WhatsApp, SMS, or phone call when communicating with local rescue, medical evacuations, or police patrols.
                </p>

                {currentCoords && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="text-xs font-mono font-bold text-gray-900 bg-red-50/80 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <MapPin size={13} className="text-red-600" />
                      <span>Lat: {currentCoords.lat}, Lng: {currentCoords.lng}</span>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>Preview Pin</span>
                    </a>
                  </div>
                )}

                {gpsError && (
                  <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>{gpsError}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
              {!currentCoords ? (
                <button
                  type="button"
                  onClick={handleGetGps}
                  disabled={loadingGps}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Navigation size={14} className={loadingGps ? 'animate-spin' : ''} />
                  <span>{loadingGps ? 'Acquiring GPS Satellite Fix...' : 'Acquire My GPS Coordinates'}</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCopyCoords}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Copy SOS message with exact latitude & longitude"
                  >
                    {coordsCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{coordsCopied ? 'Copied to Clipboard' : 'Copy SOS Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Send SOS message with coordinates directly to WhatsApp contact"
                  >
                    <Share2 size={14} />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareSms}
                    className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl border border-gray-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Open SMS composer with coordinates pre-filled"
                  >
                    <MessageSquare size={14} />
                    <span className="hidden sm:inline">SMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCoords}
                    className="p-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                    title="Clear retrieved coordinates from memory"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Critical Operational & Cybersecurity Warning Banner */}
          <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 flex items-start gap-3">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                  CRITICAL WARNING: USE ONLY FOR GENUINE EMERGENCIES
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  ANTI-TRACKING ADVISORY
                </span>
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                <strong>Anti-Surveillance &amp; Kidnapping / Banditry Risk:</strong> Transmitting live GPS coordinates establishes an exact physical location trace. 
                Do <strong>not</strong> share your location routinely, post coordinates to public channels, or forward them over unverified networks. Threat actors, hackers, and highway interception crews can intercept broadcast data to track traveler movements in remote transit corridors. 
                Only disclose coordinates directly to verified national police (PRM), licensed aeromedical evacuation operators, or official consular duty officers during life-threatening crises. Clear your coordinates when resolved.
              </p>
            </div>
          </div>
        </div>

        {/* Directory Category Segmented Controller */}
        <div className="border-b border-gray-200 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-gray-200/70 rounded-2xl w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab('services');
                resetFilters();
              }}
              className={`w-full px-4 py-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <ShieldAlert size={16} className={activeTab === 'services' ? 'text-red-600' : ''} />
              <span className="truncate">Emergency Services</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {EMERGENCY_SERVICES_DATA.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('hospitals');
                resetFilters();
              }}
              className={`w-full px-4 py-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'hospitals'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Hospital size={16} className={activeTab === 'hospitals' ? 'text-emerald-600' : ''} />
              <span className="truncate">Hospitals & Clinics</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {HOSPITALS_DATA.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('embassies');
                resetFilters();
              }}
              className={`w-full px-4 py-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'embassies'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Globe2 size={16} className={activeTab === 'embassies' ? 'text-blue-600' : ''} />
              <span className="truncate">Embassies & Consulates</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {EMBASSIES_DATA.length}
              </span>
            </button>
          </div>
        </div>

        {/* Filter and Search Section */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'services'
                    ? "Search services, city (Maputo, Beira, Pemba), or phone..."
                    : activeTab === 'hospitals'
                    ? "Search hospital name, city, province, address, or phone..."
                    : "Search embassy country (USA, UK, Germany, Brazil...), address, or email..."
                }
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Level / Role Selector for Active Tab */}
            {activeTab !== 'embassies' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">Level:</span>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="all">All Levels</option>
                  <option value="national">National Only</option>
                  <option value="provincial">Provincial Stations</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 whitespace-nowrap">Mission:</span>
                <select
                  value={selectedEmbassyRole}
                  onChange={(e) => setSelectedEmbassyRole(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Diplomatic Missions ({EMBASSIES_DATA.length})</option>
                  <option value="embassy">Embassies ({EMBASSIES_DATA.filter(e => e.role === 'Embassy').length})</option>
                  <option value="high commission">High Commissions ({EMBASSIES_DATA.filter(e => e.role === 'High Commission').length})</option>
                </select>
              </div>
            )}
          </div>

          {/* Province Filter Tabs for Services and Hospitals */}
          {activeTab !== 'embassies' && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Filter by Province:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {provinces.map((prov) => {
                  const targetData = activeTab === 'services' ? EMERGENCY_SERVICES_DATA : HOSPITALS_DATA;
                  const count = prov === 'all'
                    ? targetData.length
                    : targetData.filter(e => e.province.toLowerCase() === prov.toLowerCase() || e.province === 'All').length;

                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setSelectedProvince(prov)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedProvince === prov
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{prov === 'all' ? 'All Mozambique' : prov}</span>
                      <span className="ml-1.5 text-[10px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Role Filter Pills */}
          {activeTab === 'services' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-xs font-bold text-gray-400 mr-1 whitespace-nowrap">Role:</span>
              {serviceRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedRole === r
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r === 'all' ? 'All Roles' : r}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'hospitals' && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-gray-400 mr-1 whitespace-nowrap">Ownership:</span>
                {(['all', 'Public', 'Private'] as const).map((own) => (
                  <button
                    key={own}
                    type="button"
                    onClick={() => setSelectedOwnership(own)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedOwnership === own
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {own === 'all' ? 'All Ownership' : `${own} Healthcare`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-gray-400 mr-1 whitespace-nowrap">Facility:</span>
                {hospitalRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedRole === r
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {r === 'all' ? 'All Types' : r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Directory Results Counter */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            {activeTab === 'services' && (
              <>Showing <strong>{filteredServices.length}</strong> of <strong>{EMERGENCY_SERVICES_DATA.length}</strong> emergency services</>
            )}
            {activeTab === 'hospitals' && (
              <>Showing <strong>{filteredHospitals.length}</strong> of <strong>{HOSPITALS_DATA.length}</strong> hospitals and medical clinics</>
            )}
            {activeTab === 'embassies' && (
              <>Showing <strong>{filteredEmbassies.length}</strong> of <strong>{EMBASSIES_DATA.length}</strong> foreign diplomatic missions</>
            )}
          </span>
          {(selectedProvince !== 'all' || selectedRole !== 'all' || selectedLevel !== 'all' || selectedOwnership !== 'all' || selectedEmbassyRole !== 'all' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-red-600 hover:underline font-semibold cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* TAB 1: EMERGENCY SERVICES GRID */}
        {activeTab === 'services' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((entry) => {
              const Icon = getServiceRoleIcon(entry.role);
              const badgeStyle = getServiceBadgeStyle(entry.role);
              const isNational = entry.level === 'National';

              return (
                <div
                  key={entry.id}
                  id={`service-card-${entry.id}`}
                  className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                    isNational
                      ? 'border-red-200 shadow-sm hover:shadow-md'
                      : 'border-gray-200/90 shadow-2xs hover:shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isNational
                            ? 'bg-red-100 text-red-800 font-black'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {entry.level}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <MapPin size={12} className="text-[#009A60]" />
                          <span>{entry.city}{entry.province !== 'All' && entry.province !== entry.city ? `, ${entry.province}` : ''}</span>
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 shrink-0">
                        <Icon size={16} />
                      </div>
                    </div>

                    <h3 className="font-bold text-base text-gray-900 leading-snug mb-2">
                      {entry.service}
                    </h3>

                    <div className="mb-4">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${badgeStyle}`}>
                        {entry.role}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">
                        Emergency Contact
                      </span>
                      <span className="text-sm font-bold text-gray-900 font-mono">
                        {entry.displayContact || entry.contact}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(entry.id, entry.primaryDial)}
                        className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                        title="Copy number"
                        aria-label="Copy phone number"
                      >
                        {copiedId === entry.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      <a
                        href={`tel:${entry.primaryDial}`}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title={`Call ${entry.primaryDial}`}
                      >
                        <Phone size={13} />
                        <span>Call</span>
                      </a>

                      {entry.altDial && (
                        <a
                          href={`tel:${entry.altDial}`}
                          className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          title={`Call alternative line ${entry.altDial}`}
                        >
                          <span>{entry.altDial}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: HOSPITALS & CLINICS GRID */}
        {activeTab === 'hospitals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHospitals.map((hosp) => {
              const badgeStyle = getHospitalBadgeStyle(hosp.role);
              const isNational = hosp.level === 'National';

              return (
                <div
                  key={hosp.id}
                  id={`hospital-card-${hosp.id}`}
                  className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                    isNational
                      ? 'border-emerald-200 shadow-sm hover:shadow-md'
                      : 'border-gray-200/90 shadow-2xs hover:shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isNational
                            ? 'bg-emerald-100 text-emerald-800 font-black'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {hosp.level}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          hosp.ownership === 'Private'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200/60'
                            : 'bg-sky-100 text-sky-800 border border-sky-200/60'
                        }`}>
                          {hosp.ownership}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <MapPin size={12} className="text-[#009A60]" />
                          <span>{hosp.city}{hosp.province !== 'All' && hosp.province !== hosp.city ? `, ${hosp.province}` : ''}</span>
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Hospital size={16} />
                      </div>
                    </div>

                    <h3 className="font-bold text-base text-gray-900 leading-snug mb-1.5">
                      {hosp.facilityName}
                    </h3>

                    <div className="mb-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${badgeStyle}`}>
                        {hosp.role}
                      </span>
                    </div>

                    {/* Address & GPS */}
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-2 mb-4">
                      <div className="flex items-start gap-2 text-xs text-gray-600">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{hosp.address}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-[11px]">
                        <span className="font-mono text-gray-500 font-medium">
                          {hosp.gpsCoordinates}
                        </span>
                        <a
                          href={hosp.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#009A60] hover:text-[#007a4c] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Compass size={12} />
                          <span>Maps</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Dial Action Footer */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">
                        Hospital Line
                      </span>
                      <span className="text-xs font-bold text-gray-900 font-mono">
                        {hosp.displayContact || hosp.contact}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(hosp.id, hosp.primaryDial)}
                        className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                        title="Copy phone number"
                        aria-label="Copy phone number"
                      >
                        {copiedId === hosp.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      <a
                        href={`tel:${hosp.primaryDial}`}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title={`Call ${hosp.facilityName}`}
                      >
                        <Phone size={13} />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: EMBASSIES & CONSULATES GRID */}
        {activeTab === 'embassies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEmbassies.map((emb) => {
              const isHighCommission = emb.role === 'High Commission';

              return (
                <div
                  key={emb.id}
                  id={`embassy-card-${emb.id}`}
                  className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isHighCommission
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {emb.role}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-500">
                          {emb.city}
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Globe2 size={16} />
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-1">
                      <h3 className="font-extrabold text-lg text-gray-900 tracking-tight">
                        {emb.country}
                      </h3>
                    </div>

                    <h4 className="font-medium text-xs text-gray-600 mb-3 leading-snug">
                      {emb.facilityName}
                    </h4>

                    {/* Address & Email */}
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-2 mb-4 text-xs">
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{emb.address}</span>
                      </div>

                      {emb.email && (
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60 text-gray-600">
                          <Mail size={13} className="text-gray-400 shrink-0" />
                          <a
                            href={`mailto:${emb.email}`}
                            className="text-blue-600 hover:underline font-mono text-[11px] truncate"
                            title={`Email ${emb.email}`}
                          >
                            {emb.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dial Action Footer */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0 pr-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">
                        Telephone
                      </span>
                      <span className="text-xs font-bold text-gray-900 font-mono truncate block">
                        {emb.displayContact}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {emb.primaryDial ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyContact(emb.id, emb.primaryDial!)}
                            className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                            title="Copy phone number"
                            aria-label="Copy phone number"
                          >
                            {copiedId === emb.id ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          <a
                            href={`tel:${emb.primaryDial}`}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            title={`Call ${emb.country} Embassy`}
                          >
                            <Phone size={13} />
                            <span>Call</span>
                          </a>

                          {emb.altDials && emb.altDials.length > 0 && (
                            <a
                              href={`tel:${emb.altDials[0]}`}
                              className="px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title={`Call alt ${emb.altDials[0]}`}
                            >
                              <span>Alt</span>
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">In-person</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
