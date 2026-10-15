/**
 * MozBook Authoritative Server-Side Inventory & Concurrency Engine (Prompt 28C)
 *
 * ARCHITECTURAL REQUIREMENTS:
 * 1. Concurrency Safety: Atomic checks prevent double-booking the final seat or unit.
 * 2. Temporary Holds: 15-minute hold matching the PaySuite payment intent window.
 * 3. Safe Release: Expired uncompleted holds or failed payments do not permanently consume inventory.
 * 4. Allocation Guard: Operators cannot reduce MozBook allocation below already-confirmed bookings.
 * 5. Privileged Execution: All writes use Firebase Admin SDK to bypass client-side tampering.
 */

import { getPrivilegedFirestore, isUserAdmin } from './paymentService';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { OperatorInventoryDebit } from '../types/payment';
import { createRefundRequest } from './paymentService';
import { 
  buildBookingCancellationSnapshot, 
  evaluateCancellationSettlement,
  CancellationInitiator,
  CancellationReasonType 
} from '../types/cancellationPolicy';

export const HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class InventoryError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'InventoryError';
  }
}

/**
 * Diagnostics helper: checks if an error is a gRPC PERMISSION_DENIED / IAM service account authorization error
 */
export function isPermissionDenied(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : (err.message || '');
  const details = typeof err.details === 'string' ? err.details : '';
  return msg.includes('PERMISSION_DENIED') ||
         err.code === 7 ||
         details.includes('PERMISSION_DENIED') ||
         msg.includes('Missing or insufficient permissions');
}

export interface MemorySlotHold {
  bookingId: string;
  customerUserId: string;
  seats?: number;
  units?: number;
  status: 'hold' | 'confirmed';
  holdExpiresAt: string;
  createdAt: string;
  paymentInFlight?: boolean;
  inFlightUntil?: string;
  confirmedAt?: string;
}

export interface MemorySlotState {
  id: string;
  itemId: string;
  date: string;
  confirmedSeats?: number;
  confirmedUnits?: number;
  holds: MemorySlotHold[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Authoritative in-memory atomic OCC inventory stores
export const memoryExperienceSlots = new Map<string, MemorySlotState>();
export const memoryStaySlots = new Map<string, MemorySlotState>();
export const memoryBookings = new Map<string, any>();
export const memorySuspendedHosts = new Set<string>();
export const memorySuspendedUsers = new Set<string>();

/**
 * Authoritative Customer Suspension Guard.
 * Enforces account suspension across all MozBook booking and reservation operations.
 * - Suspended customers cannot make new bookings.
 */
export async function assertCustomerNotSuspended(
  userId: string | undefined,
  adminDb?: any,
  transaction?: any
): Promise<void> {
  if (!userId) return;

  // 1. Authoritative in-memory customer suspension check
  if (memorySuspendedUsers.has(userId)) {
    throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
  }

  // 2. Authoritative Firestore check
  if (adminDb) {
    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = transaction ? await transaction.get(userRef) : await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data()!;
        if (userData.accountStatus === 'suspended' || userData.status === 'suspended') {
          throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
        }
      }
    } catch (err: any) {
      if (err instanceof InventoryError) throw err;
    }
  }
}

/**
 * Authoritative Host Suspension Guard.
 * Enforces account suspension across all MozBook booking and reservation operations.
 * - Suspended hosts (safety, misconduct, or document expiry past 90-day grace period)
 *   cannot have their listings or experiences booked or reserved.
 * - Leaves memory and Firestore stores completely pristine without creating holds or bookings.
 */
export async function assertHostNotSuspended(
  hostId: string | undefined,
  adminDb?: any,
  transaction?: any
): Promise<void> {
  if (!hostId) return;

  // 1. Authoritative in-memory suspension store check
  if (memorySuspendedHosts.has(hostId)) {
    throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
  }

  // 2. Authoritative Firestore check
  if (adminDb) {
    try {
      const userRef = adminDb.collection('users').doc(hostId);
      const userSnap = transaction ? await transaction.get(userRef) : await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data()!;
        if (userData.accountStatus === 'suspended' || userData.verificationStatus === 'suspended') {
          throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
        }
      }

      // Check verification documents for this host
      const verifQuery = adminDb.collection('verifications').where('userId', '==', hostId);
      const verifsSnap = transaction ? await transaction.get(verifQuery) : await verifQuery.get();
      if (verifsSnap && !verifsSnap.empty) {
        verifsSnap.forEach((vDoc: any) => {
          const v = vDoc.data();
          if (v.status === 'suspended') {
            throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
          }
          if (v.expiryDate) {
            // Check against Mozambique CAT timezone (UTC+2)
            const catToday = new Date(Date.now() + (2 * 3600000));
            catToday.setUTCHours(0, 0, 0, 0);
            const expDate = new Date(v.expiryDate);
            if (!isNaN(expDate.getTime())) {
              expDate.setUTCHours(0, 0, 0, 0);
              const diffDays = Math.ceil((expDate.getTime() - catToday.getTime()) / (1000 * 60 * 60 * 24));
              // Exceeded 90-day grace period
              if (diffDays < -90) {
                throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended due to expired credentials.');
              }
            }
          }
        });
      }
    } catch (err: any) {
      if (err instanceof InventoryError) throw err;
      // Continue if non-inventory error
    }
  }
}

/**
 * Server-authoritative in-memory OCC atomic reservation engine for experiences.
 * Guarantees zero overselling, 15-minute hold windows, and strict customer authentication.
 */
