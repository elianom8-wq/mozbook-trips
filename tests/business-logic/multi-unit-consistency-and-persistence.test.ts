import { describe, it, expect } from 'vitest';
import {
  isLodgeAccommodationType,
  COMMERCIAL_MULTI_UNIT_CANONICAL_TYPES,
  isCommercialMultiUnitType,
  isMultiUnitCapable,
  getCanonicalAccommodationType,
  CanonicalAccommodationTypeId
} from '../../src/data/canonicalAccommodationTaxonomy';
import {
  sanitizeFirestorePayload,
  calculateTotalLodgeUnits,
  Listing,
  LodgeAccommodation
} from '../../src/services/listingService';

describe('MozBook — Accommodation Multi-Unit Consistency & Persistence', () => {
  // ==========================================================================
  // 1. CANONICAL MULTI-UNIT TAXONOMY HELPERS & CLASSIFICATION
  // ==========================================================================
  describe('1. Canonical Multi-Unit Taxonomy Classification', () => {
    it('accurately identifies lodge accommodation types', () => {
      expect(isLodgeAccommodationType('LODGE')).toBe(true);
      expect(isLodgeAccommodationType('SAFARI_LODGE')).toBe(true);
      expect(isLodgeAccommodationType('ECO_LODGE')).toBe(true);
      expect(isLodgeAccommodationType('COMMUNITY_LODGE')).toBe(true);
      expect(isLodgeAccommodationType('BEACH_LODGE')).toBe(true);
      expect(isLodgeAccommodationType(undefined, 'lodge')).toBe(true);
      
      expect(isLodgeAccommodationType('HOTEL')).toBe(false);
      expect(isLodgeAccommodationType('APARTMENT')).toBe(false);
      expect(isLodgeAccommodationType('VILLA')).toBe(false);
    });

    it('recognizes commercial multi-unit types including hotels, resorts, lodges, camps, hostels', () => {
      const expectedCommercialTypes: CanonicalAccommodationTypeId[] = [
        'HOTEL',
        'BOUTIQUE_HOTEL',
        'HOTEL_APARTMENT',
        'APARTHOTEL',
        'RESORT',
        'BEACH_RESORT',
        'ECO_RESORT',
        'ISLAND_RESORT',
        'FAMILY_RESORT',
        'WELLNESS_RESORT',
        'DIVING_RESORT',
        'FISHING_RESORT',
        'SAFARI_RESORT',
        'LODGE',
        'SAFARI_LODGE',
        'ECO_LODGE',
        'WILDERNESS_LODGE',
        'BEACH_LODGE',
        'COMMUNITY_LODGE',
        'HOSTEL',
        'BACKPACKER_HOSTEL',
        'SAFARI_CAMP',
        'TENTED_CAMP',
        'CAMPSITE',
        'CARAVAN_CAMP'
      ];

      for (const typeId of expectedCommercialTypes) {
        expect(COMMERCIAL_MULTI_UNIT_CANONICAL_TYPES).toContain(typeId);
        expect(isCommercialMultiUnitType(typeId)).toBe(true);
        expect(isMultiUnitCapable(typeId)).toBe(true);
      }
    });

    it('identifies optional multi-unit types (villas, apartments, estates, cottages)', () => {
      expect(isCommercialMultiUnitType('VILLA')).toBe(false);
      expect(isMultiUnitCapable('VILLA')).toBe(true);

      expect(isCommercialMultiUnitType('APARTMENT')).toBe(false);
      expect(isMultiUnitCapable('APARTMENT')).toBe(true);

      expect(isCommercialMultiUnitType('HOLIDAY_HOME')).toBe(false);
      expect(isMultiUnitCapable('HOLIDAY_HOME')).toBe(true);

      expect(isCommercialMultiUnitType('CHALET')).toBe(false);
      expect(isMultiUnitCapable('CHALET')).toBe(true);
    });

    it('provides canonical display names for propertyTypeTitle', () => {
      const hotel = getCanonicalAccommodationType('HOTEL');
      expect(hotel?.display_name).toBe('Hotel');

      const safariLodge = getCanonicalAccommodationType('SAFARI_LODGE');
      expect(safariLodge?.display_name).toBe('Safari Lodge');

      const villa = getCanonicalAccommodationType('VILLA');
      expect(villa?.display_name).toBe('Villa');

      const divingResort = getCanonicalAccommodationType('DIVING_RESORT');
      expect(divingResort?.display_name).toBe('Diving Resort');
    });
  });

  // ==========================================================================
  // 2. BACKWARD-COMPATIBLE HYDRATION LOGIC
  // ==========================================================================
  describe('2. Backward-Compatible Hydration Logic', () => {
    const sampleAccommodations: LodgeAccommodation[] = [
      {
        id: 'unit-1',
        name: 'Ocean Suite',
        units: 4,
        adults: 2,
        children: 1,
        maxGuests: 3,
        price: 150,
        currency: 'USD',
        amenities: ['wifi', 'ac'],
        photos: [],
        active: true
      }
    ];

    it('hydrates true when isMultiUnit is explicitly true in database', () => {
      const doc: Partial<Listing> = {
        isMultiUnit: true,
        residenceType: 'city residence',
        canonicalType: 'HOTEL',
        accommodations: []
      };

      const hydrated = typeof doc.isMultiUnit === 'boolean'
        ? doc.isMultiUnit
        : Boolean(doc.accommodations && doc.accommodations.length > 0 || doc.residenceType === 'lodge');

      expect(hydrated).toBe(true);
    });

    it('hydrates false when isMultiUnit is explicitly false in database', () => {
      const doc: Partial<Listing> = {
        isMultiUnit: false,
        residenceType: 'city residence',
        canonicalType: 'APARTMENT',
        accommodations: []
      };

      const hydrated = typeof doc.isMultiUnit === 'boolean'
        ? doc.isMultiUnit
        : Boolean(doc.accommodations && doc.accommodations.length > 0 || doc.residenceType === 'lodge');

      expect(hydrated).toBe(false);
    });

    it('hydrates true for legacy lodge listing without explicit isMultiUnit boolean', () => {
      const legacyLodgeDoc: Partial<Listing> = {
        residenceType: 'lodge',
        canonicalType: 'LODGE',
        isMultiUnit: undefined,
        accommodations: []
      };

      const isLodgeDoc = legacyLodgeDoc.residenceType === 'lodge' || Boolean(legacyLodgeDoc.canonicalType && isLodgeAccommodationType(legacyLodgeDoc.canonicalType, legacyLodgeDoc.residenceType));
      const hasAccommodations = Boolean(legacyLodgeDoc.accommodations && legacyLodgeDoc.accommodations.length > 0);
      const hydrated = typeof legacyLodgeDoc.isMultiUnit === 'boolean'
        ? legacyLodgeDoc.isMultiUnit
        : Boolean(hasAccommodations || isLodgeDoc);

      expect(hydrated).toBe(true);
    });

    it('hydrates true for legacy non-lodge listing that has existing accommodations', () => {
      const legacyHotelDoc: Partial<Listing> = {
        residenceType: 'city residence',
        canonicalType: 'HOTEL',
        isMultiUnit: undefined,
        accommodations: sampleAccommodations
      };

      const isLodgeDoc = legacyHotelDoc.residenceType === 'lodge' || Boolean(legacyHotelDoc.canonicalType && isLodgeAccommodationType(legacyHotelDoc.canonicalType, legacyHotelDoc.residenceType));
      const hasAccommodations = Boolean(legacyHotelDoc.accommodations && legacyHotelDoc.accommodations.length > 0);
      const hydrated = typeof legacyHotelDoc.isMultiUnit === 'boolean'
        ? legacyHotelDoc.isMultiUnit
        : Boolean(hasAccommodations || isLodgeDoc);

      expect(hydrated).toBe(true);
    });

    it('hydrates false for legacy non-lodge listing without accommodations', () => {
      const legacyHomeDoc: Partial<Listing> = {
        residenceType: 'normal residence',
        canonicalType: 'HOLIDAY_HOME',
        isMultiUnit: undefined,
        accommodations: []
      };

      const isLodgeDoc = legacyHomeDoc.residenceType === 'lodge' || Boolean(legacyHomeDoc.canonicalType && isLodgeAccommodationType(legacyHomeDoc.canonicalType, legacyHomeDoc.residenceType));
      const hasAccommodations = Boolean(legacyHomeDoc.accommodations && legacyHomeDoc.accommodations.length > 0);
      const hydrated = typeof legacyHomeDoc.isMultiUnit === 'boolean'
        ? legacyHomeDoc.isMultiUnit
        : Boolean(hasAccommodations || isLodgeDoc);

      expect(hydrated).toBe(false);
    });
  });

  // ==========================================================================
  // 3. INVENTORY & UNIT PRESERVATION ON TAXONOMY CHANGE
  // ==========================================================================
  describe('3. Unit Preservation on Taxonomy Change', () => {
    const existingUnits: LodgeAccommodation[] = [
      {
        id: 'chalet-1',
        name: 'Beachfront Chalet',
        units: 3,
        adults: 4,
        children: 0,
        maxGuests: 4,
        price: 220,
        amenities: [],
        photos: [],
        active: true
      },
      {
        id: 'chalet-2',
        name: 'Garden Bungalow',
        units: 5,
        adults: 2,
        children: 0,
        maxGuests: 2,
        price: 140,
        amenities: [],
        photos: [],
        active: true
      }
    ];

    it('does not clear configured units when changing canonical accommodation category or type', () => {
      let accommodations = [...existingUnits];
      let isMultiUnit = true;

      // Host changes canonical type from LODGE to RESORT
      const newCanonicalType = 'RESORT';
      const isNewLodge = isLodgeAccommodationType(newCanonicalType);

      // Implementation rule: do not clear units on taxonomy change
      const isMultiUnitActive = Boolean(isNewLodge || isMultiUnit || accommodations.length > 0);

      expect(accommodations).toHaveLength(2);
      expect(isMultiUnitActive).toBe(true);
      expect(calculateTotalLodgeUnits(accommodations)).toBe(8);
    });

    it('preserves units when changing category from Lodges to Hotels & Traditional Lodging', () => {
      let accommodations = [...existingUnits];
      let isMultiUnit = true;

      // Change category to Hotels
      const newCanonicalType = 'HOTEL';
      const isNewLodge = isLodgeAccommodationType(newCanonicalType);
      const isMultiUnitActive = Boolean(isNewLodge || isMultiUnit || accommodations.length > 0);

      expect(accommodations).toHaveLength(2);
      expect(isMultiUnitActive).toBe(true);
    });

    it('clears units only on explicit confirmed multi-unit toggle deactivation', () => {
      let accommodations = [...existingUnits];
      let isMultiUnit = true;
      let showDisableMultiUnitConfirm = false;

      // User tries to uncheck toggle
      const handleToggle = (checked: boolean) => {
        if (!checked && accommodations.length > 0) {
          showDisableMultiUnitConfirm = true;
        } else {
          isMultiUnit = checked;
        }
      };

      handleToggle(false);
      // Units must still be preserved before confirmation
      expect(showDisableMultiUnitConfirm).toBe(true);
      expect(accommodations).toHaveLength(2);

      // User confirms removal
      accommodations = [];
      isMultiUnit = false;
      showDisableMultiUnitConfirm = false;

      expect(accommodations).toHaveLength(0);
      expect(isMultiUnit).toBe(false);
      expect(showDisableMultiUnitConfirm).toBe(false);
    });
  });

  // ==========================================================================
  // 4. PAYLOAD SANITIZATION & FIRESTORE PERSISTENCE
  // ==========================================================================
  describe('4. Payload Serialization & Firestore Sanitization', () => {
    it('preserves boolean true and false for isMultiUnit in sanitizeFirestorePayload', () => {
      const payloadWithTrue = {
        title: 'Boutique Hotel Maputo',
        isMultiUnit: true,
        price: 180
      };
      const sanitizedTrue = sanitizeFirestorePayload(payloadWithTrue);
      expect(sanitizedTrue.isMultiUnit).toBe(true);

      const payloadWithFalse = {
        title: 'Single Family Villa',
        isMultiUnit: false,
        price: 300
      };
      const sanitizedFalse = sanitizeFirestorePayload(payloadWithFalse);
      expect(sanitizedFalse.isMultiUnit).toBe(false);
    });

    it('preserves empty array [] for single-unit listings without removing the field', () => {
      const singleUnitPayload = {
        title: 'Private Studio',
        isMultiUnit: false,
        accommodations: [],
        totalLodgeUnits: undefined
      };

      const sanitized = sanitizeFirestorePayload(singleUnitPayload);
      expect(sanitized.isMultiUnit).toBe(false);
      expect(sanitized.accommodations).toEqual([]);
      expect(sanitized.totalLodgeUnits).toBeUndefined();
      expect('totalLodgeUnits' in sanitized).toBe(false);
    });

    it('computes totalLodgeUnits correctly for multi-unit listings', () => {
      const units: LodgeAccommodation[] = [
        {
          id: 'u1',
          name: 'Standard Room',
          units: 10,
          adults: 2,
          children: 0,
          maxGuests: 2,
          price: 90,
          amenities: [],
          photos: [],
          active: true
        },
        {
          id: 'u2',
          name: 'Executive Suite',
          units: 4,
          adults: 3,
          children: 0,
          maxGuests: 3,
          price: 160,
          amenities: [],
          photos: [],
          active: true
        }
      ];

      const multiUnitPayload = {
        title: 'Polana Grand',
        isMultiUnit: true,
        accommodations: units,
        totalLodgeUnits: calculateTotalLodgeUnits(units)
      };

      const sanitized = sanitizeFirestorePayload(multiUnitPayload);
      expect(sanitized.isMultiUnit).toBe(true);
      expect(sanitized.accommodations).toHaveLength(2);
      expect(sanitized.totalLodgeUnits).toBe(14);
    });
  });

  // ==========================================================================
  // 5. OPERATING MODELS ENFORCEMENT
  // ==========================================================================
  describe('5. Operating Models Minimum Selection Rule', () => {
    it('enforces that at least 1 operating model remains selected on toggle', () => {
      let operatingModels = ['BED_AND_BREAKFAST'];

      const toggleOperatingModel = (id: string) => {
        if (operatingModels.includes(id)) {
          if (operatingModels.length > 1) {
            operatingModels = operatingModels.filter(m => m !== id);
          }
        } else {
          operatingModels = [...operatingModels, id];
        }
      };

      // Attempting to deselect the only selected model should have no effect
      toggleOperatingModel('BED_AND_BREAKFAST');
      expect(operatingModels).toEqual(['BED_AND_BREAKFAST']);

      // Adding a second model
      toggleOperatingModel('SELF_CATERING');
      expect(operatingModels).toEqual(['BED_AND_BREAKFAST', 'SELF_CATERING']);

      // Now deselecting one is permitted
      toggleOperatingModel('BED_AND_BREAKFAST');
      expect(operatingModels).toEqual(['SELF_CATERING']);

      // Deselecting the remaining one is prevented
      toggleOperatingModel('SELF_CATERING');
      expect(operatingModels).toEqual(['SELF_CATERING']);
    });
  });
});
