import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createStayBooking } from '../services/bookingService';
import { Booking } from '../types/booking';
import { auth } from '../firebase';
import CheckoutSummaryModal from '../components/CheckoutSummaryModal';
import { 
  Star, 
  MessageCircle, 
  ChevronLeft, 
  Share, 
  Heart, 
  MapPin, 
  Shield, 
  Calendar as CalendarIcon,
  Navigation,
  Utensils,
  Compass,
  Trees,
  Landmark,
  ShoppingBag,
  Building2,
  Building,
  Palmtree,
  Home as HomeIcon,
  Tent,
  LayoutGrid,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Moon,
  Wifi,
  Waves,
  Wind,
  Tv,
  Globe,
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
  Check,
  Edit3,
  Tag,
  Sparkles,
  Bed,
  Users
} from 'lucide-react';
import { getListingById, Listing, NearbyPlace, isOfferActive, formatOfferDateRange } from '../services/listingService';
import { travelGroupService } from '../services/travelGroupService';
import { useAuth } from '../context/AuthContext';
import { AMENITIES_LIST } from '../data/amenities';
import { LODGE_AMENITIES } from '../data/lodgeAccommodations';

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'normal residence': HomeIcon,
  'city residence': Building,
  'country residence': Trees,
  'studio apartment': LayoutGrid,
  'lodge': Building2,
  'beachfront residence': Palmtree,
  'apartment home residence': HomeIcon,
  'outdoor residence': Tent,
};

