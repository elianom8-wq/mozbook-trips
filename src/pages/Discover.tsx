import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  MapPin,
  Sparkles,
  Award,
  Zap,
  Utensils,
  Compass,
  Map as MapIcon,
  Tag,
  Star,
  ChevronRight,
  SlidersHorizontal,
  X,
  ExternalLink,
  Loader2,
  Calendar,
  Users,
  AlertCircle,
  Building,
  Palmtree,
  Home as HomeIcon,
  Building2,
  Tent,
  LayoutGrid,
  Trees,
  Waves,
  Sun
} from 'lucide-react';
import { motion } from 'motion/react';
import { Listing, subscribeToListings, isOfferActive, getEffectivePrice } from '../services/listingService';
import { ActivityTrip } from '../types/activityTrip';
import { getActivitiesTrips, isActivityOfferActive } from '../services/activityTripService';
import { useSearch } from '../context/SearchContext';
import ListingCard from '../components/ListingCard';
import MozambiqueInteractiveMap from '../components/MozambiqueInteractiveMap';

// ----------------------------------------------------------------------
// Mozambique Provinces (Official 11 first-order divisions)
// Maputo City is represented separately from Maputo Province as standard in Mozambique
// ----------------------------------------------------------------------
export interface ProvinceInfo {
  id: string;
  name: string;
  capital: string;
  region: 'South' | 'Central' | 'North';
  description: string;
  center: { lat: number; lng: number };
  highlights: string[];
}

export const MOZAMBIQUE_PROVINCES: ProvinceInfo[] = [
  {
    id: 'Maputo City',
    name: 'Maputo City',
    capital: 'Maputo',
    region: 'South',
    description: 'Vibrant capital with Baixa colonial heritage, Polana arts, seafood avenues and Catembe bay.',
    center: { lat: -25.9692, lng: 32.5732 },
    highlights: ['Costa do Sol', 'Polana Cimento', 'Feira de Artesanato', 'Maputo Waterfront']
  },
  {
    id: 'Maputo Province',
    name: 'Maputo Province',
    capital: 'Matola',
    region: 'South',
    description: 'Southern coast to Ponta do Ouro marine reserve and the Namaacha mountain waterfalls.',
    center: { lat: -25.6, lng: 32.3 },
    highlights: ['Ponta do Ouro', 'Ponta Malongane', 'Namaacha Falls', 'Maputo Special Reserve']
  },
  {
    id: 'Gaza',
    name: 'Gaza',
    capital: 'Xai-Xai',
    region: 'South',
    description: 'Warm coral reefs, Chidenguele freshwater lakes and the great Limpopo National Park.',
    center: { lat: -23.5, lng: 32.8 },
    highlights: ['Praia do Bilene', 'Praia do Xai-Xai', 'Chidenguele Lakes', 'Limpopo Safari']
  },
  {
    id: 'Inhambane',
    name: 'Inhambane',
    capital: 'Inhambane',
    region: 'South',
    description: 'The land of good people: world-class scuba diving with manta rays, whale sharks, and Bazaruto sandbars.',
    center: { lat: -23.0, lng: 34.5 },
    highlights: ['Praia do Tofo', 'Praia da Barra', 'Vilankulo', 'Bazaruto Archipelago']
  },
  {
    id: 'Sofala',
    name: 'Sofala',
    capital: 'Beira',
    region: 'Central',
    description: 'Historic port city of Beira and the world-renowned wilderness of Gorongosa National Park.',
    center: { lat: -19.0, lng: 34.8 },
    highlights: ['Gorongosa National Park', 'Beira Coastal Front', 'Chitengo Safari Camp', 'Lake Urema']
  },
  {
    id: 'Manica',
    name: 'Manica',
    capital: 'Chimoio',
    region: 'Central',
    description: 'Highland forests, Mount Binga peaks, Cabeça do Velho granite domes and rich agricultural estates.',
    center: { lat: -19.1, lng: 33.4 },
    highlights: ['Chimoio', 'Mount Binga', 'Chicamba Dam', 'Chimanimani Transfrontier Park']
  },
  {
    id: 'Tete',
    name: 'Tete',
    capital: 'Tete',
    region: 'Central',
    description: 'Mighty Zambezi River corridor, historic suspension bridge, and the vast Cahora Bassa reservoir.',
    center: { lat: -15.8, lng: 33.3 },
    highlights: ['Cahora Bassa Dam', 'Zambezi River Waterfront', 'Songo Plateau', 'Boroma Historic Church']
  },
  {
    id: 'Zambézia',
    name: 'Zambézia',
    capital: 'Quelimane',
    region: 'Central',
    description: 'Endless coconut palm groves, tea plantations of Gurué and the tranquil beaches of Zalala.',
    center: { lat: -16.8, lng: 36.8 },
    highlights: ['Praia de Zalala', 'Gurué Tea Plantations', 'Mount Namúli', 'Quelimane Port']
  },
  {
    id: 'Nampula',
    name: 'Nampula',
    capital: 'Nampula',
    region: 'North',
    description: 'UNESCO World Heritage Ilha de Moçambique, ancient dhow shipwrights and dramatic granite inselbergs.',
    center: { lat: -15.1, lng: 39.2 },
    highlights: ['Ilha de Moçambique', 'Chocas Mar', 'Nacala Bay Deep Water', 'Ribaue Inselbergs']
  },
  {
    id: 'Niassa',
    name: 'Niassa',
    capital: 'Lichinga',
    region: 'North',
    description: 'Untamed African wilderness in the Niassa Special Reserve and crystal-clear waters of Lake Niassa (Malawi).',
    center: { lat: -13.0, lng: 36.0 },
    highlights: ['Lake Niassa (Meponda & Metangula)', 'Niassa Special Reserve', 'Lichinga Highlands']
  },
  {
    id: 'Cabo Delgado',
    name: 'Cabo Delgado',
    capital: 'Pemba',
    region: 'North',
    description: 'The world’s third-largest natural bay at Pemba and the pristine coral atolls of the Quirimbas Archipelago.',
    center: { lat: -12.5, lng: 39.5 },
    highlights: ['Wimbe Beach (Pemba)', 'Quirimbas Coral Atolls', 'Ibo Island Silversmiths', 'Murrébuè Surf']
  }
];

