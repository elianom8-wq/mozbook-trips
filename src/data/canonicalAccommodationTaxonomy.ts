/**
 * Canonical MozBook Accommodation Taxonomy (Stage 3C)
 * 
 * Source of Truth: MozBook_Partner_Onboarding_Architecture_Seed(1).json
 *
 * SPECIFICATION CONSTRAINTS:
 * - Exactly 72 Canonical Accommodation / Property Types
 * - Exactly 6 Operating / Meal Models
 * - Exactly 16 Settings / Environmental Attributes
 * - Exactly 14 Accommodation Unit Types
 * - Full Backwards-Compatible Legacy Mapping for 8 residenceType values
 *
 * INVARIANTS:
 * - Stable backend IDs and human-friendly display names remain distinct.
 * - Operating models (Self-Catering, B&B) are NOT property types.
 * - Settings (Beachfront, Lagoon) are NOT property types.
 * - Existing hostId, listingId, and Firestore structures remain untouched.
 */

// ============================================================================
// 1. TYPE DEFINITIONS & UNIONS
// ============================================================================

export type LegacyResidenceType =
  | 'normal residence'
  | 'city residence'
  | 'country residence'
  | 'studio apartment'
  | 'lodge'
  | 'beachfront residence'
  | 'apartment home residence'
  | 'outdoor residence';

export type CanonicalAccommodationTypeId =
  // Hotels & Traditional Lodging (5)
  | 'HOTEL'
  | 'BOUTIQUE_HOTEL'
  | 'HOTEL_APARTMENT'
  | 'APARTHOTEL'
  // Hotels & Resorts (6)
  | 'RESORT'
  | 'BEACH_RESORT'
  | 'ECO_RESORT'
  | 'ISLAND_RESORT'
  | 'FAMILY_RESORT'
  | 'WELLNESS_RESORT'
  // Specialist Accommodation (8)
  | 'DIVING_RESORT'
  | 'FISHING_RESORT'
  | 'SAFARI_RESORT'
  | 'SURF_CAMP'
  | 'RETREAT_CENTRE'
  | 'HOUSEBOAT'
  | 'BOAT_ACCOMMODATION'
  | 'LIVEABOARD'
  | 'YACHT_STAY'
  // Independent & Small Accommodation (7)
  | 'GUESTHOUSE'
  | 'BED_AND_BREAKFAST'
  | 'INN'
  | 'PENSION'
  | 'RESIDENCIAL'
  | 'HOMESTAY'
  | 'FAMILY_GUESTHOUSE'
  // Budget & Social Accommodation (3)
  | 'HOSTEL'
  | 'BACKPACKER_HOSTEL'
  | 'DORMITORY'
  // Private & Self-Contained Accommodation (10)
  | 'VILLA'
  | 'PRIVATE_VILLA'
  | 'HOLIDAY_HOME'
  | 'BEACH_HOUSE'
  | 'COTTAGE'
  | 'CHALET'
  | 'BUNGALOW'
  | 'APARTMENT'
  | 'CONDOMINIUM'
  | 'TOWNHOUSE'
  // Rural & Nature Accommodation (5)
  | 'FARM_STAY'
  | 'FARMHOUSE'
  | 'COUNTRY_HOUSE'
  | 'ESTATE'
  | 'RANCH'
  // Lodges & Nature Accommodation (10)
  | 'LODGE'
  | 'ECO_LODGE'
  | 'BEACH_LODGE'
  | 'ISLAND_LODGE'
  | 'SAFARI_LODGE'
  | 'FISHING_LODGE'
  | 'RIVER_LAKE_LODGE'
  | 'FOREST_LODGE'
  | 'MOUNTAIN_LODGE'
  | 'WILDERNESS_LODGE'
  // Community & Sustainable Accommodation (2)
  | 'COMMUNITY_LODGE'
  | 'TRADITIONAL_HOUSE'
  // Camping & Tented Accommodation (10)
  | 'TENTED_LODGE'
  | 'TENTED_CAMP'
  | 'SAFARI_CAMP'
  | 'BUSH_CAMP'
  | 'ECO_CAMP'
  | 'COMMUNITY_CAMP'
  | 'BEACH_CAMP'
  | 'WILDERNESS_CAMP'
  | 'PERMANENT_TENT'
  | 'MOBILE_CAMP'
  // Camping & Outdoor Accommodation (6)
  | 'CAMPSITE'
  | 'PRIVATE_CAMPSITE'
  | 'LUXURY_CAMPING'
  | 'GLAMPING'
  | 'CARAVAN_CAMP'
  | 'BACKPACKER_CAMP';

export type OperatingModelId =
  | 'ROOM_ONLY'
  | 'BED_AND_BREAKFAST'
  | 'HALF_BOARD'
  | 'FULL_BOARD'
  | 'ALL_INCLUSIVE'
  | 'SELF_CATERING';

