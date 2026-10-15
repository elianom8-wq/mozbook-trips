import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import MozBookLogo from '../components/MozBookLogo';
import CameraCaptureModal from '../components/CameraCaptureModal';
import { 
  Building2, 
  Palmtree, 
  Home, 
  Tent, 
  Building,
  Trees,
  LayoutGrid,
  Calendar, 
  DollarSign, 
  MapPin, 
  Sparkles, 
  Camera, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Plus,
  Trash2,
  Image as ImageIcon,
  ShieldCheck,
  Moon,
  Tag,
  Check,
  Wifi,
  Waves,
  Wind,
  Tv,
  UtensilsCrossed,
  Car,
  Laptop,
  Shirt,
  Zap,
  Flame,
  Sun,
  FlameKindling,
  Dumbbell,
  Dog,
  ExternalLink,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  ResidenceType, 
  createListing, 
  NearbyPlace,
  LabeledImage,
  getUserVerification,
  HostVerification,
  SpecialOffer,
  saveListingSpecialOffer,
  LodgeAccommodation,
  calculateTotalLodgeUnits
} from '../services/listingService';
import { RESIDENCE_TYPES } from '../data/residenceTypes';
import { AMENITIES_LIST } from '../data/amenities';
import GpsLocationPicker from '../components/GpsLocationPicker';
import NearbyPlacesManager from '../components/NearbyPlacesManager';
import SpecialOffersSection from '../components/SpecialOffersSection';
import LodgeAccommodationManager from '../components/LodgeAccommodationManager';
import AccommodationUnitManager from '../components/AccommodationUnitManager';
import {
  CANONICAL_ACCOMMODATION_TYPES,
  OPERATING_MODELS,
  SETTINGS,
  mapLegacyResidenceType,
  mapCanonicalToLegacyResidenceType,
  getCanonicalAccommodationType,
  CanonicalAccommodationTypeId,
  OperatingModelId,
  SettingId,
  ClassificationStatus
} from '../data/canonicalAccommodationTaxonomy';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';

// Icon resolver for residence types
const getResidenceIcon = (iconName: string) => {
  switch (iconName) {
    case 'Home': return Home;
    case 'Building': return Building;
    case 'Building2': return Building2;
    case 'Trees': return Trees;
    case 'LayoutGrid': return LayoutGrid;
    case 'Palmtree': return Palmtree;
    case 'Tent': return Tent;
    default: return Home;
  }
};

// Icon resolver for amenities
const getAmenityIcon = (iconName: string) => {
  switch (iconName) {
    case 'Wifi': return Wifi;
    case 'Waves': return Waves;
    case 'Wind': return Wind;
    case 'Tv': return Tv;
    case 'UtensilsCrossed': return UtensilsCrossed;
    case 'Car': return Car;
    case 'Laptop': return Laptop;
    case 'Shirt': return Shirt;
    case 'Zap': return Zap;
    case 'Flame': return Flame;
    case 'Sun': return Sun;
    case 'FlameKindling': return FlameKindling;
    case 'Dumbbell': return Dumbbell;
    case 'Dog': return Dog;
    case 'Palmtree': return Palmtree;
    case 'ShieldCheck': return ShieldCheck;
    default: return Check;
  }
};

const COMMON_ROOM_LABELS = [
  'Lounge / Living Room',
  'Main Bedroom',
  'Guest Bedroom',
  'Swimming Pool',
  'Kitchen',
  'Ocean View Balcony',
  'Bathroom',
  'Dining Area',
  'Patio / Garden',
  'Exterior'
];

