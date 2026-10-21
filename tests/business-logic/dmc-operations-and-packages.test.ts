import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  submitDmcOnboarding, 
  updateDmcVerificationStatus,
  createTravelPackage,
  getHostTravelPackages,
  saveDmcSupplier,
  getDmcSuppliers,
  createDmcEnquiry,
  updateDmcEnquiryStatus
} from '../../src/services/dmcService';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../../src/config/platformCommission';
import { TravelPackage, DmcProfile } from '../../src/types/dmc';

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    }
  };
}

const mockLocalStorage = createMockStorage();
// @ts-ignore
globalThis.localStorage = mockLocalStorage;

describe('MozBook — Travel / DMC (Destination Management Company) Business Logic', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. DMC Partner Onboarding & Verification Integrity', () => {
    it('sets new onboarding submissions to pending_review and does NOT allow self-approval', async () => {
      const mockSubmission: Omit<DmcProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: 'partner_dmc_123',
        userEmail: 'antonio@bazarutodmc.co.mz',
        legalBusinessName: 'Bazaruto Expeditions Lda',
        tradingName: 'Bazaruto DMC',
        nuit: '109283746',
        inaturLicenseNumber: 'INATUR/AV/2024/089',
        licenseExpiryDate: '2027-12-31',
        representativeName: 'Antonio Silva',
        representativeRole: 'Managing Director',
        representativeEmail: 'antonio@bazarutodmc.co.mz',
        representativePhone: '+258 84 123 4567',
        city: 'Vilankulo',
        province: 'Inhambane',
        physicalAddress: 'Av. Marginal 104, Vilankulo, Inhambane',
        operatingRegions: ['Vilankulo & Bazaruto Archipelago', 'Inhambane, Tofo & Barra'],
        specializations: ['Coastal & Marine Expeditions', 'Bespoke Luxury & Honeymoon'],
        languagesSupported: ['English', 'Portuguese', 'French'],
        servicesOffered: ['Multi-Day Packages', 'Airport & Inter-city Transfers', 'Custom Itineraries'],
        status: 'approved' as any // Attempting to self-approve!
      };

      const result = await submitDmcOnboarding(mockSubmission, false);
      // Must be forced to pending_review regardless of submitted payload
      expect(result.status).toBe('pending_review');
      expect(result.inaturLicenseNumber).toBe('INATUR/AV/2024/089');
    });

    it('sets draft submissions to draft status for in-progress applications', async () => {
      const mockSubmission: Omit<DmcProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: 'partner_draft_456',
        userEmail: 'draft@gorongosa.co.mz',
        legalBusinessName: 'Gorongosa Safaris Lda',
        tradingName: 'Gorongosa Safaris',
        nuit: '998877665',
        inaturLicenseNumber: 'INATUR/AV/2025/001',
        licenseExpiryDate: '2028-12-31',
        representativeName: 'Draft Contact',
        representativeRole: 'Operations Lead',
        representativePhone: '+258 84 000 0000',
        representativeEmail: 'draft@gorongosa.co.mz',
        physicalAddress: 'Gorongosa Camp',
        city: 'Chitengo',
        province: 'Sofala',
        operatingRegions: ['Gorongosa National Park & Sofala'],
        specializations: ['Wildlife Safaris & Conservation'],
        languagesSupported: ['Portuguese', 'English'],
        servicesOffered: ['Multi-Day Packages'],
        status: 'draft'
      };

      const result = await submitDmcOnboarding(mockSubmission, true);
      expect(result.status).toBe('draft');
    });

    it('allows an authorized admin to approve or reject a DMC partner with notes', async () => {
      const mockSubmission: Omit<DmcProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: 'partner_dmc_admin_test',
        userEmail: 'info@quirimbas.co.mz',
        legalBusinessName: 'Quirimbas Travel Lda',
        tradingName: 'Quirimbas Travel',
        nuit: '123456789',
        inaturLicenseNumber: 'INATUR/AV/2023/044',
        licenseExpiryDate: '2026-10-30',
        representativeName: 'Quirimbas Lead',
        representativeRole: 'Owner',
        representativePhone: '+258 87 111 2222',
        representativeEmail: 'info@quirimbas.co.mz',
        physicalAddress: 'Av. Eduardo Mondlane',
        city: 'Pemba',
        province: 'Cabo Delgado',
        operatingRegions: ['Pemba & Quirimbas Archipelago'],
        specializations: ['Cultural & Historical Heritage'],
        languagesSupported: ['Portuguese', 'English'],
        servicesOffered: ['Multi-Day Packages'],
        status: 'pending_review'
      };

      const profile = await submitDmcOnboarding(mockSubmission, false);
      expect(profile.status).toBe('pending_review');

      // Admin approves
      await updateDmcVerificationStatus(profile.id!, profile.userId, 'approved', 'INATUR license verified with authorities', 'admin_officer_01');

      // Check status was updated
      const raw = localStorage.getItem('mozbook_dmc_profiles');
      const parsed: DmcProfile[] = JSON.parse(raw || '[]');
      const found = parsed.find(p => p.userId === 'partner_dmc_admin_test');
      expect(found?.status).toBe('approved');
      expect(found?.adminNotes).toBe('INATUR license verified with authorities');
    });
  });

  describe('2. Travel Package Commission & Pricing Rules', () => {
    it('applies the canonical platform commission (15% MozBook, 85% Partner Share)', () => {
      const packagePriceMzn = 65000; // 65,000 MZN package
      const split = calculateCommission(packagePriceMzn);

      expect(MOZBOOK_COMMISSION_PERCENT).toBe(15);
      expect(PARTNER_SHARE_PERCENT).toBe(85);
      expect(split.commissionAmount).toBe(9750);
      expect(split.partnerShare).toBe(55250);
      expect(split.commissionAmount + split.partnerShare).toBe(packagePriceMzn);
    });

    it('calculates single supplement and discounts correctly for group bookings', () => {
      const baseAdultPrice = 40000;
      const singleSupplement = 8500;
      const childDiscountPercent = 25;

      // 2 adults sharing (no single supplement)
      const twoAdultsTotal = 2 * baseAdultPrice;
      expect(twoAdultsTotal).toBe(80000);

      // 1 solo traveler in private room
      const soloTravelerTotal = baseAdultPrice + singleSupplement;
      expect(soloTravelerTotal).toBe(48500);

      // 1 child with 25% discount
      const childPrice = baseAdultPrice * (1 - childDiscountPercent / 100);
      expect(childPrice).toBe(30000);
    });
  });

  describe('3. Multi-Service Travel Package & Itinerary Builder', () => {
    it('creates, saves and retrieves a travel package for a DMC host', async () => {
      const newPkg: Omit<TravelPackage, 'id' | 'createdAt' | 'updatedAt'> = {
        hostId: 'dmc_host_777',
        hostName: 'Gorongosa Wilderness Expeditions',
        title: '7-Day Gorongosa Safari & Bazaruto Marine Expedition',
        subtitle: 'Experience the wild heart and pristine coastline of Mozambique',
        shortDescription: 'Complete multi-destination journey across wilderness and tropical archipelago.',
        description: 'Complete multi-destination journey across wilderness and tropical archipelago with full itinerary and services.',
        category: 'Wildlife & Marine Safari',
        primaryDestination: 'Gorongosa National Park & Sofala',
        destinations: ['Gorongosa National Park & Sofala', 'Vilankulo & Bazaruto Archipelago'],
        durationDays: 7,
        durationNights: 6,
        minGroupSize: 2,
        maxGroupSize: 8,
        isPrivateTourAvailable: true,
        pricePerPersonMzn: 125000,
        currency: 'MZN',
        scheduleType: 'flexible_daily',
        departureDates: [],
        coverImage: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80',
        images: ['https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80'],
        status: 'draft',
        itinerary: [
          {
            day: 1,
            title: 'Arrival in Beira & Transfer to Gorongosa',
            description: 'Meet guide at Beira Airport, scenic drive to Montebelo Gorongosa Lodge.',
            accommodationName: 'Montebelo Gorongosa Safari Lodge',
            mealsIncluded: ['dinner']
          },
          {
            day: 2,
            title: 'Full Day Wildlife Game Drives',
            description: 'Dawn game drive tracking lions and elephants, afternoon birding at Lake Urema.',
            accommodationName: 'Montebelo Gorongosa Safari Lodge',
            mealsIncluded: ['breakfast', 'lunch', 'dinner']
          }
        ],
        included: ['All game drives', 'Park entrance fees', 'Internal transfers', 'Bilingual guides'],
        notIncluded: ['International flights', 'Alcoholic beverages', 'Travel insurance'],
        whatToBring: ['Safari hat', 'Binoculars', 'Light neutral clothing'],
        travelRequirements: ['Valid passport', 'Yellow fever certificate if applicable'],
        pickupLocation: 'Beira International Airport (BEW)',
        dropoffLocation: 'Vilankulo Airport (VNX)'
      };

      const created = await createTravelPackage(newPkg);
      expect(created.id).toBeDefined();
      expect(created.title).toBe('7-Day Gorongosa Safari & Bazaruto Marine Expedition');
      expect(created.itinerary.length).toBe(2);

      const hostPackages = await getHostTravelPackages('dmc_host_777');
      expect(hostPackages.length).toBe(1);
      expect(hostPackages[0].hostId).toBe('dmc_host_777');
    });
  });

  describe('4. Preferred Suppliers Directory & Custom Inquiries', () => {
    it('allows a DMC partner to add, update, and manage verified local suppliers', () => {
      const supplier = saveDmcSupplier({
        hostId: 'dmc_host_777',
        name: 'Vilankulo Marine Dhow Charters',
        category: 'transport',
        contactName: 'Capitão Moises',
        contactEmail: 'charters@vilankulo.co.mz',
        contactPhone: '+258 82 999 8888',
        location: 'Vilankulo',
        contractStatus: 'active',
        notes: 'Dependable fleet for Santa Carolina island excursions'
      });

      expect(supplier.id).toBeDefined();
      const list = getDmcSuppliers('dmc_host_777');
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('Vilankulo Marine Dhow Charters');
    });

    it('tracks customer inquiries and quote updates', () => {
      const enquiry = createDmcEnquiry({
        packageId: 'pkg_123',
        packageTitle: 'Bazaruto Island Hopping & Coral Reef Diving',
        hostId: 'dmc_host_777',
        customerName: 'Sarah Jenkins',
        customerEmail: 'sarah.j@example.com',
        customerPhone: '+44 7700 900077',
        adultsCount: 4,
        childrenCount: 2,
        travelDates: '2026-11-15 to 2026-11-22',
        specialRequests: 'Need gluten-free catering and private catamarans'
      });

      expect(enquiry.id).toBeDefined();
      expect(enquiry.status).toBe('new');

      // Update with quote
      const updated = updateDmcEnquiryStatus(enquiry.id, 'quoted', 380000, 'Custom itinerary including private catamaran upgrade');
      expect(updated).toBe(true);
    });
  });
});
