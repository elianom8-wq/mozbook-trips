import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Upload, 
  FileText, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle,
  ChevronLeft,
  Lock,
  Building,
  CreditCard,
  User,
  ExternalLink,
  Sparkles,
  Camera,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Eye,
  Info,
  Home,
  Plus,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserScopedDraft } from '../services/authSessionManager';
import { 
  DocType, 
  submitHostVerification, 
  getUserVerification, 
  HostVerification,
  extractDocumentData,
  ExtractedDocData,
  ExpiryStatus,
  calculateDocumentExpiry
} from '../services/listingService';
import DocumentSlotUpload from '../components/DocumentSlotUpload';
import DocumentExpiryTracker from '../components/DocumentExpiryTracker';
import MozBookLogo from '../components/MozBookLogo';

const DOC_TYPES: { id: DocType; label: string; description: string; example: string }[] = [
  {
    id: 'national_id',
    label: 'Mozambican National ID (Bilhete de Identidade / B.I.)',
    description: 'Official national identity card. Front and back photos required.',
    example: 'Format: 11 digits followed by 1 letter (e.g. 110100492817M)'
  },
  {
    id: 'dire',
    label: 'D.I.R.E. (Identificação e Residência para Estrangeiros)',
    description: 'Foreign resident identification card in Mozambique. Front and back photos required.',
    example: 'Valid temporary or permanent resident document'
  },
  {
    id: 'passport',
    label: 'Passport (Passaporte Nacional ou Internacional)',
    description: 'Valid Mozambican or non-Mozambican international passport. Main photo/bio page.',
    example: 'Must have at least 6 months remaining validity'
  },
  {
    id: 'residence_permit',
    label: 'Mozambican Residence Permit (Autorização de Residência)',
    description: 'Official residency certificate or consular authorization. Front and back photos.',
    example: 'Official document with residential address'
  }
];

