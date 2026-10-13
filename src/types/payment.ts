/**
 * PaySuite & MozBook Payment Architecture Types (Stage 1)
 *
 * AUTHORITATIVE SPECIFICATION:
 * Based strictly on PaySuite official OpenAPI 3.0.3 (openapi.yaml) and documented operational behavior.
 * Server Base URL: https://paysuite.tech (LIVE PRODUCTION GATEWAY ONLY - NO SANDBOX)
 */

// ============================================================================
// 1. PaySuite Authoritative API Enums (from openapi.yaml)
// ============================================================================

/**
 * Customer payment methods accepted by PaySuite payment requests (POST /api/v1/payments)
 */
export type PaySuitePaymentMethod = 'credit_card' | 'mpesa' | 'emola';

/**
 * Host payout methods supported by PaySuite payout requests (POST /api/v1/payouts)
 */
export type PaySuitePayoutMethod = 'mpesa' | 'emola' | 'mkesh' | 'bank' | 'bank_transfer';

/**
 * PaySuite Payment Request status values (from openapi.yaml)
 */
export type PaySuitePaymentStatus = 'pending' | 'paid';

/**
 * PaySuite Payout Request status values (from openapi.yaml: pending, completed, failed, cancelled)
 */
export type PaySuitePayoutStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

/**
 * PaySuite Refund status values (from openapi.yaml: pending, processing, completed, failed, cancelled)
 */
export type PaySuiteRefundStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ============================================================================
// 2. MozBook Core Booking, Payment & Fulfillment Status Separation
// Rule: PAID ≠ SERVICE DELIVERED
// ============================================================================

/**
 * Reservation state
 */
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

/**
 * Financial settlement state
 */
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Service delivery state (independent of financial status)
 */
export type FulfillmentStatus = 'unfulfilled' | 'ready' | 'checked_in' | 'redeemed' | 'completed';

// ============================================================================
// 3. Payment Ledger Entity (Collection: 'payments')
// ============================================================================

export interface PaymentLedgerEntry {
  /** MozBook internal unique payment identifier: `pay_${timestamp}_${rand}` */
  id: string;

  /** Foreign key to target booking (`bookings` or `activity_bookings`) */
  bookingId: string;

  /** Category of service being purchased */
  bookingCategory: 'stay' | 'activity' | 'trip';

  /**
   * Server-controlled unique booking reference sent to PaySuite (Max 50 chars).
   * Example: `MB-BK-849201` or `MB-EXP-749201`
   */
  bookingRef: string;

  /** Customer / payer authenticated UID */
  payerUserId: string;
  payerName: string;
  payerEmail: string;
  payerPhone?: string;

  /** Host / provider receiving net earnings */
  hostId: string;

  /** Optional travel companion group linkage */
  travelGroupId?: string;

  /** Amount in Mozambican Meticais (PaySuite only supports MZN) */
  amount: number;
  currency: 'MZN';

  /** Selected customer payment rail (matching PaySuite OpenAPI enum) */
  paymentMethod?: PaySuitePaymentMethod;

  /** Internal financial settlement state */
  status: PaymentStatus;

  /** PaySuite Hosted Checkout URL provided upon payment creation */
  checkoutUrl?: string;

  /** PaySuite Payment Request ULID (e.g., `01H8X9V8X9Y8Z9A8B8C8D8E8F8`) */
  paysuitePaymentId?: string;

  /** PaySuite Contact ULID for the customer */
  paysuiteContactId?: string;

  /** PaySuite Transaction ID (e.g., `MPESA123456`) from verified transaction details */
  paysuiteTransactionId?: string;

  /**
   * Idempotency token: SHA-256 or unique client intent key to prevent double charging
   * on network retries or browser refreshes.
   */
  idempotencyKey: string;

  /** Timestamp when payment was verified via PaySuite webhook or GET verification */
  verifiedAt?: string;

  /** Webhook delivery tracking for idempotent processing */
  webhookReceivedAt?: string;
  webhookRequestId?: string;

  /** Failure or cancellation reason */
  failureReason?: string;

  /** Refund linkage if payment is reversed */
  refundId?: string;
  refundAmount?: number;
  refundStatus?: PaySuiteRefundStatus;
  refundReason?: string;

  /** Stage 4A Dispute Isolation & Gateway Fee Accounting */
  isDisputed?: boolean;
  disputeStatus?: 'open' | 'investigating' | 'resolved' | 'dismissed';
  disputeReason?: string;
  disputeOpenedAt?: string;
  disputeResolvedAt?: string;
  disputedAmountMzn?: number;
  gatewayProcessingFeeMzn?: number;
  gatewayRefundFeeMzn?: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 4. Host Payout Request Entity (Collection: 'payout_requests')
// ============================================================================

export interface PayoutBeneficiaryMobile {
  /** 9-digit Mozambican mobile phone number without +258 prefix (e.g. '841234567') */
  phone: string;
  /** Full legal account holder name */
  holder: string;
}

export interface PayoutBeneficiaryBank {
  /** 21-digit Mozambican Bank NIB (Número de Identificação Bancária) */
  nib: string;
  /** Full legal account holder name */
  holder: string;
}

export type PayoutBeneficiary = PayoutBeneficiaryMobile | PayoutBeneficiaryBank;

export interface HostPayoutRequest {
  /** MozBook internal payout identifier: `po_${timestamp}_${rand}` */
  id: string;

