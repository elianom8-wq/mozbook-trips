import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Dashboard Stage 1: Host Payout Request Safety Correction', () => {
  const hostActivitiesDashboardPath = path.resolve(__dirname, '../../src/pages/HostActivitiesDashboard.tsx');
  const partnerDashboardPath = path.resolve(__dirname, '../../src/pages/PartnerDashboard.tsx');
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');
  const paymentTypesPath = path.resolve(__dirname, '../../src/types/payment.ts');

  const hostActivitiesDashboardContent = fs.readFileSync(hostActivitiesDashboardPath, 'utf-8');
  const partnerDashboardContent = fs.readFileSync(partnerDashboardPath, 'utf-8');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
  const paymentTypesContent = fs.readFileSync(paymentTypesPath, 'utf-8');

  describe('HostActivitiesDashboard Payout Request Safety', () => {
    it('does not contain false success state or misleading 24-48 hour transfer banner', () => {
      // Must not claim funds will reflect in registered account in 24-48 hours
      expect(hostActivitiesDashboardContent).not.toContain(
        'Payout request submitted successfully! Funds will reflect in your registered Mozambique account within 24-48 business hours.'
      );
      // Must not set fake payoutSuccess true on click
      expect(hostActivitiesDashboardContent).not.toContain('setPayoutSuccess(true)');
    });

    it('explicitly disables the payout request button and marks it unavailable', () => {
      // The button must be disabled and have aria-disabled
      expect(hostActivitiesDashboardContent).toMatch(/<button[\s\S]*?disabled[\s\S]*?aria-disabled="true"[\s\S]*?>[\s\S]*?Request Payout Now/);
      expect(hostActivitiesDashboardContent).toContain('cursor-not-allowed');
      expect(hostActivitiesDashboardContent).toContain('Unavailable');
    });

    it('displays a clear explanation banner that on-demand payout requests are unavailable', () => {
      expect(hostActivitiesDashboardContent).toContain('On-Demand Payout Requests Unavailable');
      expect(hostActivitiesDashboardContent).toContain('Action Disabled');
      expect(hostActivitiesDashboardContent).toContain('On-demand host payout requests are currently unavailable');
    });

    it('handleRequestPayout function guards against false claims and retains unavailable status', () => {
      // Function must not simulate fake API success
      expect(hostActivitiesDashboardContent).toContain('const handleRequestPayout = () => {');
      expect(hostActivitiesDashboardContent).toContain('// Safety guard: Never show a success message');
      expect(hostActivitiesDashboardContent).not.toContain('setTimeout(() => setPayoutSuccess(false), 5000)');
    });

    it('preserves existing dashboard earnings cards and calculations without alteration', () => {
      expect(hostActivitiesDashboardContent).toContain('earnings.availableForPayoutMzn.toLocaleString()');
      expect(hostActivitiesDashboardContent).toContain('earnings.totalEarnedMzn.toLocaleString()');
      expect(hostActivitiesDashboardContent).toContain('PARTNER_SHARE_PERCENT');
      expect(hostActivitiesDashboardContent).toContain('MOZBOOK_COMMISSION_PERCENT');
    });
  });

  describe('PartnerDashboard Payout Request Safety', () => {
    it('does not display false success message or mock automated registration on click', () => {
      expect(partnerDashboardContent).not.toContain(
        "setActionSuccessMsg('Payout request registered. Automated processing will execute on Tuesday.');"
      );
    });

    it('disables the Request Payout Now button in PartnerDashboard', () => {
      expect(partnerDashboardContent).toMatch(
        /<button[\s\S]*?disabled[\s\S]*?aria-disabled="true"[\s\S]*?>[\s\S]*?Request Payout Now[\s\S]*?Unavailable/
      );
    });
  });

  describe('Firestore Security Rules for Payout Requests', () => {
    it('restricts payout_requests creation strictly to verified hosts or admins matching auth UID', () => {
      expect(firestoreRulesContent).toContain('match /payout_requests/{payoutId}');
      expect(firestoreRulesContent).toContain('request.resource.data.hostId == request.auth.uid');
      expect(firestoreRulesContent).toContain('(isAdmin() || isVerifiedHost(request.auth.uid))');
    });

    it('prevents host ID spoofing by ensuring the created request hostId matches request.auth.uid', () => {
      const payoutRuleSection = firestoreRulesContent.slice(
        firestoreRulesContent.indexOf('match /payout_requests/{payoutId}'),
        firestoreRulesContent.indexOf('match /travel_groups/{groupId}')
      );
      expect(payoutRuleSection).toContain('request.resource.data.hostId == request.auth.uid');
    });

    it('restricts payout disbursement updates exclusively to platform administrators', () => {
      const payoutRuleSection = firestoreRulesContent.slice(
        firestoreRulesContent.indexOf('match /payout_requests/{payoutId}'),
        firestoreRulesContent.indexOf('match /travel_groups/{groupId}')
      );
      expect(payoutRuleSection).toContain('allow update: if isAdmin();');
      expect(payoutRuleSection).toContain('allow delete: if false;');
    });

    it('forbids unauthenticated access to payout records', () => {
      const payoutRuleSection = firestoreRulesContent.slice(
        firestoreRulesContent.indexOf('match /payout_requests/{payoutId}'),
        firestoreRulesContent.indexOf('match /travel_groups/{groupId}')
      );
      expect(payoutRuleSection).toContain('allow read: if isAuthenticated() &&');
      expect(payoutRuleSection).toContain('resource.data.hostId == request.auth.uid');
    });
  });

  describe('Payout Types and Data Structure Integrity', () => {
    it('verifies HostPayoutRequest data model supports Mozambican payment rails', () => {
      expect(paymentTypesContent).toContain('export interface HostPayoutRequest');
      expect(paymentTypesContent).toContain('export type PaySuitePayoutMethod');
      expect(paymentTypesContent).toContain('mpesa');
      expect(paymentTypesContent).toContain('emola');
      expect(paymentTypesContent).toContain('bank');
    });

    it('verifies PaySuitePayoutStatus enums enforce valid states', () => {
      expect(paymentTypesContent).toContain("export type PaySuitePayoutStatus = 'pending' | 'completed' | 'failed' | 'cancelled'");
    });
  });
});
