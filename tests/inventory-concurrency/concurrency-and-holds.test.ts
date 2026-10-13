import { describe, it, expect } from 'vitest';

export interface InventorySlotState {
  confirmedSeats: number;
  holds: Array<{
    bookingId: string;
    customerUserId: string;
    seats: number;
    status: 'hold' | 'confirmed';
    holdExpiresAt: string;
    paymentInFlight?: boolean;
    inFlightUntil?: string;
  }>;
  version: number; // OCC version for concurrency collision detection
}

export class MockAtomicInventoryEngine {
  private slot: InventorySlotState;
  private maxCapacity: number;

  constructor(maxCapacity: number, initialConfirmed = 0) {
    this.maxCapacity = maxCapacity;
    this.slot = {
      confirmedSeats: initialConfirmed,
      holds: [],
      version: 1
    };
  }

  getSlotState() {
    return JSON.parse(JSON.stringify(this.slot));
  }

  /**
   * Simulates Firestore runTransaction with Optimistic Concurrency Control (OCC)
   * If the slot's version was changed concurrently between read and write,
   * OCC re-executes the transaction with latest state.
   */
  async reserveAtomic(params: {
    customerUserId: string;
    requestedSeats: number;
    nowMs: number;
  }): Promise<{ success: boolean; bookingId?: string; error?: string; retries: number }> {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      // 1. Transaction Read Phase
      const readVersion = this.slot.version;
      const holds = [...this.slot.holds];
      const validHolds: typeof holds = [];
      let totalCommitted = this.slot.confirmedSeats;

      for (const h of holds) {
        if (h.status === 'confirmed') {
          validHolds.push(h);
          totalCommitted += h.seats;
        } else if (h.status === 'hold') {
          const expTime = new Date(h.holdExpiresAt).getTime();
          const inFlightExp = h.paymentInFlight && h.inFlightUntil ? new Date(h.inFlightUntil).getTime() : 0;
          const isStillValid = expTime > params.nowMs || inFlightExp > params.nowMs;
          if (isStillValid) {
            validHolds.push(h);
            totalCommitted += h.seats;
          }
        }
      }

      const remainingSeats = Math.max(0, this.maxCapacity - totalCommitted);

      if (params.requestedSeats > remainingSeats) {
        return {
          success: false,
          error: `Insufficient capacity: only ${remainingSeats} seat(s) remaining. Cannot reserve ${params.requestedSeats} seats.`,
          retries: attempt - 1
        };
      }

      // 2. Yield briefly to allow concurrent tasks to execute and simulate real network interleaving
      await new Promise(r => setTimeout(r, 5 + Math.random() * 10));

      // 3. Atomic Write Phase with OCC validation
      if (this.slot.version !== readVersion) {
        // Concurrency conflict detected! In Firestore, the transaction retries automatically
        continue;
      }

      // Commit write
      const newBookingId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newHold = {
        bookingId: newBookingId,
        customerUserId: params.customerUserId,
        seats: params.requestedSeats,
        status: 'hold' as const,
        holdExpiresAt: new Date(params.nowMs + 15 * 60 * 1000).toISOString()
      };

      validHolds.push(newHold);
      this.slot.holds = validHolds;
      this.slot.version++; // Bump OCC version

      return {
        success: true,
        bookingId: newBookingId,
        retries: attempt - 1
      };
    }

    return {
      success: false,
      error: 'Transaction aborted after max concurrency retries',
      retries: maxRetries
    };
  }

  confirmHold(bookingId: string) {
    this.slot.holds = this.slot.holds.map(h => {
      if (h.bookingId === bookingId) {
        return { ...h, status: 'confirmed', paymentInFlight: false };
      }
      return h;
    });
    this.slot.version++;
  }

  releaseHold(bookingId: string) {
    this.slot.holds = this.slot.holds.filter(h => h.bookingId !== bookingId);
    this.slot.version++;
  }

  markInFlight(bookingId: string, inFlightUntilIso: string) {
    this.slot.holds = this.slot.holds.map(h => {
      if (h.bookingId === bookingId) {
        return {
          ...h,
          paymentInFlight: true,
          inFlightUntil: inFlightUntilIso,
          holdExpiresAt: inFlightUntilIso
        };
      }
      return h;
    });
    this.slot.version++;
  }
}