export type SettingId =
  | 'BEACHFRONT'
  | 'BEACH_ACCESS'
  | 'LAKEFRONT'
  | 'RIVERSIDE'
  | 'WATERFRONT'
  | 'ISLAND'
  | 'URBAN'
  | 'RURAL'
  | 'FOREST'
  | 'MOUNTAIN'
  | 'WILDLIFE_AREA'
  | 'NATIONAL_PARK'
  | 'LAGOON'
  | 'DAM'
  | 'COASTAL'
  | 'REMOTE';

export type UnitTypeId =
  | 'ROOM'
  | 'SUITE'
  | 'VILLA'
  | 'HOUSE'
  | 'APARTMENT'
  | 'COTTAGE'
  | 'CHALET'
  | 'BUNGALOW'
  | 'TENT'
  | 'CAMPSITE_PITCH'
  | 'DORMITORY'
  | 'HOUSEBOAT'
  | 'YACHT'
  | 'TRADITIONAL_UNIT';

export type ClassificationStatus =
  | 'VALID_MATCH'
  | 'SUGGESTED_MATCH'
  | 'NEEDS_ADMIN_REVIEW';

// ============================================================================
// 2. STRUCTURAL INTERFACES
// ============================================================================

export interface CanonicalAccommodationType {
  backend_id: CanonicalAccommodationTypeId;
  display_name: string;
  parent_category: string;
  description: string;
  aliases: string;
}

export interface OperatingModel {
  backend_id: OperatingModelId;
  display_name: string;
  description: string;
  aliases: string;
}

export interface AccommodationSetting {
  backend_id: SettingId;
  display_name: string;
}

export interface AccommodationUnitType {
  backend_id: UnitTypeId;
  display_name: string;
}

export interface LegacyResidenceTypeMapping {
  legacyType: LegacyResidenceType;
  canonicalTypeId: CanonicalAccommodationTypeId;
  canonicalDisplayName: string;
  suggestedOperatingModels?: OperatingModelId[];
  suggestedSettings?: SettingId[];
  classificationStatus: ClassificationStatus;
  rationale: string;
}

// ============================================================================
// 3. CANONICAL ACCOMMODATION TYPES (EXACTLY 72)
// ============================================================================

