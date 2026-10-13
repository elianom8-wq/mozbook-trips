import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MOZAMBIQUE_PROVINCE_MAP_ENTRIES, MOZAMBIQUE_MAP_VIEWBOX } from '../../src/data/mozambiqueMapData';
import { MOZAMBIQUE_PROVINCES } from '../../src/pages/Discover';

describe('Mozambique Interactive Map Geographic & Architectural Integrity', () => {
  it('defines exactly 11 first-order divisions with Maputo City separated from Maputo Province', () => {
    expect(MOZAMBIQUE_PROVINCE_MAP_ENTRIES).toHaveLength(11);
    
    const provinceIds = MOZAMBIQUE_PROVINCE_MAP_ENTRIES.map(p => p.id);
    expect(provinceIds).toContain('Maputo City');
    expect(provinceIds).toContain('Maputo Province');
    expect(provinceIds).toContain('Gaza');
    expect(provinceIds).toContain('Inhambane');
    expect(provinceIds).toContain('Sofala');
    expect(provinceIds).toContain('Manica');
    expect(provinceIds).toContain('Tete');
    expect(provinceIds).toContain('Zambézia');
    expect(provinceIds).toContain('Nampula');
    expect(provinceIds).toContain('Niassa');
    expect(provinceIds).toContain('Cabo Delgado');

    const maputoCity = MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(p => p.id === 'Maputo City');
    const maputoProvince = MOZAMBIQUE_PROVINCE_MAP_ENTRIES.find(p => p.id === 'Maputo Province');

    expect(maputoCity).toBeDefined();
    expect(maputoProvince).toBeDefined();
    expect(maputoCity?.capital).toBe('Maputo');
    expect(maputoProvince?.capital).toBe('Matola');
    expect(maputoCity?.isCityProvince).toBe(true);
  });

  it('contains valid non-empty SVG boundary paths for every province', () => {
    expect(MOZAMBIQUE_MAP_VIEWBOX).toBe('0 0 600 920');

    for (const prov of MOZAMBIQUE_PROVINCE_MAP_ENTRIES) {
      expect(prov.path).toBeDefined();
      expect(prov.path.length).toBeGreaterThan(100);
      expect(prov.path.startsWith('M')).toBe(true);
      expect(prov.path.includes('Z')).toBe(true);
      expect(prov.labelPos.x).toBeGreaterThan(0);
      expect(prov.labelPos.y).toBeGreaterThan(0);
      expect(prov.capitalPos.x).toBeGreaterThan(0);
      expect(prov.capitalPos.y).toBeGreaterThan(0);
      expect(prov.center.lat).toBeLessThan(0); // Southern hemisphere
      expect(prov.center.lng).toBeGreaterThan(30); // Mozambique longitudes
    }
  });

  it('verifies MOZAMBIQUE_PROVINCES in Discover matches the 11 divisions', () => {
    expect(MOZAMBIQUE_PROVINCES).toHaveLength(11);
    const ids = MOZAMBIQUE_PROVINCES.map(p => p.id);
    expect(ids).toContain('Maputo City');
    expect(ids).toContain('Maputo Province');
  });

  it('verifies Discover.tsx imports and integrates MozambiqueInteractiveMap in Section 8', () => {
    const discoverFilePath = path.resolve(__dirname, '../../src/pages/Discover.tsx');
    const discoverContent = fs.readFileSync(discoverFilePath, 'utf-8');

    expect(discoverContent).toContain("import MozambiqueInteractiveMap from '../components/MozambiqueInteractiveMap';");
    expect(discoverContent).toContain('<MozambiqueInteractiveMap');
    expect(discoverContent).toContain('selectedProvince=');
    expect(discoverContent).toContain('onSelectProvince=');
    expect(discoverContent).toContain('listingCounts=');
    expect(discoverContent).toContain('Explore Mozambique');
  });
});
