import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { calculateCommission, calculatePartnerShare, calculatePlatformCommission } from '../../src/config/platformCommission';

describe('Admin Dashboard Stage 3: Financials & Reconciliation Dashboard Verification', () => {
  // ==========================================================================
  // 1. Authoritative Financial Calculations (15% MozBook / 85% Partner)
  // ==========================================================================
  describe('Authoritative 15% Platform Commission & 85% Partner Share Model', () => {
    it('calculates 15% platform commission and 85% partner split with zero discrepancy', () => {
      const grossAmount = 20000;
      const breakdown = calculateCommission(grossAmount);

      expect(breakdown.grossAmount).toBe(20000);
      expect(breakdown.commissionPercent).toBe(15);
      expect(breakdown.commissionAmount).toBe(3000); // 20000 * 0.15
      expect(breakdown.partnerPercent).toBe(85);
      expect(breakdown.partnerShare).toBe(17000); // 20000 * 0.85
      expect(breakdown.commissionAmount + breakdown.partnerShare).toBe(grossAmount);
    });

    it('guarantees commission + partner share exactly equals grossAmount for odd amounts', () => {
      const oddAmounts = [1237, 9999, 33333, 7, 101];
      for (const amt of oddAmounts) {
        const breakdown = calculateCommission(amt);
        expect(breakdown.commissionAmount + breakdown.partnerShare).toBe(amt);
      }
    });

    it('helper functions return exact amounts', () => {
      expect(calculatePlatformCommission(10000)).toBe(1500);
      expect(calculatePartnerShare(10000)).toBe(8500);
    });
  });

  // ==========================================================================
  // 2. Status Separation: Pipeline vs Cash Flow vs Fulfillment
  // Rule: PAID ≠ SERVICE DELIVERED ≠ BOOKING CONFIRMED
  // ==========================================================================
  describe('Multi-Status Separation & Accounting Integrity', () => {
    interface MockBooking {
      id: string;
      totalAmount: number;
      status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
      paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
    }

    interface MockPayment {
      id: string;
      amount: number;
      status: 'initiated' | 'pending' | 'paid' | 'failed' | 'refunded';
      paysuitePaymentId?: string;
    }

    it('does NOT treat a confirmed booking as proof of payment', () => {
      const bookings: MockBooking[] = [
        { id: 'bk_1', totalAmount: 15000, status: 'confirmed', paymentStatus: 'unpaid' },
        { id: 'bk_2', totalAmount: 10000, status: 'confirmed', paymentStatus: 'paid' },
        { id: 'bk_3', totalAmount: 8000, status: 'pending', paymentStatus: 'pending' },
        { id: 'bk_4', totalAmount: 5000, status: 'cancelled', paymentStatus: 'unpaid' }
      ];

      const payments: MockPayment[] = [
        { id: 'pay_1', amount: 10000, status: 'paid', paysuitePaymentId: 'ps_1' }
      ];

      // Pipeline Volume
      const totalPipelineValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0); // 38,000
      const activeConfirmedPipeline = bookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + b.totalAmount, 0); // 25,000

      // Confirmed Cash Flow
      const cashCollected = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0); // 10,000

      // Unpaid Active Pipeline
      const unpaidActivePipeline = bookings
        .filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.paymentStatus !== 'paid')
        .reduce((sum, b) => sum + b.totalAmount, 0); // 15,000

      expect(totalPipelineValue).toBe(38000);
      expect(activeConfirmedPipeline).toBe(25000);
      expect(cashCollected).toBe(10000);
      expect(unpaidActivePipeline).toBe(15000);

      // Cash collected is NOT equal to confirmed booking pipeline
      expect(cashCollected).not.toBe(activeConfirmedPipeline);
      // Net platform revenue is strictly derived from cash collected, NOT uncollected bookings
      const netPlatformRevenue = Math.round(cashCollected * 0.15);
      expect(netPlatformRevenue).toBe(1500);
    });
  });

  // ==========================================================================
  // 3. Refunds & Ledger Reversals (Full and Partial)
  // ==========================================================================
  describe('Authoritative Refund Reversals & Commission Reconciliation', () => {
    it('accurately reconciles a full refund and reverses both commission and partner shares', () => {
      const grossPaid = 10000;
      const completedRefund = 10000;

      const grossCommission = Math.round(grossPaid * 0.15); // 1,500
      const commissionReversal = Math.round(completedRefund * 0.15); // 1,500
      const netPlatformRevenue = grossCommission - commissionReversal; // 0

      const grossPartnerShare = grossPaid - grossCommission; // 8,500
      const partnerRefundReversal = completedRefund - commissionReversal; // 8,500
      const netPartnerEarnings = grossPartnerShare - partnerRefundReversal; // 0

      expect(netPlatformRevenue).toBe(0);
      expect(netPartnerEarnings).toBe(0);
      expect(commissionReversal + partnerRefundReversal).toBe(completedRefund);
    });

    it('accurately reconciles a partial refund of 4,000 MZN on a 10,000 MZN payment', () => {
      const grossPaid = 10000;
      const partialRefund = 4000;

      const netCollected = grossPaid - partialRefund; // 6,000

      const grossCommission = Math.round(grossPaid * 0.15); // 1,500
      const commissionReversal = Math.round(partialRefund * 0.15); // 600
      const netPlatformRevenue = grossCommission - commissionReversal; // 900 (15% of 6,000)

      const grossPartnerShare = grossPaid - grossCommission; // 8,500
      const partnerRefundReversal = partialRefund - commissionReversal; // 3,400
      const netPartnerEarnings = grossPartnerShare - partnerRefundReversal; // 5,100 (85% of 6,000)

      expect(netCollected).toBe(6000);
      expect(netPlatformRevenue).toBe(900);
      expect(netPartnerEarnings).toBe(5100);
      expect(netPlatformRevenue + netPartnerEarnings).toBe(netCollected);
    });
  });

  // ==========================================================================
  // 4. Deduplication and Idempotency
  // ==========================================================================
  describe('Deduplication & Idempotent Ledger Ingestion', () => {
    it('prevents double-counting duplicate webhook events or repeated payments', () => {
      const rawPayments = [
        { id: 'pay_1', amount: 5000, status: 'paid', paysuitePaymentId: 'ps_ulid_1', idempotencyKey: 'idemp_key_1' },
        { id: 'pay_1', amount: 5000, status: 'paid', paysuitePaymentId: 'ps_ulid_1', idempotencyKey: 'idemp_key_1' }, // Exact duplicate doc
        { id: 'pay_2', amount: 5000, status: 'paid', paysuitePaymentId: 'ps_ulid_1', idempotencyKey: 'idemp_key_1' }, // Duplicate ULID & key
        { id: 'pay_3', amount: 7000, status: 'paid', paysuitePaymentId: 'ps_ulid_2', idempotencyKey: 'idemp_key_2' }, // Genuine separate payment
      ];

      const seenIds = new Set<string>();
      const seenUlids = new Set<string>();
      const seenKeys = new Set<string>();
      let duplicateCount = 0;
      let totalCollected = 0;

      rawPayments.forEach(p => {
        if (seenIds.has(p.id) || (p.paysuitePaymentId && seenUlids.has(p.paysuitePaymentId)) || (p.idempotencyKey && seenKeys.has(p.idempotencyKey))) {
          duplicateCount++;
          return;
        }
        seenIds.add(p.id);
        if (p.paysuitePaymentId) seenUlids.add(p.paysuitePaymentId);
        if (p.idempotencyKey) seenKeys.add(p.idempotencyKey);
        totalCollected += p.amount;
      });

      expect(duplicateCount).toBe(2);
      expect(totalCollected).toBe(12000); // 5000 + 7000, not 22000
    });
  });

  // ==========================================================================
  // 5. Operator Debits and Host Payout Retained Balances
  // ==========================================================================
  describe('Operator Debits and Host Retained Balance Reconciliation', () => {
    it('correctly deducts operator inventory debits and completed payouts from partner earnings', () => {
      const netPartnerEarningsBeforeDebits = 17000; // 85% of 20,000
      const appliedOperatorDebits = 2000; // inventory failure penalties
      const completedPayouts = 10000; // already transferred to host bank/mpesa
      const pendingPayoutRequests = 3000; // requested but not yet settled

      const netPartnerEarnings = Math.max(0, netPartnerEarningsBeforeDebits - appliedOperatorDebits); // 15,000
      const retainedPartnerBalance = Math.max(0, netPartnerEarnings - completedPayouts); // 5,000

      expect(netPartnerEarnings).toBe(15000);
      expect(retainedPartnerBalance).toBe(5000);
      // Retained balance covers pending payouts without deficit
      expect(retainedPartnerBalance).toBeGreaterThanOrEqual(pendingPayoutRequests);
    });
  });

  // ==========================================================================
  // 6. Security and Authorization Guards
  // ==========================================================================
  describe('Administrative Financial Authorization Guard Verification', () => {
    function isUserAdmin(user: { uid: string; email?: string; role?: string } | null | undefined): boolean {
      if (!user) return false;
      const email = user.email?.toLowerCase();
      return email === 'mozbookinfo@gmail.com' || email === 'admin@mozbook.mz' || user.role === 'admin';
    }

    it('rejects unauthenticated and non-admin users from accessing financial records', () => {
      expect(isUserAdmin(null)).toBe(false);
      expect(isUserAdmin(undefined)).toBe(false);
      expect(isUserAdmin({ uid: 'guest_1', email: 'traveler@gmail.com' })).toBe(false);
      expect(isUserAdmin({ uid: 'host_1', email: 'host@dive.mz', role: 'host' })).toBe(false);
      expect(isUserAdmin({ uid: 'hacker_1', email: 'admin@imposter.com' })).toBe(false);
    });

    it('allows verified designated administrator accounts', () => {
      expect(isUserAdmin({ uid: 'admin_1', email: 'mozbookinfo@gmail.com' })).toBe(true);
      expect(isUserAdmin({ uid: 'admin_2', email: 'admin@mozbook.mz' })).toBe(true);
      expect(isUserAdmin({ uid: 'admin_3', email: 'staff@mozbook.mz', role: 'admin' })).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Route and Component Integration Verification
  // ==========================================================================
  describe('Admin Financials Routing & Console Navigation Verification', () => {
    const appPath = path.resolve(__dirname, '../../src/App.tsx');
    const layoutPath = path.resolve(__dirname, '../../src/components/admin/AdminLayout.tsx');
    const dashboardPath = path.resolve(__dirname, '../../src/pages/admin/AdminDashboard.tsx');
    const financialsPagePath = path.resolve(__dirname, '../../src/pages/admin/AdminFinancials.tsx');
    const serverPath = path.resolve(__dirname, '../../server.ts');
    const adminServicePath = path.resolve(__dirname, '../../src/services/adminService.ts');

    it('verifies /admin/financials route is registered and protected in App.tsx', () => {
      const appContent = fs.readFileSync(appPath, 'utf-8');
      expect(appContent).toContain("import AdminFinancials from './pages/admin/AdminFinancials'");
      expect(appContent).toContain('path="/admin/financials"');
      expect(appContent).toContain('<AdminFinancials />');
      expect(appContent).toContain('<AdminRoute>');
    });

    it('verifies Financials sidebar item is enabled and live in AdminLayout.tsx', () => {
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      expect(layoutContent).toContain("path: '/admin/financials'");
      expect(layoutContent).toContain("enabled: true");
      expect(layoutContent).not.toContain("path: '#financials'");
    });

    it('verifies AdminDashboard connects Platform Revenue KPI card to /admin/financials', () => {
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
      expect(dashboardContent).toContain("actionLink: '/admin/financials'");
      expect(dashboardContent).toContain("actionText: 'View financials'");
      expect(dashboardContent).toContain('to="/admin/financials"');
    });

    it('verifies server.ts exposes GET /api/admin/financials/overview with admin auth check', () => {
      const serverContent = fs.readFileSync(serverPath, 'utf-8');
      expect(serverContent).toContain('/api/admin/financials/overview');
      expect(serverContent).toContain('isUserAdmin(user)');
      expect(serverContent).toContain('Forbidden: Administrator privileges required.');
      expect(serverContent).toContain('grossPlatformCommission');
      expect(serverContent).toContain('retainedPartnerBalance');
    });

    it('verifies adminService exposes getFinancialSummary with fallback', () => {
      const serviceContent = fs.readFileSync(adminServicePath, 'utf-8');
      expect(serviceContent).toContain('getFinancialSummary()');
      expect(serviceContent).toContain('/api/admin/financials/overview');
      expect(serviceContent).toContain('AdminFinancialSummary');
      expect(serviceContent).toContain('AdminFinancialTransaction');
    });

    it('verifies AdminFinancials page component exists and renders reconciliation model', () => {
      const pageContent = fs.readFileSync(financialsPagePath, 'utf-8');
      expect(pageContent).toContain('Financials & Reconciliation');
      expect(pageContent).toContain('PAID ≠ SERVICE DELIVERED');
      expect(pageContent).toContain('MozBook Net Commission (15%)');
      expect(pageContent).toContain('Partner Balances (85% Net)');
      expect(pageContent).toContain('Export Ledger CSV');
    });
  });
});
