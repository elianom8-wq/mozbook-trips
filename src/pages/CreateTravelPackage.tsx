import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Globe,
  Palmtree,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  Utensils,
  Bed,
  Car,
  Compass,
  FileText,
  Save,
  Eye,
  ShieldCheck,
  Check,
  HelpCircle,
  Info,
  UploadCloud,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  TravelPackage,
  DayItinerary,
  MOZAMBIQUE_REGIONS,
  MozambiqueRegion,
  DmcProfile,
  PackageImageMetadata
} from '../types/dmc';
import {
  createTravelPackage,
  getTravelPackageById,
  updateTravelPackage,
  getDmcProfile
} from '../services/dmcService';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';
import {
  uploadPackageImage,
  deletePackageImage,
  validateImageFile,
  validateGalleryLimit,
  MAX_PACKAGE_GALLERY_IMAGES,
  MAX_PACKAGE_IMAGE_SIZE_BYTES,
  savePackageDraftState,
  loadPackageDraftState,
  clearPackageDraftState
} from '../services/packageImageService';

const QUICK_INCLUDED_PRESETS = [
  'All domestic road transfers in air-conditioned 4x4 vehicles',
  'National park entrance & conservation fees (ANAC approved)',
  'Professional licensed English & Portuguese speaking safari guide',
  'Daily breakfast, lunch, and dinner (Full Board)',
  'Daily bottled mineral water & soft drinks during excursions',
  'Scheduled ocean safari & marine excursion boat charters',
  'Maputo International Airport meet-and-greet transfers'
];

const QUICK_EXCLUDED_PRESETS = [
  'International flights to/from Mozambique',
  'Mozambique tourist entry visa / e-Visa fees',
  'Comprehensive international travel & medical evacuation insurance',
  'Premium alcoholic beverages and personal discretionary spending',
  'Gratuities and tips for guides and lodge staff'
];

export interface GalleryItemUI {
  id: string;
  url: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isCover?: boolean;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  file?: File;
}

