import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Loader2, Sparkles, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import MozBookLogo from './MozBookLogo';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    authModalMode, 
    closeAuthModal, 
    openAuthModal,
    login, 
    loginWithRedirect,
    authError, 
    clearAuthError,
    loading 
  } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(false);

  useEffect(() => {
    if (isAuthModalOpen) {
      setLocalError(null);
      setPopupBlocked(false);
      setUnauthorizedDomain(false);
      clearAuthError();
    }
  }, [isAuthModalOpen]);

  // Sync auth context error into local display
  useEffect(() => {
    if (authError) {
      setLocalError(authError);
      if (authError.toLowerCase().includes('popup') || authError.toLowerCase().includes('blocked')) {
        setPopupBlocked(true);
      }
      if (authError.toLowerCase().includes('unauthorized-domain') || authError.toLowerCase().includes('authorized domain')) {
        setUnauthorizedDomain(true);
      }
    }
  }, [authError]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const isSignUp = authModalMode === 'signup';

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setPopupBlocked(false);
    setUnauthorizedDomain(false);
    clearAuthError();
    setIsSubmitting(true);

    try {
      await login();
      // On success, AuthContext listener will update state and modal can close
      closeAuthModal();
    } catch (err: any) {
      console.warn('Google sign-in attempt error:', err);
      const code = err?.code || '';
      const msg = err?.message || '';

      if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setPopupBlocked(true);
        setLocalError('The Google Sign-in popup was blocked by your browser. You can sign in using redirect below or allow popups for this site.');
      } else if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        setUnauthorizedDomain(true);
        setLocalError('Domain authorization required: This custom domain (mozbookings.com) must be added to Firebase Authorized Domains in the Firebase Console.');
      } else if (code === 'auth/popup-closed-by-user') {
        setLocalError('Sign-in cancelled: The Google popup window was closed before completing sign-in.');
      } else {
        setLocalError(msg || 'Failed to complete Google Sign-in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await loginWithRedirect();
      // Browser will navigate away to Google OAuth
    } catch (err: any) {
      console.error('Redirect sign-in error:', err);
      setLocalError(err?.message || 'Failed to initiate redirect sign-in.');
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
        {/* Top Header Pattern */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[#e6f7f0]/60 to-transparent border-b border-gray-100/80">
          <button
            onClick={closeAuthModal}
            className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <MozBookLogo variant="full" size="sm" />
          </div>

          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {isSignUp ? 'Create your MozBook account' : 'Welcome back to MozBook'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
            {isSignUp 
              ? 'Join travelers and partners discovering villas, safari lodges, and authentic adventures across Mozambique.'
              : 'Log in to manage your bookings, save favorite properties, and connect with local hosts.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Error Message Callout */}
          {localError && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 border ${
              unauthorizedDomain
                ? 'bg-amber-50 text-amber-950 border-amber-300'
                : 'bg-rose-50 text-rose-950 border-rose-200'
            }`}>
              <AlertCircle size={16} className={`shrink-0 mt-0.5 ${unauthorizedDomain ? 'text-amber-700' : 'text-rose-600'}`} />
              <div className="flex-1 space-y-1.5">
                <p className="font-semibold leading-snug">{localError}</p>
                
                {popupBlocked && (
                  <button
                    onClick={handleRedirectSignIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <span>Sign in with Redirect instead</span>
                    <ArrowRight size={13} />
                  </button>
                )}

                {unauthorizedDomain && (
                  <div className="text-[11px] text-amber-900 leading-relaxed bg-amber-100/70 p-2 rounded-lg border border-amber-200">
                    <strong>Admin Action Required:</strong> In Firebase Console → Authentication → Settings → Authorized Domains, add <code className="font-mono bg-white px-1 py-0.5 rounded text-amber-950">mozbookings.com</code>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Primary Action: Google Authentication */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 border-2 border-gray-200 hover:border-gray-300 rounded-2xl text-sm font-bold text-gray-800 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin text-[#009A60]" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSignUp ? 'Sign up with Google' : 'Continue with Google'}</span>
              </>
            )}
          </button>

          {/* Fallback Redirect Option if user prefers or is on mobile */}
          <div className="pt-1 text-center">
            <button
              onClick={handleRedirectSignIn}
              disabled={isSubmitting || loading}
              className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors cursor-pointer"
            >
              Having popup trouble? Use redirect sign-in
            </button>
          </div>

          {/* MozBook Security & Verification Assurance */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck size={14} className="text-[#009A60]" />
            <span>Secure authentication via Google Identity & Firebase</span>
          </div>

          {/* Toggle between Login and Signup */}
          <div className="pt-2 text-center text-xs text-gray-600">
            {isSignUp ? (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => openAuthModal('login')}
                  className="font-bold text-[#009A60] hover:text-[#008250] hover:underline cursor-pointer"
                >
                  Log in
                </button>
              </p>
            ) : (
              <p>
                Don't have a MozBook account?{' '}
                <button
                  onClick={() => openAuthModal('signup')}
                  className="font-bold text-[#009A60] hover:text-[#008250] hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
