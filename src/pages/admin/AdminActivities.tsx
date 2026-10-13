import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Compass,
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
  Car,
  CheckCircle2,
  XCircle,
  Anchor,
  Palmtree,
  HelpCircle,
  AlertTriangle,
  Flame,
  FileCheck2
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminActivityTrip } from '../../types/admin';

export default function AdminActivities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'all';
  const initialStatus = searchParams.get('status') || 'all';
  const initialDestination = searchParams.get('destination') || 'all';
  const initialCategory = searchParams.get('category') || 'all';
  const hostIdParam = searchParams.get('hostId') || '';

  const [activities, setActivities] = useState<AdminActivityTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(initialType);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [destinationFilter, setDestinationFilter] = useState<string>(initialDestination);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [activeHostFilter, setActiveHostFilter] = useState<string>(hostIdParam);

  // Detail Modal / Drawer state
  const [selectedItem, setSelectedItem] = useState<AdminActivityTrip | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Sync state with URL params
  useEffect(() => {
    const tParam = searchParams.get('type');
    if (tParam) setTypeFilter(tParam.toLowerCase());

    const sParam = searchParams.get('status');
    if (sParam) setStatusFilter(sParam.toLowerCase());

    const dParam = searchParams.get('destination');
    if (dParam) setDestinationFilter(dParam);

    const cParam = searchParams.get('category');
    if (cParam) setCategoryFilter(cParam);

    const hParam = searchParams.get('hostId');
    if (hParam !== null) setActiveHostFilter(hParam);
  }, [searchParams]);

  const loadActivities = async () => {
    try {
      const data = await adminService.getAllActivities();
      setActivities(data);
    } catch (err) {
      console.error('Error loading activities & trips:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
  };

  const handleSelectTypeFilter = (t: string) => {
    setTypeFilter(t);
    if (t === 'all') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', t);
    }
    setSearchParams(searchParams);
  };

  const handleSelectStatusFilter = (st: string) => {
    setStatusFilter(st);
    if (st === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', st);
    }
    setSearchParams(searchParams);
  };

  const handleSelectDestination = (dest: string) => {
    setDestinationFilter(dest);
    if (dest === 'all') {
      searchParams.delete('destination');
    } else {
      searchParams.set('destination', dest);
    }
    setSearchParams(searchParams);
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

  const handleClearHostFilter = () => {
    setActiveHostFilter('');
    searchParams.delete('hostId');
    setSearchParams(searchParams);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Safe date formatter
  const formatDate = (val: any) => {
    if (!val) return '—';
    try {
      if (typeof val.toDate === 'function') {
        return val.toDate().toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      }
      return '—';
    } catch {
      return '—';
    }
  };

  // Dynamically extract unique destinations from real records
  const destinations = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.city) set.add(a.city.trim());
    });
    return Array.from(set).sort();
  }, [activities]);

  // Dynamically extract unique categories from real records
  const categories = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.category) set.add(a.category.trim());
    });
    return Array.from(set).sort();
  }, [activities]);

  // Real KPI counts
  const summary = useMemo(() => {
    let activityCount = 0;
    let tripCount = 0;
    let published = 0;
    let draft = 0;
    let pending = 0;
    let suspended = 0;

    activities.forEach((a) => {
      if (a.type === 'trip') tripCount++;
      else activityCount++;

      const st = (a.status || '').toLowerCase();
      if (st === 'draft') draft++;
      else if (st === 'pending') pending++;
      else if (st === 'paused' || st === 'suspended' || st === 'inactive') suspended++;
      else published++; // default active in MozBook
    });

    return {
      total: activities.length,
      activityCount,
      tripCount,
      published,
      draft,
      pending,
      suspended,
    };
  }, [activities]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      // 1. Host filter
      if (activeHostFilter && a.hostId !== activeHostFilter) {
        return false;
      }

      // 2. Type filter
      if (typeFilter !== 'all' && a.type !== typeFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        const st = (a.status || '').toLowerCase();
        if (statusFilter === 'published' && !(st === 'published' || st === 'active')) return false;
        if (statusFilter === 'draft' && st !== 'draft') return false;
        if (statusFilter === 'pending' && st !== 'pending') return false;
        if (statusFilter === 'suspended' && !(st === 'paused' || st === 'suspended' || st === 'inactive')) return false;
      }

      // 4. Destination filter
      if (destinationFilter !== 'all' && a.city?.toLowerCase() !== destinationFilter.toLowerCase()) {
        return false;
      }

      // 5. Category filter
      if (categoryFilter !== 'all' && a.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // 6. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (a.title || '').toLowerCase().includes(q);
        const hostNameMatch = (a.hostName || '').toLowerCase().includes(q);
        const hostEmailMatch = (a.hostEmail || '').toLowerCase().includes(q);
        const destMatch = (a.city || '').toLowerCase().includes(q);
        const catMatch = (a.category || '').toLowerCase().includes(q);
        const idMatch = (a.id || '').toLowerCase().includes(q);
        return titleMatch || hostNameMatch || hostEmailMatch || destMatch || catMatch || idMatch;
      }

      return true;
    });
  }, [activities, activeHostFilter, typeFilter, statusFilter, destinationFilter, categoryFilter, searchQuery]);

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
              <span className="text-xs font-mono text-teal-400 font-semibold">Activities & Trips</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Activities & Trips Management
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Administrative operations directory for host-created excursions, multi-day tours, safari game drives, and ocean adventures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/trips"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-bold border border-teal-500/30 transition-colors shadow-xs"
            >
              <Compass size={15} />
              <span>Customer Trips Page</span>
              <ExternalLink size={12} />
            </Link>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-teal-400' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Experiences'}</span>
            </button>
          </div>
        </div>

        {/* Host Filter Banner if hostIdParam present */}
        {activeHostFilter && (
          <div className="p-3.5 bg-slate-900 border border-teal-500/30 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-teal-400 font-bold uppercase font-mono text-[10px]">Filter Active:</span>
              <span>Showing experiences owned by Host UID: <span className="font-mono text-white font-bold">{activeHostFilter}</span></span>
            </div>
            <button
              onClick={handleClearHostFilter}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear Host Filter
            </button>
          </div>
        )}

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4">
          {/* Total Experiences */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Total
              </span>
              <Compass size={16} className="text-teal-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-white">
                {loading ? '—' : summary.total.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                All experiences
              </span>
            </div>
          </div>

          {/* Activities */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Activities
              </span>
              <Palmtree size={16} className="text-blue-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-blue-400">
                {loading ? '—' : summary.activityCount.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Single-session
              </span>
            </div>
          </div>

          {/* Trips & Tours */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Trips & Tours
              </span>
              <Anchor size={16} className="text-purple-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-purple-400">
                {loading ? '—' : summary.tripCount.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Multi-day & safaris
              </span>
            </div>
          </div>

          {/* Published / Active */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Active
              </span>
              <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-emerald-400">
                {loading ? '—' : summary.published.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Marketplace live
              </span>
            </div>
          </div>

          {/* Drafts */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Drafts
              </span>
              <Clock size={16} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-slate-400">
                {loading ? '—' : summary.draft.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Unpublished
              </span>
            </div>
          </div>

          {/* Pending Approval */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Pending
              </span>
              <AlertCircle size={16} className="text-amber-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-amber-400">
                {loading ? '—' : summary.pending.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Review queue
              </span>
            </div>
          </div>

          {/* Suspended / Paused */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                Paused
              </span>
              <XCircle size={16} className="text-rose-400" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-black text-rose-400">
                {loading ? '—' : summary.suspended.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Offline
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Primary Type Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Experiences', count: summary.total },
                { id: 'activity', label: 'Activities', count: summary.activityCount },
                { id: 'trip', label: 'Trips & Tours', count: summary.tripCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTypeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-teal-600 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      typeFilter === tab.id
                        ? 'bg-slate-950/20 text-slate-950'
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
                placeholder="Search title, host, destination, category..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
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

          {/* Secondary Filter Row: Status, Destination, and Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-900 text-xs font-mono">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider shrink-0">
                Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => handleSelectStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-teal-500 w-full"
              >
                <option value="all">All Statuses ({summary.total})</option>
                <option value="published">Published / Active ({summary.published})</option>
                <option value="draft">Draft ({summary.draft})</option>
                <option value="pending">Pending Approval ({summary.pending})</option>
                <option value="suspended">Suspended / Paused ({summary.suspended})</option>
              </select>
            </div>

            {/* Dynamic Destination Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                <MapPin size={12} />
                <span>Destination:</span>
              </span>
              <select
                value={destinationFilter}
                onChange={(e) => handleSelectDestination(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-teal-500 w-full"
              >
                <option value="all">All Destinations ({destinations.length} locations)</option>
                {destinations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Tag size={12} />
                <span>Category:</span>
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => handleSelectCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-teal-500 w-full"
              >
                <option value="all">All Categories ({categories.length} types)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Operational Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-mono text-slate-400">Loading MozBook activities & trips from Firestore...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Compass className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No experiences found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No experiences matched "${searchQuery}".`
                  : 'There are no activities or trips matching your active filter criteria.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-teal-400 font-semibold cursor-pointer"
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
                    <th className="py-3.5 px-4 font-semibold">Experience</th>
                    <th className="py-3.5 px-4 font-semibold">Type</th>
                    <th className="py-3.5 px-4 font-semibold">Host</th>
                    <th className="py-3.5 px-4 font-semibold">Destination</th>
                    <th className="py-3.5 px-4 font-semibold">Category</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Duration</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Capacity</th>
                    <th className="py-3.5 px-4 font-semibold">Price</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Bookings</th>
                    <th className="py-3.5 px-4 font-semibold">Created</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredActivities.map((item) => {
                    const st = (item.status || '').toLowerCase();
                    const isPublished = st === 'published' || st === 'active';
                    const hasSpecialOffer = item.specialOffer && item.specialOffer.enabled;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        {/* Cover image & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {item.coverImage || (item.images && item.images.length > 0) ? (
                              <img
                                src={item.coverImage || item.images[0]}
                                alt=""
                                className="w-12 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-10 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                                <Compass size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-xs group-hover:text-teal-400 transition-colors">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                                <span>ID: {item.id.slice(0, 10)}...</span>
                                {item.vehicleType && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 truncate max-w-[120px]">
                                    {item.vehicleType.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4">
                          {item.type === 'trip' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-mono font-bold">
                              <Anchor size={11} />
                              <span>Trip & Tour</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono font-bold">
                              <Palmtree size={11} />
                              <span>Activity</span>
                            </span>
                          )}
                        </td>

                        {/* Host */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-300 truncate">
                                {item.hostName || 'Host'}
                              </span>
                              {item.isHostVerified && (
                                <ShieldCheck size={12} className="text-emerald-400 shrink-0" title="Verified Host" />
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              {item.hostEmail || `UID: ${item.hostId.slice(0, 8)}...`}
                            </p>
                          </div>
                        </td>

                        {/* Destination */}
                        <td className="py-3.5 px-4">
                          <p className="text-slate-300 font-medium truncate max-w-[120px]">
                            {item.city || '—'}
                          </p>
                          {item.meetingPoint && (
                            <p className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                              {item.meetingPoint}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                            {item.category || 'Experience'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isPublished ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Active</span>
                            </span>
                          ) : st === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
                              <span>Pending</span>
                            </span>
                          ) : st === 'draft' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[11px]">
                              <span>Draft</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[11px] font-bold">
                              <span>Paused</span>
                            </span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {item.duration || (item.multiDayDetails ? `${item.multiDayDetails.days} days` : '—')}
                        </td>

                        {/* Capacity */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="text-slate-300 font-bold">
                            {item.maxGuests}
                          </span>
                          {item.minGuests && item.minGuests > 1 && (
                            <span className="text-[10px] text-slate-500 block">
                              min {item.minGuests}
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 font-mono">
                          {hasSpecialOffer && item.specialOffer?.specialPrice ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="line-through text-slate-500 text-[10px]">
                                  MZN {item.priceAdult.toLocaleString()}
                                </span>
                                {item.specialOffer.discountPercent && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                                    {item.specialOffer.discountPercent}% OFF
                                  </span>
                                )}
                              </div>
                              <span className="text-teal-400 font-bold text-xs">
                                MZN {item.specialOffer.specialPrice.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-white font-bold text-xs">
                                MZN {(item.priceAdult || item.priceGroup || item.pricePerBooking || 0).toLocaleString()}
                              </span>
                              <span className="text-[9px] text-slate-500 block">
                                {item.pricingType ? item.pricingType.replace('_', ' ') : 'per person'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Bookings */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className={item.totalBookings > 0 ? 'text-purple-400 font-bold text-xs' : 'text-slate-500'}>
                            {item.totalBookings}
                          </span>
                          {item.upcomingBookings > 0 && (
                            <span className="block text-[9px] text-teal-400 font-semibold">
                              {item.upcomingBookings} upcoming
                            </span>
                          )}
                        </td>

                        {/* Created */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-400 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            <Link
                              to={`/admin/hosts`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-semibold transition-colors"
                              title="Go to host in Admin Hosts"
                            >
                              <Users size={12} />
                            </Link>
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
              Showing {filteredActivities.length} of {activities.length} experiences
            </span>
            <span className="text-slate-600">
              Operational directory synthesized from host-created activities, excursions, and booking reservations.
            </span>
          </div>
        </div>

        {/* Experience Detail Drawer / Modal */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Top Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl">
                    <Compass size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white truncate max-w-md">
                      {selectedItem.title}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      MozBook Experience Administration Record
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/trips"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="View on customer marketplace"
                  >
                    <span>Marketplace</span>
                    <ExternalLink size={13} />
                  </Link>

                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close experience detail"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Photo Gallery Banner */}
                {selectedItem.images && selectedItem.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="aspect-[21/9] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative">
                      <img
                        src={selectedItem.coverImage || selectedItem.images[0]}
                        alt={selectedItem.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-md">
                        Cover Photo
                      </span>
                    </div>

                    {selectedItem.images.length > 1 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {selectedItem.images.slice(1, 7).map((imgUrl, i) => (
                          <div key={i} className="aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                            <img
                              src={imgUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section 1: BASIC INFORMATION */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Basic Information
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block">Experience Title</span>
                      <p className="text-slate-100 font-sans font-bold text-sm mt-0.5">
                        {selectedItem.title}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Experience ID</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-300 truncate max-w-[200px]">{selectedItem.id}</span>
                        <button
                          onClick={() => handleCopyId(selectedItem.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Type & Category</span>
                      <p className="text-slate-200 mt-0.5 capitalize font-semibold">
                        {selectedItem.type === 'trip' ? 'Trip & Tour' : 'Activity'} • {selectedItem.category}
                      </p>
                    </div>

                    {selectedItem.shortDescription && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 text-[10px] uppercase block">Short Summary</span>
                        <p className="text-slate-300 font-sans text-xs mt-0.5 leading-relaxed">
                          {selectedItem.shortDescription}
                        </p>
                      </div>
                    )}

                    {selectedItem.description && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase block">Full Description</span>
                        <p className="text-slate-300 font-sans text-xs mt-1 leading-relaxed whitespace-pre-line">
                          {selectedItem.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: HOST ASSIGNMENT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Host Assignment
                    </h4>
                    <Link
                      to={`/admin/hosts`}
                      className="text-xs font-mono text-teal-400 hover:text-teal-300 flex items-center gap-1"
                    >
                      <span>Admin Hosts</span>
                      <ChevronRight size={13} />
                    </Link>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host Name</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-200 font-bold font-sans">
                          {selectedItem.hostName || 'Host'}
                        </span>
                        {selectedItem.isHostVerified && (
                          <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold">
                            VERIFIED
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host Email</span>
                      <p className="text-slate-300 mt-0.5 truncate">
                        {selectedItem.hostEmail || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host Phone</span>
                      <p className="text-slate-300 mt-0.5">
                        {selectedItem.hostPhone || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host UID</span>
                      <p className="text-slate-400 mt-0.5 font-mono truncate">
                        {selectedItem.hostId || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: LOCATION & MEETING POINT */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Location, Meeting Point & Pickup
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Destination / City</span>
                      <p className="text-slate-200 font-bold font-sans mt-0.5">
                        {selectedItem.city || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Pickup Offered</span>
                      <p className="text-slate-200 mt-0.5 font-semibold">
                        {selectedItem.pickup?.offered ? (
                          <span className="text-emerald-400">Yes (Fee: MZN {selectedItem.pickup.fee || 0})</span>
                        ) : (
                          <span className="text-slate-400">No pickup offered</span>
                        )}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block">Meeting Point</span>
                      <p className="text-slate-200 font-sans mt-0.5">
                        {selectedItem.meetingPoint || '—'}
                      </p>
                      {selectedItem.meetingPointInstructions && (
                        <p className="text-[11px] text-slate-400 font-sans mt-1 italic">
                          "{selectedItem.meetingPointInstructions}"
                        </p>
                      )}
                    </div>

                    {selectedItem.pickup?.offered && selectedItem.pickup.areas && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase block">Pickup Coverage & Instructions</span>
                        <p className="text-slate-300 font-sans text-xs mt-0.5">
                          {selectedItem.pickup.areas}
                        </p>
                        {selectedItem.pickup.instructions && (
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                            {selectedItem.pickup.instructions}
                          </p>
                        )}
                      </div>
                    )}

                    {selectedItem.coordinates && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-900 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-[10px] uppercase block">GPS Coordinates</span>
                          <span className="text-slate-300 font-mono">
                            Lat: {selectedItem.coordinates.lat.toFixed(5)}, Lng: {selectedItem.coordinates.lng.toFixed(5)}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${selectedItem.coordinates.lat},${selectedItem.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px]"
                        >
                          <span>Open in Maps</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: SCHEDULE & CAPACITY */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Schedule & Guest Capacity
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Duration</span>
                      <p className="text-white font-bold mt-0.5">{selectedItem.duration || '—'}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Schedule Type</span>
                      <p className="text-slate-300 mt-0.5 capitalize">{selectedItem.scheduleType || 'recurring'}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Max Guests</span>
                      <p className="text-teal-400 font-bold text-base mt-0.5">{selectedItem.maxGuests}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Min Guests</span>
                      <p className="text-slate-300 font-bold text-base mt-0.5">{selectedItem.minGuests || 1}</p>
                    </div>

                    {selectedItem.startTimes && selectedItem.startTimes.length > 0 && (
                      <div className="col-span-2 pt-2 border-t border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase block mb-1">Departure / Start Times</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedItem.startTimes.map((time, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-200 rounded text-[11px]">
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.recurringDays && selectedItem.recurringDays.length > 0 && (
                      <div className="col-span-2 pt-2 border-t border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase block mb-1">Operating Days</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedItem.recurringDays.map((day, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded text-[10px]">
                              {day.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 5: PRICING & SPECIAL OFFERS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Pricing Matrix & Promotional Offers
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Adult Rate</span>
                        <p className="text-white font-bold text-base mt-0.5">
                          {selectedItem.currency} {selectedItem.priceAdult?.toLocaleString() || '0'}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Child Rate</span>
                        <p className="text-slate-300 font-bold mt-0.5">
                          {selectedItem.priceChild ? `${selectedItem.currency} ${selectedItem.priceChild.toLocaleString()}` : '—'}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Group / Charter</span>
                        <p className="text-slate-300 font-bold mt-0.5">
                          {selectedItem.priceGroup ? `${selectedItem.currency} ${selectedItem.priceGroup.toLocaleString()}` : '—'}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Pricing Model</span>
                        <p className="text-teal-400 font-bold capitalize mt-0.5">
                          {selectedItem.pricingType ? selectedItem.pricingType.replace('_', ' ') : 'per person'}
                        </p>
                      </div>
                    </div>

                    {/* Special Offer Breakdown */}
                    {selectedItem.specialOffer && selectedItem.specialOffer.enabled ? (
                      <div className="p-3.5 bg-teal-950/30 border border-teal-500/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-teal-400 font-bold uppercase text-[11px] flex items-center gap-1.5">
                            <Sparkles size={14} />
                            <span>Special Promotional Offer Active</span>
                          </span>
                          {selectedItem.specialOffer.discountPercent && (
                            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                              {selectedItem.specialOffer.discountPercent}% OFF
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 text-[10px] block">Offer Name:</span>
                            <span className="text-slate-200 font-bold">{selectedItem.specialOffer.offerName || 'Promotion'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Special Price:</span>
                            <span className="text-teal-400 font-bold">
                              MZN {selectedItem.specialOffer.specialPrice?.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Seasonal Tag:</span>
                            <span className="text-slate-300">
                              {selectedItem.specialOffer.seasonalTag || 'Featured'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-900/60 rounded-xl text-slate-500 text-[11px]">
                        No active promotional discounts or seasonal pricing configured for this experience.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 6: TRIP-SPECIFIC / VEHICLE INFORMATION */}
                {(selectedItem.type === 'trip' || selectedItem.vehicleType || selectedItem.multiDayDetails) && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Anchor size={14} />
                      <span>Trip & Expedition Details</span>
                    </h4>
                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      {selectedItem.vehicleType && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 text-[10px] uppercase block">Vehicle / Craft / Vessel</span>
                          <p className="text-slate-200 font-semibold font-sans mt-0.5 flex items-center gap-1.5">
                            <Car size={14} className="text-purple-400" />
                            <span>{selectedItem.vehicleType}</span>
                          </p>
                        </div>
                      )}

                      {selectedItem.multiDayDetails && (
                        <>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase block">Days</span>
                            <p className="text-white font-bold text-sm mt-0.5">{selectedItem.multiDayDetails.days} Days</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase block">Nights</span>
                            <p className="text-white font-bold text-sm mt-0.5">{selectedItem.multiDayDetails.nights} Nights</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 7: INCLUSIONS, EXCLUSIONS & REQUIREMENTS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Inclusions, Exclusions & Safety Requirements
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* What's included */}
                      <div>
                        <span className="text-emerald-400 text-[11px] font-bold uppercase block mb-1 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          <span>Included</span>
                        </span>
                        {selectedItem.included && selectedItem.included.length > 0 ? (
                          <ul className="space-y-1 text-slate-300 font-sans text-[11px]">
                            {selectedItem.included.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-emerald-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 font-sans">—</span>
                        )}
                      </div>

                      {/* What's not included */}
                      <div>
                        <span className="text-rose-400 text-[11px] font-bold uppercase block mb-1 flex items-center gap-1">
                          <XCircle size={13} />
                          <span>Not Included</span>
                        </span>
                        {selectedItem.notIncluded && selectedItem.notIncluded.length > 0 ? (
                          <ul className="space-y-1 text-slate-300 font-sans text-[11px]">
                            {selectedItem.notIncluded.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-rose-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 font-sans">—</span>
                        )}
                      </div>
                    </div>

                    {/* Requirements & What to bring */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-900">
                      <div>
                        <span className="text-amber-400 text-[11px] font-bold uppercase block mb-1 flex items-center gap-1">
                          <AlertTriangle size={13} />
                          <span>Customer Requirements</span>
                        </span>
                        {selectedItem.requirements && selectedItem.requirements.length > 0 ? (
                          <ul className="space-y-1 text-slate-300 font-sans text-[11px]">
                            {selectedItem.requirements.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 font-sans">—</span>
                        )}
                      </div>

                      <div>
                        <span className="text-blue-400 text-[11px] font-bold uppercase block mb-1 flex items-center gap-1">
                          <HelpCircle size={13} />
                          <span>What to Bring</span>
                        </span>
                        {selectedItem.whatToBring && selectedItem.whatToBring.length > 0 ? (
                          <ul className="space-y-1 text-slate-300 font-sans text-[11px]">
                            {selectedItem.whatToBring.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-blue-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 font-sans">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 8: BOOKINGS OVERVIEW */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Booking Activity & Guest Traffic
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 gap-4 text-center font-mono">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <Calendar size={18} className="text-purple-400 mx-auto mb-1" />
                      <span className="text-2xl font-black text-white block">
                        {selectedItem.totalBookings}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Bookings</span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <Clock size={18} className="text-teal-400 mx-auto mb-1" />
                      <span className="text-2xl font-black text-teal-400 block">
                        {selectedItem.upcomingBookings}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Upcoming Departures</span>
                    </div>
                  </div>
                </div>

                {/* Safety Note on Actions */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-500 font-mono">
                  <Shield size={14} className="text-slate-400 inline mr-1.5" />
                  <span>
                    Administrative READ view. Experience editing, approval/rejection workflows, and suspension are locked in Phase 2D.
                  </span>
                </div>
              </div>

              {/* Modal Bottom Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 flex items-center justify-between">
                <Link
                  to="/trips"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  <span>View in Customer Marketplace</span>
                </Link>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
