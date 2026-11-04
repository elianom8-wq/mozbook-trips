import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Building2, 
  Home, 
  Compass, 
  Palmtree, 
  Calendar, 
  Users, 
  DollarSign, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  Clock, 
  Wallet, 
  Car, 
  Globe, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Check,
  Tag,
  Luggage,
  XCircle,
  FileText,
  Trash2,
  Power,
  QrCode,
  Sliders,
  AlertTriangle,
  CalendarCheck
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Listing, getHostListings, getUserVerification, HostVerification, SpecialOffer, calculateDocumentExpiry } from '../services/listingService';
import { 
  calculateNextSeasonalReview, 
  SeasonalReviewProjection, 
  confirmSeasonalOffer, 
  declineSeasonalOffer, 
  sendSeasonalReviewReminder 
} from '../services/seasonalRecurrenceService';
import { Booking } from '../types/booking';
import { getHostStayBookings, handleStayOperatorInventoryFailure } from '../services/bookingService';
import { ActivityTrip, ActivityBooking } from '../types/activityTrip';
import { TransportOffering, TransportVehicle } from '../types/transport';
import { OperatorInventoryDebit } from '../types/payment';
import QrCodeScannerModal from '../components/QrCodeScannerModal';
import { 
  getHostTransportServices, 
  updateTransportService, 
  deleteTransportService 
} from '../services/transportService';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';
import { 
  getActivitiesTrips, 
  getHostBookings, 
  getHostEarnings,
  updateBookingStatus,
  handleOperatorInventoryFailure,
  getOperatorDebits,
  updateActivityTrip
} from '../services/activityTripService';
import { DmcProfile } from '../types/dmc';
import { getDmcProfile, getHostTravelPackages } from '../services/dmcService';

type DashboardTab = 'overview' | 'accommodations' | 'activities' | 'trips' | 'transport' | 'bookings' | 'clients' | 'earnings' | 'account';

