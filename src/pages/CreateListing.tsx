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
  Clock,
  Eye,
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
  saveUserScopedDraft, 
  getUserScopedDraft, 
  clearUserScopedDraft 
} from '../services/authSessionManager';
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
  calculateTotalLodgeUnits,
  PhysicalAddress,
  formatPhysicalAddress
} from '../services/listingService';
import { RESIDENCE_TYPES } from '../data/residenceTypes';
import { AMENITIES_LIST } from '../data/amenities';
import GpsLocationPicker from '../components/GpsLocationPicker';
import SpecialOffersSection from '../components/SpecialOffersSection';
import LodgeAccommodationManager from '../components/LodgeAccommodationManager';
import AccommodationUnitManager from '../components/AccommodationUnitManager';
import {
  CANONICAL_ACCOMMODATION_TYPES,
  CANONICAL_PARENT_CATEGORIES,
  OPERATING_MODELS,
  SETTINGS,
  mapLegacyResidenceType,
  mapCanonicalToLegacyResidenceType,
  getCanonicalAccommodationType,
  getParentCategoryForType,
  getCanonicalTypesByCategory,
  isValidCanonicalCategoryTypePair,
  CanonicalAccommodationTypeId,
  OperatingModelId,
  SettingId,
  ClassificationStatus
} from '../data/canonicalAccommodationTaxonomy';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';

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

  // Stage 3D-B: Canonical Accommodation Taxonomy & Parent Category Filter
  const [canonicalType, setCanonicalType] = useState<CanonicalAccommodationTypeId>('BEACH_HOUSE');
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>('Private & Self-Contained Accommodation');
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

  // 5. GPS & Physical Address
  const [coordinates, setCoordinates] = useState({
    lat: -25.9692,
    lng: 32.5732, // Default: Maputo, Mozambique
  });
  const [city, setCity] = useState('Maputo');
  const [province, setProvince] = useState('Maputo Cidade');
  const [address, setAddress] = useState('Avenida Marginal Beachfront, Polana');
  const [country, setCountry] = useState('Mozambique');
  const [neighborhood, setNeighborhood] = useState('Polana');
  const [street, setStreet] = useState('Avenida Marginal');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [directionsLandmark, setDirectionsLandmark] = useState('');
  const [useGps, setUseGps] = useState(true);
  const [usePhysicalAddress, setUsePhysicalAddress] = useState(true);
  const [pinSource, setPinSource] = useState<'gps' | 'map_pin' | 'search' | 'default'>('default');

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

  // Nearby Places (preserved for draft/existing listing compatibility)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);

  // Host Verification Status
  const [hostVerification, setHostVerification] = useState<HostVerification | null>(null);

  // Submission & Post-save State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedListingModal, setSavedListingModal] = useState<{
    isOpen: boolean;
    listingId: string;
    title: string;
    isPendingVerification: boolean;
  } | null>(null);

  // User-Scoped Listing Draft Management (Fix A & Post-Discard Resilience)
  const STAY_LISTING_DRAFT_KEY = 'stay_listing_draft';
  const [restoredDraftNotice, setRestoredDraftNotice] = useState<{
    active: boolean;
    title?: string;
    savedAt?: string;
  } | null>(null);
  const draftReadyRef = useRef<boolean>(false);
  const hasLoadedDraftRef = useRef<string | null>(null);
  const isDiscardedRef = useRef<boolean>(false);
  const hasSubmittedRef = useRef<boolean>(false);
  const hasUserModifiedRef = useRef<boolean>(false);
  const latestDraftPayloadRef = useRef<any>(null);

  // Helper to construct serializable draft payload (strictly omitting any identity verification files)
  const getDraftPayload = () => ({
    residenceType,
    canonicalType,
    selectedParentCategory,
    selectedOperatingModels,
    selectedSettings,
    classificationStatus,
    title,
    description,
    price,
    currency,
    minNights,
    specialOffer,
    accommodations,
    isMultiUnit,
    availableFrom,
    availableTo,
    coordinates,
    city,
    province,
    address,
    country,
    neighborhood,
    street,
    buildingNumber,
    buildingName,
    postalCode,
    directionsLandmark,
    useGps,
    usePhysicalAddress,
    pinSource,
    selectedAmenities,
    photos,
    nearbyPlaces,
    savedAt: new Date().toISOString()
  });

  // Always keep latest draft payload ref in sync with current state
  useEffect(() => {
    latestDraftPayloadRef.current = getDraftPayload();
  });

  const saveDraftImmediately = () => {
    if (
      !user?.uid ||
      !draftReadyRef.current ||
      isSubmitting ||
      hasSubmittedRef.current ||
      isDiscardedRef.current ||
      !hasUserModifiedRef.current
    ) {
      return;
    }

    const payload = latestDraftPayloadRef.current || getDraftPayload();
    const hasMeaningfulContent = Boolean(
      payload.title?.trim() || 
      payload.description?.trim() || 
      payload.price !== 2000 || 
      (payload.accommodations && payload.accommodations.length > 0) ||
      payload.isMultiUnit ||
      (payload.photos && payload.photos.length !== 3) ||
      payload.city !== 'Maputo' ||
      (payload.selectedAmenities && payload.selectedAmenities.length !== 5)
    );

    if (hasMeaningfulContent) {
      saveUserScopedDraft(user.uid, STAY_LISTING_DRAFT_KEY, payload);
    }
  };

  // Restore user-scoped draft when user is authenticated
  useEffect(() => {
    if (!user?.uid) {
      draftReadyRef.current = false;
      hasLoadedDraftRef.current = null;
      setRestoredDraftNotice(null);
      return;
    }

    if (hasLoadedDraftRef.current === user.uid) return;
    hasLoadedDraftRef.current = user.uid;

    if (isDiscardedRef.current) return;

    const existing = getUserScopedDraft<any>(user.uid, STAY_LISTING_DRAFT_KEY);
    if (existing) {
      if (existing.residenceType) setResidenceType(existing.residenceType);
      if (existing.canonicalType) {
        setCanonicalType(existing.canonicalType);
        const derivedCat = existing.selectedParentCategory || getParentCategoryForType(existing.canonicalType);
        if (derivedCat) setSelectedParentCategory(derivedCat);
      } else if (existing.residenceType) {
        const mapping = mapLegacyResidenceType(existing.residenceType);
        if (mapping) {
          setCanonicalType(mapping.canonicalTypeId);
          const derivedCat = getParentCategoryForType(mapping.canonicalTypeId);
          if (derivedCat) setSelectedParentCategory(derivedCat);
        }
      }
      if (existing.selectedParentCategory) {
        setSelectedParentCategory(existing.selectedParentCategory);
      }
      if (existing.selectedOperatingModels) setSelectedOperatingModels(existing.selectedOperatingModels);
      if (existing.selectedSettings) setSelectedSettings(existing.selectedSettings);
      if (existing.classificationStatus) setClassificationStatus(existing.classificationStatus);
      if (typeof existing.title === 'string') setTitle(existing.title);
      if (typeof existing.description === 'string') setDescription(existing.description);
      if (typeof existing.price === 'number') setPrice(existing.price);
      if (existing.currency) setCurrency(existing.currency);
      if (typeof existing.minNights === 'number') setMinNights(existing.minNights);
      if (existing.specialOffer !== undefined) setSpecialOffer(existing.specialOffer);
      if (Array.isArray(existing.accommodations)) setAccommodations(existing.accommodations);
      if (typeof existing.isMultiUnit === 'boolean') setIsMultiUnit(existing.isMultiUnit);
      if (existing.availableFrom) setAvailableFrom(existing.availableFrom);
      if (existing.availableTo) setAvailableTo(existing.availableTo);
      if (existing.coordinates) setCoordinates(existing.coordinates);
      if (existing.city) setCity(existing.city);
      if (existing.province) setProvince(existing.province);
      if (existing.address) setAddress(existing.address);
      if (existing.country) setCountry(existing.country);
      if (existing.neighborhood !== undefined) setNeighborhood(existing.neighborhood);
      if (existing.street !== undefined) setStreet(existing.street);
      if (existing.buildingNumber !== undefined) setBuildingNumber(existing.buildingNumber);
      if (existing.buildingName !== undefined) setBuildingName(existing.buildingName);
      if (existing.postalCode !== undefined) setPostalCode(existing.postalCode);
      if (existing.directionsLandmark !== undefined) setDirectionsLandmark(existing.directionsLandmark);
      if (typeof existing.useGps === 'boolean') setUseGps(existing.useGps);
      if (typeof existing.usePhysicalAddress === 'boolean') setUsePhysicalAddress(existing.usePhysicalAddress);
      if (existing.pinSource) setPinSource(existing.pinSource);
      if (Array.isArray(existing.selectedAmenities)) setSelectedAmenities(existing.selectedAmenities);
      if (Array.isArray(existing.photos) && existing.photos.length > 0) setPhotos(existing.photos);
      if (Array.isArray(existing.nearbyPlaces) && existing.nearbyPlaces.length > 0) setNearbyPlaces(existing.nearbyPlaces);

      setRestoredDraftNotice({
        active: true,
        title: existing.title || '',
        savedAt: existing.savedAt
      });
      // Restored draft is not yet modified in this user session
      hasUserModifiedRef.current = false;
    }

    draftReadyRef.current = true;
  }, [user?.uid]);

  // Debounced autosave effect
  useEffect(() => {
    if (
      !user?.uid || 
      !draftReadyRef.current || 
      isSubmitting || 
      hasSubmittedRef.current || 
      isDiscardedRef.current
    ) {
      return;
    }

    const hasMeaningfulContent = Boolean(
      title.trim() || 
      description.trim() || 
      price !== 2000 || 
      accommodations.length > 0 ||
      isMultiUnit ||
      photos.length !== 3 ||
      city !== 'Maputo' ||
      selectedAmenities.length !== 5
    );

    if (!hasMeaningfulContent) return;

    // User has entered deliberate content
    hasUserModifiedRef.current = true;

    const timer = setTimeout(() => {
      if (
        !isDiscardedRef.current && 
        !hasSubmittedRef.current && 
        !isSubmitting && 
        draftReadyRef.current
      ) {
        saveUserScopedDraft(user.uid, STAY_LISTING_DRAFT_KEY, getDraftPayload());
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [
    user?.uid,
    residenceType,
    canonicalType,
    selectedParentCategory,
    selectedOperatingModels,
    selectedSettings,
    classificationStatus,
    title,
    description,
    price,
    currency,
    minNights,
    specialOffer,
    accommodations,
    isMultiUnit,
    availableFrom,
    availableTo,
    coordinates,
    city,
    province,
    address,
    selectedAmenities,
    photos,
    nearbyPlaces,
    isSubmitting
  ]);

  // Flush save on window unload / navigation away (single mount listener avoids stale state cleanup execution)
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveDraftImmediately();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Strictly saves on true unmount (navigating away) only if user modified and not discarded/submitted
      saveDraftImmediately();
    };
  }, []);

  // Explicit discard draft handler
  const handleDiscardDraft = () => {
    // 1. Immediately flag as discarded to block all pending and subsequent autosaves
    isDiscardedRef.current = true;
    hasUserModifiedRef.current = false;
    draftReadyRef.current = false;
    latestDraftPayloadRef.current = null;

    // 2. Clear persisted draft from storage
    if (user?.uid) {
      clearUserScopedDraft(user.uid, STAY_LISTING_DRAFT_KEY);
    }

    // 3. Dismiss restored notice banner immediately
    setRestoredDraftNotice(null);

    // 4. Reset form state to pristine default values
    setTitle('');
    setDescription('');
    setPrice(2000);
    setCurrency('MZN');
    setMinNights(2);
    setSpecialOffer(null);
    setAccommodations([]);
    setIsMultiUnit(false);
    setResidenceType('beachfront residence');
    setCanonicalType('BEACH_HOUSE');
    setSelectedOperatingModels(['SELF_CATERING']);
    setSelectedSettings(['BEACHFRONT', 'COASTAL']);
    setClassificationStatus('VALID_MATCH');
    setCity('Maputo');
    setProvince('Maputo Cidade');
    setAddress('Avenida Marginal Beachfront, Polana');
    setCoordinates({ lat: -25.9692, lng: 32.5732 });
    setSelectedAmenities(['wifi', 'ac', 'pool', 'kitchen', 'security']);
    setPhotos([
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

    // 5. After reset state finishes settling, re-enable draft readiness for future deliberate editing
    setTimeout(() => {
      draftReadyRef.current = true;
      isDiscardedRef.current = false;
    }, 200);
  };

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
      const cat = getParentCategoryForType(mapping.canonicalTypeId);
      if (cat) {
        setSelectedParentCategory(cat);
      }
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

  const handleSelectParentCategory = (newCategory: string) => {
    setSelectedParentCategory(newCategory);
    // If the currently selected canonicalType does not belong to the new category,
    // update to the first valid canonical type in that category. Otherwise preserve it!
    if (!isValidCanonicalCategoryTypePair(newCategory, canonicalType)) {
      const availableTypes = getCanonicalTypesByCategory(newCategory);
      if (availableTypes.length > 0) {
        const nextType = availableTypes[0].backend_id;
        setCanonicalType(nextType);
        setClassificationStatus('VALID_MATCH');
        const legacyFallback = mapCanonicalToLegacyResidenceType(nextType);
        setResidenceType(legacyFallback);
      }
    }
  };

  const handleSelectCanonicalType = (newCanonicalId: CanonicalAccommodationTypeId) => {
    setCanonicalType(newCanonicalId);
    setClassificationStatus('VALID_MATCH');
    const legacyFallback = mapCanonicalToLegacyResidenceType(newCanonicalId);
    setResidenceType(legacyFallback);
    const cat = getParentCategoryForType(newCanonicalId);
    if (cat && cat !== selectedParentCategory) {
      setSelectedParentCategory(cat);
    }
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

    if (!city.trim()) {
      setSubmitError('Please provide a city or municipality for your property.');
      return;
    }

    if (!country.trim()) {
      setSubmitError('Please provide a country for your property.');
      return;
    }

    const hasCoordinates = Boolean(coordinates && (coordinates.lat !== 0 || coordinates.lng !== 0));
    const hasAddress = Boolean(city.trim() && (province.trim() || street.trim() || address.trim()));
    if (!hasCoordinates && !hasAddress) {
      setSubmitError('Please provide either GPS coordinates on the map or a physical street address.');
      return;
    }

    if (specialOffer?.enabled && specialOffer.isSeasonal && specialOffer.seasonalTag === 'Other' && !specialOffer.customSeasonName?.trim()) {
      setSubmitError('Please provide a custom seasonal name for your special offer.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const structuredAddressDetails: PhysicalAddress = {
        country: country.trim() || 'Mozambique',
        province: province.trim(),
        city: city.trim(),
        neighborhood: neighborhood.trim() || undefined,
        street: street.trim() || undefined,
        buildingNumber: buildingNumber.trim() || undefined,
        buildingName: buildingName.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        directionsLandmark: directionsLandmark.trim() || undefined,
      };

      const computedLocationType: 'gps' | 'address' | 'both' = (useGps && usePhysicalAddress)
        ? 'both'
        : useGps
          ? 'gps'
          : 'address';

      const formattedLocation = formatPhysicalAddress(structuredAddressDetails) || address || `${city}, ${province}`;

      const listingData = {
        title: title.trim(),
        description: description.trim() || `${residenceType} in ${city}, ${province}.`,
        location: formattedLocation,
        residenceType,
        canonicalType,
        canonicalCategory: selectedParentCategory,
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
        city: city.trim(),
        province: province.trim(),
        country: country.trim() || 'Mozambique',
        neighborhood: neighborhood.trim() || undefined,
        street: street.trim() || undefined,
        buildingNumber: buildingNumber.trim() || undefined,
        buildingName: buildingName.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        directionsLandmark: directionsLandmark.trim() || undefined,
        addressDetails: structuredAddressDetails,
        locationType: computedLocationType,
        hasGpsLocation: Boolean(useGps && hasCoordinates),
        hasPhysicalAddress: Boolean(usePhysicalAddress && city.trim()),
        pinSource,
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
        hasSubmittedRef.current = true;
        isDiscardedRef.current = false;
        hasUserModifiedRef.current = false;
        draftReadyRef.current = false;
        latestDraftPayloadRef.current = null;
        if (user?.uid) {
          clearUserScopedDraft(user.uid, STAY_LISTING_DRAFT_KEY);
        }
        setRestoredDraftNotice(null);
        if (specialOffer && specialOffer.enabled) {
          try {
            await saveListingSpecialOffer(newId, specialOffer);
          } catch (offerErr) {
            console.warn('Failed to save promotional record separately:', offerErr);
          }
        }

        if (hostVerification?.status === 'verified') {
          navigate(`/listing/${newId}`);
        } else {
          setSavedListingModal({
            isOpen: true,
            listingId: newId,
            title: title.trim(),
            isPendingVerification: true
          });
        }
      } else {
        setSubmitError('Failed to publish listing. Please try again.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Error occurred while saving listing.');
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
              onClick={saveDraftImmediately}
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
          {/* Requirement 1 & 2: Approval Pending Notification Banner */}
          {(location.state?.approvalPending || hostVerification?.status === 'pending') && (
            <div className="p-4 sm:p-5 bg-amber-50/90 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 border border-amber-300">
                  <Clock size={22} className="text-amber-700" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[11px] font-black uppercase tracking-wider mb-1">
                    <ShieldCheck size={13} className="text-amber-800" />
                    <span>Approval Pending · Documents Awaiting Review</span>
                  </div>
                  <h3 className="text-base font-black text-gray-950 tracking-tight">
                    Full Accommodation Setup Enabled While Pending
                  </h3>
                  <p className="text-xs text-amber-950/85 mt-1 leading-relaxed max-w-2xl">
                    Your verification documents are awaiting review by our Trust & Safety operations team. You can add your house, apartment, lodge, or chalet information, photographs, nightly rates, room counts, amenities, and house rules now. Your completed listing will be saved and <strong>automatically published</strong> as soon as your account is approved.
                  </p>
                </div>
              </div>
              <Link
                to="/host/verify"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-200 hover:bg-amber-300 text-amber-950 text-xs font-bold rounded-xl transition-colors border border-amber-400/50 shadow-2xs"
              >
                <ShieldCheck size={14} />
                <span>Check Verification Status</span>
              </Link>
            </div>
          )}

          {/* Draft Restored Banner (Fix A) */}
          {restoredDraftNotice?.active && (
            <div className="p-4 sm:p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                  <Sparkles size={22} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded text-[11px] font-bold uppercase tracking-wider mb-1">
                    <CheckCircle2 size={12} />
                    <span>Autosaved Progress Loaded</span>
                  </div>
                  <h3 className="text-base font-black text-gray-950 tracking-tight">
                    Your unfinished listing has been restored.
                  </h3>
                  <p className="text-xs text-emerald-900/90 mt-0.5">
                    {restoredDraftNotice.title 
                      ? `We safely recovered your in-progress draft for "${restoredDraftNotice.title}".`
                      : 'We safely recovered your in-progress listing details, photos, and configurations.'}
                    {restoredDraftNotice.savedAt && ` (Saved: ${new Date(restoredDraftNotice.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60">
                <button
                  type="button"
                  onClick={() => setRestoredDraftNotice(null)}
                  className="px-3.5 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3 py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Discard draft and reset all fields to start a new listing"
                >
                  <Trash2 size={14} />
                  <span>Discard Draft</span>
                </button>
              </div>
            </div>
          )}

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
              onClick={saveDraftImmediately}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
            >
              <span>{hostVerification ? 'Review Submitted Docs' : 'Verify Documents Now'}</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          {/* Section 1: Accommodation Selection */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 1 of 6
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Which best describes your residence?
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select your accommodation category and property type so travelers can easily discover your stay.
              </p>
            </div>

            {/* Category & Accommodation Type Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dropdown 1: Category */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={selectedParentCategory}
                  onChange={(e) => handleSelectParentCategory(e.target.value)}
                  data-testid="category-select"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                >
                  {CANONICAL_PARENT_CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 2: Accommodation Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Accommodation Type
                </label>
                <select
                  value={canonicalType}
                  onChange={(e) => handleSelectCanonicalType(e.target.value as CanonicalAccommodationTypeId)}
                  data-testid="accommodation-type-select"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                >
                  {getCanonicalTypesByCategory(selectedParentCategory).map(t => (
                    <option key={t.backend_id} value={t.backend_id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {getCanonicalAccommodationType(canonicalType) && (
              <p className="text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-3">
                <strong>{getCanonicalAccommodationType(canonicalType)?.display_name}:</strong> {getCanonicalAccommodationType(canonicalType)?.description}
              </p>
            )}

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
                  Step 2 of 6
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
                Step 3 of 6
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Property Location & Physical Address
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Identify your property using GPS location, a map pin, a manual physical address, or both.
              </p>
            </div>

            <GpsLocationPicker
              coordinates={coordinates}
              city={city}
              province={province}
              address={address}
              country={country}
              neighborhood={neighborhood}
              street={street}
              buildingNumber={buildingNumber}
              buildingName={buildingName}
              postalCode={postalCode}
              directionsLandmark={directionsLandmark}
              useGps={useGps}
              usePhysicalAddress={usePhysicalAddress}
              pinSource={pinSource}
              onChange={(data) => {
                if (data.coordinates) setCoordinates(data.coordinates);
                if (data.city !== undefined) setCity(data.city);
                if (data.province !== undefined) setProvince(data.province);
                if (data.address !== undefined) setAddress(data.address);
                if (data.country !== undefined) setCountry(data.country);
                if (data.neighborhood !== undefined) setNeighborhood(data.neighborhood);
                if (data.street !== undefined) setStreet(data.street);
                if (data.buildingNumber !== undefined) setBuildingNumber(data.buildingNumber);
                if (data.buildingName !== undefined) setBuildingName(data.buildingName);
                if (data.postalCode !== undefined) setPostalCode(data.postalCode);
                if (data.directionsLandmark !== undefined) setDirectionsLandmark(data.directionsLandmark);
                if (data.useGps !== undefined) setUseGps(data.useGps);
                if (data.usePhysicalAddress !== undefined) setUsePhysicalAddress(data.usePhysicalAddress);
                if (data.pinSource !== undefined) setPinSource(data.pinSource);
              }}
            />
          </div>

          {/* Section 4: Dates Available, Minimum Nights & 15% Host Service Fee */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 4 of 6
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

          {/* Section 5: Special Offers & Seasonal Pricing */}
          <SpecialOffersSection
            stepBadge="Step 5 of 6"
            basePrice={price}
            offer={specialOffer}
            currency={currency}
            onChange={setSpecialOffer}
            isEditing={false}
          />

          {/* Section 6: Details & Photos with Naming / Room Labels */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 6 of 6
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
                  <span>Saving Accommodation...</span>
                </>
              ) : hostVerification?.status === 'verified' ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Publish MozBook Listing</span>
                </>
              ) : (
                <>
                  <Clock size={18} />
                  <span>Save Accommodation (Pending Approval)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Requirement 1, 2, 3: Saved Listing Confirmation Modal for Pending Hosts */}
      {savedListingModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 text-center space-y-5 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border-2 border-amber-300">
              <Clock size={32} className="text-amber-700" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-300">
                <ShieldCheck size={14} className="text-amber-700" />
                <span>Saved · Pending Host Verification</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Accommodation Saved Successfully!
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
                Your property <strong className="text-gray-900">"{savedListingModal.title}"</strong> has been saved and linked to your host profile.
              </p>
              <div className="bg-amber-50 rounded-2xl p-4 text-xs text-amber-950 text-left border border-amber-200 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#009A60]" />
                  <span>Automatic Publication Guaranteed:</span>
                </p>
                <p className="text-gray-600 leading-relaxed">
                  While your documents are being reviewed, this listing is held as pending and hidden from guest searches. Once your host verification is approved, your listing will automatically go live without you needing to do anything further.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(`/listing/${savedListingModal.listingId}`)}
                className="w-full sm:flex-1 py-3 px-4 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye size={14} />
                <span>Preview Listing</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/partner/dashboard?tab=accommodations')}
                className="w-full sm:flex-1 py-3 px-4 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Home size={14} />
                <span>Partner Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
