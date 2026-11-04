import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AdminAuditLog, AdminStats, AdminUser, UserActivitySummary, AdminHost, AdminProperty, AdminActivityTrip, AdminUnifiedBooking, AdminBookingCategory, AdminFinancialSummary, AdminFinancialTransaction } from '../types/admin';
import { getActivitiesTrips } from './activityTripService';
import { calculateCommission } from '../config/platformCommission';
import { calculateDocumentExpiry } from './listingService';

const STORAGE_AUDIT_LOGS_KEY = 'mozbook_admin_audit_logs_cache';

function getStoredLogs(): AdminAuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLogs(logs: AdminAuditLog[]): void {
  try {
    localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.warn('Failed to save audit logs to localStorage:', e);
  }
}

export const adminService = {
  /**
   * Record an administrative event to the admin_audit_logs collection.
   * Never logs passwords or sensitive credentials.
   * Routes write through authoritative backend endpoint /api/admin/audit-log if accessible,
   * falling back to authenticated Firestore setDoc with server timestamp.
   */
  async logAdminAction(
    adminUserId: string,
    adminEmail: string,
    action: string,
    module: string,
    targetType?: string,
    targetId?: string,
    metadata?: Record<string, any>
  ): Promise<AdminAuditLog> {
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const isoTimestamp = new Date().toISOString();

    const logEntry: AdminAuditLog = {
      id,
      adminUserId,
      adminEmail,
      action,
      module,
      timestamp: isoTimestamp,
      metadata: metadata || {},
    };
    if (targetType) logEntry.targetType = targetType;
    if (targetId) logEntry.targetId = targetId;

    // Cache locally for immediate UI display
    const logs = getStoredLogs();
    logs.unshift(logEntry);
    saveStoredLogs(logs);

    // Save to server or Firestore only after ensuring currentUser authentication is active
    try {
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();

        let recordedViaServer = false;
        try {
          const res = await fetch('/api/admin/audit-log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
              'x-user-id': auth.currentUser.uid,
              'x-user-email': auth.currentUser.email || adminEmail
            },
            body: JSON.stringify({
              id,
              action,
              module,
              targetType,
              targetId,
              metadata
            })
          });
          if (!res.ok) {
            console.warn('[AdminService] Backend audit recording returned status:', res.status);
          }
        } catch (apiErr) {
          console.warn('[AdminService] Backend audit recording network error:', apiErr);
        }
      } else {
        console.warn('Postponing admin audit log write: auth.currentUser is not yet loaded.');
      }
    } catch (err) {
      console.warn('Failed to record admin audit log:', err);
    }

    return logEntry;
  },

  /**
   * Retrieve recent admin audit logs.
   * Handles Firestore timestamps, string dates, and local cache seamlessly.
   */
  async getRecentAuditLogs(limitCount = 20): Promise<AdminAuditLog[]> {
    let firestoreLogs: AdminAuditLog[] = [];
    try {
      const snap = await getDocs(collection(db, 'admin_audit_logs'));
      snap.forEach((d) => {
        const raw = d.data();
        let normalizedTimestamp = raw.timestamp;
        if (raw.createdAt && typeof raw.createdAt === 'object' && 'seconds' in raw.createdAt) {
          normalizedTimestamp = new Date(raw.createdAt.seconds * 1000).toISOString();
        } else if (!normalizedTimestamp && raw.createdAt) {
          normalizedTimestamp = new Date(raw.createdAt).toISOString();
        }
        firestoreLogs.push({
          id: d.id,
          adminUserId: raw.adminUserId,
          adminEmail: raw.adminEmail,
          action: raw.action,
          module: raw.module,
          targetType: raw.targetType,
          targetId: raw.targetId,
          timestamp: normalizedTimestamp || new Date().toISOString(),
          createdAt: raw.createdAt,
          authProvider: raw.authProvider,
          metadata: raw.metadata || {}
        });
      });
    } catch (err) {
      console.warn('Firestore fetch failed for admin_audit_logs, falling back to cache:', err);
    }

    const cached = getStoredLogs();
    const mergedMap = new Map<string, AdminAuditLog>();
    firestoreLogs.forEach((l) => mergedMap.set(l.id, l));
    cached.forEach((l) => mergedMap.set(l.id, l));

    const all = Array.from(mergedMap.values());
    // Sort descending by timestamp
    all.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });
    return all.slice(0, limitCount);
  },

  /**
   * Safely calculate real KPI metrics from existing Firestore collections.
   * If a collection or data point is not connected or available, returns null.
   */
  async getPlatformKPIs(): Promise<AdminStats> {
    const stats: AdminStats = {
      totalUsers: null,
      activeUsers: null,
      totalHosts: null,
      totalProperties: null,
      totalActivitiesTrips: null,
      totalBookings: null,
      pendingVerifications: null,
      platformRevenue: null,
    };

    // 1. Users & Hosts
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      stats.totalUsers = usersSnap.size;
      let hostCount = 0;
      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'host') {
          hostCount++;
        }
      });
      stats.totalHosts = hostCount;
      stats.activeUsers = usersSnap.size; // Active user baseline
    } catch (e) {
      console.warn('Could not read users count:', e);
    }

    // 2. Properties (Listings)
    try {
      const listingsSnap = await getDocs(collection(db, 'listings'));
      stats.totalProperties = listingsSnap.size;
    } catch (e) {
      console.warn('Could not read listings count:', e);
    }

    // 3. Activities & Trips
    try {
      const actSnap = await getDocs(collection(db, 'activities_trips'));
      stats.totalActivitiesTrips = actSnap.size;
    } catch (e) {
      console.warn('Could not read activities_trips count:', e);
    }

    // 4. Bookings (Property bookings + Activity bookings)
    try {
      let bCount = 0;
      const bSnap = await getDocs(collection(db, 'bookings'));
      bCount += bSnap.size;
      try {
        const abSnap = await getDocs(collection(db, 'activity_bookings'));
        bCount += abSnap.size;
      } catch {
        // ignore
      }
      stats.totalBookings = bCount;
    } catch (e) {
      console.warn('Could not read bookings count:', e);
    }

    // 5. Pending Verifications
    try {
      const q = query(collection(db, 'verifications'), where('status', '==', 'pending'));
      const vSnap = await getDocs(q);
      stats.pendingVerifications = vSnap.size;
    } catch (e) {
      // Fallback: read all verifications and count pending
      try {
        const allV = await getDocs(collection(db, 'verifications'));
        let pCount = 0;
        allV.forEach((d) => {
          if (d.data().status === 'pending') pCount++;
        });
        stats.pendingVerifications = pCount;
      } catch {
        console.warn('Could not read verifications count');
      }
    }

    // 6. Platform Revenue (15% Net Commission from Confirmed Payments less Completed Refunds)
    try {
      const fin = await this.getFinancialSummary();
      if (fin.summary.reconciliation.isDataAvailable) {
        stats.platformRevenue = fin.summary.platformRevenue.netPlatformRevenue;
      }
    } catch (e) {
      console.warn('Could not read platform revenue:', e);
    }

    return stats;
  },

  /**
   * Fetch all registered platform users up to maxLimit.
   * Safe for current scale; uses index-friendly collection queries.
   */
  async getAllUsers(maxLimit = 200): Promise<AdminUser[]> {
    try {
      const q = query(collection(db, 'users'), limit(maxLimit));
      const snap = await getDocs(q);
      const users: AdminUser[] = [];

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const email = d.email || '';
        const isDesignatedAdmin = email.toLowerCase() === 'mozbookinfo@gmail.com';

        users.push({
          uid: docSnap.id,
          email: email,
          displayName: d.displayName || '',
          photoURL: d.photoURL || null,
          role: isDesignatedAdmin ? 'admin' : (d.role || 'guest'),
          phoneNumber: d.phoneNumber || d.phone || null,
          location: d.location || d.city || null,
          country: d.country || null,
          accountStatus: d.accountStatus || d.status || null,
          createdAt: d.createdAt || null,
          lastLoginAt: d.lastLoginAt || null,
          updatedAt: d.updatedAt || null,
        });
      });

      return users;
    } catch (err) {
      console.error('Failed to load users from Firestore:', err);
      return [];
    }
  },

  /**
   * Safely calculate real user activity across existing collections.
   * Only reads existing collections, returning 0 if empty or unavailable.
   */
  async getUserActivitySummary(userId: string): Promise<UserActivitySummary> {
    const summary: UserActivitySummary = {
      propertiesCount: 0,
      activitiesCount: 0,
      bookingsCount: 0,
      travelGroupsCount: 0,
    };

    if (!userId) return summary;

    // 1. Properties owned by host
    try {
      const qProps = query(collection(db, 'listings'), where('hostId', '==', userId));
      const sProps = await getDocs(qProps);
      summary.propertiesCount = sProps.size;
    } catch {
      // safe fallback
    }

    // 2. Activities & trips owned by host
    try {
      const qActs = query(collection(db, 'activities_trips'), where('hostId', '==', userId));
      const sActs = await getDocs(qActs);
      summary.activitiesCount = sActs.size;
    } catch {
      // safe fallback
    }

    // 3. Bookings made by user
    try {
      let totalB = 0;
      const qBookings = query(collection(db, 'bookings'), where('userId', '==', userId));
      const sBookings = await getDocs(qBookings);
      totalB += sBookings.size;

      try {
        const qActBookings = query(collection(db, 'activity_bookings'), where('userId', '==', userId));
        const sActBookings = await getDocs(qActBookings);
        totalB += sActBookings.size;
      } catch {
        // ignore
      }

      summary.bookingsCount = totalB;
    } catch {
      // safe fallback
    }

    // 4. Travel companion groups owned
    try {
      const qGroups = query(collection(db, 'travel_groups'), where('ownerId', '==', userId));
      const sGroups = await getDocs(qGroups);
      summary.travelGroupsCount = sGroups.size;
    } catch {
      // safe fallback
    }

    return summary;
  },

  /**
   * Fetch and synthesize real host records across platform collections.
   * Merges user profiles, compliance verifications, listings, and bookings.
   */
  async getAllHosts(): Promise<AdminHost[]> {
    try {
      const [usersSnap, verifsSnap, listingsSnap, actsSnap, bookingsSnap, actBookingsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'verifications')),
        getDocs(collection(db, 'listings')),
        getDocs(collection(db, 'activities_trips')),
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'activity_bookings')).catch(() => ({ docs: [], size: 0, forEach: () => {} })),
      ]);

      const hostsMap = new Map<string, AdminHost>();

      // A. Populate from users collection with role === 'host'
      usersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.role === 'host') {
          hostsMap.set(docSnap.id, {
            uid: docSnap.id,
            name: d.displayName || d.name || 'Unnamed Host',
            email: d.email || '',
            photoURL: d.photoURL || null,
            phoneNumber: d.phoneNumber || d.phone || null,
            location: d.location || d.city || null,
            country: d.country || null,
            joinedAt: d.createdAt || null,
            accountStatus: d.accountStatus || d.status || null,
            verificationStatus: 'unverified',
            propertiesCount: 0,
            activitiesCount: 0,
            propertyBookingsCount: 0,
            activityBookingsCount: 0,
            totalBookingsCount: 0,
          });
        }
      });

      // B. Incorporate verifications (which might include hosts whose user role isn't explicitly 'host')
      verifsSnap.forEach((docSnap) => {
        const v = docSnap.data();
        const userId = v.userId || docSnap.id;
        let host = hostsMap.get(userId);

        if (!host) {
          host = {
            uid: userId,
            name: v.hostName || 'Unnamed Host',
            email: v.userEmail || '',
            photoURL: v.docPhotoUrl || null,
            phoneNumber: v.phoneNumber || null,
            location: v.utilityBillAddress || null,
            country: v.nationality || null,
            joinedAt: v.createdAt || null,
            verificationStatus: 'unverified',
            propertiesCount: 0,
            activitiesCount: 0,
            propertyBookingsCount: 0,
            activityBookingsCount: 0,
            totalBookingsCount: 0,
          };
          hostsMap.set(userId, host);
        }

        // Attach verification details
        host.verificationId = docSnap.id;
        const expiryCalc = calculateDocumentExpiry(v.expiryDate);
        host.isExpired = expiryCalc.isExpired;
        host.expiryStatus = expiryCalc.expiryStatus;
        host.inGracePeriod = expiryCalc.inGracePeriod;
        host.gracePeriodDaysRemaining = expiryCalc.gracePeriodDaysRemaining;
        host.suspensionEffectiveDate = expiryCalc.suspensionEffectiveDate;
        host.isSuspended = expiryCalc.isSuspended;
        host.expiryDate = v.expiryDate;
        host.docType = v.docType;
        host.docNumber = v.docNumber;
        host.submittedAt = v.createdAt;
        host.reviewedAt = v.reviewedAt;
        host.reviewedBy = v.reviewedBy;
        host.adminNotes = v.adminNotes;

        // Preserve manual safety/misconduct suspension, else enforce automatic suspension after grace period
        if (host.accountStatus === 'suspended') {
          host.verificationStatus = 'suspended';
          host.suspensionReason = host.suspensionReason || 'safety';
        } else if (v.status === 'suspended') {
          host.verificationStatus = 'suspended';
        } else if (expiryCalc.isSuspended && v.status === 'verified') {
          host.verificationStatus = 'suspended';
          host.suspensionReason = 'document_expired';
        } else {
          host.verificationStatus = v.status || 'pending';
        }
        if (!host.name || host.name === 'Unnamed Host') {
          host.name = v.hostName || host.name;
        }
        if (!host.phoneNumber) {
          host.phoneNumber = v.phoneNumber;
        }
        if (!host.email && v.userEmail) {
          host.email = v.userEmail;
        }
      });

      // C. Count properties per host and map listingId -> hostId
      const listingHostMap = new Map<string, string>();
      listingsSnap.forEach((docSnap) => {
        const l = docSnap.data();
        const hostId = l.hostId;
        if (hostId) {
          listingHostMap.set(docSnap.id, hostId);
          let host = hostsMap.get(hostId);
          if (!host) {
            host = {
              uid: hostId,
              name: l.hostName || 'Property Host',
              email: '',
              photoURL: l.hostPhoto || null,
              joinedAt: l.createdAt || null,
              verificationStatus: l.isHostVerified ? 'verified' : 'unverified',
              propertiesCount: 0,
              activitiesCount: 0,
              propertyBookingsCount: 0,
              activityBookingsCount: 0,
              totalBookingsCount: 0,
            };
            hostsMap.set(hostId, host);
          }
          host.propertiesCount++;
        }
      });

      // D. Count activities per host
      actsSnap.forEach((docSnap) => {
        const a = docSnap.data();
        const hostId = a.hostId;
        if (hostId) {
          let host = hostsMap.get(hostId);
          if (!host) {
            host = {
              uid: hostId,
              name: a.hostName || 'Activity Host',
              email: a.hostEmail || '',
              phoneNumber: a.hostPhone || null,
              joinedAt: a.createdAt || null,
              verificationStatus: 'unverified',
              propertiesCount: 0,
              activitiesCount: 0,
              propertyBookingsCount: 0,
              activityBookingsCount: 0,
              totalBookingsCount: 0,
            };
            hostsMap.set(hostId, host);
          }
          host.activitiesCount++;
        }
      });

      // E. Count property bookings per host
      bookingsSnap.forEach((docSnap) => {
        const b = docSnap.data();
        const listingId = b.listingId;
        const hostId = listingHostMap.get(listingId);
        if (hostId && hostsMap.has(hostId)) {
          const host = hostsMap.get(hostId)!;
          host.propertyBookingsCount++;
          host.totalBookingsCount++;
        }
      });

      // F. Count activity bookings per host
      actBookingsSnap.forEach((docSnap: any) => {
        const ab = docSnap.data();
        const hostId = ab.hostId;
        if (hostId && hostsMap.has(hostId)) {
          const host = hostsMap.get(hostId)!;
          host.activityBookingsCount++;
          host.totalBookingsCount++;
        }
      });

      return Array.from(hostsMap.values());
    } catch (err) {
      console.error('Failed to load hosts from Firestore:', err);
      return [];
    }
  },

  /**
   * Fetch all real property listings from the listings collection and cross-reference
   * with booking data and host information.
   */
  async getAllProperties(): Promise<AdminProperty[]> {
    try {
      const [listingsSnap, bookingsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'listings')),
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'users')),
      ]);

      // Map users for host email lookup if missing on listing
      const userMap = new Map<string, { email?: string; displayName?: string; photoURL?: string }>();
      usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        userMap.set(uDoc.id, {
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
        });
      });

      // Aggregate bookings by listingId
      const todayIso = new Date().toISOString().split('T')[0];
      const bookingsByListing = new Map<string, { total: number; upcoming: number }>();
      bookingsSnap.forEach((bDoc) => {
        const b = bDoc.data();
        const lId = b.listingId;
        if (lId) {
          const curr = bookingsByListing.get(lId) || { total: 0, upcoming: 0 };
          curr.total++;
          const checkIn = b.startDate || b.checkIn;
          if (checkIn && checkIn >= todayIso) {
            curr.upcoming++;
          }
          bookingsByListing.set(lId, curr);
        }
      });

      const properties: AdminProperty[] = [];
      listingsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const bStats = bookingsByListing.get(docSnap.id) || { total: 0, upcoming: 0 };
        const hostUser = userMap.get(data.hostId);

        let statusVal = 'published';
        if (data.status) {
          statusVal = String(data.status).toLowerCase();
        } else if (data.published === false || data.active === false) {
          statusVal = 'inactive';
        }

        properties.push({
          id: docSnap.id,
          title: data.title || 'Untitled Property',
          description: data.description || '',
          location: data.location || '',
          city: data.city || '',
          province: data.province || '',
          country: data.country || 'Mozambique',
          residenceType: data.residenceType || data.category || 'stay',
          category: data.category || data.residenceType || 'stay',
          price: Number(data.price) || 0,
          currency: data.currency || 'MZN',
          status: statusVal,
          hostId: data.hostId || '',
          hostName: data.hostName || hostUser?.displayName || 'Host',
          hostEmail: hostUser?.email || '',
          hostPhoto: data.hostPhoto || hostUser?.photoURL || undefined,
          isHostVerified: data.isHostVerified || false,
          images: Array.isArray(data.images) ? data.images : [],
          labeledImages: Array.isArray(data.labeledImages) ? data.labeledImages : [],
          coordinates: data.coordinates || undefined,
          minNights: data.minNights,
          maxGuests: data.maxGuests,
          bedrooms: data.bedrooms,
          beds: data.beds,
          bathrooms: data.bathrooms,
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          specialOffer: data.specialOffer || null,
          accommodations: Array.isArray(data.accommodations) ? data.accommodations : [],
          totalLodgeUnits: data.totalLodgeUnits,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          totalBookings: bStats.total,
          upcomingBookings: bStats.upcoming,
        });
      });

      return properties;
    } catch (err) {
      console.error('Failed to load properties from Firestore:', err);
      return [];
    }
  },

  /**
   * Fetch all real host-created activities & trips and cross-reference with
   * activity bookings and host compliance verification.
   */
  async getAllActivities(): Promise<AdminActivityTrip[]> {
    try {
      const [items, bookingsSnap, usersSnap, verifsSnap] = await Promise.all([
        getActivitiesTrips({ includeUnpublished: true }),
        getDocs(collection(db, 'activity_bookings')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'users')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'verifications')).catch(() => ({ docs: [], forEach: () => {} })),
      ]);

      // Map verified hosts
      const verifiedHosts = new Set<string>();
      verifsSnap.forEach((vDoc: any) => {
        const v = vDoc.data();
        if (v.status === 'verified') {
          verifiedHosts.add(v.userId || vDoc.id);
        }
      });
      usersSnap.forEach((uDoc: any) => {
        const u = uDoc.data();
        if (u.verificationStatus === 'verified') {
          verifiedHosts.add(uDoc.id);
        }
      });

      // Map bookings
      const todayIso = new Date().toISOString().split('T')[0];
      const bookingsByActivity = new Map<string, { total: number; upcoming: number }>();

      bookingsSnap.forEach((bDoc: any) => {
        const b = bDoc.data();
        const actId = b.activityId;
        if (actId) {
          const curr = bookingsByActivity.get(actId) || { total: 0, upcoming: 0 };
          curr.total++;
          if (b.date && b.date >= todayIso && b.status !== 'cancelled') {
            curr.upcoming++;
          }
          bookingsByActivity.set(actId, curr);
        }
      });

      // Local storage fallback for bookings
      try {
        const raw = localStorage.getItem('mozbook_activity_bookings');
        if (raw) {
          const localBookings = JSON.parse(raw);
          if (Array.isArray(localBookings)) {
            localBookings.forEach((b: any) => {
              const actId = b.activityId;
              if (actId && !bookingsByActivity.has(actId)) {
                const curr = bookingsByActivity.get(actId) || { total: 0, upcoming: 0 };
                curr.total++;
                if (b.date && b.date >= todayIso && b.status !== 'cancelled') {
                  curr.upcoming++;
                }
                bookingsByActivity.set(actId, curr);
              }
            });
          }
        }
      } catch {
        // ignore
      }

      return items.map((item) => {
        const bStats = bookingsByActivity.get(item.id) || { total: 0, upcoming: 0 };
        const isHostVer = verifiedHosts.has(item.hostId);

        return {
          id: item.id,
          hostId: item.hostId,
          hostName: item.hostName || 'Host',
          hostEmail: item.hostEmail,
          hostPhone: item.hostPhone,
          isHostVerified: isHostVer,
          type: item.type || 'activity',
          title: item.title,
          shortDescription: item.shortDescription,
          description: item.description,
          category: item.category,
          customCategory: item.customCategory,
          city: item.city,
          meetingPoint: item.meetingPoint,
          meetingPointInstructions: item.meetingPointInstructions,
          coordinates: item.coordinates,
          pickup: item.pickup,
          duration: item.duration,
          multiDayDetails: item.multiDayDetails,
          scheduleType: item.scheduleType,
          recurringDays: item.recurringDays,
          startTimes: item.startTimes,
          specificDates: item.specificDates,
          maxGuests: item.maxGuests,
          minGuests: item.minGuests,
          pricingType: item.pricingType,
          priceAdult: item.priceAdult,
          priceChild: item.priceChild,
          priceGroup: item.priceGroup,
          groupMaxGuests: item.groupMaxGuests,
          pricePerBooking: item.pricePerBooking,
          currency: item.currency || 'MZN',
          specialOffer: item.specialOffer,
          images: Array.isArray(item.images) ? item.images : [],
          coverImage: item.coverImage,
          videos: item.videos,
          vehicleType: item.vehicleType,
          included: Array.isArray(item.included) ? item.included : [],
          notIncluded: Array.isArray(item.notIncluded) ? item.notIncluded : [],
          whatToBring: Array.isArray(item.whatToBring) ? item.whatToBring : [],
          requirements: Array.isArray(item.requirements) ? item.requirements : [],
          status: item.status || 'published',
          rating: item.rating,
          reviewsCount: item.reviewsCount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          totalBookings: bStats.total,
          upcomingBookings: bStats.upcoming,
        };
      });
    } catch (err) {
      console.error('Failed to load activities & trips for admin:', err);
      return [];
    }
  },

  /**
   * Load unified bookings across accommodations ('bookings') and experiences ('activity_bookings').
   * Authoritatively joins listing/activity metadata, host verification status, and customer details.
   */
  async getAllBookings(): Promise<AdminUnifiedBooking[]> {
    try {
      const [staySnap, actSnap, listingsSnap, actsSnap, usersSnap, verifsSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'activity_bookings')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'listings')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'activities_trips')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'users')).catch(() => ({ docs: [], forEach: () => {} })),
        getDocs(collection(db, 'verifications')).catch(() => ({ docs: [], forEach: () => {} }))
      ]);

      // Maps for fast lookups
      const listingsMap = new Map<string, any>();
      listingsSnap.forEach((d: any) => listingsMap.set(d.id, { id: d.id, ...d.data() }));

      const activitiesMap = new Map<string, any>();
      actsSnap.forEach((d: any) => activitiesMap.set(d.id, { id: d.id, ...d.data() }));

      const usersMap = new Map<string, any>();
      usersSnap.forEach((d: any) => usersMap.set(d.id, { uid: d.id, ...d.data() }));

      const verifiedHostsSet = new Set<string>();
      verifsSnap.forEach((d: any) => {
        const vData = d.data();
        if (vData.status === 'verified' && vData.userId) {
          verifiedHostsSet.add(vData.userId);
        }
      });

      const unified: AdminUnifiedBooking[] = [];

      // 1. Process Stays (Property Reservations)
      staySnap.forEach((docSnap: any) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const listing = listingsMap.get(data.listingId);
        const hostUser = data.hostId ? usersMap.get(data.hostId) : (listing ? usersMap.get(listing.hostId) : null);
        const customerUser = data.userId ? usersMap.get(data.userId) : null;

        const effectiveHostId = data.hostId || listing?.hostId || '';
        const isHostVerified = verifiedHostsSet.has(effectiveHostId) || listing?.isHostVerified || false;

        const bookingRef = data.bookingRef || `MB-STAY-${id.slice(0, 8).toUpperCase()}`;

        unified.push({
          id,
          bookingRef,
          category: 'stay',
          sourceCollection: 'bookings',

          targetId: data.listingId || '',
          targetTitle: data.listingTitle || listing?.title || 'Accommodation Reservation',
          targetCity: data.listingCity || listing?.city || listing?.province || '',
          targetLocation: data.listingLocation || listing?.location || '',
          targetImage: data.listingImage || (listing?.images && listing.images[0]) || '',

          hostId: effectiveHostId,
          hostName: hostUser?.displayName || hostUser?.name || listing?.hostName || 'Host Partner',
          hostEmail: hostUser?.email || listing?.hostEmail || '',
          hostPhone: hostUser?.phoneNumber || hostUser?.phone || '',
          isHostVerified,

          userId: data.userId || '',
          customerName: data.customerName || customerUser?.displayName || customerUser?.name || 'Guest Traveler',
          customerEmail: data.customerEmail || customerUser?.email || '',
          customerPhone: data.customerPhone || customerUser?.phoneNumber || '',

          startDate: data.startDate || data.checkInDate || '',
          endDate: data.endDate || data.checkOutDate || '',
          nights: data.nights || 1,

          adults: Number(data.adults || 1),
          children: Number(data.children || 0),
          totalGuests: Number(data.totalGuests || (Number(data.adults || 1) + Number(data.children || 0))),

          totalAmount: Number(data.totalAmount || 0),
          currency: data.currency || 'MZN',
          nightlyRate: data.nightlyRate ? Number(data.nightlyRate) : undefined,
          cleaningFee: data.cleaningFee ? Number(data.cleaningFee) : undefined,
          serviceFee: data.serviceFee ? Number(data.serviceFee) : undefined,

          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'unpaid',
          fulfillmentStatus: data.fulfillmentStatus || 'unfulfilled',

          travelGroupId: data.travelGroupId,
          accommodationId: data.accommodationId,
          accommodationName: data.accommodationName,

          cancellationInitiator: data.cancellationInitiator,
          cancellationReason: data.cancellationReason,
          operatorFailureNotes: data.operatorFailureNotes,
          customerProtectionRefundMzn: data.customerProtectionRefundMzn ? Number(data.customerProtectionRefundMzn) : undefined,
          inventoryFailureDebitMzn: data.inventoryFailureDebitMzn ? Number(data.inventoryFailureDebitMzn) : undefined,
          cancellationSnapshot: data.cancellationSnapshot,
          cancellationSettlement: data.cancellationSettlement,
          isDisputed: Boolean(data.isDisputed),
          disputeStatus: data.disputeStatus,
          disputeReason: data.disputeReason,

          createdAt: data.createdAt || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          updatedAt: data.updatedAt || ''
        });
      });

      // 2. Process Experiences (Activity & Trip Bookings)
      actSnap.forEach((docSnap: any) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const act = activitiesMap.get(data.activityId);
        const hostUser = data.hostId ? usersMap.get(data.hostId) : (act ? usersMap.get(act.hostId) : null);
        const customerUser = data.userId ? usersMap.get(data.userId) : null;

        const effectiveHostId = data.hostId || act?.hostId || '';
        const isHostVerified = verifiedHostsSet.has(effectiveHostId) || act?.isHostVerified || false;

        const rawCat = data.activityType || act?.type || 'activity';
        const category: AdminBookingCategory = rawCat === 'trip' ? 'trip' : (rawCat === 'transport' ? 'transport' : 'activity');

        const bookingRef = data.bookingRef || `MB-EXP-${id.slice(0, 8).toUpperCase()}`;

        unified.push({
          id,
          bookingRef,
          category,
          sourceCollection: 'activity_bookings',

          targetId: data.activityId || '',
          targetTitle: data.activityTitle || act?.title || 'Experience Booking',
          targetCity: data.city || act?.city || '',
          targetLocation: act?.meetingPoint || '',
          targetImage: (act?.images && act.images[0]) || act?.coverImage || '',

          hostId: effectiveHostId,
          hostName: data.hostName || hostUser?.displayName || hostUser?.name || act?.hostName || 'Experience Operator',
          hostEmail: hostUser?.email || act?.hostEmail || '',
          hostPhone: hostUser?.phoneNumber || hostUser?.phone || act?.hostPhone || '',
          isHostVerified,

          userId: data.userId || '',
          customerName: data.customerName || customerUser?.displayName || customerUser?.name || 'Traveler',
          customerEmail: data.customerEmail || customerUser?.email || '',
          customerPhone: data.customerPhone || customerUser?.phoneNumber || '',

          startDate: data.date || '',
          endDate: data.date || '',
          time: data.time || '',

          adults: Number(data.adults || 1),
          children: Number(data.children || 0),
          totalGuests: Number(data.totalGuests || (Number(data.adults || 1) + Number(data.children || 0))),

          totalAmount: Number(data.totalMzn || data.totalAmount || 0),
          currency: 'MZN',
          pricingType: data.pricingType,

          status: data.status || 'pending',
          paymentStatus: data.paymentStatus || 'unpaid',
          fulfillmentStatus: data.fulfillmentStatus || 'unfulfilled',

          travelGroupId: data.travelGroupId,

          cancellationInitiator: data.cancellationInitiator,
          cancellationReason: data.cancellationReason,
          operatorFailureNotes: data.operatorFailureNotes,
          customerProtectionRefundMzn: data.customerProtectionRefundMzn ? Number(data.customerProtectionRefundMzn) : undefined,
          inventoryFailureDebitMzn: data.inventoryFailureDebitMzn ? Number(data.inventoryFailureDebitMzn) : undefined,
          cancellationSnapshot: data.cancellationSnapshot,
          cancellationSettlement: data.cancellationSettlement,
          isDisputed: Boolean(data.isDisputed),
          disputeStatus: data.disputeStatus,
          disputeReason: data.disputeReason,

          isWeatherDependent: data.isWeatherDependent,
          weatherStatus: data.weatherStatus,
          rescheduledFromDate: data.rescheduledFromDate,
          rescheduledToDate: data.rescheduledToDate,
          rescheduledAt: data.rescheduledAt,
          rescheduledBy: data.rescheduledBy,
          rescheduleNotes: data.rescheduleNotes,

          createdAt: data.createdAt || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
          updatedAt: data.updatedAt || ''
        });
      });

      // Sort descending by creation date
      unified.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      return unified;
    } catch (err) {
      console.error('Failed to load unified bookings for admin:', err);
      return [];
    }
  },

  /**
   * Authoritatively execute cancellation via backend API with admin credentials.
   */
  async cancelBooking(params: {
    bookingId: string;
    bookingCategory: 'stay' | 'activity' | 'trip' | 'transport';
    cancellationReason: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'force_majeure' | 'other';
    notes?: string;
  }): Promise<{ success: boolean; message?: string; refundInitiated?: boolean; refundAmountMzn?: number }> {
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken().catch(() => '');
    }

    const res = await fetch('/api/partner/bookings/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        'x-user-id': auth.currentUser?.uid || 'admin',
        'x-user-email': auth.currentUser?.email || 'mozbookinfo@gmail.com'
      },
      body: JSON.stringify({
        bookingId: params.bookingId,
        bookingCategory: params.bookingCategory === 'stay' ? 'stay' : (params.bookingCategory === 'trip' ? 'trip' : 'activity'),
        cancellationReason: params.cancellationReason,
        notes: params.notes || ''
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Failed to cancel booking (HTTP ${res.status})`);
    }

    return {
      success: true,
      message: data?.message || 'Booking cancelled authoritatively.',
      refundInitiated: Boolean(data?.refundInitiated),
      refundAmountMzn: data?.refundAmountMzn
    };
  },

  /**
   * Authoritatively reschedule experience booking via backend API.
   */
  async rescheduleBooking(params: {
    bookingId: string;
    newDate: string;
    newTime?: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string }> {
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken().catch(() => '');
    }

    const res = await fetch('/api/bookings/reschedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        'x-user-id': auth.currentUser?.uid || 'admin',
        'x-user-email': auth.currentUser?.email || 'mozbookinfo@gmail.com'
      },
      body: JSON.stringify({
        bookingId: params.bookingId,
        newDate: params.newDate,
        newTime: params.newTime || '',
        notes: params.notes || '',
        initiatedBy: 'admin'
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `Failed to reschedule booking (HTTP ${res.status})`);
    }

    return {
      success: true,
      message: data?.message || 'Booking rescheduled authoritatively.'
    };
  },

  /**
   * Retrieves authoritative financial overview and transaction ledger for admin console.
   * Pulls from server endpoint /api/admin/financials/overview with full deduplication,
   * falling back to authenticated Firestore collections.
   */
  async getFinancialSummary(): Promise<{ summary: AdminFinancialSummary; transactions: AdminFinancialTransaction[] }> {
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken().catch(() => '');
    }

    try {
      const res = await fetch('/api/admin/financials/overview', {
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': auth.currentUser?.uid || 'admin',
          'x-user-email': auth.currentUser?.email || 'mozbookinfo@gmail.com'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.summary) {
          return {
            summary: data.summary,
            transactions: data.transactions || []
          };
        }
      }
    } catch (e) {
      console.warn('API /api/admin/financials/overview unavailable, running client fallback:', e);
    }

    // Direct Firestore fallback for client hydration or offline dev
    try {
      const [
        bookingsSnap,
        actBookingsSnap,
        paymentsSnap,
        refundsSnap,
        payoutsSnap,
        debitsSnap
      ] = await Promise.all([
        getDocs(collection(db, 'bookings')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'activity_bookings')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'payments')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'refunds')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'payout_requests')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'operator_inventory_debits')).catch(() => ({ docs: [] } as any))
      ]);

      let totalBookingValue = 0;
      let totalBookingsCount = 0;
      let confirmedBookingValue = 0;
      let confirmedBookingsCount = 0;
      let pendingBookingValue = 0;
      let pendingBookingsCount = 0;
      let cancelledBookingValue = 0;
      let cancelledBookingsCount = 0;
      let completedBookingValue = 0;
      let completedBookingsCount = 0;
      let unpaidBookingsValue = 0;
      let unpaidBookingsCount = 0;

      const processBooking = (d: any) => {
        const amt = Number(d.totalMzn || d.totalAmount || 0);
        const status = (d.status || 'pending').toLowerCase();
        const payStatus = (d.paymentStatus || 'unpaid').toLowerCase();

        totalBookingValue += amt;
        totalBookingsCount++;

        if (status === 'confirmed') {
          confirmedBookingValue += amt;
          confirmedBookingsCount++;
        } else if (status === 'completed') {
          completedBookingValue += amt;
          completedBookingsCount++;
        } else if (status === 'cancelled') {
          cancelledBookingValue += amt;
          cancelledBookingsCount++;
        } else {
          pendingBookingValue += amt;
          pendingBookingsCount++;
        }

        if ((status === 'confirmed' || status === 'completed') && payStatus !== 'paid') {
          unpaidBookingsValue += amt;
          unpaidBookingsCount++;
        }
      };

      bookingsSnap.docs.forEach((doc: any) => processBooking(doc.data()));
      actBookingsSnap.docs.forEach((doc: any) => processBooking(doc.data()));

      let duplicateTransactionsDetected = 0;
      const seenPaymentIds = new Set<string>();
      const seenPaySuitePaymentIds = new Set<string>();
      const seenIdempotencyKeys = new Set<string>();

      let grossCollectedAmount = 0;
      let paidPaymentsCount = 0;
      let pendingPaymentsAmount = 0;
      let pendingPaymentsCount = 0;
      let failedPaymentsAmount = 0;
      let failedPaymentsCount = 0;

      const transactions: AdminFinancialTransaction[] = [];

      paymentsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const psId = d.paysuitePaymentId;
        const idempKey = d.idempotencyKey;

        if (
          seenPaymentIds.has(id) ||
          (psId && seenPaySuitePaymentIds.has(psId)) ||
          (idempKey && seenIdempotencyKeys.has(idempKey))
        ) {
          duplicateTransactionsDetected++;
          return;
        }

        seenPaymentIds.add(id);
        if (psId) seenPaySuitePaymentIds.add(psId);
        if (idempKey) seenIdempotencyKeys.add(idempKey);

        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'paid') {
          grossCollectedAmount += amt;
          paidPaymentsCount++;
        } else if (status === 'pending' || status === 'initiated') {
          pendingPaymentsAmount += amt;
          pendingPaymentsCount++;
        } else if (status === 'failed') {
          failedPaymentsAmount += amt;
          failedPaymentsCount++;
        }

        const comm = Math.round(amt * 0.15);
        const part = amt - comm;

        transactions.push({
          id,
          type: 'payment',
          reference: d.bookingRef || `PAY-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'stay',
          payerOrBeneficiary: d.payerName || d.payerEmail || 'Traveler',
          payerEmail: d.payerEmail,
          hostId: d.hostId,
          amount: amt,
          currency: 'MZN',
          status,
          paymentMethod: d.paymentMethod,
          gatewayTransactionId: d.paysuiteTransactionId,
          gatewayPaymentId: d.paysuitePaymentId,
          commissionMzn: comm,
          partnerShareMzn: part,
          createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
          notes: d.failureReason || (status === 'paid' ? 'Settled via PaySuite' : undefined)
        });
      });

      const seenRefundIds = new Set<string>();
      const seenPaySuiteRefundIds = new Set<string>();

      let totalCompletedRefundsAmount = 0;
      let completedRefundsCount = 0;
      let inProgressRefundsAmount = 0;
      let inProgressRefundsCount = 0;
      let failedRefundsAmount = 0;
      let failedRefundsCount = 0;

      refundsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const psRefId = d.paysuiteRefundId;

        if (
          seenRefundIds.has(id) ||
          (psRefId && seenPaySuiteRefundIds.has(psRefId))
        ) {
          duplicateTransactionsDetected++;
          return;
        }

        seenRefundIds.add(id);
        if (psRefId) seenPaySuiteRefundIds.add(psRefId);

        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'completed') {
          totalCompletedRefundsAmount += amt;
          completedRefundsCount++;
        } else if (status === 'processing' || status === 'pending') {
          inProgressRefundsAmount += amt;
          inProgressRefundsCount++;
        } else if (status === 'failed') {
          failedRefundsAmount += amt;
          failedRefundsCount++;
        }

        const commAdj = d.commissionAdjustmentMzn ? Number(d.commissionAdjustmentMzn) : Math.round(amt * 0.15);
        const partAdj = d.partnerShareAdjustmentMzn ? Number(d.partnerShareAdjustmentMzn) : (amt - commAdj);

        transactions.push({
          id,
          type: 'refund',
          reference: d.bookingRef ? `REF-${d.bookingRef}` : `REF-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'stay',
          payerOrBeneficiary: d.requestedByRole === 'customer' ? 'Customer Refund' : (d.requestedByRole === 'admin' ? 'Admin Action' : 'Operator Incident'),
          hostId: d.hostId,
          amount: amt,
          currency: 'MZN',
          status,
          gatewayTransactionId: d.paysuiteRefundId,
          commissionMzn: commAdj,
          partnerShareMzn: partAdj,
          createdAt: d.createdAt || new Date().toISOString(),
          notes: d.reason || d.failureReason
        });
      });

      let operatorDebitsAmount = 0;
      let operatorDebitsCount = 0;

      debitsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const status = (d.status || 'pending').toLowerCase();
        const debitAmt = Number(d.debitAmountMzn || 0);

        if (status === 'applied') {
          operatorDebitsAmount += debitAmt;
          operatorDebitsCount++;
        }

        transactions.push({
          id,
          type: 'debit',
          reference: `DEB-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'activity',
          targetTitle: d.offeringTitle,
          payerOrBeneficiary: d.hostName || d.hostId || 'Operator',
          hostId: d.hostId,
          hostName: d.hostName,
          amount: debitAmt,
          currency: 'MZN',
          status,
          createdAt: d.createdAt || new Date().toISOString(),
          notes: `Inventory failure debit: ${d.reason || 'unfulfilled inventory'}`
        });
      });

      let completedPayoutsAmount = 0;
      let completedPayoutsCount = 0;
      let pendingPayoutsAmount = 0;
      let pendingPayoutsCount = 0;

      payoutsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'completed') {
          completedPayoutsAmount += amt;
          completedPayoutsCount++;
        } else if (status === 'pending' || status === 'requested') {
          pendingPayoutsAmount += amt;
          pendingPayoutsCount++;
        }

        transactions.push({
          id,
          type: 'payout',
          reference: d.reference || `PO-${id.slice(0, 8).toUpperCase()}`,
          payerOrBeneficiary: d.hostName || d.beneficiary?.holder || 'Partner Host',
          hostId: d.hostId,
          hostName: d.hostName,
          amount: amt,
          currency: 'MZN',
          status,
          paymentMethod: d.method,
          gatewayTransactionId: d.paysuitePayoutId,
          createdAt: d.requestedAt || d.createdAt || new Date().toISOString(),
          notes: d.description || d.failureReason
        });
      });

      const netCollectedAmount = Math.max(0, grossCollectedAmount - totalCompletedRefundsAmount);
      const grossPlatformCommission = Math.round(grossCollectedAmount * 0.15);
      const commissionReversals = Math.round(totalCompletedRefundsAmount * 0.15);
      const netPlatformRevenue = Math.max(0, grossPlatformCommission - commissionReversals);

      const grossPartnerShare = grossCollectedAmount - grossPlatformCommission;
      const partnerRefundReversals = totalCompletedRefundsAmount - commissionReversals;
      const netPartnerEarnings = Math.max(0, grossPartnerShare - partnerRefundReversals - operatorDebitsAmount);
      const retainedPartnerBalance = Math.max(0, netPartnerEarnings - completedPayoutsAmount);

      transactions.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      return {
        summary: {
          pipeline: {
            totalBookingValue,
            totalBookingsCount,
            confirmedBookingValue,
            confirmedBookingsCount,
            pendingBookingValue,
            pendingBookingsCount,
            cancelledBookingValue,
            cancelledBookingsCount,
            completedBookingValue,
            completedBookingsCount,
          },
          collections: {
            grossCollectedAmount,
            paidPaymentsCount,
            pendingPaymentsAmount,
            pendingPaymentsCount,
            failedPaymentsAmount,
            failedPaymentsCount,
            netCollectedAmount,
          },
          refunds: {
            totalCompletedRefundsAmount,
            completedRefundsCount,
            inProgressRefundsAmount,
            inProgressRefundsCount,
            failedRefundsAmount,
            failedRefundsCount,
          },
          platformRevenue: {
            commissionRate: 0.15,
            commissionPercent: 15,
            grossPlatformCommission,
            commissionReversals,
            netPlatformRevenue,
          },
          partnerSettlement: {
            partnerShareRate: 0.85,
            partnerSharePercent: 85,
            grossPartnerShare,
            partnerRefundReversals,
            operatorDebitsAmount,
            operatorDebitsCount,
            netPartnerEarnings,
            completedPayoutsAmount,
            completedPayoutsCount,
            pendingPayoutsAmount,
            pendingPayoutsCount,
            retainedPartnerBalance,
          },
          reconciliation: {
            unpaidBookingsValue,
            unpaidBookingsCount,
            duplicateTransactionsDetected,
            currency: 'MZN',
            lastReconciledAt: new Date().toISOString(),
            isDataAvailable: true,
          }
        },
        transactions
      };
    } catch (err) {
      console.error('Failed to load financial records from Firestore:', err);
      return {
        summary: {
          pipeline: { totalBookingValue: 0, totalBookingsCount: 0, confirmedBookingValue: 0, confirmedBookingsCount: 0, pendingBookingValue: 0, pendingBookingsCount: 0, cancelledBookingValue: 0, cancelledBookingsCount: 0, completedBookingValue: 0, completedBookingsCount: 0 },
          collections: { grossCollectedAmount: 0, paidPaymentsCount: 0, pendingPaymentsAmount: 0, pendingPaymentsCount: 0, failedPaymentsAmount: 0, failedPaymentsCount: 0, netCollectedAmount: 0 },
          refunds: { totalCompletedRefundsAmount: 0, completedRefundsCount: 0, inProgressRefundsAmount: 0, inProgressRefundsCount: 0, failedRefundsAmount: 0, failedRefundsCount: 0 },
          platformRevenue: { commissionRate: 0.15, commissionPercent: 15, grossPlatformCommission: 0, commissionReversals: 0, netPlatformRevenue: 0 },
          partnerSettlement: { partnerShareRate: 0.85, partnerSharePercent: 85, grossPartnerShare: 0, partnerRefundReversals: 0, operatorDebitsAmount: 0, operatorDebitsCount: 0, netPartnerEarnings: 0, completedPayoutsAmount: 0, completedPayoutsCount: 0, pendingPayoutsAmount: 0, pendingPayoutsCount: 0, retainedPartnerBalance: 0 },
          reconciliation: { unpaidBookingsValue: 0, unpaidBookingsCount: 0, duplicateTransactionsDetected: 0, currency: 'MZN', lastReconciledAt: new Date().toISOString(), isDataAvailable: false }
        },
        transactions: []
      };
    }
  }
};
