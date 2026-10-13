import React, { useEffect, useState } from 'react';
import { 
  Utensils, 
  Compass, 
  Trees, 
  Landmark, 
  ShoppingBag, 
  Plus, 
  Check, 
  Trash2, 
  Sparkles, 
  MapPin, 
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { NearbyPlace, getSuggestedNearbyPlaces, addCommunityPlace } from '../services/listingService';

interface NearbyPlacesManagerProps {
  city: string;
  province: string;
  coordinates?: { lat: number; lng: number };
  nearbyPlaces: NearbyPlace[];
  onChange: (places: NearbyPlace[]) => void;
}

const CATEGORY_CONFIG: Record<
  string, 
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; bg: string; text: string }
> = {
  restaurant: { label: 'Restaurant / Dining', icon: Utensils, bg: 'bg-orange-50', text: 'text-orange-600' },
  activity: { label: 'Activity / Adventure', icon: Compass, bg: 'bg-sky-50', text: 'text-sky-600' },
  nature: { label: 'Nature / Scenic Spot', icon: Trees, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  culture: { label: 'Culture / Landmark', icon: Landmark, bg: 'bg-purple-50', text: 'text-purple-600' },
  shopping: { label: 'Shopping / Market', icon: ShoppingBag, bg: 'bg-pink-50', text: 'text-pink-600' },
};

export default function NearbyPlacesManager({
  city,
  province,
  coordinates,
  nearbyPlaces,
  onChange,
}: NearbyPlacesManagerProps) {
  const [suggestions, setSuggestions] = useState<NearbyPlace[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  // Custom Place Input form state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<string>('restaurant');
  const [customDistance, setCustomDistance] = useState('5 min walk');
  const [customDescription, setCustomDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch suggestions when city, province, or coordinates change
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSuggestions(true);

    getSuggestedNearbyPlaces(city, province, coordinates).then((res) => {
      if (isMounted) {
        setSuggestions(res);
        setIsLoadingSuggestions(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [city, province, coordinates?.lat, coordinates?.lng]);

  const isAlreadyAdded = (name: string) => {
    return nearbyPlaces.some(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
  };

  const handleAddSuggestion = (place: NearbyPlace) => {
    if (isAlreadyAdded(place.name)) return;
    const newPlace = { ...place, id: `np-${Date.now()}-${Math.random()}` };
    onChange([...nearbyPlaces, newPlace]);
    setConfirmedId(place.name);
    setTimeout(() => setConfirmedId(null), 2500);
  };

  const handleRemovePlace = (indexToRemove: number) => {
    onChange(nearbyPlaces.filter((_, idx) => idx !== indexToRemove));
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newPlace: NearbyPlace = {
      id: `np-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      distance: customDistance.trim() || 'Nearby',
      description: customDescription.trim() || undefined,
      addedByHost: true,
    };

    // 1. Add to listing's selected places
    onChange([...nearbyPlaces, newPlace]);

    // 2. Immediately prepend to community suggestions so it appears for this location
    setSuggestions((prev) => {
      if (prev.some((p) => p.name.toLowerCase() === newPlace.name.toLowerCase())) {
        return prev;
      }
      return [newPlace, ...prev];
    });

    // 3. Persist to Firestore community_places collection
    addCommunityPlace({
      name: newPlace.name,
      category: newPlace.category,
      city: city || 'Local Area',
      province: province || '',
      distance: newPlace.distance,
      description: newPlace.description,
    });

    setCustomName('');
    setCustomDescription('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#e6f7f0] border border-[#a4e4c7] rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#009A60] text-white rounded-lg mt-0.5">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm md:text-base">
              What's nearby? Restaurants, activities, scenic spots & more
            </h4>
            <p className="text-gray-600 text-xs md:text-sm mt-0.5">
              Adding nearby hotspots gives travelers rich context on why your neighborhood is extraordinary. If fellow MozBook hosts have already added nearby attractions in <span className="font-semibold text-gray-900">{city || 'this region'}</span>, we suggest them below so you can simply click to confirm!
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Spots from fellow hosts or community */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
              Community Suggestions for {city || 'Your Area'}
            </h4>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              Click to confirm
            </span>
          </div>
        </div>

        {isLoadingSuggestions ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((suggestion, idx) => {
              const added = isAlreadyAdded(suggestion.name);
              const conf = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.activity;
              const Icon = conf.icon;

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    added
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-white border-gray-200 hover:border-[#009A60]/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${conf.bg} ${conf.text}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {suggestion.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-600">{conf.label.split(' / ')[0]}</span>
                        {suggestion.distance && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Navigation size={10} />
                              {suggestion.distance}
                            </span>
                          </>
                        )}
                      </div>
                      {suggestion.description && (
                        <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                          {suggestion.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSuggestion(suggestion)}
                    disabled={added}
                    className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      confirmedId === suggestion.name
                        ? 'bg-[#009A60] text-white shadow-sm ring-2 ring-[#a4e4c7]'
                        : added
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : 'bg-gray-900 hover:bg-[#009A60] text-white shadow-sm'
                    }`}
                  >
                    {confirmedId === suggestion.name ? (
                      <>
                        <CheckCircle2 size={14} /> Confirmed!
                      </>
                    ) : added ? (
                      <>
                        <Check size={14} /> Confirmed
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Confirm
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Nearby Places on this listing */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
            Added to Your Listing ({nearbyPlaces.length})
          </h4>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-semibold text-[#009A60] hover:text-[#008250] flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus size={14} /> Add custom spot
          </button>
        </div>

        {/* Add Custom Spot Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateCustom}
            className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Place / Activity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mama Mia Italian Bistro"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Category
                </label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                >
                  <option value="restaurant">Restaurant / Dining</option>
                  <option value="activity">Activity / Outdoor Adventure</option>
                  <option value="nature">Nature / Beach / Park</option>
                  <option value="culture">Culture / Museum / Historic</option>
                  <option value="shopping">Shopping / Local Market</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Distance / Travel Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5 min walk, 1.5 km, 10 min drive"
                  value={customDistance}
                  onChange={(e) => setCustomDistance(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Short Note or Recommendation (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Best wood-fired pizza in the area"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#009A60] text-white rounded-lg text-xs font-semibold hover:bg-[#008250] transition-colors cursor-pointer"
              >
                Save Spot
              </button>
            </div>
          </form>
        )}

        {nearbyPlaces.length === 0 ? (
          <div className="p-6 border border-dashed border-gray-300 rounded-xl text-center text-gray-500 text-sm">
            No nearby attractions selected yet. Click any of the community suggestions above or add your own favorite local spot!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {nearbyPlaces.map((place, idx) => {
              const conf = CATEGORY_CONFIG[place.category] || CATEGORY_CONFIG.activity;
              const Icon = conf.icon;

              return (
                <div
                  key={idx}
                  className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${conf.bg} ${conf.text}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {place.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {conf.label.split(' / ')[0]} • {place.distance || 'Nearby'}
                        {place.description ? ` • ${place.description}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePlace(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-gray-50 cursor-pointer"
                    title="Remove spot"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
