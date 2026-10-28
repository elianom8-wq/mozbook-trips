import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Globe,
  MapPin,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Utensils,
  Bed,
  Car,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MessageSquare,
  Sparkles,
  Phone,
  Mail,
  Share2,
  Bookmark,
  Check,
  Info,
  Images,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TravelPackage } from '../types/dmc';
import { getTravelPackageById, createDmcEnquiry } from '../services/dmcService';
import { createActivityBooking } from '../services/activityTripService';
import CheckoutSummaryModal from '../components/CheckoutSummaryModal';
import { ActivityBooking } from '../types/activityTrip';

export default function TravelPackageDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pkg, setPkg] = useState<TravelPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [adults, setAdults] = useState<number>(2);
  const [includeSingleSupplement, setIncludeSingleSupplement] = useState<boolean>(false);

  // Gallery Modal / Lightbox State
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<ActivityBooking | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  // Expanded days state
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function fetchPackage() {
      if (!id) return;
      try {
        const item = await getTravelPackageById(id);
        if (item) {
          setPkg(item);
          if (item.departureDates?.length > 0) {
            setSelectedDate(item.departureDates[0]);
          }
          // Expand first 2 days by default
          setExpandedDays({ 1: true, 2: true });
        }
      } catch (e) {
        console.error('Failed to load package:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchPackage();
  }, [id]);

  const toggleDay = (dayNum: number) => {
    setExpandedDays(prev => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  // Financial calculations
  const baseTotal = (pkg?.pricePerPersonMzn || 0) * adults;
  const singleSupplementTotal = includeSingleSupplement ? (pkg?.singleSupplementMzn || 0) : 0;
  const totalAmountMzn = baseTotal + singleSupplementTotal;

  // Handle Instant Booking
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;

    setSubmitting(true);
    try {
      const bookingData = {
        activityId: pkg.id,
        activityTitle: pkg.title,
        activityType: 'dmc_package' as any,
        city: pkg.primaryDestination || 'Mozambique',
        hostId: pkg.hostId,
        userId: user?.uid,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        date: selectedDate || new Date().toISOString().split('T')[0],
        time: '09:00',
        adults,
        children: 0,
        totalGuests: adults,
        pricingType: 'per_person' as const,
        totalMzn: totalAmountMzn,
        pickupRequested: true,
        pickupNotes: `Package: ${pkg.title}. Meeting at ${pkg.pickupLocation || 'Airport'}. Requests: ${specialRequests}`,
        status: 'pending' as const,
        paymentStatus: 'unpaid' as const,
        fulfillmentStatus: 'unfulfilled' as const
      };

      const created = await createActivityBooking(bookingData);
      setConfirmedBooking(created);
      setShowBookingModal(false);
      setShowCheckoutModal(true);
    } catch (err) {
      console.error('Error creating package booking:', err);
      alert('Failed to submit reservation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Custom Itinerary Enquiry
  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;

    setSubmitting(true);
    try {
      createDmcEnquiry({
        hostId: pkg.hostId,
        packageId: pkg.id,
        packageTitle: pkg.title,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        travelDates: selectedDate || 'Flexible / To be confirmed',
        adultsCount: adults,
        childrenCount: 0,
        specialRequests: specialRequests.trim()
      });
      setEnquirySuccess(true);
      setTimeout(() => {
        setShowEnquiryModal(false);
        setEnquirySuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Error sending enquiry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#009A60] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-gray-500">Loading MozBook Travel Package...</span>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <AlertCircle size={48} className="text-gray-300 mb-3" />
        <h2 className="text-xl font-bold text-gray-900">Package Not Found</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-sm">
          The requested multi-day package itinerary could not be located or has been archived.
        </p>
        <Link to="/trips" className="mt-4 px-4 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl">
          Browse Trips & Safaris
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Top Navigation */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-30 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>All Trips & Safaris</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#009A60] bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
              {pkg.category}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-8">
        
        {/* Title & Location Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {pkg.destinations?.map(d => (
              <span key={d} className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                <MapPin size={12} className="text-[#009A60]" />
                <span>{d}</span>
              </span>
            ))}
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
              {pkg.durationDays} Days / {pkg.durationNights} Nights
            </span>
          </div>

          <h1 className="text-2xl md:text-4xl font-black text-gray-950 tracking-tight leading-tight">
            {pkg.title}
          </h1>

          {pkg.subtitle && (
            <p className="text-base text-gray-600 font-medium">
              {pkg.subtitle}
            </p>
          )}

          {/* DMC Host Verification Strip */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#009A60] flex items-center justify-center font-bold">
                <Globe size={16} />
              </div>
              <div>
                <div className="font-bold text-gray-900 flex items-center gap-1">
                  <span>Organised by: {pkg.agencyName || pkg.hostName}</span>
                  <ShieldCheck size={14} className="text-[#009A60]" />
                </div>
                <div className="text-[11px] text-gray-500">
                  INATUR Registered Operator #{pkg.inaturLicenseNumber || 'INATUR/OP-REG'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Gallery with Fallback and Lightbox Trigger */}
        {(() => {
          const galleryList: string[] = [];
          if (pkg.coverImage) galleryList.push(pkg.coverImage);
          if (pkg.images?.length) {
            pkg.images.forEach(img => {
              if (img && !galleryList.includes(img)) galleryList.push(img);
            });
          }
          const secondaryImages = galleryList.filter(img => img !== pkg.coverImage).slice(0, 2);
          const totalCount = galleryList.length;

          return (
            <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gray-900 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 h-[320px] md:h-[420px]">
                <div
                  className="md:col-span-2 h-full cursor-pointer relative group overflow-hidden"
                  onClick={() => {
                    setActivePhotoIndex(0);
                    setIsGalleryModalOpen(true);
                  }}
                >
                  <img
                    src={pkg.coverImage || galleryList[0]}
                    alt={pkg.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                </div>

                <div className="hidden md:grid grid-rows-2 gap-2 h-full">
                  {secondaryImages.length > 0 ? (
                    secondaryImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="h-full cursor-pointer relative group overflow-hidden bg-gray-800"
                        onClick={() => {
                          const targetIdx = galleryList.indexOf(img);
                          setActivePhotoIndex(targetIdx >= 0 ? targetIdx : 0);
                          setIsGalleryModalOpen(true);
                        }}
                      >
                        <img
                          src={img}
                          alt={`${pkg.title} photo ${idx + 2}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-semibold p-4 text-center">
                        Mozambique Safari Experience
                      </div>
                      <div className="bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-semibold p-4 text-center">
                        Bespoke Tour Package
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* View all photos button */}
              <button
                type="button"
                onClick={() => {
                  setActivePhotoIndex(0);
                  setIsGalleryModalOpen(true);
                }}
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/95 hover:bg-white text-gray-900 text-xs font-bold shadow-lg transition-all backdrop-blur-xs cursor-pointer border border-gray-200/80"
              >
                <Images size={15} className="text-[#009A60]" />
                <span>View all {totalCount} {totalCount === 1 ? 'photo' : 'photos'}</span>
              </button>
            </div>
          );
        })()}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Main Itinerary Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Overview Narrative */}
            <div className="space-y-3">
              <h2 className="text-xl font-black text-gray-900">Experience Overview</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {pkg.description || pkg.shortDescription}
              </p>
            </div>

            {/* Day-by-Day Itinerary Section */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Day-by-Day Itinerary</h2>
                  <p className="text-xs text-gray-500">{pkg.durationDays} curated days with activities, transfers, and accommodations.</p>
                </div>
                <button
                  onClick={() => {
                    const allExpanded = Object.keys(expandedDays).length === pkg.itinerary.length;
                    if (allExpanded) {
                      setExpandedDays({});
                    } else {
                      const all: Record<number, boolean> = {};
                      pkg.itinerary.forEach(d => { all[d.day] = true; });
                      setExpandedDays(all);
                    }
                  }}
                  className="text-xs font-bold text-[#009A60] hover:underline"
                >
                  Toggle All Days
                </button>
              </div>

              <div className="space-y-3">
                {pkg.itinerary.map(dayItem => {
                  const isExpanded = !!expandedDays[dayItem.day];
                  return (
                    <div
                      key={dayItem.day}
                      className="rounded-2xl border border-gray-200 overflow-hidden transition-all shadow-xs"
                    >
                      <button
                        onClick={() => toggleDay(dayItem.day)}
                        className="w-full p-4 bg-gray-50/70 hover:bg-gray-100/70 flex items-center justify-between text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-[#009A60] text-white text-xs font-black flex items-center justify-center shrink-0">
                            {dayItem.day}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-gray-900 leading-snug">
                              {dayItem.title}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                              {dayItem.accommodationName && (
                                <span className="flex items-center gap-1">
                                  <Bed size={11} className="text-emerald-700" />
                                  <span>{dayItem.accommodationName}</span>
                                </span>
                              )}
                              {dayItem.mealsIncluded?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Utensils size={11} className="text-emerald-700" />
                                  <span>Meals included: {dayItem.mealsIncluded.join(', ')}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>

                      {isExpanded && (
                        <div className="p-5 bg-white space-y-4 text-xs text-gray-700 border-t border-gray-100">
                          <p className="leading-relaxed whitespace-pre-line text-sm text-gray-600">
                            {dayItem.description}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {dayItem.accommodationName && (
                              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Overnight Lodge
                                </span>
                                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                  <Bed size={14} className="text-[#009A60]" />
                                  <span>{dayItem.accommodationName}</span>
                                </div>
                              </div>
                            )}

                            {dayItem.transportMode && (
                              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Daily Transportation
                                </span>
                                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                  <Car size={14} className="text-[#009A60]" />
                                  <span>{dayItem.transportMode}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[#009A60]" />
                  <span>What's Included</span>
                </h3>
                <ul className="space-y-2 text-xs text-emerald-900">
                  {pkg.included?.map((inc, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#009A60] font-bold">✓</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-3">
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                  <XCircle size={16} className="text-amber-600" />
                  <span>What's Not Included</span>
                </h3>
                <ul className="space-y-2 text-xs text-amber-900">
                  {pkg.notIncluded?.map((exc, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">✕</span>
                      <span>{exc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Travel Requirements & Health Advisories */}
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-3 text-xs text-gray-700">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Info size={16} className="text-gray-500" />
                <span>Travel Requirements & Mozambique Health Advisory</span>
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-gray-600">
                {pkg.travelRequirements?.map((req, i) => (
                  <li key={i}>{req}</li>
                )) || (
                  <>
                    <li>Valid passport with at least 6 months validity from date of entry into Mozambique.</li>
                    <li>Yellow fever certificate required if arriving from or transiting endemic countries.</li>
                    <li>Malaria prophylaxis recommended for all bush, coastal, and national park regions.</li>
                  </>
                )}
              </ul>
            </div>

          </div>

          {/* Sticky Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-3xl border-2 border-[#009A60] shadow-xl p-6 space-y-5">
              
              <div className="border-b border-gray-100 pb-4">
                <span className="text-xs text-gray-500 font-medium">Starting from</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-gray-950">
                    {pkg.pricePerPersonMzn.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-gray-500">MZN / person</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  (~${Math.round(pkg.pricePerPersonMzn / 64).toLocaleString()} USD)
                </div>
              </div>

              {/* Departure Date Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800">
                  Select Departure Date
                </label>
                {pkg.departureDates?.length > 0 ? (
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-gray-50"
                  >
                    {pkg.departureDates.map(d => (
                      <option key={d} value={d}>
                        Scheduled Departure: {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    Flexible daily departures on request
                  </div>
                )}
              </div>

              {/* Number of Travelers */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800">
                  Number of Adult Travelers
                </label>
                <div className="flex items-center justify-between p-2 rounded-xl border border-gray-200 bg-gray-50">
                  <span className="text-xs font-bold text-gray-800">{adults} Travelers</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-300 font-bold text-xs"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdults(Math.min(pkg.maxGroupSize || 12, adults + 1))}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-300 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Single Room Supplement Option */}
              {pkg.singleSupplementMzn && pkg.singleSupplementMzn > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <input
                    type="checkbox"
                    id="singleSupp"
                    checked={includeSingleSupplement}
                    onChange={(e) => setIncludeSingleSupplement(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#009A60] rounded border-gray-300"
                  />
                  <label htmlFor="singleSupp" className="text-xs text-gray-700 cursor-pointer">
                    Add Single Room Supplement (+{pkg.singleSupplementMzn.toLocaleString()} MZN)
                  </label>
                </div>
              )}

              {/* Total Calculation */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Estimated Total:</span>
                <span className="text-lg font-black text-[#009A60]">
                  {totalAmountMzn.toLocaleString()} MZN
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(true)}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={15} />
                  <span>Reserve This Package</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEnquiryModal(true)}
                  className="w-full py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare size={14} />
                  <span>Request Custom Itinerary / Quote</span>
                </button>
              </div>

              <div className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
                <ShieldCheck size={13} className="text-[#009A60]" />
                <span>Protected by MozBook Operator Guarantee</span>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">Complete Package Reservation</h3>
                <p className="text-xs text-gray-500">{pkg.title}</p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4 text-xs">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-950 block">{adults} Travelers • Departure {selectedDate || 'Upcoming'}</span>
                  <span className="text-[11px] text-emerald-800">{pkg.durationDays} Days / {pkg.durationNights} Nights</span>
                </div>
                <div className="text-base font-black text-[#009A60]">
                  {totalAmountMzn.toLocaleString()} MZN
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Lead Traveler Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+258 ..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Special Dietary, Medical or Room Requests</label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Vegetarian diet, twin beds, airport arrival flight details..."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#009A60] text-white font-bold shadow-md hover:bg-[#008250]"
                >
                  {submitting ? 'Processing...' : 'Confirm & Proceed to Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Itinerary Enquiry Modal */}
      {showEnquiryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">Request Custom Itinerary / Quote</h3>
                <p className="text-xs text-gray-500">Direct enquiry to {pkg.agencyName || pkg.hostName}</p>
              </div>
              <button onClick={() => setShowEnquiryModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {enquirySuccess ? (
              <div className="p-8 text-center space-y-3">
                <CheckCircle2 size={40} className="mx-auto text-[#009A60]" />
                <h4 className="text-base font-bold text-gray-900">Enquiry Sent to DMC!</h4>
                <p className="text-xs text-gray-600">
                  The tour operator has received your custom inquiry and will prepare a tailored itinerary quote shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Tailoring Requirements & Target Dates</label>
                  <textarea
                    rows={3}
                    required
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Describe desired travel dates, extension to Bazaruto, private 4x4 charter, or group size..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEnquiryModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-[#009A60] text-white font-bold shadow-md hover:bg-[#008250]"
                  >
                    {submitting ? 'Sending...' : 'Send Custom Inquiry'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Photo Gallery Lightbox Modal */}
      {isGalleryModalOpen && pkg && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm sm:text-base font-bold line-clamp-1">{pkg.title}</h3>
              <p className="text-xs text-white/60">
                Photo {activePhotoIndex + 1} of {
                  (() => {
                    const list: string[] = [];
                    if (pkg.coverImage) list.push(pkg.coverImage);
                    if (pkg.images) pkg.images.forEach(i => { if (i && !list.includes(i)) list.push(i); });
                    return list.length || 1;
                  })()
                }
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGalleryModalOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Close photo gallery"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Photo Carousel */}
          {(() => {
            const list: string[] = [];
            if (pkg.coverImage) list.push(pkg.coverImage);
            if (pkg.images) pkg.images.forEach(i => { if (i && !list.includes(i)) list.push(i); });
            if (list.length === 0) list.push('https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80');
            const currentImg = list[activePhotoIndex] || list[0];

            return (
              <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
                <img
                  src={currentImg}
                  alt={`${pkg.title} - ${activePhotoIndex + 1}`}
                  className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80';
                  }}
                />

                {/* Left / Right Nav Arrows */}
                {list.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((activePhotoIndex - 1 + list.length) % list.length)}
                      className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((activePhotoIndex + 1) % list.length)}
                      className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all cursor-pointer"
                      aria-label="Next photo"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {/* Thumbnails Strip */}
          {(() => {
            const list: string[] = [];
            if (pkg.coverImage) list.push(pkg.coverImage);
            if (pkg.images) pkg.images.forEach(i => { if (i && !list.includes(i)) list.push(i); });

            if (list.length <= 1) return null;

            return (
              <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-4xl mx-auto">
                {list.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`h-16 w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      activePhotoIndex === idx ? 'border-[#009A60] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=400&q=80';
                      }}
                    />
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Checkout Modal if booking confirmed */}
      {showCheckoutModal && confirmedBooking && (
        <CheckoutSummaryModal
          isOpen={showCheckoutModal}
          onClose={() => {
            setShowCheckoutModal(false);
            navigate(`/booking/${confirmedBooking.id}/status`);
          }}
          booking={{
            id: confirmedBooking.id,
            bookingRef: confirmedBooking.bookingRef,
            title: confirmedBooking.activityTitle,
            category: 'trip',
            city: confirmedBooking.city,
            startDate: confirmedBooking.date,
            totalGuests: confirmedBooking.totalGuests,
            adults: confirmedBooking.adults,
            children: confirmedBooking.children,
            totalAmount: confirmedBooking.totalMzn,
            currency: 'MZN'
          }}
        />
      )}
    </div>
  );
}
