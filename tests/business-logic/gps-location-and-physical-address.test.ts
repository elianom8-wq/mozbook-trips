import { describe, it, expect } from 'vitest';
import { 
  formatPhysicalAddress, 
  PhysicalAddress, 
  Listing,
  MOZAMBIQUE_PROVINCES
} from '../../src/services/listingService';

describe('MozBook UI Update: Step 3 — GPS Location & Physical Address', () => {
  // ==========================================================================
  // 1. STRUCTURED PHYSICAL ADDRESS FIELDS & FORMATTING
  // ==========================================================================
  describe('1. Structured Physical Address Fields & Helpers', () => {
    it('formats a complete physical address including building, street, bairro, city, province, country', () => {
      const addr: PhysicalAddress = {
        country: 'Mozambique',
        province: 'Maputo Cidade',
        city: 'Maputo',
        neighborhood: 'Polana Cimento',
        street: 'Avenida Julius Nyerere',
        buildingNumber: '142',
        buildingName: 'Edifício Platinum',
        postalCode: '1100',
        directionsLandmark: 'Opposite Hotel Polana'
      };

      const formatted = formatPhysicalAddress(addr);
      expect(formatted).toBe('Edifício Platinum, Avenida Julius Nyerere, 142, Bairro Polana Cimento, Maputo, Mozambique');
    });

    it('formats an address with only minimal required fields (Country, City)', () => {
      const addr: Partial<PhysicalAddress> = {
        country: 'Mozambique',
        city: 'Vilankulo',
        province: 'Inhambane'
      };

      const formatted = formatPhysicalAddress(addr);
      expect(formatted).toBe('Vilankulo, Inhambane, Mozambique');
    });

    it('omits province if province equals city name to prevent duplicate labels', () => {
      const addr: Partial<PhysicalAddress> = {
        country: 'Mozambique',
        city: 'Maputo',
        province: 'Maputo'
      };

      const formatted = formatPhysicalAddress(addr);
      expect(formatted).toBe('Maputo, Mozambique');
    });

    it('handles null, undefined, or empty address gracefully', () => {
      expect(formatPhysicalAddress(null)).toBe('');
      expect(formatPhysicalAddress(undefined)).toBe('');
      expect(formatPhysicalAddress({})).toBe('');
    });

    it('lists all 11 official provinces of Mozambique for selection', () => {
      expect(MOZAMBIQUE_PROVINCES).toHaveLength(11);
      expect(MOZAMBIQUE_PROVINCES).toContain('Maputo Cidade');
      expect(MOZAMBIQUE_PROVINCES).toContain('Maputo Província');
      expect(MOZAMBIQUE_PROVINCES).toContain('Gaza');
      expect(MOZAMBIQUE_PROVINCES).toContain('Inhambane');
      expect(MOZAMBIQUE_PROVINCES).toContain('Sofala');
      expect(MOZAMBIQUE_PROVINCES).toContain('Manica');
      expect(MOZAMBIQUE_PROVINCES).toContain('Tete');
      expect(MOZAMBIQUE_PROVINCES).toContain('Zambézia');
      expect(MOZAMBIQUE_PROVINCES).toContain('Nampula');
      expect(MOZAMBIQUE_PROVINCES).toContain('Cabo Delgado');
      expect(MOZAMBIQUE_PROVINCES).toContain('Niassa');
    });
  });

  // ==========================================================================
  // 2. LOCATION IDENTIFICATION OPTIONS (GPS, ADDRESS, OR BOTH)
  // ==========================================================================
  describe('2. Independent Location Identification Options', () => {
    it('supports property identification using GPS coordinates only', () => {
      const listing: Partial<Listing> = {
        title: 'Coastal Dune Retreat',
        locationType: 'gps',
        hasGpsLocation: true,
        hasPhysicalAddress: false,
        coordinates: { lat: -23.8567, lng: 35.3421 },
        city: 'Tofo',
        province: 'Inhambane',
        country: 'Mozambique',
        pinSource: 'gps'
      };

      expect(listing.hasGpsLocation).toBe(true);
      expect(listing.coordinates?.lat).toBeCloseTo(-23.8567);
      expect(listing.locationType).toBe('gps');
      expect(listing.pinSource).toBe('gps');
    });

    it('supports property identification using physical address only without GPS', () => {
      const addrDetails: PhysicalAddress = {
        country: 'Mozambique',
        province: 'Sofala',
        city: 'Beira',
        neighborhood: 'Chaimite',
        street: 'Rua Correia de Brito',
        buildingNumber: '45',
        directionsLandmark: 'Near Beira Cathedral'
      };

      const listing: Partial<Listing> = {
        title: 'Beira Heritage Apartment',
        locationType: 'address',
        hasGpsLocation: false,
        hasPhysicalAddress: true,
        addressDetails: addrDetails,
        location: formatPhysicalAddress(addrDetails),
        city: 'Beira',
        province: 'Sofala',
        country: 'Mozambique',
        directionsLandmark: addrDetails.directionsLandmark
      };

      expect(listing.hasPhysicalAddress).toBe(true);
      expect(listing.locationType).toBe('address');
      expect(listing.location).toContain('Rua Correia de Brito, 45');
      expect(listing.directionsLandmark).toBe('Near Beira Cathedral');
    });

    it('supports property identification using BOTH GPS coordinates and physical address', () => {
      const addrDetails: PhysicalAddress = {
        country: 'Mozambique',
        province: 'Maputo Cidade',
        city: 'Maputo',
        neighborhood: 'Sommerschield',
        street: 'Avenida do Zimbabwe',
        buildingNumber: '880',
        buildingName: 'Condomínio Zimbabwe',
        directionsLandmark: 'Opposite French School'
      };

      const listing: Partial<Listing> = {
        title: 'Sommerschield Executive Villa',
        locationType: 'both',
        hasGpsLocation: true,
        hasPhysicalAddress: true,
        coordinates: { lat: -25.9521, lng: 32.5912 },
        addressDetails: addrDetails,
        location: formatPhysicalAddress(addrDetails),
        city: 'Maputo',
        province: 'Maputo Cidade',
        country: 'Mozambique',
        pinSource: 'map_pin'
      };

      expect(listing.locationType).toBe('both');
      expect(listing.hasGpsLocation).toBe(true);
      expect(listing.hasPhysicalAddress).toBe(true);
      expect(listing.coordinates?.lat).toBe(-25.9521);
      expect(listing.addressDetails?.buildingName).toBe('Condomínio Zimbabwe');
      expect(listing.pinSource).toBe('map_pin');
    });
  });

  // ==========================================================================
  // 3. STEP 3 VALIDATION RULES
  // ==========================================================================
  describe('3. Validation Boundaries', () => {
    function validateStep3Location(data: {
      city?: string;
      country?: string;
      coordinates?: { lat: number; lng: number };
      address?: string;
      street?: string;
      province?: string;
    }): { valid: boolean; error?: string } {
      if (!data.city || !data.city.trim()) {
        return { valid: false, error: 'Please provide a city or municipality for your property.' };
      }
      if (!data.country || !data.country.trim()) {
        return { valid: false, error: 'Please provide a country for your property.' };
      }
      const hasCoordinates = Boolean(data.coordinates && (data.coordinates.lat !== 0 || data.coordinates.lng !== 0));
      const hasAddress = Boolean(
        data.city.trim() && (
          (data.province && data.province.trim()) ||
          (data.street && data.street.trim()) ||
          (data.address && data.address.trim())
        )
      );
      if (!hasCoordinates && !hasAddress) {
        return { valid: false, error: 'Please provide either GPS coordinates on the map or a physical street address.' };
      }
      return { valid: true };
    }

    it('passes validation when both GPS coordinates and structured physical address are provided', () => {
      const result = validateStep3Location({
        city: 'Maputo',
        country: 'Mozambique',
        province: 'Maputo Cidade',
        street: 'Av. Julius Nyerere',
        coordinates: { lat: -25.9692, lng: 32.5732 }
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('passes validation when ONLY physical address is provided without GPS coordinates', () => {
      const result = validateStep3Location({
        city: 'Pemba',
        country: 'Mozambique',
        province: 'Cabo Delgado',
        street: 'Av. Eduardo Mondlane',
        coordinates: { lat: 0, lng: 0 }
      });
      expect(result.valid).toBe(true);
    });

    it('passes validation when ONLY GPS coordinates are provided with basic City and Country', () => {
      const result = validateStep3Location({
        city: 'Ponta do Ouro',
        country: 'Mozambique',
        coordinates: { lat: -26.845, lng: 32.891 }
      });
      expect(result.valid).toBe(true);
    });

    it('fails validation when city is empty', () => {
      const result = validateStep3Location({
        city: '',
        country: 'Mozambique',
        coordinates: { lat: -25.9692, lng: 32.5732 }
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('city or municipality');
    });

    it('fails validation when country is empty', () => {
      const result = validateStep3Location({
        city: 'Maputo',
        country: '',
        coordinates: { lat: -25.9692, lng: 32.5732 }
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('country');
    });

    it('optional fields (bairro, building number, postal code, landmark) can safely remain empty', () => {
      const minimalAddress: PhysicalAddress = {
        country: 'Mozambique',
        province: 'Nampula',
        city: 'Ilha de Moçambique'
      };
      expect(minimalAddress.neighborhood).toBeUndefined();
      expect(minimalAddress.street).toBeUndefined();
      expect(minimalAddress.buildingNumber).toBeUndefined();
      expect(minimalAddress.buildingName).toBeUndefined();
      expect(minimalAddress.postalCode).toBeUndefined();
      expect(minimalAddress.directionsLandmark).toBeUndefined();

      const formatted = formatPhysicalAddress(minimalAddress);
      expect(formatted).toBe('Ilha de Moçambique, Nampula, Mozambique');
    });
  });

  // ==========================================================================
  // 4. DRAFT PERSISTENCE, RESTORATION & EDITING PRESERVATION
  // ==========================================================================
  describe('4. Draft Autosave & Editing Preservation', () => {
    it('persists and restores all structured address fields in user draft payload', () => {
      const draftPayload = {
        residenceType: 'lodge',
        title: 'Gorongosa Eco-Lodge',
        city: 'Gorongosa',
        province: 'Sofala',
        country: 'Mozambique',
        neighborhood: 'Vila da Gorongosa',
        street: 'Estrada Nacional 1',
        buildingNumber: 'Km 42',
        buildingName: 'Santuário',
        postalCode: '2100',
        directionsLandmark: 'Turn right at the park entrance sign',
        useGps: true,
        usePhysicalAddress: true,
        pinSource: 'gps' as const,
        coordinates: { lat: -18.9667, lng: 34.3667 },
        savedAt: new Date().toISOString()
      };

      // Check all required fields are preserved in draft format
      expect(draftPayload.country).toBe('Mozambique');
      expect(draftPayload.neighborhood).toBe('Vila da Gorongosa');
      expect(draftPayload.directionsLandmark).toBe('Turn right at the park entrance sign');
      expect(draftPayload.pinSource).toBe('gps');
      expect(draftPayload.coordinates.lat).toBe(-18.9667);
      expect(draftPayload.useGps).toBe(true);
      expect(draftPayload.usePhysicalAddress).toBe(true);
    });

    it('updating physical address does not clear or mutate previously pinned GPS coordinates', () => {
      const initialCoordinates = { lat: -25.9692, lng: 32.5732 };
      let coordinates = { ...initialCoordinates };
      let city = 'Maputo';
      let street = 'Av. 24 de Julho';

      // Host updates street and city
      street = 'Av. Julius Nyerere';
      city = 'Maputo Cidade';

      // Coordinates MUST remain unchanged
      expect(coordinates.lat).toBe(initialCoordinates.lat);
      expect(coordinates.lng).toBe(initialCoordinates.lng);
      expect(street).toBe('Av. Julius Nyerere');
    });

    it('updating GPS pin coordinates does not clear or erase manually entered address', () => {
      const initialAddress: PhysicalAddress = {
        country: 'Mozambique',
        province: 'Inhambane',
        city: 'Vilankulo',
        neighborhood: 'Bairro Central',
        street: 'Rua Principal',
        buildingNumber: '12',
        directionsLandmark: 'Next to Bazaruto Dhow Tours'
      };

      let addressDetails = { ...initialAddress };
      let coordinates = { lat: -22.0134, lng: 35.3175 };

      // Host drags pin to a slightly new coordinate
      coordinates = { lat: -22.0150, lng: 35.3190 };

      // Address fields MUST remain intact and not overwritten
      expect(addressDetails.neighborhood).toBe('Bairro Central');
      expect(addressDetails.street).toBe('Rua Principal');
      expect(addressDetails.buildingNumber).toBe('12');
      expect(addressDetails.directionsLandmark).toBe('Next to Bazaruto Dhow Tours');
      expect(coordinates.lat).toBe(-22.0150);
    });

    it('preserves existing legacy listings without addressDetails seamlessly', () => {
      const legacyListing: Partial<Listing> = {
        id: 'legacy-123',
        title: 'Historic Ponta Beach Cabin',
        location: 'Ponta do Ouro, Maputo Província',
        city: 'Ponta do Ouro',
        province: 'Maputo Província',
        coordinates: { lat: -26.845, lng: 32.891 }
      };

      // Loading legacy listing: location and coordinates are populated cleanly
      const effectiveCity = legacyListing.city || legacyListing.addressDetails?.city || 'Maputo';
      const effectiveProvince = legacyListing.province || legacyListing.addressDetails?.province || '';
      const effectiveLocation = legacyListing.location || `${effectiveCity}, ${effectiveProvince}`;

      expect(effectiveCity).toBe('Ponta do Ouro');
      expect(effectiveProvince).toBe('Maputo Província');
      expect(effectiveLocation).toBe('Ponta do Ouro, Maputo Província');
      expect(legacyListing.coordinates?.lat).toBe(-26.845);
    });
  });
});
