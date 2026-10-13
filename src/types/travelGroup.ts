export type GroupRole = 'owner' | 'member';

export type GroupMemberStatus = 'invited' | 'active' | 'declined' | 'left' | 'removed';

export type TravelGroupStatus = 'active' | 'upcoming' | 'completed' | 'archived';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface TravelGroup {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  name: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description?: string;
  status: TravelGroupStatus;
  membersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string; // `${groupId}_${userId}` or docId
  groupId: string;
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt: string;
  leftAt?: string;
  invitedBy?: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDestination: string;
  groupStartDate: string;
  groupEndDate: string;
  inviterId: string;
  inviterName: string;
  inviteeIdentifier: string; // email or username
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  acceptedByUserId?: string;
  acceptedByEmail?: string;
  acceptedByName?: string;
}

export interface EnrichedInvitation {
  invitation: GroupInvitation;
  group: TravelGroup | null;
  isValid: boolean;
  statusReason: 'valid' | 'expired' | 'already_accepted' | 'already_declined' | 'not_found';
}

export interface CreateGroupDTO {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export type GroupBookingCategory = 'stay' | 'activity' | 'trip';

export type GroupParticipantStatus = 'included' | 'opted_out';
export type GroupParticipantType = 'member' | 'external_adult' | 'external_child' | 'companion';
export type ShareSettlementStatus = 'settled' | 'pending' | 'waived';

export interface GroupBookingParticipant {
  userId: string;
  displayName: string;
  email: string;
  status: GroupParticipantStatus;
  // Mixed participants support (registered group member vs non-group companion)
  isExternalGuest?: boolean;
  guestType?: GroupParticipantType;
  guestPhone?: string;
  // Cost allocation & fair-share tracking
  allocatedShareMzn?: number;
  shareSettlementStatus?: ShareSettlementStatus;
  notes?: string;
}

/**
 * Fair-Share Cost Allocation Breakdown for a Group Booking
 * Allows tracking who owes what while preserving single-payer PaySuite payment processing
 */
export interface GroupCostAllocation {
  totalAmount: number;
  currency: string;
  payerUserId: string;
  payerName: string;
  includedCount: number;
  fairSharePerPersonMzn: number;
  settledSharesCount: number;
  pendingSharesCount: number;
  notes?: string;
}

/**
 * Link connecting a private Travel Group to a booking
 */
export interface GroupBookingLink {
  id: string; // `${groupId}_${bookingId}` or unique ID
  groupId: string;
  bookingId: string;
  bookingCategory: GroupBookingCategory;
  bookingRef: string;
  title: string;
  city?: string;
  location?: string;
  image?: string;
  dateOrStartDate: string;
  endDate?: string;
  time?: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdByUserId: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  participants: GroupBookingParticipant[];
  costAllocation?: GroupCostAllocation;
  notes?: string;
}

export interface GroupItineraryItem {
  id: string;
  groupId: string;
  bookingId?: string;
  bookingCategory?: GroupBookingCategory;
  bookingRef?: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  time?: string;
  location?: string;
  city?: string;
  image?: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  participantsCount: number;
  participants: GroupBookingParticipant[];
  costAllocation?: GroupCostAllocation;
}
