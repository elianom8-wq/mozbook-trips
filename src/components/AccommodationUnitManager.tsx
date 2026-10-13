import React, { useState, useRef } from 'react';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Camera, 
  Upload, 
  Check, 
  DollarSign, 
  Users, 
  Bed, 
  Sparkles, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Percent,
  Calendar,
  Wifi,
  Waves,
  Wind,
  Tv,
  UtensilsCrossed,
  Sun,
  Trees,
  Coffee,
  Flame,
  ShieldCheck,
  Refrigerator,
  Fan,
  Bath,
  Layers
} from 'lucide-react';
import CameraCaptureModal from './CameraCaptureModal';
import { LodgeAccommodation, SpecialOffer } from '../services/listingService';
import { 
  LODGE_ACCOMMODATION_PRESETS, 
  LODGE_AMENITIES, 
  AccommodationTypePreset 
} from '../data/lodgeAccommodations';
import { UNIT_TYPES, UnitTypeId } from '../data/canonicalAccommodationTaxonomy';

export interface AccommodationUnitManagerProps {
  accommodations: LodgeAccommodation[];
  onChange: (accommodations: LodgeAccommodation[]) => void;
  currency?: string;
  lodgeSpecialOffer?: SpecialOffer | null;
  onSyncBasePrice?: (suggestedPrice: number) => void;
  propertyTypeTitle?: string;
}