export default function CreateListing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Partner Flow Detection (Stage 3D-B)
  const isPartnerFlow = Boolean(
    location.state?.partnerCategory === 'accommodation' ||
    location.state?.partnerFlow ||
    new URLSearchParams(location.search).get('partner') === 'true'
  );

  // 1. Residence Type (Legacy Backwards Compatibility - Always preserved)
  const [residenceType, setResidenceType] = useState<ResidenceType>('beachfront residence');

  // Stage 3D-B: Canonical Accommodation Taxonomy
  const [canonicalType, setCanonicalType] = useState<CanonicalAccommodationTypeId>('BEACH_HOUSE');
  const [selectedOperatingModels, setSelectedOperatingModels] = useState<OperatingModelId[]>(['SELF_CATERING']);
  const [selectedSettings, setSelectedSettings] = useState<SettingId[]>(['BEACHFRONT', 'COASTAL']);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus>('VALID_MATCH');

  // 2. Listing Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // 3. Pricing & Minimum Nights (15% Mozbook Host Service Fee)
  const [price, setPrice] = useState<number>(2000);
  const [currency, setCurrency] = useState<string>('MZN');
  const [minNights, setMinNights] = useState<number>(2);

  // Special Offers & Seasonal Pricing
  const [specialOffer, setSpecialOffer] = useState<SpecialOffer | null>(null);

  // Multi-Unit Accommodation State (Stage 3E Generalized Multi-Unit)
  const [accommodations, setAccommodations] = useState<LodgeAccommodation[]>([]);
  const [isMultiUnit, setIsMultiUnit] = useState<boolean>(false);

  // 4. Dates Available
  const [availableFrom, setAvailableFrom] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [availableTo, setAvailableTo] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 90);
    return nextMonth.toISOString().split('T')[0];
  });

  // 5. GPS & Geography
  const [coordinates, setCoordinates] = useState({
    lat: -25.9692,
    lng: 32.5732, // Default: Maputo, Mozambique
  });
  const [city, setCity] = useState('Maputo');
  const [province, setProvince] = useState('Maputo Cidade');
  const [address, setAddress] = useState('Avenida Marginal Beachfront, Polana');

  // 6. Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'wifi',
    'ac',
    'pool',
    'kitchen',
    'security'
  ]);

  // 7. Labeled Images
  const [photos, setPhotos] = useState<LabeledImage[]>([
    {
      url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80',
      label: 'Ocean View Balcony'
    },
    {
      url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      label: 'Swimming Pool'
    },
    {
      url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      label: 'Lounge'
    }
  ]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoLabel, setNewPhotoLabel] = useState('Main Bedroom');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  // 8. What's Nearby
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([
    {
      id: 'np-1',
      name: 'Dhow Maputo Sunset Lounge & Restaurant',
      category: 'restaurant',
      distance: '5 min walk',
      description: 'Stunning bay vistas and fresh grilled Mozambican prawns.'
    },
    {
      id: 'np-2',
      name: 'Costa do Sol Beachfront & Fish Market',
      category: 'activity',
      distance: '8 min walk',
      description: 'Lively coastal promenade with ocean swimming and local culture.'
    }
  ]);

  // Host Verification Status
  const [hostVerification, setHostVerification] = useState<HostVerification | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getUserVerification(user.uid).then((verif) => setHostVerification(verif));
    }
  }, [user]);

  // MozBook platform commission (15%) and partner earnings (85%)
  const { commissionAmount: hostServiceFee, partnerShare: netHostEarnings } = calculateCommission(price);

  const handleSelectResidenceType = (typeId: string) => {
    setResidenceType(typeId as ResidenceType);
    const mapping = mapLegacyResidenceType(typeId);
    if (mapping) {
      setCanonicalType(mapping.canonicalTypeId);
      setClassificationStatus(mapping.classificationStatus);
      if (mapping.suggestedSettings) {
        setSelectedSettings(mapping.suggestedSettings);
      }
      if (mapping.suggestedOperatingModels) {
        setSelectedOperatingModels(mapping.suggestedOperatingModels);
      }
    }

    const preset = RESIDENCE_TYPES.find((r) => r.id === typeId);
    if (preset && photos.length === 0) {
      setPhotos(
        preset.defaultImages.map((imgUrl, i) => ({
          url: imgUrl,
          label: i === 0 ? 'Main View' : i === 1 ? 'Lounge' : 'Bedroom'
        }))
      );
    }
    // If selecting Lodge, enable multi-unit and initialize with Mozambique lodge presets if empty
    if (typeId === 'lodge') {
      setIsMultiUnit(true);
      if (accommodations.length === 0) {
        setAccommodations([
        {
          id: 'acc_standard_room_1',
          name: 'Standard Room',
          units: 6,
          adults: 2,
          children: 0,
          maxGuests: 2,
          price: 3000,
          currency: 'MZN',
          description: 'Comfortable ensuite room with king or twin beds, air conditioning, and garden surroundings.',
          amenities: ['private_bathroom', 'ac', 'wifi', 'fan', 'hot_water'],
          photos: [
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
          ],
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'acc_ocean_view_chalet_1',
          name: 'Ocean View Chalet',
          units: 4,
          adults: 2,
          children: 2,
          maxGuests: 4,
          price: 6000,
          currency: 'MZN',
          description: 'Private chalet with ocean views, king-size bed, private bathroom and outdoor seating area.',
          amenities: ['private_bathroom', 'ac', 'wifi', 'sea_view', 'balcony', 'fridge', 'breakfast', 'hot_water'],
          photos: [
            'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'
          ],
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'acc_family_chalet_1',
          name: 'Family Chalet',
          units: 2,
          adults: 2,
          children: 4,
          maxGuests: 6,
          price: 7500,
          currency: 'MZN',
          description: 'Two-bedroom independent chalet with large lounge, kitchenette, covered patio, and room for 6 guests.',
          amenities: ['private_bathroom', 'ac', 'wifi', 'kitchen', 'fridge', 'balcony', 'garden_view', 'hot_water'],
          photos: [
            'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80'
          ],
          active: true,
          createdAt: new Date().toISOString()
        }
      ]);
      setPrice(3000);
      }
    }
  };

  const handleSelectCanonicalType = (newCanonicalId: CanonicalAccommodationTypeId) => {
    setCanonicalType(newCanonicalId);
    setClassificationStatus('VALID_MATCH');
    const legacyFallback = mapCanonicalToLegacyResidenceType(newCanonicalId);
    setResidenceType(legacyFallback);
  };

  const handleToggleOperatingModel = (modelId: OperatingModelId) => {
    setSelectedOperatingModels(prev => 
      prev.includes(modelId)
        ? prev.length > 1 ? prev.filter(m => m !== modelId) : prev
        : [...prev, modelId]
    );
  };

  const handleToggleSetting = (settingId: SettingId) => {
    setSelectedSettings(prev => 
      prev.includes(settingId)
        ? prev.filter(s => s !== settingId)
        : [...prev, settingId]
    );
  };

  const handleToggleAmenity = (amenityId: string) => {
    if (selectedAmenities.includes(amenityId)) {
      setSelectedAmenities(selectedAmenities.filter((id) => id !== amenityId));
    } else {
      setSelectedAmenities([...selectedAmenities, amenityId]);
    }
  };

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    setPhotos([
      ...photos,
      {
        url: newPhotoUrl.trim(),
        label: newPhotoLabel.trim() || 'Residence Photo'
      }
    ]);
    setNewPhotoUrl('');
    setNewPhotoLabel('Lounge');
  };

  const handleCameraCapture = (dataUrl: string) => {
    setPhotos((prev) => [
      ...prev,
      {
        url: dataUrl,
        label: newPhotoLabel.trim() || 'Captured Room Photo',
      },
    ]);
    setCameraModalOpen(false);
  };

  const handleDeviceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPhotos((prev) => [
          ...prev,
          {
            url: dataUrl,
            label: newPhotoLabel.trim() || 'Uploaded Room Photo',
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpdatePhotoLabel = (index: number, newLabel: string) => {
    const updated = [...photos];
    updated[index].label = newLabel;
    setPhotos(updated);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleUsePresetPhotos = () => {
    const preset = RESIDENCE_TYPES.find((r) => r.id === residenceType);
    if (preset) {
      setPhotos(
        preset.defaultImages.map((imgUrl, i) => ({
          url: imgUrl,
          label: i === 0 ? 'Exterior & Grounds' : i === 1 ? 'Lounge' : 'Main Bedroom'
        }))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }

    if (photos.length === 0) {
      setSubmitError('Please add at least one photo with a label for your residence.');
      return;
    }

    if (!title.trim()) {
      setSubmitError('Please provide a listing title.');
      return;
    }

    if (specialOffer?.enabled && specialOffer.isSeasonal && specialOffer.seasonalTag === 'Other' && !specialOffer.customSeasonName?.trim()) {
      setSubmitError('Please provide a custom seasonal name for your special offer.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const listingData = {
        title: title.trim(),
        description: description.trim() || `${residenceType} in ${city}, ${province}.`,
        location: `${city}, ${province}`,
        residenceType,
        canonicalType,
        operatingModels: selectedOperatingModels,
        settings: selectedSettings,
        classificationStatus,
        price,
        minNights,
        rating: 4.95,
        images: photos.map((p) => p.url),
        labeledImages: photos,
        amenities: selectedAmenities,
        hostId: user.uid,
        hostName: user.displayName || 'Mozbook Host',
        hostPhoto: user.photoURL || undefined,
        isHostVerified: hostVerification?.status === 'verified',
        category: residenceType,
        city,
        province,
        country: 'Mozambique',
        availableFrom,
        availableTo,
        dates: `${availableFrom} to ${availableTo}`,
        coordinates,
        nearbyPlaces,
        specialOffer: specialOffer && specialOffer.enabled ? specialOffer : null,
        accommodations: (residenceType === 'lodge' || isMultiUnit) ? accommodations : [],
        totalLodgeUnits: (residenceType === 'lodge' || isMultiUnit) ? calculateTotalLodgeUnits(accommodations) : undefined,
      };

      const newId = await createListing(listingData);
      if (newId) {
        if (specialOffer && specialOffer.enabled) {
          try {
            await saveListingSpecialOffer(newId, specialOffer);
          } catch (offerErr) {
            console.warn('Failed to save promotional record separately:', offerErr);
          }
        }
        navigate(`/listing/${newId}`);
      } else {
        setSubmitError('Failed to publish listing. Please try again.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Error occurred while publishing listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Link to="/" className="hidden sm:block hover:opacity-90">
              <MozBookLogo variant="compact" size="sm" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                {isPartnerFlow ? 'MozBook Partner Onboarding' : 'MozBook your home'}
              </h1>
              <p className="text-xs text-gray-500">
                {isPartnerFlow 
                  ? 'Accommodation Inventory Setup & Partner Registration' 
                  : 'List your residence across Mozambique and Southern Africa'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Host Verification Badge / Link */}
            <Link
              to="/host/verify"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                hostVerification?.status === 'verified'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : hostVerification?.status === 'pending'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-[#e6f7f0] text-[#009A60] hover:bg-[#d5f3e5] border border-[#a4e4c7]'
              }`}
            >
              <ShieldCheck size={15} />
              <span>
                {hostVerification?.status === 'verified'
                  ? 'Verified Host'
                  : hostVerification?.status === 'pending'
                  ? 'Docs Pending Approval'
                  : 'Host Verification Required'}
              </span>
            </Link>

            {!user ? (
              <button
                type="button"
                onClick={login}
                className="px-3.5 py-1.5 bg-[#009A60] text-white font-semibold text-xs rounded-lg hover:bg-[#008250] transition-colors"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-full">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="font-medium text-gray-800 hidden sm:inline">{user.displayName || 'Host'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Partner Flow Banner */}
      {isPartnerFlow && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white px-4 sm:px-6 py-2.5 text-xs border-b border-emerald-800/40 shadow-xs">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-[10px] border border-emerald-400/30">
                Partner Flow
              </span>
              <span className="font-semibold text-slate-200">
                Branch 1 of Selected Offerings: Accommodation Inventory
              </span>
            </div>
            <Link to="/partner" className="text-emerald-400 hover:text-emerald-300 text-xs font-bold hover:underline">
              Return to Partner Categories
            </Link>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {submitError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Listing Submission Error</p>
                <p className="text-xs text-rose-700 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* Verification Callout Box */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-[#009A60] text-white rounded-xl shadow-xs shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900">
                  Host Document & Identity Verification
                </h3>
                <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                  Submit your official identity document (Mozambican National ID / DIRE / Passport) and phone contact. Our operations team verifies your documents on the backend admin portal for listing approval.
                </p>
              </div>
            </div>

            <Link
              to="/host/verify"
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
            >
              <span>{hostVerification ? 'Review Submitted Docs' : 'Verify Documents Now'}</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          {/* Section 1: Residence Type Selection */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 1 of 7
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Which best describes your residence?
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select from standard residential properties, urban city homes, country escapes, or unique holiday stays so travelers can refine their search.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {RESIDENCE_TYPES.map((type) => {
                const isSelected = residenceType === type.id;
                const Icon = getResidenceIcon(type.iconName);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleSelectResidenceType(type.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#009A60] ring-2 ring-[#009A60]/20 bg-[#e6f7f0]/40 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div>
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
                          isSelected
                            ? 'bg-[#009A60] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Icon size={22} />
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base capitalize">
                        {type.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">
                        {type.subtitle}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#009A60]">
                        <CheckCircle2 size={15} /> Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Property Refinement Section */}
            <div className="pt-6 mt-6 border-t border-gray-100 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Refine your property
                </h3>
              </div>

              {/* Accommodation Classification Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Accommodation Classification
                </label>
                <select
                  value={canonicalType}
                  onChange={(e) => handleSelectCanonicalType(e.target.value as CanonicalAccommodationTypeId)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                >
                  {Array.from(new Set(CANONICAL_ACCOMMODATION_TYPES.map(t => t.parent_category))).map(category => (
                    <optgroup key={category} label={category}>
                      {CANONICAL_ACCOMMODATION_TYPES.filter(t => t.parent_category === category).map(t => (
                        <option key={t.backend_id} value={t.backend_id}>
                          {t.display_name} — {t.description.slice(0, 55)}...
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {getCanonicalAccommodationType(canonicalType) && (
                  <p className="text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-2.5 mt-2">
                    <strong>{getCanonicalAccommodationType(canonicalType)?.display_name}:</strong> {getCanonicalAccommodationType(canonicalType)?.description}
                  </p>
                )}
              </div>

              {/* Operating / Meal Models */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Operating & Meal Models
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {selectedOperatingModels.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {OPERATING_MODELS.map(model => {
                    const isSelected = selectedOperatingModels.includes(model.backend_id);
                    return (
                      <button
                        key={model.backend_id}
                        type="button"
                        onClick={() => handleToggleOperatingModel(model.backend_id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-[#e6f7f0] border-[#009A60] text-[#008250] font-bold shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{model.display_name}</span>
                          {isSelected && <Check size={13} className="shrink-0 text-[#009A60]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Environmental Settings & Attributes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Environmental Settings & Attributes
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {selectedSettings.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {SETTINGS.map(setting => {
                    const isSelected = selectedSettings.includes(setting.backend_id);
                    return (
                      <button
                        key={setting.backend_id}
                        type="button"
                        onClick={() => handleToggleSetting(setting.backend_id)}
                        className={`p-2 rounded-xl border text-center text-xs transition-all ${
                          isSelected
                            ? 'bg-[#e6f7f0] border-[#009A60] text-[#008250] font-bold shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <span className="truncate block">{setting.display_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Multi-Unit Accommodation Option (Stage 3E Generalization) */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-gray-900 block">
                  Multi-Unit Property Configuration
                </span>
                <span className="text-xs text-gray-500">
                  {residenceType === 'lodge' 
                    ? 'Lodge multi-unit room & chalet management is automatically enabled.' 
                    : 'Enable if this property offers multiple rooms, chalets, suites, villas, tents or camping pitches.'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={residenceType === 'lodge' || isMultiUnit}
                  disabled={residenceType === 'lodge'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsMultiUnit(checked);
                    if (!checked && residenceType !== 'lodge') {
                      setAccommodations([]);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009A60]"></div>
              </label>
            </div>
          </div>

          {/* Generalized Multi-Unit Accommodation Section (Stage 3E) */}
          {(residenceType === 'lodge' || isMultiUnit) && (
            <AccommodationUnitManager
              accommodations={accommodations}
              onChange={setAccommodations}
              currency={currency}
              lodgeSpecialOffer={specialOffer}
              onSyncBasePrice={(suggestedPrice) => {
                if (suggestedPrice > 0) {
                  setPrice(suggestedPrice);
                }
              }}
              propertyTypeTitle={
                residenceType === 'lodge' 
                  ? 'Lodge' 
                  : getCanonicalAccommodationType(canonicalType)?.display_name || 'Accommodation'
              }
            />
          )}

          {/* Section 2: Selectable List of Amenities */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                  Step 2 of 7
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-1">
                  What amenities does your residence offer?
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Let travelers know if there is fast Wi-Fi, a swimming pool, smart TV, air conditioning (AC), backup power, and more.
                </p>
              </div>

              <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full self-start">
                {selectedAmenities.length} selected
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              {AMENITIES_LIST.map((amenity) => {
                const isSelected = selectedAmenities.includes(amenity.id);
                const Icon = getAmenityIcon(amenity.iconName);
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => handleToggleAmenity(amenity.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-gray-900 bg-gray-900 text-white shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-800'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm truncate">
                        {amenity.label}
                      </div>
                      <p className={`text-[11px] line-clamp-1 mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {amenity.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Location & GPS Coordinates */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 3 of 7
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Location & GPS Pinpoint
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Pinpoint the exact GPS location of the residence so guests know the precise city, province, and neighborhood.
              </p>
            </div>

            <GpsLocationPicker
              coordinates={coordinates}
              city={city}
              province={province}
              address={address}
              onChange={(data) => {
                setCoordinates(data.coordinates);
                setCity(data.city);
                setProvince(data.province);
                setAddress(data.address);
              }}
            />
          </div>

          {/* Section 4: What's Nearby? (Community suggestions & confirmation) */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 4 of 7
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                What's Nearby?
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Add nearby restaurants, activities, beaches, and local sights. When you confirm or add a custom spot, it becomes instantly available to the community suggestions list for {city || 'this location'}!
              </p>
            </div>

            <NearbyPlacesManager
              city={city}
              province={province}
              coordinates={coordinates}
              nearbyPlaces={nearbyPlaces}
              onChange={setNearbyPlaces}
            />
          </div>

          {/* Section 5: Dates Available, Minimum Nights & 15% Host Service Fee */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 5 of 7
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Dates Available, Minimum Nights & Pricing
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Set when your residence is open for bookings, your minimum stay requirement, and nightly pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Availability Range */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Calendar size={18} className="text-[#009A60]" />
                  <span>Calendar Availability Range</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Available From *
                    </label>
                    <input
                      type="date"
                      required
                      value={availableFrom}
                      onChange={(e) => setAvailableFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Available To *
                    </label>
                    <input
                      type="date"
                      required
                      value={availableTo}
                      onChange={(e) => setAvailableTo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Minimum Booking Nights Option */}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-700 uppercase flex items-center gap-1.5">
                      <Moon size={14} className="text-indigo-600" />
                      <span>Minimum Booking Nights *</span>
                    </label>
                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                      {minNights} {minNights === 1 ? 'night' : 'nights'} minimum
                    </span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMinNights(n)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                          minNights === n
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {n} {n === 1 ? 'night' : 'nights'}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={minNights}
                    onChange={(e) => setMinNights(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800"
                    placeholder="Or enter custom minimum nights"
                  />
                </div>
              </div>

              {/* Pricing & 15% Mozbook Host Service Fee */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <DollarSign size={18} className="text-emerald-600" />
                    <span>Nightly Pricing & Host Fee Breakdown</span>
                  </div>

                  <div className="flex rounded-lg border border-gray-300 bg-white p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCurrency('MZN')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${currency === 'MZN' ? 'bg-[#009A60] text-white' : 'text-gray-600'}`}
                    >
                      MZN
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${currency === 'USD' ? 'bg-[#009A60] text-white' : 'text-gray-600'}`}
                    >
                      USD
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-sm">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={10}
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full pl-14 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-lg font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600">/ night</span>
                </div>

                {/* 15% Host Service Fee Breakdown */}
                <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Nightly Rate (Guests Pay):</span>
                    <span className="font-semibold text-gray-900">{currency} {price.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-[#009A60] bg-[#e6f7f0] px-2 py-1 rounded">
                    <span className="font-medium">MozBook Host Service Fee (15%):</span>
                    <span className="font-bold">-{currency} {hostServiceFee.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-gray-100 font-bold text-sm text-gray-900">
                    <span className="text-emerald-700">Your Net Host Earnings:</span>
                    <span className="text-emerald-700">{currency} {netHostEarnings.toLocaleString()} / night</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    The 15% MozBook host service fee covers platform 24/7 emergency support, secure escrow processing, and insurance protection.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Special Offers & Seasonal Pricing (NEW) */}
          <SpecialOffersSection
            basePrice={price}
            offer={specialOffer}
            currency={currency}
            onChange={setSpecialOffer}
            isEditing={false}
          />

          {/* Section 7: Details & Photos with Naming / Room Labels */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 7 of 7
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Residence Details & Named Photos
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Give your listing a catchy title, detailed story, and name each photograph (e.g. Lounge, Main Bedroom, Pool, Kitchen).
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Listing Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. Oceanfront Sanctuary with Heated Pool & Panoramic Deck"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm md:text-base font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Keep it vivid and descriptive</span>
                  <span>{title.length}/120</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Residence Overview & Story
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the architectural design, morning light, bedroom layout, and what makes staying here exceptional..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              {/* Photos Manager with Name / Label for each picture */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Upload & Name Photos ({photos.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                      Name each picture so guests know if they are viewing the lounge, main bedroom, pool, or patio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUsePresetPhotos}
                    className="text-xs font-semibold text-[#009A60] hover:text-[#008250] hover:underline flex items-center gap-1 self-start"
                  >
                    <Sparkles size={14} /> Load curated {residenceType} gallery
                  </button>
                </div>

                {/* Add Photo with Custom Name / Label Input */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-7">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Photo URL (https://...)
                      </label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Picture Name / Room Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lounge, Main Bedroom, Pool"
                        value={newPhotoLabel}
                        onChange={(e) => setNewPhotoLabel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddPhoto}
                        className="w-full py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Plus size={15} /> Add Picture
                      </button>
                    </div>
                  </div>

                  {/* Quick preset name tags */}
                  <div>
                    <span className="text-[11px] text-gray-500 font-semibold block mb-1">Quick Name Suggestions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_ROOM_LABELS.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setNewPhotoLabel(label)}
                          className="px-2.5 py-0.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-full text-[11px] font-medium transition-colors"
                        >
                          + {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Camera & Device Upload Action Row */}
                  <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraModalOpen(true)}
                        className="px-3.5 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Use device camera to photograph room"
                      >
                        <Camera size={15} />
                        <span>Take Photo with Camera</span>
                      </button>

                      <input
                        ref={fileUploadRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleDeviceFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileUploadRef.current?.click()}
                        className="px-3.5 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload size={15} />
                        <span>Upload from Phone / Files</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-gray-500">
                      Camera permission is asked once off and saved.
                    </span>
                  </div>
                </div>

                {/* Photo Previews with Editable Labels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {photos.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-2xs group flex flex-col justify-between"
                    >
                      <div className="relative aspect-4/3 bg-gray-100">
                        <img
                          src={item.url}
                          alt={item.label || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-[#009A60] text-white rounded-lg opacity-80 hover:opacity-100 transition-all"
                          title="Remove picture"
                        >
                          <Trash2 size={14} />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                            Cover Image
                          </span>
                        )}
                      </div>

                      {/* Picture Name space */}
                      <div className="p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                          <span className="flex items-center gap-1">
                            <Tag size={11} className="text-[#009A60]" />
                            <span>Picture Name</span>
                          </span>
                          <span className="text-gray-400">Photo #{idx + 1}</span>
                        </div>
                        <input
                          type="text"
                          value={item.label || ''}
                          placeholder="e.g. Lounge, Pool, Master Bedroom"
                          onChange={(e) => handleUpdatePhotoLabel(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-[#009A60] rounded-lg text-xs font-semibold text-gray-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
            <Link
              to="/"
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel & Return Home
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-9 py-3.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl hover:shadow-[#009A60]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Publishing Listing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Publish MozBook Listing</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* In-app Camera Modal with Once-off Permission Solicitation */}
      {cameraModalOpen && (
        <CameraCaptureModal
          isOpen={cameraModalOpen}
          onClose={() => setCameraModalOpen(false)}
          onCapture={handleCameraCapture}
          title="Photograph Your Listing Room"
        />
      )}
    </div>
  );
}
