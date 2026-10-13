import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MozBook Navigation & Footer Integrity', () => {
  const appFilePath = path.resolve(__dirname, '../../src/App.tsx');
  const appContent = fs.readFileSync(appFilePath, 'utf-8');

  it('preserves the 3 consolidated Hosting navigation items', () => {
    expect(appContent).toContain('List Your Property');
    expect(appContent).toContain('List Activities & Trips');
    expect(appContent).toContain('Hosting Resources');
  });

  it('removes duplicate public Host Portal Hub and Host Document Verification from the public footer', () => {
    // Extract footer section only
    const footerMatch = appContent.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footerContent = footerMatch![0];

    expect(footerContent).not.toContain('Host Portal Hub');
    expect(footerContent).not.toContain('Host Document Verification');
    expect(footerContent).not.toContain('Verified Host Standards');
  });

  it('removes unauthorised or unsupported AirCover branding from the footer', () => {
    const footerMatch = appContent.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footerContent = footerMatch![0];

    expect(footerContent).not.toContain('AirCover');
  });

  it('removes hardcoded specific listings (Bazaruto Dhow Safaris, Ponta do Ouro Dolphin Swims) from footer', () => {
    const footerMatch = appContent.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footerContent = footerMatch![0];

    expect(footerContent).not.toContain('Bazaruto Dhow Safaris');
    expect(footerContent).not.toContain('Ponta do Ouro Dolphin Swims');
  });

  it('preserves critical customer discovery links in the footer', () => {
    const footerMatch = appContent.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footerContent = footerMatch![0];

    expect(footerContent).toContain('/emergency');
    expect(footerContent).toContain('Emergency Directory');
    expect(footerContent).toContain('/info-hub');
    expect(footerContent).toContain('Information Hub');
    expect(footerContent).toContain('/eateries');
    expect(footerContent).toContain('Eateries & Social Check-In');
    expect(footerContent).toContain('/trips');
    expect(footerContent).toContain('MozBook Trips & Activities');
    expect(footerContent).toContain('/travel-companion');
    expect(footerContent).toContain('Travel Companion');
  });

  it('preserves Prompt 28A legal document links in the footer', () => {
    const footerMatch = appContent.match(/<footer[\s\S]*?<\/footer>/);
    expect(footerMatch).not.toBeNull();
    const footerContent = footerMatch![0];

    expect(footerContent).toContain('/legal?tab=terms_customer');
    expect(footerContent).toContain('/legal?tab=privacy_policy');
    expect(footerContent).toContain('/legal?tab=cancellation_refund_policy');
    expect(footerContent).toContain('/legal?tab=partner_agreement');
    expect(footerContent).toContain('Elvira da Gloria Consulting SU, Lda.');
  });

  it('preserves authenticated and internal host verification and admin routes in App.tsx', () => {
    // The underlying routes must remain defined in App.tsx
    expect(appContent).toContain('path="/host/verify" element={<HostVerificationPage />}');
    expect(appContent).toContain('path="/admin/verifications"');
    expect(appContent).toContain('path="/host" element={<HostHub />}');
    expect(appContent).toContain('path="/host/create" element={<CreateListing />}');
    expect(appContent).toContain('path="/host/activities" element={<HostActivitiesDashboard />}');
  });
});