const CATEGORY_MAP: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  restaurant: { label: 'Restaurant & Dining', icon: Utensils, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  activity: { label: 'Activity & Adventure', icon: Compass, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  nature: { label: 'Nature & Parks', icon: Trees, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  culture: { label: 'Culture & Sightseeing', icon: Landmark, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  shopping: { label: 'Shopping & Markets', icon: ShoppingBag, color: 'text-pink-600 bg-pink-50 border-pink-200' },
};

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

export default function ListingDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNearbyCategory, setActiveNearbyCategory] = useState<string>('all');
  const [copiedShare, setCopiedShare] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Stay Reservation Configuration State (Unauthenticated users can configure without login)
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      getListingById(id).then(data => {
        setListing(data);
        setLoading(false);

        if (data) {
          // Check if previously saved pending booking config exists in sessionStorage to survive auth
          try {
            const saved = sessionStorage.getItem(`mozbook_pending_stay_config_${id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.checkInDate) setCheckInDate(parsed.checkInDate);
              if (parsed.checkOutDate) setCheckOutDate(parsed.checkOutDate);
              if (parsed.adults) setAdults(Number(parsed.adults));
              if (parsed.children !== undefined) setChildren(Number(parsed.children));
              return;
            }
          } catch {}

          // Default initial dates based on listing availability or next-day window
          const today = new Date();
          const start = new Date(today);
          start.setDate(today.getDate() + 1);
          const defaultIn = (data.availableFrom && data.availableFrom.length >= 10)
            ? data.availableFrom
            : start.toISOString().split('T')[0];

          const nights = Math.max(data.minNights || 1, 3);
          const end = new Date(defaultIn);
          end.setDate(end.getDate() + nights);
          const defaultOut = (data.availableTo && data.availableTo.length >= 10)
            ? data.availableTo
            : end.toISOString().split('T')[0];

          setCheckInDate(defaultIn);
          setCheckOutDate(defaultOut);
        }
      });
    }
  }, [id]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
      <div className="aspect-[21/9] bg-gray-200 rounded-xl mb-8"></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  );
  
  if (!listing) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
      <h2 className="text-2xl font-bold">Listing not found</h2>
      <button onClick={() => navigate('/')} className="px-6 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-lg transition-colors">Go back home</button>
    </div>
  );

  // Prepare images with labels
  const labeledImages = listing.labeledImages && listing.labeledImages.length > 0
    ? listing.labeledImages
    : (listing.images || []).map((url, i) => ({
        url,
        label: i === 0 ? 'Main View' : i === 1 ? 'Lounge' : 'Bedroom'
      }));

  const mainPhoto = labeledImages[0] || {
    url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80',
    label: 'Main View'
  };
  const galleryPhotos = labeledImages.slice(1, 5);

  const residenceType = listing.residenceType || 'beachfront residence';
  const TypeIcon = TYPE_ICONS[residenceType] || HomeIcon;

  const nearbyPlaces: NearbyPlace[] = listing.nearbyPlaces || [];
  const filteredNearby = activeNearbyCategory === 'all' 
    ? nearbyPlaces 
    : nearbyPlaces.filter(p => p.category === activeNearbyCategory);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const amenities = listing.amenities || ['wifi', 'ac', 'pool', 'kitchen'];
  const linkedGroupId = searchParams.get('groupId') || searchParams.get('travelGroupId');

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 pb-32 md:pb-36">
      {/* Linked Travel Group Banner */}
      {linkedGroupId && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <span className="font-bold text-emerald-900 block">
                Booking for Private Travel Group
              </span>
              <span className="text-emerald-700">
                Reserving this stay will automatically attach it to your Travel Companion group workspace and shared itinerary.
              </span>
            </div>
          </div>
          <Link
            to={`/travel-companion/group/${linkedGroupId}`}
            className="text-emerald-800 font-bold hover:underline shrink-0"
          >
            ← Back to Group Workspace
          </Link>
        </div>
      )}

      {/* Back button */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4 transition-colors">
        <ChevronLeft size={18} />
        <span>Back to listings</span>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#e6f7f0] border border-[#a4e4c7] text-[#009A60] text-xs font-bold rounded-full capitalize">
            <TypeIcon size={14} />
            {residenceType}
          </span>
          {listing.city && listing.province && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
              <MapPin size={12} className="text-gray-500" />
              {listing.city}, {listing.province}
            </span>
          )}
          {listing.isHostVerified && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#e6f7f0] text-[#009A60] border border-[#a4e4c7] text-xs font-bold rounded-full">
              <ShieldCheck size={13} className="text-[#009A60]" />
              Verified Host
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{listing.title}</h1>
        
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4 font-semibold text-gray-800">
            <div className="flex items-center gap-1">
              <Star size={16} className="text-amber-500 fill-amber-500" />
              <span>{listing.rating ? listing.rating.toFixed(1) : '4.95'}</span>
            </div>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600 font-normal">Superhost Status</span>
            <span className="text-gray-400">·</span>
            <span className="underline">{listing.location}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/host/edit/${listing.id}`}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
            >
              <Edit3 size={14} />
              <span>Edit Listing & Offers</span>
            </Link>
            <button 
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
            >
              <Share size={15} />
              <span>{copiedShare ? 'Copied Link!' : 'Share'}</span>
            </button>
            <button 
              onClick={() => setIsSaved(!isSaved)}
              className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors ${
                isSaved ? 'text-[#009A60]' : 'text-gray-700'
              }`}
            >
              <Heart size={15} fill={isSaved ? 'currentColor' : 'none'} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Special Offer Callout Banner if Available */}
      {isOfferActive(listing.specialOffer) && listing.specialOffer && (
        <div className="mb-6 p-4.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/20 rounded-xl shadow-xs shrink-0">
              <Sparkles size={22} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base md:text-lg">
                  {listing.specialOffer.offerName || (listing.specialOffer.isSeasonal ? `${listing.specialOffer.customSeasonName || listing.specialOffer.seasonalTag} Special` : 'Special Promotional Offer')}
                </span>
                <span className="px-2.5 py-0.5 bg-amber-400 text-gray-900 rounded-md font-black text-xs uppercase tracking-wide">
                  {listing.specialOffer.discountPercent}% OFF
                </span>
                {listing.specialOffer.isSeasonal && (
                  <span className="px-2 py-0.5 bg-white/20 text-white rounded text-[11px] font-bold">
                    {listing.specialOffer.customSeasonName || listing.specialOffer.seasonalTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                {formatOfferDateRange(listing.specialOffer.startDate, listing.specialOffer.endDate)}
              </p>
            </div>
          </div>

          <div className="sm:text-right shrink-0">
            <div className="flex items-baseline sm:justify-end gap-2">
              <span className="line-through text-emerald-200 text-sm font-medium">
                MZN {listing.price.toLocaleString()}
              </span>
              <span className="text-2xl md:text-3xl font-black text-white">
                MZN {listing.specialOffer.specialPrice.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-100">/ night</span>
            </div>
            <span className="text-[11px] text-amber-200 font-bold block mt-0.5">
              Limited time promotional rate
            </span>
          </div>
        </div>
      )}

      {/* Image Gallery with Labeled Photos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] mb-10 shadow-xs border border-gray-100">
        <div className={`${galleryPhotos.length > 0 ? 'md:col-span-2' : 'col-span-4'} h-full relative group`}>
          <img 
            src={mainPhoto.url} 
            alt={mainPhoto.label || listing.title} 
            className="w-full h-full object-cover hover:brightness-95 transition-all" 
            referrerPolicy="no-referrer" 
          />
          {mainPhoto.label && (
            <span className="absolute bottom-3 left-3 bg-black/75 text-white text-xs font-semibold px-2.5 py-1 rounded-md backdrop-blur-xs">
              {mainPhoto.label}
            </span>
          )}
        </div>

        {galleryPhotos.length > 0 && (
          <div className="hidden md:grid grid-cols-2 grid-rows-2 col-span-2 gap-2 h-full">
            {galleryPhotos.map((photo, i) => (
              <div key={i} className="relative group h-full">
                <img 
                  src={photo.url} 
                  alt={photo.label || `${listing.title} photo ${i + 2}`} 
                  className="w-full h-full object-cover hover:brightness-95 transition-all" 
                  referrerPolicy="no-referrer" 
                />
                {photo.label && (
                  <span className="absolute bottom-2 left-2 bg-black/75 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                    {photo.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Host & Property Info */}
          <div className="flex justify-between items-center pb-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900 capitalize">
                Entire {residenceType} hosted by {listing.hostName || 'Mozbook Host'}
              </h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                <span>4 guests · 2 bedrooms · 2 queen beds · 2 private baths</span>
                {listing.isHostVerified && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck size={14} /> ID Verified Host
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to={`/messages?hostId=${listing.hostId || 'mozbook_host'}&listingId=${listing.id}&title=${encodeURIComponent(listing.title)}&hostName=${encodeURIComponent(listing.hostName || 'MozBook Host')}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 hover:border-[#009A60] rounded-xl text-xs sm:text-sm font-semibold text-gray-800 hover:text-[#009A60] hover:bg-[#e6f7f0] transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Message host directly"
              >
                <MessageCircle size={15} className="text-[#009A60]" />
                <span>Contact Host</span>
              </Link>
              <div className="w-14 h-14 bg-gray-200 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm">
                {listing.hostPhoto ? (
                  <img src={listing.hostPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-[#009A60] text-white flex items-center justify-center font-bold text-lg">
                    {(listing.hostName || 'M').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Highlights & Features */}
          <div className="pb-6 border-b border-gray-200 space-y-5">
            <div className="flex gap-4">
              <div className="p-2.5 bg-[#e6f7f0] text-[#009A60] rounded-xl shrink-0 h-fit">
                <MapPin size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Verified GPS Location</h3>
                <p className="text-gray-500 text-sm mt-0.5">
                  Located in {listing.city || 'Mozambique'}, {listing.province || ''}
                  {listing.coordinates ? ` (Lat: ${listing.coordinates.lat.toFixed(4)}, Lng: ${listing.coordinates.lng.toFixed(4)})` : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 h-fit">
                <CalendarIcon size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Available Booking Window</h3>
                <p className="text-gray-500 text-sm mt-0.5">
                  {listing.availableFrom && listing.availableTo 
                    ? `Open for reservations from ${listing.availableFrom} to ${listing.availableTo}`
                    : (listing.dates || 'Flexible dates available year-round')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 h-fit">
                <Moon size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Minimum Stay Policy</h3>
                <p className="text-gray-500 text-sm mt-0.5">
                  This host requires a minimum of <span className="font-semibold text-gray-900">{listing.minNights || 1} {listing.minNights === 1 ? 'night' : 'nights'}</span> per reservation.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl shrink-0 h-fit">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Mozbook Host & Guest Guarantee</h3>
                <p className="text-gray-500 text-sm mt-0.5">
                  Protected with verified check-in, 24/7 guest support, and safe escrow payouts.
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="pb-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-3">About this residence</h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm md:text-base">
              {listing.description}
            </p>
          </div>

          {/* Lodge Accommodations & Chalets Breakdown (Only if listing has accommodations) */}
          {listing.accommodations && listing.accommodations.length > 0 && (
            <div className="pb-8 border-b border-gray-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#009A60] uppercase tracking-wider">
                      {listing.residenceType === 'lodge' ? 'Lodge Accommodation Types' : 'Accommodation Units & Room Types'}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-bold">
                      {listing.totalLodgeUnits || listing.accommodations.reduce((sum, a) => sum + (Number(a.units) || 0), 0)} Total Units
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">
                    {listing.residenceType === 'lodge' ? 'Available Rooms & Chalets' : 'Available Units & Stays'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {listing.residenceType === 'lodge' 
                      ? 'Choose from standard rooms, private beachfront chalets, or family chalets at this lodge.' 
                      : 'Explore the different rooms, suites, chalets, villas or pitches available at this property.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listing.accommodations.map((acc) => {
                  const effectiveRate = acc.specialOffer && acc.specialOffer.enabled
                    ? acc.specialOffer.specialPrice
                    : acc.price;
                  const hasDeal = effectiveRate < acc.price;

                  return (
                    <div
                      key={acc.id}
                      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-16/9 bg-gray-100 overflow-hidden">
                          {acc.photos && acc.photos.length > 0 ? (
                            <img
                              src={acc.photos[0]}
                              alt={acc.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Bed size={28} />
                            </div>
                          )}

                          <span className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                            {acc.units} {acc.units === 1 ? 'unit available' : 'units available'}
                          </span>

                          {acc.canonicalUnitType && (
                            <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs border border-emerald-200 uppercase">
                              {acc.canonicalUnitType.replace('_', ' ')}
                            </span>
                          )}

                          {hasDeal && (
                            <span className="absolute top-3 right-3 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                              <Tag size={11} />
                              <span>{acc.specialOffer?.offerName || 'Special'}</span>
                              {acc.specialOffer?.discountPercent && <span>({acc.specialOffer.discountPercent}% OFF)</span>}
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-base font-bold text-gray-900">{acc.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Users size={12} className="text-gray-400" />
                                  <span>Up to {acc.maxGuests} guests</span>
                                </span>
                                <span>•</span>
                                <span>{acc.adults} adults{acc.children > 0 ? `, ${acc.children} children` : ''}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {hasDeal ? (
                                <div>
                                  <span className="line-through text-gray-400 text-xs block">
                                    MZN {acc.price.toLocaleString()}
                                  </span>
                                  <span className="text-base font-black text-[#009A60]">
                                    MZN {effectiveRate.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-gray-500"> / night</span>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-base font-black text-gray-900">
                                    MZN {acc.price.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-gray-500"> / night</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {acc.description && (
                            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                              {acc.description}
                            </p>
                          )}

                          {acc.amenities && acc.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {acc.amenities.slice(0, 5).map((aid) => {
                                const def = LODGE_AMENITIES.find(a => a.id === aid);
                                return (
                                  <span
                                    key={aid}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[11px] font-medium"
                                  >
                                    {def ? def.label : aid}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amenities Section */}
          <div className="pb-6 border-b border-gray-200 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">What this residence offers</h3>
              <p className="text-sm text-gray-500">
                Selected amenities and conveniences provided for your comfort.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {amenities.map((amenityId) => {
                const def = AMENITIES_LIST.find(a => a.id === amenityId) || {
                  id: amenityId,
                  label: amenityId.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
                  iconName: 'Check',
                  description: 'Included in residence'
                };
                const Icon = getAmenityIcon(def.iconName);

                return (
                  <div
                    key={amenityId}
                    className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3"
                  >
                    <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-800 shadow-2xs shrink-0">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{def.label}</h4>
                      <p className="text-xs text-gray-500">{def.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What's Nearby Section */}
          <div className="pb-6 border-b border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">What's nearby?</h3>
                <p className="text-sm text-gray-500">
                  Confirmed surrounding restaurants, activities, beaches, and local sights.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full w-fit">
                {nearbyPlaces.length} surrounding spots
              </span>
            </div>

            {/* Filter Pills */}
            {nearbyPlaces.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {['all', 'restaurant', 'activity', 'nature', 'culture', 'shopping'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveNearbyCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors capitalize ${
                      activeNearbyCategory === cat
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Nearby Spots' : cat}
                  </button>
                ))}
              </div>
            )}

            {filteredNearby.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">
                No nearby spots in this category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredNearby.map((place, idx) => {
                  const conf = CATEGORY_MAP[place.category] || CATEGORY_MAP.activity;
                  const Icon = conf.icon;

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg border ${conf.color}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{place.name}</h4>
                            <span className="text-xs text-gray-500 font-medium">
                              {conf.label.split(' & ')[0]}
                            </span>
                          </div>
                        </div>

                        {place.distance && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md shrink-0">
                            <Navigation size={10} />
                            {place.distance}
                          </span>
                        )}
                      </div>

                      {place.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {place.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Location on GPS & Map */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Where you'll be</h3>
              <p className="text-sm text-gray-500">
                {listing.location} · {listing.city ? `${listing.city}, ` : ''}{listing.province || ''}
              </p>
            </div>

            {listing.coordinates && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#009A60] text-white rounded-xl">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Precise GPS Coordinates
                    </span>
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      Latitude: {listing.coordinates.lat.toFixed(5)}, Longitude: {listing.coordinates.lng.toFixed(5)}
                    </p>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${listing.coordinates.lat},${listing.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Booking Card */}
        <div className="relative">
          <div className="sticky top-28 border border-gray-200 rounded-2xl p-6 shadow-xl bg-white space-y-5">
            {(() => {
              const hasDeal = isOfferActive(listing.specialOffer) && !!listing.specialOffer;
              const activeDeal = hasDeal ? listing.specialOffer : null;
              const effectiveNightlyRate = activeDeal && activeDeal.specialPrice > 0 ? activeDeal.specialPrice : listing.price;
              
              const calculatedNights = (() => {
                if (checkInDate && checkOutDate) {
                  const d1 = new Date(checkInDate).getTime();
                  const d2 = new Date(checkOutDate).getTime();
                  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
                  if (diff > 0) return diff;
                }
                return Math.max(listing.minNights || 1, 3);
              })();
              const stayNights = calculatedNights;
              const cleaningFee = 1200;
              const serviceFee = 850;
              const totalAmount = (effectiveNightlyRate * stayNights) + cleaningFee + serviceFee;

              const handleReserveStay = async () => {
                if (isSubmitting) return;
                setBookingError(null);

                // Preserve context in sessionStorage across auth
                try {
                  sessionStorage.setItem(`mozbook_pending_stay_config_${listing.id}`, JSON.stringify({
                    checkInDate,
                    checkOutDate,
                    adults,
                    children
                  }));
                } catch {}

                let currentUser = user;
                if (!currentUser) {
                  try {
                    await login();
                    currentUser = auth.currentUser;
                  } catch (authErr) {
                    console.warn('Authentication cancelled or failed:', authErr);
                    return;
                  }
                }

                if (!currentUser) return;

                setIsSubmitting(true);
                try {
                  const newBooking = await createStayBooking({
                    listingId: listing.id,
                    listingTitle: listing.title,
                    listingCity: listing.city,
                    listingLocation: listing.location,
                    listingImage: listing.images?.[0] || '',
                    hostId: listing.hostId,
                    userId: currentUser.uid,
                    customerName: currentUser.displayName || 'Guest Traveler',
                    customerEmail: currentUser.email || '',
                    customerPhone: currentUser.phoneNumber || '',
                    startDate: checkInDate,
                    endDate: checkOutDate,
                    checkInDate,
                    checkOutDate,
                    nights: stayNights,
                    nightlyRate: effectiveNightlyRate,
                    adults,
                    children,
                    totalGuests: adults + children,
                    cleaningFee,
                    serviceFee,
                    totalAmount,
                    currency: 'MZN',
                    travelGroupId: searchParams.get('groupId') || searchParams.get('travelGroupId') || undefined
                  });

                  const linkedGid = searchParams.get('groupId') || searchParams.get('travelGroupId');
                  if (linkedGid) {
                    try {
                      await travelGroupService.linkBookingToGroup(
                        linkedGid,
                        {
                          bookingId: newBooking.id,
                          bookingCategory: 'stay',
                          bookingRef: newBooking.bookingRef,
                          title: newBooking.listingTitle || listing.title,
                          city: newBooking.listingCity || listing.city,
                          location: newBooking.listingLocation || listing.location,
                          image: newBooking.listingImage || listing.images?.[0],
                          dateOrStartDate: newBooking.checkInDate || newBooking.startDate,
                          endDate: newBooking.checkOutDate || newBooking.endDate,
                          totalAmount: newBooking.totalAmount,
                          currency: 'MZN',
                          status: newBooking.status,
                          paymentStatus: newBooking.paymentStatus,
                          fulfillmentStatus: newBooking.fulfillmentStatus
                        },
                        {
                          uid: currentUser.uid,
                          displayName: currentUser.displayName,
                          email: currentUser.email
                        }
                      );
                    } catch (linkErr) {
                      console.warn('[ListingDetails] Could not link stay to travel group:', linkErr);
                    }
                  }

                  setCreatedBooking(newBooking);
                  setShowCheckoutModal(true);
                  sessionStorage.removeItem(`mozbook_pending_stay_config_${listing.id}`);
                } catch (err: any) {
                  console.error('Failed to create stay booking:', err);
                  setBookingError(err.message || 'Failed to submit stay reservation. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              };

              // If a reservation was just successfully created, display persistent confirmation
              if (createdBooking) {
                return (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-[#e6f7f0] border-2 border-[#009A60] rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#009A60] text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#008250] block">
                            Reservation Requested · {createdBooking.bookingRef}
                          </span>
                          <h4 className="font-bold text-gray-900 text-sm">
                            {createdBooking.listingTitle}
                          </h4>
                        </div>
                      </div>

                      <div className="bg-white/90 rounded-xl p-3 text-xs space-y-1.5 border border-emerald-100">
                        <div className="flex justify-between text-gray-600">
                          <span>Check-in:</span>
                          <span className="font-semibold text-gray-900">{createdBooking.checkInDate}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Checkout:</span>
                          <span className="font-semibold text-gray-900">{createdBooking.checkOutDate} ({createdBooking.nights} {createdBooking.nights === 1 ? 'night' : 'nights'})</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>Guests:</span>
                          <span className="font-semibold text-gray-900">{createdBooking.totalGuests} ({createdBooking.adults} Adults{createdBooking.children > 0 ? `, ${createdBooking.children} Children` : ''})</span>
                        </div>
                        <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-200 font-bold">
                          <span className="text-gray-900">Total Amount:</span>
                          <span className="text-[#008250]">MZN {createdBooking.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Booking: {createdBooking.status.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          Payment: {createdBooking.paymentStatus.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Fulfillment: {createdBooking.fulfillmentStatus.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        ✓ Your reservation is safely stored. Click below to authorize payment via PaySuite (M-Pesa, e-Mola, Card) and confirm your stay.
                      </p>

                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowCheckoutModal(true)}
                          className="w-full py-3 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <CreditCard size={15} />
                          <span>Pay MZN {createdBooking.totalAmount.toLocaleString()} with PaySuite</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <Link
                            to={`/booking/${createdBooking.id}/status?ref=${encodeURIComponent(createdBooking.bookingRef)}`}
                            className="flex-1 py-2 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold"
                          >
                            View Status & Pass
                          </Link>
                          <button
                            type="button"
                            onClick={() => setCreatedBooking(null)}
                            className="flex-1 py-2 bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            New Reservation
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      {activeDeal ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="line-through text-gray-400 text-sm font-semibold">
                              MZN {listing.price.toLocaleString()}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded uppercase">
                              {activeDeal.discountPercent}% OFF
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-3xl font-extrabold text-emerald-700">
                              MZN {activeDeal.specialPrice.toLocaleString()}
                            </span>
                            <span className="text-gray-500 text-sm"> / night</span>
                          </div>
                          <p className="text-[11px] font-semibold text-[#009A60] mt-1 flex items-center gap-1">
                            <Sparkles size={11} />
                            <span>{activeDeal.offerName || 'Special Promotional Rate'}</span>
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-3xl font-extrabold text-gray-900">
                            MZN {listing.price.toLocaleString()}
                          </span>
                          <span className="text-gray-500 text-sm"> / night</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 shrink-0">
                      <Star size={14} className="text-amber-500 fill-amber-500" />
                      <span>{listing.rating ? listing.rating.toFixed(1) : '4.95'}</span>
                    </div>
                  </div>

                  {/* Minimum Stay Notice */}
                  <div className="px-3 py-2 bg-emerald-50/80 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-900 flex items-center gap-1.5">
                      <Moon size={14} className="text-[#009A60]" />
                      Minimum Stay:
                    </span>
                    <span className="font-bold text-emerald-900">
                      {listing.minNights || 1} {(listing.minNights || 1) === 1 ? 'night' : 'nights'}
                    </span>
                  </div>

                  {/* Interactive Dates & Guests Configuration Box */}
                  <div className="border border-gray-300 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-2 border-b border-gray-300">
                      <div className="p-3 border-r border-gray-300 bg-gray-50/50">
                        <label className="font-bold text-gray-500 uppercase text-[10px] block mb-1">Check-in</label>
                        <input
                          type="date"
                          value={checkInDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => {
                            setCheckInDate(e.target.value);
                            if (checkOutDate && e.target.value >= checkOutDate) {
                              const next = new Date(e.target.value);
                              next.setDate(next.getDate() + (listing.minNights || 1));
                              setCheckOutDate(next.toISOString().split('T')[0]);
                            }
                          }}
                          className="w-full bg-transparent font-semibold text-gray-900 focus:outline-none cursor-pointer text-xs"
                        />
                      </div>
                      <div className="p-3 bg-gray-50/50">
                        <label className="font-bold text-gray-500 uppercase text-[10px] block mb-1">Checkout</label>
                        <input
                          type="date"
                          value={checkOutDate}
                          min={checkInDate || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setCheckOutDate(e.target.value)}
                          className="w-full bg-transparent font-semibold text-gray-900 focus:outline-none cursor-pointer text-xs"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50/30 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-500 uppercase text-[10px] block">Guests</span>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">
                          {adults} {adults === 1 ? 'adult' : 'adults'}{children > 0 ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                          <span className="text-[10px] text-gray-500">Adults:</span>
                          <select 
                            value={adults}
                            onChange={(e) => setAdults(Number(e.target.value))}
                            className="text-xs font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                          <span className="text-[10px] text-gray-500">Kids:</span>
                          <select 
                            value={children}
                            onChange={(e) => setChildren(Number(e.target.value))}
                            className="text-xs font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
                          >
                            {[0, 1, 2, 3, 4, 5].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {bookingError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                      {bookingError}
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={handleReserveStay}
                    disabled={isSubmitting}
                    className="w-full bg-[#009A60] hover:bg-[#008250] disabled:bg-gray-400 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-base cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting Reservation...</span>
                      </>
                    ) : (
                      <span>{user ? 'Reserve Now' : 'Sign In to Reserve'}</span>
                    )}
                  </button>

                  <p className="text-center text-xs text-gray-400">You won't be charged yet — Status: Unpaid</p>
                  <Link
                    to={`/messages?hostId=${listing.hostId || 'mozbook_host'}&listingId=${listing.id}&title=${encodeURIComponent(listing.title)}&hostName=${encodeURIComponent(listing.hostName || 'MozBook Host')}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 hover:border-[#009A60] text-xs font-semibold text-gray-700 hover:text-[#009A60] hover:bg-[#e6f7f0] transition-colors"
                  >
                    <MessageCircle size={14} className="text-[#009A60]" />
                    <span>Have questions? Contact Host</span>
                  </Link>


                  <div className="space-y-3 text-sm text-gray-600 pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span>MZN {effectiveNightlyRate.toLocaleString()} x {stayNights} nights</span>
                      <span>MZN {(effectiveNightlyRate * stayNights).toLocaleString()}</span>
                    </div>
                    {activeDeal && (
                      <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                        <span>Promotional savings:</span>
                        <span>-MZN {((listing.price - effectiveNightlyRate) * stayNights).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Cleaning & hospitality fee</span>
                      <span>MZN 1,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MozBook guest service fee</span>
                      <span>MZN 850</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 flex justify-between font-bold text-gray-900 text-base">
                      <span>Total before taxes</span>
                      <span>MZN {totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Travel Visa & Entry Requirements Helper Card */}
            <div className="pt-2">
              <Link
                to="/info#mozambique-visa-checker"
                className="w-full p-3.5 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-bold transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-[#009A60] shrink-0" />
                  <div className="text-left">
                    <span className="block font-extrabold text-emerald-900">Mozambique Visa & Entry Checker</span>
                    <span className="text-[10px] text-emerald-700 font-normal">Check exemptions, eTA, & passport rules</span>
                  </div>
                </div>
                <span className="text-emerald-700 group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {createdBooking && (
        <CheckoutSummaryModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          booking={{
            id: createdBooking.id,
            bookingRef: createdBooking.bookingRef,
            title: createdBooking.listingTitle,
            category: 'stay',
            city: createdBooking.listingCity,
            location: createdBooking.listingLocation,
            image: createdBooking.listingImage,
            startDate: createdBooking.checkInDate,
            endDate: createdBooking.checkOutDate,
            nights: createdBooking.nights,
            totalGuests: createdBooking.totalGuests,
            adults: createdBooking.adults,
            children: createdBooking.children,
            totalAmount: createdBooking.totalAmount,
            currency: createdBooking.currency
          }}
        />
      )}
    </main>
  );
}
