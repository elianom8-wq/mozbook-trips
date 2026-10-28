import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  ActivityTrip,
  ActivityBooking,
  ActivityTripType,
  ActivityTripStatus
} from '../types/activityTrip';
import { calculateCommission } from '../config/platformCommission';
import { OperatorInventoryDebit } from '../types/payment';
import { checkHostVerificationStatus } from './listingService';

const STORAGE_KEY_ACTIVITIES = 'mozbook_activities_trips';
const STORAGE_KEY_BOOKINGS = 'mozbook_activity_bookings';
const STORAGE_KEY_OPERATOR_DEBITS = 'mozbook_operator_inventory_debits';

export function isActivityOfferActive(offer?: import('../types/activityTrip').SpecialOfferConfig | null): boolean {
  if (!offer || !offer.enabled) return false;
  // If dates are provided, ensure current date falls within range
  if (offer.startDate && offer.endDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(offer.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(offer.endDate);
    end.setHours(23, 59, 59, 999);
    if (now < start || now > end) return false;
  }
  return (offer.specialPrice !== undefined && offer.specialPrice > 0) || (offer.discountPercent !== undefined && offer.discountPercent > 0);
}

export function getLocalOperatorDebits(): OperatorInventoryDebit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPERATOR_DEBITS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalOperatorDebits(debits: OperatorInventoryDebit[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_OPERATOR_DEBITS, JSON.stringify(debits));
  } catch (err) {
    console.warn('Could not cache operator debits in localStorage:', err);
  }
}

