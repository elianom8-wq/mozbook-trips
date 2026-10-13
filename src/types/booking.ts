import { BookingStatus, PaymentStatus, FulfillmentStatus } from './payment';

/**
 * Stay / Property Booking Record
 * Persisted in the existing Firestore collection: `bookings/{bookingId}`
 *
 * Rule: PAID ≠ SERVICE DELIVERED
 * Initial state: status = 'pending', paymentStatus = 'unpaid', fulfillmentStatus = 'unfulfilled'
 */
export interface Booking {
  /** Firestore document ID: `bk_stay_${timestamp}_${rand}` or Firestore auto-ID */
  id: string;

  /** Human-readable, unique MozBook booking reference (Max 50 chars, e.g. `MB-STAY-849201`) */
  bookingRef: string;

  /** Foreign key to `listings/{listingId}` */
  listingId: string;
  listingTitle?: string;
  listingCity?: string;
  listingLocation?: string;
  listingImage?: string;

  /** Host / property owner UID */
  hostId: string;

  /** Customer / traveler authenticated UID */
  userId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  /** Stay reservation dates in ISO format (YYYY-MM-DD) */
  startDate: string; // Required by firestore.rules isValidBooking
  endDate: string;   // Required by firestore.rules isValidBooking
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nightlyRate: number;

  /** Guest breakdown */
  adults: number;
  children: number;
  totalGuests: number;

  /** Fees and total pricing in MZN */
  cleaningFee: number;
  serviceFee: number;
  totalAmount: number; // Required by firestore.rules isValidBooking
  currency: 'MZN';

  /** Triple status separation */
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;

  /** Optional Travel Companion group linkage */
  travelGroupId?: string;

  /** Optional accommodation unit selection (for multi-unit lodges/chalets) */
  accommodationId?: string;
  accommodationName?: string;

  /** Operator Accountability & Customer Protection Fields */
  cancellationInitiator?: 'customer' | 'operator' | 'admin';
  cancellationReason?: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'force_majeure' | 'other';
  operatorFailureNotes?: string;
  customerProtectionRefundMzn?: number;
  inventoryFailureDebitMzn?: number;
  mozbookAllocatedUnits?: number;

  /** Stage 4A Versioned Cancellation Policy Snapshot & Dispute Tracking */
  cancellationSnapshot?: import('./cancellationPolicy').BookingCancellationSnapshot;
  cancellationSettlement?: import('./cancellationPolicy').CancellationSettlementCalculation;
  isDisputed?: boolean;
  disputeStatus?: 'open' | 'investigating' | 'resolved' | 'dismissed';
  disputeReason?: string;
  disputeOpenedAt?: string;
  disputeResolvedAt?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt?: string;
}