  /** Host authenticated UID */
  hostId: string;
  hostName: string;

  /** Payout amount in MZN (min 1, max 1,000,000 per PaySuite spec) */
  amount: number;
  currency: 'MZN';

  /** Unique alphanumeric reference up to 30 characters (e.g. `PO-HST-781920`) */
  reference: string;

  /** Payout method rail (matching PaySuite OpenAPI enum) */
  method: PaySuitePayoutMethod;

  /** Validated beneficiary details */
  beneficiary: PayoutBeneficiary;

  /** Status according to PaySuite lifecycle */
  status: PaySuitePayoutStatus;

  /** PaySuite Payout ULID */
  paysuitePayoutId?: string;

  /** Optional internal host description */
  description?: string;

  requestedAt: string;
  completedAt?: string;
  failureReason?: string;
}

// ============================================================================
// 5. PaySuite Customer UI Display Presets
// ============================================================================

export interface CustomerPaymentMethodConfig {
  id: PaySuitePaymentMethod;
  label: string;
  sublabel: string;
  badge: string;
  isPopular?: boolean;
}

export const PAYSUITE_CUSTOMER_PAYMENT_METHODS: CustomerPaymentMethodConfig[] = [
  {
    id: 'mpesa',
    label: 'M-Pesa',
    sublabel: 'Mobile money payment with Vodacom M-Pesa',
    badge: 'Popular in Mozambique',
    isPopular: true
  },
  {
    id: 'emola',
    label: 'e-Mola',
    sublabel: 'Mobile money payment with Movitel e-Mola',
    badge: 'Popular in Mozambique'
  },
  {
    id: 'credit_card',
    label: 'Visa / Mastercard — Credit or Debit Card',
    sublabel: 'Credit or debit card payment',
    badge: 'International & Local'
  }
];

export const PAYSUITE_PAYOUT_METHODS: { id: PaySuitePayoutMethod; label: string; type: 'mobile' | 'bank' }[] = [
  { id: 'mpesa', label: 'M-Pesa (Vodacom)', type: 'mobile' },
  { id: 'emola', label: 'e-Mola (Movitel)', type: 'mobile' },
  { id: 'mkesh', label: 'M-Kesh (Tmcel)', type: 'mobile' },
  { id: 'bank', label: 'Standard Bank / BCI / BIM (NIB)', type: 'bank' },
  { id: 'bank_transfer', label: 'Direct Bank Wire (NIB)', type: 'bank' }
];

// ============================================================================
// 6. Operator Inventory Failure & Accountability Debits (Collection: 'operator_inventory_debits')
// ============================================================================

export interface OperatorInventoryDebit {
  /** MozBook internal debit identifier: `deb_${timestamp}_${rand}` */
  id: string;

  /** Host / Operator UID who failed to honour inventory */
  hostId: string;
  hostName?: string;

  /** Target reservation affected */
  bookingId: string;
  bookingRef: string;
  bookingCategory: 'stay' | 'activity' | 'trip';
  offeringTitle: string;

  /** Failure classification */
  reason: 'operator_inventory_failure' | 'operator_overbooking' | 'unauthorized_external_resale';

  /** Amount refunded to customer (100% guarantee) */
  customerRefundAmountMzn: number;

  /** Debit / penalty amount debited from operator earnings */
  debitAmountMzn: number;

  /** Settlement status of the debit against partner earnings ledger */
  status: 'pending' | 'applied' | 'waived';

  notes?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ============================================================================
// 7. Authoritative Refund Record (Collection: 'refunds')
// ============================================================================

export interface RefundRecord {
  /** MozBook internal refund identifier: `ref_${timestamp}_${rand}` */
  id: string;

  /** MozBook payment ledger entry ID */
  paymentId: string;

  /** PaySuite Payment Request ULID */
  paysuitePaymentId: string;

  /** Target booking ID and reference */
  bookingId: string;
  bookingRef: string;
  bookingCategory: 'stay' | 'activity' | 'trip';

  /** Host UID associated with the booking */
  hostId: string;

  /** User ID who requested the refund (customer, host, or admin) */
  requestedByUserId: string;
  requestedByRole: 'customer' | 'host' | 'admin' | 'system';

  /** Refund amount in MZN */
  amount: number;
  currency: 'MZN';

  /** Original total paid on the payment */
  originalPaymentAmount: number;

  /** Stated reason for the refund */
  reason: string;
  incidentType?: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'admin_intervention' | 'duplicate_payment';

  /** Stage 4A Policy Snapshot Linkage & Gateway Fee Breakdown */
  policyTier?: string;
  policyVersion?: string;
  retainedAmountMzn?: number;
  gatewayFeeDeductedMzn?: number;

  /** Authoritative provider refund lifecycle status */
  status: PaySuiteRefundStatus;

  /** Provider refund ULID returned from POST /api/v1/refunds */
  paysuiteRefundId?: string;

  /** Provider error or rejection reason if refund request fails */
  failureReason?: string;

  /** Financial reconciliation tracking */
  commissionAdjustmentMzn: number; // 15% platform commission reversal
  partnerShareAdjustmentMzn: number; // 85% partner payout reversal

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

