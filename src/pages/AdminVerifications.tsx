import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MozBookLogo from '../components/MozBookLogo';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  FileText, 
  Phone, 
  MapPin, 
  CreditCard,
  Eye,
  ArrowLeft,
  Filter,
  ExternalLink,
  Sparkles,
  Calendar,
  Bell,
  RefreshCw,
  AlertTriangle,
  Info,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllVerifications, 
  updateVerificationStatus, 
  HostVerification, 
  VerificationStatus,
  submitHostVerification,
  sendRenewalReminder,
  ExpiryStatus
} from '../services/listingService';
import { adminService } from '../services/adminService';
import { auth } from '../firebase';

export default function AdminVerifications() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [verifications, setVerifications] = useState<HostVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'expiring'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected inspection modal / detail
  const [selectedVerif, setSelectedVerif] = useState<HostVerification | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getAllVerifications();
    setVerifications(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadData();
    } else if (!authLoading && !isAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAdmin]);

  // Note: Synthetic test fixtures are isolated inside automated tests (vitest)
  // No hardcoded sample identities are seeded in production code per Part B requirements.

  const handleUpdateStatus = async (verif: HostVerification, newStatus: VerificationStatus) => {
    setActionLoading(true);
    const result = await updateVerificationStatus(verif.id!, verif.userId, newStatus, adminNotes);
    const isSuccess = typeof result === 'boolean' ? result : result.success;

    if (isSuccess) {
      // Record administrative audit log
      if (auth.currentUser) {
        adminService.logAdminAction(
          auth.currentUser.uid,
          auth.currentUser.email || 'mozbookinfo@gmail.com',
          newStatus === 'verified' ? 'HOST_APPROVED' : 'HOST_REJECTED',
          'COMPLIANCE',
          'HostVerification',
          verif.id || verif.userId,
          { hostName: verif.hostName, userEmail: verif.userEmail, notes: adminNotes }
        );
      }

      const syncResult = typeof result === 'object' ? result.listingSyncResult : undefined;
      const syncInfo = syncResult && syncResult.eligibleListingsUpdated > 0
        ? ` (${syncResult.eligibleListingsUpdated} listings synchronized)`
        : '';

      setToastMessage(`Host ${verif.hostName} is now marked as ${newStatus.toUpperCase()}${syncInfo}`);
      setTimeout(() => setToastMessage(null), 3500);
      setSelectedVerif(null);
      setAdminNotes('');
      await loadData();
    } else {
      const errMsg = typeof result === 'object' && result.error ? result.error : 'Failed to update verification status';
      setToastMessage(errMsg);
      setTimeout(() => setToastMessage(null), 4000);
    }
    setActionLoading(false);
  };

  const handleSendReminder = async (verif: HostVerification) => {
    if (!verif.expiryDate) return;
    setReminderLoadingId(verif.id || verif.userId);
    try {
      const res = await sendRenewalReminder({
        hostName: verif.hostName,
        userEmail: verif.userEmail,
        docType: verif.docType,
        expiryDate: verif.expiryDate,
        daysUntilExpiry: verif.daysUntilExpiry || 0,
      });
      setToastMessage(res.message || `Renewal notification dispatched to ${verif.userEmail}`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e: any) {
      console.error(e);
      setToastMessage('Failed to dispatch reminder');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setReminderLoadingId(null);
    }
  };

  const filtered = verifications.filter((v) => {
    let matchesFilter = true;
    if (activeFilter === 'expiring') {
      matchesFilter = v.expiryStatus === 'expiring_soon' || v.expiryStatus === 'expired' || v.isExpired === true;
    } else if (activeFilter !== 'all') {
      matchesFilter = v.status === activeFilter;
    }

    const matchesSearch = 
      v.hostName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.utilityBillAddress ? v.utilityBillAddress.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = verifications.filter((v) => v.status === 'pending').length;
  const verifiedCount = verifications.filter((v) => v.status === 'verified').length;
  const rejectedCount = verifications.filter((v) => v.status === 'rejected').length;
  const expiringCount = verifications.filter(
    (v) => v.expiryStatus === 'expiring_soon' || v.expiryStatus === 'expired' || v.isExpired === true
  ).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300 font-sans">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Checking Authorization...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            You do not have administrator privileges to view this portal.
          </p>
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Return to MozBook Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/70 pb-20">
      {/* Admin Top Header */}
      <header className="bg-gray-900 text-white border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/admin/dashboard"
              className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Return to Admin Dashboard"
            >
              <ArrowLeft size={20} />
            </Link>
            <Link to="/" className="hover:opacity-90">
              <MozBookLogo variant="compact" size="sm" />
            </Link>
            <div className="border-l border-gray-800 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold text-[#009A60]">
                  MozBook Operations Console
                </span>
                <span className="px-2 py-0.5 bg-[#009A60]/20 text-[#a4e4c7] text-[10px] font-bold rounded-full border border-[#009A60]/30">
                  Compliance
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">
                Host Document Verification & Compliance
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <ShieldCheck size={14} />
              <span>Admin Dashboard</span>
            </Link>
            <Link
              to="/host/create"
              className="px-4 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Listing Studio
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Toast */}
        {toastMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-sm font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Submissions</span>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{verifications.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
            <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Clock size={14} /> Pending Approval
            </span>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
            <span className="text-xs text-emerald-700 font-semibold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={14} /> Approved Hosts
            </span>
            <p className="text-2xl font-extrabold text-emerald-900 mt-1">{verifiedCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
            <span className="text-xs text-rose-700 font-semibold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle size={14} /> Expiring / Expired
            </span>
            <p className="text-2xl font-extrabold text-rose-900 mt-1">{expiringCount}</p>
          </div>
        </div>

        {/* Controls: Search + Filter Tabs */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-full md:w-auto">
            {(['pending', 'all', 'verified', 'rejected', 'expiring'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activeFilter === filter
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter === 'pending' && `Pending (${pendingCount})`}
                {filter === 'all' && `All (${verifications.length})`}
                {filter === 'verified' && `Verified (${verifiedCount})`}
                {filter === 'rejected' && `Rejected (${rejectedCount})`}
                {filter === 'expiring' && `Expiring / Expired (${expiringCount})`}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search host, ID, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
            />
          </div>
        </div>

        {/* List of Applications */}
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Loading host applications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
            <ShieldCheck size={36} className="mx-auto text-gray-400" />
            <h3 className="font-bold text-gray-800 text-base">No Verifications Found</h3>
            <p className="text-gray-500 text-xs max-w-sm mx-auto">
              There are no host applications matching the current status filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((item) => {
              const hasBack = !!item.docBackPhotoUrl;
              const isPassport = item.docType === 'passport';
              const isExpiredDoc = item.isExpired || item.expiryStatus === 'expired';
              const isExpiringSoon = item.expiryStatus === 'expiring_soon';

              return (
                <div
                  key={item.id}
                  className={`bg-white p-6 rounded-2xl border shadow-xs hover:border-gray-300 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 ${
                    isExpiredDoc ? 'border-rose-300 bg-rose-50/10' : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-bold text-gray-900 text-base">{item.hostName}</h3>
                      <span className="text-xs text-gray-500">({item.userEmail})</span>

                      {/* Status Badge */}
                      {item.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                          <Clock size={12} /> Pending Approval
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">
                          <XCircle size={12} /> Rejected
                        </span>
                      )}

                      {/* Expiry Badge */}
                      {isExpiredDoc ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 text-white text-[11px] font-bold rounded-full">
                          <AlertTriangle size={11} /> EXPIRED
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-200 text-amber-900 text-[11px] font-bold rounded-full">
                          <Clock size={11} /> Expiring Soon ({item.daysUntilExpiry}d)
                        </span>
                      ) : item.expiryDate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-full">
                          Valid until {item.expiryDate}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <CreditCard size={15} className="text-gray-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-gray-800 uppercase block">
                            {item.docType.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-gray-600">{item.docNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-gray-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-gray-800 block">Document Expiry</span>
                          <span className={`font-mono block ${isExpiredDoc ? 'text-rose-600 font-bold' : 'text-gray-600'}`}>
                            {item.expiryDate || 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone size={15} className="text-gray-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-gray-800 block">Phone Contact</span>
                          <span className="font-mono text-gray-600">{item.phoneNumber}</span>
                        </div>
                      </div>

                      {item.utilityBillAddress ? (
                        <div className="flex items-center gap-2">
                          <MapPin size={15} className="text-gray-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-gray-800 block">Residential Address</span>
                            <span className="text-gray-600 truncate block">{item.utilityBillAddress}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Photo status badges */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                      <span className="font-medium text-gray-700">Photos attached:</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium">
                        {isPassport ? '✓ Passport Main Bio Page' : '✓ Front Photo'}
                      </span>
                      {!isPassport && (
                        <span className={`px-2 py-0.5 rounded font-medium ${
                          hasBack ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {hasBack ? '✓ Back Photo' : '⚠ Back Missing'}
                        </span>
                      )}
                      {item.utilityBillUrl ? (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-500 font-medium">
                          Legacy Utility Doc Attached
                        </span>
                      ) : null}
                    </div>

                    {item.adminNotes && (
                      <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                        <span className="font-bold">Admin Feedback: </span>
                        {item.adminNotes}
                      </div>
                    )}
                  </div>

                  {/* Right Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {/* Send Renewal Reminder button */}
                    {item.expiryDate && (
                      <button
                        onClick={() => handleSendReminder(item)}
                        disabled={reminderLoadingId === (item.id || item.userId)}
                        className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-300 transition-colors flex items-center gap-1.5 shadow-2xs"
                        title="Send renewal reminder to host email"
                      >
                        {reminderLoadingId === (item.id || item.userId) ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Bell size={14} className="text-amber-500" />
                        )}
                        <span>Remind</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedVerif(item);
                        setAdminNotes(item.adminNotes || '');
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Eye size={14} /> Review Documents
                    </button>

                    {item.status !== 'verified' && (
                      <button
                        onClick={() => handleUpdateStatus(item, 'verified')}
                        disabled={actionLoading || isExpiredDoc}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                        title={isExpiredDoc ? 'Cannot approve host with expired document' : 'Approve host'}
                      >
                        <Check size={14} /> Approve Host
                      </button>
                    )}

                    {item.status !== 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(item, 'rejected')}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl transition-colors border border-rose-200"
                      >
                        <X size={14} /> Reject
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Full Inspection of Document Photos and Utility Bill */}
        {selectedVerif && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                      Host Verification Inspection: {selectedVerif.hostName}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-gray-100 text-gray-700">
                      {selectedVerif.status}
                    </span>
                    {selectedVerif.isExpired && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-rose-600 text-white">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    User ID: {selectedVerif.userId} • Email: {selectedVerif.userEmail}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVerif(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Document Expiry Banner */}
              <div className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-4 ${
                selectedVerif.isExpired
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : selectedVerif.expiryStatus === 'expiring_soon'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center gap-2.5">
                  <Calendar size={18} className="shrink-0" />
                  <div>
                    <span className="font-bold block">
                      Document Expiry Date: {selectedVerif.expiryDate || 'Not specified'} 
                      {selectedVerif.daysUntilExpiry !== undefined && ` (${
                        selectedVerif.daysUntilExpiry <= 0
                          ? `${Math.abs(selectedVerif.daysUntilExpiry)} days ago`
                          : `${selectedVerif.daysUntilExpiry} days remaining`
                      })`}
                    </span>
                    <span className="opacity-80">
                      {selectedVerif.isExpired
                        ? 'Document is expired! Reject or request updated identification before listing activation.'
                        : 'Official document is within valid dates.'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendReminder(selectedVerif)}
                  className="px-3 py-1.5 bg-white text-gray-800 font-bold rounded-lg border border-black/10 text-xs shadow-xs hover:bg-gray-50 flex items-center gap-1.5 shrink-0"
                >
                  <Bell size={13} className="text-amber-500" />
                  <span>Send Renewal Alert</span>
                </button>
              </div>

              {/* Inspection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Front Photo */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={15} className="text-[#009A60]" />
                      <span>{selectedVerif.docType === 'passport' ? 'Passport Main Page' : 'ID Front Face'}</span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-500">{selectedVerif.docNumber}</span>
                  </div>
                  {selectedVerif.docFrontPhotoUrl || selectedVerif.docPhotoUrl ? (
                    <img
                      src={selectedVerif.docFrontPhotoUrl || selectedVerif.docPhotoUrl}
                      alt="Front Document"
                      className="w-full h-48 object-cover rounded-lg border border-gray-300 bg-black"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-400">
                      No front image attached
                    </div>
                  )}
                </div>

                {/* Back Photo (if applicable) or Utility Bill */}
                {selectedVerif.docType !== 'passport' ? (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={15} className="text-[#009A60]" />
                        <span>ID Back Face</span>
                      </span>
                      <span className="text-[11px] text-gray-500">Residency & Barcode</span>
                    </div>
                    {selectedVerif.docBackPhotoUrl ? (
                      <img
                        src={selectedVerif.docBackPhotoUrl}
                        alt="Back Document"
                        className="w-full h-48 object-cover rounded-lg border border-gray-300 bg-black"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-48 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-400">
                        No back image attached
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Legacy Utility Bill Photo & Address Review (Displayed only if existing record contains it) */}
                {selectedVerif.utilityBillUrl || selectedVerif.utilityBillAddress ? (
                  <div className={`p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 ${
                    selectedVerif.docType === 'passport' ? '' : 'md:col-span-2'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold uppercase text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <FileText size={15} className="text-[#009A60]" />
                        <span>Optional / Legacy Residence Address</span>
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">Archived Record</span>
                    </div>

                    {selectedVerif.utilityBillAddress && (
                      <p className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-200">
                        <strong className="block text-gray-900">Declared Residence Address:</strong>
                        {selectedVerif.utilityBillAddress}
                      </p>
                    )}

                    {selectedVerif.utilityBillUrl && (
                      <img
                        src={selectedVerif.utilityBillUrl}
                        alt="Utility Bill Proof"
                        className="w-full h-48 object-cover rounded-lg border border-gray-300 bg-black"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                ) : null}
              </div>

              {/* AI Extraction Confidence & Security Markers */}
              {selectedVerif.extractedData && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-gray-800">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#009A60]" />
                      <span>Document Reading Analysis (Extracted Data)</span>
                    </span>
                    {selectedVerif.extractedData.confidenceScore && (
                      <span className="text-emerald-700">
                        Confidence: {selectedVerif.extractedData.confidenceScore}%
                      </span>
                    )}
                  </div>

                  {selectedVerif.extractedData.validationNotes && (
                    <p className="text-gray-600">{selectedVerif.extractedData.validationNotes}</p>
                  )}

                  {selectedVerif.extractedData.securityFeaturesDetected && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-gray-500 font-semibold">Security Markers:</span>
                      {selectedVerif.extractedData.securityFeaturesDetected.map((f, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] text-gray-700"
                        >
                          ✓ {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Admin Note Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase">
                  Admin Verification Notes & Feedback to Host
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Identity document photo page confirmed legible, expiration unexpired, approved."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedVerif(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedVerif, 'rejected')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedVerif, 'verified')}
                    disabled={actionLoading || selectedVerif.isExpired}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                    title={selectedVerif.isExpired ? 'Cannot approve host with expired document' : 'Approve host'}
                  >
                    <CheckCircle2 size={15} /> Approve & Grant Verified Shield
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
