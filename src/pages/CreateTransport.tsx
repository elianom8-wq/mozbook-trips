import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Car, 
  Plane, 
  Navigation, 
  UserCheck, 
  Bus, 
  Anchor, 
  Wind, 
  Compass, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  MapPin, 
  Users, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Luggage, 
  Tag, 
  Info,
  Building2,
  Calendar,
  Phone,
  Mail,
  FileText,
  Edit3,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Eye,
  Camera,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  TransportCategory, 
  CONTROLLED_TRANSPORT_CATEGORIES, 
  TransportPricingType, 
  TransportStatus,
  COMMON_TRANSPORT_INCLUSIONS,
  COMMON_TRANSPORT_REQUIREMENTS,
  TransportOffering,
  TransportVehicle,
  TransportOperatingMember,
  TransportOperatingMemberRole
} from '../types/transport';
import { 
  createTransportService, 
  updateTransportService, 
  getTransportServiceById 
} from '../services/transportService';
import { 
  calculateCommission, 
  MOZBOOK_COMMISSION_PERCENT, 
  PARTNER_SHARE_PERCENT 
} from '../config/platformCommission';

// Sample curated photos for Mozambique transport offerings
const PRESET_TRANSPORT_PHOTOS = [
  { label: 'Executive Airport Sedan', url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Safari Rigged 4x4 Cruiser', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Coastal Minibus Shuttle', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Twin Outboard Speedboat', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Helicopter Aviation Shuttle', url: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Sand Track 4x4 Double Cab', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80' }
];

const MOZAMBIQUE_HUBS = [
  'Maputo',
  'Vilankulo',
  'Tofo / Inhambane',
  'Ponta do Ouro',
  'Pemba',
  'Beira',
  'Nampula',
  'Gorongosa',
  'Bilene',
  'Inhaca Island'
];

