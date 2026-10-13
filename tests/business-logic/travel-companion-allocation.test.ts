import { describe, it, expect } from 'vitest';
import { travelGroupService } from '../../src/services/travelGroupService';
import { GroupBookingParticipant } from '../../src/types/travelGroup';

describe('Travel Companion Cost Allocation & Participant Inclusion Engine', () => {
  it('divides total cost equally among all included participants', () => {
    const participants: GroupBookingParticipant[] = [
      { userId: 'user_1', displayName: 'Alice (Payer)', email: 'alice@example.com', status: 'included' },
      { userId: 'user_2', displayName: 'Bob', email: 'bob@example.com', status: 'included' },
      { userId: 'user_3', displayName: 'Charlie', email: 'charlie@example.com', status: 'included' },
      { userId: 'user_4', displayName: 'Diana', email: 'diana@example.com', status: 'included' },
    ];

    const allocation = travelGroupService.computeCostAllocation(
      12000,
      'user_1',
      'Alice (Payer)',
      participants
    );

    expect(allocation.totalAmount).toBe(12000);
    expect(allocation.includedCount).toBe(4);
    expect(allocation.fairSharePerPersonMzn).toBe(3000);

    // Each participant gets 3000 MZN allocated share
    expect(participants[0].allocatedShareMzn).toBe(3000);
    expect(participants[1].allocatedShareMzn).toBe(3000);
    expect(participants[2].allocatedShareMzn).toBe(3000);
    expect(participants[3].allocatedShareMzn).toBe(3000);

    // Payer is settled, others are pending
    expect(participants[0].shareSettlementStatus).toBe('settled');
    expect(participants[1].shareSettlementStatus).toBe('pending');
    expect(participants[2].shareSettlementStatus).toBe('pending');
    expect(participants[3].shareSettlementStatus).toBe('pending');

    expect(allocation.settledSharesCount).toBe(1);
    expect(allocation.pendingSharesCount).toBe(3);
  });

  it('excludes opted-out participants from division and assigns them 0 MZN share', () => {
    const participants: GroupBookingParticipant[] = [
      { userId: 'user_1', displayName: 'Alice (Payer)', email: 'alice@example.com', status: 'included' },
      { userId: 'user_2', displayName: 'Bob', email: 'bob@example.com', status: 'included' },
      { userId: 'user_3', displayName: 'Charlie (Opted Out)', email: 'charlie@example.com', status: 'opted_out' },
      { userId: 'user_4', displayName: 'Diana (Opted Out)', email: 'diana@example.com', status: 'opted_out' },
    ];

    const allocation = travelGroupService.computeCostAllocation(
      10000,
      'user_1',
      'Alice (Payer)',
      participants
    );

    // Only Alice and Bob are included
    expect(allocation.includedCount).toBe(2);
    expect(allocation.fairSharePerPersonMzn).toBe(5000);

    expect(participants[0].allocatedShareMzn).toBe(5000);
    expect(participants[1].allocatedShareMzn).toBe(5000);
    expect(participants[2].allocatedShareMzn).toBe(0);
    expect(participants[3].allocatedShareMzn).toBe(0);

    expect(allocation.settledSharesCount).toBe(1);
    expect(allocation.pendingSharesCount).toBe(1);
  });

  it('correctly rounds odd divisions without fractional cent artifacts', () => {
    const participants: GroupBookingParticipant[] = [
      { userId: 'user_1', displayName: 'Payer', email: 'payer@example.com', status: 'included' },
      { userId: 'user_2', displayName: 'Member 2', email: 'm2@example.com', status: 'included' },
      { userId: 'user_3', displayName: 'Member 3', email: 'm3@example.com', status: 'included' },
    ];

    // 10,000 / 3 = 3333.33 -> rounded to 3,333 MZN integer
    const allocation = travelGroupService.computeCostAllocation(
      10000,
      'user_1',
      'Payer',
      participants
    );

    expect(allocation.fairSharePerPersonMzn).toBe(3333);
    participants.forEach(p => {
      expect(p.allocatedShareMzn).toBe(3333);
    });
  });

  it('safely handles edge case where all participants opt out (falls back to minimum 1)', () => {
    const participants: GroupBookingParticipant[] = [
      { userId: 'user_1', displayName: 'Payer', email: 'payer@example.com', status: 'opted_out' },
      { userId: 'user_2', displayName: 'Member 2', email: 'm2@example.com', status: 'opted_out' },
    ];

    const allocation = travelGroupService.computeCostAllocation(
      5000,
      'user_1',
      'Payer',
      participants
    );

    // Math.max(1, includedList.length) protects against division by zero
    expect(allocation.includedCount).toBe(1);
    expect(allocation.fairSharePerPersonMzn).toBe(5000);
    // Since both opted out, individual shares remain 0
    expect(participants[0].allocatedShareMzn).toBe(0);
    expect(participants[1].allocatedShareMzn).toBe(0);
  });

  it('preserves previously settled status for non-payer participants', () => {
    const participants: GroupBookingParticipant[] = [
      { userId: 'user_1', displayName: 'Payer', email: 'payer@example.com', status: 'included' },
      { userId: 'user_2', displayName: 'Bob', email: 'bob@example.com', status: 'included', shareSettlementStatus: 'settled' },
      { userId: 'user_3', displayName: 'Charlie', email: 'charlie@example.com', status: 'included' },
    ];

    const allocation = travelGroupService.computeCostAllocation(
      9000,
      'user_1',
      'Payer',
      participants
    );

    expect(allocation.fairSharePerPersonMzn).toBe(3000);
    expect(participants[1].shareSettlementStatus).toBe('settled'); // Preserved settled
    expect(participants[2].shareSettlementStatus).toBe('pending');
    expect(allocation.settledSharesCount).toBe(2);
    expect(allocation.pendingSharesCount).toBe(1);
  });
});
