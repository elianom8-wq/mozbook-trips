import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Globe,
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
  Sliders,
  Send,
  MessageSquare,
  Building,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  TravelPackage,
  DmcProfile,
  DmcSupplier,
  DmcEnquiry
} from '../types/dmc';
import {
  getHostTravelPackages,
  getDmcProfile,
  updateTravelPackage,
  deleteTravelPackage,
  getDmcSuppliers,
  saveDmcSupplier,
  deleteDmcSupplier,
  getDmcEnquiries,
  updateDmcEnquiryStatus
} from '../services/dmcService';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';
import { getHostBookings } from '../services/activityTripService';
import { ActivityBooking } from '../types/activityTrip';

type DmcTab = 
  | 'overview' 
  | 'packages' 
  | 'bookings' 
  | 'suppliers' 
  | 'schedules' 
  | 'enquiries' 
  | 'earnings' 
  | 'profile';

export default function DmcDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as DmcTab | null;

  const [activeTab, setActiveTab] = useState<DmcTab>(tabFromUrl || 'overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [profile, setProfile] = useState<DmcProfile | null>(null);
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [bookings, setBookings] = useState<ActivityBooking[]>([]);
  const [suppliers, setSuppliers] = useState<DmcSupplier[]>([]);
  const [enquiries, setEnquiries] = useState<DmcEnquiry[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupCategory, setNewSupCategory] = useState<'accommodation' | 'activity' | 'transport' | 'guide' | 'other'>('accommodation');
  const [newSupLocation, setNewSupLocation] = useState('Gorongosa / Sofala');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');

  // Quote modal
  const [quotingEnquiry, setQuotingEnquiry] = useState<DmcEnquiry | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number>(0);
  const [quoteNotes, setQuoteNotes] = useState<string>('');

  const loadData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const [prof, pkgs, bks] = await Promise.all([
        getDmcProfile(user.uid),
        getHostTravelPackages(user.uid),
        getHostBookings(user.uid)
      ]);
      setProfile(prof);
      setPackages(pkgs);
      // Filter bookings for package type or all partner bookings
      setBookings(bks);

      // Suppliers and enquiries from local storage
      setSuppliers(getDmcSuppliers(user.uid));
      setEnquiries(getDmcEnquiries(user.uid));
    } catch (e) {
      console.error('Error loading DMC dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (newTab: DmcTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Toggle package published status
  const handleTogglePublish = async (pkg: TravelPackage) => {
    const nextStatus = pkg.status === 'published' ? 'paused' : 'published';
    await updateTravelPackage(pkg.id, { status: nextStatus });
    setPackages(packages.map(p => p.id === pkg.id ? { ...p, status: nextStatus } : p));
  };

  // Delete package
  const handleDeletePackage = async (pkgId: string) => {
    if (window.confirm('Are you sure you want to delete this travel package?')) {
      await deleteTravelPackage(pkgId);
      setPackages(packages.filter(p => p.id !== pkgId));
    }
  };

  // Save new supplier
  const handleSaveSupplier = () => {
    if (!newSupName.trim() || !user?.uid) return;
    const added = saveDmcSupplier({
      hostId: user.uid,
      name: newSupName.trim(),
      category: newSupCategory,
      location: newSupLocation.trim(),
      contactName: newSupContact.trim(),
      contactEmail: newSupEmail.trim(),
      contactPhone: newSupPhone.trim(),
      contractStatus: 'active'
    });
    setSuppliers([added, ...suppliers]);
    setShowSupplierModal(false);
    setNewSupName('');
    setNewSupContact('');
    setNewSupEmail('');
    setNewSupPhone('');
  };

  const handleDeleteSupplierItem = (supId: string) => {
    deleteDmcSupplier(supId);
    setSuppliers(suppliers.filter(s => s.id !== supId));
  };

  // Quote submission
  const handleSendQuote = () => {
    if (!quotingEnquiry) return;
    updateDmcEnquiryStatus(quotingEnquiry.id, 'quoted', quoteAmount, quoteNotes);
    setEnquiries(enquiries.map(e => e.id === quotingEnquiry.id ? { ...e, status: 'quoted', quoteAmountMzn: quoteAmount, quoteNotes } : e));
    setQuotingEnquiry(null);
  };

  // Metrics calculations
  const metrics = useMemo(() => {
    const totalPackages = packages.length;
    const publishedPackages = packages.filter(p => p.status === 'published').length;
    const totalBookingsCount = bookings.length;
    const totalGuestsCount = bookings.reduce((sum, b) => sum + (b.totalGuests || 1), 0);
    const grossRevenueMzn = bookings
      .filter(b => b.paymentStatus === 'paid' || b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.totalMzn || 0), 0);
    
    const split = calculateCommission(grossRevenueMzn);
    const partnerNetMzn = split.partnerShare;
    const platformFeeMzn = split.commissionAmount;
    const pendingEnquiriesCount = enquiries.filter(e => e.status === 'new').length;

    return {
      totalPackages,
      publishedPackages,
      totalBookingsCount,
      totalGuestsCount,
      grossRevenueMzn,
      partnerNetMzn,
      platformFeeMzn,
      pendingEnquiriesCount
    };
  }, [packages, bookings, enquiries]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.destinations?.some(d => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = selectedStatusFilter === 'all' || p.status === selectedStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [packages, searchQuery, selectedStatusFilter]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28 pt-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/partner/dashboard" className="text-xs font-bold text-gray-400 hover:text-gray-700">
                Partner Dashboard
              </Link>
              <ChevronRight size={12} className="text-gray-400" />
              <span className="text-xs font-bold text-[#009A60]">Destination Management (DMC) Hub</span>
            </div>
            <h1 className="text-3xl font-black text-gray-950 flex items-center gap-3">
              <Globe className="text-[#009A60]" size={32} />
              <span>{profile?.tradingName || profile?.legalBusinessName || 'Travel / DMC Operations'}</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Multi-day itinerary coordination, supplier management, and package bookings across Mozambique.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Link
              to="/partner/dmc/packages/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus size={16} />
              <span>Create Travel Package</span>
            </Link>
          </div>
        </div>

        {/* Verification Status Warning / Banner */}
        {profile ? (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            profile.status === 'approved'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : profile.status === 'pending_review'
              ? 'bg-blue-50 border-blue-200 text-blue-950'
              : profile.status === 'additional_info_required'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-red-50 border-red-200 text-red-950'
          }`}>
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className={profile.status === 'approved' ? 'text-[#009A60]' : 'text-amber-600'} />
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">
                  DMC Operating Status: {profile.status.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-xs text-gray-600">
                  INATUR Registration: <strong>{profile.inaturLicenseNumber}</strong> | NUIT: <strong>{profile.nuit}</strong>
                  {profile.status === 'pending_review' && ' — Application is awaiting administrator verification.'}
                  {profile.adminNotes && ` — Admin Note: ${profile.adminNotes}`}
                </div>
              </div>
            </div>
            <Link
              to="/partner/dmc/onboard"
              className="text-xs font-bold text-[#009A60] hover:underline shrink-0"
            >
              Edit Business Details & Licences →
            </Link>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>
                <strong>DMC Profile Incomplete:</strong> Complete your INATUR operator registration and legal business details to verify your agency.
              </span>
            </div>
            <Link
              to="/partner/dmc/onboard"
              className="px-3 py-1.5 rounded-lg bg-[#009A60] text-white font-bold text-xs shrink-0"
            >
              Complete DMC Onboarding
            </Link>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', icon: Globe },
            { id: 'packages', label: `Packages (${packages.length})`, icon: Palmtree },
            { id: 'bookings', label: `Bookings (${bookings.length})`, icon: Luggage },
            { id: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Building },
            { id: 'schedules', label: 'Departures Calendar', icon: Calendar },
            { id: 'enquiries', label: `Enquiries (${enquiries.length})`, icon: MessageSquare },
            { id: 'earnings', label: 'Earnings & Payouts', icon: Wallet },
            { id: 'profile', label: 'Business Profile & KYC', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as DmcTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#009A60] text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Active Published Packages
                </span>
                <div className="text-2xl font-black text-gray-900">
                  {metrics.publishedPackages} <span className="text-xs font-medium text-gray-400">/ {metrics.totalPackages}</span>
                </div>
                <div className="text-[11px] text-[#009A60] font-bold">
                  {metrics.totalPackages > 0 ? 'Live in discovery' : 'No packages published'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Confirmed Bookings
                </span>
                <div className="text-2xl font-black text-gray-900">
                  {metrics.totalBookingsCount}
                </div>
                <div className="text-[11px] text-gray-500">
                  {metrics.totalGuestsCount} total travelers
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Gross Package Revenue
                </span>
                <div className="text-2xl font-black text-gray-900">
                  {metrics.grossRevenueMzn.toLocaleString()} <span className="text-xs text-gray-400">MZN</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-bold">
                  Net Share: {metrics.partnerNetMzn.toLocaleString()} MZN
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Custom Itinerary Inquiries
                </span>
                <div className="text-2xl font-black text-gray-900">
                  {metrics.pendingEnquiriesCount}
                </div>
                <div className="text-[11px] text-amber-700 font-bold">
                  {metrics.pendingEnquiriesCount > 0 ? 'Awaiting quotation' : 'All inquiries handled'}
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Packages */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-gray-900">Featured Multi-Day Packages</h3>
                  <Link to="/partner/dmc/packages/create" className="text-xs font-bold text-[#009A60] hover:underline flex items-center gap-1">
                    <Plus size={13} />
                    <span>New Package</span>
                  </Link>
                </div>

                {packages.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 space-y-3">
                    <Palmtree size={32} className="mx-auto text-gray-300" />
                    <p className="text-xs text-gray-500">You haven't created any travel packages yet.</p>
                    <Link
                      to="/partner/dmc/packages/create"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl"
                    >
                      <span>Create First Package</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {packages.slice(0, 3).map(pkg => (
                      <div key={pkg.id} className="p-4 rounded-2xl bg-white border border-gray-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img src={pkg.coverImage} alt={pkg.title} className="w-16 h-14 rounded-xl object-cover" />
                          <div>
                            <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{pkg.title}</h4>
                            <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span>{pkg.durationDays}D / {pkg.durationNights}N</span>
                              <span>•</span>
                              <span>{pkg.pricePerPersonMzn.toLocaleString()} MZN / person</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            to={`/packages/${pkg.id}`}
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            title="Preview Public Page"
                          >
                            <Eye size={15} />
                          </Link>
                          <Link
                            to={`/partner/dmc/packages/edit/${pkg.id}`}
                            className="p-2 rounded-lg text-gray-500 hover:text-[#009A60] hover:bg-emerald-50"
                            title="Edit Itinerary"
                          >
                            <Edit3 size={15} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Operating Scope Summary */}
              <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
                <h3 className="text-sm font-black text-gray-900">DMC Operational Footprint</h3>
                <div className="space-y-2 text-xs">
                  <div className="text-gray-500">Operating Regions:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile?.operatingRegions?.map(r => (
                      <span key={r} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                        {r}
                      </span>
                    )) || <span className="text-gray-400">No regions set</span>}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
                  <div className="text-gray-500">Specializations:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile?.specializations?.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold">
                        {s}
                      </span>
                    )) || <span className="text-gray-400">None selected</span>}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
                  Headquarters: <strong>{profile?.city || 'Maputo'}, {profile?.province || 'Mozambique'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PACKAGES & ITINERARIES */}
        {activeTab === 'packages' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search packages, destinations..."
                    className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] w-64 bg-white"
                  />
                </div>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60] bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <Link
                to="/partner/dmc/packages/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Plus size={16} />
                <span>Create New Package</span>
              </Link>
            </div>

            {filteredPackages.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
                <Palmtree size={36} className="mx-auto text-gray-300" />
                <h3 className="text-sm font-bold text-gray-700">No travel packages found</h3>
                <p className="text-xs text-gray-400">Create your first multi-day tour or safari package to start receiving bookings.</p>
                <Link
                  to="/partner/dmc/packages/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl"
                >
                  <Plus size={14} />
                  <span>Start Package Builder</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPackages.map(pkg => (
                  <div key={pkg.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="relative h-44 w-full">
                        <img src={pkg.coverImage} alt={pkg.title} className="w-full h-full object-cover" />
                        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          pkg.status === 'published'
                            ? 'bg-emerald-500 text-white'
                            : pkg.status === 'draft'
                            ? 'bg-gray-700 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {pkg.status}
                        </span>
                        <span className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                          {pkg.durationDays} Days / {pkg.durationNights} Nights
                        </span>
                      </div>

                      <div className="p-4 space-y-2">
                        <span className="text-[10px] font-bold text-[#009A60] uppercase tracking-wider">
                          {pkg.category}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
                          {pkg.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {pkg.shortDescription}
                        </p>
                        <div className="pt-2 flex items-center justify-between text-xs border-t border-gray-100">
                          <span className="text-gray-500">From / person:</span>
                          <span className="font-bold text-[#009A60]">{pkg.pricePerPersonMzn.toLocaleString()} MZN</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleTogglePublish(pkg)}
                        className="text-xs font-bold text-gray-600 hover:text-gray-900"
                      >
                        {pkg.status === 'published' ? 'Pause' : 'Publish'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/packages/${pkg.id}`}
                          className="p-1.5 text-gray-500 hover:text-gray-900"
                          title="View Itinerary"
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          to={`/partner/dmc/packages/edit/${pkg.id}`}
                          className="p-1.5 text-gray-500 hover:text-[#009A60]"
                          title="Edit Package"
                        >
                          <Edit3 size={15} />
                        </Link>
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500"
                          title="Delete Package"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BOOKINGS & CUSTOMERS */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">Package Reservations & Customer Manifests</h3>
                <p className="text-xs text-gray-500">Track traveler bookings, passenger counts, and departure schedules.</p>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
                <Luggage size={36} className="mx-auto text-gray-300" />
                <h4 className="text-sm font-bold text-gray-700">No bookings recorded yet</h4>
                <p className="text-xs text-gray-400">Confirmed traveler bookings on your published packages will appear here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Ref / Package</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Travel Dates</th>
                      <th className="p-3.5">Pax</th>
                      <th className="p-3.5">Total (MZN)</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50/50">
                        <td className="p-3.5">
                          <div className="font-bold text-gray-900">{b.bookingRef}</div>
                          <div className="text-[11px] text-gray-500 line-clamp-1">{b.activityTitle}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-gray-900">{b.customerName}</div>
                          <div className="text-[11px] text-gray-400">{b.customerEmail}</div>
                        </td>
                        <td className="p-3.5 text-gray-700">
                          {b.date}
                        </td>
                        <td className="p-3.5 font-bold text-gray-900">
                          {b.totalGuests || 1}
                        </td>
                        <td className="p-3.5 font-bold text-[#009A60]">
                          {b.totalMzn?.toLocaleString()} MZN
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUPPLIERS & SERVICE NETWORK */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">Preferred Suppliers in Mozambique</h3>
                <p className="text-xs text-gray-500">Manage linked accommodation lodges, boat charterers, and licensed safari guides.</p>
              </div>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl"
              >
                <Plus size={14} />
                <span>Add Supplier</span>
              </button>
            </div>

            {suppliers.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
                <Building size={36} className="mx-auto text-gray-300" />
                <h4 className="text-sm font-bold text-gray-700">No suppliers in your directory</h4>
                <p className="text-xs text-gray-400">Keep contacts and preferred rates for lodges, 4x4 drivers, and boat operators.</p>
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009A60] text-white text-xs font-bold rounded-xl"
                >
                  <Plus size={14} />
                  <span>Add First Supplier</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(sup => (
                  <div key={sup.id} className="p-4 rounded-2xl bg-white border border-gray-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#009A60] uppercase tracking-wider">
                          {sup.category}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900">{sup.name}</h4>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          <span>{sup.location}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSupplierItem(sup.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                      {sup.contactName && <div className="text-gray-600">Contact: {sup.contactName}</div>}
                      {sup.contactPhone && <div className="text-gray-600 flex items-center gap-1"><Phone size={11} /> {sup.contactPhone}</div>}
                      {sup.contactEmail && <div className="text-gray-600 flex items-center gap-1"><Mail size={11} /> {sup.contactEmail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DEPARTURES CALENDAR */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">Scheduled Group Departures</h3>
                <p className="text-xs text-gray-500">Upcoming departure dates across your multi-day packages.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map(pkg => (
                <div key={pkg.id} className="p-5 rounded-2xl bg-white border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">{pkg.title}</h4>
                    <span className="text-xs font-bold text-[#009A60] bg-emerald-50 px-2 py-0.5 rounded-md">
                      {pkg.durationDays}D / {pkg.durationNights}N
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-gray-500">Upcoming Departures:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.departureDates?.length > 0 ? (
                        pkg.departureDates.map(d => (
                          <span key={d} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-bold flex items-center gap-1">
                            <Calendar size={12} className="text-[#009A60]" />
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">Available daily on request</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Group Capacity: {pkg.minGroupSize} - {pkg.maxGroupSize} guests</span>
                    <Link to={`/partner/dmc/packages/edit/${pkg.id}`} className="text-[#009A60] font-bold hover:underline">
                      Edit Dates →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: CUSTOM ENQUIRIES */}
        {activeTab === 'enquiries' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">Customer Itinerary Requests & Custom Quotes</h3>
                <p className="text-xs text-gray-500">Inbound traveler quote requests for tailored packages.</p>
              </div>
            </div>

            {enquiries.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 space-y-3">
                <MessageSquare size={36} className="mx-auto text-gray-300" />
                <h4 className="text-sm font-bold text-gray-700">No enquiries received yet</h4>
                <p className="text-xs text-gray-400">Travelers requesting custom safari quotes or private packages will be listed here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {enquiries.map(enq => (
                  <div key={enq.id} className="p-5 rounded-2xl bg-white border border-gray-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            enq.status === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {enq.status}
                          </span>
                          <span className="text-xs text-gray-400">{enq.createdAt?.split('T')[0]}</span>
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mt-1">
                          {enq.customerName} — {enq.adultsCount} Adults, {enq.childrenCount || 0} Children
                        </h4>
                        <div className="text-xs text-gray-500">
                          Package: <strong>{enq.packageTitle || 'Custom Itinerary'}</strong> | Dates: <strong>{enq.travelDates}</strong>
                        </div>
                      </div>

                      {enq.status === 'new' && (
                        <button
                          onClick={() => {
                            setQuotingEnquiry(enq);
                            setQuoteAmount(enq.budgetMzn || 50000);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#009A60] text-white text-xs font-bold"
                        >
                          Provide Quote
                        </button>
                      )}
                    </div>

                    {enq.specialRequests && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        "{enq.specialRequests}"
                      </p>
                    )}

                    {enq.quoteAmountMzn && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-950 flex items-center justify-between">
                        <span>Quoted Amount: <strong>{enq.quoteAmountMzn.toLocaleString()} MZN</strong></span>
                        <span>{enq.quoteNotes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: EARNINGS & PAYOUTS */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-gray-200 space-y-4">
              <h3 className="text-lg font-black text-gray-900">Financial Summary & Commission Model</h3>
              <p className="text-xs text-gray-500">
                MozBook operates on the standard <strong>{PARTNER_SHARE_PERCENT}% Partner Share / {MOZBOOK_COMMISSION_PERCENT}% Platform Fee</strong> model.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium">Gross Bookings</div>
                  <div className="text-xl font-black text-gray-900">{metrics.grossRevenueMzn.toLocaleString()} MZN</div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium">Platform Fee ({MOZBOOK_COMMISSION_PERCENT}%)</div>
                  <div className="text-xl font-bold text-gray-600">{metrics.platformFeeMzn.toLocaleString()} MZN</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xs text-emerald-800 font-medium">Available Payout Balance ({PARTNER_SHARE_PERCENT}%)</div>
                  <div className="text-2xl font-black text-[#009A60]">{metrics.partnerNetMzn.toLocaleString()} MZN</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: PROFILE & KYC */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-gray-200 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900">Official DMC Business Profile</h3>
                  <p className="text-xs text-gray-500">Verified registration and tourism operating licence details.</p>
                </div>
                <Link
                  to="/partner/dmc/onboard"
                  className="px-4 py-2 rounded-xl bg-[#009A60] text-white text-xs font-bold"
                >
                  Edit Registration
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">Legal Business Name:</span>
                  <div className="font-bold text-gray-900">{profile?.legalBusinessName || 'Not configured'}</div>
                </div>

                <div>
                  <span className="text-gray-400">Trading Name:</span>
                  <div className="font-bold text-gray-900">{profile?.tradingName || 'Not configured'}</div>
                </div>

                <div>
                  <span className="text-gray-400">INATUR Tourism Licence:</span>
                  <div className="font-bold text-gray-900">{profile?.inaturLicenseNumber || 'Not provided'}</div>
                </div>

                <div>
                  <span className="text-gray-400">Tax Identification (NUIT):</span>
                  <div className="font-bold text-gray-900">{profile?.nuit || 'Not provided'}</div>
                </div>

                <div>
                  <span className="text-gray-400">Representative Contact:</span>
                  <div className="font-bold text-gray-900">{profile?.representativeName} ({profile?.representativePhone})</div>
                </div>

                <div>
                  <span className="text-gray-400">Headquarters Address:</span>
                  <div className="font-bold text-gray-900">{profile?.physicalAddress}, {profile?.city}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Supplier Modal */}
        {showSupplierModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900">Add Mozambique Preferred Supplier</h4>
                <button onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Supplier / Lodge Name *</label>
                  <input
                    type="text"
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    placeholder="e.g. Montebelo Gorongosa Safari Lodge"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Category</label>
                  <select
                    value={newSupCategory}
                    onChange={(e) => setNewSupCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  >
                    <option value="accommodation">Accommodation / Safari Lodge</option>
                    <option value="activity">Activity Operator / Scuba Centre</option>
                    <option value="transport">4x4 Transport / Boat Charter</option>
                    <option value="guide">Professional Guide / Ranger</option>
                    <option value="other">Other Tourism Supplier</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Location / Province</label>
                  <input
                    type="text"
                    value={newSupLocation}
                    onChange={(e) => setNewSupLocation(e.target.value)}
                    placeholder="e.g. Gorongosa, Sofala"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Contact Person & Phone</label>
                  <input
                    type="text"
                    value={newSupContact}
                    onChange={(e) => setNewSupContact(e.target.value)}
                    placeholder="e.g. Reservations Desk (+258 84 ...)"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="px-4 py-2 rounded-xl bg-[#009A60] text-white text-xs font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provide Quote Modal */}
        {quotingEnquiry && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-gray-900">Submit Custom Itinerary Quote</h4>
                <button onClick={() => setQuotingEnquiry(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-500">Traveler:</span>
                  <div className="font-bold text-gray-900">{quotingEnquiry.customerName} ({quotingEnquiry.travelDates})</div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Quote Total (MZN) *</label>
                  <input
                    type="number"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Notes / Included Upgrades</label>
                  <textarea
                    rows={3}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Include accommodation tier, 4x4 vehicle details, and cancellation terms..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setQuotingEnquiry(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendQuote}
                  className="px-4 py-2 rounded-xl bg-[#009A60] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Send Quote to Traveler</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