// Verified Mozambican Top Destinations
const TOP_DESTINATIONS = [
  {
    id: 'tofo',
    name: 'Praia do Tofo & Barra',
    province: 'Inhambane',
    city: 'Tofo',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80',
    tag: 'Marine Megafauna',
    description: 'World-renowned for resident whale sharks, oceanic manta rays, surf breaks and fresh seafood shack beach bars.'
  },
  {
    id: 'bazaruto',
    name: 'Vilankulo & Bazaruto Archipelago',
    province: 'Inhambane',
    city: 'Vilankulo',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
    tag: 'National Marine Park',
    description: 'Turquoise tidal sandbars, dugong sanctuaries, and traditional wooden dhow cruises between coral islands.'
  },
  {
    id: 'ponta',
    name: 'Ponta do Ouro & Malongane',
    province: 'Maputo Province',
    city: 'Ponta do Ouro',
    image: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1000&q=80',
    tag: 'Dolphin Reserve',
    description: 'Ethical wild dolphin encounters, scenic beach launch boats, coastal dune forests and relaxed seaside vibe.'
  },
  {
    id: 'gorongosa',
    name: 'Gorongosa National Park',
    province: 'Sofala',
    city: 'Gorongosa',
    image: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1000&q=80',
    tag: 'Wild Safari Restoration',
    description: 'Africa’s celebrated conservation success story with roaring lion prides, elephant herds and lush fever tree forests.'
  },
  {
    id: 'ilha',
    name: 'Ilha de Moçambique',
    province: 'Nampula',
    city: 'Ilha de Moçambique',
    image: 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?auto=format&fit=crop&w=1000&q=80',
    tag: 'UNESCO World Heritage',
    description: 'Five centuries of Swahili, Portuguese and Indian ocean trading history woven into coral stone architecture.'
  },
  {
    id: 'maputo-cidade',
    name: 'Maputo Bay & Costa do Sol',
    province: 'Maputo City',
    city: 'Maputo',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
    tag: 'Art, Architecture & Nightlife',
    description: 'The pulsing heart of Mozambique: Baixa markets, jacaranda avenues, live Marrabenta jazz and peri-peri prawns.'
  }
];

// Verified Mozambican Hidden Gems
const HIDDEN_GEMS = [
  {
    id: 'gem-namaacha',
    title: 'Namaacha Mountain Cascades & Orchards',
    province: 'Maputo Province',
    city: 'Namaacha',
    image: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1000&q=80',
    badge: 'Lebombo Mountains',
    description: 'Perched 600m above sea level near the Swaziland border, Namaacha offers cool highland air, mountain waterfalls, and organic fruit orchards far away from coastal humidity.',
    whySpecial: 'Cool mountain microclimate, freshwater swimming holes, and tranquil country estates.'
  },
  {
    id: 'gem-zalala',
    title: 'Praia de Zalala & The Zambézia Coconut Belt',
    province: 'Zambézia',
    city: 'Quelimane',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
    badge: 'Endless Sands',
    description: 'Located 30km from Quelimane, this 40km stretch of pristine white sand is shaded by millions of towering coconut palms and remains blissfully uncrowded.',
    whySpecial: 'Untouched Atlantic-style vastness on the Indian Ocean with local fisherman dhows.'
  },
  {
    id: 'gem-gurue',
    title: 'Gurué Highland Tea Estates & Mount Namúli',
    province: 'Zambézia',
    city: 'Gurué',
    image: 'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1000&q=80',
    badge: 'Highland Rainforest',
    description: 'Verdant rolling tea plantations nestled in the shadow of Mount Namúli (2,419m), Mozambique’s second-highest peak and home to endemic bird species.',
    whySpecial: 'Picturesque green emerald hills, cool mist, and challenging hiking trails.'
  },
  {
    id: 'gem-meponda',
    title: 'Meponda Fresh Water Coves on Lake Niassa',
    province: 'Niassa',
    city: 'Lichinga',
    image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1000&q=80',
    badge: 'Inland Ocean',
    description: 'A 45-minute drive from Lichinga, Meponda fronts the crystalline freshwater of Lake Niassa, home to over 1,000 endemic brightly coloured cichlid fish.',
    whySpecial: 'Crystal-clear freshwater snorkeling, mountain backdrops, and absolute serenity.'
  }
];