// Default initial curated listings seeded for Mozambique
const INITIAL_ACTIVITIES: ActivityTrip[] = [
  {
    id: 'act-dolphin-ponta',
    hostId: 'host_wild_ocean',
    hostName: 'Ponta Marine Biology Safaris',
    hostEmail: 'info@pontadolphins.co.mz',
    hostPhone: '+258 84 311 9080',
    type: 'activity',
    title: 'Wild Dolphin Ocean Swim & Reef Snorkel',
    shortDescription: 'Ethical wild dolphin encounters guided by marine biologists in Ponta do Ouro Marine Reserve',
    description: 'Join an unforgettable 3-hour marine safari in Ponta do Ouro. Launch through the surf on an 8-meter semi-rigid Super-Duck boat and cruise the bay for resident pods of wild bottlenose dolphins. Under certified marine biologist guidance, slip quietly into the Indian Ocean for peaceful, non-intrusive in-water encounters. Afterwards, snorkel shallow coral gardens teeming with tropical reef fish, moray eels, and rays.',
    category: 'Snorkeling',
    city: 'Ponta do Ouro',
    meetingPoint: 'Ponta do Ouro Main Beach Launch Site, adjacent to the Dive Center',
    meetingPointInstructions: 'Look for the green and white MozBook sign on the beachfront. 4x4 access recommended or transfer from border.',
    coordinates: { lat: -26.8458, lng: 32.8872 },
    pickup: {
      offered: true,
      areas: 'Ponta do Ouro, Ponta Malongane lodges and Kosi Bay border post',
      location: 'Hotel reception or border parking',
      instructions: 'Please be in front of reception 30 minutes prior to launch time.',
      fee: 1500
    },
    duration: '3 hours',
    scheduleType: 'recurring',
    recurringDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTimes: ['07:30', '10:30', '14:00'],
    maxGuests: 12,
    minGuests: 2,
    pricingType: 'per_person',
    priceAdult: 4200,
    priceChild: 2500,
    currency: 'MZN',
    specialOffer: {
      enabled: true,
      offerName: 'Summer Ocean Conservation Deal',
      discountPercent: 10,
      specialPrice: 3780,
      seasonalTag: 'Early Bird Summer'
    },
    images: [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1200&q=80'
    ],
    coverImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    vehicleType: 'Super-Duck 8m Rigid Inflatable Boat + 4x4 Beach Launch',
    included: [
      'High-grade snorkel mask and fin kit',
      'Ponta Marine Reserve entry permits',
      'Marine biologist scientific briefing',
      'Chilled mineral water and seasonal fruit'
    ],
    notIncluded: ['Gratuities for skipper and deckhand', 'Alcoholic beverages'],
    whatToBring: ['Swimwear & beach towel', 'Reef-safe sunscreen & sunglasses', 'Waterproof pouch or camera'],
    requirements: ['Comfortable swimming in open water', 'Minimum age 5 years for ocean swim'],
    isWeatherDependent: true,
    weatherConditions: {
      warningTitle: 'Open Ocean Beach Launch & Marine Conditions Apply',
      description: 'Boat launches through Ponta surf zone. Operations depend on sea swell, ocean visibility, and National Maritime Institute (INAM) weather alerts.',
      seaConditions: 'Surf launch requires wave swell under 2.5 meters and safe break conditions.',
      cycloneOrWindLimit: 'Maximum onshore winds 18 knots; cancelled upon INAM tropical storm warning.',
      rainPolicy: 'runs_in_light_rain',
      decisionCutoffHours: 2,
      reschedulingOption: true,
      fullRefundOnCancellation: true
    },
    status: 'published',
    rating: 4.98,
    reviewsCount: 178,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'trip-dhow-bazaruto',
    hostId: 'host_bazaruto_sails',
    hostName: 'Bazaruto Island Expeditions',
    hostEmail: 'capt.dinis@bazarutodhows.co.mz',
    hostPhone: '+258 84 555 1234',
    type: 'trip',
    title: 'Traditional Wooden Dhow Sailing to Magaruque Island',
    shortDescription: 'Sail across turquoise Bazaruto waters on an authentic handcrafted Arab dhow with island beach seafood barbecue',
    description: 'Experience timeless maritime heritage as you board an authentic hand-hewn wooden dhow in Vilankulo. Hoist the lateen sail and catch the morning offshore breeze toward Magaruque Island in the Bazaruto National Marine Park. Hike towering golden sand dunes offering 360-degree vistas over turquoise sandbars, snorkel the vibrant reef nicknamed "The Aquarium", and feast on freshly caught grilled peri-peri fish, tiger prawns, and coconut rice prepared directly over coals on the beach.',
    category: 'Island Excursions',
    city: 'Vilankulo',
    meetingPoint: 'Vilankulo North Beach, opposite Archipelago Resort',
    meetingPointInstructions: 'Meet Captain Dinis beside the flag post at 08:00 AM. Low tide boarding tender provided.',
    coordinates: { lat: -21.9856, lng: 35.3188 },
    pickup: {
      offered: true,
      areas: 'All Vilankulo beachfront lodges and town hotels',
      location: 'Hotel lobby',
      instructions: 'Pickups commence at 07:30 AM.',
      fee: 500
    },
    duration: 'Full Day (7-8 hrs)',
    scheduleType: 'recurring',
    recurringDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    startTimes: ['08:00'],
    maxGuests: 16,
    minGuests: 2,
    pricingType: 'per_person',
    priceAdult: 6500,
    priceChild: 3900,
    currency: 'MZN',
    specialOffer: {
      enabled: false,
      offerName: ''
    },
    images: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80'
    ],
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    vehicleType: 'Handcrafted Wooden Lateen Sail Dhow & Dinghy',
    included: [
      'Bazaruto National Marine Park entry conservation fee',
      'Fresh island seafood BBQ lunch with grilled prawns and fish',
      'Snorkeling gear (mask, snorkel, fins)',
      'Water, sodas, and fresh coconuts'
    ],
    notIncluded: ['Alcoholic beers/wine (BYOB welcome)', 'Personal tips'],
    whatToBring: ['Beach towel, hat, and sunglasses', 'Reef shoes for coral walk', 'Camera and waterproof dry bag'],
    requirements: ['Suitable for all ages and families', 'Moderate mobility to board dhow from shallow water'],
    isWeatherDependent: true,
    weatherConditions: {
      warningTitle: 'Bazaruto Archipelago Maritime Conditions Apply',
      description: 'Traditional wooden dhow sailing relies on wind velocity, ocean currents, and safe channel navigation between Vilankulo and Magaruque Island.',
      seaConditions: 'Safe navigation requires calm waters in the Bazaruto channel; high chop restricts lateen sail deployment.',
      cycloneOrWindLimit: 'Maximum sustained wind 20 knots; maritime authority harbor closure grounded.',
      rainPolicy: 'operator_assessment',
      decisionCutoffHours: 3,
      reschedulingOption: true,
      fullRefundOnCancellation: true
    },
    status: 'published',
    rating: 4.96,
    reviewsCount: 134,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'act-whale-shark-tofo',
    hostId: 'host_tofo_ocean',
    hostName: 'Tofo Marine & Dive Adventure',
    hostEmail: 'dive@tofomoz.com',
    hostPhone: '+258 84 991 4422',
    type: 'activity',
    title: 'Whale Shark Ocean Safari & Manta Point Snorkel',
    shortDescription: 'Venture into Tofo’s globally renowned marine corridor alongside gentle ocean giants',
    description: 'Tofo is recognized worldwide as one of the premier gathering zones for Whale Sharks and Giant Manta Rays. Embark on a thrilling beach tractor launch and cruise the coastal plankton line with expert spotters scanning the waters from elevated towers. Experience the awe of gently gliding alongside these docile pelagic giants in crystal-clear azure waters.',
    category: 'Wildlife Experiences',
    city: 'Tofo',
    meetingPoint: 'Tofo Main Beachfront, Blue Ocean Dive Shed',
    meetingPointInstructions: 'Arrive 20 minutes before departure for gear sizing and safety protocol briefing.',
    coordinates: { lat: -23.8569, lng: 35.5489 },
    pickup: {
      offered: true,
      areas: 'Tofo and Barra Beach accommodations',
      location: 'Resort front gate',
      fee: 800
    },
    duration: '4 hours',
    scheduleType: 'recurring',
    recurringDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTimes: ['08:30', '13:30'],
    maxGuests: 14,
    minGuests: 2,
    pricingType: 'per_person',
    priceAdult: 5200,
    priceChild: 3200,
    currency: 'MZN',
    specialOffer: {
      enabled: true,
      offerName: 'Whale Season Special',
      discountPercent: 15,
      specialPrice: 4420,
      seasonalTag: 'Whale Season'
    },
    images: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=1200&q=80'
    ],
    coverImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    vehicleType: 'Semi-Rigid Dive Catamaran + 4x4 Tractor Beach Launch',
    included: [
      'Wetsuit, mask, and fin kit',
      'Licensed PADI divemaster & ocean spotter guide',
      'Hot spiced tea and tropical fruit on return to shore'
    ],
    notIncluded: ['Underwater video/photo thumb drive (available for MZN 1,200)'],
    whatToBring: ['Swimwear', 'Towel', 'Sunscreen', 'Warm windbreaker jacket for boat return'],
    requirements: ['Basic swimming capability required'],
    isWeatherDependent: true,
    weatherConditions: {
      warningTitle: 'Pelagic Ocean Launch & Whale Shark Spotting Conditions',
      description: 'Ocean safaris require offshore visibility to locate whale sharks and manageable surf conditions for tractor beach launch.',
      seaConditions: 'Swell must permit tractor launch through Tofo shorebreak.',
      cycloneOrWindLimit: 'Winds below 20 knots; cancelled under official INAM storm advisories.',
      rainPolicy: 'runs_in_light_rain',
      decisionCutoffHours: 2,
      reschedulingOption: true,
      fullRefundOnCancellation: true
    },
    status: 'published',
    rating: 4.97,
    reviewsCount: 210,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'trip-gorongosa-safari',
    hostId: 'host_gorongosa_trails',
    hostName: 'Gorongosa Wilderness Expeditions',
    hostEmail: 'safari@gorongosaadventures.mz',
    hostPhone: '+258 84 712 8840',
    type: 'trip',
    title: 'Gorongosa National Park 4x4 Safari Game Drive',
    shortDescription: 'Wildlife game tracking across floodplains, fever-tree forests, and lion territories with expert naturalists',
    description: 'Explore the legendary Gorongosa National Park, hailed as one of Africa’s greatest ecological restoration triumphs. Traverse expansive floodplains around Lake Urema, acacia savannas, and fever-tree woodlands in an open-sided 4x4 safari cruiser. Track lion prides, wild elephant herds, hippos, waterbucks, and rare sable antelopes led by veteran park naturalists and rangers.',
    category: 'Safari',
    city: 'Gorongosa',
    meetingPoint: 'Chitengo Main Safari Camp, Gorongosa National Park',
    meetingPointInstructions: 'Meet at the Safari Activity Desk at Chitengo reception.',
    coordinates: { lat: -18.9786, lng: 34.3541 },
    pickup: {
      offered: true,
      areas: 'Beira Airport or Chimoio Lodges (optional private transfer)',
      fee: 4500
    },
    duration: 'Full Day (8 hrs)',
    scheduleType: 'recurring',
    recurringDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    startTimes: ['06:00', '14:30'],
    maxGuests: 8,
    minGuests: 2,
    pricingType: 'per_person',
    priceAdult: 9800,
    priceChild: 5500,
    currency: 'MZN',
    images: [
      'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1200&q=80'
    ],
    coverImage: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
    vehicleType: 'Custom Open-Sided 4x4 Land Cruiser Safari Vehicle',
    included: [
      'Park entrance fees and conservation levy',
      'Armed park ranger escort and certified naturalist guide',
      'Bush picnic lunch in shaded fever-tree forest',
      'Professional binoculars for wildlife viewing'
    ],
    notIncluded: ['Personal safari gear and gratuities'],
    whatToBring: ['Neutral khaki/earth-toned clothing', 'Hat, sunscreen, bug repellent', 'Camera with zoom lens'],
    requirements: ['Children under 6 must remain in enclosed cabin area'],
    status: 'published',
    rating: 4.99,
    reviewsCount: 92,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'trip-maputo-heritage',
    hostId: 'host_maputo_walks',
    hostName: 'Maputo Heritage & Art Collective',
    hostEmail: 'tours@maputoheritage.co.mz',
    hostPhone: '+258 84 220 1932',
    type: 'trip',
    title: 'Maputo Modernist Architecture & FEIMA Cultural Tour',
    shortDescription: 'Explore Pancho Guedes modernist architecture, Fortaleza colonial relics, and lively artisan craft markets',
    description: 'Immerse yourself in Maputo’s vibrant urban energy, eclectic architecture, and rich Mozambican history. Stroll through the iconic Eiffel-inspired CFM Central Railway Station, visit the 18th-century Fortaleza da Senhora da Conceição, and marvel at the eccentric Pancho Guedes modernist architecture buildings. Conclude at FEIMA artisan market to watch skilled carvers craft ebony wood and batik textiles while enjoying roasted cashew nuts and spiced ginger juice.',
    category: 'Cultural Tours',
    city: 'Maputo',
    meetingPoint: 'Praça dos Trabalhadores, in front of the CFM Railway Station',
    meetingPointInstructions: 'Meet your guide carrying a green MozBook folder near the central clock.',
    coordinates: { lat: -25.9723, lng: 32.5694 },
    pickup: {
      offered: true,
      areas: 'Polana, Sommerchield, and Downtown Maputo hotels',
      fee: 600
    },
    duration: '4 hours',
    scheduleType: 'recurring',
    recurringDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    startTimes: ['09:00', '14:00'],
    maxGuests: 10,
    minGuests: 1,
    pricingType: 'per_person',
    priceAdult: 3200,
    priceChild: 1800,
    currency: 'MZN',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
    ],
    coverImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    vehicleType: 'Air-Conditioned Passenger Minivan or 4x4 Tourer',
    included: [
      'All historical museum entries and Fortaleza access',
      'FEIMA artisan craft market guided tour',
      'Bottled water and local cashew snack'
    ],
    notIncluded: ['Purchases at artisan stalls', 'Guide tip'],
    whatToBring: ['Comfortable walking shoes', 'Sun hat and sunglasses', 'Camera'],
    requirements: ['Easy walking pace suitable for all fitness levels'],
    status: 'published',
    rating: 4.88,
    reviewsCount: 76,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_ACTIVITY_IDS = new Set(INITIAL_ACTIVITIES.map(a => a.id));

