import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Globe,
  Building2,
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  Info,
  Check,
  ChevronRight,
  Calendar,
  Save,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DmcProfile,
  MOZAMBIQUE_REGIONS,
  MozambiqueRegion,
  DMC_SPECIALIZATIONS,
  DmcSpecialization,
  DmcVerificationStatus,
  DmcDocumentRecord
} from '../types/dmc';
import { getDmcProfile, submitDmcOnboarding } from '../services/dmcService';
import { MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../config/platformCommission';

const AVAILABLE_LANGUAGES = [
  'Portuguese',
  'English',
  'French',
  'German',
  'Italian',
  'Spanish',
  'Changana / Xichangana',
  'Sena',
  'Swahili / Kiswahili'
];

const AVAILABLE_SERVICES = [
  'Custom Tailored Itineraries',
  'Multi-Day Safari & Bush Tours',
  'Coastal & Marine Island Charters',
  'Ground Transport & 4x4 Logistics',
  'Airport Meet-and-Greet & VIP Transfers',
  'Certified Multilingual Safari Guides',
  'MICE, Corporate & Conference Logistics',
  'Hotel, Lodge & Resort Reservations'
];

function getDocumentStatusBadge(
  docUrl?: string,
  record?: DmcDocumentRecord
): { label: string; badgeClass: string; iconType: 'verified' | 'pending' | 'rejected' | 'expired' | 'missing' } {
  if (record) {
    if (record.status === 'verified') {
      return {
        label: 'Verified',
        badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        iconType: 'verified'
      };
    }
    if (record.status === 'rejected') {
      return {
        label: record.rejectionReason ? `Rejected: ${record.rejectionReason}` : 'Rejected',
        badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
        iconType: 'rejected'
      };
    }
    if (record.status === 'expired') {
      return {
        label: 'Expired',
        badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
        iconType: 'expired'
      };
    }
    if (record.status === 'pending_review' || record.documentUrl || (docUrl && docUrl.trim().length > 0)) {
      return {
        label: 'Submitted — Pending Review',
        badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200',
        iconType: 'pending'
      };
    }
  }

  if (docUrl && docUrl.trim().length > 0) {
    return {
      label: 'Submitted — Pending Review',
      badgeClass: 'text-blue-700 bg-blue-50 border border-blue-200',
      iconType: 'pending'
    };
  }

  return {
    label: 'Not Uploaded — Required',
    badgeClass: 'text-gray-600 bg-gray-100 border border-gray-200',
    iconType: 'missing'
  };
}

export default function DmcOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [nuit, setNuit] = useState('');
  const [inaturLicenseNumber, setInaturLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [commercialRegistrationNumber, setCommercialRegistrationNumber] = useState('');

  const [representativeName, setRepresentativeName] = useState(user?.displayName || '');
  const [representativeRole, setRepresentativeRole] = useState('Managing Director / Operations Lead');
  const [representativePhone, setRepresentativePhone] = useState('');
  const [representativeEmail, setRepresentativeEmail] = useState(user?.email || '');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [city, setCity] = useState('Maputo');
  const [province, setProvince] = useState('Maputo Cidade');

  const [operatingRegions, setOperatingRegions] = useState<MozambiqueRegion[]>([
    'Maputo & South',
    'Inhambane, Tofo & Barra'
  ]);
  const [specializations, setSpecializations] = useState<DmcSpecialization[]>([
    'Wildlife Safaris & Conservation',
    'Coastal & Marine Expeditions'
  ]);
  const [languagesSupported, setLanguagesSupported] = useState<string[]>(['Portuguese', 'English']);
  const [servicesOffered, setServicesOffered] = useState<string[]>([
    'Custom Tailored Itineraries',
    'Multi-Day Safari & Bush Tours',
    'Airport Meet-and-Greet & VIP Transfers'
  ]);

  const [liabilityInsuranceInsurer, setLiabilityInsuranceInsurer] = useState('');
  const [liabilityInsurancePolicy, setLiabilityInsurancePolicy] = useState('');
  const [liabilityInsuranceExpiry, setLiabilityInsuranceExpiry] = useState('');
  const [licenseDocUrl, setLicenseDocUrl] = useState('');
  const [commercialRegDocUrl, setCommercialRegDocUrl] = useState('');
  const [insuranceDocUrl, setInsuranceDocUrl] = useState('');

  const [existingProfile, setExistingProfile] = useState<DmcProfile | null>(null);

  // Load existing profile if any
  useEffect(() => {
    async function fetchExisting() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      try {
        const profile = await getDmcProfile(user.uid);
        if (profile) {
          setExistingProfile(profile);
          setLegalBusinessName(profile.legalBusinessName || '');
          setTradingName(profile.tradingName || '');
          setNuit(profile.nuit || '');
          setInaturLicenseNumber(profile.inaturLicenseNumber || '');
          setLicenseExpiryDate(profile.licenseExpiryDate || '');
          setCommercialRegistrationNumber(profile.commercialRegistrationNumber || '');
          setRepresentativeName(profile.representativeName || '');
          setRepresentativeRole(profile.representativeRole || '');
          setRepresentativePhone(profile.representativePhone || '');
          setRepresentativeEmail(profile.representativeEmail || '');
          setPhysicalAddress(profile.physicalAddress || '');
          setCity(profile.city || 'Maputo');
          setProvince(profile.province || 'Maputo Cidade');
          if (profile.operatingRegions?.length) setOperatingRegions(profile.operatingRegions);
          if (profile.specializations?.length) setSpecializations(profile.specializations);
          if (profile.languagesSupported?.length) setLanguagesSupported(profile.languagesSupported);
          if (profile.servicesOffered?.length) setServicesOffered(profile.servicesOffered);
          setLiabilityInsuranceInsurer(profile.liabilityInsuranceInsurer || '');
          setLiabilityInsurancePolicy(profile.liabilityInsurancePolicy || '');
          setLiabilityInsuranceExpiry(profile.liabilityInsuranceExpiry || '');
          setLicenseDocUrl(profile.licenseDocUrl || '');
          setCommercialRegDocUrl(profile.commercialRegDocUrl || '');
          setInsuranceDocUrl(profile.insuranceDocUrl || '');
        }
      } catch (e) {
        console.error('Error fetching DMC profile:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchExisting();
  }, [user?.uid]);

  const toggleRegion = (region: MozambiqueRegion) => {
    setOperatingRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const toggleSpecialization = (spec: DmcSpecialization) => {
    setSpecializations(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const toggleLanguage = (lang: string) => {
    setLanguagesSupported(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const toggleService = (srv: string) => {
    setServicesOffered(prev =>
      prev.includes(srv) ? prev.filter(s => s !== srv) : [...prev, srv]
    );
  };

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!legalBusinessName.trim()) {
        setErrorMessage('Please provide your legal business name.');
        return false;
      }
      if (!tradingName.trim()) {
        setErrorMessage('Please provide your trading / brand name.');
        return false;
      }
      if (!nuit.trim()) {
        setErrorMessage('NUIT (tax identification number) is required.');
        return false;
      }
      if (!inaturLicenseNumber.trim()) {
        setErrorMessage('INATUR Tourism Operator License Number is required.');
        return false;
      }
      if (!licenseExpiryDate) {
        setErrorMessage('Please specify your INATUR license expiry date.');
        return false;
      }
    } else if (step === 2) {
      if (!representativeName.trim()) {
        setErrorMessage('Authorized representative name is required.');
        return false;
      }
      if (!representativePhone.trim()) {
        setErrorMessage('Contact phone number is required.');
        return false;
      }
      if (!representativeEmail.trim() || !representativeEmail.includes('@')) {
        setErrorMessage('A valid representative email address is required.');
        return false;
      }
      if (!physicalAddress.trim()) {
        setErrorMessage('Physical office address in Mozambique is required.');
        return false;
      }
    } else if (step === 3) {
      if (operatingRegions.length === 0) {
        setErrorMessage('Select at least one Mozambique operating region.');
        return false;
      }
      if (specializations.length === 0) {
        setErrorMessage('Select at least one tourism specialization.');
        return false;
      }
      if (servicesOffered.length === 0) {
        setErrorMessage('Select at least one service offered.');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4) as any);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1) as any);
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!isDraft && !validateStep(currentStep)) return;
    if (!user?.uid) {
      setErrorMessage('Please sign in to submit your DMC onboarding application.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Omit<DmcProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        userEmail: user.email || representativeEmail,
        legalBusinessName: legalBusinessName.trim(),
        tradingName: tradingName.trim(),
        nuit: nuit.trim(),
        inaturLicenseNumber: inaturLicenseNumber.trim(),
        licenseExpiryDate,
        commercialRegistrationNumber: commercialRegistrationNumber.trim(),
        representativeName: representativeName.trim(),
        representativeRole: representativeRole.trim(),
        representativePhone: representativePhone.trim(),
        representativeEmail: representativeEmail.trim(),
        physicalAddress: physicalAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        operatingRegions,
        specializations,
        languagesSupported,
        servicesOffered,
        liabilityInsuranceInsurer: liabilityInsuranceInsurer.trim(),
        licenseDocUrl: licenseDocUrl.trim() || undefined,
        commercialRegDocUrl: commercialRegDocUrl.trim() || undefined,
        insuranceDocUrl: insuranceDocUrl.trim() || undefined,
        documentRecords: {
          inaturLicense: existingProfile?.documentRecords?.inaturLicense || (licenseDocUrl.trim() ? {
            documentUrl: licenseDocUrl.trim(),
            status: 'pending_review',
            uploadedAt: new Date().toISOString()
          } : {
            status: 'not_uploaded'
          }),
          commercialCertificate: existingProfile?.documentRecords?.commercialCertificate || (commercialRegDocUrl.trim() ? {
            documentUrl: commercialRegDocUrl.trim(),
            status: 'pending_review',
            uploadedAt: new Date().toISOString()
          } : {
            status: 'not_uploaded'
          }),
          liabilityInsurance: existingProfile?.documentRecords?.liabilityInsurance || (insuranceDocUrl.trim() ? {
            documentUrl: insuranceDocUrl.trim(),
            status: 'pending_review',
            uploadedAt: new Date().toISOString()
          } : {
            status: 'not_uploaded'
          })
        },
        status: isDraft ? 'draft' : 'pending_review'
      };

      const saved = await submitDmcOnboarding(payload, isDraft);
      setExistingProfile(saved);

      if (isDraft) {
        setSuccessMessage('Draft saved successfully. You can return at any time to complete your submission.');
      } else {
        setSuccessMessage('Application submitted for administrative verification! Your review is now pending.');
        setTimeout(() => {
          navigate('/partner/dmc/dashboard');
        }, 1800);
      }
    } catch (e: any) {
      console.error('Error submitting DMC profile:', e);
      setErrorMessage(e.message || 'Failed to submit onboarding application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-28 pt-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Breadcrumbs */}
        <div className="flex items-center justify-between">
          <Link
            to="/partner/categories"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to Partner Categories</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/partner/dmc/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-[#009A60] hover:bg-emerald-100 text-xs font-bold transition-colors"
            >
              <span>DMC Portal Dashboard</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* Title Card */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-[#009A60] text-xs font-bold uppercase tracking-wider">
            <Globe size={16} />
            <span>Destination Management Company (DMC) Onboarding</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-gray-950 tracking-tight">
            Register Your Travel Agency or DMC in Mozambique
          </h1>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-2xl">
            MozBook provides official inbound operators, tour companies, and DMCs with dedicated tools to create multi-day package itineraries, coordinate with verified local lodges and transport providers, and receive high-value traveler bookings.
          </p>

          {/* Current Application Status Banner if already registered */}
          {existingProfile && (
            <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
              existingProfile.status === 'approved'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : existingProfile.status === 'rejected'
                ? 'bg-red-50 border-red-200 text-red-900'
                : existingProfile.status === 'suspended'
                ? 'bg-gray-100 border-gray-300 text-gray-800'
                : existingProfile.status === 'additional_info_required'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <ShieldCheck size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold uppercase tracking-wider text-xs">
                  Current Verification Status: {existingProfile.status.replace('_', ' ').toUpperCase()}
                </div>
                <p className="text-xs">
                  {existingProfile.status === 'approved' && 'Your DMC business is verified and fully authorized to publish travel packages.'}
                  {existingProfile.status === 'pending_review' && 'Your application has been received and is awaiting compliance review by MozBook administrators.'}
                  {existingProfile.status === 'additional_info_required' && `Additional information requested: ${existingProfile.adminNotes || 'Please update your licensing details.'}`}
                  {existingProfile.status === 'rejected' && `Application not approved: ${existingProfile.rejectionReason || existingProfile.adminNotes || 'Incomplete registration documents.'}`}
                  {existingProfile.status === 'draft' && 'Your application is currently saved as an in-progress draft.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          {[
            { step: 1, title: '1. Business Identity' },
            { step: 2, title: '2. Contacts & Office' },
            { step: 3, title: '3. Operating Scope' },
            { step: 4, title: '4. Licences & Submit' }
          ].map(s => (
            <button
              key={s.step}
              type="button"
              onClick={() => setCurrentStep(s.step as any)}
              className={`py-3 px-2 rounded-2xl border transition-all ${
                currentStep === s.step
                  ? 'bg-[#009A60] text-white border-[#009A60] shadow-sm'
                  : currentStep > s.step
                  ? 'bg-emerald-50 text-[#009A60] border-emerald-200'
                  : 'bg-white text-gray-400 border-gray-200'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Feedback Alert Messages */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
          
          {/* STEP 1: Business Identity & Registration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-black text-gray-900">1. Legal & Commercial Business Identity</h2>
                <p className="text-xs text-gray-500">Provide official registered tourism company details in Mozambique.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Legal Business Name (Denominação Social) *
                  </label>
                  <input
                    type="text"
                    value={legalBusinessName}
                    onChange={(e) => setLegalBusinessName(e.target.value)}
                    placeholder="e.g. Mozambique Inbound Safaris & Travel Lda"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Trading / Brand Name (Nome Comercial) *
                  </label>
                  <input
                    type="text"
                    value={tradingName}
                    onChange={(e) => setTradingName(e.target.value)}
                    placeholder="e.g. MozVenture Travel & DMC"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Tax Number / NUIT (9 digits) *
                  </label>
                  <input
                    type="text"
                    value={nuit}
                    onChange={(e) => setNuit(e.target.value)}
                    placeholder="e.g. 400123456"
                    maxLength={15}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Commercial Registration Number (BR / Conservatória)
                  </label>
                  <input
                    type="text"
                    value={commercialRegistrationNumber}
                    onChange={(e) => setCommercialRegistrationNumber(e.target.value)}
                    placeholder="e.g. 10245/2019 Conservatória Maputo"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    INATUR Tourism Operator License (Alvará de Turismo) *
                  </label>
                  <input
                    type="text"
                    value={inaturLicenseNumber}
                    onChange={(e) => setInaturLicenseNumber(e.target.value)}
                    placeholder="e.g. INATUR/AG-2023/048"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    License Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={licenseExpiryDate}
                    onChange={(e) => setLicenseExpiryDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-900">
                <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Compliance Requirement:</strong> Registered Mozambican Travel Agencies and DMCs must hold an active INATUR (Instituto Nacional do Turismo) permit and valid NUIT.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Contacts & Office Headquarters */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-black text-gray-900">2. Authorized Representation & Office Headquarters</h2>
                <p className="text-xs text-gray-500">Contact person and physical operating presence in Mozambique.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Authorized Representative Full Name *
                  </label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="e.g. Armando Cossa"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Official Position / Role *
                  </label>
                  <input
                    type="text"
                    value={representativeRole}
                    onChange={(e) => setRepresentativeRole(e.target.value)}
                    placeholder="e.g. Managing Director / Tourism Operations Manager"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Operational Phone / WhatsApp (+258) *
                  </label>
                  <input
                    type="tel"
                    value={representativePhone}
                    onChange={(e) => setRepresentativePhone(e.target.value)}
                    placeholder="+258 84 123 4567"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Official Business Email *
                  </label>
                  <input
                    type="email"
                    value={representativeEmail}
                    onChange={(e) => setRepresentativeEmail(e.target.value)}
                    placeholder="operations@mozventure.co.mz"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Physical Office Address in Mozambique *
                  </label>
                  <input
                    type="text"
                    value={physicalAddress}
                    onChange={(e) => setPhysicalAddress(e.target.value)}
                    placeholder="e.g. Av. 24 de Julho, Edifício Polana Center, 3º Andar"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Headquarters City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Maputo, Vilankulo, Beira, Nampula..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Province *
                  </label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  >
                    <option value="Maputo Cidade">Maputo Cidade</option>
                    <option value="Maputo Província">Maputo Província</option>
                    <option value="Gaza">Gaza</option>
                    <option value="Inhambane">Inhambane</option>
                    <option value="Sofala">Sofala</option>
                    <option value="Manica">Manica</option>
                    <option value="Tete">Tete</option>
                    <option value="Zambézia">Zambézia</option>
                    <option value="Nampula">Nampula</option>
                    <option value="Cabo Delgado">Cabo Delgado</option>
                    <option value="Niassa">Niassa</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Operating Scope & Specializations */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-black text-gray-900">3. Tourism Scope, Regions & Specializations</h2>
                <p className="text-xs text-gray-500">Define where and how your agency operates across Mozambique.</p>
              </div>

              {/* Operating Regions */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Operating Regions in Mozambique ({operatingRegions.length} selected) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MOZAMBIQUE_REGIONS.map(reg => {
                    const isSelected = operatingRegions.includes(reg);
                    return (
                      <button
                        type="button"
                        key={reg}
                        onClick={() => toggleRegion(reg)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-[#009A60] text-emerald-900 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin size={14} className={isSelected ? 'text-[#009A60]' : 'text-gray-400'} />
                          {reg}
                        </span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                          isSelected ? 'bg-[#009A60] border-[#009A60] text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specializations */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  DMC Specializations *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DMC_SPECIALIZATIONS.map(spec => {
                    const isSelected = specializations.includes(spec);
                    return (
                      <button
                        type="button"
                        key={spec}
                        onClick={() => toggleSpecialization(spec)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-[#009A60] text-emerald-900 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{spec}</span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                          isSelected ? 'bg-[#009A60] border-[#009A60] text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Languages Supported */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Languages Spoken / Guided
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANGUAGES.map(lang => {
                    const isSelected = languagesSupported.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          isSelected
                            ? 'bg-[#009A60] border-[#009A60] text-white'
                            : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Services Offered */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Services Provided in Packages *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_SERVICES.map(srv => {
                    const isSelected = servicesOffered.includes(srv);
                    return (
                      <button
                        type="button"
                        key={srv}
                        onClick={() => toggleService(srv)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        <span>{srv}</span>
                        {isSelected && <Check size={14} className="text-[#009A60]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Licences, Insurance & Final Submission */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-black text-gray-900">4. Insurance, Supporting Documents & Submission</h2>
                <p className="text-xs text-gray-500">Provide liability insurance details and review application terms.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Insurance Provider / Company
                  </label>
                  <input
                    type="text"
                    value={liabilityInsuranceInsurer}
                    onChange={(e) => setLiabilityInsuranceInsurer(e.target.value)}
                    placeholder="e.g. EMOSE, Hollard Moçambique, Sanlam"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Policy / Apólice Number
                  </label>
                  <input
                    type="text"
                    value={liabilityInsurancePolicy}
                    onChange={(e) => setLiabilityInsurancePolicy(e.target.value)}
                    placeholder="e.g. RC-TUR-998822"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Policy Expiry Date
                  </label>
                  <input
                    type="date"
                    value={liabilityInsuranceExpiry}
                    onChange={(e) => setLiabilityInsuranceExpiry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                  />
                </div>
              </div>

              {/* Supporting Document Uploads */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Supporting Legal & Regulatory Documents
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Upload or link your certified digital documents for MozBook administrative review.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Administrative Review Required
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* INATUR License Document */}
                  <div className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      1. INATUR License Alvará
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Scanned copy of your active tourism operating licence.
                    </p>
                    <input
                      type="url"
                      value={licenseDocUrl}
                      onChange={(e) => setLicenseDocUrl(e.target.value)}
                      placeholder="https://... or document link"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>

                  {/* Commercial Certificate */}
                  <div className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      2. Commercial Certificate (BR)
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Boletim da República or legal deed publication.
                    </p>
                    <input
                      type="url"
                      value={commercialRegDocUrl}
                      onChange={(e) => setCommercialRegDocUrl(e.target.value)}
                      placeholder="https://... or document link"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>

                  {/* Liability Insurance Document */}
                  <div className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      3. Insurance Policy Schedule
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Proof of current passenger & public liability coverage.
                    </p>
                    <input
                      type="url"
                      value={insuranceDocUrl}
                      onChange={(e) => setInsuranceDocUrl(e.target.value)}
                      placeholder="https://... or document link"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                    />
                  </div>
                </div>

                {/* Separation of Registration Details vs Verified Evidence Notice */}
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Verification Policy Notice:</strong> Entering registration numbers (INATUR Licence #, NUIT, or Policy #) registers operational identifiers. Official verification status is granted only after an authorized MozBook administrator reviews authentic document proofs.
                  </div>
                </div>
              </div>

              {/* Authoritative Document Verification Status */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Authoritative Verification Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* INATUR Status */}
                  {(() => {
                    const badge = getDocumentStatusBadge(
                      licenseDocUrl,
                      existingProfile?.documentRecords?.inaturLicense
                    );
                    return (
                      <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                          <span>INATUR Tourism License</span>
                          {badge.iconType === 'verified' && <CheckCircle2 size={16} className="text-emerald-600" />}
                          {badge.iconType === 'pending' && <Clock size={16} className="text-blue-600" />}
                          {badge.iconType === 'rejected' && <XCircle size={16} className="text-rose-600" />}
                          {badge.iconType === 'expired' && <AlertTriangle size={16} className="text-amber-600" />}
                          {badge.iconType === 'missing' && <AlertCircle size={16} className="text-gray-400" />}
                        </div>
                        <p className="text-[11px] text-gray-500">Official Alvará issued by Ministry of Culture & Tourism.</p>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Commercial Registration Status */}
                  {(() => {
                    const badge = getDocumentStatusBadge(
                      commercialRegDocUrl,
                      existingProfile?.documentRecords?.commercialCertificate
                    );
                    return (
                      <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                          <span>Commercial Certificate (BR)</span>
                          {badge.iconType === 'verified' && <CheckCircle2 size={16} className="text-emerald-600" />}
                          {badge.iconType === 'pending' && <Clock size={16} className="text-blue-600" />}
                          {badge.iconType === 'rejected' && <XCircle size={16} className="text-rose-600" />}
                          {badge.iconType === 'expired' && <AlertTriangle size={16} className="text-amber-600" />}
                          {badge.iconType === 'missing' && <AlertCircle size={16} className="text-gray-400" />}
                        </div>
                        <p className="text-[11px] text-gray-500">Public deed / Boletim da República publication.</p>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Liability Insurance Status */}
                  {(() => {
                    const badge = getDocumentStatusBadge(
                      insuranceDocUrl,
                      existingProfile?.documentRecords?.liabilityInsurance
                    );
                    return (
                      <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                          <span>Passenger & Public Liability</span>
                          {badge.iconType === 'verified' && <CheckCircle2 size={16} className="text-emerald-600" />}
                          {badge.iconType === 'pending' && <Clock size={16} className="text-blue-600" />}
                          {badge.iconType === 'rejected' && <XCircle size={16} className="text-rose-600" />}
                          {badge.iconType === 'expired' && <AlertTriangle size={16} className="text-amber-600" />}
                          {badge.iconType === 'missing' && <AlertCircle size={16} className="text-gray-400" />}
                        </div>
                        <p className="text-[11px] text-gray-500">Coverage for tourist excursions and guided vehicles.</p>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.badgeClass}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Commission & Terms Acknowledgement */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-2">
                <div className="font-bold text-gray-900">DMC Partner Terms & Platform Commission:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>MozBook operates on the platform standard <strong>{PARTNER_SHARE_PERCENT}% Partner Share / {MOZBOOK_COMMISSION_PERCENT}% MozBook Commission</strong> model for all confirmed package bookings.</li>
                  <li>Applications are reviewed by MozBook administration within 24 to 48 business hours.</li>
                  <li>All itineraries published must comply with Mozambican conservation regulations (ANAC) and marine safety standards.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation & Submission Controls */}
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft size={14} />
                  <span>Previous Step</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors w-full sm:w-auto"
              >
                <Save size={14} />
                <span>Save Draft</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold shadow-md transition-all w-full sm:w-auto"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
                >
                  {submitting ? (
                    <span>Submitting Application...</span>
                  ) : (
                    <>
                      <span>Submit for Verification</span>
                      <CheckCircle2 size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
