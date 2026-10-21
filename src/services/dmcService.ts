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
import { db } from '../firebase';
import { 
  DmcProfile, 
  TravelPackage, 
  DmcSupplier, 
  DmcEnquiry,
  DmcVerificationStatus,
  DmcDocumentVerificationStatus,
  DmcDocumentRecord
} from '../types/dmc';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';
import { sanitizeFirestorePayload } from './listingService';

// Collections
const VERIFICATIONS_COLLECTION = 'verifications';
const PACKAGES_COLLECTION = 'activities_trips';
const ENQUIRIES_COLLECTION = 'activity_bookings';

// Local storage backup keys
const STORAGE_KEY_DMC_PROFILES = 'mozbook_dmc_profiles';
const STORAGE_KEY_PACKAGES = 'mozbook_dmc_packages';
const STORAGE_KEY_SUPPLIERS = 'mozbook_dmc_suppliers';
const STORAGE_KEY_ENQUIRIES = 'mozbook_dmc_enquiries';

// Helper storage functions
function getLocalItems<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalItems<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`LocalStorage write failed for ${key}:`, err);
  }
}

// -------------------------------------------------------------
// 1. Travel / DMC Onboarding & Profile Verification
// -------------------------------------------------------------

/**
 * Retrieves the DMC business profile and verification record for a user.
 */
export async function getDmcProfile(userId: string): Promise<DmcProfile | null> {
  if (!userId) return null;

  // 1. Try Firestore first
  try {
    const coll = collection(db, VERIFICATIONS_COLLECTION);
    const q = query(
      coll, 
      where('userId', '==', userId), 
      where('partnerCategory', '==', 'travel_dmc')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      return {
        id: snap.docs[0].id,
        ...docData
      } as DmcProfile;
    }
  } catch (err) {
    console.warn('Firestore query failed for DMC profile, checking local cache:', err);
  }

  // 2. Fallback to local cache
  const localList = getLocalItems<DmcProfile>(STORAGE_KEY_DMC_PROFILES);
  const found = localList.find(p => p.userId === userId);
  return found || null;
}

/**
 * Submits or saves DMC onboarding application.
/**
 * Evaluates the authoritative verification status of a compliance document.
 * Adheres strictly to the following rules:
 * 1. If no document evidence exists -> 'not_uploaded' ("Not Uploaded — Required")
 * 2. If document exists and is marked 'verified' -> 'verified' ("Verified by MozBook")
 * 3. If document exists and is marked 'rejected' -> 'rejected' ("Rejected — Update Required")
 * 4. If document exists and is expired -> 'expired' ("Expired — Renewal Required")
 * 5. If document is uploaded but unreviewed -> 'pending_review' ("Submitted — Pending Review")
 * Never infer approval from entered text fields, profile existence, or form submission.
 */
export function getDocumentComplianceStatus(
  docUrl: string | undefined | null,
  record: DmcDocumentRecord | undefined | null,
  profileStatus: DmcVerificationStatus | undefined,
  expiryDate?: string
): {
  status: DmcDocumentVerificationStatus;
  label: string;
  isVerified: boolean;
  notes?: string;
} {
  const effectiveUrl = (docUrl || record?.documentUrl || '').trim();

  // Rule 1: No document uploaded
  if (!effectiveUrl) {
    return {
      status: 'not_uploaded',
      label: 'Not Uploaded — Required',
      isVerified: false
    };
  }

  // Rule 4a: Check if expired
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(expiry.getTime()) && expiry < today) {
      return {
        status: 'expired',
        label: 'Expired — Renewal Required',
        isVerified: false,
        notes: record?.notes || `Expired on ${expiryDate}`
      };
    }
  }

  // Rule 2 & 3: Check explicit document record status
  if (record?.status) {
    if (record.status === 'verified') {
      return {
        status: 'verified',
        label: 'Verified by MozBook',
        isVerified: true,
        notes: record.notes
      };
    }
    if (record.status === 'rejected') {
      return {
        status: 'rejected',
        label: 'Rejected — Update Required',
        isVerified: false,
        notes: record.rejectionReason || record.notes
      };
    }
    if (record.status === 'expired') {
      return {
        status: 'expired',
        label: 'Expired — Renewal Required',
        isVerified: false,
        notes: record.notes
      };
    }
    if (record.status === 'pending_review') {
      return {
        status: 'pending_review',
        label: 'Submitted — Pending Review',
        isVerified: false
      };
    }
  }

  // If the entire DMC profile has been officially reviewed and approved by admin
  if (profileStatus === 'approved') {
    return {
      status: 'verified',
      label: 'Verified by MozBook',
      isVerified: true,
      notes: record?.notes
    };
  }

  if (profileStatus === 'rejected') {
    return {
      status: 'rejected',
      label: 'Application Rejected',
      isVerified: false,
      notes: record?.rejectionReason || 'DMC application was rejected by compliance.'
    };
  }

  // Rule 5: Document uploaded but pending admin review
  return {
    status: 'pending_review',
    label: 'Submitted — Pending Review',
    isVerified: false
  };
}

