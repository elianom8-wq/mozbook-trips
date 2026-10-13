import React from 'react';
import AccommodationUnitManager, { AccommodationUnitManagerProps } from './AccommodationUnitManager';

// Backwards-compatible type alias and component wrapper for LodgeAccommodationManager
export type LodgeAccommodationManagerProps = AccommodationUnitManagerProps;

export default function LodgeAccommodationManager(props: LodgeAccommodationManagerProps) {
  return (
    <AccommodationUnitManager 
      {...props} 
      propertyTypeTitle={props.propertyTypeTitle || 'Lodge'} 
    />
  );
}
