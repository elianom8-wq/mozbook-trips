import vehicleDataJson from './informationHubVehicleData.json';
import minorsAndOwnershipJson from './informationHubMinorsAndOwnershipData.json';

export interface InfoHubFact {
  id: string;
  title: string;
  factType: 'Vehicle' | 'Travel Document' | string;
  priority: number;
  tags: string[];
  description: string;
  categoryGroup?: 'vehicle' | 'minors_travel' | 'ownership';
}

export interface InformationHubContainer {
  category: string;
  country: string;
  facts: {
    title: string;
    factType: string;
    priority: number;
    tags: string[];
    description: string;
  }[];
}

export const INFORMATION_HUB_VEHICLE = vehicleDataJson.information_hub;

export const VEHICLE_FACTS: InfoHubFact[] = INFORMATION_HUB_VEHICLE.facts.map((fact, index) => ({
  id: `vehicle-core-fact-${fact.priority || index + 1}`,
  title: fact.title,
  factType: fact.factType,
  priority: fact.priority,
  tags: fact.tags,
  description: fact.description,
  categoryGroup: 'vehicle'
}));

export const MINORS_AND_OWNERSHIP_FACTS: InfoHubFact[] = minorsAndOwnershipJson.map((fact, index) => ({
  id: `minors-ownership-fact-${fact.priority || index + 1}`,
  title: fact.title,
  factType: fact.factType,
  priority: fact.priority,
  tags: fact.tags,
  description: fact.description,
  categoryGroup: fact.factType === 'Travel Document' ? 'minors_travel' : 'ownership'
}));

export const ALL_VERIFIED_FACTS: InfoHubFact[] = [
  ...VEHICLE_FACTS,
  ...MINORS_AND_OWNERSHIP_FACTS
];
