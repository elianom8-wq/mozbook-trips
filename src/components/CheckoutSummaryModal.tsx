import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Lock, 
  Calendar, 
  Users, 
  MapPin, 
  AlertCircle, 
  Loader2, 
  ExternalLink 
} from 'lucide-react';
import { PaySuitePaymentMethod } from '../types/payment';
import { createCheckoutPaymentIntent } from '../services/clientPaymentService';
import { useAuth } from '../context/AuthContext';
import { LegalService } from '../services/legalService';
import { 
  CANCELLATION_POLICY_TIERS, 
  CancellationTierId, 
  calculateCancellationDeadline 
} from '../types/cancellationPolicy';

export interface CheckoutModalBooking {
  id: string;
  bookingRef: string;
  title: string;
  category?: 'stay' | 'activity' | 'trip';
  city?: string;
  location?: string;
  image?: string;
  startDate: string;
  endDate?: string;
  nights?: number;
  totalGuests: number;
  adults: number;
  children?: number;
  totalAmount: number;
  currency: string;
  isWeatherDependent?: boolean;
  cancellationTier?: CancellationTierId;
  isNonRefundable?: boolean;
}

interface CheckoutSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CheckoutModalBooking | null;
}

export default function CheckoutSummaryModal({
  isOpen,
  onClose,
  booking
}: CheckoutSummaryModalProps) {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaySuitePaymentMethod>('mpesa');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (!isOpen || !booking) return null;

  const handleProceedToPayment = async () => {
    if (!acceptedTerms) {
      setErrorMessage('You must review and agree to the MozBook Terms & Conditions and Cancellation & Refund Policy before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Record server-authoritative legal acceptance if user is logged in
      if (user?.uid) {
        await LegalService.recordAcceptanceViaApi({
          userId: user.uid,
          documentType: 'terms_customer',
          documentVersionId: 'terms_customer_v1',
          context: 'checkout',
          bookingId: booking.id
        }).catch(err => console.warn('[Checkout] Legal acceptance logging error (non-blocking):', err));
      }

      const result = await createCheckoutPaymentIntent({
        bookingId: booking.id,
        bookingCategory: booking.category || 'stay',
        paymentMethod: selectedMethod
      });

      if (result.checkoutUrl) {
        // Redirect traveler to PaySuite hosted checkout interface
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('PaySuite did not return a valid checkout URL.');
      }
    } catch (err: any) {
      console.error('[Checkout] Failed to create payment intent:', err);
      setErrorMessage(err.message || 'Unable to connect to PaySuite. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#009A60] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-85 block">
                Official Checkout · PaySuite Gateway
              </span>
              <h3 className="text-base font-bold">Review & Pay Reservation</h3>
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Reservation Card Preview */}
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex gap-3">
              {booking.image ? (
                <img 
                  src={booking.image} 
                  alt={booking.title} 
                  className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-emerald-100 text-[#009A60] flex items-center justify-center font-bold text-xs shrink-0">
                  MozBook
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-[#008250] mb-1">
                  Ref: {booking.bookingRef}
                </span>
                <h4 className="font-bold text-gray-900 text-sm leading-tight truncate">
                  {booking.title}
                </h4>
                {(booking.city || booking.location) && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                    <MapPin size={12} className="shrink-0 text-gray-400" />
                    <span>{booking.city || booking.location}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span className="truncate">
                  {booking.startDate}
                  {booking.endDate && booking.endDate !== booking.startDate ? ` → ${booking.endDate}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 justify-end">
                <Users size={13} className="text-gray-400 shrink-0" />
                <span>
                  {booking.totalGuests} {booking.totalGuests === 1 ? 'Guest' : 'Guests'}
                  {booking.nights ? ` (${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'})` : ''}
                </span>
              </div>
            </div>

            {/* Weather-Dependent Booking Protection Flag */}
            {booking.isWeatherDependent && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[10px] uppercase tracking-wider">
                  <span>⚓ Weather-Dependent Activity Safeguard</span>
                </div>
                <p className="leading-snug text-amber-900/90 text-[10px]">
                  Protected by MozBook Maritime Safety Rules. If adverse conditions or INAM weather bans prevent departure, you are entitled to free rescheduling or an authoritative 100% full refund via PaySuite.
                </p>
              </div>
            )}

            {/* Stage 4A Marketplace Policy Snapshot & Deadline Disclosure */}
            {(() => {
              const effectiveTierId: CancellationTierId = booking.isNonRefundable
                ? 'non_refundable'
                : booking.isWeatherDependent
                ? 'weather_dependent'
                : booking.cancellationTier || 'flexible';
              const policy = CANCELLATION_POLICY_TIERS[effectiveTierId] || CANCELLATION_POLICY_TIERS.flexible;
              const deadlineIso = calculateCancellationDeadline(booking.startDate, policy.cutoffHours);
              const deadlineDate = new Date(deadlineIso);
              const formattedDeadline = `${deadlineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${deadlineDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} CAT`;

              return (
                <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-950 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#008250] text-[10px] uppercase tracking-wider">
                      📋 Policy: {policy.name}
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-800">
                      Version 1.0.0
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-emerald-900 font-medium">
                    {policy.summaryTerms}
                  </p>
                  {policy.cutoffHours > 0 && !booking.isNonRefundable && (
                    <div className="text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/50 flex items-center justify-between">
                      <span>Full refund cancellation cutoff:</span>
                      <span className="font-bold">{formattedDeadline}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Select Payment Rail (MZN)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* M-Pesa */}
              <button
                type="button"
                onClick={() => setSelectedMethod('mpesa')}
                disabled={isSubmitting}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMethod === 'mpesa'
                    ? 'border-red-600 bg-red-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Smartphone size={18} className={selectedMethod === 'mpesa' ? 'text-red-600' : 'text-gray-400'} />
                  {selectedMethod === 'mpesa' && (
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="font-bold text-xs text-gray-900 block">M-Pesa</span>
                  <span className="text-[10px] text-gray-500">Vodacom</span>
                </div>
              </button>

              {/* e-Mola */}
              <button
                type="button"
                onClick={() => setSelectedMethod('emola')}
                disabled={isSubmitting}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMethod === 'emola'
                    ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Smartphone size={18} className={selectedMethod === 'emola' ? 'text-amber-600' : 'text-gray-400'} />
                  {selectedMethod === 'emola' && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="font-bold text-xs text-gray-900 block">e-Mola</span>
                  <span className="text-[10px] text-gray-500">Movitel</span>
                </div>
              </button>

              {/* Card */}
              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                disabled={isSubmitting}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedMethod === 'card'
                    ? 'border-[#009A60] bg-emerald-50/50 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard size={18} className={selectedMethod === 'card' ? 'text-[#009A60]' : 'text-gray-400'} />
                  {selectedMethod === 'card' && (
                    <span className="w-2 h-2 rounded-full bg-[#009A60]"></span>
                  )}
                </div>
                <div className="mt-2">
                  <span className="font-bold text-xs text-gray-900 block">Bank Card</span>
                  <span className="text-[10px] text-gray-500">Visa / MC</span>
                </div>
              </button>
            </div>
          </div>

          {/* Amount Due Display */}
          <div className="bg-[#e6f7f0] border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#008250] block">
                Total Payable Now
              </span>
              <span className="text-xs text-gray-600">
                Authoritative Booking Total
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-[#008250]">
                MZN {booking.totalAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block">Inclusive of all local fees</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-red-800 animate-fade-in">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Payment Request Failed</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Affirmative Legal Acceptance Checkbox (Prompt 28A Phase 6) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#009A60] focus:ring-[#009A60] border-gray-300 cursor-pointer"
              />
              <span className="text-[11px] text-gray-700 leading-snug">
                I agree to the{' '}
                <a
                  href="/legal?tab=terms_customer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#009A60] hover:underline"
                >
                  Customer Terms & Conditions
                </a>{' '}
                and the{' '}
                <a
                  href="/legal?tab=cancellation_refund_policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#009A60] hover:underline"
                >
                  Cancellation & Refund Policy
                </a>
                . Operated by Elvira da Gloria Consulting SU, Lda.
              </span>
            </label>
            <p className="text-[10px] text-gray-500 pl-6.5 leading-relaxed">
              Your 15-minute inventory hold is confirmed upon PaySuite gateway connection. Single-payer rules apply to group participants.
            </p>
          </div>

          {/* Security & Guarantees */}
          <div className="space-y-1.5 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Lock size={13} className="text-[#009A60] shrink-0" />
              <span>Direct Bank of Mozambique-compliant 256-bit encryption via PaySuite</span>
            </div>
            <p className="leading-relaxed pl-5">
              Upon clicking below, you will be redirected to PaySuite to authorize payment. Your booking will confirm automatically upon settlement.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Connecting to PaySuite Gateway...</span>
                </>
              ) : (
                <>
                  <span>Pay MZN {booking.totalAmount.toLocaleString()} with PaySuite</span>
                  <ExternalLink size={16} />
                </>
              )}
            </button>

            {!isSubmitting && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors cursor-pointer text-center"
              >
                Pay Later (Saved in My Bookings)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