export const CANONICAL_ACCOMMODATION_TYPES: readonly CanonicalAccommodationType[] = [
  // 1. Hotels & Traditional Lodging
  {
    backend_id: 'HOTEL',
    display_name: 'Hotel',
    parent_category: 'Hotels & Traditional Lodging',
    description: 'Traditional commercial lodging with private guest rooms and shared guest facilities.',
    aliases: 'hotel; hotels'
  },
  {
    backend_id: 'BOUTIQUE_HOTEL',
    display_name: 'Boutique Hotel',
    parent_category: 'Hotels & Traditional Lodging',
    description: 'Smaller design-focused or individually styled hotel, usually with a distinctive character.',
    aliases: 'boutique hotel; design hotel'
  },
  {
    backend_id: 'HOTEL_APARTMENT',
    display_name: 'Serviced Apartment',
    parent_category: 'Hotels & Traditional Lodging',
    description: 'Apartment-style accommodation with hotel-like services and amenities.',
    aliases: 'serviced apartment; aparthotel; apartment hotel'
  },
  {
    backend_id: 'APARTHOTEL',
    display_name: 'Aparthotel',
    parent_category: 'Hotels & Traditional Lodging',
    description: 'Property combining hotel services with apartment-style units, often including kitchens.',
    aliases: 'aparthotel; apartment hotel'
  },

  // 2. Hotels & Resorts
  {
    backend_id: 'RESORT',
    display_name: 'Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Full-service leisure property with accommodation plus recreational or leisure facilities.',
    aliases: 'resort; holiday resort'
  },
  {
    backend_id: 'BEACH_RESORT',
    display_name: 'Beach Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Resort located on or directly associated with a beach/coastal leisure destination.',
    aliases: 'beach resort; beachfront resort'
  },
  {
    backend_id: 'ECO_RESORT',
    display_name: 'Eco-Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Resort positioned around nature, conservation, low-impact tourism or environmental experiences.',
    aliases: 'eco resort; eco-resort'
  },
  {
    backend_id: 'ISLAND_RESORT',
    display_name: 'Island Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Leisure resort located on an island.',
    aliases: 'island resort'
  },
  {
    backend_id: 'FAMILY_RESORT',
    display_name: 'Family Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Resort designed primarily for families and multi-age leisure travel.',
    aliases: 'family resort'
  },
  {
    backend_id: 'WELLNESS_RESORT',
    display_name: 'Wellness / Spa Resort',
    parent_category: 'Hotels & Resorts',
    description: 'Accommodation focused on wellness, spa, health, relaxation or retreat experiences.',
    aliases: 'spa resort; wellness resort'
  },

  // 3. Specialist Accommodation
  {
    backend_id: 'DIVING_RESORT',
    display_name: 'Diving Resort',
    parent_category: 'Specialist Accommodation',
    description: 'Accommodation strongly focused on scuba diving and marine activities.',
    aliases: 'dive resort; diving resort'
  },
  {
    backend_id: 'FISHING_RESORT',
    display_name: 'Fishing Resort',
    parent_category: 'Specialist Accommodation',
    description: 'Accommodation strongly focused on recreational or sport fishing.',
    aliases: 'fishing resort; angling resort'
  },
  {
    backend_id: 'SAFARI_RESORT',
    display_name: 'Safari Resort',
    parent_category: 'Specialist Accommodation',
    description: 'Leisure accommodation focused on wildlife viewing and safari activities.',
    aliases: 'safari resort; wildlife resort'
  },
  {
    backend_id: 'SURF_CAMP',
    display_name: 'Surf Camp',
    parent_category: 'Specialist Accommodation',
    description: 'Accommodation built around surfing instruction, surf travel and related activities.',
    aliases: 'surf camp; surfing camp'
  },
  {
    backend_id: 'RETREAT_CENTRE',
    display_name: 'Retreat Centre',
    parent_category: 'Specialist Accommodation',
    description: 'Property primarily hosting retreats such as yoga, wellness, spiritual, creative or group programmes.',
    aliases: 'retreat center; retreat centre'
  },
  {
    backend_id: 'HOUSEBOAT',
    display_name: 'Houseboat',
    parent_category: 'Specialist Accommodation',
    description: 'Boat or floating vessel equipped and operated as guest accommodation.',
    aliases: 'houseboat; floating accommodation'
  },
  {
    backend_id: 'BOAT_ACCOMMODATION',
    display_name: 'Boat Accommodation',
    parent_category: 'Specialist Accommodation',
    description: 'Overnight accommodation provided aboard a boat, dhow, yacht or other vessel.',
    aliases: 'boat stay; liveaboard; dhow accommodation'
  },
  {
    backend_id: 'LIVEABOARD',
    display_name: 'Liveaboard',
    parent_category: 'Specialist Accommodation',
    description: 'Vessel-based accommodation designed for multi-day marine travel, diving, fishing or exploration.',
    aliases: 'liveaboard; live aboard'
  },
  {
    backend_id: 'YACHT_STAY',
    display_name: 'Yacht Stay',
    parent_category: 'Specialist Accommodation',
    description: 'Overnight accommodation aboard a yacht or sailing vessel.',
    aliases: 'yacht stay; yacht accommodation'
  },

  // 4. Independent & Small Accommodation
  {
    backend_id: 'GUESTHOUSE',
    display_name: 'Guesthouse',
    parent_category: 'Independent & Small Accommodation',
    description: 'Small lodging property offering private guest rooms, often independently operated.',
    aliases: 'guesthouse; guest house'
  },
  {
    backend_id: 'BED_AND_BREAKFAST',
    display_name: 'Bed & Breakfast',
    parent_category: 'Independent & Small Accommodation',
    description: 'Accommodation where lodging is typically sold with breakfast included.',
    aliases: 'B&B; bed and breakfast; BnB'
  },
  {
    backend_id: 'INN',
    display_name: 'Inn',
    parent_category: 'Independent & Small Accommodation',
    description: 'Small traditional lodging establishment, often independently operated.',
    aliases: 'inn; country inn'
  },
  {
    backend_id: 'PENSION',
    display_name: 'Pensão / Pension',
    parent_category: 'Independent & Small Accommodation',
    description: 'Small budget or traditional lodging establishment common in Lusophone markets.',
    aliases: 'pensão; pension; pensao'
  },
  {
    backend_id: 'RESIDENCIAL',
    display_name: 'Residencial',
    parent_category: 'Independent & Small Accommodation',
    description: 'Mozambican/Lusophone-style residential lodging establishment, often simpler than a hotel.',
    aliases: 'residencial; residencial lodge'
  },
  {
    backend_id: 'HOMESTAY',
    display_name: 'Homestay',
    parent_category: 'Independent & Small Accommodation',
    description: 'Guests stay in or as part of a local host household or home-based accommodation.',
    aliases: 'homestay; home stay; local homestay'
  },
  {
    backend_id: 'FAMILY_GUESTHOUSE',
    display_name: 'Family Guesthouse',
    parent_category: 'Independent & Small Accommodation',
    description: 'Small family-operated guesthouse or lodging property.',
    aliases: 'family guesthouse; family-run guesthouse'
  },

  // 5. Budget & Social Accommodation
  {
    backend_id: 'HOSTEL',
    display_name: 'Hostel',
    parent_category: 'Budget & Social Accommodation',
    description: 'Budget accommodation with shared facilities and/or dormitory rooms.',
    aliases: 'hostel; youth hostel'
  },
  {
    backend_id: 'BACKPACKER_HOSTEL',
    display_name: 'Backpacker Hostel',
    parent_category: 'Budget & Social Accommodation',
    description: 'Hostel oriented toward independent, budget and backpacker travellers.',
    aliases: 'backpacker; backpackers; backpacker hostel'
  },
  {
    backend_id: 'DORMITORY',
    display_name: 'Dormitory Accommodation',
    parent_category: 'Budget & Social Accommodation',
    description: 'Shared sleeping accommodation with multiple beds in one room or sleeping area.',
    aliases: 'dorm; dormitory'
  },

  // 6. Private & Self-Contained Accommodation
  {
    backend_id: 'VILLA',
    display_name: 'Villa',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Standalone house or villa offered as holiday accommodation, either privately or commercially managed.',
    aliases: 'villa; holiday villa'
  },
  {
    backend_id: 'PRIVATE_VILLA',
    display_name: 'Private Villa',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Entire villa rented privately to one guest group for exclusive use.',
    aliases: 'private villa; exclusive villa'
  },
  {
    backend_id: 'HOLIDAY_HOME',
    display_name: 'Holiday Home',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Entire residential-style property rented for short-term holidays.',
    aliases: 'holiday home; vacation home; holiday house'
  },
  {
    backend_id: 'BEACH_HOUSE',
    display_name: 'Beach House',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'House or private residence offered for holiday stays in a coastal or beachfront setting.',
    aliases: 'beach house; beachfront house'
  },
  {
    backend_id: 'COTTAGE',
    display_name: 'Cottage',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Small standalone holiday dwelling, commonly in rural, nature or leisure settings.',
    aliases: 'cottage; holiday cottage'
  },
  {
    backend_id: 'CHALET',
    display_name: 'Chalet',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Standalone or semi-detached holiday unit, often associated with nature, mountains, resorts or leisure destinations.',
    aliases: 'chalet; holiday chalet'
  },
  {
    backend_id: 'BUNGALOW',
    display_name: 'Bungalow',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Single-storey standalone or semi-standalone accommodation unit.',
    aliases: 'bungalow; beach bungalow'
  },
  {
    backend_id: 'APARTMENT',
    display_name: 'Apartment',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Self-contained apartment rented for short-term or holiday accommodation.',
    aliases: 'apartment; holiday apartment; flat'
  },
  {
    backend_id: 'CONDOMINIUM',
    display_name: 'Condominium',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Condominium or managed residential unit offered as short-term accommodation.',
    aliases: 'condo; condominium'
  },
  {
    backend_id: 'TOWNHOUSE',
    display_name: 'Townhouse',
    parent_category: 'Private & Self-Contained Accommodation',
    description: 'Multi-level or attached residential unit offered for short-term accommodation.',
    aliases: 'townhouse; town house'
  },

  // 7. Rural & Nature Accommodation
  {
    backend_id: 'FARM_STAY',
    display_name: 'Farm Stay',
    parent_category: 'Rural & Nature Accommodation',
    description: 'Accommodation located on or associated with a working farm or agricultural property.',
    aliases: 'farm stay; farmstay; farm accommodation'
  },
  {
    backend_id: 'FARMHOUSE',
    display_name: 'Farmhouse',
    parent_category: 'Rural & Nature Accommodation',
    description: 'House-style accommodation located on a rural or agricultural property.',
    aliases: 'farmhouse; country farmhouse'
  },
  {
    backend_id: 'COUNTRY_HOUSE',
    display_name: 'Country House',
    parent_category: 'Rural & Nature Accommodation',
    description: 'Traditional or private house accommodation in a rural/countryside setting.',
    aliases: 'country house; rural house'
  },
  {
    backend_id: 'ESTATE',
    display_name: 'Estate',
    parent_category: 'Rural & Nature Accommodation',
    description: 'Large private or commercial property offering accommodation across an estate or extensive grounds.',
    aliases: 'estate; private estate'
  },
  {
    backend_id: 'RANCH',
    display_name: 'Ranch',
    parent_category: 'Rural & Nature Accommodation',
    description: 'Ranch or livestock/agricultural property that offers visitor accommodation.',
    aliases: 'ranch; ranch stay'
  },

  // 8. Lodges & Nature Accommodation
  {
    backend_id: 'LODGE',
    display_name: 'Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'General lodge-style accommodation, often associated with nature, leisure or remote destinations.',
    aliases: 'lodge; lodges'
  },
  {
    backend_id: 'ECO_LODGE',
    display_name: 'Eco-Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Nature-oriented accommodation emphasizing environmental responsibility, conservation or low-impact tourism.',
    aliases: 'eco lodge; ecolodge; eco-lodge'
  },
  {
    backend_id: 'BEACH_LODGE',
    display_name: 'Beach Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge located on or closely associated with a beach or coastal environment.',
    aliases: 'beach lodge; beachfront lodge'
  },
  {
    backend_id: 'ISLAND_LODGE',
    display_name: 'Island Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge located on an island.',
    aliases: 'island lodge'
  },
  {
    backend_id: 'SAFARI_LODGE',
    display_name: 'Safari Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge primarily serving wildlife viewing, safari or conservation tourism.',
    aliases: 'safari lodge; wildlife lodge'
  },
  {
    backend_id: 'FISHING_LODGE',
    display_name: 'Fishing Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge primarily serving recreational or sport fishing guests.',
    aliases: 'fishing lodge; angling lodge'
  },
  {
    backend_id: 'RIVER_LAKE_LODGE',
    display_name: 'River / Lake Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge located beside a river, lake, dam or other inland water body.',
    aliases: 'river lodge; lake lodge; lakeside lodge; riverside lodge'
  },
  {
    backend_id: 'FOREST_LODGE',
    display_name: 'Forest Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge located in or directly associated with a forest or woodland environment.',
    aliases: 'forest lodge; woodland lodge'
  },
  {
    backend_id: 'MOUNTAIN_LODGE',
    display_name: 'Mountain Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Lodge located in a mountain or highland environment.',
    aliases: 'mountain lodge; highland lodge'
  },
  {
    backend_id: 'WILDERNESS_LODGE',
    display_name: 'Wilderness Lodge',
    parent_category: 'Lodges & Nature Accommodation',
    description: 'Remote nature lodge designed around wilderness, conservation or outdoor experiences.',
    aliases: 'wilderness lodge; remote lodge'
  },

  // 9. Community & Sustainable Accommodation
  {
    backend_id: 'COMMUNITY_LODGE',
    display_name: 'Community Lodge',
    parent_category: 'Community & Sustainable Accommodation',
    description: 'Accommodation owned, operated or substantially managed by a local community or community partnership.',
    aliases: 'community lodge; community-run lodge'
  },
  {
    backend_id: 'TRADITIONAL_HOUSE',
    display_name: 'Traditional House',
    parent_category: 'Community & Sustainable Accommodation',
    description: 'Accommodation based on local traditional architecture or a culturally significant dwelling.',
    aliases: 'traditional house; traditional home'
  },

  // 10. Camping & Tented Accommodation
  {
    backend_id: 'TENTED_LODGE',
    display_name: 'Tented Lodge',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Permanent lodge using furnished or semi-permanent tented accommodation units.',
    aliases: 'tented lodge; tented accommodation'
  },
  {
    backend_id: 'TENTED_CAMP',
    display_name: 'Tented Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Camp consisting primarily of furnished or semi-permanent guest tents.',
    aliases: 'tented camp; tent camp'
  },
  {
    backend_id: 'SAFARI_CAMP',
    display_name: 'Safari Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Tented or camp-style accommodation focused on wildlife and safari experiences.',
    aliases: 'safari camp; wildlife camp'
  },
  {
    backend_id: 'BUSH_CAMP',
    display_name: 'Bush Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Remote camp-style accommodation in a natural bush/wilderness environment.',
    aliases: 'bush camp; bush lodge'
  },
  {
    backend_id: 'ECO_CAMP',
    display_name: 'Eco-Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Low-impact nature camp emphasizing environmental or conservation principles.',
    aliases: 'eco camp; eco-camp'
  },
  {
    backend_id: 'COMMUNITY_CAMP',
    display_name: 'Community Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Camp owned or operated by a local community or community tourism initiative.',
    aliases: 'community camp'
  },
  {
    backend_id: 'BEACH_CAMP',
    display_name: 'Beach Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Camping or tented accommodation located directly on or near a beach.',
    aliases: 'beach camp; coastal camp'
  },
  {
    backend_id: 'WILDERNESS_CAMP',
    display_name: 'Wilderness Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Remote camp accommodation focused on wilderness and outdoor experiences.',
    aliases: 'wilderness camp; remote camp'
  },
  {
    backend_id: 'PERMANENT_TENT',
    display_name: 'Permanent Tent Accommodation',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Individual permanent or semi-permanent guest tents sold as accommodation units.',
    aliases: 'permanent tent; safari tent'
  },
  {
    backend_id: 'MOBILE_CAMP',
    display_name: 'Mobile / Seasonal Camp',
    parent_category: 'Camping & Tented Accommodation',
    description: 'Temporary, seasonal or movable camp established for a defined tourism period or itinerary.',
    aliases: 'mobile camp; seasonal camp; temporary camp'
  },

  // 11. Camping & Outdoor Accommodation
  {
    backend_id: 'CAMPSITE',
    display_name: 'Campsite',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Designated place where guests stay in their own tents, caravans or camping equipment.',
    aliases: 'campsite; camping site; campground'
  },
  {
    backend_id: 'PRIVATE_CAMPSITE',
    display_name: 'Private Campsite',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Privately operated campsite offering designated camping pitches to guests.',
    aliases: 'private campsite'
  },
  {
    backend_id: 'LUXURY_CAMPING',
    display_name: 'Luxury Camping',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Higher-comfort camping with upgraded facilities or furnished accommodation.',
    aliases: 'luxury camping'
  },
  {
    backend_id: 'GLAMPING',
    display_name: 'Glamping',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Comfort-focused or luxury camping using furnished tents, domes, pods or similar structures.',
    aliases: 'glamping; glamorous camping'
  },
  {
    backend_id: 'CARAVAN_CAMP',
    display_name: 'Caravan / Motorhome Park',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Site designed for caravans, campervans or motorhomes, often with utility connections.',
    aliases: 'caravan park; motorhome park; RV park'
  },
  {
    backend_id: 'BACKPACKER_CAMP',
    display_name: 'Backpacker Camp',
    parent_category: 'Camping & Outdoor Accommodation',
    description: 'Budget camp oriented toward backpackers and independent travellers.',
    aliases: 'backpacker camp'
  }
];

