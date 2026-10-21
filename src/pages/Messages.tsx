import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MessageCircle,
  Search,
  Send,
  ArrowLeft,
  ShieldCheck,
  Check,
  CheckCheck,
  ExternalLink,
  MapPin,
  Calendar,
  Sparkles,
  LogIn,
  Home,
  Clock
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Conversation,
  Message,
  ConversationParticipant
} from '../types/messaging';
import {
  subscribeToUserConversations,
  subscribeToConversationMessages,
  sendMessage,
  markConversationAsRead,
  getOrCreateConversation
} from '../services/messagingService';

type FilterTab = 'all' | 'unread' | 'stays' | 'activities';

export default function Messages() {
  const { user, profile, loading: authLoading, login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handledDeepLinkRef = useRef<string | null>(null);
  const isHandlingDeepLinkRef = useRef<boolean>(false);

  // Deep-link query parameters
  const queryConvId = searchParams.get('conversationId');
  const queryHostId = searchParams.get('hostId');
  const queryListingId = searchParams.get('listingId');
  const queryListingTitle = searchParams.get('title');
  const queryHostName = searchParams.get('hostName');
  const queryBookingId = searchParams.get('bookingId');
  const queryBookingRef = searchParams.get('bookingRef');

  // Keep ref to latest conversations for stable inspection without re-triggering deep link effect
  const conversationsRef = useRef<Conversation[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // 1. Subscribe to conversations
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setIsInitializing(false);
      return;
    }

    const unsubscribe = subscribeToUserConversations(
      user.uid,
      user.displayName || 'MozBook Guest',
      (convs) => {
        setConversations(convs);
        setIsInitializing(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Handle deep-linking query parameters (e.g. from "Message Host" on bookings or "Contact Host")
  useEffect(() => {
    async function handleDeepLink() {
      if (!user) return;

      if (queryConvId) {
        setSelectedConversationId(queryConvId);
        return;
      }

      // If no host ID in parameters, nothing to deep link
      if (!queryHostId) return;

      const deepLinkKey = `${user.uid}_${queryHostId}_${queryListingId || ''}_${queryBookingId || ''}`;
      if (handledDeepLinkRef.current === deepLinkKey || isHandlingDeepLinkRef.current) {
        return;
      }

      isHandlingDeepLinkRef.current = true;

      try {
        let resolvedHostId = queryHostId;
        let resolvedHostName = queryHostName || 'MozBook Host';
        let resolvedListingTitle = queryListingTitle || 'MozBook Reservation';
        let resolvedBookingRef = queryBookingRef;
        let resolvedListingId = queryListingId;

        // If bookingId is provided, look up authoritative booking record to verify participants
        if (queryBookingId) {
          // If an existing conversation already matches this booking, open it
          const matchedByBooking = conversationsRef.current.find((c) => c.bookingId === queryBookingId);
          if (matchedByBooking) {
            handledDeepLinkRef.current = deepLinkKey;
            setSelectedConversationId(matchedByBooking.id);
            setSearchParams({ conversationId: matchedByBooking.id }, { replace: true });
            return;
          }

          try {
            const staySnap = await getDoc(doc(db, 'bookings', queryBookingId));
            if (staySnap.exists()) {
              const data = staySnap.data();
              resolvedHostId = data.hostId;
              resolvedHostName = data.hostName || 'Property Host';
              resolvedListingTitle = data.listingTitle || resolvedListingTitle;
              resolvedBookingRef = data.bookingRef || resolvedBookingRef;
              resolvedListingId = data.listingId || resolvedListingId;
            } else {
              const actSnap = await getDoc(doc(db, 'activity_bookings', queryBookingId));
              if (actSnap.exists()) {
                const data = actSnap.data();
                resolvedHostId = data.hostId;
                resolvedHostName = data.hostName || 'Activity Operator';
                resolvedListingTitle = data.activityTitle || resolvedListingTitle;
                resolvedBookingRef = data.bookingRef || resolvedBookingRef;
                resolvedListingId = data.activityId || resolvedListingId;
              }
            }
          } catch (fetchErr) {
            console.warn('[Messages] Authoritative booking lookup note:', fetchErr);
          }
        }

        // Check if an existing conversation in state matches this host and listing/booking
        if (resolvedHostId && resolvedHostId !== user.uid) {
          const matchedExisting = conversationsRef.current.find((c) => {
            const hasBoth = c.participantIds.includes(user.uid) && c.participantIds.includes(resolvedHostId!);
            if (!hasBoth) return false;
            if (queryBookingId) return c.bookingId === queryBookingId;
            if (resolvedListingId) return c.listingId === resolvedListingId;
            return true;
          });

          if (matchedExisting) {
            handledDeepLinkRef.current = deepLinkKey;
            setSelectedConversationId(matchedExisting.id);
            setSearchParams({ conversationId: matchedExisting.id }, { replace: true });
            return;
          }

          const convId = await getOrCreateConversation({
            currentUserId: user.uid,
            currentUser: {
              displayName: user.displayName || 'Guest',
              email: user.email || undefined,
              photoURL: user.photoURL || undefined,
              role: (profile?.role as any) || 'guest'
            },
            otherUserId: resolvedHostId,
            otherUser: {
              displayName: resolvedHostName,
              role: 'host',
              isHostVerified: true
            },
            listingId: resolvedListingId || undefined,
            listingTitle: resolvedListingTitle,
            bookingId: queryBookingId || undefined,
            bookingRef: resolvedBookingRef || undefined
          });

          handledDeepLinkRef.current = deepLinkKey;
          setSelectedConversationId(convId);
          setSearchParams({ conversationId: convId }, { replace: true });
        }
      } catch (err) {
        console.error('[Messages] Deep link conversation creation error:', err);
      } finally {
        isHandlingDeepLinkRef.current = false;
      }
    }

    handleDeepLink();
  }, [user, queryConvId, queryHostId, queryListingId, queryListingTitle, queryHostName, queryBookingId, queryBookingRef, profile, setSearchParams]);

  // Set default selected conversation on desktop if none selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0 && window.innerWidth >= 768) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // 3. Subscribe to active conversation messages
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToConversationMessages(
      selectedConversationId,
      (msgs) => {
        setMessages(msgs);
        // Auto-scroll on new messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    );

    // Mark as read when opening conversation
    if (user) {
      markConversationAsRead(selectedConversationId, user.uid);
    }

    return () => unsubscribe();
  }, [selectedConversationId, user]);

  // Selected conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  // Other participant details
  const getOtherParticipant = (conv: Conversation) => {
    if (!user) return { name: conv.hostName, role: 'Host', isVerified: conv.isHostVerified, photo: conv.hostPhotoURL };
    const isCurrentUserGuest = conv.guestId === user.uid;
    if (isCurrentUserGuest) {
      return {
        name: conv.hostName || 'Host',
        role: 'Host',
        isVerified: conv.isHostVerified || false,
        photo: conv.hostPhotoURL,
        email: conv.hostEmail
      };
    } else {
      return {
        name: conv.guestName || 'Guest',
        role: 'Guest',
        isVerified: false,
        photo: conv.guestPhotoURL,
        email: conv.guestEmail
      };
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const other = getOtherParticipant(conv);
    const matchesSearch =
      other.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.listingTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.bookingRef || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.lastMessageText || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'unread') {
      const unread = user ? conv.unreadCount?.[user.uid] || 0 : 0;
      return unread > 0;
    }
    if (activeTab === 'stays') {
      return !conv.residenceType || conv.residenceType !== 'trip';
    }
    if (activeTab === 'activities') {
      return conv.residenceType === 'trip' || (conv.listingTitle || '').toLowerCase().includes('safari') || (conv.listingTitle || '').toLowerCase().includes('tour');
    }
    return true;
  });

  // Handle Send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedConversationId || !user || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const senderParticipant: ConversationParticipant = {
        uid: user.uid,
        displayName: user.displayName || 'MozBook Member',
        email: user.email || undefined,
        photoURL: user.photoURL || undefined,
        role: (profile?.role as any) || 'guest'
      };

      await sendMessage(selectedConversationId, senderParticipant, text);
      // Refocus input
      textareaRef.current?.focus();
    } catch (err) {
      console.error('[Messages] Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut: Enter sends message (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick reply prompt handler
  const handleInsertPrompt = (prompt: string) => {
    setInputText(prompt);
    textareaRef.current?.focus();
  };

  // Format relative time helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // 1. Unauthenticated Gate
  if (!authLoading && !user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center mx-auto shadow-inner">
            <MessageCircle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Sign In to Access Messages</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Connect directly with verified property hosts and tour operators across Mozambique.
              Discuss check-in times, ask about local conditions, and coordinate your bookings in real time.
            </p>
          </div>
          <button
            onClick={() => login()}
            className="w-full flex items-center justify-center gap-2 bg-[#009A60] hover:bg-[#008250] text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer text-sm"
          >
            <LogIn size={18} />
            <span>Sign In with Google</span>
          </button>
          <div className="pt-2 text-xs text-gray-400">
            End-to-end messaging is restricted to verified MozBook guests and host partners.
          </div>
        </div>
      </div>
    );
  }

  const otherParticipant = activeConversation ? getOtherParticipant(activeConversation) : null;
  const unreadTotal = user
    ? conversations.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] || 0), 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#e6f7f0] text-[#009A60] rounded-xl">
              <MessageCircle size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Messages
            </h1>
            {unreadTotal > 0 && (
              <span className="bg-[#009A60] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                {unreadTotal} new
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Direct guest–host messaging and trip coordination across Mozambique.
          </p>
        </div>
      </div>

      {/* Main Messaging Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px] max-h-[820px] h-[calc(100vh-14rem)]">
        {/* Left Column: Conversations List */}
        <div
          className={`md:col-span-5 lg:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50 ${
            selectedConversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search & Tabs Header */}
          <div className="p-3.5 border-b border-gray-200 bg-white space-y-3 shrink-0">
            {/* Search Box */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations, hosts, stays..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-100 hover:bg-gray-100/80 focus:bg-white border border-transparent focus:border-[#009A60] rounded-xl outline-none transition-all placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'stays', label: 'Stays' },
                  { id: 'activities', label: 'Trips' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#009A60] text-white font-bold shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                  <MessageCircle size={22} />
                </div>
                <p className="text-sm font-semibold text-gray-700">No conversations found</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  {searchQuery
                    ? 'No messages matched your search query.'
                    : 'Your incoming and outgoing messages with hosts and tour operators will appear here.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const isSelected = conv.id === selectedConversationId;
                const unread = user ? conv.unreadCount?.[user.uid] || 0 : 0;
                const isLastFromMe = user && conv.lastMessageSenderId === user.uid;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      setSearchParams({ conversationId: conv.id });
                    }}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-[#e6f7f0] border-l-4 border-[#009A60]'
                        : unread > 0
                        ? 'bg-white hover:bg-gray-50 border-l-4 border-emerald-400 font-semibold'
                        : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Participant Avatar */}
                    <div className="relative shrink-0">
                      {other.photo ? (
                        <img
                          src={other.photo}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover border border-gray-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#009A60] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                          {other.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Active green status dot */}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>

                    {/* Middle Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-sm truncate ${
                              unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
                            }`}
                          >
                            {other.name}
                          </span>
                          {other.isVerified && (
                            <ShieldCheck
                              size={14}
                              className="text-[#009A60] shrink-0"
                              title="ID Verified Host"
                            />
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {formatTime(conv.lastMessageTimestamp)}
                        </span>
                      </div>

                      {/* Listing Context Tag */}
                      {conv.listingTitle && (
                        <div className="text-[11px] text-[#008250] font-medium truncate flex items-center gap-1 mb-1">
                          <Home size={11} className="shrink-0" />
                          <span className="truncate">{conv.listingTitle}</span>
                        </div>
                      )}

                      {/* Last Message Preview */}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs truncate ${
                            unread > 0 ? 'font-bold text-gray-900' : 'text-gray-500'
                          }`}
                        >
                          {isLastFromMe && <span className="text-gray-400 font-normal">You: </span>}
                          {conv.lastMessageText || 'Conversation started'}
                        </p>

                        {unread > 0 && (
                          <span className="shrink-0 bg-[#009A60] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Chat Thread */}
        <div
          className={`md:col-span-7 lg:col-span-8 flex flex-col bg-white ${
            !selectedConversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation && otherParticipant ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(null);
                      setSearchParams({});
                    }}
                    className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Other Participant Avatar */}
                  <div className="relative shrink-0">
                    {otherParticipant.photo ? (
                      <img
                        src={otherParticipant.photo}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#009A60] text-white flex items-center justify-center font-bold text-sm">
                        {otherParticipant.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>

                  {/* Participant Name & Status */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {otherParticipant.name}
                      </h2>
                      {otherParticipant.isVerified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#009A60] bg-[#e6f7f0] px-2 py-0.5 rounded-full">
                          <ShieldCheck size={11} />
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {otherParticipant.role} · Active in Mozambique
                    </p>
                  </div>
                </div>

                {/* Right Context Action (View Listing or Booking) */}
                <div className="shrink-0 flex items-center gap-2">
                  {activeConversation.listingId && (
                    <Link
                      to={`/listing/${activeConversation.listingId}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#009A60] text-gray-700 hover:text-[#009A60] hover:bg-[#e6f7f0] transition-colors"
                    >
                      <ExternalLink size={12} />
                      <span className="hidden sm:inline">View Listing</span>
                    </Link>
                  )}
                  {activeConversation.bookingId && (
                    <Link
                      to={`/booking/${activeConversation.bookingId}/status`}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-[#009A60] hover:bg-emerald-100 transition-colors"
                    >
                      <span>Booking Pass</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Context Summary Banner */}
              {activeConversation.listingTitle && (
                <div className="px-4 py-2 bg-emerald-50/50 border-b border-emerald-100/60 flex items-center justify-between text-xs text-gray-700 shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-gray-900 truncate">
                      {activeConversation.listingTitle}
                    </span>
                    {activeConversation.listingCity && (
                      <span className="text-gray-500 hidden sm:inline">
                        · {activeConversation.listingCity}
                      </span>
                    )}
                    {activeConversation.bookingRef && (
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 text-[#008250] font-bold">
                        {activeConversation.bookingRef}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfcfb]">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-8">
                    <div className="max-w-xs space-y-2">
                      <div className="w-12 h-12 bg-emerald-100 text-[#009A60] rounded-full flex items-center justify-center mx-auto">
                        <Sparkles size={20} />
                      </div>
                      <p className="font-bold text-gray-800 text-sm">Start your conversation</p>
                      <p className="text-xs text-gray-500">
                        Ask about availability, verify check-in requirements, or coordinate arrival times.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isFromMe = user && msg.senderId === user.uid;
                    const showDateSeparator =
                      index === 0 ||
                      new Date(messages[index - 1].createdAt).toDateString() !==
                        new Date(msg.createdAt).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full">
                              {new Date(msg.createdAt).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex items-end gap-2 ${
                            isFromMe ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isFromMe && (
                            <div className="w-7 h-7 rounded-full bg-[#009A60] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mb-1">
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] sm:max-w-[70%] p-3.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                              isFromMe
                                ? 'bg-[#009A60] text-white rounded-2xl rounded-tr-xs'
                                : 'bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-tl-xs'
                            }`}
                          >
                            {!isFromMe && (
                              <p className="text-[10px] font-bold text-[#009A60] mb-1">
                                {msg.senderName}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isFromMe ? 'text-emerald-100' : 'text-gray-400'
                              }`}
                            >
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {isFromMe && (
                                <span>
                                  {msg.read ? (
                                    <CheckCheck size={13} className="text-white" />
                                  ) : (
                                    <Check size={13} className="text-emerald-200" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick: generic prompt pills removed to focus strictly on private communication */}

              {/* Message Composer Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 bg-white border-t border-gray-200 flex items-end gap-2 shrink-0"
              >
                <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#009A60] focus-within:bg-white transition-all px-3 py-2">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${otherParticipant.name}... (Press Enter to send, Shift+Enter for new line)`}
                    className="w-full bg-transparent resize-none outline-none text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className={`p-3 rounded-2xl font-semibold flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    inputText.trim() && !isSending
                      ? 'bg-[#009A60] hover:bg-[#008250] text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            /* Empty State when no conversation selected */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/40">
              <div className="w-16 h-16 rounded-3xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center mb-4 shadow-sm">
                <MessageCircle size={32} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Select a conversation
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-4 leading-relaxed">
                Choose any conversation from your bookings to message hosts, ask about amenities, or coordinate arrival details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
