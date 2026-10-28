/**
 * ============================================================================
 * MOZBOOK TRANSPORT PARTNER OFFERINGS TAXONOMY & TYPES (STAGE 3I)
 * ============================================================================
 * 
 * Controlled Transport Categories:
 * 1. Airport Transfer
 * 2. Intercity Transfer
 * 3. Private Driver
 * 4. Tourist Shuttle
 * 5. Boat Transfer
 * 6. Helicopter Shuttle
 * 7. Vehicle Rental
 * 8. 4x4 / Safari Transfer
 */

export type TransportCategory =
  | 'Airport Transfer'
  | 'Intercity Transfer'
  | 'Private Driver'
  | 'Tourist Shuttle'
  | 'Boat Transfer'
  | 'Helicopter Shuttle'
  | 'Vehicle Rental'
  | '4x4 / Safari Transfer';

export interface TransportCategoryMeta {
  id: TransportCategory;
  label: string;
  shortDesc: string;
  iconName: string;
  defaultPricingType: TransportPricingType;
  vehicleSuggestions: string[];
}

export const CONTROLLED_TRANSPORT_CATEGORIES: TransportCategoryMeta[] = [
  {
    id: 'Airport Transfer',
    label: 'Airport Transfer',
    shortDesc: 'Reliable terminal meet-and-greet to hotels, lodges, and coastal resorts.',
    iconName: 'Plane',
    defaultPricingType: 'per_vehicle',
    vehicleSuggestions: ['Executive Sedan', 'Toyota Quantum Minibus (14-seater)', '4x4 SUV', 'Luxury VIP Van']
  },
  {
    id: 'Intercity Transfer',
    label: 'Intercity Transfer',
    shortDesc: 'Long-distance road transport between Mozambican cities, towns, and border posts.',
    iconName: 'Navigation',
    defaultPricingType: 'per_trip',
    vehicleSuggestions: ['Toyota HiAce / Quantum', 'Toyota Fortuner 4x4', 'Mercedes Sprinter Bus', 'Prado SUV']
  },
  {
    id: 'Private Driver',
    label: 'Private Driver',
    shortDesc: 'Dedicated chauffeur-driven vehicle for daily business, city exploration, or custom errands.',
    iconName: 'UserCheck',
    defaultPricingType: 'per_day',
    vehicleSuggestions: ['Executive Sedan', 'Air-Conditioned SUV', 'Chauffeur Van', 'Mercedes-Benz E-Class']
  },
  {
    id: 'Tourist Shuttle',
    label: 'Tourist Shuttle',
    shortDesc: 'Scheduled or shared beach and park transfers connecting popular backpacker and lodge hubs.',
    iconName: 'Bus',
    defaultPricingType: 'per_person',
    vehicleSuggestions: ['Commuter Minibus', 'Open-sided Beach Shuttle', 'Air-Conditioned Coaster Bus']
  },
  {
    id: 'Boat Transfer',
    label: 'Boat Transfer',
    shortDesc: 'Marine transfers across lagoons, estuaries, and island archipelagos (Bazaruto, Inhaca, Quirimbas).',
    iconName: 'Anchor',
    defaultPricingType: 'per_trip',
    vehicleSuggestions: ['Twin-Outboard Speedboat (8-12 pax)', 'Catamaran Cruiser', 'Traditional Motorized Dhow', 'RIB Inflatable Boat']
  },
  {
    id: 'Helicopter Shuttle',
    label: 'Helicopter Shuttle',
    shortDesc: 'Direct scenic aviation shuttles to remote island lodges and private wildlife reserves.',
    iconName: 'Wind',
    defaultPricingType: 'per_trip',
    vehicleSuggestions: ['Robinson R44 (3 pax)', 'Bell 407 (6 pax)', 'Airbus H125 / Squirrel (5 pax)']
  },
  {
    id: 'Vehicle Rental',
    label: 'Vehicle Rental',
    shortDesc: 'Self-drive rental cars, rugged pickups, and camper-equipped vehicles.',
    iconName: 'Car',
    defaultPricingType: 'per_day',
    vehicleSuggestions: ['Toyota Hilux 4x4 Double Cab', 'Suzuki Jimny 4x4', 'Sedan / Hatchback', 'Fully Equipped Camping 4x4']
  },
  {
    id: '4x4 / Safari Transfer',
    label: '4x4 / Safari Transfer',
    shortDesc: 'Specialized sand-track and deep bush transfers for Ponta do Ouro, Gorongosa, and Zinave.',
    iconName: 'Compass',
    defaultPricingType: 'per_vehicle',
    vehicleSuggestions: ['Toyota Land Cruiser (Safari Rigged)', 'Toyota Hilux 4x4 Raised Suspension', 'Open Game Viewer (9-seater)']
  }
];