// ============================================================================
// 4. OPERATING / MEAL MODELS (EXACTLY 6)
// ============================================================================

export const OPERATING_MODELS: readonly OperatingModel[] = [
  {
    backend_id: 'ROOM_ONLY',
    display_name: 'Room Only',
    description: 'Accommodation price includes lodging only; meals are not included by default.',
    aliases: 'room only'
  },
  {
    backend_id: 'BED_AND_BREAKFAST',
    display_name: 'Bed & Breakfast',
    description: 'Lodging with breakfast included.',
    aliases: 'B&B; breakfast included'
  },
  {
    backend_id: 'HALF_BOARD',
    display_name: 'Half Board',
    description: 'Lodging typically including breakfast and one main meal.',
    aliases: 'half board'
  },
  {
    backend_id: 'FULL_BOARD',
    display_name: 'Full Board',
    description: 'Lodging typically including breakfast, lunch and dinner.',
    aliases: 'full board'
  },
  {
    backend_id: 'ALL_INCLUSIVE',
    display_name: 'All Inclusive',
    description: 'Lodging package including accommodation and a broad range of meals/drinks/services as defined by the property.',
    aliases: 'all inclusive; all-inclusive'
  },
  {
    backend_id: 'SELF_CATERING',
    display_name: 'Self-Catering',
    description: 'Guest accommodation designed to allow guests to prepare their own meals, usually with a kitchen or kitchenette.',
    aliases: 'self catering; self-catering'
  }
];

