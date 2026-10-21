import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import { 
  Palmtree, 
  Compass, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Camera, 
  MapPin, 
  Clock, 
  Calendar, 
  Users, 
  DollarSign, 
  Tag, 
  Car, 
  Anchor, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Video,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CameraCaptureModal from '../components/CameraCaptureModal';
import { 
  ActivityTrip, 
  ActivityTripType, 
  ActivityTripStatus,
  PricingType,
  ScheduleType,
  ACTIVITY_CATEGORIES, 
  TRIP_CATEGORIES, 
  MOZAMBIQUE_DESTINATIONS,
  DURATION_OPTIONS_ACTIVITY,
  DURATION_OPTIONS_TRIP,
  DAYS_OF_WEEK,
  COMMON_INCLUSIONS,
  COMMON_WHAT_TO_BRING
} from '../types/activityTrip';
import { 
  createActivityTrip, 
  updateActivityTrip, 
  getActivityTripById 
} from '../services/activityTripService';

// Preset sample photos for Mozambique experiences
const PRESET_PHOTOS = [
  { label: 'Dolphin Swim Ponta', url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Bazaruto Dhow Sail', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Whale Shark Tofo', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Gorongosa Safari 4x4', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Maputo Architecture', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Turquoise Coral Reef', url: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Tropical Beachfront', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Dhow Sandbar Picnic', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80' }
];

export default function CreateActivityTrip() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Partner Flow Detection (Stages 3F & 3G - Controlled Integration)
  const isPartnerFlow = Boolean(
    location.state?.partnerCategory === 'activities' ||
    location.state?.partnerCategory === 'trips_tours' ||
    location.state?.partnerFlow ||
    searchParams.get('partner') === 'true'
  );
  const partnerCategory = location.state?.partnerCategory;

  const isEditing = Boolean(id);
  const initialTypeFromQuery = (searchParams.get('type') as ActivityTripType) || 
    (partnerCategory === 'trips_tours' ? 'trip' : (partnerCategory === 'activities' ? 'activity' : 'activity'));

  // Active Wizard Step (1: Basics & Category, 2: Destination & Pickup, 3: Duration & Schedule, 4: Capacity & Pricing, 5: Inclusions & Details, 6: Media & Publish)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 6;

  // Form State
  const [type, setType] = useState<ActivityTripType>(initialTypeFromQuery);
  const [category, setCategory] = useState<string>(
    initialTypeFromQuery === 'activity' ? 'Snorkeling' : 'Island Excursions'
  );
  const [customCategory, setCustomCategory] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [shortDescription, setShortDescription] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Destination & Location
  const [city, setCity] = useState<string>('Tofo');
  const [customCity, setCustomCity] = useState<string>('');
  const [meetingPoint, setMeetingPoint] = useState<string>('');
  const [meetingPointInstructions, setMeetingPointInstructions] = useState<string>('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  // Pickup
  const [pickupOffered, setPickupOffered] = useState<boolean>(false);
  const [pickupAreas, setPickupAreas] = useState<string>('');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [pickupInstructions, setPickupInstructions] = useState<string>('');
  const [pickupFee, setPickupFee] = useState<number>(0);

  // Duration
  const [duration, setDuration] = useState<string>('3 hours');
  const [customDuration, setCustomDuration] = useState<string>('');
  const [isMultiDay, setIsMultiDay] = useState<boolean>(false);
  const [multiDays, setMultiDays] = useState<number>(2);
  const [multiNights, setMultiNights] = useState<number>(1);
  const [vehicleType, setVehicleType] = useState<string>('');

  // Schedule & Availability
  const [scheduleType, setScheduleType] = useState<ScheduleType>('recurring');
  const [recurringDays, setRecurringDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]);
  const [startTimes, setStartTimes] = useState<string[]>(['09:00', '14:00']);
  const [newTimeInput, setNewTimeInput] = useState<string>('11:00');
  const [specificDateInput, setSpecificDateInput] = useState<string>('');
  const [specificDates, setSpecificDates] = useState<string[]>([]);

  // Capacity
  const [maxGuests, setMaxGuests] = useState<number>(12);
  const [minGuests, setMinGuests] = useState<number>(2);

  // Pricing
  const [pricingType, setPricingType] = useState<PricingType>('per_person');
  const [priceAdult, setPriceAdult] = useState<number>(4500);
  const [priceChild, setPriceChild] = useState<number>(2500);
  const [priceGroup, setPriceGroup] = useState<number>(24000);
  const [groupMaxGuests, setGroupMaxGuests] = useState<number>(8);
  const [pricePerBooking, setPricePerBooking] = useState<number>(18000);

  // Special Offers & Seasonal Pricing
  const [specialOfferEnabled, setSpecialOfferEnabled] = useState<boolean>(false);
  const [specialOfferName, setSpecialOfferName] = useState<string>('Summer Coastal Special');
  const [specialDiscountPercent, setSpecialDiscountPercent] = useState<number>(15);
  const [specialPrice, setSpecialPrice] = useState<number>(3825);
  const [specialTag, setSpecialTag] = useState<string>('Early Bird Special');
  const [specialStartDate, setSpecialStartDate] = useState<string>('');
  const [specialEndDate, setSpecialEndDate] = useState<string>('');

  // Inclusions & Exclusions
  const [included, setIncluded] = useState<string[]>([
    'Professional licensed guide',
    'Snorkeling gear (mask, snorkel, fins)',
    'Bottled mineral water'
  ]);
  const [newIncludedInput, setNewIncludedInput] = useState<string>('');
  const [notIncluded, setNotIncluded] = useState<string[]>([
    'Gratuities for crew',
    'Alcoholic beverages'
  ]);
  const [newNotIncludedInput, setNewNotIncludedInput] = useState<string>('');
  const [whatToBring, setWhatToBring] = useState<string[]>([
    'Swimwear & beach towel',
    'Reef-safe sunscreen & sunglasses',
    'Camera / waterproof pouch'
  ]);
  const [newWhatToBringInput, setNewWhatToBringInput] = useState<string>('');
  const [requirements, setRequirements] = useState<string[]>([
    'Comfortable swimming in open water',
    'Minimum age 6 years'
  ]);
  const [newReqInput, setNewReqInput] = useState<string>('');

  // Weather-Dependent Activity Controls (Prompt 28B)
  const [isWeatherDependent, setIsWeatherDependent] = useState<boolean>(false);
  const [weatherWarningTitle, setWeatherWarningTitle] = useState<string>('');
  const [weatherDescription, setWeatherDescription] = useState<string>('');
  const [seaConditions, setSeaConditions] = useState<string>('');
  const [cycloneOrWindLimit, setCycloneOrWindLimit] = useState<string>('');
  const [rainPolicy, setRainPolicy] = useState<'runs_in_light_rain' | 'cancelled_on_rain' | 'operator_assessment'>('operator_assessment');
  const [decisionCutoffHours, setDecisionCutoffHours] = useState<number>(3);
  const [reschedulingOption, setReschedulingOption] = useState<boolean>(true);
  const [fullRefundOnCancellation, setFullRefundOnCancellation] = useState<boolean>(true);

  // Media
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
  ]);
  const [coverImage, setCoverImage] = useState<string>(
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80'
  );
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videos, setVideos] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status
  const [status, setStatus] = useState<ActivityTripStatus>('published');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Load existing if editing
  useEffect(() => {
    if (id) {
      getActivityTripById(id).then(item => {
        if (item) {
          setType(item.type);
          setCategory(item.category);
          setCustomCategory(item.customCategory || '');
          setTitle(item.title);
          setShortDescription(item.shortDescription || '');
          setDescription(item.description || '');
          setCity(item.city);
          setMeetingPoint(item.meetingPoint || '');
          setMeetingPointInstructions(item.meetingPointInstructions || '');
          if (item.coordinates) {
            setLat(item.coordinates.lat?.toString() || '');
            setLng(item.coordinates.lng?.toString() || '');
          }
          if (item.pickup) {
            setPickupOffered(item.pickup.offered || false);
            setPickupAreas(item.pickup.areas || '');
            setPickupLocation(item.pickup.location || '');
            setPickupInstructions(item.pickup.instructions || '');
            setPickupFee(item.pickup.fee || 0);
          }
          setDuration(item.duration);
          if (item.multiDayDetails) {
            setIsMultiDay(true);
            setMultiDays(item.multiDayDetails.days || 2);
            setMultiNights(item.multiDayDetails.nights || 1);
          }
          setVehicleType(item.vehicleType || '');
          setScheduleType(item.scheduleType || 'recurring');
          setRecurringDays(item.recurringDays || DAYS_OF_WEEK);
          setStartTimes(item.startTimes || ['09:00']);
          setSpecificDates(item.specificDates || []);
          setMaxGuests(item.maxGuests || 12);
          setMinGuests(item.minGuests || 1);
          setPricingType(item.pricingType || 'per_person');
          setPriceAdult(item.priceAdult || 3000);
          setPriceChild(item.priceChild || 1500);
          setPriceGroup(item.priceGroup || 15000);
          setGroupMaxGuests(item.groupMaxGuests || 8);
          setPricePerBooking(item.pricePerBooking || 10000);
          if (item.specialOffer) {
            setSpecialOfferEnabled(item.specialOffer.enabled || false);
            setSpecialOfferName(item.specialOffer.offerName || '');
            setSpecialDiscountPercent(item.specialOffer.discountPercent || 0);
            setSpecialPrice(item.specialOffer.specialPrice || 0);
            setSpecialTag(item.specialOffer.seasonalTag || '');
            setSpecialStartDate(item.specialOffer.startDate || '');
            setSpecialEndDate(item.specialOffer.endDate || '');
          }
          setIncluded(item.included || []);
          setNotIncluded(item.notIncluded || []);
          setWhatToBring(item.whatToBring || []);
          setRequirements(item.requirements || []);
          setIsWeatherDependent(item.isWeatherDependent || false);
          if (item.weatherConditions) {
            setWeatherWarningTitle(item.weatherConditions.warningTitle || '');
            setWeatherDescription(item.weatherConditions.description || '');
            setSeaConditions(item.weatherConditions.seaConditions || '');
            setCycloneOrWindLimit(item.weatherConditions.cycloneOrWindLimit || '');
            setRainPolicy(item.weatherConditions.rainPolicy || 'operator_assessment');
            setDecisionCutoffHours(item.weatherConditions.decisionCutoffHours || 3);
            setReschedulingOption(item.weatherConditions.reschedulingOption ?? true);
            setFullRefundOnCancellation(item.weatherConditions.fullRefundOnCancellation ?? true);
          }
          setImages(item.images || []);
          setCoverImage(item.coverImage || item.images?.[0] || '');
          setVideos(item.videos || []);
          setStatus(item.status || 'published');
        }
      });
    }
  }, [id]);

  // Sync category presets when type toggles
  const handleTypeChange = (newType: ActivityTripType) => {
    setType(newType);
    if (newType === 'activity') {
      if (!ACTIVITY_CATEGORIES.includes(category)) {
        setCategory(ACTIVITY_CATEGORIES[0]);
      }
    } else {
      if (!TRIP_CATEGORIES.includes(category)) {
        setCategory(TRIP_CATEGORIES[0]);
      }
    }
  };

  // Add Item Helpers
  const addIncluded = () => {
    if (newIncludedInput.trim() && !included.includes(newIncludedInput.trim())) {
      setIncluded([...included, newIncludedInput.trim()]);
      setNewIncludedInput('');
    }
  };

  const addNotIncluded = () => {
    if (newNotIncludedInput.trim() && !notIncluded.includes(newNotIncludedInput.trim())) {
      setNotIncluded([...notIncluded, newNotIncludedInput.trim()]);
      setNewNotIncludedInput('');
    }
  };

  const addWhatToBring = () => {
    if (newWhatToBringInput.trim() && !whatToBring.includes(newWhatToBringInput.trim())) {
      setWhatToBring([...whatToBring, newWhatToBringInput.trim()]);
      setNewWhatToBringInput('');
    }
  };

  const addRequirement = () => {
    if (newReqInput.trim() && !requirements.includes(newReqInput.trim())) {
      setRequirements([...requirements, newReqInput.trim()]);
      setNewReqInput('');
    }
  };

  const addStartTime = () => {
    if (newTimeInput.trim() && !startTimes.includes(newTimeInput.trim())) {
      setStartTimes([...startTimes, newTimeInput.trim()]);
    }
  };

  const addSpecificDate = () => {
    if (specificDateInput && !specificDates.includes(specificDateInput)) {
      setSpecificDates([...specificDates, specificDateInput]);
      setSpecificDateInput('');
    }
  };

  const handleDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const url = event.target.result as string;
          setImages(prev => [...prev, url]);
          if (!coverImage) setCoverImage(url);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = (url: string) => {
    setImages(prev => [...prev, url]);
    if (!coverImage) setCoverImage(url);
    setShowCameraModal(false);
  };

  const addImageUrl = () => {
    if (newImageUrl.trim()) {
      setImages(prev => [...prev, newImageUrl.trim()]);
      if (!coverImage) setCoverImage(newImageUrl.trim());
      setNewImageUrl('');
    }
  };

  const addVideoUrl = () => {
    if (videoUrl.trim() && !videos.includes(videoUrl.trim())) {
      setVideos([...videos, videoUrl.trim()]);
      setVideoUrl('');
    }
  };

  // Submit Handler
  const handleSubmit = async (targetStatus: ActivityTripStatus) => {
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg('Please enter an experience title.');
      setCurrentStep(1);
      return;
    }
    if (!meetingPoint.trim()) {
      setErrorMsg('Please specify a meeting point so travelers know where to meet you.');
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCity = city === 'Other' && customCity.trim() ? customCity.trim() : city;
      const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;
      const finalDuration = duration === 'Custom' && customDuration.trim() ? customDuration.trim() : duration;
      const primaryPhoto = coverImage || images[0] || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80';

      const payload = {
        hostId: user?.uid || 'host_operator',
        hostName: user?.displayName || 'MozBook Certified Host',
        hostEmail: user?.email || '',
        hostPhone: '+258 84 000 0000',
        type,
        title: title.trim(),
        shortDescription: shortDescription.trim() || title.trim(),
        description: description.trim() || shortDescription.trim() || title.trim(),
        category: finalCategory,
        customCategory: category === 'Other' ? customCategory.trim() : undefined,
        city: finalCity,
        meetingPoint: meetingPoint.trim(),
        meetingPointInstructions: meetingPointInstructions.trim(),
        coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
        pickup: {
          offered: pickupOffered,
          areas: pickupAreas.trim(),
          location: pickupLocation.trim(),
          instructions: pickupInstructions.trim(),
          fee: pickupFee || 0
        },
        duration: finalDuration,
        multiDayDetails: isMultiDay ? { days: multiDays, nights: multiNights } : undefined,
        scheduleType,
        recurringDays,
        startTimes,
        specificDates,
        maxGuests: maxGuests || 12,
        minGuests: minGuests || 1,
        pricingType,
        priceAdult: priceAdult || 3000,
        priceChild: priceChild || 0,
        priceGroup: priceGroup || 0,
        groupMaxGuests: groupMaxGuests || 8,
        pricePerBooking: pricePerBooking || 0,
        currency: 'MZN',
        specialOffer: specialOfferEnabled ? {
          enabled: true,
          offerName: specialOfferName,
          discountPercent: specialDiscountPercent,
          specialPrice: specialPrice || Math.round(priceAdult * (1 - specialDiscountPercent / 100)),
          startDate: specialStartDate,
          endDate: specialEndDate,
          seasonalTag: specialTag
        } : {
          enabled: false,
          offerName: ''
        },
        images: images.length > 0 ? images : [primaryPhoto],
        coverImage: primaryPhoto,
        videos,
        vehicleType: vehicleType.trim(),
        included,
        notIncluded,
        whatToBring,
        requirements,
        isWeatherDependent,
        weatherConditions: isWeatherDependent ? {
          warningTitle: weatherWarningTitle.trim() || 'Weather-Dependent Operational Advisory',
          description: weatherDescription.trim(),
          seaConditions: seaConditions.trim(),
          cycloneOrWindLimit: cycloneOrWindLimit.trim(),
          rainPolicy,
          decisionCutoffHours: Number(decisionCutoffHours) || 3,
          reschedulingOption,
          fullRefundOnCancellation
        } : undefined,
        status: targetStatus,
        rating: 4.95,
        reviewsCount: 12
      };

      if (isEditing && id) {
        await updateActivityTrip(id, payload);
      } else {
        await createActivityTrip(payload);
      }

      const targetTab = type === 'trip' ? 'trips' : 'activities';
      navigate(`/partner/dashboard?tab=${targetTab}`);
    } catch (err) {
      console.error('Error saving activity/trip:', err);
      setErrorMsg('Failed to save experience. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-36 pt-6 px-4 md:px-8">
      {/* Partner Flow Banner (Stages 3F & 3G) */}
      {isPartnerFlow && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white px-4 sm:px-6 py-2.5 text-xs border-b border-emerald-800/40 shadow-xs -mx-4 md:-mx-8 -mt-6 mb-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-[10px] border border-emerald-400/30">
                Partner Flow
              </span>
              <span className="font-semibold text-slate-200">
                {type === 'trip' || partnerCategory === 'trips_tours'
                  ? 'Branch 3 of Selected Offerings: Trips & Tours Inventory'
                  : 'Branch 2 of Selected Offerings: Activities & Experiences Inventory'}
              </span>
            </div>
            <Link to="/partner" className="text-emerald-400 hover:text-emerald-300 text-xs font-bold hover:underline">
              Return to Partner Categories
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to={isPartnerFlow ? "/partner" : `/partner/dashboard?tab=${type === 'trip' ? 'trips' : 'activities'}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs transition-colors"
          >
            <ArrowLeft size={14} />
            <span>{isPartnerFlow ? "Return to Partner Categories" : "Back to Partner Dashboard"}</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span>Step {currentStep} of {totalSteps}</span>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-[#009A60] h-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: TYPE & BASIC INFO */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                {isPartnerFlow 
                  ? (type === 'trip' || partnerCategory === 'trips_tours'
                      ? 'Partner Onboarding · Trips & Tours Registration'
                      : 'Partner Onboarding · Activities & Experiences Registration')
                  : 'Step 1 · Experience Architecture'}
              </span>
              <h1 className="text-2xl font-black text-gray-900 mt-1">
                {isPartnerFlow 
                  ? (type === 'trip' || partnerCategory === 'trips_tours'
                      ? 'Register Your Trip, Safari, or Tour'
                      : 'Register Your Activity or Experience')
                  : (isEditing ? 'Edit Experience' : 'What type of experience are you offering?')}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {isPartnerFlow
                  ? (type === 'trip' || partnerCategory === 'trips_tours'
                      ? 'Set up your organized excursion, safari tour, island cruise, or multi-day itinerary across Mozambique.'
                      : 'Set up your guided ocean, wildlife, cultural, or outdoor activity for travelers across Mozambique.')
                  : 'Activities and Trips are stored as distinct listing types with specialized schedules and booking flows.'}
              </p>
            </div>

            {/* Type Switcher Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => handleTypeChange('activity')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                  type === 'activity'
                    ? 'border-[#009A60] bg-emerald-50/40 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    type === 'activity' ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <Compass size={24} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    type === 'activity' ? 'border-[#009A60] bg-[#009A60]' : 'border-gray-300'
                  }`}>
                    {type === 'activity' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Activity / Experience</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Single-session adventures like snorkeling, diving, quad biking, surfing, or local culinary workshops.
                  </p>
                </div>
              </div>

              <div
                onClick={() => handleTypeChange('trip')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                  type === 'trip'
                    ? 'border-[#009A60] bg-emerald-50/40 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    type === 'trip' ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <Anchor size={24} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    type === 'trip' ? 'border-[#009A60] bg-[#009A60]' : 'border-gray-300'
                  }`}>
                    {type === 'trip' && <Check size={12} className="text-white" />}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Trip / Tour</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Excursions, dhow sailing, island crossings, game reserve safaris, multi-day tours, and 4x4 overland trips.
                  </p>
                </div>
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800 block">
                Category ({type === 'activity' ? 'Activity Categories' : 'Trip / Tour Categories'})
              </label>
              <div className="flex flex-wrap gap-2">
                {(type === 'activity' ? ACTIVITY_CATEGORIES : TRIP_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      category === cat
                        ? 'bg-[#009A60] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {category === 'Other' && (
                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Title & Descriptions */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800">
                  {type === 'trip' ? 'Trip / Tour Title' : 'Experience Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    type === 'trip'
                      ? "e.g. 3-Day Bazaruto Archipelago Island Safari or Maputo Modernist Heritage Tour"
                      : "e.g. Tofo Ocean Snorkeling Experience or Ponta Dolphin Ocean Swim"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800">
                  Short Tagline / Catchy Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swim with whale sharks guided by licensed marine biologists"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800">
                  Full Detailed Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the entire experience from start to finish. Include scenic stops, wildlife sightings, sailing traditions, and what makes it extraordinary..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none leading-relaxed"
                />
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: DESTINATION, LOCATION & PICKUP */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                Step 2 · Destination & Meeting Point
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                Where does this experience take place?
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Aligns with the existing destination filters on the MozBook Trips & Activities customer page.
              </p>
            </div>

            {/* Destination Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800">Destination / Region</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MOZAMBIQUE_DESTINATIONS.map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    onClick={() => setCity(dest)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                      city === dest
                        ? 'bg-[#009A60] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {dest}
                  </button>
                ))}
              </div>
            </div>

            {/* Meeting Point & Coordinates */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800">
                  Meeting Point <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tofo Beach, near the main diving centre"
                  value={meetingPoint}
                  onChange={(e) => setMeetingPoint(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800">
                  Meeting Point Guidance & Landmark Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Look for the white and green MozBook sail flag next to the dive hut. 4x4 tractor launch area."
                  value={meetingPointInstructions}
                  onChange={(e) => setMeetingPointInstructions(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600">Latitude (GPS Optional)</label>
                  <input
                    type="text"
                    placeholder="-23.8569"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600">Longitude (GPS Optional)</label>
                  <input
                    type="text"
                    placeholder="35.5489"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Pickup Service Section */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Car className="text-[#009A60]" size={18} />
                    <span>Do you offer pickup?</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Pickup is optional and convenient for travelers without 4x4 beach vehicles.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickupOffered(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      !pickupOffered ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickupOffered(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      pickupOffered ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {pickupOffered && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Pickup Coverage Areas</label>
                      <input
                        type="text"
                        placeholder="e.g. All Tofo & Barra beachfront lodges"
                        value={pickupAreas}
                        onChange={(e) => setPickupAreas(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Optional Pickup Fee (MZN per booking)</label>
                      <input
                        type="number"
                        placeholder="0 for free pickup"
                        value={pickupFee || ''}
                        onChange={(e) => setPickupFee(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-800">Pickup Instructions for Guests</label>
                    <input
                      type="text"
                      placeholder="e.g. Please be at your hotel reception 30 minutes before departure time."
                      value={pickupInstructions}
                      onChange={(e) => setPickupInstructions(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: DURATION & SCHEDULE */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                Step 3 · Duration & Availability Schedule
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                How long is it and when do you run?
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Configure departure times, operating days, and trip length.
              </p>
            </div>

            {/* Duration selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800">Duration</label>
              <div className="flex flex-wrap gap-2">
                {(type === 'activity' ? DURATION_OPTIONS_ACTIVITY : DURATION_OPTIONS_TRIP).map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      setDuration(dur);
                      setIsMultiDay(dur.includes('Night') || dur.includes('Days'));
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      duration === dur
                        ? 'bg-[#009A60] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {dur}
                  </button>
                ))}
              </div>

              {type === 'trip' && (
                <div className="pt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={isMultiDay}
                      onChange={(e) => setIsMultiDay(e.target.checked)}
                      className="rounded text-[#009A60] focus:ring-[#009A60]"
                    />
                    <span>This is a multi-day trip/tour</span>
                  </label>
                </div>
              )}

              {isMultiDay && (
                <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 mt-2">
                  <div>
                    <label className="text-xs font-bold text-gray-800 block">Number of Days</label>
                    <input
                      type="number"
                      min={1}
                      value={multiDays}
                      onChange={(e) => setMultiDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-800 block">Number of Nights</label>
                    <input
                      type="number"
                      min={0}
                      value={multiNights}
                      onChange={(e) => setMultiNights(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle / Craft Details */}
            <div className="space-y-1 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800">
                Vehicle or Boat Type (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 8m Super-Duck Rigid Inflatable Boat or Custom 4x4 Safari Cruiser"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Availability Mode */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 block">Availability Schedule</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType('recurring')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    scheduleType === 'recurring' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Recurring Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('specific_dates')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    scheduleType === 'specific_dates' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Specific Dates
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('flexible')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    scheduleType === 'flexible' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Flexible / On Demand
                </button>
              </div>

              {/* Recurring Days */}
              {scheduleType === 'recurring' && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-700 block">Operating Days</span>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = recurringDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setRecurringDays(recurringDays.filter(d => d !== day));
                            } else {
                              setRecurringDays([...recurringDays, day]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#009A60] text-white shadow-2xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Specific Dates Picker */}
              {scheduleType === 'specific_dates' && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-700 block">Add Operating Dates</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={specificDateInput}
                      onChange={(e) => setSpecificDateInput(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={addSpecificDate}
                      className="px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                    >
                      + Add Date
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {specificDates.map((d) => (
                      <span key={d} className="px-2.5 py-1 bg-emerald-50 text-[#009A60] text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
                        {d}
                        <button onClick={() => setSpecificDates(specificDates.filter(x => x !== d))}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Times */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-800 block">Daily Start Times</span>
                <div className="flex flex-wrap items-center gap-2">
                  {startTimes.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border border-gray-200"
                    >
                      <Clock size={12} className="text-[#009A60]" />
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => setStartTimes(startTimes.filter(x => x !== t))}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={newTimeInput}
                      onChange={(e) => setNewTimeInput(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={addStartTime}
                      className="px-3 py-1 bg-[#009A60] text-white rounded-lg text-xs font-bold"
                    >
                      + Add Time
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: CAPACITY & PRICING */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                Step 4 · Capacity & Pricing Structure
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                Guest Limits & Pricing
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                MozBook will strictly prevent overbooking beyond your maximum passenger capacity.
              </p>
            </div>

            {/* Capacity Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                <label className="text-xs font-bold text-gray-800 block flex items-center justify-between">
                  <span>Maximum Guests</span>
                  <span className="text-[10px] text-gray-400">Strict Cap</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-base font-black text-gray-900"
                />
                <span className="text-[11px] text-gray-500 block">
                  e.g. 12 spaces on boat or 8 in safari cruiser
                </span>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                <label className="text-xs font-bold text-gray-800 block flex items-center justify-between">
                  <span>Minimum Guests Required</span>
                  <span className="text-[10px] text-gray-400">Departure Threshold</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxGuests}
                  value={minGuests}
                  onChange={(e) => setMinGuests(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-base font-black text-gray-900"
                />
                <span className="text-[11px] text-gray-500 block">
                  Minimum party size before launch confirmed
                </span>
              </div>
            </div>

            {/* Pricing Model Selector */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 block">Pricing Model</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPricingType('per_person')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    pricingType === 'per_person' ? 'bg-[#009A60] text-white shadow-2xs' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Per Person
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('per_group')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    pricingType === 'per_group' ? 'bg-[#009A60] text-white shadow-2xs' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Per Group
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('per_booking')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    pricingType === 'per_booking' ? 'bg-[#009A60] text-white shadow-2xs' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Per Booking (Private)
                </button>
              </div>

              {/* Per Person inputs */}
              {pricingType === 'per_person' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-200">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-800">
                      Adult Price (MZN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={priceAdult || ''}
                      onChange={(e) => setPriceAdult(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-800">
                      Child Price (MZN, under 12)
                    </label>
                    <input
                      type="number"
                      value={priceChild || ''}
                      onChange={(e) => setPriceChild(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                    />
                  </div>
                </div>
              )}

              {/* Per Group inputs */}
              {pricingType === 'per_group' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-200">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-800">
                      Group Rate (MZN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={priceGroup || ''}
                      onChange={(e) => setPriceGroup(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-800">
                      Max Guests per Group
                    </label>
                    <input
                      type="number"
                      value={groupMaxGuests}
                      onChange={(e) => setGroupMaxGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                    />
                  </div>
                </div>
              )}

              {/* Per Booking inputs */}
              {pricingType === 'per_booking' && (
                <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-200 space-y-1">
                  <label className="text-xs font-bold text-gray-800">
                    Flat Private Booking Price (MZN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={pricePerBooking || ''}
                    onChange={(e) => setPricePerBooking(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                  />
                  <span className="text-[11px] text-gray-500 block">
                    Fixed price for chartering the entire vessel or excursion, up to {maxGuests} guests.
                  </span>
                </div>
              )}
            </div>

            {/* Special Offers & Seasonal Pricing */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Tag className="text-[#009A60]" size={16} />
                    <span>Special Offers & Seasonal Pricing</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Offer early bird discounts, low-season specials, or seasonal promotions.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialOfferEnabled}
                    onChange={(e) => setSpecialOfferEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009A60]"></div>
                </label>
              </div>

              {specialOfferEnabled && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-4 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Special Offer Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Summer Marine Special"
                        value={specialOfferName}
                        onChange={(e) => setSpecialOfferName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Seasonal Badge Tag</label>
                      <input
                        type="text"
                        placeholder="e.g. Whale Season or 15% OFF"
                        value={specialTag}
                        onChange={(e) => setSpecialTag(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Discount Percent (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={specialDiscountPercent}
                        onChange={(e) => {
                          const pct = Number(e.target.value);
                          setSpecialDiscountPercent(pct);
                          setSpecialPrice(Math.round(priceAdult * (1 - pct / 100)));
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Discounted Net Price (MZN)</label>
                      <input
                        type="number"
                        value={specialPrice}
                        onChange={(e) => setSpecialPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-black text-[#009A60]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 5: INCLUSIONS, EXCLUSIONS & SAFETY */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                Step 5 · Inclusions, Exclusions & Requirements
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                What’s included and what should guests bring?
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Clear expectations reduce traveler inquiries and deliver 5-star reviews.
              </p>
            </div>

            {/* What's Included */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-800 block">What’s Included</label>
              <div className="flex flex-wrap gap-1.5">
                {included.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={12} className="text-[#009A60]" />
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setIncluded(included.filter(x => x !== item))}
                      className="text-emerald-700 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Marine Park permits, Seafood lunch..."
                  value={newIncludedInput}
                  onChange={(e) => setNewIncludedInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIncluded())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={addIncluded}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* What's NOT Included */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 block">What’s NOT Included</label>
              <div className="flex flex-wrap gap-1.5">
                {notIncluded.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 flex items-center gap-1.5"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setNotIncluded(notIncluded.filter(x => x !== item))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Gratuities, Alcoholic drinks..."
                  value={newNotIncludedInput}
                  onChange={(e) => setNewNotIncludedInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNotIncluded())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={addNotIncluded}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* What to Bring */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 block">What Guests Should Bring</label>
              <div className="flex flex-wrap gap-1.5">
                {whatToBring.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-amber-50 text-amber-900 rounded-xl text-xs font-semibold border border-amber-200 flex items-center gap-1.5"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setWhatToBring(whatToBring.filter(x => x !== item))}
                      className="text-amber-700 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Beach towel, Sunscreen, Passport..."
                  value={newWhatToBringInput}
                  onChange={(e) => setNewWhatToBringInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addWhatToBring())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={addWhatToBring}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Requirements & Safety */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 block">
                Requirements & Safety Precautions
              </label>
              <div className="flex flex-wrap gap-1.5">
                {requirements.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-blue-50 text-blue-900 rounded-xl text-xs font-semibold border border-blue-200 flex items-center gap-1.5"
                  >
                    <ShieldCheck size={12} className="text-blue-600" />
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setRequirements(requirements.filter(x => x !== item))}
                      className="text-blue-700 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Basic swimming ability required, Min age 6 years..."
                  value={newReqInput}
                  onChange={(e) => setNewReqInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={addRequirement}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Weather-Dependent Activity & Maritime Conditions (Prompt 28B) */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Compass className="text-amber-600" size={16} />
                    <span>Weather-Dependent Experience & Operational Conditions</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Flag marine charters, open-water dhow sailing, surf launches, or outdoor safaris affected by sea swell or storms.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWeatherDependent}
                    onChange={(e) => setIsWeatherDependent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {isWeatherDependent && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4 animate-fade-in text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs pb-1 border-b border-amber-200/60">
                    <AlertCircle size={15} className="text-amber-600" />
                    <span>Operator Weather Protocol (INAM & Maritime Authority Guidelines)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Advisory Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Open Ocean Launch & Swell Conditions Apply"
                        value={weatherWarningTitle}
                        onChange={(e) => setWeatherWarningTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Operator Decision Cut-off</label>
                      <select
                        value={decisionCutoffHours}
                        onChange={(e) => setDecisionCutoffHours(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs"
                      >
                        <option value={1}>1 hour prior to launch</option>
                        <option value={2}>2 hours prior to launch (Recommended)</option>
                        <option value={3}>3 hours prior to launch</option>
                        <option value={6}>6 hours prior to launch</option>
                        <option value={12}>12 hours prior to launch (Night before)</option>
                        <option value={24}>24 hours prior to launch</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-800">Operational Conditions Summary</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Activity requires sea visibility and calm surf launch. Operator assesses conditions continuously."
                      value={weatherDescription}
                      onChange={(e) => setWeatherDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Sea / Swell Requirements</label>
                      <input
                        type="text"
                        placeholder="e.g. Wave swell under 2.5m; safe beach surf break"
                        value={seaConditions}
                        onChange={(e) => setSeaConditions(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-gray-800">Wind / Cyclone Limit</label>
                      <input
                        type="text"
                        placeholder="e.g. Winds < 20 knots; cancelled on INAM storm advisory"
                        value={cycloneOrWindLimit}
                        onChange={(e) => setCycloneOrWindLimit(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-gray-800">Rain Policy</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                        rainPolicy === 'runs_in_light_rain' ? 'border-amber-600 bg-white font-bold' : 'border-gray-200 bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="rainPolicy"
                          value="runs_in_light_rain"
                          checked={rainPolicy === 'runs_in_light_rain'}
                          onChange={() => setRainPolicy('runs_in_light_rain')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Runs in light rain</span>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                        rainPolicy === 'cancelled_on_rain' ? 'border-amber-600 bg-white font-bold' : 'border-gray-200 bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="rainPolicy"
                          value="cancelled_on_rain"
                          checked={rainPolicy === 'cancelled_on_rain'}
                          onChange={() => setRainPolicy('cancelled_on_rain')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Cancelled on rain</span>
                      </label>

                      <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                        rainPolicy === 'operator_assessment' ? 'border-amber-600 bg-white font-bold' : 'border-gray-200 bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="rainPolicy"
                          value="operator_assessment"
                          checked={rainPolicy === 'operator_assessment'}
                          onChange={() => setRainPolicy('operator_assessment')}
                          className="text-amber-600 focus:ring-amber-500"
                        />
                        <span>Skipper's safety call</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-amber-200/60">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reschedulingOption}
                        onChange={(e) => setReschedulingOption(e.target.checked)}
                        className="text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span className="font-semibold text-gray-800">Priority date rescheduling offered without penalty</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fullRefundOnCancellation}
                        onChange={(e) => setFullRefundOnCancellation(e.target.checked)}
                        className="text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span className="font-semibold text-gray-800">100% full refund guarantee if customer cannot reschedule</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 6: MEDIA & PUBLISH */}
        {/* ============================================================== */}
        {currentStep === 6 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                Step 6 · Photos & Publishing
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                Visual Showcase & Launch
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                High-quality photos of your dhow, ocean waters, or wildlife encounters maximize booking conversion.
              </p>
            </div>

            {/* Media Upload Buttons */}
            <div className="flex flex-wrap gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleDeviceUpload}
                multiple
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <Upload size={14} className="text-[#009A60]" />
                <span>Upload from Device</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCameraModal(true)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <Camera size={14} className="text-[#009A60]" />
                <span>Take Live Photo</span>
              </button>
            </div>

            {/* Paste Image URL */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or paste direct image URL (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={addImageUrl}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
              >
                + Add Image
              </button>
            </div>

            {/* Preset Photos for Mozambique */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-800 block">
                Quick Select Mozambique Ocean & Safari Presets:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {PRESET_PHOTOS.map((p) => (
                  <div
                    key={p.url}
                    onClick={() => {
                      if (!images.includes(p.url)) {
                        setImages([...images, p.url]);
                        if (!coverImage) setCoverImage(p.url);
                      }
                    }}
                    title={p.label}
                    className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:scale-105 transition-all group relative"
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold text-center p-1">
                      + Add
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photos Gallery & Cover Image Selector */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-800 block">
                Uploaded Images ({images.length}) · Select Cover Photo
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((imgUrl, idx) => {
                  const isCover = coverImage === imgUrl;
                  return (
                    <div
                      key={idx}
                      className={`relative aspect-video rounded-2xl overflow-hidden border-2 transition-all ${
                        isCover ? 'border-[#009A60] ring-2 ring-emerald-500/20 shadow-md' : 'border-gray-200'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      
                      {isCover && (
                        <span className="absolute top-2 left-2 bg-[#009A60] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          Cover Photo
                        </span>
                      )}

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => setCoverImage(imgUrl)}
                            className="text-[10px] bg-black/70 hover:bg-black text-white px-2 py-1 rounded-lg backdrop-blur-xs font-bold"
                          >
                            Set Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = images.filter((_, i) => i !== idx);
                            setImages(filtered);
                            if (isCover && filtered.length > 0) setCoverImage(filtered[0]);
                          }}
                          className="p-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white ml-auto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Videos link */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Video size={14} className="text-[#009A60]" />
                <span>Video Showcase (YouTube / Vimeo / MP4 link)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={addVideoUrl}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  + Add Video
                </button>
              </div>
            </div>

            {/* Publishing Target */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-[#009A60]" />
                <span>Ready to Launch?</span>
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                When you publish, your experience immediately connects to the customer-facing <strong>MozBook Trips & Activities</strong> page, where visitors can discover and reserve spaces.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit('published')}
                  className="px-6 py-3 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>{isSubmitting ? 'Saving...' : 'Publish Immediately'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit('draft')}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit('pending')}
                  className="px-4 py-3 rounded-xl border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100 text-xs font-bold transition-colors"
                >
                  Submit for Approval
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Step Navigation Footer */}
        <div className="flex items-center justify-between pt-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Previous Step</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !title.trim()) {
                  setErrorMsg('Please enter an experience title before proceeding.');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(prev => prev + 1);
              }}
              className="px-6 py-2.5 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ArrowRight size={14} />
            </button>
          ) : null}
        </div>

      </div>

      {/* Live Camera Capture Modal */}
      {showCameraModal && (
        <CameraCaptureModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={handleCameraCapture}
          title="Take Experience Photo"
          subtitle="Capture your boat, equipment, or coastal location directly"
        />
      )}
    </div>
  );
}