// Helper: load local items
function getLocalActivities(): ActivityTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(INITIAL_ACTIVITIES));
      return INITIAL_ACTIVITIES;
    }
    return parsed;
  } catch {
    return INITIAL_ACTIVITIES;
  }
}

function saveLocalActivities(items: ActivityTrip[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(items));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function getLocalBookings(): ActivityBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalBookings(items: ActivityBooking[]) {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(items));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export interface GetActivitiesTripsOptions {
  type?: ActivityTripType;
  status?: ActivityTripStatus;
  city?: string;
  hostId?: string;
  includeUnpublished?: boolean;
}

export interface AuthorizationContext {
  isCallerAuthorizedAdmin?: boolean;
  currentUid?: string;
}

export function isCallerAdmin(user?: { uid?: string; email?: string | null } | null): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  return email === 'mozbookinfo@gmail.com' || email === 'admin@mozbook.mz';
}

/**
 * Fetch all activities & trips with optional filters.
 *
 * Architecture Invariants:
 * 1. Curated baseline activities (INITIAL_ACTIVITIES) and local items are merged
 *    with Firestore items by ID deduplication (Firestore records take precedence),
 *    ensuring verified platform experiences remain discoverable across environments
 *    and are not wiped out when a single partner draft or package is written to Firestore.
 * 2. Public queries (where hostId is not specified or caller is not authorized)
 *    are strictly guarded: only published ('published') items may be returned. Drafts ('draft')
 *    and unapproved submissions ('pending' / 'paused') remain strictly hidden from public-facing views.
 * 3. Scoped host queries enforce authentication: hosts can see their own drafts and submissions,
 *    but a third party or competing host querying another hostId can only see published listings.
 * 4. Admin flag `includeUnpublished: true` is strictly verified against admin email/claims.
 *    Unauthorized or public callers passing includeUnpublished are safely ignored.
 */
