import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Home, 
  Compass, 
  CalendarCheck, 
  FileCheck2, 
  DollarSign, 
  ArrowUpRight, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  ScrollText, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Activity,
  CreditCard
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { AdminStats, AdminAuditLog } from '../../types/admin';
import { useAuth } from '../../context/AuthContext';
import { formatAuditTimestamp } from '../../utils/auditFormat';

export default function AdminDashboard() {
  const { user, hasCustomClaim, refreshAdminClaims } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: null,
    activeUsers: null,
    totalHosts: null,
    totalProperties: null,
    totalActivitiesTrips: null,
    totalBookings: null,
    pendingVerifications: null,
    platformRevenue: null,
  });
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimChecking, setClaimChecking] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [kpis, recentLogs] = await Promise.all([
        adminService.getPlatformKPIs(),
        adminService.getRecentAuditLogs(15),
      ]);
      setStats(kpis);
      setLogs(recentLogs);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  const handleCheckClaims = async () => {
    setClaimChecking(true);
    try {
      await refreshAdminClaims();
    } finally {
      setClaimChecking(false);
    }
  };

  const formatCount = (val: number | null) => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString();
  };

  const kpiCards = [
    {
      label: 'Total Users',
      value: formatCount(stats.totalUsers),
      subtext: 'Registered accounts',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      actionLink: '/admin/users',
      actionText: 'View users',
    },
    {
      label: 'Active Users',
      value: formatCount(stats.activeUsers),
      subtext: 'Platform participants',
      icon: Activity,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'Hosts',
      value: formatCount(stats.totalHosts),
      subtext: 'Property & tour providers',
      icon: Home,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      actionLink: '/admin/hosts',
      actionText: 'View hosts',
    },
    {
      label: 'Properties',
      value: formatCount(stats.totalProperties),
      subtext: 'Active accommodations',
      icon: Home,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      actionLink: '/admin/properties',
      actionText: 'View properties',
    },
    {
      label: 'Activities & Trips',
      value: formatCount(stats.totalActivitiesTrips),
      subtext: 'Published experiences',
      icon: Compass,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      actionLink: '/admin/activities',
      actionText: 'View experiences',
    },
    {
      label: 'Total Bookings',
      value: formatCount(stats.totalBookings),
      subtext: 'Stays & activity reservations',
      icon: CalendarCheck,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      actionLink: '/admin/bookings',
      actionText: 'View bookings',
    },
    {
      label: 'Pending Verification',
      value: formatCount(stats.pendingVerifications),
      subtext: stats.pendingVerifications ? 'Requires compliance review' : 'No backlog',
      icon: FileCheck2,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      actionLink: '/admin/verifications',
      actionText: 'Review documents',
    },
    {
      label: 'Platform Revenue',
      value: stats.platformRevenue !== null ? `MZN ${stats.platformRevenue.toLocaleString()}` : '—',
      subtext: stats.platformRevenue !== null ? '15% platform commission net' : 'Awaiting settled transactions',
      icon: DollarSign,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      actionLink: '/admin/financials',
      actionText: 'View financials',
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                MozBook Operations Console
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">Phase 1 Shell</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              MozBook Dashboard
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-400">
                Operations overview
              </span>
              <span className="text-slate-600">•</span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold">
                <ShieldCheck size={12} />
                <span>
                  {hasCustomClaim ? "Custom Claim Verified (role: admin)" : "Admin Account (mozbookinfo@gmail.com)"}
                </span>
              </div>
              <button
                onClick={handleCheckClaims}
                disabled={claimChecking}
                className="text-[10px] text-slate-400 hover:text-emerald-400 underline font-mono cursor-pointer ml-1"
                title="Refresh and check Firebase Authentication custom token claims"
              >
                {claimChecking ? "Checking claims..." : "Verify claims"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
            </button>

            <Link
              to="/admin/verifications"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              <FileCheck2 size={14} />
              <span>Compliance Portal</span>
            </Link>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Platform Metrics
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              Live from Firestore
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 h-28 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpiCards.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-400">
                          {kpi.label}
                        </span>
                        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${kpi.color}`}>
                          <Icon size={16} />
                        </div>
                      </div>

                      <div className="text-2xl font-black text-white font-mono tracking-tight">
                        {kpi.value}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{kpi.subtext}</span>
                      {kpi.actionLink && (
                        <Link
                          to={kpi.actionLink}
                          className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-0.5"
                        >
                          <span>{kpi.actionText}</span>
                          <ChevronRight size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Operations Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Quick Operations
            </h2>
            <span className="text-[11px] text-slate-500">
              Integrated platform modules
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Host Verification */}
            <Link
              to="/admin/verifications"
              className="group bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <FileCheck2 size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Host Verification
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Identity documents, DIREs, passports, and compliance.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>{stats.pendingVerifications || 0} pending</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Properties */}
            <Link
              to="/admin/properties"
              className="group bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                  <Home size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  Properties
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Lodges, chalets, beachfront residences, and villas.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                <span>{stats.totalProperties || 0} listings</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Activities & Trips */}
            <Link
              to="/admin/activities"
              className="group bg-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
                  <Compass size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors">
                  Activities & Trips
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Snorkeling, safaris, dhow tours, and excursions.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-400">
                <span>{stats.totalActivitiesTrips || 0} active</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Bookings */}
            <Link
              to="/admin/bookings"
              className="group bg-slate-950 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <CalendarCheck size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                  Bookings
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Unified stays and experiences reservation management.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400">
                <span>{stats.totalBookings || 0} reservations</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Users */}
            <Link
              to="/admin/users"
              className="group bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <Users size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Users & Accounts
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Profiles, host roles, permissions, and status.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
                <span>{stats.totalUsers || 0} accounts</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* Financials & Reconciliation */}
            <Link
              to="/admin/financials"
              className="group bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <CreditCard size={20} />
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Financials
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  PaySuite settlement, commission, partner balances.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>{stats.platformRevenue !== null ? `MZN ${stats.platformRevenue.toLocaleString()}` : 'Reconciliation'}</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* Recent Platform Activity & Audit Log Section */}
        <section id="audit-logs" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ScrollText size={15} className="text-emerald-400" />
              <span>Recent Platform Activity & Audit Logs</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              admin_audit_logs collection
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xs">
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-400">No recent activity</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1">
                  Administrator actions such as logins, document approvals, and role updates will be logged here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-500">
                      <th className="pb-3 font-semibold">Timestamp</th>
                      <th className="pb-3 font-semibold">Action</th>
                      <th className="pb-3 font-semibold">Module</th>
                      <th className="pb-3 font-semibold">Admin Account</th>
                      <th className="pb-3 font-semibold">Target / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 text-slate-400 whitespace-nowrap">
                          {(() => {
                            const formatted = formatAuditTimestamp(log.createdAt || log.timestamp);
                            return (
                              <div className="flex flex-col">
                                <span className="text-slate-300 font-semibold">{formatted.catDisplay}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{formatted.utcDisplay}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 text-slate-300 whitespace-nowrap">
                          {log.module}
                        </td>
                        <td className="py-3 text-slate-400 whitespace-nowrap">
                          {log.adminEmail}
                        </td>
                        <td className="py-3 text-slate-500 text-[11px] truncate max-w-xs">
                          {log.targetType ? `${log.targetType} (${log.targetId || ''})` : (JSON.stringify(log.metadata) !== '{}' ? JSON.stringify(log.metadata) : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
