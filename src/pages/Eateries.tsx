import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Utensils, 
  Star, 
  MapPin, 
  Users, 
  MessageSquare, 
  Navigation, 
  Clock, 
  CheckCircle2, 
  X, 
  Radio, 
  Phone, 
  Flame, 
  Search, 
  ExternalLink,
  Loader2,
  Compass,
  AlertCircle
} from 'lucide-react';
import { permissionService } from '../services/permissionService';
import PermissionPromptModal from '../components/PermissionPromptModal';
import { useAuth } from '../context/AuthContext';

export interface GooglePlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: {
    displayName: string;
    uri?: string;
    photoUri?: string;
  }[];
}

export interface GooglePlace {
  id: string;
  google_place_id: string;
  name: string;
  address: string;
  shortAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  rating: number; // Google Rating
  userRatingCount: number; // Google Review Count
  googleMapsUri: string | null;
  websiteUri: string | null;
  phone: string | null;
  primaryType: string;
  types: string[];
  priceLevel: string | null;
  regularOpeningHours: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  } | null;
  photos: GooglePlacePhoto[];
}

export interface MozBookCheckIn {
  id: string;
  user_id: string;
  user_name: string;
  google_place_id: string;
  place_name: string;
  latitude: number;
  longitude: number;
  trip_id?: string;
  checked_in_at: string;
  note?: string;
  spot?: string;
  expires_at: number;
}

export interface MozBookReview {
  id: string;
  user_id: string;
  user_name: string;
  google_place_id: string;
  rating: number;
  review_text: string;
  created_at: string;
}

// Region coordinates across Mozambique
const REGION_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  all: { lat: -25.9692, lng: 32.5732, name: 'All Mozambique' },
  Maputo: { lat: -25.9692, lng: 32.5732, name: 'Maputo' },
  'Ponta do Ouro': { lat: -26.8456, lng: 32.8872, name: 'Ponta do Ouro' },
  Tofo: { lat: -23.8550, lng: 35.5458, name: 'Tofo' },
  Vilankulo: { lat: -22.0000, lng: 35.3167, name: 'Vilankulo' }
};

// Available active MozBook trips for connecting check-ins
const AVAILABLE_TRIPS = [
  { id: 'trip-maputo-coast', name: 'Maputo & Inhaca Coastal Discovery' },
  { id: 'trip-ponta-safari', name: 'Ponta do Ouro Dolphin & Ocean Safari' },
  { id: 'trip-tofo-scuba', name: 'Tofo Beach Scuba & Manta Rays Expedition' },
  { id: 'trip-bazaruto-dhow', name: 'Vilankulo & Bazaruto Archipelago Dhow Voyage' },
];

// Helper: Haversine distance in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Helper: Map Google place types to simple MozBook categories
function mapGoogleTypeToMozbook(primaryType?: string, types?: string[]): string {
  const all = [primaryType, ...(types || [])].filter(Boolean).map(t => t.toLowerCase());
  if (all.some(t => t.includes('seafood'))) return 'Seafood';
  if (all.some(t => t.includes('cafe') || t.includes('coffee'))) return 'Café';
  if (all.some(t => t.includes('bakery'))) return 'Bakery';
  if (all.some(t => t.includes('bar') || t.includes('pub') || t.includes('lounge'))) return 'Bar & Lounge';
  if (all.some(t => t.includes('fast_food') || t.includes('takeaway'))) return 'Fast Food';
  if (all.some(t => t.includes('beach'))) return 'Beach Restaurant';
  if (all.some(t => t.includes('grill') || t.includes('steak') || t.includes('barbecue'))) return 'Grill & Piri-Piri';
  if (all.some(t => t.includes('pizza') || t.includes('italian'))) return 'Pizzeria';
  if (all.some(t => t.includes('restaurant'))) return 'Restaurant';
  return 'Eat & Drink';
}

