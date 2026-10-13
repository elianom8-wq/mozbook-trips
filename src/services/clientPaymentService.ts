/**
 * MozBook Client Payment Service (Stage 2D)
 *
 * Coordinates customer checkout with the authoritative MozBook backend:
 * - POST /api/payments/create-intent
 * - GET /api/payments/:id
 * - GET /api/bookings/:bookingId/status
 *
 * ARCHITECTURAL INVARIANT:
 * THE FRONTEND NEVER MARKS A BOOKING PAID OR CONFIRMED.
 * All payment settlements are performed authoritatively by the Stage 2C Webhook.
 */

import { auth } from '../firebase';
import { PaySuitePaymentMethod } from '../types/payment';

export interface CreatePaymentIntentRequest {
  bookingId: string;
  bookingCategory?: 'stay' | 'activity' | 'trip';
  paymentMethod?: PaySuitePaymentMethod;
  customReturnUrl?: string;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  paymentId?: string;
  bookingId?: string;
  bookingRef?: string;
  amount?: number;
  currency?: string;
  checkoutUrl?: string;
  status?: string;
  reusedExisting?: boolean;
  error?: string;
}

export interface AuthoritativeBookingStatusResponse {
  success: boolean;
  booking?: {
    id: string;
    bookingRef: string;
    bookingCategory: 'stay' | 'activity' | 'trip';
    status: 'pending' | 'confirmed' | 'cancelled' | string;
    paymentStatus: 'unpaid' | 'paid' | 'failed' | string;
    fulfillmentStatus: 'unfulfilled' | 'fulfilled' | string;
    title: string;
    city?: string;
    location?: string;
    image?: string;
    startDate: string;
    endDate: string;
    nights?: number;
    totalGuests: number;
    adults?: number;
    children?: number;
    totalAmount: number;
    currency: string;
    paidAt?: string | null;
    confirmedAt?: string | null;
    createdAt?: string;
    isWeatherDependent?: boolean;
    weatherStatus?: 'normal' | 'weather_watch' | 'weather_cancelled' | 'rescheduled' | null;
    cancellationInitiator?: string | null;
    cancellationReason?: string | null;
    operatorFailureNotes?: string | null;
    rescheduledFromDate?: string | null;
    rescheduledToDate?: string | null;
    rescheduledAt?: string | null;
    rescheduledBy?: string | null;
    rescheduleNotes?: string | null;
  };
  error?: string;
}

/**
 * Initiates an authoritative PaySuite payment intent via backend API
 */
export async function createCheckoutPaymentIntent(
  params: CreatePaymentIntentRequest
): Promise<CreatePaymentIntentResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to proceed to checkout.');
  }

  const token = await currentUser.getIdToken();

  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(params)
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to initiate PaySuite payment intent.');
  }

  return data;
}

/**
 * Retrieves authoritative booking & payment status with strict ownership enforcement
 */
export async function fetchAuthoritativeBookingStatus(
  bookingId: string
): Promise<AuthoritativeBookingStatusResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required to inspect reservation status.');
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorMsg = data.error || `Failed to fetch status for reservation '${bookingId}'.`;
    const err = new Error(errorMsg) as Error & { statusCode?: number };
    err.statusCode = response.status;
    throw err;
  }

  return data;
}
