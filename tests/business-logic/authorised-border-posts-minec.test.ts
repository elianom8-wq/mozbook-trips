import { describe, it, expect } from 'vitest';
import { 
  BORDER_POSTS, 
  BORDER_POST_INFO, 
  BORDER_POST_PROVINCE_GROUPS,
  BorderPostProvinceGroup
} from '../../src/data/visaEngine';

describe('MozBook — Authorised Border Posts (Official MINEC List)', () => {
  it('has exactly 27 authorised border posts as the single source of truth', () => {
    expect(BORDER_POSTS).toHaveLength(27);
    expect(BORDER_POST_INFO.official_source).toBe('https://minec.gov.mz/vistos-de-entrada/');
  });

  it('groups all 27 border posts across Maputo City and the 10 provinces', () => {
    expect(BORDER_POST_PROVINCE_GROUPS).toHaveLength(11);

    const totalGroupedPosts = BORDER_POST_PROVINCE_GROUPS.reduce(
      (sum: number, g: BorderPostProvinceGroup) => sum + g.posts.length, 
      0
    );
    expect(totalGroupedPosts).toBe(27);

    // Verify province names
    const expectedProvinces = [
      'Maputo City',
      'Maputo Province',
      'Gaza Province',
      'Inhambane Province',
      'Sofala Province',
      'Manica Province',
      'Tete Province',
      'Zambézia Province',
      'Nampula Province',
      'Niassa Province',
      'Cabo Delgado Province'
    ];
    expect(BORDER_POST_PROVINCE_GROUPS.map(g => g.province)).toEqual(expectedProvinces);
  });

  it('matches official MINEC location names, provinces, and crossing types', () => {
    const maputoCity = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Maputo City');
    expect(maputoCity?.posts).toEqual([
      { name: 'Maputo International Airport', type: 'Airport' }
    ]);

    const maputoProv = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Maputo Province');
    expect(maputoProv?.posts).toEqual([
      { name: 'Ressano Garcia', type: 'Land border' },
      { name: 'Namaacha', type: 'Land border' },
      { name: 'Ponta do Ouro', type: 'Land border' },
      { name: 'Goba', type: 'Land border' }
    ]);

    const gaza = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Gaza Province');
    expect(gaza?.posts).toEqual([
      { name: 'Chicualacuala', type: 'Land border' },
      { name: 'Giryondo', type: 'Land border' },
      { name: 'Pafuri', type: 'Land border' }
    ]);

    const inhambane = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Inhambane Province');
    expect(inhambane?.posts).toEqual([
      { name: 'Vilanculos Aerodrome', type: 'Aerodrome' },
      { name: 'Inhambane Aerodrome', type: 'Aerodrome' }
    ]);

    const sofala = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Sofala Province');
    expect(sofala?.posts).toEqual([
      { name: 'Beira International Airport', type: 'International airport' }
    ]);

    const manica = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Manica Province');
    expect(manica?.posts).toEqual([
      { name: 'Machipanda', type: 'Land border' },
      { name: 'Espungabera', type: 'Land border' },
      { name: 'Chimoio Aerodrome', type: 'Aerodrome' }
    ]);

    const tete = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Tete Province');
    expect(tete?.posts).toEqual([
      { name: 'Tete Aerodrome', type: 'Aerodrome' },
      { name: 'Cuchamano', type: 'Land border' },
      { name: 'Cassacatiza', type: 'Land border' },
      { name: 'Calomue', type: 'Land border' },
      { name: 'Songo Aerodrome', type: 'Aerodrome' },
      { name: 'Zobwé', type: 'Land border' }
    ]);

    const zambezia = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Zambézia Province');
    expect(zambezia?.posts).toEqual([
      { name: 'Quelimane Aerodrome', type: 'Aerodrome' },
      { name: 'Melosa', type: 'Land border' }
    ]);

    const nampula = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Nampula Province');
    expect(nampula?.posts).toEqual([
      { name: 'Nampula International Airport', type: 'International airport' }
    ]);

    const niassa = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Niassa Province');
    expect(niassa?.posts).toEqual([
      { name: 'Mandimba', type: 'Land border' },
      { name: 'Lichinga Aerodrome', type: 'Aerodrome' }
    ]);

    const caboDelgado = BORDER_POST_PROVINCE_GROUPS.find(g => g.province === 'Cabo Delgado Province');
    expect(caboDelgado?.posts).toEqual([
      { name: 'Pemba Aerodrome', type: 'Aerodrome' },
      { name: 'Mocimboa da Praia Aerodrome', type: 'Aerodrome' }
    ]);
  });
});