// Helper: Map Google price levels
function mapPriceLevel(priceLevel?: string | null): string {
  if (priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' || priceLevel === 'PRICE_LEVEL_EXPENSIVE') return '$$$$';
  if (priceLevel === 'PRICE_LEVEL_MODERATE') return '$$$';
  return '$$';
}

// Helper: Format hours display
function formatOpeningHours(hours?: { openNow?: boolean; weekdayDescriptions?: string[] } | null): string {
  if (!hours) return 'Hours not listed';
  if (hours.openNow !== undefined) {
    const status = hours.openNow ? 'Open Now' : 'Closed Now';
    if (hours.weekdayDescriptions && hours.weekdayDescriptions.length > 0) {
      const todayDay = (new Date().getDay() + 6) % 7; // Convert to Mon=0 ... Sun=6
      const desc = hours.weekdayDescriptions[todayDay] || hours.weekdayDescriptions[0];
      const timePart = desc.split(': ')[1] || desc;
      return `${status} (${timePart})`;
    }
    return status;
  }
  return 'Hours available at door';
}

export default function Eateries() {
  const { user, profile } = useAuth();

  // Places state directly sourced from Google Places API
  const [places, setPlaces] = useState<GooglePlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // MozBook social layer: check-ins & reviews
  const [checkIns, setCheckIns] = useState<MozBookCheckIn[]>([]);
  const [reviews, setReviews] = useState<MozBookReview[]>([]);

  // Filtering & search
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'distance' | 'reviews'>('rating');

  // User GPS state
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [showLocationRationale, setShowLocationRationale] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Review Modal state
  const [ratingModalPlace, setRatingModalPlace] = useState<GooglePlace | null>(null);
  const [userStars, setUserStars] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [userName, setUserName] = useState(user?.displayName || profile?.displayName || '');

  // Check-In Modal state
  const [checkInModalPlace, setCheckInModalPlace] = useState<GooglePlace | null>(null);
  const [checkInName, setCheckInName] = useState(user?.displayName || profile?.displayName || '');
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInSpot, setCheckInSpot] = useState('');
  const [checkInTripId, setCheckInTripId] = useState<string>('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [checkInSuccessAlert, setCheckInSuccessAlert] = useState<string | null>(null);

  // Fetch Check-ins and Reviews from MozBook backend
  const fetchSocialData = useCallback(async () => {
    try {
      const [chkRes, revRes] = await Promise.all([
        fetch('/api/check-ins'),
        fetch('/api/reviews')
      ]);
      if (chkRes.ok) {
        const chkData = await chkRes.json();
        setCheckIns(chkData.checkIns || []);
      }
      if (revRes.ok) {
        const revData = await revRes.json();
        setReviews(revData.reviews || []);
      }
    } catch (err) {
      console.warn('Could not fetch MozBook social data:', err);
    }
  }, []);

  useEffect(() => {
    fetchSocialData();
  }, [fetchSocialData]);

  // Load Google Places for a given coordinate / region
  const fetchPlacesByLocation = useCallback(async (lat: number, lng: number, radius = 15000) => {
    setLoadingPlaces(true);
    setPlacesError(null);
    try {
      const res = await fetch('/api/places/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng, radius })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.places)) {
        setPlaces(data.places);
      } else {
        setPlacesError(data.error || 'Failed to load places from Google');
      }
    } catch (err: any) {
      setPlacesError(err.message || 'Error communicating with Google Places API');
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  // Search Google Places with text query
  const searchGooglePlaces = useCallback(async (query: string, region: string) => {
    if (!query.trim()) return;
    setLoadingPlaces(true);
    setPlacesError(null);
    try {
      const coords = userCoords || REGION_COORDINATES[region] || REGION_COORDINATES.all;
      const res = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          latitude: coords?.lat || coords?.latitude,
          longitude: coords?.lng || coords?.longitude,
          region
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.places)) {
        setPlaces(data.places);
      } else {
        setPlacesError(data.error || 'No matching eateries found on Google');
      }
    } catch (err: any) {
      setPlacesError(err.message || 'Error searching Google Places');
    } finally {
      setLoadingPlaces(false);
    }
  }, [userCoords]);

  // Initial load: Fetch Google places for initial region (Maputo / All Mozambique)
  useEffect(() => {
    const coords = REGION_COORDINATES[selectedCity] || REGION_COORDINATES.all;
    fetchPlacesByLocation(coords.lat, coords.lng);
  }, [selectedCity, fetchPlacesByLocation]);

  // Handle Search submit or debounced search
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      searchGooglePlaces(searchQuery, selectedCity);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCity, searchGooglePlaces]);

  // Handle GPS detection using permissionService
  const handleDetectLocation = async () => {
    const isGranted = permissionService.isGranted('location');
    const hasBeenSolicited = permissionService.hasBeenSolicited('location');

    if (!isGranted && !hasBeenSolicited) {
      setShowLocationRationale(true);
      return;
    }

    executeGpsScan();
  };

  const executeGpsScan = () => {
    setDetectingGps(true);
    if (!navigator.geolocation) {
      setDetectingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        permissionService.saveStatus('location', 'granted');
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
        setUserCoords(coords);
        setDetectingGps(false);
        setGpsDetected(true);
        setSortBy('distance');
        // Fetch real Google Places around user's GPS coordinates
        fetchPlacesByLocation(coords.latitude, coords.longitude, 15000);
      },
      () => {
        permissionService.saveStatus('location', 'denied');
        setDetectingGps(false);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  // Submit MozBook Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingModalPlace || !userComment.trim() || !userName.trim()) return;

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.uid || 'user_guest_' + Date.now(),
          user_name: userName.trim(),
          google_place_id: ratingModalPlace.google_place_id,
          rating: userStars,
          review_text: userComment.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.review) {
          setReviews(prev => [data.review, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to submit MozBook review:', err);
    } finally {
      setUserComment('');
      setUserStars(5);
      setRatingModalPlace(null);
    }
  };

  // Submit MozBook Check-In
  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInModalPlace || !checkInName.trim()) return;

    setSubmittingCheckIn(true);
    try {
      const res = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.uid || 'user_traveler_' + Date.now(),
          user_name: checkInName.trim(),
          google_place_id: checkInModalPlace.google_place_id,
          place_name: checkInModalPlace.name,
          latitude: checkInModalPlace.location.latitude,
          longitude: checkInModalPlace.location.longitude,
          trip_id: checkInTripId || undefined,
          spot: checkInSpot.trim() || 'Main Dining Area',
          note: checkInNote.trim() || 'Enjoying food and drinks here!'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkIn) {
          setCheckIns(prev => [data.checkIn, ...prev]);
          setCheckInSuccessAlert(`Checked into ${checkInModalPlace.name}! Fellow MozBook travelers nearby can see your table.`);
          setTimeout(() => setCheckInSuccessAlert(null), 5000);
        }
      }
    } catch (err) {
      console.error('Failed to submit MozBook check-in:', err);
    } finally {
      setSubmittingCheckIn(false);
      setCheckInNote('');
      setCheckInSpot('');
      setCheckInTripId('');
      setCheckInModalPlace(null);
    }
  };

  // Compute distance for each place from user coordinates (or reference center)
  const placesWithMeta = useMemo(() => {
    const reference = userCoords || (REGION_COORDINATES[selectedCity] ? { latitude: REGION_COORDINATES[selectedCity].lat, longitude: REGION_COORDINATES[selectedCity].lng } : null);

    return places.map((place) => {
      const distanceKm = reference
        ? calculateDistanceKm(
            reference.latitude,
            reference.longitude,
            place.location.latitude,
            place.location.longitude
          )
        : undefined;

      const placeCheckIns = checkIns.filter(c => c.google_place_id === place.google_place_id && c.expires_at > Date.now());
      const placeReviews = reviews.filter(r => r.google_place_id === place.google_place_id);
      const mozbookAvgRating = placeReviews.length > 0
        ? Number((placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length).toFixed(1))
        : null;

      return {
        ...place,
        distanceKm,
        mozbookCategory: mapGoogleTypeToMozbook(place.primaryType, place.types),
        priceRange: mapPriceLevel(place.priceLevel),
        openingHoursText: formatOpeningHours(place.regularOpeningHours),
        checkIns: placeCheckIns,
        mozbookReviews: placeReviews,
        mozbookRating: mozbookAvgRating
      };
    });
  }, [places, userCoords, selectedCity, checkIns, reviews]);

  // Sort and filter places
  const sortedPlaces = useMemo(() => {
    return [...placesWithMeta].sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'distance') return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
      if (sortBy === 'reviews') return (b.userRatingCount || 0) - (a.userRatingCount || 0);
      return 0;
    });
  }, [placesWithMeta, sortBy]);

  const cities = ['all', 'Maputo', 'Ponta do Ouro', 'Tofo', 'Vilankulo'];

  return (
    <div className="min-h-screen bg-gray-50/60 pb-36 pt-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Success toast after check-in */}
        {checkInSuccessAlert && (
          <div className="fixed top-20 right-4 z-50 bg-[#009A60] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-300">
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="text-xs font-bold">{checkInSuccessAlert}</span>
            <button onClick={() => setCheckInSuccessAlert(null)} className="ml-2 hover:opacity-75">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header Hero */}
        <div className="bg-gradient-to-br from-[#009A60] via-[#008552] to-[#005c39] rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-xs font-semibold">
              <Utensils size={14} />
              <span>Mozambique Dining, Piri-Piri & Seafood</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">
              Eateries & Social Check-In
            </h1>
            <p className="text-white/85 text-sm md:text-base leading-relaxed">
              Find top-rated local restaurants, beach bars, and seafood taverns around you powered by Google Maps. Check in live so fellow travelers nearby can join your table, and leave authentic MozBook traveler reviews!
            </p>

            {/* GPS Detection Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="px-4 py-2.5 bg-white text-[#009A60] hover:bg-[#e6f7f0] rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Navigation size={15} className={detectingGps ? 'animate-spin' : ''} />
                <span>
                  {detectingGps
                    ? 'Detecting your coordinates...'
                    : gpsDetected
                    ? 'GPS Active: Showing Eateries Around Me'
                    : 'Show Eateries Around Me (GPS)'}
                </span>
              </button>

              {gpsDetected && (
                <span className="text-xs text-white/90 bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-xs flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={14} />
                  <span>Google Places sorted by real GPS proximity</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search input (queries Google Places text search) */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Google Places (e.g. seafood, pizza, piri-piri, bar, bakery, coffee)..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
              />
              {loadingPlaces && (
                <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#009A60] animate-spin" />
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#009A60] cursor-pointer"
              >
                <option value="rating">Google Rating ★</option>
                <option value="distance">Closest to Me (Distance)</option>
                <option value="reviews">Most Reviewed</option>
              </select>
            </div>
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <MapPin size={13} />
              <span>Region:</span>
            </span>
            {cities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setSelectedCity(city);
                  setSearchQuery('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCity === city
                    ? 'bg-[#009A60] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {city === 'all' ? 'All Mozambique' : city}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Indicator */}
        {loadingPlaces && (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center justify-center gap-3 text-xs font-bold text-gray-600">
            <Loader2 size={18} className="animate-spin text-[#009A60]" />
            <span>Finding real establishments around {selectedCity === 'all' ? 'Mozambique' : selectedCity} via Google Places...</span>
          </div>
        )}

        {/* Places Error banner if any */}
        {placesError && !loadingPlaces && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Google Places Notice</p>
              <p className="text-[11px] text-amber-800">{placesError}</p>
            </div>
          </div>
        )}

        {/* Restaurant Cards List */}
        <div className="space-y-6">
          {!loadingPlaces && sortedPlaces.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 space-y-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <Utensils size={30} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">No eateries found matching your search</h3>
              <p className="text-xs text-gray-500">Try searching for "restaurant", "seafood", "bar", or picking another region above.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCity('all');
                  setSearchQuery('');
                  const coords = REGION_COORDINATES.all;
                  fetchPlacesByLocation(coords.lat, coords.lng);
                }}
                className="px-4 py-2 bg-[#009A60] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset Search
              </button>
            </div>
          ) : (
            sortedPlaces.map((eatery) => {
              const hasPhotos = eatery.photos && eatery.photos.length > 0;
              const photoResourceName = hasPhotos
                ? eatery.photos[0].name
                : `places/${eatery.google_place_id}/photos/default`;
              const photoUrl = `/api/places/photo?name=${encodeURIComponent(photoResourceName)}&category=${encodeURIComponent(eatery.mozbookCategory || eatery.primaryType || '')}&placeName=${encodeURIComponent(eatery.name)}`;
              const photoAuthor = hasPhotos && eatery.photos[0].authorAttributions?.[0]?.displayName;

              return (
                <div
                  key={eatery.google_place_id}
                  id={`eatery-card-${eatery.google_place_id}`}
                  className="bg-white rounded-3xl border border-gray-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col md:flex-row"
                >
                  {/* Photo / Visual Column */}
                  <div className="md:w-72 h-48 md:h-auto relative shrink-0 bg-slate-900 flex items-center justify-center overflow-hidden">
                    {photoUrl && !failedImages[eatery.google_place_id] ? (
                      <img
                        src={photoUrl}
                        alt={eatery.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={() => {
                          setFailedImages(prev => ({ ...prev, [eatery.google_place_id]: true }));
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-800 p-6 flex flex-col justify-between text-white">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                          <Utensils size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                            {eatery.mozbookCategory}
                          </span>
                          <span className="text-sm font-bold text-white line-clamp-2">
                            {eatery.name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Google Rating Badge */}
                    <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm">
                      <span className="text-[10px] uppercase font-black text-amber-300">Google</span>
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      <span>{eatery.rating ? eatery.rating.toFixed(1) : 'New'}</span>
                      {eatery.userRatingCount > 0 && (
                        <span className="text-white/70">({eatery.userRatingCount})</span>
                      )}
                    </div>

                    {/* Distance Badge dynamically computed from GPS */}
                    {eatery.distanceKm !== undefined && (
                      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md text-gray-900 px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-xs">
                        <Navigation size={11} className="text-[#009A60]" />
                        <span>{eatery.distanceKm} km away</span>
                      </div>
                    )}

                    {/* Photo attribution when photo is displayed */}
                    {photoAuthor && !failedImages[eatery.google_place_id] && (
                      <div className="absolute bottom-1 right-2 text-[9px] text-white/85 bg-black/75 px-2 py-0.5 rounded backdrop-blur-xs max-w-[180px] truncate shadow-xs">
                        Photo: {photoAuthor}
                      </div>
                    )}
                  </div>

                  {/* Details Column */}
                  <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-gray-900">
                              {eatery.name}
                            </h2>
                            <span className="text-xs font-bold text-gray-400">
                              {eatery.priceRange}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#008250] text-[10px] font-extrabold uppercase border border-emerald-200">
                              {eatery.mozbookCategory}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                            <MapPin size={13} className="text-[#009A60] shrink-0" />
                            <span className="line-clamp-1">{eatery.address}</span>
                          </p>
                        </div>

                        {/* Live Check-In Badge */}
                        {eatery.checkIns.length > 0 && (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-[#a4e4c7] text-[#008250] text-xs font-bold self-start">
                            <span className="w-2 h-2 rounded-full bg-[#009A60] animate-ping" />
                            <span>{eatery.checkIns.length} traveler{eatery.checkIns.length > 1 ? 's' : ''} checked in now</span>
                          </div>
                        )}
                      </div>

                      {/* MozBook Rating & Social Banner if rated by MozBook travelers */}
                      {eatery.mozbookRating !== null && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-xs font-bold mb-3 shadow-xs">
                          <span className="text-emerald-400 font-black">MozBook</span>
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span>{eatery.mozbookRating}</span>
                          <span className="text-slate-400 font-normal">
                            ({eatery.mozbookReviews.length} traveler review{eatery.mozbookReviews.length > 1 ? 's' : ''})
                          </span>
                        </div>
                      )}

                      {/* Google Rating Details Callout */}
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 mb-3 text-amber-950">
                        <div className="flex items-center gap-1.5">
                          <Star size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                          <span className="font-bold">Google Rating:</span>
                          <span>
                            {eatery.rating ? `${eatery.rating.toFixed(1)} / 5` : 'Not yet rated'} ({eatery.userRatingCount || 0} Google reviews)
                          </span>
                        </div>

                        {eatery.googleMapsUri && (
                          <a
                            href={eatery.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#009A60] hover:underline flex items-center gap-1 shrink-0"
                          >
                            <span>Google Maps</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {/* Checked in travelers feed */}
                      {eatery.checkIns.length > 0 && (
                        <div className="mb-4 bg-gray-50 rounded-2xl p-3 border border-gray-200/70 space-y-2">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Live Travelers At This Eatery:
                          </span>
                          {eatery.checkIns.map((chk) => (
                            <div key={chk.id} className="flex items-start gap-2.5 text-xs text-gray-700">
                              <div className="w-6 h-6 rounded-full bg-[#009A60] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                {chk.user_name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <span className="font-bold text-gray-900">{chk.user_name}</span>
                                <span className="text-gray-400 text-[10px] ml-2">
                                  ({chk.spot || 'Main Area'} {chk.trip_id ? `· ${chk.trip_id}` : ''})
                                </span>
                                {chk.note && (
                                  <p className="text-gray-600 italic mt-0.5">"{chk.note}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* MozBook traveler reviews feed */}
                      {eatery.mozbookReviews.length > 0 && (
                        <div className="border-t border-gray-100 pt-3 flex items-start gap-2 text-xs text-gray-600">
                          <MessageSquare size={13} className="text-gray-400 shrink-0 mt-0.5" />
                          <span className="italic">
                            "{eatery.mozbookReviews[0].review_text}" — <strong className="font-semibold text-gray-800 not-italic">{eatery.mozbookReviews[0].user_name}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="mt-5 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          <span>{eatery.openingHoursText}</span>
                        </span>

                        {eatery.phone && (
                          <>
                            <span>·</span>
                            <a
                              href={`tel:${eatery.phone}`}
                              className="flex items-center gap-1 text-[#009A60] hover:underline font-semibold"
                            >
                              <Phone size={13} />
                              <span>{eatery.phone}</span>
                            </a>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* MozBook Rate & Review button */}
                        <button
                          type="button"
                          onClick={() => {
                            setRatingModalPlace(eatery);
                            setUserName(user?.displayName || profile?.displayName || '');
                          }}
                          className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Star size={13} className="text-amber-500 fill-amber-500" />
                          <span>Rate & Review</span>
                        </button>

                        {/* MozBook Check-In button */}
                        <button
                          type="button"
                          onClick={() => {
                            setCheckInModalPlace(eatery);
                            setCheckInName(user?.displayName || profile?.displayName || '');
                          }}
                          className="px-4 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Users size={13} />
                          <span>Check In Here</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Google Places Attribution Footer */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 text-center text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-gray-800">Google Maps Platform Places</span>
            <span>· Real-time food & drink establishments in Mozambique</span>
          </div>
          <span className="text-[11px] text-gray-400">
            Ratings marked with "Google" are Google ratings. MozBook check-ins and traveler reviews are recorded on MozBook.
          </span>
        </div>

      </div>

      {/* RATING MODAL (MozBook Review) */}
      {ratingModalPlace && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  Write a MozBook Review
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {ratingModalPlace.name}
                </h3>
              </div>
              <button
                onClick={() => setRatingModalPlace(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  MozBook Traveler Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserStars(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        size={28}
                        className={
                          star <= userStars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-gray-600 ml-2">
                    {userStars} of 5 stars
                  </span>
                </div>
              </div>

              {/* Your Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Sergio C. or Sarah traveler"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Review & Recommendations
                </label>
                <textarea
                  rows={3}
                  required
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="How was the food, service, atmosphere, or fresh catch of the day?"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRatingModalPlace(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Publish Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL (MozBook Check-In with Trip Connection) */}
      {checkInModalPlace && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block flex items-center gap-1">
                  <Radio size={12} className="animate-pulse" />
                  Live Social Check-In
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  Check into {checkInModalPlace.name}
                </h3>
              </div>
              <button
                onClick={() => setCheckInModalPlace(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              Let other MozBook travelers nearby know you’re here so they can drop by, share travel stories, or clink a cold 2M beer together!
            </p>

            <form onSubmit={handleSubmitCheckIn} className="space-y-4">
              {/* Your Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Your Name / Handle
                </label>
                <input
                  type="text"
                  required
                  value={checkInName}
                  onChange={(e) => setCheckInName(e.target.value)}
                  placeholder="e.g. Alex (South Africa) or Paulo"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              {/* Spot / Table */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Where are you seated? (Optional)
                </label>
                <input
                  type="text"
                  value={checkInSpot}
                  onChange={(e) => setCheckInSpot(e.target.value)}
                  placeholder="e.g. Beach deck, Patio Table 3, By the bar"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              {/* Note / Invite */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Social Note / What are you up to?
                </label>
                <textarea
                  rows={2}
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="e.g. Celebrating our dive day with grilled prawns, come pull up a chair!"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              {/* Trip Connection (Future Trips compatibility) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Compass size={13} className="text-[#009A60]" />
                    <span>Connect to MozBook Trip (Optional)</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">For Trip companions</span>
                </label>
                <select
                  value={checkInTripId}
                  onChange={(e) => setCheckInTripId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#009A60] cursor-pointer"
                >
                  <option value="">No Active Trip / Solo Dining</option>
                  {AVAILABLE_TRIPS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckInModalPlace(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckIn}
                  className="px-5 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submittingCheckIn ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Users size={14} />
                  )}
                  <span>{submittingCheckIn ? 'Checking in...' : 'Check In Here'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Rationale Modal */}
      {showLocationRationale && (
        <PermissionPromptModal
          isOpen={showLocationRationale}
          type="location"
          onClose={() => setShowLocationRationale(false)}
          onGranted={() => {
            setShowLocationRationale(false);
            executeGpsScan();
          }}
          onDenied={() => setShowLocationRationale(false)}
        />
      )}
    </div>
  );
}
