import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc,
  setDoc,
  deleteDoc,
  query, 
  where, 
  serverTimestamp,
  onSnapshot,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  CanonicalAccommodationTypeId,
  OperatingModelId,
  SettingId,
  UnitTypeId,
  ClassificationStatus,
  LegacyResidenceType
} from '../data/canonicalAccommodationTaxonomy';

export type { CanonicalAccommodationTypeId, OperatingModelId, SettingId, UnitTypeId, ClassificationStatus };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type ResidenceType = 
  | 'lodge' 
  | 'beachfront residence' 
  | 'apartment home residence' 
  | 'outdoor residence'
  | 'normal residence'
  | 'city residence'
  | 'country residence'
  | 'studio apartment';

export type OfferType = 'percentage' | 'fixed' | 'seasonal';
export type OfferStatus = 'scheduled' | 'active' | 'expired';
export type RecurrenceStatus = 'none' | 'pending_review' | 'confirmed' | 'declined';

export interface SpecialOffer {
  id?: string;
  listingId?: string;
  hostId?: string;
  enabled: boolean;
  offerType: OfferType;
  discountPercent?: number;
  discountAmount?: number;
  specialPrice: number;
  originalPrice: number;
  offerName?: string;
  startDate: string;
  endDate: string;
  isSeasonal?: boolean;
  seasonalTag?: string;
  customSeasonName?: string;
  createdAt?: any;
  updatedAt?: any;
  annualRecurrenceEnabled?: boolean;
  recurrenceStatus?: RecurrenceStatus;
  targetYear?: number;
  lastReviewPromptDate?: string;
  lastConfirmedAt?: string;
  declinedYears?: number[];
}

export function getOfferStatus(startDate?: string, endDate?: string): OfferStatus {
  if (!startDate || !endDate) return 'expired';
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'active';
}

export function isOfferActive(offer?: SpecialOffer | null): boolean {
  if (!offer || !offer.enabled) return false;
  return getOfferStatus(offer.startDate, offer.endDate) === 'active';
}

export function formatOfferDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `Valid from ${startDate} to ${endDate}`;
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `Valid from ${s.toLocaleDateString('en-GB', options)} to ${e.toLocaleDateString('en-GB', options)}`;
}

export function getEffectivePrice(listing: { price: number; specialOffer?: SpecialOffer | null }): {
  currentPrice: number;
  originalPrice: number;
  hasActiveOffer: boolean;
  discountPercent?: number;
  offerName?: string;
  seasonalTag?: string;
} {
  const offer = listing.specialOffer;
  if (isOfferActive(offer) && offer && offer.specialPrice > 0 && offer.specialPrice < listing.price) {
    const calculatedDiscount = offer.discountPercent || Math.max(1, Math.round(((listing.price - offer.specialPrice) / listing.price) * 100));
    return {
      currentPrice: offer.specialPrice,
      originalPrice: listing.price,
      hasActiveOffer: true,
      discountPercent: calculatedDiscount,
      offerName: offer.offerName,
      seasonalTag: offer.isSeasonal ? (offer.customSeasonName || offer.seasonalTag) : undefined
    };
  }
  return {
    currentPrice: listing.price,
    originalPrice: listing.price,
    hasActiveOffer: false
  };
}

export interface NearbyPlace {
  id?: string;
  name: string;
  category: 'restaurant' | 'activity' | 'nature' | 'culture' | 'shopping' | 'other' | string;
  distance?: string;
  description?: string;
  addedByHost?: boolean;
}

export interface LabeledImage {
  url: string;
  label?: string;
}

export interface LodgeAccommodation {
  id: string;
  listingId?: string;
  name: string;
  customName?: string;
  canonicalUnitType?: UnitTypeId;
  units: number;
  adults: number;
  children: number;
  maxGuests: number;
  price: number;
  currency?: string;
  description?: string;
  amenities: string[];
  photos: string[];
  active: boolean;
  specialOffer?: SpecialOffer | null;
  createdAt?: string;
}

// Generalized Accommodation Unit type alias (Stage 3E)
export type AccommodationUnit = LodgeAccommodation;

export function calculateTotalLodgeUnits(accommodations?: LodgeAccommodation[]): number {
  if (!accommodations || accommodations.length === 0) return 0;
  return accommodations
    .filter(a => a.active !== false)
    .reduce((sum, a) => sum + (Number(a.units) || 0), 0);
}

export const calculateTotalUnits = calculateTotalLodgeUnits;

export const MOZAMBIQUE_PROVINCES = [
  'Maputo Cidade',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa'
];

export interface PhysicalAddress {
  country: string;
  province: string;
  city: string;
  neighborhood?: string;
  street?: string;
  buildingNumber?: string;
  buildingName?: string;
  postalCode?: string;
  directionsLandmark?: string;
}