export default function AccommodationUnitManager({
  accommodations,
  onChange,
  currency = 'MZN',
  lodgeSpecialOffer,
  onSyncBasePrice,
  propertyTypeTitle = 'Accommodation'
}: AccommodationUnitManagerProps) {
  // Modal / Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields for the current accommodation unit being created/edited
  const [canonicalUnitType, setCanonicalUnitType] = useState<UnitTypeId>('ROOM');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard_room');
  const [name, setName] = useState('Standard Room');
  const [customName, setCustomName] = useState('');
  const [units, setUnits] = useState<number>(4);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [maxGuests, setMaxGuests] = useState<number>(2);
  const [price, setPrice] = useState<number>(3000);
  const [description, setDescription] = useState('Comfortable ensuite room with king or twin beds, air conditioning, and garden surroundings.');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'private_bathroom',
    'ac',
    'wifi',
    'fan',
    'hot_water'
  ]);
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
  ]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [hasSpecialPriceOverride, setHasSpecialPriceOverride] = useState(false);
  const [specialPrice, setSpecialPrice] = useState<number>(2400);
  const [specialOfferName, setSpecialOfferName] = useState('Special Offer');
  const [specialDiscountPercent, setSpecialDiscountPercent] = useState<number>(20);

  // UI state for image camera / upload
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Icon Resolver for Unit Amenities
  const getAmenityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Bath': return Bath;
      case 'Wind': return Wind;
      case 'Fan': return Fan;
      case 'Wifi': return Wifi;
      case 'Tv': return Tv;
      case 'Refrigerator': return Refrigerator;
      case 'UtensilsCrossed': return UtensilsCrossed;
      case 'Sun': return Sun;
      case 'Waves': return Waves;
      case 'Trees': return Trees;
      case 'Coffee': return Coffee;
      case 'Flame': return Flame;
      case 'ShieldCheck': return ShieldCheck;
      default: return Check;
    }
  };

  // Open Editor for a brand new accommodation unit
  const handleOpenNew = () => {
    setEditingId(null);
    setSelectedPresetId('standard_room');
    setCanonicalUnitType('ROOM');
    const preset = LODGE_ACCOMMODATION_PRESETS[0];
    setName(preset.name);
    setCustomName('');
    setUnits(2);
    setAdults(preset.defaultAdults);
    setChildren(preset.defaultChildren);
    setMaxGuests(preset.defaultMaxGuests);
    setPrice(preset.suggestedPriceMzn);
    setDescription(preset.defaultDescription);
    setSelectedAmenities([...preset.defaultAmenities]);
    setPhotos([...preset.suggestedPhotos]);
    setPhotoUrlInput('');

    // Pre-configure special pricing if parent property has an active offer
    if (lodgeSpecialOffer && lodgeSpecialOffer.enabled) {
      setHasSpecialPriceOverride(true);
      const discount = lodgeSpecialOffer.discountPercent || 20;
      setSpecialDiscountPercent(discount);
      setSpecialPrice(Math.round(preset.suggestedPriceMzn * (1 - discount / 100)));
      setSpecialOfferName(lodgeSpecialOffer.offerName || 'Special Offer');
    } else {
      setHasSpecialPriceOverride(false);
      setSpecialDiscountPercent(20);
      setSpecialPrice(Math.round(preset.suggestedPriceMzn * 0.8));
      setSpecialOfferName('Special Offer');
    }

    setErrorMsg(null);
    setIsEditorOpen(true);
  };

  // Open Editor to edit existing accommodation unit
  const handleEdit = (acc: LodgeAccommodation) => {
    setEditingId(acc.id);
    setCanonicalUnitType(acc.canonicalUnitType || 'ROOM');
    const matchedPreset = LODGE_ACCOMMODATION_PRESETS.find(p => p.name.toLowerCase() === acc.name.toLowerCase());
    setSelectedPresetId(matchedPreset ? matchedPreset.id : 'other');
    setName(acc.name);
    setCustomName(matchedPreset ? '' : acc.name);
    setUnits(acc.units || 1);
    setAdults(acc.adults || 2);
    setChildren(acc.children || 0);
    setMaxGuests(acc.maxGuests || (acc.adults + acc.children) || 2);
    setPrice(acc.price || 3000);
    setDescription(acc.description || '');
    setSelectedAmenities(acc.amenities || []);
    setPhotos(acc.photos || []);
    setPhotoUrlInput('');

    if (acc.specialOffer && acc.specialOffer.enabled) {
      setHasSpecialPriceOverride(true);
      setSpecialPrice(acc.specialOffer.specialPrice);
      setSpecialOfferName(acc.specialOffer.offerName || 'Special Offer');
      setSpecialDiscountPercent(acc.specialOffer.discountPercent || Math.round(((acc.price - acc.specialOffer.specialPrice) / acc.price) * 100));
    } else if (lodgeSpecialOffer && lodgeSpecialOffer.enabled) {
      setHasSpecialPriceOverride(true);
      const discount = lodgeSpecialOffer.discountPercent || 20;
      setSpecialDiscountPercent(discount);
      setSpecialPrice(Math.round(acc.price * (1 - discount / 100)));
      setSpecialOfferName(lodgeSpecialOffer.offerName || 'Special Offer');
    } else {
      setHasSpecialPriceOverride(false);
      setSpecialPrice(Math.round(acc.price * 0.8));
      setSpecialDiscountPercent(20);
      setSpecialOfferName('Special Offer');
    }

    setErrorMsg(null);
    setIsEditorOpen(true);
  };

  // Preset Selection Handler
  const handleSelectPreset = (preset: AccommodationTypePreset) => {
    setSelectedPresetId(preset.id);
    if (preset.id === 'other') {
      setName(customName.trim() || 'Custom Unit');
    } else {
      setName(preset.name);
      setCustomName('');
    }
    // Auto-align canonical unit type with category if possible
    if (preset.category === 'chalet') setCanonicalUnitType('CHALET');
    else if (preset.category === 'suite') setCanonicalUnitType('SUITE');
    else if (preset.category === 'room') setCanonicalUnitType('ROOM');

    setAdults(preset.defaultAdults);
    setChildren(preset.defaultChildren);
    setMaxGuests(preset.defaultMaxGuests);
    setPrice(preset.suggestedPriceMzn);
    setDescription(preset.defaultDescription);
    setSelectedAmenities([...preset.defaultAmenities]);
    if (photos.length === 0) {
      setPhotos([...preset.suggestedPhotos]);
    }
    if (hasSpecialPriceOverride) {
      setSpecialPrice(Math.round(preset.suggestedPriceMzn * (1 - specialDiscountPercent / 100)));
    }
  };

  // Amenities toggle
  const handleToggleAmenity = (amenityId: string) => {
    if (selectedAmenities.includes(amenityId)) {
      setSelectedAmenities(selectedAmenities.filter(id => id !== amenityId));
    } else {
      setSelectedAmenities([...selectedAmenities, amenityId]);
    }
  };

  // Photo handlers
  const handleAddPhotoUrl = () => {
    if (!photoUrlInput.trim()) return;
    setPhotos([...photos, photoUrlInput.trim()]);
    setPhotoUrlInput('');
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleCameraCapture = (dataUrl: string) => {
    setPhotos(prev => [...prev, dataUrl]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Save Accommodation Unit
  const handleSaveAccommodation = (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = selectedPresetId === 'other' ? customName.trim() : name;
    if (!finalName) {
      setErrorMsg('Please enter or select a name for this accommodation unit.');
      return;
    }

    if (units < 1) {
      setErrorMsg('Number of units must be at least 1.');
      return;
    }

    if (price <= 0) {
      setErrorMsg('Nightly price must be greater than zero.');
      return;
    }

    if (photos.length === 0) {
      setErrorMsg('Please add at least one photo for this accommodation unit.');
      return;
    }

    const calculatedMaxGuests = Number(maxGuests) || (Number(adults) + Number(children)) || 1;

    let accommodationSpecialOffer: SpecialOffer | null = null;
    if (hasSpecialPriceOverride && specialPrice > 0 && specialPrice < price) {
      const today = new Date();
      const in90Days = new Date();
      in90Days.setDate(in90Days.getDate() + 90);

      accommodationSpecialOffer = {
        enabled: true,
        offerName: specialOfferName.trim() || 'Unit Special',
        discountPercent: Number(specialDiscountPercent) || Math.round(((price - specialPrice) / price) * 100),
        specialPrice: Number(specialPrice),
        originalPrice: Number(price),
        startDate: today.toISOString().split('T')[0],
        endDate: in90Days.toISOString().split('T')[0],
        offerType: 'percentage'
      };
    }

    const accommodationData: LodgeAccommodation = {
      id: editingId || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: finalName,
      customName: selectedPresetId === 'other' ? customName.trim() : undefined,
      canonicalUnitType,
      units: Number(units),
      adults: Number(adults),
      children: Number(children),
      maxGuests: Number(calculatedMaxGuests),
      price: Number(price),
      currency: currency,
      description: description.trim(),
      amenities: selectedAmenities,
      photos: photos,
      active: true,
      specialOffer: accommodationSpecialOffer,
      createdAt: new Date().toISOString(),
    };

    let updatedList: LodgeAccommodation[];
    if (editingId) {
      updatedList = accommodations.map(item => item.id === editingId ? accommodationData : item);
    } else {
      updatedList = [...accommodations, accommodationData];
    }

    onChange(updatedList);
    setIsEditorOpen(false);
    setEditingId(null);

    // If host wants to align property base price to lowest unit price
    if (onSyncBasePrice && updatedList.length > 0) {
      const minPrice = Math.min(...updatedList.map(a => a.price));
      if (minPrice > 0) {
        onSyncBasePrice(minPrice);
      }
    }
  };

  const handleDelete = (idToDelete: string) => {
    const updated = accommodations.filter(a => a.id !== idToDelete);
    onChange(updated);
    if (onSyncBasePrice && updated.length > 0) {
      const minPrice = Math.min(...updated.map(a => a.price));
      if (minPrice > 0) {
        onSyncBasePrice(minPrice);
      }
    }
  };

  // Summary calculations
  const totalUnits = accommodations.reduce((sum, item) => sum + (Number(item.units) || 0), 0);
  const minPrice = accommodations.length > 0 ? Math.min(...accommodations.map(a => a.price)) : 0;
  const maxPrice = accommodations.length > 0 ? Math.max(...accommodations.map(a => a.price)) : 0;

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
              {propertyTypeTitle} Units
            </span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-bold">
              Multi-Unit Configuration
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            Accommodation Units & Room Types
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure the individual rooms, chalets, suites, villas, tents or pitches available at this property.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus size={17} />
          <span>{accommodations.length > 0 ? 'Add another unit type' : 'Add accommodation unit'}</span>
        </button>
      </div>

      {/* Host Summary */}
      {accommodations.length > 0 ? (
        <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Unit Inventory Overview
              </span>
              <h3 className="text-lg font-bold text-gray-900">
                Configured Inventory ({accommodations.length} {accommodations.length === 1 ? 'type' : 'types'})
              </h3>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl shadow-2xs">
              <Layers size={16} className="text-[#009A60]" />
              <span className="text-sm font-black text-gray-900">
                {totalUnits} {totalUnits === 1 ? 'total unit' : 'total units'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
              <span className="text-gray-500 block">Unit Types</span>
              <span className="text-base font-black text-gray-900 mt-0.5 block">
                {accommodations.length}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
              <span className="text-gray-500 block">Total Units Available</span>
              <span className="text-base font-black text-[#009A60] mt-0.5 block">
                {totalUnits}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
              <span className="text-gray-500 block">Starting Nightly Rate</span>
              <span className="text-base font-black text-gray-900 mt-0.5 block">
                {currency} {minPrice.toLocaleString()}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
              <span className="text-gray-500 block">Top Unit Rate</span>
              <span className="text-base font-black text-gray-900 mt-0.5 block">
                {currency} {maxPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-3 bg-gray-50/50">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#009A60] mx-auto flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">No accommodation units configured yet</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Add your rooms, suites, chalets, villas, or camping pitches so guests can view the different options available.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Add First Unit</span>
          </button>
        </div>
      )}

      {/* Accommodation Cards Detail Grid */}
      {accommodations.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">
              Configured Accommodation Units ({accommodations.length})
            </h3>
            <button
              type="button"
              onClick={handleOpenNew}
              className="text-xs font-semibold text-[#009A60] hover:text-[#008250] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus size={14} /> Add another unit type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accommodations.map((acc) => {
              const effectivePrice = acc.specialOffer && acc.specialOffer.enabled
                ? acc.specialOffer.specialPrice
                : acc.price;
              const hasDiscount = effectivePrice < acc.price;
              const canonicalMatch = UNIT_TYPES.find(u => u.backend_id === acc.canonicalUnitType);

              return (
                <div
                  key={acc.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Photos Preview Header */}
                    <div className="relative aspect-16/9 bg-gray-100 overflow-hidden group">
                      {acc.photos && acc.photos.length > 0 ? (
                        <img
                          src={acc.photos[0]}
                          alt={acc.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                          <Bed size={28} />
                          <span className="text-xs">No photos uploaded</span>
                        </div>
                      )}

                      {/* Units Badge */}
                      <span className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                        {acc.units} {acc.units === 1 ? 'unit' : 'units'}
                      </span>

                      {/* Canonical Badge */}
                      {canonicalMatch && (
                        <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs border border-emerald-200">
                          {canonicalMatch.display_name}
                        </span>
                      )}

                      {/* Special Offer Badge */}
                      {hasDiscount && (
                        <span className="absolute top-3 right-3 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <Tag size={11} />
                          <span>{acc.specialOffer?.offerName || 'Special'}</span>
                          {acc.specialOffer?.discountPercent && <span>({acc.specialOffer.discountPercent}% OFF)</span>}
                        </span>
                      )}

                      {/* Photo counter */}
                      {acc.photos && acc.photos.length > 1 && (
                        <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                          +{acc.photos.length - 1} more photos
                        </span>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-bold text-gray-900">
                            {acc.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Users size={13} className="text-gray-400" />
                              <span>{acc.maxGuests} max guests</span>
                            </span>
                            <span>•</span>
                            <span>{acc.adults} adults{acc.children > 0 ? `, ${acc.children} children` : ''}</span>
                          </div>
                        </div>

                        {/* Price Display */}
                        <div className="text-right">
                          {hasDiscount ? (
                            <div>
                              <span className="text-xs text-gray-400 line-through block">
                                {currency} {acc.price.toLocaleString()}
                              </span>
                              <div className="text-base font-black text-[#009A60]">
                                {currency} {effectivePrice.toLocaleString()}
                                <span className="text-[10px] font-normal text-gray-500"> / night</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-base font-black text-gray-900">
                              {currency} {acc.price.toLocaleString()}
                              <span className="text-[10px] font-normal text-gray-500"> / night</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {acc.description && (
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {acc.description}
                        </p>
                      )}

                      {/* Amenities Pills */}
                      {acc.amenities && acc.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {acc.amenities.slice(0, 4).map((amenityId) => {
                            const def = LODGE_AMENITIES.find(a => a.id === amenityId);
                            return (
                              <span
                                key={amenityId}
                                className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[11px] font-medium"
                              >
                                {def ? def.label : amenityId}
                              </span>
                            );
                          })}
                          {acc.amenities.length > 4 && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[11px] font-medium">
                              +{acc.amenities.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-4 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">
                      {acc.units} {acc.units === 1 ? 'unit available' : 'units available'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(acc)}
                        className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(acc.id)}
                        className="p-1 text-xs text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete unit"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit Accommodation Unit' : 'Add New Accommodation Unit'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Set unit type, capacity, nightly rates, photos, and amenities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Unit Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                  Unit Type *
                </label>
                <select
                  value={canonicalUnitType}
                  onChange={(e) => setCanonicalUnitType(e.target.value as UnitTypeId)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#009A60]"
                >
                  {UNIT_TYPES.map(u => (
                    <option key={u.backend_id} value={u.backend_id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Preset or Custom Template */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                  2. Unit Preset or Custom Name *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {LODGE_ACCOMMODATION_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'border-[#009A60] bg-[#e6f7f0]/50 ring-2 ring-[#009A60]/20 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-[#009A60]' : 'text-gray-900'}`}>
                            {preset.name}
                          </span>
                          {isSelected && <Check size={14} className="text-[#009A60]" />}
                        </div>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          ~ {currency} {preset.suggestedPriceMzn.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {(selectedPresetId === 'other' || customName) && (
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Custom Unit Name *
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => {
                        setCustomName(e.target.value);
                        setName(e.target.value);
                      }}
                      placeholder="e.g., Luxury Ocean Safari Suite, Treehouse #3..."
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>
                )}
              </div>

              {/* 3. Number of Units & Guest Capacities */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                  3. Quantity & Guest Capacities *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="block text-xs text-gray-600 font-semibold mb-1">Number of Units</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={units}
                      onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-600 font-semibold mb-1">Adults Capacity</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-600 font-semibold mb-1">Children</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={children}
                      onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900"
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-600 font-semibold mb-1">Total Max Guests</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={maxGuests}
                      onChange={(e) => setMaxGuests(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Pricing & Special Offers */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                  4. Nightly Rate ({currency}) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs text-gray-600 font-semibold mb-1">Standard Rate per Night</span>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">
                        {currency}
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={price}
                        onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full pl-14 pr-3 py-2 border border-gray-300 rounded-xl text-sm font-black text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={hasSpecialPriceOverride}
                        onChange={(e) => setHasSpecialPriceOverride(e.target.checked)}
                        className="rounded text-[#009A60] focus:ring-[#009A60] w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-gray-800">
                        Enable Special Promotional Price
                      </span>
                    </label>
                  </div>
                </div>

                {hasSpecialPriceOverride && (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs text-emerald-900 font-semibold mb-1">Special Discounted Rate</span>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-700">{currency}</span>
                          <input
                            type="number"
                            min="1"
                            value={specialPrice}
                            onChange={(e) => {
                              const sp = parseInt(e.target.value) || 0;
                              setSpecialPrice(sp);
                              if (price > 0 && sp > 0) {
                                setSpecialDiscountPercent(Math.round(((price - sp) / price) * 100));
                              }
                            }}
                            className="w-full pl-14 pr-3 py-2 border border-emerald-300 rounded-xl text-sm font-black text-emerald-900 bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs text-emerald-900 font-semibold mb-1">Offer Tag / Name</span>
                        <input
                          type="text"
                          value={specialOfferName}
                          onChange={(e) => setSpecialOfferName(e.target.value)}
                          placeholder="e.g. Low Season Special"
                          className="w-full px-3 py-2 border border-emerald-300 rounded-xl text-xs font-semibold text-gray-900 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                  5. Unit Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe room layout, bed types, view, and specific unit features..."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#009A60]"
                />
              </div>

              {/* 6. Unit Amenities */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                    6. Unit Amenities & Features
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {selectedAmenities.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LODGE_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity.id);
                    const Icon = getAmenityIcon(amenity.iconName);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => handleToggleAmenity(amenity.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-[#e6f7f0] border-[#009A60] text-[#008250] font-bold shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon size={14} className="shrink-0" />
                          <span className="truncate">{amenity.label}</span>
                        </div>
                        {isSelected && <Check size={13} className="shrink-0 text-[#009A60]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. Photos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-gray-700 tracking-wider">
                    7. Unit Photos * ({photos.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraModalOpen(true)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#009A60] hover:bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Camera size={13} /> Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Upload size={13} /> Upload
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                {/* Add Photo URL Input */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    placeholder="Paste image web link (https://...)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhotoUrl}
                    disabled={!photoUrlInput.trim()}
                    className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-40"
                  >
                    Add URL
                  </button>
                </div>

                {/* Photos Thumbnail Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {photos.map((url, i) => (
                    <div key={i} className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 group bg-gray-100">
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAccommodation}
                className="px-6 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {editingId ? 'Save Changes' : 'Add Unit Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {cameraModalOpen && (
        <CameraCaptureModal
          isOpen={cameraModalOpen}
          onClose={() => setCameraModalOpen(false)}
          onCapture={handleCameraCapture}
          title="Photograph Accommodation Unit"
        />
      )}
    </div>
  );
}
