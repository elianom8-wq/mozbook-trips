import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Navigation, 
  Search, 
  Check, 
  Loader2, 
  AlertCircle, 
  Smartphone, 
  Building2, 
  Compass, 
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { permissionService, PHONE_SETTINGS_GUIDES } from '../services/permissionService';
import PermissionPromptModal from './PermissionPromptModal';

export interface Coordinates {
  lat: number;
  lng: number;
}

import { MOZAMBIQUE_PROVINCES } from '../services/listingService';
export { MOZAMBIQUE_PROVINCES };

export interface GpsLocationPickerProps {
  coordinates: Coordinates;
  city: string;
  province: string;
  address: string;
  country?: string;
  neighborhood?: string;
  street?: string;
  buildingNumber?: string;
  buildingName?: string;
  postalCode?: string;
  directionsLandmark?: string;
  useGps?: boolean;
  usePhysicalAddress?: boolean;
  pinSource?: 'gps' | 'map_pin' | 'search' | 'default';
  onChange: (data: {
    coordinates: Coordinates;
    city: string;
    province: string;
    address: string;
    country?: string;
    neighborhood?: string;
    street?: string;
    buildingNumber?: string;
    buildingName?: string;
    postalCode?: string;
    directionsLandmark?: string;
    useGps?: boolean;
    usePhysicalAddress?: boolean;
    pinSource?: 'gps' | 'map_pin' | 'search' | 'default';
  }) => void;
}

// Custom Leaflet marker HTML with MozBook brand green
const createCustomMarker = () => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        width: 38px;
        height: 38px;
        background-color: #009A60;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(0, 154, 96, 0.4);
        border: 3px solid #ffffff;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });
};