/**
 * Submits or saves DMC onboarding application.
 * Note: Initial submissions are strictly set to 'pending_review' or 'draft'.
 * Never auto-approves a DMC partner (authorized administrator review required).
 */
export async function submitDmcOnboarding(
  profileData: Omit<DmcProfile, 'id' | 'createdAt' | 'updatedAt'>,
  isDraft: boolean = false
): Promise<DmcProfile> {
  const now = new Date().toISOString();
  const targetStatus: DmcVerificationStatus = isDraft ? 'draft' : 'pending_review';

  // Construct honest per-document records based on actual uploaded evidence
  const existingProfiles = getLocalItems<DmcProfile>(STORAGE_KEY_DMC_PROFILES);
  const existingIdx = existingProfiles.findIndex(p => p.userId === profileData.userId);
  const existingProfile = existingIdx >= 0 ? existingProfiles[existingIdx] : null;

  const licenseUrl = (profileData.licenseDocUrl || '').trim();
  const commercialUrl = (profileData.commercialRegDocUrl || '').trim();
  const insuranceUrl = (profileData.insuranceDocUrl || '').trim();

  const documentRecords = {
    inaturLicense: {
      documentUrl: licenseUrl,
      status: (licenseUrl 
        ? (existingProfile?.documentRecords?.inaturLicense?.status === 'verified' && existingProfile.licenseDocUrl === licenseUrl 
            ? 'verified' 
            : 'pending_review')
        : 'not_uploaded') as DmcDocumentVerificationStatus,
      uploadedAt: licenseUrl ? (existingProfile?.documentRecords?.inaturLicense?.uploadedAt || now) : undefined,
      expiryDate: profileData.licenseExpiryDate
    },
    commercialCertificate: {
      documentUrl: commercialUrl,
      status: (commercialUrl 
        ? (existingProfile?.documentRecords?.commercialCertificate?.status === 'verified' && existingProfile.commercialRegDocUrl === commercialUrl 
            ? 'verified' 
            : 'pending_review')
        : 'not_uploaded') as DmcDocumentVerificationStatus,
      uploadedAt: commercialUrl ? (existingProfile?.documentRecords?.commercialCertificate?.uploadedAt || now) : undefined
    },
    liabilityInsurance: {
      documentUrl: insuranceUrl,
      status: (insuranceUrl 
        ? (existingProfile?.documentRecords?.liabilityInsurance?.status === 'verified' && existingProfile.insuranceDocUrl === insuranceUrl 
            ? 'verified' 
            : 'pending_review')
        : 'not_uploaded') as DmcDocumentVerificationStatus,
      uploadedAt: insuranceUrl ? (existingProfile?.documentRecords?.liabilityInsurance?.uploadedAt || now) : undefined,
      expiryDate: profileData.liabilityInsuranceExpiry
    }
  };

  const newProfile: DmcProfile = {
    ...profileData,
    documentRecords,
    status: targetStatus,
    createdAt: existingProfile?.createdAt || now,
    updatedAt: now
  };

  // 1. Write to local storage
  if (existingIdx >= 0) {
    newProfile.id = existingProfiles[existingIdx].id;
    existingProfiles[existingIdx] = newProfile;
  } else {
    newProfile.id = 'dmc_' + Date.now();
    existingProfiles.push(newProfile);
  }
  saveLocalItems(STORAGE_KEY_DMC_PROFILES, existingProfiles);

  // 2. Write to Firestore verifications collection
  try {
    const coll = collection(db, VERIFICATIONS_COLLECTION);
    const firestorePayload = sanitizeFirestorePayload({
      ...newProfile,
      partnerCategory: 'travel_dmc',
      docType: 'dmc_license',
      hostName: profileData.tradingName || profileData.legalBusinessName || 'DMC Partner',
      docNumber: profileData.inaturLicenseNumber || '',
      expiryDate: profileData.licenseExpiryDate || '',
      phoneNumber: profileData.representativePhone || '',
      status: targetStatus === 'pending_review' ? 'pending' : targetStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (newProfile.id && !newProfile.id.startsWith('dmc_')) {
      const docRef = doc(db, VERIFICATIONS_COLLECTION, newProfile.id);
      await setDoc(docRef, firestorePayload, { merge: true });
    } else {
      const docRef = await addDoc(coll, firestorePayload);
      newProfile.id = docRef.id;
      // Sync back with local storage
      const refreshed = getLocalItems<DmcProfile>(STORAGE_KEY_DMC_PROFILES);
      const matchIdx = refreshed.findIndex(p => p.userId === profileData.userId);
      if (matchIdx >= 0) {
        refreshed[matchIdx].id = docRef.id;
        saveLocalItems(STORAGE_KEY_DMC_PROFILES, refreshed);
      }
    }
  } catch (err) {
    console.warn('Firestore write for DMC onboarding failed, local storage preserved:', err);
  }

  return newProfile;
}

/**
 * Admin action to review DMC verification status (approve, reject, suspend, or request info)
 */
export async function updateDmcVerificationStatus(
  profileId: string,
  userId: string,
  status: DmcVerificationStatus,
  adminNotes?: string,
  reviewedBy?: string,
  docVerificationDecisions?: {
    inaturLicense?: { status: DmcDocumentVerificationStatus; notes?: string };
    commercialCertificate?: { status: DmcDocumentVerificationStatus; notes?: string };
    liabilityInsurance?: { status: DmcDocumentVerificationStatus; notes?: string };
  }
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Update local cache
  const localProfiles = getLocalItems<DmcProfile>(STORAGE_KEY_DMC_PROFILES);
  const idx = localProfiles.findIndex(p => p.id === profileId || p.userId === userId);
  if (idx >= 0) {
    const p = localProfiles[idx];
    p.status = status;
    p.adminNotes = adminNotes || p.adminNotes;
    p.reviewedBy = reviewedBy || 'admin';
    p.reviewedAt = now;
    p.updatedAt = now;

    // Update documentRecords based on review
    if (p.documentRecords) {
      if (docVerificationDecisions) {
        if (docVerificationDecisions.inaturLicense && p.documentRecords.inaturLicense) {
          p.documentRecords.inaturLicense.status = docVerificationDecisions.inaturLicense.status;
          p.documentRecords.inaturLicense.notes = docVerificationDecisions.inaturLicense.notes;
          p.documentRecords.inaturLicense.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.inaturLicense.reviewedAt = now;
        }
        if (docVerificationDecisions.commercialCertificate && p.documentRecords.commercialCertificate) {
          p.documentRecords.commercialCertificate.status = docVerificationDecisions.commercialCertificate.status;
          p.documentRecords.commercialCertificate.notes = docVerificationDecisions.commercialCertificate.notes;
          p.documentRecords.commercialCertificate.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.commercialCertificate.reviewedAt = now;
        }
        if (docVerificationDecisions.liabilityInsurance && p.documentRecords.liabilityInsurance) {
          p.documentRecords.liabilityInsurance.status = docVerificationDecisions.liabilityInsurance.status;
          p.documentRecords.liabilityInsurance.notes = docVerificationDecisions.liabilityInsurance.notes;
          p.documentRecords.liabilityInsurance.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.liabilityInsurance.reviewedAt = now;
        }
      } else if (status === 'approved') {
        // When administrator approves DMC profile, all attached documents transition to verified
        if (p.documentRecords.inaturLicense && p.documentRecords.inaturLicense.documentUrl) {
          p.documentRecords.inaturLicense.status = 'verified';
          p.documentRecords.inaturLicense.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.inaturLicense.reviewedAt = now;
        }
        if (p.documentRecords.commercialCertificate && p.documentRecords.commercialCertificate.documentUrl) {
          p.documentRecords.commercialCertificate.status = 'verified';
          p.documentRecords.commercialCertificate.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.commercialCertificate.reviewedAt = now;
        }
        if (p.documentRecords.liabilityInsurance && p.documentRecords.liabilityInsurance.documentUrl) {
          p.documentRecords.liabilityInsurance.status = 'verified';
          p.documentRecords.liabilityInsurance.reviewedBy = reviewedBy || 'admin';
          p.documentRecords.liabilityInsurance.reviewedAt = now;
        }
      } else if (status === 'rejected') {
        if (p.documentRecords.inaturLicense && p.documentRecords.inaturLicense.documentUrl) {
          p.documentRecords.inaturLicense.status = 'rejected';
          p.documentRecords.inaturLicense.rejectionReason = adminNotes;
        }
        if (p.documentRecords.commercialCertificate && p.documentRecords.commercialCertificate.documentUrl) {
          p.documentRecords.commercialCertificate.status = 'rejected';
          p.documentRecords.commercialCertificate.rejectionReason = adminNotes;
        }
        if (p.documentRecords.liabilityInsurance && p.documentRecords.liabilityInsurance.documentUrl) {
          p.documentRecords.liabilityInsurance.status = 'rejected';
          p.documentRecords.liabilityInsurance.rejectionReason = adminNotes;
        }
      }
    }

    saveLocalItems(STORAGE_KEY_DMC_PROFILES, localProfiles);
  }

  // 2. Update Firestore
  try {
    if (profileId && !profileId.startsWith('dmc_')) {
      const docRef = doc(db, VERIFICATIONS_COLLECTION, profileId);
      await updateDoc(docRef, {
        status: status === 'approved' ? 'verified' : status === 'pending_review' ? 'pending' : status,
        adminNotes: adminNotes || '',
        reviewedBy: reviewedBy || 'admin',
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    }
  } catch (err) {
    console.warn('Firestore update for DMC verification status failed:', err);
  }

  return true;
}

// -------------------------------------------------------------
// 2. Travel Package Operations (Stored in activities_trips)
// -------------------------------------------------------------

/**
 * Creates a new Travel Package for a DMC partner.
 */
export async function createTravelPackage(
  packageData: Omit<TravelPackage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TravelPackage> {
  const now = new Date().toISOString();
  const newId = 'pkg_' + Date.now();

  const newPkg: TravelPackage = {
    ...packageData,
    id: newId,
    currency: 'MZN',
    createdAt: now,
    updatedAt: now
  };

  // Local storage
  const localList = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES);
  localList.unshift(newPkg);
  saveLocalItems(STORAGE_KEY_PACKAGES, localList);

  // Firestore
  try {
    const coll = collection(db, PACKAGES_COLLECTION);
    const firestorePayload = sanitizeFirestorePayload({
      ...newPkg,
      type: 'dmc_package',
      city: newPkg.primaryDestination || (newPkg.destinations && newPkg.destinations[0]) || 'Mozambique',
      priceAdult: newPkg.pricePerPersonMzn,
      maxGuests: newPkg.maxGroupSize,
      minGuests: newPkg.minGroupSize,
      duration: `${newPkg.durationDays} Days / ${newPkg.durationNights} Nights`,
      meetingPoint: newPkg.pickupLocation || 'Maputo International Airport (MPM)',
      pickup: {
        offered: true,
        location: newPkg.pickupLocation || 'Maputo / Designated Arrival Port',
        instructions: newPkg.meetingPointInstructions || 'Included meet-and-greet transfer'
      },
      scheduleType: newPkg.scheduleType === 'scheduled_dates' ? 'specific_dates' : 'flexible',
      specificDates: newPkg.departureDates || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const docRef = await addDoc(coll, firestorePayload);
    newPkg.id = docRef.id;

    // Update local cache ID
    const updatedLocal = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES);
    const idx = updatedLocal.findIndex(p => p.id === newId);
    if (idx >= 0) {
      updatedLocal[idx].id = docRef.id;
      saveLocalItems(STORAGE_KEY_PACKAGES, updatedLocal);
    }
  } catch (err) {
    console.warn('Firestore write for travel package failed, cached locally:', err);
  }

  return newPkg;
}

/**
 * Updates an existing travel package.
 */
export async function updateTravelPackage(
  packageId: string,
  updates: Partial<TravelPackage>
): Promise<boolean> {
  const now = new Date().toISOString();

  // Local storage update
  const localList = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES);
  const idx = localList.findIndex(p => p.id === packageId);
  if (idx >= 0) {
    localList[idx] = { ...localList[idx], ...updates, updatedAt: now };
    saveLocalItems(STORAGE_KEY_PACKAGES, localList);
  }

  // Firestore update
  try {
    if (packageId && !packageId.startsWith('pkg_')) {
      const docRef = doc(db, PACKAGES_COLLECTION, packageId);
      const firestoreUpdates: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      if (updates.pricePerPersonMzn !== undefined) {
        firestoreUpdates.priceAdult = updates.pricePerPersonMzn;
      }
      if (updates.maxGroupSize !== undefined) {
        firestoreUpdates.maxGuests = updates.maxGroupSize;
      }
      if (updates.minGroupSize !== undefined) {
        firestoreUpdates.minGuests = updates.minGroupSize;
      }
      if (updates.departureDates !== undefined) {
        firestoreUpdates.specificDates = updates.departureDates;
      }
      await updateDoc(docRef, firestoreUpdates);
    }
    return true;
  } catch (err) {
    console.warn('Firestore update for travel package failed:', err);
    return true;
  }
}

/**
 * Gets travel packages owned by a specific host.
 */
export async function getHostTravelPackages(hostId: string): Promise<TravelPackage[]> {
  if (!hostId) return [];

  try {
    const coll = collection(db, PACKAGES_COLLECTION);
    const q = query(
      coll,
      where('hostId', '==', hostId),
      where('type', '==', 'dmc_package')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const firestoreItems: TravelPackage[] = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          pricePerPersonMzn: data.pricePerPersonMzn || data.priceAdult || 0,
          minGroupSize: data.minGroupSize || data.minGuests || 1,
          maxGroupSize: data.maxGroupSize || data.maxGuests || 12,
          departureDates: data.departureDates || data.specificDates || [],
          durationDays: data.durationDays || (data.multiDayDetails ? data.multiDayDetails.days : 3),
          durationNights: data.durationNights || (data.multiDayDetails ? data.multiDayDetails.nights : 2),
        } as TravelPackage;
      });

      // Merge with any offline local additions
      const localList = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES).filter(p => p.hostId === hostId);
      const mergedMap = new Map<string, TravelPackage>();
      firestoreItems.forEach(item => mergedMap.set(item.id, item));
      localList.forEach(item => {
        if (!mergedMap.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });
      return Array.from(mergedMap.values());
    }
  } catch (err) {
    console.warn('Firestore fetch for host packages failed, reading from local storage:', err);
  }

  return getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES).filter(p => p.hostId === hostId);
}

