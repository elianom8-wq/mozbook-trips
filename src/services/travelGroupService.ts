import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  TravelGroup, 
  GroupMember, 
  GroupInvitation, 
  CreateGroupDTO,
  TravelGroupStatus,
  EnrichedInvitation,
  GroupBookingLink,
  GroupItineraryItem,
  GroupBookingParticipant,
  GroupCostAllocation,
  GroupParticipantType,
  ShareSettlementStatus
} from '../types/travelGroup';

// Local storage fallback keys for offline persistence and resilient state
const STORAGE_GROUPS_KEY = 'mozbook_travel_groups_cache';
const STORAGE_MEMBERS_KEY = 'mozbook_group_members_cache';
const STORAGE_INVITATIONS_KEY = 'mozbook_group_invitations_cache';
const STORAGE_GROUP_BOOKINGS_KEY = 'mozbook_group_bookings_cache';

// Seed demo group so new visitors immediately understand the feature
const INITIAL_DEMO_GROUPS: TravelGroup[] = [
  {
    id: 'group_tofo_weekend_demo',
    ownerId: 'demo_host_edson',
    ownerName: 'Edson Machel',
    ownerEmail: 'edson@mozbook.mz',
    name: 'Tofo Weekend Explorers',
    destination: 'Tofo, Inhambane',
    startDate: '2026-12-12',
    endDate: '2026-12-15',
    description: 'Annual dive and coastal getaway with friends! Ocean safari, fresh seafood in Barra, and relaxing at the beach lodge.',
    status: 'upcoming',
    membersCount: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const INITIAL_DEMO_MEMBERS: GroupMember[] = [
  {
    id: 'group_tofo_weekend_demo_demo_host_edson',
    groupId: 'group_tofo_weekend_demo',
    userId: 'demo_host_edson',
    displayName: 'Edson Machel',
    email: 'edson@mozbook.mz',
    role: 'owner',
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'group_tofo_weekend_demo_sarah',
    groupId: 'group_tofo_weekend_demo',
    userId: 'sarah_user_id',
    displayName: 'Sarah Jenkins',
    email: 'sarah@example.com',
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'group_tofo_weekend_demo_john',
    groupId: 'group_tofo_weekend_demo',
    userId: 'john_user_id',
    displayName: 'John Doe',
    email: 'john@example.com',
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'group_tofo_weekend_demo_maria',
    groupId: 'group_tofo_weekend_demo',
    userId: 'maria_user_id',
    displayName: 'Maria Santos',
    email: 'maria@example.com',
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
  }
];

// Helper to determine status based on dates
export function calculateGroupStatus(startDate: string, endDate: string): TravelGroupStatus {
  const now = new Date().toISOString().split('T')[0];
  if (endDate < now) return 'completed';
  if (startDate <= now && endDate >= now) return 'active';
  return 'upcoming';
}

function getStoredCache<T>(key: string, defaultVal: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function saveStoredCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Could not save cache to ${key}:`, e);
  }
}

export const travelGroupService = {
  // 1. Create a Travel Group
  async createTravelGroup(
    owner: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
    dto: CreateGroupDTO
  ): Promise<TravelGroup> {
    const groupId = 'tg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const status = calculateGroupStatus(dto.startDate, dto.endDate);

    const group: TravelGroup = {
      id: groupId,
      ownerId: owner.uid,
      ownerName: owner.displayName || owner.email?.split('@')[0] || 'Group Organizer',
      ownerEmail: owner.email || undefined,
      name: dto.name.trim(),
      destination: dto.destination.trim(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description?.trim() || '',
      status,
      membersCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const memberId = `${groupId}_${owner.uid}`;
    const ownerMember: GroupMember = {
      id: memberId,
      groupId,
      userId: owner.uid,
      displayName: owner.displayName || owner.email?.split('@')[0] || 'Group Organizer',
      email: owner.email || '',
      photoURL: owner.photoURL || undefined,
      role: 'owner',
      status: 'active',
      joinedAt: now,
    };

    // Save in Local Storage Cache first for instantaneous optimistic updates
    const groups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    groups.unshift(group);
    saveStoredCache(STORAGE_GROUPS_KEY, groups);

    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    members.push(ownerMember);
    saveStoredCache(STORAGE_MEMBERS_KEY, members);

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'travel_groups', groupId), group);
      await setDoc(doc(db, 'group_members', memberId), ownerMember);
    } catch (err) {
      console.warn('Firestore sync failed for createTravelGroup, using local cache:', err);
    }

    return group;
  },

  // 2. Get a single group
  async getTravelGroup(groupId: string): Promise<TravelGroup | null> {
    // Try Firestore
    try {
      const snap = await getDoc(doc(db, 'travel_groups', groupId));
      if (snap.exists()) {
        const data = snap.data() as TravelGroup;
        return {
          ...data,
          status: calculateGroupStatus(data.startDate, data.endDate)
        };
      }
    } catch (err) {
      console.warn('Firestore fetch failed for getTravelGroup:', err);
    }

    // Fallback to cache
    const groups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    const found = groups.find(g => g.id === groupId);
    if (found) {
      return {
        ...found,
        status: calculateGroupStatus(found.startDate, found.endDate)
      };
    }
    return null;
  },

  // 3. Update Travel Group (Owner only)
  async updateTravelGroup(
    groupId: string,
    data: Partial<CreateGroupDTO>,
    requesterUserId: string
  ): Promise<TravelGroup> {
    const existing = await this.getTravelGroup(groupId);
    if (!existing) throw new Error('Group not found');
    if (existing.ownerId !== requesterUserId) {
      throw new Error('Only the Group Owner can edit this travel group');
    }

    const now = new Date().toISOString();
    const updated: TravelGroup = {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      destination: data.destination !== undefined ? data.destination.trim() : existing.destination,
      startDate: data.startDate !== undefined ? data.startDate : existing.startDate,
      endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
      description: data.description !== undefined ? data.description.trim() : existing.description,
      status: calculateGroupStatus(
        data.startDate || existing.startDate, 
        data.endDate || existing.endDate
      ),
      updatedAt: now,
    };

    // Update Cache
    const groups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx >= 0) {
      groups[idx] = updated;
    } else {
      groups.push(updated);
    }
    saveStoredCache(STORAGE_GROUPS_KEY, groups);

    // Update Firestore
    try {
      await updateDoc(doc(db, 'travel_groups', groupId), {
        name: updated.name,
        destination: updated.destination,
        startDate: updated.startDate,
        endDate: updated.endDate,
        description: updated.description,
        status: updated.status,
        updatedAt: now,
      });
    } catch (err) {
      console.warn('Firestore update failed for updateTravelGroup:', err);
    }

    return updated;
  },

  // 4. Get all groups for a user
  async getUserGroups(userId: string, userEmail?: string | null): Promise<TravelGroup[]> {
    const userEmailLower = userEmail?.toLowerCase() || '';

    // First retrieve memberships from cache/Firestore
    let userGroupIds = new Set<string>();

    try {
      const q = query(
        collection(db, 'group_members'), 
        where('userId', '==', userId),
        where('status', 'in', ['active', 'invited'])
      );
      const snap = await getDocs(q);
      snap.forEach(d => userGroupIds.add(d.data().groupId));
    } catch (err) {
      console.warn('Firestore query failed for group_members:', err);
    }

    // Also scan local cache for memberships
    const cachedMembers = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    cachedMembers.forEach(m => {
      if ((m.userId === userId || (userEmailLower && m.email.toLowerCase() === userEmailLower)) && 
          (m.status === 'active' || m.status === 'invited')) {
        userGroupIds.add(m.groupId);
      }
    });

    // Also add groups owned directly
    const cachedGroups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    cachedGroups.forEach(g => {
      if (g.ownerId === userId || (userEmailLower && g.ownerEmail?.toLowerCase() === userEmailLower)) {
        userGroupIds.add(g.id);
      }
    });

    // If demo group is present, also allow viewing for demo exploration
    if (userGroupIds.size === 0) {
      userGroupIds.add('group_tofo_weekend_demo');
    }

    const resultGroups: TravelGroup[] = [];
    for (const gid of Array.from(userGroupIds)) {
      const g = await this.getTravelGroup(gid);
      if (g) {
        // Calculate active members count
        const members = await this.getGroupMembers(gid);
        const activeCount = members.filter(m => m.status === 'active').length;
        resultGroups.push({
          ...g,
          membersCount: activeCount > 0 ? activeCount : (g.membersCount || 1)
        });
      }
    }

    // Sort by startDate ascending
    return resultGroups.sort((a, b) => a.startDate.localeCompare(b.startDate));
  },

  // 5. Get members of a group
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const q = query(collection(db, 'group_members'), where('groupId', '==', groupId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firestoreMembers: GroupMember[] = [];
        snap.forEach(d => firestoreMembers.push(d.data() as GroupMember));
        return firestoreMembers;
      }
    } catch (err) {
      console.warn('Firestore fetch failed for getGroupMembers:', err);
    }

    const cachedMembers = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    return cachedMembers.filter(m => m.groupId === groupId);
  },

  // 6. Invite Member to group
  async inviteMember(
    groupId: string,
    inviter: { uid: string; displayName?: string | null },
    inviteeIdentifier: string // email or username
  ): Promise<GroupInvitation> {
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Travel group not found');

    const cleanIdentifier = inviteeIdentifier.trim();
    if (!cleanIdentifier) throw new Error('Please provide an email or username to invite');

    // Check if already an active member
    const existingMembers = await this.getGroupMembers(groupId);
    const alreadyMember = existingMembers.find(m => 
      m.email.toLowerCase() === cleanIdentifier.toLowerCase() || 
      m.displayName.toLowerCase() === cleanIdentifier.toLowerCase() ||
      m.userId === cleanIdentifier
    );

    if (alreadyMember && alreadyMember.status === 'active') {
      throw new Error(`${cleanIdentifier} is already an active member of this group`);
    }

    const invitationId = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const token = 'tok_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

    const invitation: GroupInvitation = {
      id: invitationId,
      groupId,
      groupName: group.name,
      groupDestination: group.destination,
      groupStartDate: group.startDate,
      groupEndDate: group.endDate,
      inviterId: inviter.uid,
      inviterName: inviter.displayName || 'Group Host',
      inviteeIdentifier: cleanIdentifier,
      token,
      status: 'pending',
      expiresAt,
      createdAt: now.toISOString(),
    };

    // Save invitation to cache
    const invitations = getStoredCache<GroupInvitation>(STORAGE_INVITATIONS_KEY, []);
    invitations.unshift(invitation);
    saveStoredCache(STORAGE_INVITATIONS_KEY, invitations);

    // Add member with status 'invited'
    const memberId = `${groupId}_${cleanIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const invitedMember: GroupMember = {
      id: memberId,
      groupId,
      userId: cleanIdentifier,
      displayName: cleanIdentifier.includes('@') ? cleanIdentifier.split('@')[0] : cleanIdentifier,
      email: cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@mozbook.mz`,
      role: 'member',
      status: 'invited',
      joinedAt: now.toISOString(),
      invitedBy: inviter.displayName || 'Organizer',
    };

    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    const existingIdx = members.findIndex(m => m.id === memberId);
    if (existingIdx >= 0) {
      members[existingIdx] = invitedMember;
    } else {
      members.push(invitedMember);
    }
    saveStoredCache(STORAGE_MEMBERS_KEY, members);

    // Save to Firestore
    try {
      await setDoc(doc(db, 'group_invitations', invitationId), invitation);
      await setDoc(doc(db, 'group_members', memberId), invitedMember);
    } catch (err) {
      console.warn('Firestore sync failed for inviteMember:', err);
    }

    return invitation;
  },

  // 7. Get Pending Invitations for a user
  async getUserPendingInvitations(userId: string, userEmail?: string | null): Promise<GroupInvitation[]> {
    const userEmailLower = userEmail?.toLowerCase() || '';

    let invitations: GroupInvitation[] = [];

    // Query Firestore
    try {
      const q = query(
        collection(db, 'group_invitations'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      snap.forEach(d => invitations.push(d.data() as GroupInvitation));
    } catch (err) {
      console.warn('Firestore fetch failed for pending invitations:', err);
    }

    // Merge cache
    const cached = getStoredCache<GroupInvitation>(STORAGE_INVITATIONS_KEY, []);
    cached.forEach(ci => {
      if (!invitations.some(i => i.id === ci.id)) {
        invitations.push(ci);
      }
    });

    // Filter to invitations matching user email or identifier
    return invitations.filter(inv => {
      if (inv.status !== 'pending') return false;
      const target = inv.inviteeIdentifier.toLowerCase();
      return target === userEmailLower || target === userId.toLowerCase();
    });
  },

  // 7b. Check if user is already an active member of a group
  async isUserGroupMember(groupId: string, userId: string, userEmail?: string | null): Promise<boolean> {
    if (!groupId || !userId) return false;
    const emailLower = userEmail?.toLowerCase();

    // Check if group owner
    const group = await this.getTravelGroup(groupId);
    if (group && (group.ownerId === userId || (emailLower && group.ownerEmail?.toLowerCase() === emailLower))) {
      return true;
    }

    // Check active group members
    const members = await this.getGroupMembers(groupId);
    return members.some(m => 
      m.status === 'active' && 
      (m.userId === userId || (emailLower && m.email?.toLowerCase() === emailLower))
    );
  },

  // 7c. Get Invitation by Token with enriched group metadata
  async getInvitationByToken(token: string): Promise<EnrichedInvitation | null> {
    if (!token) return null;
    const cleanToken = token.trim();

    let invitation: GroupInvitation | null = null;

    // 1. Try Firestore lookup
    try {
      const q = query(
        collection(db, 'group_invitations'),
        where('token', '==', cleanToken)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        invitation = snap.docs[0].data() as GroupInvitation;
      }
    } catch (err) {
      console.warn('Firestore query failed for getInvitationByToken:', err);
    }

    // 2. Try Local Cache fallback
    if (!invitation) {
      const cached = getStoredCache<GroupInvitation>(STORAGE_INVITATIONS_KEY, []);
      const found = cached.find(i => i.token === cleanToken);
      if (found) {
        invitation = found;
      }
    }

    if (!invitation) return null;

    // Expiry evaluation
    const nowTime = Date.now();
    const isExpired = new Date(invitation.expiresAt).getTime() < nowTime;
    if (isExpired && invitation.status === 'pending') {
      invitation.status = 'expired';
    }

    // Fetch associated group details
    const group = await this.getTravelGroup(invitation.groupId);

    // Determine state reason
    let statusReason: EnrichedInvitation['statusReason'] = 'valid';
    if (invitation.status === 'accepted') {
      statusReason = 'already_accepted';
    } else if (invitation.status === 'declined') {
      statusReason = 'already_declined';
    } else if (isExpired || invitation.status === 'expired') {
      statusReason = 'expired';
    }

    return {
      invitation,
      group,
      isValid: invitation.status === 'pending' && !isExpired,
      statusReason,
    };
  },

  // 8. Accept Invitation
  async acceptInvitation(
    invitationId: string,
    user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }
  ): Promise<{ groupId: string; groupName: string }> {
    const invitations = getStoredCache<GroupInvitation>(STORAGE_INVITATIONS_KEY, []);
    const invIdx = invitations.findIndex(i => i.id === invitationId);
    let inv = invIdx >= 0 ? invitations[invIdx] : null;

    if (!inv) {
      try {
        const snap = await getDoc(doc(db, 'group_invitations', invitationId));
        if (snap.exists()) inv = snap.data() as GroupInvitation;
      } catch (err) {
        console.warn('Failed to fetch invitation from firestore:', err);
      }
    }

    if (!inv) throw new Error('Invitation not found or invalid');
    if (inv.status === 'accepted') {
      return { groupId: inv.groupId, groupName: inv.groupName };
    }
    if (inv.status === 'declined') {
      throw new Error('This invitation has already been declined.');
    }
    const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
    if (isExpired || inv.status === 'expired') {
      throw new Error('This invitation has expired.');
    }

    const now = new Date().toISOString();
    inv.status = 'accepted';
    inv.acceptedAt = now;
    inv.acceptedByUserId = user.uid;
    inv.acceptedByEmail = user.email || undefined;
    inv.acceptedByName = user.displayName || user.email?.split('@')[0] || undefined;

    if (invIdx >= 0) {
      invitations[invIdx] = inv;
      saveStoredCache(STORAGE_INVITATIONS_KEY, invitations);
    }

    // Create/update active membership
    const memberId = `${inv.groupId}_${user.uid}`;
    const activeMember: GroupMember = {
      id: memberId,
      groupId: inv.groupId,
      userId: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Group Member',
      email: user.email || (inv.inviteeIdentifier.includes('@') ? inv.inviteeIdentifier : `${inv.inviteeIdentifier}@mozbook.mz`),
      photoURL: user.photoURL || undefined,
      role: 'member',
      status: 'active',
      joinedAt: now,
      invitedBy: inv.inviterName,
    };

    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    const cleanIdentifier = inv.inviteeIdentifier.toLowerCase();
    
    // Replace placeholder or existing record for this user
    const existingIdx = members.findIndex(m => 
      m.groupId === inv!.groupId && (
        m.userId === user.uid || 
        m.id === memberId ||
        m.email.toLowerCase() === cleanIdentifier ||
        (user.email && m.email.toLowerCase() === user.email.toLowerCase())
      )
    );

    if (existingIdx >= 0) {
      members[existingIdx] = activeMember;
    } else {
      members.push(activeMember);
    }
    saveStoredCache(STORAGE_MEMBERS_KEY, members);

    // Calculate updated active members count
    const activeCount = members.filter(m => m.groupId === inv!.groupId && m.status === 'active').length;
    const groups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    const gIdx = groups.findIndex(g => g.id === inv!.groupId);
    if (gIdx >= 0) {
      groups[gIdx].membersCount = activeCount;
      groups[gIdx].updatedAt = now;
      saveStoredCache(STORAGE_GROUPS_KEY, groups);
    }

    // Sync to Firestore
    try {
      await updateDoc(doc(db, 'group_invitations', invitationId), {
        status: 'accepted',
        acceptedAt: now,
        acceptedByUserId: user.uid,
        acceptedByEmail: user.email || null,
        acceptedByName: user.displayName || null,
      });
      await setDoc(doc(db, 'group_members', memberId), activeMember);
      await updateDoc(doc(db, 'travel_groups', inv.groupId), {
        membersCount: activeCount,
        updatedAt: now,
      });

      // Cleanup placeholder doc if identifier was different from uid
      const placeholderMemberId = `${inv.groupId}_${cleanIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (placeholderMemberId !== memberId) {
        try {
          await deleteDoc(doc(db, 'group_members', placeholderMemberId));
        } catch {
          // ignore placeholder cleanup if already absent
        }
      }
    } catch (err) {
      console.warn('Firestore update failed for acceptInvitation:', err);
    }

    return { groupId: inv.groupId, groupName: inv.groupName };
  },

  // 8b. Accept Invitation by Token
  async acceptInvitationByToken(
    token: string,
    user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null }
  ): Promise<{ groupId: string; groupName: string }> {
    const enriched = await this.getInvitationByToken(token);
    if (!enriched) {
      throw new Error('Invitation not found or invalid token.');
    }
    if (enriched.invitation.status === 'accepted') {
      return { groupId: enriched.invitation.groupId, groupName: enriched.invitation.groupName };
    }
    if (enriched.invitation.status === 'declined') {
      throw new Error('This invitation has already been declined.');
    }
    if (!enriched.isValid) {
      throw new Error('This invitation has expired or is no longer valid.');
    }

    return this.acceptInvitation(enriched.invitation.id, user);
  },

  // 9. Decline Invitation
  async declineInvitation(invitationId: string, _user: { uid: string }): Promise<void> {
    const invitations = getStoredCache<GroupInvitation>(STORAGE_INVITATIONS_KEY, []);
    const invIdx = invitations.findIndex(i => i.id === invitationId);
    let inv = invIdx >= 0 ? invitations[invIdx] : null;

    if (!inv) {
      try {
        const snap = await getDoc(doc(db, 'group_invitations', invitationId));
        if (snap.exists()) inv = snap.data() as GroupInvitation;
      } catch (err) {
        console.warn('Failed to fetch invitation:', err);
      }
    }

    if (!inv) throw new Error('Invitation not found');
    const now = new Date().toISOString();
    inv.status = 'declined';
    inv.declinedAt = now;

    if (invIdx >= 0) {
      invitations[invIdx] = inv;
      saveStoredCache(STORAGE_INVITATIONS_KEY, invitations);
    }

    // Mark member record as declined if exists
    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    const mIdx = members.findIndex(m => m.groupId === inv.groupId && m.email.toLowerCase() === inv.inviteeIdentifier.toLowerCase());
    if (mIdx >= 0) {
      members[mIdx].status = 'declined';
      saveStoredCache(STORAGE_MEMBERS_KEY, members);
    }

    try {
      await updateDoc(doc(db, 'group_invitations', invitationId), {
        status: 'declined',
        declinedAt: now
      });
    } catch (err) {
      console.warn('Firestore update failed for declineInvitation:', err);
    }
  },

  // 9b. Decline Invitation by Token
  async declineInvitationByToken(token: string, user: { uid: string }): Promise<void> {
    const enriched = await this.getInvitationByToken(token);
    if (!enriched) {
      throw new Error('Invitation not found.');
    }
    return this.declineInvitation(enriched.invitation.id, user);
  },

  // 10. Leave Group
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');

    if (group.ownerId === userId) {
      const members = await this.getGroupMembers(groupId);
      const otherActive = members.filter(m => m.userId !== userId && m.status === 'active');
      if (otherActive.length > 0) {
        throw new Error('As the Group Owner, you must transfer ownership to another active member before leaving.');
      }
    }

    const now = new Date().toISOString();
    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    const mIdx = members.findIndex(m => m.groupId === groupId && m.userId === userId);
    if (mIdx >= 0) {
      members[mIdx].status = 'left';
      members[mIdx].leftAt = now;
      saveStoredCache(STORAGE_MEMBERS_KEY, members);
    }

    try {
      const q = query(
        collection(db, 'group_members'), 
        where('groupId', '==', groupId),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      snap.forEach(async d => {
        await updateDoc(doc(db, 'group_members', d.id), {
          status: 'left',
          leftAt: now
        });
      });
    } catch (err) {
      console.warn('Firestore update failed for leaveGroup:', err);
    }
  },

  // 11. Remove Member (Owner only)
  async removeMember(groupId: string, memberUserId: string, requesterUserId: string): Promise<void> {
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (group.ownerId !== requesterUserId) {
      throw new Error('Only the Group Owner can remove members');
    }
    if (memberUserId === group.ownerId) {
      throw new Error('You cannot remove the group owner. Transfer ownership first.');
    }

    const now = new Date().toISOString();
    const members = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    const mIdx = members.findIndex(m => m.groupId === groupId && (m.userId === memberUserId || m.id === memberUserId));
    if (mIdx >= 0) {
      members[mIdx].status = 'removed';
      members[mIdx].leftAt = now;
      saveStoredCache(STORAGE_MEMBERS_KEY, members);
    }

    try {
      const q = query(
        collection(db, 'group_members'), 
        where('groupId', '==', groupId),
        where('userId', '==', memberUserId)
      );
      const snap = await getDocs(q);
      snap.forEach(async d => {
        await updateDoc(doc(db, 'group_members', d.id), {
          status: 'removed',
          leftAt: now
        });
      });
    } catch (err) {
      console.warn('Firestore update failed for removeMember:', err);
    }
  },

  // 12. Transfer Ownership (Owner only)
  async transferOwnership(
    groupId: string, 
    newOwnerUserId: string, 
    currentOwnerUserId: string
  ): Promise<void> {
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (group.ownerId !== currentOwnerUserId) {
      throw new Error('Only the current Group Owner can transfer ownership');
    }

    const members = await this.getGroupMembers(groupId);
    const newOwnerMember = members.find(m => m.userId === newOwnerUserId && m.status === 'active');
    if (!newOwnerMember) {
      throw new Error('Ownership can only be transferred to an active group member');
    }

    const now = new Date().toISOString();

    // 1. Update Group document
    const updatedGroup: TravelGroup = {
      ...group,
      ownerId: newOwnerUserId,
      ownerName: newOwnerMember.displayName,
      ownerEmail: newOwnerMember.email,
      updatedAt: now,
    };

    const groups = getStoredCache<TravelGroup>(STORAGE_GROUPS_KEY, INITIAL_DEMO_GROUPS);
    const gIdx = groups.findIndex(g => g.id === groupId);
    if (gIdx >= 0) groups[gIdx] = updatedGroup;
    saveStoredCache(STORAGE_GROUPS_KEY, groups);

    // 2. Update Member roles
    const cachedMembers = getStoredCache<GroupMember>(STORAGE_MEMBERS_KEY, INITIAL_DEMO_MEMBERS);
    cachedMembers.forEach(m => {
      if (m.groupId === groupId) {
        if (m.userId === currentOwnerUserId) {
          m.role = 'member';
        } else if (m.userId === newOwnerUserId) {
          m.role = 'owner';
        }
      }
    });
    saveStoredCache(STORAGE_MEMBERS_KEY, cachedMembers);

    // 3. Sync to Firestore
    try {
      await updateDoc(doc(db, 'travel_groups', groupId), {
        ownerId: newOwnerUserId,
        ownerName: newOwnerMember.displayName,
        ownerEmail: newOwnerMember.email,
        updatedAt: now
      });

      // Update old owner member doc
      const oldQ = query(collection(db, 'group_members'), where('groupId', '==', groupId), where('userId', '==', currentOwnerUserId));
      const oldSnap = await getDocs(oldQ);
      oldSnap.forEach(async d => await updateDoc(doc(db, 'group_members', d.id), { role: 'member' }));

      // Update new owner member doc
      const newQ = query(collection(db, 'group_members'), where('groupId', '==', groupId), where('userId', '==', newOwnerUserId));
      const newSnap = await getDocs(newQ);
      newSnap.forEach(async d => await updateDoc(doc(db, 'group_members', d.id), { role: 'owner' }));
    } catch (err) {
      console.warn('Firestore update failed for transferOwnership:', err);
    }
  },

  // Helper: Compute Fair-Share Cost Allocation Breakdown
  computeCostAllocation(
    totalAmount: number,
    payerUserId: string,
    payerName: string,
    participants: GroupBookingParticipant[],
    currency = 'MZN'
  ): GroupCostAllocation {
    const includedList = participants.filter(p => p.status === 'included');
    const includedCount = Math.max(1, includedList.length);
    const fairShare = Math.round(totalAmount / includedCount);

    // Apply fair-share amount to all included participants
    participants.forEach(p => {
      if (p.status === 'included') {
        p.allocatedShareMzn = fairShare;
        if (!p.shareSettlementStatus) {
          p.shareSettlementStatus = p.userId === payerUserId ? 'settled' : 'pending';
        }
      } else {
        p.allocatedShareMzn = 0;
      }
    });

    const settledSharesCount = participants.filter(p => p.status === 'included' && p.shareSettlementStatus === 'settled').length;
    const pendingSharesCount = participants.filter(p => p.status === 'included' && p.shareSettlementStatus === 'pending').length;

    return {
      totalAmount,
      currency,
      payerUserId,
      payerName,
      includedCount,
      fairSharePerPersonMzn: fairShare,
      settledSharesCount,
      pendingSharesCount
    };
  },

  // 13. Link an existing or new booking to a private Travel Group
  async linkBookingToGroup(
    groupId: string,
    bookingData: {
      bookingId: string;
      bookingCategory: 'stay' | 'activity' | 'trip';
      bookingRef: string;
      title: string;
      city?: string;
      location?: string;
      image?: string;
      dateOrStartDate: string;
      endDate?: string;
      time?: string;
      totalAmount: number;
      currency?: string;
      status?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      notes?: string;
    },
    user: { uid: string; displayName?: string | null; email?: string | null }
  ): Promise<GroupBookingLink> {
    // Security check: User must be active member or owner of group
    const isMember = await this.isUserGroupMember(groupId, user.uid, user.email);
    if (!isMember) {
      throw new Error('Only active members of this travel group can link bookings.');
    }

    // Default all active group members as included participants initially
    const activeMembers = (await this.getGroupMembers(groupId)).filter(m => m.status === 'active');
    const participants: GroupBookingParticipant[] = activeMembers.map(m => ({
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
      status: 'included',
      isExternalGuest: false,
      guestType: 'member',
      shareSettlementStatus: m.userId === user.uid ? 'settled' : 'pending'
    }));

    const now = new Date().toISOString();
    const linkId = `${groupId}_${bookingData.bookingId}`;

    // Calculate Fair-Share Cost Allocation Breakdown
    const costAllocation = this.computeCostAllocation(
      bookingData.totalAmount,
      user.uid,
      user.displayName || 'Booking Organizer',
      participants,
      bookingData.currency || 'MZN'
    );

    const link: GroupBookingLink = {
      id: linkId,
      groupId,
      bookingId: bookingData.bookingId,
      bookingCategory: bookingData.bookingCategory,
      bookingRef: bookingData.bookingRef,
      title: bookingData.title,
      city: bookingData.city,
      location: bookingData.location,
      image: bookingData.image,
      dateOrStartDate: bookingData.dateOrStartDate,
      endDate: bookingData.endDate,
      time: bookingData.time,
      totalAmount: bookingData.totalAmount,
      currency: bookingData.currency || 'MZN',
      status: bookingData.status || 'pending',
      paymentStatus: bookingData.paymentStatus || 'unpaid',
      fulfillmentStatus: bookingData.fulfillmentStatus || 'unfulfilled',
      createdByUserId: user.uid,
      createdByName: user.displayName || user.email?.split('@')[0] || 'Group Member',
      createdAt: now,
      updatedAt: now,
      participants,
      costAllocation,
      notes: bookingData.notes
    };

    // Save in Local Storage Cache
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    const existingIdx = stored.findIndex(b => b.id === linkId);
    if (existingIdx >= 0) {
      stored[existingIdx] = link;
    } else {
      stored.unshift(link);
    }
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, stored);

    // Save in Firestore `travel_group_bookings` collection
    try {
      await setDoc(doc(db, 'travel_group_bookings', linkId), link);
    } catch (err) {
      console.warn('Firestore setDoc failed for travel_group_bookings, stored locally:', err);
    }

    return link;
  },

  // 14. Get all bookings linked to a travel group
  async getGroupBookings(groupId: string, requesterUserId?: string, requesterEmail?: string | null): Promise<GroupBookingLink[]> {
    if (requesterUserId) {
      const isMember = await this.isUserGroupMember(groupId, requesterUserId, requesterEmail);
      if (!isMember) {
        throw new Error('Access denied: Only members of this travel group can access group bookings.');
      }
    }

    let links: GroupBookingLink[] = [];

    // Query Firestore
    try {
      const q = query(collection(db, 'travel_group_bookings'), where('groupId', '==', groupId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        snap.forEach(d => links.push(d.data() as GroupBookingLink));
      }
    } catch (err) {
      console.warn('Firestore fetch failed for travel_group_bookings:', err);
    }

    // Merge Cache
    const cached = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    cached.filter(b => b.groupId === groupId).forEach(cb => {
      if (!links.some(l => l.id === cb.id)) {
        links.push(cb);
      }
    });

    // Also look up any bookings directly in `bookings` and `activity_bookings` where travelGroupId == groupId
    try {
      const stayQ = query(collection(db, 'bookings'), where('travelGroupId', '==', groupId));
      const staySnap = await getDocs(stayQ);
      staySnap.forEach(d => {
        const data = d.data();
        const bId = d.id;
        const exists = links.some(l => l.bookingId === bId);
        if (!exists) {
          links.push({
            id: `${groupId}_${bId}`,
            groupId,
            bookingId: bId,
            bookingCategory: 'stay',
            bookingRef: data.bookingRef || 'MB-STAY-REF',
            title: data.listingTitle || 'Stay Reservation',
            city: data.listingCity,
            location: data.listingLocation,
            image: data.listingImage,
            dateOrStartDate: data.startDate || data.checkInDate,
            endDate: data.endDate || data.checkOutDate,
            totalAmount: data.totalAmount || 0,
            currency: data.currency || 'MZN',
            status: data.status || 'pending',
            paymentStatus: data.paymentStatus || 'unpaid',
            fulfillmentStatus: data.fulfillmentStatus || 'unfulfilled',
            createdByUserId: data.userId,
            createdByName: data.customerName,
            createdAt: data.createdAt || new Date().toISOString(),
            participants: []
          });
        }
      });
    } catch (stayErr) {
      console.warn('Error querying stay bookings for group:', stayErr);
    }

    try {
      const actQ = query(collection(db, 'activity_bookings'), where('travelGroupId', '==', groupId));
      const actSnap = await getDocs(actQ);
      actSnap.forEach(d => {
        const data = d.data();
        const bId = d.id;
        const exists = links.some(l => l.bookingId === bId);
        if (!exists) {
          links.push({
            id: `${groupId}_${bId}`,
            groupId,
            bookingId: bId,
            bookingCategory: data.activityType === 'trip' ? 'trip' : 'activity',
            bookingRef: data.bookingRef || 'MB-EXP-REF',
            title: data.activityTitle || 'Activity Booking',
            city: data.city,
            dateOrStartDate: data.date,
            time: data.time,
            totalAmount: data.totalMzn || 0,
            currency: 'MZN',
            status: data.status || 'pending',
            paymentStatus: data.paymentStatus || 'unpaid',
            fulfillmentStatus: data.fulfillmentStatus || 'unfulfilled',
            createdByUserId: data.userId || 'traveler',
            createdByName: data.customerName,
            createdAt: data.createdAt || new Date().toISOString(),
            participants: []
          });
        }
      });
    } catch (actErr) {
      console.warn('Error querying activity bookings for group:', actErr);
    }

    // Sort ascending by date
    return links.sort((a, b) => a.dateOrStartDate.localeCompare(b.dateOrStartDate));
  },

  // 15. Update participant inclusion in a group booking
  async updateParticipantStatus(
    groupId: string,
    bookingId: string,
    participantUserId: string,
    newStatus: 'included' | 'opted_out',
    requesterUserId: string
  ): Promise<GroupBookingLink> {
    const linkId = `${groupId}_${bookingId}`;
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    let link = stored.find(b => b.id === linkId || (b.groupId === groupId && b.bookingId === bookingId));

    if (!link) {
      // Try to load from Firestore
      try {
        const snap = await getDoc(doc(db, 'travel_group_bookings', linkId));
        if (snap.exists()) {
          link = snap.data() as GroupBookingLink;
        }
      } catch (err) {
        console.warn('Firestore fetch failed:', err);
      }
    }

    if (!link) {
      throw new Error('Group booking link not found');
    }

    // Authorization: User can update their own participation, or group owner can adjust
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');
    const isOwner = group.ownerId === requesterUserId;
    if (!isOwner && requesterUserId !== participantUserId) {
      throw new Error('You can only update your own participation in this booking');
    }

    const now = new Date().toISOString();
    const updatedParticipants = [...(link.participants || [])];
    const pIdx = updatedParticipants.findIndex(p => p.userId === participantUserId);

    if (pIdx >= 0) {
      updatedParticipants[pIdx].status = newStatus;
    } else {
      // Find member details
      const members = await this.getGroupMembers(groupId);
      const member = members.find(m => m.userId === participantUserId);
      updatedParticipants.push({
        userId: participantUserId,
        displayName: member?.displayName || 'Member',
        email: member?.email || '',
        status: newStatus
      });
    }

    link.participants = updatedParticipants;
    link.costAllocation = this.computeCostAllocation(
      link.totalAmount,
      link.createdByUserId,
      link.createdByName || 'Organizer',
      updatedParticipants,
      link.currency
    );
    link.updatedAt = now;

    // Update Cache
    const idx = stored.findIndex(b => b.id === link!.id);
    if (idx >= 0) {
      stored[idx] = link;
    } else {
      stored.push(link);
    }
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, stored);

    // Update Firestore
    try {
      await updateDoc(doc(db, 'travel_group_bookings', link.id), {
        participants: updatedParticipants,
        costAllocation: link.costAllocation,
        updatedAt: now
      });
    } catch (err) {
      console.warn('Firestore update failed for updateParticipantStatus:', err);
    }

    return link;
  },

  // 15B. Add non-group companion / external guest to a group booking
  async addExternalGuestToBooking(
    groupId: string,
    bookingId: string,
    guestData: {
      displayName: string;
      email?: string;
      guestType?: GroupParticipantType;
      guestPhone?: string;
      notes?: string;
    },
    requesterUserId: string
  ): Promise<GroupBookingLink> {
    const linkId = `${groupId}_${bookingId}`;
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    let link = stored.find(b => b.id === linkId || (b.groupId === groupId && b.bookingId === bookingId));

    if (!link) {
      try {
        const snap = await getDoc(doc(db, 'travel_group_bookings', linkId));
        if (snap.exists()) {
          link = snap.data() as GroupBookingLink;
        }
      } catch (err) {
        console.warn('Firestore fetch failed:', err);
      }
    }

    if (!link) throw new Error('Booking link not found');

    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');
    const isOwner = group.ownerId === requesterUserId;
    const isBooker = link.createdByUserId === requesterUserId;

    if (!isOwner && !isBooker) {
      throw new Error('Only the group owner or booking creator can add companions');
    }

    const extId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newParticipant: GroupBookingParticipant = {
      userId: extId,
      displayName: guestData.displayName,
      email: guestData.email || '',
      status: 'included',
      isExternalGuest: true,
      guestType: guestData.guestType || 'companion',
      guestPhone: guestData.guestPhone,
      shareSettlementStatus: 'pending',
      notes: guestData.notes
    };

    const updatedParticipants = [...(link.participants || []), newParticipant];
    const now = new Date().toISOString();

    link.participants = updatedParticipants;
    link.costAllocation = this.computeCostAllocation(
      link.totalAmount,
      link.createdByUserId,
      link.createdByName || 'Organizer',
      updatedParticipants,
      link.currency
    );
    link.updatedAt = now;

    // Cache update
    const idx = stored.findIndex(b => b.id === link!.id);
    if (idx >= 0) stored[idx] = link;
    else stored.push(link);
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, stored);

    // Firestore update
    try {
      await updateDoc(doc(db, 'travel_group_bookings', link.id), {
        participants: updatedParticipants,
        costAllocation: link.costAllocation,
        updatedAt: now
      });
    } catch (err) {
      console.warn('Firestore update failed for addExternalGuestToBooking:', err);
    }

    return link;
  },

  // 15C. Remove external guest from group booking
  async removeExternalGuestFromBooking(
    groupId: string,
    bookingId: string,
    guestUserId: string,
    requesterUserId: string
  ): Promise<GroupBookingLink> {
    const linkId = `${groupId}_${bookingId}`;
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    let link = stored.find(b => b.id === linkId || (b.groupId === groupId && b.bookingId === bookingId));

    if (!link) throw new Error('Booking link not found');

    const updatedParticipants = (link.participants || []).filter(p => p.userId !== guestUserId);
    const now = new Date().toISOString();

    link.participants = updatedParticipants;
    link.costAllocation = this.computeCostAllocation(
      link.totalAmount,
      link.createdByUserId,
      link.createdByName || 'Organizer',
      updatedParticipants,
      link.currency
    );
    link.updatedAt = now;

    const idx = stored.findIndex(b => b.id === link!.id);
    if (idx >= 0) stored[idx] = link;
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, stored);

    try {
      await updateDoc(doc(db, 'travel_group_bookings', link.id), {
        participants: updatedParticipants,
        costAllocation: link.costAllocation,
        updatedAt: now
      });
    } catch (err) {
      console.warn('Firestore update failed for removeExternalGuestFromBooking:', err);
    }

    return link;
  },

  // 15D. Update internal share settlement status between group members/companions
  async updateParticipantSettlement(
    groupId: string,
    bookingId: string,
    participantUserId: string,
    settlementStatus: ShareSettlementStatus,
    requesterUserId: string
  ): Promise<GroupBookingLink> {
    const linkId = `${groupId}_${bookingId}`;
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    let link = stored.find(b => b.id === linkId || (b.groupId === groupId && b.bookingId === bookingId));

    if (!link) throw new Error('Booking link not found');

    const updatedParticipants = [...(link.participants || [])];
    const pIdx = updatedParticipants.findIndex(p => p.userId === participantUserId);
    if (pIdx >= 0) {
      updatedParticipants[pIdx].shareSettlementStatus = settlementStatus;
    }

    const now = new Date().toISOString();
    link.participants = updatedParticipants;
    link.costAllocation = this.computeCostAllocation(
      link.totalAmount,
      link.createdByUserId,
      link.createdByName || 'Organizer',
      updatedParticipants,
      link.currency
    );
    link.updatedAt = now;

    const idx = stored.findIndex(b => b.id === link!.id);
    if (idx >= 0) stored[idx] = link;
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, stored);

    try {
      await updateDoc(doc(db, 'travel_group_bookings', link.id), {
        participants: updatedParticipants,
        costAllocation: link.costAllocation,
        updatedAt: now
      });
    } catch (err) {
      console.warn('Firestore update failed for updateParticipantSettlement:', err);
    }

    return link;
  },

  // 16. Remove a booking from a group
  async unlinkBookingFromGroup(groupId: string, bookingId: string, requesterUserId: string): Promise<void> {
    const group = await this.getTravelGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (group.ownerId !== requesterUserId) {
      throw new Error('Only the Group Owner can remove bookings from the shared itinerary');
    }

    const linkId = `${groupId}_${bookingId}`;
    const stored = getStoredCache<GroupBookingLink>(STORAGE_GROUP_BOOKINGS_KEY, []);
    const filtered = stored.filter(b => b.id !== linkId && !(b.groupId === groupId && b.bookingId === bookingId));
    saveStoredCache(STORAGE_GROUP_BOOKINGS_KEY, filtered);

    try {
      await deleteDoc(doc(db, 'travel_group_bookings', linkId));
    } catch (err) {
      console.warn('Firestore delete failed for unlinkBookingFromGroup:', err);
    }
  },

  // 17. Compute Chronological Unified Group Itinerary
  async getGroupItinerary(groupId: string, requesterUserId?: string, requesterEmail?: string | null): Promise<GroupItineraryItem[]> {
    const bookings = await this.getGroupBookings(groupId, requesterUserId, requesterEmail);

    const items: GroupItineraryItem[] = bookings.map(b => {
      const includedParticipants = (b.participants || []).filter(p => p.status === 'included');
      return {
        id: `itin_${b.bookingId}`,
        groupId: b.groupId,
        bookingId: b.bookingId,
        bookingCategory: b.bookingCategory,
        bookingRef: b.bookingRef,
        title: b.title,
        date: b.dateOrStartDate,
        endDate: b.endDate,
        time: b.time,
        location: b.location,
        city: b.city,
        image: b.image,
        totalAmount: b.totalAmount,
        currency: b.currency,
        status: b.status,
        paymentStatus: b.paymentStatus,
        participantsCount: includedParticipants.length,
        participants: b.participants || [],
        costAllocation: b.costAllocation
      };
    });

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }
};

/**
 * Platform-Wide Session Isolation:
 * Wipes travel companion groups, members, invites, and group bookings from local storage.
 */
export function clearTravelGroupCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_GROUPS_KEY);
      localStorage.removeItem(STORAGE_MEMBERS_KEY);
      localStorage.removeItem(STORAGE_INVITATIONS_KEY);
      localStorage.removeItem(STORAGE_GROUP_BOOKINGS_KEY);
    }
  } catch (e) {
    console.warn('[travelGroupService] Error clearing travel group cache:', e);
  }
}

