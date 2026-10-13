import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Check, 
  X, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  LogIn, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { travelGroupService } from '../services/travelGroupService';
import { EnrichedInvitation } from '../types/travelGroup';

export default function TravelGroupInvitationPage() {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();

  // Support token from route param or query params (?invitation= or ?token=)
  const queryToken = searchParams.get('invitation') || searchParams.get('token');
  const token = routeToken || queryToken || sessionStorage.getItem('mozbook_pending_invitation_token') || '';

  const [loading, setLoading] = useState(true);
  const [invitationData, setInvitationData] = useState<EnrichedInvitation | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Store token in session storage so it survives auth flows
  useEffect(() => {
    if (token) {
      sessionStorage.setItem('mozbook_pending_invitation_token', token);
    }
  }, [token]);

  // Load invitation & check membership
  const loadInvitation = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setActionError(null);

    try {
      const enriched = await travelGroupService.getInvitationByToken(token);
      setInvitationData(enriched);

      if (enriched && user && enriched.invitation.groupId) {
        const memberStatus = await travelGroupService.isUserGroupMember(
          enriched.invitation.groupId,
          user.uid,
          user.email
        );
        setIsMember(memberStatus);
      }
    } catch (err: any) {
      console.error('Failed to load invitation:', err);
      setActionError(err?.message || 'Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitation();
  }, [token, user?.uid]);

  const handleSignInAndAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await login();
      // Auth state listener in useAuth will update user, and useEffect will re-check
    } catch (err: any) {
      setActionError(err?.message || 'Google sign-in was cancelled or failed.');
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !user) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const result = await travelGroupService.acceptInvitationByToken(token, {
        uid: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Travel Member',
        email: user.email || undefined,
        photoURL: user.photoURL || undefined
      });

      sessionStorage.removeItem('mozbook_pending_invitation_token');
      setActionSuccess(`Welcome to ${result.groupName}!`);

      setTimeout(() => {
        navigate(`/travel-companion/group/${result.groupId}`);
      }, 1200);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to accept invitation');
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to decline this invitation?')) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await travelGroupService.declineInvitationByToken(token, { uid: user?.uid || '' });
      sessionStorage.removeItem('mozbook_pending_invitation_token');
      setActionSuccess('You have declined this travel group invitation.');
      await loadInvitation();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to decline invitation');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateRange = (startStr?: string, endStr?: string) => {
    if (!startStr) return '';
    try {
      const s = new Date(startStr);
      const sFormatted = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      if (!endStr) return sFormatted;
      const e = new Date(endStr);
      const eFormatted = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${sFormatted} – ${eFormatted}`;
    } catch {
      return `${startStr} to ${endStr || ''}`;
    }
  };

  const calculateDays = (startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return null;
    try {
      const diff = new Date(endStr).getTime() - new Date(startStr).getTime();
      const days = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
      return days > 0 ? `${days} days` : null;
    } catch {
      return null;
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-300">Validating travel group invitation...</p>
        </div>
      </div>
    );
  }

  // 2. Missing Token / Invalid URL
  if (!token || !invitationData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-black mb-2">Invitation Not Found</h2>
          <p className="text-sm text-slate-300 mb-6">
            This invitation link is invalid, incomplete, or may have expired. Please verify the URL or ask the group organizer to resend the invite.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/travel-companion"
              className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all text-center"
            >
              Go to Travel Companion
            </Link>
            <Link
              to="/"
              className="px-6 py-3 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-sm transition-all text-center"
            >
              Browse MozBook
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { invitation, group, isValid, statusReason } = invitationData;
  const daysText = calculateDays(invitation.groupStartDate, invitation.groupEndDate);
  const formattedDates = formatDateRange(invitation.groupStartDate, invitation.groupEndDate);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl w-full">
        {/* MozBook Brand Pill */}
        <div className="text-center mb-6">
          <Link
            to="/travel-companion"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide uppercase hover:bg-emerald-500/20 transition-colors"
          >
            <Users size={14} />
            <span>MozBook Travel Companion</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl transition-all">
          
          {/* Card Header Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 sm:p-8 border-b border-emerald-800/30 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3 backdrop-blur-md">
                Group Trip Invitation
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                {invitation.groupName}
              </h1>
              <p className="text-sm sm:text-base text-emerald-100/90 max-w-md mx-auto">
                Invited by <strong className="text-white font-bold">{invitation.inviterName}</strong>
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Action/Success Notification */}
            {actionSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm flex items-center gap-3">
                <Check className="shrink-0 text-emerald-400" size={20} />
                <span className="font-semibold">{actionSuccess}</span>
              </div>
            )}

            {/* Error Notification */}
            {actionError && (
              <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm flex items-center gap-3">
                <AlertCircle className="shrink-0 text-red-400" size={20} />
                <span>{actionError}</span>
              </div>
            )}

            {/* Trip Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Destination
                  </span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {invitation.groupDestination}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-700/60 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Travel Dates
                  </span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {formattedDates || 'Dates to be decided'}
                  </span>
                  {daysText && (
                    <span className="text-[11px] text-teal-300 font-medium">
                      ({daysText})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Group Description (if available) */}
            {group?.description && (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-700/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  <Info size={14} className="text-emerald-400" />
                  <span>About This Trip</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {group.description}
                </p>
              </div>
            )}

            {/* Members Count Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Users size={16} className="text-emerald-400" />
                <span>Traveling Companions</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                {group?.membersCount || 1} {group?.membersCount === 1 ? 'member' : 'members'} joined
              </span>
            </div>

            {/* STATUS-SPECIFIC VIEWS */}

            {/* Case A: User is already an active member */}
            {isMember && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3">
                  <Check size={20} className="text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block font-bold">You are already an active member!</strong>
                    <span>You are a participant in this travel group.</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/travel-companion/group/${invitation.groupId}`)}
                  className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Travel Group</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* Case B: Invitation Expired */}
            {!isMember && statusReason === 'expired' && (
              <div className="space-y-4 pt-2 text-center">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm">
                  <div className="flex items-center justify-center gap-2 font-bold mb-1">
                    <Clock size={18} />
                    <span>This Invitation Has Expired</span>
                  </div>
                  <p className="text-xs text-amber-200/80">
                    Invitations expire after 14 days. Please ask {invitation.inviterName} to generate a fresh invitation link.
                  </p>
                </div>

                <Link
                  to="/travel-companion"
                  className="inline-block w-full py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all"
                >
                  Go to Travel Companion
                </Link>
              </div>
            )}

            {/* Case C: Invitation Declined */}
            {!isMember && statusReason === 'already_declined' && (
              <div className="space-y-4 pt-2 text-center">
                <div className="p-4 rounded-2xl bg-slate-700/40 border border-slate-600/50 text-slate-300 text-xs sm:text-sm">
                  <div className="flex items-center justify-center gap-2 font-bold mb-1">
                    <X size={18} className="text-red-400" />
                    <span>Invitation Declined</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    This invitation was previously declined.
                  </p>
                </div>

                <Link
                  to="/travel-companion"
                  className="inline-block w-full py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all"
                >
                  Go to Travel Companion
                </Link>
              </div>
            )}

            {/* Case D: Valid Invitation - User Not Logged In */}
            {!isMember && isValid && !user && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs sm:text-sm text-emerald-200">
                  <div className="flex items-center gap-2 font-bold mb-1 text-emerald-300">
                    <Sparkles size={16} />
                    <span>Sign In to Accept Your Invitation</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Sign in with Google to accept this invitation, join the group roster, and participate in itinerary planning and bookings.
                  </p>
                </div>

                <button
                  onClick={handleSignInAndAccept}
                  disabled={actionLoading}
                  className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {actionLoading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <LogIn size={20} />
                      <span>Sign In with Google to Join Group</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Case E: Valid Invitation - User IS Logged In */}
            {!isMember && isValid && user && (
              <div className="space-y-4 pt-2">
                {/* User indicator */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                        {user.displayName?.[0] || user.email?.[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] text-slate-400 block">Joining as</span>
                      <span className="font-bold text-white">{user.displayName || user.email}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    Verified User
                  </span>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {actionLoading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Check size={20} />
                        <span>Accept Invitation & Join Group</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDecline}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X size={15} />
                    <span>Decline Invitation</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer security note */}
          <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-700/40 text-center flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Secure MozBook invitation verified through platform token validation</span>
          </div>

        </div>

      </div>
    </div>
  );
}
