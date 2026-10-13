import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CalendarCheck,
  ShieldCheck,
  Search,
  X,
  RefreshCw,
  Eye,
  Calendar,
  Mail,
  MapPin,
  Copy,
  Check,
  ArrowLeft,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  Users,
  Tag,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Home,
  Compass,
  DollarSign,
  Phone,
  AlertTriangle,
  RotateCcw,
  Ban
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminUnifiedBooking, AdminBookingCategory } from '../../types/admin';

export default function AdminBookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialStatus = searchParams.get('status') || 'all';
  const initialPayment = searchParams.get('payment') || 'all';
  const hostIdParam = searchParams.get('hostId') || '';
  const initialSearch = searchParams.get('q') || '';

  const [bookings, setBookings] = useState<AdminUnifiedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [paymentFilter, setPaymentFilter] = useState<string>(initialPayment);
  const [activeHostFilter, setActiveHostFilter] = useState<string>(hostIdParam);

  // Detail Modal state
  const [selectedBooking, setSelectedBooking] = useState<AdminUnifiedBooking | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Operational Action Modal states
  const [actionTarget, setActionTarget] = useState<AdminUnifiedBooking | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'reschedule' | null>(null);
  
  // Cancel action form
  const [cancelReason, setCancelReason] = useState<'customer_request' | 'operator_inventory_failure' | 'weather' | 'force_majeure' | 'other'>('customer_request');
  const [cancelNotes, setCancelNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reschedule action form
  const [newDateInput, setNewDateInput] = useState('');
  const [newTimeInput, setNewTimeInput] = useState('');
  const [rescheduleNotesInput, setRescheduleNotesInput] = useState('');

  // Sync state with URL params
  useEffect(() => {
    const cParam = searchParams.get('category');
    if (cParam) setCategoryFilter(cParam.toLowerCase());

    const sParam = searchParams.get('status');
    if (sParam) setStatusFilter(sParam.toLowerCase());

    const pParam = searchParams.get('payment');
    if (pParam) setPaymentFilter(pParam.toLowerCase());

    const hParam = searchParams.get('hostId');
    if (hParam !== null) setActiveHostFilter(hParam);
  }, [searchParams]);

  const loadBookings = async () => {
    setErrorMessage(null);
    try {
      const data = await adminService.getAllBookings();
      setBookings(data);
    } catch (err: any) {
      console.error('Error loading bookings for admin:', err);
      setErrorMessage(err.message || 'Failed to retrieve bookings from registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
  };

  const handleSelectCategory = (cat: string) => {
    setCategoryFilter(cat);
    if (cat === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  const handleSelectStatus = (st: string) => {
    setStatusFilter(st);
    if (st === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', st);
    }
    setSearchParams(searchParams);
  };

  const handleSelectPayment = (pay: string) => {
    setPaymentFilter(pay);
    if (pay === 'all') {
      searchParams.delete('payment');
    } else {
      searchParams.set('payment', pay);
    }
    setSearchParams(searchParams);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Open Cancel Action Modal
  const openCancelModal = (b: AdminUnifiedBooking) => {
    setActionTarget(b);
    setActionType('cancel');
    setCancelReason('customer_request');
    setCancelNotes('');
    setActionError(null);
    setActionSuccess(null);
  };

  // Open Reschedule Action Modal
  const openRescheduleModal = (b: AdminUnifiedBooking) => {
    setActionTarget(b);
    setActionType('reschedule');
    setNewDateInput(b.startDate || '');
    setNewTimeInput(b.time || '');
    setRescheduleNotesInput('');
    setActionError(null);
    setActionSuccess(null);
  };

  // Authoritative Cancel execution
  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget) return;

    setIsSubmittingAction(true);
    setActionError(null);

    try {
      const res = await adminService.cancelBooking({
        bookingId: actionTarget.id,
        bookingCategory: actionTarget.category,
        cancellationReason: cancelReason,
        notes: cancelNotes
      });

      setActionSuccess(res.message || 'Booking cancelled successfully.');
      setTimeout(() => {
        setActionType(null);
        setActionTarget(null);
        // Refresh registry
        loadBookings();
      }, 1500);
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setActionError(err.message || 'Failed to process cancellation.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Authoritative Reschedule execution
  const handleExecuteReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !newDateInput) return;

    setIsSubmittingAction(true);
    setActionError(null);

    try {
      const res = await adminService.rescheduleBooking({
        bookingId: actionTarget.id,
        newDate: newDateInput,
        newTime: newTimeInput,
        notes: rescheduleNotesInput
      });

      setActionSuccess(res.message || 'Experience booking rescheduled successfully.');
      setTimeout(() => {
        setActionType(null);
        setActionTarget(null);
        // Refresh registry
        loadBookings();
      }, 1500);
    } catch (err: any) {
      console.error('Reschedule error:', err);
      setActionError(err.message || 'Failed to process rescheduling.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Real KPI counts
  const summary = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let cancelled = 0;
    let completed = 0;
    let stays = 0;
    let experiences = 0;
    let unpaid = 0;
    let paid = 0;

    bookings.forEach((b) => {
      const st = (b.status || '').toLowerCase();
      if (st === 'pending') pending++;
      else if (st === 'confirmed') confirmed++;
      else if (st === 'cancelled') cancelled++;
      else if (st === 'completed') completed++;

      if (b.category === 'stay') stays++;
      else experiences++;

      const pst = (b.paymentStatus || '').toLowerCase();
      if (pst === 'paid') paid++;
      else if (pst === 'unpaid' || pst === 'pending') unpaid++;
    });

    return {
      total: bookings.length,
      pending,
      confirmed,
      cancelled,
      completed,
      stays,
      experiences,
      unpaid,
      paid
    };
  }, [bookings]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Host filter
      if (activeHostFilter && b.hostId !== activeHostFilter) {
        return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'stay' && b.category !== 'stay') return false;
        if (categoryFilter === 'experience' && b.category === 'stay') return false;
        if (categoryFilter === 'activity' && b.category !== 'activity') return false;
        if (categoryFilter === 'trip' && b.category !== 'trip') return false;
        if (categoryFilter === 'transport' && b.category !== 'transport') return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        const st = (b.status || '').toLowerCase();
        if (st !== statusFilter.toLowerCase()) return false;
      }

      // 4. Payment filter
      if (paymentFilter !== 'all') {
        const pst = (b.paymentStatus || '').toLowerCase();
        if (pst !== paymentFilter.toLowerCase()) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const refMatch = (b.bookingRef || '').toLowerCase().includes(q);
        const targetTitleMatch = (b.targetTitle || '').toLowerCase().includes(q);
        const customerNameMatch = (b.customerName || '').toLowerCase().includes(q);
        const customerEmailMatch = (b.customerEmail || '').toLowerCase().includes(q);
        const hostNameMatch = (b.hostName || '').toLowerCase().includes(q);
        const hostEmailMatch = (b.hostEmail || '').toLowerCase().includes(q);
        const idMatch = (b.id || '').toLowerCase().includes(q);
        const cityMatch = (b.targetCity || '').toLowerCase().includes(q);
        return refMatch || targetTitleMatch || customerNameMatch || customerEmailMatch || hostNameMatch || hostEmailMatch || idMatch || cityMatch;
      }

      return true;
    });
  }, [bookings, activeHostFilter, categoryFilter, statusFilter, paymentFilter, searchQuery]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'confirmed':
        return {
          label: 'Confirmed',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          dot: 'bg-emerald-400'
        };
      case 'pending':
        return {
          label: 'Pending',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          dot: 'bg-amber-400'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          dot: 'bg-rose-400'
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          dot: 'bg-blue-400'
        };
      default:
        return {
          label: status || 'Unknown',
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          dot: 'bg-slate-400'
        };
    }
  };

  const getPaymentBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'paid':
        return {
          label: 'Paid',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        };
      case 'pending':
        return {
          label: 'Payment Pending',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        };
      case 'unpaid':
        return {
          label: 'Unpaid',
          color: 'text-slate-400 bg-slate-800/80 border-slate-700'
        };
      case 'refunded':
        return {
          label: 'Refunded',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
        };
      default:
        return {
          label: status || 'Unpaid',
          color: 'text-slate-400 bg-slate-800 border-slate-700'
        };
    }
  };

  const getCategoryBadge = (cat: AdminBookingCategory) => {
    switch (cat) {
      case 'stay':
        return {
          label: 'Stay',
          icon: Home,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        };
      case 'activity':
        return {
          label: 'Activity',
          icon: Compass,
          color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'
        };
      case 'trip':
        return {
          label: 'Trip',
          icon: Compass,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        };
      case 'transport':
        return {
          label: 'Transport',
          icon: Compass,
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
        };
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/admin/dashboard"
                className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1"
              >
                <ArrowLeft size={12} />
                <span>Dashboard</span>
              </Link>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">Management</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-purple-400 font-semibold">Bookings</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Booking Management
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Unified registry of traveler stay reservations and experience bookings across Mozambique.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Registry'}</span>
            </button>
          </div>
        </div>

        {/* Error notification if fetch failed */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <div className="flex-1">
              <span className="font-bold">Error loading reservations: </span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-200 font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Counter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Reservations</span>
            <span className="text-2xl font-black text-white font-mono tabular-nums">{summary.total}</span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Stays & Experiences</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-amber-400 block mb-1">Pending</span>
            <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">{summary.pending}</span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Awaiting fulfillment</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-emerald-400 block mb-1">Confirmed</span>
            <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">{summary.confirmed}</span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Confirmed bookings</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-rose-400 block mb-1">Cancelled</span>
            <span className="text-2xl font-black text-rose-400 font-mono tabular-nums">{summary.cancelled}</span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Released holds</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-teal-400 block mb-1">Stays vs Exp</span>
            <div className="text-base font-bold text-white font-mono mt-1">
              <span className="text-amber-400">{summary.stays}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-teal-400">{summary.experiences}</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Accommodation / Tours</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-semibold text-emerald-400 block mb-1">Settled / Paid</span>
            <span className="text-2xl font-black text-white font-mono tabular-nums">{summary.paid}</span>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">Paid transactions</span>
          </div>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          {/* Active Host Filter Notice */}
          {activeHostFilter && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs">
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>
                  Filtering bookings for Host UID: <code className="font-mono bg-purple-950/60 px-1 py-0.5 rounded text-[11px]">{activeHostFilter}</code>
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveHostFilter('');
                  searchParams.delete('hostId');
                  setSearchParams(searchParams);
                }}
                className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/40 rounded text-[11px] font-semibold text-purple-200 cursor-pointer"
              >
                Clear host filter
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { id: 'all', label: 'All Categories', count: summary.total },
                { id: 'stay', label: 'Stays', count: summary.stays },
                { id: 'experience', label: 'Experiences', count: summary.experiences }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSelectCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      categoryFilter === tab.id
                        ? 'bg-slate-950/20 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[280px] lg:w-80">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference, guest, host, or title..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Status & Payment Selectors */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-900 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">Status:</span>
              {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleSelectStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer capitalize ${
                    statusFilter === st
                      ? 'bg-slate-800 text-purple-400 border border-purple-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-slate-500 text-[11px] uppercase font-mono tracking-wider">Payment:</span>
              {['all', 'paid', 'unpaid', 'refunded'].map((pay) => (
                <button
                  key={pay}
                  onClick={() => handleSelectPayment(pay)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer capitalize ${
                    paymentFilter === pay
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {pay}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bookings Registry Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-mono text-slate-400">Loading MozBook bookings from Firestore...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <CalendarCheck className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No reservations found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No bookings matched "${searchQuery}".`
                  : 'There are no booking records matching your active filters.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-purple-400 font-semibold cursor-pointer"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-500 bg-slate-900/40">
                    <th className="py-3.5 px-4 font-semibold">Reference</th>
                    <th className="py-3.5 px-4 font-semibold">Listing / Activity</th>
                    <th className="py-3.5 px-4 font-semibold">Guest</th>
                    <th className="py-3.5 px-4 font-semibold">Host / Operator</th>
                    <th className="py-3.5 px-4 font-semibold">Schedule</th>
                    <th className="py-3.5 px-4 font-semibold">Guests</th>
                    <th className="py-3.5 px-4 font-semibold">Amount</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Payment</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBookings.map((b) => {
                    const statusBadge = getStatusBadge(b.status);
                    const paymentBadge = getPaymentBadge(b.paymentStatus);
                    const catBadge = getCategoryBadge(b.category);
                    const CategoryIcon = catBadge.icon;
                    const isCancelled = b.status === 'cancelled';
                    const isExperience = b.category !== 'stay';

                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedBooking(b)}
                      >
                        {/* Booking Reference */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-white group-hover:text-purple-400 transition-colors">
                                {b.bookingRef}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold border ${catBadge.color}`}>
                                  <CategoryIcon size={10} />
                                  <span>{catBadge.label}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Listing / Experience Title */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate">
                              {b.targetTitle}
                            </p>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                              <MapPin size={11} className="shrink-0 text-slate-500" />
                              <span>{b.targetCity || 'Mozambique'}</span>
                            </span>
                          </div>
                        </td>

                        {/* Guest / Customer */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-300 block truncate">
                              {b.customerName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono block truncate">
                              {b.customerEmail || 'No email provided'}
                            </span>
                          </div>
                        </td>

                        {/* Host / Operator */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-300 truncate">
                                {b.hostName}
                              </span>
                              {b.isHostVerified && (
                                <ShieldCheck size={13} className="text-emerald-400 shrink-0" title="Verified MozBook Host" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono truncate block">
                              UID: {b.hostId.slice(0, 10)}...
                            </span>
                          </div>
                        </td>

                        {/* Schedule / Travel Dates */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-slate-300 text-xs">
                            {formatDate(b.startDate)}
                            {b.endDate && b.endDate !== b.startDate && (
                              <span className="text-slate-400"> → {formatDate(b.endDate)}</span>
                            )}
                          </div>
                          {b.category === 'stay' ? (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {b.nights || 1} {b.nights === 1 ? 'night' : 'nights'}
                            </span>
                          ) : (
                            b.time && (
                              <span className="text-[10px] text-teal-400 font-mono">
                                Time: {b.time}
                              </span>
                            )
                          )}
                        </td>

                        {/* Guest Count */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono tabular-nums">
                          <span>{b.totalGuests}</span>
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({b.adults}A{b.children > 0 ? ` + ${b.children}C` : ''})
                          </span>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-white tabular-nums">
                          {b.currency || 'MZN'} {b.totalAmount.toLocaleString()}
                        </td>

                        {/* Booking Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                            <span>{statusBadge.label}</span>
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${paymentBadge.color}`}>
                            {paymentBadge.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBooking(b);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-purple-400 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="View booking details"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            {/* Operational Reschedule action (experiences only, when not cancelled) */}
                            {isExperience && !isCancelled && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRescheduleModal(b);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Reschedule experience booking"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}

                            {/* Operational Cancel action (when not already cancelled) */}
                            {!isCancelled && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCancelModal(b);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Execute authoritative cancellation"
                              >
                                <Ban size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer info */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono gap-2">
            <span>
              Showing {filteredBookings.length} of {bookings.length} reservations
            </span>
            <span className="text-slate-600">
              Authoritative booking records from Firestore `bookings` and `activity_bookings` collections.
            </span>
          </div>
        </div>

        {/* Booking Detail Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Top Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                    <CalendarCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedBooking.bookingRef}</span>
                      <button
                        onClick={() => handleCopy(selectedBooking.bookingRef)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Copy Reference"
                      >
                        {copiedId ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      MozBook Reservation Record • Source: {selectedBooking.sourceCollection}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBooking(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 text-xs text-slate-300">
                {/* Status Banners */}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">Reservation</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(selectedBooking.status).color}`}>
                      {selectedBooking.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">Financial State</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${getPaymentBadge(selectedBooking.paymentStatus).color}`}>
                      {selectedBooking.paymentStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">Fulfillment</span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                      {selectedBooking.fulfillmentStatus}
                    </span>
                  </div>
                </div>

                {/* Target Property / Activity Details */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                      {selectedBooking.category === 'stay' ? 'Accommodation Details' : 'Experience Details'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">ID: {selectedBooking.targetId}</span>
                  </div>

                  <div className="flex items-start gap-4">
                    {selectedBooking.targetImage ? (
                      <img
                        src={selectedBooking.targetImage}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border border-slate-800 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        {selectedBooking.category === 'stay' ? <Home size={24} /> : <Compass size={24} />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white">{selectedBooking.targetTitle}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin size={13} className="text-slate-500 shrink-0" />
                        <span>{selectedBooking.targetLocation || selectedBooking.targetCity || 'Mozambique'}</span>
                      </p>
                      {selectedBooking.accommodationName && (
                        <p className="text-[11px] text-amber-400 font-mono mt-1">
                          Unit: {selectedBooking.accommodationName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Traveler & Host Profiles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Guest Info */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                      Traveler Information
                    </span>
                    <p className="font-semibold text-white text-sm">{selectedBooking.customerName}</p>
                    <p className="text-slate-400 flex items-center gap-1.5 font-mono text-[11px]">
                      <Mail size={12} className="text-slate-500" />
                      <span>{selectedBooking.customerEmail || '—'}</span>
                    </p>
                    {selectedBooking.customerPhone && (
                      <p className="text-slate-400 flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone size={12} className="text-slate-500" />
                        <span>{selectedBooking.customerPhone}</span>
                      </p>
                    )}
                    {selectedBooking.userId && (
                      <p className="text-[10px] text-slate-400 font-mono">UID: {selectedBooking.userId}</p>
                    )}
                  </div>

                  {/* Host Info */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                      Host / Operator Information
                    </span>
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-white text-sm">{selectedBooking.hostName}</p>
                      {selectedBooking.isHostVerified && (
                        <ShieldCheck size={14} className="text-emerald-400" title="Verified" />
                      )}
                    </div>
                    <p className="text-slate-400 flex items-center gap-1.5 font-mono text-[11px]">
                      <Mail size={12} className="text-slate-500" />
                      <span>{selectedBooking.hostEmail || '—'}</span>
                    </p>
                    {selectedBooking.hostPhone && (
                      <p className="text-slate-400 flex items-center gap-1.5 font-mono text-[11px]">
                        <Phone size={12} className="text-slate-500" />
                        <span>{selectedBooking.hostPhone}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">Host UID: {selectedBooking.hostId}</p>
                  </div>
                </div>

                {/* Schedule & Breakdown */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
                    Schedule & Pricing Breakdown
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center border-b border-slate-900 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">Start Date</span>
                      <span className="font-mono text-white font-semibold">{formatDate(selectedBooking.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">End Date</span>
                      <span className="font-mono text-white font-semibold">{formatDate(selectedBooking.endDate)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">Guests</span>
                      <span className="font-mono text-white font-semibold">
                        {selectedBooking.totalGuests} ({selectedBooking.adults}A, {selectedBooking.children}C)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono block">Total Amount</span>
                      <span className="font-mono text-emerald-400 font-bold text-sm">
                        {selectedBooking.currency} {selectedBooking.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                    <span>Created: {formatDate(selectedBooking.createdAt)}</span>
                    <span>Document ID: {selectedBooking.id}</span>
                  </div>
                </div>

                {/* Cancellation & Operator Accountability Audit trail */}
                {selectedBooking.cancellationReason && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                    <span className="text-[11px] font-mono uppercase text-rose-400 font-bold flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      <span>Cancellation Record & Policy Settlement</span>
                    </span>
                    <div className="text-xs text-rose-300 space-y-1">
                      <p><strong>Reason:</strong> {selectedBooking.cancellationReason}</p>
                      {selectedBooking.cancellationInitiator && (
                        <p><strong>Initiator:</strong> {selectedBooking.cancellationInitiator}</p>
                      )}
                      {selectedBooking.operatorFailureNotes && (
                        <p><strong>Notes:</strong> {selectedBooking.operatorFailureNotes}</p>
                      )}
                      {selectedBooking.customerProtectionRefundMzn !== undefined && (
                        <p><strong>Refund Entitlement:</strong> MZN {selectedBooking.customerProtectionRefundMzn.toLocaleString()}</p>
                      )}
                      {selectedBooking.cancellationSettlement && (
                        <div className="pt-2 mt-2 border-t border-rose-500/20 text-[11px] space-y-0.5 font-mono text-rose-200">
                          <p>• Refund Rate: {selectedBooking.cancellationSettlement.refundPercent}% (MZN {selectedBooking.cancellationSettlement.customerRefundMzn?.toLocaleString()})</p>
                          <p>• Retained Amount: MZN {selectedBooking.cancellationSettlement.retainedAmountMzn?.toLocaleString()}</p>
                          <p>• Platform Commission Retained: MZN {selectedBooking.cancellationSettlement.platformCommissionRetainedMzn?.toLocaleString()} (15%)</p>
                          <p>• Partner Share Retained: MZN {selectedBooking.cancellationSettlement.partnerShareRetainedMzn?.toLocaleString()} (85%)</p>
                          {selectedBooking.cancellationSettlement.operatorAccountabilityDebitMzn > 0 && (
                            <p className="text-rose-400 font-bold">• Operator Failure Debit: MZN {selectedBooking.cancellationSettlement.operatorAccountabilityDebitMzn?.toLocaleString()}</p>
                          )}
                          <p className="text-[10px] text-rose-300/80 italic mt-1 font-sans">{selectedBooking.cancellationSettlement.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Accepted Cancellation Policy Snapshot */}
                {selectedBooking.cancellationSnapshot && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                        <ShieldCheck size={13} />
                        <span>Accepted Policy Snapshot ({selectedBooking.cancellationSnapshot.tierName})</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        v{selectedBooking.cancellationSnapshot.policyVersion}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="text-[11px] text-slate-400">{selectedBooking.cancellationSnapshot.summaryTerms}</p>
                      {selectedBooking.cancellationSnapshot.deadlineIso && (
                        <p className="font-mono text-[11px] text-emerald-400">
                          <strong>Cutoff Deadline:</strong> {formatDate(selectedBooking.cancellationSnapshot.deadlineIso)} (CAT)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Reschedule audit trail */}
                {selectedBooking.rescheduledFromDate && (
                  <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-2">
                    <span className="text-[11px] font-mono uppercase text-teal-400 font-bold flex items-center gap-1.5">
                      <RotateCcw size={13} />
                      <span>Reschedule Audit Trail</span>
                    </span>
                    <div className="text-xs text-teal-300">
                      <p><strong>Moved From:</strong> {formatDate(selectedBooking.rescheduledFromDate)} → {formatDate(selectedBooking.rescheduledToDate)}</p>
                      {selectedBooking.rescheduledBy && <p><strong>Rescheduled By:</strong> {selectedBooking.rescheduledBy}</p>}
                      {selectedBooking.rescheduleNotes && <p><strong>Notes:</strong> {selectedBooking.rescheduleNotes}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  {selectedBooking.category !== 'stay' && selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={() => openRescheduleModal(selectedBooking)}
                      className="px-3.5 py-2 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Reschedule</span>
                    </button>
                  )}

                  {selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={() => openCancelModal(selectedBooking)}
                      className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Ban size={13} />
                      <span>Cancel Reservation</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Operational Cancel Modal */}
        {actionType === 'cancel' && actionTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl">
                  <Ban size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cancel Reservation</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ref: {actionTarget.bookingRef} • {actionTarget.category.toUpperCase()}
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <form onSubmit={handleExecuteCancel} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Cancellation Reason
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e: any) => setCancelReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white outline-none"
                    disabled={isSubmittingAction}
                  >
                    <option value="customer_request">Customer Cancellation (Evaluated Against Policy Snapshot)</option>
                    <option value="operator_inventory_failure">Operator Inventory Failure (Overbooking / 15% Debit)</option>
                    <option value="operator_cancellation">Operator Cancellation / Failure to Deliver (15% Debit)</option>
                    <option value="material_inaccuracy">Material Listing Inaccuracy / Undelivered Experience</option>
                    <option value="weather">Severe Weather / Maritime Safety Ban (100% Refund Guarantee)</option>
                    <option value="exceptional_circumstances">Exceptional Circumstances (Special Protection)</option>
                    <option value="customer_no_show">Customer No-Show (Non-Refundable)</option>
                    <option value="mutual_agreement">Mutual Agreement Between Parties (100% Refund)</option>
                    <option value="duplicate_payment">Duplicate Payment Verification Reversal</option>
                    <option value="other">Other Administrative Intervention</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Administrative Notes / Justification
                  </label>
                  <textarea
                    value={cancelNotes}
                    onChange={(e) => setCancelNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter reason details or audit notes..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 outline-none"
                    disabled={isSubmittingAction}
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Authoritative Action Impact:</p>
                  <p>• Inventory holds will be immediately released back to available slots.</p>
                  <p>• If paid, an automated refund request will be registered in the refund ledger.</p>
                  <p>• Action is authorized by server endpoint <code className="text-purple-400">/api/partner/bookings/cancel</code>.</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType(null);
                      setActionTarget(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    disabled={isSubmittingAction}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingAction ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Confirm Cancellation</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Operational Reschedule Modal */}
        {actionType === 'reschedule' && actionTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-teal-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reschedule Experience</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ref: {actionTarget.bookingRef} • {actionTarget.targetTitle}
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <form onSubmit={handleExecuteReschedule} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    New Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    required
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-2.5 text-xs text-white outline-none"
                    disabled={isSubmittingAction}
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Current date: {formatDate(actionTarget.startDate)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    New Start Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    placeholder="e.g. 08:30 AM"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-2.5 text-xs text-white outline-none"
                    disabled={isSubmittingAction}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Rescheduling Reason / Notes
                  </label>
                  <textarea
                    value={rescheduleNotesInput}
                    onChange={(e) => setRescheduleNotesInput(e.target.value)}
                    rows={2}
                    placeholder="e.g. Rescheduled due to high winds and tide warning"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 outline-none"
                    disabled={isSubmittingAction}
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">Atomic Capacity Check:</p>
                  <p>• The backend transaction verifies seat availability on the target date before moving.</p>
                  <p>• Authorized via endpoint <code className="text-teal-400">/api/bookings/reschedule</code>.</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType(null);
                      setActionTarget(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    disabled={isSubmittingAction}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingAction ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Save New Schedule</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
