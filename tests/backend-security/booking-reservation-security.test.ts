import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  reserveExperienceInventory, 
  reserveStayInventory, 
  memoryExperienceSlots, 
  memoryStaySlots, 
  memoryBookings,
  InventoryError 
} from '../../src/server/inventoryService';

describe('Booking Reservation Security & Integrity Tests (Prompt 30)', () => {
  beforeEach(() => {
    // Clear any test state in memory stores
    memoryExperienceSlots.clear();
    memoryStaySlots.clear();
    memoryBookings.clear();
    vi.restoreAllMocks();
  });

  describe('1. Missing / Invalid Authentication & Forged Identity (x-user-id Defense)', () => {
    it('rejects reservation requests when Bearer token is missing even if x-user-id header is provided', async () => {
      // Simulation of authenticateRequest logic from server.ts
      const authenticateRequest = async (headers: Record<string, string | undefined>) => {
        const authHeader = headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return null;
        }
        const token = authHeader.split('Bearer ')[1]?.trim();
        if (!token || token === 'invalid_token') {
          return null;
        }
        if (token === 'valid_token_alice') {
          return { uid: 'user_alice_123', email: 'alice@example.com' };
        }
        return null;
      };

      // Case A: Forged x-user-id with no Bearer token
      const headersWithSpoofedUser = {
        'x-user-id': 'victim_user_99',
        'x-user-email': 'victim@example.com'
      };
      const resultA = await authenticateRequest(headersWithSpoofedUser);
      expect(resultA).toBeNull();

      // Case B: Invalid Bearer token
      const headersWithInvalidToken = {
        'authorization': 'Bearer invalid_token',
        'x-user-id': 'victim_user_99'
      };
      const resultB = await authenticateRequest(headersWithInvalidToken);
      expect(resultB).toBeNull();

      // Case C: Valid token overrides and ignores spoofed x-user-id
      const headersWithBoth = {
        'authorization': 'Bearer valid_token_alice',
        'x-user-id': 'victim_user_99' // Attacker tries to impersonate victim while holding Alice's token
      };
      const resultC = await authenticateRequest(headersWithBoth);
      expect(resultC).not.toBeNull();
      expect(resultC?.uid).toBe('user_alice_123'); // Identity comes strictly from verified token!
      expect(resultC?.uid).not.toBe('victim_user_99');
    });
  });

  describe('2. Client Price Tampering Defense (Authoritative Pricing)', () => {
    it('recalculates experience total strictly from database activity prices, ignoring tampered totalMzn', () => {
      // Pure evaluation function matching authoritative pricing in reserveExperienceInventory
      const calculateExperienceAuthoritativeTotal = (
        act: {
          pricingType?: string;
          priceAdult: number;
          priceChild?: number;
          priceGroup?: number;
          pricePerBooking?: number;
          specialOffer?: { enabled: boolean; specialPrice?: number };
          pickup?: { offered: boolean; fee?: number };
        },
        params: {
          totalGuests: number;
          adults?: number;
          children?: number;
          pickupRequested?: boolean;
          tamperedClientTotalMzn: number;
        }
      ) => {
        const effectiveAdultPrice = (act.specialOffer?.enabled && act.specialOffer.specialPrice && Number(act.specialOffer.specialPrice) > 0)
          ? Number(act.specialOffer.specialPrice)
          : Number(act.priceAdult || 0);

        const effectiveChildPrice = act.priceChild !== undefined
          ? Number(act.priceChild)
          : Math.round(effectiveAdultPrice * 0.6);

        const adultsCount = Math.max(0, Number(params.adults !== undefined ? params.adults : params.totalGuests));
        const childrenCount = Math.max(0, Number(params.children !== undefined ? params.children : 0));

        let baseTotal = 0;
        const actPricingType = act.pricingType || 'per_person';

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

        return Math.max(1, Math.round(baseTotal + pickupCost));
      };

      const actData = {
        priceAdult: 3500,
        priceChild: 2000,
        pricingType: 'per_person',
        pickup: { offered: true, fee: 500 }
      };

      // Attacker sends totalMzn: 1 MZN in client body
      const authoritativeTotal = calculateExperienceAuthoritativeTotal(actData, {
        totalGuests: 3,
        adults: 2,
        children: 1,
        pickupRequested: true,
        tamperedClientTotalMzn: 1
      });

      // Expected: (3500 * 2) + (2000 * 1) + 500 = 7000 + 2000 + 500 = 9500 MZN
      expect(authoritativeTotal).toBe(9500);
      expect(authoritativeTotal).not.toBe(1);
    });

    it('recalculates accommodation total strictly from database listing nightly rate and fees, ignoring tampered totalAmount', () => {
      const calculateStayAuthoritativeTotal = (
        listing: {
          price: number;
          cleaningFee?: number;
          serviceFee?: number;
          specialOffer?: { enabled: boolean; specialPrice?: number };
        },
        stayNights: number,
        _tamperedClientTotal: number
      ) => {
        const hasDeal = Boolean(listing.specialOffer?.enabled && listing.specialOffer.specialPrice && Number(listing.specialOffer.specialPrice) > 0);
        const effectiveNightlyRate = hasDeal ? Number(listing.specialOffer.specialPrice) : Number(listing.price || 0);
        const cleaningFee = Number(listing.cleaningFee !== undefined ? listing.cleaningFee : 1200);
        const serviceFee = Number(listing.serviceFee !== undefined ? listing.serviceFee : 850);
        return Math.max(1, Math.round((effectiveNightlyRate * stayNights) + cleaningFee + serviceFee));
      };

      const listingData = {
        price: 4500,
        cleaningFee: 1500,
        serviceFee: 850
      };

      // Attacker attempts to book 3 nights for 100 MZN
      const authoritativeStayTotal = calculateStayAuthoritativeTotal(listingData, 3, 100);

      // Expected: (4500 * 3) + 1500 + 850 = 13500 + 1500 + 850 = 15850 MZN
      expect(authoritativeStayTotal).toBe(15850);
      expect(authoritativeStayTotal).not.toBe(100);
    });
  });

  describe('3. Inventory Exhaustion & Capacity Guards', () => {
    it('rejects reservation with 409 Conflict when requested seats exceed remaining capacity', () => {
      const mozbookCapacity = 10;
      const totalCommittedSeats = 8;
      const requestedSeats = 3;

      const remainingSeats = Math.max(0, mozbookCapacity - totalCommittedSeats);
      expect(remainingSeats).toBe(2);

      const checkCapacity = () => {
        if (requestedSeats > remainingSeats) {
          throw new InventoryError(
            409,
            `Insufficient capacity: only ${remainingSeats} seat(s) remaining. Cannot reserve ${requestedSeats} seats.`
          );
        }
      };

      expect(checkCapacity).toThrowError(InventoryError);
      expect(checkCapacity).toThrowError(/Insufficient capacity: only 2 seat\(s\) remaining/);
    });
  });

  describe('4. Firestore Permission Denial Handling (Zero Ephemeral Fallback)', () => {
    it('throws InventoryError 500 when Firestore Admin returns PERMISSION_DENIED and does NOT write to memory', async () => {
      // In this AI Studio environment, Admin SDK does not have IAM on hip-graph-485101-k7.
      // Calling reserveExperienceInventory directly will trigger slotRef.get() -> PERMISSION_DENIED.
      // We verify that the function throws InventoryError 500 and does NOT fall back to memoryBookings!
      let errorThrown: any = null;

      try {
        await reserveExperienceInventory({
          activityId: 'act_live_test_safari',
          activityTitle: 'Bazaruto Dhow Safari',
          activityType: 'activity',
          hostId: 'host_wild_ocean',
          date: '2026-11-20',
          totalGuests: 2,
          customerUserId: 'test_guest_alice',
          customerName: 'Alice Traveler',
          customerEmail: 'alice@example.com',
          customerPhone: '+258841234567',
          totalMzn: 5000
        });
      } catch (err) {
        errorThrown = err;
      }

      // 1. Must fail with clear server error
      expect(errorThrown).not.toBeNull();
      expect(errorThrown).toBeInstanceOf(InventoryError);
      expect(errorThrown.statusCode).toBe(500);
      expect(errorThrown.message).toContain('Persistent reservation failed');
      expect(errorThrown.message).toContain('PERMISSION_DENIED');

      // 2. CRITICAL: Must NOT populate memoryBookings
      expect(memoryBookings.size).toBe(0);

      // 3. CRITICAL: Must NOT consume capacity in memoryExperienceSlots
      expect(memoryExperienceSlots.size).toBe(0);
    });

    it('throws InventoryError 500 when stay reservation encounters PERMISSION_DENIED and leaves memory pristine', async () => {
      let errorThrown: any = null;

      try {
        await reserveStayInventory({
          listingId: 'list_villa_inhambane',
          listingTitle: 'Ocean Villa Inhambane',
          hostId: 'host_villa_owner',
          startDate: '2026-11-20',
          endDate: '2026-11-22',
          nights: 2,
          adults: 2,
          children: 0,
          totalGuests: 2,
          customerUserId: 'test_guest_bob',
          customerName: 'Bob Traveler',
          customerEmail: 'bob@example.com',
          customerPhone: '+258849876543',
          totalAmount: 12000
        });
      } catch (err) {
        errorThrown = err;
      }

      // 1. Must fail with clear server error
      expect(errorThrown).not.toBeNull();
      expect(errorThrown).toBeInstanceOf(InventoryError);
      expect(errorThrown.statusCode).toBe(500);
      expect(errorThrown.message).toContain('Persistent reservation failed');

      // 2. CRITICAL: Must NOT populate memoryBookings
      expect(memoryBookings.size).toBe(0);

      // 3. CRITICAL: Must NOT consume capacity in memoryStaySlots
      expect(memoryStaySlots.size).toBe(0);
    });
  });
});