// ============================================================================
// 5. SETTINGS / ENVIRONMENTAL ATTRIBUTES (EXACTLY 16)
// ============================================================================

export const SETTINGS: readonly AccommodationSetting[] = [
  {
    backend_id: 'BEACHFRONT',
    display_name: 'Beachfront'
  },
  {
    backend_id: 'BEACH_ACCESS',
    display_name: 'Beach Access'
  },
  {
    backend_id: 'LAKEFRONT',
    display_name: 'Lakefront'
  },
  {
    backend_id: 'RIVERSIDE',
    display_name: 'Riverside'
  },
  {
    backend_id: 'WATERFRONT',
    display_name: 'Waterfront'
  },
  {
    backend_id: 'ISLAND',
    display_name: 'Island'
  },
  {
    backend_id: 'URBAN',
    display_name: 'Urban'
  },
  {
    backend_id: 'RURAL',
    display_name: 'Rural'
  },
  {
    backend_id: 'FOREST',
    display_name: 'Forest'
  },
  {
    backend_id: 'MOUNTAIN',
    display_name: 'Mountain'
  },
  {
    backend_id: 'WILDLIFE_AREA',
    display_name: 'Wildlife / Game Area'
  },
  {
    backend_id: 'NATIONAL_PARK',
    display_name: 'National Park'
  },
  {
    backend_id: 'LAGOON',
    display_name: 'Lagoon'
  },
  {
    backend_id: 'DAM',
    display_name: 'Dam / Reservoir'
  },
  {
    backend_id: 'COASTAL',
    display_name: 'Coastal'
  },
  {
    backend_id: 'REMOTE',
    display_name: 'Remote / Wilderness'
  }
];