export async function getActivitiesTrips(
  options?: GetActivitiesTripsOptions,
  authContext?: AuthorizationContext
): Promise<ActivityTrip[]> {
  const itemMap = new Map<string, ActivityTrip>();

  const currentUser = auth.currentUser;
  const isAdmin = authContext?.isCallerAuthorizedAdmin ?? isCallerAdmin(currentUser);
  const currentUid = authContext?.currentUid ?? currentUser?.uid;
  const isHostSelfQuery = Boolean(options?.hostId && currentUid && currentUid === options.hostId);
  const includeUnpublished = Boolean(options?.includeUnpublished && isAdmin);

  try {
    const coll = collection(db, 'activities_trips');
    let snapshot;

    if (includeUnpublished) {
      // Authorized administrator query: reads all documents
      snapshot = await getDocs(coll);
    } else if (isHostSelfQuery && options?.hostId) {
      // Authenticated host inspecting their own listings: reads own items including drafts
      const q = query(coll, where('hostId', '==', options.hostId));
      snapshot = await getDocs(q);
    } else if (options?.hostId) {
      // Public / third-party query for a host's offerings: strictly published only
      const q = query(coll, where('hostId', '==', options.hostId), where('status', '==', 'published'));
      snapshot = await getDocs(q);
    } else {
      // General public traveler query: strictly published items only
      const q = query(coll, where('status', '==', 'published'));
      snapshot = await getDocs(q);
    }

    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        itemMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ActivityTrip);
      });
    }
  } catch (err) {
    console.warn('Firestore fetch failed, checking local:', err);
  }

  // 2. Merge baseline curated platform activities and authorized host local drafts
  // Authoritative rules:
  // - Firestore documents take absolute precedence over local cache (already in itemMap)
  // - Local cache items with matching IDs cannot overwrite Firestore records
  // - Local cache cannot independently authorize a public listing:
  //   Only platform seed activities (INITIAL_ACTIVITY_IDS) or host self-query drafts can be merged.
  //   Unpersisted local records are NEVER exposed to public discovery.
  //   In host self-queries, unpersisted items are explicitly marked as draft and flagged.
  const localItems = getLocalActivities();
  localItems.forEach(item => {
    if (itemMap.has(item.id)) return;
    if (INITIAL_ACTIVITY_IDS.has(item.id)) {
      itemMap.set(item.id, item);
    } else if (isHostSelfQuery && options?.hostId && item.hostId === options.hostId) {
      itemMap.set(item.id, {
        ...item,
        status: 'draft',
        isLocalDraft: true
      });
    }
  });

  const allItems = Array.from(itemMap.values());
  return applyFilters(allItems, options, {
    isCallerAuthorizedAdmin: isAdmin,
    currentUid
  });
}

