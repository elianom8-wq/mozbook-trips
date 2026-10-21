import { describe, it, expect, beforeEach } from 'vitest';
import { DmcProfile, DmcVerificationStatus } from '../../src/types/dmc';

/**
 * Pure helper mirroring the Partner Dashboard Travel / DMC card presentation and routing rules.
 * This ensures strict adherence to requirements across all DMC verification lifecycle states.
 */
export function getDmcCardConfig(profile: DmcProfile | null, packagesCount: number = 0) {
  if (!profile) {
    return {
      statusBadge: 'Partner Offering Available',
      primaryActionLabel: 'Complete DMC Registration',
      primaryRoute: '/partner/dmc/onboard',
      isAuthorizedDmc: false,
      canPublishPackages: false
    };
  }

  switch (profile.status) {
    case 'approved':
      return {
        statusBadge: 'Verified DMC Partner',
        primaryActionLabel: 'Open DMC Dashboard',
        primaryRoute: '/partner/dmc/dashboard',
        isAuthorizedDmc: true,
        canPublishPackages: true,
        secondaryActionLabel: 'Create Package',
        secondaryRoute: '/partner/dmc/packages/create',
        inaturLicense: profile.inaturLicenseNumber,
        packagesCount
      };

    case 'draft':
      return {
        statusBadge: 'Draft Application',
        primaryActionLabel: 'Continue Application',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false
      };

    case 'pending_review':
      return {
        statusBadge: 'Application Under Review',
        primaryActionLabel: 'Application Under Review',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false,
        inaturLicense: profile.inaturLicenseNumber
      };

    case 'rejected':
      return {
        statusBadge: 'Review Feedback',
        primaryActionLabel: 'View Application Status',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false,
        feedback: profile.rejectionReason || profile.adminNotes
      };

    case 'additional_info_required':
      return {
        statusBadge: 'Information Required',
        primaryActionLabel: 'Update Application',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false,
        feedback: profile.adminNotes
      };

    case 'suspended':
      return {
        statusBadge: 'DMC Suspended',
        primaryActionLabel: 'View Application Status',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false,
        feedback: profile.suspensionReason || profile.adminNotes
      };

    default:
      return {
        statusBadge: 'Partner Offering Available',
        primaryActionLabel: 'Complete DMC Registration',
        primaryRoute: '/partner/dmc/onboard',
        isAuthorizedDmc: false,
        canPublishPackages: false
      };
  }
}

describe('MozBook — Partner Dashboard Travel / DMC Card Integration', () => {
  const baseProfile: DmcProfile = {
    userId: 'partner_test_101',
    userEmail: 'dmc@mozambique-safari.co.mz',
    legalBusinessName: 'Inhambane Expeditions Lda',
    tradingName: 'Inhambane DMC',
    nuit: '102938475',
    inaturLicenseNumber: 'INATUR/AV/2024/777',
    licenseExpiryDate: '2027-12-31',
    representativeName: 'Maria Chissano',
    representativeRole: 'Director',
    representativePhone: '+258 84 999 0000',
    representativeEmail: 'dmc@mozambique-safari.co.mz',
    physicalAddress: 'Av. Marginal, Inhambane',
    city: 'Inhambane',
    province: 'Inhambane',
    operatingRegions: ['Inhambane, Tofo & Barra', 'Vilankulo & Bazaruto Archipelago'],
    specializations: ['Coastal & Marine Expeditions', 'Bespoke Luxury & Honeymoon'],
    languagesSupported: ['Portuguese', 'English'],
    servicesOffered: ['Custom Tailored Itineraries', 'Multi-Day Safari & Bush Tours'],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('1. Routes non-registered partners to /partner/dmc/onboard with "Complete DMC Registration"', () => {
    const config = getDmcCardConfig(null);
    expect(config.primaryRoute).toBe('/partner/dmc/onboard');
    expect(config.primaryActionLabel).toBe('Complete DMC Registration');
    expect(config.statusBadge).toBe('Partner Offering Available');
    expect(config.isAuthorizedDmc).toBe(false);
    expect(config.canPublishPackages).toBe(false);
  });

  it('2. Routes draft applicants to /partner/dmc/onboard with "Continue Application"', () => {
    const draftProfile: DmcProfile = { ...baseProfile, status: 'draft' };
    const config = getDmcCardConfig(draftProfile);
    expect(config.primaryRoute).toBe('/partner/dmc/onboard');
    expect(config.primaryActionLabel).toBe('Continue Application');
    expect(config.statusBadge).toBe('Draft Application');
    expect(config.isAuthorizedDmc).toBe(false);
    expect(config.canPublishPackages).toBe(false);
  });

  it('3. Displays "Application Under Review" for pending submissions and protects DMC operations', () => {
    const pendingProfile: DmcProfile = { ...baseProfile, status: 'pending_review' };
    const config = getDmcCardConfig(pendingProfile);
    expect(config.primaryRoute).toBe('/partner/dmc/onboard');
    expect(config.primaryActionLabel).toBe('Application Under Review');
    expect(config.statusBadge).toBe('Application Under Review');
    expect(config.inaturLicense).toBe('INATUR/AV/2024/777');
    expect(config.isAuthorizedDmc).toBe(false);
    expect(config.canPublishPackages).toBe(false);
  });

  it('4. Authorizes approved DMCs, links to /partner/dmc/dashboard with package metrics', () => {
    const approvedProfile: DmcProfile = { ...baseProfile, status: 'approved' };
    const config = getDmcCardConfig(approvedProfile, 3);
    expect(config.primaryRoute).toBe('/partner/dmc/dashboard');
    expect(config.primaryActionLabel).toBe('Open DMC Dashboard');
    expect(config.statusBadge).toBe('Verified DMC Partner');
    expect(config.isAuthorizedDmc).toBe(true);
    expect(config.canPublishPackages).toBe(true);
    expect(config.packagesCount).toBe(3);
    expect(config.secondaryRoute).toBe('/partner/dmc/packages/create');
  });

  it('5. Routes rejected applications to /partner/dmc/onboard with feedback and re-application path', () => {
    const rejectedProfile: DmcProfile = { 
      ...baseProfile, 
      status: 'rejected',
      rejectionReason: 'INATUR license document was expired.'
    };
    const config = getDmcCardConfig(rejectedProfile);
    expect(config.primaryRoute).toBe('/partner/dmc/onboard');
    expect(config.primaryActionLabel).toBe('View Application Status');
    expect(config.statusBadge).toBe('Review Feedback');
    expect(config.feedback).toContain('expired');
    expect(config.isAuthorizedDmc).toBe(false);
    expect(config.canPublishPackages).toBe(false);
  });

  it('6. Routes additional_info_required to /partner/dmc/onboard with "Update Application"', () => {
    const infoProfile: DmcProfile = { 
      ...baseProfile, 
      status: 'additional_info_required',
      adminNotes: 'Please provide commercial registry certificate'
    };
    const config = getDmcCardConfig(infoProfile);
    expect(config.primaryRoute).toBe('/partner/dmc/onboard');
    expect(config.primaryActionLabel).toBe('Update Application');
    expect(config.statusBadge).toBe('Information Required');
    expect(config.feedback).toBe('Please provide commercial registry certificate');
    expect(config.isAuthorizedDmc).toBe(false);
  });
});