// ============================================================================
// 6. ACCOMMODATION UNIT TYPES (EXACTLY 14)
// ============================================================================

export const UNIT_TYPES: readonly AccommodationUnitType[] = [
  {
    backend_id: 'ROOM',
    display_name: 'Room'
  },
  {
    backend_id: 'SUITE',
    display_name: 'Suite'
  },
  {
    backend_id: 'VILLA',
    display_name: 'Villa'
  },
  {
    backend_id: 'HOUSE',
    display_name: 'House'
  },
  {
    backend_id: 'APARTMENT',
    display_name: 'Apartment'
  },
  {
    backend_id: 'COTTAGE',
    display_name: 'Cottage'
  },
  {
    backend_id: 'CHALET',
    display_name: 'Chalet'
  },
  {
    backend_id: 'BUNGALOW',
    display_name: 'Bungalow'
  },
  {
    backend_id: 'TENT',
    display_name: 'Tent'
  },
  {
    backend_id: 'CAMPSITE_PITCH',
    display_name: 'Campsite Pitch'
  },
  {
    backend_id: 'DORMITORY',
    display_name: 'Dormitory'
  },
  {
    backend_id: 'HOUSEBOAT',
    display_name: 'Houseboat'
  },
  {
    backend_id: 'YACHT',
    display_name: 'Yacht / Boat'
  },
  {
    backend_id: 'TRADITIONAL_UNIT',
    display_name: 'Traditional Accommodation Unit'
  }
];

