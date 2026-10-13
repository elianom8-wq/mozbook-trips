import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Home,
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
  Bed,
  Users,
  Tag,
  Clock,
  AlertCircle,
  Building,
  DollarSign
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminProperty } from '../../types/admin';

export default function AdminProperties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const initialDestination = searchParams.get('destination') || 'all';
  const hostIdParam = searchParams.get('hostId') || '';

  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [destinationFilter, setDestinationFilter] = useState<string>(initialDestination);
  const [activeHostFilter, setActiveHostFilter] = useState<string>(hostIdParam);

  // Detail Modal / Drawer state
  const [selectedProperty, setSelectedProperty] = useState<AdminProperty | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Sync state with URL params
  useEffect(() => {
    const sParam = searchParams.get('status');
    if (sParam) setStatusFilter(sParam.toLowerCase());

    const dParam = searchParams.get('destination');
    if (dParam) setDestinationFilter(dParam);

    const hParam = searchParams.get('hostId');
    if (hParam !== null) setActiveHostFilter(hParam);
  }, [searchParams]);

  const loadProperties = async () => {
    try {
      const data = await adminService.getAllProperties();
      setProperties(data);
    } catch (err) {
      console.error('Error loading properties:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProperties();
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

  // Unique destinations found in real listings
  const destinations = useMemo(() => {
    const set = new Set<string>();
    properties.forEach((p) => {
      const dest = p.city || p.location.split(',')[0]?.trim();
      if (dest) set.add(dest);
    });
    return Array.from(set).sort();
  }, [properties]);

  // Real KPI counts
  const summary = useMemo(() => {
    let published = 0;
    let draft = 0;
    let pending = 0;
    let suspended = 0;

    properties.forEach((p) => {
      const st = (p.status || '').toLowerCase();
      if (st === 'draft') draft++;
      else if (st === 'pending' || st === 'pending_approval') pending++;
      else if (st === 'suspended' || st === 'inactive') suspended++;
      else published++; // default active in MozBook
    });

    return {
      total: properties.length,
      published,
      draft,
      pending,
      suspended,
    };
  }, [properties]);

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 1. Host filter
      if (activeHostFilter && p.hostId !== activeHostFilter) {
        return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        const st = (p.status || '').toLowerCase();
        if (statusFilter === 'published' && !(st === 'published' || st === 'active')) return false;
        if (statusFilter === 'draft' && st !== 'draft') return false;
        if (statusFilter === 'pending' && !(st === 'pending' || st === 'pending_approval')) return false;
        if (statusFilter === 'suspended' && !(st === 'suspended' || st === 'inactive')) return false;
      }

      // 3. Destination filter
      if (destinationFilter !== 'all') {
        const dest = p.city || p.location;
        if (!dest.toLowerCase().includes(destinationFilter.toLowerCase())) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const hostNameMatch = (p.hostName || '').toLowerCase().includes(q);
        const hostEmailMatch = (p.hostEmail || '').toLowerCase().includes(q);
        const idMatch = (p.id || '').toLowerCase().includes(q);
        const locationMatch = (p.location || '').toLowerCase().includes(q);
        const cityMatch = (p.city || '').toLowerCase().includes(q);
        return titleMatch || hostNameMatch || hostEmailMatch || idMatch || locationMatch || cityMatch;
      }

      return true;
    });
  }, [properties, activeHostFilter, statusFilter, destinationFilter, searchQuery]);

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
              <span className="text-xs font-mono text-emerald-400 font-semibold">Properties</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Property Inventory
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Operational directory of registered MozBook stays, lodge accommodations, and special offers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Inventory'}</span>
            </button>
          </div>
        </div>

        {/* Host Filter Banner if hostIdParam present */}
        {activeHostFilter && (
          <div className="p-3.5 bg-slate-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400 font-bold uppercase font-mono text-[10px]">Filter Active:</span>
              <span>Showing properties owned by Host UID: <span className="font-mono text-white font-bold">{activeHostFilter}</span></span>
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Properties */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Total Properties
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : summary.total.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                All platform stays
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Home size={22} />
            </div>
          </div>

          {/* Published / Active */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Published / Active
              </span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                {loading ? '—' : summary.published.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Live on marketplace
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
          </div>

          {/* Drafts */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Drafts
              </span>
              <p className="text-2xl sm:text-3xl font-black text-slate-400 mt-1">
                {loading ? '—' : summary.draft.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Unpublished listings
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-400 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
          </div>

          {/* Pending Approval */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Pending Approval
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                {loading ? '—' : summary.pending.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                In moderation queue
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle size={22} />
            </div>
          </div>

          {/* Suspended / Inactive */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Suspended / Inactive
              </span>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
                {loading ? '—' : summary.suspended.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Offline properties
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Building size={22} />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Properties', count: summary.total },
                { id: 'published', label: 'Published / Active', count: summary.published },
                { id: 'draft', label: 'Draft', count: summary.draft },
                { id: 'pending', label: 'Pending Approval', count: summary.pending },
                { id: 'suspended', label: 'Suspended / Inactive', count: summary.suspended },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleSelectStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-emerald-600 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      statusFilter === tab.id
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
                placeholder="Search title, host, ID, or location..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
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

          {/* Secondary Destination Filter */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-xs font-mono overflow-x-auto">
            <span className="text-slate-500 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
              <MapPin size={13} />
              <span>Destination:</span>
            </span>
            <button
              onClick={() => handleSelectDestination('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                destinationFilter === 'all'
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              All Destinations
            </button>
            {destinations.map((dest) => (
              <button
                key={dest}
                onClick={() => handleSelectDestination(dest)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                  destinationFilter === dest
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>

        {/* Property Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-mono text-slate-400">Loading MozBook property inventory from Firestore...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Home className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No properties found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No listings matched "${searchQuery}".`
                  : 'There are no property records matching your active filters.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-emerald-400 font-semibold cursor-pointer"
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
                    <th className="py-3.5 px-4 font-semibold">Property</th>
                    <th className="py-3.5 px-4 font-semibold">Host</th>
                    <th className="py-3.5 px-4 font-semibold">Location</th>
                    <th className="py-3.5 px-4 font-semibold">Property Type</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Price / Night</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Bookings</th>
                    <th className="py-3.5 px-4 font-semibold">Created</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProperties.map((p) => {
                    const st = (p.status || '').toLowerCase();
                    const isPublished = st === 'published' || st === 'active';
                    const hasSpecialOffer = p.specialOffer && p.specialOffer.enabled;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedProperty(p)}
                      >
                        {/* Property Thumbnail & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {p.images && p.images.length > 0 ? (
                              <img
                                src={p.images[0]}
                                alt=""
                                className="w-12 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-12 h-10 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                                <Home size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-xs group-hover:text-emerald-400 transition-colors">
                                {p.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                                <span>ID: {p.id.slice(0, 10)}...</span>
                                {p.residenceType === 'lodge' && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                    LODGE
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Host */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-300 truncate">
                                {p.hostName || 'Host'}
                              </span>
                              {p.isHostVerified && (
                                <ShieldCheck size={12} className="text-emerald-400 shrink-0" title="Verified Host" />
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              {p.hostEmail || `UID: ${p.hostId.slice(0, 8)}...`}
                            </p>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4">
                          <p className="text-slate-300 font-medium truncate max-w-[140px]">
                            {p.city || p.location}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 truncate">
                            {p.province || p.country}
                          </p>
                        </td>

                        {/* Property Type */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono capitalize">
                            {p.residenceType ? p.residenceType.replace('_', ' ') : 'Stay'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isPublished ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>Active</span>
                            </span>
                          ) : st === 'pending' || st === 'pending_approval' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
                              <span>Pending</span>
                            </span>
                          ) : st === 'draft' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[11px]">
                              <span>Draft</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[11px] font-bold">
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 font-mono">
                          {hasSpecialOffer ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="line-through text-slate-500 text-[10px]">
                                  MZN {p.price.toLocaleString()}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                                  {p.specialOffer.discountPercent}% OFF
                                </span>
                              </div>
                              <span className="text-emerald-400 font-bold text-xs">
                                MZN {p.specialOffer.specialPrice.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white font-bold text-xs">
                              MZN {p.price.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Bookings */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className={p.totalBookings > 0 ? 'text-purple-400 font-bold text-xs' : 'text-slate-500'}>
                            {p.totalBookings}
                          </span>
                          {p.upcomingBookings > 0 && (
                            <span className="block text-[9px] text-emerald-400 font-semibold">
                              {p.upcomingBookings} upcoming
                            </span>
                          )}
                        </td>

                        {/* Created */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(p.createdAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProperty(p);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
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
              Showing {filteredProperties.length} of {properties.length} property records
            </span>
            <span className="text-slate-600">
              Operational property directory synthesized from listings and real booking reservations.
            </span>
          </div>
        </div>

        {/* Property Detail Drawer / Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Top Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <Home size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white truncate max-w-md">
                      {selectedProperty.title}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      MozBook Listing Administration Record
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/listing/${selectedProperty.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="View live listing on marketplace"
                  >
                    <span>Marketplace</span>
                    <ExternalLink size={13} />
                  </a>

                  <button
                    onClick={() => setSelectedProperty(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close property detail"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Photo Gallery Banner */}
                {selectedProperty.images && selectedProperty.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="aspect-[21/9] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative">
                      <img
                        src={selectedProperty.images[0]}
                        alt={selectedProperty.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-md">
                        Cover Image
                      </span>
                    </div>

                    {selectedProperty.images.length > 1 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {selectedProperty.images.slice(1, 7).map((imgUrl, i) => (
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

                {/* Section 1: PROPERTY OVERVIEW */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Property Overview & Location
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block">Title</span>
                      <p className="text-slate-100 font-sans font-bold text-sm mt-0.5">
                        {selectedProperty.title}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Listing ID</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-300 truncate max-w-[200px]">{selectedProperty.id}</span>
                        <button
                          onClick={() => handleCopyId(selectedProperty.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Copy Listing ID"
                        >
                          {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Property Type</span>
                      <p className="text-slate-200 mt-0.5 capitalize font-semibold">
                        {selectedProperty.residenceType ? selectedProperty.residenceType.replace('_', ' ') : 'Stay'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Location / City</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedProperty.city || selectedProperty.location}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Province / Country</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedProperty.province ? `${selectedProperty.province}, ` : ''}{selectedProperty.country || 'Mozambique'}
                      </p>
                    </div>

                    {selectedProperty.coordinates && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-900 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-[10px] uppercase block">GPS Coordinates</span>
                          <span className="text-slate-300 font-mono">
                            Lat: {selectedProperty.coordinates.lat.toFixed(5)}, Lng: {selectedProperty.coordinates.lng.toFixed(5)}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${selectedProperty.coordinates.lat},${selectedProperty.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-lg border border-slate-800 flex items-center gap-1 text-[11px]"
                        >
                          <span>Open in Maps</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}

                    {selectedProperty.description && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-900">
                        <span className="text-slate-500 text-[10px] uppercase block">Description</span>
                        <p className="text-slate-300 font-sans text-xs mt-1 leading-relaxed whitespace-pre-line">
                          {selectedProperty.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: HOST INFORMATION */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Host Assignment
                    </h4>
                    <Link
                      to={`/admin/hosts`}
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
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
                          {selectedProperty.hostName || 'Host record unavailable'}
                        </span>
                        {selectedProperty.isHostVerified && (
                          <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold">
                            VERIFIED
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host Email</span>
                      <p className="text-slate-300 mt-0.5 truncate">
                        {selectedProperty.hostEmail || '—'}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-slate-500 text-[10px] uppercase block">Host UID</span>
                      <p className="text-slate-400 mt-0.5 font-mono">
                        {selectedProperty.hostId || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: PRICING & SPECIAL OFFERS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Pricing & Promotional Rates
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Base Nightly Rate</span>
                        <p className="text-white font-bold text-base mt-0.5">
                          {selectedProperty.currency} {selectedProperty.price.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Minimum Stay</span>
                        <p className="text-slate-300 mt-0.5 font-bold">
                          {selectedProperty.minNights || 1} nights
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block">Listing Status</span>
                        <p className="text-emerald-400 font-bold uppercase mt-0.5">
                          {selectedProperty.status}
                        </p>
                      </div>
                    </div>

                    {/* Special Offer / Seasonal Pricing Details */}
                    {selectedProperty.specialOffer && selectedProperty.specialOffer.enabled ? (
                      <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-bold uppercase text-[11px] flex items-center gap-1.5">
                            <Sparkles size={14} />
                            <span>Special Promotional Offer Active</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                            {selectedProperty.specialOffer.discountPercent}% OFF
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 text-[10px] block">Offer Name:</span>
                            <span className="text-slate-200 font-bold">{selectedProperty.specialOffer.offerName || 'Promotion'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Discounted Rate:</span>
                            <span className="text-emerald-400 font-bold">
                              MZN {selectedProperty.specialOffer.specialPrice.toLocaleString()} / night
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Schedule Range:</span>
                            <span className="text-slate-300">
                              {selectedProperty.specialOffer.startDate} to {selectedProperty.specialOffer.endDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-900/60 rounded-xl text-slate-500 text-[11px]">
                        No active promotional discounts or seasonal rates configured for this listing.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: ACCOMMODATIONS & MULTI-UNIT SUPPORT */}
                {selectedProperty.accommodations && selectedProperty.accommodations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Layers size={14} />
                        <span>Accommodation Units & Room Types ({selectedProperty.totalLodgeUnits || selectedProperty.accommodations.length} total units)</span>
                      </h4>
                    </div>

                    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 divide-y divide-slate-800/60">
                      {selectedProperty.accommodations.map((acc, idx) => (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-sans">{acc.name || acc.title}</span>
                              {acc.canonicalUnitType && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase">
                                  {acc.canonicalUnitType.replace('_', ' ')}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                {acc.units || 1} {Number(acc.units) === 1 ? 'unit' : 'units'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                              {acc.description || `Capacity: ${acc.maxGuests || 2} guests (${acc.adults || 2} adults, ${acc.children || 0} children)`}
                            </p>
                          </div>
                          <div className="text-right sm:text-right shrink-0">
                            <span className="text-emerald-400 font-bold text-sm block">
                              MZN {Number(acc.price || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500">per unit / night</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: BOOKINGS OVERVIEW */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Property Booking Activity
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 gap-4 text-center font-mono">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <Calendar size={18} className="text-purple-400 mx-auto mb-1" />
                      <span className="text-2xl font-black text-white block">
                        {selectedProperty.totalBookings}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Bookings</span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <Clock size={18} className="text-emerald-400 mx-auto mb-1" />
                      <span className="text-2xl font-black text-emerald-400 block">
                        {selectedProperty.upcomingBookings}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Upcoming Stays</span>
                    </div>
                  </div>
                </div>

                {/* Security Note on Actions */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-500 font-mono">
                  <Shield size={14} className="text-slate-400 inline mr-1.5" />
                  <span>
                    Administrative READ view. Property modification, pricing changes, and approval workflows are locked in Phase 2C.
                  </span>
                </div>
              </div>

              {/* Modal Bottom Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 flex items-center justify-between">
                <a
                  href={`/listing/${selectedProperty.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  <span>View Live in Marketplace</span>
                </a>

                <button
                  onClick={() => setSelectedProperty(null)}
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
