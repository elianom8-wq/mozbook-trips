import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MozBook — Partner Dashboard Consolidation Invariants', () => {
  const appPath = path.resolve(__dirname, '../../src/App.tsx');
  const navbarPath = path.resolve(__dirname, '../../src/components/Navbar.tsx');
  const hostActivitiesDashboardPath = path.resolve(__dirname, '../../src/pages/HostActivitiesDashboard.tsx');
  const partnerDashboardPath = path.resolve(__dirname, '../../src/pages/PartnerDashboard.tsx');
  const createActivityTripPath = path.resolve(__dirname, '../../src/pages/CreateActivityTrip.tsx');
  const tripsPagePath = path.resolve(__dirname, '../../src/pages/MozBookTrips.tsx');
  const adminActivitiesPath = path.resolve(__dirname, '../../src/pages/admin/AdminActivities.tsx');
  const adminHostsPath = path.resolve(__dirname, '../../src/pages/admin/AdminHosts.tsx');

  const appContent = fs.readFileSync(appPath, 'utf-8');
  const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
  const hostActivitiesDashboardContent = fs.readFileSync(hostActivitiesDashboardPath, 'utf-8');
  const partnerDashboardContent = fs.readFileSync(partnerDashboardPath, 'utf-8');
  const createActivityTripContent = fs.readFileSync(createActivityTripPath, 'utf-8');
  const tripsPageContent = fs.readFileSync(tripsPagePath, 'utf-8');
  const adminActivitiesContent = fs.readFileSync(adminActivitiesPath, 'utf-8');
  const adminHostsContent = fs.readFileSync(adminHostsPath, 'utf-8');

  describe('1. Single Primary Management Hub (Partner Dashboard)', () => {
    it('preserves /partner/dashboard as the authoritative multi-service management hub in App.tsx', () => {
      expect(appContent).toContain('path="/partner/dashboard" element={<PartnerDashboard />}');
      expect(appContent).toContain('path="/partner" element={<PartnerCategorySelection />}');
    });

    it('PartnerDashboard manages accommodations, activities, trips, transport, bookings, clients, and earnings in one unified workspace', () => {
      expect(partnerDashboardContent).toContain("'overview' | 'accommodations' | 'activities' | 'trips' | 'transport' | 'bookings' | 'clients' | 'earnings' | 'account'");
      expect(partnerDashboardContent).toContain('tabFromUrl');
      expect(partnerDashboardContent).toContain('getHostListings(user.uid)');
      expect(partnerDashboardContent).toContain('getActivitiesTrips({ hostId: user.uid })');
      expect(partnerDashboardContent).toContain('getHostTransportServices(user.uid)');
      expect(partnerDashboardContent).toContain('getHostBookings(user.uid)');
      expect(partnerDashboardContent).toContain('getHostEarnings(user.uid)');
    });

    it('enforces partner-level data isolation: queries are strictly filtered by user.uid', () => {
      // Must not query global collections without partner ownership filtering
      expect(partnerDashboardContent).toContain('user.uid');
      expect(partnerDashboardContent).toContain('getHostStayBookings(listingIds)');
      expect(partnerDashboardContent).toContain('getOperatorDebits(user.uid)');
    });
  });

  describe('2. Compatibility Route & Redirects (/host/activities)', () => {
    it('preserves /host/activities in App.tsx for backwards compatibility', () => {
      expect(appContent).toContain('path="/host/activities" element={<HostActivitiesDashboard />}');
    });

    it('HostActivitiesDashboard performs seamless automatic redirect to /partner/dashboard with tab mapping', () => {
      expect(hostActivitiesDashboardContent).toContain("navigate(`/partner/dashboard?${searchParams.toString()}`, { replace: true });");
      expect(hostActivitiesDashboardContent).toContain("if (tabParam === 'trips')");
      expect(hostActivitiesDashboardContent).toContain("targetTab = 'trips'");
      expect(hostActivitiesDashboardContent).toContain("targetTab = 'activities'");
    });

    it('HostActivitiesDashboard preserves prominent manual fallback banner and safety invariants', () => {
      expect(hostActivitiesDashboardContent).toContain('Primary Multi-Service Hub');
      expect(hostActivitiesDashboardContent).toContain('Open in Partner Dashboard');
      expect(hostActivitiesDashboardContent).toContain('/partner/dashboard?tab=');
      expect(hostActivitiesDashboardContent).toContain('On-Demand Payout Requests Unavailable');
    });
  });

  describe('3. Navigation Menu Consolidation (Navbar.tsx)', () => {
    it('consolidates dropdown navigation to point directly to Partner Dashboard', () => {
      expect(navbarContent).toContain('to="/partner/dashboard"');
      expect(navbarContent).toContain('to="/partner/dashboard?tab=activities"');
      expect(navbarContent).not.toMatch(/<Link[\s\S]*?to="\/host\/activities"[\s\S]*?>[\s\S]*?Host Activities & Trips/);
    });

    it('preserves property hosting and verification links in the navbar', () => {
      expect(navbarContent).toContain('to="/host/create"');
      expect(navbarContent).toContain('to="/host/verify"');
    });
  });

  describe('4. Trips & Experience Management Linking (MozBookTrips.tsx)', () => {
    it('directs activity hosts to Partner Dashboard activities tab', () => {
      expect(tripsPageContent).toContain('to="/partner/dashboard?tab=activities"');
    });

    it('directs tour operators to Partner Dashboard trips tab', () => {
      expect(tripsPageContent).toContain('to="/partner/dashboard?tab=trips"');
    });
  });

  describe('5. Shared Create/Edit Wizard (CreateActivityTrip.tsx)', () => {
    it('preserves /host/activities/create and /host/activities/edit/:id routes', () => {
      expect(appContent).toContain('path="/host/activities/create" element={<CreateActivityTrip />}');
      expect(appContent).toContain('path="/host/activities/edit/:id" element={<CreateActivityTrip />}');
    });

    it('redirects to the matching tab in Partner Dashboard upon save', () => {
      expect(createActivityTripContent).toContain("const targetTab = type === 'trip' ? 'trips' : 'activities';");
      expect(createActivityTripContent).toContain('navigate(`/partner/dashboard?tab=${targetTab}`);');
    });

    it('provides top breadcrumb link back to the matching Partner Dashboard tab', () => {
      expect(createActivityTripContent).toContain("`/partner/dashboard?tab=${type === 'trip' ? 'trips' : 'activities'}`");
      expect(createActivityTripContent).toContain('Back to Partner Dashboard');
    });
  });

  describe('6. Admin Console Isolation', () => {
    it('keeps administrator-only activities and verification management distinct', () => {
      expect(adminActivitiesContent).toContain('export default function AdminActivities()');
      expect(adminHostsContent).toContain('export default function AdminHosts()');
      expect(appContent).toContain('path="/admin/activities"');
      expect(appContent).toContain('path="/admin/verifications"');
    });
  });
});