/**
 * Gets all published travel packages for traveler discovery.
 */
export async function getPublishedTravelPackages(): Promise<TravelPackage[]> {
  try {
    const coll = collection(db, PACKAGES_COLLECTION);
    const q = query(
      coll,
      where('type', '==', 'dmc_package'),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as TravelPackage[];
    }
  } catch (err) {
    console.warn('Firestore query for published travel packages failed:', err);
  }

  return getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES).filter(p => p.status === 'published');
}

/**
 * Gets a single travel package by ID.
 */
export async function getTravelPackageById(packageId: string): Promise<TravelPackage | null> {
  if (!packageId) return null;

  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return {
        id: snap.id,
        ...snap.data()
      } as TravelPackage;
    }
  } catch (err) {
    console.warn('Firestore fetch for package by ID failed:', err);
  }

  const localList = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES);
  return localList.find(p => p.id === packageId) || null;
}

/**
 * Deletes or archives a travel package.
 */
export async function deleteTravelPackage(packageId: string): Promise<boolean> {
  const localList = getLocalItems<TravelPackage>(STORAGE_KEY_PACKAGES);
  const updated = localList.filter(p => p.id !== packageId);
  saveLocalItems(STORAGE_KEY_PACKAGES, updated);

  try {
    if (packageId && !packageId.startsWith('pkg_')) {
      const docRef = doc(db, PACKAGES_COLLECTION, packageId);
      await deleteDoc(docRef);
    }
    return true;
  } catch (err) {
    console.warn('Firestore delete for package failed:', err);
    return true;
  }
}

