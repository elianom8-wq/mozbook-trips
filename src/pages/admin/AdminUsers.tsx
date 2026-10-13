import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users,
  Home,
  ShieldCheck,
  User,
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
  UsersRound,
  ArrowLeft,
  ChevronRight,
  Shield,
  Activity
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminUser, UserActivitySummary } from '../../types/admin';

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoleFilter = searchParams.get('role') || 'all';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);

  // Detail Modal / Drawer state
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySummary, setActivitySummary] = useState<UserActivitySummary | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync role filter with URL query param if present
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['all', 'guest', 'host', 'admin'].includes(roleParam.toLowerCase())) {
      setRoleFilter(roleParam.toLowerCase());
    }
  }, [searchParams]);

  const loadUsers = async () => {
    try {
      const data = await adminService.getAllUsers(250);
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
  };

  const handleSelectRoleFilter = (filter: string) => {
    setRoleFilter(filter);
    if (filter === 'all') {
      searchParams.delete('role');
    } else {
      searchParams.set('role', filter);
    }
    setSearchParams(searchParams);
  };

  // Open User Detail Drawer & fetch real activity counts
  const handleOpenDetail = async (u: AdminUser) => {
    setSelectedUser(u);
    setActivityLoading(true);
    setActivitySummary(null);
    try {
      const summary = await adminService.getUserActivitySummary(u.uid);
      setActivitySummary(summary);
    } catch (err) {
      console.warn('Failed to load user activity summary:', err);
      setActivitySummary({
        propertiesCount: 0,
        activitiesCount: 0,
        bookingsCount: 0,
        travelGroupsCount: 0,
      });
    } finally {
      setActivityLoading(false);
    }
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

  // KPI counts computed from real Firestore records
  const kpis = useMemo(() => {
    let guests = 0;
    let hosts = 0;
    let admins = 0;

    users.forEach((u) => {
      const r = (u.role || '').toLowerCase();
      if (r === 'admin' || u.email.toLowerCase() === 'mozbookinfo@gmail.com') {
        admins++;
      } else if (r === 'host') {
        hosts++;
      } else {
        guests++;
      }
    });

    return {
      total: users.length,
      guests,
      hosts,
      admins,
    };
  }, [users]);

  // Filtered and searched user records
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all') {
        const r = (u.role || '').toLowerCase();
        const isAdminAccount = r === 'admin' || u.email.toLowerCase() === 'mozbookinfo@gmail.com';
        if (roleFilter === 'admin' && !isAdminAccount) return false;
        if (roleFilter === 'host' && (r !== 'host' || isAdminAccount)) return false;
        if (roleFilter === 'guest' && (r !== 'guest' || isAdminAccount)) return false;
      }

      // Search query filter (name, email, UID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = (u.displayName || '').toLowerCase().includes(query);
        const emailMatch = (u.email || '').toLowerCase().includes(query);
        const uidMatch = (u.uid || '').toLowerCase().includes(query);
        return nameMatch || emailMatch || uidMatch;
      }

      return true;
    });
  }, [users, roleFilter, searchQuery]);

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
              <span className="text-xs font-mono text-emerald-400 font-semibold">Users</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              User Management
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Secure administrative directory of registered platform accounts, profiles, and roles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Directory'}</span>
            </button>
          </div>
        </div>

        {/* User Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Total Users
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : kpis.total.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                All platform accounts
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
          </div>

          {/* Guests */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Guests
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : kpis.guests.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Travelers & explorers
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <User size={22} />
            </div>
          </div>

          {/* Hosts */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Hosts
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : kpis.hosts.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Property & tour providers
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Home size={22} />
            </div>
          </div>

          {/* Admins */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
                Admins
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                {loading ? '—' : kpis.admins.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Verified operations staff
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            {[
              { id: 'all', label: 'All Users', count: kpis.total },
              { id: 'guest', label: 'Guests', count: kpis.guests },
              { id: 'host', label: 'Hosts', count: kpis.hosts },
              { id: 'admin', label: 'Admins', count: kpis.admins },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  roleFilter === tab.id
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    roleFilter === tab.id
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
          <div className="relative min-w-[280px] sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, or UID..."
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

        {/* User Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs font-mono text-slate-400">Loading MozBook users from Firestore...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">No users found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No accounts matched your search "${searchQuery}".`
                  : 'There are no user accounts in this category.'}
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
                    <th className="py-3.5 px-4 font-semibold">User</th>
                    <th className="py-3.5 px-4 font-semibold">Email</th>
                    <th className="py-3.5 px-4 font-semibold">Role</th>
                    <th className="py-3.5 px-4 font-semibold">Account Status</th>
                    <th className="py-3.5 px-4 font-semibold">Created</th>
                    <th className="py-3.5 px-4 font-semibold">Last Activity</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isAdminUser =
                      u.role === 'admin' || u.email.toLowerCase() === 'mozbookinfo@gmail.com';
                    const isHost = u.role === 'host' && !isAdminUser;

                    return (
                      <tr
                        key={u.uid}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => handleOpenDetail(u)}
                      >
                        {/* Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isAdminUser
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : isHost
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                                {u.displayName || 'Unnamed User'}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">
                                UID: {u.uid.slice(0, 10)}...
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {u.email || '—'}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4">
                          {isAdminUser ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-[11px] font-bold">
                              <ShieldCheck size={11} />
                              <span>Admin</span>
                            </span>
                          ) : isHost ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-semibold">
                              <Home size={11} />
                              <span>Host</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] font-semibold">
                              <User size={11} />
                              <span>Guest</span>
                            </span>
                          )}
                        </td>

                        {/* Account Status */}
                        <td className="py-3.5 px-4">
                          {u.accountStatus ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                                u.accountStatus.toLowerCase() === 'active'
                                  ? 'text-emerald-400 bg-emerald-500/10'
                                  : 'text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span className="capitalize">{u.accountStatus}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(u.createdAt)}
                        </td>

                        {/* Last Activity */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {formatDate(u.lastLoginAt || u.updatedAt)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(u);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>View User</span>
                          </button>
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
              Showing {filteredUsers.length} of {users.length} users
            </span>
            <span className="text-slate-600">
              Architecture note: Client query capped at 250 records. Production scale will use server-side cursor pagination.
            </span>
          </div>
        </div>

        {/* User Detail View Drawer / Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Top Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">User Account Detail</h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      MozBook Platform Record
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close user details"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* User Identity Banner */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4">
                  {selectedUser.photoURL ? (
                    <img
                      src={selectedUser.photoURL}
                      alt=""
                      className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-white shrink-0">
                      {(selectedUser.displayName || selectedUser.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="text-center sm:text-left flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h4 className="text-lg font-bold text-white truncate">
                        {selectedUser.displayName || 'Unnamed User'}
                      </h4>
                      {selectedUser.role === 'admin' || selectedUser.email.toLowerCase() === 'mozbookinfo@gmail.com' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-[10px] font-bold">
                          Admin
                        </span>
                      ) : selectedUser.role === 'host' ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                          Host
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
                          Guest
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                {/* Section 1: PROFILE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Profile Information
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Display Name</span>
                      <p className="text-slate-200 mt-0.5 font-sans font-semibold">
                        {selectedUser.displayName || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Email Address</span>
                      <p className="text-slate-200 mt-0.5 truncate">{selectedUser.email || '—'}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">User ID (UID)</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-slate-300 truncate max-w-[180px]">{selectedUser.uid}</span>
                        <button
                          onClick={() => handleCopyUid(selectedUser.uid)}
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
                        {selectedUser.phoneNumber || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Location / City</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedUser.location || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Country</span>
                      <p className="text-slate-200 mt-0.5 font-sans">
                        {selectedUser.country || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: ACCOUNT */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Account & Authorization
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Role</span>
                      <p className="text-slate-200 mt-0.5 uppercase font-bold text-emerald-400">
                        {selectedUser.email.toLowerCase() === 'mozbookinfo@gmail.com' ? 'admin' : (selectedUser.role || 'guest')}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Account Status</span>
                      <p className="text-slate-200 mt-0.5 capitalize">
                        {selectedUser.accountStatus || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Registration Date</span>
                      <p className="text-slate-200 mt-0.5">
                        {formatDate(selectedUser.createdAt)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Last Activity</span>
                      <p className="text-slate-200 mt-0.5">
                        {formatDate(selectedUser.lastLoginAt || selectedUser.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: ACTIVITY SUMMARY */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                    Platform Activity Summary
                  </h4>
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4">
                    {activityLoading ? (
                      <div className="py-6 text-center">
                        <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
                        <span className="text-[11px] font-mono text-slate-400">
                          Querying user records across collections...
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <Home size={16} className="text-amber-400 mx-auto mb-1" />
                          <span className="text-lg font-black text-white block">
                            {activitySummary?.propertiesCount ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Properties</span>
                        </div>

                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <Compass size={16} className="text-teal-400 mx-auto mb-1" />
                          <span className="text-lg font-black text-white block">
                            {activitySummary?.activitiesCount ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Activities</span>
                        </div>

                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <CalendarCheck size={16} className="text-purple-400 mx-auto mb-1" />
                          <span className="text-lg font-black text-white block">
                            {activitySummary?.bookingsCount ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Bookings</span>
                        </div>

                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                          <UsersRound size={16} className="text-indigo-400 mx-auto mb-1" />
                          <span className="text-lg font-black text-white block">
                            {activitySummary?.travelGroupsCount ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Travel Groups</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Security Note on Actions */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-500 font-mono">
                  <Shield size={14} className="text-slate-400 inline mr-1.5" />
                  <span>
                    Destructive account mutations (role revocation, suspension, deletion) require elevated compliance review and are locked in Phase 2A.
                  </span>
                </div>
              </div>

              {/* Modal Bottom Footer */}
              <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 p-4 flex items-center justify-end">
                <button
                  onClick={() => setSelectedUser(null)}
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