// Accommodation categories to browse by
const DISCOVER_CATEGORIES = [
  { id: 'all', label: 'All Stays', icon: Compass, count: 'Browse all' },
  { id: 'beachfront residence', label: 'Beachfront Stays', icon: Palmtree, count: 'Coastal views' },
  { id: 'lodge', label: 'Safari & Eco Lodges', icon: Building2, count: 'Bush & wildlife' },
  { id: 'city residence', label: 'City Residences', icon: Building, count: 'Urban centers' },
  { id: 'apartment home residence', label: 'Apartment Homes', icon: HomeIcon, count: 'Self-catering' },
  { id: 'outdoor residence', label: 'Outdoor Glamping', icon: Tent, count: 'Nature camps' },
  { id: 'country residence', label: 'Country Escapes', icon: Trees, count: 'Mountains & estates' },
  { id: 'studio apartment', label: 'Studio Suites', icon: LayoutGrid, count: 'Compact comfort' },
];

// Google Place eatery interface
interface EateryItem {
  id: string;
  name: string;
  address: string;
  city?: string;
  rating: number;
  userRatingCount: number;
  primaryType?: string;
  photoUrl?: string;
}

export default function Discover() {
  const navigate = useNavigate();
  const [searchParams, setSearchSearchParams] = useSearchParams();
  const { filters, updateFilters } = useSearch();

  // State
  const [listings, setListings] = useState<Listing[]>([]);
  const [activities, setActivities] = useState<ActivityTrip[]>([]);
  const [eateries, setEateries] = useState<EateryItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingEateries, setLoadingEateries] = useState(false);
  const [eateryError, setEateryError] = useState<string | null>(null);

  // Selected province filter from query param or internal state
  const provinceParam = searchParams.get('province') || 'all';
  const selectedProvince = provinceParam;

  const setSelectedProvince = (prov: string) => {
    const next = new URLSearchParams(searchParams);
    if (prov === 'all') {
      next.delete('province');
    } else {
      next.set('province', prov);
    }
    setSearchSearchParams(next, { replace: true });
  };

  // 1. Subscribe to Listings
  useEffect(() => {
    const unsub = subscribeToListings((data) => {
      setListings(data || []);
      setLoadingListings(false);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Activities & Experiences
  useEffect(() => {
    let isMounted = true;
    getActivitiesTrips()
      .then((acts) => {
        if (isMounted) {
          setActivities(acts || []);
          setLoadingActivities(false);
        }
      })
      .catch((err) => {
        console.warn('Could not load experiences for Discover:', err);
        if (isMounted) setLoadingActivities(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Fetch Eateries from server-side Google Places route
  const fetchEateriesForProvince = useCallback(async (provinceId: string) => {
    setLoadingEateries(true);
    setEateryError(null);

    // Resolve representative coordinates for the province
    let coords = { lat: -25.9692, lng: 32.5732 }; // default Maputo
    if (provinceId !== 'all') {
      const match = MOZAMBIQUE_PROVINCES.find(
        (p) => p.id.toLowerCase() === provinceId.toLowerCase()
      );
      if (match) {
        coords = match.center;
      }
    }

    try {
      const res = await fetch('/api/places/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          radius: provinceId === 'all' ? 25000 : 35000
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        setEateryError('Google Places data temporarily unavailable.');
        setLoadingEateries(false);
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.places)) {
        const mapped: EateryItem[] = data.places.slice(0, 8).map((p: any) => {
          let photoUrl = '';
          if (p.photos && p.photos.length > 0 && p.photos[0].name) {
            photoUrl = `/api/places/photo?name=${encodeURIComponent(p.photos[0].name)}&maxHeightPx=400&maxWidthPx=600`;
          }
          return {
            id: p.id || p.google_place_id,
            name: p.name,
            address: p.shortAddress || p.address,
            city: p.shortAddress?.split(',')[0] || 'Mozambique',
            rating: p.rating || 4.5,
            userRatingCount: p.userRatingCount || 0,
            primaryType: p.primaryType || 'Restaurant',
            photoUrl
          };
        });
        setEateries(mapped);
      } else {
        setEateries([]);
      }
    } catch (err: any) {
      setEateryError('Could not connect to Google Places API.');
    } finally {
      setLoadingEateries(false);
    }
  }, []);

  useEffect(() => {
    fetchEateriesForProvince(selectedProvince);
  }, [selectedProvince, fetchEateriesForProvince]);

  // Province matcher helper
  const matchesProvince = useCallback((itemProvince?: string, itemLocation?: string, itemCity?: string): boolean => {
    if (selectedProvince === 'all') return true;

    const target = selectedProvince.toLowerCase();
    const prov = (itemProvince || '').toLowerCase();
    const loc = (itemLocation || '').toLowerCase();
    const city = (itemCity || '').toLowerCase();

    // Maputo City vs Maputo Province differentiation
    if (target === 'maputo city') {
      if (prov === 'maputo city' || prov === 'maputo cidade' || loc.includes('maputo city') || loc.includes('maputo cidade')) return true;
      if (city === 'maputo' && !loc.includes('ponta') && !loc.includes('namaacha') && !loc.includes('matola')) return true;
      return false;
    }

    if (target === 'maputo province') {
      if (prov === 'maputo province' || prov === 'maputo província' || loc.includes('maputo province')) return true;
      if (city === 'ponta do ouro' || city === 'namaacha' || city === 'matola' || loc.includes('ponta do ouro') || loc.includes('namaacha')) return true;
      return false;
    }

    // Standard province matching
    return prov.includes(target) || loc.includes(target) || city.includes(target);
  }, [selectedProvince]);

  // Section 1: Trending Now (Filtered by province if selected)
  const trendingListings = useMemo(() => {
    return listings
      .filter((l) => matchesProvince(l.province, l.location, l.city))
      .filter((l) => (l.rating && l.rating >= 4.8) || (l.images && l.images.length > 0))
      .slice(0, 4);
  }, [listings, matchesProvince]);

  // Section 2: Top Destinations (Filtered by province)
  const filteredTopDestinations = useMemo(() => {
    if (selectedProvince === 'all') return TOP_DESTINATIONS;
    return TOP_DESTINATIONS.filter((d) => d.province.toLowerCase() === selectedProvince.toLowerCase());
  }, [selectedProvince]);

  // Section 3: Hidden Gems (Filtered by province)
  const filteredHiddenGems = useMemo(() => {
    if (selectedProvince === 'all') return HIDDEN_GEMS;
    return HIDDEN_GEMS.filter((g) => g.province.toLowerCase() === selectedProvince.toLowerCase());
  }, [selectedProvince]);

  // Section 4: Featured Experiences (Admin-curated / verified activities)
  const featuredExperiences = useMemo(() => {
    return activities
      .filter((a) => {
        if (selectedProvince === 'all') return true;
        return matchesProvince(undefined, a.city, a.city);
      })
      .slice(0, 3);
  }, [activities, selectedProvince, matchesProvince]);

  // Section 5: Last-Minute Deals & Current Specials (Prioritized genuine offers across stays & experiences)
  const lastMinuteDeals = useMemo(() => {
    interface DealItem {
      id: string;
      itemType: 'stay' | 'experience';
      title: string;
      image: string;
      locationText: string;
      rating?: number;
      offerName?: string;
      badgeText: string;
      isUrgent: boolean; // expiring within 14 days or explicitly last-minute
      daysRemaining?: number;
      currentPrice: number;
      originalPrice: number;
      priceSubtext: string;
      bookUrl: string;
      bookLabel: string;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 1. Gather valid active offers from Stays (Listings)
    const stayDeals: DealItem[] = listings
      .filter((l) => matchesProvince(l.province, l.location, l.city))
      .filter((l) => isOfferActive(l.specialOffer))
      .map((l) => {
        const pricing = getEffectivePrice(l);
        const offer = l.specialOffer!;
        let daysRemaining: number | undefined;
        let isUrgent = false;

        if (offer.endDate) {
          const end = new Date(offer.endDate);
          const diffMs = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            daysRemaining = diffDays;
            if (diffDays <= 14) isUrgent = true;
          }
        }

        const discountBadge = pricing.discountPercent 
          ? `${pricing.discountPercent}% OFF` 
          : 'SPECIAL OFFER';

        return {
          id: `stay-${l.id}`,
          itemType: 'stay',
          title: l.title,
          image: l.images[0] || 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1000&q=80',
          locationText: l.city || l.province || 'Mozambique',
          rating: l.rating,
          offerName: pricing.offerName || (pricing.seasonalTag ? `${pricing.seasonalTag} Special` : undefined),
          badgeText: isUrgent && daysRemaining !== undefined && daysRemaining <= 7 
            ? `${daysRemaining === 0 ? 'Ends Today' : `${daysRemaining}d left`} • ${discountBadge}` 
            : discountBadge,
          isUrgent,
          daysRemaining,
          currentPrice: pricing.currentPrice,
          originalPrice: pricing.originalPrice,
          priceSubtext: 'per night',
          bookUrl: `/listing/${l.id}`,
          bookLabel: 'Book Stay'
        };
      });

    // 2. Gather valid active offers from Experiences (Activities & Trips)
    const experienceDeals: DealItem[] = activities
      .filter((a) => {
        if (selectedProvince === 'all') return true;
        return matchesProvince(undefined, a.city, a.city);
      })
      .filter((a) => isActivityOfferActive(a.specialOffer))
      .map((a) => {
        const offer = a.specialOffer!;
        const origPrice = a.priceAdult || 0;
        let curPrice = offer.specialPrice || origPrice;
        let discPercent = offer.discountPercent;

        if (discPercent && (!offer.specialPrice || offer.specialPrice <= 0) && origPrice > 0) {
          curPrice = Math.round(origPrice * (1 - discPercent / 100));
        } else if (origPrice > 0 && curPrice > 0 && curPrice < origPrice && !discPercent) {
          discPercent = Math.max(1, Math.round(((origPrice - curPrice) / origPrice) * 100));
        }

        let daysRemaining: number | undefined;
        let isUrgent = false;

        if (offer.endDate) {
          const end = new Date(offer.endDate);
          const diffMs = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            daysRemaining = diffDays;
            if (diffDays <= 14) isUrgent = true;
          }
        }

        const discountBadge = discPercent ? `${discPercent}% OFF` : 'SPECIAL OFFER';

        return {
          id: `exp-${a.id}`,
          itemType: 'experience',
          title: a.title,
          image: a.coverImage || (a.images && a.images[0]) || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
          locationText: a.city || 'Mozambique',
          rating: a.rating,
          offerName: offer.offerName || (offer.seasonalTag ? `${offer.seasonalTag} Special` : undefined),
          badgeText: isUrgent && daysRemaining !== undefined && daysRemaining <= 7 
            ? `${daysRemaining === 0 ? 'Ends Today' : `${daysRemaining}d left`} • ${discountBadge}` 
            : discountBadge,
          isUrgent,
          daysRemaining,
          currentPrice: curPrice,
          originalPrice: origPrice,
          priceSubtext: 'per person',
          bookUrl: `/trips?select=${a.id}`,
          bookLabel: 'Book Experience'
        };
      });

    // Priority 1: Verified near-term deadline / qualifying last-minute booking window
    // Priority 2: Other current specials (valid active offers even when not expiring soon)
    const combined = [...stayDeals, ...experienceDeals];

    // Sort: urgent deals first (by least days remaining), then by highest savings percentage
    combined.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      if (a.isUrgent && b.isUrgent && a.daysRemaining !== undefined && b.daysRemaining !== undefined) {
        return a.daysRemaining - b.daysRemaining;
      }
      const savingPercentA = a.originalPrice > 0 ? (a.originalPrice - a.currentPrice) / a.originalPrice : 0;
      const savingPercentB = b.originalPrice > 0 ? (b.originalPrice - b.currentPrice) / b.originalPrice : 0;
      return savingPercentB - savingPercentA;
    });

    return combined.slice(0, 4);
  }, [listings, activities, selectedProvince, matchesProvince]);

  // Section 7: Categories distribution
  const selectedCategoryListings = useCallback((categoryId: string) => {
    if (categoryId === 'all') {
      return listings.filter((l) => matchesProvince(l.province, l.location, l.city)).length;
    }
    return listings
      .filter((l) => matchesProvince(l.province, l.location, l.city))
      .filter((l) => l.residenceType === categoryId || l.category === categoryId)
      .length;
  }, [listings, matchesProvince]);

  // Helper to navigate preserving Search / Travel Companion context
  const handleDestinationSelect = (destinationName: string) => {
    updateFilters({ destination: destinationName });
    navigate(`/?destination=${encodeURIComponent(destinationName)}`);
  };

  const handleCategorySelect = (categoryId: string) => {
    if (categoryId === 'all') {
      navigate('/');
    } else {
      navigate(`/?category=${encodeURIComponent(categoryId)}`);
    }
  };

  const currentProvinceInfo = useMemo(() => {
    if (selectedProvince === 'all') return null;
    return MOZAMBIQUE_PROVINCES.find(
      (p) => p.id.toLowerCase() === selectedProvince.toLowerCase()
    );
  }, [selectedProvince]);

  // Province-level listing counts for map and statistics
  const listingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MOZAMBIQUE_PROVINCES.forEach((p) => {
      counts[p.id] = listings.filter((l) => {
        const prov = (l.province || '').toLowerCase();
        const loc = (l.location || '').toLowerCase();
        const city = (l.city || '').toLowerCase();
        const target = p.id.toLowerCase();
        if (target === 'maputo city') {
          if (prov === 'maputo city' || prov === 'maputo cidade' || loc.includes('maputo city') || loc.includes('maputo cidade')) return true;
          if (city === 'maputo' && !loc.includes('ponta') && !loc.includes('namaacha') && !loc.includes('matola')) return true;
          return false;
        }
        if (target === 'maputo province') {
          if (prov === 'maputo province' || prov === 'maputo província' || loc.includes('maputo province')) return true;
          if (city === 'ponta do ouro' || city === 'namaacha' || city === 'matola' || loc.includes('ponta do ouro') || loc.includes('namaacha')) return true;
          return false;
        }
        return prov.includes(target) || loc.includes(target) || city.includes(target);
      }).length;
    });
    return counts;
  }, [listings]);

  return (
    <main className="min-h-screen bg-gray-50/60 pb-36">
      {/* Hero / Header Banner */}
      <section className="bg-gradient-to-b from-white via-white to-gray-50/80 border-b border-gray-200 pt-8 pb-10 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-[#009A60] rounded-full text-xs font-bold mb-3 border border-emerald-200">
                <Compass size={14} className="animate-spin" style={{ animationDuration: '8s' }} />
                <span>MozBook Discover · Official Exploration Guide</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">
                Discover Mozambique
              </h1>
              <p className="text-base sm:text-lg text-gray-600 mt-2 max-w-2xl">
                Explore real verified stays, untouched Indian Ocean coral archipelagos, authentic culinary spots, and curated safaris across 11 provinces.
              </p>
            </div>

            {/* Quick Stats or Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/eateries"
                className="px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <Utensils size={15} className="text-[#009A60]" />
                <span>Eateries & Check-in</span>
              </Link>
              <Link
                to="/trips"
                className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <Waves size={15} />
                <span>MozBook Trips</span>
              </Link>
            </div>
          </div>

          {/* Interactive Province Selector Pills */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#009A60]" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Filter Discover by Province:
                </span>
              </div>
              {selectedProvince !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedProvince('all')}
                  className="text-xs font-semibold text-[#009A60] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X size={13} />
                  <span>Show All Mozambique</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSelectedProvince('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedProvince === 'all'
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Mozambique ({MOZAMBIQUE_PROVINCES.length})
              </button>

              {MOZAMBIQUE_PROVINCES.map((prov) => {
                const isSelected = selectedProvince.toLowerCase() === prov.id.toLowerCase();
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setSelectedProvince(prov.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#009A60] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <span>{prov.name}</span>
                    <span className="text-[10px] opacity-75">· {prov.region}</span>
                  </button>
                );
              })}
            </div>

            {/* Active province info badge */}
            {currentProvinceInfo && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                      Currently Exploring: {currentProvinceInfo.name}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-full text-[10px] font-bold">
                      Capital: {currentProvinceInfo.capital}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    {currentProvinceInfo.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentProvinceInfo.highlights.slice(0, 3).map((hl) => (
                    <span
                      key={hl}
                      className="px-2.5 py-1 bg-white text-emerald-900 border border-emerald-200 rounded-lg text-[11px] font-semibold"
                    >
                      {hl}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Main Discover Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-16">

        {/* ================================================================= */}
        {/* 1. TRENDING NOW */}
        {/* ================================================================= */}
        <section id="trending-now">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-[#009A60] rounded-xl">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Trending Now
                </h2>
                <p className="text-xs text-gray-500">
                  Genuine stays in Mozambique with verified recent interest & guest ratings
                </p>
              </div>
            </div>

            <Link
              to="/"
              className="text-xs font-bold text-[#009A60] hover:text-[#008250] flex items-center gap-1"
            >
              <span>View all stays</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {loadingListings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 bg-gray-200 rounded-2xl"></div>
              ))}
            </div>
          ) : trendingListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id!}
                  title={listing.title}
                  location={listing.location}
                  price={listing.price}
                  rating={listing.rating}
                  image={listing.images[0] || 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80'}
                  dates={listing.dates}
                  residenceType={listing.residenceType}
                  specialOffer={listing.specialOffer}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <Compass size={32} className="mx-auto text-gray-400 mb-2" />
              <h4 className="font-bold text-gray-900 text-sm">No Trending Stays In This Province Yet</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                No accommodation records matched “{selectedProvince}”. Try switching to All Mozambique to view all active stays.
              </p>
              <button
                type="button"
                onClick={() => setSelectedProvince('all')}
                className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
              >
                Reset to All Mozambique
              </button>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 2. TOP DESTINATIONS */}
        {/* ================================================================= */}
        <section id="top-destinations">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Top Destinations
                </h2>
                <p className="text-xs text-gray-500">
                  Iconic travel destinations across Mozambique with rich ecosystems & activities
                </p>
              </div>
            </div>
          </div>

          {filteredTopDestinations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTopDestinations.map((dest) => (
                <div
                  key={dest.id}
                  onClick={() => handleDestinationSelect(dest.city)}
                  className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    <img
                      src={dest.image}
                      alt={dest.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-xs text-gray-900 rounded-full text-[10px] font-bold">
                      {dest.province}
                    </span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 bg-blue-600/90 text-white rounded-full text-[10px] font-extrabold">
                      {dest.tag}
                    </span>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-lg font-black leading-tight drop-shadow-sm">
                        {dest.name}
                      </h3>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                      {dest.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#009A60]">
                        Browse stays in {dest.city}
                      </span>
                      <ChevronRight size={14} className="text-[#009A60] group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <MapPin size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">
                No featured destination cards directly pinned in {selectedProvince}. Explore nearby provincial highlights below.
              </p>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 3. HIDDEN GEMS */}
        {/* ================================================================= */}
        <section id="hidden-gems">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Hidden Gems
                </h2>
                <p className="text-xs text-gray-500">
                  Off-the-beaten-path Mozambican retreats, highland escapes & pristine coastlines
                </p>
              </div>
            </div>
          </div>

          {filteredHiddenGems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredHiddenGems.map((gem) => (
                <div
                  key={gem.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all p-5 flex flex-col sm:flex-row gap-5"
                >
                  <div className="w-full sm:w-44 h-44 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <img
                      src={gem.image}
                      alt={gem.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {gem.badge}
                        </span>
                        <span className="text-[11px] text-gray-400 font-semibold">
                          {gem.province}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 leading-snug">
                        {gem.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                        {gem.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-[11px] text-gray-500 italic">
                        💡 {gem.whySpecial}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDestinationSelect(gem.city)}
                        className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                      >
                        Explore
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <Sparkles size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">
                No hidden gem records currently published for {selectedProvince}. View our Mozambique-wide gems above.
              </p>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 4. FEATURED EXPERIENCES */}
        {/* ================================================================= */}
        <section id="featured-experiences">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Award size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Featured Experiences
                </h2>
                <p className="text-xs text-gray-500">
                  Verified ocean excursions, marine safaris & guided Mozambique expeditions
                </p>
              </div>
            </div>

            <Link
              to="/trips"
              className="text-xs font-bold text-[#009A60] hover:text-[#008250] flex items-center gap-1"
            >
              <span>Explore all trips</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {loadingActivities ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-2xl"></div>
              ))}
            </div>
          ) : featuredExperiences.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredExperiences.map((act) => (
                <div
                  key={act.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    <img
                      src={act.coverImage || act.images?.[0] || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80'}
                      alt={act.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-xs text-gray-900 rounded-full text-[10px] font-bold">
                      {act.category}
                    </span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#009A60] text-white rounded-full text-[10px] font-extrabold">
                      {act.city}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 leading-snug">
                        {act.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {act.shortDescription || act.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-semibold">From</span>
                        <span className="text-sm font-black text-gray-900">
                          {act.priceAdult?.toLocaleString()} MZN
                        </span>
                      </div>
                      <Link
                        to={`/trips?select=${act.id}`}
                        className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        Book Experience
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <Award size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">
                No active experiences currently registered in {selectedProvince}. View all available trips on the Trips page.
              </p>
              <Link
                to="/trips"
                className="mt-4 inline-block px-4 py-2 bg-[#009A60] text-white rounded-xl text-xs font-bold"
              >
                Browse All MozBook Trips
              </Link>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 5. LAST-MINUTE DEALS */}
        {/* ================================================================= */}
        <section id="last-minute-deals">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-[#009A60] rounded-xl">
                <Zap size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Last-Minute Deals
                </h2>
                <p className="text-xs text-gray-500">
                  Active, verified special offers with confirmed availability & transparent pricing
                </p>
              </div>
            </div>
          </div>

          {lastMinuteDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {lastMinuteDeals.map((deal) => {
                return (
                  <div
                    key={deal.id}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all group flex flex-col justify-between"
                  >
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      <img
                        src={deal.image}
                        alt={deal.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                        <Tag size={12} />
                        <span>{deal.badgeText}</span>
                      </div>
                      <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white rounded-full text-[9px] font-bold uppercase tracking-wider">
                        {deal.itemType === 'stay' ? 'Stay' : 'Experience'}
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span className="font-semibold">{deal.locationText}</span>
                          {deal.rating && (
                            <span className="flex items-center gap-1 font-bold text-gray-900">
                              <Star size={13} className="text-amber-500 fill-amber-500" />
                              {deal.rating}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                          {deal.title}
                        </h4>
                        {deal.offerName && (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1 line-clamp-1">
                            {deal.offerName}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-black text-gray-900">
                              {deal.currentPrice.toLocaleString()} MZN
                            </span>
                            {deal.originalPrice > deal.currentPrice && (
                              <span className="text-xs text-gray-400 line-through">
                                {deal.originalPrice.toLocaleString()} MZN
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 block font-medium">
                            {deal.priceSubtext}
                          </span>
                        </div>
                        <Link
                          to={deal.bookUrl}
                          className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all"
                        >
                          {deal.bookLabel}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <Zap size={32} className="mx-auto text-gray-400 mb-2" />
              <h4 className="font-bold text-gray-900 text-sm">
                No Active Special Offers {selectedProvince !== 'all' ? `in ${selectedProvince}` : 'Right Now'}
              </h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Host properties and experience guides publish seasonal promotions regularly. Browse available verified stays, activities and trips across Mozambique.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/"
                  className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Browse Available Stays
                </Link>
                <Link
                  to="/trips"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all"
                >
                  Browse Activities & Trips
                </Link>
                {selectedProvince !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedProvince('all')}
                    className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    View All Mozambique Deals
                  </button>
                )}
              </div>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 6. RESTAURANTS & EATERIES (Google Places live integration) */}
        {/* ================================================================= */}
        <section id="restaurants-eateries">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-100 text-orange-700 rounded-xl">
                <Utensils size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Restaurants & Eateries
                </h2>
                <p className="text-xs text-gray-500">
                  Authentic Mozambican seafood, cafes & eateries powered by Google Places
                </p>
              </div>
            </div>

            <Link
              to="/eateries"
              className="text-xs font-bold text-[#009A60] hover:text-[#008250] flex items-center gap-1"
            >
              <span>Social check-in & reviews</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {loadingEateries ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-60 bg-gray-200 rounded-2xl"></div>
              ))}
            </div>
          ) : eateryError ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>{eateryError} You can browse social check-ins and member tips on the dedicated Eateries tab.</span>
            </div>
          ) : eateries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {eateries.map((eatery) => (
                <div
                  key={eatery.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    {eatery.photoUrl ? (
                      <img
                        src={eatery.photoUrl}
                        alt={eatery.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if photo fails to load
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                        <Utensils size={30} />
                      </div>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-white/90 backdrop-blur-xs text-gray-800 rounded-full text-[10px] font-bold">
                      {eatery.primaryType || 'Restaurant'}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                        {eatery.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {eatery.address}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs font-bold text-gray-900">
                        <Star size={13} className="text-amber-500 fill-amber-500" />
                        <span>{eatery.rating}</span>
                        {eatery.userRatingCount > 0 && (
                          <span className="text-gray-400 font-normal text-[10px]">
                            ({eatery.userRatingCount})
                          </span>
                        )}
                      </div>

                      <Link
                        to="/eateries"
                        className="text-[11px] font-bold text-[#009A60] hover:underline"
                      >
                        Check In →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl text-center">
              <Utensils size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">
                No Google Places records retrieved for {selectedProvince} within this search radius.
              </p>
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* 7. EXPLORE BY CATEGORY */}
        {/* ================================================================= */}
        <section id="explore-by-category">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-[#009A60] rounded-xl">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Explore by Category
                </h2>
                <p className="text-xs text-gray-500">
                  Filter MozBook by canonical property types and living styles
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {DISCOVER_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = selectedCategoryListings(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className="p-4 bg-white border border-gray-200 hover:border-[#009A60] rounded-2xl text-center transition-all group hover:shadow-md cursor-pointer flex flex-col items-center justify-between gap-3"
                >
                  <div className="p-3 bg-gray-50 group-hover:bg-emerald-50 text-gray-700 group-hover:text-[#009A60] rounded-xl transition-colors">
                    <Icon size={22} />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-gray-900 leading-tight">
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold mt-1 block">
                      {count} stay{count === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>


        {/* ================================================================= */}
        {/* 8. EXPLORE MOZAMBIQUE — Interactive Provincial Map */}
        {/* ================================================================= */}
        <section id="explore-map">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-[#009A60] rounded-xl">
                <MapIcon size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Explore Mozambique
                </h2>
                <p className="text-xs text-gray-500">
                  Geographic territorial map of Mozambique with 11 first-order divisions and Maputo City represented separately
                </p>
              </div>
            </div>
            {selectedProvince !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedProvince('all')}
                className="text-xs font-bold text-[#009A60] hover:underline cursor-pointer"
              >
                Reset Map Filter
              </button>
            )}
          </div>

          <MozambiqueInteractiveMap
            selectedProvince={selectedProvince === 'all' ? 'Maputo City' : selectedProvince}
            onSelectProvince={(id) => setSelectedProvince(id)}
            listingCounts={listingCounts}
            onExploreListings={(provName, capital) => handleDestinationSelect(provName || capital)}
          />
        </section>

      </div>
    </main>
  );
}
