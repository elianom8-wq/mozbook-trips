import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Palmtree, 
  Compass, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Eye, 
  Share2, 
  PauseCircle, 
  PlayCircle,
  CreditCard,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  Car,
  Anchor,
  Sparkles,
  Phone,
  Mail,
  Check,
  X,
  FileText,
  TrendingUp,
  Wallet,
  QrCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  ActivityTrip, 
  ActivityBooking, 
  ActivityTripType, 
  ActivityTripStatus 
} from '../types/activityTrip';
import QrCodeScannerModal from '../components/QrCodeScannerModal';
import { 
  getActivitiesTrips, 
  deleteActivityTrip, 
  updateActivityTrip,
  getHostBookings,
  updateBookingStatus,
  getHostEarnings
} from '../services/activityTripService';
import { MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';

export default function HostActivitiesDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPartnerFlow = Boolean(
    new URLSearchParams(location.search).get('partner') === 'true' || 
    location.state?.partnerFlow
  );

  // Active top-level tab: 'activities' | 'trips' | 'bookings' | 'earnings'
  const tabFromQuery = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState<'activities' | 'trips' | 'bookings' | 'earnings'>(
    tabFromQuery === 'trips' ? 'trips' : 'activities'
  );
  
  // Status filter for listings
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data
  const [items, setItems] = useState<ActivityTrip[]>([]);
  const [bookings, setBookings] = useState<ActivityBooking[]>([]);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [earnings, setEarnings] = useState<{
    totalBookingsCount: number;
    completedCount: number;
    pendingCount: number;
    totalEarnedMzn: number;
    pendingMzn: number;
    availableForPayoutMzn: number;
    platformFeeMzn: number;
  }>({
    totalBookingsCount: 0,
    completedCount: 0,
    pendingCount: 0,
    totalEarnedMzn: 0,
    pendingMzn: 0,
    availableForPayoutMzn: 0,
    platformFeeMzn: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<ActivityBooking | null>(null);
  const [payoutNotice, setPayoutNotice] = useState<{
    type: 'unavailable' | 'error' | 'info';
    message: string;
  } | null>({
    type: 'unavailable',
    message: 'On-demand host payout requests are currently unavailable. Earnings are protected in escrow and disbursed automatically via scheduled weekly disbursements once local account details are verified.'
  });

  // Cancellation & Rescheduling Controls (Prompt 28B)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<'operator_inventory_failure' | 'weather' | 'customer_request'>('weather');
  const [cancelNotes, setCancelNotes] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDateInput, setNewDateInput] = useState('');
  const [newTimeInput, setNewTimeInput] = useState('');
  const [rescheduleNotesInput, setRescheduleNotesInput] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const allItems = await getActivitiesTrips();
      setItems(allItems);

      const allBookings = await getHostBookings();
      setBookings(allBookings);

      const earn = await getHostEarnings();
      setEarnings(earn);
    } catch (e) {
      console.error('Failed to load host activities data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter items by type and status and query
  const activitiesList = items.filter(i => i.type === 'activity');
  const tripsList = items.filter(i => i.type === 'trip');

  const currentList = activeTab === 'activities' ? activitiesList : tripsList;

  const filteredList = currentList.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Action handlers
  const handleToggleStatus = async (item: ActivityTrip) => {
    const nextStatus: ActivityTripStatus = item.status === 'published' ? 'paused' : 'published';
    await updateActivityTrip(item.id, { status: nextStatus });
    await loadData();
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteActivityTrip(id);
      await loadData();
    }
  };

  const handleAuthoritativeCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setIsCancelling(true);
    try {
      const { auth } = await import('../firebase');
      let idToken = '';
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/partner/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': auth.currentUser?.uid || selectedBooking.hostId || 'host',
          'x-user-email': auth.currentUser?.email || ''
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          bookingCategory: selectedBooking.activityType === 'trip' ? 'trip' : 'activity',
          cancellationReason: cancelReason,
          notes: cancelNotes
        })
      });

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        alert(resJson?.error || 'Failed to cancel booking.');
        return;
      }

      setShowCancelModal(false);
      setSelectedBooking(null);
      setCancelNotes('');
      await loadData();
    } catch (err: any) {
      console.error('Cancel booking error:', err);
      alert(err.message || 'Error executing cancellation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAuthoritativeReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !newDateInput) return;

    setIsRescheduling(true);
    try {
      const { auth } = await import('../firebase');
      let idToken = '';
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': auth.currentUser?.uid || selectedBooking.hostId || 'host',
          'x-user-email': auth.currentUser?.email || ''
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          newDate: newDateInput,
          newTime: newTimeInput || selectedBooking.time || '',
          notes: rescheduleNotesInput,
          initiatedBy: 'operator'
        })
      });

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        alert(resJson?.error || 'Failed to reschedule booking.');
        return;
      }

      setShowRescheduleModal(false);
      setSelectedBooking(null);
      setNewDateInput('');
      setNewTimeInput('');
      setRescheduleNotesInput('');
      await loadData();
    } catch (err: any) {
      console.error('Reschedule error:', err);
      alert(err.message || 'Error executing rescheduling.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: 'confirmed' | 'completed' | 'cancelled') => {
    await updateBookingStatus(bookingId, status);
    await loadData();
    if (selectedBooking && selectedBooking.id === bookingId) {
      setSelectedBooking(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleRequestPayout = () => {
    // Safety guard: Never show a success message or mock a financial transaction.
    // On-demand payout request pipeline is not yet available.
    setPayoutNotice({
      type: 'unavailable',
      message: 'On-demand host payout requests are currently unavailable. Earnings are protected in escrow and disbursed automatically via scheduled weekly disbursements once local account details are verified.'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-36 pt-6 px-4 md:px-8">
      {/* Partner Flow Banner */}
      {isPartnerFlow && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white px-4 sm:px-6 py-2.5 text-xs border-b border-emerald-800/40 shadow-xs -mx-4 md:-mx-8 -mt-6 mb-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider text-[10px] border border-emerald-400/30">
                Partner Flow
              </span>
              <span className="font-semibold text-slate-200">
                Partner Management: Activities, Trips & Tours Inventory
              </span>
            </div>
            <Link to="/partner" className="text-emerald-400 hover:text-emerald-300 text-xs font-bold hover:underline">
              Return to Partner Categories
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e6f7f0] text-[#009A60] text-xs font-bold uppercase tracking-wider">
                <Palmtree size={14} />
                Host Activities & Trips
              </span>
              <span className="text-xs text-gray-400 font-medium">Mozambique Experiences</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
              Host Management Center
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              Manage guided excursions, boat tours, passenger capacities, traveler reservations, and MZN earnings.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/host"
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <span>Switch to Properties</span>
            </Link>

            <Link
              to="/trips"
              target="_blank"
              className="px-4 py-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-[#009A60] bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <Eye size={14} />
              <span>Customer Trips Page</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/host/activities/create?type=activity"
                className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>+ Create Activity</span>
              </Link>
              <Link
                to="/host/activities/create?type=trip"
                className="px-4 py-2.5 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>+ Create Trip / Tour</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Dashboard Navigation Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex flex-wrap gap-1 shadow-2xs">
          <button
            onClick={() => { setActiveTab('activities'); setStatusFilter('all'); }}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-[#009A60] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Compass size={16} />
            <span>My Activities</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {activitiesList.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('trips'); setStatusFilter('all'); }}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'trips'
                ? 'bg-[#009A60] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Anchor size={16} />
            <span>My Trips & Tours</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'trips' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {tripsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'bookings'
                ? 'bg-[#009A60] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar size={16} />
            <span>Bookings & Guests</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'bookings' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {bookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'earnings'
                ? 'bg-[#009A60] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DollarSign size={16} />
            <span>Earnings</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-[#009A60] font-bold">
              MZN
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1 & 2: ACTIVITIES / TRIPS LIST */}
        {/* ============================================================== */}
        {(activeTab === 'activities' || activeTab === 'trips') && (
          <div className="space-y-4">
            
            {/* Filter Sub-bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
              
              {/* Status pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({currentList.length})
                </button>
                <button
                  onClick={() => setStatusFilter('published')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'published'
                      ? 'bg-[#009A60] text-white'
                      : 'bg-[#e6f7f0] text-[#009A60] hover:bg-emerald-100'
                  }`}
                >
                  Published ({currentList.filter(i => i.status === 'published').length})
                </button>
                <button
                  onClick={() => setStatusFilter('draft')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'draft'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  Drafts ({currentList.filter(i => i.status === 'draft').length})
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'pending'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  Pending Approval ({currentList.filter(i => i.status === 'pending').length})
                </button>
                <button
                  onClick={() => setStatusFilter('paused')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    statusFilter === 'paused'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Paused ({currentList.filter(i => i.status === 'paused').length})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'activities' ? 'activities' : 'trips'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                />
              </div>
            </div>

            {/* Listings Grid */}
            {isLoading ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
                <div className="w-8 h-8 border-3 border-[#009A60] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-500 mt-3 font-medium">Loading your {activeTab}...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 p-8 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center mx-auto">
                  {activeTab === 'activities' ? <Compass size={32} /> : <Anchor size={32} />}
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-gray-900">
                    No {activeTab === 'activities' ? 'activities' : 'trips & tours'} found
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No items match your active search or status filters. Try resetting the filter.'
                      : `You haven't created any ${activeTab === 'activities' ? 'activities' : 'trips'} yet. Add your first experience to start receiving bookings from travelers.`
                    }
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to={`/host/activities/create?type=${activeTab === 'activities' ? 'activity' : 'trip'}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Plus size={16} />
                    <span>+ Create {activeTab === 'activities' ? 'Activity' : 'Trip / Tour'}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredList.map((item) => (
                  <div 
                    key={item.id}
                    className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cover Photo & Status Badge */}
                      <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
                        <img
                          src={item.coverImage || item.images[0] || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80'}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                        
                        {/* Status Badge */}
                        <div className="absolute top-3 left-3">
                          {item.status === 'published' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
                              <CheckCircle2 size={12} />
                              <span>Published</span>
                            </span>
                          )}
                          {item.status === 'draft' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-xs">
                              <span>Draft</span>
                            </span>
                          )}
                          {item.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold shadow-xs">
                              <span>Pending Review</span>
                            </span>
                          )}
                          {item.status === 'paused' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-700 text-white text-[11px] font-bold shadow-xs">
                              <PauseCircle size={12} />
                              <span>Paused</span>
                            </span>
                          )}
                        </div>

                        {/* Category & City Tag */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-semibold">
                          <span className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                            {item.category}
                          </span>
                          <span className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                            <MapPin size={12} />
                            <span>{item.city}</span>
                          </span>
                        </div>
                      </div>

                      {/* Content Details */}
                      <div className="p-5 space-y-3">
                        <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {item.shortDescription || item.description}
                        </p>

                        {/* Specs Chips */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-[#009A60]" />
                            <span className="truncate">{item.duration}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-[#009A60]" />
                            <span>Max {item.maxGuests} guests</span>
                          </div>
                        </div>

                        {/* Pricing Line */}
                        <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                              {item.pricingType === 'per_person' ? 'Per Person' : item.pricingType === 'per_group' ? 'Per Group' : 'Per Booking'}
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-gray-900">
                                MZN {(item.specialOffer?.enabled && item.specialOffer.specialPrice ? item.specialOffer.specialPrice : item.priceAdult).toLocaleString()}
                              </span>
                              {item.specialOffer?.enabled && item.specialOffer.specialPrice && (
                                <span className="text-xs text-gray-400 line-through">
                                  MZN {item.priceAdult.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {item.specialOffer?.enabled && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                              {item.specialOffer.discountPercent ? `${item.specialOffer.discountPercent}% OFF` : 'Special'}
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 pt-0 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                      <Link
                        to={`/host/activities/edit/${item.id}`}
                        className="flex-1 py-2 px-3 rounded-xl border border-gray-300 text-center text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </Link>

                      <button
                        onClick={() => handleToggleStatus(item)}
                        title={item.status === 'published' ? 'Pause Listing' : 'Publish Listing'}
                        className="p-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {item.status === 'published' ? <PauseCircle size={15} /> : <PlayCircle size={15} className="text-[#009A60]" />}
                      </button>

                      <Link
                        to="/trips"
                        title="View on Customer Trips Page"
                        className="p-2 rounded-xl border border-emerald-200 text-[#009A60] hover:bg-emerald-50 transition-colors"
                      >
                        <Eye size={15} />
                      </Link>

                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        title="Delete listing"
                        className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BOOKINGS & GUESTS */}
        {/* ============================================================== */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-gray-900">Activity & Trip Reservations</h2>
                <p className="text-xs text-gray-500">
                  Guest reservations placed directly through the MozBook Trips customer catalog.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode size={14} />
                  <span>Scan Guest QR Voucher</span>
                </button>
                <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                  {bookings.length} Total Bookings
                </span>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 p-8 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                  <Calendar size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No Reservations Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  When travelers book your published activities or trips on the MozBook customer page, their reservation details, contact phone, and guest counts will appear here.
                </p>
                <div className="pt-2">
                  <Link
                    to="/trips"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl"
                  >
                    <span>View Customer Trips Page</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Ref & Experience</th>
                        <th className="py-3.5 px-4">Date & Time</th>
                        <th className="py-3.5 px-4">Lead Guest</th>
                        <th className="py-3.5 px-4">Guests</th>
                        <th className="py-3.5 px-4">Amount</th>
                        <th className="py-3.5 px-4">Transfer / Pickup</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[10px] text-gray-400 block">{b.bookingRef}</span>
                            <span className="font-bold text-gray-900 block truncate max-w-[220px]">
                              {b.activityTitle}
                            </span>
                            <span className="text-[11px] text-[#009A60]">{b.city}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-gray-400" />
                              <span className="font-bold text-gray-800">{b.date}</span>
                            </div>
                            {b.time && (
                              <span className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock size={11} /> {b.time}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-gray-900 block">{b.customerName}</span>
                            <span className="text-[11px] text-gray-500 block">{b.customerPhone}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-gray-800">{b.totalGuests} total</span>
                            <span className="text-[10px] text-gray-500 block">
                              {b.adults} adult{b.adults > 1 ? 's' : ''}{b.children > 0 ? `, ${b.children} child` : ''}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-black text-[#009A60] text-sm">
                              MZN {b.totalMzn.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {b.pickupRequested ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                                <Car size={11} /> Pickup Req.
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400">Direct Meet</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {b.status === 'confirmed' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Confirmed
                              </span>
                            )}
                            {b.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                                Completed
                              </span>
                            )}
                            {b.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Pending
                              </span>
                            )}
                            {b.status === 'cancelled' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                                  title="Confirm booking"
                                  className="px-2.5 py-1 bg-[#009A60] hover:bg-[#008250] text-white rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  Confirm
                                </button>
                              )}
                              {b.status === 'confirmed' && (
                                <button
                                  onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                                  title="Mark as completed"
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  Complete
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedBooking(b)}
                                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: EARNINGS & PAYOUTS */}
        {/* ============================================================== */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            
            {payoutNotice && (
              <div 
                data-testid="payout-notice-banner"
                className={`rounded-2xl p-4 text-xs font-medium flex items-start gap-3 border shadow-2xs ${
                  payoutNotice.type === 'unavailable'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : payoutNotice.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>On-Demand Payout Requests Unavailable</span>
                    <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Action Disabled
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {payoutNotice.message}
                  </p>
                </div>
              </div>
            )}

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Gross Bookings</span>
                <div className="text-2xl font-black text-gray-900">
                  MZN {earnings.totalEarnedMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-gray-500">From {earnings.completedCount} eligible bookings</span>
              </div>

              <div className="bg-white rounded-3xl border-2 border-emerald-500 p-5 space-y-1 shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60]">Available for Payout</span>
                <div className="text-2xl font-black text-[#009A60]">
                  MZN {earnings.availableForPayoutMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-emerald-800">Partner share ({PARTNER_SHARE_PERCENT}%) after {MOZBOOK_COMMISSION_PERCENT}% MozBook commission</span>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Upcoming / Pending</span>
                <div className="text-2xl font-black text-amber-600">
                  MZN {earnings.pendingMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-gray-500">{earnings.pendingCount} pending customer reservations</span>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">MozBook Commission ({MOZBOOK_COMMISSION_PERCENT}%)</span>
                <div className="text-2xl font-black text-gray-700">
                  MZN {earnings.platformFeeMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-gray-500">Platform operations & 24/7 dispatch</span>
              </div>
            </div>

            {/* Payout Channels & Method Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 space-y-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Wallet className="text-[#009A60]" size={20} />
                      <span>Mozambique Host Payout Account</span>
                    </h3>
                    <p className="text-xs text-gray-500">
                      Select your preferred local payout rail for scheduled earnings transfers.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    data-testid="request-payout-btn"
                    onClick={handleRequestPayout}
                    className="px-5 py-2.5 bg-gray-100 text-gray-400 border border-gray-200 text-xs font-bold rounded-xl cursor-not-allowed transition-all shadow-none flex items-center gap-2"
                    title="On-demand payout requests are currently unavailable. Earnings are disbursed automatically on scheduled weekly cycles."
                  >
                    <AlertCircle size={14} className="text-gray-400" />
                    <span>Request Payout Now</span>
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">Unavailable</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">M-Pesa (Vodacom)</span>
                      <span className="text-[10px] font-bold bg-[#009A60] text-white px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <p className="text-xs text-gray-600 font-mono">+258 84 ••• 9080</p>
                    <p className="text-[10px] text-gray-400">Instant transfer (MZN)</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 space-y-2 opacity-80 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">E-Mola (Movitel)</span>
                      <span className="text-[10px] text-gray-400">Backup</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">+258 86 ••• 1234</p>
                    <p className="text-[10px] text-gray-400">Instant transfer (MZN)</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 space-y-2 opacity-80 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Millennium BIM / BCI</span>
                      <span className="text-[10px] text-gray-400">Bank IBAN</span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">MZ59 •••• 4410</p>
                    <p className="text-[10px] text-gray-400">1 business day</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs text-gray-600 space-y-1">
                  <span className="font-bold text-gray-800 block">Automatic Weekly Disbursements</span>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    MozBook executes automated payout batches every Tuesday morning for activities and trips completed in the preceding 7 days. Ensure your mobile number or bank coordinates remain active.
                  </p>
                </div>
              </div>

              {/* Host Support & Protection */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-5 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center">
                    <ShieldCheck size={26} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">AirCover for Activity Hosts</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    All authorized MozBook activity excursions and boat trips are covered under our Mozambique marine liability framework.
                  </p>
                  <ul className="space-y-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#009A60]" />
                      <span>Guest injury liability coverage</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#009A60]" />
                      <span>Weather cancellation protection</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#009A60]" />
                      <span>Emergency evacuation coordination</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <Link
                    to="/emergency"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    <span>Emergency Directory & Maritime SOS</span>
                  </Link>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* BOOKING DETAILS MODAL */}
        {/* ============================================================== */}
        {selectedBooking && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-150">
              <button
                onClick={() => setSelectedBooking(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#e6f7f0] text-[#009A60] flex items-center justify-center shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold text-gray-400 block">{selectedBooking.bookingRef}</span>
                  <h3 className="font-bold text-gray-900 text-base">{selectedBooking.activityTitle}</h3>
                  <span className="text-xs text-[#009A60] font-medium">{selectedBooking.city}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Scheduled Date</span>
                  <span className="font-bold text-gray-800">{selectedBooking.date} {selectedBooking.time ? `at ${selectedBooking.time}` : ''}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Party Size</span>
                  <span className="font-bold text-gray-800">{selectedBooking.totalGuests} Guests ({selectedBooking.adults} Adults, {selectedBooking.children} Children)</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Guest Contact</span>
                  <span className="font-bold text-gray-800">{selectedBooking.customerName}</span>
                  <span className="text-[11px] text-gray-600 block">{selectedBooking.customerPhone}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Charge</span>
                  <span className="font-black text-[#009A60] text-sm">MZN {selectedBooking.totalMzn.toLocaleString()}</span>
                </div>
              </div>

              {selectedBooking.pickupRequested && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-950">
                  <span className="font-bold block flex items-center gap-1.5">
                    <Car size={13} className="text-[#009A60]" />
                    Pickup Service Requested
                  </span>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    {selectedBooking.pickupNotes || 'Guest requested pickup at their local lodge accommodation.'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setNewDateInput(selectedBooking.date);
                    setNewTimeInput(selectedBooking.time || '');
                    setRescheduleNotesInput('');
                    setShowRescheduleModal(true);
                  }}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass size={13} className="text-amber-600" />
                  <span>Reschedule (Weather/Date)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelReason('weather');
                    setCancelNotes('');
                    setShowCancelModal(true);
                  }}
                  className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel Reservation...
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* QR Code Scanner for Host / Guide Check-In */}
      {showQrScanner && (
        <QrCodeScannerModal
          isOpen={showQrScanner}
          onClose={() => setShowQrScanner(false)}
          existingBookingRefs={bookings.map((b) => b.bookingRef || '')}
          onVerifiedBooking={(ref) => {
            const match = bookings.find((b) => b.bookingRef === ref);
            if (match) {
              handleUpdateBookingStatus(match.id, 'confirmed');
            }
          }}
        />
      )}
      {/* Structured Cancellation Modal (Prompt 28B) */}
      {showCancelModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Cancel Experience Reservation</h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthoritativeCancel} className="mt-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                <span className="font-bold text-gray-900 block truncate">{selectedBooking.activityTitle}</span>
                <span className="text-gray-500 font-mono text-[10px]">Ref: {selectedBooking.bookingRef} · MZN {selectedBooking.totalMzn.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Cancellation Reason *
                </label>
                <div className="space-y-2">
                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancelReason === 'weather' ? 'border-amber-400 bg-amber-50/40 text-amber-950' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="hostCancelReason"
                      value="weather"
                      checked={cancelReason === 'weather'}
                      onChange={() => setCancelReason('weather')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold block">Severe Weather / Maritime Force Majeure</span>
                      <span className="text-[11px] text-gray-500 block">Adverse swell, INAM storm warning, or high winds. Zero partner debit.</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancelReason === 'operator_inventory_failure' ? 'border-rose-400 bg-rose-50/40 text-rose-950' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="hostCancelReason"
                      value="operator_inventory_failure"
                      checked={cancelReason === 'operator_inventory_failure'}
                      onChange={() => setCancelReason('operator_inventory_failure')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold block">Operator Inventory Failure / Oversell</span>
                      <span className="text-[11px] text-gray-500 block">Mechanical breakdown or lack of guides. Incurs 15% platform accountability debit.</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancelReason === 'customer_request' ? 'border-[#009A60] bg-emerald-50/40 text-emerald-950' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="hostCancelReason"
                      value="customer_request"
                      checked={cancelReason === 'customer_request'}
                      onChange={() => setCancelReason('customer_request')}
                      className="mt-0.5 text-[#009A60] focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold block">Customer Requested Cancellation</span>
                      <span className="text-[11px] text-gray-500 block">Guest requested directly to cancel.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Explanation / Operational Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide context regarding this operational decision..."
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Keep Reservation
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? 'Processing...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Experience Modal (Prompt 28B) */}
      {showRescheduleModal && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-700">
                <Compass size={18} className="text-amber-600" />
                <h3 className="font-bold text-gray-900 text-sm">Reschedule Experience Date</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthoritativeReschedule} className="mt-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                <span className="font-bold text-gray-900 block truncate">{selectedBooking.activityTitle}</span>
                <div className="text-xs text-gray-500 pt-1">
                  Current Date: <strong className="text-gray-800">{selectedBooking.date}</strong> {selectedBooking.time ? `at ${selectedBooking.time}` : ''}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Operating Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Departure Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Weather / Operational Context
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Rough sea swell and surf break. Postponed to safe weather window with guest consent."
                    value={rescheduleNotesInput}
                    onChange={(e) => setRescheduleNotesInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRescheduling}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
