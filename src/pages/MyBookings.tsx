import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  Users, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight, 
  ExternalLink,
  Compass,
  Home,
  Luggage,
  MessageCircle,
  LogIn
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getUserStayBookings } from '../services/bookingService';
import { Booking } from '../types/booking';
import { ActivityBooking } from '../types/activityTrip';
import CheckoutSummaryModal, { CheckoutModalBooking } from '../components/CheckoutSummaryModal';

type FilterTab = 'all' | 'stays' | 'activities';

interface UnifiedBookingItem {
  id: string;
  bookingRef: string;
  category: 'stay' | 'activity' | 'trip';
  title: string;
  hostId?: string;
  listingId?: string;
  city?: string;
  location?: string;
  image?: string;
  startDate: string;
  endDate: string;
  nights?: number;
  totalGuests: number;
  adults: number;
  children?: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt?: string;
  travelGroupId?: string;
  isWeatherDependent?: boolean;
  weatherStatus?: string;
  cancellationReason?: string;
  rescheduledFromDate?: string;
}

export default function MyBookings() {
  const { user, loading: authLoading, login } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [bookings, setBookings] = useState<UnifiedBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForCheckout, setSelectedForCheckout] = useState<CheckoutModalBooking | null>(null);

  useEffect(() => {
    async function loadAllBookings() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const unifiedList: UnifiedBookingItem[] = [];

        // 1. Fetch Stays
        try {
          const stays = await getUserStayBookings(user.uid);
          stays.forEach((s: Booking) => {
            unifiedList.push({
              id: s.id,
              bookingRef: s.bookingRef,
              category: 'stay',
              title: s.listingTitle,
              hostId: s.hostId,
              listingId: s.listingId,
              city: s.listingCity,
              location: s.listingLocation,
              image: s.listingImage,
              startDate: s.checkInDate || s.startDate,
              endDate: s.checkOutDate || s.endDate,
              nights: s.nights || 1,
              totalGuests: s.totalGuests || (s.adults + (s.children || 0)),
              adults: s.adults || 1,
              children: s.children || 0,
              totalAmount: s.totalAmount,
              currency: s.currency || 'MZN',
              status: s.status || 'pending',
              paymentStatus: s.paymentStatus || 'unpaid',
              fulfillmentStatus: s.fulfillmentStatus || 'unfulfilled',
              createdAt: s.createdAt,
              travelGroupId: s.travelGroupId
            });
          });
        } catch (stayErr) {
          console.warn('[MyBookings] Error loading stay bookings:', stayErr);
        }

        // 2. Fetch Activities & Trips
        try {
          const actColl = collection(db, 'activity_bookings');
          const q = query(actColl, where('userId', '==', user.uid));
          const snap = await getDocs(q);
          snap.forEach(d => {
            const a = d.data() as ActivityBooking;
            unifiedList.push({
              id: d.id,
              bookingRef: a.bookingRef,
              category: a.activityType === 'trip' ? 'trip' : 'activity',
              title: a.activityTitle,
              hostId: a.hostId,
              listingId: a.activityId,
              city: a.city,
              location: a.city,
              image: '',
              startDate: a.date,
              endDate: a.date,
              nights: 1,
              totalGuests: a.totalGuests || 1,
              adults: a.adults || 1,
              children: a.children || 0,
              totalAmount: a.totalMzn || 0,
              currency: 'MZN',
              status: a.status || 'pending',
              paymentStatus: a.paymentStatus || 'unpaid',
              fulfillmentStatus: a.fulfillmentStatus || 'unfulfilled',
              createdAt: a.createdAt,
              travelGroupId: a.travelGroupId,
              isWeatherDependent: a.isWeatherDependent,
              weatherStatus: a.weatherStatus,
              cancellationReason: a.cancellationReason,
              rescheduledFromDate: a.rescheduledFromDate
            });
          });
        } catch (actErr) {
          console.warn('[MyBookings] Error loading activity bookings:', actErr);
        }

        // Sort descending by creation date or start date
        unifiedList.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        setBookings(unifiedList);
      } catch (err) {
        console.error('[MyBookings] Error loading reservations:', err);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadAllBookings();
    }
  }, [user, authLoading]);

  // Filter items by tab
  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'stays') return b.category === 'stay';
    if (activeTab === 'activities') return b.category === 'activity' || b.category === 'trip';
    return true;
  });

  // 1. Unauthenticated Gate
  if (!authLoading && !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center mx-auto">
            <Luggage size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Sign In to View Your Bookings</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Track your upcoming stays across Mozambique, check PaySuite payment status, and view QR passes for check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={login}
            className="w-full py-3.5 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            <LogIn size={18} />
            <span>Sign In with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-[#009A60] uppercase tracking-wider block">
              Traveler Reservations
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">
              My Trips & Reservations
            </h1>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-200/70 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({bookings.length})
            </button>
            <button
              onClick={() => setActiveTab('stays')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'stays'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Stays ({bookings.filter(b => b.category === 'stay').length})
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'activities'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Experiences ({bookings.filter(b => b.category !== 'stay').length})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#009A60] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500 font-semibold">Loading your reservations...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <Compass size={32} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-gray-900">No Reservations Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                You don't have any {activeTab === 'all' ? '' : activeTab} reservations yet. Discover Mozambique's pristine coastlines, wildlife safaris, and beach lodges!
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/"
                className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Browse Stays
              </Link>
              <Link
                to="/trips"
                className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Browse Activities
              </Link>
            </div>
          </div>
        ) : (
          /* Bookings List */
          <div className="space-y-4">
            {filteredBookings.map((b) => {
              const isPaid = b.paymentStatus === 'paid' && b.status === 'confirmed';
              const isFailed = b.paymentStatus === 'failed';
              const isPending = !isPaid && !isFailed;

              return (
                <div 
                  key={b.id} 
                  className="bg-white rounded-3xl p-5 md:p-6 border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="flex gap-4 items-start min-w-0 flex-1">
                    {b.image ? (
                      <img 
                        src={b.image} 
                        alt={b.title} 
                        className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0 border border-gray-100" 
                      />
                    ) : (
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center font-bold text-xs shrink-0">
                        {b.category === 'stay' ? 'Stay' : 'Exp'}
                      </div>
                    )}

                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-extrabold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md">
                          {b.bookingRef}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPaid 
                            ? 'bg-emerald-100 text-[#008250] border-emerald-200' 
                            : isFailed
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          Payment: {b.paymentStatus.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {b.category.toUpperCase()}
                        </span>
                        {b.isWeatherDependent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <span>⚓ Weather Protected</span>
                          </span>
                        )}
                        {b.rescheduledFromDate && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Rescheduled from {b.rescheduledFromDate}
                          </span>
                        )}
                        {b.status === 'cancelled' && b.cancellationReason === 'weather' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Weather Cancelled · Full Refund
                          </span>
                        )}
                        {b.travelGroupId && (
                          <Link
                            to={`/travel-companion/group/${b.travelGroupId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 flex items-center gap-1 transition-colors"
                          >
                            <span>👥 Group Trip</span>
                          </Link>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                        {b.title}
                      </h3>

                      {(b.city || b.location) && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <MapPin size={12} className="shrink-0 text-gray-400" />
                          <span>{b.city || b.location}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-[#009A60]" />
                          {b.startDate}{b.endDate && b.endDate !== b.startDate ? ` → ${b.endDate}` : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} className="text-[#009A60]" />
                          {b.totalGuests} Guests
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Total and Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 shrink-0 gap-3">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 font-semibold block uppercase">Total Amount</span>
                      <span className="text-base md:text-lg font-black text-gray-900">
                        {b.currency} {b.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => setSelectedForCheckout(b)}
                          className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard size={14} />
                          <span>Pay with PaySuite</span>
                        </button>
                      )}

                      <Link
                        to={`/messages?bookingId=${b.id}&bookingRef=${encodeURIComponent(b.bookingRef)}&title=${encodeURIComponent(b.title)}${b.hostId ? `&hostId=${b.hostId}` : ''}`}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#009A60] font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Message host about this reservation"
                      >
                        <MessageCircle size={13} />
                        <span className="hidden sm:inline">Message Host</span>
                      </Link>
                      <Link
                        to={`/booking/${b.id}/status?ref=${encodeURIComponent(b.bookingRef)}`}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                      >
                        <span>Status</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Checkout Summary Modal for initiating PaySuite */}
      <CheckoutSummaryModal
        isOpen={Boolean(selectedForCheckout)}
        onClose={() => setSelectedForCheckout(null)}
        booking={selectedForCheckout}
      />
    </div>
  );
}
