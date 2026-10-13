import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types/booking';
import { OperatorInventoryDebit } from '../types/payment';
import { getLocalOperatorDebits, saveLocalOperatorDebits } from './activityTripService';

const STORAGE_KEY_STAY_BOOKINGS = 'mozbook_stay_bookings';

function getLocalStayBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STAY_BOOKINGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStayBookings(bookings: Booking[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STAY_BOOKINGS, JSON.stringify(bookings));
  } catch (err) {
    console.warn('Could not cache stay bookings in localStorage:', err);
  }
}

/**
 * Creates a persistent Stay / Property Reservation in the existing `bookings` collection.
 * 
 * Enforces Stage 1 & Stage 2A constraints:
 * - status: 'pending'
 * - paymentStatus: 'unpaid'
 * - fulfillmentStatus: 'unfulfilled'
 * - currency: 'MZN'
 * - Unique reference: MB-STAY-XXXXXX (under 50 chars)
 */
export async function createStayBooking(
  bookingData: Omit<Booking, 'id' | 'createdAt' | 'bookingRef' | 'status' | 'paymentStatus' | 'fulfillmentStatus'>
): Promise<Booking> {
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
      category: 'stay',
      listingId: bookingData.listingId,
      listingTitle: bookingData.listingTitle,
      hostId: bookingData.hostId,
      startDate: bookingData.startDate || bookingData.checkInDate,
      endDate: bookingData.endDate || bookingData.checkOutDate,
      nights: bookingData.nights,
      adults: bookingData.adults,
      children: bookingData.children,
      totalGuests: bookingData.totalGuests,
      customerUserId: bookingData.userId,
      customerName: bookingData.customerName,
      customerEmail: bookingData.customerEmail,
      customerPhone: bookingData.customerPhone,
      totalAmount: bookingData.totalAmount,
      accommodationId: (bookingData as any).accommodationId,
      travelGroupId: bookingData.travelGroupId
    })
  });

  const resJson = await res.json().catch(() => null);

  if (!res.ok) {
    const errMsg = resJson?.error || `Failed to reserve accommodation inventory (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  const newBooking = resJson.booking as Booking;

  // Cache locally
  const local = getLocalStayBookings();
  saveLocalStayBookings([newBooking, ...local.filter(b => b.id !== newBooking.id)]);

  return newBooking;
}

/**
 * Retrieves stay bookings for a specific customer
 */
export async function getUserStayBookings(userId: string): Promise<Booking[]> {
  try {
    const coll = collection(db, 'bookings');
    const q = query(coll, where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: Booking[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as Booking);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore get user stay bookings failed, fallback to local:', err);
  }

  return getLocalStayBookings().filter(b => b.userId === userId);
}

/**
 * Retrieves stay bookings for a specific listing
 */
export async function getListingStayBookings(listingId: string): Promise<Booking[]> {
  try {
    const coll = collection(db, 'bookings');
    const q = query(coll, where('listingId', '==', listingId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: Booking[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as Booking);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore get listing stay bookings failed, fallback to local:', err);
  }

  return getLocalStayBookings().filter(b => b.listingId === listingId);
}

/**
 * Retrieves a single stay booking by its Firestore ID
 */
export async function getStayBookingById(bookingId: string): Promise<Booking | null> {
  try {
    const docRef = doc(db, 'bookings', bookingId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Booking;
    }
  } catch (err) {
    console.warn('Firestore getStayBookingById failed:', err);
  }

  const local = getLocalStayBookings();
  return local.find(b => b.id === bookingId) || null;
}

/**
 * Retrieves all stay bookings across a host's listings
 */
export async function getHostStayBookings(listingIds: string[]): Promise<Booking[]> {
  if (!listingIds || listingIds.length === 0) return [];
  try {
    const promises = listingIds.map(id => getListingStayBookings(id));
    const results = await Promise.all(promises);
    const combined = results.flat();
    return combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.warn('Error fetching host stay bookings:', err);
    return [];
  }
}

/**
 * Retrieves stay bookings associated with a travel group
 */
export async function getGroupStayBookings(travelGroupId: string): Promise<Booking[]> {
  try {
    const coll = collection(db, 'bookings');
    const q = query(coll, where('travelGroupId', '==', travelGroupId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: Booking[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as Booking);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore get group stay bookings failed, fallback to local:', err);
  }

  return getLocalStayBookings().filter(b => b.travelGroupId === travelGroupId);
}

/**
 * Handle Operator Inventory Failure for Stays / Accommodations (Prompt 28)
 * - MozBook protects the customer: 100% full refund entitlement guaranteed.
 * - Operator is accountable: records debit/penalty in partner earnings ledger.
 */
export async function handleStayOperatorInventoryFailure(
  bookingId: string,
  notes?: string,
  operatorHostId?: string
): Promise<{ success: boolean; customerRefundAmountMzn: number; debitId: string }> {
  const allBookings = getLocalStayBookings();
  const booking = allBookings.find(b => b.id === bookingId);
  const refundAmount = booking?.totalAmount || 0;
  const hostId = operatorHostId || booking?.hostId || 'unknown_host';
  const now = new Date().toISOString();

  // 1. Update Booking Status to Cancelled with 100% Customer Protection
  try {
    const docRef = doc(db, 'bookings', bookingId);
    await updateDoc(docRef, {
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationInitiator: 'operator',
      cancellationReason: 'operator_inventory_failure',
      operatorFailureNotes: notes || 'Operator accommodation inventory failure / overbooking',
      customerProtectionRefundMzn: refundAmount,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore stay cancellation update note:', err);
  }

  // Update local cache
  const bIdx = allBookings.findIndex(b => b.id === bookingId);
  if (bIdx >= 0) {
    allBookings[bIdx] = {
      ...allBookings[bIdx],
      status: 'cancelled',
      paymentStatus: 'refunded',
      cancellationInitiator: 'operator',
      cancellationReason: 'operator_inventory_failure',
      operatorFailureNotes: notes || 'Operator accommodation inventory failure / overbooking',
      customerProtectionRefundMzn: refundAmount,
      updatedAt: now
    };
    saveLocalStayBookings(allBookings);
  }

  // 2. Record Operator Inventory Debit
  const debitAmountMzn = Math.round(refundAmount * 0.15); // Standard 15% marketplace platform debit
  const debitId = `deb_stay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const debitRecord: OperatorInventoryDebit = {
    id: debitId,
    hostId,
    bookingId,
    bookingRef: booking?.bookingRef || `MB-STAY-${bookingId}`,
    bookingCategory: 'stay',
    offeringTitle: booking?.listingTitle || 'Stay Accommodation',
    reason: 'operator_inventory_failure',
    customerRefundAmountMzn: refundAmount,
    debitAmountMzn,
    status: 'applied',
    notes: notes || 'Host accommodation inventory failure / overbooking debit',
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

