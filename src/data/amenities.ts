export interface AmenityDefinition {
  id: string;
  label: string;
  category: 'essentials' | 'features' | 'safety' | 'location';
  iconName: string;
  description: string;
}

export const AMENITIES_LIST: AmenityDefinition[] = [
  { id: 'wifi', label: 'Fast Wi-Fi', category: 'essentials', iconName: 'Wifi', description: 'High-speed internet throughout the residence' },
  { id: 'pool', label: 'Swimming Pool', category: 'features', iconName: 'Waves', description: 'Private or shared clean outdoor swimming pool' },
  { id: 'ac', label: 'Air Conditioning (AC)', category: 'essentials', iconName: 'Wind', description: 'Full climate control in bedrooms & living spaces' },
  { id: 'tv', label: 'Smart TV', category: 'essentials', iconName: 'Tv', description: 'Flat-screen HD TV with streaming apps / cable' },
  { id: 'kitchen', label: 'Fully Equipped Kitchen', category: 'essentials', iconName: 'UtensilsCrossed', description: 'Refrigerator, stove, microwave, cookware & dishware' },
  { id: 'parking', label: 'Free Parking', category: 'features', iconName: 'Car', description: 'Secure gated or private on-premise parking' },
  { id: 'workspace', label: 'Dedicated Workspace', category: 'essentials', iconName: 'Laptop', description: 'Desk with ergonomic chair and nearby power outlets' },
  { id: 'washer', label: 'Washing Machine', category: 'essentials', iconName: 'Shirt', description: 'In-unit laundry washer & drying rack' },
  { id: 'generator', label: 'Backup Generator / Solar', category: 'features', iconName: 'Zap', description: 'Continuous power backup during municipal grid outages' },
  { id: 'hot_water', label: 'Hot Water', category: 'essentials', iconName: 'Flame', description: 'Reliable heated shower and plumbing' },
  { id: 'balcony', label: 'Patio / Balcony', category: 'features', iconName: 'Sun', description: 'Outdoor relaxation terrace with seating' },
  { id: 'bbq', label: 'BBQ Grill / Braai', category: 'features', iconName: 'FlameKindling', description: 'Outdoor charcoal or gas braai station' },
  { id: 'gym', label: 'Gym / Fitness Equipment', category: 'features', iconName: 'Dumbbell', description: 'Exercise mats, free weights, or fitness area' },
  { id: 'pets', label: 'Pet Friendly', category: 'features', iconName: 'Dog', description: 'Fur-friendly accommodation with outdoor space' },
  { id: 'beach_access', label: 'Beach Access', category: 'location', iconName: 'Palmtree', description: 'Direct pathway or walking distance to sandy shoreline' },
  { id: 'security', label: '24/7 Security / Guard', category: 'safety', iconName: 'ShieldCheck', description: 'Gated perimeter, security guard or alarm monitoring' },
];
