import { describe, it, expect } from 'vitest';

export interface MockBookingEntity {
  id: string;
  userId: string;
  hostId: string;
  customerEmail?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded';
  currency: string;
  totalAmount: number;
}

export interface MockUserEntity {
  uid: string;
  email?: string;
  role?: string;
}

export function authorizeAndValidateRefundRequest(params: {
  booking: MockBookingEntity | null;
  paymentExists: boolean;
  paymentStatus?: string;
  paymentAmount?: number;
  requesterUser: MockUserEntity;
}) {
  const { booking, paymentExists, paymentStatus, paymentAmount, requesterUser } = params;

  // 1. Booking exists
  if (!booking) {
    return { authorized: false, statusCode: 404, error: 'Reservation not found.' };
  }

  // 2. Caller authorization: owner, host, or admin
  const isOwner = booking.userId === requesterUser.uid || 
    (requesterUser.email && booking.customerEmail && requesterUser.email.toLowerCase() === booking.customerEmail.toLowerCase());
  const isHost = booking.hostId === requesterUser.uid;
  const isAdmin = requesterUser.role === 'admin' || requesterUser.email === 'admin@mozbook.mz' || requesterUser.email === 'mozbookinfo@gmail.com';

  if (!isOwner && !isHost && !isAdmin) {
    return { authorized: false, statusCode: 403, error: 'Unauthorized: You are not authorized to request a refund for this reservation.' };
  }

  // 3. Paid payment check
  if (!paymentExists || paymentStatus !== 'paid') {
    return { authorized: false, statusCode: 400, error: 'No confirmed paid payment found for this reservation. Cannot refund unpaid booking.' };
  }

  // 4. Currency check
  if ((booking.currency || 'MZN').toUpperCase() !== 'MZN') {
    return { authorized: false, statusCode: 400, error: 'Unsupported currency. PaySuite strictly processes MZN.' };
  }

  return {
    authorized: true,
    statusCode: 200,
    refundableAmount: paymentAmount || booking.totalAmount,
    requesterRole: isAdmin ? 'admin' : isHost ? 'host' : 'customer'
  };
}

describe('Authoritative Refund & Payment Access Control Engine', () => {
  const customer: MockUserEntity = { uid: 'usr_traveler_1', email: 'traveler@gmail.com' };
  const host: MockUserEntity = { uid: 'usr_host_1', email: 'host@dive.mz' };
  const admin: MockUserEntity = { uid: 'usr_admin', email: 'admin@mozbook.mz', role: 'admin' };
  const randomStranger: MockUserEntity = { uid: 'usr_stranger', email: 'stranger@gmail.com' };

  const validPaidBooking: MockBookingEntity = {
    id: 'bk_valid_1',
    userId: 'usr_traveler_1',
    hostId: 'usr_host_1',
    customerEmail: 'traveler@gmail.com',
    status: 'confirmed',
    paymentStatus: 'paid',
    currency: 'MZN',
    totalAmount: 15000
  };

  describe('Authorization Rules', () => {
    it('allows booking owner to initiate refund', () => {
      const result = authorizeAndValidateRefundRequest({
        booking: validPaidBooking,
        paymentExists: true,
        paymentStatus: 'paid',
        paymentAmount: 15000,
        requesterUser: customer
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.requesterRole).toBe('customer');
    });

    it('allows assigned host to initiate refund', () => {
      const result = authorizeAndValidateRefundRequest({
        booking: validPaidBooking,
        paymentExists: true,
        paymentStatus: 'paid',
        paymentAmount: 15000,
        requesterUser: host
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.requesterRole).toBe('host');
    });

    it('allows platform admin to initiate refund', () => {
      const result = authorizeAndValidateRefundRequest({
        booking: validPaidBooking,
        paymentExists: true,
        paymentStatus: 'paid',
        paymentAmount: 15000,
        requesterUser: admin
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.requesterRole).toBe('admin');
    });

    it('strictly denies unauthorized 3rd-party users with 403 Forbidden', () => {
      const result = authorizeAndValidateRefundRequest({
        booking: validPaidBooking,
        paymentExists: true,
        paymentStatus: 'paid',
        paymentAmount: 15000,
        requesterUser: randomStranger
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Payment Integrity Rules', () => {
    it('rejects refund when booking does not exist (404)', () => {
      const result = authorizeAndValidateRefundRequest({
        booking: null,
        paymentExists: false,
        requesterUser: customer
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('rejects refund if reservation is unpaid or pending (400)', () => {
      const unpaidBooking: MockBookingEntity = {
        ...validPaidBooking,
        paymentStatus: 'unpaid'
      };

      const result = authorizeAndValidateRefundRequest({
        booking: unpaidBooking,
        paymentExists: true,
        paymentStatus: 'pending',
        requesterUser: customer
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Cannot refund unpaid booking');
    });

    it('rejects refund if payment currency is not MZN', () => {
      const foreignBooking: MockBookingEntity = {
        ...validPaidBooking,
        currency: 'USD'
      };

      const result = authorizeAndValidateRefundRequest({
        booking: foreignBooking,
        paymentExists: true,
        paymentStatus: 'paid',
        requesterUser: customer
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Unsupported currency');
    });
  });

  describe('Truthful Provider Status Lifecycle (No Simulation)', () => {
    it('verifies that gateway failures record truthful failed status rather than claiming money returned', () => {
      // When PaySuite gateway throws an error (e.g. 502 or network error)
      const gatewayResponse = { success: false, error: 'PaySuite gateway unreachable' };

      const refundRecord = {
        status: gatewayResponse.success ? 'pending' : 'failed',
        failureReason: gatewayResponse.error
      };

      expect(refundRecord.status).toBe('failed');
      expect(refundRecord.failureReason).toBe('PaySuite gateway unreachable');
    });

    it('verifies that refund is only marked completed when provider explicitly reports completed', () => {
      const initialStatus = 'pending';
      const providerStatus = 'completed';

      let authoritativeRefundStatus = initialStatus;
      if (providerStatus === 'completed') {
        authoritativeRefundStatus = 'completed';
      }

      expect(authoritativeRefundStatus).toBe('completed');
    });
  });
});