// -------------------------------------------------------------
// 3. DMC Suppliers & Preferred Service Directory
// -------------------------------------------------------------

export function getDmcSuppliers(hostId: string): DmcSupplier[] {
  const list = getLocalItems<DmcSupplier>(STORAGE_KEY_SUPPLIERS);
  return list.filter(s => s.hostId === hostId);
}

export function saveDmcSupplier(supplier: Omit<DmcSupplier, 'id'> & { id?: string }): DmcSupplier {
  const list = getLocalItems<DmcSupplier>(STORAGE_KEY_SUPPLIERS);
  const id = supplier.id || 'sup_' + Date.now();
  const newSupplier: DmcSupplier = { ...supplier, id };

  const idx = list.findIndex(s => s.id === id);
  if (idx >= 0) {
    list[idx] = newSupplier;
  } else {
    list.unshift(newSupplier);
  }
  saveLocalItems(STORAGE_KEY_SUPPLIERS, list);
  return newSupplier;
}

export function deleteDmcSupplier(supplierId: string): boolean {
  const list = getLocalItems<DmcSupplier>(STORAGE_KEY_SUPPLIERS);
  const filtered = list.filter(s => s.id !== supplierId);
  saveLocalItems(STORAGE_KEY_SUPPLIERS, filtered);
  return true;
}

