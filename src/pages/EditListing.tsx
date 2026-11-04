import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Sparkles, 
  Camera, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Plus,
  Trash2,
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
  ShieldCheck,
  Upload,
  Save,
  Moon,
  ExternalLink,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  ResidenceType, 
  getListingById,
  updateListing,
  saveListingSpecialOffer,
  removeListingSpecialOffer,
  getListingSpecialOffer,
  SpecialOffer,
  NearbyPlace,
  LabeledImage,
  getUserVerification,
  HostVerification,
  LodgeAccommodation,
  calculateTotalLodgeUnits,
  PhysicalAddress,
  formatPhysicalAddress
} from '../services/listingService';
import { AMENITIES_LIST } from '../data/amenities';
import GpsLocationPicker from '../components/GpsLocationPicker';
import SpecialOffersSection from '../components/SpecialOffersSection';
import {
  CANONICAL_ACCOMMODATION_TYPES,
  CANONICAL_PARENT_CATEGORIES,
  OPERATING_MODELS,
  SETTINGS,
  getCanonicalAccommodationType,
  mapCanonicalToLegacyResidenceType,
  getParentCategoryForType,
  getCanonicalTypesByCategory,
  isValidCanonicalCategoryTypePair,
  CanonicalAccommodationTypeId,
  OperatingModelId,
  SettingId,
  ClassificationStatus,
  mapLegacyResidenceType
} from '../data/canonicalAccommodationTaxonomy';
import LodgeAccommodationManager from '../components/LodgeAccommodationManager';
import AccommodationUnitManager from '../components/AccommodationUnitManager';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';

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

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const { user, login, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string>('');
  const [listingHostId, setListingHostId] = useState<string | null>(null);

  // Form State
  const [residenceType, setResidenceType] = useState<ResidenceType>('beachfront residence');
  const [canonicalType, setCanonicalType] = useState<CanonicalAccommodationTypeId | undefined>(undefined);
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>('Private & Self-Contained Accommodation');
  const [selectedOperatingModels, setSelectedOperatingModels] = useState<OperatingModelId[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<SettingId[]>([]);
  const [classificationStatus, setClassificationStatus] = useState<ClassificationStatus | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(2000);
  const [currency, setCurrency] = useState<string>('MZN');
  const [minNights, setMinNights] = useState<number>(2);

  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');

  const [coordinates, setCoordinates] = useState({ lat: -25.9692, lng: 32.5732 });
  const [city, setCity] = useState('Maputo');
  const [province, setProvince] = useState('Maputo Cidade');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Mozambique');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [directionsLandmark, setDirectionsLandmark] = useState('');
  const [useGps, setUseGps] = useState(true);
  const [usePhysicalAddress, setUsePhysicalAddress] = useState(true);
  const [pinSource, setPinSource] = useState<'gps' | 'map_pin' | 'search' | 'default'>('default');

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<LabeledImage[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);

  // Special Offers State
  const [specialOffer, setSpecialOffer] = useState<SpecialOffer | null>(null);

  // Multi-Unit Accommodation State (Stage 3E Generalized Multi-Unit)
  const [accommodations, setAccommodations] = useState<LodgeAccommodation[]>([]);
  const [isMultiUnit, setIsMultiUnit] = useState<boolean>(false);

  // Image Upload & Camera Modal
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoLabel, setNewPhotoLabel] = useState('Lounge');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  // Host Verification Status
  const [hostVerification, setHostVerification] = useState<HostVerification | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getUserVerification(user.uid).then((verif) => setHostVerification(verif));
    }
  }, [user]);

  // Load existing listing
  useEffect(() => {
    if (!id) {
      setLoadError('No listing ID provided.');
      setLoading(false);
      return;
    }

    if (authLoading) {
      return; // Wait for authentication initialization to complete
    }

    if (!user) {
      setIsUnauthorized(true);
      setUnauthorizedReason('Authentication Required: Please sign in to an authorized host account or administrator account to edit listings.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setIsUnauthorized(false);

    Promise.all([
      getListingById(id),
      getListingSpecialOffer(id)
    ])
      .then(([listingData, separateOffer]) => {
        if (!listingData) {
          setLoadError('Listing not found or currently unavailable.');
          setLoading(false);
          return;
        }

        // Host Authorization check: user must be the listing host OR an admin
        const isOwner = Boolean(user && listingData.hostId && user.uid === listingData.hostId);
        if (!isOwner && !isAdmin) {
          setIsUnauthorized(true);
          setUnauthorizedReason('Access Denied: You do not have permission to edit this listing. Only the property host or a MozBook administrator can access the management interface.');
          setLoading(false);
          return; // CRITICAL: Stop here! DO NOT populate form with private listing details!
        }

        setListingHostId(listingData.hostId);

        setTitle(listingData.title || '');
        setDescription(listingData.description || '');
        setResidenceType(listingData.residenceType || 'beachfront residence');
        setPrice(listingData.price || 2000);
        setMinNights(listingData.minNights || 1);
        setAvailableFrom(listingData.availableFrom || '');
        const addrDetails = listingData.addressDetails;
        setCity(listingData.city || addrDetails?.city || 'Maputo');
        setProvince(listingData.province || addrDetails?.province || 'Maputo Cidade');
        setAddress(listingData.location || '');
        setCountry(listingData.country || addrDetails?.country || 'Mozambique');
        setNeighborhood(listingData.neighborhood || addrDetails?.neighborhood || '');
        setStreet(listingData.street || addrDetails?.street || '');
        setBuildingNumber(listingData.buildingNumber || addrDetails?.buildingNumber || '');
        setBuildingName(listingData.buildingName || addrDetails?.buildingName || '');
        setPostalCode(listingData.postalCode || addrDetails?.postalCode || '');
        setDirectionsLandmark(listingData.directionsLandmark || addrDetails?.directionsLandmark || '');
        
        if (listingData.locationType) {
          setUseGps(listingData.locationType === 'gps' || listingData.locationType === 'both');
          setUsePhysicalAddress(listingData.locationType === 'address' || listingData.locationType === 'both');
        } else {
          setUseGps(Boolean(listingData.coordinates));
          setUsePhysicalAddress(Boolean(listingData.location || listingData.city));
        }

        if (listingData.pinSource) {
          setPinSource(listingData.pinSource);
        }

        if (listingData.coordinates) {
          setCoordinates(listingData.coordinates);
        }
        setSelectedAmenities(listingData.amenities || []);
        
        if (listingData.labeledImages && listingData.labeledImages.length > 0) {
          setPhotos(listingData.labeledImages);
        } else if (listingData.images && listingData.images.length > 0) {
          setPhotos(listingData.images.map((url, i) => ({
            url,
            label: i === 0 ? 'Main View' : `Room Photo #${i + 1}`
          })));
        }

        setNearbyPlaces(listingData.nearbyPlaces || []);
        setAccommodations(listingData.accommodations || []);
        if ((listingData.accommodations && listingData.accommodations.length > 0) || listingData.residenceType === 'lodge') {
          setIsMultiUnit(true);
        }

        if (listingData.canonicalType) {
          setCanonicalType(listingData.canonicalType);
          setClassificationStatus(listingData.classificationStatus || 'VALID_MATCH');
          setSelectedOperatingModels(listingData.operatingModels || []);
          setSelectedSettings(listingData.settings || []);
          const derivedCat = (listingData as any).canonicalCategory || getParentCategoryForType(listingData.canonicalType);
          if (derivedCat) setSelectedParentCategory(derivedCat);
        } else if (listingData.residenceType) {
          const mapping = mapLegacyResidenceType(listingData.residenceType);
          if (mapping) {
            setCanonicalType(mapping.canonicalTypeId);
            setClassificationStatus(mapping.classificationStatus);
            if (mapping.suggestedSettings) setSelectedSettings(mapping.suggestedSettings);
            if (mapping.suggestedOperatingModels) setSelectedOperatingModels(mapping.suggestedOperatingModels);
            const derivedCat = getParentCategoryForType(mapping.canonicalTypeId);
            if (derivedCat) setSelectedParentCategory(derivedCat);
          }
        }
        if ((listingData as any).canonicalCategory) {
          setSelectedParentCategory((listingData as any).canonicalCategory);
        }

        // Prefer standalone special offer from special_offers collection if found, else listing.specialOffer
        const offerToUse = (separateOffer && separateOffer.enabled)
          ? separateOffer
          : listingData.specialOffer || null;
        
        setSpecialOffer(offerToUse);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load listing for editing:', err);
        setLoadError('Could not load listing details.');
        setLoading(false);
      });
  }, [id, user?.uid, isAdmin, authLoading]);

  // MozBook platform commission (15%) and partner earnings (85%)
  const { commissionAmount: hostServiceFee, partnerShare: netHostEarnings } = calculateCommission(price);

  const handleToggleAmenity = (amenityId: string) => {
    if (selectedAmenities.includes(amenityId)) {
      setSelectedAmenities(selectedAmenities.filter((aid) => aid !== amenityId));
    } else {
      setSelectedAmenities([...selectedAmenities, amenityId]);
    }
  };

  const handleSelectResidenceType = (typeId: string) => {
    setResidenceType(typeId as ResidenceType);
    const mapping = mapLegacyResidenceType(typeId);
    if (mapping) {
      setCanonicalType(mapping.canonicalTypeId);
      setClassificationStatus(mapping.classificationStatus);
      const cat = getParentCategoryForType(mapping.canonicalTypeId);
      if (cat) setSelectedParentCategory(cat);
      if (mapping.suggestedSettings) setSelectedSettings(mapping.suggestedSettings);
      if (mapping.suggestedOperatingModels) setSelectedOperatingModels(mapping.suggestedOperatingModels);
    }
  };

  const handleSelectParentCategory = (newCategory: string) => {
    setSelectedParentCategory(newCategory);
    // If the currently selected canonicalType does not belong to the new parent category,
    // update to the first valid canonical type in that category. Otherwise, preserve the current selection!
    if (!canonicalType || !isValidCanonicalCategoryTypePair(newCategory, canonicalType)) {
      const availableTypes = getCanonicalTypesByCategory(newCategory);
      if (availableTypes.length > 0) {
        const nextType = availableTypes[0].backend_id;
        setCanonicalType(nextType);
        setClassificationStatus('VALID_MATCH');
        const legacyFallback = mapCanonicalToLegacyResidenceType(nextType);
        if (legacyFallback) {
          setResidenceType(legacyFallback);
        }
      }
    }
  };

  const handleSelectCanonicalType = (newCanonicalId: CanonicalAccommodationTypeId) => {
    setCanonicalType(newCanonicalId);
    setClassificationStatus('VALID_MATCH');
    const legacyFallback = mapCanonicalToLegacyResidenceType(newCanonicalId);
    if (legacyFallback) {
      setResidenceType(legacyFallback);
    }
    const cat = getParentCategoryForType(newCanonicalId);
    if (cat && cat !== selectedParentCategory) {
      setSelectedParentCategory(cat);
    }
  };

  const handleToggleOperatingModel = (modelId: OperatingModelId) => {
    setSelectedOperatingModels(prev => 
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  const handleToggleSetting = (settingId: SettingId) => {
    setSelectedSettings(prev => 
      prev.includes(settingId) ? prev.filter(id => id !== settingId) : [...prev, settingId]
    );
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

  // Requirement 10: Delete Offer without deleting the underlying listing
  const handleDeleteOffer = async () => {
    if (!id) return;
    if (listingHostId && user?.uid !== listingHostId && !isAdmin) {
      setSubmitError('Unauthorized: You are not authorized to modify special offers for this listing.');
      return;
    }
    setSpecialOffer(null);
    try {
      await removeListingSpecialOffer(id);
      setSaveSuccessMessage('Special offer has been deleted from this listing. The underlying listing remains active.');
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Failed to remove special offer:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!user) {
      login();
      return;
    }

    if (listingHostId && user.uid !== listingHostId && !isAdmin) {
      setSubmitError('Unauthorized: You do not have permission to save changes to this listing.');
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
    setSaveSuccessMessage(null);

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

      const updates = {
        title: title.trim(),
        description: description.trim() || `${residenceType} in ${city}, ${province}.`,
        location: formattedLocation,
        residenceType,
        canonicalType: canonicalType || undefined,
        canonicalCategory: selectedParentCategory,
        operatingModels: selectedOperatingModels.length > 0 ? selectedOperatingModels : undefined,
        settings: selectedSettings.length > 0 ? selectedSettings : undefined,
        classificationStatus: classificationStatus || undefined,
        price,
        minNights,
        images: photos.map((p) => p.url),
        labeledImages: photos,
        amenities: selectedAmenities,
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
        dates: availableFrom && availableTo ? `${availableFrom} to ${availableTo}` : undefined,
        coordinates,
        nearbyPlaces,
        specialOffer: specialOffer && specialOffer.enabled ? specialOffer : null,
        accommodations: (residenceType === 'lodge' || isMultiUnit) ? accommodations : [],
        totalLodgeUnits: (residenceType === 'lodge' || isMultiUnit) ? calculateTotalLodgeUnits(accommodations) : undefined
      };

      // 1. Update listing
      const success = await updateListing(id, updates);
      if (!success) {
        throw new Error('Failed to update listing. Please try again.');
      }

      // 2. Manage promotional information in separate collection (Requirement 11)
      if (specialOffer && specialOffer.enabled) {
        await saveListingSpecialOffer(id, specialOffer);
      } else {
        await removeListingSpecialOffer(id);
      }

      setSaveSuccessMessage('Listing and Special Offer updated successfully!');
      setTimeout(() => {
        navigate(`/listing/${id}`);
      }, 1200);
    } catch (err: any) {
      setSubmitError(err?.message || 'Error occurred while saving listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <Loader2 className="animate-spin text-[#009A60]" size={32} />
          <p className="text-sm font-semibold text-gray-700">Loading listing details...</p>
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Host Authorization Required</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            {unauthorizedReason || 'You do not have permission to manage this listing. Only the listing host or a MozBook administrator can access the host management interface.'}
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              to={id ? `/listing/${id}` : '/'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <span>Return to Public Listing</span>
            </Link>
            <Link
              to="/discover"
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-medium transition-colors"
            >
              <span>Explore MozBook</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
          <AlertCircle size={40} className="text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">{loadError}</h2>
          <p className="text-xs text-gray-500">The listing could not be retrieved or has been removed.</p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-[#009A60] text-white rounded-xl text-xs font-bold"
          >
            Return to MozBook Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70 pb-36">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/listing/${id}`}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              title="Return to Listing"
            >
              <ArrowLeft size={20} />
            </Link>
            <MozBookLogo size="sm" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-gray-400">
              | Edit Listing & Special Pricing
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/listing/${id}`}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {submitError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Listing Update Error</p>
                <p className="text-xs text-rose-700 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {saveSuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-sm flex items-center gap-3">
              <CheckCircle2 size={20} className="shrink-0 text-[#009A60]" />
              <p className="font-semibold">{saveSuccessMessage}</p>
            </div>
          )}

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
                  value={canonicalType || ''}
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

            {canonicalType && getCanonicalAccommodationType(canonicalType) && (
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
                  : 'Accommodation'
              }
            />
          )}

          {/* Section 2: Amenities */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                  Step 2 of 6
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-1">
                  Amenities & Facilities
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Check conveniences offered at your residence.
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
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-gray-900 bg-gray-900 text-white shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-800'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">
                        {amenity.label}
                      </div>
                      <p className={`text-[10px] line-clamp-1 mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {amenity.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Location & GPS */}
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

          {/* Section 4: Calendar, Minimum Nights & Nightly Base Rate */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 4 of 6
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Dates Available, Minimum Nights & Base Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar Range */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Calendar size={18} className="text-[#009A60]" />
                  <span>Calendar Availability Range</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Available From
                    </label>
                    <input
                      type="date"
                      value={availableFrom}
                      onChange={(e) => setAvailableFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Available To
                    </label>
                    <input
                      type="date"
                      value={availableTo}
                      onChange={(e) => setAvailableTo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                </div>

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
                </div>
              </div>

              {/* Nightly Base Rate in MZN */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <DollarSign size={18} className="text-emerald-600" />
                    <span>Regular Base Nightly Rate</span>
                  </div>

                  {/* Currency selector: MZN / USD */}
                  <div className="flex rounded-lg border border-gray-300 bg-white p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCurrency('MZN')}
                      className={`px-2 py-0.5 rounded ${currency === 'MZN' ? 'bg-[#009A60] text-white' : 'text-gray-600'}`}
                    >
                      MZN
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2 py-0.5 rounded ${currency === 'USD' ? 'bg-[#009A60] text-white' : 'text-gray-600'}`}
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
            onDeleteOffer={handleDeleteOffer}
            isEditing={true}
          />

          {/* Section 6: Title, Story & Labeled Photos */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
                Step 6 of 6
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Residence Details & Named Photos
              </h2>
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm md:text-base font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Residence Overview & Story
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              {/* Photos with labels */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">
                    Named Photos ({photos.length})
                  </h3>
                </div>

                {/* Add Photo */}
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
                        Room Name / Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Lounge, Master Bedroom"
                        value={newPhotoLabel}
                        onChange={(e) => setNewPhotoLabel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddPhoto}
                        className="w-full py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus size={15} /> Add Picture
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraModalOpen(true)}
                      className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera size={14} /> Take Photo with Camera
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
                      className="px-3.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={14} /> Upload from Phone / Files
                    </button>
                  </div>
                </div>

                {/* Previews with Editable Labels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {photos.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-2xs flex flex-col justify-between"
                    >
                      <div className="relative aspect-4/3 bg-gray-100">
                        <img
                          src={item.url}
                          alt={item.label || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600 text-white rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            Cover Image
                          </span>
                        )}
                      </div>

                      <div className="p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                          <span className="flex items-center gap-1">
                            <Tag size={11} className="text-[#009A60]" />
                            <span>Room Name</span>
                          </span>
                          <span className="text-gray-400">Photo #{idx + 1}</span>
                        </div>
                        <input
                          type="text"
                          value={item.label || ''}
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
              to={`/listing/${id}`}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel & Discard Changes
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-9 py-3.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl hover:shadow-[#009A60]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Listing & Special Offers</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* In-app Camera Modal */}
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
