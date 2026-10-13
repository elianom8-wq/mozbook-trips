import React, { useState } from 'react';
import { Camera, MapPin, Users, ShieldCheck, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { permissionService, PermissionType, PHONE_SETTINGS_GUIDES, PERMISSION_PURPOSES, ContactInfo } from '../services/permissionService';

interface PermissionPromptModalProps {
  isOpen: boolean;
  type: PermissionType;
  title?: string;
  rationale?: string;
  detail?: string;
  onClose: () => void;
  onGranted: (data?: { coords?: { lat: number; lng: number }; contacts?: ContactInfo[]; nativeSupported?: boolean }) => void;
  onDenied?: (error?: string) => void;
}

export default function PermissionPromptModal({
  isOpen,
  type,
  title,
  rationale,
  detail,
  onClose,
  onGranted,
  onDenied,
}: PermissionPromptModalProps) {
  const [requesting, setRequesting] = useState(false);
  const [deniedError, setDeniedError] = useState<string | null>(null);
  const [selectedOs, setSelectedOs] = useState<'iOS' | 'Android' | 'Desktop'>('iOS');

  if (!isOpen) return null;

  const standardPurpose = PERMISSION_PURPOSES[type];
  const displayTitle = title || standardPurpose.title;
  const displayRationale = rationale || standardPurpose.rationale;
  const displayDetail = detail || standardPurpose.detail;

  const guides = PHONE_SETTINGS_GUIDES[type];
  const activeGuide = guides.find((g) => g.os === selectedOs) || guides[0];

  const handleAllowClick = async () => {
    setRequesting(true);
    setDeniedError(null);

    try {
      if (type === 'camera') {
        const result = await permissionService.requestCamera();
        setRequesting(false);
        if (result.success) {
          onGranted({});
          onClose();
        } else {
          setDeniedError(result.error || standardPurpose.deniedAdvice);
          if (onDenied) onDenied(result.error);
        }
      } else if (type === 'location') {
        const result = await permissionService.requestLocation();
        setRequesting(false);
        if (result.success) {
          onGranted({ coords: result.coords });
          onClose();
        } else {
          setDeniedError(result.error || standardPurpose.deniedAdvice);
          if (onDenied) onDenied(result.error);
        }
      } else if (type === 'contacts') {
        const result = await permissionService.requestContacts();
        setRequesting(false);
        if (result.success) {
          onGranted({ contacts: result.contacts, nativeSupported: result.nativeSupported });
          onClose();
        } else {
          setDeniedError(result.error || standardPurpose.deniedAdvice);
          if (onDenied) onDenied(result.error);
        }
      }
    } catch (err: any) {
      setRequesting(false);
      setDeniedError(err.message || 'An unexpected error occurred while requesting permission.');
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'camera':
        return <Camera size={26} />;
      case 'location':
        return <MapPin size={26} />;
      case 'contacts':
        return <Users size={26} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 transition-all">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-[#e6f7f0] border border-[#a4e4c7] flex items-center justify-center text-[#009A60] shadow-xs">
              {getIcon()}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold mb-2">
              <ShieldCheck size={13} className="text-[#009A60]" />
              <span>One-Off Permission Request</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {displayTitle}
            </h2>
            <p className="text-sm font-semibold text-gray-800 mt-2 leading-relaxed">
              "{displayRationale}"
            </p>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {displayDetail}
            </p>
          </div>

          {/* Key promise card */}
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-2 text-gray-800 font-semibold">
              <Check size={14} className="text-[#009A60]" />
              <span>Privacy protected & never asked repeatedly</span>
            </div>
            <p className="text-gray-500 pl-5 text-[11px]">
              {type === 'contacts'
                ? 'Only the companion you choose is accessed. MozBook never uploads your full address book to our database.'
                : 'Once permission is granted, MozBook remembers your preference and will not ask again. You can adjust this anytime in phone settings.'}
            </p>
          </div>

          {/* If denied error occurred */}
          {deniedError && (
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="font-semibold">{deniedError}</div>
              </div>
              <p className="text-[11px] text-amber-800">
                To enable access, adjust the permission in your phone settings below:
              </p>

              {/* OS Tabs for phone settings */}
              <div className="pt-2">
                <div className="flex gap-1 border-b border-amber-200 pb-1 mb-2">
                  {(['iOS', 'Android', 'Desktop'] as const).map((os) => (
                    <button
                      key={os}
                      type="button"
                      onClick={() => setSelectedOs(os)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                        selectedOs === os
                          ? 'bg-amber-200 text-amber-900'
                          : 'text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {os === 'iOS' ? 'iPhone' : os}
                    </button>
                  ))}
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-700 font-medium">
                  {activeGuide.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Not Now
          </button>

          <button
            type="button"
            onClick={handleAllowClick}
            disabled={requesting}
            className="px-5 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {requesting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Prompting Device...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Allow & Continue</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
