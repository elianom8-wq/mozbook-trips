export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  timestamp: string;
  createdAt?: any;
  authProvider?: string;
  metadata?: Record<string, any>;
}

export interface AdminStats {
  totalUsers: number | null;
  activeUsers: number | null;
  totalHosts: number | null;
  totalProperties: number | null;
  totalActivitiesTrips: number | null;
  totalBookings: number | null;
  pendingVerifications: number | null;
  platformRevenue: number | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string | null;
  role: 'guest' | 'host' | 'admin' | string;
  phoneNumber?: string | null;
  location?: string | null;
  country?: string | null;
  accountStatus?: string | null;
  createdAt?: any;
  lastLoginAt?: any;
  updatedAt?: any;
}

export interface UserActivitySummary {
  propertiesCount: number;
  activitiesCount: number;
  bookingsCount: number;
  travelGroupsCount: number;
}

export interface AdminHost {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  phoneNumber?: string | null;
  location?: string | null;
  country?: string | null;
  joinedAt?: any;
  accountStatus?: string | null;
  
  // Verification details
  verificationId?: string;
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'suspended' | 'unverified';
  expiryStatus?: 'valid' | 'expiring_soon' | 'expired';
  isExpired?: boolean;
  inGracePeriod?: boolean;
  gracePeriodDaysRemaining?: number;
  suspensionEffectiveDate?: string;
  isSuspended?: boolean;
  suspensionReason?: 'safety' | 'misconduct' | 'document_expired' | string;
  expiryDate?: string;
  docType?: string;
  docNumber?: string;
  submittedAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  adminNotes?: string;

  // Inventory & Bookings
  propertiesCount: number;
  activitiesCount: number;
  propertyBookingsCount: number;
  activityBookingsCount: number;
  totalBookingsCount: number;
}

export interface AdminProperty {
  id: string;
  title: string;
  description?: string;
  location: string;
  city?: string;
  province?: string;
  country?: string;
  residenceType?: string;
  category?: string;
  price: number;
  currency?: string;
  status: 'published' | 'draft' | 'pending' | 'suspended' | string;
  hostId: string;
  hostName?: string;
  hostEmail?: string;
  hostPhoto?: string;
  isHostVerified?: boolean;
  images: string[];
  labeledImages?: { url: string; label?: string }[];
  coordinates?: { lat: number; lng: number };
  minNights?: number;
  maxGuests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  amenities?: string[];
  specialOffer?: any;
  accommodations?: any[];
  totalLodgeUnits?: number;
  createdAt?: any;
  updatedAt?: any;
  totalBookings: number;
  upcomingBookings: number;
}

export interface AdminActivityTrip {
  id: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  hostPhone?: string;
  hostPhoto?: string;
  isHostVerified?: boolean;
  type: 'activity' | 'trip' | string;
  title: string;
  shortDescription?: string;
  description: string;
  category: string;
  customCategory?: string;
  city: string;
  meetingPoint?: string;
  meetingPointInstructions?: string;
  coordinates?: { lat: number; lng: number };
  pickup?: {
    offered: boolean;
    areas?: string;
    location?: string;
    instructions?: string;
    fee?: number;
  };
  duration: string;
  multiDayDetails?: { days: number; nights: number };
  scheduleType?: string;
  recurringDays?: string[];
  startTimes?: string[];
  specificDates?: string[];
  maxGuests: number;
  minGuests?: number;
  pricingType: string;
  priceAdult: number;
  priceChild?: number;
  priceGroup?: number;
  groupMaxGuests?: number;
  pricePerBooking?: number;
  currency: string;
  specialOffer?: {
    enabled: boolean;
    offerName: string;
    discountPercent?: number;
    specialPrice?: number;
    startDate?: string;
    endDate?: string;
    seasonalTag?: string;
  } | null;
  images: string[];
  coverImage?: string;
  videos?: string[];
  vehicleType?: string;
  included?: string[];
  notIncluded?: string[];
  whatToBring?: string[];
  requirements?: string[];
  status: 'published' | 'draft' | 'pending' | 'paused' | 'suspended' | string;
  rating?: number;
  reviewsCount?: number;
  createdAt?: any;
  updatedAt?: any;
  totalBookings: number;
  upcomingBookings: number;
}

export type AdminBookingCategory = 'stay' | 'activity' | 'trip' | 'transport';

export interface AdminUnifiedBooking {
  id: string;
  bookingRef: string;
  category: AdminBookingCategory;
  sourceCollection: 'bookings' | 'activity_bookings';
  
  // Listing / Activity association
  targetId: string; // listingId or activityId
  targetTitle: string;
  targetCity?: string;
  targetLocation?: string;
  targetImage?: string;
  
  // Host / Operator association
  hostId: string;
  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;
  isHostVerified?: boolean;
  
  // Customer / Traveler association
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  
  // Dates & Schedule
  startDate: string; // checkInDate or experience date
  endDate?: string;   // checkOutDate (stays) or same day (experiences)
  time?: string;      // start time for activities
  nights?: number;    // for stays
  
  // Guests
  adults: number;
  children: number;
  totalGuests: number;
  
  // Financial breakdown
  totalAmount: number;
  currency: string;
  nightlyRate?: number;
  cleaningFee?: number;
  serviceFee?: number;
  pricingType?: string;
  
  // Multi-status separation
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | string;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | string;
  fulfillmentStatus: 'unfulfilled' | 'ready' | 'checked_in' | 'redeemed' | 'completed' | string;
  
