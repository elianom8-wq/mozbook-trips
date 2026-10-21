import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  Check, 
  X, 
  Clock, 
  Sparkles, 
  UserCheck, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { travelGroupService } from '../services/travelGroupService';
import { TravelGroup, GroupInvitation, CreateGroupDTO, TravelGroupStatus } from '../types/travelGroup';
import ContactPickerModal from '../components/ContactPickerModal';
import { ContactInfo } from '../services/permissionService';

export default function TravelCompanion() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Redirect legacy /travel-companion?invitation=<token> to dedicated invitation experience
  const invitationParam = searchParams.get('invitation') || searchParams.get('token');
  useEffect(() => {
    if (invitationParam) {
      navigate(`/travel-companion/invite/${invitationParam}`, { replace: true });
    }
  }, [invitationParam, navigate]);

  const [groups, setGroups] = useState<TravelGroup[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'active' | 'past'>('all');
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  
  const [formData, setFormData] = useState<CreateGroupDTO>({
    name: '',
    destination: 'Tofo',
    startDate: '',
    endDate: '',
    description: '',
  });

  const popularDestinations = [
    'Tofo, Inhambane',
    'Vilankulo & Bazaruto',
    'Ponta do Ouro',
    'Maputo City & Catembe',
    'Gorongosa National Park',
    'Bilene Lagoon',
    'Pemba & Quirimbas',
    'Santa Maria & Inhaca',
  ];

  const loadData = async () => {
    if (!user) {
      setGroups([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [userGroups, userInvs] = await Promise.all([
        travelGroupService.getUserGroups(user.uid, user.email || ''),
        travelGroupService.getUserPendingInvitations(user.uid, user.email || '')
      ]);
      setGroups(userGroups);
      setInvitations(userInvs);
    } catch (err) {
      console.error('Error loading travel companion data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!formData.name.trim()) {
      setCreateError('Please give your travel group a name (e.g. "Tofo Weekend")');
      return;
    }
    if (!formData.destination.trim()) {
      setCreateError('Please specify a destination');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setCreateError('Please provide both travel start and end dates');
      return;
    }
    if (!user) {
      setCreateError('Please sign in to create a private travel group.');
      return;
    }

    setSubmitting(true);
    try {
      const newGroup = await travelGroupService.createTravelGroup(
        {
          uid: user.uid,
          displayName: user.displayName || 'Group Organizer',
          email: user.email || '',
          photoURL: user.photoURL || undefined
        },
        formData
      );

      setShowCreateModal(false);
      setFormData({
        name: '',
        destination: 'Tofo',
        startDate: '',
        endDate: '',
        description: '',
      });

      // Navigate straight into the new group
      navigate(`/travel-companion/group/${newGroup.id}`);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create travel group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvitation = async (invitation: GroupInvitation) => {
    if (!user) return;
    try {
      await travelGroupService.acceptInvitation(invitation.id, {
        uid: user.uid,
        displayName: user.displayName || 'Traveler',
        email: user.email || '',
        photoURL: user.photoURL || undefined
      });
      await loadData();
      navigate(`/travel-companion/group/${invitation.groupId}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to decline this invitation?')) return;
    try {
      await travelGroupService.declineInvitation(invitationId, { uid: user.uid });
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to decline invitation');
    }
  };

  // Filter groups according to tabs
  const filteredGroups = groups.filter((g) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') return g.status === 'upcoming';
    if (activeTab === 'active') return g.status === 'active';
    if (activeTab === 'past') return g.status === 'completed' || g.status === 'archived';
    return true;
  });

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 pt-4">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white py-12 md:py-16 px-4 sm:px-6 lg:px-8 border-b border-emerald-800/40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3 backdrop-blur-sm border border-emerald-400/20">
              <Users size={14} />
              <span>MozBook Travel Companion</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2">
              Travel Companion
            </h1>
            <p className="text-emerald-100/90 text-base md:text-lg max-w-2xl font-light">
              Travel together, plan together, and share the cost.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm md:text-base shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Create a Travel Group</span>
            </button>
            <button
              onClick={() => {
                setTargetGroupId(groups[0]?.id);
                setShowContactsModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm md:text-base border border-white/20 transition-all cursor-pointer backdrop-blur-sm"
            >
              <Users size={18} />
              <span>Invite from Contacts</span>
            </button>
            {!user && (
              <button
                onClick={login}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/20 transition-all"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-10">
        {/* Pending Invitations Section */}
        {invitations.length > 0 && (
          <section className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-amber-900 font-bold text-base md:text-lg">
              <Clock className="text-amber-600" size={20} />
              <span>Pending Invitations ({invitations.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitations.map((inv) => (
                <div 
                  key={inv.id}
                  className="bg-white rounded-xl p-4 border border-amber-200/60 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-amber-800 font-medium mb-1">
                      <span>Invited by <strong className="text-slate-900">{inv.inviterName}</strong></span>
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                        Awaiting Response
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {inv.groupName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-emerald-600" />
                        {inv.groupDestination}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} className="text-slate-500" />
                        {formatDateDisplay(inv.groupStartDate, inv.groupEndDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleAcceptInvitation(inv)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      <Check size={14} strokeWidth={2.5} />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(inv.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <X size={14} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Groups Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="text-emerald-600" size={24} />
                <span>My Travel Groups</span>
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Organize trips, invite fellow travelers, and share Mozambique experiences
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'all' 
                    ? 'bg-white text-emerald-800 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({groups.length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'upcoming' 
                    ? 'bg-white text-emerald-800 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'active' 
                    ? 'bg-white text-emerald-800 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'past' 
                    ? 'bg-white text-emerald-800 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Past
              </button>
            </div>
          </div>

          {/* Groups Grid / Empty State */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading your travel groups...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 md:p-14 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Users size={32} />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-1">
                No travel groups found
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Create a travel group to invite friends, organize shared accommodation, and add MozBook trips.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Create a Travel Group</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGroups.map((group) => {
                const isOwner = Boolean(user && group.ownerId === user.uid);
                const statusBadge = 
                  group.status === 'active' 
                    ? { bg: 'bg-emerald-100 text-emerald-800', label: 'Active Trip' }
                    : group.status === 'upcoming'
                    ? { bg: 'bg-blue-100 text-blue-800', label: 'Upcoming' }
                    : { bg: 'bg-slate-100 text-slate-700', label: 'Completed' };

                return (
                  <Link
                    key={group.id}
                    to={`/travel-companion/group/${group.id}`}
                    className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight uppercase ${statusBadge.bg}`}>
                          {statusBadge.label}
                        </span>

                        {isOwner ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                            <ShieldCheck size={12} />
                            Owner
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Member
                          </span>
                        )}
                      </div>

                      {/* Title & Destination */}
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {group.name}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mt-1.5">
                        <MapPin size={14} className="shrink-0" />
                        <span>{group.destination}</span>
                      </div>

                      {/* Travel Dates */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <Calendar size={13} className="shrink-0 text-slate-400" />
                        <span>{formatDateDisplay(group.startDate, group.endDate)}</span>
                      </div>

                      {/* Description Preview */}
                      {group.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 mt-3 pt-3 border-t border-slate-100">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata */}
                    <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
                      <div className="inline-flex items-center gap-1.5 text-slate-700">
                        <Users size={14} className="text-emerald-600" />
                        <span>{group.membersCount || 1} {group.membersCount === 1 ? 'member' : 'members'}</span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-emerald-600 group-hover:translate-x-0.5 transition-transform font-bold">
                        <span>Open</span>
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Informative Value Props */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">1. Create Group</h4>
              <p className="text-xs text-slate-500 mt-1">
                Name your trip, select your Mozambique destination, and set departure dates.
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-sm">2. Invite Friends</h4>
              <p className="text-xs text-slate-500 mt-1">
                Send invites via contact picker, phone, email, or secure tokens.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTargetGroupId(groups[0]?.id);
                  setShowContactsModal(true);
                }}
                className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Invite from Contacts</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">3. Travel Together</h4>
              <p className="text-xs text-slate-500 mt-1">
                Coordinate itinerary and split bookings seamlessly across members.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* CREATE TRAVEL GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Create a Travel Group</h3>
                <p className="text-xs text-slate-500 mt-0.5">Plan and share your upcoming Mozambique adventure</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tofo Weekend, Bazaruto Island Expedition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Destination *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tofo, Ponta do Ouro, Vilankulo"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm mb-2"
                />
                
                {/* Popular Quick Select */}
                <div className="flex flex-wrap gap-1.5">
                  {popularDestinations.slice(0, 4).map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setFormData({ ...formData, destination: dest })}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        formData.destination === dest 
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {dest}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Share trip highlights, planned dives, accommodation vibe, or instructions for friends..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-start gap-2">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>You will automatically become the <strong>Group Owner</strong> with full control over invitations and settings.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Creating Group...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CONTACT PICKER MODAL */}
      {showContactsModal && (
        <ContactPickerModal
          isOpen={showContactsModal}
          onClose={() => setShowContactsModal(false)}
          groupId={targetGroupId || groups[0]?.id}
          groupName={groups.find((g) => g.id === (targetGroupId || groups[0]?.id))?.name}
          onSelectContact={(_contact) => {
            setShowContactsModal(false);
            const gid = targetGroupId || groups[0]?.id;
            if (gid) {
              navigate(`/travel-companion/group/${gid}`);
            }
          }}
        />
      )}
    </div>
  );
}
