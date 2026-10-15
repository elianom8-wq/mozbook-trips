import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Bell, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';
import { ExpiryStatus, sendRenewalReminder, DocType } from '../services/listingService';

interface DocumentExpiryTrackerProps {
  expiryDate?: string;
  issueDate?: string;
  daysUntilExpiry?: number;
  expiryStatus?: ExpiryStatus;
  isExpired?: boolean;
  inGracePeriod?: boolean;
  gracePeriodDaysRemaining?: number;
  suspensionEffectiveDate?: string;
  isSuspended?: boolean;
  hostName: string;
  userEmail: string;
  docType: DocType;
  docNumber?: string;
  nationality?: string;
  securityFeatures?: string[];
  validationNotes?: string;
  showReminderAction?: boolean;
}

export default function DocumentExpiryTracker({
  expiryDate,
  issueDate,
  daysUntilExpiry,
  expiryStatus,
  isExpired,
  inGracePeriod,
  gracePeriodDaysRemaining,
  suspensionEffectiveDate,
  isSuspended,
  hostName,
  userEmail,
  docType,
  docNumber,
  nationality,
  securityFeatures,
  validationNotes,
  showReminderAction = true,
}: DocumentExpiryTrackerProps) {
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const handleSendReminder = async () => {
    if (!expiryDate) return;
    setReminderSending(true);
    try {
      const res = await sendRenewalReminder({
        hostName,
        userEmail,
        docType,
        expiryDate,
        daysUntilExpiry: daysUntilExpiry || 0,
      });
      setReminderSent(true);
      setReminderMessage(res.message || 'Renewal alert sent to host.');
      setTimeout(() => setReminderMessage(null), 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setReminderSending(false);
    }
  };

  const status = expiryStatus || (isExpired ? 'expired' : 'valid');
  const isGrace = inGracePeriod || (status === 'expired' && daysUntilExpiry !== undefined && daysUntilExpiry < 0 && daysUntilExpiry >= -90);
  const effectiveSuspended = isSuspended || (status === 'expired' && daysUntilExpiry !== undefined && daysUntilExpiry < -90);

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      effectiveSuspended
        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
        : isGrace
        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
        : status === 'expiring_soon'
        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
        : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
    }`}>
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-black/5">
        <div className="flex items-center gap-2.5">
          {effectiveSuspended ? (
            <AlertCircle size={22} className="text-rose-600 shrink-0" />
          ) : isGrace ? (
            <AlertTriangle size={22} className="text-amber-600 shrink-0" />
          ) : status === 'expiring_soon' ? (
            <Clock size={22} className="text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
          )}

          <div>
            <h4 className="font-bold text-sm tracking-tight">
              {effectiveSuspended && 'Verification Suspended — Grace Period Elapsed'}
              {!effectiveSuspended && isGrace && 'Document Expired — In 90-Day Grace Period'}
              {!effectiveSuspended && !isGrace && status === 'expiring_soon' && 'Document Expiring Soon — Renewal Required'}
              {!effectiveSuspended && !isGrace && status === 'valid' && 'Document Unexpired — Expiration Date Tracked'}
            </h4>
            <p className="text-xs opacity-75">
              {suspensionEffectiveDate
                ? `Automatic suspension takes effect on ${suspensionEffectiveDate} (90-day post-expiry grace period)`
                : 'Calculated against current date and stored expiration date for host verification compliance'}
            </p>
          </div>
        </div>

        {/* Badge */}
        <div className="shrink-0">
          {effectiveSuspended ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-200 text-rose-800 text-xs font-bold rounded-full uppercase tracking-wider">
              Suspended
            </span>
          ) : isGrace ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-full uppercase tracking-wider">
              Grace Period ({gracePeriodDaysRemaining ?? (daysUntilExpiry !== undefined ? 90 + daysUntilExpiry : 'Active')}d left)
            </span>
          ) : status === 'expiring_soon' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-full uppercase tracking-wider">
              Expiring Soon
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-200 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider">
              Unexpired
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
        <div className="p-2.5 bg-white/70 rounded-xl border border-black/5">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Expiry Date</span>
          <span className="text-sm font-extrabold text-gray-900 font-mono mt-0.5 block">
            {expiryDate || 'N/A'}
          </span>
        </div>

        <div className="p-2.5 bg-white/70 rounded-xl border border-black/5">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">
            {isGrace ? 'Grace Days Remaining' : 'Remaining Time'}
          </span>
          <span className={`text-sm font-extrabold font-mono mt-0.5 block ${
            effectiveSuspended ? 'text-rose-600' : (isGrace || status === 'expiring_soon') ? 'text-amber-600' : 'text-emerald-700'
          }`}>
            {isGrace
              ? `${gracePeriodDaysRemaining ?? (daysUntilExpiry !== undefined ? 90 + daysUntilExpiry : 0)} days until suspension`
              : daysUntilExpiry !== undefined
              ? daysUntilExpiry <= 0
                ? `${Math.abs(daysUntilExpiry)} days ago`
                : `${daysUntilExpiry} days left`
              : 'Verified'}
          </span>
        </div>

        {suspensionEffectiveDate ? (
          <div className="p-2.5 bg-white/70 rounded-xl border border-black/5">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Suspension Date</span>
            <span className="text-sm font-semibold text-gray-800 font-mono mt-0.5 block">
              {suspensionEffectiveDate}
            </span>
          </div>
        ) : issueDate ? (
          <div className="p-2.5 bg-white/70 rounded-xl border border-black/5">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Issue Date</span>
            <span className="text-sm font-semibold text-gray-800 font-mono mt-0.5 block">
              {issueDate}
            </span>
          </div>
        ) : null}

        {nationality && (
          <div className="p-2.5 bg-white/70 rounded-xl border border-black/5">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Nationality</span>
            <span className="text-xs font-semibold text-gray-800 truncate mt-0.5 block">
              {nationality}
            </span>
          </div>
        )}
      </div>

      {/* Expiry guidance & Warning Banner */}
      {effectiveSuspended && (
        <div className="mt-3 p-3 bg-rose-100/90 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p>
            <strong>Crucial Notice:</strong> This document expired on {expiryDate || 'past date'} and has exceeded the 90-day grace period. Platform listings are currently suspended from receiving new reservations. Please upload your renewed B.I., D.I.R.E. or passport immediately to restore verified booking status.
          </p>
        </div>
      )}

      {!effectiveSuspended && isGrace && (
        <div className="mt-3 p-3 bg-amber-100/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p>
            <strong>90-Day Grace Period Active:</strong> Your document expired on {expiryDate}. Your listings remain active during this 90-day grace period ({gracePeriodDaysRemaining ?? (daysUntilExpiry !== undefined ? 90 + daysUntilExpiry : 0)} days remaining). If renewed documents are not approved before {suspensionEffectiveDate || 'the end of grace period'}, listings will be automatically suspended from booking.
          </p>
        </div>
      )}

      {!effectiveSuspended && !isGrace && status === 'expiring_soon' && (
        <div className="mt-3 p-3 bg-amber-100/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <Clock size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p>
            <strong>Renewal Alert:</strong> Your document expires in less than 6 months. To ensure your calendar and host account remain active without interruption, please renew with the civil registration / migration bureau and upload the updated document before expiration.
          </p>
        </div>
      )}

      {/* Validation Notes from AI */}
      {validationNotes && (
        <div className="mt-3 text-xs text-gray-700 bg-white/60 p-2.5 rounded-xl border border-black/5 flex items-start gap-2">
          <Info size={14} className="text-gray-500 shrink-0 mt-0.5" />
          <span><strong>AI Inspection Notes:</strong> {validationNotes}</span>
        </div>
      )}

      {/* Security Features Detected */}
      {securityFeatures && securityFeatures.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-gray-500 mr-1">Security Markers:</span>
          {securityFeatures.map((feat, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-white/80 border border-black/5 rounded-full text-[10px] font-semibold text-gray-700 uppercase tracking-wider"
            >
              ✓ {feat.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Reminder Action for Host / Admin */}
      {showReminderAction && (
        <div className="mt-4 pt-3 border-t border-black/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs text-gray-600 flex items-center gap-1.5">
            <Bell size={14} className="text-gray-400" />
            <span>Automated renewal notifications will remind you 30, 15, and 7 days prior to expiry.</span>
          </span>

          <button
            type="button"
            disabled={reminderSending || reminderSent}
            onClick={handleSendReminder}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              reminderSent
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 shadow-xs'
            }`}
          >
            {reminderSending ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : reminderSent ? (
              <>
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Renewal Reminder Scheduled</span>
              </>
            ) : (
              <>
                <Bell size={12} />
                <span>Send Test Renewal Alert</span>
              </>
            )}
          </button>
        </div>
      )}

      {reminderMessage && (
        <div className="mt-2 text-xs text-emerald-800 bg-emerald-100/70 p-2 rounded-lg font-medium">
          ✓ {reminderMessage}
        </div>
      )}
    </div>
  );
}
