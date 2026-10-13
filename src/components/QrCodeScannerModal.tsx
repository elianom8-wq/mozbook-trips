import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  QrCode, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Upload, 
  Search, 
  ShieldCheck, 
  Smartphone,
  Check
} from 'lucide-react';
import { permissionService, PHONE_SETTINGS_GUIDES } from '../services/permissionService';
import PermissionPromptModal from './PermissionPromptModal';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedBooking?: (bookingRef: string) => void;
  existingBookingRefs?: string[];
}

export default function QrCodeScannerModal({
  isOpen,
  onClose,
  onVerifiedBooking,
  existingBookingRefs = [],
}: QrCodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [selectedOs, setSelectedOs] = useState<'iOS' | 'Android' | 'Desktop'>('iOS');
  const [manualCode, setManualCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    bookingRef: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setVerificationResult(null);
      setManualCode('');
      return;
    }

    const isGranted = permissionService.isGranted('camera');
    const hasSolicited = permissionService.hasBeenSolicited('camera');

    if (!isGranted && !hasSolicited) {
      setShowPromptModal(true);
    } else {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setShowSettingsGuide(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported by this browser environment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      permissionService.saveStatus('camera', 'granted');
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('QR camera error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      if (isDenied) {
        permissionService.saveStatus('camera', 'denied');
      }
      setCameraError(
        isDenied
          ? 'Camera permission was denied. You can enable it in device settings, or enter the Booking Reference manually below.'
          : err.message || 'Unable to start camera for QR scanning.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    verifyBookingRef(manualCode.trim().toUpperCase());
  };

  const verifyBookingRef = (ref: string) => {
    const cleanRef = ref.trim().toUpperCase();
    const isKnown = existingBookingRefs.length === 0 || existingBookingRefs.includes(cleanRef);

    if (cleanRef.length >= 4) {
      setVerificationResult({
        success: true,
        bookingRef: cleanRef,
        message: isKnown
          ? `Booking verified for check-in: ${cleanRef}`
          : `Valid MozBook pass format detected: ${cleanRef}`,
      });
      if (onVerifiedBooking) {
        onVerifiedBooking(cleanRef);
      }
    } else {
      setVerificationResult({
        success: false,
        bookingRef: cleanRef,
        message: 'Invalid booking reference format. Must be at least 4 characters (e.g. MZB-123456).',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate extracting QR code from uploaded voucher image
    const simulatedRef = `MZB-${Math.floor(100000 + Math.random() * 900000)}`;
    verifyBookingRef(simulatedRef);
  };

  if (!isOpen) return null;

  const activeGuides = PHONE_SETTINGS_GUIDES.camera;
  const currentGuide = activeGuides.find((g) => g.os === selectedOs) || activeGuides[0];

  return (
    <>
      <div className="fixed inset-0 z-[550] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#e6f7f0] border border-[#a4e4c7] flex items-center justify-center text-[#009A60]">
                <QrCode size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Scan Guest QR Voucher</h3>
                <p className="text-xs text-slate-500">Verify guest arrival and fulfill reservation</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner Viewport / Video */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {verificationResult?.success ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 bg-[#009A60] text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-base font-bold text-emerald-950">Guest Check-In Verified!</h4>
                <p className="text-xs text-emerald-800 leading-relaxed font-mono font-bold bg-white/70 py-1.5 px-3 rounded-lg inline-block border border-emerald-200">
                  {verificationResult.bookingRef}
                </p>
                <p className="text-xs text-emerald-700">{verificationResult.message}</p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationResult(null);
                      startCamera();
                    }}
                    className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Scan Another Guest
                  </button>
                </div>
              </div>
            ) : cameraError ? (
              /* Camera Denied or Blocked State: Clear explanation, retry & alternatives */
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-amber-950">Camera Access Denied</h5>
                    <p className="text-[11px] text-amber-800 mt-0.5">{cameraError}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      permissionService.reset('camera');
                      startCamera();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Try Camera Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSettingsGuide(!showSettingsGuide)}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    {showSettingsGuide ? 'Hide Settings Guide' : 'Phone Settings Instructions'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Upload size={12} />
                    <span>Upload QR Screenshot</span>
                  </button>
                </div>

                {showSettingsGuide && (
                  <div className="mt-2 pt-2 border-t border-amber-200 space-y-2">
                    <div className="flex gap-1">
                      {(['iOS', 'Android', 'Desktop'] as const).map((os) => (
                        <button
                          key={os}
                          type="button"
                          onClick={() => setSelectedOs(os)}
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded ${
                            selectedOs === os ? 'bg-amber-200 text-amber-900' : 'text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {os}
                        </button>
                      ))}
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[10px] text-slate-700">
                      {currentGuide.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              /* Live Camera Stream with QR targeting reticle */
              <div className="relative aspect-square max-h-72 w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Overlay */}
                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-dashed border-[#009A60] rounded-2xl relative animate-pulse flex items-center justify-center">
                    <div className="w-12 h-0.5 bg-[#009A60] shadow-xs"></div>
                  </div>
                </div>

                <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                  <span className="bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-xs">
                    Align guest QR voucher code inside box
                  </span>
                </div>
              </div>
            )}

            {/* Manual Fallback Input (Always available!) */}
            <div className="pt-2">
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Manual Entry Alternative
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleManualVerify} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Enter 8-digit Booking Reference or Voucher Code:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. MZB-872198"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009A60] uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Search size={13} />
                    <span>Verify</span>
                  </button>
                </div>
              </form>

              {/* Upload QR Image Alternative */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#009A60] hover:text-[#008250] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Upload size={13} />
              <span>Upload voucher photo</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Permission Rationale Modal */}
      {showPromptModal && (
        <PermissionPromptModal
          isOpen={showPromptModal}
          type="camera"
          title="Allow MozBook to Access Camera?"
          rationale="Allow camera access to scan guest QR voucher."
          detail="MozBook uses your device camera solely to scan guest check-in QR passes. We never capture or save personal background images during check-in."
          onClose={() => setShowPromptModal(false)}
          onGranted={() => {
            setShowPromptModal(false);
            startCamera();
          }}
          onDenied={(err) => {
            setShowPromptModal(false);
            setCameraError(err || 'Camera permission was denied.');
          }}
        />
      )}
    </>
  );
}
