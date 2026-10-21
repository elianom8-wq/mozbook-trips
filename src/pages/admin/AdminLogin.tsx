import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  LogOut, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import MozBookLogo from '../../components/MozBookLogo';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { user, isAdmin, loading, login, logout } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated as admin, route directly to dashboard
  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      await login();
      // On success, AuthContext onAuthStateChanged verifies mozbookinfo@gmail.com and navigates
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Verifying Administrator Credentials...
          </p>
        </div>
      </div>
    );
  }

  // CASE 2: Authenticated but not authorized as admin
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Access Restricted
          </h2>

          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            You are signed in as <strong className="text-slate-200 font-mono">{user.email}</strong>. 
            This account does not have administrator privileges to access this area.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => logout()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out / Switch account</span>
            </button>

            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Return to MozBook Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // CASE 1: Not authenticated (or logging in)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-md w-full mx-auto my-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-2xl mb-4 shadow-lg shadow-black/50">
            <MozBookLogo variant="full" size="md" theme="dark" preferVector />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
            <ShieldCheck size={13} />
            <span>Operations Console</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Admin Authentication
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Secure internal gateway for MozBook platform administration
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-950/60 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Authorized Personnel Notice */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-6">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Authorized Personnel Only
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Google Authentication required. Please sign in using an authorized MozBook administrator account.
            </p>
          </div>

          {/* Google Sign-In Action Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#ffffff"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#ffffff"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#ffffff"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#ffffff"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{submitting ? 'Verifying...' : 'Sign in with Google Administrator Account'}</span>
            <ArrowRight size={14} />
          </button>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <div className="text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
              <Lock size={12} className="text-emerald-500" />
              <span>Zero password stored on frontend. Google OAuth verified.</span>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs text-slate-500 hover:text-slate-300 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to public MozBook booking site</span>
          </Link>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-600 font-mono">
        MozBook Operations Console • Phase 1A Secure Admin Role
      </div>
    </div>
  );
}
