export interface AccommodationTypePreset {
  id: string;
  name: string;
  category: 'room' | 'chalet' | 'suite' | 'other';
  defaultAdults: number;
  defaultChildren: number;
  defaultMaxGuests: number;
  suggestedPriceMzn: number;
  defaultDescription: string;
  defaultAmenities: string[];
  suggestedPhotos: string[];
}

export const LODGE_ACCOMMODATION_PRESETS: AccommodationTypePreset[] = [
  {
    id: 'standard_room',
    name: 'Standard Room',
    category: 'room',
    defaultAdults: 2,
    defaultChildren: 0,
    defaultMaxGuests: 2,
    suggestedPriceMzn: 3000,
    defaultDescription: 'Comfortable ensuite room with king or twin beds, air conditioning, and garden surroundings.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'fan', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'deluxe_room',
    name: 'Deluxe Room',
    category: 'room',
    defaultAdults: 2,
    defaultChildren: 1,
    defaultMaxGuests: 3,
    suggestedPriceMzn: 4500,
    defaultDescription: 'Spacious lodge bedroom with premium furnishings, private balcony, fridge, and luxury walk-in bathroom.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'tv', 'fridge', 'balcony', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'family_room',
    name: 'Family Room',
    category: 'room',
    defaultAdults: 2,
    defaultChildren: 2,
    defaultMaxGuests: 4,
    suggestedPriceMzn: 5500,
    defaultDescription: 'Generous family accommodation with master double bed and twin beds for children, plus seating area.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'tv', 'fridge', 'hot_water', 'fan'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'standard_chalet',
    name: 'Standard Chalet',
    category: 'chalet',
    defaultAdults: 2,
    defaultChildren: 0,
    defaultMaxGuests: 2,
    suggestedPriceMzn: 4500,
    defaultDescription: 'Freestanding thatched wooden chalet immersed in coastal nature with private veranda and ensuite bath.',
    defaultAmenities: ['private_bathroom', 'fan', 'wifi', 'balcony', 'garden_view', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'beach_chalet',
    name: 'Beach Chalet',
    category: 'chalet',
    defaultAdults: 2,
    defaultChildren: 1,
    defaultMaxGuests: 3,
    suggestedPriceMzn: 6500,
    defaultDescription: 'Steps away from the warm Indian Ocean sand, featuring private outdoor hammock deck and sea breeze ventilation.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'balcony', 'sea_view', 'fridge', 'breakfast'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'ocean_view_chalet',
    name: 'Ocean View Chalet',
    category: 'chalet',
    defaultAdults: 2,
    defaultChildren: 2,
    defaultMaxGuests: 4,
    suggestedPriceMzn: 6000,
    defaultDescription: 'Private chalet with ocean views, king-size bed, private bathroom and outdoor seating area.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'sea_view', 'balcony', 'fridge', 'breakfast', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'family_chalet',
    name: 'Family Chalet',
    category: 'chalet',
    defaultAdults: 2,
    defaultChildren: 4,
    defaultMaxGuests: 6,
    suggestedPriceMzn: 7500,
    defaultDescription: 'Two-bedroom independent chalet with large lounge, kitchenette, covered patio, and room for 6 guests.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'kitchen', 'fridge', 'balcony', 'garden_view', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'suite',
    name: 'Suite',
    category: 'suite',
    defaultAdults: 2,
    defaultChildren: 0,
    defaultMaxGuests: 2,
    suggestedPriceMzn: 8000,
    defaultDescription: 'Executive safari master suite with private plunge pool, panoramic terrace, king bed, and daily breakfast.',
    defaultAmenities: ['private_bathroom', 'ac', 'wifi', 'tv', 'fridge', 'balcony', 'sea_view', 'breakfast', 'hot_water'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'other',
    name: 'Other',
    category: 'other',
    defaultAdults: 2,
    defaultChildren: 0,
    defaultMaxGuests: 2,
    suggestedPriceMzn: 3500,
    defaultDescription: 'Custom room or chalet tailored to your lodge specifications.',
    defaultAmenities: ['private_bathroom', 'wifi', 'fan'],
    suggestedPhotos: [
      'https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1000&q=80'
    ]
  }
];

export interface LodgeAmenityItem {
  id: string;
  label: string;
  iconName: string;
  description: string;
}

export const LODGE_AMENITIES: LodgeAmenityItem[] = [
  { id: 'private_bathroom', label: 'Private bathroom', iconName: 'Bath', description: 'Ensuite private bathroom with shower or tub' },
  { id: 'ac', label: 'Air conditioning', iconName: 'Wind', description: 'Climate-controlled cooling system' },
  { id: 'fan', label: 'Fan', iconName: 'Fan', description: 'Ceiling or portable air circulation fan' },
  { id: 'wifi', label: 'Wi-Fi', iconName: 'Wifi', description: 'Fast wireless internet access' },
  { id: 'tv', label: 'TV', iconName: 'Tv', description: 'Television with satellite or local channels' },
  { id: 'fridge', label: 'Fridge', iconName: 'Refrigerator', description: 'Mini-fridge or bar refrigerator' },
  { id: 'kitchen', label: 'Kitchen', iconName: 'UtensilsCrossed', description: 'Private kitchenette or cooking area' },
  { id: 'balcony', label: 'Balcony', iconName: 'Sun', description: 'Private outdoor balcony or deck' },
  { id: 'sea_view', label: 'Sea view', iconName: 'Waves', description: 'Direct ocean or coastal waters view' },
  { id: 'garden_view', label: 'Garden view', iconName: 'Trees', description: 'Lush tropical or bush garden outlook' },
  { id: 'breakfast', label: 'Breakfast included', iconName: 'Coffee', description: 'Daily morning meal provided' },
  { id: 'hot_water', label: 'Hot water', iconName: 'Flame', description: 'Reliable heated water in bathroom' },
  { id: 'mosquito_net', label: 'Mosquito netting', iconName: 'ShieldCheck', description: 'Canopy mosquito protection over beds' },
  { id: 'pool_access', label: 'Pool access', iconName: 'Waves', description: 'Direct proximity to lodge swimming pool' },
];