// ============================================================================
// 7. BACKWARDS-COMPATIBLE LEGACY MAPPINGS (8 LEGACY RESIDENCE TYPES)
// ============================================================================

export const LEGACY_RESIDENCE_MAPPINGS: Record<LegacyResidenceType, LegacyResidenceTypeMapping> = {
  'normal residence': {
    legacyType: 'normal residence',
    canonicalTypeId: 'HOLIDAY_HOME',
    canonicalDisplayName: 'Holiday Home',
    suggestedSettings: ['RURAL', 'URBAN'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Standalone suburban or residential dwelling maps directly to canonical Holiday Home.'
  },
  'city residence': {
    legacyType: 'city residence',
    canonicalTypeId: 'TOWNHOUSE',
    canonicalDisplayName: 'Townhouse',
    suggestedSettings: ['URBAN'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Urban townhouse, duplex or condo in city center maps to Townhouse with Urban setting.'
  },
  'country residence': {
    legacyType: 'country residence',
    canonicalTypeId: 'COUNTRY_HOUSE',
    canonicalDisplayName: 'Country House',
    suggestedSettings: ['RURAL'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Rural homestead, farm estate or spacious acreage dwelling maps to Country House with Rural setting.'
  },
  'studio apartment': {
    legacyType: 'studio apartment',
    canonicalTypeId: 'APARTMENT',
    canonicalDisplayName: 'Apartment',
    suggestedOperatingModels: ['SELF_CATERING'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Self-contained open-plan apartment with kitchen maps to Apartment with Self-Catering operating model.'
  },
  'lodge': {
    legacyType: 'lodge',
    canonicalTypeId: 'LODGE',
    canonicalDisplayName: 'Lodge',
    suggestedSettings: ['WILDLIFE_AREA', 'REMOTE', 'FOREST'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Direct 1:1 match with canonical Lodge.'
  },
  'beachfront residence': {
    legacyType: 'beachfront residence',
    canonicalTypeId: 'BEACH_HOUSE',
    canonicalDisplayName: 'Beach House',
    suggestedSettings: ['BEACHFRONT', 'COASTAL'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Coastal villa, seaside bungalow or oceanfront dwelling maps to Beach House with Beachfront and Coastal settings.'
  },
  'apartment home residence': {
    legacyType: 'apartment home residence',
    canonicalTypeId: 'APARTMENT',
    canonicalDisplayName: 'Apartment',
    suggestedSettings: ['URBAN'],
    classificationStatus: 'VALID_MATCH',
    rationale: 'Multi-room residential flat in a residential block maps to canonical Apartment.'
  },
  'outdoor residence': {
    legacyType: 'outdoor residence',
    canonicalTypeId: 'GLAMPING',
    canonicalDisplayName: 'Glamping',
    suggestedSettings: ['REMOTE', 'FOREST', 'COASTAL'],
    classificationStatus: 'NEEDS_ADMIN_REVIEW',
    rationale: 'Legacy type conflates glamping domes, safari tents, treehouses, bush camps, and campsites. Mapped provisionally to Glamping, but requires admin review to determine if the property is a Campsite, Safari Camp, Bush Camp, or Luxury Camping.'
  }
};

// ============================================================================
// 8. TAXONOMY LOOKUP HELPERS
// ============================================================================

export function getCanonicalAccommodationType(id?: string): CanonicalAccommodationType | undefined {
  if (!id) return undefined;
  return CANONICAL_ACCOMMODATION_TYPES.find(t => t.backend_id === id);
}

export function getOperatingModel(id?: string): OperatingModel | undefined {
  if (!id) return undefined;
  return OPERATING_MODELS.find(m => m.backend_id === id);
}

export function getSetting(id?: string): AccommodationSetting | undefined {
  if (!id) return undefined;
  return SETTINGS.find(s => s.backend_id === id);
}

export function getUnitType(id?: string): AccommodationUnitType | undefined {
  if (!id) return undefined;
  return UNIT_TYPES.find(u => u.backend_id === id);
}

/**
 * Backwards-compatible resolution of legacy residenceType to canonical mapping
 */
export function mapLegacyResidenceType(residenceType?: string): LegacyResidenceTypeMapping | undefined {
  if (!residenceType) return undefined;
  const legacyKey = residenceType as LegacyResidenceType;
  return LEGACY_RESIDENCE_MAPPINGS[legacyKey];
}

/**
 * Backwards-compatible resolution of canonical type to legacy residenceType
 */
export function mapCanonicalToLegacyResidenceType(canonicalId?: string): LegacyResidenceType {
  if (!canonicalId) return 'normal residence';
  
  if (canonicalId.includes('LODGE') || canonicalId === 'SAFARI_RESORT') {
    return 'lodge';
  }
  if (canonicalId.includes('BEACH') || canonicalId === 'SURF_CAMP') {
    return 'beachfront residence';
  }
  if (
    canonicalId.includes('CAMP') || 
    canonicalId.includes('TENT') || 
    canonicalId === 'GLAMPING'
  ) {
    return 'outdoor residence';
  }
  if (
    canonicalId === 'APARTMENT' || 
    canonicalId === 'CONDOMINIUM' || 
    canonicalId === 'HOTEL_APARTMENT' || 
    canonicalId === 'APARTHOTEL'
  ) {
    return 'apartment home residence';
  }
  if (
    canonicalId === 'TOWNHOUSE' || 
    canonicalId === 'HOTEL' || 
    canonicalId === 'BOUTIQUE_HOTEL' || 
    canonicalId === 'RESIDENCIAL' || 
    canonicalId === 'HOSTEL' || 
    canonicalId === 'BACKPACKER_HOSTEL' || 
    canonicalId === 'DORMITORY'
  ) {
    return 'city residence';
  }
  if (
    canonicalId.includes('FARM') || 
    canonicalId === 'COUNTRY_HOUSE' || 
    canonicalId === 'ESTATE' || 
    canonicalId === 'RANCH'
  ) {
    return 'country residence';
  }
  return 'normal residence';
}

/**
 * All 11 Canonical Parent Categories in standard order
 */
export const CANONICAL_PARENT_CATEGORIES: readonly string[] = [
  'Hotels & Traditional Lodging',
  'Hotels & Resorts',
  'Specialist Accommodation',
  'Independent & Small Accommodation',
  'Budget & Social Accommodation',
  'Private & Self-Contained Accommodation',
  'Rural & Nature Accommodation',
  'Lodges & Nature Accommodation',
  'Community & Sustainable Accommodation',
  'Camping & Tented Accommodation',
  'Camping & Outdoor Accommodation'
] as const;

/**
 * Returns the parent category for a given canonical accommodation type ID.
 */
export function getParentCategoryForType(canonicalTypeId?: string): string | undefined {
  if (!canonicalTypeId) return undefined;
  const match = CANONICAL_ACCOMMODATION_TYPES.find(t => t.backend_id === canonicalTypeId);
  return match?.parent_category;
}

/**
 * Returns all canonical accommodation types belonging to a specific parent category.
 * If no category or an empty/all filter is supplied, returns all canonical types.
 */
export function getCanonicalTypesByCategory(parentCategory?: string): readonly CanonicalAccommodationType[] {
  if (!parentCategory || parentCategory === 'all') {
    return CANONICAL_ACCOMMODATION_TYPES;
  }
  return CANONICAL_ACCOMMODATION_TYPES.filter(t => t.parent_category === parentCategory);
}

/**
 * Validates whether a given canonical accommodation type belongs to the specified parent category.
 */
export function isValidCanonicalCategoryTypePair(parentCategory?: string, canonicalTypeId?: string): boolean {
  if (!parentCategory || !canonicalTypeId) return false;
  if (parentCategory === 'all') {
    return CANONICAL_ACCOMMODATION_TYPES.some(t => t.backend_id === canonicalTypeId);
  }
  const match = CANONICAL_ACCOMMODATION_TYPES.find(t => t.backend_id === canonicalTypeId);
  return Boolean(match && match.parent_category === parentCategory);
}

/**
 * Type guard for CanonicalAccommodationTypeId
 */
export function isCanonicalAccommodationTypeId(id?: string): id is CanonicalAccommodationTypeId {
  if (!id) return false;
  return CANONICAL_ACCOMMODATION_TYPES.some(t => t.backend_id === id);
}
