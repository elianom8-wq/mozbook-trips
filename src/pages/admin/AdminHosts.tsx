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
  Phone,
  MapPin,
  Copy,
  Check,
  Compass,
  CalendarCheck,
  ArrowLeft,
  ChevronRight,
  Shield,
  FileCheck2,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminHost } from '../../types/admin';

export default function AdminHosts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  const initialInventory = searchParams.get('inventory') || 'all';

  const [hosts, setHosts] = useState<AdminHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [inventoryFilter, setInventoryFilter] = useState<string>(initialInventory);

  // Detail Modal / Drawer state
  const [selectedHost, setSelectedHost] = useState<AdminHost | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync filters with URL query parameters
  useEffect(() => {
    const fParam = searchParams.get('filter');
    if (fParam && ['all', 'verified', 'pending', 'rejected', 'expiring'].includes(fParam.toLowerCase())) {
      setStatusFilter(fParam.toLowerCase());
    }
    const invParam = searchParams.get('inventory');
    if (invParam && ['all', 'properties', 'activities', 'both'].includes(invParam.toLowerCase())) {
      setInventoryFilter(invParam.toLowerCase());
    }
  }, [searchParams]);

  const loadHosts = async () => {
    try {
      const data = await adminService.getAllHosts();
      setHosts(data);
    } catch (err) {
      console.error('Error loading hosts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHosts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHosts();
  };

  const handleSelectStatusFilter = (filter: string) => {
    setStatusFilter(filter);
    if (filter === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', filter);
    }
    setSearchParams(searchParams);
  };

  const handleSelectInventoryFilter = (inv: string) => {
    setInventoryFilter(inv);
    if (inv === 'all') {
      searchParams.delete('inventory');
    } else {
      searchParams.set('inventory', inv);
    }
    setSearchParams(searchParams);
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  // Safe Date Formatter helper
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

  // Summary counts computed from real Firestore records
  const summary = useMemo(() => {
    let verified = 0;
    let pending = 0;
    let rejected = 0;
    let suspended = 0;
    let expiring = 0;

    hosts.forEach((h) => {
      if (h.verificationStatus === 'verified') verified++;
      else if (h.verificationStatus === 'pending') pending++;
      else if (h.verificationStatus === 'rejected') rejected++;
      else if (h.verificationStatus === 'suspended' || h.accountStatus === 'suspended') suspended++;

      if (
        h.expiryStatus === 'expiring_soon' ||
        h.expiryStatus === 'expired' ||
        h.isExpired === true
      ) {
        expiring++;
      }
    });

    return {
      total: hosts.length,
      verified,
      pending,
      rejected,
      suspended,
      expiring,
    };
  }, [hosts]);

  // Filtered and searched host records
  const filteredHosts = useMemo(() => {
    return hosts.filter((h) => {
      // 1. Status Filter
      if (statusFilter === 'verified' && h.verificationStatus !== 'verified') return false;
      if (statusFilter === 'pending' && h.verificationStatus !== 'pending') return false;
      if (statusFilter === 'rejected' && h.verificationStatus !== 'rejected') return false;
      if (statusFilter === 'suspended' && h.verificationStatus !== 'suspended' && h.accountStatus !== 'suspended') return false;
      if (statusFilter === 'expiring') {
        const isExp =
          h.expiryStatus === 'expiring_soon' ||
          h.expiryStatus === 'expired' ||
          h.isExpired === true;
        if (!isExp) return false;
      }

      // 2. Inventory Filter
      if (inventoryFilter === 'properties' && h.propertiesCount === 0) return false;
      if (inventoryFilter === 'activities' && h.activitiesCount === 0) return false;
      if (inventoryFilter === 'both' && (h.propertiesCount === 0 || h.activitiesCount === 0)) return false;

      // 3. Search query (name, email, UID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = (h.name || '').toLowerCase().includes(query);
        const emailMatch = (h.email || '').toLowerCase().includes(query);
        const uidMatch = (h.uid || '').toLowerCase().includes(query);
        return nameMatch || emailMatch || uidMatch;
      }

      return true;
    });
  }, [hosts, statusFilter, inventoryFilter, searchQuery]);

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
              <span className="text-xs font-mono text-emerald-400 font-semibold">Hosts</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Host Management
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Operational directory of MozBook property & tour hosts, compliance statuses, and inventory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/verifications"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-colors shadow-xs"
            >
              <FileCheck2 size={15} />
              <span>Compliance Portal</span>
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Hosts'}</span>
            </button>
          </div>
        </div>

        {/* Host Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Hosts */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Total Hosts
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : summary.total.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Platform providers
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Home size={22} />
            </div>
          </div>

          {/* Verified Hosts */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Verified Hosts
              </span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                {loading ? '—' : summary.verified.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Compliant & approved
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
          </div>

          {/* Pending Verification */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Pending
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                {loading ? '—' : summary.pending.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Requires review
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
          </div>

          {/* Rejected */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Rejected
              </span>
              <p className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
                {loading ? '—' : summary.rejected.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Non-compliant
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <XCircle size={22} />
            </div>
          </div>

          {/* Expiring / Expired */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Expiring / Expired
              </span>
              <p className="text-2xl sm:text-3xl font-black text-orange-400 mt-1">
                {loading ? '—' : summary.expiring.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Document alert
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Hosts', count: summary.total },
                { id: 'verified', label: 'Verified', count: summary.verified },
                { id: 'pending', label: 'Pending', count: summary.pending },
                { id: 'rejected', label: 'Rejected', count: summary.rejected },
                { id: 'suspended', label: 'Suspended', count: summary.suspended },
                { id: 'expiring', label: 'Expiring / Expired', count: summary.expiring },
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
                placeholder="Search host name, email, or UID..."
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

          {/* Secondary Inventory Filter */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-900 text-xs font-mono">
            <span className="text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Layers size={13} />
              <span>Inventory Type:</span>
            </span>
            {[
              { id: 'all', label: 'All Inventory' },
              { id: 'properties', label: 'Property Hosts' },
              { id: 'activities', label: 'Activity & Trip Hosts' },
              { id: 'both', label: 'Both' },
            ].map((inv) => (
              <button
                key={inv.id}
                onClick={() => handleSelectInventoryFilter(inv.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  inventoryFilter === inv.id
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {inv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Host Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-mono text-slate-400">Loading MozBook hosts from platform collections...</p>
            </div>
          ) : filteredHosts.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Home className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No hosts found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No hosts matched your search "${searchQuery}".`
                  : 'There are no host records in this category.'}
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
                    <th className="py-3.5 px-4 font-semibold">Host</th>
                    <th className="py-3.5 px-4 font-semibold">Email</th>
                    <th className="py-3.5 px-4 font-semibold">Verification Status</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Properties</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Activities</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Bookings</th>
                    <th className="py-3.5 px-4 font-semibold">Account Status</th>
                    <th className="py-3.5 px-4 font-semibold">Joined</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHosts.map((h) => {
                    const isExpiringOrExpired =
                      h.expiryStatus === 'expiring_soon' ||
                      h.expiryStatus === 'expired' ||
                      h.isExpired === true;

                    return (
                      <tr
                        key={h.uid}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedHost(h)}
                      >
                        {/* Host Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {h.photoURL ? (
                              <img
                                src={h.photoURL}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                {(h.name || h.email || 'H').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                                {h.name || 'Unnamed Host'}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">
                                UID: {h.uid.slice(0, 10)}...
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {h.email || '—'}
                        </td>

                        {/* Verification Status Badge */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {h.verificationStatus === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                                <ShieldCheck size={11} />
                                <span>Verified</span>
                              </span>
                            ) : h.verificationStatus === 'suspended' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
                                <AlertTriangle size={11} />
                                <span>Suspended</span>
                              </span>
                            ) : h.verificationStatus === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold">
                                <Clock size={11} />
                                <span>Pending</span>
                              </span>
                            ) : h.verificationStatus === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[11px] font-bold">
                                <XCircle size={11} />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[11px]">
                                <span>Unverified</span>
                              </span>
                            )}

                            {h.inGracePeriod && (
                              <span className="text-[9px] font-mono text-amber-400 flex items-center gap-0.5">
                                <Clock size={10} />
                                <span>Grace Period ({h.gracePeriodDaysRemaining}d left)</span>
                              </span>
                            )}

                            {isExpiringOrExpired && !h.inGracePeriod && (
                              <span className="text-[9px] font-mono text-orange-400 flex items-center gap-0.5">
                                <AlertTriangle size={10} />
                                <span>{h.expiryStatus === 'expired' || h.isExpired ? 'Doc Expired' : 'Expiring Soon'}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Properties count */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          {h.propertiesCount > 0 ? (
                            <Link
                              to={`/admin/properties?hostId=${h.uid}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-400 font-bold hover:underline hover:text-amber-300"
                              title="Filter properties for this host"
                            >
                              {h.propertiesCount}
                            </Link>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Activities count */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          {h.activitiesCount > 0 ? (
                            <Link
                              to={`/admin/activities?hostId=${h.uid}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-teal-400 font-bold hover:underline hover:text-teal-300"
                              title="Filter activities for this host"
                            >
                              {h.activitiesCount}
                            </Link>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Bookings count */}
                        <td className="py-3.5 px-4 text-center font-mono">
                          {h.totalBookingsCount > 0 ? (
                            <Link
                              to={`/admin/bookings?hostId=${encodeURIComponent(h.uid)}`}
                              className="text-purple-400 hover:text-purple-300 font-bold hover:underline"
                              title="View host bookings"
                            >
                              {h.totalBookingsCount}
                            </Link>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Account Status */}
                        <td className="py-3.5 px-4 font-mono">
                          {h.accountStatus ? (
                            <span className="text-emerald-400 capitalize">{h.accountStatus}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(h.joinedAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHost(h);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>View Host</span>
                            </button>

                            <Link
                              to="/admin/verifications"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition-colors"
                              title="Review compliance dossier in portal"
                            >
                              <FileCheck2 size={13} />
                              <span>Verify</span>
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
              Showing {filteredHosts.length} of {hosts.length} hosts
            </span>
            <span className="text-slate-600">
              Operational directory synthesized from users, verifications, listings, and bookings.
            </span>
          </div>
        </div>

        {/* Host Detail View Drawer / Modal */}
        {selectedHost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Top Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <Home size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Host Profile & Compliance</h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      MozBook Host Operations Record
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHost(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close host profile"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Host Identity Banner */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4">
                  {selectedHost.photoURL ? (
                    <img
                      src={selectedHost.photoURL}
                      alt=""
                      className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center text-xl font-bold shrink-0">
                      {(selectedHost.name || selectedHost.email || 'H').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="text-center sm:text-left flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h4 className="text-lg font-bold text-white truncate">
                        {selectedHost.name || 'Unnamed Host'}
                      </h4>
                      {selectedHost.verificationStatus === 'verified' ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                          Verified Host
                        </span>
                      ) : selectedHost.verificationStatus === 'pending' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                          Verification Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px] font-bold">
                          Unverified
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {selectedHost.email || 'No email on record'}
                    </p>
                  </div>
                </div>

                {/* Section 1: HOST PROFILE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Host Profile
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host Name</span>
                      <p className="text-slate-200 mt-0.5 font-sans font-semibold">
                        {selectedHost.name || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Email Address</span>
                      <p className="text-slate-200 mt-0.5 truncate">{selectedHost.email || '—'}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Host UID</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-300 truncate max-w-[180px]">{selectedHost.uid}</span>
                        <button
                          onClick={() => handleCopyUid(selectedHost.uid)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Copy UID"
                        >
                          {copiedUid ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Phone</span>
                      <p className="text-slate-200 mt-0.5">
                        {selectedHost.phoneNumber || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Location / Address</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedHost.location || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Country</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedHost.country || 'Mozambique'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: VERIFICATION & COMPLIANCE */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Verification & Identity Documents
                    </h4>
                    <Link
                      to="/admin/verifications"
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <span>Full Compliance Portal</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Verification Status</span>
                      <p className="text-slate-200 mt-0.5 uppercase font-bold text-emerald-400">
                        {selectedHost.verificationStatus}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Document Type</span>
                      <p className="text-slate-200 mt-0.5 capitalize">
                        {selectedHost.docType ? selectedHost.docType.replace('_', ' ') : '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Document Number</span>
                      <p className="text-slate-200 mt-0.5">
                        {selectedHost.docNumber || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Expiry Date</span>
                      <p className="text-slate-200 mt-0.5">
                        {selectedHost.expiryDate || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Submission Date</span>
                      <p className="text-slate-200 mt-0.5">
                        {formatDate(selectedHost.submittedAt)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Reviewed Date</span>
                      <p className="text-slate-200 mt-0.5">
                        {formatDate(selectedHost.reviewedAt)}
                      </p>
                    </div>

                    {selectedHost.reviewedBy && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 text-[10px] uppercase block">Reviewed By</span>
                        <p className="text-slate-300 mt-0.5">{selectedHost.reviewedBy}</p>
                      </div>
                    )}

                    {selectedHost.adminNotes && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 text-[10px] uppercase block">Review Notes</span>
                        <p className="text-slate-300 mt-0.5 font-sans italic">{selectedHost.adminNotes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: HOST INVENTORY & BOOKINGS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Host Inventory & Operational Volume
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <Link
                      to={`/admin/properties?hostId=${selectedHost.uid}`}
                      className="p-3 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl transition-all block group"
                    >
                      <Home size={16} className="text-amber-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white group-hover:text-amber-400 block">
                        {selectedHost.propertiesCount}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Properties</span>
                      <span className="text-[9px] text-amber-400/80 block mt-1">View Listings →</span>
                    </Link>

                    <Link
                      to={`/admin/activities?hostId=${selectedHost.uid}`}
                      className="p-3 bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl transition-all block group"
                    >
                      <Compass size={16} className="text-teal-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-lg font-black text-white group-hover:text-teal-400 block">
                        {selectedHost.activitiesCount}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Activities</span>
                      <span className="text-[9px] text-teal-400/80 block mt-1">View Experiences →</span>
                    </Link>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <CalendarCheck size={16} className="text-purple-400 mx-auto mb-1" />
                      <span className="text-lg font-black text-white block">
                        {selectedHost.propertyBookingsCount}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Property Stays</span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <CalendarCheck size={16} className="text-indigo-400 mx-auto mb-1" />
                      <span className="text-lg font-black text-white block">
                        {selectedHost.activityBookingsCount}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Activity Bookings</span>
                    </div>
                  </div>
                </div>

                {/* Security Note on Actions */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-500 font-mono">
                  <Shield size={14} className="text-slate-400 inline mr-1.5" />
                  <span>
                    Factual platform records only. Destructive actions (suspension, role revocation, deletion) are locked in Phase 2B.
                  </span>
                </div>
              </div>

              {/* Modal Bottom Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 flex items-center justify-between">
                <Link
                  to="/admin/verifications"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <FileCheck2 size={14} />
                  <span>Open Verification Portal</span>
                </Link>

                <button
                  onClick={() => setSelectedHost(null)}
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
