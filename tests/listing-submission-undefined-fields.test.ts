import { describe, it, expect } from 'vitest';
import { sanitizeFirestorePayload } from '../src/services/listingService';

/**
 * Helper to recursively assert that no key in an object or array has an undefined value.
 */
function assertNoUndefined(obj: any, path: string = 'root') {
  if (obj === undefined) {
    throw new Error(`Found undefined at path: ${path}`);
  }
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      assertNoUndefined(item, `${path}[${index}]`);
    });
    return;
  }
  // If it's a plain object, check all properties
  const proto = Object.getPrototypeOf(obj);
  if (proto === Object.prototype || proto === null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        throw new Error(`Found undefined at path: ${path}.${key}`);
      }
      assertNoUndefined(value, `${path}.${key}`);
    }
  }
}

describe('Listing Submission Undefined Fields Sanitization & Regression Tests', () => {
  it('reproduces and fixes the undefined specialOffer.customSeasonName error', () => {
    // Exact scenario reported in the bug:
    // A listing submitted with specialOffer containing customSeasonName: undefined
    const rawListingPayload = {
      title: 'Tofo Ocean Villa',
      description: 'Luxury beachfront villa',
      location: 'Tofo, Inhambane',
      price: 15000,
      specialOffer: {
        enabled: true,
        offerType: 'seasonal',
        originalPrice: 15000,
        specialPrice: 12000,
        discountPercent: 20,
        discountAmount: 3000,
        offerName: undefined,
        startDate: '2026-12-01',
        endDate: '2027-01-15',
        isSeasonal: true,
        seasonalTag: 'Summer',
        customSeasonName: undefined, // <-- The root cause of the Firestore addDoc error
      },
    };

    // Pre-condition: verify that the raw payload DOES contain undefined customSeasonName
    expect('customSeasonName' in rawListingPayload.specialOffer).toBe(true);
    expect(rawListingPayload.specialOffer.customSeasonName).toBeUndefined();

    // Sanitize payload using our utility
    const sanitized = sanitizeFirestorePayload(rawListingPayload);

    // Assert that customSeasonName is completely omitted from the object keys
    expect('customSeasonName' in sanitized.specialOffer).toBe(false);
    expect('offerName' in sanitized.specialOffer).toBe(false);
    expect(sanitized.specialOffer.seasonalTag).toBe('Summer');
    expect(sanitized.specialOffer.specialPrice).toBe(12000);

    // Assert that no undefined values exist anywhere in the sanitized tree
    expect(() => assertNoUndefined(sanitized)).not.toThrow();
  });

  it('correctly handles a listing without a custom season name (non-seasonal offer)', () => {
    const rawListingPayload = {
      title: 'Maputo Central Apartment',
      price: 5000,
      specialOffer: {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 5000,
        specialPrice: 4000,
        discountPercent: 20,
        discountAmount: 1000,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        isSeasonal: false,
        seasonalTag: undefined,
        customSeasonName: undefined,
      },
    };

    const sanitized = sanitizeFirestorePayload(rawListingPayload);

    expect('customSeasonName' in sanitized.specialOffer).toBe(false);
    expect('seasonalTag' in sanitized.specialOffer).toBe(false);
    expect(sanitized.specialOffer.isSeasonal).toBe(false);
    expect(sanitized.specialOffer.specialPrice).toBe(4000);
    expect(() => assertNoUndefined(sanitized)).not.toThrow();
  });

  it('preserves valid customSeasonName when seasonalTag is Other', () => {
    const rawListingPayload = {
      title: 'Vilankulo Beach Haven',
      price: 8000,
      specialOffer: {
        enabled: true,
        offerType: 'seasonal',
        originalPrice: 8000,
        specialPrice: 6500,
        discountPercent: 19,
        discountAmount: 1500,
        offerName: 'Carnival Special',
        startDate: '2026-12-15',
        endDate: '2027-01-05',
        isSeasonal: true,
        seasonalTag: 'Other',
        customSeasonName: 'Maputo Carnival Holiday',
      },
    };

    const sanitized = sanitizeFirestorePayload(rawListingPayload);

    expect(sanitized.specialOffer.customSeasonName).toBe('Maputo Carnival Holiday');
    expect(sanitized.specialOffer.seasonalTag).toBe('Other');
    expect(sanitized.specialOffer.offerName).toBe('Carnival Special');
    expect(() => assertNoUndefined(sanitized)).not.toThrow();
  });

  it('sanitizes all other optional undefined fields across the listing payload', () => {
    const fullListingPayload = {
      title: 'Pemba Dive Lodge',
      description: 'Lodge near Quirimbas',
      location: 'Pemba, Cabo Delgado',
      residenceType: 'normal residence',
      canonicalType: undefined,
      operatingModels: undefined,
      settings: undefined,
      classificationStatus: undefined,
      price: 0, // valid 0 must be preserved
      minNights: 1,
      rating: 4.95,
      images: ['https://example.com/photo1.jpg'],
      labeledImages: [{ url: 'https://example.com/photo1.jpg', label: 'Exterior' }],
      amenities: ['wifi', 'pool'],
      hostId: 'host_123',
      hostName: 'Test Host',
      hostPhoto: undefined, // optional field should be omitted
      isHostVerified: false, // valid false must be preserved
      category: 'normal residence',
      city: 'Pemba',
      province: 'Cabo Delgado',
      country: 'Mozambique',
      availableFrom: '2026-10-15',
      availableTo: '2027-10-15',
      dates: '2026-10-15 to 2027-10-15',
      coordinates: { lat: -12.973, lng: 40.517 },
      nearbyPlaces: [],
      specialOffer: null, // explicit null must be preserved
      accommodations: [],
      totalLodgeUnits: undefined, // optional field should be omitted
    };

    const sanitized = sanitizeFirestorePayload(fullListingPayload);

    // Omitted undefined fields
    expect('canonicalType' in sanitized).toBe(false);
    expect('operatingModels' in sanitized).toBe(false);
    expect('settings' in sanitized).toBe(false);
    expect('classificationStatus' in sanitized).toBe(false);
    expect('hostPhoto' in sanitized).toBe(false);
    expect('totalLodgeUnits' in sanitized).toBe(false);

    // Preserved valid fields
    expect(sanitized.price).toBe(0);
    expect(sanitized.isHostVerified).toBe(false);
    expect(sanitized.specialOffer).toBeNull();
    expect(sanitized.accommodations).toEqual([]);
    expect(sanitized.nearbyPlaces).toEqual([]);
    expect(sanitized.coordinates).toEqual({ lat: -12.973, lng: 40.517 });

    // Assert entire tree is free of undefined
    expect(() => assertNoUndefined(sanitized)).not.toThrow();
  });

  it('safely handles nested objects, arrays, and preserves Firestore special objects and Dates', () => {
    const testDate = new Date('2026-10-14T00:00:00Z');
    const mockFieldValue = {
      _methodName: 'serverTimestamp',
      constructor: { name: 'ServerTimestampFieldValueImpl' },
    };
    // Assign custom prototype so it simulates Firestore FieldValue
    Object.setPrototypeOf(mockFieldValue, { isFieldValue: true });

    const payload = {
      createdAt: mockFieldValue,
      updatedAt: testDate,
      tags: ['beach', undefined, 'ocean'],
      nested: {
        deep: {
          undef: undefined,
          zero: 0,
          bool: false,
          empty: '',
          emptyArr: [],
          nullVal: null,
        },
      },
    };

    const sanitized = sanitizeFirestorePayload(payload);

    expect(sanitized.createdAt).toBe(mockFieldValue);
    expect(sanitized.updatedAt).toBe(testDate);
    expect(sanitized.tags).toEqual(['beach', 'ocean']);
    expect('undef' in sanitized.nested.deep).toBe(false);
    expect(sanitized.nested.deep.zero).toBe(0);
    expect(sanitized.nested.deep.bool).toBe(false);
    expect(sanitized.nested.deep.empty).toBe('');
    expect(sanitized.nested.deep.emptyArr).toEqual([]);
    expect(sanitized.nested.deep.nullVal).toBeNull();
  });
});
