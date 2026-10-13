import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Compass, 
  MapPin, 
  Calendar, 
  Users, 
  Clock, 
  ShieldCheck, 
  Star, 
  Car, 
  CheckCircle2, 
  CreditCard,
  X, 
  ArrowRight,
  Anchor,
  Palmtree,
  Sparkles,
  Ticket,
  Globe,
  Tag,
  PlusCircle,
  HelpCircle,
  AlertTriangle,
  Navigation,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  ActivityTrip, 
  ActivityBooking 
} from '../types/activityTrip';
import { 
  getActivitiesTrips, 
  createActivityBooking,
  getRemainingCapacity
} from '../services/activityTripService';
import CheckoutSummaryModal from '../components/CheckoutSummaryModal';
import { permissionService } from '../services/permissionService';
import PermissionPromptModal from '../components/PermissionPromptModal';
import { useAuth } from '../context/AuthContext';
import { travelGroupService } from '../services/travelGroupService';

export default function MozBookTrips() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const linkedGroupId = searchParams.get('groupId') || searchParams.get('travelGroupId') || null;
  const [activities, setActivities] = useState<ActivityTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<'all' | 'activity' | 'trip' | 'transport'>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isNearMeActive, setIsNearMeActive] = useState(false);

  // Booking Form State
  const [bookingActivity, setBookingActivity] = useState<ActivityTrip | null>(null);
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState<string>('09:00');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [includePickup, setIncludePickup] = useState<boolean>(false);
  const [pickupNotes, setPickupNotes] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [confirmedBooking, setConfirmedBooking] = useState<ActivityBooking | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState<{ maxCapacity: number; bookedCount: number; remainingCapacity: number }>({
    maxCapacity: 12,
    bookedCount: 0,
    remainingCapacity: 12
  });

  // Load published items from service
  const loadPublishedActivities = async () => {
    setIsLoading(true);
    try {
      const items = await getActivitiesTrips({ status: 'published' });
      setActivities(items);
    } catch (e) {
      console.error('Failed to load published activities:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPublishedActivities();
  }, []);

  // Check remaining capacity when booking modal opens or date changes
  useEffect(() => {
    if (bookingActivity) {
      getRemainingCapacity(bookingActivity.id, bookingDate, bookingTime).then(res => {
        setCapacityInfo(res);
      });
    }
  }, [bookingActivity, bookingDate, bookingTime]);

  const cities = ['all', 'Ponta do Ouro', 'Vilankulo', 'Tofo', 'Gorongosa', 'Maputo', 'Inhambane'];

  const handleAroundYouClick = () => {
    setLocationError(null);
    if (isNearMeActive) {
      setIsNearMeActive(false);
      setSelectedCity('all');
      return;
    }

    const isGranted = permissionService.isGranted('location');
    const hasSolicited = permissionService.hasBeenSolicited('location');

    if (isGranted) {
      executeLocationDetect();
    } else if (!hasSolicited) {
      setShowLocationPrompt(true);
    } else {
      executeLocationDetect();
    }
  };

  const executeLocationDetect = async () => {
    setIsLocating(true);
    setLocationError(null);
    const res = await permissionService.requestLocation();
    setIsLocating(false);
    if (res.success && res.coords) {
      const destCoords: Record<string, { lat: number; lng: number }> = {
        'Maputo': { lat: -25.9692, lng: 32.5732 },
        'Ponta do Ouro': { lat: -26.8436, lng: 32.8872 },
        'Tofo': { lat: -23.8567, lng: 35.5458 },
        'Inhambane': { lat: -23.8650, lng: 35.3833 },
        'Vilankulo': { lat: -22.0167, lng: 35.3167 },
        'Gorongosa': { lat: -18.7622, lng: 34.3644 },
      };

      let closestCity = 'all';
      let minDistance = Infinity;

      for (const [cityName, coord] of Object.entries(destCoords)) {
        const d = Math.hypot(res.coords.lat - coord.lat, res.coords.lng - coord.lng);
        if (d < minDistance) {
          minDistance = d;
          closestCity = cityName;
        }
      }

      setSelectedCity(closestCity);
      setIsNearMeActive(true);
    } else {
      setIsNearMeActive(false);
      setLocationError(res.error || 'Location access was denied. You can manually select any destination.');
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (selectedType !== 'all') {
      if (act.type !== selectedType) return false;
    } else {
      if (act.type !== 'activity' && act.type !== 'trip' && act.type !== 'transport') {
        return false;
      }
    }
    if (selectedCity !== 'all' && act.city.toLowerCase() !== selectedCity.toLowerCase()) {
      return false;
    }
    if (selectedCategory !== 'all') {
      const actCat = (act.category || '').toLowerCase();
      const sel = selectedCategory.toLowerCase();
      if (!actCat.includes(sel) && !sel.includes(actCat)) {
        return false;
      }
    }
    return true;
  });

  const handleOpenBooking = (act: ActivityTrip) => {
    setBookingActivity(act);
    setAdults(2);
    setChildren(0);
    setBookingTime(act.startTimes?.[0] || '09:00');
    setIncludePickup(act.pickup?.offered || false);
    setPickupNotes('');
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingActivity || !contactName.trim() || !contactPhone.trim()) return;

    const totalGuests = adults + children;
    
    // Safety capacity check
    if (capacityInfo.remainingCapacity > 0 && totalGuests > capacityInfo.remainingCapacity) {
      alert(`Sorry, only ${capacityInfo.remainingCapacity} spaces remain available for this date/time.`);
      return;
    }

    setIsBookingSubmitting(true);
    try {
      // Calculate Price
      let baseTotal = 0;
      const effectiveAdultPrice = (bookingActivity.specialOffer?.enabled && bookingActivity.specialOffer.specialPrice)
        ? bookingActivity.specialOffer.specialPrice
        : bookingActivity.priceAdult;

      const effectiveChildPrice = bookingActivity.priceChild || Math.round(effectiveAdultPrice * 0.6);

      if (bookingActivity.pricingType === 'per_person') {
        baseTotal = (effectiveAdultPrice * adults) + (effectiveChildPrice * children);
      } else if (bookingActivity.pricingType === 'per_group') {
        baseTotal = bookingActivity.priceGroup || effectiveAdultPrice;
      } else {
        baseTotal = bookingActivity.pricePerBooking || effectiveAdultPrice;
      }

      const pickupCost = (includePickup && bookingActivity.pickup?.fee) ? bookingActivity.pickup.fee : 0;
      const finalTotal = baseTotal + pickupCost;

      const newBooking = await createActivityBooking({
        activityId: bookingActivity.id,
        activityTitle: bookingActivity.title,
        activityType: bookingActivity.type,
        city: bookingActivity.city,
        hostId: bookingActivity.hostId,
        customerName: contactName.trim(),
        customerEmail: contactEmail.trim() || 'guest@mozbook.mz',
        customerPhone: contactPhone.trim(),
        date: bookingDate,
        time: bookingTime,
        adults,
        children,
        totalGuests,
        pricingType: bookingActivity.pricingType,
        totalMzn: Math.round(finalTotal),
        pickupRequested: includePickup && Boolean(bookingActivity.pickup?.offered),
        pickupNotes: pickupNotes.trim(),
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        travelGroupId: linkedGroupId || undefined
      });

      // If booked within a Travel Group context, also register the group booking link
      if (linkedGroupId) {
        try {
          await travelGroupService.linkBookingToGroup(
            linkedGroupId,
            {
              bookingId: newBooking.id,
              bookingCategory: newBooking.activityType === 'trip' ? 'trip' : 'activity',
              bookingRef: newBooking.bookingRef,
              title: newBooking.activityTitle,
              city: newBooking.city,
              dateOrStartDate: newBooking.date,
              time: newBooking.time,
              totalAmount: newBooking.totalMzn,
              currency: 'MZN',
              status: newBooking.status,
              paymentStatus: newBooking.paymentStatus || 'unpaid',
              fulfillmentStatus: newBooking.fulfillmentStatus || 'unfulfilled'
            },
            {
              uid: user?.uid || 'guest_traveler',
              displayName: contactName.trim() || user?.displayName,
              email: contactEmail.trim() || user?.email
            }
          );
        } catch (linkErr) {
          console.warn('[MozBookTrips] Could not link booking to travel group:', linkErr);
        }
      }

      setConfirmedBooking(newBooking);
      setBookingActivity(null);
      setShowCheckoutModal(true);
    } catch (err) {
      console.error('Booking failed:', err);
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-36 pt-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Linked Travel Group Indicator */}
        {linkedGroupId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <span className="font-bold text-emerald-900 block">
                  Booking for Private Travel Group
                </span>
                <span className="text-emerald-700">
                  Any excursion or trip reserved will automatically sync to your private group itinerary.
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

        {/* Hero Section with Excursions Motif */}
        <div className="bg-gradient-to-br from-[#009A60] via-[#008250] to-[#005c39] rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-semibold">
              <Compass size={14} />
              <span>MozBook Excursions, Safaris & Ocean Activities</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              MozBook Trips & Activities
            </h1>
            <p className="text-white/85 text-sm md:text-base leading-relaxed">
              Book vetted coastal adventures and wilderness safaris around your stay. Swim with wild dolphins, sail vintage dhows across Bazaruto, dive with whale sharks in Tofo, or track lions in Gorongosa.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link 
                to="/info#mozambique-visa-checker"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/30 transition-all shadow-xs"
              >
                <Globe size={14} />
                <span>Mozambique Visa & eTA Requirements →</span>
              </Link>

              <Link
                to="/host/activities"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#009A60] hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Palmtree size={14} />
                <span>Host Your Activity / Trip on MozBook →</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Confirmed Booking Banner */}
        {confirmedBooking && (
          <div className="bg-[#e6f7f0] border-2 border-[#009A60] rounded-3xl p-6 shadow-md animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#009A60] text-white flex items-center justify-center shrink-0">
                <Ticket size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#008250] block">
                  Reservation Created · Reference: {confirmedBooking.bookingRef}
                </span>
                <h3 className="font-bold text-gray-900 text-base">
                  {confirmedBooking.activityTitle} ({confirmedBooking.city})
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Scheduled for <strong>{confirmedBooking.date}</strong> at <strong>{confirmedBooking.time || '09:00'}</strong> · {confirmedBooking.totalGuests} Guests · Total: <strong>MZN {confirmedBooking.totalMzn.toLocaleString()}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Booking: {(confirmedBooking.status || 'pending').toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                    Payment: {(confirmedBooking.paymentStatus || 'unpaid').toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Fulfillment: {(confirmedBooking.fulfillmentStatus || 'unfulfilled').toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] text-gray-600 font-medium mt-1 block">
                  ✓ Space reserved. Payment integration will settle via PaySuite (M-Pesa, e-Mola, Card) before admission.
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard size={14} />
                <span>Pay with PaySuite</span>
              </button>
              <Link
                to={`/booking/${confirmedBooking.id}/status?ref=${encodeURIComponent(confirmedBooking.bookingRef)}`}
                className="px-3.5 py-2 bg-white text-gray-700 hover:bg-gray-50 text-xs font-bold rounded-xl border border-gray-200 text-center"
              >
                Status & Pass
              </Link>
              <button
                onClick={() => setConfirmedBooking(null)}
                className="px-3 py-2 bg-transparent text-gray-500 hover:text-gray-700 text-xs font-semibold text-center"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Filter Navigation Bar */}
        <div className="bg-white rounded-3xl p-4 md:p-6 border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Explore by Category & Destination</h2>
              <p className="text-xs text-gray-500">Filter curated adventures and experiences hosted by certified guides.</p>
            </div>

            {/* Type Filter (All, Activities, Trips, Transport) */}
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 self-start md:self-auto text-xs font-bold flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Experiences
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('activity')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedType === 'activity' ? 'bg-[#009A60] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Compass size={13} />
                <span>Activities</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('trip')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedType === 'trip' ? 'bg-[#009A60] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Anchor size={13} />
                <span>Trips & Tours</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('transport')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedType === 'transport' ? 'bg-[#009A60] text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Car size={13} />
                <span>Transport & Transfers</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            {/* City Filter & What's Around You */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={handleAroundYouClick}
                disabled={isLocating}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 border ${
                  isNearMeActive
                    ? 'bg-[#009A60] text-white border-[#009A60] shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                }`}
              >
                {isLocating ? (
                  <RefreshCw size={12} className="animate-spin text-[#009A60]" />
                ) : (
                  <Navigation size={12} className={isNearMeActive ? 'text-white' : 'text-[#009A60]'} />
                )}
                <span>
                  {isLocating
                    ? 'Detecting GPS...'
                    : isNearMeActive
                    ? `Near You: ${selectedCity}`
                    : "What's Around You?"}
                </span>
              </button>

              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    setIsNearMeActive(false);
                    setSelectedCity(city);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCity === city && !isNearMeActive
                      ? 'bg-[#009A60] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {city === 'all' ? 'All Mozambique' : city}
                </button>
              ))}
            </div>

            {locationError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span>{locationError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationError(null)}
                  className="text-amber-700 hover:text-amber-950 text-xs font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'snorkel', label: 'Snorkeling & Diving' },
                { id: 'island', label: 'Island Dhow' },
                { id: 'safari', label: '4x4 Safari' },
                { id: 'wildlife', label: 'Wildlife' },
                { id: 'culture', label: 'Culture & Heritage' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Host Call-to-Action Banner */}
        <div className="bg-gradient-to-r from-emerald-500 via-[#009A60] to-teal-700 rounded-3xl p-5 md:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
              Host on MozBook
            </span>
            <h3 className="text-lg font-black">Are you a tour guide, boat skipper, or dive operator?</h3>
            <p className="text-xs text-white/90">
              List your activities and multi-day tours. Access our dedicated Host Activities & Trips management center and receive direct bookings in MZN.
            </p>
          </div>
          <Link
            to="/host/activities"
            className="px-5 py-2.5 bg-white text-[#009A60] hover:bg-emerald-50 text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 text-center"
          >
            Host Activities & Trips →
          </Link>
        </div>

        {/* Activities Grid */}
        {isLoading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
            <div className="w-8 h-8 border-3 border-[#009A60] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-3 font-medium">Discovering coastal adventures...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center mx-auto">
              <Compass size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Experiences Found</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              No published activities match your current city or category filters. Try switching filters or host your own tour!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredActivities.map((activity) => {
              const effectivePrice = (activity.specialOffer?.enabled && activity.specialOffer.specialPrice)
                ? activity.specialOffer.specialPrice
                : activity.priceAdult;

              return (
                <div
                  key={activity.id}
                  id={`activity-card-${activity.id}`}
                  className="bg-white rounded-3xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Image & Badges */}
                    <div className="h-60 relative overflow-hidden bg-gray-100">
                      <img
                        src={activity.coverImage || activity.images?.[0] || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80'}
                        alt={activity.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                          <MapPin size={12} className="text-[#00C49F]" />
                          <span>{activity.city}</span>
                        </span>
                        <span className="bg-white/90 backdrop-blur-md text-gray-900 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                          {activity.type === 'trip' ? 'Trip / Tour' : activity.type === 'transport' ? 'Transport & Transfer' : 'Activity'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        {activity.specialOffer?.enabled && (
                          <span className="bg-amber-500 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
                            {activity.specialOffer.seasonalTag || `${activity.specialOffer.discountPercent}% OFF`}
                          </span>
                        )}
                        <span className="bg-white/95 backdrop-blur-md text-gray-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span>{activity.rating}</span>
                          <span className="text-gray-400">({activity.reviewsCount})</span>
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <div className="flex items-center gap-2 text-xs font-medium text-white/90 mb-1">
                          <Clock size={13} />
                          <span>{activity.duration}</span>
                          {activity.vehicleType && (
                            <>
                              <span>·</span>
                              <Car size={13} />
                              <span className="truncate">{activity.vehicleType}</span>
                            </>
                          )}
                          <span>·</span>
                          <Users size={13} />
                          <span>Max {activity.maxGuests}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] mb-1">
                        {activity.category}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 leading-snug mb-2">
                        {activity.title}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-4">
                        {activity.shortDescription || activity.description}
                      </p>

                      {/* Inclusions Highlights */}
                      {activity.included && activity.included.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          {activity.included.slice(0, 3).map((h, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <CheckCircle2 size={14} className="text-[#009A60] shrink-0 mt-0.5" />
                              <span className="leading-tight">{h}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pickup indicator */}
                      {activity.pickup?.offered && (
                        <div className="bg-[#e6f7f0] border border-[#a4e4c7] rounded-xl px-3 py-2 text-xs text-[#008250] flex items-center gap-2 font-medium mb-2">
                          <Car size={14} />
                          <span>Hotel / Lodge pickup available ({activity.pickup.areas || 'Local area'})</span>
                        </div>
                      )}

                      {/* Weather Dependency Notice (Prompt 28B) */}
                      {activity.isWeatherDependent && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-950 space-y-1 mb-2">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
                            <Compass size={13} className="text-amber-600 shrink-0" />
                            <span>Weather-Dependent Experience</span>
                            {activity.weatherConditions?.decisionCutoffHours && (
                              <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded-md font-normal ml-auto">
                                Final call {activity.weatherConditions.decisionCutoffHours}h before
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-amber-900/90 leading-tight">
                            {activity.weatherConditions?.warningTitle || 'Subject to coastal maritime swell and weather conditions.'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-amber-800 pt-0.5">
                            <span>✓ Free date reschedule</span>
                            <span>·</span>
                            <span>✓ 100% refund guarantee on cancellation</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price & Book Button Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-gray-400 font-semibold block">
                        {activity.pricingType === 'per_person' ? 'Per Person' : activity.pricingType === 'per_group' ? 'Per Group' : (activity.pricingType as string) === 'per_vehicle' ? 'Per Vehicle' : (activity.pricingType as string) === 'per_day' ? 'Per Day' : (activity.pricingType as string) === 'per_trip' ? 'Per Trip / Route' : 'Per Booking'}
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-black text-gray-900">
                          {effectivePrice.toLocaleString()} MZN
                        </span>
                        {activity.specialOffer?.enabled && activity.specialOffer.specialPrice && (
                          <span className="text-xs text-gray-400 line-through">
                            {activity.priceAdult.toLocaleString()} MZN
                          </span>
                        )}
                        <span className="text-xs text-gray-500 font-medium">
                          (~${Math.round(effectivePrice / 65)})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenBooking(activity)}
                      className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Book Now</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* BOOKING MODAL */}
      {bookingActivity && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">
                  Reserve Experience · {bookingActivity.type === 'trip' ? 'Trip / Tour' : 'Activity'}
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {bookingActivity.title}
                </h3>
                <span className="text-xs text-gray-500">
                  Host: {bookingActivity.hostName} · {bookingActivity.city}
                </span>
              </div>
              <button
                onClick={() => setBookingActivity(null)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Capacity Status Notice */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs flex items-center justify-between border border-gray-200">
              <span className="text-gray-600 font-medium">Available spaces for selected date:</span>
              <span className={`font-bold ${
                capacityInfo.remainingCapacity <= 3 ? 'text-amber-600' : 'text-[#009A60]'
              }`}>
                {capacityInfo.remainingCapacity} of {bookingActivity.maxGuests} spots left
              </span>
            </div>

            {/* Weather & Operational Conditions Advisory (Prompt 28B) */}
            {bookingActivity.isWeatherDependent && (
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 mb-4 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Compass size={15} className="text-amber-600" />
                  <span>Weather-Dependent Experience · Operational Policy</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  {bookingActivity.weatherConditions?.warningTitle || 'This experience takes place in an open coastal environment.'}{' '}
                  {bookingActivity.weatherConditions?.description || 'Activities are guided by local maritime safety standards and INAM alerts.'}
                </p>
                {bookingActivity.weatherConditions?.seaConditions && (
                  <p className="text-[11px] text-amber-800">
                    <strong>Sea conditions:</strong> {bookingActivity.weatherConditions.seaConditions}
                  </p>
                )}
                <div className="p-2 bg-white/80 rounded-xl border border-amber-200 text-[10px] space-y-1 text-amber-900">
                  <div className="font-bold">MozBook Traveler Protection Guarantee:</div>
                  <div>• Final operator assessment: <strong>{bookingActivity.weatherConditions?.decisionCutoffHours || 3} hours</strong> prior to start time.</div>
                  <div>• If adverse weather or maritime closure prevents departure, you can <strong>reschedule for free</strong> or receive an <strong>automatic 100% full refund</strong> through PaySuite.</div>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              
              {/* Date & Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Departure Time
                  </label>
                  {bookingActivity.startTimes && bookingActivity.startTimes.length > 0 ? (
                    <select
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    >
                      {bookingActivity.startTimes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900"
                    />
                  )}
                </div>
              </div>

              {/* Guest Counts (if per_person) */}
              {bookingActivity.pricingType === 'per_person' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Adults (12+)
                    </label>
                    <select
                      value={adults}
                      onChange={(e) => setAdults(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                        <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Children (Under 12)
                    </label>
                    <select
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    >
                      {[0, 1, 2, 3, 4, 6].map((n) => (
                        <option key={n} value={n}>{n} Children</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Lead Guest Contact Information */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Lead Guest Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Maria Dos Santos"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      WhatsApp / Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+258 84 123 4567"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="maria@example.com"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Pickup Service */}
              {bookingActivity.pickup?.offered && (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePickup}
                      onChange={(e) => setIncludePickup(e.target.checked)}
                      className="mt-0.5 text-[#009A60] rounded focus:ring-[#009A60]"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        Include Hotel / Stay Pickup {bookingActivity.pickup.fee ? `(+${bookingActivity.pickup.fee.toLocaleString()} MZN)` : '(Complimentary)'}
                      </span>
                      <span className="text-[11px] text-gray-600 block">
                        Coverage: {bookingActivity.pickup.areas || 'Local beachfront lodges'}
                      </span>
                    </div>
                  </label>

                  {includePickup && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="Your hotel/residence name in the area..."
                        value={pickupNotes}
                        onChange={(e) => setPickupNotes(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Meeting Point Details */}
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 border border-gray-200 space-y-1">
                <span className="font-bold text-gray-900 block flex items-center gap-1">
                  <MapPin size={13} className="text-[#009A60]" />
                  Meeting Point:
                </span>
                <p className="text-[11px]">{bookingActivity.meetingPoint}</p>
                {bookingActivity.meetingPointInstructions && (
                  <p className="text-[10px] text-gray-500 italic">{bookingActivity.meetingPointInstructions}</p>
                )}
              </div>

              {/* Price Calculation Summary */}
              {(() => {
                const effPrice = (bookingActivity.specialOffer?.enabled && bookingActivity.specialOffer.specialPrice)
                  ? bookingActivity.specialOffer.specialPrice
                  : bookingActivity.priceAdult;
                const effChild = bookingActivity.priceChild || Math.round(effPrice * 0.6);
                let baseCalc = 0;
                if (bookingActivity.pricingType === 'per_person') {
                  baseCalc = (effPrice * adults) + (effChild * children);
                } else if (bookingActivity.pricingType === 'per_group') {
                  baseCalc = bookingActivity.priceGroup || effPrice;
                } else {
                  baseCalc = bookingActivity.pricePerBooking || effPrice;
                }
                const pickupAdd = (includePickup && bookingActivity.pickup?.fee) ? bookingActivity.pickup.fee : 0;
                const grandTotal = baseCalc + pickupAdd;

                return (
                  <div className="bg-[#e6f7f0] border border-[#a4e4c7] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-700">
                      <span>Experience Rate ({bookingActivity.pricingType === 'per_person' ? `${adults} Adults, ${children} Children` : 'Fixed / Group'})</span>
                      <span className="font-semibold">{baseCalc.toLocaleString()} MZN</span>
                    </div>

                    {includePickup && bookingActivity.pickup?.fee ? (
                      <div className="flex items-center justify-between text-xs text-gray-700">
                        <span>Pickup Transfer Fee</span>
                        <span className="font-semibold">{bookingActivity.pickup.fee.toLocaleString()} MZN</span>
                      </div>
                    ) : null}

                    <div className="border-t border-[#a4e4c7] pt-2 flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900">Total Amount</span>
                      <span className="font-black text-base text-[#008250]">
                        {grandTotal.toLocaleString()} MZN
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBookingActivity(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBookingSubmitting}
                  className="px-6 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>{isBookingSubmitting ? 'Confirming...' : 'Confirm & Reserve Space'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmedBooking && (
        <CheckoutSummaryModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          booking={{
            id: confirmedBooking.id,
            bookingRef: confirmedBooking.bookingRef,
            title: confirmedBooking.activityTitle,
            category: confirmedBooking.activityType === 'trip' ? 'trip' : 'activity',
            city: confirmedBooking.city,
            location: confirmedBooking.city,
            startDate: confirmedBooking.date,
            endDate: confirmedBooking.date,
            totalGuests: confirmedBooking.totalGuests,
            adults: confirmedBooking.adults,
            children: confirmedBooking.children,
            totalAmount: confirmedBooking.totalMzn,
            currency: 'MZN',
            isWeatherDependent: confirmedBooking.isWeatherDependent || bookingActivity?.isWeatherDependent
          }}
        />
      )}

      {/* Location Permission Rationale Modal */}
      {showLocationPrompt && (
        <PermissionPromptModal
          isOpen={showLocationPrompt}
          type="location"
          title="Allow MozBook to Access Location?"
          rationale="Allow location access so MozBook can show what's around you and help you find nearby stays, activities and places."
          detail="MozBook uses your device GPS to detect your nearest coastal or safari hub (e.g. Tofo, Vilankulo, Maputo, Ponta do Ouro) and highlight experiences in your area."
          onClose={() => setShowLocationPrompt(false)}
          onGranted={() => {
            setShowLocationPrompt(false);
            executeLocationDetect();
          }}
          onDenied={(err) => {
            setShowLocationPrompt(false);
            setLocationError(err || 'Location access was denied. You can manually select any destination.');
          }}
        />
      )}
    </div>
  );
}
