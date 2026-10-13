import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  Download,
  CalendarCheck,
  Scale,
  Wallet,
  Receipt,
  FileCheck2,
  Copy,
  Check,
  Eye,
  Info
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminService } from '../../services/adminService';
import { 
  AdminFinancialSummary, 
  AdminFinancialTransaction, 
  AdminFinancialTransactionType 
} from '../../types/admin';

export default function AdminFinancials() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<AdminFinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<AdminFinancialTransaction[]>([]);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Detail Modal state
  const [selectedTx, setSelectedTx] = useState<AdminFinancialTransaction | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadFinancialData = async () => {
    try {
      setError(null);
      const res = await adminService.getFinancialSummary();
      setSummary(res.summary);
      setTransactions(res.transactions);
    } catch (err: any) {
      console.error('Failed to load financial records:', err);
      setError(err?.message || 'Failed to load financial overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFinancialData();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        const normStatus = tx.status.toLowerCase();
        if (selectedStatus === 'settled') {
          if (!['paid', 'completed', 'applied'].includes(normStatus)) return false;
        } else if (selectedStatus === 'pending') {
          if (!['pending', 'processing', 'initiated', 'requested'].includes(normStatus)) return false;
        } else if (selectedStatus === 'failed') {
          if (!['failed', 'cancelled', 'waived'].includes(normStatus)) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = tx.reference?.toLowerCase().includes(q);
        const matchesBookingRef = tx.bookingRef?.toLowerCase().includes(q);
        const matchesPayer = tx.payerOrBeneficiary?.toLowerCase().includes(q);
        const matchesEmail = tx.payerEmail?.toLowerCase().includes(q);
        const matchesHost = tx.hostName?.toLowerCase().includes(q) || tx.hostId?.toLowerCase().includes(q);
        const matchesGateway = tx.gatewayTransactionId?.toLowerCase().includes(q) || tx.gatewayPaymentId?.toLowerCase().includes(q);
        const matchesId = tx.id.toLowerCase().includes(q);

        if (!matchesRef && !matchesBookingRef && !matchesPayer && !matchesEmail && !matchesHost && !matchesGateway && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedType, selectedStatus, searchQuery]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (!transactions.length) return;

    const headers = [
      'Transaction ID',
      'Type',
      'Reference',
      'Booking Ref',
      'Category',
      'Counterparty',
      'Amount (MZN)',
      '15% MozBook Commission',
      '85% Partner Share',
      'Status',
      'Payment Method',
      'Gateway ID',
      'Created At',
      'Notes'
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.id}"`,
      `"${tx.type.toUpperCase()}"`,
      `"${tx.reference}"`,
      `"${tx.bookingRef || ''}"`,
      `"${tx.bookingCategory || ''}"`,
      `"${tx.payerOrBeneficiary}"`,
      tx.amount,
      tx.commissionMzn || 0,
      tx.partnerShareMzn || 0,
      `"${tx.status}"`,
      `"${tx.paymentMethod || ''}"`,
      `"${tx.gatewayTransactionId || tx.gatewayPaymentId || ''}"`,
      `"${tx.createdAt}"`,
      `"${(tx.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mozbook-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMzn = (val: number | undefined | null) => {
    const num = Math.round(val || 0);
    return `MZN ${num.toLocaleString('en-US')}`;
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                MozBook Operations Console
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">Financial Ledger & Settlement</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Financials & Reconciliation</span>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                15% Commission / 85% Split
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authoritative PaySuite settlement, revenue reconciliation, partner balances, and refund audit registry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Reconciling...' : 'Refresh Financials'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={loading || transactions.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export Ledger CSV</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={handleRefresh} className="underline hover:text-white font-mono ml-4">
              Retry
            </button>
          </div>
        )}

        {/* Status Callout Banner */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Authoritative Cash Flow Principle</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  PAID ≠ SERVICE DELIVERED
                </span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Confirmed reservations do not imply collected funds. Net MozBook Platform Revenue represents 15% of confirmed collections less refund reversals. Partner balances remain retained until formal payout disbursement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase block">Duplicates Ignored</span>
              <span className="font-bold text-emerald-400">{summary?.reconciliation.duplicateTransactionsDetected || 0}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase block">Currency</span>
              <span className="font-bold text-white">MZN (Meticais)</span>
            </div>
          </div>
        </div>

        {/* Primary Financial Metric Cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Authoritative Financial Position
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              Live from Payments & Refunds Ledger
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Booking Pipeline */}
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Total Booking Pipeline
                    </span>
                    <div className="w-8 h-8 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <CalendarCheck size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {formatMzn(summary?.pipeline.totalBookingValue)}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {summary?.pipeline.totalBookingsCount || 0} reservations created
                  </span>
                  <Link to="/admin/bookings" className="text-purple-400 hover:underline flex items-center gap-0.5">
                    <span>View</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Confirmed Collected Cash */}
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Confirmed Collected Cash
                    </span>
                    <div className="w-8 h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <CreditCard size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                    {formatMzn(summary?.collections.grossCollectedAmount)}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {summary?.collections.paidPaymentsCount || 0} paid via PaySuite
                  </span>
                  <span className="text-emerald-400 font-semibold font-mono">
                    Net: {formatMzn(summary?.collections.netCollectedAmount)}
                  </span>
                </div>
              </div>

              {/* Net MozBook Platform Revenue */}
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">
                      MozBook Net Commission (15%)
                    </span>
                    <div className="w-8 h-8 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-blue-400 font-mono tracking-tight">
                    {formatMzn(summary?.platformRevenue.netPlatformRevenue)}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    Gross: {formatMzn(summary?.platformRevenue.grossPlatformCommission)}
                  </span>
                  <span className="text-rose-400 font-mono">
                    -{formatMzn(summary?.platformRevenue.commissionReversals)} ref
                  </span>
                </div>
              </div>

              {/* Retained Partner Balance */}
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Partner Balances (85% Net)
                    </span>
                    <div className="w-8 h-8 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Wallet size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                    {formatMzn(summary?.partnerSettlement.retainedPartnerBalance)}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    Disbursed: {formatMzn(summary?.partnerSettlement.completedPayoutsAmount)}
                  </span>
                  <span className="text-amber-400 font-semibold font-mono">
                    {summary?.partnerSettlement.pendingPayoutsCount || 0} req pending
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Secondary Operational Balance Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Completed Refunds */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Completed Refunds</span>
              <ArrowDownLeft size={14} className="text-rose-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatMzn(summary?.refunds.totalCompletedRefundsAmount)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {summary?.refunds.completedRefundsCount || 0} transactions reversed
            </div>
          </div>

          {/* Uncollected Active Pipeline */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Unpaid Reservations</span>
              <Clock size={14} className="text-amber-400" />
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono">
              {formatMzn(summary?.reconciliation.unpaidBookingsValue)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {summary?.reconciliation.unpaidBookingsCount || 0} bookings awaiting payment
            </div>
          </div>

          {/* Applied Operator Debits */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Operator Debits</span>
              <Scale size={14} className="text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatMzn(summary?.partnerSettlement.operatorDebitsAmount)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {summary?.partnerSettlement.operatorDebitsCount || 0} inventory penalties applied
            </div>
          </div>

          {/* Pending / In-Progress Payments */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Pending Checkouts</span>
              <Clock size={14} className="text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatMzn(summary?.collections.pendingPaymentsAmount)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {summary?.collections.pendingPaymentsCount || 0} checkouts initiated
            </div>
          </div>
        </section>

        {/* Financial Reconciliation Summary Breakdown Box */}
        <section className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt size={16} className="text-emerald-400" />
                <span>Reconciliation & Settlement Audit Model</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mathematical proof of ledger balance: Confirmed Collections = Net Platform Commission + Net Partner Share + Applied Debits + Completed Refunds.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <CheckCircle2 size={13} />
              <span>Balanced (0 MZN discrepancy)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* Column 1: Gross Inflow */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                1. Cash Inflow (PaySuite)
              </span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Gross Confirmed Payments</span>
                  <span className="text-white font-bold">{formatMzn(summary?.collections.grossCollectedAmount)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Less Completed Refunds</span>
                  <span>-{formatMzn(summary?.refunds.totalCompletedRefundsAmount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-emerald-400">
                  <span>Net Settled Cash</span>
                  <span>{formatMzn(summary?.collections.netCollectedAmount)}</span>
                </div>
              </div>
            </div>

            {/* Column 2: Platform Commission (15%) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                2. Platform Revenue (15%)
              </span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Gross 15% Fee</span>
                  <span className="text-white font-bold">{formatMzn(summary?.platformRevenue.grossPlatformCommission)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Less 15% Refund Reversals</span>
                  <span>-{formatMzn(summary?.platformRevenue.commissionReversals)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-blue-400">
                  <span>Net Platform Revenue</span>
                  <span>{formatMzn(summary?.platformRevenue.netPlatformRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Column 3: Partner Share (85%) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                3. Partner Ledger (85%)
              </span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Gross 85% Partner Share</span>
                  <span className="text-white font-bold">{formatMzn(summary?.partnerSettlement.grossPartnerShare)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Less 85% Refund Reversals</span>
                  <span>-{formatMzn(summary?.partnerSettlement.partnerRefundReversals)}</span>
                </div>
                <div className="flex justify-between text-cyan-400">
                  <span>Less Inventory Debits</span>
                  <span>-{formatMzn(summary?.partnerSettlement.operatorDebitsAmount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-amber-400">
                  <span>Retained Host Balance</span>
                  <span>{formatMzn(summary?.partnerSettlement.retainedPartnerBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Transaction History & Filter Section */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Payment & Refund Ledger History</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {filteredTransactions.length} of {transactions.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative transaction ledger records logged across payments, refunds, operator debits, and host payouts.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ref, ULID, host, traveler..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 w-56 md:w-64"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Type Select */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="payment">Payments</option>
                <option value="refund">Refunds</option>
                <option value="payout">Host Payouts</option>
                <option value="debit">Operator Debits</option>
              </select>

              {/* Status Select */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="settled">Settled / Completed</option>
                <option value="pending">Pending / Processing</option>
                <option value="failed">Failed / Cancelled</option>
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading authoritative transactions...</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-300">No financial transactions found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                    ? 'No transactions match your current search and filter criteria.'
                    : 'No customer payments or host payouts have been recorded in this environment yet.'}
                </p>
                {(searchQuery || selectedType !== 'all' || selectedStatus !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedType('all');
                      setSelectedStatus('all');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-500 bg-slate-900/40">
                      <th className="py-3.5 px-4 font-semibold">Date & Ref</th>
                      <th className="py-3.5 px-4 font-semibold">Type</th>
                      <th className="py-3.5 px-4 font-semibold">Counterparty</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Amount (MZN)</th>
                      <th className="py-3.5 px-4 font-semibold text-right">MozBook 15%</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Partner 85%</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredTransactions.map((tx) => {
                      const isPayment = tx.type === 'payment';
                      const isRefund = tx.type === 'refund';
                      const isPayout = tx.type === 'payout';
                      const isDebit = tx.type === 'debit';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* Date & Ref */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">
                              {tx.reference}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {new Date(tx.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4">
                            {isPayment && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <ArrowUpRight size={10} />
                                PAYMENT
                              </span>
                            )}
                            {isRefund && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <ArrowDownLeft size={10} />
                                REFUND
                              </span>
                            )}
                            {isPayout && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Wallet size={10} />
                                PAYOUT
                              </span>
                            )}
                            {isDebit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <Scale size={10} />
                                DEBIT
                              </span>
                            )}
                            {tx.paymentMethod && (
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                {tx.paymentMethod}
                              </span>
                            )}
                          </td>

                          {/* Counterparty */}
                          <td className="py-3.5 px-4 font-sans">
                            <div className="text-slate-200 font-medium truncate max-w-[180px]">
                              {tx.payerOrBeneficiary}
                            </div>
                            {tx.bookingRef && (
                              <div className="text-[11px] font-mono text-purple-400">
                                {tx.bookingRef}
                              </div>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right">
                            <span className={`font-bold ${isRefund ? 'text-rose-400' : isDebit ? 'text-cyan-400' : 'text-white'}`}>
                              {isRefund ? '-' : ''}{tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">MZN</span>
                          </td>

                          {/* MozBook 15% */}
                          <td className="py-3.5 px-4 text-right text-blue-400">
                            {tx.commissionMzn !== undefined ? (
                              <span>{isRefund ? '-' : ''}{tx.commissionMzn.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Partner 85% */}
                          <td className="py-3.5 px-4 text-right text-amber-400">
                            {tx.partnerShareMzn !== undefined ? (
                              <span>{isRefund ? '-' : ''}{tx.partnerShareMzn.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {['paid', 'completed', 'applied'].includes(tx.status.toLowerCase()) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 size={10} />
                                {tx.status.toUpperCase()}
                              </span>
                            ) : ['pending', 'processing', 'initiated', 'requested'].includes(tx.status.toLowerCase()) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Clock size={10} />
                                {tx.status.toUpperCase()}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <AlertCircle size={10} />
                                {tx.status.toUpperCase()}
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right font-sans">
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Transaction Detail Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Transaction Ledger Breakdown
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      {selectedTx.reference}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 text-xs font-mono max-h-[80vh] overflow-y-auto">
                {/* Top Summary Banner */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Total Amount</span>
                    <span className="text-xl font-black text-white font-mono">
                      {formatMzn(selectedTx.amount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                    <span className="font-bold text-emerald-400 uppercase">
                      {selectedTx.status}
                    </span>
                  </div>
                </div>

                {/* 15% / 85% Split Breakdown */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">MozBook 15% Platform Commission</span>
                    <span className="text-base font-bold text-blue-400 font-mono">
                      {selectedTx.commissionMzn !== undefined ? formatMzn(selectedTx.commissionMzn) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Partner 85% Net Allocation</span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {selectedTx.partnerShareMzn !== undefined ? formatMzn(selectedTx.partnerShareMzn) : '—'}
                    </span>
                  </div>
                </div>

                {/* Granular Field List */}
                <div className="space-y-3 font-mono">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-500">Internal ID</span>
                    <div className="flex items-center gap-1.5 text-white">
                      <span>{selectedTx.id}</span>
                      <button
                        onClick={() => copyToClipboard(selectedTx.id, 'id')}
                        className="text-slate-400 hover:text-emerald-400 cursor-pointer"
                      >
                        {copiedId === 'id' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-500">Transaction Type</span>
                    <span className="text-white uppercase font-bold">{selectedTx.type}</span>
                  </div>

                  {selectedTx.bookingRef && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-500">Associated Booking Ref</span>
                      <Link
                        to={`/admin/bookings?search=${encodeURIComponent(selectedTx.bookingRef)}`}
                        className="text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>{selectedTx.bookingRef}</span>
                        <ChevronRight size={12} />
                      </Link>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-500">Counterparty</span>
                    <span className="text-white">{selectedTx.payerOrBeneficiary}</span>
                  </div>

                  {selectedTx.payerEmail && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-500">Payer Email</span>
                      <span className="text-slate-300">{selectedTx.payerEmail}</span>
                    </div>
                  )}

                  {selectedTx.paymentMethod && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-500">Payment Method</span>
                      <span className="text-white font-semibold">{selectedTx.paymentMethod}</span>
                    </div>
                  )}

                  {selectedTx.gatewayTransactionId && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-500">PaySuite Transaction ID</span>
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <span>{selectedTx.gatewayTransactionId}</span>
                        <button
                          onClick={() => copyToClipboard(selectedTx.gatewayTransactionId!, 'txId')}
                          className="text-slate-400 hover:text-emerald-400 cursor-pointer"
                        >
                          {copiedId === 'txId' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedTx.gatewayPaymentId && (
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-500">PaySuite ULID</span>
                      <span className="text-slate-300">{selectedTx.gatewayPaymentId}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-500">Timestamp</span>
                    <span className="text-slate-300">
                      {new Date(selectedTx.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>

                  {selectedTx.notes && (
                    <div className="py-1.5">
                      <span className="text-slate-500 block mb-1">Operational Notes</span>
                      <p className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-sans">
                        {selectedTx.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-800 flex justify-end bg-slate-900/60">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
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
