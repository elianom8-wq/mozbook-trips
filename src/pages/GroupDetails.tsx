import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Users, 
  UserPlus, 
  LogOut, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Share2, 
  Clock, 
  UserX, 
  ArrowRightLeft,
  AlertTriangle,
  Compass,
  CreditCard,
  Luggage,
  Sparkles,
  Info,
  Phone,
  Smartphone,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  XCircle,
  CheckCircle2,
  ListFilter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { travelGroupService, calculateGroupStatus } from '../services/travelGroupService';
import { 
  TravelGroup, 
  GroupMember, 
  GroupInvitation, 
  CreateGroupDTO,
  GroupBookingLink,
  GroupItineraryItem,
  GroupParticipantType,
  ShareSettlementStatus,
  GroupCostAllocation
} from '../types/travelGroup';
import ContactPickerModal from '../components/ContactPickerModal';
import { ContactInfo } from '../services/permissionService';

export default function GroupDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<TravelGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupBookings, setGroupBookings] = useState<GroupBookingLink[]>([]);
  const [itineraryItems, setItineraryItems] = useState<GroupItineraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'bookings' | 'members'>('overview');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'stay' | 'activity' | 'trip'>('all');
  const [updatingParticipant, setUpdatingParticipant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<GroupInvitation | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<CreateGroupDTO>({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    description: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Mixed Participants & External Guest State (Prompt 28)
  const [activeBookingForGuest, setActiveBookingForGuest] = useState<string | null>(null);
  const [guestFormData, setGuestFormData] = useState<{
    displayName: string;
    email: string;
    guestType: GroupParticipantType;
    guestPhone: string;
    notes: string;
  }>({
    displayName: '',
    email: '',
    guestType: 'companion',
    guestPhone: '',
    notes: ''
  });
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const [guestError, setGuestError] = useState('');

  const currentUserId = user?.uid || 'guest_traveler';
  const currentUserEmail = user?.email || 'traveler@mozbook.mz';

  const loadGroupData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const g = await travelGroupService.getTravelGroup(id);
      if (!g) {
        setError('Travel group not found');
        return;
      }

      // Check membership: only group owner or active members are authorized to view private travel groups
      const m = await travelGroupService.getGroupMembers(id);
      const isOwnerCheck = g.ownerId === currentUserId;
      const isMemberCheck = m.some(
        member => (member.userId === currentUserId || (currentUserEmail && member.email?.toLowerCase() === currentUserEmail.toLowerCase())) && member.status === 'active'
      );

      if (!isOwnerCheck && !isMemberCheck) {
        setError('This is a private Travel Companion group. Only invited and accepted group members can view this workspace.');
        setGroup(null);
        setMembers([]);
        return;
      }

      setGroup(g);
      setEditFormData({
        name: g.name,
        destination: g.destination,
        startDate: g.startDate,
        endDate: g.endDate,
        description: g.description || '',
      });

      setMembers(m);

      // Fetch linked group bookings & unified itinerary
      try {
        const [bookings, itinerary] = await Promise.all([
          travelGroupService.getGroupBookings(id, currentUserId, currentUserEmail),
          travelGroupService.getGroupItinerary(id, currentUserId, currentUserEmail)
        ]);
        setGroupBookings(bookings);
        setItineraryItems(itinerary);
      } catch (bookingErr) {
        console.warn('Failed to fetch group bookings/itinerary:', bookingErr);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupData();
  }, [id, user]);

  const isOwner = group?.ownerId === currentUserId;
  const isMember = members.some(m => (m.userId === currentUserId || m.email === currentUserEmail) && m.status === 'active');
  const userRole = isOwner ? 'owner' : (isMember ? 'member' : 'guest');

  // Handle Participant Inclusion Toggle
  const handleToggleParticipant = async (bookingId: string, participantUserId: string, currentStatus: 'included' | 'opted_out') => {
    if (!group) return;
    const newStatus = currentStatus === 'included' ? 'opted_out' : 'included';
    setUpdatingParticipant(`${bookingId}_${participantUserId}`);
    try {
      await travelGroupService.updateParticipantStatus(group.id, bookingId, participantUserId, newStatus, currentUserId);
      const [bookings, itinerary] = await Promise.all([
        travelGroupService.getGroupBookings(group.id, currentUserId, currentUserEmail),
        travelGroupService.getGroupItinerary(group.id, currentUserId, currentUserEmail)
      ]);
      setGroupBookings(bookings);
      setItineraryItems(itinerary);
    } catch (err: any) {
      alert(err?.message || 'Failed to update participant status');
    } finally {
      setUpdatingParticipant(null);
    }
  };

  // Handle Unlink Booking from Group
  const handleUnlinkBooking = async (bookingId: string, bookingTitle: string) => {
    if (!group) return;
    if (!window.confirm(`Remove "${bookingTitle}" from the group workspace and shared itinerary?`)) return;
    try {
      await travelGroupService.unlinkBookingFromGroup(group.id, bookingId, currentUserId);
      const [bookings, itinerary] = await Promise.all([
        travelGroupService.getGroupBookings(group.id, currentUserId, currentUserEmail),
        travelGroupService.getGroupItinerary(group.id, currentUserId, currentUserEmail)
      ]);
      setGroupBookings(bookings);
      setItineraryItems(itinerary);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove booking from group');
    }
  };

  // Handle Add External Companion / Guest (Prompt 28)
  const handleAddExternalGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !activeBookingForGuest) return;
    if (!guestFormData.displayName.trim()) {
      setGuestError('Please enter companion full name.');
      return;
    }
    setSubmittingGuest(true);
    setGuestError('');
    try {
      await travelGroupService.addExternalGuestToBooking(
        group.id,
        activeBookingForGuest,
        guestFormData,
        currentUserId
      );
      const [bookings, itinerary] = await Promise.all([
        travelGroupService.getGroupBookings(group.id, currentUserId, currentUserEmail),
        travelGroupService.getGroupItinerary(group.id, currentUserId, currentUserEmail)
      ]);
      setGroupBookings(bookings);
      setItineraryItems(itinerary);
      setActiveBookingForGuest(null);
      setGuestFormData({ displayName: '', email: '', guestType: 'companion', guestPhone: '', notes: '' });
    } catch (err: any) {
      setGuestError(err?.message || 'Failed to add companion');
    } finally {
      setSubmittingGuest(false);
    }
  };

  // Handle Remove External Companion
  const handleRemoveExternalGuest = async (bookingId: string, guestUserId: string, guestName: string) => {
    if (!group) return;
    if (!window.confirm(`Remove companion "${guestName}" from this reservation roster?`)) return;
    try {
      await travelGroupService.removeExternalGuestFromBooking(group.id, bookingId, guestUserId, currentUserId);
      const [bookings, itinerary] = await Promise.all([
        travelGroupService.getGroupBookings(group.id, currentUserId, currentUserEmail),
        travelGroupService.getGroupItinerary(group.id, currentUserId, currentUserEmail)
      ]);
      setGroupBookings(bookings);
      setItineraryItems(itinerary);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove companion');
    }
  };

  // Handle Toggle Share Settlement (Prompt 28)
  const handleToggleShareSettlement = async (bookingId: string, participantUserId: string, currentStatus?: ShareSettlementStatus) => {
    if (!group) return;
    const nextStatus: ShareSettlementStatus = currentStatus === 'settled' ? 'pending' : 'settled';
    try {
      await travelGroupService.updateParticipantSettlement(group.id, bookingId, participantUserId, nextStatus, currentUserId);
      const [bookings, itinerary] = await Promise.all([
        travelGroupService.getGroupBookings(group.id, currentUserId, currentUserEmail),
        travelGroupService.getGroupItinerary(group.id, currentUserId, currentUserEmail)
      ]);
      setGroupBookings(bookings);
      setItineraryItems(itinerary);
    } catch (err: any) {
      alert(err?.message || 'Failed to update share settlement status');
    }
  };

  // Handle Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setInviteError('');
    setInviting(true);

    try {
      const inv = await travelGroupService.inviteMember(
        group.id,
        { uid: currentUserId, displayName: user?.displayName || 'Group Host' },
        inviteIdentifier
      );
      setInviteSuccess(inv);
      setInviteIdentifier('');
      // Reload members list to show invited user
      const m = await travelGroupService.getGroupMembers(group.id);
      setMembers(m);
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Handle Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setEditError('');
    setSavingEdit(true);

    try {
      const updated = await travelGroupService.updateTravelGroup(group.id, editFormData, currentUserId);
      setGroup(updated);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update group');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!group) return;
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;

    try {
      await travelGroupService.removeMember(group.id, memberUserId, currentUserId);
      const m = await travelGroupService.getGroupMembers(group.id);
      setMembers(m);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
    }
  };

  // Handle Transfer Ownership
  const handleTransferOwnership = async () => {
    if (!group || !selectedNewOwner) return;
    const targetMember = members.find(m => m.userId === selectedNewOwner);
    if (!targetMember) return;

    if (!window.confirm(`Transfer group ownership to ${targetMember.displayName}? You will become a regular member.`)) {
      return;
    }

    setTransferring(true);
    try {
      await travelGroupService.transferOwnership(group.id, selectedNewOwner, currentUserId);
      setShowTransferModal(false);
      await loadGroupData();
    } catch (err: any) {
      alert(err?.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  // Handle Leave Group
  const handleLeaveGroup = async () => {
    if (!group) return;
    setLeaving(true);
    try {
      await travelGroupService.leaveGroup(group.id, currentUserId);
      setShowLeaveModal(false);
      navigate('/travel-companion');
    } catch (err: any) {
      alert(err?.message || 'Failed to leave group');
      setLeaving(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/travel-companion/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatDateDisplay = (startStr: string, endStr: string) => {
    if (!startStr) return '';
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const sFormatted = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const eFormatted = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${sFormatted} – ${eFormatted}`;
    } catch {
      return `${startStr} to ${endStr}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">Loading travel group details...</p>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Group Unavailable</h2>
          <p className="text-sm text-slate-500 mb-6">{error || 'This travel group does not exist or has been removed.'}</p>
          <Link
            to="/travel-companion"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-xs hover:bg-emerald-700 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Travel Companion</span>
          </Link>
        </div>
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === 'active');
  const invitedMembers = members.filter(m => m.status === 'invited');
  const otherActiveMembers = activeMembers.filter(m => m.userId !== currentUserId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 pt-4">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/travel-companion"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>All Travel Groups</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowInviteModal(true);
                setInviteSuccess(null);
                setInviteError('');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Invite People</span>
            </button>

            {isOwner && (
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Edit Group"
              >
                <Edit3 size={14} />
                <span className="hidden sm:inline">Edit Group</span>
              </button>
            )}

            {isOwner && otherActiveMembers.length > 0 && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Transfer Ownership"
              >
                <ArrowRightLeft size={14} />
                <span className="hidden md:inline">Transfer Ownership</span>
              </button>
            )}

            <button
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Leave Group"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Leave Group</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Group Header Hero Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-100/40 via-teal-50/20 to-transparent pointer-events-none rounded-bl-full" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                {group.status === 'active' ? 'Active Trip' : group.status === 'upcoming' ? 'Upcoming' : 'Completed'}
              </span>

              {isOwner ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                  <ShieldCheck size={13} />
                  You are Group Owner
                </span>
              ) : isMember ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                  You are an Active Member
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {group.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-semibold text-slate-600 mt-3">
              <div className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                <MapPin size={16} />
                <span>{group.destination}</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Calendar size={16} className="text-slate-400" />
                <span>{formatDateDisplay(group.startDate, group.endDate)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Users size={16} className="text-slate-400" />
                <span>{activeMembers.length} active {activeMembers.length === 1 ? 'member' : 'members'}</span>
              </div>
            </div>

            {group.description && (
              <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-3xl bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                {group.description}
              </p>
            )}
          </div>
        </div>

        {/* Group Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles size={16} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('itinerary')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'itinerary'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar size={16} />
            <span>Group Itinerary</span>
            {itineraryItems.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                {itineraryItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Luggage size={16} />
            <span>Group Bookings</span>
            {groupBookings.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                {groupBookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'members'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            <span>Members ({activeMembers.length})</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Actions Card: Find Accommodation & Activities for Group */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Compass size={18} className="text-emerald-600" />
                      <span>Book For This Group</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Find stays and experiences in {group.destination} linked directly to {group.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <Link
                    to={`/?destination=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        <Luggage size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900">Find Stays & Lodges</h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Search beach villas and lodges in {group.destination} for your travel group.
                      </p>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <span>Explore Accommodations</span>
                      <span>→</span>
                    </div>
                  </Link>

                  <Link
                    to={`/trips?city=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                        <Compass size={18} />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900">MozBook Activities & Trips</h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Add island excursions, ocean safaris, and tours directly into your itinerary.
                      </p>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <span>Browse Activities</span>
                      <span>→</span>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Itinerary Preview */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar size={18} className="text-emerald-600" />
                      <span>Shared Itinerary Summary</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {itineraryItems.length === 0 ? 'No bookings added to this itinerary yet' : `${itineraryItems.length} planned group reservation${itineraryItems.length > 1 ? 's' : ''}`}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('itinerary')}
                    className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    View Timeline →
                  </button>
                </div>

                {itineraryItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 space-y-3">
                    <Calendar size={36} className="mx-auto text-slate-300" />
                    <p className="text-xs">
                      No activities or stays have been scheduled yet. Click <strong>Book For This Group</strong> above to add items to your shared itinerary.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itineraryItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            {item.bookingCategory === 'stay' ? <Luggage size={18} /> : <Compass size={18} />}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">{item.title}</span>
                            <div className="flex items-center gap-2 text-slate-500 mt-0.5">
                              <span>📅 {item.date}</span>
                              {item.time && <span>⏰ {item.time}</span>}
                              <span>👥 {item.participantsCount} participant{item.participantsCount === 1 ? '' : 's'}</span>
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          {item.bookingCategory}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members Preview */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users size={18} className="text-emerald-600" />
                    <span>Active Members ({activeMembers.length})</span>
                  </h2>

                  <button
                    onClick={() => setActiveTab('members')}
                    className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Manage Members →
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {activeMembers.map((m) => (
                    <div
                      key={m.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-[10px]">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span>{m.displayName}</span>
                      {m.role === 'owner' && (
                        <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">Host</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Group Highlights & Next Phase Notes */}
            <div className="space-y-6">
              {/* Cost Splitting Roadmap Notice */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CreditCard size={18} className="text-emerald-600" />
                  <span>Cost Splitting (Phase 2 Roadmap)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Individual participant inclusion and booking linkages are established. In Phase 2, group members can pay their split amounts directly through PaySuite (M-Pesa, E-Mola, Cards).
                </p>
                <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-100">
                  ✓ Group-to-booking relational link active<br />
                  ✓ Individual participation toggling active<br />
                  ✓ Unified chronological itinerary active
                </div>
              </div>

              {/* Share Group Invitation */}
              <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-sm space-y-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Share2 size={18} className="text-emerald-300" />
                  <span>Invite Companions</span>
                </h3>
                <p className="text-xs text-emerald-200 leading-relaxed">
                  Generate private tokens to invite travel companions into this workspace.
                </p>
                <button
                  onClick={() => {
                    setShowInviteModal(true);
                    setInviteSuccess(null);
                  }}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Generate Invitation Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UNIFIED GROUP ITINERARY */}
        {activeTab === 'itinerary' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={20} className="text-emerald-600" />
                  <span>Chronological Group Itinerary</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordered timeline of all stays and activities connected to this trip
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/?destination=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
                >
                  + Add Stay
                </Link>
                <Link
                  to={`/trips?city=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors"
                >
                  + Add Activity
                </Link>
              </div>
            </div>

            {itineraryItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Calendar size={48} className="mx-auto text-slate-300" />
                <h3 className="font-bold text-slate-700 text-sm">No Itinerary Items Yet</h3>
                <p className="text-xs max-w-sm mx-auto">
                  When you or other group members reserve stays or activities with this group ID, they automatically appear on this timeline.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-emerald-200 ml-4 pl-6 space-y-8 my-4">
                {itineraryItems.map((item) => {
                  const includedParticipants = item.participants.filter(p => p.status === 'included');

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white shadow-xs" />

                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                              {item.bookingCategory}
                            </span>
                            <h3 className="font-bold text-base text-slate-900">{item.title}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                              <span>📅 {item.date} {item.endDate ? `to ${item.endDate}` : ''}</span>
                              {item.time && <span>⏰ {item.time}</span>}
                              {item.city && <span>📍 {item.city}</span>}
                              {item.bookingRef && <span className="font-mono text-slate-400">Ref: {item.bookingRef}</span>}
                            </div>
                          </div>

                          {item.totalAmount && (
                            <div className="text-right">
                              <span className="text-xs text-slate-400 block">Total</span>
                              <span className="font-extrabold text-sm text-slate-900">
                                MZN {item.totalAmount.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Participants for this itinerary item */}
                        <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">
                              Participating ({includedParticipants.length}/{item.participants.length || activeMembers.length}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {includedParticipants.map(p => (
                                <span
                                  key={p.userId}
                                  className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                                >
                                  {p.displayName}
                                </span>
                              ))}
                            </div>
                          </div>

                          {item.bookingId && (
                            <Link
                              to={`/booking/${item.bookingId}/status?ref=${encodeURIComponent(item.bookingRef || '')}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                            >
                              <span>View Booking</span>
                              <ExternalLink size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GROUP BOOKINGS & PARTICIPANT ARCHITECTURE */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Luggage size={20} className="text-emerald-600" />
                  <span>Group Bookings & Participant Inclusion</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage which group members are participating in each reservation
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                {(['all', 'stay', 'activity', 'trip'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setBookingFilter(cat)}
                    className={`px-3 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                      bookingFilter === cat ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List of bookings */}
            {groupBookings.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Luggage size={48} className="mx-auto text-slate-300" />
                <h3 className="font-bold text-slate-700 text-sm">No Bookings Linked</h3>
                <p className="text-xs max-w-sm mx-auto">
                  When you book a stay or activity with this group ID, it will appear here with participant controls.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link
                    to={`/?destination=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                  >
                    Search Accommodation
                  </Link>
                  <Link
                    to={`/trips?city=${encodeURIComponent(group.destination.split(',')[0].trim())}&groupId=${group.id}`}
                    className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Search Activities
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groupBookings
                  .filter(b => bookingFilter === 'all' || b.bookingCategory === bookingFilter)
                  .map((booking) => {
                    const participants = booking.participants || [];
                    const includedList = participants.filter(p => p.status === 'included');

                    return (
                      <div
                        key={booking.id}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                                {booking.bookingCategory}
                              </span>
                              <span className="font-mono text-xs text-slate-500">
                                {booking.bookingRef}
                              </span>
                            </div>
                            <h3 className="font-bold text-base text-slate-900">{booking.title}</h3>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                              <span>📅 {booking.dateOrStartDate} {booking.endDate ? `to ${booking.endDate}` : ''}</span>
                              {booking.time && <span>⏰ {booking.time}</span>}
                              {booking.city && <span>📍 {booking.city}</span>}
                              {booking.createdByName && <span>Booked by: {booking.createdByName}</span>}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-400 block">Total Cost</span>
                            <span className="font-extrabold text-base text-slate-900">
                              MZN {booking.totalAmount.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1.5 justify-end mt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {booking.status}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                {booking.paymentStatus}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Fair-Share Cost Allocation & Participant Architecture (Prompt 28) */}
                        {(() => {
                          const externalGuests = participants.filter(p => p.isExternalGuest);
                          const memberParticipants = activeMembers;
                          const includedCount = Math.max(1, includedList.length);
                          const fairShareMzn = Math.round(booking.totalAmount / includedCount);
                          const settledCount = includedList.filter(p => p.shareSettlementStatus === 'settled').length;

                          return (
                            <div className="pt-4 border-t border-slate-200 space-y-4">
                              {/* Cost Allocation Summary Card */}
                              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100/90 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                                      <CreditCard size={16} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                                        Fair-Share Cost Allocation
                                      </h4>
                                      <p className="text-[11px] text-emerald-800">
                                        Single Payer: <span className="font-bold">{booking.createdByName || 'Lead Traveler'}</span> via PaySuite
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200 text-emerald-950">
                                      MZN {fairShareMzn.toLocaleString()} / person
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-emerald-200">
                                      {settledCount}/{includedList.length} Settled
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1">
                                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] text-slate-500 block">Total Booking</span>
                                    <span className="font-bold text-slate-900">MZN {booking.totalAmount.toLocaleString()}</span>
                                  </div>
                                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] text-slate-500 block">Active Travelers</span>
                                    <span className="font-bold text-slate-900">{includedList.length} total</span>
                                  </div>
                                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] text-slate-500 block">Group Members</span>
                                    <span className="font-bold text-slate-900">{includedList.filter(p => !p.isExternalGuest).length}</span>
                                  </div>
                                  <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] text-slate-500 block">Companions / Guests</span>
                                    <span className="font-bold text-slate-900">{externalGuests.length}</span>
                                  </div>
                                </div>

                                <p className="text-[10px] text-emerald-800/80 leading-normal">
                                  ℹ️ <strong>MozBook Single-Payer Principle:</strong> The booking was processed as a single transaction through PaySuite. This internal workspace ledger calculates fair shares and tracks who has settled their portion with the booker.
                                </p>
                              </div>

                              {/* Participant Roster Header & Actions */}
                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Users size={14} className="text-emerald-600" />
                                    <span>Traveler Roster ({includedList.length} Included)</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 block sm:inline sm:ml-1">
                                    Toggle inclusion or mark share settlement
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    setActiveBookingForGuest(booking.bookingId);
                                    setGuestFormData({ displayName: '', email: '', guestType: 'companion', guestPhone: '', notes: '' });
                                    setGuestError('');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                                >
                                  <Plus size={13} />
                                  <span>+ Add Companion / Guest</span>
                                </button>
                              </div>

                              {/* Active Group Members Section */}
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Registered Group Members
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {activeMembers.map((member) => {
                                    const existingP = participants.find(p => p.userId === member.userId);
                                    const isIncluded = existingP ? existingP.status === 'included' : true;
                                    const isSelf = member.userId === currentUserId;
                                    const canModify = isOwner || isSelf;
                                    const isToggling = updatingParticipant === `${booking.bookingId}_${member.userId}`;
                                    const settlement = existingP?.shareSettlementStatus || (member.userId === booking.createdByUserId ? 'settled' : 'pending');

                                    return (
                                      <div
                                        key={member.userId}
                                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                                          isIncluded
                                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                            : 'bg-slate-100/70 border-slate-200 text-slate-500 opacity-70'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="flex items-center gap-2 truncate pr-1">
                                            <div className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                                              isIncluded ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                              {member.displayName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold truncate">
                                              {member.displayName} {isSelf && '(You)'}
                                            </span>
                                          </div>

                                          {canModify ? (
                                            <button
                                              disabled={isToggling}
                                              onClick={() => handleToggleParticipant(booking.bookingId, member.userId, isIncluded ? 'included' : 'opted_out')}
                                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0 ${
                                                isIncluded
                                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                              }`}
                                            >
                                              {isToggling ? '...' : isIncluded ? 'Included' : 'Opted Out'}
                                            </button>
                                          ) : (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                              isIncluded ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                              {isIncluded ? 'Included' : 'Opted Out'}
                                            </span>
                                          )}
                                        </div>

                                        {isIncluded && (
                                          <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-[11px]">
                                            <span className="font-semibold text-emerald-900">
                                              Share: MZN {fairShareMzn.toLocaleString()}
                                            </span>
                                            {(isOwner || booking.createdByUserId === currentUserId) ? (
                                              <button
                                                onClick={() => handleToggleShareSettlement(booking.bookingId, member.userId, settlement)}
                                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer transition-colors ${
                                                  settlement === 'settled'
                                                    ? 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300'
                                                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                                }`}
                                                title="Click to toggle settlement status"
                                              >
                                                {settlement === 'settled' ? '✓ Settled' : '⏳ Pending'}
                                              </button>
                                            ) : (
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                settlement === 'settled' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-900'
                                              }`}>
                                                {settlement === 'settled' ? 'Settled' : 'Pending'}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* External Companions / Non-Group Guests Section */}
                              {externalGuests.length > 0 && (
                                <div className="space-y-2 pt-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <span>Non-Group Companions & External Guests</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                                      {externalGuests.length}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {externalGuests.map((guest) => {
                                      const isIncluded = guest.status === 'included';
                                      const settlement = guest.shareSettlementStatus || 'pending';

                                      return (
                                        <div
                                          key={guest.userId}
                                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                                            isIncluded
                                              ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                                              : 'bg-slate-100/70 border-slate-200 text-slate-500 opacity-70'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-2 truncate pr-1">
                                              <div className="w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 bg-teal-200 text-teal-900">
                                                {guest.displayName.charAt(0).toUpperCase()}
                                              </div>
                                              <div className="truncate">
                                                <span className="font-semibold truncate block">
                                                  {guest.displayName}
                                                </span>
                                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-teal-700 bg-teal-100/80 px-1 py-0.2 rounded">
                                                  {guest.guestType || 'Companion'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <button
                                                onClick={() => handleToggleParticipant(booking.bookingId, guest.userId, isIncluded ? 'included' : 'opted_out')}
                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                                  isIncluded
                                                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                }`}
                                              >
                                                {isIncluded ? 'Included' : 'Opted Out'}
                                              </button>

                                              {(isOwner || booking.createdByUserId === currentUserId) && (
                                                <button
                                                  onClick={() => handleRemoveExternalGuest(booking.bookingId, guest.userId, guest.displayName)}
                                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                  title="Remove companion"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {isIncluded && (
                                            <div className="flex items-center justify-between pt-1 border-t border-teal-100 text-[11px]">
                                              <span className="font-semibold text-teal-900">
                                                Share: MZN {fairShareMzn.toLocaleString()}
                                              </span>
                                              {(isOwner || booking.createdByUserId === currentUserId) ? (
                                                <button
                                                  onClick={() => handleToggleShareSettlement(booking.bookingId, guest.userId, settlement)}
                                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer transition-colors ${
                                                    settlement === 'settled'
                                                      ? 'bg-emerald-200 text-emerald-900 hover:bg-emerald-300'
                                                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                                  }`}
                                                  title="Click to toggle settlement status"
                                                >
                                                  {settlement === 'settled' ? '✓ Settled' : '⏳ Pending'}
                                                </button>
                                              ) : (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                  settlement === 'settled' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-100 text-amber-900'
                                                }`}>
                                                  {settlement === 'settled' ? 'Settled' : 'Pending'}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Booking Footer Actions */}
                        <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <Link
                            to={`/booking/${booking.bookingId}/status?ref=${encodeURIComponent(booking.bookingRef)}`}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                          >
                            <span>Open Booking Pass</span>
                            <ExternalLink size={12} />
                          </Link>

                          {isOwner && (
                            <button
                              onClick={() => handleUnlinkBooking(booking.bookingId, booking.title)}
                              className="text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                            >
                              Remove from Group
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEMBERS */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Active Members Section */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Users size={20} className="text-emerald-600" />
                      <span>Group Members ({activeMembers.length})</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      People traveling together and participating in this trip
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowInviteModal(true);
                      setInviteSuccess(null);
                      setInviteError('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>+ Invite</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {activeMembers.map((member) => {
                    const isCurrent = member.userId === currentUserId || member.email === currentUserEmail;
                    const isMemberOwner = member.role === 'owner';

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">
                                {member.displayName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 block">
                              {member.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isMemberOwner ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300/40">
                              <ShieldCheck size={12} />
                              Owner
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              Member
                            </span>
                          )}

                          {/* Owner can remove regular members */}
                          {isOwner && !isMemberOwner && (
                            <button
                              onClick={() => handleRemoveMember(member.userId, member.displayName)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove Member"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Invited Members (Pending Acceptance) */}
                {invitedMembers.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-500" />
                      <span>Pending Invitations ({invitedMembers.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {invitedMembers.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-200/50 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                              {inv.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">{inv.displayName}</span>
                              <span className="text-[11px] text-slate-500 block">{inv.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Invited
                            </span>

                            {isOwner && (
                              <button
                                onClick={() => handleRemoveMember(inv.userId, inv.displayName)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Cancel Invitation"
                              >
                                <UserX size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Share Link Card */}
            <div className="space-y-6">
              <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Share2 size={18} className="text-emerald-300" />
                    <span>Shareable Group Invitation</span>
                  </h3>
                  <p className="text-xs text-emerald-200/90 mt-1">
                    Invite friends to join this travel group directly via secure token preview link.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowInviteModal(true);
                    setInviteSuccess(null);
                  }}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Generate Link & Invite
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <UserPlus size={18} />
                <span>Invite to {group.name}</span>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {inviteError}
              </div>
            )}

            {inviteSuccess ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-sm mb-1 text-emerald-800">
                    <Check size={16} />
                    <span>Invitation Created!</span>
                  </div>
                  <p>
                    Invited <strong>{inviteSuccess.inviteeIdentifier}</strong>. They will see this under Pending Invitations when visiting MozBook.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Direct Invitation Token Link:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/travel-companion/invite/${inviteSuccess.token}`}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-600 focus:outline-none select-all"
                    />
                    <button
                      onClick={() => copyInviteLink(inviteSuccess.token)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setInviteSuccess(null);
                      setShowInviteModal(false);
                    }}
                    className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Fast Action: Invite from Device Contacts */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200 text-[#009A60] flex items-center justify-center shrink-0">
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">Invite from Device Contacts</h4>
                      <p className="text-[11px] text-emerald-800">
                        Select a companion directly from your address book
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowContactPicker(true)}
                    className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Smartphone size={13} />
                    <span>Open Contacts</span>
                  </button>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Or Enter Manually
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email, Phone or Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. maria@example.com or +258 84 123 4567"
                      value={inviteIdentifier}
                      onChange={(e) => setInviteIdentifier(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                    />
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Your companion will receive an invitation on MozBook to join this trip.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={inviting}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
                    >
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT GROUP MODAL (Owner only) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Group Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.destination}
                  onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.endDate}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER OWNERSHIP MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Transfer Group Ownership</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select an active group member to become the new Group Owner. After transfer, you will become a regular member.
            </p>

            <div className="space-y-2 mb-5">
              {otherActiveMembers.map((m) => (
                <label
                  key={m.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedNewOwner === m.userId 
                      ? 'border-emerald-500 bg-emerald-50/50' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="newOwner"
                      value={m.userId}
                      checked={selectedNewOwner === m.userId}
                      onChange={() => setSelectedNewOwner(m.userId)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{m.displayName}</span>
                      <span className="text-[11px] text-slate-500">{m.email}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnership}
                disabled={!selectedNewOwner || transferring}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
              >
                {transferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE GROUP MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Leave Travel Group</h3>

            {isOwner && otherActiveMembers.length > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs mb-4">
                <AlertTriangle size={18} className="text-amber-600 mb-1" />
                <p className="font-bold mb-1">Owner Action Required</p>
                <p>
                  As the Group Owner, you cannot leave the group until you transfer ownership to another active member.
                </p>
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    setShowTransferModal(true);
                  }}
                  className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  Transfer Ownership First
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Are you sure you want to leave <strong>{group.name}</strong>? Your participation status will change to "Left".
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              {(!isOwner || otherActiveMembers.length === 0) && (
                <button
                  onClick={handleLeaveGroup}
                  disabled={leaving}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                >
                  {leaving ? 'Leaving...' : 'Yes, Leave Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ADD EXTERNAL COMPANION / GUEST MODAL (Prompt 28) */}
      {activeBookingForGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Companion / Guest</h3>
                  <p className="text-[11px] text-slate-500">Include a non-group member in this booking roster</p>
                </div>
              </div>
              <button
                onClick={() => setActiveBookingForGuest(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {guestError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {guestError}
              </div>
            )}

            <form onSubmit={handleAddExternalGuestSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Silva"
                  value={guestFormData.displayName}
                  onChange={(e) => setGuestFormData({ ...guestFormData, displayName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Companion Type
                  </label>
                  <select
                    value={guestFormData.guestType}
                    onChange={(e) => setGuestFormData({ ...guestFormData, guestType: e.target.value as GroupParticipantType })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="companion">Travel Companion</option>
                    <option value="external_adult">Adult Guest</option>
                    <option value="external_child">Child Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+258 84..."
                    value={guestFormData.guestPhone}
                    onChange={(e) => setGuestFormData({ ...guestFormData, guestPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="companion@example.com"
                  value={guestFormData.email}
                  onChange={(e) => setGuestFormData({ ...guestFormData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vegetarian meal, child seat requested"
                  value={guestFormData.notes}
                  onChange={(e) => setGuestFormData({ ...guestFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveBookingForGuest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGuest}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingGuest ? 'Adding...' : 'Add to Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTACT PICKER MODAL */}
      {showContactPicker && (
        <ContactPickerModal
          isOpen={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          groupId={group.id}
          groupName={group.name}
          invitationToken={inviteSuccess?.token}
          onSelectContact={(contact: ContactInfo) => {
            const identifier = contact.email || contact.tel || contact.name || '';
            setInviteIdentifier(identifier);
            setShowContactPicker(false);
            setShowInviteModal(true);
          }}
        />
      )}
    </div>
  );
}