export default function GpsLocationPicker({
  coordinates,
  city,
  province,
  address,
  country = 'Mozambique',
  neighborhood = '',
  street = '',
  buildingNumber = '',
  buildingName = '',
  postalCode = '',
  directionsLandmark = '',
  useGps = true,
  usePhysicalAddress = true,
  pinSource = 'default',
  onChange,
}: GpsLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [guideOs, setGuideOs] = useState<'iOS' | 'Android' | 'Desktop'>('iOS');

  // Local state for toggles so host can activate/deactivate sections without data loss
  const [localUseGps, setLocalUseGps] = useState(useGps);
  const [localUsePhysicalAddress, setLocalUsePhysicalAddress] = useState(usePhysicalAddress);

  useEffect(() => {
    setLocalUseGps(useGps);
  }, [useGps]);

  useEffect(() => {
    setLocalUsePhysicalAddress(usePhysicalAddress);
  }, [usePhysicalAddress]);

  // Safe reverse geocode: DOES NOT overwrite manually entered address details
  const reverseGeocode = async (lat: number, lng: number, source: 'gps' | 'map_pin' | 'search') => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (!res.ok) {
        onChange({
          coordinates: { lat, lng },
          city,
          province,
          address,
          country,
          neighborhood,
          street,
          buildingNumber,
          buildingName,
          postalCode,
          directionsLandmark,
          useGps: localUseGps,
          usePhysicalAddress: localUsePhysicalAddress,
          pinSource: source,
        });
        return;
      }

      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const detectedCity =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.hamlet ||
          addr.suburb ||
          '';
        const detectedProvince =
          addr.state ||
          addr.province ||
          addr.region ||
          addr.state_district ||
          '';
        const fullAddr =
          data.display_name?.split(',').slice(0, 3).join(', ') || '';

        // Safe preservation: Only pre-populate if user has not entered them yet
        const finalCity = city.trim() ? city : detectedCity;
        const finalProvince = province.trim() ? province : detectedProvince;
        const finalAddress = address.trim() ? address : fullAddr;

        onChange({
          coordinates: { lat, lng },
          city: finalCity,
          province: finalProvince,
          address: finalAddress,
          country: country || 'Mozambique',
          neighborhood,
          street,
          buildingNumber,
          buildingName,
          postalCode,
          directionsLandmark,
          useGps: localUseGps,
          usePhysicalAddress: localUsePhysicalAddress,
          pinSource: source,
        });
      } else {
        onChange({
          coordinates: { lat, lng },
          city,
          province,
          address,
          country,
          neighborhood,
          street,
          buildingNumber,
          buildingName,
          postalCode,
          directionsLandmark,
          useGps: localUseGps,
          usePhysicalAddress: localUsePhysicalAddress,
          pinSource: source,
        });
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      onChange({
        coordinates: { lat, lng },
        city,
        province,
        address,
        country,
        neighborhood,
        street,
        buildingNumber,
        buildingName,
        postalCode,
        directionsLandmark,
        useGps: localUseGps,
        usePhysicalAddress: localUsePhysicalAddress,
        pinSource: source,
      });
    }
  };

  // Initialize Map when GPS / Map Location is active
  useEffect(() => {
    if (!localUseGps) return;
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = coordinates.lat || -25.9692;
      const initialLng = coordinates.lng || 32.5732;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        icon: createCustomMarker(),
        draggable: true,
      }).addTo(map);

      // Handle marker drag
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        reverseGeocode(pos.lat, pos.lng, 'map_pin');
      });

      // Handle map click
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng, 'map_pin');
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [localUseGps]);

  // Update map view when coordinates change from outside
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - coordinates.lat) > 0.0001 ||
        Math.abs(currentPos.lng - coordinates.lng) > 0.0001
      ) {
        markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
        mapInstanceRef.current.setView([coordinates.lat, coordinates.lng], 13);
      }
    }
  }, [coordinates.lat, coordinates.lng]);

  // Execute actual GPS detection once permission is confirmed
  const executeGpsDetect = () => {
    setGeoError(null);
    setShowSettingsGuide(false);

    if (!navigator.geolocation) {
      setGeoError('GPS Geolocation is not supported by your browser or device. You can enter your physical address below.');
      setLocalUsePhysicalAddress(true);
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        permissionService.saveStatus('location', 'granted');
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));

        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 14);
        }

        reverseGeocode(lat, lng, 'gps');
      },
      (err) => {
        setIsDetectingGps(false);
        // Ensure physical address is available so user is never blocked
        setLocalUsePhysicalAddress(true);
        if (err.code === 1) {
          permissionService.saveStatus('location', 'denied');
          setGeoError('GPS permission was denied. You can enter your physical address below — GPS is not required to complete or publish your listing.');
        } else {
          setGeoError('Unable to retrieve your current location. You can enter your physical address below or position the map pin manually.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Solicited GPS Click
  const handleDetectGps = () => {
    const isGranted = permissionService.isGranted('location');
    const hasSolicited = permissionService.hasBeenSolicited('location');

    if (isGranted) {
      executeGpsDetect();
    } else if (!hasSolicited) {
      setShowPromptModal(true);
    } else {
      executeGpsDetect();
    }
  };

  // Search by text query
  const handleSearch = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGeoError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 13);
        }

        reverseGeocode(lat, lng, 'search');
      } else {
        setGeoError('Location not found in search. You can click directly on the map or enter your address details.');
      }
    } catch {
      setGeoError('Search request error. You can click directly on the map or enter your physical address.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleOption = (type: 'gps' | 'address') => {
    if (type === 'gps') {
      const nextGps = !localUseGps;
      // Do not allow unchecking both simultaneously
      if (!nextGps && !localUsePhysicalAddress) {
        setLocalUsePhysicalAddress(true);
      }
      setLocalUseGps(nextGps);
      onChange({
        coordinates,
        city,
        province,
        address,
        country,
        neighborhood,
        street,
        buildingNumber,
        buildingName,
        postalCode,
        directionsLandmark,
        useGps: nextGps,
        usePhysicalAddress: !nextGps ? true : localUsePhysicalAddress,
        pinSource,
      });
    } else {
      const nextAddr = !localUsePhysicalAddress;
      if (!nextAddr && !localUseGps) {
        setLocalUseGps(true);
      }
      setLocalUsePhysicalAddress(nextAddr);
      onChange({
        coordinates,
        city,
        province,
        address,
        country,
        neighborhood,
        street,
        buildingNumber,
        buildingName,
        postalCode,
        directionsLandmark,
        useGps: !nextAddr ? true : localUseGps,
        usePhysicalAddress: nextAddr,
        pinSource,
      });
    }
  };

  const locationGuides = PHONE_SETTINGS_GUIDES.location;
  const currentGuide = locationGuides.find((g) => g.os === guideOs) || locationGuides[0];

  const getSourceBadge = () => {
    switch (pinSource) {
      case 'gps':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e6f7f0] text-[#009A60] border border-[#a4e4c7]">
            <CheckCircle2 size={12} />
            GPS Sensor Detected
          </span>
        );
      case 'map_pin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <MapPin size={12} />
            Map Pin Selected
          </span>
        );
      case 'search':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Search size={12} />
            Searched Location
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
            <Compass size={12} />
            Default Coordinates
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Options: Use GPS / Map Location and/or Enter Physical Address */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          How would you like to set your property location?
        </label>
        <p className="text-xs text-gray-500">
          You can use a map pinpoint or GPS, enter a physical street address, or provide both for maximum accuracy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Option 1: GPS / Map */}
          <div
            onClick={() => handleToggleOption('gps')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              localUseGps
                ? 'border-[#009A60] bg-[#f0fbf6] shadow-2xs'
                : 'border-gray-200 bg-white hover:border-gray-300 opacity-80'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              localUseGps ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Navigation size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-900">Use GPS / Map Location</span>
                <input
                  type="checkbox"
                  checked={localUseGps}
                  onChange={() => {}} // handled by parent onClick
                  className="w-4 h-4 text-[#009A60] rounded focus:ring-[#009A60] cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Pinpoint your property with Leaflet map, mobile GPS, or place search.
              </p>
            </div>
          </div>

          {/* Option 2: Physical Address */}
          <div
            onClick={() => handleToggleOption('address')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
              localUsePhysicalAddress
                ? 'border-[#009A60] bg-[#f0fbf6] shadow-2xs'
                : 'border-gray-200 bg-white hover:border-gray-300 opacity-80'
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 ${
              localUsePhysicalAddress ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              <Building2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-900">Enter Physical Address</span>
                <input
                  type="checkbox"
                  checked={localUsePhysicalAddress}
                  onChange={() => {}} // handled by parent onClick
                  className="w-4 h-4 text-[#009A60] rounded focus:ring-[#009A60] cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Structured street address, neighborhood (bairro), house number, and directions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-off rationale modal for location */}
      {showPromptModal && (
        <PermissionPromptModal
          isOpen={showPromptModal}
          type="location"
          onClose={() => setShowPromptModal(false)}
          onGranted={(data) => {
            setShowPromptModal(false);
            const coords = data?.coords;
            if (coords) {
              if (mapInstanceRef.current && markerRef.current) {
                markerRef.current.setLatLng([coords.lat, coords.lng]);
                mapInstanceRef.current.setView([coords.lat, coords.lng], 14);
              }
              reverseGeocode(coords.lat, coords.lng, 'gps');
            } else {
              executeGpsDetect();
            }
          }}
          onDenied={(err) => {
            setShowPromptModal(false);
            setGeoError(err || 'GPS permission was denied. You can enter your physical address below — GPS is not required.');
            setLocalUsePhysicalAddress(true);
          }}
        />
      )}

      {/* Geo Error / Guidance Banner */}
      {geoError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <div className="font-semibold">{geoError}</div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowSettingsGuide(!showSettingsGuide)}
              className="inline-flex items-center gap-1.5 text-xs text-[#009A60] hover:text-[#007a4c] font-bold underline cursor-pointer"
            >
              <Smartphone size={14} />
              <span>{showSettingsGuide ? 'Hide Settings Guide' : 'How to enable location in Phone Settings'}</span>
            </button>

            {showSettingsGuide && (
              <div className="mt-2.5 p-3 bg-white rounded-lg border border-amber-200 text-gray-700">
                <div className="flex gap-1 border-b border-gray-200 pb-1.5 mb-2">
                  {(['iOS', 'Android', 'Desktop'] as const).map((os) => (
                    <button
                      key={os}
                      type="button"
                      onClick={() => setGuideOs(os)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        guideOs === os
                          ? 'bg-[#009A60] text-white'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {os === 'iOS' ? 'iPhone' : os}
                    </button>
                  ))}
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  {currentGuide.steps.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section A: GPS / Map Pinpoint */}
      {localUseGps && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Map Pin & GPS Coordinates
              </span>
              {getSourceBadge()}
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
            </span>
          </div>

          {/* Search & GPS Detect Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search city, neighborhood, or landmark (e.g. Maputo, Tofo Beach)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60] focus:border-[#009A60]"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleDetectGps}
              disabled={isDetectingGps}
              className="px-4 py-2.5 bg-[#e6f7f0] hover:bg-[#d5f3e5] text-[#009A60] border border-[#a4e4c7] rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              title="Detect your device GPS position"
            >
              {isDetectingGps ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Navigation size={16} />
              )}
              <span>Detect My Location</span>
            </button>
          </div>

          {/* Map Display */}
          <div className="relative border border-gray-300 rounded-xl overflow-hidden shadow-xs">
            <div
              ref={mapContainerRef}
              className="w-full h-72 md:h-80 z-0 bg-gray-100"
            />
            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 shadow-xs flex items-center gap-2">
              <MapPin size={14} className="text-[#009A60]" />
              <span>Drag the pin or click anywhere on the map to position your property</span>
            </div>
          </div>

          {/* Coordinates readout and manual adjustment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                Latitude (GPS)
              </label>
              <input
                type="number"
                step="any"
                value={coordinates.lat}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onChange({
                    coordinates: { lat: val, lng: coordinates.lng },
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource: 'map_pin',
                  });
                }}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-700 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                Longitude (GPS)
              </label>
              <input
                type="number"
                step="any"
                value={coordinates.lng}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onChange({
                    coordinates: { lat: coordinates.lat, lng: val },
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource: 'map_pin',
                  });
                }}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-700 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Section B: Physical Address Fields */}
      {localUsePhysicalAddress && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Physical Street Address Details
            </span>
            <span className="text-xs text-gray-500">
              * Country & City are required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Country (Default: Mozambique) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Country / País <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={country}
                placeholder="Mozambique"
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country: e.target.value,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Province / Region */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Province / Província <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="moz-provinces-list"
                  required
                  placeholder="Select or enter province"
                  value={province}
                  onChange={(e) =>
                    onChange({
                      coordinates,
                      city,
                      province: e.target.value,
                      address,
                      country,
                      neighborhood,
                      street,
                      buildingNumber,
                      buildingName,
                      postalCode,
                      directionsLandmark,
                      useGps: localUseGps,
                      usePhysicalAddress: localUsePhysicalAddress,
                      pinSource,
                    })
                  }
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
                <datalist id="moz-provinces-list">
                  {MOZAMBIQUE_PROVINCES.map((prov) => (
                    <option key={prov} value={prov} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* City / Municipality */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                City / Cidade / Município <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maputo, Inhambane, Vilankulo"
                value={city}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city: e.target.value,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Neighborhood / Bairro */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Area / Neighborhood (Bairro) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Polana Cimento, Sommerschield, Costa do Sol"
                value={neighborhood}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood: e.target.value,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Street / Road */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Street / Road (Rua / Avenida) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Av. Julius Nyerere, Rua de Bagamoyo"
                value={street}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street: e.target.value,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* House / Building Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                House / Building Number (Número) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 142, Lote 4, Bloco C"
                value={buildingNumber}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber: e.target.value,
                    buildingName,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Building / Property Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Building / Property Name (Nome do Edifício) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Edifício Platinum, Vila Paraíso"
                value={buildingName}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName: e.target.value,
                    postalCode,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Postal / ZIP Code */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Postal / ZIP Code (Código Postal) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1100"
                value={postalCode}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode: e.target.value,
                    directionsLandmark,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>

            {/* Nearby Landmark / Directions */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Nearby Landmark / Directions (Ponto de Referência / Instruções) <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Near Pastelaria Cristal, blue gate next to the mango tree, 200m from main road"
                value={directionsLandmark}
                onChange={(e) =>
                  onChange({
                    coordinates,
                    city,
                    province,
                    address,
                    country,
                    neighborhood,
                    street,
                    buildingNumber,
                    buildingName,
                    postalCode,
                    directionsLandmark: e.target.value,
                    useGps: localUseGps,
                    usePhysicalAddress: localUsePhysicalAddress,
                    pinSource,
                  })
                }
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