export default function HostVerificationPage() {
  const { user, login, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [existingVerification, setExistingVerification] = useState<HostVerification | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form fields
  const [hostName, setHostName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [docType, setDocType] = useState<DocType>('national_id');
  const [docNumber, setDocNumber] = useState('');
  
  // Document photos
  const [docFrontPhotoUrl, setDocFrontPhotoUrl] = useState('');
  const [docBackPhotoUrl, setDocBackPhotoUrl] = useState('');

  // Expiration & validation state
  const [expiryDate, setExpiryDate] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | undefined>(undefined);
  const [expiryStatus, setExpiryStatus] = useState<ExpiryStatus | undefined>(undefined);
  const [securityFeatures, setSecurityFeatures] = useState<string[]>([]);
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [extractedRawData, setExtractedRawData] = useState<ExtractedDocData | null>(null);

  // Field extraction attribution tracking (user review and manual correction)
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<Set<string>>(new Set());
  const [manuallyEditedFields, setManuallyEditedFields] = useState<Set<string>>(new Set());

  // Extraction UI state & provider error categorization
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [providerErrorCategory, setProviderErrorCategory] = useState<string | null>(null);
  const [providerCreditsDepleted, setProviderCreditsDepleted] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptedPartnerTerms, setAcceptedPartnerTerms] = useState(false);
  const [existingDraft, setExistingDraft] = useState<any | null>(null);
  const [showUpdateDocuments, setShowUpdateDocuments] = useState(false);

  useEffect(() => {
    if (!user) {
      setExistingVerification(null);
      setExistingDraft(null);
      setHostName('');
      setPhoneNumber('');
      setDocNumber('');
      setDocFrontPhotoUrl('');
      setDocBackPhotoUrl('');
      setExpiryDate('');
      setIssueDate('');
      setDateOfBirth('');
      setNationality('');
      setIsExpired(false);
      setDaysUntilExpiry(undefined);
      setExpiryStatus(undefined);
      setSecurityFeatures([]);
      setValidationNotes('');
      setExtractedRawData(null);
      setLoadingInitial(false);
      return;
    }

    setLoadingInitial(true);
    setHostName(user.displayName || '');
    
    // Check if user has an in-progress stay listing draft
    const draft = getUserScopedDraft<any>(user.uid, 'stay_listing_draft');
    setExistingDraft(draft);

    getUserVerification(user.uid).then((data) => {
      setExistingVerification(data);
      if (data) {
        setHostName(data.hostName);
        setPhoneNumber(data.phoneNumber);
        setDocType(data.docType);
        setDocNumber(data.docNumber);
        setDocFrontPhotoUrl(data.docFrontPhotoUrl || data.docPhotoUrl || '');
        setDocBackPhotoUrl(data.docBackPhotoUrl || '');
        if (data.expiryDate) setExpiryDate(data.expiryDate);
        if (data.issueDate) setIssueDate(data.issueDate);
        if (data.dateOfBirth) setDateOfBirth(data.dateOfBirth);
        if (data.nationality) setNationality(data.nationality);
        if (data.isExpired !== undefined) setIsExpired(data.isExpired);
        if (data.daysUntilExpiry !== undefined) setDaysUntilExpiry(data.daysUntilExpiry);
        if (data.expiryStatus) setExpiryStatus(data.expiryStatus);
        if (data.extractedData) {
          setExtractedRawData(data.extractedData);
          if (data.extractedData.securityFeaturesDetected) {
            setSecurityFeatures(data.extractedData.securityFeaturesDetected);
          }
          if (data.extractedData.validationNotes) {
            setValidationNotes(data.extractedData.validationNotes);
          }
        }
      }
      setLoadingInitial(false);
    });
  }, [user?.uid]);

  // Recalculate expiry whenever user manually edits expiryDate
  const handleExpiryDateChange = (newDate: string) => {
    setExpiryDate(newDate);
    if (!newDate) {
      setIsExpired(false);
      setDaysUntilExpiry(undefined);
      setExpiryStatus(undefined);
      return;
    }

    const calc = calculateDocumentExpiry(newDate);
    setIsExpired(calc.isExpired);
    setDaysUntilExpiry(calc.daysUntilExpiry);
    setExpiryStatus(calc.expiryStatus);
  };

  // Requirement 3: Switching between B.I. and passport must not carry over data from another document
  const handleDocTypeChange = (newType: DocType) => {
    if (newType === docType) return;
    setDocType(newType);
    
    // Clear document photos
    setDocFrontPhotoUrl('');
    setDocBackPhotoUrl('');

    // Clear stale extracted identity fields, notes, and attribution markers
    setDocNumber('');
    setExpiryDate('');
    setIssueDate('');
    setDateOfBirth('');
    setNationality('');
    setIsExpired(false);
    setDaysUntilExpiry(undefined);
    setExpiryStatus(undefined);
    setSecurityFeatures([]);
    setValidationNotes('');
    setExtractedRawData(null);
    setExtractedFieldKeys(new Set());
    setManuallyEditedFields(new Set());
    setExtractionSuccess(false);
    setExtractionError(null);
    setProviderErrorCategory(null);

    // Reset hostName to authenticated user's display name if previously auto-filled
    setHostName(user?.displayName || '');
  };

  // Clear session to start clean without stale data
  const handleResetVerificationSession = () => {
    setDocFrontPhotoUrl('');
    setDocBackPhotoUrl('');
    setDocNumber('');
    setExpiryDate('');
    setIssueDate('');
    setDateOfBirth('');
    setNationality('');
    setIsExpired(false);
    setDaysUntilExpiry(undefined);
    setExpiryStatus(undefined);
    setSecurityFeatures([]);
    setValidationNotes('');
    setExtractedRawData(null);
    setExtractedFieldKeys(new Set());
    setManuallyEditedFields(new Set());
    setExtractionSuccess(false);
    setExtractionError(null);
    setProviderErrorCategory(null);
    setHostName(user?.displayName || '');
  };

  // Perform Gemini AI Extraction
  const handleExtractData = async () => {
    if (!docFrontPhotoUrl) {
      setExtractionError('Please take or upload at least the front photo of your document.');
      setProviderErrorCategory('MISSING_FRONT_IMAGE');
      return;
    }

    if (docType !== 'passport' && !docBackPhotoUrl) {
      setExtractionError('For Mozambican ID or DIRE, please take photos of both front and back.');
      setProviderErrorCategory('MISSING_BACK_IMAGE');
      return;
    }

    // Requirement 7: Do not attempt repeated Gemini API calls while provider reports depleted credits
    if (providerCreditsDepleted) {
      setExtractionError('Automated AI document reading is paused because Gemini API prepayment credits are depleted. Please enter your document details manually in the fields below.');
      setProviderErrorCategory('PROVIDER_CREDITS_DEPLETED');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setProviderErrorCategory(null);
    setExtractionSuccess(false);

    try {
      const res = await extractDocumentData({
        docType,
        frontImage: docFrontPhotoUrl,
        backImage: docBackPhotoUrl,
      });

      if (res.success && res.extracted) {
        const ext = res.extracted;
        setExtractedRawData(ext);

        const newExtractedKeys = new Set<string>();

        // Requirement 4: Autofill only fields without overwriting legitimate values already entered by user
        if (ext.legalName) {
          if (!manuallyEditedFields.has('legalName') || !hostName) {
            setHostName(ext.legalName);
            newExtractedKeys.add('legalName');
          }
        }
        if (ext.docNumber) {
          if (!manuallyEditedFields.has('docNumber') || !docNumber) {
            setDocNumber(ext.docNumber);
            newExtractedKeys.add('docNumber');
          }
        }
        if (ext.expiryDate) {
          if (!manuallyEditedFields.has('expiryDate') || !expiryDate) {
            setExpiryDate(ext.expiryDate);
            newExtractedKeys.add('expiryDate');
            if (ext.isExpired !== undefined) setIsExpired(ext.isExpired);
            if (ext.daysUntilExpiry !== undefined) setDaysUntilExpiry(ext.daysUntilExpiry);
            if (ext.expiryStatus) setExpiryStatus(ext.expiryStatus);
          }
        }
        if (ext.issueDate) {
          if (!manuallyEditedFields.has('issueDate') || !issueDate) {
            setIssueDate(ext.issueDate);
            newExtractedKeys.add('issueDate');
          }
        }
        if (ext.dateOfBirth) {
          if (!manuallyEditedFields.has('dateOfBirth') || !dateOfBirth) {
            setDateOfBirth(ext.dateOfBirth);
            newExtractedKeys.add('dateOfBirth');
          }
        }
        if (ext.nationality) {
          if (!manuallyEditedFields.has('nationality') || !nationality) {
            setNationality(ext.nationality);
            newExtractedKeys.add('nationality');
          }
        }
        if (ext.securityFeaturesDetected) {
          setSecurityFeatures(ext.securityFeaturesDetected);
        }
        if (ext.validationNotes) {
          setValidationNotes(ext.validationNotes);
        }

        setExtractedFieldKeys(newExtractedKeys);
        setExtractionSuccess(true);
      } else {
        // Requirement 4: When extraction fails, preserve uploaded image but do not claim fields were extracted.
        // Show actual provider error category and allow retry or manual entry. Do not overwrite user values.
        if (res.providerCreditsDepleted) {
          setProviderCreditsDepleted(true);
        }
        setProviderErrorCategory(res.errorCategory || (res.providerCreditsDepleted ? 'PROVIDER_CREDITS_DEPLETED' : 'OCR_EXTRACTION_FAILED'));
        setExtractionError(res.error || 'Failed to extract text from document photos. Please enter your details manually.');
      }
    } catch (err: any) {
      setProviderErrorCategory('NETWORK_OR_SERVER_ERROR');
      setExtractionError(err.message || 'Error communicating with document extraction service. Manual entry is available.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }

    if (!docFrontPhotoUrl.trim()) {
      setError('Please take or upload the front photo of your official document.');
      return;
    }

    if (docType !== 'passport' && !docBackPhotoUrl.trim()) {
      setError('Mozambican ID / D.I.R.E. requires both front and back photos.');
      return;
    }

    if (!docNumber.trim() || !phoneNumber.trim()) {
      setError('Please provide your full legal name, document ID number, and contact phone number.');
      return;
    }

    if (!acceptedPartnerTerms) {
      setError('You must review and agree to the MozBook Partner and Operator Agreement before submitting for listing approval.');
      return;
    }

    if (isExpired) {
      console.warn('Submitting host verification with expired document. Host listing approvals will remain suspended until unexpired document is approved.');
    }

    setSubmitting(true);
    setError(null);

    try {
      const docId = await submitHostVerification({
        userId: user.uid,
        userEmail: user.email || 'host@mozbook.mz',
        hostName: hostName.trim() || user.displayName || 'Mozbook Host',
        phoneNumber: phoneNumber.trim(),
        docType,
        docNumber: docNumber.trim(),
        docPhotoUrl: docFrontPhotoUrl.trim(),
        docFrontPhotoUrl: docFrontPhotoUrl.trim(),
        docBackPhotoUrl: docBackPhotoUrl.trim(),
        expiryDate: expiryDate.trim(),
        issueDate: issueDate.trim(),
        dateOfBirth: dateOfBirth.trim(),
        nationality: nationality.trim(),
        isExpired,
        daysUntilExpiry: daysUntilExpiry !== undefined ? daysUntilExpiry : 365,
        expiryStatus: expiryStatus || (isExpired ? 'expired' : 'valid'),
        extractedData: extractedRawData || {
          legalName: hostName,
          docNumber,
          expiryDate,
          isExpired,
          daysUntilExpiry,
        },
      });

      if (docId) {
        setSuccessMessage(
          'Your verification photos and document dates have been submitted to the Mozbook Operations Team for review.'
        );
        // Requirement 1: Redirect the host to MozBook Your Home with Approval Pending notification
        setTimeout(() => {
          navigate('/host/create', {
            state: {
              approvalPending: true,
              verificationSubmitted: true,
              hostName: hostName.trim() || user.displayName || 'Mozbook Host',
              message: 'Your verification documents have been submitted and are awaiting review by our Trust & Safety team. You can continue setting up your accommodation listing below while waiting.'
            }
          });
        }, 800);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit verification request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPassport = docType === 'passport';

  return (
    <div className="min-h-screen bg-gray-50/60 pb-20">
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link
            to={existingVerification?.status === 'verified' ? "/partner/dashboard?tab=accommodations" : "/host/create"}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={18} />
            <span>{existingVerification?.status === 'verified' ? 'Go to Partner Accommodations' : 'Back to Listing Studio'}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-90">
              <MozBookLogo variant="compact" size="sm" />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 font-medium border-l border-gray-200 pl-3">
              <ShieldCheck size={16} className="text-[#009A60]" />
              <span>Trust & Safety Operations</span>
            </div>
            {isAdmin && (
              <Link
                to="/admin/verifications"
                className="px-2.5 py-1 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Admin Console</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Header Hero */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#e6f7f0] text-[#009A60] text-xs font-bold rounded-full">
                <ShieldCheck size={14} />
                <span>MozBook Host Identity Document Verification</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {existingVerification?.status === 'verified' && !isExpired
                  ? 'Host Identity Verified'
                  : 'Document Verification & Expiry Tracking'}
              </h1>
              <p className="text-gray-600 text-sm max-w-xl leading-relaxed">
                {existingVerification?.status === 'verified' && !isExpired
                  ? 'Your official identification has been verified by MozBook Operations. Your eligible properties display the Verified Host shield badge, and you are fully authorized to accept bookings.'
                  : 'Take photos of your official identification (front and back for ID/DIRE, or main photo page for passport). Our document reader extracts legible details for your review before submission to the operations team.'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 shrink-0 text-center w-full md:w-auto">
              <div className="text-xs text-gray-500 uppercase font-semibold">Verification Status</div>
              {existingVerification?.status === 'verified' ? (
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-sm">
                  <CheckCircle2 size={16} /> Verified Host
                </div>
              ) : existingVerification?.status === 'pending' ? (
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full font-bold text-sm">
                  <Clock size={16} /> Pending Approval
                </div>
              ) : existingVerification?.status === 'rejected' ? (
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 rounded-full font-bold text-sm">
                  <XCircle size={16} /> Action Required
                </div>
              ) : (
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full font-semibold text-sm">
                  Not Submitted
                </div>
              )}
            </div>
          </div>

          {/* Verification Architecture: 3 Distinct States (Requirement 5) */}
          <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Stage 1: Extraction State */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">1. OCR Image Extraction</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  extractionSuccess 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : extractionError 
                    ? 'bg-amber-100 text-amber-800' 
                    : isExtracting 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {isExtracting ? 'Extracting...' : extractionSuccess ? 'Data Read' : extractionError ? 'Manual Entry' : 'Ready'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Reads text from uploaded images. Does not check government registries or physical chips.
              </p>
            </div>

            {/* Stage 2: Expiry Tracking State */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">2. Expiration Tracking</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  isExpired 
                    ? 'bg-rose-100 text-rose-800' 
                    : expiryStatus === 'expiring_soon' 
                    ? 'bg-amber-100 text-amber-800' 
                    : expiryDate 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {isExpired ? 'Expired' : expiryStatus === 'expiring_soon' ? 'Expiring Soon' : expiryDate ? 'Unexpired' : 'Not Calculated'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Evaluates document validity against current calendar date.
              </p>
            </div>

            {/* Stage 3: Authorised Approval State */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">3. Authorised Approval</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  existingVerification?.status === 'verified' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : existingVerification?.status === 'pending' 
                    ? 'bg-amber-100 text-amber-800' 
                    : existingVerification?.status === 'rejected' 
                    ? 'bg-rose-100 text-rose-800' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {existingVerification?.status === 'verified' ? 'Approved' : existingVerification?.status === 'pending' ? 'Pending Review' : existingVerification?.status === 'rejected' ? 'Action Required' : 'Not Submitted'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                MozBook Trust & Safety Operations review required for listing activation.
              </p>
            </div>
          </div>
        </div>

        {/* Authoritative Verified Host Complete State (Fix B) */}
        {existingVerification?.status === 'verified' && !isExpired && expiryStatus !== 'suspended' && (
          <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#009A60] flex items-center justify-center shrink-0 border border-emerald-200">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-1">
                    <CheckCircle2 size={13} />
                    <span>Identity Verification Complete</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    Your Host Identity is Approved by MozBook Operations
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-xl leading-relaxed">
                    Your official identity documents have been authenticated. All your eligible listings display the Verified Host shield badge, and your properties can accept guest bookings.
                  </p>
                </div>
              </div>

              <div className="shrink-0 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center w-full sm:w-auto">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Verified Document</span>
                <span className="text-sm font-bold text-gray-900 capitalize">
                  {existingVerification.docType.replace('_', ' ')}
                </span>
                {existingVerification.expiryDate && (
                  <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium">
                    Valid until {existingVerification.expiryDate}
                  </span>
                )}
              </div>
            </div>

            {/* Unfinished Draft Resume Banner (if user has a draft) */}
            {existingDraft && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                    <Home size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      Unfinished Listing Draft Available
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      You have an in-progress draft for "{existingDraft.title || 'Untitled Property'}" with photos and pricing preserved.
                    </p>
                  </div>
                </div>
                <Link
                  to="/host/create"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <span>Resume Listing Draft</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* Navigation Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Link
                to="/partner/dashboard?tab=accommodations"
                className="p-5 rounded-2xl border-2 border-[#009A60] bg-[#e6f7f0]/40 hover:bg-[#e6f7f0] text-gray-900 transition-all flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#009A60] text-white flex items-center justify-center shrink-0">
                    <Home size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-[#008250] flex items-center gap-1">
                      <span>Go to My Accommodations</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      View and manage your registered properties on the Partner Dashboard
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-[#009A60] group-hover:translate-x-1 transition-transform shrink-0" />
              </Link>

              <Link
                to="/host/create"
                className="p-5 rounded-2xl border border-gray-200 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-900 transition-all flex items-center justify-between group shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-black flex items-center gap-1">
                      <span>Create a New Listing</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Publish a new beach villa, urban home, or safari lodge
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </Link>
            </div>

            {/* Toggle to view/update credentials */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
              <span>Your identity documents are securely on file. You do not need to re-upload.</span>
              <button
                type="button"
                onClick={() => setShowUpdateDocuments(!showUpdateDocuments)}
                className="text-xs text-[#009A60] hover:text-[#008250] font-bold hover:underline cursor-pointer text-left"
              >
                {showUpdateDocuments ? 'Hide Document Upload Form' : 'Update / Replace Submitted Documents'}
              </button>
            </div>
          </div>
        )}

        {/* Existing Status Banner for Pending / Rejected / Expired */}
        {existingVerification && (existingVerification.status !== 'verified' || isExpired || expiryStatus === 'suspended') && (
          <div className={`p-5 rounded-2xl border ${
            existingVerification.status === 'verified' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : existingVerification.status === 'pending'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-start gap-3">
              {existingVerification.status === 'verified' ? (
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : existingVerification.status === 'pending' ? (
                <Clock size={24} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={24} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h3 className="font-bold text-base">
                  {existingVerification.status === 'verified' && 'Your Host Identity is Approved by MozBook Operations'}
                  {existingVerification.status === 'pending' && 'Verification In Progress with Operations Team'}
                  {existingVerification.status === 'rejected' && 'Update Required on Your Documents'}
                </h3>
                <p className="text-sm opacity-90">
                  {existingVerification.status === 'verified' && 'Your listings display the Verified Host shield badge. Guests can book with complete trust.'}
                  {existingVerification.status === 'pending' && 'Our operations team is reviewing your submitted identity documents. Approvals typically take 1–4 hours.'}
                  {existingVerification.status === 'rejected' && (existingVerification.adminNotes || 'Please review your document photos and ensure all identification details are clear and legible.')}
                </p>
                {existingVerification.reviewedBy && (
                  <p className="text-xs opacity-75 pt-1">
                    Reviewed by: {existingVerification.reviewedBy}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Unfinished Draft Resume Banner for Pending or Unverified Hosts */}
        {existingDraft && existingVerification?.status !== 'verified' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                <Home size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  Unfinished Listing Draft Available
                </h4>
                <p className="text-[11px] text-amber-800">
                  You have an in-progress draft for "{existingDraft.title || 'Untitled Property'}" with photos and pricing preserved.
                </p>
              </div>
            </div>
            <Link
              to="/host/create"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>Resume Listing Draft</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Verification Form (shown when unverified, expired, or explicitly toggled) */}
        {(showUpdateDocuments || existingVerification?.status !== 'verified' || isExpired || expiryStatus === 'suspended') && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Select Document Type */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard size={20} className="text-[#009A60]" />
                  <span>1. Select Official Document Type</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Mozambican ID and DIRE require both front and back photos; Passports require the main bio page
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetVerificationSession}
                className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
              >
                Clear / New Session
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPES.map((type) => {
                const isSelected = docType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleDocTypeChange(type.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-[#009A60] bg-[#e6f7f0]/40 ring-2 ring-[#009A60]/20'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{type.label}</h4>
                        <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                        <span className="text-[11px] text-gray-400 mt-2 block italic">{type.example}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'border-[#009A60] bg-[#009A60] text-white' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Take Photos of Document */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Camera size={20} className="text-[#009A60]" />
                  <span>2. Document Photo Capture</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isPassport 
                    ? 'Take a photo of the main passport bio/photo page (Mozambican or international)' 
                    : 'Take a photo of BOTH the FRONT and BACK of your ID card'}
                </p>
              </div>

              {/* Action Button: Trigger AI Extraction */}
              <button
                type="button"
                disabled={isExtracting || !docFrontPhotoUrl}
                onClick={handleExtractData}
                className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Extracting with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Auto-fill Data from Photos</span>
                  </>
                )}
              </button>
            </div>

            {/* Photo Slots */}
            <div className={`grid grid-cols-1 ${isPassport ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-4`}>
              <DocumentSlotUpload
                label={isPassport ? 'Passport Main Photo Page' : 'Document Front Photo'}
                required
                hint={isPassport ? 'Clear photo of the bio page including photo and MRZ lines' : 'Front face showing full portrait, name, and B.I. number'}
                value={docFrontPhotoUrl}
                onChange={(val) => {
                  setDocFrontPhotoUrl(val);
                  setExtractionSuccess(false);
                }}
                captureTitle={isPassport ? 'Capture Passport Main Page' : 'Capture Document Front'}
              />

              {!isPassport && (
                <DocumentSlotUpload
                  label="Document Back Photo"
                  required
                  hint="Back face showing document details and machine-readable text or registration numbers"
                  value={docBackPhotoUrl}
                  onChange={(val) => {
                    setDocBackPhotoUrl(val);
                    setExtractionSuccess(false);
                  }}
                  captureTitle="Capture Document Back"
                />
              )}
            </div>

            {/* Extraction Banner / Status (Requirement 4 & 5) */}
            {extractionSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Document details extracted — pending user review</span>
                  <p className="text-emerald-800 mt-0.5">
                    Data has been read from the document image. Please inspect all fields below, correct any inaccuracies, and confirm before submitting for authorized review.
                  </p>
                </div>
              </div>
            )}

            {extractionError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs space-y-2">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">Extraction Notice</span>
                      {providerErrorCategory && (
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-mono text-[10px] font-bold">
                          Category: {providerErrorCategory}
                        </span>
                      )}
                      {providerCreditsDepleted && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                          Prepayment Credits Depleted
                        </span>
                      )}
                    </div>
                    <p className="text-amber-900 leading-relaxed">{extractionError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-amber-200/60">
                  {!providerCreditsDepleted && (
                    <button
                      type="button"
                      onClick={handleExtractData}
                      className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={12} />
                      <span>Retry Extraction</span>
                    </button>
                  )}
                  <span className="text-[11px] text-amber-800">
                    {providerCreditsDepleted
                      ? 'Automated retry is disabled while credits are depleted. Please enter details manually below.'
                      : 'You may retry or proceed with manual entry in Step 3 below.'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Extracted Document Details & Expiry Tracker */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User size={20} className="text-[#009A60]" />
                <span>3. Verified Identity Details & Expiry Check</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Autofilled from document analysis. Check that the dates are valid and not expired.
              </p>
            </div>

            {/* Document Expiry Tracker Card */}
            {expiryDate && (() => {
              const calc = calculateDocumentExpiry(expiryDate);
              return (
                <DocumentExpiryTracker
                  expiryDate={expiryDate}
                  issueDate={issueDate}
                  daysUntilExpiry={calc.daysUntilExpiry}
                  expiryStatus={calc.expiryStatus}
                  isExpired={calc.isExpired}
                  inGracePeriod={calc.inGracePeriod}
                  gracePeriodDaysRemaining={calc.gracePeriodDaysRemaining}
                  suspensionEffectiveDate={calc.suspensionEffectiveDate}
                  isSuspended={calc.isSuspended}
                  hostName={hostName || 'Host'}
                  userEmail={user?.email || 'host@mozbook.mz'}
                  docType={docType}
                  docNumber={docNumber}
                  nationality={nationality}
                  securityFeatures={securityFeatures}
                  validationNotes={validationNotes}
                  showReminderAction={true}
                />
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 uppercase">
                    Full Legal Name * (from document)
                  </label>
                  {extractedFieldKeys.has('legalName') && !manuallyEditedFields.has('legalName') ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Extracted
                    </span>
                  ) : manuallyEditedFields.has('legalName') ? (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Manually Edited
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Manual Entry</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full legal name as shown on document"
                  value={hostName}
                  onChange={(e) => {
                    setHostName(e.target.value);
                    setManuallyEditedFields((prev) => new Set(prev).add('legalName'));
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 uppercase">
                    Document ID / Passport Number *
                  </label>
                  {extractedFieldKeys.has('docNumber') && !manuallyEditedFields.has('docNumber') ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Extracted
                    </span>
                  ) : manuallyEditedFields.has('docNumber') ? (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Manually Edited
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Manual Entry</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 110100492817M or AB123456"
                  value={docNumber}
                  onChange={(e) => {
                    setDocNumber(e.target.value);
                    setManuallyEditedFields((prev) => new Set(prev).add('docNumber'));
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none uppercase font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 uppercase">
                    Document Expiration Date * (YYYY-MM-DD)
                  </label>
                  {extractedFieldKeys.has('expiryDate') && !manuallyEditedFields.has('expiryDate') ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Extracted
                    </span>
                  ) : manuallyEditedFields.has('expiryDate') ? (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Manually Edited
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Manual Entry</span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => {
                      handleExpiryDateChange(e.target.value);
                      setManuallyEditedFields((prev) => new Set(prev).add('expiryDate'));
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 uppercase">
                    Contact Phone Number * (Mozambique or International)
                  </label>
                  {manuallyEditedFields.has('phoneNumber') ? (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      User Entered
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">Direct Entry</span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Phone size={16} />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="+258 84 123 4567"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setManuallyEditedFields((prev) => new Set(prev).add('phoneNumber'));
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none font-mono"
                  />
                </div>
              </div>

              {nationality && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 uppercase">
                      Nationality / Citizenship
                    </label>
                    {extractedFieldKeys.has('nationality') && !manuallyEditedFields.has('nationality') ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Extracted
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">User Entered</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => {
                      setNationality(e.target.value);
                      setManuallyEditedFields((prev) => new Set(prev).add('nationality'));
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none"
                  />
                </div>
              )}

              {dateOfBirth && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 uppercase">
                      Date of Birth
                    </label>
                    {extractedFieldKeys.has('dateOfBirth') && !manuallyEditedFields.has('dateOfBirth') ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Extracted
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">User Entered</span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      setManuallyEditedFields((prev) => new Set(prev).add('dateOfBirth'));
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#009A60] focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Partner & Operator Agreement Acceptance (Prompt 28A Phase 5 & 6) */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedPartnerTerms}
                onChange={(e) => setAcceptedPartnerTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-[#009A60] focus:ring-[#009A60] border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-gray-800 leading-snug">
                I have read and agree to the{' '}
                <a
                  href="/legal?tab=partner_agreement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#009A60] hover:underline"
                >
                  MozBook Partner & Operator Agreement
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
                . I commit to honoring the 15% platform commission / 85% net partner split, maintaining accurate live availability, and avoiding unauthorized inventory reductions.
              </span>
            </label>
            <p className="text-[11px] text-gray-500 pl-7 leading-relaxed">
              Operated by Elvira da Gloria Consulting SU, Lda. Listing activation is subject to document verification and compliance with Mozambican tourism and commercial licensing standards.
            </p>
          </div>

          {/* Privacy & Trust Assurance Notice */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 flex items-start gap-3">
            <Lock size={18} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gray-900">Encrypted & Confidential Document Handling</span>
              <p className="mt-0.5">
                Your official identification documents are strictly accessible by the verified MozBook Trust & Safety Operations team. They are never shared publicly with guests and are stored with cryptographic encryption. Expiration dates are tracked to provide proactive renewal reminders before document expiry.
              </p>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <Link
              to="/host/create"
              className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              Cancel and Return
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#009A60] hover:bg-[#008250] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-[#009A60]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Submitting to Operations Team...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Submit Documents for Final Approval</span>
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}