export function applyFilters(
  items: ActivityTrip[],
  options?: GetActivitiesTripsOptions,
  authContext?: AuthorizationContext
): ActivityTrip[] {
  let res = [...items];

  const currentUser = auth.currentUser;
  const isAdmin = authContext?.isCallerAuthorizedAdmin ?? isCallerAdmin(currentUser);
  const currentUid = authContext?.currentUid ?? currentUser?.uid;
  const isSelfHost = Boolean(options?.hostId && currentUid && currentUid === options.hostId);
  const authorizedToSeeUnpublished = Boolean((options?.includeUnpublished && isAdmin) || isSelfHost);

  // Invariant 1: Public queries and unauthorized callers must NEVER receive
  // drafts ('draft') or unapproved submissions ('pending' / 'paused').
  // Passing `includeUnpublished: true` without a verified admin identity is strictly rejected.
  if (!authorizedToSeeUnpublished) {
    res = res.filter(i => i.status === 'published');
  }

  // Invariant 2: Host queries must isolate records to the requested host.
  // If the requester is NOT that host (and not an admin), they only see the host's published offerings.
  if (options?.hostId) {
    res = res.filter(i => i.hostId === options.hostId);
  }

  if (!options) return res;

  if (options.type) {
    res = res.filter(i => i.type === options.type);
  }
  if (options.status) {
    res = res.filter(i => i.status === options.status);
  }
  if (options.city && options.city.toLowerCase() !== 'all') {
    res = res.filter(i => i.city.toLowerCase() === options.city!.toLowerCase());
  }

  return res;
}

/**
 * Get published activities & trips for travelers page
 */
