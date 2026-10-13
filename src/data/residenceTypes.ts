export interface ResidenceTypeOption {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  badgeColor: string;
  defaultImages: string[];
}

export const RESIDENCE_TYPES: ResidenceTypeOption[] = [
  {
    id: 'normal residence',
    title: 'Normal Residence',
    subtitle: 'A standalone family home or comfortable residential house in a suburban or local neighborhood.',
    iconName: 'Home',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'city residence',
    title: 'City Residence',
    subtitle: 'Urban townhouse, duplex or condo right in the vibrant heart of the city near commerce and nightlife.',
    iconName: 'Building',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'country residence',
    title: 'Country Residence',
    subtitle: 'Peaceful farm estate, rural homestead, or spacious acreage with tranquil natural surroundings.',
    iconName: 'Trees',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'studio apartment',
    title: 'Studio Apartment',
    subtitle: 'Modern self-contained open-plan flat with integrated kitchen, lounge, and sleeping quarter.',
    iconName: 'LayoutGrid',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502005229762-bf1b461e9677?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'lodge',
    title: 'Lodge',
    subtitle: 'Rustic safari lodge, eco-retreat, game reserve chalets, or warm timber mountain cabin.',
    iconName: 'Building2',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'beachfront residence',
    title: 'Beachfront Residence',
    subtitle: 'Coastal villa, seaside bungalow, or oceanfront retreat with direct sand and wave access.',
    iconName: 'Palmtree',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'apartment home residence',
    title: 'Apartment Home Residence',
    subtitle: 'Multi-room residential flat, luxury penthouse, or serviced apartment in a secure residential block.',
    iconName: 'Home',
    badgeColor: 'bg-[#e6f7f0] text-[#009A60] border-[#a4e4c7]',
    defaultImages: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'outdoor residence',
    title: 'Outdoor Residence',
    subtitle: 'Glamping dome, safari tent, treehouse, bush camp, or outdoor scenic stargazing shelter.',
    iconName: 'Tent',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    defaultImages: [
      'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80'
    ]
  }
];
