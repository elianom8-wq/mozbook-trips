export type DmcVerificationStatus = 
  | 'draft' 
  | 'pending_review' 
  | 'approved' 
  | 'rejected' 
  | 'suspended' 
  | 'additional_info_required';

export type DmcDocumentVerificationStatus = 
  | 'not_uploaded' 
  | 'pending_review' 
  | 'verified' 
  | 'rejected' 
  | 'expired';

export interface DmcDocumentRecord {
  documentUrl?: string;
  documentName?: string;
  status: DmcDocumentVerificationStatus;
  uploadedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  notes?: string;
  expiryDate?: string;
}

export type MozambiqueRegion =
  | 'Maputo & South'
  | 'Ponta do Ouro & Maputo Special Reserve'
  | 'Bilene & Gaza Coast'
  | 'Inhambane, Tofo & Barra'
  | 'Vilankulo & Bazaruto Archipelago'
  | 'Gorongosa National Park & Sofala'
  | 'Beira & Central Mozambique'
  | 'Ilha de Moçambique & Nampula'
  | 'Pemba & Quirimbas Archipelago'
  | 'Niassa Special Reserve & North';

export const MOZAMBIQUE_REGIONS: MozambiqueRegion[] = [
  'Maputo & South',
  'Ponta do Ouro & Maputo Special Reserve',
  'Bilene & Gaza Coast',
  'Inhambane, Tofo & Barra',
  'Vilankulo & Bazaruto Archipelago',
  'Gorongosa National Park & Sofala',
  'Beira & Central Mozambique',
  'Ilha de Moçambique & Nampula',
  'Pemba & Quirimbas Archipelago',
  'Niassa Special Reserve & North'
];

export type DmcSpecialization =
  | 'Wildlife Safaris & Conservation'
  | 'Coastal & Marine Expeditions'
  | 'Cultural & Historical Heritage'
  | 'MICE & Corporate Retreats'
  | 'Bespoke Luxury & Honeymoon'
  | 'Overland 4x4 & Adventure'
  | 'Scuba Diving & Ocean Safari'
  | 'Birding & Botanical Tours';

export const DMC_SPECIALIZATIONS: DmcSpecialization[] = [
  'Wildlife Safaris & Conservation',
  'Coastal & Marine Expeditions',
  'Cultural & Historical Heritage',
  'MICE & Corporate Retreats',
  'Bespoke Luxury & Honeymoon',
  'Overland 4x4 & Adventure',
  'Scuba Diving & Ocean Safari',
  'Birding & Botanical Tours'
];

export interface DayItinerary {
  day: number;
  title: string;
  description: string;
  mealsIncluded: ('breakfast' | 'lunch' | 'dinner')[];
  accommodationName?: string;
  activities?: string[];
  transportMode?: string;
}

export interface TravelPackage {
  id: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  hostPhone?: string;
  agencyName?: string;
  inaturLicenseNumber?: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  description: string;
  category: string;
  destinations: MozambiqueRegion[];
  primaryDestination: string;
  durationDays: number;
  durationNights: number;
  itinerary: DayItinerary[];
  minGroupSize: number;
  maxGroupSize: number;
  isPrivateTourAvailable: boolean;
  
  // Pricing in MZN (Mozambican Meticais)
  pricePerPersonMzn: number;
  singleSupplementMzn?: number;
  childPriceMzn?: number;
  depositPercent?: number;
  currency: 'MZN';
  
  // Package Deliverables
  included: string[];
  notIncluded: string[];
  whatToBring: string[];
  travelRequirements: string[];
  pickupLocation: string;
  dropoffLocation: string;
  meetingPointInstructions?: string;
  
  // Departure scheduling
  departureDates: string[]; // Scheduled dates YYYY-MM-DD
  scheduleType: 'scheduled_dates' | 'flexible_daily' | 'on_request';
  
  // Media
  coverImage: string;
  images: string[];
  
  // Operational State
  status: 'draft' | 'pending' | 'published' | 'paused' | 'archived';
  featured?: boolean;
  rating?: number;
  reviewsCount?: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface DmcProfile {
  id?: string;
  userId: string;
  userEmail: string;
  legalBusinessName: string;
  tradingName: string;
  nuit: string; // Número Único de Identificação Tributária
  inaturLicenseNumber: string; // INATUR National Tourism Registration
  licenseExpiryDate: string;
  commercialRegistrationNumber?: string;
  representativeName: string;
  representativeRole: string;
  representativePhone: string;
  representativeEmail: string;
  physicalAddress: string;
  city: string;
  province: string;
  operatingRegions: MozambiqueRegion[];
  specializations: DmcSpecialization[];
  languagesSupported: string[];
  servicesOffered: string[];
  liabilityInsuranceInsurer?: string;
  liabilityInsurancePolicy?: string;
  liabilityInsuranceExpiry?: string;
  licenseDocUrl?: string;
  commercialRegDocUrl?: string;
  insuranceDocUrl?: string;
  documentRecords?: {
    inaturLicense?: DmcDocumentRecord;
    commercialCertificate?: DmcDocumentRecord;
    liabilityInsurance?: DmcDocumentRecord;
  };
  status: DmcVerificationStatus;
  adminNotes?: string;
  rejectionReason?: string;
  suspensionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DmcSupplier {
  id: string;
  hostId: string;
  name: string;
  category: 'accommodation' | 'activity' | 'transport' | 'guide' | 'other';
  location: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string;
  isVerifiedPartner?: boolean;
  rating?: number;
  contractStatus: 'active' | 'pending' | 'inactive';
}

export interface DmcEnquiry {
  id: string;
  hostId: string; // DMC host UID
  packageId?: string;
  packageTitle?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  travelDates: string;
  adultsCount: number;
  childrenCount: number;
  budgetMzn?: number;
  specialRequests?: string;
  status: 'new' | 'quoted' | 'accepted' | 'declined';
  quoteAmountMzn?: number;
  quoteNotes?: string;
  createdAt: string;
  updatedAt?: string;
}
