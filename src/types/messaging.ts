export type MessageSenderRole = 'guest' | 'host' | 'admin';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  senderRole: MessageSenderRole;
  text: string;
  read: boolean;
  createdAt: string;
  timestampMs: number;
}

export interface ConversationParticipant {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: MessageSenderRole;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participants: Record<string, ConversationParticipant>;
  guestId: string;
  guestName: string;
  guestEmail?: string;
  guestPhotoURL?: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  hostPhotoURL?: string;
  isHostVerified?: boolean;
  
  // Associated property or experience context
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingCity?: string;
  listingLocation?: string;
  residenceType?: string;
  
  bookingId?: string;
  bookingRef?: string;
  bookingDates?: string;
  bookingStatus?: string;
  
  // Last message and unread counters
  lastMessageText: string;
  lastMessageTimestamp: string;
  lastMessageSenderId: string;
  unreadCount: Record<string, number>; // { [userId]: number }
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationParams {
  currentUserId: string;
  currentUser: {
    displayName: string;
    email?: string;
    photoURL?: string;
    role?: MessageSenderRole;
  };
  otherUserId: string;
  otherUser: {
    displayName: string;
    email?: string;
    photoURL?: string;
    role?: MessageSenderRole;
    isHostVerified?: boolean;
  };
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingCity?: string;
  listingLocation?: string;
  residenceType?: string;
  bookingId?: string;
  bookingRef?: string;
  bookingDates?: string;
  initialMessage?: string;
}
