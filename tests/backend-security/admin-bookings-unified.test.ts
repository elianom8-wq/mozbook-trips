import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Dashboard Stage 2: Unified Booking Management Verification', () => {
  const appPath = path.resolve(__dirname, '../../src/App.tsx');
  const adminLayoutPath = path.resolve(__dirname, '../../src/components/admin/AdminLayout.tsx');
  const adminDashboardPath = path.resolve(__dirname, '../../src/pages/admin/AdminDashboard.tsx');
  const adminBookingsPath = path.resolve(__dirname, '../../src/pages/admin/AdminBookings.tsx');
  const adminServicePath = path.resolve(__dirname, '../../src/services/adminService.ts');
  const adminTypesPath = path.resolve(__dirname, '../../src/types/admin.ts');
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');

  it('verifies /admin/bookings route is registered and protected by AdminRoute', () => {
    const appContent = fs.readFileSync(appPath, 'utf-8');
    expect(appContent).toContain("import AdminBookings from './pages/admin/AdminBookings'");
    expect(appContent).toContain('path="/admin/bookings"');
    
    // Verify it is inside AdminRoute
    const bookingRouteSnippet = appContent.slice(
      appContent.indexOf('path="/admin/bookings"'),
      appContent.indexOf('path="/admin/bookings"') + 200
    );
    expect(bookingRouteSnippet).toContain('<AdminRoute>');
    expect(bookingRouteSnippet).toContain('<AdminBookings />');
  });

  it('verifies AdminLayout sidebar enables Bookings link with Live badge', () => {
    const layoutContent = fs.readFileSync(adminLayoutPath, 'utf-8');
    expect(layoutContent).toContain("label: 'Bookings', path: '/admin/bookings', icon: CalendarCheck, enabled: true");
  });

  it('verifies AdminDashboard connects Total Bookings KPI and Quick Operations Bookings card', () => {
    const dashContent = fs.readFileSync(adminDashboardPath, 'utf-8');
    expect(dashContent).toContain("actionLink: '/admin/bookings'");
    expect(dashContent).toContain("actionText: 'View bookings'");
    expect(dashContent).toContain('to="/admin/bookings"');
  });

  it('verifies AdminUnifiedBooking interface exists in types/admin.ts', () => {
    const typesContent = fs.readFileSync(adminTypesPath, 'utf-8');
    expect(typesContent).toContain('export interface AdminUnifiedBooking');
    expect(typesContent).toContain('bookingRef: string;');
    expect(typesContent).toContain('category: AdminBookingCategory;');
    expect(typesContent).toContain("sourceCollection: 'bookings' | 'activity_bookings';");
    expect(typesContent).toContain('targetTitle: string;');
    expect(typesContent).toContain('hostId: string;');
    expect(typesContent).toContain('customerName: string;');
    expect(typesContent).toContain('customerEmail: string;');
    expect(typesContent).toContain('startDate: string;');
    expect(typesContent).toContain('totalAmount: number;');
    expect(typesContent).toContain('paymentStatus:');
    expect(typesContent).toContain('fulfillmentStatus:');
  });

  it('verifies adminService contains authoritative getAllBookings and operational action methods', () => {
    const serviceContent = fs.readFileSync(adminServicePath, 'utf-8');
    expect(serviceContent).toContain('async getAllBookings(): Promise<AdminUnifiedBooking[]>');
    expect(serviceContent).toContain("getDocs(collection(db, 'bookings'))");
    expect(serviceContent).toContain("getDocs(collection(db, 'activity_bookings'))");
    expect(serviceContent).toContain('async cancelBooking(params:');
    expect(serviceContent).toContain('async rescheduleBooking(params:');
    expect(serviceContent).toContain('/api/partner/bookings/cancel');
    expect(serviceContent).toContain('/api/bookings/reschedule');
  });

  it('verifies AdminBookings component implements filters, search, multi-status separation, and operational controls', () => {
    const bookingsContent = fs.readFileSync(adminBookingsPath, 'utf-8');
    // Search and filters
    expect(bookingsContent).toContain('searchQuery');
    expect(bookingsContent).toContain('categoryFilter');
    expect(bookingsContent).toContain('statusFilter');
    expect(bookingsContent).toContain('paymentFilter');
    expect(bookingsContent).toContain('activeHostFilter');

    // Multi-status separation
    expect(bookingsContent).toContain('getStatusBadge');
    expect(bookingsContent).toContain('getPaymentBadge');
    expect(bookingsContent).toContain('fulfillmentStatus');

    // Authoritative operational actions
    expect(bookingsContent).toContain('handleExecuteCancel');
    expect(bookingsContent).toContain('handleExecuteReschedule');
    expect(bookingsContent).toContain('adminService.cancelBooking');
    expect(bookingsContent).toContain('adminService.rescheduleBooking');

    // Empty and loading states
    expect(bookingsContent).toContain('No reservations found');
    expect(bookingsContent).toContain('Loading MozBook bookings');
  });

  it('verifies Firestore security rules require isAdmin for full bookings & activity_bookings administration', () => {
    const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
    expect(rulesContent).toContain('match /bookings/{bookingId}');
    expect(rulesContent).toContain('isAdmin()');
    expect(rulesContent).toContain('match /activity_bookings/{bookingId}');
  });
});
