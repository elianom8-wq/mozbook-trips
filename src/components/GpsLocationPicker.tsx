import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Search, Check, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { permissionService, PHONE_SETTINGS_GUIDES } from '../services/permissionService';
import PermissionPromptModal from './PermissionPromptModal';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationDetails {
  city: string;
  province: string;
  country: string;
  address: string;
}

interface GpsLocationPickerProps {
  coordinates: Coordinates;
  city: string;
  province: string;
  address: string;
  onChange: (data: {
    coordinates: Coordinates;
    city: string;
    province: string;
    address: string;
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

  // Reverse geocode latitude and longitude to get city, province, address
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (!res.ok) return;
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

        onChange({
          coordinates: { lat, lng },
          city: detectedCity || city,
          province: detectedProvince || province,
          address: fullAddr || address,
        });
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  };

  // Initialize Map
  useEffect(() => {
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
        reverseGeocode(pos.lat, pos.lng);
      });

      // Handle map click
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

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
      setGeoError('GPS Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        // Save granted state so we never prompt rationale again
        permissionService.saveStatus('location', 'granted');
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));

        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.setView([lat, lng], 14);
        }

        reverseGeocode(lat, lng);
      },
      (err) => {
        setIsDetectingGps(false);
        if (err.code === 1) {
          permissionService.saveStatus('location', 'denied');
          setGeoError('Permission to access GPS was denied. You can enable it in your phone settings or search manually.');
        } else {
          setGeoError('Unable to retrieve your current location. Please search by city/address.');
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
      // Permission already granted: detect immediately without bothering the user!
      executeGpsDetect();
    } else if (!hasSolicited) {
      // First-time solicitation: show one-off native-like rationale modal
      setShowPromptModal(true);
    } else {
      // Previously solicited, attempt direct detection
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

        reverseGeocode(lat, lng);
      } else {
        setGeoError('Location not found. Try entering a city or landmark.');
      }
    } catch {
      setGeoError('Search error. You can click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  const locationGuides = PHONE_SETTINGS_GUIDES.location;
  const currentGuide = locationGuides.find((g) => g.os === guideOs) || locationGuides[0];

  return (
    <div className="space-y-4">
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
              reverseGeocode(coords.lat, coords.lng);
            } else {
              executeGpsDetect();
            }
          }}
          onDenied={(err) => {
            setShowPromptModal(false);
            setGeoError(err || 'Location access was denied. You can allow it in your phone settings or search by city.');
          }}
        />
      )}

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
              placeholder="Search by city, address, or landmark..."
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
          <span>Detect GPS Pin</span>
        </button>
      </div>

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

      {/* Map Display */}
      <div className="relative border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        <div
          ref={mapContainerRef}
          className="w-full h-72 md:h-80 z-0 bg-gray-100"
        />
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 shadow-sm flex items-center gap-2">
          <MapPin size={14} className="text-[#009A60]" />
          <span>Click anywhere or drag the pin to adjust your residence GPS spot</span>
        </div>
      </div>

      {/* Structured City / Province / Lat / Lng inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            City
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Maputo, Inhambane, Ponta do Ouro"
            value={city}
            onChange={(e) =>
              onChange({
                coordinates,
                city: e.target.value,
                province,
                address,
              })
            }
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            Province / State
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Maputo Cidade, Inhambane, Cabo Delgado"
            value={province}
            onChange={(e) =>
              onChange({
                coordinates,
                city,
                province: e.target.value,
                address,
              })
            }
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            GPS Latitude
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
              });
            }}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-700 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
            GPS Longitude
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
              });
            }}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-700 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
