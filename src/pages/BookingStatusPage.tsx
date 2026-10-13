import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw, 
  MapPin, 
  Calendar, 
  Users, 
  Lock, 
  ExternalLink,
  ArrowRight,
  Home,
  QrCode,
  LogIn,
  Compass,
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAuthoritativeBookingStatus, AuthoritativeBookingStatusResponse } from '../services/clientPaymentService';
import CheckoutSummaryModal, { CheckoutModalBooking } from '../components/CheckoutSummaryModal';

export default function BookingStatusPage() {
  const { id: bookingId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlRef = searchParams.get('ref') || '';
  const { user, loading: authLoading, login } = useAuth();

  const [bookingStatusData, setBookingStatusData] = useState<AuthoritativeBookingStatusResponse['booking'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Authoritative Status Fetcher
  const loadStatus = useCallback(async (isManualRefresh = false) => {
    if (!bookingId || !user) return;

    if (isManualRefresh) setIsRefreshing(true);

    try {
      const response = await fetchAuthoritativeBookingStatus(bookingId);
      if (response.success && response.booking) {
        setBookingStatusData(response.booking);
        setErrorStatus(null);
        setErrorMessage(null);
      }
    } catch (err: any) {
      console.warn('[BookingStatus] Status fetch note:', err);
      const status = err.statusCode || (err.message?.includes('Access denied') ? 403 : 500);
      setErrorStatus(status);
      setErrorMessage(err.message || 'Unable to retrieve reservation status.');
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, [bookingId, user]);

  // Initial load when user auth is available
  useEffect(() => {
    if (!authLoading && user && bookingId) {
      loadStatus();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user, bookingId, loadStatus]);

  // Auto-polling for pending payments (Awaiting PaySuite webhook settlement)
  useEffect(() => {
    // Only poll if booking is pending or unpaid
    const shouldPoll = 
      bookingStatusData && 
      bookingStatusData.paymentStatus === 'unpaid' && 
      bookingStatusData.status === 'pending' &&
      pollCount < 20; // Poll for up to 60 seconds (20 x 3s)

    if (shouldPoll) {
      pollIntervalRef.current = setTimeout(() => {
        setPollCount(prev => prev + 1);
        loadStatus();
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
    };
  }, [bookingStatusData, pollCount, loadStatus]);

  // 1. Unauthenticated Gate: Prompt Traveler to Log In
  if (!authLoading && !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center mx-auto shadow-inner">
            <Lock size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Sign In to View Reservation</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              For security and customer data privacy, reservation passes and payment records are accessible only to the authenticated traveler who booked them.
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
          <div className="pt-2">
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-800 font-medium">
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#009A60] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-600 animate-pulse">
          Retrieving authoritative reservation status...
        </p>
      </div>
    );
  }

  // 3. Authorization Error / Access Denied (403)
  if (errorStatus === 403) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-red-100 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 uppercase tracking-wider">
              Access Denied (403)
            </span>
            <h2 className="text-xl font-bold text-gray-900">Unauthorized Reservation Access</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              This reservation belongs to a different traveler or host account. Please switch to the account used when creating this reservation.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Link
              to="/my-bookings"
              className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl text-xs block text-center"
            >
              Go to My Bookings
            </Link>
            <Link
              to="/"
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold block text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Missing Reservation (404)
  if (!bookingStatusData || errorStatus === 404) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-200 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Reservation Not Found</h2>
            <p className="text-xs text-gray-500">
              We could not find reservation details for ID: <code>{bookingId}</code>.
            </p>
          </div>
          <Link
            to="/my-bookings"
            className="w-full py-3 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-2xl text-xs block text-center"
          >
            Check My Bookings
          </Link>
        </div>
      </div>
    );
  }

  // Helper values
  const isCancelled = bookingStatusData.status === 'cancelled';
  const isWeatherCancelled = isCancelled && bookingStatusData.cancellationReason === 'weather';
  const isRescheduled = Boolean(bookingStatusData.rescheduledFromDate);
  const isPaid = !isCancelled && bookingStatusData.paymentStatus === 'paid' && bookingStatusData.status === 'confirmed';
  const isFailed = !isCancelled && bookingStatusData.paymentStatus === 'failed';
  const isPending = !isCancelled && !isPaid && !isFailed;

  const checkoutModalData: CheckoutModalBooking = {
    id: bookingStatusData.id,
    bookingRef: bookingStatusData.bookingRef,
    title: bookingStatusData.title,
    category: bookingStatusData.bookingCategory,
    isWeatherDependent: bookingStatusData.isWeatherDependent,
    city: bookingStatusData.city,
    location: bookingStatusData.location,
    image: bookingStatusData.image,
    startDate: bookingStatusData.startDate,
    endDate: bookingStatusData.endDate,
    nights: bookingStatusData.nights,
    totalGuests: bookingStatusData.totalGuests,
    adults: bookingStatusData.adults || 1,
    children: bookingStatusData.children || 0,
    totalAmount: bookingStatusData.totalAmount,
    currency: bookingStatusData.currency
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* State Banner */}
        {isWeatherCancelled && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-6 shadow-md text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-sm">
              <Compass size={36} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-900 block">
                Official Maritime & Weather Cancellation Advisory
              </span>
              <h1 className="text-2xl font-black text-gray-900">
                Cancelled Due to Severe Weather Conditions
              </h1>
              <p className="text-xs text-gray-700 max-w-md mx-auto leading-relaxed">
                This outdoor/marine activity was cancelled due to hazardous sea swell, wind velocity, or official INAM maritime advisories for your safety.
              </p>
              {bookingStatusData.operatorFailureNotes && (
                <p className="text-[11px] text-amber-900 font-semibold italic bg-amber-100/70 p-2 rounded-xl max-w-md mx-auto mt-2">
                  "{bookingStatusData.operatorFailureNotes}"
                </p>
              )}
            </div>
            <div className="p-3 bg-white/80 rounded-2xl border border-amber-300 text-xs text-amber-950 space-y-1 max-w-md mx-auto">
              <span className="font-bold block">100% Full Refund or Priority Reschedule</span>
              <p className="text-[11px] text-gray-600">
                You are entitled to an immediate 100% refund via PaySuite or you can agree on an alternate date with your operator without penalty.
              </p>
            </div>
          </div>
        )}

        {isCancelled && !isWeatherCancelled && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-6 shadow-md text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-rose-600 text-white flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle size={36} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-rose-800 block">
                Reservation Cancelled
              </span>
              <h1 className="text-2xl font-black text-gray-900">
                {bookingStatusData.cancellationReason === 'operator_inventory_failure'
                  ? 'Cancelled Due to Operator Inventory Issue'
                  : 'Reservation Cancelled'}
              </h1>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                {bookingStatusData.operatorFailureNotes || 'This booking has been cancelled.'}
              </p>
            </div>
          </div>
        )}

        {isRescheduled && !isCancelled && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-3xl p-5 text-center space-y-2 animate-fade-in">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-800 block">
              Schedule Updated · Weather Rescheduled
            </span>
            <p className="text-xs text-blue-950 font-semibold">
              This reservation was rescheduled from {bookingStatusData.rescheduledFromDate} to <strong>{bookingStatusData.startDate}</strong>.
            </p>
            {bookingStatusData.rescheduleNotes && (
              <p className="text-[11px] text-blue-800 italic">
                Note: "{bookingStatusData.rescheduleNotes}"
              </p>
            )}
          </div>
        )}

        {isPaid && (
          <div className="bg-[#e6f7f0] border-2 border-[#009A60] rounded-3xl p-6 shadow-md text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[#009A60] text-white flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#008250] block">
                Official Settlement Confirmed · PaySuite
              </span>
              <h1 className="text-2xl font-black text-gray-900">
                Payment Confirmed! Your Reservation is Active.
              </h1>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                Your payment was received and settled via the PaySuite Mozambique gateway. Your host has been notified.
              </p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-sm">
              <Clock size={36} className="animate-spin-slow" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-800 block">
                Awaiting Settlement · PaySuite Network
              </span>
              <h1 className="text-2xl font-black text-gray-900">
                Payment Processing...
              </h1>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                We are confirming your transaction with the mobile money / card network. This usually takes 5 to 20 seconds.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => loadStatus(true)}
                disabled={isRefreshing}
                className="px-4 py-2 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-xl text-xs border border-gray-300 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
                <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-xl text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Pay with PaySuite</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-6 shadow-md text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle size={36} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-800 block">
                Payment Not Completed
              </span>
              <h1 className="text-2xl font-black text-gray-900">
                Transaction Declined or Cancelled
              </h1>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                Your reservation is still saved. You can retry payment with M-Pesa, e-Mola, or another card without creating a duplicate booking.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <span>Retry Payment with PaySuite</span>
              <ExternalLink size={14} />
            </button>
          </div>
        )}

        {/* Detailed Reservation Pass Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-100 gap-3">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                Authoritative Reference
              </span>
              <span className="text-lg font-mono font-black text-gray-900">
                {bookingStatusData.bookingRef}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                bookingStatusData.status === 'confirmed' 
                  ? 'bg-emerald-100 text-[#008250] border-emerald-200' 
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                Booking: {bookingStatusData.status.toUpperCase()}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                bookingStatusData.paymentStatus === 'paid' 
                  ? 'bg-emerald-100 text-[#008250] border-emerald-200' 
                  : isFailed
                  ? 'bg-red-100 text-red-800 border-red-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}>
                Payment: {bookingStatusData.paymentStatus.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Fulfillment: {bookingStatusData.fulfillmentStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Property or Activity Overview */}
          <div className="flex gap-4 items-start">
            {bookingStatusData.image ? (
              <img 
                src={bookingStatusData.image} 
                alt={bookingStatusData.title}
                className="w-24 h-24 rounded-2xl object-cover border border-gray-200 shrink-0" 
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center font-bold text-sm shrink-0">
                MozBook
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#009A60] block">
                {bookingStatusData.bookingCategory.toUpperCase()} RESERVATION
              </span>
              <h2 className="text-base font-bold text-gray-900 leading-snug">
                {bookingStatusData.title}
              </h2>
              {(bookingStatusData.city || bookingStatusData.location) && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <span>{bookingStatusData.city || bookingStatusData.location}</span>
                </p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 border-y border-gray-100 text-xs">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar size={15} className="text-[#009A60] shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold">SCHEDULE DATES</span>
                <span className="font-bold">
                  {bookingStatusData.startDate}
                  {bookingStatusData.endDate && bookingStatusData.endDate !== bookingStatusData.startDate ? ` → ${bookingStatusData.endDate}` : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <Users size={15} className="text-[#009A60] shrink-0" />
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold">GUESTS / PARTICIPANTS</span>
                <span className="font-bold">
                  {bookingStatusData.totalGuests} Guests
                  {bookingStatusData.nights ? ` · ${bookingStatusData.nights} ${bookingStatusData.nights === 1 ? 'Night' : 'Nights'}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 block">Total Authoritative Price</span>
              <span className="font-bold text-gray-900">Currency: {bookingStatusData.currency}</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-[#009A60]">
                {bookingStatusData.currency} {bookingStatusData.totalAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-400 block">
                {isPaid ? '✓ Settled via PaySuite' : 'Awaiting Settlement'}
              </span>
            </div>
          </div>

          {/* QR & Check-In Notice (Paid != Fulfilled) */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-xs text-gray-700 space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#008250]">
              <QrCode size={16} />
              <span>Check-in & Service Fulfillment Lifecycle</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              MozBook separates payment settlement from service fulfillment. Your payment secures your reservation, and your host will scan or redeem your booking reference during arrival check-in.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Link
                to="/my-bookings"
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs text-center transition-all shadow-xs"
              >
                Go to My Bookings
              </Link>
              <Link
                to={`/messages?bookingId=${bookingStatusData.id}&bookingRef=${encodeURIComponent(bookingStatusData.bookingRef)}&title=${encodeURIComponent(bookingStatusData.listingTitle || 'MozBook Reservation')}${bookingStatusData.hostId ? `&hostId=${bookingStatusData.hostId}` : ''}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#009A60] font-bold rounded-xl text-xs text-center flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
              >
                <MessageCircle size={14} />
                <span>Message Host</span>
              </Link>
            </div>
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-2.5 text-gray-600 hover:text-gray-900 font-semibold rounded-xl text-xs text-center flex items-center justify-center gap-1.5"
            >
              <Home size={14} />
              <span>Return Home</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Checkout Modal for Retrying Payment */}
      <CheckoutSummaryModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        booking={checkoutModalData}
      />
    </div>
  );
}