  // Travel group linkage
  travelGroupId?: string;
  
  // Accommodation / Unit (for stays)
  accommodationId?: string;
  accommodationName?: string;
  
  // Operator Accountability & Cancellation Details
  cancellationInitiator?: 'customer' | 'operator' | 'admin';
  cancellationReason?: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'force_majeure' | 'other' | string;
  operatorFailureNotes?: string;
  customerProtectionRefundMzn?: number;
  inventoryFailureDebitMzn?: number;
  
  // Weather & Rescheduling (Experiences)
  isWeatherDependent?: boolean;
  weatherStatus?: 'normal' | 'weather_watch' | 'weather_cancelled' | 'rescheduled';
  rescheduledFromDate?: string;
  rescheduledToDate?: string;
  rescheduledAt?: string;
  rescheduledBy?: 'operator' | 'customer' | 'admin';
  rescheduleNotes?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;

  // Stage 4A Marketplace Policy Snapshot & Dispute Tracking
  cancellationSnapshot?: any;
  cancellationSettlement?: any;
  isDisputed?: boolean;
  disputeStatus?: string;
  disputeReason?: string;
}

// ============================================================================
// Admin Financials & Reconciliation Types (Stage 3)
// ============================================================================

export interface AdminFinancialPipeline {
  /** Sum of all bookings regardless of payment status */
  totalBookingValue: number;
  totalBookingsCount: number;
  /** Confirmed or completed reservations */
  confirmedBookingValue: number;
  confirmedBookingsCount: number;
  /** Pending reservations */
  pendingBookingValue: number;
  pendingBookingsCount: number;
  /** Cancelled reservations */
  cancelledBookingValue: number;
  cancelledBookingsCount: number;
  /** Completed stays / experiences */
  completedBookingValue: number;
  completedBookingsCount: number;
}

export interface AdminFinancialCollections {
  /** Total payments with status === 'paid' before refund reversals */
  grossCollectedAmount: number;
  paidPaymentsCount: number;
  /** Initiated or pending PaySuite checkouts */
  pendingPaymentsAmount: number;
  pendingPaymentsCount: number;
  /** Failed payments */
  failedPaymentsAmount: number;
  failedPaymentsCount: number;
  /** Net cash collected after deducting completed refunds */
  netCollectedAmount: number;
}

export interface AdminFinancialRefunds {
  /** Completed refunds processed through PaySuite / internal ledger */
  totalCompletedRefundsAmount: number;
  completedRefundsCount: number;
  /** In-progress / pending refunds */
  inProgressRefundsAmount: number;
  inProgressRefundsCount: number;
  /** Failed refund attempts */
  failedRefundsAmount: number;
  failedRefundsCount: number;
}

export interface AdminFinancialPlatformRevenue {
  /** Standard MozBook commission rate (0.15 / 15%) */
  commissionRate: number;
  commissionPercent: number;
  /** Gross 15% fee on collected payments */
  grossPlatformCommission: number;
  /** 15% platform fee reversed due to completed refunds */
  commissionReversals: number;
  /** Net platform commission retained by MozBook */
  netPlatformRevenue: number;
}

export interface AdminFinancialPartnerSettlement {
  /** Standard Partner share rate (0.85 / 85%) */
  partnerShareRate: number;
  partnerSharePercent: number;
  /** Gross 85% share on collected payments */
  grossPartnerShare: number;
  /** 85% partner share reversed due to completed refunds */
  partnerRefundReversals: number;
  /** Operator inventory accountability debits applied */
  operatorDebitsAmount: number;
  operatorDebitsCount: number;
  /** Net partner earnings (gross - refunds - debits) */
  netPartnerEarnings: number;
  /** Completed payouts actually disbursed to partners */
  completedPayoutsAmount: number;
  completedPayoutsCount: number;
  /** Pending payout requests awaiting disbursement */
  pendingPayoutsAmount: number;
  pendingPayoutsCount: number;
  /** Retained partner earnings awaiting payout request / settlement */
  retainedPartnerBalance: number;
}

export interface AdminFinancialReconciliation {
  /** Confirmed or completed bookings that do not have a confirmed paid payment */
  unpaidBookingsValue: number;
  unpaidBookingsCount: number;
  /** Number of duplicate webhook / transaction records safely ignored */
  duplicateTransactionsDetected: number;
  currency: 'MZN';
  lastReconciledAt: string;
  isDataAvailable: boolean;
}

export interface AdminFinancialSummary {
  pipeline: AdminFinancialPipeline;
  collections: AdminFinancialCollections;
  refunds: AdminFinancialRefunds;
  platformRevenue: AdminFinancialPlatformRevenue;
  partnerSettlement: AdminFinancialPartnerSettlement;
  reconciliation: AdminFinancialReconciliation;
}

export type AdminFinancialTransactionType = 'payment' | 'refund' | 'payout' | 'debit';

export interface AdminFinancialTransaction {
  id: string;
  type: AdminFinancialTransactionType;
  reference: string;
  bookingId?: string;
  bookingRef?: string;
  bookingCategory?: 'stay' | 'activity' | 'trip' | 'transport';
  targetTitle?: string;
  payerOrBeneficiary: string;
  payerEmail?: string;
  hostId?: string;
  hostName?: string;
  amount: number;
  currency: 'MZN';
  status: string;
  paymentMethod?: string;
  gatewayTransactionId?: string;
  gatewayPaymentId?: string;
  commissionMzn?: number;
  partnerShareMzn?: number;
  createdAt: string;
  notes?: string;
}


