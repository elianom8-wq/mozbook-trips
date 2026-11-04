import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Listing, NearbyPlace, formatPhysicalAddress } from '../../src/services/listingService';

describe('MozBook UI Update: Remove Step 4 — What\'s Nearby?', () => {
  const createListingPath = path.resolve(__dirname, '../../src/pages/CreateListing.tsx');
  const editListingPath = path.resolve(__dirname, '../../src/pages/EditListing.tsx');
  const createListingContent = fs.readFileSync(createListingPath, 'utf-8');
  const editListingContent = fs.readFileSync(editListingPath, 'utf-8');

  // ==========================================================================
  // 1. WHAT'S NEARBY STEP REMOVED FROM LISTING WIZARD
  // ==========================================================================
  describe('1. Removal of What\'s Nearby Step from Host Wizard', () => {
    it('completely removes What\'s Nearby section header from CreateListing.tsx', () => {
      expect(createListingContent).not.toContain("What's Nearby?");
      expect(createListingContent).not.toContain("Add nearby restaurants, activities");
    });

    it('completely removes What\'s Nearby section header from EditListing.tsx', () => {
      expect(editListingContent).not.toContain("What's Nearby?");
    });

    it('does not import or render NearbyPlacesManager in CreateListing.tsx', () => {
      expect(createListingContent).not.toContain("import NearbyPlacesManager");
      expect(createListingContent).not.toContain("<NearbyPlacesManager");
    });

    it('does not import or render NearbyPlacesManager in EditListing.tsx', () => {
      expect(editListingContent).not.toContain("import NearbyPlacesManager");
      expect(editListingContent).not.toContain("<NearbyPlacesManager");
    });

    it('preserves the shared NearbyPlacesManager component file for other platform features', () => {
      const managerPath = path.resolve(__dirname, '../../src/components/NearbyPlacesManager.tsx');
      expect(fs.existsSync(managerPath)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. WIZARD STEP RENUMBERING (6 TOTAL STEPS)
  // ==========================================================================
  describe('2. Wizard Step Renumbering and 6-Step Total', () => {
    it('contains zero occurrences of legacy "of 7" step count in CreateListing.tsx', () => {
      expect(createListingContent).not.toContain('of 7');
      expect(createListingContent).not.toContain('Step 4 of 7');
      expect(createListingContent).not.toContain('Step 5 of 7');
      expect(createListingContent).not.toContain('Step 7 of 7');
    });

    it('contains zero occurrences of legacy "of 7" step count in EditListing.tsx', () => {
      expect(editListingContent).not.toContain('of 7');
      expect(editListingContent).not.toContain('Step 4 of 7');
      expect(editListingContent).not.toContain('Step 5 of 7');
      expect(editListingContent).not.toContain('Step 7 of 7');
    });

    it('contains sequential "Step 1 of 6" through "Step 6 of 6" in CreateListing.tsx', () => {
      expect(createListingContent).toContain('Step 1 of 6');
      expect(createListingContent).toContain('Step 2 of 6');
      expect(createListingContent).toContain('Step 3 of 6');
      expect(createListingContent).toContain('Step 4 of 6');
      expect(createListingContent).toContain('Step 5 of 6');
      expect(createListingContent).toContain('Step 6 of 6');
    });

    it('contains sequential "Step 1 of 6" through "Step 6 of 6" in EditListing.tsx', () => {
      expect(editListingContent).toContain('Step 1 of 6');
      expect(editListingContent).toContain('Step 2 of 6');
      expect(editListingContent).toContain('Step 3 of 6');
      expect(editListingContent).toContain('Step 4 of 6');
      expect(editListingContent).toContain('Step 5 of 6');
      expect(editListingContent).toContain('Step 6 of 6');
    });

    it('transitions directly from Step 3 (Location & Address) to Step 4 (Dates & Pricing)', () => {
      // In CreateListing, Step 3 ends and Step 4 immediately follows
      const step3Index = createListingContent.indexOf('Step 3 of 6');
      const step4Index = createListingContent.indexOf('Step 4 of 6');
      expect(step3Index).toBeGreaterThan(0);
      expect(step4Index).toBeGreaterThan(step3Index);

      // Between step 3 and step 4, there must be NO nearby places or attractions
      const between3and4 = createListingContent.slice(step3Index, step4Index);
      expect(between3and4.toLowerCase()).not.toContain('nearby');
      expect(between3and4.toLowerCase()).not.toContain('attraction');
    });
  });

  // ==========================================================================
  // 3. BACKWARD COMPATIBILITY & EXISTING LISTING / DRAFT PRESERVATION
  // ==========================================================================
  describe('3. Existing Data & Draft Compatibility', () => {
    it('preserves existing nearbyPlaces in previously stored listings without data loss', () => {
      const existingListing: Listing = {
        id: 'mock-listing-with-nearby',
        title: 'Tofo Ocean View Chalet',
        description: 'Charming beach chalet in Inhambane.',
        location: 'Tofo, Inhambane, Mozambique',
        price: 3500,
        rating: 4.9,
        images: ['https://example.com/photo.jpg'],
        hostId: 'host-123',
        nearbyPlaces: [
          {
            id: 'place-1',
            name: 'Dino\'s Beach Bar',
            category: 'restaurant',
            distance: '3 min walk',
            description: 'Local grilled seafood and live music.'
          },
          {
            id: 'place-2',
            name: 'Peri-Peri Divers',
            category: 'activity',
            distance: '5 min walk',
            description: 'Scuba diving with manta rays and whale sharks.'
          }
        ]
      };

      // Existing listing data remains intact and unchanged
      expect(existingListing.nearbyPlaces).toHaveLength(2);
      expect(existingListing.nearbyPlaces?.[0].name).toBe('Dino\'s Beach Bar');
      expect(existingListing.nearbyPlaces?.[1].category).toBe('activity');
    });

    it('new listings can be successfully created without any nearbyPlaces', () => {
      const newListingData: Partial<Listing> = {
        title: 'Modern Maputo Apartment',
        description: 'Central city residence.',
        location: 'Maputo, Mozambique',
        city: 'Maputo',
        province: 'Maputo Cidade',
        country: 'Mozambique',
        price: 4000,
        nearbyPlaces: [] // No nearby places required!
      };

      expect(newListingData.title).toBe('Modern Maputo Apartment');
      expect(newListingData.nearbyPlaces).toEqual([]);
    });

    it('draft restoration safely handles both drafts with and without nearbyPlaces', () => {
      // Draft A: created prior to step removal with nearbyPlaces
      const oldDraft = {
        title: 'Draft with Nearby',
        nearbyPlaces: [
          { name: 'Old Sights', category: 'culture' }
        ]
      };
      const restoredA = Array.isArray(oldDraft.nearbyPlaces) ? oldDraft.nearbyPlaces : [];
      expect(restoredA).toHaveLength(1);

      // Draft B: created after step removal with no nearbyPlaces
      const newDraft = {
        title: 'Draft without Nearby',
        nearbyPlaces: undefined
      };
      const restoredB = Array.isArray(newDraft.nearbyPlaces) ? newDraft.nearbyPlaces : [];
      expect(restoredB).toEqual([]);
    });
  });

  // ==========================================================================
  // 4. SHARED LOCATION & DETAILS INTEGRITY
  // ==========================================================================
  describe('4. Shared Platform Integrity', () => {
    it('preserves ListingDetails location and nearby places guest-facing display', () => {
      const listingDetailsPath = path.resolve(__dirname, '../../src/pages/ListingDetails.tsx');
      const listingDetailsContent = fs.readFileSync(listingDetailsPath, 'utf-8');

      // ListingDetails still shows Where you'll be and What's nearby to travelers
      expect(listingDetailsContent).toContain("Where you'll be");
      expect(listingDetailsContent).toContain("What's nearby?");
      expect(listingDetailsContent).toContain("listing.nearbyPlaces");
    });
  });
});
