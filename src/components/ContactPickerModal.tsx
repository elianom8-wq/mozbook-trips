import React, { useState } from 'react';
import { 
  Users, 
  X, 
  Mail, 
  Phone, 
  Copy, 
  Check, 
  Share2, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight,
  Send
} from 'lucide-react';
import { permissionService, ContactInfo } from '../services/permissionService';
import { travelGroupService } from '../services/travelGroupService';
import { useAuth } from '../context/AuthContext';

interface ContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact?: (contact: ContactInfo) => void;
  groupId?: string;
  groupName?: string;
  invitationToken?: string;
}

export default function ContactPickerModal({
  isOpen,
  onClose,
  onSelectContact,
  groupId,
  groupName,
  invitationToken,
}: ContactPickerModalProps) {
  const { user } = useAuth();
  const isSupported = permissionService.isContactPickerSupported();

  // Tab for unsupported/manual alternatives: 'email' | 'phone' | 'link'
  const [manualMethod, setManualMethod] = useState<'email' | 'phone' | 'link'>('email');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // For supported picker state
  const [pickerLaunched, setPickerLaunched] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactInfo | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const inviteLink = invitationToken
    ? `${window.location.origin}/travel-companion/invite/${invitationToken}`
    : `${window.location.origin}/travel-companion`;

  // Launch the native contact picker (supported browsers only)
  const handleOpenNativePicker = async () => {
    setPickerLaunched(true);
    setPickerError(null);
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await permissionService.requestContacts({ multiple: false });
      setLoading(false);

      if (res.success && res.contacts && res.contacts.length > 0) {
        const contact = res.contacts[0];
        setSelectedContact(contact);
      } else {
        setPickerError(res.error || 'No contact was selected.');
      }
    } catch (err: any) {
      setLoading(false);
      setPickerError(err?.message || 'Unable to access contacts.');
    }
  };

  // Submit the selected contact from the native picker
  const handleConfirmSelectedContact = async () => {
    if (!selectedContact) return;

    if (onSelectContact) {
      onSelectContact(selectedContact);
      onClose();
      return;
    }

    const identifier = selectedContact.email || selectedContact.tel || selectedContact.name || '';
    if (!identifier) {
      setErrorMsg('The selected contact does not have an email or phone number.');
      return;
    }

    if (groupId && user) {
      setLoading(true);
      setErrorMsg(null);
      try {
        await travelGroupService.inviteMember(
          groupId,
          { uid: user.uid, displayName: user.displayName || 'Group Host' },
          identifier
        );
        setSuccessMsg(`Invitation sent to ${selectedContact.name || identifier}!`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to send invitation');
      } finally {
        setLoading(false);
      }
    } else {
      onClose();
    }
  };

  // Submit manual invite (email or phone)
  const handleSendManualInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = manualMethod === 'email' ? manualEmail.trim() : manualPhone.trim();
    if (!identifier) {
      setErrorMsg(manualMethod === 'email' ? 'Please enter a valid email' : 'Please enter a phone number');
      return;
    }

    if (onSelectContact) {
      onSelectContact(
        manualMethod === 'email' ? { email: identifier } : { tel: identifier }
      );
      onClose();
      return;
    }

    if (groupId && user) {
      setLoading(true);
      setErrorMsg(null);
      try {
        await travelGroupService.inviteMember(
          groupId,
          { uid: user.uid, displayName: user.displayName || 'Group Host' },
          identifier
        );
        setSuccessMsg(`Invitation sent to ${identifier}!`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to send invitation');
      } finally {
        setLoading(false);
      }
    } else {
      setSuccessMsg(`Companion details saved for ${identifier}!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  // Copy invitation link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Share via Web Share API or WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join my Mozambique travel group on MozBook! Open link: ${inviteLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#e6f7f0] border border-[#a4e4c7] flex items-center justify-center text-[#009A60]">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Invite from Contacts</h3>
              <p className="text-xs text-slate-500">
                {groupName ? `Invite to ${groupName}` : 'Add a companion to your travel group'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Status feedback */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800">
              <Check size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CASE A: Contacts Picker IS SUPPORTED */}
          {isSupported ? (
            <div className="space-y-4">
              {!selectedContact ? (
                <>
                  {/* Privacy Rationale Explanation */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={20} className="text-[#009A60] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                          Why MozBook Needs Contacts Access
                        </h4>
                        <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                          MozBook allows you to select companions directly from your device contact book so you don't have to enter their details manually.
                        </p>
                      </div>
                    </div>

                    <ul className="text-[11px] text-emerald-800 space-y-1 pt-1 border-t border-emerald-200/60 pl-6 list-disc">
                      <li>Only the contact you explicitly choose will be used for the invitation.</li>
                      <li>We never download, store, or upload your full address book.</li>
                      <li>No background contact synchronization or bulk data collection.</li>
                    </ul>
                  </div>

                  {pickerError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{pickerError}</span>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          You can try opening the picker again or enter details manually below.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Open Native Picker Button */}
                  <button
                    type="button"
                    onClick={handleOpenNativePicker}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl shadow-md shadow-[#009A60]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Opening device contacts...</span>
                      </>
                    ) : (
                      <>
                        <Users size={16} />
                        <span>Open Device Contact Picker</span>
                      </>
                    )}
                  </button>

                  {/* Manual fallback separator */}
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Or Invite Manually
                    </span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                </>
              ) : (
                /* Selected Contact Display */
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Selected Companion
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedContact(null)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
                    >
                      Change Contact
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-100">
                    <div className="w-10 h-10 rounded-full bg-[#e6f7f0] text-[#009A60] font-bold flex items-center justify-center shrink-0">
                      {selectedContact.name?.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedContact.name || 'Unnamed Contact'}
                      </p>
                      {selectedContact.email && (
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <Mail size={11} className="text-slate-400 shrink-0" />
                          <span>{selectedContact.email}</span>
                        </p>
                      )}
                      {selectedContact.tel && (
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <Phone size={11} className="text-slate-400 shrink-0" />
                          <span>{selectedContact.tel}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmSelectedContact}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#009A60] hover:bg-[#008250] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>Send Travel Invitation</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CASE B: Contacts Picker IS NOT SUPPORTED */
            <div className="space-y-4">
              {/* Clear Unsupported Banner */}
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-start gap-2.5">
                  <Smartphone size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      Contacts aren't supported on this device/browser.
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      The Web Contact Picker API is only available on compatible mobile browsers (such as Chrome on Android). On this device, you can invite your companion using the options below:
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MANUAL ALTERNATIVES (Shown always when unsupported, or as fallback when supported) */}
          {(!isSupported || pickerLaunched || !selectedContact) && (
            <div className="space-y-3 pt-1">
              {/* Method Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setManualMethod('email');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer ${
                    manualMethod === 'email'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Enter Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualMethod('phone');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer ${
                    manualMethod === 'phone'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Enter Phone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualMethod('link');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-colors cursor-pointer ${
                    manualMethod === 'link'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Share Link
                </button>
              </div>

              {/* Tab 1: Manual Email */}
              {manualMethod === 'email' && (
                <form onSubmit={handleSendManualInvite} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Companion's Email Address
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="friend@example.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Send Invitation to Email</span>
                    <ArrowRight size={13} />
                  </button>
                </form>
              )}

              {/* Tab 2: Manual Phone */}
              {manualMethod === 'phone' && (
                <form onSubmit={handleSendManualInvite} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Companion's Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        required
                        placeholder="+258 84 123 4567"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#009A60]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Send Invitation to Phone</span>
                    <ArrowRight size={13} />
                  </button>
                </form>
              )}

              {/* Tab 3: Copy / Share Link */}
              {manualMethod === 'link' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Travel Companion Invitation Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteLink}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 select-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3 py-2.5 bg-[#009A60] hover:bg-[#008250] text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Share2 size={13} />
                      <span>Share on WhatsApp</span>
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.share({
                              title: 'MozBook Travel Companion',
                              text: 'Join my travel group on MozBook!',
                              url: inviteLink,
                            });
                          } catch {
                            // User cancelled share
                          }
                        }}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <span>More...</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Privacy: Only selected contacts are used
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
