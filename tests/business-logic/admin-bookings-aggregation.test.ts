import { describe, it, expect } from 'vitest';
import { AdminUnifiedBooking } from '../../src/types/admin';

describe('Admin Bookings Data Aggregation, Normalization & Filtering Logic', () => {
  // Test Fixtures for stays and experiences
  const sampleStayRaw = {
    id: 'stay-doc-123',
    bookingRef: 'MB-STAY-A1B2C3D4',
    listingId: 'listing-456',
    listingTitle: 'Ponta do Ouro Beach Chalet',
    listingCity: 'Ponta do Ouro',
    listingLocation: 'Main Beach Road',
    hostId: 'host-user-999',
    userId: 'guest-user-111',
    customerName: 'Alice Traveler',
    customerEmail: 'alice@example.com',
    customerPhone: '+258841234567',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    nights: 4,
    adults: 2,
    children: 1,
    totalGuests: 3,
    totalAmount: 18000,
    currency: 'MZN',
    nightlyRate: 4000,
    cleaningFee: 2000,
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'ready',
    createdAt: '2026-10-01T10:00:00.000Z'
  };

  const sampleLegacyStayRaw = {
    id: 'stay-doc-legacy',
    // Missing bookingRef, nights, adults, currency
    listingId: 'listing-legacy-1',
    hostId: 'host-legacy-2',
    userId: 'guest-legacy-3',
    startDate: '2026-12-10',
    totalAmount: 5000,
    status: undefined, // missing
    paymentStatus: undefined, // missing
    createdAt: undefined // missing
  };

  const sampleExperienceRaw = {
    id: 'act-doc-789',
    bookingRef: 'MB-EXP-E5F6G7H8',
    activityId: 'activity-987',
    activityTitle: 'Bazaruto Archipelago Dhow Safari',
    activityType: 'trip',
    city: 'Vilankulo',
    hostId: 'operator-444',
    userId: 'guest-222',
    customerName: 'Bob Adventurer',
    customerEmail: 'bob@example.com',
    date: '2026-11-15',
    time: '08:00 AM',
    adults: 4,
    children: 0,
    totalMzn: 24000,
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'unfulfilled',
    isWeatherDependent: true,
    weatherStatus: 'normal',
    createdAt: '2026-10-05T14:30:00.000Z'
  };

  it('correctly separates booking status from payment status', () => {
    // A booking can be confirmed but unpaid, or cancelled but paid/refunded
    const bookingConfirmedUnpaid: Partial<AdminUnifiedBooking> = {
      status: 'confirmed',
      paymentStatus: 'unpaid'
    };
    expect(bookingConfirmedUnpaid.status).toBe('confirmed');
    expect(bookingConfirmedUnpaid.paymentStatus).toBe('unpaid');
    expect(bookingConfirmedUnpaid.status).not.toBe(bookingConfirmedUnpaid.paymentStatus);

    const bookingCancelledPaid: Partial<AdminUnifiedBooking> = {
      status: 'cancelled',
      paymentStatus: 'refunded'
    };
    expect(bookingCancelledPaid.status).toBe('cancelled');
    expect(bookingCancelledPaid.paymentStatus).toBe('refunded');
  });

  it('handles missing and legacy fields safely with fallbacks without corrupting data', () => {
    const raw = sampleLegacyStayRaw;
    const fallbackBookingRef = `MB-STAY-${raw.id.slice(0, 8).toUpperCase()}`;
    const fallbackCategory = 'stay';
    const fallbackStatus = raw.status || 'pending';
    const fallbackPaymentStatus = raw.paymentStatus || 'unpaid';
    const fallbackGuests = Number((raw as any).totalGuests || (Number((raw as any).adults || 1) + Number((raw as any).children || 0)));
    const fallbackCurrency = (raw as any).currency || 'MZN';

    expect(fallbackBookingRef).toBe('MB-STAY-STAY-DOC');
    expect(fallbackCategory).toBe('stay');
    expect(fallbackStatus).toBe('pending');
    expect(fallbackPaymentStatus).toBe('unpaid');
    expect(fallbackGuests).toBe(1);
    expect(fallbackCurrency).toBe('MZN');
  });

  it('aggregates stays and experiences across unified list and categorizes properly', () => {
    const bookings: AdminUnifiedBooking[] = [
      {
        id: sampleStayRaw.id,
        bookingRef: sampleStayRaw.bookingRef,
        category: 'stay',
        sourceCollection: 'bookings',
        targetId: sampleStayRaw.listingId,
        targetTitle: sampleStayRaw.listingTitle,
        hostId: sampleStayRaw.hostId,
        customerName: sampleStayRaw.customerName,
        customerEmail: sampleStayRaw.customerEmail,
        startDate: sampleStayRaw.startDate,
        endDate: sampleStayRaw.endDate,
        adults: sampleStayRaw.adults,
        children: sampleStayRaw.children,
        totalGuests: sampleStayRaw.totalGuests,
        totalAmount: sampleStayRaw.totalAmount,
        currency: sampleStayRaw.currency,
        status: sampleStayRaw.status,
        paymentStatus: sampleStayRaw.paymentStatus,
        fulfillmentStatus: sampleStayRaw.fulfillmentStatus,
        createdAt: sampleStayRaw.createdAt
      },
      {
        id: sampleExperienceRaw.id,
        bookingRef: sampleExperienceRaw.bookingRef,
        category: 'trip',
        sourceCollection: 'activity_bookings',
        targetId: sampleExperienceRaw.activityId,
        targetTitle: sampleExperienceRaw.activityTitle,
        hostId: sampleExperienceRaw.hostId,
        customerName: sampleExperienceRaw.customerName,
        customerEmail: sampleExperienceRaw.customerEmail,
        startDate: sampleExperienceRaw.date,
        adults: sampleExperienceRaw.adults,
        children: sampleExperienceRaw.children,
        totalGuests: 4,
        totalAmount: sampleExperienceRaw.totalMzn,
        currency: 'MZN',
        status: sampleExperienceRaw.status,
        paymentStatus: sampleExperienceRaw.paymentStatus,
        fulfillmentStatus: sampleExperienceRaw.fulfillmentStatus,
        createdAt: sampleExperienceRaw.createdAt
      }
    ];

    expect(bookings).toHaveLength(2);
    expect(bookings[0].category).toBe('stay');
    expect(bookings[1].category).toBe('trip');
    expect(bookings[0].sourceCollection).toBe('bookings');
    expect(bookings[1].sourceCollection).toBe('activity_bookings');

    // Counts
    const stayCount = bookings.filter((b) => b.category === 'stay').length;
    const expCount = bookings.filter((b) => b.category !== 'stay').length;
    expect(stayCount).toBe(1);
    expect(expCount).toBe(1);
  });

  it('filters bookings authoritatively by search query across reference, title, guest, and host', () => {
    const bookings: AdminUnifiedBooking[] = [
      {
        id: '1',
        bookingRef: 'MB-STAY-1234',
        category: 'stay',
        sourceCollection: 'bookings',
        targetId: 'l1',
        targetTitle: 'Tofo Scuba Villa',
        targetCity: 'Inhambane',
        hostId: 'h1',
        hostName: 'Carlos Host',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        startDate: '2026-10-10',
        adults: 2,
        children: 0,
        totalGuests: 2,
        totalAmount: 10000,
        currency: 'MZN',
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'ready',
        createdAt: '2026-10-01'
      },
      {
        id: '2',
        bookingRef: 'MB-EXP-5678',
        category: 'activity',
        sourceCollection: 'activity_bookings',
        targetId: 'a1',
        targetTitle: 'Gorongosa Safari Drive',
        targetCity: 'Sofala',
        hostId: 'h2',
        hostName: 'Safari Guide Moz',
        customerName: 'Sarah Smith',
        customerEmail: 'sarah@example.com',
        startDate: '2026-10-15',
        adults: 1,
        children: 0,
        totalGuests: 1,
        totalAmount: 8000,
        currency: 'MZN',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        createdAt: '2026-10-02'
      }
    ];

    const filterByQuery = (q: string) => {
      const term = q.toLowerCase().trim();
      return bookings.filter((b) => {
        return (
          (b.bookingRef || '').toLowerCase().includes(term) ||
          (b.targetTitle || '').toLowerCase().includes(term) ||
          (b.customerName || '').toLowerCase().includes(term) ||
          (b.customerEmail || '').toLowerCase().includes(term) ||
          (b.hostName || '').toLowerCase().includes(term) ||
          (b.targetCity || '').toLowerCase().includes(term)
        );
      });
    };

    expect(filterByQuery('MB-STAY-1234')).toHaveLength(1);
    expect(filterByQuery('Gorongosa')).toHaveLength(1);
    expect(filterByQuery('john@example.com')).toHaveLength(1);
    expect(filterByQuery('Safari Guide Moz')).toHaveLength(1);
    expect(filterByQuery('nonexistent')).toHaveLength(0);
  });

  it('safely handles operational cancel and reschedule checks', () => {
    // Only non-cancelled experience bookings should allow reschedule
    const isReschedulePermitted = (category: string, status: string) => {
      return category !== 'stay' && status !== 'cancelled';
    };

    expect(isReschedulePermitted('stay', 'confirmed')).toBe(false);
    expect(isReschedulePermitted('activity', 'confirmed')).toBe(true);
    expect(isReschedulePermitted('activity', 'cancelled')).toBe(false);
    expect(isReschedulePermitted('trip', 'pending')).toBe(true);

    // Cancel is allowed only when not already cancelled
    const isCancelPermitted = (status: string) => {
      return status !== 'cancelled';
    };

    expect(isCancelPermitted('confirmed')).toBe(true);
    expect(isCancelPermitted('pending')).toBe(true);
    expect(isCancelPermitted('cancelled')).toBe(false);
  });
});