function reserveExperienceInventoryInMemory(
  params: ReserveExperienceParams,
  slotDocId: string,
  requestedSeats: number,
  bookingId: string,
  bookingRef: string,
  now: number,
  nowIso: string,
  holdExpiresAtIso: string
) {
  if (params.isCustomerSuspended || (params.customerUserId && memorySuspendedUsers.has(params.customerUserId))) {
    throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
  }

  if (params.isHostSuspended || (params.hostId && memorySuspendedHosts.has(params.hostId))) {
    throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
  }

  let slot = memoryExperienceSlots.get(slotDocId);
  if (!slot) {
    slot = {
      id: slotDocId,
      itemId: params.activityId,
      date: params.date,
      confirmedSeats: 0,
      holds: [],
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    memoryExperienceSlots.set(slotDocId, slot);
  }

  // Filter holds: purge expired holds
  const validHolds: MemorySlotHold[] = [];
  let reusableExistingBookingId: string | null = null;
  let totalCommittedSeats = slot.confirmedSeats || 0;

  for (const h of slot.holds) {
    const seats = Number(h.seats || 1);
    if (h.status === 'confirmed') {
      validHolds.push(h);
      totalCommittedSeats += seats;
    } else if (h.status === 'hold') {
      const expTime = new Date(h.holdExpiresAt || 0).getTime();
      const inFlightTime = h.paymentInFlight ? new Date(h.inFlightUntil || 0).getTime() : 0;
      const isStillValid = expTime > now || inFlightTime > now;
      if (isStillValid) {
        validHolds.push(h);
        totalCommittedSeats += seats;

        // Idempotent duplicate request by exact same customer
        if (
          h.customerUserId === params.customerUserId &&
          seats === requestedSeats &&
          !reusableExistingBookingId
        ) {
          reusableExistingBookingId = h.bookingId;
        }
      }
    }
  }

  if (reusableExistingBookingId && memoryBookings.has(reusableExistingBookingId)) {
    console.log(`[Inventory Engine] Reusing existing unexpired hold '${reusableExistingBookingId}' for user '${params.customerUserId}'`);
    return memoryBookings.get(reusableExistingBookingId);
  }

  const mozbookCapacity = 12; // Authoritative default slot capacity limit
  const remainingSeats = Math.max(0, mozbookCapacity - totalCommittedSeats);

  if (requestedSeats > remainingSeats) {
    console.warn(`[Inventory Conflict] Experience '${params.activityId}' date '${params.date}': requested ${requestedSeats}, remaining ${remainingSeats}/${mozbookCapacity}`);
    throw new InventoryError(
      409,
      `Insufficient capacity: only ${remainingSeats} seat(s) remaining on ${params.date}. Cannot reserve ${requestedSeats} seats.`
    );
  }

  const newBooking = {
    id: bookingId,
    bookingRef,
    activityId: params.activityId,
    activityTitle: params.activityTitle,
    activityType: params.activityType,
    hostId: params.hostId || 'host_wild_ocean',
    date: params.date,
    time: params.time || '',
    totalGuests: requestedSeats,
    adults: params.adults || requestedSeats,
    children: params.children || 0,
    userId: params.customerUserId,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
    totalMzn: Number(params.totalMzn),
    currency: 'MZN',
    pricingType: params.pricingType || 'per_person',
    travelGroupId: params.travelGroupId || null,
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'unfulfilled',
    isWeatherDependent: false,
    cancellationSnapshot: buildBookingCancellationSnapshot({
      tierId: 'flexible',
      startDate: params.date,
      startTime: params.time,
      isWeatherDependent: false,
      isNonRefundable: false
    }),
    holdExpiresAt: holdExpiresAtIso,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const newHold: MemorySlotHold = {
    bookingId,
    customerUserId: params.customerUserId,
    seats: requestedSeats,
    status: 'hold',
    holdExpiresAt: holdExpiresAtIso,
    createdAt: nowIso
  };

  validHolds.push(newHold);
  slot.holds = validHolds;
  slot.version++;
  slot.updatedAt = nowIso;

  memoryBookings.set(bookingId, newBooking);
  console.log(`[Inventory Atomic Lock] In-Memory OCC reserved ${requestedSeats} seat(s) on '${params.activityId}' on ${params.date}. Remaining: ${remainingSeats - requestedSeats}/${mozbookCapacity}`);

  return newBooking;
}

export interface ReserveExperienceParams {
  activityId: string;
  activityTitle: string;
  activityType: 'activity' | 'trip';
  hostId: string;
  date: string; // YYYY-MM-DD
  time?: string;
  totalGuests: number;
  adults?: number;
  children?: number;
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalMzn: number;
  pricingType?: string;
  travelGroupId?: string;
  idempotencyKey?: string;
  pickupRequested?: boolean;
  pickupNotes?: string;
  isHostSuspended?: boolean;
  isCustomerSuspended?: boolean;
}

export interface ReserveStayParams {
  listingId: string;
  listingTitle: string;
  hostId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  nights: number;
  adults: number;
  children: number;
  totalGuests: number;
  customerUserId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  accommodationId?: string;
  travelGroupId?: string;
  idempotencyKey?: string;
  isHostSuspended?: boolean;
  isCustomerSuspended?: boolean;
}

/**
 * Authoritatively reserves seats on an Experience (Activity/Tour) with atomic Firestore transaction concurrency protection.
 * Prevents concurrent travelers from overselling the final seat.
 */
export async function reserveExperienceInventory(params: ReserveExperienceParams) {
  // Enforce customer suspension safeguard prior to taking any locks
  if (params.isCustomerSuspended || (params.customerUserId && memorySuspendedUsers.has(params.customerUserId))) {
    throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
  }

  // Enforce host suspension safeguard prior to taking any locks
  if (params.isHostSuspended || (params.hostId && memorySuspendedHosts.has(params.hostId))) {
    throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const holdExpiresAtIso = new Date(now + HOLD_DURATION_MS).toISOString();
  const slotDocId = `${params.activityId}_${params.date}`;
  const requestedSeats = Number(params.totalGuests || 1);
  const bookingId = `bk_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bookingRef = 'MB-EXP-' + Math.floor(100000 + Math.random() * 900000);

  // Attempt privileged Firestore Admin transaction first
  try {
    const adminDb = getPrivilegedFirestore();
    const actRef = adminDb.collection('activities_trips').doc(params.activityId);
    const slotRef = adminDb.collection('inventory_experience_slots').doc(slotDocId);

    // 1. One-time seed of the inventory slot document if it does not exist yet
    const slotSnapBefore = await slotRef.get();
    if (!slotSnapBefore.exists) {
      const actDocSnap = await actRef.get();
      if (!actDocSnap.exists) {
        throw new InventoryError(404, `Experience '${params.activityId}' not found.`);
      }

      const bookingsSnap = await adminDb
        .collection('activity_bookings')
        .where('activityId', '==', params.activityId)
        .where('date', '==', params.date)
        .get();

      let initialConfirmedSeats = 0;
      const initialHolds: any[] = [];

      bookingsSnap.forEach((docSnap) => {
        const b = docSnap.data();
        if (b.status === 'cancelled') return;
        if (params.time && b.time && b.time !== params.time) return;

        const seats = Number(b.totalGuests || 1);
        if (b.status === 'confirmed' || b.status === 'completed') {
          initialConfirmedSeats += seats;
          initialHolds.push({
            bookingId: docSnap.id,
            customerUserId: b.userId || '',
            seats,
            status: 'confirmed',
            holdExpiresAt: nowIso,
            createdAt: b.createdAt || nowIso
          });
        } else if (b.status === 'pending' && b.paymentStatus !== 'failed') {
          const expiresAt = b.holdExpiresAt ? new Date(b.holdExpiresAt).getTime() : new Date(b.createdAt || 0).getTime() + HOLD_DURATION_MS;
          if (expiresAt > now) {
            initialHolds.push({
              bookingId: docSnap.id,
              customerUserId: b.userId || '',
              seats,
              status: 'hold',
              holdExpiresAt: new Date(expiresAt).toISOString(),
              createdAt: b.createdAt || nowIso
            });
          }
        }
      });

      await slotRef.set({
        activityId: params.activityId,
        date: params.date,
        confirmedSeats: initialConfirmedSeats,
        holds: initialHolds,
        createdAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });
    }

    const bDocRef = adminDb.collection('activity_bookings').doc(bookingId);

    // 2. ATOMIC FIRESTORE TRANSACTION — Guarantees zero overselling of final seat
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const actSnap = await transaction.get(actRef);
      if (!actSnap.exists) {
        throw new InventoryError(404, `Experience '${params.activityId}' not found.`);
      }
      const act = actSnap.data()!;

      // Enforce both customer and host suspension checks authoritatively
      await assertCustomerNotSuspended(params.customerUserId, adminDb, transaction);
      const hostId = act.hostId || params.hostId;
      await assertHostNotSuspended(hostId, adminDb, transaction);

      if (act.blockedDates && Array.isArray(act.blockedDates) && act.blockedDates.includes(params.date)) {
        throw new InventoryError(400, `The date ${params.date} has been blocked by the operator and is unavailable.`);
      }

      const totalPhysicalCapacity = Number(act.totalCapacity || act.maxGuests || 10);
      const mozbookCapacity = Number(
        act.mozbookAllocatedCapacity ? Math.min(totalPhysicalCapacity, act.mozbookAllocatedCapacity) : totalPhysicalCapacity
      );

      const slotSnap = await transaction.get(slotRef);
      const slotData = slotSnap.exists ? slotSnap.data()! : { confirmedSeats: 0, holds: [] };
      const rawHolds = Array.isArray(slotData.holds) ? slotData.holds : [];

      // Filter holds: purge expired holds
      const validHolds: any[] = [];
      let reusableExistingBookingId: string | null = null;
      let totalCommittedSeats = 0;

      for (const h of rawHolds) {
        const seats = Number(h.seats || 1);
        if (h.status === 'confirmed') {
          validHolds.push(h);
          totalCommittedSeats += seats;
        } else if (h.status === 'hold') {
          const expTime = new Date(h.holdExpiresAt || 0).getTime();
          const inFlightTime = h.paymentInFlight ? new Date(h.inFlightUntil || 0).getTime() : 0;
          const isStillValid = expTime > now || inFlightTime > now;
          if (isStillValid) {
            validHolds.push(h);
            totalCommittedSeats += seats;

            // Check idempotent duplicate request from exact same customer
            if (
              h.customerUserId === params.customerUserId &&
              seats === requestedSeats &&
              !reusableExistingBookingId
            ) {
              reusableExistingBookingId = h.bookingId;
            }
          }
        }
      }

      if (reusableExistingBookingId) {
        return { reusableBookingId: reusableExistingBookingId };
      }

      const remainingSeats = Math.max(0, mozbookCapacity - totalCommittedSeats);

      if (requestedSeats > remainingSeats) {
        console.warn(`[Inventory Conflict] Experience '${params.activityId}' date '${params.date}': requested ${requestedSeats}, remaining ${remainingSeats}/${mozbookCapacity}`);
        throw new InventoryError(
          409,
          `Insufficient capacity: only ${remainingSeats} seat(s) remaining on ${params.date}. Cannot reserve ${requestedSeats} seats.`
        );
      }

      // Authoritative pricing calculation strictly from trusted database activity record
      const effectiveAdultPrice = (act.specialOffer?.enabled && act.specialOffer.specialPrice && Number(act.specialOffer.specialPrice) > 0)
        ? Number(act.specialOffer.specialPrice)
        : Number(act.priceAdult || 0);

      const effectiveChildPrice = act.priceChild !== undefined
        ? Number(act.priceChild)
        : Math.round(effectiveAdultPrice * 0.6);

      const adultsCount = Math.max(0, Number(params.adults !== undefined ? params.adults : requestedSeats));
      const childrenCount = Math.max(0, Number(params.children !== undefined ? params.children : 0));

      let baseTotal = 0;
      const actPricingType = act.pricingType || params.pricingType || 'per_person';

      if (actPricingType === 'per_person') {
        baseTotal = (effectiveAdultPrice * adultsCount) + (effectiveChildPrice * childrenCount);
      } else if (actPricingType === 'per_group') {
        baseTotal = Number(act.priceGroup || effectiveAdultPrice);
      } else {
        baseTotal = Number(act.pricePerBooking || effectiveAdultPrice);
      }

      const pickupCost = (params.pickupRequested && act.pickup?.offered && act.pickup?.fee)
        ? Number(act.pickup.fee)
        : 0;

      const authoritativeTotalMzn = Math.max(1, Math.round(baseTotal + pickupCost));

      const newBooking = {
        id: bookingId,
        bookingRef,
        activityId: params.activityId,
        activityTitle: params.activityTitle,
        activityType: params.activityType,
        hostId: params.hostId || act.hostId || 'unknown_host',
        date: params.date,
        time: params.time || '',
        totalGuests: requestedSeats,
        adults: adultsCount,
        children: childrenCount,
        userId: params.customerUserId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        totalMzn: authoritativeTotalMzn,
        currency: 'MZN',
        pricingType: actPricingType,
        pickupRequested: Boolean(params.pickupRequested),
        pickupNotes: params.pickupNotes || '',
        travelGroupId: params.travelGroupId || null,
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        isWeatherDependent: Boolean(act.isWeatherDependent),
        weatherStatus: act.isWeatherDependent ? 'normal' : undefined,
        cancellationSnapshot: buildBookingCancellationSnapshot({
          tierId: act.cancellationTier || (act.isWeatherDependent ? 'weather_dependent' : 'flexible'),
          startDate: params.date,
          startTime: params.time,
          isWeatherDependent: Boolean(act.isWeatherDependent),
          isNonRefundable: Boolean(act.isNonRefundable)
        }),
        holdExpiresAt: holdExpiresAtIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdAtServer: AdminFieldValue.serverTimestamp()
      };

      const newHold = {
        bookingId,
        customerUserId: params.customerUserId,
        seats: requestedSeats,
        status: 'hold',
        holdExpiresAt: holdExpiresAtIso,
        createdAt: nowIso
      };

      validHolds.push(newHold);

      transaction.set(bDocRef, newBooking);
      transaction.set(slotRef, {
        activityId: params.activityId,
        date: params.date,
        confirmedSeats: slotData.confirmedSeats || 0,
        holds: validHolds,
        updatedAt: nowIso
      }, { merge: true });

      console.log(`[Inventory Atomic Lock] Reserved ${requestedSeats} seat(s) on '${params.activityId}' on ${params.date}. Remaining: ${remainingSeats - requestedSeats}/${mozbookCapacity}`);

      return { booking: newBooking };
    });

    if (transactionResult.reusableBookingId) {
      const existingSnap = await adminDb.collection('activity_bookings').doc(transactionResult.reusableBookingId).get();
      if (existingSnap.exists) {
        console.log(`[Inventory] Reusing existing unexpired hold '${transactionResult.reusableBookingId}' for user '${params.customerUserId}'`);
        return { id: existingSnap.id, ...existingSnap.data() };
      }
    }

    return transactionResult.booking;
  } catch (err: any) {
    if (isPermissionDenied(err)) {
      console.error(`[Inventory Error] Firestore Admin PERMISSION_DENIED: persistent reservation failed for experience '${params.activityId}'.`);
      throw new InventoryError(
        500,
        `Persistent reservation failed: Firestore database access denied (PERMISSION_DENIED). Booking could not be saved.`
      );
    }
    throw err;
  }
}

/**
 * Server-authoritative in-memory OCC atomic reservation engine for stays.
 */
function reserveStayInventoryInMemory(
  params: ReserveStayParams,
  nightsList: string[],
  bookingId: string,
  bookingRef: string,
  now: number,
  nowIso: string,
  holdExpiresAtIso: string
) {
  if (params.isCustomerSuspended || (params.customerUserId && memorySuspendedUsers.has(params.customerUserId))) {
    throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
  }

  if (params.isHostSuspended || (params.hostId && memorySuspendedHosts.has(params.hostId))) {
    throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
  }

  const mozbookUnits = 5; // Authoritative default stay unit allocation limit
  let reusableExistingBookingId: string | null = null;

  // Check each night slot
  for (const nightStr of nightsList) {
    const slotDocId = `${params.listingId}_${nightStr}`;
    let slot = memoryStaySlots.get(slotDocId);
    if (!slot) {
      slot = {
        id: slotDocId,
        itemId: params.listingId,
        date: nightStr,
        confirmedUnits: 0,
        holds: [],
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      memoryStaySlots.set(slotDocId, slot);
    }

    let committedUnits = slot.confirmedUnits || 0;
    const validHolds: MemorySlotHold[] = [];

    for (const h of slot.holds) {
      const units = Number(h.units || 1);
      if (h.status === 'confirmed') {
        validHolds.push(h);
        committedUnits += units;
      } else if (h.status === 'hold') {
        const expTime = new Date(h.holdExpiresAt || 0).getTime();
        const inFlightTime = h.paymentInFlight ? new Date(h.inFlightUntil || 0).getTime() : 0;
        const isStillValid = expTime > now || inFlightTime > now;
        if (isStillValid) {
          validHolds.push(h);
          committedUnits += units;

          if (h.customerUserId === params.customerUserId && !reusableExistingBookingId) {
            reusableExistingBookingId = h.bookingId;
          }
        }
      }
    }

    if (committedUnits >= mozbookUnits) {
      console.warn(`[Inventory Conflict] Property '${params.listingId}' on ${nightStr}: ${committedUnits}/${mozbookUnits} units committed`);
      throw new InventoryError(
        409,
        `No units available for ${params.startDate} to ${params.endDate}. Date ${nightStr} is fully booked (${committedUnits}/${mozbookUnits} allocated units reserved).`
      );
    }
  }

  if (reusableExistingBookingId && memoryBookings.has(reusableExistingBookingId)) {
    console.log(`[Inventory Engine] Reusing existing unexpired stay hold '${reusableExistingBookingId}' for user '${params.customerUserId}'`);
    return memoryBookings.get(reusableExistingBookingId);
  }

  const newBooking = {
    id: bookingId,
    bookingRef,
    listingId: params.listingId,
    listingTitle: params.listingTitle,
    hostId: params.hostId || 'unknown_host',
    startDate: params.startDate,
    endDate: params.endDate,
    checkInDate: params.startDate,
    checkOutDate: params.endDate,
    nights: params.nights,
    adults: params.adults,
    children: params.children,
    totalGuests: params.totalGuests,
    userId: params.customerUserId,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
    totalAmount: Number(params.totalAmount),
    currency: 'MZN',
    accommodationId: params.accommodationId || null,
    travelGroupId: params.travelGroupId || null,
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'unfulfilled',
    cancellationSnapshot: buildBookingCancellationSnapshot({
      tierId: 'flexible',
      startDate: params.startDate,
      startTime: '14:00',
      isWeatherDependent: false,
      isNonRefundable: false
    }),
    holdExpiresAt: holdExpiresAtIso,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const newHold: MemorySlotHold = {
    bookingId,
    customerUserId: params.customerUserId,
    units: 1,
    status: 'hold',
    holdExpiresAt: holdExpiresAtIso,
    createdAt: nowIso
  };

  // Add hold to each night slot
  for (const nightStr of nightsList) {
    const slotDocId = `${params.listingId}_${nightStr}`;
    const slot = memoryStaySlots.get(slotDocId)!;
    slot.holds.push(newHold);
    slot.version++;
    slot.updatedAt = nowIso;
  }

  memoryBookings.set(bookingId, newBooking);
  console.log(`[Inventory Atomic Lock] In-Memory OCC reserved stay unit on '${params.listingId}' across ${nightsList.length} night(s).`);

  return newBooking;
}

/**
 * Authoritatively reserves accommodation units across dates with atomic Firestore transaction protection.
 */
export async function reserveStayInventory(params: ReserveStayParams) {
  // Enforce customer suspension safeguard prior to taking any locks
  if (params.isCustomerSuspended || (params.customerUserId && memorySuspendedUsers.has(params.customerUserId))) {
    throw new InventoryError(403, 'Booking unavailable: Customer account is currently suspended.');
  }

  // Enforce host suspension safeguard prior to taking any locks
  if (params.isHostSuspended || (params.hostId && memorySuspendedHosts.has(params.hostId))) {
    throw new InventoryError(403, 'Booking unavailable: Host account is currently suspended for safety or compliance.');
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const holdExpiresAtIso = new Date(now + HOLD_DURATION_MS).toISOString();

  // Compute all night dates
  const nightsList: string[] = [];
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    nightsList.push(d.toISOString().split('T')[0]);
  }

  if (nightsList.length === 0) {
    throw new InventoryError(400, 'Stay must be for at least one night.');
  }

  const bookingId = `bk_stay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bookingRef = 'MB-STAY-' + Math.floor(100000 + Math.random() * 900000);

  // Attempt privileged Firestore Admin transaction first
  try {
    const adminDb = getPrivilegedFirestore();
    const listingRef = adminDb.collection('listings').doc(params.listingId);

    // 1. One-time seed for each night slot if missing
    for (const nightStr of nightsList) {
      const slotDocId = `${params.listingId}_${nightStr}`;
      const slotRef = adminDb.collection('inventory_stay_slots').doc(slotDocId);
      const snap = await slotRef.get();
      if (!snap.exists) {
        const bookingsSnap = await adminDb
          .collection('bookings')
          .where('listingId', '==', params.listingId)
          .get();

        let initialConfirmedUnits = 0;
        const initialHolds: any[] = [];

        bookingsSnap.forEach((docSnap) => {
          const b = docSnap.data();
          if (b.status === 'cancelled') return;
          const bCheckIn = b.checkInDate || b.startDate;
          const bCheckOut = b.checkOutDate || b.endDate;
          if (!bCheckIn || !bCheckOut) return;
          if (nightStr >= bCheckIn && nightStr < bCheckOut) {
            if (b.status === 'confirmed' || b.status === 'completed') {
              initialConfirmedUnits += 1;
              initialHolds.push({
                bookingId: docSnap.id,
                customerUserId: b.userId || '',
                units: 1,
                status: 'confirmed',
                holdExpiresAt: nowIso,
                createdAt: b.createdAt || nowIso
              });
            } else if (b.status === 'pending' && b.paymentStatus !== 'failed') {
              const expTime = b.holdExpiresAt ? new Date(b.holdExpiresAt).getTime() : new Date(b.createdAt || 0).getTime() + HOLD_DURATION_MS;
              if (expTime > now) {
                initialHolds.push({
                  bookingId: docSnap.id,
                  customerUserId: b.userId || '',
                  units: 1,
                  status: 'hold',
                  holdExpiresAt: new Date(expTime).toISOString(),
                  createdAt: b.createdAt || nowIso
                });
              }
            }
          }
        });

        await slotRef.set({
          listingId: params.listingId,
          date: nightStr,
          confirmedUnits: initialConfirmedUnits,
          holds: initialHolds,
          createdAt: nowIso,
          updatedAt: nowIso
        }, { merge: true });
      }
    }

    const bDocRef = adminDb.collection('bookings').doc(bookingId);

    // 2. ATOMIC FIRESTORE TRANSACTION — Verifies all nights concurrently
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const listingSnap = await transaction.get(listingRef);
      if (!listingSnap.exists) {
        throw new InventoryError(404, `Property '${params.listingId}' not found.`);
      }

      const listing = listingSnap.data()!;

      // Enforce both customer and host suspension checks authoritatively
      await assertCustomerNotSuspended(params.customerUserId, adminDb, transaction);
      const hostId = listing.hostId || params.hostId;
      await assertHostNotSuspended(hostId, adminDb, transaction);

      // Blocked dates check
      if (listing.blockedDates && Array.isArray(listing.blockedDates)) {
        for (const nightStr of nightsList) {
          if (listing.blockedDates.includes(nightStr)) {
            throw new InventoryError(400, `Date ${nightStr} is blocked by the host and unavailable for check-in.`);
          }
        }
      }

      const totalUnits = Number(listing.totalLodgeUnits || listing.maxGuests || 1);
      const mozbookUnits = Number(listing.mozbookAllocatedUnits || totalUnits || 1);

      // Read and validate all night slots
      const nightSlotsToUpdate: { ref: any; validHolds: any[]; confirmedUnits: number; date: string }[] = [];
      let reusableExistingBookingId: string | null = null;

      for (const nightStr of nightsList) {
        const slotRef = adminDb.collection('inventory_stay_slots').doc(`${params.listingId}_${nightStr}`);
        const slotSnap = await transaction.get(slotRef);
        const slotData = slotSnap.exists ? slotSnap.data()! : { confirmedUnits: 0, holds: [] };
        const rawHolds = Array.isArray(slotData.holds) ? slotData.holds : [];

        const validHolds: any[] = [];
        let committedUnits = 0;

        for (const h of rawHolds) {
          const units = Number(h.units || 1);
          if (h.status === 'confirmed') {
            validHolds.push(h);
            committedUnits += units;
          } else if (h.status === 'hold') {
            const expTime = new Date(h.holdExpiresAt || 0).getTime();
            const inFlightTime = h.paymentInFlight ? new Date(h.inFlightUntil || 0).getTime() : 0;
            const isStillValid = expTime > now || inFlightTime > now;
            if (isStillValid) {
              validHolds.push(h);
              committedUnits += units;

              if (h.customerUserId === params.customerUserId && !reusableExistingBookingId) {
                reusableExistingBookingId = h.bookingId;
              }
            }
          }
        }

        if (committedUnits >= mozbookUnits) {
          console.warn(`[Inventory Conflict] Property '${params.listingId}' on ${nightStr}: ${committedUnits}/${mozbookUnits} units committed`);
          throw new InventoryError(
            409,
            `No units available for ${params.startDate} to ${params.endDate}. Date ${nightStr} is fully booked (${committedUnits}/${mozbookUnits} allocated units reserved).`
          );
        }

        nightSlotsToUpdate.push({
          ref: slotRef,
          validHolds,
          confirmedUnits: slotData.confirmedUnits || 0,
          date: nightStr
        });
      }

      if (reusableExistingBookingId) {
        return { reusableBookingId: reusableExistingBookingId };
      }

      // Authoritative pricing calculation strictly from trusted database listing record
      const stayNights = nightsList.length;
      const hasDeal = Boolean(listing.specialOffer?.enabled && listing.specialOffer.specialPrice && Number(listing.specialOffer.specialPrice) > 0);
      const effectiveNightlyRate = hasDeal ? Number(listing.specialOffer.specialPrice) : Number(listing.price || 0);
      const cleaningFee = Number(listing.cleaningFee !== undefined ? listing.cleaningFee : 1200);
      const serviceFee = Number(listing.serviceFee !== undefined ? listing.serviceFee : 850);
      const authoritativeTotalAmount = Math.max(1, Math.round((effectiveNightlyRate * stayNights) + cleaningFee + serviceFee));

      const newBooking = {
        id: bookingId,
        bookingRef,
        listingId: params.listingId,
        listingTitle: params.listingTitle,
        hostId: params.hostId || listing.hostId || 'unknown_host',
        startDate: params.startDate,
        endDate: params.endDate,
        checkInDate: params.startDate,
        checkOutDate: params.endDate,
        nights: stayNights,
        nightlyRate: effectiveNightlyRate,
        adults: params.adults,
        children: params.children,
        totalGuests: params.totalGuests,
        userId: params.customerUserId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        cleaningFee,
        serviceFee,
        totalAmount: authoritativeTotalAmount,
        currency: 'MZN',
        accommodationId: params.accommodationId || null,
        travelGroupId: params.travelGroupId || null,
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        cancellationSnapshot: buildBookingCancellationSnapshot({
          tierId: listing.cancellationTier || 'flexible',
          startDate: params.startDate,
          startTime: '14:00',
          isWeatherDependent: false,
          isNonRefundable: Boolean(listing.isNonRefundable)
        }),
        holdExpiresAt: holdExpiresAtIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdAtServer: AdminFieldValue.serverTimestamp()
      };

      const newHold = {
        bookingId,
        customerUserId: params.customerUserId,
        units: 1,
        status: 'hold',
        holdExpiresAt: holdExpiresAtIso,
        createdAt: nowIso
      };

      transaction.set(bDocRef, newBooking);

      for (const slot of nightSlotsToUpdate) {
        slot.validHolds.push(newHold);
        transaction.set(slot.ref, {
          listingId: params.listingId,
          date: slot.date,
          confirmedUnits: slot.confirmedUnits,
          holds: slot.validHolds,
          updatedAt: nowIso
        }, { merge: true });
      }

      console.log(`[Inventory Atomic Lock] Reserved stay unit on '${params.listingId}' across ${nightsList.length} night(s).`);

      return { booking: newBooking };
    });

    if (transactionResult.reusableBookingId) {
      const existingSnap = await adminDb.collection('bookings').doc(transactionResult.reusableBookingId).get();
      if (existingSnap.exists) {
        console.log(`[Inventory] Reusing existing unexpired stay hold '${transactionResult.reusableBookingId}' for user '${params.customerUserId}'`);
        return { id: existingSnap.id, ...existingSnap.data() };
      }
    }

    return transactionResult.booking;
  } catch (err: any) {
    if (isPermissionDenied(err)) {
      console.error(`[Inventory Error] Firestore Admin PERMISSION_DENIED: persistent reservation failed for stay '${params.listingId}'.`);
      throw new InventoryError(
        500,
        `Persistent reservation failed: Firestore database access denied (PERMISSION_DENIED). Stay booking could not be saved.`
      );
    }
    throw err;
  }
}

/**
 * Transitions an inventory slot hold to confirmed upon successful payment settlement.
 */
export async function confirmInventorySlotReservation(
  bookingId: string,
  category: 'stay' | 'activity' | 'trip'
) {
  const nowIso = new Date().toISOString();

  // Update in-memory stores if booking is managed in-memory
  if (memoryBookings.has(bookingId)) {
    const b = memoryBookings.get(bookingId);
    b.status = 'confirmed';
    b.paymentStatus = 'paid';
    b.updatedAt = nowIso;
  }

  if (category === 'stay') {
    for (const slot of memoryStaySlots.values()) {
      for (const h of slot.holds) {
        if (h.bookingId === bookingId) {
          h.status = 'confirmed';
          h.paymentInFlight = false;
          h.confirmedAt = nowIso;
          slot.confirmedUnits = (slot.confirmedUnits || 0) + 1;
        }
      }
    }
  } else {
    for (const slot of memoryExperienceSlots.values()) {
      for (const h of slot.holds) {
        if (h.bookingId === bookingId) {
          h.status = 'confirmed';
          h.paymentInFlight = false;
          h.confirmedAt = nowIso;
          slot.confirmedSeats = (slot.confirmedSeats || 0) + (h.seats || 1);
        }
      }
    }
  }

  try {
    const adminDb = getPrivilegedFirestore();

    if (category === 'stay') {
      const bSnap = await adminDb.collection('bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const start = new Date(b.checkInDate || b.startDate);
      const end = new Date(b.checkOutDate || b.endDate);

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const nightStr = d.toISOString().split('T')[0];
        const slotRef = adminDb.collection('inventory_stay_slots').doc(`${b.listingId}_${nightStr}`);
        const slotSnap = await slotRef.get();
        if (slotSnap.exists) {
          const data = slotSnap.data()!;
          const holds = (data.holds || []).map((h: any) => {
            if (h.bookingId === bookingId) {
              return { ...h, status: 'confirmed', paymentInFlight: false, confirmedAt: nowIso };
            }
            return h;
          });
          await slotRef.update({
            holds,
            confirmedUnits: (data.confirmedUnits || 0) + 1,
            updatedAt: nowIso
          });
        }
      }
    } else {
      const bSnap = await adminDb.collection('activity_bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const slotRef = adminDb.collection('inventory_experience_slots').doc(`${b.activityId}_${b.date}`);
      const slotSnap = await slotRef.get();
      if (slotSnap.exists) {
        const data = slotSnap.data()!;
        const holds = (data.holds || []).map((h: any) => {
          if (h.bookingId === bookingId) {
            return { ...h, status: 'confirmed', paymentInFlight: false, confirmedAt: nowIso };
          }
          return h;
        });
        await slotRef.update({
          holds,
          confirmedSeats: (data.confirmedSeats || 0) + Number(b.totalGuests || 1),
          updatedAt: nowIso
        });
      }
    }
  } catch (err: any) {
    if (isPermissionDenied(err)) {
      console.warn(`[Inventory] confirmInventorySlotReservation operating on authoritative in-memory store (Admin IAM restricted).`);
      return;
    }
    console.warn('[Inventory] confirmInventorySlotReservation error:', err.message);
  }
}

/**
 * Safely marks inventory hold as having an active payment in-flight,
 * preventing expired hold releases while customer completes PaySuite checkout (Prompt 28C - Part 4).
 */
export async function markPaymentInFlight(
  bookingId: string,
  category: 'stay' | 'activity' | 'trip'
) {
  const now = Date.now();
  const inFlightExpiresAtIso = new Date(now + 20 * 60 * 1000).toISOString(); // 20-minute in-flight payment grace period

  // Update in-memory stores
  if (category === 'stay') {
    for (const slot of memoryStaySlots.values()) {
      for (const h of slot.holds) {
        if (h.bookingId === bookingId) {
          h.paymentInFlight = true;
          h.inFlightUntil = inFlightExpiresAtIso;
          h.holdExpiresAt = inFlightExpiresAtIso;
        }
      }
    }
  } else {
    for (const slot of memoryExperienceSlots.values()) {
      for (const h of slot.holds) {
        if (h.bookingId === bookingId) {
          h.paymentInFlight = true;
          h.inFlightUntil = inFlightExpiresAtIso;
          h.holdExpiresAt = inFlightExpiresAtIso;
        }
      }
    }
  }

  try {
    const adminDb = getPrivilegedFirestore();

    if (category === 'stay') {
      const bSnap = await adminDb.collection('bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const start = new Date(b.checkInDate || b.startDate);
      const end = new Date(b.checkOutDate || b.endDate);

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const nightStr = d.toISOString().split('T')[0];
        const slotRef = adminDb.collection('inventory_stay_slots').doc(`${b.listingId}_${nightStr}`);
        const slotSnap = await slotRef.get();
        if (slotSnap.exists) {
          const data = slotSnap.data()!;
          const holds = (data.holds || []).map((h: any) => {
            if (h.bookingId === bookingId) {
              return {
                ...h,
                paymentInFlight: true,
                inFlightUntil: inFlightExpiresAtIso,
                holdExpiresAt: inFlightExpiresAtIso
              };
            }
            return h;
          });
          await slotRef.update({ holds, updatedAt: new Date().toISOString() });
        }
      }
    } else {
      const bSnap = await adminDb.collection('activity_bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const slotRef = adminDb.collection('inventory_experience_slots').doc(`${b.activityId}_${b.date}`);
      const slotSnap = await slotRef.get();
      if (slotSnap.exists) {
        const data = slotSnap.data()!;
        const holds = (data.holds || []).map((h: any) => {
          if (h.bookingId === bookingId) {
            return {
              ...h,
              paymentInFlight: true,
              inFlightUntil: inFlightExpiresAtIso,
              holdExpiresAt: inFlightExpiresAtIso
            };
          }
          return h;
        });
        await slotRef.update({ holds, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err: any) {
    if (isPermissionDenied(err)) {
      return;
    }
    console.warn('[Inventory] markPaymentInFlight error:', err.message);
  }
}

/**
 * Releases inventory hold or confirmed seats upon cancellation or payment failure.
 */
export async function releaseInventorySlotReservation(
  bookingId: string,
  category: 'stay' | 'activity' | 'trip'
) {
  const nowIso = new Date().toISOString();

  // In-memory hold release
  if (category === 'stay') {
    for (const slot of memoryStaySlots.values()) {
      const wasConfirmed = slot.holds.some(h => h.bookingId === bookingId && h.status === 'confirmed');
      slot.holds = slot.holds.filter(h => h.bookingId !== bookingId);
      if (wasConfirmed) {
        slot.confirmedUnits = Math.max(0, (slot.confirmedUnits || 0) - 1);
      }
      slot.updatedAt = nowIso;
    }
  } else {
    for (const slot of memoryExperienceSlots.values()) {
      const targetHold = slot.holds.find(h => h.bookingId === bookingId);
      const wasConfirmed = targetHold?.status === 'confirmed';
      const seats = targetHold?.seats || 1;
      slot.holds = slot.holds.filter(h => h.bookingId !== bookingId);
      if (wasConfirmed) {
        slot.confirmedSeats = Math.max(0, (slot.confirmedSeats || 0) - seats);
      }
      slot.updatedAt = nowIso;
    }
  }

  try {
    const adminDb = getPrivilegedFirestore();

    if (category === 'stay') {
      const bSnap = await adminDb.collection('bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const start = new Date(b.checkInDate || b.startDate);
      const end = new Date(b.checkOutDate || b.endDate);

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const nightStr = d.toISOString().split('T')[0];
        const slotRef = adminDb.collection('inventory_stay_slots').doc(`${b.listingId}_${nightStr}`);
        const slotSnap = await slotRef.get();
        if (slotSnap.exists) {
          const data = slotSnap.data()!;
          const wasConfirmed = (data.holds || []).some((h: any) => h.bookingId === bookingId && h.status === 'confirmed');
          const remainingHolds = (data.holds || []).filter((h: any) => h.bookingId !== bookingId);
          await slotRef.update({
            holds: remainingHolds,
            confirmedUnits: wasConfirmed ? Math.max(0, (data.confirmedUnits || 0) - 1) : (data.confirmedUnits || 0),
            updatedAt: nowIso
          });
        }
      }
    } else {
      const bSnap = await adminDb.collection('activity_bookings').doc(bookingId).get();
      if (!bSnap.exists) return;
      const b = bSnap.data()!;
      const slotRef = adminDb.collection('inventory_experience_slots').doc(`${b.activityId}_${b.date}`);
      const slotSnap = await slotRef.get();
      if (slotSnap.exists) {
        const data = slotSnap.data()!;
        const wasConfirmed = (data.holds || []).some((h: any) => h.bookingId === bookingId && h.status === 'confirmed');
        const seats = Number(b.totalGuests || 1);
        const remainingHolds = (data.holds || []).filter((h: any) => h.bookingId !== bookingId);
        await slotRef.update({
          holds: remainingHolds,
          confirmedSeats: wasConfirmed ? Math.max(0, (data.confirmedSeats || 0) - seats) : (data.confirmedSeats || 0),
          updatedAt: nowIso
        });
      }
    }
  } catch (err: any) {
    if (isPermissionDenied(err)) {
      return;
    }
    console.warn('[Inventory] releaseInventorySlotReservation error:', err.message);
  }
}

export interface SetInventoryAllocationParams {
  itemId: string;
  itemType: 'accommodation' | 'activity' | 'trip';
  totalCapacity: number;
  mozbookCapacity: number;
  blockedDates: string[];
  operatorUser: { uid: string; email?: string };
}

/**
 * Enforces Partner Inventory Allocation Guard (Prompt 28C - Part 5)
 * Rejects reductions below existing active/confirmed reservations.
 */
export async function checkAndSetInventoryAllocation(params: SetInventoryAllocationParams) {
  const adminDb = getPrivilegedFirestore();
  const targetCollection = params.itemType === 'accommodation' ? 'listings' : 'activities_trips';
  const targetDocSnap = await adminDb.collection(targetCollection).doc(params.itemId).get();

  if (!targetDocSnap.exists) {
    throw new InventoryError(404, `Item '${params.itemId}' not found.`);
  }

  const item = targetDocSnap.data()!;

  // Ownership verification
  const isOwner = item.hostId === params.operatorUser.uid;
  const isAdmin = isUserAdmin(params.operatorUser);

  if (!isOwner && !isAdmin) {
    throw new InventoryError(403, 'Unauthorized: You can only modify your own property or activity allocation.');
  }

  if (params.mozbookCapacity > params.totalCapacity) {
    throw new InventoryError(400, 'MozBook allocated inventory cannot exceed total physical capacity.');
  }

  if (params.mozbookCapacity < 1) {
    throw new InventoryError(400, 'MozBook allocated capacity must be at least 1.');
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Check upcoming bookings to prevent reducing capacity below active reservations
  if (params.itemType === 'accommodation') {
    const bookingsSnap = await adminDb
      .collection('bookings')
      .where('listingId', '==', params.itemId)
      .get();

    // Map each upcoming date to active bookings
    const dateOccupancyMap: Record<string, number> = {};

    bookingsSnap.forEach((docSnap) => {
      const b = docSnap.data();
      if (b.status === 'cancelled') return;
      if (b.endDate < todayStr) return; // Ignore past bookings

      const start = new Date(b.startDate || b.checkInDate);
      const end = new Date(b.endDate || b.checkOutDate);

      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        dateOccupancyMap[dStr] = (dateOccupancyMap[dStr] || 0) + 1;
      }
    });

    // Check if new mozbookCapacity is below active bookings on any upcoming date
    for (const [dateStr, bookedUnits] of Object.entries(dateOccupancyMap)) {
      if (bookedUnits > params.mozbookCapacity) {
        throw new InventoryError(
          400,
          `Cannot reduce MozBook allocation to ${params.mozbookCapacity} unit(s). On ${dateStr}, you already have ${bookedUnits} active/confirmed booking(s). You must honour your represented reservations.`
        );
      }

      if (params.blockedDates.includes(dateStr)) {
        throw new InventoryError(
          400,
          `Cannot block date ${dateStr}. There is already an active reservation (${bookedUnits} unit) booked on this date.`
        );
      }
    }

    // Persist safe update
    await adminDb.collection('listings').doc(params.itemId).update({
      totalLodgeUnits: params.totalCapacity,
      mozbookAllocatedUnits: params.mozbookCapacity,
      blockedDates: params.blockedDates,
      updatedAt: new Date().toISOString()
    });
  } else {
    // Activities and Trips
    const bookingsSnap = await adminDb
      .collection('activity_bookings')
      .where('activityId', '==', params.itemId)
      .where('date', '>=', todayStr)
      .get();

    const datePaxMap: Record<string, number> = {};

    bookingsSnap.forEach((docSnap) => {
      const b = docSnap.data();
      if (b.status === 'cancelled') return;
      const dStr = b.date;
      const pax = Number(b.totalGuests || 1);
      datePaxMap[dStr] = (datePaxMap[dStr] || 0) + pax;
    });

    for (const [dateStr, totalPax] of Object.entries(datePaxMap)) {
      if (totalPax > params.mozbookCapacity) {
        throw new InventoryError(
          400,
          `Cannot reduce MozBook capacity to ${params.mozbookCapacity} pax. On ${dateStr}, you already have ${totalPax} traveler(s) confirmed/reserved. You must honour your represented capacity.`
        );
      }

      if (params.blockedDates.includes(dateStr)) {
        throw new InventoryError(
          400,
          `Cannot block date ${dateStr}. There are already ${totalPax} active traveler reservation(s) on this date.`
        );
      }
    }

    await adminDb.collection('activities_trips').doc(params.itemId).update({
      totalCapacity: params.totalCapacity,
      maxGuests: params.totalCapacity,
      mozbookAllocatedCapacity: params.mozbookCapacity,
      blockedDates: params.blockedDates,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    success: true,
    itemId: params.itemId,
    mozbookCapacity: params.mozbookCapacity,
    blockedDates: params.blockedDates
  };
}

export interface CancelBookingParams {
  bookingId: string;
  bookingCategory: 'stay' | 'activity' | 'trip';
  cancellationReason: CancellationReasonType | 'operator_inventory_failure' | 'customer_request' | 'weather' | 'other' | string;
  cancellationInitiator?: CancellationInitiator;
  notes?: string;
  operatorUser: { uid: string; email?: string; displayName?: string };
}

/**
 * Authoritatively executes booking cancellation with server-side operator accountability,
 * versioned policy evaluation, 15% / 85% commission reconciliation, and privileged refund initiation (Stage 4A).
 */
export async function cancelBookingWithOperatorAccountability(params: CancelBookingParams) {
  const adminDb = getPrivilegedFirestore();
  const targetCollection = params.bookingCategory === 'stay' ? 'bookings' : 'activity_bookings';
  const bookingRef = adminDb.collection(targetCollection).doc(params.bookingId);

  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    throw new InventoryError(404, `Reservation '${params.bookingId}' not found.`);
  }

  const booking = bookingSnap.data()!;

  // Ownership verification: host, customer, or admin
  const isHost = booking.hostId === params.operatorUser.uid;
  const isCustomer = booking.userId === params.operatorUser.uid || 
    (params.operatorUser.email && booking.customerEmail && params.operatorUser.email.toLowerCase() === booking.customerEmail.toLowerCase());
  const isAdmin = isUserAdmin(params.operatorUser);

  if (!isHost && !isCustomer && !isAdmin) {
    throw new InventoryError(403, 'Unauthorized: Only the assigned host, booking customer, or MozBook administration can cancel this reservation.');
  }

  if (booking.status === 'cancelled') {
    throw new InventoryError(400, 'This reservation is already cancelled.');
  }

  const now = new Date().toISOString();
  const bookingAmount = Number(booking.totalAmount || booking.totalMzn || 0);
  const hostId = booking.hostId || params.operatorUser.uid;

  // Determine initiator
  const initiator: CancellationInitiator = params.cancellationInitiator || (isAdmin ? 'admin' : isHost ? 'operator' : 'customer');

  // Normalize reason
  let reason: CancellationReasonType = 'customer_request_before_deadline';
  if (params.cancellationReason === 'operator_inventory_failure' || params.cancellationReason === 'operator_overbooking') {
    reason = 'operator_inventory_failure';
  } else if (params.cancellationReason === 'severe_weather' || params.cancellationReason === 'weather') {
    reason = 'severe_weather';
  } else if (params.cancellationReason === 'material_inaccuracy') {
    reason = 'material_inaccuracy';
  } else if (params.cancellationReason === 'exceptional_circumstances' || params.cancellationReason === 'force_majeure') {
    reason = 'exceptional_circumstances';
  } else if (params.cancellationReason === 'mutual_agreement') {
    reason = 'mutual_agreement';
  } else if (params.cancellationReason === 'customer_no_show') {
    reason = 'customer_no_show';
  } else if (params.cancellationReason === 'non_refundable') {
    reason = 'non_refundable';
  } else if (initiator === 'operator') {
    reason = 'operator_cancellation';
  } else {
    reason = (params.cancellationReason as CancellationReasonType) || 'customer_request_before_deadline';
  }

  // Authoritative settlement calculation against stored snapshot (or safe legacy fallback)
  const settlement = evaluateCancellationSettlement({
    bookingId: params.bookingId,
    totalBookingAmountMzn: bookingAmount,
    initiator,
    reason,
    snapshot: booking.cancellationSnapshot || null,
    cancelledAt: now,
    legacyStartDate: booking.startDate || booking.date || booking.checkInDate,
    isWeatherDependent: Boolean(booking.isWeatherDependent),
    notes: params.notes
  });

  let debitRecord: OperatorInventoryDebit | null = null;
  let refundResult: any = null;

  // 1. Authoritative cancellation update
  const updates: Record<string, any> = {
    status: 'cancelled',
    cancellationInitiator: initiator,
    cancellationReason: reason,
    operatorFailureNotes: params.notes || '',
    cancellationSettlement: settlement,
    customerProtectionRefundMzn: settlement.customerRefundMzn,
    refundEntitlementStatus: settlement.customerRefundMzn > 0 ? 'entitled' : 'none',
    updatedAt: now,
    updatedAtServer: AdminFieldValue.serverTimestamp()
  };

  // 2. Handle Operator Accountability Debit (15% penalty on inventory failure or provider default)
  if (settlement.operatorAccountabilityDebitMzn > 0) {
    const debitAmountMzn = settlement.operatorAccountabilityDebitMzn;
    const debitId = `deb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    debitRecord = {
      id: debitId,
      hostId,
      hostName: booking.hostName || params.operatorUser.displayName || 'MozBook Partner',
      bookingId: params.bookingId,
      bookingRef: booking.bookingRef || `MB-REF-${params.bookingId.substring(0, 8)}`,
      bookingCategory: params.bookingCategory,
      offeringTitle: booking.listingTitle || booking.activityTitle || 'Reserved Offering',
      reason: 'operator_inventory_failure',
      customerRefundAmountMzn: settlement.customerRefundMzn,
      debitAmountMzn,
      status: 'applied',
      notes: params.notes || settlement.explanation,
      createdAt: now
    };

    // Privileged write to operator_inventory_debits
    await adminDb.collection('operator_inventory_debits').doc(debitId).set(debitRecord);
    updates.operatorDebitId = debitId;
    updates.inventoryFailureDebitMzn = debitAmountMzn;
  }

  // 3. If booking was paid and refund is entitled (> 0), initiate authoritative provider refund request
  if (booking.paymentStatus === 'paid' && settlement.customerRefundMzn > 0) {
    try {
      refundResult = await createRefundRequest({
        bookingId: params.bookingId,
        bookingCategory: params.bookingCategory,
        amount: settlement.customerRefundMzn,
        reason: `${settlement.explanation} Notes: ${params.notes || ''}`.trim(),
        incidentType: reason as any,
        policyTier: settlement.tierId,
        policyVersion: booking.cancellationSnapshot?.policyVersion || '1.0.0',
        retainedAmountMzn: settlement.retainedAmountMzn,
        authenticatedUser: params.operatorUser
      });
      updates.refundStatus = refundResult.status;
      updates.refundId = refundResult.refundId;
    } catch (refErr: any) {
      console.warn(`[Cancellation] Refund request initiation note: ${refErr.message}`);
      updates.refundStatus = 'pending_manual_processing';
      updates.refundError = refErr.message;
    }
  }

  // Update booking
  await bookingRef.update(updates);

  // Safely release inventory hold or confirmed capacity in atomic inventory slot
  try {
    await releaseInventorySlotReservation(params.bookingId, params.bookingCategory);
  } catch (slotErr) {
    console.warn(`[Cancellation] Slot release note for ${params.bookingId}:`, slotErr);
  }

  return {
    success: true,
    bookingId: params.bookingId,
    status: 'cancelled',
    cancellationReason: reason,
    settlement,
    debitRecord,
    refundResult,
    refundAmountMzn: settlement.customerRefundMzn,
    refundInitiated: Boolean(refundResult && refundResult.success)
  };
}

export interface RescheduleBookingParams {
  bookingId: string;
  newDate: string;
  newTime?: string;
  notes?: string;
  initiatedBy: 'operator' | 'customer' | 'admin';
  user: { uid: string; email?: string; displayName?: string };
}

/**
 * Authoritatively reschedules a weather-dependent or requested experience booking.
 * Atomically checks capacity on newDate, transfers confirmed/held inventory, and releases old date.
 */
export async function rescheduleExperienceBooking(params: RescheduleBookingParams) {
  const adminDb = getPrivilegedFirestore();
  const bookingRef = adminDb.collection('activity_bookings').doc(params.bookingId);
  const nowIso = new Date().toISOString();

  return await adminDb.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new InventoryError(404, `Booking '${params.bookingId}' not found.`);
    }

    const booking = bookingSnap.data()!;

    // Verification: operator or customer or admin
    const isHost = booking.hostId === params.user.uid;
    const isCustomer = booking.userId === params.user.uid;
    const isAdmin = isUserAdmin(params.user);

    if (!isHost && !isCustomer && !isAdmin) {
      throw new InventoryError(403, 'Unauthorized: Only the guest, operator, or admin may reschedule this reservation.');
    }

    if (booking.status === 'cancelled') {
      throw new InventoryError(400, 'Cancelled reservations cannot be rescheduled.');
    }

    const oldDate = booking.date;
    const newDate = params.newDate;

    if (oldDate === newDate && (!params.newTime || params.newTime === booking.time)) {
      throw new InventoryError(400, 'The new date and time match the current reservation schedule.');
    }

    const activityId = booking.activityId;
    const requestedSeats = Number(booking.totalGuests || 1);

    // Fetch activity doc for capacity
    const actRef = adminDb.collection('activities_trips').doc(activityId);
    const actSnap = await transaction.get(actRef);
    if (!actSnap.exists) {
      throw new InventoryError(404, `Activity '${activityId}' not found.`);
    }

    const act = actSnap.data()!;
    const mozbookCapacity = Number(act.mozbookAllocatedCapacity || act.maxGuests || 12);

    // Read new date inventory slot
    const newSlotRef = adminDb.collection('inventory_experience_slots').doc(`${activityId}_${newDate}`);
    const newSlotSnap = await transaction.get(newSlotRef);

    let committedOnNewDate = 0;
    const validHoldsOnNewSlot: any[] = [];
    const nowMs = Date.now();

    if (newSlotSnap.exists) {
      const slotData = newSlotSnap.data()!;
      const existingHolds = slotData.holds || [];
      for (const h of existingHolds) {
        if (h.bookingId === params.bookingId) continue; // Skip self if already present
        const seats = Number(h.seats || 1);
        if (h.status === 'confirmed') {
          validHoldsOnNewSlot.push(h);
          committedOnNewDate += seats;
        } else if (h.status === 'hold') {
          const expTime = new Date(h.holdExpiresAt || 0).getTime();
          if (expTime > nowMs) {
            validHoldsOnNewSlot.push(h);
            committedOnNewDate += seats;
          }
        }
      }
    }

    const remainingSeatsNewDate = Math.max(0, mozbookCapacity - committedOnNewDate);
    if (requestedSeats > remainingSeatsNewDate) {
      throw new InventoryError(
        409,
        `Cannot reschedule to ${newDate}: Only ${remainingSeatsNewDate} spaces remaining out of ${mozbookCapacity}.`
      );
    }

    // Allocate on new slot
    const wasConfirmed = booking.paymentStatus === 'paid' || booking.status === 'confirmed';
    validHoldsOnNewSlot.push({
      bookingId: params.bookingId,
      customerUserId: booking.userId,
      seats: requestedSeats,
      status: wasConfirmed ? 'confirmed' : 'hold',
      rescheduledAt: nowIso
    });

    transaction.set(
      newSlotRef,
      {
        activityId,
        date: newDate,
        mozbookAllocatedCapacity: mozbookCapacity,
        holds: validHoldsOnNewSlot,
        confirmedSeats: committedOnNewDate + (wasConfirmed ? requestedSeats : 0),
        updatedAt: nowIso
      },
      { merge: true }
    );

    // Read and release old date inventory slot
    const oldSlotRef = adminDb.collection('inventory_experience_slots').doc(`${activityId}_${oldDate}`);
    const oldSlotSnap = await transaction.get(oldSlotRef);
    if (oldSlotSnap.exists) {
      const oldData = oldSlotSnap.data()!;
      const remainingHoldsOld = (oldData.holds || []).filter((h: any) => h.bookingId !== params.bookingId);
      const wasOldConfirmed = (oldData.holds || []).some(
        (h: any) => h.bookingId === params.bookingId && h.status === 'confirmed'
      );
      transaction.set(
        oldSlotRef,
        {
          holds: remainingHoldsOld,
          confirmedSeats: wasOldConfirmed
            ? Math.max(0, (oldData.confirmedSeats || 0) - requestedSeats)
            : oldData.confirmedSeats || 0,
          updatedAt: nowIso
        },
        { merge: true }
      );
    }

    // Update booking record
    transaction.update(bookingRef, {
      date: newDate,
      time: params.newTime || booking.time || '',
      weatherStatus: 'rescheduled',
      rescheduledFromDate: oldDate,
      rescheduledToDate: newDate,
      rescheduledAt: nowIso,
      rescheduledBy: params.initiatedBy,
      rescheduleNotes: params.notes || 'Weather-related schedule adjustment',
      updatedAt: nowIso,
      updatedAtServer: AdminFieldValue.serverTimestamp()
    });

    return {
      success: true,
      bookingId: params.bookingId,
      oldDate,
      newDate,
      newTime: params.newTime || booking.time,
      rescheduledBy: params.initiatedBy,
      rescheduledAt: nowIso
    };
  });
}

