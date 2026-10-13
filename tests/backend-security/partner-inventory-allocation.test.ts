import { describe, it, expect } from 'vitest';

export interface MockBooking {
  id: string;
  listingId?: string;
  activityId?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  date?: string; // For activities (YYYY-MM-DD)
  startDate?: string; // For stays
  endDate?: string; // For stays
  totalGuests?: number;
}

export interface MockInventoryItem {
  id: string;
  hostId: string;
  type: 'accommodation' | 'activity' | 'trip';
  totalPhysicalCapacity: number;
  mozbookAllocatedCapacity: number;
  blockedDates: string[];
}

/**
 * Pure evaluation function implementing the exact authoritative logic from
 * src/server/inventoryService.ts: checkAndSetInventoryAllocation (lines 688-814)
 */
export function validateInventoryAllocationUpdate(params: {
  item: MockInventoryItem;
  newTotalCapacity: number;
  newMozbookCapacity: number;
  newBlockedDates: string[];
  operatorUser: { uid: string; email?: string; role?: string };
  upcomingBookings: MockBooking[];
  todayStr: string;
}) {
  const { item, newTotalCapacity, newMozbookCapacity, newBlockedDates, operatorUser, upcomingBookings, todayStr } = params;

  // 1. Authorization check: Host owner or MozBook admin
  const isOwner = item.hostId === operatorUser.uid;
  const isAdmin = operatorUser.role === 'admin' || operatorUser.email === 'admin@mozbook.mz' || operatorUser.email === 'mozbookinfo@gmail.com';

  if (!isOwner && !isAdmin) {
    return {
      allowed: false,
      statusCode: 403,
      error: 'Unauthorized: You can only modify your own property or activity allocation.'
    };
  }

  // 2. Physical boundary checks
  if (newMozbookCapacity > newTotalCapacity) {
    return {
      allowed: false,
      statusCode: 400,
      error: 'MozBook allocated inventory cannot exceed total physical capacity.'
    };
  }

  if (newMozbookCapacity < 1) {
    return {
      allowed: false,
      statusCode: 400,
      error: 'MozBook allocated capacity must be at least 1.'
    };
  }

  // 3. Upcoming booking contention checks
  if (item.type === 'accommodation') {
    const dateOccupancyMap: Record<string, number> = {};

    for (const b of upcomingBookings) {
      if (b.status === 'cancelled') continue;
      if (b.endDate && b.endDate < todayStr) continue;

      const start = new Date(b.startDate!);
      const end = new Date(b.endDate!);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        dateOccupancyMap[dStr] = (dateOccupancyMap[dStr] || 0) + 1;
      }
    }

    for (const [dateStr, bookedUnits] of Object.entries(dateOccupancyMap)) {
      if (bookedUnits > newMozbookCapacity) {
        return {
          allowed: false,
          statusCode: 400,
          error: `Cannot reduce MozBook allocation to ${newMozbookCapacity} unit(s). On ${dateStr}, you already have ${bookedUnits} active/confirmed booking(s). You must honour your represented reservations.`
        };
      }

      if (newBlockedDates.includes(dateStr)) {
        return {
          allowed: false,
          statusCode: 400,
          error: `Cannot block date ${dateStr}. There is already an active reservation (${bookedUnits} unit) booked on this date.`
        };
      }
    }
  } else {
    // Activity / Trip pax checks
    const datePaxMap: Record<string, number> = {};

    for (const b of upcomingBookings) {
      if (b.status === 'cancelled') continue;
      if (b.date && b.date < todayStr) continue;

      const dStr = b.date!;
      const pax = Number(b.totalGuests || 1);
      datePaxMap[dStr] = (datePaxMap[dStr] || 0) + pax;
    }

    for (const [dateStr, totalPax] of Object.entries(datePaxMap)) {
      if (totalPax > newMozbookCapacity) {
        return {
          allowed: false,
          statusCode: 400,
          error: `Cannot reduce MozBook capacity to ${newMozbookCapacity} pax. On ${dateStr}, you already have ${totalPax} traveler(s) confirmed/reserved. You must honour your represented capacity.`
        };
      }

      if (newBlockedDates.includes(dateStr)) {
        return {
          allowed: false,
          statusCode: 400,
          error: `Cannot block date ${dateStr}. There are already ${totalPax} active traveler reservation(s) on this date.`
        };
      }
    }
  }

  return {
    allowed: true,
    statusCode: 200,
    updatedMozbookCapacity: newMozbookCapacity,
    updatedBlockedDates: newBlockedDates
  };
}