interface UnifiedClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality?: string;
  bookingRef: string;
  offeringTitle: string;
  offeringType: 'accommodation' | 'activity' | 'trip' | 'transport';
  dates: string;
  rawDate?: string;
  rawTime?: string;
  guestsCount: number;
  totalMzn: number;
  status: string;
  paymentStatus: string;
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as DashboardTab | null;

  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromUrl || 'overview');
  const [loading, setLoading] = useState(true);
  const [showQrScanner, setShowQrScanner] = useState(false);

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Business Data for this authenticated Partner
  const [listings, setListings] = useState<Listing[]>([]);
  const [stayBookings, setStayBookings] = useState<Booking[]>([]);
  const [experiences, setExperiences] = useState<ActivityTrip[]>([]);
  const [transports, setTransports] = useState<TransportOffering[]>([]);
  const [experienceBookings, setExperienceBookings] = useState<ActivityBooking[]>([]);
  const [earnings, setEarnings] = useState<{
    totalBookingsCount: number;
    completedCount: number;
    pendingCount: number;
    totalEarnedMzn: number;
    pendingMzn: number;
    totalDebitsMzn: number;
    operatorDebitsCount: number;
    availableForPayoutMzn: number;
    partnerShareGross: number;
    platformFeeMzn: number;
  }>({
    totalBookingsCount: 0,
    completedCount: 0,
    pendingCount: 0,
    totalEarnedMzn: 0,
    pendingMzn: 0,
    totalDebitsMzn: 0,
    operatorDebitsCount: 0,
    availableForPayoutMzn: 0,
    partnerShareGross: 0,
    platformFeeMzn: 0,
    completedPayoutsMzn: 0,
    completedRefundsMzn: 0,
    outstandingLiabilityMzn: 0
  });
  const [verification, setVerification] = useState<HostVerification | null>(null);
  const [dmcProfile, setDmcProfile] = useState<DmcProfile | null>(null);
  const [dmcPackagesCount, setDmcPackagesCount] = useState<number>(0);
  const [operatorDebitsList, setOperatorDebitsList] = useState<OperatorInventoryDebit[]>([]);
  const [inventoryConflictError, setInventoryConflictError] = useState<string | null>(null);

  const [cancelModalBooking, setCancelModalBooking] = useState<{
    id: string;
    ref: string;
    type: 'accommodation' | 'activity' | 'trip' | 'transport';
    title: string;
    totalMzn: number;
  } | null>(null);
  const [cancellationReason, setCancellationReason] = useState<'operator_inventory_failure' | 'customer_request' | 'weather' | 'other'>('operator_inventory_failure');
  const [cancellationNotes, setCancellationNotes] = useState('');
  const [processingCancellation, setProcessingCancellation] = useState(false);

  // Weather & Experience Rescheduling Modal State (Prompt 28B)
  const [rescheduleModalBooking, setRescheduleModalBooking] = useState<{
    id: string;
    ref: string;
    title: string;
    currentDate: string;
    currentTime?: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [processingReschedule, setProcessingReschedule] = useState(false);

  // Inventory Allocation & Blocked Dates Modal State (Prompt 28)
  const [inventoryModalItem, setInventoryModalItem] = useState<{
    id: string;
    title: string;
    type: 'activity' | 'trip' | 'accommodation';
    totalCapacity: number;
    mozbookCapacity: number;
    blockedDates: string[];
  } | null>(null);
  const [savingInventory, setSavingInventory] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState('');

  // Search & Filters
  const [bookingFilter, setBookingFilter] = useState<'all' | 'stays' | 'experiences' | 'transport' | 'pending' | 'confirmed' | 'completed'>('all');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Seasonal Offers Annual Review Modal State (FIX #6)
  const [seasonalReviewModal, setSeasonalReviewModal] = useState<{
    listing: Listing;
    offer: SpecialOffer;
    projection: SeasonalReviewProjection;
  } | null>(null);
  const [confirmingSeasonal, setConfirmingSeasonal] = useState(false);
  const [editSeasonalPrice, setEditSeasonalPrice] = useState<number>(0);
  const [editSeasonalStartDate, setEditSeasonalStartDate] = useState<string>('');
  const [editSeasonalEndDate, setEditSeasonalEndDate] = useState<string>('');
  const [seasonalReviewSuccess, setSeasonalReviewSuccess] = useState<string | null>(null);
  const [seasonalReminderSent, setSeasonalReminderSent] = useState<string | null>(null);

  // Computed list of seasonal offers eligible and due for annual review
  const pendingSeasonalReviews = useMemo(() => {
    return listings
      .filter(l => l.specialOffer && l.specialOffer.enabled && l.specialOffer.isSeasonal && l.specialOffer.annualRecurrenceEnabled)
      .map(l => {
        const projection = calculateNextSeasonalReview(l.specialOffer!);
        return {
          listing: l,
          offer: l.specialOffer!,
          projection,
        };
      })
  }, [listings]);

  // Document Expiry and Suspension Compliance (FIX #7)
  const hostDocExpiry = useMemo(() => {
    return calculateDocumentExpiry(verification?.expiryDate);
  }, [verification?.expiryDate]);

  const effectiveVerificationStatus = useMemo(() => {
    if (!verification) return 'unsubmitted';
    return hostDocExpiry.effectiveVerificationStatus(verification.status);
  }, [verification, hostDocExpiry]);

  const loadPartnerData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch Partner's Accommodations
      const userListings = await getHostListings(user.uid);
      setListings(userListings);

      // 2. Fetch Accommodations Bookings
      const listingIds = userListings.map(l => l.id).filter(Boolean);
      const userStayBookings = await getHostStayBookings(listingIds);
      setStayBookings(userStayBookings);

      // 3. Fetch Partner's Activities & Trips
      const userExperiences = await getActivitiesTrips({ hostId: user.uid });
      setExperiences(userExperiences);

      // 4. Fetch Partner's Transport Services
      const userTransports = await getHostTransportServices(user.uid);
      setTransports(userTransports);

      // 5. Fetch Activities & Trips Bookings
      const userExpBookings = await getHostBookings(user.uid);
      setExperienceBookings(userExpBookings);

      // 6. Fetch Operator Debits & Adjustments (Prompt 28)
      const debits = await getOperatorDebits(user.uid);
      setOperatorDebitsList(debits);
      const totalDebits = debits
        .filter(d => d.status === 'applied')
        .reduce((sum, d) => sum + (d.debitAmountMzn || 0), 0);

      // 7. Fetch Authoritative Earnings
      const userEarnings = await getHostEarnings(user.uid);
      
      // Calculate accommodation earnings addition (excluding refunded stays)
      const validStayBookings = userStayBookings.filter(b => 
        (b.status === 'confirmed' || b.status === 'completed') && 
        b.paymentStatus !== 'refunded'
      );
      const stayEarnedMzn = validStayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const pendingStayBookings = userStayBookings.filter(b => b.status === 'pending');
      const pendingStayMzn = pendingStayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      // Fetch completed payouts from payout_requests
      let completedPayoutsMzn = 0;
      try {
        const pQuery = query(collection(db, 'payout_requests'), where('hostId', '==', user.uid));
        const pSnap = await getDocs(pQuery);
        pSnap.forEach(d => {
          const p = d.data();
          if (p.status === 'completed') {
            completedPayoutsMzn += Number(p.amount || 0);
          }
        });
      } catch (pErr) {
        console.warn('Could not load payout requests:', pErr);
      }

      // Fetch completed refunds for host offerings
      let completedRefundsMzn = 0;
      try {
        const rQuery = query(collection(db, 'refunds'), where('hostId', '==', user.uid));
        const rSnap = await getDocs(rQuery);
        rSnap.forEach(d => {
          const r = d.data();
          if (r.status === 'completed') {
            completedRefundsMzn += Number(r.amount || 0);
          }
        });
      } catch (rErr) {
        console.warn('Could not load refunds:', rErr);
      }

      // Fetch open disputed payments to isolate without blocking undisputed balances
      let disputedPartnerShareMzn = 0;
      try {
        const payQuery = query(collection(db, 'payments'), where('hostId', '==', user.uid), where('status', '==', 'paid'));
        const paySnap = await getDocs(payQuery);
        paySnap.forEach(d => {
          const p = d.data();
          if (p.isDisputed && p.disputeStatus !== 'resolved') {
            const amt = Number(p.amount || 0);
            disputedPartnerShareMzn += Math.round(amt * 0.85);
          }
        });
      } catch (dErr) {
        console.warn('Could not load disputes:', dErr);
      }

      const totalGross = userEarnings.totalEarnedMzn + stayEarnedMzn;
      const commissionBreakdown = calculateCommission(totalGross);
      const partnerShare = commissionBreakdown.partnerShare;
      const totalDeductions = totalDebits + completedPayoutsMzn + disputedPartnerShareMzn;
      const netPayout = Math.max(0, partnerShare - totalDeductions);
      const outstandingLiability = totalDeductions > partnerShare ? totalDeductions - partnerShare : 0;

      setEarnings({
        totalBookingsCount: userEarnings.totalBookingsCount + userStayBookings.length,
        completedCount: userEarnings.completedCount + validStayBookings.length,
        pendingCount: userEarnings.pendingCount + pendingStayBookings.length,
        totalEarnedMzn: totalGross,
        pendingMzn: userEarnings.pendingMzn + pendingStayMzn,
        totalDebitsMzn: totalDebits,
        operatorDebitsCount: debits.length,
        availableForPayoutMzn: netPayout,
        partnerShareGross: partnerShare,
        platformFeeMzn: commissionBreakdown.commissionAmount,
        completedPayoutsMzn,
        completedRefundsMzn,
        outstandingLiabilityMzn: outstandingLiability
      });

      // 8. Fetch Verification Status
      const userVerif = await getUserVerification(user.uid);
      setVerification(userVerif);

      // 9. Fetch Travel / DMC Profile & Active Packages
      try {
        const dmc = await getDmcProfile(user.uid);
        setDmcProfile(dmc);
        if (dmc) {
          const pkgs = await getHostTravelPackages(user.uid);
          setDmcPackagesCount(pkgs.length);
        }
      } catch (dmcErr) {
        console.warn('Could not load DMC profile in partner dashboard:', dmcErr);
      }
    } catch (err) {
      console.error('Error loading partner dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, [user]);

  // Derived Activities vs Trips
  const activitiesList = experiences.filter(e => e.type === 'activity');
  const tripsList = experiences.filter(e => e.type === 'trip');

  // Derive Client Roster strictly from this partner's own bookings
  const unifiedClients: UnifiedClient[] = [
    ...stayBookings.map(b => ({
      id: `stay_${b.id}`,
      name: b.customerName || 'Guest',
      email: b.customerEmail || 'Not provided',
      phone: b.customerPhone || 'Not provided',
      bookingRef: b.bookingRef || b.id.slice(0, 8).toUpperCase(),
      offeringTitle: listings.find(l => l.id === b.listingId)?.title || 'Accommodation Stay',
      offeringType: 'accommodation' as const,
      dates: `${b.startDate} to ${b.endDate}`,
      guestsCount: b.guests || (b.adults ? b.adults + (b.children || 0) : 1),
      totalMzn: b.totalAmount,
      status: b.status,
      paymentStatus: b.paymentStatus
    })),
    ...experienceBookings.map(b => {
      const exp = experiences.find(e => e.id === b.activityId);
      const isTransport = exp?.type === 'transport' || transports.some(t => t.id === b.activityId);
      const offType: 'activity' | 'trip' | 'transport' = isTransport ? 'transport' : ((exp?.type || 'activity') as 'activity' | 'trip');
      return {
        id: `exp_${b.id}`,
        name: b.customerName || 'Guest',
        email: b.customerEmail || 'Not provided',
        phone: b.customerPhone || 'Not provided',
        nationality: b.customerNationality,
        bookingRef: b.bookingRef || b.id.slice(0, 8).toUpperCase(),
        offeringTitle: b.activityTitle || (isTransport ? 'Transport Transfer' : 'Tour / Activity'),
        offeringType: offType,
        dates: b.date + (b.time ? ` at ${b.time}` : ''),
        rawDate: b.date,
        rawTime: b.time,
        guestsCount: b.totalGuests || (b.adults + (b.children || 0)),
        totalMzn: b.totalMzn,
        status: b.status,
        paymentStatus: b.paymentStatus
      };
    })
  ];

  const filteredClients = unifiedClients.filter(c => {
    if (!clientSearchQuery.trim()) return true;
    const q = clientSearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.bookingRef.toLowerCase().includes(q) ||
      c.offeringTitle.toLowerCase().includes(q)
    );
  });

  // Handle status update for activity/trip/transport booking
  const handleUpdateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'completed' | 'cancelled') => {
    setStatusActionLoading(bookingId);
    try {
      await updateBookingStatus(bookingId, newStatus);
      setActionSuccessMsg(`Booking status updated to ${newStatus}`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadPartnerData();
    } catch (err) {
      console.error('Failed to update booking status:', err);
    } finally {
      setStatusActionLoading(null);
    }
  };

  // Handle Cancellation & Operator Inventory Accountability (Prompt 28C)
  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalBooking || !user) return;
    setProcessingCancellation(true);
    try {
      let idToken: string | undefined;
      try {
        idToken = await user.getIdToken();
      } catch (tErr) {
        console.warn('Could not get idToken:', tErr);
      }

      const cleanBookingId = cancelModalBooking.type === 'accommodation'
        ? cancelModalBooking.id
        : cancelModalBooking.id.replace('exp_', '');

      const res = await fetch('/api/partner/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify({
          bookingId: cleanBookingId,
          bookingCategory: cancelModalBooking.type === 'accommodation' ? 'stay' : 'activity',
          cancellationReason,
          notes: cancellationNotes
        })
      });

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        const errMsg = resJson?.error || `Failed to cancel booking (HTTP ${res.status})`;
        alert(errMsg);
        return;
      }

      if (cancellationReason === 'operator_inventory_failure') {
        setActionSuccessMsg(`Booking ${cancelModalBooking.ref} cancelled. 100% customer refund guarantee initiated with PaySuite and 15% operator accountability debit recorded.`);
      } else {
        setActionSuccessMsg(`Booking ${cancelModalBooking.ref} cancelled.`);
      }

      setTimeout(() => setActionSuccessMsg(null), 4000);
      setCancelModalBooking(null);
      setCancellationNotes('');
      await loadPartnerData();
    } catch (err: any) {
      console.error('Failed to cancel booking:', err);
      alert(err.message || 'Failed to process cancellation.');
    } finally {
      setProcessingCancellation(false);
    }
  };

  // Handle Authoritative Experience Rescheduling (Prompt 28B)
  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModalBooking || !rescheduleDate || !user) return;

    setProcessingReschedule(true);
    try {
      let idToken = '';
      try {
        idToken = await user.getIdToken();
      } catch (tErr) {
        console.warn('Could not get idToken:', tErr);
      }

      const res = await fetch('/api/bookings/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify({
          bookingId: rescheduleModalBooking.id,
          newDate: rescheduleDate,
          newTime: rescheduleTime || rescheduleModalBooking.currentTime || '',
          notes: rescheduleNotes,
          initiatedBy: 'operator'
        })
      });

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        const errMsg = resJson?.error || `Failed to reschedule booking (HTTP ${res.status})`;
        alert(errMsg);
        return;
      }

      setActionSuccessMsg(`Booking ${rescheduleModalBooking.ref} successfully rescheduled to ${rescheduleDate}. Inventory slot transferred.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      setRescheduleModalBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleNotes('');
      await loadPartnerData();
    } catch (err: any) {
      console.error('Failed to reschedule booking:', err);
      alert(err.message || 'Failed to reschedule reservation.');
    } finally {
      setProcessingReschedule(false);
    }
  };

  // Handle Inventory Allocation & Capacity Controls (Prompt 28C - Part 5)
  const handleSaveInventoryAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryModalItem || !user) return;
    setSavingInventory(true);
    setInventoryConflictError(null);
    try {
      let idToken: string | undefined;
      try {
        idToken = await user.getIdToken();
      } catch (tErr) {
        console.warn('Could not get idToken:', tErr);
      }

      const res = await fetch('/api/partner/inventory/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify({
          itemId: inventoryModalItem.id,
          itemType: inventoryModalItem.type,
          totalCapacity: inventoryModalItem.totalCapacity,
          mozbookCapacity: inventoryModalItem.mozbookCapacity,
          blockedDates: inventoryModalItem.blockedDates
        })
      });

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = resJson?.error || `Failed to update inventory allocation (HTTP ${res.status})`;
        setInventoryConflictError(errorMsg);
        return;
      }

      setActionSuccessMsg(`Inventory allocation updated for "${inventoryModalItem.title}".`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setInventoryModalItem(null);
      await loadPartnerData();
    } catch (err: any) {
      console.error('Failed to save inventory allocation:', err);
      setInventoryConflictError(err.message || 'Failed to save inventory changes.');
    } finally {
      setSavingInventory(false);
    }
  };

  // Seasonal Offers Annual Review Handlers (FIX #6)
  const handleOpenSeasonalReview = (listing: Listing, offer: SpecialOffer, projection: SeasonalReviewProjection) => {
    setSeasonalReviewModal({ listing, offer, projection });
    setEditSeasonalPrice(offer.specialPrice);
    setEditSeasonalStartDate(projection.projectedStartDate);
    setEditSeasonalEndDate(projection.projectedEndDate);
    setSeasonalReviewSuccess(null);
  };

  // Deep-link direct review screen handler (FIX #6 Requirement D)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reviewListingId = params.get('reviewListingId');
    if (reviewListingId && listings.length > 0) {
      const match = listings.find(l => l.id === reviewListingId);
      if (match && match.specialOffer && match.specialOffer.isSeasonal) {
        const proj = calculateNextSeasonalReview(match.specialOffer);
        handleOpenSeasonalReview(match, match.specialOffer, proj);
      }
    }
  }, [listings]);

  const handleConfirmSeasonalReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonalReviewModal || !seasonalReviewModal.listing.id) return;
    setConfirmingSeasonal(true);
    try {
      const { listing, offer, projection } = seasonalReviewModal;
      const success = await confirmSeasonalOffer(
        listing.id,
        offer,
        projection.upcomingYear,
        editSeasonalStartDate,
        editSeasonalEndDate,
        editSeasonalPrice
      );
      if (success) {
        setSeasonalReviewSuccess(`Promotion confirmed and updated for ${projection.seasonName} ${projection.upcomingYear}!`);
        setListings(prev => prev.map(l => {
          if (l.id === listing.id && l.specialOffer) {
            return {
              ...l,
              specialOffer: {
                ...l.specialOffer,
                startDate: editSeasonalStartDate,
                endDate: editSeasonalEndDate,
                specialPrice: editSeasonalPrice,
                targetYear: projection.upcomingYear,
                recurrenceStatus: 'confirmed',
                lastConfirmedAt: new Date().toISOString()
              }
            };
          }
          return l;
        }));
        setTimeout(() => {
          setSeasonalReviewModal(null);
          setSeasonalReviewSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      console.error('Failed to confirm seasonal offer:', err);
    } finally {
      setConfirmingSeasonal(false);
    }
  };

  const handleDeclineSeasonalReview = async (listing: Listing, offer: SpecialOffer, year: number) => {
    if (!listing.id) return;
    try {
      const success = await declineSeasonalOffer(listing.id, offer, year);
      if (success) {
        setListings(prev => prev.map(l => {
          if (l.id === listing.id && l.specialOffer) {
            return {
              ...l,
              specialOffer: {
                ...l.specialOffer,
                declinedYears: [...(l.specialOffer.declinedYears || []), year],
                recurrenceStatus: 'declined'
              }
            };
          }
          return l;
        }));
        if (seasonalReviewModal?.listing.id === listing.id) {
          setSeasonalReviewModal(null);
        }
      }
    } catch (err) {
      console.error('Failed to decline seasonal offer:', err);
    }
  };

  const handleSendSeasonalReminder = async (listing: Listing, offer: SpecialOffer, projection: SeasonalReviewProjection) => {
    if (!listing.id) return;
    try {
      const res = await sendSeasonalReviewReminder({
        listingId: listing.id,
        listingTitle: listing.title,
        hostId: user?.uid || listing.hostId,
        hostEmail: user?.email || undefined,
        hostName: user?.displayName || listing.hostName,
        seasonalTag: offer.seasonalTag || 'Seasonal',
        offerName: offer.offerName,
        upcomingYear: projection.upcomingYear,
        projectedStartDate: projection.projectedStartDate,
        projectedEndDate: projection.projectedEndDate,
        reviewDueDate: projection.reviewDueDate
      });
      if (res.success) {
        setSeasonalReminderSent(`Reminder alert dispatched for "${listing.title}" (${projection.seasonName} ${projection.upcomingYear}).`);
        setTimeout(() => setSeasonalReminderSent(null), 4000);
      }
    } catch (err) {
      console.error('Failed to send reminder:', err);
    }
  };

  // Operational controls for Transport services & fleet
  const handleToggleTransportStatus = async (transportId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'published' ? 'paused' : 'published';
    try {
      await updateTransportService(transportId, { status: nextStatus });
      setActionSuccessMsg(`Transport service set to ${nextStatus}.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setTransports(transports.map(t => t.id === transportId ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error('Failed to toggle transport status:', err);
    }
  };

  const handleToggleTransportVehicle = async (transportId: string, vehicleId: string) => {
    const target = transports.find(t => t.id === transportId);
    if (!target || !target.vehicles) return;
    const updatedVehicles = target.vehicles.map(v => 
      v.id === vehicleId ? { ...v, active: !v.active } : v
    );
    try {
      await updateTransportService(transportId, { vehicles: updatedVehicles });
      setActionSuccessMsg('Vehicle operational status updated.');
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setTransports(transports.map(t => t.id === transportId ? { ...t, vehicles: updatedVehicles } : t));
    } catch (err) {
      console.error('Failed to update vehicle status:', err);
    }
  };

  const handleDeleteTransport = async (transportId: string, title: string) => {
    if (!confirm(`Are you sure you want to remove the transport service "${title}"?`)) return;
    try {
      await deleteTransportService(transportId);
      setActionSuccessMsg(`Transport service "${title}" removed.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setTransports(transports.filter(t => t.id !== transportId));
    } catch (err) {
      console.error('Failed to delete transport service:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-200 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#009A60] flex items-center justify-center mx-auto">
            <Building2 size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Partner Authentication Required</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Please log in with your MozBook Partner account to access your business management area, listings, reservations, and earnings.
          </p>
          <Link
            to="/partner"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <span>Go to Partner Portal</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const renderSeasonalReviewsBanner = () => {
    if (pendingSeasonalReviews.length === 0) return null;
    return (
      <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/40 rounded-3xl p-6 shadow-sm space-y-4">
        {seasonalReminderSent && (
          <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-medium animate-fadeIn">
            ✓ {seasonalReminderSent}
          </div>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#008250] flex items-center justify-center shrink-0">
              <CalendarCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                  Action Required
                </span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Annual Seasonal Recurrence Review
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mt-1">
                {pendingSeasonalReviews.length} Seasonal Promotion{pendingSeasonalReviews.length > 1 ? 's' : ''} Awaiting Your Confirmation
              </h3>
              <p className="text-xs text-gray-600 max-w-2xl mt-0.5">
                Your seasonal offers are eligible for annual review. MozBook never automatically publishes or activates recurring seasonal discounts without your explicit review and confirmation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {pendingSeasonalReviews.map(({ listing, offer, projection }) => (
            <div key={listing.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col justify-between shadow-2xs space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900 line-clamp-1">{listing.title}</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold shrink-0">
                    {projection.seasonName} {projection.upcomingYear}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Offer Name:</span>
                    <span className="font-semibold text-gray-900">{offer.offerName || 'Special Seasonal Offer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proposed Dates:</span>
                    <span className="font-medium text-emerald-800">{projection.projectedStartDate} to {projection.projectedEndDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Promo Rate:</span>
                    <span className="font-bold text-gray-900">MZN {offer.specialPrice?.toLocaleString()} / night</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>Review Due:</span>
                    <span>{projection.reviewDueDate}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenSeasonalReview(listing, offer, projection)}
                  className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  <span>Review & Confirm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeclineSeasonalReview(listing, offer, projection.upcomingYear)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-36 pt-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Partner Identity Bar */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#009A60] border border-emerald-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={13} />
                <span>Partner Business Dashboard</span>
              </span>
              
              {/* Real Verification Badge (FIX #7) */}
              {effectiveVerificationStatus === 'suspended' ? (
                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1">
                  <AlertCircle size={13} className="text-rose-600" />
                  <span>Verification Suspended · Document Expired</span>
                </span>
              ) : verification?.status === 'verified' ? (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-[#008250] text-xs font-black flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>Approved — Your Listing Is Live</span>
                </span>
              ) : verification?.status === 'pending' ? (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black flex items-center gap-1.5 border border-amber-300 shadow-2xs">
                  <Clock size={14} className="text-amber-700" />
                  <span>Approval Pending · Awaiting Review</span>
                </span>
              ) : (
                <Link
                  to="/host/verify"
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <ShieldCheck size={13} />
                  <span>Verification Unsubmitted · Verify Now</span>
                </Link>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-gray-950 tracking-tight">
              {user.displayName || 'Mozambique Tourism Partner'}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 max-w-2xl leading-relaxed">
              Business control center for your registered properties, excursions, safari tours, reservations roster, and MZN disbursements.
            </p>
          </div>

          {/* Quick Launch & Onboard Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/partner"
              className="px-4 py-2.5 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>+ Onboard New Category</span>
            </Link>
            <button
              onClick={loadPartnerData}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh Business Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Document Expiry & Suspension Warning Banner (FIX #7) */}
        {effectiveVerificationStatus === 'suspended' && (
          <div className="bg-rose-50 border border-rose-300 text-rose-950 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-200/90 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 tracking-tight flex items-center gap-2">
                  <span>Mozambique Tourism Compliance: Host Verification Suspended</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] uppercase font-black">Suspended</span>
                </h3>
                <p className="text-xs text-rose-800/90 mt-1 leading-relaxed max-w-3xl">
                  Your registered identification ({verification?.docType === 'passport' ? 'Passport' : 'National ID (B.I.)'}) expired on <strong>{verification?.expiryDate}</strong> ({Math.abs(hostDocExpiry.daysUntilExpiry || 0)} days ago). Under Mozambique tourism safety regulations, partner listings cannot accept new bookings and automated disbursements are suspended until unexpired credentials are uploaded and verified.
                </p>
              </div>
            </div>
            <Link
              to="/host/verify"
              className="shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Renew Credentials Now</span>
            </Link>
          </div>
        )}

        {/* 90-Day Post-Expiry Grace Period Notice (FIX #7) */}
        {effectiveVerificationStatus !== 'suspended' && hostDocExpiry.inGracePeriod && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 tracking-tight">
                  90-Day Grace Period Active ({hostDocExpiry.gracePeriodDaysRemaining} days remaining)
                </h3>
                <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                  Your registered {verification?.docType === 'passport' ? 'passport' : 'B.I.'} expired on <strong>{verification?.expiryDate}</strong>. Stays and tours remain bookable during this 90-day grace period until <strong>{hostDocExpiry.suspensionEffectiveDate || 'grace period end'}</strong>. Please upload your renewed credentials before automatic suspension.
                </p>
              </div>
            </div>
            <Link
              to="/host/verify"
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Submit Renewal</span>
            </Link>
          </div>
        )}

        {/* Document Expiring Soon Notice (FIX #7) */}
        {effectiveVerificationStatus !== 'suspended' && !hostDocExpiry.inGracePeriod && hostDocExpiry.expiryStatus === 'expiring_soon' && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 tracking-tight">
                  Document Expiring Soon ({hostDocExpiry.daysUntilExpiry} days remaining)
                </h3>
                <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                  Your registered {verification?.docType === 'passport' ? 'passport' : 'B.I.'} expires on <strong>{verification?.expiryDate}</strong>. Please renew with the issuing authority and upload your updated document before expiration to avoid partner suspension.
                </p>
              </div>
            </div>
            <Link
              to="/host/verify"
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Renew Early</span>
            </Link>
          </div>
        )}

        {/* Global Action Banner */}
        {actionSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-[#008250] px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* OVERVIEW STATS CARDS */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Total Bookings</span>
            <div className="text-2xl font-black text-gray-900">
              {earnings.totalBookingsCount}
            </div>
            <span className="text-[11px] text-gray-500">
              {stayBookings.length} stays · {experienceBookings.length} experiences
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Active / Pending</span>
            <div className="text-2xl font-black text-amber-600">
              {earnings.pendingCount}
            </div>
            <span className="text-[11px] text-amber-700 font-medium">Awaiting fulfillment</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Guests Served</span>
            <div className="text-2xl font-black text-gray-900">
              {unifiedClients.reduce((sum, c) => sum + c.guestsCount, 0)}
            </div>
            <span className="text-[11px] text-gray-500">Across all offerings</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Net Business Earnings</span>
            <div className="text-2xl font-black text-[#009A60]">
              MZN {earnings.totalEarnedMzn.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-800 font-medium">Confirmed & completed</span>
          </div>

          <div className="bg-white rounded-2xl border-2 border-emerald-500 p-4 space-y-1 shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60] block">Available Payout</span>
            <div className="text-2xl font-black text-[#009A60]">
              MZN {earnings.availableForPayoutMzn.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">Partner share ({PARTNER_SHARE_PERCENT}%) · {MOZBOOK_COMMISSION_PERCENT}% MozBook commission</span>
          </div>

        </div>

        {/* Primary Dashboard Navigation Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex flex-wrap gap-1 shadow-2xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('accommodations')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'accommodations'
                ? 'bg-[#009A60] text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home size={14} />
            <span>Accommodation</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'accommodations' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {listings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('activities')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-[#009A60] text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Compass size={14} />
            <span>Activities</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {activitiesList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('trips')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'trips'
                ? 'bg-[#009A60] text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Palmtree size={14} />
            <span>Trips & Tours</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'trips' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {tripsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transport')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transport'
                ? 'bg-[#009A60] text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Car size={14} />
            <span>Transport</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'transport' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {transports.length}
            </span>
          </button>

          <Link
            to={dmcProfile?.status === 'approved' ? "/partner/dmc/dashboard" : "/partner/dmc/onboard"}
            className="py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
            title={dmcProfile?.status === 'approved' ? "Open DMC Dashboard" : "Travel / DMC Onboarding & Registration"}
          >
            <Globe size={14} className="text-[#009A60]" />
            <span>Travel / DMC {dmcProfile?.status === 'approved' ? 'Hub' : 'Operations'}</span>
          </Link>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar size={14} />
            <span>Bookings</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'bookings' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {unifiedClients.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={14} />
            <span>Client Roster</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'clients' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {unifiedClients.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('earnings')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'earnings'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wallet size={14} />
            <span>Payouts & Finance</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'account'
                ? 'bg-gray-900 text-white shadow-2xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Business Profile & KYC</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {renderSeasonalReviewsBanner()}
            
            {/* Published Offerings Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Accommodation Card */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#009A60] flex items-center justify-center">
                    <Home size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                    Accommodation
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Properties & Lodges</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Entire homes, holiday villas, lodge chalets, and multi-unit rooms.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-2xl font-black text-gray-900">{listings.length}</span>
                    <span className="text-xs text-gray-500 font-medium">published properties</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('accommodations')}
                    className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Properties</span>
                    <ArrowRight size={13} />
                  </button>
                  <Link
                    to="/host/create?partner=true"
                    className="text-xs font-bold text-gray-700 hover:text-gray-900"
                  >
                    + Add Listing
                  </Link>
                </div>
              </div>

              {/* Activities Card */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#009A60] flex items-center justify-center">
                    <Compass size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                    Activities
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Activities & Experiences</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Diving, snorkeling, quad biking, paragliding, and guided local sessions.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-2xl font-black text-gray-900">{activitiesList.length}</span>
                    <span className="text-xs text-gray-500 font-medium">published activities</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('activities')}
                    className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Activities</span>
                    <ArrowRight size={13} />
                  </button>
                  <Link
                    to="/host/activities/create?type=activity&partner=true"
                    className="text-xs font-bold text-gray-700 hover:text-gray-900"
                  >
                    + Add Activity
                  </Link>
                </div>
              </div>

              {/* Trips & Tours Card */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#009A60] flex items-center justify-center">
                    <Palmtree size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                    Trips & Tours
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Trips & Safaris</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Island dhow cruises, wildlife safaris, 4x4 overland trips, and multi-day tours.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-2xl font-black text-gray-900">{tripsList.length}</span>
                    <span className="text-xs text-gray-500 font-medium">published tours</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('trips')}
                    className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Tours</span>
                    <ArrowRight size={13} />
                  </button>
                  <Link
                    to="/host/activities/create?type=trip&partner=true"
                    className="text-xs font-bold text-gray-700 hover:text-gray-900"
                  >
                    + Add Tour
                  </Link>
                </div>
              </div>

              {/* Transport & Logistics Card */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#009A60] flex items-center justify-center">
                    <Car size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                    Transport
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Transport & Transfers</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Airport transfers, tourist shuttles, boat charters, and 4x4 bush shuttles.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-2xl font-black text-gray-900">{transports.length}</span>
                    <span className="text-xs text-gray-500 font-medium">published services</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('transport')}
                    className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage Transport</span>
                    <ArrowRight size={13} />
                  </button>
                  <Link
                    to="/partner/transport/create"
                    className="text-xs font-bold text-gray-700 hover:text-gray-900"
                  >
                    + Add Service
                  </Link>
                </div>
              </div>

            </div>

            {/* Travel / DMC Agency Operations (Canonical Partner Offering) */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs transition-all hover:border-emerald-200">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    dmcProfile?.status === 'approved'
                      ? 'bg-emerald-100 text-[#009A60]'
                      : dmcProfile?.status === 'pending_review'
                      ? 'bg-blue-100 text-blue-700'
                      : dmcProfile?.status === 'rejected'
                      ? 'bg-rose-100 text-rose-700'
                      : dmcProfile?.status === 'draft'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-50 text-[#009A60]'
                  }`}>
                    <Globe size={24} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">
                        Travel / DMC Agency Operations
                      </h3>
                      {!dmcProfile && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#009A60] border border-emerald-200 text-[11px] font-bold">
                          Partner Offering Available
                        </span>
                      )}
                      {dmcProfile?.status === 'approved' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-[#009A60]" />
                          <span>Verified DMC Partner</span>
                        </span>
                      )}
                      {dmcProfile?.status === 'pending_review' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold flex items-center gap-1">
                          <Clock size={12} className="text-blue-600" />
                          <span>Application Under Review</span>
                        </span>
                      )}
                      {dmcProfile?.status === 'draft' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                          <Clock size={12} className="text-amber-600" />
                          <span>Draft Application</span>
                        </span>
                      )}
                      {dmcProfile?.status === 'additional_info_required' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1">
                          <AlertCircle size={12} className="text-amber-700" />
                          <span>Information Required</span>
                        </span>
                      )}
                      {dmcProfile?.status === 'rejected' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold flex items-center gap-1">
                          <AlertCircle size={12} className="text-rose-600" />
                          <span>Review Feedback</span>
                        </span>
                      )}
                      {dmcProfile?.status === 'suspended' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-300 text-[11px] font-bold">
                          DMC Suspended
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-gray-600 font-medium">
                      Manage destination packages, multi-day itineraries, and coordinated travel experiences.
                    </p>
                    
                    {/* Dynamic state description */}
                    {!dmcProfile && (
                      <p className="text-xs text-gray-500">
                        Create multi-day bespoke itineraries, coordinate verified lodge and transport suppliers, and receive comprehensive traveler bookings across Mozambique.
                      </p>
                    )}
                    {dmcProfile?.status === 'approved' && (
                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="font-bold text-gray-800">{dmcProfile.tradingName || dmcProfile.legalBusinessName}</span>
                        <span>•</span>
                        <span className="font-semibold text-gray-700">{dmcPackagesCount} travel package{dmcPackagesCount === 1 ? '' : 's'}</span>
                        <span>•</span>
                        <span>INATUR Reg: <strong className="font-mono text-gray-700">{dmcProfile.inaturLicenseNumber}</strong></span>
                      </div>
                    )}
                    {dmcProfile?.status === 'pending_review' && (
                      <p className="text-xs text-blue-700">
                        Application for <strong className="text-blue-900">{dmcProfile.tradingName || dmcProfile.legalBusinessName}</strong> (INATUR License: <span className="font-mono">{dmcProfile.inaturLicenseNumber || 'On file'}</span>) has been submitted and is currently being audited by MozBook compliance.
                      </p>
                    )}
                    {dmcProfile?.status === 'draft' && (
                      <p className="text-xs text-amber-700 font-medium">
                        Your DMC onboarding application is partially saved. Complete your business details, operating provinces, and license documents to submit for verification.
                      </p>
                    )}
                    {dmcProfile?.status === 'rejected' && (
                      <p className="text-xs text-rose-700 font-medium">
                        Application not approved: {dmcProfile.rejectionReason || dmcProfile.adminNotes || 'Verification criteria could not be met. Review feedback and update your documents.'}
                      </p>
                    )}
                    {dmcProfile?.status === 'additional_info_required' && (
                      <p className="text-xs text-amber-800 font-medium">
                        Action required: {dmcProfile.adminNotes || 'Please provide updated license details or additional documentation.'}
                      </p>
                    )}
                    {dmcProfile?.status === 'suspended' && (
                      <p className="text-xs text-gray-600 font-medium">
                        DMC operations suspended: {dmcProfile.suspensionReason || dmcProfile.adminNotes || 'Please contact MozBook partner support.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
                  {!dmcProfile && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Complete DMC Registration</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {dmcProfile?.status === 'approved' && (
                    <>
                      <Link
                        to="/partner/dmc/dashboard"
                        className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Open DMC Dashboard</span>
                        <ArrowRight size={14} />
                      </Link>
                      <Link
                        to="/partner/dmc/packages/create"
                        className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Create Package</span>
                      </Link>
                    </>
                  )}
                  {dmcProfile?.status === 'draft' && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Continue Application</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {dmcProfile?.status === 'pending_review' && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Application Under Review</span>
                      <ChevronRight size={14} />
                    </Link>
                  )}
                  {dmcProfile?.status === 'rejected' && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Application Status</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {dmcProfile?.status === 'additional_info_required' && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Update Application</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}
                  {dmcProfile?.status === 'suspended' && (
                    <Link
                      to="/partner/dmc/onboard"
                      className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Application Status</span>
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Bookings Roster Preview */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Recent Customer Bookings</h3>
                  <p className="text-xs text-gray-500">Latest reservations across your accommodation and experiences</p>
                </div>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1"
                >
                  <span>View All Bookings ({unifiedClients.length})</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {unifiedClients.length === 0 ? (
                <div className="text-center py-10 text-gray-400 space-y-2">
                  <Luggage size={32} className="mx-auto text-gray-300" />
                  <p className="text-xs font-medium">No bookings received yet.</p>
                  <p className="text-[11px] text-gray-400">Customer reservations for your listings will appear here automatically.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {unifiedClients.slice(0, 5).map(client => (
                    <div key={client.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          client.offeringType === 'accommodation' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {client.offeringType === 'accommodation' ? <Home size={16} /> : <Compass size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">{client.name}</span>
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold">
                              {client.bookingRef}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {client.offeringTitle} · {client.dates} · {client.guestsCount} guest(s)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900 block">
                            MZN {client.totalMzn.toLocaleString()}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            client.status === 'confirmed' || client.status === 'completed' 
                              ? 'text-[#009A60]' 
                              : client.status === 'cancelled' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {client.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ACCOMMODATIONS */}
        {/* ============================================================== */}
        {activeTab === 'accommodations' && (
          <div className="space-y-4">
            {renderSeasonalReviewsBanner()}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Property Portfolio</h2>
                <p className="text-xs text-gray-500">Manage rates, units, images, and special offers</p>
              </div>
              <Link
                to="/host/create?partner=true"
                className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Add Property</span>
              </Link>
            </div>

            {listings.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-4">
                <Home size={40} className="mx-auto text-gray-300" />
                <h3 className="font-bold text-gray-900 text-base">No Accommodations Registered Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  List your beach villa, apartment, or safari lodge to begin accepting reservations from travelers across Mozambique.
                </p>
                <Link
                  to="/host/create?partner=true"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#009A60] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#008250]"
                >
                  <Plus size={14} />
                  <span>Register First Property</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map(listing => (
                  <div key={listing.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="relative h-44 bg-gray-100">
                        {listing.images && listing.images[0] ? (
                          <img
                            src={listing.images[0]}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Home size={32} />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                          {listing.residenceType || 'Property'}
                        </span>
                        {listing.status === 'published' ? (
                          <span className="absolute top-3 right-3 bg-emerald-600/95 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                            <CheckCircle2 size={11} />
                            <span>Live on MozBook</span>
                          </span>
                        ) : listing.status === 'draft' ? (
                          <span className="absolute top-3 right-3 bg-slate-700/90 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                            <span>Incomplete Draft</span>
                          </span>
                        ) : (
                          <span className="absolute top-3 right-3 bg-amber-600/95 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                            <Clock size={11} />
                            <span>Pending Approval</span>
                          </span>
                        )}
                        {listing.accommodations && listing.accommodations.length > 0 && (
                          <span className="absolute bottom-3 left-3 bg-emerald-950/80 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs border border-emerald-400/30">
                            {listing.accommodations.length} Units Managed
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                            <MapPin size={12} className="text-[#009A60]" />
                            <span>{listing.city || 'Mozambique'}</span>
                          </span>
                          <span className="text-xs font-black text-gray-900">
                            MZN {listing.price?.toLocaleString()} / night
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{listing.title}</h3>
                        <p className="text-xs text-gray-500 line-clamp-2">{listing.description}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/listing/${listing.id}`}
                          target="_blank"
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setInventoryModalItem({
                              id: listing.id || '',
                              title: listing.title,
                              type: 'accommodation',
                              totalCapacity: listing.totalLodgeUnits || listing.maxGuests || 4,
                              mozbookCapacity: listing.mozbookAllocatedUnits || listing.totalLodgeUnits || listing.maxGuests || 4,
                              blockedDates: listing.blockedDates || []
                            });
                            setNewBlockedDate('');
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders size={13} />
                          <span>Allocation ({listing.mozbookAllocatedUnits || listing.totalLodgeUnits || 'All'} Units)</span>
                        </button>
                      </div>
                      <Link
                        to={`/host/edit/${listing.id}`}
                        className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 size={13} />
                        <span>Edit Property</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: ACTIVITIES */}
        {/* ============================================================== */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Single-Session Activities & Experiences</h2>
                <p className="text-xs text-gray-500">Ocean diving, snorkeling, quad biking, and local workshops</p>
              </div>
              <Link
                to="/host/activities/create?type=activity&partner=true"
                className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Add Activity</span>
              </Link>
            </div>

            {activitiesList.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-4">
                <Compass size={40} className="mx-auto text-gray-300" />
                <h3 className="font-bold text-gray-900 text-base">No Activities Registered Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Add ocean adventures, snorkeling tours, or cultural workshops to receive traveler reservations.
                </p>
                <Link
                  to="/host/activities/create?type=activity&partner=true"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#009A60] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#008250]"
                >
                  <Plus size={14} />
                  <span>Register First Activity</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activitiesList.map(activity => (
                  <div key={activity.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="relative h-44 bg-gray-100">
                        {activity.coverImage ? (
                          <img
                            src={activity.coverImage}
                            alt={activity.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Compass size={32} />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                          {activity.category}
                        </span>
                        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          activity.id.startsWith('act_')
                            ? 'bg-amber-600 text-white ring-1 ring-amber-400'
                            : activity.status === 'published'
                            ? 'bg-[#009A60] text-white'
                            : 'bg-gray-800 text-white'
                        }`}>
                          {activity.id.startsWith('act_') ? 'Unsynced Local Draft' : activity.status}
                        </span>
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                            <Clock size={12} className="text-[#009A60]" />
                            <span>{activity.duration}</span>
                          </span>
                          <span className="text-xs font-black text-gray-900">
                            MZN {activity.priceAdult?.toLocaleString()} / adult
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{activity.title}</h3>
                        <p className="text-xs text-gray-500 line-clamp-2">{activity.shortDescription || activity.description}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Link
                          to="/trips"
                          target="_blank"
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setInventoryModalItem({
                              id: activity.id,
                              title: activity.title,
                              type: 'activity',
                              totalCapacity: activity.totalCapacity || activity.maxGuests,
                              mozbookCapacity: activity.mozbookAllocatedCapacity || activity.maxGuests,
                              blockedDates: activity.blockedDates || []
                            });
                            setNewBlockedDate('');
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders size={13} />
                          <span>MozBook Allocation ({activity.mozbookAllocatedCapacity || activity.maxGuests} Pax)</span>
                        </button>
                      </div>
                      <Link
                        to={`/host/activities/edit/${activity.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 size={13} />
                        <span>Edit Activity</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: TRIPS & TOURS */}
        {/* ============================================================== */}
        {activeTab === 'trips' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Organized Trips, Tours & Safaris</h2>
                <p className="text-xs text-gray-500">Excursions, dhow sailing cruises, multi-day tours, and game drives</p>
              </div>
              <Link
                to="/host/activities/create?type=trip&partner=true"
                className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ Add Trip / Tour</span>
              </Link>
            </div>

            {tripsList.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-4">
                <Palmtree size={40} className="mx-auto text-gray-300" />
                <h3 className="font-bold text-gray-900 text-base">No Trips or Tours Registered Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Add organized island crossings, national park game safaris, or multi-day coastal circuits.
                </p>
                <Link
                  to="/host/activities/create?type=trip&partner=true"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#009A60] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#008250]"
                >
                  <Plus size={14} />
                  <span>Register First Tour</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tripsList.map(trip => (
                  <div key={trip.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="relative h-44 bg-gray-100">
                        {trip.coverImage ? (
                          <img
                            src={trip.coverImage}
                            alt={trip.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Palmtree size={32} />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                          {trip.category}
                        </span>
                        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          trip.id.startsWith('act_')
                            ? 'bg-amber-600 text-white ring-1 ring-amber-400'
                            : trip.status === 'published'
                            ? 'bg-[#009A60] text-white'
                            : 'bg-gray-800 text-white'
                        }`}>
                          {trip.id.startsWith('act_') ? 'Unsynced Local Draft' : (trip.status || 'draft')}
                        </span>
                        {trip.multiDayDetails && (
                          <span className="absolute bottom-3 left-3 bg-emerald-950/80 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs border border-emerald-400/30">
                            {trip.multiDayDetails.days} Days / {trip.multiDayDetails.nights} Nights
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                            <Clock size={12} className="text-[#009A60]" />
                            <span>{trip.duration}</span>
                          </span>
                          <span className="text-xs font-black text-gray-900">
                            MZN {trip.priceAdult?.toLocaleString()} / adult
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{trip.title}</h3>
                        <p className="text-xs text-gray-500 line-clamp-2">{trip.shortDescription || trip.description}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Link
                          to="/trips"
                          target="_blank"
                          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setInventoryModalItem({
                              id: trip.id,
                              title: trip.title,
                              type: 'trip',
                              totalCapacity: trip.totalCapacity || trip.maxGuests,
                              mozbookCapacity: trip.mozbookAllocatedCapacity || trip.maxGuests,
                              blockedDates: trip.blockedDates || []
                            });
                            setNewBlockedDate('');
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders size={13} />
                          <span>MozBook Allocation ({trip.mozbookAllocatedCapacity || trip.maxGuests} Pax)</span>
                        </button>
                      </div>
                      <Link
                        to={`/host/activities/edit/${trip.id}`}
                        className="px-3.5 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 size={13} />
                        <span>Edit Tour</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB: TRANSPORT SERVICES & FLEET */}
        {/* ============================================================== */}
        {activeTab === 'transport' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Transport Services, Fleet & Team</h2>
                <p className="text-xs text-gray-500">
                  Manage your multi-vehicle fleet assets, operational crew members, routes, and MZN fares.
                </p>
              </div>
              <Link
                to="/partner/transport/create"
                className="px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>+ Add Transport Offering</span>
              </Link>
            </div>

            {/* Quick Fleet & Crew Metric Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Transport Services</span>
                <span className="text-2xl font-black text-gray-900">{transports.length}</span>
                <span className="text-[11px] text-gray-500 block">Published operational routes</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Fleet Vehicles & Vessels</span>
                <span className="text-2xl font-black text-[#009A60]">
                  {transports.reduce((sum, t) => sum + (t.vehicles?.length || (t.vehicleType ? 1 : 0)), 0)}
                </span>
                <span className="text-[11px] text-emerald-800 block">Across all registered offerings</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Operating Crew & Drivers</span>
                <span className="text-2xl font-black text-blue-600">
                  {transports.reduce((sum, t) => sum + (t.operatingMembers?.length || 0), 0)}
                </span>
                <span className="text-[11px] text-blue-800 block">Active dispatch contacts</span>
              </div>
            </div>

            {transports.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-4">
                <Car size={40} className="mx-auto text-gray-300" />
                <h3 className="font-bold text-gray-900 text-base">No Transport Services Registered Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Add airport transfers, 4x4 bush shuttles, boat charters, or private driver services with multiple vehicles and operating members.
                </p>
                <Link
                  to="/partner/transport/create"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#009A60] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#008250]"
                >
                  <Plus size={14} />
                  <span>Register First Transport Service</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {transports.map(t => {
                  const fleetList = t.vehicles && t.vehicles.length > 0 
                    ? t.vehicles 
                    : [{
                        id: 'legacy_1',
                        name: t.vehicleType,
                        transportType: t.vehicleType,
                        capacity: t.capacity?.maxPassengers || 4,
                        luggageCapacity: t.capacity?.luggageCapacityPieces || 4,
                        registrationNumber: t.licensePlateOrReg || '',
                        images: t.images || [],
                        active: true
                      }];
                  const teamList = t.operatingMembers || [];

                  return (
                    <div key={t.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                      <div>
                        {/* Header Media */}
                        <div className="relative h-48 bg-gray-100">
                          {t.coverImage || t.images?.[0] ? (
                            <img
                              src={t.coverImage || t.images[0]}
                              alt={t.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Car size={32} />
                            </div>
                          )}
                          <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                            {t.category}
                          </span>
                          <div className="absolute top-3 right-3 flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              t.id.startsWith('tr_')
                                ? 'bg-amber-600 text-white ring-1 ring-amber-400'
                                : t.status === 'published'
                                ? 'bg-[#009A60] text-white'
                                : 'bg-gray-800 text-white'
                            }`}>
                              {t.id.startsWith('tr_') ? 'Unsynced Local Draft' : t.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleTransportStatus(t.id, t.status)}
                              className="px-2 py-0.5 rounded-full bg-black/60 hover:bg-black text-white text-[10px] font-bold transition-colors cursor-pointer"
                              title={t.status === 'published' ? 'Pause Service' : 'Publish Service'}
                            >
                              {t.status === 'published' ? 'Pause' : 'Publish'}
                            </button>
                          </div>
                        </div>

                        {/* Service Meta */}
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                              <MapPin size={12} className="text-[#009A60]" />
                              <span>{t.city} ({t.route?.serviceArea || 'General Area'})</span>
                            </span>
                            <span className="text-sm font-black text-gray-900">
                              MZN {t.price?.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">({t.pricingType?.replace('_', ' ')})</span>
                            </span>
                          </div>

                          <div>
                            <h3 className="font-bold text-gray-900 text-base">{t.title}</h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.shortDescription || t.description}</p>
                          </div>

                          {/* Vehicle / Fleet Breakdown (Gap #1 & #2) */}
                          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Car size={12} className="text-[#009A60]" />
                                <span>Fleet Assets ({fleetList.length})</span>
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {fleetList.map(v => (
                                <div key={v.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-gray-100">
                                  <div className="flex items-center gap-2">
                                    {v.images?.[0] ? (
                                      <img src={v.images[0]} alt={v.name} className="w-8 h-8 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                        <Car size={14} />
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-bold text-gray-900 block truncate max-w-[170px]">{v.name}</span>
                                      <span className="text-[10px] text-gray-400">
                                        {v.registrationNumber ? `${v.registrationNumber} · ` : ''}Max {v.capacity} Pax
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTransportVehicle(t.id, v.id)}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                        v.active ? 'bg-emerald-50 text-[#008250] hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      }`}
                                      title="Toggle operational availability"
                                    >
                                      {v.active ? 'Active' : 'Inactive'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Operating Team Breakdown (Gap #3) */}
                          {teamList.length > 0 && (
                            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Users size={12} className="text-blue-600" />
                                <span>Operating Crew ({teamList.length})</span>
                              </span>
                              <div className="space-y-1">
                                {teamList.map(m => (
                                  <div key={m.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-gray-100">
                                    <div>
                                      <span className="font-semibold text-gray-900 block">{m.fullName}</span>
                                      <span className="text-[10px] text-gray-400">{m.role} · {m.phone}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      m.active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {m.active ? 'On Duty' : 'Off Duty'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="text-[10px] text-gray-400 block font-semibold">Your 85% Net Share:</span>
                          <span className="text-xs font-bold text-[#009A60]">
                            MZN {calculateCommission(t.price).partnerShare.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransport(t.id, t.title)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete transport service"
                          >
                            <Trash2 size={14} />
                          </button>
                          <Link
                            to={`/partner/transport/edit/${t.id}`}
                            className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <Edit3 size={13} />
                            <span>Edit Service & Fleet</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: BOOKINGS MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Unified Business Bookings</h2>
                <p className="text-xs text-gray-500">Manage stay arrivals, tour participant lists, and transfer reservations</p>
              </div>

              {/* Search & QR Scanner Action */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className="px-3.5 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <QrCode size={14} />
                  <span>Scan Guest QR Voucher</span>
                </button>

                <div className="relative min-w-[200px] flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search ref or guest name..."
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {(['all', 'stays', 'experiences', 'transport', 'pending', 'confirmed', 'completed'] as const).map(flt => (
                <button
                  key={flt}
                  onClick={() => setBookingFilter(flt)}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] cursor-pointer transition-colors ${
                    bookingFilter === flt
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {flt}
                </button>
              ))}
            </div>

            {unifiedClients.length === 0 ? (
              <div className="text-center py-12 text-gray-400 space-y-2">
                <Luggage size={36} className="mx-auto text-gray-300" />
                <p className="text-xs font-semibold">No reservations recorded for your business.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-2">Ref</th>
                      <th className="py-3 px-2">Guest</th>
                      <th className="py-3 px-2">Offering</th>
                      <th className="py-3 px-2">Dates</th>
                      <th className="py-3 px-2">Guests</th>
                      <th className="py-3 px-2">Total</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unifiedClients
                      .filter(b => {
                        if (bookingFilter === 'stays' && b.offeringType !== 'accommodation') return false;
                        if (bookingFilter === 'experiences' && (b.offeringType !== 'activity' && b.offeringType !== 'trip')) return false;
                        if (bookingFilter === 'transport' && b.offeringType !== 'transport') return false;
                        if (bookingFilter === 'pending' && b.status !== 'pending') return false;
                        if (bookingFilter === 'confirmed' && b.status !== 'confirmed') return false;
                        if (bookingFilter === 'completed' && b.status !== 'completed') return false;
                        if (bookingSearchQuery.trim()) {
                          const q = bookingSearchQuery.toLowerCase();
                          return b.name.toLowerCase().includes(q) || b.bookingRef.toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map(booking => (
                        <tr key={booking.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-2 font-mono font-bold text-gray-900">
                            {booking.bookingRef}
                          </td>
                          <td className="py-3.5 px-2">
                            <span className="font-bold text-gray-900 block">{booking.name}</span>
                            <span className="text-[10px] text-gray-400 block">{booking.phone}</span>
                          </td>
                          <td className="py-3.5 px-2">
                            <span className="font-semibold text-gray-800 line-clamp-1">{booking.offeringTitle}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{booking.offeringType}</span>
                          </td>
                          <td className="py-3.5 px-2 text-gray-600 whitespace-nowrap">
                            {booking.dates}
                          </td>
                          <td className="py-3.5 px-2 text-gray-700 font-semibold">
                            {booking.guestsCount}
                          </td>
                          <td className="py-3.5 px-2 font-black text-gray-900 whitespace-nowrap">
                            MZN {booking.totalMzn.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              booking.status === 'confirmed' || booking.status === 'completed'
                                ? 'bg-emerald-100 text-[#008250]'
                                : booking.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {booking.offeringType !== 'accommodation' && booking.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateBookingStatus(booking.id.replace('exp_', ''), 'confirmed')}
                                  disabled={statusActionLoading === booking.id.replace('exp_', '')}
                                  className="px-2.5 py-1 bg-[#009A60] hover:bg-[#008250] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Confirm
                                </button>
                              )}
                              {booking.offeringType !== 'accommodation' && booking.status === 'confirmed' && (
                                <button
                                  onClick={() => handleUpdateBookingStatus(booking.id.replace('exp_', ''), 'completed')}
                                  disabled={statusActionLoading === booking.id.replace('exp_', '')}
                                  className="px-2.5 py-1 bg-gray-900 hover:bg-black text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Complete
                                </button>
                              )}
                              {booking.offeringType !== 'accommodation' && (booking.status === 'pending' || booking.status === 'confirmed') && (
                                <button
                                  onClick={() => {
                                    const effDate = booking.rawDate || booking.dates.split(' ')[0] || '';
                                    setRescheduleModalBooking({
                                      id: booking.id.replace('exp_', ''),
                                      ref: booking.bookingRef,
                                      title: booking.offeringTitle,
                                      currentDate: effDate,
                                      currentTime: booking.rawTime
                                    });
                                    setRescheduleDate(effDate);
                                    setRescheduleTime(booking.rawTime || '');
                                    setRescheduleNotes('');
                                  }}
                                  className="px-2 py-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                                  title="Reschedule experience date (Adverse weather / Customer adjustment)"
                                >
                                  Reschedule...
                                </button>
                              )}
                              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                <button
                                  onClick={() => {
                                    setCancelModalBooking({
                                      id: booking.offeringType === 'accommodation' ? booking.id : booking.id.replace('exp_', ''),
                                      ref: booking.bookingRef,
                                      type: booking.offeringType,
                                      title: booking.offeringTitle,
                                      totalMzn: booking.totalMzn
                                    });
                                    setCancellationReason('operator_inventory_failure');
                                    setCancellationNotes('');
                                  }}
                                  className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                                  title="Cancel reservation (Inventory Failure / Severe Weather / Customer Request)"
                                >
                                  Cancel...
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: CLIENT ROSTER */}
        {/* ============================================================== */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Partner Client & Guest Directory</h2>
                <p className="text-xs text-gray-500">
                  Guest list derived strictly from your business reservations
                </p>
              </div>

              <div className="relative min-w-[260px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by guest name, phone, or ref..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                />
              </div>
            </div>

            {filteredClients.length === 0 ? (
              <div className="text-center py-12 text-gray-400 space-y-2">
                <Users size={36} className="mx-auto text-gray-300" />
                <p className="text-xs font-semibold">No clients match your filter criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map(client => (
                  <div key={client.id} className="p-4 rounded-2xl border border-gray-200 space-y-3 bg-gray-50/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#e6f7f0] text-[#009A60] flex items-center justify-center font-bold text-xs">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-gray-900 block">{client.name}</span>
                          {client.nationality && (
                            <span className="text-[10px] text-gray-500 block">{client.nationality}</span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded font-bold text-gray-700">
                        {client.bookingRef}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-gray-600 pt-1 border-t border-gray-200/60">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-[#009A60] shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-[#009A60] shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag size={12} className="text-[#009A60] shrink-0" />
                        <span className="truncate font-semibold">{client.offeringTitle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-[#009A60] shrink-0" />
                        <span>{client.dates}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-500">{client.guestsCount} Guest(s)</span>
                      <span className="text-gray-900">MZN {client.totalMzn.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 7: EARNINGS & PAYOUTS */}
        {/* ============================================================== */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            
            {/* MozBook Standard Business Terms Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#009A60] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  %
                </div>
                <div>
                  <span className="font-bold text-emerald-950 block">MozBook Standard Business Terms</span>
                  <span className="text-emerald-800 text-[11px]">
                    Partner Share: <strong>{PARTNER_SHARE_PERCENT}%</strong> · MozBook Platform Commission: <strong>{MOZBOOK_COMMISSION_PERCENT}%</strong>
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-emerald-900 bg-white px-3 py-1 rounded-full border border-emerald-200 font-bold uppercase tracking-wider self-start sm:self-auto">
                Global Business Rule
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border-2 border-emerald-500 p-5 space-y-1 shadow-2xs bg-gradient-to-br from-white to-emerald-50/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#009A60]">Available for Payout</span>
                <div className="text-2xl font-black text-[#009A60]">
                  MZN {earnings.availableForPayoutMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-emerald-800">Net payout after commission & debits</span>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Business Revenue</span>
                <div className="text-2xl font-black text-gray-900">
                  MZN {earnings.totalEarnedMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-gray-500">Gross completed booking sales</span>
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">MozBook Commission ({MOZBOOK_COMMISSION_PERCENT}%)</span>
                <div className="text-2xl font-black text-gray-700">
                  MZN {earnings.platformFeeMzn.toLocaleString()}
                </div>
                <span className="text-[11px] text-gray-500">Platform operations & 24/7 dispatch</span>
              </div>

              <div className={`bg-white rounded-3xl p-5 space-y-1 shadow-2xs border ${
                earnings.totalDebitsMzn > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  earnings.totalDebitsMzn > 0 ? 'text-rose-700' : 'text-gray-400'
                }`}>
                  Inventory Debits
                </span>
                <div className={`text-2xl font-black ${
                  earnings.totalDebitsMzn > 0 ? 'text-rose-700' : 'text-gray-900'
                }`}>
                  {earnings.totalDebitsMzn > 0 ? `-MZN ${earnings.totalDebitsMzn.toLocaleString()}` : 'MZN 0'}
                </div>
                <span className="text-[11px] text-gray-500">
                  {earnings.operatorDebitsCount} operator accountability adjustment(s)
                </span>
              </div>
            </div>

            {/* Operator Accountability & Deduction Ledger (Prompt 28) */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className={earnings.totalDebitsMzn > 0 ? 'text-rose-600' : 'text-emerald-600'} size={20} />
                    <span>Operator Inventory Accountability Ledger</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Transparent financial adjustments for inventory representations and overbooking failures
                  </p>
                </div>

                <div className="text-xs">
                  <span className={`px-3 py-1 rounded-full font-bold inline-flex items-center gap-1.5 ${
                    earnings.totalDebitsMzn === 0
                      ? 'bg-emerald-100 text-[#008250]'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {earnings.totalDebitsMzn === 0 ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Zero Inventory Failures · 100% Reliability</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={13} />
                        <span>{earnings.operatorDebitsCount} Active Debit Adjustment(s)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Net Payout Reconciliation Breakdown */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  Authoritative Payout Formula (Prompt 28C - Part 3 Reconciliation)
                </span>
                <div className="flex flex-wrap items-center gap-2 md:gap-4 font-mono font-medium text-gray-700">
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                    Gross: <strong>MZN {earnings.totalEarnedMzn.toLocaleString()}</strong>
                  </span>
                  <span>−</span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600">
                    Commission ({MOZBOOK_COMMISSION_PERCENT}%): <strong>MZN {earnings.platformFeeMzn.toLocaleString()}</strong>
                  </span>
                  <span>=</span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-[#009A60]">
                    Partner Share ({PARTNER_SHARE_PERCENT}%): <strong>MZN {earnings.partnerShareGross.toLocaleString()}</strong>
                  </span>
                  <span>−</span>
                  <span className={`bg-white px-2.5 py-1 rounded-lg border ${
                    earnings.totalDebitsMzn > 0 ? 'border-rose-300 text-rose-700 font-bold' : 'border-gray-200'
                  }`}>
                    Inventory Debits: <strong>MZN {earnings.totalDebitsMzn.toLocaleString()}</strong>
                  </span>
                  <span>−</span>
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-blue-700">
                    Completed Payouts: <strong>MZN {earnings.completedPayoutsMzn.toLocaleString()}</strong>
                  </span>
                  <span>=</span>
                  <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold shadow-2xs">
                    Net Available Payout: <strong>MZN {earnings.availableForPayoutMzn.toLocaleString()}</strong>
                  </span>
                </div>

                {earnings.outstandingLiabilityMzn > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 mt-2">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span>
                      <strong>Outstanding Partner Recovery: MZN {earnings.outstandingLiabilityMzn.toLocaleString()}</strong>.
                      Previous disbursements and accountability debits currently exceed new earnings. This will offset future bookings.
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-gray-500 italic mt-1.5">
                  * Financial safety rule: Partner debits and offsets operate strictly through authorized platform earnings. No unauthorized automatic deductions occur from external bank or mobile-money accounts.
                </p>
              </div>

              {/* Operator Debits Roster */}
              {operatorDebitsList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-center space-y-1">
                  <span className="font-bold text-xs text-emerald-950 block">No Inventory Failure Debits Recorded</span>
                  <p className="text-[11px] text-emerald-800">
                    All represented seats and units have been honoured. MozBook customers booked and completed their itineraries seamlessly.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-2">Date</th>
                        <th className="py-2.5 px-2">Booking Ref</th>
                        <th className="py-2.5 px-2">Offering</th>
                        <th className="py-2.5 px-2">Customer Protection</th>
                        <th className="py-2.5 px-2">Debit Amount</th>
                        <th className="py-2.5 px-2">Reason / Notes</th>
                        <th className="py-2.5 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {operatorDebitsList.map((debit) => (
                        <tr key={debit.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-3 px-2 text-gray-500 whitespace-nowrap">
                            {new Date(debit.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-gray-900">
                            {debit.bookingRef}
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-bold text-gray-900 block">{debit.offeringTitle}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{debit.bookingCategory}</span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#008250]">
                              100% Refund Guaranteed (MZN {debit.customerRefundAmountMzn.toLocaleString()})
                            </span>
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-rose-700 whitespace-nowrap">
                            -MZN {debit.debitAmountMzn.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-gray-600 max-w-xs">
                            <span className="block truncate text-[11px]">{debit.notes || 'Operator inventory failure'}</span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 capitalize">
                              {debit.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payout Channels & Method Configuration */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="text-[#009A60]" size={20} />
                    <span>Mozambique Payout Destination</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Direct settlements to authorized local mobile money or bank accounts
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="On-demand payout requests are currently unavailable. Earnings are disbursed automatically on scheduled weekly cycles."
                  className="px-5 py-2.5 bg-gray-100 text-gray-400 border border-gray-200 text-xs font-bold rounded-xl cursor-not-allowed transition-all shadow-none self-start sm:self-auto flex items-center gap-2"
                >
                  <AlertCircle size={14} className="text-gray-400" />
                  <span>Request Payout Now</span>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium">Unavailable</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">M-Pesa (Vodacom)</span>
                    <span className="text-[10px] font-bold bg-[#009A60] text-white px-2 py-0.5 rounded-full">Primary</span>
                  </div>
                  <p className="text-xs text-gray-600 font-mono">+258 84 ••• 9080</p>
                  <p className="text-[10px] text-gray-400">Instant transfer in MZN</p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 space-y-2 opacity-80 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">E-Mola (Movitel)</span>
                    <span className="text-[10px] text-gray-400">Backup</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">+258 86 ••• 1234</p>
                  <p className="text-[10px] text-gray-400">Instant transfer in MZN</p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 space-y-2 opacity-80 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Millennium BIM / BCI</span>
                    <span className="text-[10px] text-gray-400">Bank IBAN</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">MZ59 •••• 4410</p>
                  <p className="text-[10px] text-gray-400">1 business day</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs text-gray-600 space-y-1">
                <span className="font-bold text-gray-800 block">Automatic Weekly Disbursements</span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  MozBook executes automated payout batches every Tuesday morning for services completed in the preceding 7 days.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 8: BUSINESS PROFILE & KYC */}
        {/* ============================================================== */}
        {activeTab === 'account' && (
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Partner Business Profile & KYC Verification</h2>
              <p className="text-xs text-gray-500">Official registry and compliance credentials for MozBook operations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Account Details */}
              <div className="space-y-4 p-5 rounded-2xl border border-gray-200 bg-gray-50/40">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Building2 size={16} className="text-[#009A60]" />
                  <span>Business Account Credentials</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Registered Supplier Name</span>
                    <span className="font-bold text-gray-900">{user.displayName || 'Unnamed Partner'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Primary Email</span>
                    <span className="font-mono text-gray-800">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Partner Backend ID (hostId)</span>
                    <span className="font-mono text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block">
                      {user.uid}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real Verification Status */}
              <div className="space-y-4 p-5 rounded-2xl border border-gray-200 bg-gray-50/40 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#009A60]" />
                    <span>Mozambique Tourism Compliance Status</span>
                  </h3>

                  <div className="mt-3">
                    {effectiveVerificationStatus === 'suspended' ? (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300">
                          <AlertCircle size={14} className="text-rose-600" />
                          <span>Verification Suspended (Expired Document)</span>
                        </div>
                        <p className="text-xs text-rose-800 leading-relaxed">
                          Your registered credentials expired on {verification?.expiryDate}. Under Mozambique tourism regulations, partner verified status and listing privileges are suspended until renewed documents are verified.
                        </p>
                      </div>
                    ) : verification?.status === 'verified' ? (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#008250] text-xs font-bold">
                          <CheckCircle2 size={14} />
                          <span>Officially Verified Partner</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Your business licenses and government identification documents are verified with MozBook Compliance.
                        </p>
                      </div>
                    ) : verification?.status === 'pending' ? (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          <Clock size={14} />
                          <span>Documents Under Review</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Your submitted verification documents are currently undergoing review by MozBook compliance agents.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                          <AlertCircle size={14} />
                          <span>Verification Required</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Upload your National ID (BI), passport, or Alvará / commercial registration to earn the Verified Partner badge.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to="/host/verify"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <FileText size={13} />
                    <span>{effectiveVerificationStatus === 'suspended' ? 'Upload Renewed Document' : verification ? 'Manage Verification Documents' : 'Submit Verification Documents'}</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* QR Code Scanner for Host / Partner Check-In */}
      {showQrScanner && (
        <QrCodeScannerModal
          isOpen={showQrScanner}
          onClose={() => setShowQrScanner(false)}
          existingBookingRefs={unifiedClients.map((c) => c.bookingRef)}
          onVerifiedBooking={(ref) => {
            setBookingSearchQuery(ref);
            setActiveTab('bookings');
          }}
        />
      )}

      {/* INVENTORY ALLOCATION & AVAILABILITY MODAL (Prompt 28) */}
      {inventoryModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#008250] flex items-center justify-center">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Inventory Allocation & Availability</h3>
                  <p className="text-xs text-gray-500">MozBook Marketplace Capacity Controls</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInventoryModalItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInventoryAllocation} className="mt-5 space-y-5">
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Offering</span>
                <span className="font-bold text-sm text-gray-900 block truncate">{inventoryModalItem.title}</span>
                <span className="text-xs text-gray-500 capitalize">{inventoryModalItem.type}</span>
              </div>

              {/* Core Business Principle Notice */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs space-y-1.5 text-emerald-950">
                <span className="font-bold block flex items-center gap-1.5 text-[#008250]">
                  <CheckCircle2 size={14} />
                  <span>MozBook Bookable Inventory Principle</span>
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  MozBook only sells inventory explicitly allocated through this dashboard. If you sell seats or units through external offline channels, update your MozBook allocation or block dates below immediately to prevent overselling.
                </p>
              </div>

              {/* Conflict Guard Alert (Prompt 28C - Part 5) */}
              {inventoryConflictError && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-1 text-rose-950 animate-shake">
                  <span className="font-bold flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle size={15} />
                    <span>Server Allocation Conflict Guard</span>
                  </span>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                    {inventoryConflictError}
                  </p>
                  <p className="text-[10px] text-rose-600 mt-1">
                    Existing customer bookings are protected. You cannot reduce MozBook allocation or block dates below active reservations.
                  </p>
                </div>
              )}

              {/* Capacity Split Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Total Physical Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inventoryModalItem.totalCapacity}
                    onChange={(e) => setInventoryModalItem({
                      ...inventoryModalItem,
                      totalCapacity: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-gray-400 block mt-1">Total physical units or max guests</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    MozBook Allocated Inventory *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={inventoryModalItem.totalCapacity}
                    required
                    value={inventoryModalItem.mozbookCapacity}
                    onChange={(e) => setInventoryModalItem({
                      ...inventoryModalItem,
                      mozbookCapacity: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-gray-400 block mt-1">Bookable units on MozBook</span>
                </div>
              </div>

              {/* Blocked Dates Section */}
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Blocked Dates (Unavailable on MozBook)
                  </label>
                  <span className="text-[10px] text-gray-400">
                    {inventoryModalItem.blockedDates.length} blocked
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-[#009A60] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newBlockedDate) return;
                      if (!inventoryModalItem.blockedDates.includes(newBlockedDate)) {
                        setInventoryModalItem({
                          ...inventoryModalItem,
                          blockedDates: [...inventoryModalItem.blockedDates, newBlockedDate].sort()
                        });
                      }
                      setNewBlockedDate('');
                    }}
                    className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    + Block Date
                  </button>
                </div>

                {inventoryModalItem.blockedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inventoryModalItem.blockedDates.map((dateStr) => (
                      <span
                        key={dateStr}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200"
                      >
                        <span>{dateStr}</span>
                        <button
                          type="button"
                          onClick={() => setInventoryModalItem({
                            ...inventoryModalItem,
                            blockedDates: inventoryModalItem.blockedDates.filter(d => d !== dateStr)
                          })}
                          className="text-gray-400 hover:text-red-600 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setInventoryModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInventory}
                  className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingInventory ? 'Saving Allocation...' : 'Save Allocation & Availability'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL RESERVATION & OPERATOR ACCOUNTABILITY MODAL (Prompt 28) */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Cancel Confirmed Reservation</h3>
                  <p className="text-xs text-gray-500">Ref: {cancelModalBooking.ref}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCancellation} className="mt-5 space-y-4">
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Reservation</span>
                <span className="font-bold text-sm text-gray-900 block truncate">{cancelModalBooking.title}</span>
                <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                  <span className="capitalize">{cancelModalBooking.type}</span>
                  <span className="font-bold text-gray-900">MZN {cancelModalBooking.totalMzn.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Cancellation Reason *
                </label>
                <div className="space-y-2">
                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancellationReason === 'operator_inventory_failure'
                      ? 'border-rose-400 bg-rose-50/40 text-rose-950'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="cancellationReason"
                      value="operator_inventory_failure"
                      checked={cancellationReason === 'operator_inventory_failure'}
                      onChange={() => setCancellationReason('operator_inventory_failure')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold block">Operator Inventory Failure / Overbooking</span>
                      <span className="text-[11px] text-gray-500 block">
                        Sold externally or unable to honour represented capacity on MozBook.
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancellationReason === 'customer_request'
                      ? 'border-[#009A60] bg-emerald-50/40 text-emerald-950'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="cancellationReason"
                      value="customer_request"
                      checked={cancellationReason === 'customer_request'}
                      onChange={() => setCancellationReason('customer_request')}
                      className="mt-0.5 text-[#009A60] focus:ring-emerald-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold block">Customer Requested Cancellation</span>
                      <span className="text-[11px] text-gray-500 block">
                        Guest contacted you directly to cancel with mutual consent.
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    cancellationReason === 'weather'
                      ? 'border-amber-400 bg-amber-50/40 text-amber-950'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="cancellationReason"
                      value="weather"
                      checked={cancellationReason === 'weather'}
                      onChange={() => setCancellationReason('weather')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold block">Severe Weather / Maritime Force Majeure</span>
                      <span className="text-[11px] text-gray-500 block">
                        Adverse sea conditions, INAM storm warning, or cyclone advisory.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Operator Inventory Failure Impact Notice */}
              {cancellationReason === 'operator_inventory_failure' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertTriangle size={15} />
                    <span>Customer Protection Guarantee & Adjustment Notice</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-900">
                    MozBook guarantees a <strong>100% full refund</strong> (MZN {cancelModalBooking.totalMzn.toLocaleString()}) to the customer. A platform accountability debit of <strong>MZN {Math.round(cancelModalBooking.totalMzn * 0.15).toLocaleString()}</strong> (15% platform loss) will be recorded against your partner ledger.
                  </p>
                </div>
              )}

              {/* Severe Weather / Maritime Force Majeure Notice (Prompt 28B) */}
              {cancellationReason === 'weather' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Compass size={15} className="text-amber-600" />
                    <span>Fair Maritime Protection Policy (Prompt 28B & Legal Terms §4.2)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    Weather cancellations (swell, high winds, cyclone warnings, INAM maritime directives) protect traveler lives. Under MozBook policy, this is classified as <strong>mutual safety force majeure</strong>. <strong>No operator accountability debit</strong> is levied against your ledger.
                  </p>
                  <p className="text-[10px] text-amber-800">
                    • 100% customer refund is initiated via PaySuite.<br />
                    • Capacity hold for this time slot is immediately returned to available inventory.<br />
                    • If guest requested rescheduling instead, use the "Reschedule Reservation" feature.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Explanation / Operational Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide context regarding this cancellation..."
                  value={cancellationNotes}
                  onChange={(e) => setCancellationNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={processingCancellation}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {processingCancellation ? 'Processing...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Experience Modal (Prompt 28B) */}
      {rescheduleModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-700">
                <Compass size={20} className="text-amber-600" />
                <h3 className="font-bold text-gray-900 text-sm">Reschedule Experience</h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalBooking(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="mt-5 space-y-4">
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Reservation Ref: {rescheduleModalBooking.ref}</span>
                <span className="font-bold text-sm text-gray-900 block truncate">{rescheduleModalBooking.title}</span>
                <div className="text-xs text-gray-500 pt-1">
                  Current Scheduled Date: <strong className="text-gray-800">{rescheduleModalBooking.currentDate}</strong> {rescheduleModalBooking.currentTime ? `at ${rescheduleModalBooking.currentTime}` : ''}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Operating Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Departure Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Reason / Weather Context
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Rescheduled due to high swell and surf break in Ponta. Agreed with customer."
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                <span>Inventory holds will automatically transfer to the new date. No payment adjustments or customer debits are made.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalBooking(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingReschedule}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {processingReschedule ? 'Rescheduling...' : 'Confirm New Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEASONAL OFFERS ANNUAL REVIEW MODAL (FIX #6) */}
      {seasonalReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#008250] flex items-center justify-center">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Annual Seasonal Offer Review</h3>
                  <p className="text-xs text-gray-500">Confirm or adjust dates and rates for upcoming season</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeasonalReviewModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {seasonalReviewSuccess ? (
              <div className="my-6 p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
                <h4 className="font-bold text-gray-900 text-sm">{seasonalReviewSuccess}</h4>
                <p className="text-xs text-gray-600">Your seasonal promotion is now confirmed and scheduled.</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmSeasonalReview} className="mt-5 space-y-5">
                {/* Offering & Previous Saved Configuration */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Property</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                      {seasonalReviewModal.projection.seasonName} {seasonalReviewModal.projection.upcomingYear}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-900">{seasonalReviewModal.listing.title}</h4>
                  
                  <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500 block">Offer Name:</span>
                      <span className="font-semibold text-gray-900">
                        {seasonalReviewModal.offer.offerName || 'Special Promotional Offer'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Pricing Method:</span>
                      <span className="font-semibold text-gray-900 capitalize">
                        {seasonalReviewModal.offer.offerType} Discount
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Base Price:</span>
                      <span className="font-semibold text-gray-900">
                        MZN {seasonalReviewModal.offer.originalPrice?.toLocaleString()} / night
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Previous Dates:</span>
                      <span className="font-medium text-gray-700">
                        {seasonalReviewModal.offer.startDate} to {seasonalReviewModal.offer.endDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Important Review Policy Notice */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs space-y-1.5 text-emerald-950">
                  <span className="font-bold block flex items-center gap-1.5 text-[#008250]">
                    <Sparkles size={14} />
                    <span>Annual Review Confirmation Policy</span>
                  </span>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Seasonal promotions do not auto-publish without owner approval. Review the projected upcoming dates and nightly rate below. You can adjust the dates or price before confirming.
                  </p>
                </div>

                {/* Editable Dates for Upcoming Season */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Upcoming Season Dates ({seasonalReviewModal.projection.upcomingYear}) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Start Date</span>
                      <input
                        type="date"
                        required
                        value={editSeasonalStartDate}
                        onChange={(e) => setEditSeasonalStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">End Date</span>
                      <input
                        type="date"
                        required
                        value={editSeasonalEndDate}
                        onChange={(e) => setEditSeasonalEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Calculated for upcoming {seasonalReviewModal.projection.seasonName}. Moving occasions (e.g. Easter) are projected dynamically.
                  </p>
                </div>

                {/* Editable Nightly Special Price */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Confirmed Promotional Rate (MZN / Night) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editSeasonalPrice}
                    onChange={(e) => setEditSeasonalPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Original listing price is MZN {seasonalReviewModal.offer.originalPrice?.toLocaleString()}.
                  </span>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeclineSeasonalReview(seasonalReviewModal.listing, seasonalReviewModal.offer, seasonalReviewModal.projection.upcomingYear)}
                      className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      Decline for {seasonalReviewModal.projection.upcomingYear}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSeasonalReminder(seasonalReviewModal.listing, seasonalReviewModal.offer, seasonalReviewModal.projection)}
                      className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Mail size={12} />
                      <span>Dispatch Alert</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSeasonalReviewModal(null)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={confirmingSeasonal}
                      className="px-5 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      <span>{confirmingSeasonal ? 'Confirming...' : `Confirm & Activate for ${seasonalReviewModal.projection.upcomingYear}`}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