export type TransportPricingType = 
  | 'per_vehicle' 
  | 'per_person' 
  | 'per_day' 
  | 'per_trip';

export type TransportStatus = 'published' | 'pending' | 'draft' | 'paused';

export interface TransportCapacity {
  maxPassengers: number;
  luggageCapacityPieces?: number;
}

export interface TransportVehicle {
  id: string; // Unique vehicle identifier e.g. "veh_172817281_x1"
  name: string; // Human-friendly name e.g. "Safari Land Cruiser #1" or "Executive Quantum Van"
  transportType?: string; // e.g. "4x4 SUV", "Minibus", "Speedboat", "Helicopter"
  make?: string; // e.g. "Toyota", "Yamaha", "Robinson"
  model?: string; // e.g. "Land Cruiser 79 Series", "Quantum GL"
  year?: string; // e.g. "2023"
  registrationNumber?: string; // Mozambican license plate e.g. "AIH-421-MC"
  licenseNumber?: string; // Commercial transport license or maritime registry
  capacity: number; // Max passenger capacity
  luggageCapacity?: number; // Max luggage pieces capacity
  description?: string; // Features, A/C, cooler box, charging ports, comfort details
  images: string[]; // Specific photos of THIS vehicle/vessel (exterior, interior, seating, luggage)
  active: boolean; // Active / Inactive operational toggle
}

export type TransportOperatingMemberRole = 
  | 'Owner'
  | 'Manager'
  | 'Operations Manager'
  | 'Driver'
  | 'Guide'
  | 'Captain';

export interface TransportOperatingMember {
  id: string; // Unique member identifier e.g. "mem_172817281_m1"
  fullName: string;
  role: TransportOperatingMemberRole;
  phone: string; // Direct operational Mozambican contact e.g. "+258 84 123 4567"
  email?: string;
  licenseOrIdRef?: string; // Carta de Condução profissional or BI reference
  active: boolean; // Active / Inactive operational toggle
}

export interface TransportRouteInfo {
  operatingLocation: string; // e.g. "Maputo", "Vilankulo", "Pemba"
  serviceArea: string; // e.g. "Greater Maputo and Southern Border"
  pickupLocations: string[]; // e.g. ["Maputo International Airport (MPM)", "City Center Hotels"]
  dropoffLocations: string[]; // e.g. ["Ponta do Ouro Beach", "Catembe", "Polana Serena"]
}

export interface TransportOffering {
  id: string;
  hostId: string; // Authenticated partner UID
  hostName: string;
  hostEmail?: string;
  hostPhone?: string;
  type: 'transport'; // Persisted cleanly inside activities_trips
  category: TransportCategory;
  title: string;
  shortDescription: string;
  description: string;
  city: string; // Main operating hub
  route: TransportRouteInfo;

  // Primary compatibility vehicle fields (preserved for backwards compatibility)
  vehicleType: string; // Specific model / craft (e.g. "Toyota Land Cruiser 4x4")
  vehicleYear?: string;
  licensePlateOrReg?: string;
  capacity: TransportCapacity;

  // Additive fleet management: Multiple vehicles/vessels (Gap #1 & Gap #2)
  vehicles?: TransportVehicle[];

  // Additive operations team: Multiple operating members (Gap #3)
  operatingMembers?: TransportOperatingMember[];

  pricingType: TransportPricingType;
  price: number; // MZN
  currency: string; // 'MZN'
  included: string[];
  notIncluded: string[];
  requirements: string[];
  images: string[];
  coverImage: string;
  status: TransportStatus;
  isHostVerified?: boolean;
  isLocalDraft?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const COMMON_TRANSPORT_INCLUSIONS = [
  'Professional English & Portuguese speaking driver',
  'Fuel & highway toll charges included',
  'Flight tracking & airport terminal meet-and-greet',
  'Air-conditioned clean cabin',
  'Complimentary chilled mineral water',
  'Passenger liability insurance coverage',
  'Direct door-to-door lodge drop-off',
  'Assistance with luggage loading and unloading',
  'Border post transit assistance',
  'Child car safety seat available on request'
];

export const COMMON_TRANSPORT_REQUIREMENTS = [
  'Flight details and arrival schedule required upon booking',
  'Valid passport / identification for intercity or border transit',
  'Valid international driver license required (Vehicle Rental only)',
  'Strict no smoking policy inside the vehicle/vessel',
  'Notification of oversized luggage (surfboards, dive bags) in advance'
];