describe('Partner Inventory Allocation Guard (Prompt 28C & 29)', () => {
  const hostUser = { uid: 'host_tofo_dive', email: 'dive@tofo.mz' };
  const otherUser = { uid: 'host_malongane', email: 'other@malongane.mz' };
  const adminUser = { uid: 'admin_1', email: 'admin@mozbook.mz', role: 'admin' };

  describe('Authorization Checks', () => {
    const item: MockInventoryItem = {
      id: 'act_snorkel_1',
      hostId: 'host_tofo_dive',
      type: 'activity',
      totalPhysicalCapacity: 12,
      mozbookAllocatedCapacity: 8,
      blockedDates: []
    };

    it('rejects allocation updates by unauthorized other hosts with 403 Forbidden', () => {
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 6,
        newBlockedDates: [],
        operatorUser: otherUser,
        upcomingBookings: [],
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('Unauthorized');
    });

    it('allows allocation updates by the verified host owner', () => {
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 6,
        newBlockedDates: [],
        operatorUser: hostUser,
        upcomingBookings: [],
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('allows allocation updates by a MozBook platform admin', () => {
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 6,
        newBlockedDates: [],
        operatorUser: adminUser,
        upcomingBookings: [],
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Physical Capacity Constraints', () => {
    const item: MockInventoryItem = {
      id: 'stay_villa_1',
      hostId: 'host_tofo_dive',
      type: 'accommodation',
      totalPhysicalCapacity: 4,
      mozbookAllocatedCapacity: 4,
      blockedDates: []
    };

    it('rejects allocated capacity higher than total physical capacity (e.g. 5 > 4)', () => {
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 4,
        newMozbookCapacity: 5,
        newBlockedDates: [],
        operatorUser: hostUser,
        upcomingBookings: [],
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('cannot exceed total physical capacity');
    });

    it('rejects allocated capacity less than 1', () => {
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 4,
        newMozbookCapacity: 0,
        newBlockedDates: [],
        operatorUser: hostUser,
        upcomingBookings: [],
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('must be at least 1');
    });
  });

  describe('Committed Reservation Protection', () => {
    it('prevents reducing activity allocation below confirmed upcoming reservations', () => {
      const item: MockInventoryItem = {
        id: 'act_dolphins_1',
        hostId: 'host_tofo_dive',
        type: 'activity',
        totalPhysicalCapacity: 12,
        mozbookAllocatedCapacity: 10,
        blockedDates: []
      };

      // Existing bookings: 6 pax on 2026-10-20
      const upcomingBookings: MockBooking[] = [
        { id: 'b_1', activityId: 'act_dolphins_1', date: '2026-10-20', totalGuests: 4, status: 'confirmed' },
        { id: 'b_2', activityId: 'act_dolphins_1', date: '2026-10-20', totalGuests: 2, status: 'confirmed' }
      ];

      // Host attempts to reduce capacity to 5 pax (when 6 are booked)
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 5,
        newBlockedDates: [],
        operatorUser: hostUser,
        upcomingBookings,
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('already have 6 traveler(s) confirmed/reserved');
    });

    it('prevents blocking a date that has an active booking', () => {
      const item: MockInventoryItem = {
        id: 'act_dolphins_1',
        hostId: 'host_tofo_dive',
        type: 'activity',
        totalPhysicalCapacity: 12,
        mozbookAllocatedCapacity: 10,
        blockedDates: []
      };

      const upcomingBookings: MockBooking[] = [
        { id: 'b_1', activityId: 'act_dolphins_1', date: '2026-10-25', totalGuests: 2, status: 'confirmed' }
      ];

      // Host attempts to block 2026-10-25
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 8,
        newBlockedDates: ['2026-10-25'],
        operatorUser: hostUser,
        upcomingBookings,
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Cannot block date 2026-10-25');
    });

    it('allows blocking a date that has zero active bookings', () => {
      const item: MockInventoryItem = {
        id: 'act_dolphins_1',
        hostId: 'host_tofo_dive',
        type: 'activity',
        totalPhysicalCapacity: 12,
        mozbookAllocatedCapacity: 10,
        blockedDates: []
      };

      const upcomingBookings: MockBooking[] = [
        { id: 'b_1', activityId: 'act_dolphins_1', date: '2026-10-20', totalGuests: 2, status: 'confirmed' }
      ];

      // Host blocks 2026-10-28 (empty date)
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 12,
        newMozbookCapacity: 8,
        newBlockedDates: ['2026-10-28'],
        operatorUser: hostUser,
        upcomingBookings,
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.updatedBlockedDates).toContain('2026-10-28');
    });

    it('ignores cancelled bookings when checking occupancy thresholds', () => {
      const item: MockInventoryItem = {
        id: 'stay_villa_1',
        hostId: 'host_tofo_dive',
        type: 'accommodation',
        totalPhysicalCapacity: 2,
        mozbookAllocatedCapacity: 2,
        blockedDates: []
      };

      // 1 cancelled booking on 2026-10-22
      const upcomingBookings: MockBooking[] = [
        { id: 'b_cancelled', listingId: 'stay_villa_1', startDate: '2026-10-22', endDate: '2026-10-24', status: 'cancelled' }
      ];

      // Can reduce capacity to 1 or block dates because booking is cancelled
      const result = validateInventoryAllocationUpdate({
        item,
        newTotalCapacity: 2,
        newMozbookCapacity: 1,
        newBlockedDates: ['2026-10-22'],
        operatorUser: hostUser,
        upcomingBookings,
        todayStr: '2026-10-15'
      });

      expect(result.allowed).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });
});
