import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Palmtree, 
  Home as HomeIcon, 
  Tent, 
  Compass, 
  Plus, 
  Sparkles,
  MapPin,
  Building,
  Trees,
  LayoutGrid,
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  Users
} from 'lucide-react';
import ListingCard from '../components/ListingCard';
import { getListings, Listing, subscribeToListings } from '../services/listingService';
import { useSearch } from '../context/SearchContext';
import { permissionService } from '../services/permissionService';
import PermissionPromptModal from '../components/PermissionPromptModal';
import { Navigation, AlertCircle, RefreshCw } from 'lucide-react';

// Approximate coordinates for regional centers when listing coords are absent
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'maputo': { lat: -25.9692, lng: 32.5732 },
  'tofo': { lat: -23.8567, lng: 35.5458 },
  'inhambane': { lat: -23.8650, lng: 35.3833 },
  'ponta do ouro': { lat: -26.8436, lng: 32.8872 },
  'vilankulo': { lat: -22.0167, lng: 35.3167 },
  'gorongosa': { lat: -18.7622, lng: 34.3644 },
  'namaacha': { lat: -25.9754, lng: 32.0298 },
  'bilene': { lat: -25.2652, lng: 33.2458 },
  'pemba': { lat: -12.9732, lng: 40.5178 },
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const CATEGORIES = [
  { id: 'all', label: 'All Stays', icon: Compass },
  { id: 'beachfront residence', label: 'Beachfront', icon: Palmtree },
  { id: 'city residence', label: 'City Residence', icon: Building },
  { id: 'normal residence', label: 'Normal Residence', icon: HomeIcon },
  { id: 'studio apartment', label: 'Studio Apartment', icon: LayoutGrid },
  { id: 'country residence', label: 'Country Residence', icon: Trees },
  { id: 'lodge', label: 'Safari & Eco Lodges', icon: Building2 },
  { id: 'apartment home residence', label: 'Apartment Homes', icon: HomeIcon },
  { id: 'outdoor residence', label: 'Outdoor Glamping', icon: Tent },
];

