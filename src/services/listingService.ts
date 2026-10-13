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
  orderBy
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
  // MozBook Inventory Allocation & Availability (Prompt 28)
  mozbookAllocatedUnits?: number;
  blockedDates?: string[];
  // Marketplace Cancellation Policy (Stage 4A)
  cancellationTier?: import('../types/cancellationPolicy').CancellationTierId;
  isNonRefundable?: boolean;
  // Canonical Accommodation Taxonomy (Stage 3C - Optional & Additive)
  canonicalType?: CanonicalAccommodationTypeId;
  operatingModels?: OperatingModelId[];
  settings?: SettingId[];
  classificationStatus?: ClassificationStatus;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'listings';
const COMMUNITY_COLLECTION = 'community_places';
const VERIFICATIONS_COLLECTION = 'verifications';

export const getListings = async (category?: string) => {
  const path = COLLECTION;
  try {
    const q = category 
      ? query(collection(db, path), where('category', '==', category))
      : collection(db, path);
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
  } catch (error) {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const createListing = async (listing: Omit<Listing, 'id' | 'createdAt'>) => {
  const path = COLLECTION;
  try {
    const docRef = await addDoc(collection(db, path), {
      ...listing,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

export const updateListing = async (id: string, updates: Partial<Listing>) => {
  const path = `${COLLECTION}/${id}`;
  try {
    await updateDoc(doc(db, COLLECTION, id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
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
    await setDoc(doc(db, SPECIAL_OFFERS_COLLECTION, offerDocId), {
      ...offer,
      listingId,
      hostId: auth.currentUser?.uid || offer.hostId || 'unknown_host',
      updatedAt: serverTimestamp(),
      createdAt: offer.createdAt || serverTimestamp(),
    }, { merge: true });

    // 2. Also keep synced on listing for immediate reactive display
    await updateDoc(doc(db, COLLECTION, listingId), {
      specialOffer: {
        ...offer,
        listingId,
      },
      updatedAt: serverTimestamp(),
    });
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

export const subscribeToListings = (callback: (listings: Listing[]) => void) => {
  const path = COLLECTION;
  return onSnapshot(collection(db, path), (snapshot) => {
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
    callback(listings);
  }, (error) => {
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
    const docRef = await addDoc(collection(db, path), {
      ...place,
      addedBy: auth.currentUser?.uid || 'guest_host',
      createdAt: serverTimestamp(),
    });
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

  // 2. Fetch existing listings to aggregate community nearby places
  try {
    const snapshot = await getDocs(collection(db, COLLECTION));
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
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type ExpiryStatus = 'valid' | 'expiring_soon' | 'expired';

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
    const res = await fetch('/api/verify/send-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const docRef = await addDoc(collection(db, path), {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

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

export const updateVerificationStatus = async (
  verificationId: string, 
  userId: string,
  status: VerificationStatus, 
  adminNotes?: string
) => {
  const path = `${VERIFICATIONS_COLLECTION}/${verificationId}`;
  try {
    await updateDoc(doc(db, VERIFICATIONS_COLLECTION, verificationId), {
      status,
      adminNotes: adminNotes || '',
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser?.email || 'admin',
    });

    // Update user profile status
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: status,
        verifiedAt: status === 'verified' ? serverTimestamp() : null,
      });
    } catch (e) {
      console.warn('Could not update user doc verificationStatus', e);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    return false;
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
