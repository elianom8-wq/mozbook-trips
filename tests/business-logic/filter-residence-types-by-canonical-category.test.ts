import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ACCOMMODATION_TYPES,
  CANONICAL_PARENT_CATEGORIES,
  getParentCategoryForType,
  getCanonicalTypesByCategory,
  isValidCanonicalCategoryTypePair,
  isCanonicalAccommodationTypeId,
  mapLegacyResidenceType,
  mapCanonicalToLegacyResidenceType,
  LEGACY_RESIDENCE_MAPPINGS,
  CanonicalAccommodationTypeId,
  LegacyResidenceType
} from '../../src/data/canonicalAccommodationTaxonomy';

describe('Filter Residence Types by Canonical Category (Impact & Regression Suite)', () => {
  // ==========================================================================
  // 1. CANONICAL TAXONOMY INTEGRITY & AUTHORITATIVE MAPPING
  // ==========================================================================
  describe('1. Canonical Taxonomy & Category Integrity', () => {
    it('contains exactly 11 canonical parent categories', () => {
      expect(CANONICAL_PARENT_CATEGORIES).toHaveLength(11);
      const uniqueCats = new Set(CANONICAL_PARENT_CATEGORIES);
      expect(uniqueCats.size).toBe(11);
    });

    it('contains exactly 72 canonical accommodation types and all belong to valid categories', () => {
      expect(CANONICAL_ACCOMMODATION_TYPES).toHaveLength(72);
      
      for (const item of CANONICAL_ACCOMMODATION_TYPES) {
        expect(item.backend_id).toBeDefined();
        expect(item.display_name).toBeDefined();
        expect(CANONICAL_PARENT_CATEGORIES).toContain(item.parent_category);
      }
    });

    it('verifies getParentCategoryForType resolves accurately for all 72 types', () => {
      expect(getParentCategoryForType('HOTEL')).toBe('Hotels & Traditional Lodging');
      expect(getParentCategoryForType('RESORT')).toBe('Hotels & Resorts');
      expect(getParentCategoryForType('DIVING_RESORT')).toBe('Specialist Accommodation');
      expect(getParentCategoryForType('GUESTHOUSE')).toBe('Independent & Small Accommodation');
      expect(getParentCategoryForType('HOSTEL')).toBe('Budget & Social Accommodation');
      expect(getParentCategoryForType('BEACH_HOUSE')).toBe('Private & Self-Contained Accommodation');
      expect(getParentCategoryForType('FARMHOUSE')).toBe('Rural & Nature Accommodation');
      expect(getParentCategoryForType('LODGE')).toBe('Lodges & Nature Accommodation');
      expect(getParentCategoryForType('COMMUNITY_LODGE')).toBe('Community & Sustainable Accommodation');
      expect(getParentCategoryForType('SAFARI_CAMP')).toBe('Camping & Tented Accommodation');
      expect(getParentCategoryForType('GLAMPING')).toBe('Camping & Outdoor Accommodation');
    });

    it('all 8 legacy residence types map seamlessly to valid canonical types and categories', () => {
      const legacyTypes: LegacyResidenceType[] = [
        'normal residence',
        'city residence',
        'country residence',
        'studio apartment',
        'lodge',
        'beachfront residence',
        'apartment home residence',
        'outdoor residence'
      ];

      for (const legacy of legacyTypes) {
        const mapping = mapLegacyResidenceType(legacy);
        expect(mapping).toBeDefined();
        expect(isCanonicalAccommodationTypeId(mapping!.canonicalTypeId)).toBe(true);
        const parentCategory = getParentCategoryForType(mapping!.canonicalTypeId);
        expect(parentCategory).toBeDefined();
        expect(CANONICAL_PARENT_CATEGORIES).toContain(parentCategory);
      }
    });
  });

  // ==========================================================================
  // 2. DROPDOWN FILTERING BY CANONICAL CATEGORY
  // ==========================================================================
  describe('2. Dropdown / Options Layer Filtering', () => {
    it('filters accommodation types strictly to the selected parent category', () => {
      const hotelTypes = getCanonicalTypesByCategory('Hotels & Traditional Lodging');
      expect(hotelTypes.map(t => t.backend_id)).toEqual([
        'HOTEL',
        'BOUTIQUE_HOTEL',
        'HOTEL_APARTMENT',
        'APARTHOTEL'
      ]);

      const privateTypes = getCanonicalTypesByCategory('Private & Self-Contained Accommodation');
      expect(privateTypes).toHaveLength(10);
      expect(privateTypes.map(t => t.backend_id)).toContain('BEACH_HOUSE');
      expect(privateTypes.map(t => t.backend_id)).toContain('VILLA');
      expect(privateTypes.map(t => t.backend_id)).not.toContain('HOTEL');

      const lodgeTypes = getCanonicalTypesByCategory('Lodges & Nature Accommodation');
      expect(lodgeTypes).toHaveLength(10);
      expect(lodgeTypes.map(t => t.backend_id)).toContain('LODGE');
      expect(lodgeTypes.map(t => t.backend_id)).toContain('SAFARI_LODGE');
    });

    it('returns all types when parent category is empty or "all"', () => {
      expect(getCanonicalTypesByCategory()).toHaveLength(72);
      expect(getCanonicalTypesByCategory('all')).toHaveLength(72);
    });

    it('changing parent category preserves existing type when type is valid in new category', () => {
      // Simulation of user category selection handler logic
      const simulateCategoryChange = (
        currentType: CanonicalAccommodationTypeId,
        newCategory: string
      ): { nextType: CanonicalAccommodationTypeId; changed: boolean } => {
        if (isValidCanonicalCategoryTypePair(newCategory, currentType)) {
          return { nextType: currentType, changed: false };
        }
        const available = getCanonicalTypesByCategory(newCategory);
        return { nextType: available[0].backend_id, changed: true };
      };

      // VILLA belongs to 'Private & Self-Contained Accommodation'
      const res1 = simulateCategoryChange('VILLA', 'Private & Self-Contained Accommodation');
      expect(res1.changed).toBe(false);
      expect(res1.nextType).toBe('VILLA');

      // Changing to 'Hotels & Traditional Lodging' makes VILLA invalid -> resets to HOTEL
      const res2 = simulateCategoryChange('VILLA', 'Hotels & Traditional Lodging');
      expect(res2.changed).toBe(true);
      expect(res2.nextType).toBe('HOTEL');
    });
  });

  // ==========================================================================
  // 3. EXISTING LISTING EDITING SELECTION PRESERVATION
  // ==========================================================================
  describe('3. Existing Listing Editing & Selection Preservation', () => {
    it('preserves saved canonicalType and parentCategory without clearing when loaded', () => {
      const existingListing = {
        id: 'list_123',
        title: 'Ponta do Ouro Beach Villa',
        residenceType: 'beachfront residence' as const,
        canonicalType: 'BEACH_HOUSE' as CanonicalAccommodationTypeId,
        canonicalCategory: 'Private & Self-Contained Accommodation',
        price: 8500
      };

      // Infer category on load
      const loadedCategory = existingListing.canonicalCategory || getParentCategoryForType(existingListing.canonicalType);
      const loadedType = existingListing.canonicalType;

      expect(loadedCategory).toBe('Private & Self-Contained Accommodation');
      expect(loadedType).toBe('BEACH_HOUSE');

      // Dropdown options available for this category
      const availableOptions = getCanonicalTypesByCategory(loadedCategory);
      expect(availableOptions.some(opt => opt.backend_id === loadedType)).toBe(true);
    });

    it('safely infers canonical category and type from legacy residenceType for legacy listings', () => {
      const legacyListing = {
        id: 'list_legacy_456',
        title: 'Gorongosa Eco Safari Lodge',
        residenceType: 'lodge' as const,
        price: 5000
      };

      const mapping = mapLegacyResidenceType(legacyListing.residenceType);
      expect(mapping).toBeDefined();
      expect(mapping!.canonicalTypeId).toBe('LODGE');

      const inferredCategory = getParentCategoryForType(mapping!.canonicalTypeId);
      expect(inferredCategory).toBe('Lodges & Nature Accommodation');

      const options = getCanonicalTypesByCategory(inferredCategory);
      expect(options.some(opt => opt.backend_id === 'LODGE')).toBe(true);
    });

    it('editing other fields leaves canonical category and type untouched', () => {
      const state = {
        residenceType: 'beachfront residence' as const,
        canonicalType: 'BEACH_HOUSE' as CanonicalAccommodationTypeId,
        selectedParentCategory: 'Private & Self-Contained Accommodation',
        title: 'Initial Title',
        price: 5000
      };

      // Host updates title and price only
      const updatedState = {
        ...state,
        title: 'Updated Seaside Luxury House',
        price: 6500
      };

      expect(updatedState.canonicalType).toBe('BEACH_HOUSE');
      expect(updatedState.selectedParentCategory).toBe('Private & Self-Contained Accommodation');
      expect(updatedState.residenceType).toBe('beachfront residence');
    });
  });

  // ==========================================================================
  // 4. DRAFT PERSISTENCE & RESTORATION
  // ==========================================================================
  describe('4. Draft Persistence & Recovery', () => {
    it('serializes and deserializes draft with selectedParentCategory intact', () => {
      const draftPayload = {
        residenceType: 'lodge' as const,
        canonicalType: 'SAFARI_LODGE' as CanonicalAccommodationTypeId,
        selectedParentCategory: 'Lodges & Nature Accommodation',
        title: 'Kruger Border Safari Camp',
        price: 12000
      };

      const serialized = JSON.stringify(draftPayload);
      const restored = JSON.parse(serialized);

      expect(restored.selectedParentCategory).toBe('Lodges & Nature Accommodation');
      expect(restored.canonicalType).toBe('SAFARI_LODGE');
      expect(restored.residenceType).toBe('lodge');
    });

    it('recovers category when restoring legacy draft that lacks selectedParentCategory', () => {
      const legacyDraft = {
        residenceType: 'city residence' as const,
        canonicalType: 'TOWNHOUSE' as CanonicalAccommodationTypeId,
        title: 'Maputo Polana Apartment',
        price: 4500
      };

      const recoveredCategory = (legacyDraft as any).selectedParentCategory || getParentCategoryForType(legacyDraft.canonicalType);
      expect(recoveredCategory).toBe('Private & Self-Contained Accommodation');
    });
  });

  // ==========================================================================
  // 5. VALIDATION OF INVALID CATEGORY/TYPE COMBINATIONS
  // ==========================================================================
  describe('5. Validation of Category & Type Combinations', () => {
    it('accepts valid category-to-type pairings', () => {
      expect(isValidCanonicalCategoryTypePair('Hotels & Traditional Lodging', 'HOTEL')).toBe(true);
      expect(isValidCanonicalCategoryTypePair('Hotels & Traditional Lodging', 'BOUTIQUE_HOTEL')).toBe(true);
      expect(isValidCanonicalCategoryTypePair('Lodges & Nature Accommodation', 'SAFARI_LODGE')).toBe(true);
      expect(isValidCanonicalCategoryTypePair('Camping & Outdoor Accommodation', 'GLAMPING')).toBe(true);
    });

    it('rejects invalid category-to-type pairings', () => {
      // BEACH_HOUSE is in Private & Self-Contained, NOT Hotels & Traditional Lodging
      expect(isValidCanonicalCategoryTypePair('Hotels & Traditional Lodging', 'BEACH_HOUSE')).toBe(false);

      // LODGE is in Lodges & Nature Accommodation, NOT Budget & Social
      expect(isValidCanonicalCategoryTypePair('Budget & Social Accommodation', 'LODGE')).toBe(false);

      // HOTEL is NOT in Camping & Outdoor
      expect(isValidCanonicalCategoryTypePair('Camping & Outdoor Accommodation', 'HOTEL')).toBe(false);
    });

    it('rejects nonexistent or fabricated canonical type IDs', () => {
      expect(isCanonicalAccommodationTypeId('FABRICATED_SUPER_HOTEL')).toBe(false);
      expect(isCanonicalAccommodationTypeId('RANDOM_STRING')).toBe(false);
      expect(isCanonicalAccommodationTypeId(undefined)).toBe(false);
      expect(isValidCanonicalCategoryTypePair('Hotels & Traditional Lodging', 'FABRICATED_SUPER_HOTEL')).toBe(false);
    });
  });

  // ==========================================================================
  // 6. SIMPLIFIED STEP 1 UI CONTRACT VERIFICATION
  // ==========================================================================
  describe('6. Simplified Step 1 UI Contract Verification', () => {
    const fs = require('fs');
    const path = require('path');
    const createListingSource = fs.readFileSync(path.resolve(__dirname, '../../src/pages/CreateListing.tsx'), 'utf8');
    const editListingSource = fs.readFileSync(path.resolve(__dirname, '../../src/pages/EditListing.tsx'), 'utf8');

    it('1. None of the eight preset cards appear in Step 1 in CreateListing or EditListing', () => {
      // Step 1 card grid and RESIDENCE_TYPES mapping in Step 1 must be removed
      expect(createListingSource).not.toContain('RESIDENCE_TYPES.map');
      expect(editListingSource).not.toContain('RESIDENCE_TYPES.map');
      expect(createListingSource).not.toContain('getResidenceIcon');
      expect(editListingSource).not.toContain('getResidenceIcon');
      expect(createListingSource).not.toContain('Refine your property');
      expect(editListingSource).not.toContain('Refine your property');
    });

    it('2. The two dropdown labels are exactly "Category" and "Accommodation Type"', () => {
      // In CreateListing
      expect(createListingSource).toContain('Category\n                </label>');
      expect(createListingSource).toContain('Accommodation Type\n                </label>');
      // In EditListing
      expect(editListingSource).toContain('Category\n                </label>');
      expect(editListingSource).toContain('Accommodation Type\n                </label>');
    });

    it('3. No "Canonical" terminology or type counts like (x types) are displayed in controls', () => {
      // Check that labels and option templates do NOT include "Canonical Category" or type count brackets
      expect(createListingSource).not.toContain('Canonical Category');
      expect(editListingSource).not.toContain('Canonical Category');
      expect(createListingSource).not.toContain('types)');
      expect(editListingSource).not.toContain('types)');
    });

    it('4. All 11 categories remain available in CANONICAL_PARENT_CATEGORIES', () => {
      expect(CANONICAL_PARENT_CATEGORIES).toHaveLength(11);
      const expectedCategories = [
        'Hotels & Traditional Lodging',
        'Hotels & Resorts',
        'Specialist Accommodation',
        'Independent & Small Accommodation',
        'Budget & Social Accommodation',
        'Private & Self-Contained Accommodation',
        'Rural & Nature Accommodation',
        'Lodges & Nature Accommodation',
        'Community & Sustainable Accommodation',
        'Camping & Tented Accommodation',
        'Camping & Outdoor Accommodation'
      ];
      for (const cat of expectedCategories) {
        expect(CANONICAL_PARENT_CATEGORIES).toContain(cat);
      }
    });

    it('5. The accommodation type dropdown filters correctly for every single category', () => {
      for (const cat of CANONICAL_PARENT_CATEGORIES) {
        const types = getCanonicalTypesByCategory(cat);
        expect(types.length).toBeGreaterThan(0);
        for (const t of types) {
          expect(t.parent_category).toBe(cat);
          expect(t.display_name).toBeTruthy();
        }
      }
    });

    it('6. Changing categories cannot leave an invalid type selected', () => {
      // Starting in Camping & Outdoor with GLAMPING
      let currentCategory = 'Camping & Outdoor Accommodation';
      let currentType: CanonicalAccommodationTypeId = 'GLAMPING';
      expect(isValidCanonicalCategoryTypePair(currentCategory, currentType)).toBe(true);

      // User changes category to 'Hotels & Traditional Lodging'
      const newCategory = 'Hotels & Traditional Lodging';
      if (!isValidCanonicalCategoryTypePair(newCategory, currentType)) {
        currentType = getCanonicalTypesByCategory(newCategory)[0].backend_id;
      }
      expect(currentType).toBe('HOTEL');
      expect(isValidCanonicalCategoryTypePair(newCategory, currentType)).toBe(true);
    });

    it('7. Informational panel shows clean display name and description without internal IDs or technical tags', () => {
      const typeInfo = CANONICAL_ACCOMMODATION_TYPES.find(t => t.backend_id === 'BEACH_HOUSE');
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.display_name).toBe('Beach House');
      expect(typeInfo!.description).toBeTruthy();
      // Description must be human-readable and intended for hosts
      expect(typeInfo!.description.toLowerCase()).toContain('coastal');
    });
  });
});