const MOCK_LISTINGS: Listing[] = [
  {
    id: 'mock-1',
    title: 'Modern Cliffside Oceanfront Villa & Infinity Pool',
    location: 'Praia do Tofo, Inhambane',
    city: 'Tofo',
    province: 'Inhambane',
    residenceType: 'beachfront residence',
    price: 2000,
    minNights: 2,
    maxGuests: 8,
    bedrooms: 3,
    beds: 4,
    bathrooms: 3,
    rating: 4.96,
    images: ['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Available next week',
    hostId: 'mock-host-1',
    isHostVerified: true,
    description: 'Breathtaking ocean views over Tofo bay with private infinity pool, outdoor braai, and direct access to pristine beaches.',
    coordinates: { lat: -23.8567, lng: 35.5458 },
    specialOffer: {
      enabled: true,
      offerType: 'percentage',
      originalPrice: 2000,
      specialPrice: 1600,
      discountPercent: 20,
      offerName: 'Summer Special',
      startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
      isSeasonal: true,
      seasonalTag: 'Summer'
    },
    nearbyPlaces: [
      { name: 'Tofo Ocean Snorkel & Whale Shark Safari', category: 'activity', distance: '3 min walk' },
      { name: 'Dino’s Beach Bar & Prawns', category: 'restaurant', distance: '5 min walk' },
    ]
  },
  {
    id: 'mock-2',
    title: 'Executive City Residence with Panoramic Bay Views',
    location: 'Polana Cimento, Maputo',
    city: 'Maputo',
    province: 'Maputo Cidade',
    residenceType: 'city residence',
    price: 210,
    minNights: 1,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    rating: 4.92,
    images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Available all season',
    hostId: 'mock-host-2',
    isHostVerified: true,
    description: 'High-end urban residence in prime Maputo diplomacy quarter. Fast fiber Wi-Fi, generator backup, and private balcony.',
    coordinates: { lat: -25.9692, lng: 32.5732 },
    nearbyPlaces: [
      { name: 'Dhow Maputo Waterfront & Lounge', category: 'restaurant', distance: '5 min walk' },
      { name: 'Mercado Central de Maputo', category: 'shopping', distance: '12 min walk' },
    ]
  },
  {
    id: 'mock-3',
    title: 'Peaceful Family Normal Residence with Lush Garden',
    location: 'Sommerschield II, Maputo',
    city: 'Maputo',
    province: 'Maputo Cidade',
    residenceType: 'normal residence',
    price: 180,
    minNights: 2,
    maxGuests: 6,
    bedrooms: 3,
    beds: 3,
    bathrooms: 2,
    rating: 4.89,
    images: ['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Flexible dates available',
    hostId: 'mock-host-3',
    isHostVerified: true,
    description: 'Standalone comfortable 3-bedroom family residence with private swimming pool, electric fence security, and parking.',
    coordinates: { lat: -25.9525, lng: 32.5931 },
    nearbyPlaces: [
      { name: 'Jardim dos Professores', category: 'nature', distance: '6 min walk' },
      { name: 'Zambi Waterfront Seafood', category: 'restaurant', distance: '8 min drive' },
    ]
  },
  {
    id: 'mock-4',
    title: 'Chic Designer Studio Apartment in Downtown',
    location: 'Baixa de Maputo, Maputo',
    city: 'Maputo',
    province: 'Maputo Cidade',
    residenceType: 'studio apartment',
    price: 95,
    minNights: 1,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    rating: 4.95,
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Instant book available',
    hostId: 'mock-host-4',
    isHostVerified: true,
    description: 'Modern open-plan studio flat with fully equipped kitchenette, air conditioning, smart TV, and dedicated workspace.',
    coordinates: { lat: -25.9715, lng: 32.5744 },
    nearbyPlaces: [
      { name: 'Casa de Ferro (Iron House)', category: 'culture', distance: '4 min walk' },
      { name: 'Maputo Railway Station & Gallery', category: 'culture', distance: '6 min walk' },
    ]
  },
  {
    id: 'mock-5',
    title: 'Tranquil Country Residence Estate & Citrus Groves',
    location: 'Namaacha, Maputo Province',
    city: 'Namaacha',
    province: 'Maputo Província',
    residenceType: 'country residence',
    price: 160,
    minNights: 2,
    maxGuests: 8,
    bedrooms: 4,
    beds: 5,
    bathrooms: 3,
    rating: 4.94,
    images: ['https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Nov 1 – Mar 30',
    hostId: 'mock-host-5',
    isHostVerified: false,
    description: 'Spacious rural homestead surrounded by fresh mountain breezes, fruit orchards, and hiking trails in the Lebombo range.',
    coordinates: { lat: -25.9754, lng: 32.0298 },
    nearbyPlaces: [
      { name: 'Namaacha Cascades & Waterfalls', category: 'nature', distance: '10 min drive' },
      { name: 'Santuário de Nossa Senhora de Fátima', category: 'culture', distance: '5 min drive' },
    ]
  },
  {
    id: 'mock-6',
    title: 'Wild Safari Chalet & Bushveld Eco-Lodge',
    location: 'Gorongosa National Park, Sofala',
    city: 'Gorongosa',
    province: 'Sofala',
    residenceType: 'lodge',
    price: 340,
    minNights: 3,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    rating: 4.98,
    images: ['https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1200&q=80'],
    dates: 'Available next month',
    hostId: 'mock-host-6',
    isHostVerified: true,
    description: 'Exclusive eco-lodge nestled near Lake Urema. Guided morning game drives, solar power backup, and authentic safari hospitality.',
    coordinates: { lat: -18.7622, lng: 34.3644 },
    nearbyPlaces: [
      { name: 'Gorongosa Lion & Elephant Safari', category: 'activity', distance: '1 min walk' },
      { name: 'Mount Gorongosa Rainforest Trail', category: 'nature', distance: '25 min drive' },
    ]
  }
];

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const { filters, isSearchActive, clearFilters, openSearchTab, totalGuests } = useSearch();

  // Location / "What's Around You?" State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isNearMeActive, setIsNearMeActive] = useState(false);

  useEffect(() => {
    // Realtime subscription to listings
    const unsubscribe = subscribeToListings((dbListings) => {
      if (dbListings.length > 0) {
        // Merge DB listings with mock listings for rich diversity
        const merged = [...dbListings];
        for (const mock of MOCK_LISTINGS) {
          if (!merged.some(l => l.id === mock.id)) {
            merged.push(mock);
          }
        }
        setListings(merged);
      } else {
        setListings(MOCK_LISTINGS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAroundYouClick = () => {
    setLocationError(null);
    if (isNearMeActive) {
      setIsNearMeActive(false);
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
      setUserCoords(res.coords);
      setIsNearMeActive(true);
    } else {
      setIsNearMeActive(false);
      setLocationError(res.error || 'Location access was denied. You can manually browse or select any region below.');
    }
  };

  const filteredListings = listings.filter((l) => {
    // Category match
    if (selectedCategory !== 'all') {
      const match = (
        l.residenceType === selectedCategory ||
        l.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
      if (!match) return false;
    }

    // Destination match
    if (filters.destination.trim()) {
      const q = filters.destination.trim().toLowerCase();
      const matchesDest = (
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.province && l.province.toLowerCase().includes(q)) ||
        (l.location && l.location.toLowerCase().includes(q)) ||
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
      if (!matchesDest) return false;
    }

    // Guest capacity match
    if (totalGuests > 0) {
      if (l.maxGuests !== undefined && l.maxGuests < totalGuests) {
        return false;
      }
    }

    return true;
  });

  // When "What's Around You" is active, sort listings by proximity
  const displayedListings = useMemo(() => {
    if (!isNearMeActive || !userCoords) {
      return filteredListings;
    }

    return [...filteredListings].sort((a, b) => {
      const aCoords = a.coordinates || (a.city ? CITY_COORDS[a.city.toLowerCase()] : undefined);
      const bCoords = b.coordinates || (b.city ? CITY_COORDS[b.city.toLowerCase()] : undefined);

      const aDist = aCoords ? getDistanceKm(userCoords.lat, userCoords.lng, aCoords.lat, aCoords.lng) : 99999;
      const bDist = bCoords ? getDistanceKm(userCoords.lat, userCoords.lng, bCoords.lat, bCoords.lng) : 99999;

      return aDist - bDist;
    });
  }, [filteredListings, isNearMeActive, userCoords]);

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 pb-32 md:pb-36">
      {/* Category Pills Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-gray-100">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center gap-2 pb-2 px-1 min-w-fit cursor-pointer border-b-2 transition-all ${
                  isSelected
                    ? 'border-gray-900 text-gray-900 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Icon size={22} className={isSelected ? 'text-gray-900' : 'text-gray-500'} />
                <span className="text-xs tracking-tight whitespace-nowrap">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Mozbook your home */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/host/create"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-[#e6f7f0] text-[#009A60] hover:bg-[#d4f2e4] border border-[#a4e4c7] rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
          >
            <Plus size={14} />
            <span>MozBook your home</span>
          </Link>
        </div>
      </div>

      {/* Location Access Denied or Error Notification (Non-blocking) */}
      {locationError && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Location access was denied or unavailable
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                MozBook continues functioning normally. You can manually browse all stays below or search for specific destinations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={executeLocationDetect}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry GPS
            </button>
            <button
              type="button"
              onClick={() => setLocationError(null)}
              className="px-3 py-1.5 text-amber-800 hover:text-amber-950 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Near Me Active Banner */}
      {isNearMeActive && userCoords && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#009A60] text-white rounded-xl">
              <Navigation size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Showing stays closest to your current location
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Sorted by proximity from GPS coordinates ({userCoords.lat}, {userCoords.lng})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNearMeActive(false)}
            className="px-3.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-center"
          >
            Reset to All Regions
          </button>
        </div>
      )}

      {/* Active Search Filter Banner */}
      {isSearchActive && (
        <div className="mb-8 p-4 bg-[#e6f7f0] border border-[#a4e4c7] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#009A60] text-white rounded-xl shadow-xs">
              <Search size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-gray-900">
                  {filters.destination.trim() ? `Stays in "${filters.destination}"` : 'All Stays in Mozambique'}
                </span>
                {totalGuests > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200">
                    <Users size={12} />
                    {totalGuests} guest{totalGuests > 1 ? 's' : ''}
                  </span>
                )}
                {(filters.datePreset || filters.checkIn) && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200">
                    <Calendar size={12} />
                    {filters.datePreset || `${filters.checkIn} to ${filters.checkOut || 'open'}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Showing {filteredListings.length} {filteredListings.length === 1 ? 'residence' : 'residences'} matching your search
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => openSearchTab('where')}
              className="px-3.5 py-1.5 bg-white border border-[#a4e4c7] text-[#009A60] hover:bg-[#d5f3e5] rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Modify search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-900 rounded-xl text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1"
            >
              <X size={14} />
              <span>Clear filters</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-xl mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : displayedListings.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 bg-[#e6f7f0] rounded-full flex items-center justify-center mx-auto text-[#009A60]">
            <Compass size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {isNearMeActive
              ? 'No stays found close to your location'
              : isSearchActive
              ? 'No residences match your search'
              : 'No residences found in this category'}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {isNearMeActive
              ? 'We couldn\'t detect stays immediately within your vicinity. Try browsing all Mozambique regions below.'
              : isSearchActive
              ? `We couldn't find any stays matching "${filters.destination || 'your filters'}". Try clearing your search or browsing all regions.`
              : 'Be the first host to list a stay in this category on MozBook!'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {isNearMeActive && (
              <button
                type="button"
                onClick={() => setIsNearMeActive(false)}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 shadow-sm transition-colors cursor-pointer"
              >
                Show All Regions
              </button>
            )}
            {isSearchActive && !isNearMeActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 shadow-sm transition-colors cursor-pointer"
              >
                Clear search filters
              </button>
            )}
            <Link
              to="/host/create"
              className="inline-block px-5 py-2.5 bg-[#009A60] text-white text-sm font-semibold rounded-xl hover:bg-[#008250] shadow-sm transition-colors"
            >
              MozBook your home
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {displayedListings.map((listing) => (
            <ListingCard 
              key={listing.id} 
              id={listing.id!}
              title={listing.title}
              location={listing.location}
              price={listing.price}
              rating={listing.rating}
              image={listing.images?.[0] || (listing as any).image}
              dates={
                listing.availableFrom && listing.availableTo 
                  ? `${listing.availableFrom} – ${listing.availableTo}`
                  : (listing.dates || 'Flexible dates')
              }
              residenceType={listing.residenceType}
              specialOffer={listing.specialOffer}
            />
          ))}
        </div>
      )}

      {/* Location Permission Prompt Modal */}
      {showLocationPrompt && (
        <PermissionPromptModal
          isOpen={showLocationPrompt}
          type="location"
          title="Allow MozBook to Access Location?"
          rationale="Allow location access so MozBook can show what's around you and help you find nearby stays, activities and places."
          detail="MozBook uses your device GPS only when you ask to find what's around you. We never track your location continuously in the background."
          onClose={() => setShowLocationPrompt(false)}
          onGranted={(data) => {
            setShowLocationPrompt(false);
            if (data?.coords) {
              setUserCoords(data.coords);
              setIsNearMeActive(true);
            } else {
              executeLocationDetect();
            }
          }}
          onDenied={(err) => {
            setShowLocationPrompt(false);
            setLocationError(err || 'Location access was denied. You can manually browse or select any region below.');
          }}
        />
      )}
    </main>
  );
}
