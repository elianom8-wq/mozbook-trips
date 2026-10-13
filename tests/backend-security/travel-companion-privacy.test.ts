import { describe, it, expect } from 'vitest';
import { GroupMember, TravelGroup } from '../../src/types/travelGroup';

/**
 * Access control validator reflecting the exact authorization rules in:
 * - src/pages/GroupDetails.tsx (lines 125-137)
 * - src/services/travelGroupService.ts (lines 218-223, lines 777-782, lines 1157-1160)
 */
export function checkTravelGroupAccess(params: {
  group: TravelGroup | null;
  members: GroupMember[];
  requesterUserId: string;
  requesterEmail?: string;
}) {
  const { group, members, requesterUserId, requesterEmail } = params;

  if (!group) {
    return { hasAccess: false, statusCode: 404, error: 'Travel group not found' };
  }

  const isOwner = group.ownerId === requesterUserId;
  const isMember = members.some(
    m => (m.userId === requesterUserId || (requesterEmail && m.email?.toLowerCase() === requesterEmail.toLowerCase())) && 
         m.status === 'active'
  );

  if (!isOwner && !isMember) {
    return {
      hasAccess: false,
      statusCode: 403,
      error: 'This is a private Travel Companion group. Only invited and accepted group members can view this workspace.'
    };
  }

  const userRole = isOwner ? 'owner' : 'member';

  return {
    hasAccess: true,
    statusCode: 200,
    role: userRole
  };
}

describe('Private Travel Companion Privacy & Access Control (Prompt 26B & 29)', () => {
  const sampleGroup: TravelGroup = {
    id: 'grp_tofo_retreat',
    ownerId: 'usr_alice',
    ownerName: 'Alice',
    ownerEmail: 'alice@mozbook.mz',
    name: 'Tofo Marine Conservation Retreat',
    destination: 'Tofo, Inhambane',
    startDate: '2026-11-10',
    endDate: '2026-11-15',
    status: 'upcoming',
    membersCount: 2,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z'
  };

  const sampleMembers: GroupMember[] = [
    {
      id: 'grp_tofo_retreat_usr_alice',
      groupId: 'grp_tofo_retreat',
      userId: 'usr_alice',
      displayName: 'Alice',
      email: 'alice@mozbook.mz',
      role: 'owner',
      status: 'active',
      joinedAt: '2026-10-01T10:00:00Z'
    },
    {
      id: 'grp_tofo_retreat_usr_bob',
      groupId: 'grp_tofo_retreat',
      userId: 'usr_bob',
      displayName: 'Bob',
      email: 'bob@gmail.com',
      role: 'member',
      status: 'active',
      joinedAt: '2026-10-02T12:00:00Z'
    },
    {
      id: 'grp_tofo_retreat_usr_charlie',
      groupId: 'grp_tofo_retreat',
      userId: 'usr_charlie',
      displayName: 'Charlie',
      email: 'charlie@gmail.com',
      role: 'member',
      status: 'invited', // Not yet accepted!
      joinedAt: '2026-10-03T15:00:00Z'
    },
    {
      id: 'grp_tofo_retreat_usr_dave',
      groupId: 'grp_tofo_retreat',
      userId: 'usr_dave',
      displayName: 'Dave',
      email: 'dave@gmail.com',
      role: 'member',
      status: 'left', // Left the group
      joinedAt: '2026-10-01T11:00:00Z'
    }
  ];

  it('grants owner access with owner role', () => {
    const access = checkTravelGroupAccess({
      group: sampleGroup,
      members: sampleMembers,
      requesterUserId: 'usr_alice',
      requesterEmail: 'alice@mozbook.mz'
    });

    expect(access.hasAccess).toBe(true);
    expect(access.statusCode).toBe(200);
    expect(access.role).toBe('owner');
  });

  it('grants active accepted member access with member role', () => {
    const access = checkTravelGroupAccess({
      group: sampleGroup,
      members: sampleMembers,
      requesterUserId: 'usr_bob',
      requesterEmail: 'bob@gmail.com'
    });

    expect(access.hasAccess).toBe(true);
    expect(access.statusCode).toBe(200);
    expect(access.role).toBe('member');
  });

  it('denies invited-but-not-accepted user from viewing the private group workspace', () => {
    const access = checkTravelGroupAccess({
      group: sampleGroup,
      members: sampleMembers,
      requesterUserId: 'usr_charlie',
      requesterEmail: 'charlie@gmail.com'
    });

    expect(access.hasAccess).toBe(false);
    expect(access.statusCode).toBe(403);
    expect(access.error).toContain('This is a private Travel Companion group');
  });

  it('denies former member who left the group', () => {
    const access = checkTravelGroupAccess({
      group: sampleGroup,
      members: sampleMembers,
      requesterUserId: 'usr_dave',
      requesterEmail: 'dave@gmail.com'
    });

    expect(access.hasAccess).toBe(false);
    expect(access.statusCode).toBe(403);
  });

  it('strictly denies completely unrelated third-party users with 403 Forbidden', () => {
    const access = checkTravelGroupAccess({
      group: sampleGroup,
      members: sampleMembers,
      requesterUserId: 'usr_stranger',
      requesterEmail: 'stranger@example.com'
    });

    expect(access.hasAccess).toBe(false);
    expect(access.statusCode).toBe(403);
    expect(access.error).toContain('Only invited and accepted group members can view this workspace');
  });
});
