import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  MapPin, 
  Users,
  ShieldCheck, 
  X, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Smartphone, 
  RefreshCw, 
  RotateCcw,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { permissionService, PermissionType, PermissionState, PHONE_SETTINGS_GUIDES } from '../services/permissionService';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppSettingsModal({ isOpen, onClose }: AppSettingsModalProps) {
  const [cameraStatus, setCameraStatus] = useState<PermissionState>('prompt');
  const [locationStatus, setLocationStatus] = useState<PermissionState>('prompt');
  const [contactsSupported, setContactsSupported] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'permissions' | 'guide'>('permissions');
  const [guideOs, setGuideOs] = useState<'iOS' | 'Android' | 'Desktop'>('iOS');
  const [guideType, setGuideType] = useState<PermissionType>('camera');
  const [testingType, setTestingType] = useState<PermissionType | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatuses();
    }
  }, [isOpen]);

  const loadStatuses = async () => {
    const cam = await permissionService.queryNativeState('camera');
    const loc = await permissionService.queryNativeState('location');
    setCameraStatus(cam);
    setLocationStatus(loc);
    setContactsSupported(permissionService.isContactPickerSupported());
  };

  if (!isOpen) return null;

  const handleTestPermission = async (type: 'camera' | 'location') => {
    setTestingType(type);
    setTestResult(null);

    if (type === 'camera') {
      const res = await permissionService.requestCamera();
      setTestingType(null);
      await loadStatuses();
      if (res.success) {
        setTestResult('Camera access successfully verified and active!');
      } else {
        setTestResult(res.error || 'Camera permission not granted.');
      }
    } else if (type === 'location') {
      const res = await permissionService.requestLocation();
      setTestingType(null);
      await loadStatuses();
      if (res.success && res.coords) {
        setTestResult(`Location verified! Coords: ${res.coords.lat}, ${res.coords.lng}`);
      } else {
        setTestResult(res.error || 'Location permission not granted.');
      }
    }
  };

  const handleReset = (type: 'camera' | 'location') => {
    permissionService.reset(type);
    loadStatuses();
    setTestResult(`Reset ${type} stored preference. The app will solicit permission again on next use.`);
  };

  const getStatusBadge = (status: PermissionState) => {
    if (status === 'granted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={13} /> Allowed
        </span>
      );
    }
    if (status === 'denied') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
          <XCircle size={13} /> Blocked / Denied
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
        <HelpCircle size={13} /> Not Solicited Yet
      </span>
    );
  };

  const activeGuides = PHONE_SETTINGS_GUIDES[guideType];
  const currentGuide = activeGuides.find((g) => g.os === guideOs) || activeGuides[0];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e6f7f0] border border-[#a4e4c7] flex items-center justify-center text-[#009A60]">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">App Permissions & Privacy</h2>
              <p className="text-xs text-gray-500">Manage device permissions for MozBook</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'permissions'
                ? 'border-[#009A60] text-[#009A60]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Current Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'guide'
                ? 'border-[#009A60] text-[#009A60]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Phone Settings Guide
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {testResult && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 flex items-center justify-between">
              <span>{testResult}</span>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-gray-400 hover:text-gray-700 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'permissions' ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Permissions are requested once off only when you solicit features like capturing photos, detecting your GPS spot, or inviting travel companions. Once allowed, MozBook will not ask again.
              </p>

              {/* Camera Row */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[#009A60]">
                    <Camera size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">Camera Access</h4>
                      {getStatusBadge(cameraStatus)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Used for room photos, host ID verification & QR check-in scanning
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleTestPermission('camera')}
                    disabled={testingType === 'camera'}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingType === 'camera' ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReset('camera')}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                    title="Reset stored prompt status"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Location Row */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[#009A60]">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">Location (GPS)</h4>
                      {getStatusBadge(locationStatus)}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Used for "What's Around You", discovery & host GPS pinpointing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleTestPermission('location')}
                    disabled={testingType === 'location'}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingType === 'location' ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReset('location')}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                    title="Reset stored prompt status"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Contacts Row */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[#009A60]">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-900">Contacts</h4>
                      {contactsSupported ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} /> Available on this device
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          <HelpCircle size={13} /> Available when supported
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Used to invite travel companions directly from your phone address book
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium">
                    {contactsSupported ? 'Web Contact Picker API' : 'Manual / Link Available'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-[#e6f7f0] border border-[#a4e4c7] rounded-xl text-xs text-[#007a4c] flex items-start gap-2.5">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-[#009A60]" />
                <div>
                  <span className="font-bold">Privacy Guaranteed: </span>
                  MozBook only accesses camera when taking photos or scanning QR codes, location when finding nearby spots or pinpointing your property, and contacts only when you actively select a companion to invite. We never upload your full address book.
                </div>
              </div>
            </div>
          ) : (
            /* Guide Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {/* Select Permission Type */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGuideType('camera')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      guideType === 'camera'
                        ? 'bg-[#009A60] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideType('location')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      guideType === 'location'
                        ? 'bg-[#009A60] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideType('contacts')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      guideType === 'contacts'
                        ? 'bg-[#009A60] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Contacts
                  </button>
                </div>

                {/* Select OS */}
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {(['iOS', 'Android', 'Desktop'] as const).map((os) => (
                    <button
                      key={os}
                      type="button"
                      onClick={() => setGuideOs(os)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                        guideOs === os
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {os === 'iOS' ? 'iPhone' : os}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Smartphone size={16} className="text-[#009A60]" />
                  <span>{currentGuide.title}</span>
                </div>

                <ol className="space-y-2 text-xs text-gray-700">
                  {currentGuide.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#e6f7f0] text-[#009A60] font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="mt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