describe('Concurrent Inventory Reservations & Hold Lifecycle (Prompt 28C & 29)', () => {
  describe('Race Condition for Final Seat (Single Remaining Seat)', () => {
    it('guarantees only 1 customer can reserve the final available seat when two compete simultaneously', async () => {
      // Experience with max capacity 10, already 9 seats committed
      const engine = new MockAtomicInventoryEngine(10, 9);
      const now = Date.now();

      // Two customers simultaneously attempt to book the 10th seat
      const [res1, res2] = await Promise.all([
        engine.reserveAtomic({ customerUserId: 'traveler_A', requestedSeats: 1, nowMs: now }),
        engine.reserveAtomic({ customerUserId: 'traveler_B', requestedSeats: 1, nowMs: now })
      ]);

      const successCount = [res1, res2].filter(r => r.success).length;
      const failureCount = [res1, res2].filter(r => !r.success).length;

      // Exactly 1 must succeed and 1 must fail with 409 Insufficient Capacity
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      const failedResult = res1.success ? res2 : res1;
      expect(failedResult.error).toContain('Insufficient capacity: only 0 seat(s) remaining');

      // The slot holds must contain exactly 1 new hold
      const slot = engine.getSlotState();
      expect(slot.holds.length).toBe(1);
    });

    it('guarantees zero oversell when 10 concurrent requests compete for 2 available seats', async () => {
      const engine = new MockAtomicInventoryEngine(10, 8); // 2 seats remaining
      const now = Date.now();

      const requests = Array.from({ length: 10 }).map((_, i) => 
        engine.reserveAtomic({ customerUserId: `traveler_${i}`, requestedSeats: 1, nowMs: now })
      );

      const results = await Promise.all(requests);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Exactly 2 succeeded and 8 were rejected
      expect(successful.length).toBe(2);
      expect(failed.length).toBe(8);

      const slot = engine.getSlotState();
      expect(slot.holds.length).toBe(2);
    });
  });

  describe('Hold Expiration & In-Flight Payment Protection', () => {
    it('purges regular expired hold after 15 minutes when no payment is in flight', async () => {
      const engine = new MockAtomicInventoryEngine(5);
      const t0 = 1000000;

      // Traveler A books 5 seats (fills capacity)
      const resA = await engine.reserveAtomic({ customerUserId: 'traveler_A', requestedSeats: 5, nowMs: t0 });
      expect(resA.success).toBe(true);

      // At t = 10 minutes: capacity still full for Traveler B
      const t10Min = t0 + 10 * 60 * 1000;
      const resB_early = await engine.reserveAtomic({ customerUserId: 'traveler_B', requestedSeats: 2, nowMs: t10Min });
      expect(resB_early.success).toBe(false);

      // At t = 16 minutes (hold expired): Traveler A's hold is automatically purged and Traveler B succeeds!
      const t16Min = t0 + 16 * 60 * 1000;
      const resB_late = await engine.reserveAtomic({ customerUserId: 'traveler_B', requestedSeats: 2, nowMs: t16Min });
      expect(resB_late.success).toBe(true);
    });

    it('prevents releasing inventory hold while payment remains in flight, even after 15 minutes', async () => {
      const engine = new MockAtomicInventoryEngine(5);
      const t0 = 1000000;

      // Traveler A reserves all 5 seats
      const resA = await engine.reserveAtomic({ customerUserId: 'traveler_A', requestedSeats: 5, nowMs: t0 });
      expect(resA.success).toBe(true);

      // Traveler A proceeds to PaySuite checkout at minute 14, marking payment in-flight with 20m grace window
      const inFlightUntilIso = new Date(t0 + 34 * 60 * 1000).toISOString();
      engine.markInFlight(resA.bookingId!, inFlightUntilIso);

      // At minute 16 (normal hold expired, but payment in-flight):
      // Another customer attempts to book the seats:
      const t16Min = t0 + 16 * 60 * 1000;
      const resB = await engine.reserveAtomic({ customerUserId: 'traveler_B', requestedSeats: 2, nowMs: t16Min });

      // Must be safely rejected to prevent race condition while payment completes!
      expect(resB.success).toBe(false);
      expect(resB.error).toContain('Insufficient capacity');

      // When PaySuite payment succeeds, hold is confirmed
      engine.confirmHold(resA.bookingId!);
      const slot = engine.getSlotState();
      expect(slot.holds[0].status).toBe('confirmed');
    });

    it('releases hold immediately when payment fails', async () => {
      const engine = new MockAtomicInventoryEngine(4);
      const now = Date.now();

      const res = await engine.reserveAtomic({ customerUserId: 'traveler_fail', requestedSeats: 4, nowMs: now });
      expect(res.success).toBe(true);

      // Webhook arrives with payment.failed -> release hold
      engine.releaseHold(res.bookingId!);

      // Now all 4 seats are available again
      const newAttempt = await engine.reserveAtomic({ customerUserId: 'new_traveler', requestedSeats: 4, nowMs: now });
      expect(newAttempt.success).toBe(true);
    });
  });
});