export function formatPhysicalAddress(addr?: Partial<PhysicalAddress> | null): string {
  if (!addr) return '';
  const parts: string[] = [];
  if (addr.buildingName) parts.push(addr.buildingName);
  const streetPart = [addr.street, addr.buildingNumber].filter(Boolean).join(', ');
  if (streetPart) parts.push(streetPart);
  if (addr.neighborhood) parts.push(`Bairro ${addr.neighborhood}`);
  if (addr.city) parts.push(addr.city);
  if (addr.province && (!addr.city || !addr.province.toLowerCase().includes(addr.city.toLowerCase()))) {
    parts.push(addr.province);
  }
  if (addr.country) parts.push(addr.country);
  return parts.join(', ');
}

export interface Listing {
  id?: string;
  title: string;
  description: string;
  location: string;
  residenceType?: ResidenceType;
  price: number;
  minNights?: number;
  maxGuests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  rating: number;
  images: string[];
  labeledImages?: LabeledImage[];
  amenities?: string[];
  hostId: string;
  hostName?: string;
  hostPhoto?: string;
  isHostVerified?: boolean;
  category?: string;
  city?: string;
  province?: string;
  country?: string;
  neighborhood?: string;
  street?: string;
  buildingNumber?: string;
  buildingName?: string;
  postalCode?: string;
  directionsLandmark?: string;
  addressDetails?: PhysicalAddress;
  locationType?: 'gps' | 'address' | 'both';
  hasGpsLocation?: boolean;
  hasPhysicalAddress?: boolean;
  pinSource?: 'gps' | 'map_pin' | 'search' | 'default';
  availableFrom?: string;
  availableTo?: string;
  dates?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  nearbyPlaces?: NearbyPlace[];
  specialOffer?: SpecialOffer | null;
  accommodations?: LodgeAccommodation[];
  totalLodgeUnits?: number;
  isMultiUnit?: boolean;
  // MozBook Inventory Allocation & Availability (Prompt 28)
  mozbookAllocatedUnits?: number;
  blockedDates?: string[];
  // Marketplace Cancellation Policy (Stage 4A)
  cancellationTier?: import('../types/cancellationPolicy').CancellationTierId;
  isNonRefundable?: boolean;
  // Canonical Accommodation Taxonomy (Stage 3C - Optional & Additive)
  canonicalType?: CanonicalAccommodationTypeId;
  canonicalCategory?: string;
  operatingModels?: OperatingModelId[];
  settings?: SettingId[];
  classificationStatus?: ClassificationStatus;
  status?: 'published' | 'pending' | 'pending_approval' | 'pending_verification' | 'draft' | 'archived' | 'paused' | 'suspended' | 'rejected';
  isLocalDraft?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'listings';
const COMMUNITY_COLLECTION = 'community_places';
const VERIFICATIONS_COLLECTION = 'verifications';

export const getListings = async (category?: string, options?: { includeUnpublished?: boolean }) => {
  const path = COLLECTION;
  try {
    const constraints: any[] = [];
    if (!options?.includeUnpublished) {
      constraints.push(where('status', '==', 'published'));
    }
    if (category) {
      constraints.push(where('category', '==', category));
    }
    
    const q = constraints.length > 0
      ? query(collection(db, path), ...constraints)
      : collection(db, path);
    
    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
    if (!options?.includeUnpublished) {
      items = items.filter(l => l.status === 'published');
    }
    return items;
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
      console.warn('Listing read permission denied, returning empty list.');
      return [];
    }
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

/**
 * Retrieves all property listings owned by a specific host/partner
 */
export const getHostListings = async (hostId: string): Promise<Listing[]> => {
  const path = COLLECTION;
  try {
    const q = query(collection(db, path), where('hostId', '==', hostId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
  } catch (error) {
    console.error('Error fetching host listings:', error);
    return [];
  }
};

export const getListingById = async (id: string) => {
  const path = `${COLLECTION}/${id}`;
  try {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as Listing;
    }
    return null;
  } catch (error: any) {
    // If permission denied (e.g. unpublished listing accessed without owner/admin authorization), return null gracefully
    if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied') || error?.message?.includes('Missing or insufficient permissions')) {
      console.warn(`Listing ${id} read permission denied.`);
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

/**
 * Recursively sanitizes a Firestore payload by omitting fields whose values are undefined.
 * Preserves null, 0, false, empty strings, arrays, Dates, and Firestore FieldValues (such as serverTimestamp()).
 */
export function sanitizeFirestorePayload<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  // Check if it's a plain object (vs. Date, Timestamp, FieldValue, etc.)
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      result[key] = sanitizeFirestorePayload(val);
    }
  }
  return result as T;
}

export interface HostVerificationStatusInfo {
  isVerified: boolean;
  isSuspended: boolean;
  status: 'verified' | 'pending' | 'rejected' | 'suspended' | 'unverified';
}

export async function checkHostVerificationStatus(userId: string): Promise<HostVerificationStatusInfo> {
  if (!userId) {
    return { isVerified: false, isSuspended: false, status: 'unverified' };
  }
  try {
    let verificationStatus: string | undefined;
    let isSuspended = false;

    // 1. Authoritative check in users collection
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const udata = userSnap.data();
      if (udata.accountStatus === 'suspended' || udata.verificationStatus === 'suspended' || udata.isSuspended === true) {
        return { isVerified: false, isSuspended: true, status: 'suspended' };
      }
      if (udata.verificationStatus) {
        verificationStatus = udata.verificationStatus;
      }
    }

    // 2. Authoritative check in verifications collection
    if (verificationStatus !== 'verified') {
      const vq = query(collection(db, VERIFICATIONS_COLLECTION), where('userId', '==', userId));
      const vsnap = await getDocs(vq);
      if (!vsnap.empty) {
        const sorted = vsnap.docs
          .map(d => d.data())
          .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        const latest = sorted[0];
        if (latest.status === 'suspended') {
          return { isVerified: false, isSuspended: true, status: 'suspended' };
        }
        if (latest.status === 'verified') {
          verificationStatus = 'verified';
        } else if (!verificationStatus && latest.status) {
          verificationStatus = latest.status;
        }
      }
    }

    const finalStatus = (verificationStatus as any) || 'unverified';
    return {
      isVerified: finalStatus === 'verified',
      isSuspended: finalStatus === 'suspended' || isSuspended,
      status: finalStatus
    };
  } catch (err) {
    console.warn('Error checking host verification status:', err);
    return { isVerified: false, isSuspended: false, status: 'unverified' };
  }
}

export const createListing = async (listing: Omit<Listing, 'id' | 'createdAt'>) => {
  const path = COLLECTION;
  try {
    const hostId = listing.hostId || auth.currentUser?.uid;
    let targetStatus = listing.status || 'published';
    let isHostVerified = Boolean(listing.isHostVerified);

    const hasPhotos = (Array.isArray(listing.images) && listing.images.length > 0) ||
                      (Array.isArray(listing.labeledImages) && listing.labeledImages.length > 0);
    const isComplete = Boolean(
      listing.title?.trim() &&
      (listing.location?.trim() || listing.city?.trim()) &&
      typeof listing.price === 'number' && listing.price > 0 &&
      hasPhotos
    );

    if (hostId) {
      const statusInfo = await checkHostVerificationStatus(hostId);
      if (statusInfo.isSuspended) {
        throw new Error('Host account is suspended. Cannot create or publish listings.');
      }
      isHostVerified = statusInfo.isVerified;
      if (!isHostVerified) {
        // While waiting for verification, listing is saved as pending (if complete) or draft (if incomplete)
        targetStatus = (targetStatus === 'draft' || !isComplete) ? 'draft' : 'pending';
      } else {
        targetStatus = (targetStatus === 'draft' || !isComplete) ? 'draft' : (listing.status || 'published');
      }
    }

    const payload = sanitizeFirestorePayload({
      ...listing,
      hostId: hostId || listing.hostId,
      status: targetStatus,
      isHostVerified,
      createdAt: serverTimestamp(),
    });
    const docRef = await addDoc(collection(db, path), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const updateListing = async (id: string, updates: Partial<Listing>) => {
  const path = `${COLLECTION}/${id}`;
  try {
    // If attempting to publish, enforce that host is verified
    if (updates.status === 'published') {
      const hostId = updates.hostId || auth.currentUser?.uid;
      if (hostId) {
        const statusInfo = await checkHostVerificationStatus(hostId);
        if (!statusInfo.isVerified) {
          updates.status = 'pending';
        }
      }
    }

    const payload = sanitizeFirestorePayload({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, COLLECTION, id), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

const SPECIAL_OFFERS_COLLECTION = 'special_offers';

export const saveListingSpecialOffer = async (listingId: string, offer: SpecialOffer) => {
  const path = SPECIAL_OFFERS_COLLECTION;
  try {
    // 1. Store promotional information separately in special_offers collection
    const offerDocId = `offer_${listingId}`;
    const sanitizedOfferDoc = sanitizeFirestorePayload({
      ...offer,
      listingId,
      hostId: auth.currentUser?.uid || offer.hostId || 'unknown_host',
      updatedAt: serverTimestamp(),
      createdAt: offer.createdAt || serverTimestamp(),
    });
    await setDoc(doc(db, SPECIAL_OFFERS_COLLECTION, offerDocId), sanitizedOfferDoc, { merge: true });

    // 2. Also keep synced on listing for immediate reactive display
    const sanitizedListingOffer = sanitizeFirestorePayload({
      specialOffer: {
        ...offer,
        listingId,
      },
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, COLLECTION, listingId), sanitizedListingOffer);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

export const removeListingSpecialOffer = async (listingId: string) => {
  const path = `${COLLECTION}/${listingId}`;
  try {
    // Disable on listing without deleting listing
    await updateDoc(doc(db, COLLECTION, listingId), {
      specialOffer: null,
      updatedAt: serverTimestamp(),
    });

    // Mark as disabled in standalone collection
    const offerDocId = `offer_${listingId}`;
    try {
      await updateDoc(doc(db, SPECIAL_OFFERS_COLLECTION, offerDocId), {
        enabled: false,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      // Document might not exist
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
  }
};

export const getListingSpecialOffer = async (listingId: string): Promise<SpecialOffer | null> => {
  const path = `${SPECIAL_OFFERS_COLLECTION}/offer_${listingId}`;
  try {
    const docRef = doc(db, SPECIAL_OFFERS_COLLECTION, `offer_${listingId}`);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as SpecialOffer;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const subscribeToListings = (
  callback: (listings: Listing[]) => void,
  options?: { includeUnpublished?: boolean }
) => {
  const path = COLLECTION;
  const constraints: any[] = [];
  if (!options?.includeUnpublished) {
    constraints.push(where('status', '==', 'published'));
  }
  const q = constraints.length > 0
    ? query(collection(db, path), ...constraints)
    : collection(db, path);

  return onSnapshot(q, (snapshot) => {
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
    if (!options?.includeUnpublished) {
      listings = listings.filter(l => l.status === 'published');
    }
    callback(listings);
  }, (error: any) => {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
      console.warn('Subscription permission denied, returning empty list.');
      callback([]);
      return;
    }
    handleFirestoreError(error, OperationType.GET, path);
  });
};

// -------------------------------------------------------------
// Community Nearby Places
// -------------------------------------------------------------

export interface CommunityPlaceRecord {
  id?: string;
  name: string;
  category: string;
  city: string;
  province?: string;
  distance?: string;
  description?: string;
  addedBy?: string;
  createdAt?: any;
}

export const addCommunityPlace = async (place: {
  name: string;
  category: string;
  city: string;
  province?: string;
  distance?: string;
  description?: string;
}) => {
  const path = COMMUNITY_COLLECTION;
  try {
    const payload = sanitizeFirestorePayload({
      ...place,
      addedBy: auth.currentUser?.uid || 'guest_host',
      createdAt: serverTimestamp(),
    });
    const docRef = await addDoc(collection(db, path), payload);
    return docRef.id;
  } catch (error) {
    console.warn('Could not save to community_places in firestore:', error);
    return null;
  }
};

// Smart suggestions for "What's nearby?":
// Queries places added to community_places collection + places from other listings
export const getSuggestedNearbyPlaces = async (
  city?: string, 
  province?: string, 
  coords?: { lat: number; lng: number }
): Promise<NearbyPlace[]> => {
  const suggestions: Map<string, NearbyPlace> = new Map();
  const normCity = city?.trim().toLowerCase();
  const normProv = province?.trim().toLowerCase();

  // 1. Fetch from crowdsourced community_places collection
  try {
    const commSnap = await getDocs(collection(db, COMMUNITY_COLLECTION));
    commSnap.docs.forEach(doc => {
      const data = doc.data() as CommunityPlaceRecord;
      const matchCity = !normCity || data.city?.toLowerCase().includes(normCity);
      const matchProv = !normProv || data.province?.toLowerCase().includes(normProv);
      if (matchCity || matchProv) {
        suggestions.set(data.name.toLowerCase().trim(), {
          id: doc.id,
          name: data.name,
          category: data.category,
          distance: data.distance,
          description: data.description,
          addedByHost: true
        });
      }
    });
  } catch (e) {
    console.warn('Could not fetch community_places:', e);
  }

  // 2. Fetch existing listings to aggregate community nearby places (only published listings are visible to public)
  try {
    const snapshot = await getDocs(query(collection(db, COLLECTION), where('status', '==', 'published')));
    const allListings = snapshot.docs.map(d => d.data() as Listing);

    for (const listing of allListings) {
      if (!listing.nearbyPlaces || !Array.isArray(listing.nearbyPlaces)) continue;

      const isSameCity = normCity && listing.city?.toLowerCase().includes(normCity);
      const isSameProv = normProv && listing.province?.toLowerCase().includes(normProv);
      
      let isNearGps = false;
      if (coords && listing.coordinates) {
        const dLat = Math.abs(coords.lat - listing.coordinates.lat);
        const dLng = Math.abs(coords.lng - listing.coordinates.lng);
        if (dLat < 0.4 && dLng < 0.4) {
          isNearGps = true;
        }
      }

      if (isSameCity || isSameProv || isNearGps) {
        for (const place of listing.nearbyPlaces) {
          if (place.name && !suggestions.has(place.name.toLowerCase().trim())) {
            suggestions.set(place.name.toLowerCase().trim(), {
              ...place,
              addedByHost: true
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not fetch remote suggestions, using regional defaults", err);
  }

  // 3. Fallback Mozambican / regional verified recommendations if list is small
  const defaults: NearbyPlace[] = [
    {
      name: "Dhow Maputo Waterfront & Sunset Lounge",
      category: "restaurant",
      distance: "6 min drive",
      description: "Picturesque bay views, fresh grilled seafood, cocktails and Mediterranean-Mozambican dishes."
    },
    {
      name: "Tofo Ocean Snorkel & Whale Shark Safari",
      category: "activity",
      distance: "10 min walk",
      description: "World-famous marine biodiversity safaris, manta rays and crystal clear waves."
    },
    {
      name: "Mercado Central de Maputo (Central Market)",
      category: "shopping",
      distance: "12 min walk",
      description: "Historic 1901 market featuring fresh piri-piri cashews, tropical fruit, and artisanal crafts."
    },
    {
      name: "Costa do Sol Beachfront Promenade",
      category: "nature",
      distance: "4 min walk",
      description: "Golden sand beach lined with palm trees, coastal breezes, and local seafood shacks."
    },
    {
      name: "Zambezi River Canoe & Hippo Excursion",
      category: "activity",
      distance: "15 min drive",
      description: "Guided river excursions with wildlife viewing and sunset photography."
    },
    {
      name: "Casa de Ferro (The Iron House by Gustave Eiffel)",
      category: "culture",
      distance: "8 min drive",
      description: "Pre-colonial historical landmark and cultural exhibition center."
    },
    {
      name: "Piri-Piri Seafood & Braai Grill",
      category: "restaurant",
      distance: "5 min walk",
      description: "Authentic grilled prawns, peri-peri chicken, coconut rice, and Laurentina beer."
    }
  ];

  for (const item of defaults) {
    if (!suggestions.has(item.name.toLowerCase().trim())) {
      suggestions.set(item.name.toLowerCase().trim(), item);
    }
  }

  return Array.from(suggestions.values());
};

// -------------------------------------------------------------
// Host Verification System
// -------------------------------------------------------------

export type DocType = 'national_id' | 'dire' | 'passport' | 'residence_permit';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type ExpiryStatus = 'valid' | 'expiring_soon' | 'expired';

export const GRACE_PERIOD_DAYS = 90;

export interface DocumentExpiryCalculation {
  isExpired: boolean;
  daysUntilExpiry?: number;
  expiryStatus?: ExpiryStatus;
  isSuspended: boolean;
  inGracePeriod?: boolean;
  gracePeriodDaysRemaining?: number;
  suspensionEffectiveDate?: string;
  effectiveVerificationStatus: (
    currentStatus: VerificationStatus,
    options?: { manualSuspension?: boolean; hasPendingRenewal?: boolean }
  ) => VerificationStatus;
}

/**
 * Authoritative Mozambique compliance document expiry and suspension calculator.
 * Evaluates document expiry against Mozambique CAT time (UTC+2).
 * - Distinguishes document expiry date from the date automatic suspension becomes effective.
 * - Implements the agreed 90-day post-expiry grace period (GRACE_PERIOD_DAYS = 90).
 * - During 90-day grace period: isExpired = true, inGracePeriod = true, isSuspended = false.
 * - Once 90-day grace period elapses (daysUntilExpiry < -90): isSuspended = true.
 * - Submitting renewal documents pending review does NOT avoid suspension once grace period expires.
 * - Manual safety or misconduct suspensions can NEVER be overridden or erased.
 * - 0 <= daysUntilExpiry <= 180: status is 'expiring_soon', isSuspended = false.
 * - daysUntilExpiry > 180: status is 'valid', isSuspended = false.
 */
export function calculateDocumentExpiry(expiryDateStr?: string | null, referenceDate?: Date): DocumentExpiryCalculation {
  if (!expiryDateStr || !expiryDateStr.trim()) {
    return {
      isExpired: false,
      daysUntilExpiry: undefined,
      expiryStatus: undefined,
      isSuspended: false,
      inGracePeriod: false,
      effectiveVerificationStatus: (currentStatus, options) => {
        if (currentStatus === 'suspended' || options?.manualSuspension) return 'suspended';
        return currentStatus;
      },
    };
  }

  // Mozambique CAT is UTC+2
  const ref = referenceDate || new Date();
  const utc = ref.getTime() + (ref.getTimezoneOffset() * 60000);
  const catToday = new Date(utc + (2 * 3600000));
  catToday.setHours(0, 0, 0, 0);

  const expDate = new Date(expiryDateStr);
  if (isNaN(expDate.getTime())) {
    return {
      isExpired: false,
      daysUntilExpiry: undefined,
      expiryStatus: undefined,
      isSuspended: false,
      inGracePeriod: false,
      effectiveVerificationStatus: (currentStatus, options) => {
        if (currentStatus === 'suspended' || options?.manualSuspension) return 'suspended';
        return currentStatus;
      },
    };
  }
  expDate.setHours(0, 0, 0, 0);

  const diffMs = expDate.getTime() - catToday.getTime();
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Suspension effective date is 90 days after expiry date
  const suspDate = new Date(expDate.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
  const suspensionEffectiveDate = suspDate.toISOString().split('T')[0];

  if (daysUntilExpiry < 0) {
    const inGracePeriod = daysUntilExpiry >= -GRACE_PERIOD_DAYS;
    const gracePeriodDaysRemaining = inGracePeriod ? GRACE_PERIOD_DAYS + daysUntilExpiry : 0;
    const isSuspended = !inGracePeriod;

    return {
      isExpired: true,
      daysUntilExpiry,
      expiryStatus: 'expired',
      isSuspended,
      inGracePeriod,
      gracePeriodDaysRemaining,
      suspensionEffectiveDate,
      effectiveVerificationStatus: (currentStatus, options) => {
        // Manual safety/misconduct suspension is NEVER overridden
        if (currentStatus === 'suspended' || options?.manualSuspension) {
          return 'suspended';
        }
        // If grace period elapsed, suspension is enforced even if renewal is pending review
        if (isSuspended) {
          return 'suspended';
        }
        // Within grace period: retains current status (e.g. verified), but host is in grace period
        return currentStatus;
      },
    };
  } else if (daysUntilExpiry <= 180) {
    return {
      isExpired: false,
      daysUntilExpiry,
      expiryStatus: 'expiring_soon',
      isSuspended: false,
      inGracePeriod: false,
      gracePeriodDaysRemaining: undefined,
      suspensionEffectiveDate,
      effectiveVerificationStatus: (currentStatus, options) => {
        if (currentStatus === 'suspended' || options?.manualSuspension) return 'suspended';
        return currentStatus;
      },
    };
  } else {
    return {
      isExpired: false,
      daysUntilExpiry,
      expiryStatus: 'valid',
      isSuspended: false,
      inGracePeriod: false,
      gracePeriodDaysRemaining: undefined,
      suspensionEffectiveDate,
      effectiveVerificationStatus: (currentStatus, options) => {
        if (currentStatus === 'suspended' || options?.manualSuspension) return 'suspended';
        return currentStatus;
      },
    };
  }
}

export interface ExtractedDocData {
  legalName?: string;
  docNumber?: string;
  expiryDate?: string;
  issueDate?: string;
  dateOfBirth?: string;
  nationality?: string;
  docTypeDetected?: DocType | string;
  isFrontAndBackProvided?: boolean;
  utilityAddressExtracted?: string;
  confidenceScore?: number;
  securityFeaturesDetected?: string[];
  validationNotes?: string;
  isExpired?: boolean;
  daysUntilExpiry?: number;
  expiryStatus?: ExpiryStatus;
  checkedAt?: string;
}

export interface HostVerification {
  id?: string;
  userId: string;
  userEmail: string;
  hostName: string;
  phoneNumber: string;
  docType: DocType;
  docNumber: string;
  docPhotoUrl?: string;
  docFrontPhotoUrl?: string;
  docBackPhotoUrl?: string;
  expiryDate?: string;
  issueDate?: string;
  dateOfBirth?: string;
  nationality?: string;
  isExpired?: boolean;
  daysUntilExpiry?: number;
  expiryStatus?: ExpiryStatus;
  inGracePeriod?: boolean;
  gracePeriodDaysRemaining?: number;
  suspensionEffectiveDate?: string;
  isSuspended?: boolean;
  suspensionReason?: 'safety' | 'misconduct' | 'document_expired' | string;
  utilityBillUrl?: string;
  utilityBillAddress?: string;
  status: VerificationStatus;
  adminNotes?: string;
  extractedData?: ExtractedDocData;
  expiryReminderSent?: boolean;
  expiryReminderSentAt?: any;
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

// Client helper to call backend document extraction API with Gemini
export const extractDocumentData = async (payload: {
  docType: DocType;
  frontImage: string;
  backImage?: string;
}): Promise<{ 
  success: boolean; 
  extracted?: ExtractedDocData; 
  error?: string;
  extractionStatus?: string;
  providerCreditsDepleted?: boolean;
  errorCategory?: string;
}> => {
  try {
    const res = await fetch('/api/verify/extract-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return { 
      success: Boolean(data.success && data.extracted), 
      extracted: data.extracted || undefined,
      error: data.error,
      extractionStatus: data.extractionStatus,
      providerCreditsDepleted: Boolean(data.providerCreditsDepleted),
      errorCategory: data.errorCategory || (data.providerCreditsDepleted ? 'PROVIDER_CREDITS_DEPLETED' : undefined),
    };
  } catch (e: any) {
    console.error('Error calling extractDocumentData:', e);
    return { 
      success: false, 
      error: e.message || 'Failed to extract document information',
      errorCategory: 'NETWORK_OR_SERVER_ERROR'
    };
  }
};

// Client helper to dispatch renewal reminder to host
export const sendRenewalReminder = async (payload: {
  hostName: string;
  userEmail: string;
  docType: DocType;
  expiryDate: string;
  daysUntilExpiry: number;
}): Promise<{ success: boolean; message?: string }> => {
  try {
    const token = auth.currentUser && typeof (auth.currentUser as any).getIdToken === 'function'
      ? await auth.currentUser.getIdToken().catch(() => null)
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/verify/send-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (e: any) {
    console.error('Error calling sendRenewalReminder:', e);
    return { success: false, message: e.message };
  }
};

export const submitHostVerification = async (data: Omit<HostVerification, 'id' | 'createdAt' | 'status'>) => {
  const path = VERIFICATIONS_COLLECTION;
  try {
    const payload = sanitizeFirestorePayload({
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    const docRef = await addDoc(collection(db, path), payload);

    // Also update user's verification status
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          verificationStatus: 'pending'
        });
      } catch (e) {
        // User doc may not exist yet, which is okay
      }
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const getUserVerification = async (userId: string): Promise<HostVerification | null> => {
  const path = VERIFICATIONS_COLLECTION;
  try {
    const q = query(
      collection(db, path), 
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      // Sort by newest if multiple
      const sorted = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as HostVerification))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return sorted[0];
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getAllVerifications = async (): Promise<HostVerification[]> => {
  const path = VERIFICATIONS_COLLECTION;
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HostVerification));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export interface ListingEligibilityCheck {
  eligibleForVerifiedBadge: boolean;
  eligibleForAutoPublish: boolean;
  reason?: string;
}

/**
 * Authoritative evaluation of listing eligibility for automatic publishing & verification badge.
 * Strictly preserves manual suspensions, compliance blocks, and draft incomplete states.
 */
export function evaluateListingAutoPublishEligibility(listing: Partial<Listing>): ListingEligibilityCheck {
  // 1. Basic structural validity
  const hasTitle = Boolean(listing.title && listing.title.trim().length > 0);
  const hasLocation = Boolean(listing.location && listing.location.trim().length > 0);
  const hasPrice = typeof listing.price === 'number' && listing.price > 0;
  const hasPhotos = (Array.isArray(listing.images) && listing.images.length > 0) || 
                    (Array.isArray(listing.labeledImages) && listing.labeledImages.length > 0);

  if (!hasTitle || !hasLocation || !hasPrice) {
    return {
      eligibleForVerifiedBadge: false,
      eligibleForAutoPublish: false,
      reason: 'Incomplete listing structure: missing title, location, or valid price'
    };
  }

  // 2. Explicit suspensions, safety freezes, and blocks must be strictly preserved
  const isSuspended = (listing as any).isSuspended === true || 
                      (listing as any).suspended === true || 
                      (listing as any).status === 'suspended' || 
                      (listing as any).accountStatus === 'suspended';

  if (isSuspended) {
    return {
      eligibleForVerifiedBadge: false,
      eligibleForAutoPublish: false,
      reason: 'Listing is under manual safety suspension or administrative freeze'
    };
  }

  // 3. Rejected listings must remain rejected unless explicitly re-evaluated
  if ((listing as any).status === 'rejected') {
    return {
      eligibleForVerifiedBadge: false,
      eligibleForAutoPublish: false,
      reason: 'Listing was explicitly rejected by compliance'
    };
  }

  // 4. Draft listings or listings missing photos should not be auto-published, but can receive verified host badge
  const isExplicitDraft = (listing as any).status === 'draft';
  if (isExplicitDraft || !hasPhotos) {
    return {
      eligibleForVerifiedBadge: true,
      eligibleForAutoPublish: false,
      reason: isExplicitDraft ? 'Listing is marked as draft by host' : 'Listing missing photos'
    };
  }

  // 5. Eligible for full auto-publishing & verified host badge
  return {
    eligibleForVerifiedBadge: true,
    eligibleForAutoPublish: true,
  };
}

export interface HostListingSyncResult {
  success: boolean;
  totalListingsFound: number;
  eligibleListingsUpdated: number;
  skippedIneligibleCount: number;
  error?: string;
}

/**
 * Synchronizes existing listings owned by the verified host.
 * Idempotent: Targeted field updates only (isHostVerified, status, updatedAt).
 * Never mutates titles, descriptions, prices, photos, accommodations, coordinates, or host IDs.
 */
export const syncHostListingsVerification = async (
  userId: string,
  isHostVerified: boolean
): Promise<HostListingSyncResult> => {
  if (!userId) {
    return {
      success: false,
      totalListingsFound: 0,
      eligibleListingsUpdated: 0,
      skippedIneligibleCount: 0,
      error: 'Cannot synchronize listings: missing userId'
    };
  }

  // 1. Authoritative server-side execution if authenticated
  if (auth.currentUser && typeof fetch !== 'undefined') {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/hosts/sync-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'x-user-id': auth.currentUser.uid,
          'x-user-email': auth.currentUser.email || ''
        },
        body: JSON.stringify({
          hostId: userId,
          isHostVerified
        })
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          totalListingsFound: data.totalListingsFound || 0,
          eligibleListingsUpdated: data.eligibleListingsUpdated || 0,
          skippedIneligibleCount: data.skippedIneligibleCount || 0
        };
      }
    } catch (apiErr) {
      console.warn('Backend sync-listings call fell through to client batch:', apiErr);
    }
  }

  const path = COLLECTION;
  try {
    const q = query(collection(db, path), where('hostId', '==', userId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return {
        success: true,
        totalListingsFound: 0,
        eligibleListingsUpdated: 0,
        skippedIneligibleCount: 0
      };
    }

    const batch = writeBatch(db);
    let updatedCount = 0;
    let skippedCount = 0;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as Listing;
      const docRef = doc(db, COLLECTION, docSnap.id);

      if (isHostVerified) {
        const eligibility = evaluateListingAutoPublishEligibility(data);

        if (!eligibility.eligibleForVerifiedBadge) {
          skippedCount++;
          return;
        }

        const updates: Record<string, any> = {
          isHostVerified: true,
          updatedAt: serverTimestamp()
        };

        // If eligible for auto-publishing and currently pending/unapproved
        if (eligibility.eligibleForAutoPublish) {
          const currentStatus = (data as any).status;
          if (!currentStatus || currentStatus === 'pending' || currentStatus === 'pending_approval' || currentStatus === 'pending_verification') {
            updates.status = 'published';
          }
        }

        batch.update(docRef, updates);
        updatedCount++;
      } else {
        // Revoke / unverify
        batch.update(docRef, {
          isHostVerified: false,
          updatedAt: serverTimestamp()
        });
        updatedCount++;
      }
    });

    // Also sync activities_trips for this host
    try {
      const actSnap = await getDocs(query(collection(db, 'activities_trips'), where('hostId', '==', userId)));
      if (!actSnap.empty) {
        actSnap.docs.forEach((docSnap) => {
          const actData = docSnap.data();
          const docRef = doc(db, 'activities_trips', docSnap.id);

          if (isHostVerified) {
            const updates: Record<string, any> = {
              isHostVerified: true,
              updatedAt: serverTimestamp()
            };
            if (!actData.status || actData.status === 'pending' || actData.status === 'pending_approval' || actData.status === 'pending_verification') {
              updates.status = 'published';
            }
            batch.update(docRef, updates);
            updatedCount++;
          } else {
            batch.update(docRef, {
              isHostVerified: false,
              updatedAt: serverTimestamp()
            });
            updatedCount++;
          }
        });
      }
    } catch (actErr) {
      console.warn('Note: activities_trips sync query fallback:', actErr);
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      totalListingsFound: snap.size,
      eligibleListingsUpdated: updatedCount,
      skippedIneligibleCount: skippedCount
    };
  } catch (err: any) {
    console.error('Error synchronizing host listings verification:', err);
    return {
      success: false,
      totalListingsFound: 0,
      eligibleListingsUpdated: 0,
      skippedIneligibleCount: 0,
      error: err?.message || 'Failed to synchronize host listings'
    };
  }
};

export interface UpdateVerificationStatusResult {
  success: boolean;
  verificationUpdated: boolean;
  userProfileUpdated: boolean;
  listingSyncResult?: HostListingSyncResult;
  error?: string;
}

export const updateVerificationStatus = async (
  verificationId: string, 
  userId: string,
  status: VerificationStatus, 
  adminNotes?: string
): Promise<UpdateVerificationStatusResult> => {
  // Authoritative server-side execution if authenticated
  if (auth.currentUser && typeof fetch !== 'undefined') {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/admin/hosts/${userId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'x-user-id': auth.currentUser.uid,
          'x-user-email': auth.currentUser.email || ''
        },
        body: JSON.stringify({
          status,
          adminNotes: adminNotes || ''
        })
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          verificationUpdated: true,
          userProfileUpdated: true,
          listingSyncResult: {
            success: true,
            totalListingsFound: data.totalListingsFound || 0,
            eligibleListingsUpdated: data.publishedCount || 0,
            skippedIneligibleCount: data.draftIncompleteCount || 0
          }
        };
      }
    } catch (apiErr) {
      console.warn('Backend /api/admin/hosts/:userId/verify fell through to client batch:', apiErr);
    }
  }

  const path = `${VERIFICATIONS_COLLECTION}/${verificationId}`;
  try {
    await updateDoc(doc(db, VERIFICATIONS_COLLECTION, verificationId), {
      status,
      adminNotes: adminNotes || '',
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser?.email || 'mozbookinfo@gmail.com',
    });

    let userProfileUpdated = false;
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: status,
        verifiedAt: status === 'verified' ? serverTimestamp() : null,
      });
      userProfileUpdated = true;
    } catch (e) {
      console.warn('Could not update user doc verificationStatus', e);
    }

    // Synchronize eligible existing listings for this host
    let listingSyncResult: HostListingSyncResult | undefined;
    if (status === 'verified') {
      listingSyncResult = await syncHostListingsVerification(userId, true);
    } else if (status === 'rejected') {
      listingSyncResult = await syncHostListingsVerification(userId, false);
    }

    return {
      success: true,
      verificationUpdated: true,
      userProfileUpdated,
      listingSyncResult
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return {
      success: false,
      verificationUpdated: false,
      userProfileUpdated: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const subscribeToVerifications = (callback: (verifs: HostVerification[]) => void) => {
  const path = VERIFICATIONS_COLLECTION;
  return onSnapshot(collection(db, path), (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HostVerification));
    callback(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};