// -------------------------------------------------------------
// 4. Inquiries & Custom Itinerary Requests
// -------------------------------------------------------------

export function getDmcEnquiries(hostId: string): DmcEnquiry[] {
  const list = getLocalItems<DmcEnquiry>(STORAGE_KEY_ENQUIRIES);
  return list.filter(e => e.hostId === hostId);
}

export function createDmcEnquiry(enquiry: Omit<DmcEnquiry, 'id' | 'createdAt' | 'status'> & { status?: DmcEnquiry['status'] }): DmcEnquiry {
  const list = getLocalItems<DmcEnquiry>(STORAGE_KEY_ENQUIRIES);
  const now = new Date().toISOString();
  const newEnquiry: DmcEnquiry = {
    ...enquiry,
    id: 'enq_' + Date.now(),
    status: 'new',
    createdAt: now,
    updatedAt: now
  };
  list.unshift(newEnquiry);
  saveLocalItems(STORAGE_KEY_ENQUIRIES, list);
  return newEnquiry;
}

export function updateDmcEnquiryStatus(
  enquiryId: string, 
  status: DmcEnquiry['status'],
  quoteAmountMzn?: number,
  quoteNotes?: string
): boolean {
  const list = getLocalItems<DmcEnquiry>(STORAGE_KEY_ENQUIRIES);
  const idx = list.findIndex(e => e.id === enquiryId);
  if (idx >= 0) {
    list[idx].status = status;
    if (quoteAmountMzn !== undefined) list[idx].quoteAmountMzn = quoteAmountMzn;
    if (quoteNotes !== undefined) list[idx].quoteNotes = quoteNotes;
    list[idx].updatedAt = new Date().toISOString();
    saveLocalItems(STORAGE_KEY_ENQUIRIES, list);
    return true;
  }
  return false;
}