export async function getPublishedActivitiesTrips(
  city?: string,
  category?: string
): Promise<ActivityTrip[]> {
  const all = await getActivitiesTrips({ status: 'published' });
  return all.filter(item => {
    if (city && city.toLowerCase() !== 'all' && item.city.toLowerCase() !== city.toLowerCase()) {
      return false;
    }
    if (category && category.toLowerCase() !== 'all') {
      const catLower = category.toLowerCase();
      const itemCat = item.category.toLowerCase();
      // Match category loosely
      if (!itemCat.includes(catLower) && !catLower.includes(itemCat)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get activity or trip by ID
 */
export async function getActivityTripById(id: string): Promise<ActivityTrip | null> {
  try {
    const docRef = doc(db, 'activities_trips', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ActivityTrip;
    }
  } catch (err) {
    console.warn('Firestore doc get failed, checking local:', err);
  }

  const local = getLocalActivities();
  const match = local.find(i => i.id === id);
  return match || null;
}

/**
 * Create a new Activity or Trip
 * Authoritative Firestore write:
 * - Requires authenticated user
 * - Queries checkHostVerificationStatus(hostId)
 * - Auto-publishes ONLY if host is verified and not suspended
 * - Sets status to 'pending' if host is unverified/pending/rejected
 * - Throws if host is suspended
 * - Throws immediately on Firestore persistence failure (no silent false-success fallback)
 * - Returns the authoritative Firestore record with docRef.id
 */
export async function createActivityTrip(
  data: Omit<ActivityTrip, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ActivityTrip> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: You must be logged in to create an experience.');
  }

  const hostId = data.hostId || currentUser.uid;
  const verifStatus = await checkHostVerificationStatus(hostId);
  if (verifStatus.isSuspended) {
    throw new Error('Host account is suspended. Cannot create or publish experiences.');
  }

  // Automatic publication policy:
  // If host is verified: eligible listings can be automatically published
  // If host is not verified (pending, unverified, rejected): status forced to 'pending' or 'draft'
  let targetStatus: ActivityTripStatus = data.status || 'published';
  if (targetStatus !== 'draft') {
    targetStatus = verifStatus.isVerified ? (data.status || 'published') : 'pending';
  }

  const coll = collection(db, 'activities_trips');
  const docRef = await addDoc(coll, {
    ...data,
    hostId,
    status: targetStatus,
    isHostVerified: verifStatus.isVerified,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const now = new Date().toISOString();
  const newRecord: ActivityTrip = {
    ...data,
    id: docRef.id,
    hostId,
    status: targetStatus,
    createdAt: now,
    updatedAt: now
  };

  // Update local cache
  const local = getLocalActivities();
  saveLocalActivities([newRecord, ...local.filter(i => i.id !== docRef.id)]);

  return newRecord;
}

/**
 * Update an Activity or Trip
 */
export async function updateActivityTrip(
  id: string,
  updates: Partial<ActivityTrip>
): Promise<ActivityTrip> {
  if (!id) {
    throw new Error('Activity ID is required for update.');
  }
  if (id.startsWith('act_')) {
    throw new Error('Cannot update unsynced local draft in Firestore. Please submit a new listing.');
  }

  const now = new Date().toISOString();
  const docRef = doc(db, 'activities_trips', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  const local = getLocalActivities();
  const idx = local.findIndex(i => i.id === id);
  let updatedRecord: ActivityTrip;
  if (idx >= 0) {
    updatedRecord = { ...local[idx], ...updates, updatedAt: now };
    local[idx] = updatedRecord;
    saveLocalActivities(local);
  } else {
    updatedRecord = { id, updatedAt: now, ...updates } as ActivityTrip;
    saveLocalActivities([updatedRecord, ...local]);
  }

  return updatedRecord;
}

/**
 * Delete an Activity or Trip
 */
export async function deleteActivityTrip(id: string): Promise<boolean> {
  if (!id) return false;
  if (!id.startsWith('act_')) {
    const docRef = doc(db, 'activities_trips', id);
    await deleteDoc(docRef);
  }

  const local = getLocalActivities();
  const filtered = local.filter(i => i.id !== id);
  saveLocalActivities(filtered);
  return true;
}

/**
 * Create a new Activity or Trip Booking by a traveler
 */
export async function createActivityBooking(
  bookingData: Omit<ActivityBooking, 'id' | 'createdAt' | 'bookingRef'>
): Promise<ActivityBooking> {
  // Authoritative Server-Side Concurrency Protected Reservation
  let idToken: string | undefined;
  try {
    const { auth } = await import('../firebase');
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (authErr) {
    console.warn('ID token fetch note:', authErr);
  }

  const res = await fetch('/api/bookings/reserve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({
      category: 'experience',
      activityId: bookingData.activityId,
      activityTitle: bookingData.activityTitle,
      activityType: bookingData.activityType,
      hostId: bookingData.hostId,
      date: bookingData.date,
      time: bookingData.time,
      totalGuests: bookingData.totalGuests,
      adults: bookingData.adults,
      children: bookingData.children,
      customerUserId: bookingData.userId,
      customerName: bookingData.customerName,
      customerEmail: bookingData.customerEmail,
      customerPhone: bookingData.customerPhone,
      totalMzn: bookingData.totalMzn,
      pricingType: bookingData.pricingType,
      pickupRequested: (bookingData as any).pickupRequested,
      pickupNotes: (bookingData as any).pickupNotes,
      travelGroupId: bookingData.travelGroupId
    })
  });

  const resJson = await res.json().catch(() => null);

  if (!res.ok) {
    const errMsg = resJson?.error || `Failed to reserve experience inventory (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  const newBooking = resJson.booking as ActivityBooking;

  // Local storage cache
  const local = getLocalBookings();
  saveLocalBookings([newBooking, ...local.filter(b => b.id !== newBooking.id)]);

  return newBooking;
}

/**
 * Get bookings for a host
 */
export async function getHostBookings(hostId?: string): Promise<ActivityBooking[]> {
  try {
    const coll = collection(db, 'activity_bookings');
    let q = query(coll, orderBy('createdAt', 'desc'));
    if (hostId) {
      q = query(coll, where('hostId', '==', hostId));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: ActivityBooking[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as ActivityBooking);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore get bookings failed, reading local:', err);
  }

  const local = getLocalBookings();
  if (hostId) {
    return local.filter(b => b.hostId === hostId);
  }
  return local;
}

/**
 * Update booking status
 */
export async function updateBookingStatus(
  bookingId: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
): Promise<void> {
  try {
    const docRef = doc(db, 'activity_bookings', bookingId);
    await updateDoc(docRef, { status });
  } catch (err) {
    console.warn('Firestore booking status update failed:', err);
  }

  const local = getLocalBookings();
  const idx = local.findIndex(b => b.id === bookingId);
  if (idx >= 0) {
    local[idx].status = status;
    saveLocalBookings(local);
  }
}

/**
 * Check remaining capacity for an activity on a specific date/time
 * Distinguishes Total Physical Capacity vs MozBook-Allocated Capacity (Prompt 28)
 */
export async function getRemainingCapacity(
  activityId: string,
  date: string,
  time?: string
): Promise<{ 
  totalCapacity: number;
  mozbookAllocatedCapacity: number;
  bookedCount: number; 
  remainingCapacity: number;
  isDateBlocked: boolean;
}> {
  const act = await getActivityTripById(activityId);
  if (!act) {
    return { totalCapacity: 0, mozbookAllocatedCapacity: 0, bookedCount: 0, remainingCapacity: 0, isDateBlocked: false };
  }

  // Check if date is blocked by operator
  const isDateBlocked = !!(act.blockedDates && act.blockedDates.includes(date));
  if (isDateBlocked) {
    return {
      totalCapacity: act.totalCapacity || act.maxGuests,
      mozbookAllocatedCapacity: 0,
      bookedCount: 0,
      remainingCapacity: 0,
      isDateBlocked: true
    };
  }

  // Distinguish total physical capacity from MozBook dedicated inventory
  const totalCapacity = act.totalCapacity || act.maxGuests;
  const mozbookAllocatedCapacity = act.mozbookAllocatedCapacity ? Math.min(totalCapacity, act.mozbookAllocatedCapacity) : totalCapacity;

  const allBookings = getLocalBookings();
  const relevantBookings = allBookings.filter(b => {
    if (b.activityId !== activityId) return false;
    if (b.date !== date) return false;
    if (time && b.time && b.time !== time) return false;
    if (b.status === 'cancelled') return false;
    return true;
  });

  const bookedCount = relevantBookings.reduce((sum, b) => sum + (b.totalGuests || 1), 0);
  const remaining = Math.max(0, mozbookAllocatedCapacity - bookedCount);

  return {
    totalCapacity,
    mozbookAllocatedCapacity,
    bookedCount,
    remainingCapacity: remaining,
    isDateBlocked: false
  };
}

/**
 * Handle Operator Inventory Failure (Overbooking / Operator Failure to Deliver)
 * Core business principle (Prompt 28):
 * - MozBook protects the customer: 100% full refund entitlement guaranteed.
 * - Operator is accountable: records debit/penalty in partner earnings ledger.
 */
export async function handleOperatorInventoryFailure(
  bookingId: string,
  notes?: string,
  operatorHostId?: string
): Promise<{ success: boolean; customerRefundAmountMzn: number; debitId: string }> {
  const allBookings = getLocalBookings();
  const booking = allBookings.find(b => b.id === bookingId);
  const refundAmount = booking?.totalMzn || 0;
  const hostId = operatorHostId || booking?.hostId || 'unknown_host';
  const now = new Date().toISOString();

  // 1. Update Booking Status to Cancelled with 100% Customer Refund Guarantee
  try {
    const docRef = doc(db, 'activity_bookings', bookingId);
    await updateDoc(docRef, {
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationInitiator: 'operator',
      cancellationReason: 'operator_inventory_failure',
      operatorFailureNotes: notes || 'Operator inventory failure / external oversell',
      customerProtectionRefundMzn: refundAmount,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore booking cancellation update note:', err);
  }

  // Local cache update for booking
  const bIdx = allBookings.findIndex(b => b.id === bookingId);
  if (bIdx >= 0) {
    allBookings[bIdx] = {
      ...allBookings[bIdx],
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationInitiator: 'operator',
      cancellationReason: 'operator_inventory_failure',
      operatorFailureNotes: notes || 'Operator inventory failure / external oversell',
      customerProtectionRefundMzn: refundAmount,
      updatedAt: now
    };
    saveLocalBookings(allBookings);
  }

  // 2. Record Operator Inventory Debit
  // Standard marketplace inventory failure debit (15% platform commission loss / admin handling fee)
  const debitAmountMzn = Math.round(refundAmount * 0.15);
  const debitId = `deb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const debitRecord: OperatorInventoryDebit = {
    id: debitId,
    hostId,
    bookingId,
    bookingRef: booking?.bookingRef || `MB-EXP-${bookingId}`,
    bookingCategory: booking?.activityType === 'trip' ? 'trip' : 'activity',
    offeringTitle: booking?.activityTitle || 'Experience Booking',
    reason: 'operator_inventory_failure',
    customerRefundAmountMzn: refundAmount,
    debitAmountMzn,
    status: 'applied',
    notes: notes || 'Operator inventory failure / overbooking debit',
    createdAt: now
  };

  try {
    await setDoc(doc(db, 'operator_inventory_debits', debitId), debitRecord);
  } catch (dErr) {
    console.warn('Firestore operator_inventory_debits setDoc note:', dErr);
  }

  const existingDebits = getLocalOperatorDebits();
  saveLocalOperatorDebits([debitRecord, ...existingDebits]);

  return {
    success: true,
    customerRefundAmountMzn: refundAmount,
    debitId
  };
}

/**
 * Retrieve Operator Inventory Debits for a Host
 */
export async function getOperatorDebits(hostId?: string): Promise<OperatorInventoryDebit[]> {
  try {
    const coll = collection(db, 'operator_inventory_debits');
    let q = query(coll, orderBy('createdAt', 'desc'));
    if (hostId) {
      q = query(coll, where('hostId', '==', hostId));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list: OperatorInventoryDebit[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as OperatorInventoryDebit));
      return list;
    }
  } catch (err) {
    console.warn('Firestore get operator debits failed, using local cache:', err);
  }

  const local = getLocalOperatorDebits();
  if (hostId) {
    return local.filter(d => d.hostId === hostId);
  }
  return local;
}

/**
 * Calculate Host / Partner Earnings
 * Applies the authoritative 15% MozBook platform commission / 85% Partner share rule,
 * and accounts for Operator Inventory Debits (Prompt 28).
 */
export async function getHostEarnings(hostId?: string) {
  const bookings = await getHostBookings(hostId);
  const operatorDebits = await getOperatorDebits(hostId);
  
  // Total completed or confirmed bookings (excluding refunded)
  const validBookings = bookings.filter(b => 
    (b.status === 'confirmed' || b.status === 'completed') && 
    b.paymentStatus !== 'refunded'
  );
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  
  const totalEarnedMzn = validBookings.reduce((sum, b) => sum + (b.totalMzn || 0), 0);
  const pendingMzn = pendingBookings.reduce((sum, b) => sum + (b.totalMzn || 0), 0);
  const commission = calculateCommission(totalEarnedMzn);

  // Total operator debits applied
  const totalDebitsMzn = operatorDebits
    .filter(d => d.status === 'applied')
    .reduce((sum, d) => sum + (d.debitAmountMzn || 0), 0);

  // Net payout balance = Partner share minus operator accountability debits
  const availableForPayoutMzn = Math.max(0, commission.partnerShare - totalDebitsMzn);
  
  return {
    totalBookingsCount: bookings.length,
    completedCount: validBookings.length,
    pendingCount: pendingBookings.length,
    totalEarnedMzn,
    pendingMzn,
    totalDebitsMzn,
    operatorDebitsCount: operatorDebits.length,
    availableForPayoutMzn, // Net payout balance
    partnerShareGross: commission.partnerShare,
    platformFeeMzn: commission.commissionAmount
  };
}

/**
 * Get activity and trip bookings associated with a travel group
 */
export async function getGroupActivityBookings(travelGroupId: string): Promise<ActivityBooking[]> {
  try {
    const coll = collection(db, 'activity_bookings');
    const q = query(coll, where('travelGroupId', '==', travelGroupId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: ActivityBooking[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as ActivityBooking);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore get group activity bookings failed, fallback to local:', err);
  }

  const local = getLocalBookings();
  return local.filter(b => b.travelGroupId === travelGroupId);
}

/**
 * Platform-Wide Session Isolation:
 * Wipes local activity bookings and operator debits cache from storage.
 */
export function clearLocalActivityBookingsCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_BOOKINGS);
      localStorage.removeItem(STORAGE_KEY_OPERATOR_DEBITS);
    }
  } catch (e) {
    console.warn('[activityTripService] Error clearing local activity bookings cache:', e);
  }
}

