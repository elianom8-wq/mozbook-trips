import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tag, 
  Percent, 
  DollarSign, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Eye, 
  Palmtree,
  Info,
  CalendarCheck
} from 'lucide-react';
import { 
  SpecialOffer, 
  OfferType, 
  getOfferStatus, 
  formatOfferDateRange 
} from '../services/listingService';

interface SpecialOffersSectionProps {
  basePrice: number;
  offer: SpecialOffer | null | undefined;
  currency?: string; // Default 'MZN'
  onChange: (offer: SpecialOffer | null) => void;
  onDeleteOffer?: () => void;
  isEditing?: boolean;
  stepBadge?: string;
}

const SEASONAL_PRESETS = [
  'Summer',
  'Christmas',
  'Easter',
  'Easter Holidays',
  'New Year',
  'Holiday Season',
  'Low Season',
  'High Season',
  'Other'
];

const OFFER_NAME_PRESETS = [
  'Summer Special',
  'Weekend Special',
  'Family Special',
  'Christmas Special',
  'Easter Special',
  'Low Season Special',
  'Flash Deal'
];

export default function SpecialOffersSection({
  basePrice,
  offer,
  currency = 'MZN',
  onChange,
  onDeleteOffer,
  isEditing = false,
  stepBadge
}: SpecialOffersSectionProps) {
  // 1. Toggle: Yes / No (Default: No)
  const [hasOffer, setHasOffer] = useState<boolean>(() => {
    return offer ? !!offer.enabled : false;
  });

  // 2. Offer Type
  const [offerType, setOfferType] = useState<OfferType>(() => {
    return offer?.offerType || 'percentage';
  });

  // 3 & 4 & 5. Pricing fields
  const [originalPrice, setOriginalPrice] = useState<number>(() => {
    return offer?.originalPrice || basePrice || 2000;
  });

  const [discountPercent, setDiscountPercent] = useState<number>(() => {
    return offer?.discountPercent || 20;
  });

  const [discountAmount, setDiscountAmount] = useState<number>(() => {
    return offer?.discountAmount || 400;
  });

  const [customSpecialPrice, setCustomSpecialPrice] = useState<number>(() => {
    return offer?.specialPrice || 1500;
  });

  // 6. Optional Offer Name
  const [offerName, setOfferName] = useState<string>(() => {
    return offer?.offerName || '';
  });

  // 7. Offer Validity Dates
  const [startDate, setStartDate] = useState<string>(() => {
    if (offer?.startDate) return offer.startDate;
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (offer?.endDate) return offer.endDate;
    const future = new Date();
    future.setDate(future.getDate() + 30);
    return future.toISOString().split('T')[0];
  });

  // 8. Optional Seasonal Offer
  const [isSeasonal, setIsSeasonal] = useState<boolean>(() => {
    return offer?.isSeasonal || false;
  });

  const [seasonalTag, setSeasonalTag] = useState<string>(() => {
    return offer?.seasonalTag || 'Summer';
  });

  const [customSeasonName, setCustomSeasonName] = useState<string>(() => {
    return offer?.customSeasonName || '';
  });

  // 8b. Annual Seasonal Review & Recurrence
  const [annualRecurrenceEnabled, setAnnualRecurrenceEnabled] = useState<boolean>(() => {
    return offer?.annualRecurrenceEnabled || false;
  });

  // Sync originalPrice when basePrice changes if not previously detached
  useEffect(() => {
    if (!offer?.originalPrice && basePrice > 0 && originalPrice !== basePrice) {
      setOriginalPrice(basePrice);
    }
  }, [basePrice]);

  // Compute Special Price based on selected offer type
  const calculatedSpecialPrice = useMemo(() => {
    if (offerType === 'percentage') {
      const pct = Math.max(1, Math.min(99, discountPercent));
      return Math.max(1, Math.round(originalPrice * (1 - pct / 100)));
    }
    if (offerType === 'fixed') {
      const amt = Math.max(0, discountAmount);
      return Math.max(1, originalPrice - amt);
    }
    // Special / Seasonal Price direct input
    return Math.max(1, customSpecialPrice);
  }, [offerType, originalPrice, discountPercent, discountAmount, customSpecialPrice]);

  // Compute equivalent discount percentage for customer preview
  const calculatedDiscountPercent = useMemo(() => {
    if (originalPrice <= 0 || calculatedSpecialPrice >= originalPrice) return 0;
    return Math.max(1, Math.round(((originalPrice - calculatedSpecialPrice) / originalPrice) * 100));
  }, [originalPrice, calculatedSpecialPrice]);

  // Determine current offer status: Scheduled / Active / Expired
  const offerStatus = useMemo(() => {
    return getOfferStatus(startDate, endDate);
  }, [startDate, endDate]);

  // Emit updated offer object to parent
  useEffect(() => {
    if (!hasOffer) {
      onChange(null);
      return;
    }

    const payload: SpecialOffer = {
      enabled: true,
      offerType,
      originalPrice,
      specialPrice: calculatedSpecialPrice,
      discountPercent: offerType === 'percentage' ? discountPercent : calculatedDiscountPercent,
      discountAmount: offerType === 'fixed' ? discountAmount : (originalPrice - calculatedSpecialPrice),
      startDate,
      endDate,
      isSeasonal: Boolean(isSeasonal),
    };

    if (offerName && offerName.trim()) {
      payload.offerName = offerName.trim();
    }
    if (isSeasonal && seasonalTag) {
      payload.seasonalTag = seasonalTag;
    }
    if (isSeasonal && seasonalTag === 'Other' && customSeasonName && customSeasonName.trim()) {
      payload.customSeasonName = customSeasonName.trim();
    }
    if (isSeasonal && annualRecurrenceEnabled) {
      payload.annualRecurrenceEnabled = true;
      if (offer?.recurrenceStatus) {
        payload.recurrenceStatus = offer.recurrenceStatus;
      }
      if (offer?.targetYear) {
        payload.targetYear = offer.targetYear;
      }
      if (offer?.lastReviewPromptDate) {
        payload.lastReviewPromptDate = offer.lastReviewPromptDate;
      }
      if (offer?.lastConfirmedAt) {
        payload.lastConfirmedAt = offer.lastConfirmedAt;
      }
      if (offer?.declinedYears && offer.declinedYears.length > 0) {
        payload.declinedYears = offer.declinedYears;
      }
    } else {
      payload.annualRecurrenceEnabled = false;
      payload.recurrenceStatus = 'none';
    }

    onChange(payload);
  }, [
    hasOffer,
    offerType,
    originalPrice,
    calculatedSpecialPrice,
    discountPercent,
    discountAmount,
    calculatedDiscountPercent,
    offerName,
    startDate,
    endDate,
    isSeasonal,
    seasonalTag,
    customSeasonName,
    annualRecurrenceEnabled
  ]);

  const handleTurnOffOffer = () => {
    setHasOffer(false);
  };

  const handleDeleteOffer = () => {
    setHasOffer(false);
    if (onDeleteOffer) {
      onDeleteOffer();
    }
  };

  const isFixedAmountValid = discountAmount < originalPrice && discountAmount > 0;
  const isSeasonalPriceValid = customSpecialPrice < originalPrice && customSpecialPrice > 0;

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-[#009A60] uppercase">
              {stepBadge || 'Special Offers & Pricing'}
            </span>
            {hasOffer && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                offerStatus === 'active' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : offerStatus === 'scheduled'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {offerStatus === 'active' ? '● Active Offer' : offerStatus === 'scheduled' ? '⏱ Scheduled' : '✕ Expired'}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-1">
            Special Offers & Seasonal Pricing
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Set promotional discounts, flash deals, or seasonal rates to boost bookings during holiday periods.
          </p>
        </div>

        {hasOffer && isEditing && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleTurnOffOffer}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
            >
              Turn Off Offer
            </button>
            <button
              type="button"
              onClick={handleDeleteOffer}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Trash2 size={13} />
              <span>Delete Offer</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. SPECIAL OFFER TOGGLE */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
        <label className="block text-sm font-bold text-gray-900">
          Does this listing have a special offer or promotional price?
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHasOffer(true)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              hasOffer
                ? 'bg-[#009A60] text-white shadow-sm ring-2 ring-[#009A60]/20'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            <CheckCircle2 size={16} className={hasOffer ? 'text-white' : 'text-gray-400'} />
            <span>Yes</span>
          </button>

          <button
            type="button"
            onClick={() => setHasOffer(false)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              !hasOffer
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            <span>No</span>
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {hasOffer
            ? 'Special promotional pricing is enabled. Configure your offer details below.'
            : 'Standard nightly rate applies without promotional discounts.'}
        </p>
      </div>

      {/* ADDITIONAL OFFER FIELDS — Displayed only when hasOffer is Yes */}
      {hasOffer && (
        <div className="space-y-6 pt-2 animate-fadeIn">
          {/* 2. OFFER TYPE SELECTOR */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Offer Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Percentage Discount */}
              <button
                type="button"
                onClick={() => setOfferType('percentage')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  offerType === 'percentage'
                    ? 'border-[#009A60] bg-[#e6f7f0]/40 ring-2 ring-[#009A60]/20 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg ${offerType === 'percentage' ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <Percent size={16} />
                  </div>
                  <span className="font-bold text-sm text-gray-900">Percentage Discount (%)</span>
                </div>
                <p className="text-xs text-gray-500">
                  Deduct a percentage from regular price (e.g. 20% OFF).
                </p>
              </button>

              {/* Option 2: Fixed Amount Discount */}
              <button
                type="button"
                onClick={() => setOfferType('fixed')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  offerType === 'fixed'
                    ? 'border-[#009A60] bg-[#e6f7f0]/40 ring-2 ring-[#009A60]/20 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg ${offerType === 'fixed' ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <Tag size={16} />
                  </div>
                  <span className="font-bold text-sm text-gray-900">Fixed Amount ({currency})</span>
                </div>
                <p className="text-xs text-gray-500">
                  Deduct a fixed {currency} amount (e.g. {currency} 400 OFF).
                </p>
              </button>

              {/* Option 3: Special/Seasonal Price */}
              <button
                type="button"
                onClick={() => setOfferType('seasonal')}
                className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  offerType === 'seasonal'
                    ? 'border-[#009A60] bg-[#e6f7f0]/40 ring-2 ring-[#009A60]/20 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg ${offerType === 'seasonal' ? 'bg-[#009A60] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    <Sparkles size={16} />
                  </div>
                  <span className="font-bold text-sm text-gray-900">Special / Seasonal Price</span>
                </div>
                <p className="text-xs text-gray-500">
                  Directly specify the exact promotional rate for the occasion.
                </p>
              </button>
            </div>
          </div>

          {/* 3. PERCENTAGE DISCOUNT CONFIGURATION */}
          {offerType === 'percentage' && (
            <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 text-sm font-bold">
                <Percent size={17} className="text-[#009A60]" />
                <span>Percentage Discount Configuration</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Original Price ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-14 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={95}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Math.max(1, Math.min(95, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      %
                    </span>
                  </div>
                  {/* Preset quick discount buttons */}
                  <div className="flex gap-1.5 mt-2">
                    {[10, 15, 20, 25, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded border transition-colors ${
                          discountPercent === pct
                            ? 'bg-[#009A60] text-white border-[#009A60]'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Special Price (Auto-calculated)
                  </label>
                  <div className="px-3.5 py-2 bg-white border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                    <span className="text-xs font-bold text-emerald-800">{currency}</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {calculatedSpecialPrice.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                    Guests save {currency} {(originalPrice - calculatedSpecialPrice).toLocaleString()} ({discountPercent}% OFF)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. FIXED AMOUNT DISCOUNT CONFIGURATION */}
          {offerType === 'fixed' && (
            <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 text-sm font-bold">
                <Tag size={17} className="text-[#009A60]" />
                <span>Fixed Amount Discount Configuration</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Original Price ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-14 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount Amount ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={originalPrice - 1}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Math.max(1, Number(e.target.value)))}
                      className={`w-full pl-14 pr-3 py-2 bg-white border rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none ${
                        !isFixedAmountValid ? 'border-rose-400 focus:ring-rose-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {!isFixedAmountValid && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      Discount amount cannot make final price zero or negative.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Special Price (Auto-calculated)
                  </label>
                  <div className="px-3.5 py-2 bg-white border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                    <span className="text-xs font-bold text-emerald-800">{currency}</span>
                    <span className="text-base font-extrabold text-emerald-700">
                      {calculatedSpecialPrice.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                    Equivalent to {calculatedDiscountPercent}% OFF for the customer
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. SPECIAL / SEASONAL PRICE DIRECT CONFIGURATION */}
          {offerType === 'seasonal' && (
            <div className="p-5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 text-sm font-bold">
                <Sparkles size={17} className="text-[#009A60]" />
                <span>Special / Seasonal Promotional Price</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Regular Price ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-14 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Special Promotional Price ({currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {currency}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={originalPrice - 1}
                      value={customSpecialPrice}
                      onChange={(e) => setCustomSpecialPrice(Math.max(1, Number(e.target.value)))}
                      className={`w-full pl-14 pr-3 py-2 bg-white border rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none ${
                        !isSeasonalPriceValid ? 'border-rose-400 focus:ring-rose-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {!isSeasonalPriceValid && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      Special price must be lower than regular price ({currency} {originalPrice.toLocaleString()}).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Equivalent Customer Discount
                  </label>
                  <div className="px-3.5 py-2 bg-white border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                    <span className="text-xs font-bold text-emerald-800">Customer Savings:</span>
                    <span className="text-base font-extrabold text-[#009A60]">
                      {calculatedDiscountPercent}% OFF
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                    Savings: {currency} {(originalPrice - calculatedSpecialPrice).toLocaleString()} / night
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 6. OPTIONAL OFFER NAME */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Offer Name (Optional)
              </label>
              <span className="text-[11px] text-gray-400">e.g. "Summer Special"</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Summer Special, Weekend Special, Flash Deal"
              value={offerName}
              onChange={(e) => setOfferName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-[#009A60] focus:outline-none"
            />
            {/* Quick preset chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-gray-500 font-medium mr-1">Suggestions:</span>
              {OFFER_NAME_PRESETS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setOfferName(name)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                    offerName === name
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 7. OFFER VALIDITY (START & END DATES) */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Calendar size={17} className="text-[#009A60]" />
                <span>Offer Validity Period</span>
              </div>

              {/* Status explanation */}
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-gray-500">Status:</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                  offerStatus === 'active' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : offerStatus === 'scheduled'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {offerStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Offer Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Offer End Date *
                </label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 pt-1 border-t border-gray-200">
              <Clock size={14} className="text-gray-400 shrink-0" />
              <span>
                {offerStatus === 'active' && 'Promotion is currently active and will be prominently highlighted to guests.'}
                {offerStatus === 'scheduled' && `Promotion starts on ${startDate} — will automatically turn active on that date.`}
                {offerStatus === 'expired' && 'End date has passed. Expired promotions are automatically hidden from guests.'}
              </span>
            </div>
          </div>

          {/* 8. OPTIONAL SEASONAL OFFER */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center gap-2.5">
              <input
                id="seasonal-toggle-checkbox"
                type="checkbox"
                checked={isSeasonal}
                onChange={(e) => setIsSeasonal(e.target.checked)}
                className="w-4 h-4 text-[#009A60] rounded border-gray-300 focus:ring-[#009A60] cursor-pointer"
              />
              <label
                htmlFor="seasonal-toggle-checkbox"
                className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
              >
                <Palmtree size={16} className="text-[#009A60]" />
                <span>Seasonal Offer</span>
              </label>
            </div>

            {isSeasonal && (
              <div className="pl-6 space-y-3 pt-1 border-l-2 border-[#009A60]/40 ml-1.5 animate-fadeIn">
                <p className="text-xs text-gray-500">
                  Tag the season or occasion so travelers searching for holiday getaways can discover your promotion.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Season or Occasion
                    </label>
                    <select
                      value={seasonalTag}
                      onChange={(e) => setSeasonalTag(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                    >
                      {SEASONAL_PRESETS.map((season) => (
                        <option key={season} value={season}>
                          {season}
                        </option>
                      ))}
                    </select>
                  </div>

                  {seasonalTag === 'Other' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Custom Seasonal Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Maputo Carnival, Safari Season"
                        value={customSeasonName}
                        onChange={(e) => setCustomSeasonName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Annual Seasonal Review & Recurrence Configuration */}
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="annual-recurrence-checkbox"
                      type="checkbox"
                      checked={annualRecurrenceEnabled}
                      onChange={(e) => setAnnualRecurrenceEnabled(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-[#009A60] rounded border-gray-300 focus:ring-[#009A60] cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="annual-recurrence-checkbox"
                        className="text-xs font-bold text-gray-900 cursor-pointer flex items-center gap-1.5"
                      >
                        <CalendarCheck size={14} className="text-[#009A60]" />
                        <span>Annual Seasonal Review & Recurrence</span>
                      </label>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        Eligible for annual review: MozBook will alert you prior to this season arriving each year so you can review previous rates, adjust dates, and confirm publication. Offers are never automatically published without your explicit confirmation.
                      </p>
                      {!annualRecurrenceEnabled && (
                        <p className="text-[11px] text-amber-700 mt-1 font-medium">
                          Annual review disabled. This promotion will only run for the selected dates above and will not be scheduled for future seasonal reviews.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 9. HOST PREVIEW */}
          <div className="p-5 bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Eye size={17} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Customer Live Preview
                </span>
              </div>
              <span className="text-[11px] text-gray-400">Updates dynamically</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h4 className="font-extrabold text-base text-white">
                    {offerName.trim() || (isSeasonal ? `${seasonalTag === 'Other' ? (customSeasonName || 'Seasonal') : seasonalTag} Special` : 'Special Promotional Offer')}
                  </h4>
                  {isSeasonal && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      {seasonalTag === 'Other' ? (customSeasonName || 'Seasonal') : seasonalTag}
                    </span>
                  )}
                  {isSeasonal && annualRecurrenceEnabled && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <Clock size={10} />
                      <span>Annual Review Eligible</span>
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5">
                  <span className="line-through text-gray-400 text-sm font-medium">
                    {currency} {originalPrice.toLocaleString()}
                  </span>
                  <span className="text-2xl font-black text-emerald-400">
                    {currency} {calculatedSpecialPrice.toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-md text-xs font-black tracking-wide">
                    {calculatedDiscountPercent}% OFF
                  </span>
                </div>

                <p className="text-xs text-gray-300 mt-2 flex items-center gap-1.5">
                  <CalendarCheck size={13} className="text-emerald-400 shrink-0" />
                  <span>{formatOfferDateRange(startDate, endDate)}</span>
                </p>
              </div>

              {/* Status indicator badge in preview */}
              <div className="self-stretch sm:self-auto sm:text-right border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Customer Visibility
                </span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  offerStatus === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : offerStatus === 'scheduled'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span>{offerStatus === 'active' ? 'Active Deal' : offerStatus === 'scheduled' ? 'Starts Soon' : 'Expired Deal'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