export default function CreateTravelPackage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editPackageId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Safari & Wildlife');
  const [destinations, setDestinations] = useState<MozambiqueRegion[]>(['Gorongosa National Park & Sofala']);
  const [primaryDestination, setPrimaryDestination] = useState('Gorongosa National Park');
  const [durationDays, setDurationDays] = useState(5);
  const [durationNights, setDurationNights] = useState(4);
  const [minGroupSize, setMinGroupSize] = useState(2);
  const [maxGroupSize, setMaxGroupSize] = useState(8);
  const [isPrivateTourAvailable, setIsPrivateTourAvailable] = useState(true);

  // Pricing
  const [pricePerPersonMzn, setPricePerPersonMzn] = useState<number>(85000);
  const [singleSupplementMzn, setSingleSupplementMzn] = useState<number>(18000);
  const [childPriceMzn, setChildPriceMzn] = useState<number>(55000);
  const [depositPercent, setDepositPercent] = useState<number>(20);

  // Itinerary Days
  const [itinerary, setItinerary] = useState<DayItinerary[]>([
    {
      day: 1,
      title: 'Arrival in Beira & 4x4 Transfer to Gorongosa Safari Camp',
      description: 'Meet-and-greet at Beira Airport (BEW) with your certified MozBook safari ranger. Scenic private 4x4 overland transit through Sofala province to Montebelo Gorongosa Lodge.',
      mealsIncluded: ['dinner'],
      accommodationName: 'Montebelo Gorongosa Safari Lodge',
      activities: ['Welcome orientation', 'Conservation briefing', 'Sunset sundowner drive'],
      transportMode: 'Private air-conditioned 4x4 Safari Cruiser'
    },
    {
      day: 2,
      title: 'Full-Day Big 5 Safari & Lion Pride Tracking',
      description: 'Early morning game drive along Lake Urema floodplains. Tracking lion prides, large elephant herds, and endemic waterbuck populations with resident researchers.',
      mealsIncluded: ['breakfast', 'lunch', 'dinner'],
      accommodationName: 'Montebelo Gorongosa Safari Lodge',
      activities: ['Morning Game Drive', 'Lake Urema boat safari', 'Nocturnal predator drive'],
      transportMode: 'Open 4x4 Safari Vehicle'
    },
    {
      day: 3,
      title: 'Mount Gorongosa Rainforest & Coffee Community Project',
      description: 'Ascend the lush misty rainforest of Mount Gorongosa. Visit the community agroforestry coffee plantations supporting local conservation initiatives.',
      mealsIncluded: ['breakfast', 'lunch', 'dinner'],
      accommodationName: 'Montebelo Gorongosa Safari Lodge',
      activities: ['Rainforest canopy hike', 'Gorongosa Coffee tasting', 'Birding walk'],
      transportMode: '4x4 Mountain Cruiser'
    }
  ]);

  // Deliverables
  const [included, setIncluded] = useState<string[]>([
    'All domestic road transfers in air-conditioned 4x4 vehicles',
    'National park entrance & conservation fees (ANAC approved)',
    'Professional licensed English & Portuguese speaking safari guide',
    'Daily breakfast, lunch, and dinner (Full Board)'
  ]);
  const [newIncludedItem, setNewIncludedItem] = useState('');

  const [notIncluded, setNotIncluded] = useState<string[]>([
    'International flights to/from Mozambique',
    'Mozambique tourist entry visa / e-Visa fees',
    'Comprehensive international travel & medical evacuation insurance'
  ]);
  const [newNotIncludedItem, setNewNotIncludedItem] = useState('');

  const [whatToBring, setWhatToBring] = useState<string[]>([
    'Neutral safari-colored lightweight clothing (khaki, beige, olive)',
    'Wide-brimmed sun hat, polarized sunglasses, high SPF sunblock',
    'Comfortable closed walking shoes or trekking boots',
    'Prescribed malaria prophylaxis and personal medications'
  ]);
  const [travelRequirements, setTravelRequirements] = useState<string[]>([
    'Valid passport with minimum 6 months remaining validity',
    'Yellow fever vaccination card (mandatory if arriving from endemic transit zones)'
  ]);

  const [pickupLocation, setPickupLocation] = useState('Beira International Airport (BEW) or Maputo (MPM)');
  const [dropoffLocation, setDropoffLocation] = useState('Beira International Airport (BEW)');
  const [meetingPointInstructions, setMeetingPointInstructions] = useState('Your tour guide will meet you at the arrivals terminal holding a personalized MozBook welcome sign.');

  // Departure Scheduling
  const [scheduleType, setScheduleType] = useState<'scheduled_dates' | 'flexible_daily' | 'on_request'>('scheduled_dates');
  const [departureDates, setDepartureDates] = useState<string[]>([
    '2026-11-15',
    '2026-12-01',
    '2026-12-15',
    '2027-01-10'
  ]);
  const [newDateInput, setNewDateInput] = useState('');

  // Media State & Draft Scoping
  const [packageDraftId] = useState<string>(() => {
    return editPackageId || `pkg_draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  });
  const effectivePackageId = editPackageId || packageDraftId;

  const [coverImage, setCoverImage] = useState<string>('');
  const [coverStoragePath, setCoverStoragePath] = useState<string | undefined>(undefined);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [showManualUrlFallback, setShowManualUrlFallback] = useState(false);


  const [galleryItems, setGalleryItems] = useState<GalleryItemUI[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [imageMetadata, setImageMetadata] = useState<PackageImageMetadata[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  // Status
  const [status, setStatus] = useState<'draft' | 'pending' | 'published' | 'paused' | 'archived'>('published');
  const [dmcProfile, setDmcProfile] = useState<DmcProfile | null>(null);
  const [dmcAgencyName, setDmcAgencyName] = useState('');
  const [dmcLicense, setDmcLicense] = useState('');

  // Load existing package if in edit mode, or restore draft
  useEffect(() => {
    async function init() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      // Fetch host DMC details
      try {
        const profile = await getDmcProfile(user.uid);
        if (profile) {
          setDmcProfile(profile);
          setDmcAgencyName(profile.tradingName || profile.legalBusinessName);
          setDmcLicense(profile.inaturLicenseNumber);
        }
      } catch (e) {
        console.warn('Could not load DMC profile details:', e);
      }

      // 1. If editing existing package from Firestore
      if (editPackageId) {
        try {
          const pkg = await getTravelPackageById(editPackageId);
          if (pkg) {
            setTitle(pkg.title || '');
            setSubtitle(pkg.subtitle || '');
            setShortDescription(pkg.shortDescription || '');
            setDescription(pkg.description || '');
            setCategory(pkg.category || 'Safari & Wildlife');
            if (pkg.destinations?.length) setDestinations(pkg.destinations);
            setPrimaryDestination(pkg.primaryDestination || '');
            setDurationDays(pkg.durationDays || 3);
            setDurationNights(pkg.durationNights || 2);
            setMinGroupSize(pkg.minGroupSize || 2);
            setMaxGroupSize(pkg.maxGroupSize || 8);
            setIsPrivateTourAvailable(pkg.isPrivateTourAvailable ?? true);
            setPricePerPersonMzn(pkg.pricePerPersonMzn || 0);
            setSingleSupplementMzn(pkg.singleSupplementMzn || 0);
            setChildPriceMzn(pkg.childPriceMzn || 0);
            setDepositPercent(pkg.depositPercent || 20);
            if (pkg.itinerary?.length) setItinerary(pkg.itinerary);
            if (pkg.included?.length) setIncluded(pkg.included);
            if (pkg.notIncluded?.length) setNotIncluded(pkg.notIncluded);
            if (pkg.whatToBring?.length) setWhatToBring(pkg.whatToBring);
            if (pkg.travelRequirements?.length) setTravelRequirements(pkg.travelRequirements);
            setPickupLocation(pkg.pickupLocation || '');
            setDropoffLocation(pkg.dropoffLocation || '');
            setMeetingPointInstructions(pkg.meetingPointInstructions || '');
            setScheduleType(pkg.scheduleType || 'scheduled_dates');
            if (pkg.departureDates?.length) setDepartureDates(pkg.departureDates);
            setCoverImage(pkg.coverImage || '');

            const metaList = pkg.imageMetadata || [];
            setImageMetadata(metaList);

            if (pkg.images?.length) {
              setImages(pkg.images);
              const loadedItems: GalleryItemUI[] = pkg.images.map((imgUrl, idx) => {
                const matchedMeta = metaList.find(m => m.url === imgUrl);
                return {
                  id: matchedMeta?.id || `img_loaded_${idx}_${Date.now()}`,
                  url: imgUrl,
                  storagePath: matchedMeta?.storagePath,
                  fileName: matchedMeta?.fileName || `Photo ${idx + 1}`,
                  fileSize: matchedMeta?.fileSize,
                  mimeType: matchedMeta?.mimeType,
                  isCover: imgUrl === pkg.coverImage,
                  status: 'success',
                  progress: 100
                };
              });
              setGalleryItems(loadedItems);
            }
            setStatus(pkg.status || 'published');
          }
        } catch (e) {
          console.error('Failed to load package for edit:', e);
        }
      } else {
        // 2. New package: Check if draft was preserved in session
        try {
          const savedDraft = loadPackageDraftState(user.uid);
          if (savedDraft && (savedDraft.title || savedDraft.coverImage || savedDraft.galleryItems?.length)) {
            if (savedDraft.title) setTitle(savedDraft.title);
            if (savedDraft.subtitle) setSubtitle(savedDraft.subtitle);
            if (savedDraft.shortDescription) setShortDescription(savedDraft.shortDescription);
            if (savedDraft.description) setDescription(savedDraft.description);
            if (savedDraft.category) setCategory(savedDraft.category);
            if (savedDraft.destinations?.length) setDestinations(savedDraft.destinations);
            if (savedDraft.primaryDestination) setPrimaryDestination(savedDraft.primaryDestination);
            if (savedDraft.durationDays) setDurationDays(savedDraft.durationDays);
            if (savedDraft.durationNights) setDurationNights(savedDraft.durationNights);
            if (savedDraft.minGroupSize) setMinGroupSize(savedDraft.minGroupSize);
            if (savedDraft.maxGroupSize) setMaxGroupSize(savedDraft.maxGroupSize);
            if (savedDraft.pricePerPersonMzn) setPricePerPersonMzn(savedDraft.pricePerPersonMzn);
            if (savedDraft.singleSupplementMzn) setSingleSupplementMzn(savedDraft.singleSupplementMzn);
            if (savedDraft.childPriceMzn) setChildPriceMzn(savedDraft.childPriceMzn);
            if (savedDraft.depositPercent) setDepositPercent(savedDraft.depositPercent);
            if (savedDraft.itinerary?.length) setItinerary(savedDraft.itinerary);
            if (savedDraft.included?.length) setIncluded(savedDraft.included);
            if (savedDraft.notIncluded?.length) setNotIncluded(savedDraft.notIncluded);
            if (savedDraft.whatToBring?.length) setWhatToBring(savedDraft.whatToBring);
            if (savedDraft.travelRequirements?.length) setTravelRequirements(savedDraft.travelRequirements);
            if (savedDraft.pickupLocation) setPickupLocation(savedDraft.pickupLocation);
            if (savedDraft.dropoffLocation) setDropoffLocation(savedDraft.dropoffLocation);
            if (savedDraft.meetingPointInstructions) setMeetingPointInstructions(savedDraft.meetingPointInstructions);
            if (savedDraft.departureDates?.length) setDepartureDates(savedDraft.departureDates);
            if (savedDraft.coverImage) setCoverImage(savedDraft.coverImage);
            if (savedDraft.coverStoragePath) setCoverStoragePath(savedDraft.coverStoragePath);
            if (savedDraft.galleryItems?.length) {
              setGalleryItems(savedDraft.galleryItems);
              setImages(savedDraft.galleryItems.map((g: any) => g.url));
            }
            if (savedDraft.imageMetadata) setImageMetadata(savedDraft.imageMetadata);
            setHasRestoredDraft(true);
          }
        } catch (draftErr) {
          console.warn('Could not restore draft:', draftErr);
        }
      }
      setLoading(false);
    }
    init();
  }, [user?.uid, editPackageId]);

  // Itinerary Handlers
  const addDay = () => {
    const nextDayNum = itinerary.length + 1;
    const newDay: DayItinerary = {
      day: nextDayNum,
      title: `Day ${nextDayNum}: Scheduled Excursion & Cultural Exploration`,
      description: 'Morning guided activity followed by afternoon leisure and evening dinner.',
      mealsIncluded: ['breakfast', 'dinner'],
      accommodationName: 'Selected Partner Lodge or Resort',
      activities: ['Guided safari/coastal excursion'],
      transportMode: 'Tour vehicle'
    };
    setItinerary([...itinerary, newDay]);
    setDurationDays(nextDayNum);
    setDurationNights(Math.max(1, nextDayNum - 1));
  };

  const removeDay = (index: number) => {
    if (itinerary.length <= 1) return;
    const updated = itinerary
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, day: i + 1 }));
    setItinerary(updated);
    setDurationDays(updated.length);
    setDurationNights(Math.max(1, updated.length - 1));
  };

  const updateDayField = (index: number, field: keyof DayItinerary, value: any) => {
    const updated = [...itinerary];
    updated[index] = { ...updated[index], [field]: value };
    setItinerary(updated);
  };

  const toggleDayMeal = (dayIndex: number, meal: 'breakfast' | 'lunch' | 'dinner') => {
    const updated = [...itinerary];
    const currentMeals = updated[dayIndex].mealsIncluded || [];
    if (currentMeals.includes(meal)) {
      updated[dayIndex].mealsIncluded = currentMeals.filter(m => m !== meal);
    } else {
      updated[dayIndex].mealsIncluded = [...currentMeals, meal];
    }
    setItinerary(updated);
  };

  // Deliverables Handlers
  const addIncluded = () => {
    if (newIncludedItem.trim() && !included.includes(newIncludedItem.trim())) {
      setIncluded([...included, newIncludedItem.trim()]);
      setNewIncludedItem('');
    }
  };

  const removeIncluded = (index: number) => {
    setIncluded(included.filter((_, i) => i !== index));
  };

  const addNotIncluded = () => {
    if (newNotIncludedItem.trim() && !notIncluded.includes(newNotIncludedItem.trim())) {
      setNotIncluded([...notIncluded, newNotIncludedItem.trim()]);
      setNewNotIncludedItem('');
    }
  };

  const removeNotIncluded = (index: number) => {
    setNotIncluded(notIncluded.filter((_, i) => i !== index));
  };

  // Departure Dates Handlers
  const addDepartureDate = () => {
    if (newDateInput && !departureDates.includes(newDateInput)) {
      setDepartureDates([...departureDates, newDateInput].sort());
      setNewDateInput('');
    }
  };

  const removeDepartureDate = (dateToRemove: string) => {
    setDepartureDates(departureDates.filter(d => d !== dateToRemove));
  };

  // Destination toggle
  const toggleDestination = (dest: MozambiqueRegion) => {
    setDestinations(prev =>
      prev.includes(dest) ? prev.filter(d => d !== dest) : [...prev, dest]
    );
  };

  // -------------------------------------------------------------
  // Image Upload, Gallery & Draft Handlers
  // -------------------------------------------------------------

  // Keep `images: string[]` synchronized with valid gallery items
  useEffect(() => {
    const validUrls = galleryItems
      .filter(item => item.status === 'success' || (item.url && !item.url.startsWith('blob:')))
      .map(item => item.url);
    setImages(validUrls);
  }, [galleryItems]);

  // Auto-save draft changes to sessionStorage
  useEffect(() => {
    if (!user?.uid || loading) return;
    const draftData = {
      title,
      subtitle,
      shortDescription,
      description,
      category,
      destinations,
      primaryDestination,
      durationDays,
      durationNights,
      minGroupSize,
      maxGroupSize,
      isPrivateTourAvailable,
      pricePerPersonMzn,
      singleSupplementMzn,
      childPriceMzn,
      depositPercent,
      itinerary,
      included,
      notIncluded,
      whatToBring,
      travelRequirements,
      pickupLocation,
      dropoffLocation,
      meetingPointInstructions,
      departureDates,
      scheduleType,
      coverImage,
      coverStoragePath,
      images,
      imageMetadata,
      galleryItems: galleryItems.filter(i => i.status === 'success')
    };
    savePackageDraftState(user.uid, draftData, editPackageId);
  }, [
    user?.uid,
    loading,
    title,
    subtitle,
    shortDescription,
    description,
    category,
    destinations,
    primaryDestination,
    durationDays,
    durationNights,
    minGroupSize,
    maxGroupSize,
    isPrivateTourAvailable,
    pricePerPersonMzn,
    singleSupplementMzn,
    childPriceMzn,
    depositPercent,
    itinerary,
    included,
    notIncluded,
    whatToBring,
    travelRequirements,
    pickupLocation,
    dropoffLocation,
    meetingPointInstructions,
    departureDates,
    scheduleType,
    coverImage,
    coverStoragePath,
    images,
    imageMetadata,
    galleryItems,
    editPackageId
  ]);

  // Cover photo upload handler
  const handleCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processCoverUpload(file);
  };

  const processCoverUpload = async (file: File) => {
    setCoverUploadError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setCoverUploadError(validation.error || 'Invalid image file.');
      return;
    }

    if (!user?.uid) {
      setCoverUploadError('Please sign in to upload package photos.');
      return;
    }

    setIsUploadingCover(true);
    setCoverUploadProgress(0);

    try {
      const result = await uploadPackageImage(
        file,
        user.uid,
        effectivePackageId,
        (progress) => setCoverUploadProgress(progress)
      );

      setCoverImage(result.url);
      setCoverStoragePath(result.storagePath);
      setCoverUploadProgress(100);

      // Add to gallery items if not present, and mark as cover
      setGalleryItems(prev => {
        const existingIdx = prev.findIndex(item => item.url === result.url || (result.storagePath && item.storagePath === result.storagePath));
        if (existingIdx >= 0) {
          return prev.map((item, idx) => ({
            ...item,
            isCover: idx === existingIdx
          }));
        }
        const newItem: GalleryItemUI = {
          id: result.id,
          url: result.url,
          storagePath: result.storagePath,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          isCover: true,
          status: 'success',
          progress: 100
        };
        return [newItem, ...prev.map(p => ({ ...p, isCover: false }))].slice(0, MAX_PACKAGE_GALLERY_IMAGES);
      });

      setImageMetadata(prev => {
        const filtered = prev.filter(m => m.url !== result.url);
        return [{
          id: result.id,
          url: result.url,
          storagePath: result.storagePath,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          uploadedAt: result.uploadedAt,
          isCover: true
        }, ...filtered.map(m => ({ ...m, isCover: false }))];
      });
    } catch (err: any) {
      console.error('Cover upload error:', err);
      setCoverUploadError(err.message || 'Failed to upload cover photo. Please verify your connection.');
      setCoverUploadProgress(0);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = async () => {
    if (coverStoragePath && user?.uid) {
      deletePackageImage(coverStoragePath, user.uid).catch(() => {});
    }
    setCoverImage('');
    setCoverStoragePath(undefined);
    setCoverUploadError(null);
    setCoverUploadProgress(0);
    setGalleryItems(prev => prev.map(p => ({ ...p, isCover: false })));
  };

  // Gallery multi-file upload handler
  const handleGalleryFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    e.target.value = '';
    await processGalleryUploads(files);
  };

  const processGalleryUploads = async (files: File[]) => {
    setGalleryError(null);
    if (!user?.uid) {
      setGalleryError('Please sign in to upload package photos.');
      return;
    }

    const currentCount = galleryItems.length;
    const limitCheck = validateGalleryLimit(currentCount, files.length);
    if (!limitCheck.valid) {
      setGalleryError(limitCheck.error || `Maximum ${MAX_PACKAGE_GALLERY_IMAGES} photos permitted.`);
      return;
    }

    const idToken = await user.getIdToken().catch(() => undefined);

    for (const file of files) {
      const val = validateImageFile(file);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const previewUrl = URL.createObjectURL(file);

      if (!val.valid) {
        setGalleryItems(prev => [
          ...prev,
          {
            id: tempId,
            url: previewUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            status: 'error',
            progress: 0,
            error: val.error,
            file
          }
        ]);
        continue;
      }

      setGalleryItems(prev => [
        ...prev,
        {
          id: tempId,
          url: previewUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          status: 'uploading',
          progress: 0,
          file
        }
      ]);

      uploadPackageImage(
        file,
        user.uid,
        effectivePackageId,
        (progress) => {
          setGalleryItems(prev =>
            prev.map(item => item.id === tempId ? { ...item, progress } : item)
          );
        }
      )
        .then((result) => {
          setGalleryItems(prev => {
            const updated = prev.map(item => {
              if (item.id === tempId) {
                return {
                  id: result.id,
                  url: result.url,
                  storagePath: result.storagePath,
                  fileName: result.fileName,
                  fileSize: result.fileSize,
                  mimeType: result.mimeType,
                  status: 'success' as const,
                  progress: 100,
                  isCover: !coverImage && prev[0]?.id === tempId
                };
              }
              return item;
            });
            return updated;
          });

          // If no cover is active yet, designate the first successful photo as cover
          setCoverImage(current => current || result.url);

          setImageMetadata(prev => [
            ...prev,
            {
              id: result.id,
              url: result.url,
              storagePath: result.storagePath,
              fileName: result.fileName,
              fileSize: result.fileSize,
              mimeType: result.mimeType,
              uploadedAt: result.uploadedAt
            }
          ]);
        })
        .catch((uploadErr) => {
          setGalleryItems(prev =>
            prev.map(item =>
              item.id === tempId
                ? { ...item, status: 'error', error: uploadErr.message || 'Upload failed' }
                : item
            )
          );
        });
    }
  };

  const handleRetryUpload = async (item: GalleryItemUI) => {
    if (!item.file || !user?.uid) return;
    setGalleryItems(prev =>
      prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0, error: undefined } : i)
    );

    try {
      const result = await uploadPackageImage(
        item.file,
        user.uid,
        effectivePackageId,
        (progress) => {
          setGalleryItems(prev =>
            prev.map(i => i.id === item.id ? { ...i, progress } : i)
          );
        }
      );

      setGalleryItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                id: result.id,
                url: result.url,
                storagePath: result.storagePath,
                fileName: result.fileName,
                fileSize: result.fileSize,
                mimeType: result.mimeType,
                status: 'success',
                progress: 100
              }
            : i
        )
      );
      if (!coverImage) {
        setCoverImage(result.url);
      }
    } catch (err: any) {
      setGalleryItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', error: err.message || 'Retry failed' }
            : i
        )
      );
    }
  };

  const handleSetCoverPhoto = (item: GalleryItemUI) => {
    setCoverImage(item.url);
    if (item.storagePath) setCoverStoragePath(item.storagePath);
    setGalleryItems(prev =>
      prev.map(i => ({
        ...i,
        isCover: i.url === item.url
      }))
    );
  };

  const handleRemoveGalleryItem = async (index: number) => {
    const item = galleryItems[index];
    if (!item) return;

    if (item.storagePath && user?.uid) {
      deletePackageImage(item.storagePath, user.uid).catch(() => {});
    }

    const updated = galleryItems.filter((_, i) => i !== index);
    setGalleryItems(updated);

    if (item.isCover || coverImage === item.url) {
      const nextCover = updated[0]?.url || '';
      setCoverImage(nextCover);
      if (updated[0]) {
        updated[0].isCover = true;
      }
    }
  };

  const handleMoveGalleryItem = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= galleryItems.length) return;

    const updated = [...galleryItems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setGalleryItems(updated);
  };

  const handleManualAddUrl = () => {
    if (!newImageUrl.trim()) return;
    const url = newImageUrl.trim();
    if (galleryItems.some(i => i.url === url)) {
      setGalleryError('This image URL is already in your gallery.');
      return;
    }
    const limitCheck = validateGalleryLimit(galleryItems.length, 1);
    if (!limitCheck.valid) {
      setGalleryError(limitCheck.error || `Maximum ${MAX_PACKAGE_GALLERY_IMAGES} photos permitted.`);
      return;
    }

    const newItem: GalleryItemUI = {
      id: `img_url_${Date.now()}`,
      url,
      fileName: 'External Photo',
      status: 'success',
      progress: 100,
      isCover: !coverImage
    };

    setGalleryItems(prev => [...prev, newItem]);
    if (!coverImage) {
      setCoverImage(url);
    }
    setNewImageUrl('');
    setGalleryError(null);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length > 0) {
      await processGalleryUploads(files);
    }
  };

  const handleClearRestoredDraft = () => {
    if (window.confirm('Clear your restored draft and start with a fresh template?')) {
      clearPackageDraftState(user?.uid || '', editPackageId);
      setHasRestoredDraft(false);
      window.location.reload();
    }
  };

  // Financial commission calculation
  const commission = calculateCommission(pricePerPersonMzn);

  // Submission
  const handleSubmit = async (publishImmediately: boolean = true) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Guard against incomplete/in-progress uploads
    const isUploading = galleryItems.some(i => i.status === 'uploading') || isUploadingCover;
    if (isUploading) {
      setErrorMessage('Please wait for photo uploads to finish before saving or publishing.');
      return;
    }

    // 2. Form field validations
    if (!title.trim()) {
      setErrorMessage('Please provide a package title.');
      return;
    }
    if (!shortDescription.trim()) {
      setErrorMessage('Please provide a short summary for package cards.');
      return;
    }
    if (pricePerPersonMzn <= 0) {
      setErrorMessage('Please set a valid price per person in MZN.');
      return;
    }
    if (destinations.length === 0) {
      setErrorMessage('Please select at least one Mozambique operating destination.');
      return;
    }
    if (itinerary.length === 0) {
      setErrorMessage('A travel package must include at least 1 day itinerary.');
      return;
    }
    if (publishImmediately && dmcProfile?.status !== 'approved') {
      setErrorMessage('Your DMC registration must be approved before packages can be published to the public marketplace. Please save as draft until your application is verified.');
      return;
    }

    setSaving(true);
    const targetStatus = publishImmediately ? 'published' : 'draft';

    try {
      const finalCover = coverImage || galleryItems.find(i => i.status === 'success')?.url || '';
      const finalGalleryUrls = galleryItems
        .filter(i => i.status === 'success')
        .map(i => i.url);
      const combinedImages = finalGalleryUrls.length > 0
        ? (finalCover && !finalGalleryUrls.includes(finalCover) ? [finalCover, ...finalGalleryUrls] : finalGalleryUrls)
        : (finalCover ? [finalCover] : []);

      const payload: Omit<TravelPackage, 'id' | 'createdAt' | 'updatedAt'> = {
        hostId: user?.uid || 'guest_dmc',
        hostName: user?.displayName || dmcAgencyName || 'MozBook DMC Partner',
        hostEmail: user?.email || '',
        agencyName: dmcAgencyName || 'MozBook Tour Operator',
        inaturLicenseNumber: dmcLicense || '',
        title: title.trim(),
        subtitle: subtitle.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim() || shortDescription.trim(),
        category,
        destinations,
        primaryDestination: primaryDestination || destinations[0],
        durationDays,
        durationNights,
        itinerary,
        minGroupSize,
        maxGroupSize,
        isPrivateTourAvailable,
        pricePerPersonMzn,
        singleSupplementMzn,
        childPriceMzn,
        depositPercent,
        currency: 'MZN',
        included,
        notIncluded,
        whatToBring,
        travelRequirements,
        pickupLocation: pickupLocation.trim(),
        dropoffLocation: dropoffLocation.trim(),
        meetingPointInstructions: meetingPointInstructions.trim(),
        departureDates,
        scheduleType,
        coverImage: finalCover,
        images: combinedImages,
        imageMetadata,
        status: targetStatus
      };

      if (editPackageId) {
        await updateTravelPackage(editPackageId, payload);
        setSuccessMessage('Travel package updated successfully!');
      } else {
        await createTravelPackage(payload);
        setSuccessMessage('Travel package created and published successfully!');
      }

      // Clear draft on successful persistence
      clearPackageDraftState(user?.uid || '', editPackageId);

      setTimeout(() => {
        navigate('/partner/dmc/dashboard');
      }, 1500);
    } catch (e: any) {
      console.error('Error saving package:', e);
      setErrorMessage(e.message || 'Failed to save travel package.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-28 pt-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Breadcrumbs */}
        <div className="flex items-center justify-between">
          <Link
            to="/partner/dmc/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to DMC Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-[#009A60]">
              {editPackageId ? 'Edit Package' : 'New Package Builder'}
            </span>
          </div>
        </div>

        {/* Title Bar */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[#009A60] text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Mozambique DMC Travel Package Builder</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-950 tracking-tight">
            {editPackageId ? 'Edit Multi-Service Travel Package' : 'Design a New Travel Package & Itinerary'}
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">
            Create high-end safari packages, coastal island expeditions, and bespoke multi-day itineraries across Mozambique.
          </p>
        </div>

        {/* Feedback Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Restored Draft Alert */}
        {hasRestoredDraft && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <RotateCcw size={18} className="text-amber-600 shrink-0" />
              <span>
                <strong>Unsaved Draft Restored:</strong> We found an in-progress draft from your last session and restored your package fields and gallery photos.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearRestoredDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Reset to Blank</span>
            </button>
          </div>
        )}

        {/* Main Builder Form Container */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-8">
          
          {/* SECTION 1: Basic Details */}
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">1. Package Overview & Destinations</h2>
                <p className="text-xs text-gray-500">Provide the title, summary, and destinations across Mozambique.</p>
              </div>
              <span className="text-xs font-bold text-[#009A60] bg-emerald-50 px-2.5 py-1 rounded-full">
                Step 1 of 5
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Package Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 5-Day Gorongosa Wilderness Safari & Lake Urema Boat Cruise"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Subtitle / Highlights Tagline
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Big 5 Conservation, Rainforest Canopy Hike & Montebelo Luxury Camp"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Package Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  >
                    <option value="Safari & Wildlife">Safari & Wildlife</option>
                    <option value="Coastal & Marine Island Charters">Coastal & Marine Island Charters</option>
                    <option value="Cultural & Historical Heritage">Cultural & Historical Heritage</option>
                    <option value="Bespoke Luxury & Honeymoon">Bespoke Luxury & Honeymoon</option>
                    <option value="Overland 4x4 & Adventure">Overland 4x4 & Adventure</option>
                    <option value="Scuba Diving & Ocean Safari">Scuba Diving & Ocean Safari</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Primary Destination Hub *
                  </label>
                  <input
                    type="text"
                    value={primaryDestination}
                    onChange={(e) => setPrimaryDestination(e.target.value)}
                    placeholder="e.g. Gorongosa National Park"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>
              </div>

              {/* Operating Regions */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Destinations Included in Package ({destinations.length} selected) *
                </label>
                <div className="flex flex-wrap gap-2">
                  {MOZAMBIQUE_REGIONS.map(reg => {
                    const isSelected = destinations.includes(reg);
                    return (
                      <button
                        type="button"
                        key={reg}
                        onClick={() => toggleDestination(reg)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#009A60] border-[#009A60] text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <MapPin size={12} />
                        <span>{reg}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Short Description (Shown on search cards) *
                </label>
                <textarea
                  rows={2}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Experience Mozambique's legendary wildlife recovery in Gorongosa National Park..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Detailed Package Narrative
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive description of the journey, conservation impact, landscape, and experience..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Duration, Capacity & Group Size */}
          <div className="space-y-5 pt-6 border-t border-gray-100">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">2. Duration & Group Capacity</h2>
                <p className="text-xs text-gray-500">Days, nights, and group participation boundaries.</p>
              </div>
              <span className="text-xs font-bold text-[#009A60] bg-emerald-50 px-2.5 py-1 rounded-full">
                Step 2 of 5
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Duration (Days) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Duration (Nights) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={durationNights}
                  onChange={(e) => setDurationNights(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Min Group Size *
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={minGroupSize}
                  onChange={(e) => setMinGroupSize(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Max Group Size *
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxGroupSize}
                  onChange={(e) => setMaxGroupSize(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                id="privateTour"
                checked={isPrivateTourAvailable}
                onChange={(e) => setIsPrivateTourAvailable(e.target.checked)}
                className="w-4 h-4 text-[#009A60] rounded border-gray-300 focus:ring-[#009A60]"
              />
              <label htmlFor="privateTour" className="text-xs font-bold text-gray-800 cursor-pointer">
                Available as a Private Tailored Departure on request (Exclusive vehicle & guide)
              </label>
            </div>
          </div>

          {/* SECTION 3: Day-by-Day Itinerary Builder */}
          <div className="space-y-5 pt-6 border-t border-gray-100">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">3. Day-by-Day Itinerary Builder</h2>
                <p className="text-xs text-gray-500">Add daily itineraries, activities, meals, and overnight accommodations.</p>
              </div>
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-[#009A60] hover:bg-emerald-100 text-xs font-bold transition-colors"
              >
                <Plus size={14} />
                <span>Add Day {itinerary.length + 1}</span>
              </button>
            </div>

            <div className="space-y-4">
              {itinerary.map((dayItem, index) => (
                <div
                  key={index}
                  className="p-5 rounded-2xl border-2 border-gray-200 bg-gray-50/50 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#009A60] text-white">
                      Day {dayItem.day}
                    </span>
                    {itinerary.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDay(index)}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>Remove Day</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Day {dayItem.day} Title *
                    </label>
                    <input
                      type="text"
                      value={dayItem.title}
                      onChange={(e) => updateDayField(index, 'title', e.target.value)}
                      placeholder="e.g. Wildlife Safari Drive & Boat Cruise"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Daily Schedule & Narrative *
                    </label>
                    <textarea
                      rows={2}
                      value={dayItem.description}
                      onChange={(e) => updateDayField(index, 'description', e.target.value)}
                      placeholder="Detailed schedule of the morning and afternoon activities..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Bed size={13} className="text-emerald-700" />
                        <span>Overnight Accommodation</span>
                      </label>
                      <input
                        type="text"
                        value={dayItem.accommodationName || ''}
                        onChange={(e) => updateDayField(index, 'accommodationName', e.target.value)}
                        placeholder="e.g. Montebelo Gorongosa Lodge or Luxury Tented Camp"
                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Car size={13} className="text-emerald-700" />
                        <span>Transport Mode</span>
                      </label>
                      <input
                        type="text"
                        value={dayItem.transportMode || ''}
                        onChange={(e) => updateDayField(index, 'transportMode', e.target.value)}
                        placeholder="e.g. 4x4 Safari Land Cruiser, Boat Charter, Domestic Flight"
                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                      />
                    </div>
                  </div>

                  {/* Meals Included */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <Utensils size={13} className="text-emerald-700" />
                      <span>Meals Included on Day {dayItem.day}</span>
                    </label>
                    <div className="flex gap-3">
                      {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
                        const isIncluded = dayItem.mealsIncluded?.includes(meal);
                        return (
                          <button
                            type="button"
                            key={meal}
                            onClick={() => toggleDayMeal(index, meal)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                              isIncluded
                                ? 'bg-emerald-100 border-[#009A60] text-emerald-900'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            {meal === 'breakfast' && '☕ Breakfast'}
                            {meal === 'lunch' && '🥪 Lunch'}
                            {meal === 'dinner' && '🍽️ Dinner'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: Inclusions, Exclusions & Requirements */}
          <div className="space-y-5 pt-6 border-t border-gray-100">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">4. Inclusions, Exclusions & Meeting Points</h2>
                <p className="text-xs text-gray-500">Clarify deliverables to protect both travelers and your agency.</p>
              </div>
              <span className="text-xs font-bold text-[#009A60] bg-emerald-50 px-2.5 py-1 rounded-full">
                Step 4 of 5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inclusions */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#009A60]" />
                  <span>Included in Package</span>
                </label>
                <div className="space-y-2">
                  {included.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 text-xs text-emerald-950 font-medium">
                      <span>✓ {item}</span>
                      <button type="button" onClick={() => removeIncluded(idx)} className="text-red-400 hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIncludedItem}
                      onChange={(e) => setNewIncludedItem(e.target.value)}
                      placeholder="Add an included item..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                    <button
                      type="button"
                      onClick={addIncluded}
                      className="px-3 py-2 rounded-xl bg-[#009A60] text-white text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Exclusions */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600" />
                  <span>Not Included (Exclusions)</span>
                </label>
                <div className="space-y-2">
                  {notIncluded.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 text-xs text-amber-950 font-medium">
                      <span>✕ {item}</span>
                      <button type="button" onClick={() => removeNotIncluded(idx)} className="text-red-400 hover:text-red-700">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNotIncludedItem}
                      onChange={(e) => setNewNotIncludedItem(e.target.value)}
                      placeholder="Add an exclusion..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                    <button
                      type="button"
                      onClick={addNotIncluded}
                      className="px-3 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Meeting Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Pickup & Meeting Point *
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Maputo International Airport (MPM)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Drop-off / Final Departure Point *
                </label>
                <input
                  type="text"
                  value={dropoffLocation}
                  onChange={(e) => setDropoffLocation(e.target.value)}
                  placeholder="e.g. Beira Airport (BEW) or Maputo (MPM)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Pricing, Commission & Scheduled Departures */}
          <div className="space-y-5 pt-6 border-t border-gray-100">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">5. Pricing & Scheduled Departures</h2>
                <p className="text-xs text-gray-500">Authoritative package rate in MZN, commission display, and scheduled dates.</p>
              </div>
              <span className="text-xs font-bold text-[#009A60] bg-emerald-50 px-2.5 py-1 rounded-full">
                Step 5 of 5
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Base Price Per Person (MZN) *
                </label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={pricePerPersonMzn}
                  onChange={(e) => setPricePerPersonMzn(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Single Room Supplement (MZN)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={singleSupplementMzn}
                  onChange={(e) => setSingleSupplementMzn(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Deposit Required (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>
            </div>

            {/* Platform Commission Calculation Card */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#009A60] uppercase tracking-wider">
                  MozBook Platform Pricing Transparent Model
                </span>
                <div className="text-xs text-emerald-950">
                  Per person booking: <strong>{pricePerPersonMzn.toLocaleString()} MZN</strong> (~${Math.round(pricePerPersonMzn / 64).toLocaleString()} USD)
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div>
                  <div className="text-gray-500 font-medium">Platform Fee ({commission.commissionPercent}%)</div>
                  <div className="font-bold text-gray-700">{commission.commissionAmount.toLocaleString()} MZN</div>
                </div>
                <div>
                  <div className="text-emerald-700 font-bold">Your Partner Net ({commission.partnerPercent}%)</div>
                  <div className="text-base font-black text-[#009A60]">{commission.partnerShare.toLocaleString()} MZN</div>
                </div>
              </div>
            </div>

            {/* Scheduled Departure Dates */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Scheduled Group Departure Dates ({departureDates.length} dates listed)
              </label>
              <div className="flex flex-wrap gap-2">
                {departureDates.map((date) => (
                  <span
                    key={date}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-800 text-xs font-bold"
                  >
                    <Calendar size={13} className="text-[#009A60]" />
                    <span>{date}</span>
                    <button
                      type="button"
                      onClick={() => removeDepartureDate(date)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <input
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
                <button
                  type="button"
                  onClick={addDepartureDate}
                  className="px-4 py-2 rounded-xl bg-[#009A60] text-white text-xs font-bold"
                >
                  Add Date
                </button>
              </div>
            </div>

            {/* SECTION: Package Media & Imagery */}
            <div className="space-y-6 pt-6 border-t border-gray-100">
              
              {/* Cover Photo Subsection */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Package Cover Photo *
                    </label>
                    <p className="text-xs text-gray-500">
                      Primary high-resolution landscape photo featured on MozBook search cards and catalog headers.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-gray-400">
                    JPG, PNG, WebP • Max 10 MB
                  </span>
                </div>

                {/* Hidden File Picker for Cover */}
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverFileSelected}
                  disabled={isUploadingCover}
                  className="hidden"
                />

                {coverUploadError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{coverUploadError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverUploadError(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {coverImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-950 aspect-[16/9] max-h-80 w-full group shadow-xs">
                    <img
                      src={coverImage}
                      alt="Package Cover"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />

                    {/* Gradient Overlay & Badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none" />

                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#009A60] text-white text-xs font-bold shadow-xs">
                        <Star size={12} className="fill-white" />
                        <span>Active Cover Photo</span>
                      </span>
                      {coverStoragePath && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/60 text-white/90 text-[11px] backdrop-blur-xs">
                          <CheckCircle2 size={11} className="text-emerald-400" />
                          <span>Saved in Cloud Storage</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons in Hover Toolbar */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => coverFileInputRef.current?.click()}
                        disabled={isUploadingCover}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/95 hover:bg-white text-gray-900 text-xs font-bold shadow-md hover:shadow-lg transition-all backdrop-blur-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={13} className={isUploadingCover ? 'animate-spin' : ''} />
                        <span>Replace Cover</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        disabled={isUploadingCover}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>

                    {/* Uploading indicator over existing image */}
                    {isUploadingCover && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 gap-2 z-10">
                        <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        <span className="text-white text-xs font-bold">Uploading Cover Photo... ({coverUploadProgress}%)</span>
                        <div className="w-48 bg-white/20 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#009A60] h-full transition-all duration-300"
                            style={{ width: `${coverUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      if (!isUploadingCover) {
                        coverFileInputRef.current?.click();
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center transition-all ${
                      isUploadingCover
                        ? 'border-[#009A60] bg-emerald-50/40 cursor-wait'
                        : 'border-gray-300 hover:border-[#009A60] hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    {isUploadingCover ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-[#009A60]/30 border-t-[#009A60] rounded-full animate-spin" />
                        <p className="text-xs font-bold text-gray-800">Uploading Cover Photo ({coverUploadProgress}%)</p>
                        <div className="w-48 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#009A60] h-full transition-all duration-300"
                            style={{ width: `${coverUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#009A60]">
                          <UploadCloud size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Click to upload package cover photo
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            JPEG, PNG or WebP files up to 10 MB
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mt-1 px-4 py-2 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          Select Image File
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Collapsible Manual URL Fallback */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManualUrlFallback(!showManualUrlFallback)}
                    className="text-xs text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{showManualUrlFallback ? '− Hide external image URL fallback' : '+ Or paste external image URL'}</span>
                  </button>

                  {showManualUrlFallback && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                      <label className="block text-xs font-semibold text-gray-700">
                        External Image URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={coverImage}
                          onChange={(e) => setCoverImage(e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                        />
                        {coverImage && (
                          <button
                            type="button"
                            onClick={() => setCoverImage('')}
                            className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Package Image Gallery Subsection */}
              <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Package Photos & Gallery
                      </h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                        {galleryItems.length} / {MAX_PACKAGE_GALLERY_IMAGES} Photos
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Showcase safari game drives, luxury lodges, ocean coral reefs, dining, and scenic panoramas.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => galleryFileInputRef.current?.click()}
                      disabled={galleryItems.length >= MAX_PACKAGE_GALLERY_IMAGES}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#009A60] hover:bg-[#008250] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Upload Photos</span>
                    </button>
                  </div>
                </div>

                {/* Hidden Multi-file Input */}
                <input
                  ref={galleryFileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleGalleryFilesSelected}
                  className="hidden"
                />

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => galleryFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#009A60] bg-emerald-50 scale-[1.005]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      Drag & drop multiple package photos here, or click to browse
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Select up to {MAX_PACKAGE_GALLERY_IMAGES - galleryItems.length} more images (JPG, PNG, WebP • Max 10 MB each)
                    </p>
                  </div>
                </div>

                {galleryError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{galleryError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGalleryError(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Gallery Items Grid */}
                {galleryItems.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                    {galleryItems.map((item, index) => {
                      const isItemCover = item.isCover || (coverImage && item.url === coverImage);
                      return (
                        <div
                          key={item.id}
                          className={`relative rounded-xl overflow-hidden border bg-gray-900 group aspect-[4/3] flex flex-col justify-between shadow-2xs transition-all ${
                            isItemCover
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Image Thumbnail */}
                          <img
                            src={item.url}
                            alt={item.fileName || `Photo ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=400&q=80';
                            }}
                          />

                          {/* Gradient Vignette for Readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

                          {/* Top Badges */}
                          <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between gap-1 z-10 pointer-events-none">
                            {isItemCover ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#009A60] text-white text-[10px] font-bold shadow-xs">
                                <Star size={10} className="fill-white" />
                                <span>Cover</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-white/80 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-xs">
                                #{index + 1}
                              </span>
                            )}

                            {item.status === 'success' && (
                              <span className="text-[10px] text-emerald-300 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                                <Check size={10} />
                              </span>
                            )}
                          </div>

                          {/* Status Overlays */}
                          {item.status === 'uploading' && (
                            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-2 gap-1.5 z-20">
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span className="text-white text-[11px] font-bold">{item.progress || 0}%</span>
                              <div className="w-3/4 bg-white/20 rounded-full h-1 overflow-hidden">
                                <div
                                  className="bg-[#009A60] h-full transition-all"
                                  style={{ width: `${item.progress || 0}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {item.status === 'error' && (
                            <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center p-2 text-center gap-1 z-20">
                              <AlertCircle size={18} className="text-red-400" />
                              <span className="text-white text-[10px] line-clamp-2 px-1">
                                {item.error || 'Upload failed'}
                              </span>
                              {item.file && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetryUpload(item);
                                  }}
                                  className="mt-1 px-2.5 py-1 rounded bg-white text-gray-900 text-[10px] font-bold hover:bg-gray-100 cursor-pointer"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          )}

                          {/* Bottom Control Bar */}
                          {item.status === 'success' && (
                            <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between gap-1 z-10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title="Move Left"
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveGalleryItem(index, 'left');
                                  }}
                                  className="p-1 rounded bg-black/70 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                                <button
                                  type="button"
                                  title="Move Right"
                                  disabled={index === galleryItems.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveGalleryItem(index, 'right');
                                  }}
                                  className="p-1 rounded bg-black/70 hover:bg-black text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <ChevronRight size={12} />
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                {!isItemCover && (
                                  <button
                                    type="button"
                                    title="Set as Cover Photo"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSetCoverPhoto(item);
                                    }}
                                    className="px-1.5 py-1 rounded bg-black/70 hover:bg-[#009A60] text-white text-[10px] font-semibold cursor-pointer flex items-center gap-0.5"
                                  >
                                    <Star size={10} />
                                    <span>Cover</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Remove image"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveGalleryItem(index);
                                  }}
                                  className="p-1 rounded bg-black/70 hover:bg-red-600 text-white cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">
                      No gallery photos added yet. Upload up to 15 high-quality tour photos above to build guest trust and showcase your itinerary.
                    </p>
                  </div>
                )}

                {/* Add external photo URL to gallery */}
                <div className="pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Add an external photo URL to gallery (https://...)"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleManualAddUrl}
                      disabled={!newImageUrl.trim() || galleryItems.length >= MAX_PACKAGE_GALLERY_IMAGES}
                      className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Add URL
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              to="/partner/dmc/dashboard"
              className="text-xs font-bold text-gray-500 hover:text-gray-900"
            >
              Cancel & Discard Changes
            </Link>

            {(() => {
              const isAnyUploadActive = isUploadingCover || galleryItems.some(i => i.status === 'uploading');
              return (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={saving || isAnyUploadActive}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                  >
                    <Save size={14} />
                    <span>Save as Draft</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={saving || isAnyUploadActive}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#009A60] hover:bg-[#008250] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                  >
                    {isAnyUploadActive ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Uploading Photos...</span>
                      </span>
                    ) : saving ? (
                      <span>Publishing Package...</span>
                    ) : (
                      <>
                        <span>Publish Package</span>
                        <CheckCircle2 size={16} />
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>

        </div>

      </div>
    </div>
  );
}
