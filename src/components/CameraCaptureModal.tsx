import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle, Smartphone, Upload, ShieldCheck } from 'lucide-react';
import { permissionService, PHONE_SETTINGS_GUIDES } from '../services/permissionService';
import PermissionPromptModal from './PermissionPromptModal';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title: string;
  subtitle?: string;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title,
  subtitle,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showSettingsGuide, setShowSettingsGuide] = useState(false);
  const [guideOs, setGuideOs] = useState<'iOS' | 'Android' | 'Desktop'>('iOS');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPhoto(null);
      setCameraError(null);
      setShowPromptModal(false);
      setShowSettingsGuide(false);
      return;
    }

    // Check if permission has been solicited or granted
    const isGranted = permissionService.isGranted('camera');
    const hasSolicited = permissionService.hasBeenSolicited('camera');

    if (!isGranted && !hasSolicited) {
      // First time solicitation: show the native-like one-off rationale prompt
      setShowPromptModal(true);
    } else {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported in this browser environment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // User allowed camera: mark granted in permissionService so it won't ever ask again
      permissionService.saveStatus('camera', 'granted');
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      if (isDenied) {
        permissionService.saveStatus('camera', 'denied');
      }
      setCameraError(
        isDenied
          ? 'Camera permission is blocked or denied. You can enable it in your phone settings or upload a photo directly.'
          : err.message || 'Unable to access camera.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedPhoto(dataUrl);
        stopCamera();
        setCameraError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const cameraGuides = PHONE_SETTINGS_GUIDES.camera;
  const currentGuide = cameraGuides.find((g) => g.os === guideOs) || cameraGuides[0];

  return (
    <>
      {/* One-off rationale modal if not solicited yet */}
      {showPromptModal && (
        <PermissionPromptModal
          isOpen={showPromptModal}
          type="camera"
          onClose={() => {
            setShowPromptModal(false);
            onClose();
          }}
          onGranted={() => {
            setShowPromptModal(false);
            startCamera();
          }}
          onDenied={() => {
            setShowPromptModal(false);
            setCameraError('Camera permission was denied. You can enable it in phone settings or upload an image file.');
          }}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
        <div className="bg-gray-900 text-white rounded-2xl max-w-xl w-full overflow-hidden border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Camera size={18} className="text-[#009A60]" />
                <span>{title}</span>
              </h3>
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Viewport */}
          <div className="relative bg-black min-h-[320px] sm:min-h-[380px] flex items-center justify-center overflow-hidden flex-1">
            {cameraError ? (
              <div className="text-center p-6 space-y-4 max-w-md">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Camera Access Required</h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">{cameraError}</p>
                </div>

                {/* Settings Guide Toggle */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSettingsGuide(!showSettingsGuide)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#009A60] hover:text-[#34d399] font-semibold underline cursor-pointer"
                  >
                    <Smartphone size={14} />
                    <span>{showSettingsGuide ? 'Hide Settings Guide' : 'How to allow in Phone Settings'}</span>
                  </button>

                  {showSettingsGuide && (
                    <div className="mt-3 p-3 bg-gray-800/90 border border-gray-700 rounded-xl text-left text-xs space-y-2">
                      <div className="flex gap-1 border-b border-gray-700 pb-1.5">
                        {(['iOS', 'Android', 'Desktop'] as const).map((os) => (
                          <button
                            key={os}
                            type="button"
                            onClick={() => setGuideOs(os)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                              guideOs === os
                                ? 'bg-[#009A60] text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {os === 'iOS' ? 'iPhone' : os}
                          </button>
                        ))}
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-gray-300 text-[11px]">
                        {currentGuide.steps.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* Actions when camera error occurs */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => startCamera()}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    <span>Try Again</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload size={14} />
                    <span>Choose Photo File</span>
                  </button>
                </div>
              </div>
            ) : capturedPhoto ? (
              <div className="relative w-full h-full">
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  className="w-full h-full object-contain max-h-[420px]"
                />
                <div className="absolute top-3 left-3 bg-black/70 px-2.5 py-1 rounded-full text-xs text-emerald-400 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  <span>Photo Captured</span>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain max-h-[420px]"
                />

                {/* Framing guide */}
                <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-[#009A60]/80 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                  <span className="text-[11px] bg-black/60 px-2 py-0.5 rounded text-[#a4e4c7] self-start">
                    Align within guide
                  </span>
                  <span className="text-[11px] bg-black/60 px-2 py-0.5 rounded text-gray-300 self-end">
                    MozBook HD
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Hidden Canvas for capture rendering */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Footer controls */}
          <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-3">
            {!capturedPhoto ? (
              <>
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Switch Camera</span>
                </button>

                <button
                  type="button"
                  disabled={!!cameraError}
                  onClick={handleTakePhoto}
                  className="px-6 py-2.5 bg-[#009A60] hover:bg-[#008250] disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-[#009A60]/30 transition-all cursor-pointer"
                >
                  <Camera size={18} />
                  <span>Take Photo</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Retake</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-5 py-2 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#009A60]/30 cursor-pointer"
                  >
                    <Check size={16} />
                    <span>Use This Photo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