export default function CreateTransport() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 5;
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: Category & Service Basics
  const [category, setCategory] = useState<TransportCategory>('Airport Transfer');
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Maputo');
  const [serviceArea, setServiceArea] = useState('Maputo International Airport to City & Catembe');

  // Step 2: Multiple Vehicles / Vessels (Gap #1 & Gap #2)
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([
    {
      id: 'veh_' + Date.now() + '_1',
      name: 'Primary Passenger Vehicle',
      transportType: 'Toyota Quantum Minibus (14-seater)',
      make: 'Toyota',
      model: 'Quantum GL',
      year: '2023',
      registrationNumber: 'AIH-421-MC',
      licenseNumber: 'MZ-TRANSP-8419',
      capacity: 10,
      luggageCapacity: 10,
      description: 'Air-conditioned cabin, high roof, tint windows, charging ports, clean interior.',
      images: [PRESET_TRANSPORT_PHOTOS[2].url],
      active: true
    }
  ]);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [newVehicleImageUrl, setNewVehicleImageUrl] = useState<{ [vehId: string]: string }>({});

  // Step 3: Multiple Operating Members (Gap #3)
  const [operatingMembers, setOperatingMembers] = useState<TransportOperatingMember[]>([
    {
      id: 'mem_' + Date.now() + '_1',
      fullName: user?.displayName || 'Lead Operator',
      role: 'Operations Manager',
      phone: user?.phoneNumber || '+258 84 100 2000',
      email: user?.email || '',
      licenseOrIdRef: 'Carta Profissional Cat C/D',
      active: true
    }
  ]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Step 4: Route Logistics & Pricing
  const [pickupInput, setPickupInput] = useState('');
  const [pickupLocations, setPickupLocations] = useState<string[]>(['Maputo International Airport (MPM)']);
  const [dropoffInput, setDropoffInput] = useState('');
  const [dropoffLocations, setDropoffLocations] = useState<string[]>(['Polana Serena Hotel', 'Radisson Blu', 'Catembe Beach']);
  const [pricingType, setPricingType] = useState<TransportPricingType>('per_vehicle');
  const [price, setPrice] = useState<number>(2500);
  const [selectedInclusions, setSelectedInclusions] = useState<string[]>([
    'Professional English & Portuguese speaking driver',
    'Fuel & highway toll charges included',
    'Flight tracking & airport terminal meet-and-greet',
    'Air-conditioned clean cabin',
    'Complimentary chilled mineral water'
  ]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([
    'Flight details and arrival schedule required upon booking',
    'Valid passport / identification for intercity or border transit'
  ]);

  // Step 5: Service Media & Status
  const [images, setImages] = useState<string[]>([PRESET_TRANSPORT_PHOTOS[0].url]);
  const [coverImage, setCoverImage] = useState<string>(PRESET_TRANSPORT_PHOTOS[0].url);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [status, setStatus] = useState<TransportStatus>('published');

  // Load existing service if editing
  useEffect(() => {
    if (id) {
      getTransportServiceById(id).then(item => {
        if (item) {
          setCategory(item.category);
          setTitle(item.title);
          setShortDescription(item.shortDescription || '');
          setDescription(item.description || '');
          setCity(item.city || 'Maputo');
          setServiceArea(item.route?.serviceArea || '');
          setPickupLocations(item.route?.pickupLocations || []);
          setDropoffLocations(item.route?.dropoffLocations || []);
          setPricingType(item.pricingType || 'per_vehicle');
          setPrice(item.price || 1500);
          setSelectedInclusions(item.included || []);
          setSelectedRequirements(item.requirements || []);
          setImages(item.images?.length ? item.images : [PRESET_TRANSPORT_PHOTOS[0].url]);
          setCoverImage(item.coverImage || (item.images?.[0] || ''));
          setStatus(item.status || 'published');

          // Backwards compatibility for vehicles
          if (item.vehicles && item.vehicles.length > 0) {
            setVehicles(item.vehicles);
          } else if (item.vehicleType) {
            setVehicles([{
              id: 'veh_legacy_' + Date.now(),
              name: item.vehicleType,
              transportType: item.vehicleType,
              make: '',
              model: '',
              capacity: item.capacity?.maxPassengers || 4,
              luggageCapacity: item.capacity?.luggageCapacityPieces || 4,
              registrationNumber: item.licensePlateOrReg || '',
              description: 'Standard operational vehicle',
              images: item.images?.length ? item.images : [PRESET_TRANSPORT_PHOTOS[0].url],
              active: true
            }]);
          }

          // Backwards compatibility for operating members
          if (item.operatingMembers && item.operatingMembers.length > 0) {
            setOperatingMembers(item.operatingMembers);
          }
        } else {
          setLoadError('Transport service not found.');
        }
      });
    }
  }, [id]);

  // Sync category defaults when switching
  const handleSelectCategory = (cat: TransportCategory) => {
    setCategory(cat);
    const meta = CONTROLLED_TRANSPORT_CATEGORIES.find(c => c.id === cat);
    if (meta) {
      setPricingType(meta.defaultPricingType);
    }
  };

  // --------------------------------------------------------------------------
  // Vehicle / Vessel Fleet Management (Gap #1 & Gap #2)
  // --------------------------------------------------------------------------
  const handleAddVehicle = () => {
    const meta = CONTROLLED_TRANSPORT_CATEGORIES.find(c => c.id === category);
    const defaultCraft = meta?.vehicleSuggestions?.[0] || 'Passenger Vehicle';
    const newVeh: TransportVehicle = {
      id: 'veh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: `${defaultCraft} #${vehicles.length + 1}`,
      transportType: defaultCraft,
      make: 'Toyota',
      model: '',
      year: '2023',
      registrationNumber: '',
      capacity: 4,
      luggageCapacity: 4,
      description: 'Clean, fully serviced, commercial insurance active.',
      images: [PRESET_TRANSPORT_PHOTOS[Math.min(vehicles.length, PRESET_TRANSPORT_PHOTOS.length - 1)].url],
      active: true
    };
    setVehicles([...vehicles, newVeh]);
    setEditingVehicleId(newVeh.id);
  };

  const handleUpdateVehicle = (vehId: string, updates: Partial<TransportVehicle>) => {
    setVehicles(vehicles.map(v => v.id === vehId ? { ...v, ...updates } : v));
  };

  const handleRemoveVehicle = (vehId: string) => {
    if (vehicles.length <= 1) {
      alert('Your transport service must have at least one vehicle or vessel.');
      return;
    }
    setVehicles(vehicles.filter(v => v.id !== vehId));
    if (editingVehicleId === vehId) setEditingVehicleId(null);
  };

  const handleToggleVehicleActive = (vehId: string) => {
    setVehicles(vehicles.map(v => v.id === vehId ? { ...v, active: !v.active } : v));
  };

  const handleAddPhotoToVehicle = (vehId: string, url: string) => {
    if (!url.trim()) return;
    setVehicles(vehicles.map(v => {
      if (v.id === vehId) {
        return {
          ...v,
          images: v.images.includes(url.trim()) ? v.images : [...v.images, url.trim()]
        };
      }
      return v;
    }));
  };

  const handleRemovePhotoFromVehicle = (vehId: string, urlToRemove: string) => {
    setVehicles(vehicles.map(v => {
      if (v.id === vehId) {
        if (v.images.length <= 1) return v; // Keep at least one
        return {
          ...v,
          images: v.images.filter(img => img !== urlToRemove)
        };
      }
      return v;
    }));
  };

  // --------------------------------------------------------------------------
  // Operating Members Management (Gap #3)
  // --------------------------------------------------------------------------
  const handleAddOperatingMember = () => {
    const newMem: TransportOperatingMember = {
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      fullName: 'New Team Driver',
      role: 'Driver',
      phone: '+258 84 ',
      email: '',
      licenseOrIdRef: 'Carta de Condução',
      active: true
    };
    setOperatingMembers([...operatingMembers, newMem]);
    setEditingMemberId(newMem.id);
  };

  const handleUpdateOperatingMember = (memId: string, updates: Partial<TransportOperatingMember>) => {
    setOperatingMembers(operatingMembers.map(m => m.id === memId ? { ...m, ...updates } : m));
  };

  const handleRemoveOperatingMember = (memId: string) => {
    if (operatingMembers.length <= 1) {
      alert('Your transport service must have at least one operating contact.');
      return;
    }
    setOperatingMembers(operatingMembers.filter(m => m.id !== memId));
    if (editingMemberId === memId) setEditingMemberId(null);
  };

  const handleToggleMemberActive = (memId: string) => {
    setOperatingMembers(operatingMembers.map(m => m.id === memId ? { ...m, active: !m.active } : m));
  };

  // --------------------------------------------------------------------------
  // Route & Location tags
  // --------------------------------------------------------------------------
  const handleAddPickup = () => {
    if (pickupInput.trim() && !pickupLocations.includes(pickupInput.trim())) {
      setPickupLocations([...pickupLocations, pickupInput.trim()]);
      setPickupInput('');
    }
  };

  const handleRemovePickup = (loc: string) => {
    setPickupLocations(pickupLocations.filter(l => l !== loc));
  };

  const handleAddDropoff = () => {
    if (dropoffInput.trim() && !dropoffLocations.includes(dropoffInput.trim())) {
      setDropoffLocations([...dropoffLocations, dropoffInput.trim()]);
      setDropoffInput('');
    }
  };

  const handleRemoveDropoff = (loc: string) => {
    setDropoffLocations(dropoffLocations.filter(l => l !== loc));
  };

  const handleToggleInclusion = (inc: string) => {
    setSelectedInclusions(prev => 
      prev.includes(inc) ? prev.filter(i => i !== inc) : [...prev, inc]
    );
  };

  const handleToggleRequirement = (req: string) => {
    setSelectedRequirements(prev => 
      prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]
    );
  };

  const handleAddCustomImage = () => {
    if (customImageUrl.trim() && !images.includes(customImageUrl.trim())) {
      const updated = [...images, customImageUrl.trim()];
      setImages(updated);
      if (!coverImage) setCoverImage(customImageUrl.trim());
      setCustomImageUrl('');
    }
  };

  const handleTogglePresetPhoto = (url: string) => {
    if (images.includes(url)) {
      if (images.length === 1) return;
      const updated = images.filter(u => u !== url);
      setImages(updated);
      if (coverImage === url) setCoverImage(updated[0]);
    } else {
      setImages([...images, url]);
    }
  };

  // Authoritative commission breakdown (15% MozBook / 85% Partner Share)
  const commissionBreakdown = calculateCommission(price);

  const handleSubmit = async () => {
    if (!user) {
      alert('Please log in with your Partner account to publish transport services.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title for your transport service.');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const primaryVeh = vehicles[0];
      const aggregatedImages = Array.from(new Set([
        ...images,
        ...vehicles.flatMap(v => v.images)
      ]));

      const payload: Omit<TransportOffering, 'id' | 'createdAt' | 'updatedAt'> = {
        hostId: user.uid,
        hostName: user.displayName || 'Mozambique Transport Partner',
        hostEmail: user.email || undefined,
        type: 'transport',
        category,
        title: title.trim(),
        shortDescription: shortDescription.trim() || `${category} operated by ${user.displayName || 'licensed partner'} in ${city}.`,
        description: description.trim() || `${title} provides professional transport across ${city} and surrounding areas.`,
        city,
        route: {
          operatingLocation: city,
          serviceArea: serviceArea.trim() || city,
          pickupLocations: pickupLocations.length ? pickupLocations : [city],
          dropoffLocations: dropoffLocations.length ? dropoffLocations : ['Customer Destination']
        },
        // Legacy compatibility sync
        vehicleType: primaryVeh?.name || primaryVeh?.transportType || 'Passenger Vehicle',
        vehicleYear: primaryVeh?.year,
        licensePlateOrReg: primaryVeh?.registrationNumber,
        capacity: {
          maxPassengers: primaryVeh?.capacity || 4,
          luggageCapacityPieces: primaryVeh?.luggageCapacity || 4
        },
        // Gap #1 & #2 Additive fleet
        vehicles,
        // Gap #3 Additive operating team
        operatingMembers,
        pricingType,
        price: Number(price) || 1000,
        currency: 'MZN',
        included: selectedInclusions,
        notIncluded: ['Gratuities / Driver Tips', 'Personal Expenses'],
        requirements: selectedRequirements,
        images: aggregatedImages.length ? aggregatedImages : [PRESET_TRANSPORT_PHOTOS[0].url],
        coverImage: coverImage || aggregatedImages[0] || PRESET_TRANSPORT_PHOTOS[0].url,
        status
      };

      if (isEditing && id) {
        await updateTransportService(id, payload);
      } else {
        await createTransportService(payload);
      }

      navigate('/partner/dashboard?tab=transport', { replace: true });
    } catch (err) {
      console.error('Failed to save transport service:', err);
      alert('Error saving transport service. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-36 pt-6 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/partner"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Partner Offerings</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-[#008250] text-xs font-bold flex items-center gap-1">
              <Car size={13} />
              <span>Transport Onboarding</span>
            </span>
          </div>
        </div>

        {/* Wizard Header Banner */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#e6f7f0] text-[#009A60] text-[10px] font-bold uppercase tracking-wider">
              {isEditing ? 'Editing Service' : 'Step ' + currentStep + ' of ' + totalSteps}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs font-semibold text-gray-600">{category}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-950 tracking-tight">
            {isEditing ? 'Edit Transport Offering & Fleet' : 'Register Transport Offering & Fleet'}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 max-w-2xl leading-relaxed">
            Manage your transport offering, multi-vehicle fleet assets, operational team members, route logistics, and MZN fares.
          </p>

          {/* Stepper Progress Bar */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { step: 1, label: '1. Category & Basics' },
              { step: 2, label: '2. Vehicles & Vessels' },
              { step: 3, label: '3. Operating Team' },
              { step: 4, label: '4. Route & Pricing' },
              { step: 5, label: '5. Photos & Publish' }
            ].map(s => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={`py-2 px-3 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                  currentStep === s.step
                    ? 'border-[#009A60] bg-[#e6f7f0] text-[#009A60]'
                    : currentStep > s.step
                    ? 'border-gray-200 bg-gray-50 text-gray-700'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{s.label}</span>
                  {currentStep > s.step && <Check size={12} className="text-[#009A60]" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold">
            {loadError}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: CATEGORY & BASICS */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-gray-900">1. Select Transport Category</h2>
              <p className="text-xs text-gray-500">Choose the controlled MozBook transport category that best fits this service</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {CONTROLLED_TRANSPORT_CATEGORIES.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'border-2 border-[#009A60] bg-emerald-50/40 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <Car size={16} />
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#009A60] text-white flex items-center justify-center">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-gray-900">{cat.label}</h3>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-1 leading-snug">{cat.shortDesc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                  Service Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Maputo International Airport (MPM) to City Hotels Private Sedan Transfer"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                    Operating Hub / City *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden cursor-pointer"
                  >
                    {MOZAMBIQUE_HUBS.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                    Coverage Area / District
                  </label>
                  <input
                    type="text"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    placeholder="e.g. Greater Maputo, Matola, Catembe, & Costa do Sol"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                  Short Summary (for listing card)
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="e.g. Direct door-to-door transfer with flight monitoring and bilingual driver."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                  Full Service Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your service, vehicle comfort, punctuality, meet-and-greet procedure, and border crossing support..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    alert('Please enter a title for your service.');
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="px-6 py-3 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Vehicles & Fleet</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: MULTIPLE VEHICLES / VESSELS & PHOTOS (GAP #1 & GAP #2) */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">2. Fleet: Vehicles & Vessels</h2>
                <p className="text-xs text-gray-500">
                  Register each actual vehicle or marine craft operated in this service with its individual photos and capacities.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVehicle}
                className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>+ Add Another Vehicle/Vessel</span>
              </button>
            </div>

            {/* List of Registered Fleet Vehicles */}
            <div className="space-y-4">
              {vehicles.map((veh, index) => {
                const isExpanded = editingVehicleId === veh.id || vehicles.length === 1;
                return (
                  <div key={veh.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/40">
                    
                    {/* Header Bar */}
                    <div className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#009A60] flex items-center justify-center font-bold text-xs shrink-0">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-gray-900">{veh.name || 'Unnamed Vehicle'}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              veh.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {veh.active ? 'Active Fleet' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {veh.transportType} · Max {veh.capacity} Passengers · {veh.luggageCapacity || 0} Bags · {veh.images.length} Photo(s)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleVehicleActive(veh.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 cursor-pointer"
                        >
                          {veh.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVehicleId(isExpanded ? null : veh.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer"
                        >
                          {isExpanded ? 'Collapse' : 'Edit Specs & Photos'}
                        </button>
                        {vehicles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVehicle(veh.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Remove vehicle"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Form & Photos Area */}
                    {isExpanded && (
                      <div className="p-5 space-y-5 bg-white">
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Asset Name / Identifier *
                            </label>
                            <input
                              type="text"
                              value={veh.name}
                              onChange={(e) => handleUpdateVehicle(veh.id, { name: e.target.value })}
                              placeholder="e.g. Safari Cruiser #1"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Make & Model
                            </label>
                            <input
                              type="text"
                              value={`${veh.make || ''} ${veh.model || ''}`.trim()}
                              onChange={(e) => {
                                const parts = e.target.value.split(' ');
                                handleUpdateVehicle(veh.id, { 
                                  make: parts[0] || '', 
                                  model: parts.slice(1).join(' ') 
                                });
                              }}
                              placeholder="e.g. Toyota Land Cruiser 79"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Mozambican Plate / Reg #
                            </label>
                            <input
                              type="text"
                              value={veh.registrationNumber || ''}
                              onChange={(e) => handleUpdateVehicle(veh.id, { registrationNumber: e.target.value })}
                              placeholder="e.g. AIH-421-MC or MZ-BOAT-19"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Max Passengers *
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={veh.capacity}
                              onChange={(e) => handleUpdateVehicle(veh.id, { capacity: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Luggage Bags
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={60}
                              value={veh.luggageCapacity || 0}
                              onChange={(e) => handleUpdateVehicle(veh.id, { luggageCapacity: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Year of Manufacture
                            </label>
                            <input
                              type="text"
                              value={veh.year || '2023'}
                              onChange={(e) => handleUpdateVehicle(veh.id, { year: e.target.value })}
                              placeholder="2023"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Commercial License
                            </label>
                            <input
                              type="text"
                              value={veh.licenseNumber || ''}
                              onChange={(e) => handleUpdateVehicle(veh.id, { licenseNumber: e.target.value })}
                              placeholder="License / Permit #"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>

                        {/* Multiple Photos specific to THIS actual vehicle (Gap #2) */}
                        <div className="pt-2 border-t border-gray-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-gray-900 block flex items-center gap-1.5">
                                <ImageIcon size={14} className="text-[#009A60]" />
                                <span>Actual Photos of this Vehicle/Vessel ({veh.images.length})</span>
                              </span>
                              <span className="text-[11px] text-gray-500">
                                Upload exterior, interior seating, luggage compartment, or cabin photos
                              </span>
                            </div>
                          </div>

                          {/* Photos Thumbnail Gallery */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {veh.images.map((imgUrl, i) => (
                              <div key={i} className="relative h-24 rounded-xl overflow-hidden border border-gray-200 group">
                                <img src={imgUrl} alt={`${veh.name} ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                {veh.images.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhotoFromVehicle(veh.id, imgUrl)}
                                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors cursor-pointer"
                                    title="Remove photo"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                {i === 0 && (
                                  <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/70 text-white text-[9px] font-bold uppercase">
                                    Primary
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add Photo Input / Quick Preset Selector */}
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <input
                              type="text"
                              value={newVehicleImageUrl[veh.id] || ''}
                              onChange={(e) => setNewVehicleImageUrl({ ...newVehicleImageUrl, [veh.id]: e.target.value })}
                              placeholder="Paste photo URL for this vehicle (e.g. https://...)"
                              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const url = newVehicleImageUrl[veh.id];
                                if (url) {
                                  handleAddPhotoToVehicle(veh.id, url);
                                  setNewVehicleImageUrl({ ...newVehicleImageUrl, [veh.id]: '' });
                                }
                              }}
                              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              Add Photo
                            </button>
                          </div>

                          {/* Quick Preset Selector for vehicle */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Or choose sample:</span>
                            {PRESET_TRANSPORT_PHOTOS.map(p => (
                              <button
                                key={p.url}
                                type="button"
                                onClick={() => handleAddPhotoToVehicle(veh.id, p.url)}
                                className="text-[10px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200 transition-colors cursor-pointer"
                              >
                                + {p.label}
                              </button>
                            ))}
                          </div>

                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-3 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Operating Team</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: MULTIPLE OPERATING MEMBERS (GAP #3) */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">3. Operating Team & Drivers</h2>
                <p className="text-xs text-gray-500">
                  Register operations managers, designated drivers, boat captains, and field contacts for this service.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddOperatingMember}
                className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <UserPlus size={14} />
                <span>+ Add Team Member</span>
              </button>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs">
              <ShieldCheck size={22} className="text-[#009A60] shrink-0" />
              <p className="text-[11px] text-emerald-950 leading-relaxed">
                <strong>Partner Account Security</strong>: Team member contact information is stored strictly for dispatch coordination. Your primary MozBook Partner account credentials remain protected and separate.
              </p>
            </div>

            {/* List of Operating Members */}
            <div className="space-y-3">
              {operatingMembers.map((mem, index) => {
                const isExpanded = editingMemberId === mem.id || operatingMembers.length === 1;
                return (
                  <div key={mem.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/30">
                    <div className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#008250] flex items-center justify-center font-bold text-xs shrink-0">
                          {mem.fullName ? mem.fullName.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-gray-900">{mem.fullName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              {mem.role}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              mem.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {mem.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {mem.phone} {mem.email ? `· ${mem.email}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberActive(mem.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 cursor-pointer"
                        >
                          {mem.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(isExpanded ? null : mem.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer"
                        >
                          {isExpanded ? 'Collapse' : 'Edit Member'}
                        </button>
                        {operatingMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOperatingMember(mem.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5 space-y-4 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              value={mem.fullName}
                              onChange={(e) => handleUpdateOperatingMember(mem.id, { fullName: e.target.value })}
                              placeholder="e.g. Carlos Tembe"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Role / Function *
                            </label>
                            <select
                              value={mem.role}
                              onChange={(e) => handleUpdateOperatingMember(mem.id, { role: e.target.value as TransportOperatingMemberRole })}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden cursor-pointer"
                            >
                              <option value="Driver">Driver / Chauffeur</option>
                              <option value="Captain">Boat Captain / Skipper</option>
                              <option value="Guide">Guide / Safari Tracker</option>
                              <option value="Operations Manager">Operations Manager</option>
                              <option value="Manager">Station / Fleet Manager</option>
                              <option value="Owner">Owner / Executive</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Direct Phone (Dispatch) *
                            </label>
                            <input
                              type="text"
                              value={mem.phone}
                              onChange={(e) => handleUpdateOperatingMember(mem.id, { phone: e.target.value })}
                              placeholder="+258 84 123 4567"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Email (Optional)
                            </label>
                            <input
                              type="email"
                              value={mem.email || ''}
                              onChange={(e) => handleUpdateOperatingMember(mem.id, { email: e.target.value })}
                              placeholder="carlos@transport.co.mz"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Professional License / ID Reference
                            </label>
                            <input
                              type="text"
                              value={mem.licenseOrIdRef || ''}
                              onChange={(e) => handleUpdateOperatingMember(mem.id, { licenseOrIdRef: e.target.value })}
                              placeholder="e.g. Carta Profissional B/C/D #MZ8409"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-3 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Route & Pricing</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: ROUTE LOGISTICS, PRICING & TERMS */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-gray-900">4. Route Logistics & Fares</h2>
              <p className="text-xs text-gray-500">
                Configure pickup and drop-off points, pricing structure, and authoritative 15% platform commission
              </p>
            </div>

            {/* Pickup & Drop-off Managers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Pickup Locations
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pickupInput}
                    onChange={(e) => setPickupInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPickup(); } }}
                    placeholder="e.g. Maputo Airport (MPM)"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddPickup}
                    className="px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {pickupLocations.map(loc => (
                    <span key={loc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold">
                      <MapPin size={11} className="text-[#009A60]" />
                      <span>{loc}</span>
                      <button type="button" onClick={() => handleRemovePickup(loc)} className="text-emerald-700 hover:text-red-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Drop-off Destinations
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dropoffInput}
                    onChange={(e) => setDropoffInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDropoff(); } }}
                    placeholder="e.g. Polana Serena Hotel"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddDropoff}
                    className="px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {dropoffLocations.map(loc => (
                    <span key={loc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-semibold">
                      <Navigation size={11} className="text-blue-600" />
                      <span>{loc}</span>
                      <button type="button" onClick={() => handleRemoveDropoff(loc)} className="text-blue-700 hover:text-red-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Pricing Model Selection */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                Pricing Structure
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'per_vehicle', label: 'Per Vehicle', hint: 'Fixed price for entire vehicle' },
                  { id: 'per_trip', label: 'Per Trip / Route', hint: 'Fixed route fee' },
                  { id: 'per_day', label: 'Per Day', hint: 'Daily chauffeur or rental' },
                  { id: 'per_person', label: 'Per Person', hint: 'Per seat on shared shuttle' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPricingType(p.id as TransportPricingType)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      pricingType === p.id
                        ? 'border-2 border-[#009A60] bg-[#e6f7f0] text-gray-900 font-bold'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="block text-xs font-bold">{p.label}</span>
                    <span className="block text-[10px] text-gray-500 mt-0.5">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Input & Live MozBook 15% Commission Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl border border-gray-200 bg-gray-50/50">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Gross Price (Customer Pays)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">
                    MZN
                  </span>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full pl-14 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-base font-black text-gray-950 focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                </div>
                <span className="text-[11px] text-gray-500 block">
                  Applicable {pricingType.replace('_', ' ')}
                </span>
              </div>

              {/* Authoritative Commission Display */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  MozBook Global Financial Rule
                </span>
                
                <div className="flex justify-between items-center text-gray-600">
                  <span>Gross customer fare:</span>
                  <span className="font-semibold text-gray-900">MZN {commissionBreakdown.grossAmount.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                  <span>MozBook Commission ({MOZBOOK_COMMISSION_PERCENT}%):</span>
                  <span className="font-bold text-gray-900">-MZN {commissionBreakdown.commissionAmount.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-[#009A60] bg-[#e6f7f0] px-2.5 py-2 rounded-lg font-bold text-sm">
                  <span>Your Net Partner Earnings ({PARTNER_SHARE_PERCENT}%):</span>
                  <span>MZN {commissionBreakdown.partnerShare.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Inclusions Checkbox Grid */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Services Included
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMMON_TRANSPORT_INCLUSIONS.map(inc => {
                  const isChecked = selectedInclusions.includes(inc);
                  return (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleToggleInclusion(inc)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                        isChecked
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-[#009A60] text-white' : 'border border-gray-300 bg-white'
                      }`}>
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="text-[11px]">{inc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Passenger Requirements */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Traveler Booking Requirements
              </label>
              <div className="space-y-1.5">
                {COMMON_TRANSPORT_REQUIREMENTS.map(req => {
                  const isChecked = selectedRequirements.includes(req);
                  return (
                    <button
                      key={req}
                      type="button"
                      onClick={() => handleToggleRequirement(req)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                        isChecked
                          ? 'border-blue-300 bg-blue-50 text-blue-900 font-semibold'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white'
                      }`}>
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="text-[11px]">{req}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-6 py-3 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Media & Publish</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 5: PHOTOS & PUBLISH */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-gray-900">5. Service Photos & Publication</h2>
              <p className="text-xs text-gray-500">
                Choose primary service cover imagery and confirm your operational readiness
              </p>
            </div>

            {/* Presets Grid */}
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                Mozambique Transport Photo Catalog
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESET_TRANSPORT_PHOTOS.map(p => {
                  const isSelected = images.includes(p.url);
                  const isCover = coverImage === p.url;
                  return (
                    <div
                      key={p.url}
                      onClick={() => handleTogglePresetPhoto(p.url)}
                      className={`relative h-28 rounded-2xl overflow-hidden border-2 cursor-pointer group transition-all ${
                        isSelected ? 'border-[#009A60] shadow-sm' : 'border-gray-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-white">
                        <span className="text-[10px] font-bold truncate">{p.label}</span>
                      </div>
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#009A60] text-white flex items-center justify-center shadow-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      {isCover && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-bold uppercase">
                          Cover
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Or Add Custom Photo URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddCustomImage}
                  className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Add Image
                </button>
              </div>
            </div>

            {/* Publication Status */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Publication Status
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                    className="accent-[#009A60]"
                  />
                  <span className="text-xs font-bold text-gray-800">Publish Immediately</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="accent-[#009A60]"
                  />
                  <span className="text-xs font-bold text-gray-600">Save as Draft</span>
                </label>
              </div>
            </div>

            {/* Final Comprehensive Summary Card */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#009A60] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                    <Car size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-950 text-base">{title || 'Transport Service'}</h3>
                    <p className="text-xs text-emerald-900 font-medium">
                      {category} · {city} ({serviceArea})
                    </p>
                  </div>
                </div>
                <div className="text-right self-start sm:self-auto">
                  <span className="text-[11px] text-emerald-800 font-bold block">Your 85% Partner Share:</span>
                  <span className="text-lg font-black text-[#009A60]">
                    MZN {commissionBreakdown.partnerShare.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Fleet Assets</span>
                  <span className="font-bold text-gray-900">{vehicles.length} Vehicle(s)/Vessel(s)</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Team Members</span>
                  <span className="font-bold text-gray-900">{operatingMembers.length} Operating Staff</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Pricing Model</span>
                  <span className="font-bold text-gray-900 capitalize">{pricingType.replace('_', ' ')}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Gross Fare</span>
                  <span className="font-bold text-gray-900">MZN {price.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>Saving Transport Service...</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{isEditing ? 'Save Changes' : 'Publish Transport Offering'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
